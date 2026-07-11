# Prompt Library Maintenance Guide

> **Last Updated:** 2025-12-08
> **Review Frequency:** Quarterly (every 3 months)
> **Next Review Due:** 2026-03-08

## Purpose

This guide ensures the prompt library stays current with evolving best practices, technology updates, and deprecated features. It provides a systematic approach to maintaining technical accuracy and preventing outdated guidance.

---

## Quarterly Review Checklist

Every 3 months, review all prompt files for the following:

### 1. Technology Version Updates

Check and update version references in prompts:

**Node.js:**
- [ ] Verify current LTS version at https://nodejs.org/en/about/previous-releases
- [ ] Update `NODE_VERSION` references in workflow examples
- [ ] Current LTS: Node 24 "Krypton" (Active until April 2028)
- [ ] Files to check: `firebase-deployment.md`, `platform-simplification-principles.md`, `.nvmrc`, `package.json`

**Firebase SDK:**
- [ ] Check latest stable version at https://firebase.google.com/support/releases/js-sdk
- [ ] Review breaking changes in release notes
- [ ] Update code examples if syntax changed
- [ ] Current version: v12.x+ (as of December 2025)
- [ ] Key changes in v12: Firebase AI Logic SDK replaces Vertex AI SDK
- [ ] Files to check: `firebase-best-practices.md`, `firebase-deployment.md`

**GitHub Actions:**
- [ ] Check action versions at https://github.com/actions
- [ ] Update action version references (e.g., `@v5` → `@v6`)
- [ ] Key actions to monitor:
  - `actions/checkout` (currently v5)
  - `actions/setup-node` (currently v6, requires runner v2.327.1+)
  - `actions/upload-artifact` (currently v4)
  - `actions/download-artifact` (currently v4)
  - `actions/cache` (currently v4)
- [ ] Files to check: `firebase-deployment.md`, all `.github/workflows/` files

**Testing Libraries:**
- [ ] Check npm for latest versions of:
  - `@testing-library/react`
  - `@testing-library/jest-dom`
  - `@firebase/rules-unit-testing`
  - `jest`
  - `playwright`
- [ ] Files to check: `testing-qa.md`

### 2. Deprecated Features & Commands

Actively search for deprecated patterns:

**Firebase CLI:**
- [ ] Run `firebase --help` to check for deprecated commands
- [ ] Review Firebase CLI changelog: https://github.com/firebase/firebase-tools/releases
- [ ] Known deprecations to watch:
  - ✅ `firebase login:ci` → service accounts (FIXED 2025-01-08)
  - `firebase deploy --token` → GOOGLE_APPLICATION_CREDENTIALS
- [ ] Files to check: `deployment-cicd.md`, `firebase-best-practices.md`

**GitHub Actions:**
- [ ] Check for deprecated workflow syntax
- [ ] Review GitHub changelog: https://github.blog/changelog/
- [ ] Watch for authentication changes (tokens → OIDC)
- [ ] Files to check: `deployment-cicd.md`, `.github/workflows/`

**npm/Package Management:**
- [ ] Check for deprecated npm commands
- [ ] Review `npm` vs `pnpm` vs `yarn` recommendations
- [ ] Files to check: `deployment-cicd.md`, `platform-simplification.md`

**Build Tools:**
- [ ] Check Vite, webpack, or other build tool documentation
- [ ] Review configuration best practices
- [ ] Files to check: All build-related prompts

### 3. New Features to Document

Stay current with new capabilities:

**Firebase:**
- [ ] Review Firebase release notes for new features
- [ ] Check Firebase Console for new UI/features
- [ ] Firebase Emulator Suite updates
- [ ] New Firebase services or SDKs
- [ ] Files to update: `firebase-best-practices.md`

**GitHub Actions:**
- [ ] New GitHub Actions features (environments, OIDC, etc.)
- [ ] Workflow optimization opportunities
- [ ] Security enhancements
- [ ] Files to update: `deployment-cicd.md`

**Testing:**
- [ ] New testing patterns or best practices
- [ ] Testing framework updates
- [ ] Accessibility testing advancements
- [ ] Files to update: `testing-qa.md`

### 4. Security & Best Practices Evolution

**Authentication:**
- [ ] Review Firebase authentication best practices
- [ ] Check for new security recommendations
- [ ] Verify secret management patterns are current
- [ ] Files to check: `security-architecture.md`, `deployment-cicd.md`

**Performance:**
- [ ] Review performance monitoring best practices
- [ ] Check for new optimization techniques
- [ ] Files to check: `monitoring-observability.md`, `finops-free-tier-maximization.md`

**Cost Optimization:**
- [ ] Verify free tier limits haven't changed
- [ ] Check for new cost-saving opportunities
- [ ] Files to check: `finops-free-tier-maximization.md`, `budget-resilience.md`

### 5. External Link Validation

- [ ] Check all external URLs for 404s
- [ ] Update documentation links if moved
- [ ] Verify official documentation references are current
- [ ] Tools: Use link checker or manual spot-check

---

## Annual Deep Review

Once per year (recommended: January), perform a comprehensive audit:

### 1. Code Example Validation

- [ ] Test all code examples against latest versions
- [ ] Verify workflow examples execute successfully
- [ ] Check that Firebase configurations are valid
- [ ] Update any broken examples

### 2. Prompt File Organization

- [ ] Review CLAUDE.md decision framework
- [ ] Ensure prompt files are logically organized
- [ ] Identify missing guidance areas
- [ ] Consider new prompt files if needed

