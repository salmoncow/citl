# Firebase Testing Implementation

**Status**: Firebase-Specific
**Last Updated**: 2025-11-18
**Testing Libraries**: @testing-library/react v14+, jest v29+, playwright v1.40+
**Node.js**: 24 LTS
**Core Principles**: See [../../core/testing/testing-principles.md](../../core/testing/testing-principles.md)

## Overview

Firebase-specific testing implementation including Firebase Emulator usage, Firestore Security Rules testing, Firebase Auth testing, and Cloud Functions testing.

For universal testing principles (testing pyramid, best practices, test organization), see the [Core Testing Principles](../../core/testing/testing-principles.md) guide.

---

## Comprehensive Testing Strategy for Firebase

When implementing testing for this Firebase application, follow these patterns for quality assurance, security validation, and reliability:

### Testing Pyramid Architecture

#### 1. Unit Tests (Base Layer - 70%)
```typescript
// Test utilities and configuration
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';

// Mock Firebase configuration for unit tests
export const mockFirebaseConfig = {
  apiKey: 'test-api-key',
  authDomain: 'test-project.firebaseapp.com',
  projectId: 'test-project',
  storageBucket: 'test-project.appspot.com',
  messagingSenderId: '123456789',
  appId: 'test-app-id',
};

// Component unit testing with Firebase mocks
describe('UserProfile Component', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'user' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user information correctly', () => {
    render(<UserProfile user={mockUser} />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('handles profile update submission', async () => {
    const mockUpdateProfile = jest.fn().mockResolvedValue({ success: true });
    render(<UserProfile user={mockUser} onUpdate={mockUpdateProfile} />);

    const nameInput = screen.getByLabelText('Display Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        displayName: 'Updated Name',
      });
    });
  });

  it('displays error message on update failure', async () => {
    const mockUpdateProfile = jest.fn().mockRejectedValue(new Error('Update failed'));
    render(<UserProfile user={mockUser} onUpdate={mockUpdateProfile} />);

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to update profile')).toBeInTheDocument();
    });
  });
});

// Utility function unit testing
describe('formatters', () => {
  describe('formatDate', () => {
    it('formats date correctly for US locale', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      const formatted = formatDate(date, 'en-US');
      expect(formatted).toBe('12/25/2023');
    });

    it('handles invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      const formatted = formatDate(invalidDate);
      expect(formatted).toBe('Invalid Date');
    });
  });

  describe('truncateText', () => {
    it('truncates text to specified length', () => {
      const text = 'This is a very long text that should be truncated';
      const truncated = truncateText(text, 20);
      expect(truncated).toBe('This is a very long...');
    });

    it('returns original text if shorter than limit', () => {
      const text = 'Short text';
      const truncated = truncateText(text, 20);
      expect(truncated).toBe('Short text');
    });
  });
});

// Firebase service unit testing with mocks
describe('UserService', () => {
  let mockDb: any;
  let userService: UserService;

  beforeEach(() => {
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    userService = new UserService(mockDb);
  });

  it('creates user profile successfully', async () => {
    const userData = {
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'user',
    };

    mockDb.set.mockResolvedValue(undefined);

    await userService.createUser('user-id', userData);

    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockDb.doc).toHaveBeenCalledWith('user-id');
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        ...userData,
        createdAt: expect.any(Object),
        updatedAt: expect.any(Object),
      })
    );
  });

  it('handles user creation errors', async () => {
    const userData = { email: 'test@example.com' };
    mockDb.set.mockRejectedValue(new Error('Permission denied'));

    await expect(userService.createUser('user-id', userData))
      .rejects.toThrow('Permission denied');
  });
});
```

