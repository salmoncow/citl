# Feature Extensibility & Modularity Principles

## Universal Patterns for Building Extensible Systems

When designing applications for extensibility, follow these technology-agnostic patterns that enable modular growth, feature toggles, and plugin architectures across any platform or language.

## Core Extensibility Principles

### 1. Open/Closed Principle
Software entities should be open for extension but closed for modification:

```
// Define stable interfaces
interface AuthenticationProvider {
    authenticate(credentials): Promise<Result<User>>
    refresh(token): Promise<Result<Token>>
    revoke(token): Promise<Result<void>>
}

// Extend through new implementations, not modifications
class OAuthProvider implements AuthenticationProvider {}
class SAMLProvider implements AuthenticationProvider {}
class LocalProvider implements AuthenticationProvider {}
```

### 2. Dependency Inversion
Depend on abstractions, not concretions:

```
// High-level module depends on abstraction
class UserService {
    constructor(
        private authProvider: AuthenticationProvider,
        private userRepository: UserRepository,
        private logger: Logger
    ) {}
}

// Low-level modules implement abstractions
class FirebaseAuthProvider implements AuthenticationProvider {}
class DatabaseUserRepository implements UserRepository {}
```

### 3. Interface Segregation
Many client-specific interfaces are better than one general-purpose interface:

```
// ❌ Fat interface
interface UserManager {
    authenticate()
    authorize()
    createProfile()
    updateProfile()
    sendNotification()
    generateReport()
}

// ✅ Segregated interfaces
interface Authenticator { authenticate() }
interface Authorizer { authorize() }
interface ProfileManager { createProfile(), updateProfile() }
interface NotificationSender { sendNotification() }
```

## Plugin Architecture Patterns

### 1. Plugin Interface Design
Define clear contracts for extensions:

```
interface Plugin {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly dependencies?: string[]

    initialize(context: ApplicationContext): Promise<void>
    activate(): Promise<void>
    deactivate(): Promise<void>
    destroy(): Promise<void>
}

interface ApplicationContext {
    config: Configuration
    services: ServiceRegistry
    eventBus: EventBus
    logger: Logger
}
```

### 2. Plugin Registry Pattern
Manage plugin lifecycle centrally:

```
interface PluginRegistry {
    register(plugin: Plugin): Promise<void>
    unregister(pluginId: string): Promise<void>
    get(pluginId: string): Plugin | null
    getAll(): Plugin[]
    isActive(pluginId: string): boolean
}

class DefaultPluginRegistry implements PluginRegistry {
    private plugins = new Map<string, Plugin>()
    private activePlugins = new Set<string>()

    async register(plugin: Plugin): Promise<void> {
        // Validate dependencies
        this.validateDependencies(plugin)

        // Initialize plugin
        await plugin.initialize(this.context)

        // Store plugin
        this.plugins.set(plugin.id, plugin)

        // Activate if auto-start enabled
        if (this.shouldAutoActivate(plugin)) {
            await this.activate(plugin.id)
        }
    }

    private validateDependencies(plugin: Plugin): void {
        if (!plugin.dependencies) return

        for (const dep of plugin.dependencies) {
            if (!this.plugins.has(dep)) {
                throw new Error(`Plugin ${plugin.id} requires ${dep}`)
            }
        }
    }
}
```

### 3. Hook System
Allow plugins to extend application behavior:

```
interface HookManager {
    registerHook(event: string, handler: HookHandler): UnsubscribeFunction
    executeHook(event: string, data: any): Promise<any>
    removeHook(event: string, handler: HookHandler): void
}

type HookHandler = (data: any) => Promise<any> | any

// Usage examples
hookManager.registerHook('user:beforeCreate', async (userData) => {
    // Validate user data
    return validatedData
})

hookManager.registerHook('user:afterCreate', async (user) => {
    // Send welcome email
    await emailService.sendWelcome(user)
})

// In application code
async function createUser(userData) {
    const processedData = await hookManager.executeHook('user:beforeCreate', userData)
    const user = await userRepository.save(processedData)
    await hookManager.executeHook('user:afterCreate', user)
    return user
}
```