### 3. Technology Stack Review

- [ ] Evaluate if recommended stack is still optimal
- [ ] Consider emerging technologies worth adopting
- [ ] Review "boring technology" choices for continued validity
- [ ] Files to check: `platform-simplification.md`

### 4. Accessibility & Compliance

- [ ] Review accessibility standards (WCAG updates)
- [ ] Check compliance requirements
- [ ] Update a11y guidance if needed
- [ ] Files to check: `testing-qa.md`, accessibility prompts

---

## Version-Specific Reference Format

When documenting version-specific features, use this format:

```markdown
## Feature Name

> **Last Updated:** 2025-12-08
> **Technology Version:** Firebase SDK v12+, Node 24 LTS
> **Status:** Current

[Feature documentation here]

### Version Compatibility
- Firebase SDK: v12.0.0+
- Node.js: 22 LTS or higher (24 LTS recommended)
- Last verified: 2025-12-08
```

---

## Tracking Changes in Prompts

When updating prompt files:

1. **Add update metadata** at the top of modified sections:
   ```markdown
   > **Last Updated:** 2025-01-08 | **Reason:** Updated to service account auth
   ```

2. **Document deprecated patterns** instead of deleting them:
   ```markdown
   ### ⚠️ Deprecated Approach (Do Not Use)
   ```bash
   # ❌ Old way - deprecated
   ```

3. **Reference official documentation:**
   ```markdown
   See: https://firebase.google.com/docs/...
   ```

4. **Test before committing:**
   - Verify code examples work
   - Check links aren't broken
   - Ensure consistency across related prompts

5. **Update CLAUDE.md if needed:**
   - Add new prompt files to decision framework
   - Update guidance references
   - Maintain decision map accuracy

---

## Automation Opportunities

Consider implementing:

### 1. Dependabot for GitHub Actions
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

### 2. Link Checker GitHub Action
```yaml
# .github/workflows/link-checker.yml
name: Check Links
on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: lycheeverse/lychee-action@v1
        with:
          args: --verbose '.prompts/**/*.md'
```

### 3. Calendar Reminders
- Set quarterly calendar events for prompt review
- Assign responsibility to team member
- Track review completion

---

## Common Deprecation Patterns to Watch

### Firebase
- **CLI tokens** → Service accounts ✅ (Fixed 2025-01-08)
- **Compat SDK** → Modular SDK (monitor for v8 end-of-life)
- **Legacy database** → Firestore (ongoing transition)

### GitHub Actions
- **set-output** → GITHUB_OUTPUT (deprecated 2022, removed 2023)
- **save-state** → GITHUB_STATE (deprecated 2022)
- **Personal access tokens** → Fine-grained tokens or OIDC

### Node.js
- Node 18 → End of life (2025-04-30) ⚠️ **PAST EOL**
- Node 20 → LTS (until 2026-04-30)
- Node 22 → LTS "Jod" (Active until 2027-04-30)
- Node 24 → **Current LTS** "Krypton" (Active until 2028-04-30)

---

## Responsibility & Ownership

**Primary Maintainer:** Project Lead or designated developer

**Review Process:**
1. Schedule quarterly review (3-4 hours)
2. Follow checklist systematically
3. Create GitHub issue for each update needed
4. Submit PR with prompt updates
5. Document changes in commit message

**Escalation:**
- If major technology shift required, discuss with team
- For breaking changes, plan migration strategy
- Document decisions in architectural decision records (ADRs)

---

## Emergency Updates

For critical issues (security vulnerabilities, breaking changes):

1. **Immediate Action:**
   - Update affected prompts immediately
   - Add warning banners to deprecated sections
   - Notify team via Slack/Discord

2. **Communication:**
   - Document what changed and why
   - Provide migration path if applicable
   - Update GITHUB_ACTIONS_SETUP.md or relevant docs

3. **Verification:**
   - Test updated guidance
   - Verify workflows still function
   - Check for cascading impacts

---

## Success Metrics

Track maintenance effectiveness:

- [ ] Zero critical deprecated practices in prompts
- [ ] All external links functional
- [ ] All code examples validated within 6 months
- [ ] Version references current within 1 major version
- [ ] Quarterly reviews completed on schedule

---

## Related Documentation

- `CLAUDE.md` - Project instruction framework
- `git-best-practices.md` - Version control for prompt updates
- `deployment-cicd.md` - Deployment patterns and workflows
- `.github/GITHUB_ACTIONS_SETUP.md` - Setup guide (keep in sync)

---

## Appendix: Quick Reference

### Critical Files Requiring Regular Updates
1. `deployment-cicd.md` - GitHub Actions, Firebase CLI, Node versions
2. `firebase-best-practices.md` - Firebase SDK, security patterns
3. `testing-qa.md` - Testing library versions, best practices
4. `platform-simplification.md` - Technology stack recommendations
5. `finops-free-tier-maximization.md` - Free tier limits, optimization

### External Resources to Monitor
- Firebase Blog: https://firebase.blog
- GitHub Changelog: https://github.blog/changelog
- Node.js Releases: https://nodejs.org/en/about/previous-releases
- Firebase Release Notes: https://firebase.google.com/support/release-notes
- GitHub Actions Docs: https://docs.github.com/en/actions

---

**Remember:** Proactive maintenance prevents outdated guidance from misleading developers. Schedule the next review now!
