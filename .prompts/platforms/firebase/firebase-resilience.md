# Firebase Resilience Implementation

**Status**: Firebase-Specific
**Last Updated**: 2025-11-18
**Core Principles**: See [../../core/operations/budget-principles.md](../../core/operations/budget-principles.md)

## Overview

Firebase-specific resilience patterns for budget-friendly, reliable applications using Firebase services.

For universal budget and resilience principles, see the [Core Budget Principles](../../core/operations/budget-principles.md) guide.

---

## Firebase Cost-Effective Resilience Architecture

When building resilient Firebase applications on a budget, focus on single-region, multi-availability zone patterns with smart error handling and graceful degradation. **For zero-cost strategies**, see [firebase-finops.md](./firebase-finops.md).

> 💡 **Free Tier First**: Before implementing any paid resilience patterns, ensure you've maximized all available free tier services and quotas outlined in the FinOps prompt.

### Error Handling & Retry Patterns

#### 1. Exponential Backoff with Jitter
```typescript
interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitter: boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponentialBase = 2,
    jitter = true,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Only retry on retriable errors
      if (!isRetriableError(error)) {
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(exponentialBase, attempt - 1),
        maxDelay
      );

      const finalDelay = jitter ? delay * (0.5 + Math.random() * 0.5) : delay;

      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError!;
}

function isRetriableError(error: any): boolean {
  // Firebase specific retriable errors
  const retriableCodes = [
    'unavailable',
    'deadline-exceeded',
    'internal',
    'aborted',
    'resource-exhausted',
  ];

  return retriableCodes.includes(error?.code) ||
         error?.status >= 500 ||
         error?.name === 'NetworkError';
}

// Usage
const userData = await withRetry(() =>
  getDoc(doc(db, 'users', userId))
);
```

#### 2. Circuit Breaker Pattern
```typescript
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly monitoringWindow: number = 300000 // 5 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }
}

// Usage for external API calls
const apiCircuitBreaker = new CircuitBreaker(3, 30000);

export async function callExternalAPI(endpoint: string) {
  return apiCircuitBreaker.execute(() =>
    fetch(endpoint).then(res => res.json())
  );
}
```

### Graceful Degradation Patterns

#### 1. Fallback Data Strategies
```typescript
export class DataService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getUserData(userId: string): Promise<UserData> {
    try {
      // Try primary data source
      const userData = await this.fetchFromFirestore(userId);
      this.cache.set(userId, { data: userData, timestamp: Date.now() });
      return userData;
    } catch (error) {
      // Fallback to cache
      const cached = this.cache.get(userId);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL * 2) {
        console.warn('Using cached data due to Firestore error:', error);
        return { ...cached.data, isStale: true };
      }

      // Fallback to default data
      console.error('All data sources failed, using defaults:', error);
      return this.getDefaultUserData(userId);
    }
  }

  private async fetchFromFirestore(userId: string): Promise<UserData> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    return userDoc.data() as UserData;
  }

  private getDefaultUserData(userId: string): UserData {
    return {
      id: userId,
      displayName: 'Anonymous User',
      email: '',
      avatar: '/default-avatar.png',
      isStale: true,
      isDefault: true,
    };
  }
}
```

