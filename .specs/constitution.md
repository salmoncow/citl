# Project Constitution: citl.club (Central Illinois Trap League)

**Version:** 1.0.1
**Last Updated:** 2026-02-28
**Scope:** All development on the citl-static project
**Review Frequency:** Quarterly (next review: 2026-05-27)

---

## Introduction

This constitutional spec establishes the governing principles, standards, and constraints for
citl.club. It is the single source of truth for project-specific requirements, and cross-references
detailed patterns in `.prompts/` for implementation guidance.

**Relationship to `.prompts/` System:**
- This constitution defines **project-specific** constraints and current state
- `.prompts/` provides **foundational, universal** patterns and best practices
- When developing features, consult this constitution first, then reference `.prompts/` for patterns

---

## I. Core Principles

### I.1 Progressive Complexity

**Philosophy**: Start simple, add complexity only when justified by measurable pain.

**Principles:**
- Follow phase-based evolution (Phase 1 → 2 → 3, never skip phases)
- Measure before evolving — use decision triggers from `architectural-evolution-strategy.md`
- Each phase teaches lessons needed for the next
- Avoid premature optimization and over-engineering

**Reference**: [.prompts/meta/architectural-evolution-strategy.md](.prompts/meta/architectural-evolution-strategy.md)

### I.2 Platform Simplification

**Philosophy**: Minimize platforms and dependencies to reduce operational overhead.

**Constraints:**
- **Maximum platforms**: 2–3 total
- **Current platforms**: Firebase + GitHub (2 platforms)
- **New platform addition requires**:
  - All decision triggers met from `platform-simplification-principles.md`
  - Explicit justification why existing platforms are insufficient
  - Documented evaluation of extending current platforms first

**Reference**: [.prompts/core/operations/platform-simplification-principles.md](.prompts/core/operations/platform-simplification-principles.md)

### I.3 AI-Assisted Evolution

**Philosophy**: Choose technologies that support future AI-assisted migrations.

**Requirements:**
- Select technologies with ≥80% AI migration capability
- Document patterns clearly for future AI refactoring
- Maintain clear migration paths between architectural phases
- Current technology choices:
  - Vanilla JS + Web Components → Lit (95% AI-assisted migration)
  - Lit → React (80% AI-assisted migration)

**Reference**: [.prompts/meta/architectural-evolution-strategy.md](.prompts/meta/architectural-evolution-strategy.md) §II.1

---

## II. Architectural Standards

### II.1 Current Architectural State

**Last Updated**: 2026-02-28
**Last Architecture Review**: 2026-02-27

| Domain | Current Phase | Target Phase | Status |
|--------|---------------|--------------|--------|
| **UI Components** | Phase 1: Vanilla JS views (no Web Components yet) | Phase 2: Web Components | Scorecards + home view are functional; first component is standings-table (Phase 4) |
| **Security** | Phase 1: No auth; public read only | Phase 2: Firebase Auth (Google) + Firestore rules | Deferred to Phase 5 (admin-only auth) |
| **Data** | Phase 2: Firestore live reads | Phase 2: Firestore live reads | Firestore live (us-central1); security rules deployed; admin writes + standings in Firestore; scorecards page uses static JSON per §II.5 |
| **Testing** | Phase 1: Manual browser testing | Phase 2: Vitest unit tests | Trigger: 10+ modules or production launch |
| **Deployment** | Phase 1: Manual (`npm run deploy`) | Phase 2: GitHub Actions CI/CD | Deferred to Phase 6 (after DNS cutover) |
| **Monitoring** | Phase 1: Manual Firebase console checks | Phase 2: Firebase Performance Monitoring | Deferred until production launch |
| **Cost** | Phase 1: Firebase Spark free tier | Phase 2: Optimized free tier | Monitor — currently near 0% usage |
| **Platform** | 2 platforms (Firebase + GitHub) | Maintain at 2 | Avoid additions |

