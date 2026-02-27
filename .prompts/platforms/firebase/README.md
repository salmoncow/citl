# Firebase Implementation Guide

Firebase-specific implementations of core software development principles.

---

## Quick Reference

### Essential Guides
- [Firebase Best Practices](./firebase-best-practices.md) - SDK patterns, Firestore, Auth fundamentals
- [Firebase Security](./firebase-security.md) - Security rules, App Check, custom claims
- [Firebase Deployment](./firebase-deployment.md) - GitHub Actions, Hosting, Functions CI/CD

### Specialized Topics
- [Firebase Testing](./firebase-testing.md) - Emulator, security rules testing, unit/integration tests
- [Firebase Monitoring](./firebase-monitoring.md) - Performance Monitoring, Analytics, Cloud Logging
- [Firebase FinOps](./firebase-finops.md) - Free tier maximization, cost optimization
- [Firebase Resilience](./firebase-resilience.md) - Error handling, retry patterns, budget-friendly patterns

---

## Firebase Guides by Topic

### Security & Authentication
**Core Principles**: [Security Principles](../../core/security/security-principles.md)

**Firebase Implementation**: [Firebase Security](./firebase-security.md)
- Firebase Auth custom claims for RBAC
- Firestore Security Rules templates and patterns
- Cloud Functions security (input validation, CORS, rate limiting)
- Firebase App Check integration
- Security testing with Firebase Emulator

---

### Testing & Quality Assurance
**Core Principles**: [Testing Principles](../../core/testing/testing-principles.md)

**Firebase Implementation**: [Firebase Testing](./firebase-testing.md)
- Firebase Emulator usage
- Firestore Security Rules testing
- Firebase Auth testing
- Cloud Functions unit and integration tests
- E2E testing with Firebase services

---

### Deployment & CI/CD
**Firebase Implementation**: [Firebase Deployment](./firebase-deployment.md)
- GitHub Actions workflows for Firebase
- Firebase Hosting deployment (production and preview channels)
- Cloud Functions deployment strategies
- Firestore Rules deployment
- Environment management and secrets

---

### Monitoring & Observability
**Core Principles**: [Monitoring Principles](../../core/operations/monitoring-principles.md)

**Firebase Implementation**: [Firebase Monitoring](./firebase-monitoring.md)
- Firebase Performance Monitoring integration
- Firebase Analytics event tracking
- Cloud Logging and log analysis
- Free-tier monitoring strategies
- Alerting with Discord webhooks and GitHub Actions

---

### Cost Optimization & FinOps
**Core Principles**: [Budget Principles](../../core/operations/budget-principles.md)

**Firebase Implementation**:
- [Firebase FinOps](./firebase-finops.md) - Free tier maximization, quota management
- [Firebase Resilience](./firebase-resilience.md) - Budget-friendly resilience patterns

---

### Platform Simplification
**Core Principles**: [Platform Simplification Principles](../../core/operations/platform-simplification-principles.md)

Platform simplification strategy is documented in the core principles. Firebase + GitHub serves as the two-platform strategy for this project.

---

## Firebase Service Coverage

### Firebase Authentication
- Covered in: [Firebase Best Practices](./firebase-best-practices.md), [Firebase Security](./firebase-security.md)
- Custom claims, OAuth providers, session management

### Firestore Database
- Covered in: [Firebase Best Practices](./firebase-best-practices.md), [Firebase Security](./firebase-security.md), [Firebase Testing](./firebase-testing.md)
- Security rules, data modeling, real-time listeners

### Firebase Hosting
- Covered in: [Firebase Deployment](./firebase-deployment.md), [Firebase FinOps](./firebase-finops.md)
- Static hosting, preview channels, CDN configuration

### Cloud Functions
- Covered in: [Firebase Best Practices](./firebase-best-practices.md), [Firebase Security](./firebase-security.md), [Firebase Deployment](./firebase-deployment.md)
- HTTP functions, callable functions, triggers

### Firebase Performance Monitoring
- Covered in: [Firebase Monitoring](./firebase-monitoring.md)
- Custom traces, automatic monitoring

### Firebase Analytics
- Covered in: [Firebase Monitoring](./firebase-monitoring.md)
- Event tracking, user properties

### Firebase App Check
- Covered in: [Firebase Security](./firebase-security.md)
- Request verification, abuse prevention

---

## How to Use These Guides

### For New Firebase Projects
1. Start with [Firebase Best Practices](./firebase-best-practices.md) for foundational patterns
2. Set up security with [Firebase Security](./firebase-security.md)
3. Configure CI/CD using [Firebase Deployment](./firebase-deployment.md)
4. Implement testing following [Firebase Testing](./firebase-testing.md)
5. Optimize costs with [Firebase FinOps](./firebase-finops.md)

### For Existing Projects
1. Review [Firebase Security](./firebase-security.md) to audit security rules
2. Check [Firebase FinOps](./firebase-finops.md) for cost optimization opportunities
3. Improve reliability with [Firebase Resilience](./firebase-resilience.md)
4. Enhance observability using [Firebase Monitoring](./firebase-monitoring.md)

### For Specific Features
1. Review relevant core principle first (linked at top of each Firebase guide)
2. Implement using Firebase-specific patterns from the guide
3. Test using patterns from [Firebase Testing](./firebase-testing.md)
4. Monitor using patterns from [Firebase Monitoring](./firebase-monitoring.md)

---

## Firebase + GitHub Stack

This implementation assumes:
- **Backend**: Firebase (Auth, Firestore, Functions, Hosting, Storage)
- **CI/CD**: GitHub Actions
- **Repository**: GitHub
- **Monitoring**: Firebase Console + free-tier services

For platform simplification rationale, see [Platform Simplification Principles](../../core/operations/platform-simplification-principles.md).

---

## Free Tier Optimization

All guides prioritize free tier usage where possible:
- Firebase Spark Plan (free tier) for small/medium apps
- GitHub Actions free tier for CI/CD
- Free monitoring services (UptimeRobot, Discord webhooks)
- Efficient Firestore queries to stay within quotas
- Smart caching to minimize reads

See [Firebase FinOps](./firebase-finops.md) for comprehensive free tier strategies.

---

## Cross-References to Core Principles

All Firebase guides link to their corresponding core principles. This ensures:
- **Universal understanding** before Firebase-specific implementation
- **Consistent patterns** across different platforms
- **Educational value** - learn the "why" before the "how"
- **Future-proof knowledge** - core principles apply even if you migrate away from Firebase

---

## Contributing to Firebase Guides

When updating Firebase guides:
- Keep core principles separate (update in `../../core/` instead)
- Include code examples with Firebase SDK
- Reference Firebase documentation
- Test examples with Firebase Emulator when applicable
- Update version numbers when Firebase SDK changes
- Cross-link related guides

See [Prompt Maintenance](../../meta/prompt-maintenance.md) for details.
