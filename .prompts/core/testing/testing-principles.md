# Testing Principles

**Status**: Platform-Agnostic
**Last Updated**: 2025-11-18

## Overview

Universal testing principles and strategies for web applications that apply to any technology stack. These principles ensure code quality, reliability, and maintainability through comprehensive testing.

---

## Testing Pyramid Architecture

The testing pyramid provides a balanced approach to testing with appropriate investment at each level:

```
           /\
          /  \
         / E2E \          10% - End-to-End Tests
        /______\
       /        \
      /Integration\       20% - Integration Tests
     /____________\
    /              \
   /   Unit Tests   \     70% - Unit Tests
  /__________________\
```

**Rationale**:
- **Unit Tests (70%)**: Fast, isolated, numerous - test individual functions and components
- **Integration Tests (20%)**: Test component interactions and data flows
- **E2E Tests (10%)**: Test complete user workflows - slow but high confidence

---

## 1. Unit Testing

**Purpose**: Test individual units of code in isolation

**Best Practices**:
- Test pure functions and isolated logic
- Mock external dependencies
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert
- Aim for high code coverage (80%+) but focus on meaningful tests
- Test edge cases and error conditions

**What to Test**:
- Business logic functions
- Utility functions
- Component rendering and behavior
- State management
- Error handling
- Validation logic

**Anti-Patterns to Avoid**:
- ❌ Testing implementation details instead of behavior
- ❌ Writing tests that depend on other tests
- ❌ Over-mocking that makes tests brittle
- ❌ Testing framework code or third-party libraries
- ❌ Ignoring edge cases and error scenarios

---

## 2. Integration Testing

**Purpose**: Test how multiple units work together

**Best Practices**:
- Test component interactions
- Test data flow between modules
- Use test databases or mock services
- Verify API integrations
- Test authentication and authorization flows
- Clean up test data after each test

**What to Test**:
- API endpoint integration
- Database operations (CRUD)
- Authentication workflows
- Authorization checks
- Data validation across layers
- External service integrations (with mocks)

**Test Isolation**:
- Use test databases separate from production
- Reset state between tests
- Use transactions that rollback
- Clean up created resources
- Avoid test interdependencies

---

## 3. End-to-End Testing

**Purpose**: Test complete user workflows from start to finish

**Best Practices**:
- Test critical user journeys
- Use real browser automation
- Test across multiple browsers/devices
- Keep E2E tests focused and fast
- Use page object pattern for maintainability
- Run E2E tests in CI/CD pipeline

**What to Test**:
- User registration and login flows
- Critical business workflows
- Payment processes
- Data submission and retrieval
- Navigation and routing
- Cross-browser compatibility

**Performance Considerations**:
- Run E2E tests in parallel when possible
- Use test data fixtures for speed
- Implement retry logic for flaky tests
- Skip E2E tests for minor changes (run selectively)

---

## 4. Security Testing

**Purpose**: Validate security controls and identify vulnerabilities

**Test Types**:

**Authentication Testing**:
- Test login/logout functionality
- Verify session management
- Test password reset flows
- Verify MFA if implemented
- Test OAuth flows

**Authorization Testing**:
- Test role-based access control
- Verify permission checks
- Test privilege escalation prevention
- Verify data access restrictions

**Input Validation Testing**:
- Test SQL injection prevention
- Test XSS prevention
- Test command injection prevention
- Verify input sanitization
- Test file upload restrictions

**API Security Testing**:
- Test rate limiting
- Verify CORS configuration
- Test API authentication
- Verify error message security (no info leakage)

---

## 5. Performance Testing

**Purpose**: Ensure application meets performance requirements

**Test Types**:

**Load Testing**:
- Test application under expected load
- Identify bottlenecks
- Measure response times
- Test database query performance

**Stress Testing**:
- Test application beyond normal capacity
- Identify breaking points
- Test recovery mechanisms

**Endurance Testing**:
- Test application over extended periods
- Identify memory leaks
- Test resource cleanup