**Key Metrics** (as of 2026-02-27):
- **Active Users**: 0 (pre-launch — still on AWS/CloudFront)
- **SPA Views**: 5 (`home`, `scorecards`, `rules`, `about`, `downloads`)
- **Modules**: 7 (`main`, `router`, `navigation`, `ui`, `firebase-config`, `score-service`, `standings-service`)
- **Repositories**: 2 (`score-repository`, `repository-factory`)
- **Types**: 3 (`score`, `shooter`, `season`)
- **Data files**: 7 JSON scorecard seasons (2019–2025)
- **Team Size**: 1 developer
- **Firebase Usage**: Hosting configured (DNS not yet cutover); Firestore live; Spark free tier usage <5%

**Migration Context** (current as of 2026-02-28):
- Hosted on AWS S3 + CloudFront (legacy)
- Firebase Hosting configured but DNS not yet cut over
- Firestore enabled and live; security rules deployed; 7 seasons imported
- Target: DNS cutover to `citl.club` → Firebase Hosting (Phase 8)

### II.2 Evolution Triggers

**Before advancing to next phase**, consult `architectural-evolution-strategy.md` for domain-specific triggers.

**General Principle**: Don't advance phases until measurable pain justifies the complexity increase.

**CITL-specific thresholds**:
- **Testing**: Trigger at 10+ modules (currently 7) OR production launch planned
- **Web Components**: Trigger when `standings-table` component needs reuse in 2+ places
- **CI/CD**: Trigger at DNS cutover decision (Phase 6 milestone)
- **Cost optimization**: Alert at 70% of any Firebase free tier limit

**Reference**: [.prompts/meta/architectural-evolution-strategy.md](.prompts/meta/architectural-evolution-strategy.md)

### II.3 Modularity Requirements

**Principles** (distilled from `modular-architecture-principles.md`):

1. **Single Responsibility**: Each module has one clear purpose
2. **Clear Interfaces**: Module contracts documented and stable
3. **Dependency Direction**: `components → modules → services → repositories` (never reverse)
4. **Module Size**: Target <500 lines per file; split at 750 lines hard limit

**Anti-Patterns (Forbidden)**:
- ❌ God modules (>500 lines, multiple responsibilities)
- ❌ Circular dependencies between modules
- ❌ Components calling Firestore directly (must go through service layer)
- ❌ Repositories importing from services

**Reference**: [.prompts/core/architecture/modular-architecture-principles.md](.prompts/core/architecture/modular-architecture-principles.md)

### II.4 Code Structure Standards

**Layer Responsibilities**:
```
src/components/    Web Components — rendering, user events, no business logic
src/modules/       Orchestration — wires components + services, manages app state
src/services/      Business logic — validation, transformation, caching, rules
src/repositories/  Data access — Firestore reads/writes only
src/types/         JSDoc typedefs only — no runtime code
src/views/         Page-level render functions (transitional — migrate to components)
src/data/          Static JSON data (scorecard seasons 2019–2025)
```

**Reference**: [.prompts/core/architecture/code-structure.md](.prompts/core/architecture/code-structure.md)

### II.5 CITL-Specific Data Architecture

CITL operates a **dual data layer** during the migration period:

| Layer | Purpose | Lifecycle |
|-------|---------|-----------|
| `src/data/scorecards/*.json` | Historical scorecard display (2019–2025) | Permanent static assets |
| Firestore `seasons/{year}/weeks/{n}` | Live weekly results for home page | Active from Phase 4 onward |

The JSON scorecard data is **never replaced by Firestore** — it serves the Scorecards page
accordion display. Firestore drives the home page results feed and standings.

**Firestore Schema**:
```
seasons/{year}                              → Season metadata + awards
seasons/{year}/teams/{teamId}              → Team roster + totals arrays
seasons/{year}/weeks/{weekNumber}          → Weekly results + standings snapshot + accolades
```

---

## III. Quality Standards

### III.1 Testing Requirements

**Current state**: Phase 1 — manual browser testing only.

**Test Pyramid target** (when Phase 2 triggered):
- **70% Unit Tests**: Fast, isolated, individual functions / services
- **20% Integration Tests**: Service ↔ repository interactions
- **10% E2E Tests**: Full user workflows

**Coverage targets** (Phase 2+):
- Overall: ≥80% code coverage
- Auth + Firestore security rule paths: 100%

