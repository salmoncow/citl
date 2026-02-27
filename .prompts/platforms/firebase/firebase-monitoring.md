# Firebase Monitoring & Observability Implementation

**Status**: Firebase-Specific
**Last Updated**: 2025-11-18
**Core Principles**: See [../../core/operations/monitoring-principles.md](../../core/operations/monitoring-principles.md)

## Overview

Firebase-specific monitoring implementation using Firebase Performance Monitoring, Firebase Analytics, Cloud Logging, and free-tier monitoring services.

For universal monitoring principles, see the [Core Monitoring Principles](../../core/operations/monitoring-principles.md) guide.

---

## Firebase Observability Strategy

When implementing monitoring and observability for this Firebase application, follow these patterns for visibility, alerting, and performance optimization. **For zero-cost monitoring**, see [firebase-finops.md](./firebase-finops.md) for free monitoring strategies.

> 📊 **Free-First Monitoring**: Use UptimeRobot, Discord webhooks, and GitHub Actions for comprehensive monitoring without cost.

### Application Performance Monitoring

#### 1. Firebase Performance Monitoring Integration
```typescript
// lib/monitoring/performance.ts
import { getPerformance, trace, Trace } from 'firebase/performance';
import { getAnalytics, logEvent } from 'firebase/analytics';

export class PerformanceMonitor {
  private perf: any;
  private analytics: any;
  private activeTraces = new Map<string, Trace>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.perf = getPerformance();
      this.analytics = getAnalytics();
    }
  }

  // Start custom trace
  startTrace(name: string, customAttributes?: Record<string, string>): void {
    if (!this.perf) return;

    const customTrace = trace(this.perf, name);

    if (customAttributes) {
      Object.entries(customAttributes).forEach(([key, value]) => {
        customTrace.putAttribute(key, value);
      });
    }

    customTrace.start();
    this.activeTraces.set(name, customTrace);
  }

  // Stop custom trace
  stopTrace(name: string, metrics?: Record<string, number>): void {
    const customTrace = this.activeTraces.get(name);
    if (!customTrace) return;

    if (metrics) {
      Object.entries(metrics).forEach(([key, value]) => {
        customTrace.putMetric(key, value);
      });
    }

    customTrace.stop();
    this.activeTraces.delete(name);
  }

  // Monitor API calls
  async monitorApiCall<T>(
    endpoint: string,
    operation: () => Promise<T>,
    metadata?: Record<string, string>
  ): Promise<T> {
    const traceName = `api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;

    this.startTrace(traceName, {
      endpoint,
      ...metadata,
    });

    const startTime = performance.now();

    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.stopTrace(traceName, {
        duration,
        success: 1,
      });

      // Log successful API call
      this.analytics && logEvent(this.analytics, 'api_call_success', {
        endpoint,
        duration: Math.round(duration),
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.stopTrace(traceName, {
        duration,
        success: 0,
        error: 1,
      });

      // Log failed API call
      this.analytics && logEvent(this.analytics, 'api_call_error', {
        endpoint,
        duration: Math.round(duration),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  // Monitor component render performance
  monitorComponentRender(componentName: string, renderTime: number): void {
    if (!this.analytics) return;

    logEvent(this.analytics, 'component_render', {
      component_name: componentName,
      render_time: Math.round(renderTime),
    });

    // Create performance mark for DevTools
    performance.mark(`${componentName}_render_${Date.now()}`);
  }

  // Monitor user interactions
  monitorUserAction(action: string, metadata?: Record<string, any>): void {
    if (!this.analytics) return;

    logEvent(this.analytics, 'user_action', {
      action_name: action,
      timestamp: Date.now(),
      ...metadata,
    });
  }

  // Monitor business metrics
  trackBusinessMetric(metricName: string, value: number, metadata?: Record<string, any>): void {
    if (!this.analytics) return;

    logEvent(this.analytics, 'business_metric', {
      metric_name: metricName,
      metric_value: value,
      ...metadata,
    });
  }
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const monitor = useMemo(() => new PerformanceMonitor(), []);

  const trackRender = useCallback((componentName: string) => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      monitor.monitorComponentRender(componentName, endTime - startTime);
    };
  }, [monitor]);

  const trackUserAction = useCallback((action: string, metadata?: Record<string, any>) => {
    monitor.monitorUserAction(action, metadata);
  }, [monitor]);

  const trackApiCall = useCallback(async <T>(
    endpoint: string,
    operation: () => Promise<T>,
    metadata?: Record<string, string>
  ): Promise<T> => {
    return monitor.monitorApiCall(endpoint, operation, metadata);
  }, [monitor]);

  return {
    trackRender,
    trackUserAction,
    trackApiCall,
    startTrace: monitor.startTrace.bind(monitor),
    stopTrace: monitor.stopTrace.bind(monitor),
  };
}

// Usage in components
export function UserProfile() {
  const { trackRender, trackUserAction, trackApiCall } = usePerformanceMonitor();

  useEffect(() => {
    const stopTracking = trackRender('UserProfile');
    return stopTracking;
  }, [trackRender]);

  const handleUpdateProfile = async (userData: any) => {
    trackUserAction('profile_update_attempted');

    try {
      await trackApiCall('updateProfile', () => updateUserProfile(userData));
      trackUserAction('profile_update_success');
    } catch (error) {
      trackUserAction('profile_update_failed', { error: error.message });
    }
  };

  return <ProfileForm onSubmit={handleUpdateProfile} />;
}
```

#### 2. Error Tracking and Logging
```typescript
// lib/monitoring/error-tracking.ts
interface ErrorContext {
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: number;
  additionalData?: Record<string, any>;
}

interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  affectedUsers: number;
  topErrors: Array<{ message: string; count: number }>;
}

