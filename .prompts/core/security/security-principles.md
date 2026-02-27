# Security Principles

**Status**: Platform-Agnostic
**Last Updated**: 2025-12-08

## Overview

Universal security principles for web applications that apply to any technology stack. These principles form the foundation of a defense-in-depth security architecture.

---

## Core Security Principles

### 1. Authentication & Authorization

**Multi-Factor Authentication (MFA)**
- Implement MFA for all user accounts, especially privileged roles
- Support multiple MFA methods (TOTP, SMS, hardware keys)
- Enforce MFA for administrative access

**OAuth Federation**
- Use trusted identity providers (Google, GitHub, Microsoft, etc.)
- Implement proper scope limitations for OAuth tokens
- Validate OAuth tokens on the server side
- Never trust client-side authentication state alone

**Role-Based Access Control (RBAC)**
- Design granular user roles with least-privilege principle
- Implement hierarchical roles when appropriate
- Separate authentication (who you are) from authorization (what you can do)
- Use server-side authorization checks, never rely solely on UI restrictions

**Session Management**
- Implement secure token refresh patterns
- Configure appropriate session timeouts
- Invalidate sessions on logout and password change
- Protect against session fixation and hijacking
- Use secure, HTTP-only cookies for session tokens

**Custom Claims & User Metadata**
- Store authorization data (roles, permissions) in secure, server-controlled locations
- Never trust client-side role checks
- Validate permissions on every protected operation
- Implement fine-grained permission systems when needed

---

### 2. Data Protection & Privacy

**Input Validation**
- Validate all user inputs on both client and server
- Use allowlists rather than blocklists when possible
- Implement schema validation for all API inputs
- Reject malformed data early in the request pipeline

**Data Sanitization**
- Sanitize data before storage to prevent injection attacks
- Sanitize data before display to prevent XSS attacks
- Use context-appropriate encoding (HTML, JavaScript, SQL, etc.)
- Never trust user-generated content

**PII Handling**
- Encrypt sensitive personal data at rest and in transit
- Implement data retention and deletion policies
- Minimize collection of sensitive data (data minimization principle)
- Use tokenization or pseudonymization when possible

**GDPR & Privacy Compliance**
- Provide data export capabilities (data portability)
- Implement data deletion workflows (right to be forgotten)
- Obtain explicit consent for data collection
- Document data processing activities
- Implement privacy by design

**Audit Logging**
- Log all administrative actions
- Log access to sensitive data
- Include sufficient context (user, timestamp, action, resource)
- Protect audit logs from tampering
- Implement log retention policies

---

### 3. API Security

**Rate Limiting**
- Implement rate limiting on all public endpoints
- Use adaptive rate limiting for sensitive operations
- Return appropriate HTTP status codes (429 Too Many Requests)
- Implement per-user and per-IP rate limits

**CORS Configuration**
- Properly configure CORS for your frontend domains only
- Never use wildcard (*) origins in production
- Implement CORS preflight handling correctly
- Validate Origin headers on the server

**Input Validation**
- Use schema validation libraries (Joi, Zod, etc.)
- Validate content types and request formats
- Implement size limits for request bodies
- Reject unexpected parameters

**Error Handling**
- Don't expose sensitive information in error messages
- Use generic error messages for external consumers
- Log detailed errors internally for debugging
- Implement consistent error response formats
- Never expose stack traces to clients

**API Versioning**
- Implement versioning strategy for backward compatibility
- Use semantic versioning
- Deprecate old versions gracefully
- Document version-specific changes

---

### 4. Infrastructure Security

**Environment Variables & Secrets Management**
- Store sensitive configuration in environment variables
- Never commit secrets to version control
- Use secrets management systems (HashiCorp Vault, cloud provider secrets managers)
- Rotate secrets regularly
- Implement just-in-time secret access

**Service Account & Key Management**
- Rotate service account keys regularly
- Use IAM roles when possible instead of static keys
- Implement least-privilege access for service accounts
- Monitor and audit service account usage
- Revoke unused credentials

**Network Security**
- Implement request verification to prevent abuse
- Use allowlists for API access when possible
- Implement DDoS protection
- Use Content Delivery Networks (CDNs) for DDoS mitigation
- Segment networks appropriately

**Content Security Policy (CSP)**

CSP is a critical defense layer against XSS attacks. Modern best practices (2025) favor **strict CSP** over allowlist-based approaches.

*Strict CSP (Recommended)*
- Use **nonce-based** or **hash-based** CSP instead of allowlist-based policies
- Nonces: Server generates random value per-response, included in CSP header and script tags
- Hashes: Compute SHA-256/384/512 hash of inline script content and include in CSP
- Strict CSP is more secure and easier to maintain than allowlists