**Next trigger**: 10+ modules OR production launch planned

**Reference**: [.prompts/core/testing/testing-principles.md](.prompts/core/testing/testing-principles.md)

### III.2 Security Standards

**Authentication & Authorization**:
- CITL uses **admin-only auth** (Google sign-in, Phase 5). Public pages are unauthenticated.
- Never rely on client-side auth checks alone — enforce with Firestore security rules
- Scores/standings: public read, admin-only write (custom claim `admin: true`)

**Data Protection**:
- Validate all inputs before writing to Firestore
- Use `textContent` / `escapeHtml()` helper for any user-supplied content rendered to DOM
- Never commit secrets or API keys — all Firebase config in `.env` (gitignored)

**Transport / Headers**:
- `firebase.json` enforces: `X-Frame-Options`, `X-Content-Type-Options`,
  `Strict-Transport-Security`, `Content-Security-Policy`
- CSP must allow `maps.google.com` + `www.google.com` (Google Maps embed in about view)
- CSP must allow `cdnjs.cloudflare.com` (Font Awesome)

**Reference**:
- [.prompts/core/security/security-principles.md](.prompts/core/security/security-principles.md)
- [.prompts/platforms/firebase/firebase-security.md](.prompts/platforms/firebase/firebase-security.md)

### III.3 Performance Standards

**Targets** (measurable at production launch):
- Page Load Time: <3 seconds (p95)
- Time to Interactive (TTI): <5 seconds (p95)
- First Contentful Paint (FCP): <1.5 seconds (p95)
- JS bundle: <250 kB gzipped (currently ~34 kB gzipped ✅)

**Firebase Quota Constraints** (Spark free tier):
| Resource | Daily Limit | Alert Threshold (70%) |
|----------|------------|----------------------|
| Firestore reads | 50,000 | 35,000 |
| Firestore writes | 20,000 | 14,000 |
| Hosting transfer | 360 MB | 252 MB |

**Optimization requirements**:
- Always use `limit()` + `where()` on Firestore queries — never read entire collections
- 1-hour in-memory TTL cache for season / team data (already implemented in `score-service.js`)
- 5-minute TTL for `getLatestWeekResult()` (active-season data)
- Store and call `unsubscribe()` on any `onSnapshot()` listener

**Reference**:
- [.prompts/core/operations/monitoring-principles.md](.prompts/core/operations/monitoring-principles.md)
- [.prompts/platforms/firebase/firebase-finops.md](.prompts/platforms/firebase/firebase-finops.md)

### III.4 Code Quality Standards

**JavaScript style**:
- Always `const` / `let`. Never `var`.
- Always ES6+ module syntax (`import`/`export`). No global function declarations.
- Arrow functions for callbacks; named `function` declarations for module-level exports.
- No inline event handlers in HTML (`onclick=`, `onload=`). Attach listeners in JS.
- Prefer `textContent` over `innerHTML`. Sanitize before any HTML insertion.
- Absolute imports using `@/` path alias (configured in `vite.config.js` and `tsconfig.json`)

**Naming conventions**:
| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `score-service.js` |
| Classes / Web Components | PascalCase | `ScoreService` |
| Functions / methods | camelCase | `getStandings()` |
| Constants | SCREAMING_SNAKE_CASE | `CACHE_TTL_MS` |
| CSS custom properties | `--kebab-case` | `--color-primary` |
| Custom elements | `kebab-case` | `<standings-table>` |

**Git workflow** (from `git-best-practices.md`):
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `ci:`
- Branch naming: `feat/<desc>`, `fix/<desc>`, `chore/<desc>`, `ci/<desc>`
- All changes to `main` via Pull Request — no direct commits
- No force pushes to `main`

**Reference**: [.prompts/core/development/git-best-practices.md](.prompts/core/development/git-best-practices.md)

---

## IV. Technology Standards

### IV.1 Approved Technology Stack

