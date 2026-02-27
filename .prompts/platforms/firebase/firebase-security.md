# Firebase Security Implementation

**Status**: Firebase-Specific
**Last Updated**: 2025-12-08
**Core Principles**: See [../../core/security/security-principles.md](../../core/security/security-principles.md)

## Overview

Firebase-specific implementation of security principles using Firebase Authentication, Firestore Security Rules, Cloud Functions, and App Check.

---

## Firebase Authentication

### Custom Claims for Authorization

**Core Principle**: [Role-Based Access Control](../../core/security/security-principles.md#1-authentication--authorization)

Firebase Auth supports custom claims for implementing RBAC:

```typescript
// Set custom claims (server-side only, Cloud Functions)
import { getAuth } from 'firebase-admin/auth';

export async function setAdminRole(uid: string): Promise<void> {
  await getAuth().setCustomUserClaims(uid, { admin: true });
}

export async function setUserRole(uid: string, role: string): Promise<void> {
  const customClaims = { role, roleAssignedAt: Date.now() };
  await getAuth().setCustomUserClaims(uid, customClaims);
}

// Verify custom claims in security rules or Cloud Functions
function isAdmin(auth: any): boolean {
  return auth?.token?.admin === true;
}
```

**Important**: Custom claims are limited to 1000 bytes. For complex permission systems, store permissions in Firestore and reference them in security rules.

---

## Firestore Security Rules

**Core Principle**: [Access Control](../../core/security/security-principles.md#1-authentication--authorization)

### Template for Secure Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() && request.auth.token.admin == true;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function validatePostData(data) {
      return data.keys().hasAll(['title', 'content', 'authorId']) &&
             data.title is string && data.title.size() <= 100 &&
             data.content is string && data.content.size() <= 10000 &&
             data.authorId == request.auth.uid;
    }

    // User can only access their own data
    match /users/{userId} {
      allow read, write: if isOwner(userId);

      // Allow users to read their own private subcollections
      match /private/{document=**} {
        allow read, write: if isOwner(userId);
      }
    }

    // Admin-only collections
    match /admin/{document=**} {
      allow read, write: if isAdmin();
    }

    // Public read, authenticated write with validation
    match /posts/{postId} {
      allow read: if true;
      allow create, update: if isAuthenticated() &&
        validatePostData(request.resource.data);
      allow delete: if isOwner(resource.data.authorId) || isAdmin();
    }

    // Comments with rate limiting via custom validation
    match /posts/{postId}/comments/{commentId} {
      allow read: if true;
      allow create: if isAuthenticated() &&
        request.resource.data.authorId == request.auth.uid &&
        request.resource.data.content.size() <= 500;
      allow update, delete: if isOwner(resource.data.authorId);
    }
  }
}
```

### Advanced Security Rules Patterns

**Time-Based Access**:
```javascript
// Allow access only during business hours (UTC)
function isDuringBusinessHours() {
  let hour = request.time.hours();
  return hour >= 9 && hour <= 17;
}

match /workdocs/{docId} {
  allow read, write: if isAuthenticated() && isDuringBusinessHours();
}
```

**Field-Level Validation**:
```javascript
function isValidEmail(email) {
  return email.matches('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
}

match /users/{userId} {
  allow update: if isOwner(userId) &&
    (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'admin'])) &&
    (request.resource.data.email == resource.data.email ||
     isValidEmail(request.resource.data.email));
}
```

**Rate Limiting with Custom Counters**:
```javascript
match /users/{userId}/rateLimits/{action} {
  allow read: if isOwner(userId);
  allow write: if false; // Only Cloud Functions can write
}

// In Cloud Functions, track action counts and reset daily
```

---

## Firebase Cloud Functions Security

**Core Principles**: [API Security](../../core/security/security-principles.md#3-api-security)

### Input Validation with Zod

```typescript
import { https } from 'firebase-functions/v2';
import { z } from 'zod';

const createPostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(10000),
  tags: z.array(z.string()).max(10).optional(),
});

