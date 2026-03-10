# Firebase Best Practices Prompt

> **Last Updated:** 2025-12-08
> **Firebase SDK:** v12.x+ (Modular)
> **Next Review:** 2026-03-08

## SDK v12.x Notable Changes

### Key Updates from v10.x to v12.x
- **Firebase AI Logic SDK**: New `@firebase/ai` package replaces `@firebase/vertexai`. Import from `firebase/ai` instead of `firebase/vertexai`
- **App Check Limited-Use Tokens**: Support for replay protection via limited-use tokens
- **Realtime Remote Config**: Real-time parameter updates now available for web
- **Firestore Serialization**: New `toJSON()`/`fromJSON()` methods for result type serialization
- **Bug Fixes**: CORS issues in Firebase Studio emulators resolved, WebChannel leak fixes, Safari cache improvements with client-side indexing

### Migration Notes
```typescript
// ❌ Old (v10.x - deprecated)
import { getVertexAI } from 'firebase/vertexai';

// ✅ New (v12.x)
import { getAI } from 'firebase/ai';
```

---

## Firestore Database Design & Optimization

When working with Firestore in this application, follow these well-architected patterns for optimal performance and cost efficiency. **For free tier optimization**, see `finops-free-tier-maximization.md` for aggressive caching and batching strategies.

> 🎯 **Free Tier Priority**: All recommendations should prioritize staying within Firebase Spark plan limits (50K reads/day, 20K writes/day) through caching and batching.

### Data Modeling Best Practices

#### 1. Document Structure Design
```typescript
// ✅ Good: Flat, denormalized structure
interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  role: 'admin' | 'user' | 'moderator';
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
  stats: {
    postsCount: number;
    lastLoginAt: Timestamp;
    createdAt: Timestamp;
  };
}

// ✅ Good: Subcollection for related data
// users/{userId}/posts/{postId}
interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string; // Denormalized reference
  authorName: string; // Denormalized for display
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ❌ Avoid: Deep nesting
interface BadStructure {
  user: {
    profile: {
      personal: {
        details: {
          name: string; // Too deep!
        }
      }
    }
  }
}
```

#### 2. Collection and Document Naming
```typescript
// ✅ Good: Clear, plural collection names
const COLLECTIONS = {
  USERS: 'users',
  POSTS: 'posts',
  COMMENTS: 'comments',
  USER_POSTS: 'userPosts', // Compound collection name
} as const;

// ✅ Good: Consistent document ID patterns
function createUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ✅ Better: Use Firestore auto-generated IDs
const userRef = doc(collection(db, COLLECTIONS.USERS));
const userId = userRef.id; // Auto-generated ID
```

#### 3. Indexing Strategy
```typescript
// ✅ Create composite indexes for complex queries
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "authorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}

// ✅ Optimize queries for indexes
export async function getUserPosts(userId: string, limit = 10) {
  const q = query(
    collection(db, COLLECTIONS.POSTS),
    where('authorId', '==', userId),
    orderBy('createdAt', 'desc'),
    limitToLast(limit)
  );

  return getDocs(q);
}
```

### Query Optimization Patterns

#### 1. Efficient Query Design
```typescript
// ✅ Good: Use limits and pagination
export async function getPaginatedPosts(
  lastDoc?: QueryDocumentSnapshot,
  pageSize = 20
) {
  let q = query(
    collection(db, COLLECTIONS.POSTS),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];

  return { posts, lastVisible, hasMore: snapshot.docs.length === pageSize };
}

// ✅ Good: Use array-contains for tag filtering
export async function getPostsByTag(tag: string) {
  const q = query(
    collection(db, COLLECTIONS.POSTS),
    where('tags', 'array-contains', tag),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return getDocs(q);
}

// ❌ Avoid: Client-side filtering
export async function getAllPostsThenFilter(tag: string) {
  const snapshot = await getDocs(collection(db, COLLECTIONS.POSTS));
  return snapshot.docs.filter(doc => doc.data().tags.includes(tag)); // Expensive!
}
```

#### 2. Real-time Subscriptions Management
```typescript
// ✅ Good: Managed subscriptions with cleanup
export function usePostsSubscription(userId: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, COLLECTIONS.POSTS),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const updatedPosts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Post));
        setPosts(updatedPosts);
        setLoading(false);
      },
      (error) => {
        console.error('Posts subscription error:', error);
        setLoading(false);
      }
    );

    return unsubscribe; // Important: cleanup subscription
  }, [userId]);

  return { posts, loading };
}

// ✅ Good: Conditional subscriptions
export function useOptionalSubscription<T>(
  enabled: boolean,
  queryFn: () => Query<T>
) {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = onSnapshot(queryFn(), (snapshot) => {
      setData(snapshot.docs.map(doc => doc.data()));
    });

    return unsubscribe;
  }, [enabled, queryFn]);

  return data;
}
```

### Cloud Functions Best Practices

#### 1. Function Organization and Structure
```typescript
// ✅ Good: Organized function structure
// functions/src/auth/onCreate.ts
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  try {
    await admin.firestore().collection('users').doc(user.uid).set({
      email: user.email,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create user profile');
  }
});

// ✅ Good: Callable functions with validation
export const updateUserProfile = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Input validation
  const schema = z.object({
    displayName: z.string().min(1).max(50),
    preferences: z.object({
      theme: z.enum(['light', 'dark']),
      notifications: z.boolean(),
    }),
  });

  const validatedData = schema.parse(data);

  try {
    await admin.firestore()
      .collection('users')
      .doc(context.auth.uid)
      .update({
        ...validatedData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { success: true };
  } catch (error) {
    console.error('Error updating profile:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update profile');
  }
});
```