**Metrics to Monitor**:
- Response time (p50, p95, p99)
- Throughput (requests/second)
- Error rate
- Resource utilization (CPU, memory, database connections)

---

## Testing Best Practices

### Test Organization

**Directory Structure**:
```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   └── Button.test.tsx
│   └── Header/
│       ├── Header.tsx
│       └── Header.test.tsx
├── utils/
│   ├── formatters.ts
│   └── formatters.test.ts
└── __tests__/
    ├── integration/
    │   └── api.test.ts
    └── e2e/
        └── user-workflow.spec.ts
```

**Naming Conventions**:
- Unit tests: `*.test.ts`, `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.spec.ts`

### Test Data Management

**Fixtures**:
- Use consistent test data across tests
- Store fixtures in separate files
- Use factories for dynamic test data

**Mocks**:
- Mock external dependencies
- Use realistic mock data
- Update mocks when APIs change

**Test Databases**:
- Use separate test databases
- Seed with known data
- Clean up after tests

### Continuous Integration

**CI/CD Testing Strategy**:
- Run unit tests on every commit
- Run integration tests on PR
- Run E2E tests before deployment
- Fail builds on test failures
- Report test coverage

**Test Performance in CI**:
- Run tests in parallel
- Cache dependencies
- Use test sharding for large suites
- Set appropriate timeouts

---

## Testing Metrics

### Code Coverage
- **Target**: 80%+ for critical code paths
- **Focus**: Coverage of edge cases, not just lines
- **Tools**: Built-in coverage reports in test frameworks

### Test Quality Metrics
- **Test Reliability**: < 1% flaky test rate
- **Test Speed**: Unit tests < 5s total, integration < 30s
- **Mutation Score**: Aim for 70%+ (if using mutation testing)

### CI/CD Metrics
- **Build Success Rate**: > 95%
- **Test Execution Time**: Trend downward or stable
- **Failed Test Resolution Time**: < 1 day

---

## Common Testing Anti-Patterns

### Anti-Pattern: The Liar
Test passes but feature is broken
**Solution**: Test actual behavior, not mocked behavior

### Anti-Pattern: The Giant
Test does too much, tests multiple things
**Solution**: Break into smaller, focused tests

### Anti-Pattern: The Slow Poke
Tests take too long to run
**Solution**: Optimize setup, use appropriate test types

### Anti-Pattern: The Hidden Dependency
Tests depend on external state or other tests
**Solution**: Ensure test isolation and proper setup/teardown

### Anti-Pattern: The Inspector
Tests implementation details instead of behavior
**Solution**: Test public APIs and user-facing behavior

### Anti-Pattern: The Greedy Catcher
Catches all exceptions, hiding real failures
**Solution**: Be specific about expected exceptions

---

## Testing Checklist

### Before Writing Tests
- [ ] Understand the requirement being tested
- [ ] Choose appropriate test type (unit, integration, E2E)
- [ ] Plan test data and fixtures needed
- [ ] Identify edge cases to test

### While Writing Tests
- [ ] Use descriptive test names
- [ ] Follow AAA pattern (Arrange, Act, Assert)
- [ ] Test both happy path and error cases
- [ ] Ensure test isolation
- [ ] Keep tests simple and focused

### After Writing Tests
- [ ] Verify tests fail when they should
- [ ] Check test coverage
- [ ] Review for flakiness
- [ ] Document complex test scenarios
- [ ] Ensure tests run in CI/CD

---

## Testing Resources

### General Testing
- [Testing Best Practices](https://testingjavascript.com/)
- [The Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Martin Fowler on Testing](https://martinfowler.com/testing/)

### Test-Driven Development
- [TDD by Example](https://www.oreilly.com/library/view/test-driven-development/0321146530/)
- [Growing Object-Oriented Software, Guided by Tests](http://www.growing-object-oriented-software.com/)

### Testing Philosophy
- [Software Testing Guide](https://martinfowler.com/testing/)
- [Testing Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

---

## Platform Implementations

For platform-specific testing implementations, see:
- [Firebase Testing](../../platforms/firebase/firebase-testing.md)
- Other platforms: Add as needed