export class ErrorTracker {
  private errors: Array<{ error: Error; context: ErrorContext; timestamp: number }> = [];
  private maxErrors = 1000; // Keep last 1000 errors in memory

  // Track errors with context
  trackError(error: Error, context: ErrorContext = {}): void {
    const enhancedContext = {
      userId: this.getCurrentUserId(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
      ...context,
    };

    this.errors.push({
      error,
      context: enhancedContext,
      timestamp: Date.now(),
    });

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error tracked:', error, enhancedContext);
    }

    // Send to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(error, enhancedContext);
    }

    // Log to Firebase Analytics
    this.logErrorToAnalytics(error, enhancedContext);
  }

  // Track unhandled errors
  setupGlobalErrorHandling(): void {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.trackError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        { type: 'unhandled_rejection' }
      );
    });
  }

  // Get error metrics
  getErrorMetrics(timeWindow = 24 * 60 * 60 * 1000): ErrorMetrics {
    const cutoff = Date.now() - timeWindow;
    const recentErrors = this.errors.filter(e => e.timestamp > cutoff);

    const errorCounts = new Map<string, number>();
    const affectedUsers = new Set<string>();

    recentErrors.forEach(({ error, context }) => {
      const message = error.message;
      errorCounts.set(message, (errorCounts.get(message) || 0) + 1);

      if (context.userId) {
        affectedUsers.add(context.userId);
      }
    });

    const topErrors = Array.from(errorCounts.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      errorCount: recentErrors.length,
      errorRate: recentErrors.length / (timeWindow / (60 * 1000)), // errors per minute
      affectedUsers: affectedUsers.size,
      topErrors,
    };
  }

  private getCurrentUserId(): string | undefined {
    // Get current user ID from auth context
    return (window as any).currentUserId;
  }

  private async sendToErrorService(error: Error, context: ErrorContext): Promise<void> {
    try {
      // Send to free error tracking service or webhook
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          context,
        }),
      });
    } catch (sendError) {
      console.error('Failed to send error to tracking service:', sendError);
    }
  }

  private logErrorToAnalytics(error: Error, context: ErrorContext): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        custom_map: {
          user_id: context.userId,
          error_context: JSON.stringify(context.additionalData),
        },
      });
    }
  }
}

// React Error Boundary with tracking
export class ErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error?: Error }
> {
  private errorTracker = new ErrorTracker();

  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.errorTracker.trackError(error, {
      componentStack: errorInfo.componentStack,
      type: 'react_error_boundary',
    });
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error }: { error: Error }) {
  return (
    <div className="error-fallback">
      <h2>Something went wrong</h2>
      <p>We're sorry for the inconvenience. The error has been reported.</p>
      <button onClick={() => window.location.reload()}>
        Reload page
      </button>
    </div>
  );
}
```

### Infrastructure Monitoring

#### 1. Firebase Functions Monitoring
```typescript
// functions/src/monitoring/index.ts
import * as functions from 'firebase-functions';
import { performance } from 'perf_hooks';