#### 2. Integration Tests (Middle Layer - 20%)
```typescript
// Firebase Emulator integration testing
describe('User Authentication Integration', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
      auth: {
        host: 'localhost',
        port: 9099,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows authenticated users to read their own data', async () => {
    const alice = testEnv.authenticatedContext('alice', {
      email: 'alice@example.com',
    });

    const db = alice.firestore();

    // Create user document
    await db.collection('users').doc('alice').set({
      email: 'alice@example.com',
      displayName: 'Alice',
      role: 'user',
    });

    // Read user document
    const userDoc = await db.collection('users').doc('alice').get();
    expect(userDoc.data()?.email).toBe('alice@example.com');
  });

  it('denies access to other users data', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const bob = testEnv.authenticatedContext('bob');

    const aliceDb = alice.firestore();
    const bobDb = bob.firestore();

    // Alice creates her document
    await aliceDb.collection('users').doc('alice').set({
      email: 'alice@example.com',
    });

    // Bob tries to read Alice's document
    await expect(
      bobDb.collection('users').doc('alice').get()
    ).rejects.toThrow();
  });

  it('allows admin users to access all data', async () => {
    const admin = testEnv.authenticatedContext('admin', {
      admin: true,
    });

    const db = admin.firestore();

    // Create test data
    await db.collection('users').doc('user1').set({
      email: 'user1@example.com',
    });

    // Admin can read any user data
    const userDoc = await db.collection('users').doc('user1').get();
    expect(userDoc.exists).toBe(true);
  });
});

// API integration testing
describe('User API Integration', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    app = createTestApp();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server.close();
  });

  it('creates user profile via API', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Authorization', 'Bearer test-token')
      .send({
        email: 'test@example.com',
        displayName: 'Test User',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      data: {
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'user',
      },
      meta: {
        version: 'v1',
      },
    });
  });

  it('validates input data', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Authorization', 'Bearer test-token')
      .send({
        email: 'invalid-email',
      })
      .expect(400);

    expect(response.body.error).toContain('Invalid email format');
  });

  it('requires authentication', async () => {
    await request(app)
      .post('/api/v1/users')
      .send({
        email: 'test@example.com',
      })
      .expect(401);
  });
});
```

#### 3. End-to-End Tests (Top Layer - 10%)
```typescript
// Playwright E2E testing
import { test, expect, Page } from '@playwright/test';

test.describe('User Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/');
  });

  test('user can sign up with email and password', async ({ page }) => {
    await page.click('[data-testid="signup-button"]');

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'securepassword123');
    await page.fill('[data-testid="confirm-password-input"]', 'securepassword123');
    await page.fill('[data-testid="display-name-input"]', 'Test User');

    await page.click('[data-testid="submit-signup"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-greeting"]')).toContainText('Welcome, Test User');
  });

  test('user can sign in with Google OAuth', async ({ page }) => {
    await page.click('[data-testid="signin-button"]');
    await page.click('[data-testid="google-signin"]');

    // Handle OAuth popup
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('[data-testid="google-signin"]'),
    ]);

    await popup.fill('#email', 'test@gmail.com');
    await popup.click('#next');
    await popup.fill('#password', 'password');
    await popup.click('#signin');

    await expect(page).toHaveURL('/dashboard');
  });

  test('displays appropriate error for invalid credentials', async ({ page }) => {
    await page.click('[data-testid="signin-button"]');

    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');

    await page.click('[data-testid="submit-signin"]');

    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('Invalid email or password');
  });
});

test.describe('User Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate user before each test
    await authenticateUser(page, 'test@example.com');
    await page.goto('/profile');
  });

  test('user can update profile information', async ({ page }) => {
    await page.fill('[data-testid="display-name-input"]', 'Updated Name');
    await page.fill('[data-testid="bio-textarea"]', 'This is my updated bio');

    await page.click('[data-testid="save-profile"]');

    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('Profile updated successfully');

    // Verify changes persist after page reload
    await page.reload();
    await expect(page.locator('[data-testid="display-name-input"]'))
      .toHaveValue('Updated Name');
  });

  test('user can upload profile picture', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="upload-avatar"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('./test-assets/avatar.jpg');

    await expect(page.locator('[data-testid="avatar-preview"]')).toBeVisible();
    await page.click('[data-testid="save-profile"]');

    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('Profile updated successfully');
  });
});

// Helper functions for E2E tests
async function authenticateUser(page: Page, email: string) {
  await page.goto('/signin');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', 'testpassword123');
  await page.click('[data-testid="submit-signin"]');
  await page.waitForURL('/dashboard');
}
```

### Security Testing