## Feature Toggle Patterns

### 1. Feature Flag Interface
Abstract feature control from implementation:

```
interface FeatureToggle {
    isEnabled(feature: string, context?: ToggleContext): boolean
    getAllFeatures(): FeatureFlag[]
    onToggleChange(callback: (feature: string, enabled: boolean) => void): UnsubscribeFunction
}

interface ToggleContext {
    userId?: string
    userRole?: string
    environment?: string
    customAttributes?: Record<string, any>
}

interface FeatureFlag {
    name: string
    enabled: boolean
    rolloutPercentage?: number
    userSegments?: string[]
    startDate?: Date
    endDate?: Date
    conditions?: ToggleCondition[]
}
```

### 2. Conditional Feature Loading
Load features based on toggles:

```
// Module factory pattern
interface ModuleFactory {
    createModule(name: string): Promise<Module | null>
}

class FeatureToggleModuleFactory implements ModuleFactory {
    constructor(
        private featureToggle: FeatureToggle,
        private moduleLoaders: Map<string, () => Promise<Module>>
    ) {}

    async createModule(name: string): Promise<Module | null> {
        if (!this.featureToggle.isEnabled(name)) {
            return null
        }

        const loader = this.moduleLoaders.get(name)
        if (!loader) {
            throw new Error(`No loader registered for module: ${name}`)
        }

        return await loader()
    }
}

// Usage
const dashboardModule = await moduleFactory.createModule('new-dashboard')
if (dashboardModule) {
    await dashboardModule.initialize()
} else {
    // Fall back to legacy dashboard
    const legacyDashboard = await moduleFactory.createModule('legacy-dashboard')
    await legacyDashboard.initialize()
}
```

### 3. Gradual Feature Rollout
Implement percentage-based rollouts:

```
class GradualRolloutToggle implements FeatureToggle {
    isEnabled(feature: string, context?: ToggleContext): boolean {
        const flag = this.getFeatureFlag(feature)
        if (!flag || !flag.enabled) return false

        // Check date range
        if (!this.isWithinDateRange(flag)) return false

        // Check user segments
        if (!this.isInTargetSegment(flag, context)) return false

        // Check rollout percentage
        if (flag.rolloutPercentage < 100) {
            return this.isInRolloutPercentage(flag, context)
        }

        return true
    }

    private isInRolloutPercentage(flag: FeatureFlag, context?: ToggleContext): boolean {
        if (!context?.userId) return false

        // Consistent hash-based percentage
        const hash = this.hashString(context.userId + flag.name)
        return (hash % 100) < flag.rolloutPercentage
    }
}
```

## Configuration-Driven Architecture

### 1. External Configuration
Make features configurable without code changes:

```
interface ConfigurationProvider {
    get<T>(key: string, defaultValue?: T): T
    watch<T>(key: string, callback: (value: T) => void): UnsubscribeFunction
    set(key: string, value: any): Promise<void>
}

// Configuration schema
interface AppConfiguration {
    features: {
        [featureName: string]: {
            enabled: boolean
            config?: Record<string, any>
        }
    }
    modules: {
        [moduleName: string]: {
            autoLoad: boolean
            config?: Record<string, any>
        }
    }
    integrations: {
        [serviceName: string]: {
            enabled: boolean
            endpoint?: string
            credentials?: Record<string, any>
        }
    }
}
```

### 2. Runtime Configuration Updates
Allow configuration changes without restarts:

```
class RuntimeConfigurationManager {
    private watchers = new Map<string, Array<(value: any) => void>>()

    watch<T>(key: string, callback: (value: T) => void): UnsubscribeFunction {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, [])
        }

        this.watchers.get(key)!.push(callback)

        return () => {
            const callbacks = this.watchers.get(key)
            if (callbacks) {
                const index = callbacks.indexOf(callback)
                if (index !== -1) {
                    callbacks.splice(index, 1)
                }
            }
        }
    }

    private notifyWatchers(key: string, value: any): void {
        const callbacks = this.watchers.get(key) || []
        callbacks.forEach(callback => {
            try {
                callback(value)
            } catch (error) {
                this.logger.error(`Error in configuration watcher for ${key}:`, error)
            }
        })
    }
}
```