**Frontend**:
- **Build Tool**: Vite 7.x (see `.specs/technical/build-system.md`)
- **Language**: Vanilla JavaScript (ES6+ modules, JSDoc types — no TypeScript emit)
- **UI Pattern**: SPA with hash-based router; views migrating to Web Components
- **Styling**: Plain CSS with custom properties; no framework
- **Type checking**: `tsconfig.json` with `allowJs: true`, `checkJs: false` — IDE support only

**Backend / Platform**:
- **Platform**: Firebase (`citl` project, Spark plan)
  - Firestore (NoSQL, `us-central1` region, production mode)
  - Hosting (SPA rewrite, security headers, cache rules)
  - Auth (Google, admin-only — Phase 5)
- **SDK**: `firebase` npm package (installed; imported as ES modules)

**Development**:
- **Version Control**: Git + GitHub
- **Node.js**: 24.x (pinned in `.nvmrc`)
- **CI/CD**: Manual deploy via Firebase CLI now; GitHub Actions in Phase 6
- **Testing**: Manual (Phase 1); Vitest when Phase 2 triggered

### IV.2 Forbidden Patterns

**Firebase anti-patterns** (break free tier or cause errors):
```
❌  getDocs(collection(db, 'scores'))        Always add where() + limit()
❌  onSnapshot(...) without cleanup          Store and call unsubscribe()
❌  Client-side filtering of Firestore data  Use where() queries
❌  Hardcoded Firebase config in source      Use import.meta.env.VITE_*
```

**Architecture anti-patterns**:
```
❌  var x = ...                              Use const / let
❌  onclick="myFunction()"                   Attach listeners in JS
❌  element.innerHTML = userInput            Use textContent or escapeHtml()
❌  God modules > 500 lines                  Split by responsibility
❌  Circular imports between modules         Dependencies flow inward only
❌  Components importing from firebase/      Go through services → repositories
```

**Process anti-patterns**:
```
❌  Direct commits to main                   Always open a PR
❌  git commit -m "wip" / "fix"             Use conventional commit format
❌  Force push to main                       Never
❌  Skipping security rules in Emulator      Test rules before deploying
```

**Reference**: [.prompts/platforms/firebase/firebase-best-practices.md](.prompts/platforms/firebase/firebase-best-practices.md)

### IV.3 Technology Evaluation Criteria

Before adopting new technology, evaluate:
1. Does it fit within current platforms (Firebase, GitHub)?
2. Can existing platforms provide this capability?
3. What complexity does it add?
4. What is AI migration capability? (target: ≥80%)
5. What are the long-term maintenance implications?

**Reference**: [.prompts/core/operations/platform-simplification-principles.md](.prompts/core/operations/platform-simplification-principles.md)

---

## V. Development Workflow

### V.1 Feature Development Process

1. **Consult Constitution**: Read this document for project constraints and current phase
2. **Create Specification**: Use `/speckit-specify <feature-name>` to create feature requirements
   - Reference constitutional constraints (current phases, quality standards, forbidden patterns)
   - Cite applicable `.prompts/core/*` patterns for architecture approach
3. **Plan Implementation**: Use `/speckit-plan` to design technical approach
   - Reference `.prompts/platforms/firebase/*` for Firebase guidance
   - Consider evolution triggers — does this feature push us to next phase?
4. **Break Down Work**: Use `/speckit-tasks` to create actionable task list
5. **Implement**: Follow patterns from `.prompts/core/` and `.prompts/platforms/firebase/`
6. **Test**: Validate against constitutional standards (security, performance, Firestore queries)
7. **Commit**: Conventional commit format with constitutional references

**Example commit message**:
```
feat(standings): add standings-table Web Component

Implements live Firestore-backed standings for home view.

Constitutional compliance:
- §III.3: Firestore query uses where() + limit() to stay within free tier
- §III.2: Admin-write enforced via Firestore rules (not client-side only)
- §IV.2: onSnapshot() unsubscribed in disconnectedCallback()

Guidance references:
- .prompts/core/architecture/modular-architecture-principles.md
- .prompts/platforms/firebase/firebase-best-practices.md
```

### V.2 Prompt Gap Protocol