#### 1. Firestore Security Rules Testing
```typescript
// Comprehensive security rules testing
describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'security-test-project',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('User Collection Security', () => {
    it('allows users to read their own document', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc('alice').set({
          email: 'alice@example.com',
          role: 'user',
        });
      });

      const db = alice.firestore();
      await expect(db.collection('users').doc('alice').get()).toAllow();
    });

    it('denies users from reading other users documents', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc('bob').set({
          email: 'bob@example.com',
          role: 'user',
        });
      });

      const aliceDb = alice.firestore();
      await expect(aliceDb.collection('users').doc('bob').get()).toDeny();
    });

    it('validates user data on write', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const db = alice.firestore();

      // Valid data should be allowed
      await expect(db.collection('users').doc('alice').set({
        email: 'alice@example.com',
        displayName: 'Alice',
        role: 'user',
      })).toAllow();

      // Invalid email should be denied
      await expect(db.collection('users').doc('alice').set({
        email: 'invalid-email',
        displayName: 'Alice',
        role: 'user',
      })).toDeny();

      // Missing required fields should be denied
      await expect(db.collection('users').doc('alice').set({
        displayName: 'Alice',
      })).toDeny();
    });
  });

  describe('Posts Collection Security', () => {
    it('allows authenticated users to create posts', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const db = alice.firestore();

      await expect(db.collection('posts').add({
        title: 'Test Post',
        content: 'This is a test post',
        authorId: 'alice',
        createdAt: new Date(),
      })).toAllow();
    });

    it('denies unauthenticated users from creating posts', async () => {
      const unauthenticated = testEnv.unauthenticatedContext();
      const db = unauthenticated.firestore();

      await expect(db.collection('posts').add({
        title: 'Test Post',
        content: 'This is a test post',
        authorId: 'anonymous',
      })).toDeny();
    });

    it('allows post authors to delete their own posts', async () => {
      const alice = testEnv.authenticatedContext('alice');

      // Create post with security rules disabled
      let postId: string;
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const docRef = await context.firestore().collection('posts').add({
          title: 'Alice Post',
          content: 'This is Alice\'s post',
          authorId: 'alice',
        });
        postId = docRef.id;
      });

      const db = alice.firestore();
      await expect(db.collection('posts').doc(postId!).delete()).toAllow();
    });

    it('denies users from deleting other users posts', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const bob = testEnv.authenticatedContext('bob');

      // Create Alice's post
      let postId: string;
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const docRef = await context.firestore().collection('posts').add({
          title: 'Alice Post',
          authorId: 'alice',
        });
        postId = docRef.id;
      });

      const bobDb = bob.firestore();
      await expect(bobDb.collection('posts').doc(postId!).delete()).toDeny();
    });
  });

  describe('Admin Collection Security', () => {
    it('allows admin users to access admin collection', async () => {
      const admin = testEnv.authenticatedContext('admin', { admin: true });
      const db = admin.firestore();

      await expect(db.collection('admin').doc('settings').get()).toAllow();
      await expect(db.collection('admin').doc('settings').set({
        maintenanceMode: false,
      })).toAllow();
    });

    it('denies regular users from accessing admin collection', async () => {
      const user = testEnv.authenticatedContext('user', { admin: false });
      const db = user.firestore();

      await expect(db.collection('admin').doc('settings').get()).toDeny();
      await expect(db.collection('admin').doc('settings').set({
        maintenanceMode: true,
      })).toDeny();
    });
  });
});
```

#### 2. Input Validation Testing
```typescript
// Test input validation and sanitization
describe('Input Validation', () => {
  describe('User Input Sanitization', () => {
    it('sanitizes HTML input to prevent XSS', () => {
      const maliciousInput = '<script>alert("XSS")</script><p>Safe content</p>';
      const sanitized = sanitizeHtml(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('validates email addresses properly', () => {
      expect(validateEmail('valid@example.com')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('enforces password strength requirements', () => {
      const strongPassword = 'SecureP@ssw0rd123';
      const weakPassword = 'weak';

      expect(validatePassword(strongPassword)).toEqual({
        isValid: true,
        errors: [],
      });

      expect(validatePassword(weakPassword)).toEqual({
        isValid: false,
        errors: expect.arrayContaining([
          'Password must be at least 8 characters long',
          'Password must contain at least one uppercase letter',
          'Password must contain at least one number',
          'Password must contain at least one special character',
        ]),
      });
    });
  });

  describe('File Upload Validation', () => {
    it('validates file types correctly', () => {
      expect(validateFileType('image.jpg', ['jpg', 'png'])).toBe(true);
      expect(validateFileType('document.pdf', ['jpg', 'png'])).toBe(false);
      expect(validateFileType('script.js', ['jpg', 'png'])).toBe(false);
    });

    it('enforces file size limits', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB

      expect(validateFileSize(1024 * 1024, maxSize)).toBe(true); // 1MB
      expect(validateFileSize(10 * 1024 * 1024, maxSize)).toBe(false); // 10MB
    });
  });
});
```