interface FunctionMetrics {
  executionTime: number;
  memoryUsed: number;
  errors: number;
  invocations: number;
}

export class FunctionMonitor {
  private metrics = new Map<string, FunctionMetrics>();

  // Wrapper for monitoring Cloud Functions
  monitorFunction<T extends any[], R>(
    name: string,
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      try {
        const result = await fn(...args);

        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;

        this.recordMetrics(name, {
          executionTime: endTime - startTime,
          memoryUsed: endMemory - startMemory,
          errors: 0,
          invocations: 1,
        });

        return result;
      } catch (error) {
        const endTime = performance.now();

        this.recordMetrics(name, {
          executionTime: endTime - startTime,
          memoryUsed: 0,
          errors: 1,
          invocations: 1,
        });

        // Log error with context
        console.error(`Function ${name} failed:`, {
          error: error instanceof Error ? error.message : error,
          args: JSON.stringify(args),
          executionTime: endTime - startTime,
        });

        throw error;
      }
    };
  }

  private recordMetrics(functionName: string, metrics: FunctionMetrics): void {
    const existing = this.metrics.get(functionName) || {
      executionTime: 0,
      memoryUsed: 0,
      errors: 0,
      invocations: 0,
    };

    this.metrics.set(functionName, {
      executionTime: existing.executionTime + metrics.executionTime,
      memoryUsed: Math.max(existing.memoryUsed, metrics.memoryUsed),
      errors: existing.errors + metrics.errors,
      invocations: existing.invocations + metrics.invocations,
    });
  }

  getMetrics(): Record<string, FunctionMetrics> {
    return Object.fromEntries(this.metrics.entries());
  }
}

const monitor = new FunctionMonitor();

// Usage in Cloud Functions
export const createUser = functions.https.onCall(
  monitor.monitorFunction('createUser', async (data, context) => {
    // Function implementation
    const userId = await createUserInDatabase(data);
    return { userId, success: true };
  })
);

export const updateUserProfile = functions.https.onCall(
  monitor.monitorFunction('updateUserProfile', async (data, context) => {
    // Function implementation
    await updateUserInDatabase(context.auth?.uid, data);
    return { success: true };
  })
);

// Monitoring endpoint to expose metrics
export const getMetrics = functions.https.onRequest(async (req, res) => {
  // Verify admin access
  if (!req.headers.authorization?.includes('admin-token')) {
    res.status(401).send('Unauthorized');
    return;
  }

  const metrics = monitor.getMetrics();
  res.json(metrics);
});
```

#### 2. Custom Metrics Collection
```typescript
// lib/monitoring/custom-metrics.ts
interface CustomMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export class MetricsCollector {
  private metrics: CustomMetric[] = [];
  private batchSize = 50;
  private flushInterval = 30000; // 30 seconds

  constructor() {
    this.startPeriodicFlush();
  }

  // Track custom business metrics
  track(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    if (this.metrics.length >= this.batchSize) {
      this.flush();
    }
  }

  // Track user engagement metrics
  trackUserEngagement(action: string, userId: string, metadata?: Record<string, any>): void {
    this.track('user_engagement', 1, {
      action,
      user_id: userId,
      ...metadata,
    });
  }

  // Track business conversion metrics
  trackConversion(event: string, value?: number, userId?: string): void {
    this.track('conversion', value || 1, {
      event,
      user_id: userId,
    });
  }

  // Track performance metrics
  trackPerformance(metric: string, value: number, component?: string): void {
    this.track('performance', value, {
      metric,
      component,
    });
  }

  // Flush metrics to external service
  private async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    const batch = [...this.metrics];
    this.metrics = [];

    try {
      await this.sendMetrics(batch);
    } catch (error) {
      console.error('Failed to send metrics:', error);
      // Put metrics back for retry
      this.metrics.unshift(...batch);
    }
  }

  private async sendMetrics(metrics: CustomMetric[]): Promise<void> {
    // Send to monitoring service (could be Firebase Analytics, custom endpoint, etc.)
    await fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics }),
    });
  }

  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
}

