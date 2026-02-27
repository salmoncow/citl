# FinOps Free Tier Maximization Prompt for Firebase Applications

**Status**: Firebase-Specific
**Last Updated**: 2025-12-08
**Free Tier Quotas Verified**: 2025-12-08
**Next Review**: 2026-03-08
**Core Principles**: See [../../core/operations/budget-principles.md](../../core/operations/budget-principles.md)

> **Note**: Firebase free tier quotas are subject to change. Verify current limits at [firebase.google.com/pricing](https://firebase.google.com/pricing).

## Zero-Cost Architecture Strategy

When building Firebase applications, follow these FinOps patterns to maximize free tier usage across all services while maintaining production-ready functionality:

### Firebase Free Tier Limits & Optimization

#### Firestore (Spark Plan Free Tier)
- **Free Quota**: 1 GiB storage, 50K reads/day, 20K writes/day, 20K deletes/day
- **Network**: 10 GiB/month egress

```typescript
// Optimize Firestore usage for free tier
export class FreeTierFirestoreOptimizer {
  private readCount = 0;
  private writeCount = 0;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly DAILY_READ_LIMIT = 45000; // Buffer below 50K
  private readonly DAILY_WRITE_LIMIT = 18000; // Buffer below 20K

  // Aggressive caching to minimize reads
  async optimizedRead(docPath: string): Promise<any> {
    const cached = this.cache.get(docPath);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }

    if (this.readCount >= this.DAILY_READ_LIMIT) {
      console.warn('Daily read limit approaching, using stale cache');
      return cached?.data || null;
    }

    try {
      const docRef = doc(db, docPath);
      const docSnap = await getDoc(docRef);
      this.readCount++;

      const data = docSnap.exists() ? docSnap.data() : null;
      this.cache.set(docPath, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      // Return cached data on error
      return cached?.data || null;
    }
  }

  // Batch writes to minimize operations
  private pendingWrites = new Map<string, any>();
  private writeTimer: NodeJS.Timeout | null = null;

  async optimizedWrite(docPath: string, data: any): Promise<void> {
    this.pendingWrites.set(docPath, data);

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }

    this.writeTimer = setTimeout(() => {
      this.flushPendingWrites();
    }, 5000); // Batch writes every 5 seconds
  }

  private async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0) return;

    const batch = writeBatch(db);
    const writes = Array.from(this.pendingWrites.entries());

    writes.forEach(([docPath, data]) => {
      if (this.writeCount < this.DAILY_WRITE_LIMIT) {
        const docRef = doc(db, docPath);
        batch.set(docRef, data, { merge: true });
        this.writeCount++;
      }
    });

    try {
      await batch.commit();
      this.pendingWrites.clear();
    } catch (error) {
      console.error('Batch write failed:', error);
    }
  }

  // Optimize queries to use as few reads as possible
  async optimizedQuery(collectionPath: string, constraints: any[] = []): Promise<any[]> {
    const cacheKey = `query_${collectionPath}_${JSON.stringify(constraints)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }

    // Limit query size to conserve reads
    const limitedConstraints = [...constraints, limit(10)];
    const q = query(collection(db, collectionPath), ...limitedConstraints);

    const snapshot = await getDocs(q);
    this.readCount += snapshot.size;

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  getUsageStats(): { reads: number; writes: number; readPercentage: number; writePercentage: number } {
    return {
      reads: this.readCount,
      writes: this.writeCount,
      readPercentage: (this.readCount / this.DAILY_READ_LIMIT) * 100,
      writePercentage: (this.writeCount / this.DAILY_WRITE_LIMIT) * 100,
    };
  }
}
```

#### Cloud Functions (Free Tier)
- **Free Quota**: 2M invocations/month, 400K GB-seconds, 200K CPU-seconds

```typescript
// Optimize Cloud Functions for free tier
export const optimizedFunction = functions
  .runWith({
    memory: '128MB', // Minimum memory to reduce GB-seconds
    timeoutSeconds: 10, // Quick timeout to reduce CPU-seconds
  })
  .https.onCall(async (data, context) => {
    // Early validation to exit quickly on invalid requests
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Use connection pooling to reduce cold starts
    const pool = getConnectionPool();

    try {
      // Minimal processing
      const result = await processWithPool(pool, data);
      return { success: true, data: result };
    } catch (error) {
      console.error('Function error:', error);
      throw new functions.https.HttpsError('internal', 'Processing failed');
    }
  });