#### 2. Performance and Cost Optimization
```typescript
// ✅ Good: Efficient batch operations
export const batchUpdateUserStats = functions.firestore
  .document('posts/{postId}')
  .onWrite(async (change, context) => {
    const batch = admin.firestore().batch();

    if (change.after.exists && !change.before.exists) {
      // New post created
      const postData = change.after.data();
      const userRef = admin.firestore().collection('users').doc(postData.authorId);

      batch.update(userRef, {
        'stats.postsCount': admin.firestore.FieldValue.increment(1),
        'stats.lastPostAt': admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (!change.after.exists && change.before.exists) {
      // Post deleted
      const postData = change.before.data();
      const userRef = admin.firestore().collection('users').doc(postData.authorId);

      batch.update(userRef, {
        'stats.postsCount': admin.firestore.FieldValue.increment(-1),
      });
    }

    await batch.commit();
  });

// ✅ Good: Memory and timeout configuration
export const processLargeDataset = functions
  .runWith({
    memory: '2GB',
    timeoutSeconds: 300,
  })
  .https.onCall(async (data, context) => {
    // Process large datasets
  });
```

### Firebase Storage Best Practices

#### 1. File Upload Patterns
```typescript
// ✅ Good: Organized storage structure
export class StorageService {
  private static getUploadPath(userId: string, fileType: 'avatar' | 'document', fileName: string) {
    const timestamp = Date.now();
    return `users/${userId}/${fileType}/${timestamp}_${fileName}`;
  }

  static async uploadUserFile(
    file: File,
    userId: string,
    fileType: 'avatar' | 'document'
  ): Promise<string> {
    const path = this.getUploadPath(userId, fileType, file.name);
    const storageRef = ref(storage, path);

    // Upload with metadata
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    return getDownloadURL(snapshot.ref);
  }

  static async deleteUserFile(filePath: string): Promise<void> {
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
  }
}

// ✅ Good: Upload progress tracking
export function useFileUpload() {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadURL, setDownloadURL] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(progress);
      },
      (error) => {
        setError(error.message);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setDownloadURL(url);
      }
    );
  }, []);

  return { uploadFile, progress, error, downloadURL };
}
```

#### 2. Security Rules for Storage
```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // User can only access their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // File size and type restrictions
    match /users/{userId}/avatar/{fileName} {
      allow write: if request.auth != null &&
                      request.auth.uid == userId &&
                      request.resource.size < 5 * 1024 * 1024 && // 5MB
                      request.resource.contentType.matches('image/.*');
    }

    // Public read for certain files
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

### Authentication Best Practices

#### 1. Custom Claims Management
```typescript
// ✅ Good: Server-side custom claims
export const setUserRole = functions.https.onCall(async (data, context) => {
  // Admin-only operation
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { userId, role } = data;

  try {
    await admin.auth().setCustomUserClaims(userId, { role });

    // Update Firestore document
    await admin.firestore().collection('users').doc(userId).update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to set user role');
  }
});

// ✅ Good: Client-side role checking
export function useUserRole() {
  const [role, setRole] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      user.getIdTokenResult().then((tokenResult) => {
        setRole(tokenResult.claims.role || 'user');
      });
    }
  }, [user]);

  return role;
}
```

### Performance Monitoring

#### 1. Firebase Performance Integration
```typescript
// ✅ Good: Performance monitoring
import { trace } from 'firebase/performance';

export async function monitoredOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const performanceTrace = trace(perf, operationName);
  performanceTrace.start();

  try {
    const result = await operation();
    performanceTrace.putAttribute('success', 'true');
    return result;
  } catch (error) {
    performanceTrace.putAttribute('success', 'false');
    performanceTrace.putAttribute('error', error.message);
    throw error;
  } finally {
    performanceTrace.stop();
  }
}

// Usage
const posts = await monitoredOperation('fetch-user-posts', () =>
  getUserPosts(userId)
);
```

## Firebase Optimization Checklist

### Before Deployment
- [ ] Firestore security rules tested and validated
- [ ] Storage security rules configured
- [ ] Indexes created for all complex queries
- [ ] Cloud Functions have proper error handling
- [ ] Authentication flows tested with all providers
- [ ] Performance monitoring configured
- [ ] Cloud Functions memory and timeout optimized

### Performance Optimization
- [ ] Query limits implemented to prevent large data transfers
- [ ] Pagination implemented for large lists
- [ ] Real-time subscriptions properly managed and cleaned up
- [ ] Batch operations used where appropriate
- [ ] File uploads include progress tracking and error handling
- [ ] Images optimized before upload

### Cost Optimization
- [ ] Unnecessary real-time subscriptions eliminated
- [ ] Document reads minimized through caching
- [ ] Cloud Functions cold starts optimized
- [ ] Storage files have lifecycle policies
- [ ] Composite indexes only created when needed

## Common Firebase Anti-Patterns to Avoid

- ❌ Reading entire collections without limits
- ❌ Using real-time subscriptions for one-time data
- ❌ Not cleaning up Firestore listeners
- ❌ Storing large arrays in documents (use subcollections)
- ❌ Creating too many composite indexes
- ❌ Using Cloud Functions for simple operations that can be done client-side
- ❌ Not validating data in Cloud Functions
- ❌ Storing sensitive data in client-accessible documents
- ❌ Using document IDs that reveal sensitive information
- ❌ Not implementing proper error handling in async operations

## Development Commands

```bash
# Start Firebase emulators
firebase emulators:start

# Deploy security rules only
firebase deploy --only firestore:rules,storage

# Deploy specific functions
firebase deploy --only functions:functionName

# Test security rules
npm run test:rules

# Monitor function logs
firebase functions:log
```