If guidance is insufficient for a task:
1. **STOP** — do not guess or proceed without guidance
2. Flag the gap following `.prompts/meta/prompt-gap-protocol.md`
3. Determine: constitutional gap, prompt gap, or technical spec gap
4. Recommend creation / update of the appropriate file
5. **Do NOT proceed** until the gap is addressed

**Reference**: [.prompts/meta/prompt-gap-protocol.md](.prompts/meta/prompt-gap-protocol.md)

---

## VI. Cost Constraints

### VI.1 Firebase Free Tier Limits (Spark Plan)

| Resource | Daily Limit | Alert at 70% |
|----------|------------|--------------|
| Firestore reads | 50,000 | 35,000 |
| Firestore writes | 20,000 | 14,000 |
| Firestore deletes | 20,000 | 14,000 |
| Hosting storage | 10 GB total | — |
| Hosting transfer | 360 MB/day | 252 MB |
| Authentication | Unlimited | — |
| Cloud Functions | Not available (Spark plan) | — |

**Hard constraints**:
- MUST stay within free tier indefinitely (CITL is a hobby league — no budget for paid tier)
- MUST implement caching before hitting 70% of any limit
- Cloud Functions require upgrading to Blaze — requires explicit decision + approval

**Reference**: [.prompts/platforms/firebase/firebase-finops.md](.prompts/platforms/firebase/firebase-finops.md)

### VI.2 Cost Optimization

**Mandatory optimizations** (already implemented):
- ✅ `score-service.js` caches reads with 1-hour TTL
- ✅ All Firestore queries use `limit()` in `score-repository.js`
- ✅ `repository-factory.js` provides `stub` backend for offline dev (zero Firestore reads)

**Ongoing monitoring**:
- Check Firebase console weekly (during active season: April–July)
- Alert at 70% of any daily limit
- Seasonal traffic pattern: peaks April–July (league season), near-zero off-season

---

## VII. Migration Milestones

The following are CITL-specific milestones that don't exist in a greenfield project:

### VII.1 AWS → Firebase Cutover Sequence

| Step | Phase | Status |
|------|-------|--------|
| Vite SPA + static routes | Phase 1–3 | ✅ Complete |
| Firebase Hosting config | Phase 2 | ✅ Complete |
| Firestore data layer (code) | Phase 4 | ✅ Complete |
| Enable Firestore in console | Phase 4 | ✅ Complete |
| `standings-table` Web Component | Phase 4 | ✅ Complete |
| Firestore security rules | Phase 4 | ✅ Complete |
| Admin auth (Google sign-in) | Phase 5 | ✅ Complete |
| Admin score entry UI | Phase 5 | ✅ Complete |
| GitHub Actions CI/CD | Phase 6 | ⬜ Deferred until after DNS cutover |
| DNS cutover (`citl.club` → Firebase) | Phase 7 | ⬜ Deferred |
| Decommission AWS Terraform | Phase 7 | ⬜ Deferred |

### VII.2 DNS Cutover Prerequisites (Phase 7)

Before cutting DNS, all of the following must be verified:
- [ ] All 5 SPA routes work correctly on Firebase Hosting URL (`citl-baed2.web.app`)
- [ ] CSP headers pass browser console with zero violations
- [ ] Firestore reads/writes functioning correctly with live data
- [ ] Firestore security rules tested in Local Emulator
- [ ] Admin auth working end-to-end
- [ ] PDF score sheet downloads work from Firebase Hosting
- [ ] Google Maps embed loads (requires CSP `frame-src` for `maps.google.com`)
- [ ] Font Awesome icons load (requires CSP `style-src`/`font-src` for `cdnjs.cloudflare.com`)

---

## VIII. References

### VIII.1 Foundational Guidance (Always Consult)

**Core Architecture**:
- [code-structure.md](.prompts/core/architecture/code-structure.md) — Separation of concerns, layered architecture
- [modular-architecture-principles.md](.prompts/core/architecture/modular-architecture-principles.md) — Modularity, coupling/cohesion
- [feature-extensibility.md](.prompts/core/architecture/feature-extensibility.md) — Extension patterns

**Core Security**:
- [security-principles.md](.prompts/core/security/security-principles.md) — Auth/authz, data protection