export const createPost = https.onCall(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Validate input
  const result = createPostSchema.safeParse(request.data);
  if (!result.success) {
    throw new https.HttpsError('invalid-argument', 'Invalid post data',
      result.error.format());
  }

  const { title, content, tags } = result.data;

  // Business logic here
  // ...
});
```

### CORS Configuration for HTTP Functions

```typescript
export const publicApi = https.onRequest(async (req, res) => {
  // Set CORS headers for specific domains only
  const allowedOrigins = [
    'https://your-app.web.app',
    'https://your-app.firebaseapp.com',
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Handle actual request
  // ...
});
```

### Rate Limiting with Firebase Extensions

Use the [Firebase Extensions Rate Limiting](https://extensions.dev/) or implement custom rate limiting:

```typescript
import { getFirestore } from 'firebase-admin/firestore';

async function checkRateLimit(userId: string, action: string, limit: number): Promise<boolean> {
  const db = getFirestore();
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;

  const rateLimitRef = db.collection(`rateLimits/${userId}/actions`);
  const recentActions = await rateLimitRef
    .where('action', '==', action)
    .where('timestamp', '>=', hourAgo)
    .count()
    .get();

  return recentActions.data().count < limit;
}

export const rateLimitedFunction = https.onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new https.HttpsError('unauthenticated', 'Authentication required');
  }

  const canProceed = await checkRateLimit(userId, 'createPost', 10);
  if (!canProceed) {
    throw new https.HttpsError('resource-exhausted', 'Rate limit exceeded');
  }

  // Process request
  // ...
});
```

---

## Firebase App Check

**Core Principle**: [Network Security](../../core/security/security-principles.md#4-infrastructure-security)

### Setting Up App Check

```typescript
// Initialize App Check in your web app
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('your-recaptcha-site-key'),
  isTokenAutoRefreshEnabled: true,
});
```

### Enforcing App Check in Cloud Functions

```typescript
import { https } from 'firebase-functions/v2';

export const protectedFunction = https.onCall({
  consumeAppCheckToken: true, // Verify App Check token
}, async (request) => {
  // This function only runs if App Check succeeds
  // ...
});
```

### Enforcing App Check in Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sensitiveData/{document} {
      allow read, write: if request.auth != null &&
        request.app.check.valid == true; // Requires valid App Check token
    }
  }
}
```

---

## Firebase Environment Configuration