// React hook for metrics
export function useMetrics() {
  const metrics = useMemo(() => new MetricsCollector(), []);

  const trackUserAction = useCallback((action: string, metadata?: Record<string, any>) => {
    metrics.trackUserEngagement(action, 'current-user-id', metadata);
  }, [metrics]);

  const trackConversion = useCallback((event: string, value?: number) => {
    metrics.trackConversion(event, value, 'current-user-id');
  }, [metrics]);

  const trackPerformance = useCallback((metric: string, value: number, component?: string) => {
    metrics.trackPerformance(metric, value, component);
  }, [metrics]);

  return { trackUserAction, trackConversion, trackPerformance };
}
```

### Health Checks and Alerting

#### 1. Application Health Monitoring
```typescript
// lib/monitoring/health-checks.ts
interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
  timeout?: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: boolean; responseTime: number; error?: string }>;
  timestamp: number;
}

export class HealthMonitor {
  private checks: HealthCheck[] = [];
  private lastStatus: HealthStatus | null = null;

  // Register health checks
  registerCheck(check: HealthCheck): void {
    this.checks.push(check);
  }

  // Run all health checks
  async runHealthChecks(): Promise<HealthStatus> {
    const results: Record<string, { status: boolean; responseTime: number; error?: string }> = {};

    await Promise.allSettled(
      this.checks.map(async (check) => {
        const startTime = performance.now();

        try {
          const timeout = check.timeout || 5000;
          const result = await Promise.race([
            check.check(),
            new Promise<boolean>((_, reject) =>
              setTimeout(() => reject(new Error('Health check timeout')), timeout)
            ),
          ]);

          results[check.name] = {
            status: result,
            responseTime: performance.now() - startTime,
          };
        } catch (error) {
          results[check.name] = {
            status: false,
            responseTime: performance.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const healthStatus: HealthStatus = {
      status: this.calculateOverallStatus(results),
      checks: results,
      timestamp: Date.now(),
    };

    this.lastStatus = healthStatus;
    await this.handleStatusChange(healthStatus);

    return healthStatus;
  }

  private calculateOverallStatus(
    results: Record<string, { status: boolean; responseTime: number; error?: string }>
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalChecks = this.checks.filter(c => c.critical);
    const criticalFailures = criticalChecks.filter(c => !results[c.name]?.status);

    if (criticalFailures.length > 0) {
      return 'unhealthy';
    }

    const allChecks = this.checks;
    const failures = allChecks.filter(c => !results[c.name]?.status);

    if (failures.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async handleStatusChange(status: HealthStatus): Promise<void> {
    if (!this.lastStatus || this.lastStatus.status !== status.status) {
      await this.sendAlert(status);
    }
  }

  private async sendAlert(status: HealthStatus): Promise<void> {
    const message = `🚨 Application health status changed to: ${status.status.toUpperCase()}`;

    // Send to Slack, email, or other alerting service
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          attachments: [{
            color: status.status === 'healthy' ? 'good' : 'danger',
            fields: Object.entries(status.checks).map(([name, result]) => ({
              title: name,
              value: result.status ? '✅ Healthy' : `❌ Failed: ${result.error}`,
              short: true,
            })),
          }],
        }),
      });
    }
  }
}

// Setup health checks
export function setupHealthMonitoring(): HealthMonitor {
  const healthMonitor = new HealthMonitor();

  // Database connectivity check
  healthMonitor.registerCheck({
    name: 'firestore',
    critical: true,
    check: async () => {
      try {
        const testRef = doc(db, 'health', 'check');
        await getDoc(testRef);
        return true;
      } catch {
        return false;
      }
    },
  });

  // Authentication service check
  healthMonitor.registerCheck({
    name: 'auth',
    critical: true,
    check: async () => {
      try {
        // Simple auth check
        const currentUser = auth.currentUser;
        return true; // Auth service is available
      } catch {
        return false;
      }
    },
  });

  // External API dependencies
  healthMonitor.registerCheck({
    name: 'external_api',
    critical: false,
    check: async () => {
      try {
        const response = await fetch('https://api.external-service.com/health');
        return response.ok;
      } catch {
        return false;
      }
    },
  });

  // Memory usage check
  healthMonitor.registerCheck({
    name: 'memory',
    critical: false,
    check: async () => {
      if (typeof window === 'undefined') return true;

      const memory = (performance as any).memory;
      if (!memory) return true;

      const usagePercentage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      return usagePercentage < 0.9; // Alert if > 90% memory usage
    },
  });

  return healthMonitor;
}
```

#### 2. Budget-Friendly Alerting System
```typescript
// lib/monitoring/alerting.ts
interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  level: 'info' | 'warning' | 'error' | 'critical';
  cooldown: number; // Minimum time between alerts
  channels: string[]; // slack, email, webhook
}

export class AlertManager {
  private rules: AlertRule[] = [];
  private lastAlerts = new Map<string, number>();
  private alertHistory: Alert[] = [];

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  async checkAlerts(metrics: any): Promise<void> {
    for (const rule of this.rules) {
      if (this.shouldSkipRule(rule)) continue;

      if (rule.condition(metrics)) {
        await this.sendAlert({
          id: `${rule.id}_${Date.now()}`,
          level: rule.level,
          message: `Alert: ${rule.name}`,
          timestamp: Date.now(),
          metadata: { rule: rule.id, metrics },
        }, rule.channels);

        this.lastAlerts.set(rule.id, Date.now());
      }
    }
  }