## Event-Driven Extensibility

### 1. Event Bus Pattern
Enable loose coupling between modules:

```
interface EventBus {
    subscribe<T>(event: string, handler: EventHandler<T>): UnsubscribeFunction
    publish<T>(event: string, data: T): Promise<void>
    unsubscribe(event: string, handler: EventHandler<any>): void
}

type EventHandler<T> = (event: Event<T>) => Promise<void> | void

interface Event<T> {
    type: string
    data: T
    timestamp: Date
    source?: string
    correlationId?: string
}

// Usage
eventBus.subscribe('user.created', async (event) => {
    await analyticsService.trackUserCreation(event.data)
})

eventBus.subscribe('user.created', async (event) => {
    await emailService.sendWelcomeEmail(event.data)
})

// Publishing events
await eventBus.publish('user.created', { userId, email, role })
```

### 2. Domain Events
Model business events as first-class concepts:

```
abstract class DomainEvent {
    readonly occurredOn: Date = new Date()
    readonly eventId: string = generateUUID()

    abstract readonly eventType: string
    abstract readonly aggregateId: string
}

class UserCreatedEvent extends DomainEvent {
    readonly eventType = 'UserCreated'

    constructor(
        readonly aggregateId: string,
        readonly email: string,
        readonly role: string
    ) {
        super()
    }
}

// Event sourcing pattern
interface EventStore {
    append(aggregateId: string, events: DomainEvent[]): Promise<void>
    getEvents(aggregateId: string): Promise<DomainEvent[]>
    subscribe(eventType: string, handler: EventHandler<DomainEvent>): UnsubscribeFunction
}
```

## API Extensibility Patterns

### 1. Versioned APIs
Support multiple API versions simultaneously:

```
interface APIVersion {
    readonly version: string
    readonly endpoints: APIEndpoint[]
    readonly deprecated?: boolean
    readonly sunsetDate?: Date
}

interface APIEndpoint {
    path: string
    method: HttpMethod
    handler: RequestHandler
    middleware?: Middleware[]
    documentation?: string
}

class VersionedAPIManager {
    private versions = new Map<string, APIVersion>()

    registerVersion(version: APIVersion): void {
        this.versions.set(version.version, version)
    }

    async handleRequest(request: APIRequest): Promise<APIResponse> {
        const version = this.extractVersion(request)
        const apiVersion = this.versions.get(version)

        if (!apiVersion) {
            throw new APIError(`API version ${version} not supported`)
        }

        if (apiVersion.deprecated) {
            this.logDeprecationWarning(version, apiVersion.sunsetDate)
        }

        return this.routeRequest(request, apiVersion)
    }
}
```

### 2. Extension Points
Define clear extension mechanisms:

```
// Middleware pattern for request processing
interface Middleware {
    execute(request: Request, next: NextFunction): Promise<Response>
}

class AuthenticationMiddleware implements Middleware {
    async execute(request: Request, next: NextFunction): Promise<Response> {
        // Validate authentication
        if (!this.isAuthenticated(request)) {
            throw new UnauthorizedError()
        }

        return next(request)
    }
}

// Plugin can register custom middleware
class CustomSecurityPlugin implements Plugin {
    async initialize(context: ApplicationContext): Promise<void> {
        context.apiManager.registerMiddleware(new CustomSecurityMiddleware())
    }
}
```

## Data Schema Evolution

### 1. Schema Versioning
Handle data structure changes over time:

```
interface SchemaVersion {
    version: number
    schema: Schema
    migrationUp?: (data: any) => any
    migrationDown?: (data: any) => any
}

class SchemaEvolutionManager {
    private versions = new Map<number, SchemaVersion>()

    registerVersion(schemaVersion: SchemaVersion): void {
        this.versions.set(schemaVersion.version, schemaVersion)
    }

    migrate(data: any, fromVersion: number, toVersion: number): any {
        let currentData = data
        let currentVersion = fromVersion

        while (currentVersion < toVersion) {
            const nextVersion = this.versions.get(currentVersion + 1)
            if (!nextVersion?.migrationUp) {
                throw new Error(`No migration path from ${currentVersion} to ${currentVersion + 1}`)
            }

            currentData = nextVersion.migrationUp(currentData)
            currentVersion++
        }

        return currentData
    }
}
```

