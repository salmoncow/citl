# Code Structure & Maintainability Principles

## Universal Architecture Patterns for Scalable Applications

When structuring code in any application, follow these well-architected patterns for maintainability and scalability. These principles apply across languages, frameworks, and platforms.

## Core Organizational Principles

### 1. Separation of Concerns
Organize code by responsibility, not by file type:

```
/src
├── core/                     # Core application functionality
│   ├── config/              # Configuration management
│   ├── services/            # Business logic services
│   └── utilities/           # Shared utilities
├── features/                # Feature-based modules
│   ├── authentication/      # Auth-related code
│   ├── user-management/     # User operations
│   └── dashboard/           # Dashboard functionality
├── shared/                  # Reusable components
│   ├── components/          # UI components
│   ├── utils/              # Helper functions
│   └── types/              # Data definitions
└── infrastructure/          # External concerns
    ├── api/                # API layer
    ├── database/           # Data access
    └── storage/            # File handling
```

### 2. Dependency Direction
- High-level modules should not depend on low-level modules
- Both should depend on abstractions
- Abstractions should not depend on details

```
Application Layer → Domain Layer → Infrastructure Layer
     ↑                  ↑              ↑
Dependencies flow inward, not outward
```

### 3. Single Responsibility Principle
Each module, class, or function should have one reason to change:

**✅ Good:**
```
AuthenticationService - handles only auth operations
UserProfileService - handles only profile operations
NotificationService - handles only notifications
```

**❌ Avoid:**
```
UserService - handles auth, profile, notifications, settings...
```

## Module Design Patterns

### 1. Service Layer Pattern
Encapsulate business logic in service modules:

```
// Authentication Service Interface
interface AuthenticationService {
    signIn(credentials: Credentials): Result<User>
    signOut(): Result<void>
    getCurrentUser(): User | null
    onAuthStateChange(callback: Function): UnsubscribeFunction
}

// Implementation can use any technology
class FirebaseAuthService implements AuthenticationService {
    // Firebase-specific implementation
}

class LocalAuthService implements AuthenticationService {
    // Local storage implementation
}
```

### 2. Repository Pattern
Abstract data access behind interfaces:

```
interface UserRepository {
    findById(id: string): Promise<User | null>
    save(user: User): Promise<void>
    delete(id: string): Promise<void>
    findByEmail(email: string): Promise<User | null>
}

// Can be implemented with any database
class FirestoreUserRepository implements UserRepository {}
class PostgreSQLUserRepository implements UserRepository {}
class InMemoryUserRepository implements UserRepository {} // For testing
```

### 3. Factory Pattern
Create objects without specifying exact classes:

```
interface ServiceFactory {
    createAuthService(): AuthenticationService
    createUserRepository(): UserRepository
    createNotificationService(): NotificationService
}

class DevelopmentServiceFactory implements ServiceFactory {
    createAuthService() {
        return new MockAuthService()
    }
}

class ProductionServiceFactory implements ServiceFactory {
    createAuthService() {
        return new FirebaseAuthService(config)
    }
}
```

## Error Handling Architecture

### 1. Result Pattern
Return structured results instead of throwing exceptions:

```
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

// Usage
async function authenticateUser(credentials): Promise<Result<User>> {
    try {
        const user = await authService.signIn(credentials)
        return { success: true, data: user }
    } catch (error) {
        return { success: false, error }
    }
}
```

### 2. Error Boundary Pattern
Contain errors at appropriate levels:

```
// High-level error handling
class ApplicationErrorHandler {
    handleAuthenticationError(error: AuthError): void {}
    handleValidationError(error: ValidationError): void {}
    handleNetworkError(error: NetworkError): void {}
}

// Module-level error handling
class AuthenticationModule {
    private errorHandler: ErrorHandler

    async signIn(credentials) {
        try {
            // Operation
        } catch (error) {
            this.errorHandler.handle(error)
            throw new AuthenticationError(error.message)
        }
    }
}
```

## Configuration Management

### 1. Environment-Based Configuration
Separate configuration from code:

```
interface AppConfig {
    api: {
        baseUrl: string
        timeout: number
    }
    database: {
        host: string
        port: number
    }
    features: {
        enableAnalytics: boolean
        enableNotifications: boolean
    }
}

// Load from environment variables, files, or external services
class ConfigurationManager {
    load(): AppConfig {}
    get<T>(key: string): T {}
    watch(key: string, callback: Function): void {}
}
```

### 2. Feature Toggle Pattern
Control feature availability through configuration:

```
interface FeatureManager {
    isEnabled(feature: string): boolean
    enable(feature: string): void
    disable(feature: string): void
}

// Usage
if (featureManager.isEnabled('new-dashboard')) {
    renderNewDashboard()
} else {
    renderLegacyDashboard()
}
```

## Testing Architecture

### 1. Test Pyramid Structure
```
E2E Tests (Few)
├── Integration Tests (Some)
└── Unit Tests (Many)
```

### 2. Dependency Injection for Testing
Make components testable by injecting dependencies:

```
class UserService {
    constructor(
        private userRepository: UserRepository,
        private emailService: EmailService,
        private logger: Logger
    ) {}
}

// In tests
const mockUserRepo = new MockUserRepository()
const mockEmailService = new MockEmailService()
const mockLogger = new MockLogger()

const userService = new UserService(mockUserRepo, mockEmailService, mockLogger)
```