// Optimize for cold starts by sharing resources
let sharedResources: any = null;

export const quickFunction = functions
  .runWith({ memory: '128MB' })
  .https.onCall(async (data, context) => {
    // Reuse shared resources to avoid initialization overhead
    if (!sharedResources) {
      sharedResources = await initializeSharedResources();
    }

    // Process quickly and return
    return sharedResources.quickProcess(data);
  });
```

#### Firebase Storage (Free Tier)
- **Free Quota**: 5 GB storage, 1 GB/day downloads, 20K uploads/day

```typescript
// Optimize Storage usage for free tier
export class FreeTierStorageOptimizer {
  private uploadCount = 0;
  private readonly DAILY_UPLOAD_LIMIT = 18000; // Buffer below 20K

  // Compress images before upload
  async optimizedImageUpload(file: File, path: string): Promise<string> {
    if (this.uploadCount >= this.DAILY_UPLOAD_LIMIT) {
      throw new Error('Daily upload limit reached');
    }

    // Compress image to reduce storage usage
    const compressedFile = await this.compressImage(file, 0.7); // 70% quality

    const storageRef = ref(storage, path);
    const uploadTask = await uploadBytes(storageRef, compressedFile);
    this.uploadCount++;

    return getDownloadURL(uploadTask.ref);
  }