  private shouldSkipRule(rule: AlertRule): boolean {
    const lastAlert = this.lastAlerts.get(rule.id);
    if (!lastAlert) return false;

    return Date.now() - lastAlert < rule.cooldown;
  }

  private async sendAlert(alert: Alert, channels: string[]): Promise<void> {
    this.alertHistory.push(alert);

    for (const channel of channels) {
      try {
        await this.sendToChannel(alert, channel);
      } catch (error) {
        console.error(`Failed to send alert to ${channel}:`, error);
      }
    }
  }

  private async sendToChannel(alert: Alert, channel: string): Promise<void> {
    switch (channel) {
      case 'slack':
        await this.sendToSlack(alert);
        break;
      case 'email':
        await this.sendToEmail(alert);
        break;
      case 'webhook':
        await this.sendToWebhook(alert);
        break;
    }
  }

  private async sendToSlack(alert: Alert): Promise<void> {
    if (!process.env.SLACK_WEBHOOK_URL) return;

    const color = {
      info: '#36a64f',
      warning: '#ff9500',
      error: '#ff0000',
      critical: '#ff0000',
    }[alert.level];

    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `${alert.level.toUpperCase()} Alert`,
          text: alert.message,
          fields: [{
            title: 'Timestamp',
            value: new Date(alert.timestamp).toISOString(),
            short: true,
          }],
        }],
      }),
    });
  }

  private async sendToEmail(alert: Alert): Promise<void> {
    // Use a free email service or SMTP
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: process.env.ALERT_EMAIL,
        subject: `${alert.level.toUpperCase()} Alert`,
        body: `${alert.message}\n\nTimestamp: ${new Date(alert.timestamp).toISOString()}`,
      }),
    });
  }

  private async sendToWebhook(alert: Alert): Promise<void> {
    if (!process.env.ALERT_WEBHOOK_URL) return;

    await fetch(process.env.ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
  }
}

// Setup common alerting rules
export function setupAlerting(): AlertManager {
  const alertManager = new AlertManager();

  // High error rate alert
  alertManager.addRule({
    id: 'high_error_rate',
    name: 'High Error Rate Detected',
    condition: (metrics) => metrics.errorRate > 0.05, // > 5% error rate
    level: 'error',
    cooldown: 10 * 60 * 1000, // 10 minutes
    channels: ['slack', 'email'],
  });

  // Performance degradation alert
  alertManager.addRule({
    id: 'slow_response_time',
    name: 'Slow Response Time',
    condition: (metrics) => metrics.avgResponseTime > 2000, // > 2 seconds
    level: 'warning',
    cooldown: 15 * 60 * 1000, // 15 minutes
    channels: ['slack'],
  });

  // Memory usage alert
  alertManager.addRule({
    id: 'high_memory_usage',
    name: 'High Memory Usage',
    condition: (metrics) => metrics.memoryUsage > 0.85, // > 85% memory usage
    level: 'warning',
    cooldown: 5 * 60 * 1000, // 5 minutes
    channels: ['slack'],
  });

  return alertManager;
}
```

### Dashboard and Visualization

#### 1. Simple Monitoring Dashboard
```typescript
// components/monitoring/MonitoringDashboard.tsx
interface MetricCard {
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'error';
}