*Key Directives*
- `default-src 'self'` - Baseline fallback for all resource types
- `script-src 'nonce-{random}' 'strict-dynamic'` - Allow scripts with valid nonce
- `style-src 'self' 'nonce-{random}'` - Control stylesheet sources
- `upgrade-insecure-requests` - Auto-upgrade HTTP to HTTPS

*Avoid These Anti-Patterns*
- ❌ `'unsafe-inline'` - Defeats XSS protection entirely
- ❌ `'unsafe-eval'` - Allows dangerous JavaScript eval()
- ❌ Wildcard domains (`*.example.com`) - Too permissive
- ❌ Allowlist CSPs with many domains - Hard to maintain, often bypassable
- ❌ `X-Content-Security-Policy` or `X-WebKit-CSP` headers - Obsolete, use `Content-Security-Policy`

*Deployment Strategy*
- Start with `Content-Security-Policy-Report-Only` header to monitor without blocking
- Review violation reports and adjust policy
- Gradually tighten restrictions
- Only switch to enforcing mode when confident
- Review and update CSP as application evolves (new scripts, CDNs, integrations)

*Static Hosting Considerations*
- Nonce-based CSP requires dynamic server-side generation per request
- For static hosting (Firebase Hosting, GitHub Pages), use hash-based CSP
- Hash-based CSP requires updating hashes when scripts change
- Alternative: Use `'strict-dynamic'` with inline script hashes

> **Note**: CSP is a defense-in-depth layer. Always implement proper input validation and output encoding - don't rely on CSP alone for XSS prevention.

**HTTPS/TLS Enforcement**
- Ensure all communications use HTTPS/TLS
- Implement HSTS (HTTP Strict Transport Security)
- Use strong TLS configurations (TLS 1.2+)
- Keep TLS certificates up to date
- Disable weak cipher suites

---

### 5. Security Monitoring & Incident Response

**Security Logging**
- Log authentication events (login, logout, failed attempts)
- Log failed access attempts
- Log privilege escalations
- Log configuration changes
- Include correlation IDs for request tracing

**Anomaly Detection**
- Monitor for unusual access patterns
- Track data access volumes
- Alert on suspicious activity
- Implement automated threat detection
- Use machine learning for advanced detection

**Incident Response Plan**
- Define procedures for security breaches
- Document data incident response workflows
- Establish communication protocols
- Assign roles and responsibilities
- Practice incident response through drills

**Regular Security Audits**
- Schedule periodic reviews of security configurations
- Audit access patterns and permissions
- Review third-party integrations
- Conduct penetration testing
- Perform code security reviews

**Vulnerability Management**
- Keep dependencies updated
- Use automated security scanning
- Subscribe to security advisories
- Implement a CVE response process
- Track and remediate vulnerabilities by severity

---

## Common Security Anti-Patterns to Avoid

- ❌ Storing sensitive data in client-side code or localStorage
- ❌ Using client-side role checks without server-side validation
- ❌ Exposing admin functionality based only on UI hiding
- ❌ Using overly permissive access control rules
- ❌ Hardcoding API keys or secrets in source code
- ❌ Implementing custom authentication instead of using proven systems
- ❌ Ignoring input validation on server-side operations
- ❌ Using HTTP instead of HTTPS for any communication
- ❌ Failing to implement proper session management
- ❌ Not logging security-relevant events
- ❌ Trusting user input without validation
- ❌ Exposing detailed error messages to clients
- ❌ Failing to sanitize user-generated content
- ❌ Not implementing rate limiting on public APIs

---

## Implementation Checklist

### Before Deployment
- [ ] Access control rules tested thoroughly
- [ ] All environment variables properly configured
- [ ] Input validation implemented on all user-facing operations
- [ ] Authentication flows tested with various providers
- [ ] Rate limiting configured for public endpoints
- [ ] Error handling doesn't expose sensitive information
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Request verification configured for production
- [ ] Dependency vulnerability scan passed
- [ ] Security review completed

### Post-Deployment
- [ ] Security monitoring dashboard configured
- [ ] Audit logging enabled and monitored
- [ ] Incident response procedures documented
- [ ] Security testing performed (penetration testing if applicable)
- [ ] Team trained on security procedures
- [ ] Regular security review schedule established
- [ ] Vulnerability disclosure process documented
- [ ] Backup and recovery procedures tested

---

## Security Resources

### General Security
- [OWASP Top 10 Security Risks](https://owasp.org/www-project-top-ten/)
- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/)

### Standards & Compliance
- [GDPR Compliance Guide](https://gdpr.eu/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001 Information Security](https://www.iso.org/isoiec-27001-information-security.html)

### Tools & Testing
- [OWASP ZAP Security Scanner](https://www.zaproxy.org/)
- [Burp Suite](https://portswigger.net/burp)
- [Security Headers Analyzer](https://securityheaders.com/)

---

## Platform Implementations

For platform-specific implementations of these security principles, see:
- [Firebase Security](../../platforms/firebase/firebase-security.md)
- Other platforms: Add as needed