**Core Principle**: [Secrets Management](../../core/security/security-principles.md#4-infrastructure-security)

### Storing Secrets in Firebase

```bash
# Set secret for Cloud Functions
firebase functions:secrets:set API_KEY

# Access in Cloud Functions
import { defineSecret } from 'firebase-functions/params';

const apiKey = defineSecret('API_KEY');

export const useSecret = https.onRequest(
  { secrets: [apiKey] },
  async (req, res) => {
    const key = apiKey.value();
    // Use key
  }
);
```

### Environment-Specific Configuration

```typescript
// firebase.json - environment configs
{
  "functions": {
    "source": "functions"
  },
  "env": {
    "production": {
      "RATE_LIMIT": "100",
      "LOG_LEVEL": "warn"
    },
    "development": {
      "RATE_LIMIT": "1000",
      "LOG_LEVEL": "debug"
    }
  }
}
```

---

## Security Testing

**Core Principle**: [Security Monitoring](../../core/security/security-principles.md#5-security-monitoring--incident-response)

### Testing Firestore Security Rules

```bash
# Start emulator
firebase emulators:start --only firestore

# Run security rules tests
npm run test:security-rules
```

**Example test file**:
```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore Security Rules', () => {
  let testEnv: any;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  it('should deny unauthenticated users from reading user data', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection('users').doc('user1').get());
  });

  it('should allow users to read their own data', async () => {
    const authedDb = testEnv.authenticatedContext('user1').firestore();
    await assertSucceeds(authedDb.collection('users').doc('user1').get());
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });
});
```

### Security Audit Commands

```bash
# Audit dependencies
npm audit
npm audit fix

# Check for known vulnerabilities
npm run security:scan

# Test authentication flows
npm run test:auth

# Validate security rules
firebase deploy --only firestore:rules --dry-run
```

---

## Content Security Policy for Firebase Hosting

**Core Principle**: [Content Security Policy](../../core/security/security-principles.md#4-infrastructure-security)

Firebase Hosting supports CSP headers via `firebase.json`. Since Firebase Hosting serves static files, nonce-based CSP is not directly available without Cloud Functions.

### Basic CSP Configuration for Firebase Hosting

```json
// firebase.json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' https://*.googleapis.com https://*.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com"
          }
        ]
      }
    ]
  }
}
```

### Required Domains for Firebase Services

Firebase SDKs require these domains in your CSP:

| Firebase Service | Required Domains |
|------------------|------------------|
| **Firebase SDK** | `https://*.googleapis.com`, `https://*.gstatic.com` |
| **Authentication** | `https://identitytoolkit.googleapis.com`, `https://accounts.google.com`, `https://*.firebaseapp.com` |
| **Firestore** | `https://*.googleapis.com`, `https://*.firebaseio.com`, `wss://*.firebaseio.com` |
| **Storage** | `https://*.googleapis.com`, `https://firebasestorage.googleapis.com` |
| **Analytics** | `https://www.google-analytics.com`, `https://*.google.com` |

### CSP with Report-Only Mode

Start with report-only mode to identify issues before enforcement:

```json
{
  "headers": [
    {
      "key": "Content-Security-Policy-Report-Only",
      "value": "default-src 'self'; script-src 'self' https://*.googleapis.com; report-uri /csp-report"
    }
  ]
}
```

### Considerations for Firebase Hosting (Static)

- **No nonce support**: Firebase Hosting serves static files, so per-request nonces aren't available without Cloud Functions
- **Hash-based CSP**: For inline scripts, compute hashes and include in CSP (requires rebuild on changes)
- **CDN scripts**: Firebase SDK loaded from `gstatic.com` requires allowlisting that domain
- **Future implementation**: Consider adding Cloud Functions to enable nonce-based CSP when security requirements increase

### When to Implement Full CSP

For static Firebase Hosting apps with minimal inline scripts, focus on:
1. Basic security headers first (X-Content-Type-Options, X-Frame-Options)
2. Allowlist-based CSP for Firebase SDK domains
3. Upgrade to strict CSP when Cloud Functions are added

> **Note**: See the [Core Security Principles](../../core/security/security-principles.md) for comprehensive CSP guidance, including strict CSP patterns for dynamic applications.

---

## Firebase Security Checklist

### Before Deployment
- [ ] Firestore security rules tested with emulator
- [ ] Firebase environment variables/secrets properly configured
- [ ] Input validation implemented in all Cloud Functions
- [ ] Firebase Auth flows tested with OAuth providers
- [ ] Rate limiting configured using Firebase Extensions or custom implementation
- [ ] Error handling doesn't expose sensitive Firebase configuration
- [ ] Security headers configured in firebase.json (for Hosting)
- [ ] App Check configured and enforced in production
- [ ] Custom claims properly implemented for RBAC
- [ ] Cloud Functions use latest runtime version

### Post-Deployment
- [ ] Firebase Console monitoring dashboard configured
- [ ] Cloud Functions logs monitored for errors
- [ ] Authentication events logged and monitored
- [ ] App Check attestation working correctly
- [ ] Firebase security rules analyzer reviewed
- [ ] Regular security review schedule established
- [ ] Incident response procedures include Firebase-specific steps

---

## Firebase-Specific Security Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [Firebase Security Rules Reference](https://firebase.google.com/docs/reference/rules)
- [Firebase App Check Documentation](https://firebase.google.com/docs/app-check)
- [Firebase Auth Best Practices](https://firebase.google.com/docs/auth/web/security-best-practices)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [Firebase Security Rules Playground](https://firebase.google.com/docs/rules/simulator)

---

## Cross-References

**Universal Principles**: [../../core/security/security-principles.md](../../core/security/security-principles.md)
**Related Firebase Guides**:
- [Firebase Best Practices](./firebase-best-practices.md)
- [Firebase Testing](./firebase-testing.md)