export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [metricsRes, healthRes] = await Promise.all([
          fetch('/api/metrics'),
          fetch('/api/health'),
        ]);

        setMetrics(await metricsRes.json());
        setHealthStatus(await healthRes.json());
      } catch (error) {
        console.error('Failed to fetch monitoring data:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (!metrics || !healthStatus) {
    return <div>Loading monitoring data...</div>;
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Response Time',
      value: `${metrics.avgResponseTime}ms`,
      trend: metrics.responseTimeTrend,
      status: metrics.avgResponseTime > 1000 ? 'warning' : 'good',
    },
    {
      title: 'Error Rate',
      value: `${(metrics.errorRate * 100).toFixed(2)}%`,
      trend: metrics.errorRateTrend,
      status: metrics.errorRate > 0.02 ? 'error' : 'good',
    },
    {
      title: 'Active Users',
      value: metrics.activeUsers,
      trend: metrics.activeUsersTrend,
      status: 'good',
    },
    {
      title: 'Health Status',
      value: healthStatus.status,
      status: healthStatus.status === 'healthy' ? 'good' : 'warning',
    },
  ];

  return (
    <div className="monitoring-dashboard">
      <h1>Application Monitoring</h1>

      <div className="metrics-grid">
        {metricCards.map((card, index) => (
          <MetricCard key={index} {...card} />
        ))}
      </div>

      <div className="charts-section">
        <PerformanceChart data={metrics.performanceHistory} />
        <ErrorChart data={metrics.errorHistory} />
      </div>

      <div className="health-checks">
        <h2>Health Checks</h2>
        {Object.entries(healthStatus.checks).map(([name, check]) => (
          <HealthCheckRow
            key={name}
            name={name}
            status={check.status}
            responseTime={check.responseTime}
            error={check.error}
          />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, status }: MetricCard) {
  const statusColors = {
    good: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    error: 'text-red-600 bg-red-50',
  };

  return (
    <div className={`metric-card p-4 rounded-lg ${status ? statusColors[status] : ''}`}>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold">{value}</span>
        {trend && <TrendIndicator trend={trend} />}
      </div>
    </div>
  );
}
```

## Monitoring Checklist

### Implementation
- [ ] Performance monitoring configured with Firebase Performance
- [ ] Error tracking implemented with global error handlers
- [ ] Custom metrics collection for business KPIs
- [ ] Health checks configured for critical services
- [ ] Alerting rules configured for key metrics
- [ ] Monitoring dashboard implemented

### Metrics Coverage
- [ ] Application performance metrics (response times, throughput)
- [ ] Error rates and types tracked
- [ ] User engagement and behavior metrics
- [ ] Business conversion metrics
- [ ] Infrastructure health metrics
- [ ] Security-related events monitored

### Alerting Configuration
- [ ] Critical alerts (high error rates, service unavailability)
- [ ] Warning alerts (performance degradation, capacity issues)
- [ ] Alert fatigue prevention (cooldowns, thresholds)
- [ ] Multiple notification channels configured
- [ ] Alert escalation procedures documented

### Cost Optimization
- [ ] Monitoring overhead minimized
- [ ] Metrics retention policies configured
- [ ] Free tier limits monitored
- [ ] Cost-effective alerting channels used
- [ ] Monitoring infrastructure right-sized

## Development Commands

```bash
# Monitoring and metrics
npm run metrics:collect
npm run metrics:export
npm run health:check
npm run alerts:test

# Performance monitoring
npm run performance:audit
npm run performance:baseline
npm run performance:compare

# Error tracking
npm run errors:report
npm run errors:analyze
npm run errors:export

# Dashboard
npm run dashboard:dev
npm run dashboard:build
npm run dashboard:deploy
```