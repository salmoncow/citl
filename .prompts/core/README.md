# Core Principles (Platform-Agnostic)

Universal software development principles that apply to any technology stack.

---

## Architecture

Foundational patterns for organizing and structuring code.

### [Code Structure](./architecture/code-structure.md)
- Separation of concerns
- Dependency injection
- Layered architecture
- Module organization

### [Modular Architecture Principles](./architecture/modular-architecture-principles.md)
- Right-sized modularity
- Coupling and cohesion
- Module boundaries
- Interface design

### [Feature Extensibility](./architecture/feature-extensibility.md)
- Plugin architecture
- Strategy pattern
- Extension points
- Backward compatibility

---

## Development Practices

Day-to-day development workflows and patterns.

### [Asset Reusability](./development/asset-reusability.md)
- DRY (Don't Repeat Yourself) principles
- Asset pipeline design
- Resource management
- Reusable component patterns

### [Git Best Practices](./development/git-best-practices.md)
- Git workflows (feature branches, trunk-based development)
- Commit conventions
- Branching strategies
- Code review practices

---

## Security

Defense-in-depth security principles.

### [Security Principles](./security/security-principles.md)
- Authentication & authorization
- Data protection & privacy
- API security (rate limiting, CORS, input validation)
- Infrastructure security
- Security monitoring & incident response
- Common security anti-patterns

---

## Testing & QA

Comprehensive testing strategies for quality assurance.

### [Testing Principles](./testing/testing-principles.md)
- Testing pyramid architecture
- Unit testing best practices
- Integration testing patterns
- End-to-end testing strategies
- Security testing
- Performance testing
- Testing anti-patterns

---

## Operations

Running and maintaining production systems.

### [Monitoring Principles](./operations/monitoring-principles.md)
- Observability pillars (metrics, logs, traces)
- What to monitor
- Alerting best practices
- Performance tracking

### [Platform Simplification Principles](./operations/platform-simplification-principles.md)
- Minimizing platform complexity
- Reducing operational overhead
- Platform consolidation
- Decision framework for new platforms

### [Budget Principles](./operations/budget-principles.md)
- FinOps fundamentals
- Designing for cost efficiency
- Cost visibility and tracking
- Error handling & retry patterns
- Resource optimization

---

## Platform Implementations

These core principles are implemented for specific platforms:

- [Firebase Implementation](../platforms/firebase/) - Firebase-specific patterns and configurations

---

## Using Core Principles

### Start Here For:

**Architecture Decisions** → Architecture section
**Security Implementation** → Security Principles
**Testing Strategy** → Testing Principles
**Deployment Planning** → See `.specs/technical/cicd-pipeline.md`
**Cost Optimization** → Budget Principles
**Operational Simplification** → Platform Simplification

### Then Move To:

Platform-specific implementations for concrete, actionable patterns using your chosen technology stack.

---

## Philosophy

Core principles are:
- ✅ **Platform-agnostic** - Apply to any technology
- ✅ **Timeless** - Fundamental patterns that don't change frequently
- ✅ **Reusable** - Can be referenced across multiple projects
- ✅ **Educational** - Teach the "why" behind the "how"

Core principles are NOT:
- ❌ **Implementation-specific** - No Firebase/AWS/Vercel-specific code
- ❌ **Opinionated about tools** - Tool choices belong in platform implementations
- ❌ **Prescriptive about exact patterns** - Provide options and trade-offs
