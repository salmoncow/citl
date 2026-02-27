# Development Prompts Library

Foundational development guidance organized by platform-agnostic principles and platform-specific implementations.

**Note**: This library works alongside **Spec-Kit** (`.specs/`) for a hybrid architecture:
- **Prompts** (this library) = Foundational, universal patterns and best practices
- **Spec-Kit** (`.specs/`) = Project-specific constraints, technical configurations, and feature specifications

See [Spec-Kit Integration Guide](./meta/speckit-integration-guide.md) for complete documentation.

---

## Quick Navigation

### 🎯 [Core Principles](./core/) (Platform-Agnostic)
Universal software development principles applicable to any technology stack.

### 🔥 [Firebase Implementation](./platforms/firebase/)
Firebase-specific implementations of core principles.

### 📚 [Meta-Guidance](./meta/)
Library maintenance, prompt management, and spec-kit integration.

### 📋 [Spec-Kit](../.specs/) (Project-Specific)
Constitutional spec, technical configurations, and feature specifications.

---

## Core Principles (Platform-Agnostic)

These principles apply to any technology stack and form the foundation of good software development practices.

### Architecture
- [Code Structure](./core/architecture/code-structure.md) - Separation of concerns, dependency injection, layered architecture
- [Modular Architecture](./core/architecture/modular-architecture-principles.md) - Right-sized modularity, coupling/cohesion
- [Feature Extensibility](./core/architecture/feature-extensibility.md) - Plugin architecture, extensibility patterns

### Development Practices
- [Asset Reusability](./core/development/asset-reusability.md) - DRY principles, asset pipeline, resource management
- [Git Best Practices](./core/development/git-best-practices.md) - Git workflows, commit conventions, branching strategies

**Project-Specific Build & Deployment**:
- Build System: `.specs/technical/build-system.md`
- CI/CD Pipeline: `.specs/technical/cicd-pipeline.md`

### Security
- [Security Principles](./core/security/security-principles.md) - Authentication, authorization, data protection, API security

### Testing & QA
- [Testing Principles](./core/testing/testing-principles.md) - Testing pyramid, unit/integration/E2E testing, best practices

### Operations
- [Monitoring Principles](./core/operations/monitoring-principles.md) - Observability pillars, metrics, logs, traces
- [Platform Simplification](./core/operations/platform-simplification-principles.md) - Reducing complexity, minimizing platforms
- [Budget Principles](./core/operations/budget-principles.md) - FinOps, cost optimization, resilience patterns

---

## Firebase Implementation

Firebase-specific patterns, configurations, and best practices. All Firebase guides reference their corresponding core principles.

### Firebase Guides
- [Firebase Best Practices](./platforms/firebase/firebase-best-practices.md) - Firebase SDK patterns, Firestore, Auth
- [Firebase Security](./platforms/firebase/firebase-security.md) - Firestore rules, App Check, custom claims
- [Firebase Testing](./platforms/firebase/firebase-testing.md) - Emulator usage, security rules testing
- [Firebase Monitoring](./platforms/firebase/firebase-monitoring.md) - Performance Monitoring, Analytics, logging

**Project-Specific Firebase Configuration**:
- Firebase Deployment: `.specs/technical/firebase-deployment.md`
- Project Constraints: `.specs/constitution.md` §VI (Cost constraints, free tier limits)

---

## Meta-Guidance

Documentation about maintaining this prompt library and spec-kit integration.

- [Spec-Kit Integration Guide](./meta/speckit-integration-guide.md) - **START HERE** - Hybrid architecture documentation
- [Prompt Maintenance](./meta/prompt-maintenance.md) - Keeping prompts current and accurate
- [Architectural Evolution Strategy](./meta/architectural-evolution-strategy.md) - Phase-based evolution framework
- [Architectural Decision Log](./meta/architectural-decision-log.md) - Historical decisions and current state
- [Prompt Gap Protocol](./meta/prompt-gap-protocol.md) - Handling insufficient guidance

---

## How to Use This Library

**🚀 New? Start Here**: [Spec-Kit Integration Guide](./meta/speckit-integration-guide.md)

### For New Features
1. **Start with Spec-Kit**: `/speckit-specify <feature-name>` (creates `.specs/features/<feature>.md`)
2. **Consult Constitutional Constraints**: Read `.specs/constitution.md` for project-specific requirements
3. **Apply Foundational Patterns**: Reference prompts from this library:
   - [Modular Architecture](./core/architecture/modular-architecture-principles.md)
   - [Firebase Best Practices](./platforms/firebase/firebase-best-practices.md)
4. **Design Implementation**: `/speckit-plan` (applies prompt patterns)
5. **Execute**: `/speckit-implement` (follows constitutional + prompt guidance)

### For Architectural Decisions
1. Check [Architectural Decision Log](./meta/architectural-decision-log.md) for current state
2. Review [Architectural Evolution Strategy](./meta/architectural-evolution-strategy.md) for decision triggers
3. Consult [Core Principles](./core/) to understand universal patterns
4. Reference [Firebase Implementation](./platforms/firebase/) for platform-specific guidance

### For Security Implementation
1. Read constitutional requirements: `.specs/constitution.md` §III.2
2. Study universal patterns: [Security Principles](./core/security/security-principles.md)
3. Apply Firebase patterns: [Firebase Security](./platforms/firebase/firebase-security.md)

---

## Philosophy

### Core Principles
**Universal, reusable guidance** that applies regardless of hosting platform or cloud provider. These principles represent fundamental software engineering best practices.

### Platform Implementations
**Concrete, actionable patterns** for specific technologies. Firebase implementations show how to apply core principles using Firebase services.

### Future Extensibility
This structure supports adding new platforms (Vercel, AWS, Netlify) without modifying core principles:

```
.prompts/platforms/
├── firebase/      # Current
├── vercel/        # Future
├── aws/           # Future
└── netlify/       # Future
```

---

## Contributing to This Library

See [Prompt Maintenance](./meta/prompt-maintenance.md) for guidelines on:
- Updating existing prompts
- Adding new prompts
- Maintaining accuracy
- Version management