  private async compressImage(file: File, quality: number): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Resize to max 800px width to save storage
        const maxWidth = 800;
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);

        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          resolve(new File([blob!], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // Use CDN caching to reduce download bandwidth
  getOptimizedDownloadURL(filePath: string): string {
    const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${PROJECT_ID}.appspot.com/o/${encodeURIComponent(filePath)}`;
    return `${baseUrl}?alt=media&cache=3600`; // 1 hour cache
  }
}
```

### External Free Services Integration

#### 1. Firebase Hosting (Free Tier Hosting)
- **Free Quota**: 100 GB bandwidth/month, 6000 function executions/day

```typescript
// Optimize for Firebase Hosting free tier
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set aggressive caching headers
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  // Minimize function execution time
  if (req.method === 'GET') {
    const data = await getCachedData(req.query.id as string);
    return res.json(data);
  }

  res.status(405).json({ error: 'Method not allowed' });
}

// Edge caching strategy
export const config = {
  runtime: 'edge', // Use edge runtime for faster responses and lower costs
};
```

#### 2. Cloudflare (Free Tier CDN & Security)
- **Free Quota**: Unlimited bandwidth, 100K requests/day Workers

```javascript
// Cloudflare Worker for request optimization
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Aggressive caching to reduce origin requests
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);

  let response = await cache.match(cacheKey);

  if (!response) {
    response = await fetch(request);

    // Cache successful responses for 1 hour
    if (response.status === 200) {
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...response.headers,
          'Cache-Control': 'public, max-age=3600'
        }
      });

      event.waitUntil(cache.put(cacheKey, newResponse.clone()));
      return newResponse;
    }
  }

  return response;
}
```

#### 3. MongoDB Atlas (Free Tier Database)
- **Free Quota**: 512 MB storage, shared cluster

```typescript
// Use MongoDB Atlas as backup/analytics database
export class MongoAnalytics {
  private client: MongoClient;
  private dailyWrites = 0;
  private readonly DAILY_WRITE_LIMIT = 1000; // Self-imposed limit

  async logEvent(event: string, data: any): Promise<void> {
    if (this.dailyWrites >= this.DAILY_WRITE_LIMIT) {
      return; // Skip logging when approaching limits
    }

    try {
      await this.client.db('analytics').collection('events').insertOne({
        event,
        data,
        timestamp: new Date(),
      });
      this.dailyWrites++;
    } catch (error) {
      console.error('Analytics logging failed:', error);
    }
  }

  // Batch analytics to reduce operations
  private eventQueue: any[] = [];

  queueEvent(event: string, data: any): void {
    this.eventQueue.push({ event, data, timestamp: new Date() });

    if (this.eventQueue.length >= 50) {
      this.flushEvents();
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    try {
      await this.client.db('analytics').collection('events').insertMany(this.eventQueue);
      this.dailyWrites += this.eventQueue.length;
      this.eventQueue = [];
    } catch (error) {
      console.error('Batch analytics failed:', error);
    }
  }
}
```

#### 4. Supabase (Free Tier Alternative)
- **Free Quota**: 500 MB database, 2 GB bandwidth/month

```typescript
// Use Supabase for real-time features when Firebase limits are reached
export class SupabaseBackup {
  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async backupUserData(userId: string, data: any): Promise<void> {
    try {
      await this.supabase
        .from('user_backups')
        .upsert({ user_id: userId, data, updated_at: new Date() });
    } catch (error) {
      console.error('Supabase backup failed:', error);
    }
  }

  async getBackupData(userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('user_backups')
      .select('data')
      .eq('user_id', userId)
      .single();

    return error ? null : data?.data;
  }
}
```

### Free Monitoring & Alerting Services

#### 1. UptimeRobot (Free Monitoring)
- **Free Quota**: 50 monitors, 5-minute checks

```typescript
// Setup monitoring endpoints for UptimeRobot
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Quick health checks
    const firebaseHealth = await checkFirebaseHealth();
    const databaseHealth = await checkDatabaseHealth();

    if (firebaseHealth && databaseHealth) {
      res.status(200).json({ status: 'healthy', timestamp: Date.now() });
    } else {
      res.status(503).json({ status: 'unhealthy', timestamp: Date.now() });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
}

async function checkFirebaseHealth(): Promise<boolean> {
  try {
    const testRef = doc(db, 'health', 'check');
    await getDoc(testRef);
    return true;
  } catch {
    return false;
  }
}
```

#### 2. Discord Webhooks (Free Alerting)
- **Free Quota**: Unlimited webhooks

```typescript
// Free alerting via Discord webhooks
export class DiscordAlerting {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(level: 'info' | 'warning' | 'error', message: string, data?: any): Promise<void> {
    const colors = {
      info: 0x00ff00,    // Green
      warning: 0xffff00, // Yellow
      error: 0xff0000,   // Red
    };

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `${level.toUpperCase()} Alert`,
            description: message,
            color: colors[level],
            timestamp: new Date().toISOString(),
            fields: data ? Object.entries(data).map(([key, value]) => ({
              name: key,
              value: String(value),
              inline: true,
            })) : [],
          }],
        }),
      });
    } catch (error) {
      console.error('Discord alert failed:', error);
    }
  }
}
```

### Free Development Tools

#### 1. GitHub Actions (Free Tier)
- **Free Quota**: 2,000 minutes/month for private repos

```yaml
# .github/workflows/free-tier-optimized.yml
name: Free Tier Optimized CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quick-checks:
    runs-on: ubuntu-latest
    timeout-minutes: 5 # Minimize usage

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --prefer-offline

      - name: Quick lint
        run: npm run lint -- --max-warnings 0

      - name: Quick test
        run: npm run test -- --passWithNoTests --maxWorkers=2

  deploy:
    needs: quick-checks
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Firebase
        uses: w9jds/setup-firebase@main
        with:
          firebase_token: ${{ secrets.FIREBASE_TOKEN }}
      - run: firebase deploy --project ${{ secrets.FIREBASE_PROJECT_ID }}
```

#### 2. CodeCov (Free Tier)
- **Free Quota**: Unlimited public repos

```yaml
# Add to GitHub Actions
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/lcov.info
    fail_ci_if_error: false # Don't fail on upload errors
```

### Cost Monitoring & Optimization

#### 1. Firebase Usage Monitoring
```typescript
// Monitor Firebase usage to stay within free limits
export class FirebaseUsageMonitor {
  private usageLog: { [key: string]: number } = {};

  logOperation(operation: 'read' | 'write' | 'delete' | 'function_call' | 'storage_upload'): void {
    const today = new Date().toDateString();
    const key = `${today}_${operation}`;

    this.usageLog[key] = (this.usageLog[key] || 0) + 1;

    // Alert when approaching limits
    this.checkLimits(operation, this.usageLog[key]);
  }

  private checkLimits(operation: string, count: number): void {
    const limits = {
      read: 45000,      // 90% of 50K daily limit
      write: 18000,     // 90% of 20K daily limit
      delete: 18000,    // 90% of 20K daily limit
      function_call: 360000, // 90% of 400K monthly limit / 30 days
      storage_upload: 18000,  // 90% of 20K daily limit
    };

    const limit = limits[operation as keyof typeof limits];
    if (limit && count > limit * 0.8) {
      console.warn(`Approaching ${operation} limit: ${count}/${limit}`);

      // Send alert via Discord
      const alerting = new DiscordAlerting(process.env.DISCORD_WEBHOOK_URL!);
      alerting.sendAlert('warning', `Approaching ${operation} limit`, {
        current: count,
        limit,
        percentage: Math.round((count / limit) * 100),
      });
    }
  }

  getDailyUsage(): Record<string, number> {
    const today = new Date().toDateString();
    const todayUsage: Record<string, number> = {};

    Object.entries(this.usageLog).forEach(([key, value]) => {
      if (key.startsWith(today)) {
        const operation = key.split('_')[1];
        todayUsage[operation] = value;
      }
    });

    return todayUsage;
  }
}
```

#### 2. Automated Cost Optimization
```typescript
// Automatically optimize based on usage patterns
export class AutoCostOptimizer {
  private monitor = new FirebaseUsageMonitor();

  async optimizeBasedOnUsage(): Promise<void> {
    const usage = this.monitor.getDailyUsage();

    // If read usage is high, increase caching aggressiveness
    if (usage.read > 30000) {
      this.increaseCacheTTL();
    }

    // If write usage is high, increase batching
    if (usage.write > 15000) {
      this.increaseBatchSize();
    }

    // If function calls are high, implement more client-side logic
    if (usage.function_call > 300000) {
      this.enableClientSideProcessing();
    }
  }

  private increaseCacheTTL(): void {
    // Increase cache time-to-live to reduce reads
    console.log('Increasing cache TTL to reduce Firebase reads');
  }

  private increaseBatchSize(): void {
    // Batch more operations together
    console.log('Increasing batch size to reduce Firebase writes');
  }

  private enableClientSideProcessing(): void {
    // Move processing from Cloud Functions to client
    console.log('Enabling client-side processing to reduce function calls');
  }
}
```

## Free Tier Maximization Checklist

### Firebase Services
- [ ] Firestore usage optimized with aggressive caching and batching
- [ ] Cloud Functions using minimum memory (128MB) and quick timeouts
- [ ] Storage uploads compressed and limited
- [ ] Authentication using built-in providers (no custom tokens)
- [ ] Hosting using Firebase for static assets only

### External Free Services
- [ ] Firebase Hosting for Next.js application hosting
- [ ] Cloudflare for CDN and security (if needed)
- [ ] MongoDB Atlas for analytics/backup storage
- [ ] Supabase as backup real-time database
- [ ] GitHub Actions for CI/CD (optimized runtime)

### Monitoring & Alerting
- [ ] UptimeRobot for uptime monitoring
- [ ] Discord webhooks for free alerting
- [ ] CodeCov for code coverage
- [ ] Firebase usage monitoring implemented
- [ ] Automated cost optimization active

### Development Tools
- [ ] GitHub for version control (free for public repos)
- [ ] VS Code with free extensions
- [ ] Firebase Hosting preview deployments
- [ ] Free SSL certificates (Let's Encrypt via hosting providers)

### Cost Optimization Strategies
- [ ] Aggressive caching to minimize database reads
- [ ] Batch operations to reduce API calls
- [ ] Client-side processing to reduce function usage
- [ ] Image compression to reduce storage costs
- [ ] CDN usage to reduce bandwidth costs
- [ ] Usage monitoring and alerts configured
- [ ] Automatic optimization based on usage patterns

## Monthly Free Tier Budget
```
Firebase (Spark Plan):           $0
Firebase Hosting (Spark Plan):  $0
Cloudflare (Free Plan):         $0
MongoDB Atlas (Free Cluster):   $0
Supabase (Free Tier):          $0
GitHub Actions (Public repo):   $0
UptimeRobot (Free):            $0
Discord (Free):                $0
--------------------------------
Total Monthly Cost:             $0
```

## Development Commands

```bash
# Monitor usage
npm run usage:check
npm run usage:report
npm run usage:optimize

# Cost optimization
npm run optimize:cache
npm run optimize:batch
npm run optimize:images

# Free tier monitoring
npm run freetier:status
npm run freetier:limits
npm run freetier:alerts
```