#### 2. Progressive Feature Degradation
```typescript
export function useFeatureFlags() {
  const [features, setFeatures] = useState({
    realTimeUpdates: true,
    advancedSearch: true,
    fileUpload: true,
    notifications: true,
  });

  useEffect(() => {
    // Monitor connection quality and service availability
    const checkServiceHealth = async () => {
      try {
        // Simple ping to test Firestore connectivity
        await getDocs(query(collection(db, 'health'), limit(1)));
      } catch (error) {
        // Degrade features on connectivity issues
        setFeatures(prev => ({
          ...prev,
          realTimeUpdates: false,
          notifications: false,
        }));
      }
    };

    const interval = setInterval(checkServiceHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return features;
}

// Component usage
export function PostsList() {
  const features = useFeatureFlags();
  const { posts, loading } = features.realTimeUpdates
    ? useRealtimePosts()
    : useStaticPosts();

  return (
    <div>
      {features.realTimeUpdates ? (
        <div className="text-green-600">Live updates enabled</div>
      ) : (
        <div className="text-yellow-600">
          Real-time updates unavailable. <button>Refresh manually</button>
        </div>
      )}

      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

### Offline Support & Local Storage

#### 1. Offline-First Data Layer
```typescript
export class OfflineDataManager {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'app-offline-data';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('posts')) {
          const postsStore = db.createObjectStore('posts', { keyPath: 'id' });
          postsStore.createIndex('authorId', 'authorId', { unique: false });
        }
      };
    });
  }

  async saveUserData(userId: string, data: UserData): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');

    await new Promise((resolve, reject) => {
      const request = store.put({ ...data, id: userId, timestamp: Date.now() });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserData(userId: string): Promise<UserData | null> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction(['users'], 'readonly');
    const store = transaction.objectStore('users');

    return new Promise((resolve, reject) => {
      const request = store.get(userId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async syncWhenOnline(): Promise<void> {
    if (!navigator.onLine) return;

    // Sync offline changes to Firebase
    const pendingChanges = await this.getPendingChanges();

    for (const change of pendingChanges) {
      try {
        await this.uploadChange(change);
        await this.markChangeSynced(change.id);
      } catch (error) {
        console.error('Failed to sync change:', change.id, error);
      }
    }
  }
}

// React hook for offline support
export function useOfflineData<T>(
  key: string,
  fetcher: () => Promise<T>
): { data: T | null; loading: boolean; error: Error | null; isOffline: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (isOffline) {
          // Try to load from local storage
          const offlineData = localStorage.getItem(key);
          if (offlineData) {
            setData(JSON.parse(offlineData));
          }
        } else {
          // Load from remote source
          const remoteData = await fetcher();
          setData(remoteData);

          // Cache for offline use
          localStorage.setItem(key, JSON.stringify(remoteData));
        }
      } catch (err) {
        setError(err as Error);

        // Try offline fallback
        const offlineData = localStorage.getItem(key);
        if (offlineData) {
          setData(JSON.parse(offlineData));
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [key, fetcher, isOffline]);

  return { data, loading, error, isOffline };
}
```

### Budget-Optimized Firebase Configuration

#### 1. Smart Firestore Usage
```typescript
// Minimize reads with strategic caching
export class CostOptimizedFirestore {
  private cache = new Map<string, { data: any; timestamp: number; etag?: string }>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  async getDocument(path: string, useCache = true): Promise<any> {
    const cached = this.cache.get(path);

    if (useCache && cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        this.cache.set(path, {
          data,
          timestamp: Date.now(),
          etag: docSnap.metadata.fromCache ? cached?.etag : 'server'
        });
        return data;
      }

      return null;
    } catch (error) {
      // Return stale cache if available
      if (cached) {
        console.warn('Using stale cache due to error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  // Batch operations to reduce function calls
  async batchGet(paths: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const uncachedPaths: string[] = [];

    // Check cache first
    for (const path of paths) {
      const cached = this.cache.get(path);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        results.set(path, cached.data);
      } else {
        uncachedPaths.push(path);
      }
    }

    // Batch fetch uncached documents
    if (uncachedPaths.length > 0) {
      const batch = uncachedPaths.map(path => doc(db, path));
      const snapshots = await getDocs(query(collection(db, '_'), where(documentId(), 'in', batch)));

      snapshots.forEach(snap => {
        if (snap.exists()) {
          const data = snap.data();
          results.set(snap.ref.path, data);
          this.cache.set(snap.ref.path, { data, timestamp: Date.now() });
        }
      });
    }

    return results;
  }
}
```

#### 2. Efficient Cloud Functions
```typescript
// Minimize cold starts and execution time
export const optimizedFunction = functions
  .runWith({
    memory: '256MB', // Use minimum necessary memory
    timeoutSeconds: 30, // Set appropriate timeout
  })
  .https.onCall(async (data, context) => {
    // Connection pooling for external services
    const pool = getConnectionPool();

    try {
      // Validate early to avoid unnecessary processing
      const validatedData = validateInput(data);

      // Process efficiently
      const result = await processWithPool(pool, validatedData);

      return { success: true, data: result };
    } catch (error) {
      // Log for monitoring but don't expose details
      console.error('Function error:', error);
      throw new functions.https.HttpsError('internal', 'Processing failed');
    }
  });

// Connection pooling for external services
let connectionPool: any = null;

function getConnectionPool() {
  if (!connectionPool) {
    connectionPool = createPool({
      max: 10,
      min: 2,
      acquireTimeoutMillis: 3000,
    });
  }
  return connectionPool;
}
```

### Health Monitoring & Alerting

#### 1. Simple Health Checks
```typescript
export class HealthMonitor {
  private static instance: HealthMonitor;
  private healthStatus = new Map<string, boolean>();

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  async checkFirestoreHealth(): Promise<boolean> {
    try {
      const healthRef = doc(db, 'health', 'check');
      await getDoc(healthRef);
      this.healthStatus.set('firestore', true);
      return true;
    } catch (error) {
      this.healthStatus.set('firestore', false);
      return false;
    }
  }

  async checkAuthHealth(): Promise<boolean> {
    try {
      // Simple auth check
      const user = auth.currentUser;
      this.healthStatus.set('auth', true);
      return true;
    } catch (error) {
      this.healthStatus.set('auth', false);
      return false;
    }
  }

  async runHealthCheck(): Promise<{ [key: string]: boolean }> {
    await Promise.allSettled([
      this.checkFirestoreHealth(),
      this.checkAuthHealth(),
    ]);

    return Object.fromEntries(this.healthStatus);
  }

  // Simple alerting via email (using a free service)
  async sendAlert(service: string, error: string): Promise<void> {
    if (typeof window !== 'undefined') return; // Client-side skip

    try {
      // Use free email service or webhooks
      await fetch(process.env.WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Service Alert: ${service} is down. Error: ${error}`,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Failed to send alert:', err);
    }
  }
}
```

## Budget Resilience Checklist

### Cost Optimization
- [ ] Firestore queries use appropriate limits and indexes
- [ ] Real-time subscriptions are minimized and properly cleaned up
- [ ] Cloud Functions use minimal memory allocation
- [ ] Caching implemented to reduce duplicate reads
- [ ] Batch operations used where possible
- [ ] File storage includes lifecycle management

### Resilience Implementation
- [ ] Retry logic with exponential backoff implemented
- [ ] Circuit breakers configured for external dependencies
- [ ] Graceful degradation patterns in place
- [ ] Offline support for critical functionality
- [ ] Health monitoring and basic alerting configured
- [ ] Error boundaries prevent application crashes

### Single-Region Multi-AZ Strategy
- [ ] Firebase project configured in closest region to users
- [ ] CDN configured for static assets (Firebase Hosting)
- [ ] Database backup strategy implemented
- [ ] Environment-specific configurations separated
- [ ] Disaster recovery procedures documented

## Budget-Friendly Monitoring Commands

```bash
# Check Firebase usage and costs
firebase projects:list
firebase use --add [project-id]

# Monitor function costs and execution
gcloud functions list
gcloud logging read "resource.type=cloud_function" --limit=50

# Basic performance monitoring
npm run lighthouse
npm run bundle-analyzer

# Health check endpoint
curl https://your-app.com/api/health
```

## Cost Monitoring Alerts

Set up budget alerts in Google Cloud Console:
- Daily budget threshold: $5
- Monthly budget threshold: $50
- Automatic notifications via email
- Firestore read/write quotas monitored