### 3. Test Organization
Mirror your source structure in tests:

```
/tests
├── unit/
│   ├── services/
│   ├── components/
│   └── utils/
├── integration/
│   ├── api/
│   └── database/
└── e2e/
    ├── user-flows/
    └── critical-paths/
```

## Performance Patterns

### 1. Lazy Loading
Load modules only when needed:

```
// Dynamic imports
async function loadDashboard() {
    const { DashboardModule } = await import('./dashboard/dashboard-module')
    return new DashboardModule()
}

// Conditional loading
if (user.hasPermission('admin')) {
    const adminModule = await loadAdminModule()
}
```

### 2. Caching Strategy
Implement caching at appropriate layers:

```
interface CacheManager {
    get<T>(key: string): T | null
    set<T>(key: string, value: T, ttl?: number): void
    invalidate(key: string): void
    clear(): void
}

class UserService {
    constructor(
        private userRepo: UserRepository,
        private cache: CacheManager
    ) {}

    async getUser(id: string): Promise<User> {
        const cached = this.cache.get(`user:${id}`)
        if (cached) return cached

        const user = await this.userRepo.findById(id)
        this.cache.set(`user:${id}`, user, 300) // 5 minutes
        return user
    }
}
```

## Code Quality Guidelines

### 1. Naming Conventions
- **Modules/Classes**: PascalCase (`UserService`, `AuthenticationModule`)
- **Functions/Methods**: camelCase (`getUserById`, `validateCredentials`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`)
- **Files**: kebab-case (`user-service.js`, `auth-module.py`)

### 2. Function Design
```
// ✅ Pure functions when possible
function calculateTax(amount: number, rate: number): number {
    return amount * rate
}

// ✅ Single responsibility
function validateEmail(email: string): boolean {
    // Only validates email format
}

function sendEmail(to: string, subject: string, body: string): Promise<void> {
    // Only sends emails
}

// ✅ Consistent error handling
async function processPayment(amount: number): Promise<Result<Payment>> {
    // Returns structured result
}
```

### 3. Documentation Standards
```
/**
 * Authenticates a user with provided credentials
 *
 * @param credentials - User login credentials
 * @returns Promise resolving to authentication result
 * @throws AuthenticationError when credentials are invalid
 */
async function authenticateUser(credentials: Credentials): Promise<Result<User>>
```

## Deployment and Operations

### 1. Environment Parity
Keep development, staging, and production as similar as possible:

```
// Same configuration structure across environments
const config = {
    development: { /* dev settings */ },
    staging: { /* staging settings */ },
    production: { /* prod settings */ }
}
```

### 2. Health Checks
Implement standardized health monitoring:

```
interface HealthCheck {
    name: string
    check(): Promise<HealthStatus>
}

class DatabaseHealthCheck implements HealthCheck {
    name = 'database'

    async check(): Promise<HealthStatus> {
        try {
            await this.database.ping()
            return { status: 'healthy', timestamp: new Date() }
        } catch (error) {
            return { status: 'unhealthy', error: error.message, timestamp: new Date() }
        }
    }
}
```

## Security Patterns

### 1. Input Validation
Validate all inputs at boundaries:

```
interface Validator<T> {
    validate(input: unknown): Result<T>
}

class EmailValidator implements Validator<string> {
    validate(input: unknown): Result<string> {
        if (typeof input !== 'string') {
            return { success: false, error: new Error('Email must be string') }
        }

        if (!this.isValidEmail(input)) {
            return { success: false, error: new Error('Invalid email format') }
        }

        return { success: true, data: input }
    }
}
```

### 2. Authorization Patterns
Implement consistent permission checking:

```
interface AuthorizationService {
    hasPermission(user: User, resource: string, action: string): boolean
    checkPermission(user: User, resource: string, action: string): void
}

// Usage
function deleteUser(userId: string, currentUser: User) {
    authService.checkPermission(currentUser, 'users', 'delete')
    // Proceed with deletion
}
```

## Universal Principles Checklist

### Architecture Design
- [ ] Clear separation of concerns
- [ ] Dependency inversion applied
- [ ] Single responsibility principle followed
- [ ] Interface segregation implemented
- [ ] Open/closed principle respected

### Code Organization
- [ ] Feature-based organization over technical grouping
- [ ] Consistent naming conventions
- [ ] Clear module boundaries
- [ ] Appropriate abstraction levels
- [ ] Documentation for public interfaces

### Quality Assurance
- [ ] Comprehensive error handling
- [ ] Input validation at boundaries
- [ ] Structured logging implemented
- [ ] Performance monitoring in place
- [ ] Security considerations addressed

### Testing Strategy
- [ ] Test pyramid structure
- [ ] Dependency injection for testability
- [ ] Integration test coverage
- [ ] End-to-end test automation
- [ ] Performance test scenarios

### Operations
- [ ] Environment parity maintained
- [ ] Health checks implemented
- [ ] Configuration externalized
- [ ] Deployment automation
- [ ] Monitoring and alerting

These principles apply regardless of whether you're building with vanilla JavaScript, React, Python, Java, or any other technology. Focus on the architectural patterns and adapt the implementation to your chosen tools.