### Performance Testing

#### 1. Load Testing
```typescript
// Performance testing utilities
describe('Performance Tests', () => {
  it('handles concurrent user operations efficiently', async () => {
    const concurrentUsers = 50;
    const operationsPerUser = 10;

    const promises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
      const userOperations = Array.from({ length: operationsPerUser }, async (_, opIndex) => {
        const startTime = performance.now();

        try {
          await simulateUserOperation(userIndex, opIndex);
          const endTime = performance.now();
          return endTime - startTime;
        } catch (error) {
          console.error(`Operation failed for user ${userIndex}, op ${opIndex}:`, error);
          return null;
        }
      });

      return Promise.all(userOperations);
    });

    const results = await Promise.all(promises);
    const allTimes = results.flat().filter(time => time !== null) as number[];

    const avgTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
    const maxTime = Math.max(...allTimes);

    expect(avgTime).toBeLessThan(500); // Average under 500ms
    expect(maxTime).toBeLessThan(2000); // Max under 2 seconds

    console.log(`Performance Results:
      - Average response time: ${avgTime.toFixed(2)}ms
      - Max response time: ${maxTime.toFixed(2)}ms
      - Successful operations: ${allTimes.length}/${concurrentUsers * operationsPerUser}
    `);
  });

  it('maintains performance under database load', async () => {
    const startTime = performance.now();

    // Simulate heavy database operations
    await Promise.all([
      queryLargeCollection(),
      performBatchWrites(),
      runComplexQueries(),
    ]);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(5000); // Complete within 5 seconds
  });
});

async function simulateUserOperation(userIndex: number, operationIndex: number) {
  // Simulate realistic user operations
  const operations = [
    () => getUserProfile(`user-${userIndex}`),
    () => createPost(`user-${userIndex}`, `Post ${operationIndex}`),
    () => updateUserPreferences(`user-${userIndex}`, { theme: 'dark' }),
    () => searchPosts(`query-${operationIndex}`),
  ];

  const operation = operations[operationIndex % operations.length];
  return operation();
}
```

### Accessibility Testing

#### 1. A11y Testing with Jest and Testing Library
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  it('has no accessibility violations on main page', async () => {
    const { container } = render(<HomePage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', async () => {
    render(<NavigationMenu />);

    const firstMenuItem = screen.getByRole('menuitem', { name: /home/i });
    firstMenuItem.focus();

    fireEvent.keyDown(firstMenuItem, { key: 'ArrowDown' });

    const secondMenuItem = screen.getByRole('menuitem', { name: /profile/i });
    expect(secondMenuItem).toHaveFocus();
  });

  it('provides proper ARIA labels', () => {
    render(<UserForm />);

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });
});
```

## Testing Infrastructure Setup

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
  },
});
```

## Quality Assurance Checklist

### Before Merge
- [ ] All unit tests pass (minimum 80% coverage)
- [ ] Integration tests pass with Firebase emulators
- [ ] Security rules tested thoroughly
- [ ] E2E tests pass on all supported browsers
- [ ] Accessibility tests pass
- [ ] Performance benchmarks met
- [ ] Input validation tested
- [ ] Error handling tested

### CI/CD Pipeline
- [ ] Automated test execution on pull requests
- [ ] Code coverage reporting
- [ ] Security vulnerability scanning
- [ ] Accessibility testing automation
- [ ] Performance regression testing
- [ ] Visual regression testing (if applicable)

### Production Readiness
- [ ] Load testing completed
- [ ] Security penetration testing
- [ ] Backup and recovery testing
- [ ] Monitoring and alerting verified
- [ ] Documentation updated
- [ ] Team training completed

## Testing Commands

```bash
# Unit tests
npm run test
npm run test:watch
npm run test:coverage

# Integration tests
npm run test:integration
npm run test:emulators

# E2E tests
npm run test:e2e
npm run test:e2e:headed

# Security tests
npm run test:security
npm run test:rules

# Performance tests
npm run test:performance
npm run test:load

# Accessibility tests
npm run test:a11y

# All tests
npm run test:all
npm run test:ci
```