### 2. Backward Compatibility
Maintain compatibility across changes:

```
// Adapter pattern for legacy support
interface LegacyUserService {
    getUser(id: number): LegacyUser
}

interface ModernUserService {
    getUser(id: string): Promise<ModernUser>
}

class UserServiceAdapter implements LegacyUserService {
    constructor(private modernService: ModernUserService) {}

    getUser(id: number): LegacyUser {
        // Convert and delegate to modern service
        const modernUser = await this.modernService.getUser(id.toString())
        return this.convertToLegacyFormat(modernUser)
    }

    private convertToLegacyFormat(user: ModernUser): LegacyUser {
        // Transform modern user to legacy format
        return {
            id: parseInt(user.id),
            name: user.displayName,
            // ... other mappings
        }
    }
}
```

## Testing Extensible Systems

### 1. Plugin Testing Strategy
Test plugins in isolation and integration:

```
// Plugin test harness
class PluginTestHarness {
    private mockContext: ApplicationContext

    setup(): void {
        this.mockContext = {
            config: new MockConfiguration(),
            services: new MockServiceRegistry(),
            eventBus: new MockEventBus(),
            logger: new MockLogger()
        }
    }

    async testPlugin(plugin: Plugin): Promise<TestResult> {
        try {
            await plugin.initialize(this.mockContext)
            await plugin.activate()

            // Run plugin-specific tests
            const testResults = await this.runPluginTests(plugin)

            await plugin.deactivate()
            await plugin.destroy()

            return { success: true, results: testResults }
        } catch (error) {
            return { success: false, error }
        }
    }
}
```

### 2. Feature Toggle Testing
Test all feature combinations:

```
class FeatureToggleTestSuite {
    async testFeatureCombinations(features: string[]): Promise<TestResult[]> {
        const combinations = this.generateCombinations(features)
        const results: TestResult[] = []

        for (const combination of combinations) {
            const testEnvironment = await this.createTestEnvironment(combination)
            const result = await this.runTestSuite(testEnvironment)
            results.push({
                combination,
                success: result.success,
                errors: result.errors
            })
        }

        return results
    }

    private generateCombinations(features: string[]): FeatureCombination[] {
        // Generate all possible on/off combinations
        const combinations: FeatureCombination[] = []
        const totalCombinations = Math.pow(2, features.length)

        for (let i = 0; i < totalCombinations; i++) {
            const combination: FeatureCombination = {}
            features.forEach((feature, index) => {
                combination[feature] = Boolean(i & (1 << index))
            })
            combinations.push(combination)
        }

        return combinations
    }
}
```

## Extensibility Checklist

### Design Principles
- [ ] Open/Closed principle applied
- [ ] Dependency inversion implemented
- [ ] Interface segregation followed
- [ ] Plugin contracts well-defined
- [ ] Extension points documented

### Feature Management
- [ ] Feature toggles implemented
- [ ] Gradual rollout capability
- [ ] A/B testing support
- [ ] Configuration externalized
- [ ] Runtime updates supported

### API Design
- [ ] Versioning strategy defined
- [ ] Backward compatibility maintained
- [ ] Extension mechanisms provided
- [ ] Documentation automated
- [ ] Breaking changes managed

### Data Management
- [ ] Schema evolution planned
- [ ] Migration strategies defined
- [ ] Backward compatibility ensured
- [ ] Data validation implemented
- [ ] Rollback procedures tested

### Testing Strategy
- [ ] Plugin testing framework
- [ ] Integration test coverage
- [ ] Feature combination testing
- [ ] Performance testing included
- [ ] Security testing automated

These patterns enable building systems that can grow and evolve over time without requiring major rewrites, regardless of the underlying technology stack.