**Core Testing**:
- [testing-principles.md](.prompts/core/testing/testing-principles.md) — Testing pyramid, coverage targets

**Core Operations**:
- [platform-simplification-principles.md](.prompts/core/operations/platform-simplification-principles.md) — Platform selection
- [budget-principles.md](.prompts/core/operations/budget-principles.md) — FinOps, cost efficiency
- [monitoring-principles.md](.prompts/core/operations/monitoring-principles.md) — Observability patterns

**Core Development**:
- [git-best-practices.md](.prompts/core/development/git-best-practices.md) — Git workflow, conventional commits
- [asset-reusability.md](.prompts/core/development/asset-reusability.md) — DRY principles

### VIII.2 Platform Implementation (Reference as Needed)

**Firebase**:
- [firebase-best-practices.md](.prompts/platforms/firebase/firebase-best-practices.md) — SDK patterns, Firestore, Auth
- [firebase-security.md](.prompts/platforms/firebase/firebase-security.md) — Security rules, custom claims
- [firebase-testing.md](.prompts/platforms/firebase/firebase-testing.md) — Emulator usage, rules testing
- [firebase-monitoring.md](.prompts/platforms/firebase/firebase-monitoring.md) — Performance monitoring, logging
- [firebase-finops.md](.prompts/platforms/firebase/firebase-finops.md) — Free tier optimization
- [firebase-resilience.md](.prompts/platforms/firebase/firebase-resilience.md) — Error handling, retry patterns

### VIII.3 Strategic Frameworks

**Meta Guidance**:
- [architectural-evolution-strategy.md](.prompts/meta/architectural-evolution-strategy.md) — Phase-based evolution, decision triggers
- [architectural-decision-log.md](.prompts/meta/architectural-decision-log.md) — Historical decisions, current state
- [prompt-gap-protocol.md](.prompts/meta/prompt-gap-protocol.md) — Handling insufficient guidance
- [prompt-maintenance.md](.prompts/meta/prompt-maintenance.md) — Keeping prompts current

### VIII.4 Technical Specifications

- [.specs/technical/build-system.md](.specs/technical/build-system.md) — Vite 7 configuration
- [.specs/technical/cicd-pipeline.md](.specs/technical/cicd-pipeline.md) — GitHub Actions (Phase 6)
- [.specs/technical/firebase-deployment.md](.specs/technical/firebase-deployment.md) — Firebase Hosting deployment

### VIII.5 Spec-Kit Workflow Commands

| Command | Description |
|---------|-------------|
| `/speckit-specify <feature>` | Create feature requirement spec |
| `/speckit-plan` | Generate technical implementation plan |
| `/speckit-tasks` | Break down into actionable tasks |
| `/speckit-implement` | Execute implementation |
| `/speckit-constitution` | View this constitutional spec |

---

## IX. Maintenance & Review

### IX.1 Review Schedule

**Quarterly reviews** (every 3 months):
- Update §II.1 Current Architectural State with latest metrics
- Review evolution triggers — any domains approaching phase transition?
- Check Firebase free tier quotas (verify limits unchanged)

**When to amend**:
- **Minor** (metrics, current state): increment patch version (1.0.0 → 1.0.1), update date
- **Major** (new standards, changed principles): increment minor version (1.0.0 → 1.1.0), document in decision log
- **Breaking** (removed/incompatible standards): increment major version, migration plan required

### IX.2 Quick Reference

**Mandatory before every commit**:
- ✅ `const`/`let` only — no `var`
- ✅ No inline HTML event handlers
- ✅ Firestore queries use `limit()` (if Firestore-related)
- ✅ `onSnapshot()` cleanup stored (if using real-time listeners)
- ✅ No secrets in code (`.env` only)
- ✅ Conventional commit format

**Mandatory before every PR**:
- ✅ PR description includes Summary, Changes, Testing, Guidance References
- ✅ No force push to main
- ✅ Build passes (`npm run build`)
- ✅ No merge conflicts

---

**Version History:**
- 1.0.0 (2026-02-27): Initial constitution established for CITL
