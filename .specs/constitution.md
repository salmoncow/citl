# Project Constitution: citl.club (Central Illinois Trap League)

**Version:** 1.2.0
**Last Updated:** 2026-03-10
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
- Measure before evolving — use decision triggers from `architectural-evolution-strategy.md`
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
- Maintain clear migration paths between architectural states
- Current technology choices:
  - TypeScript + Web Components → Lit (95% AI-assisted migration)
  - Lit → React (80% AI-assisted migration)

**Reference**: [.prompts/meta/architectural-evolution-strategy.md](.prompts/meta/architectural-evolution-strategy.md) §II.1

---

## II. Architectural Standards

### II.1 Current Architectural State

**Last Updated**: 2026-03-10
**Last Architecture Review**: 2026-03-10

| Domain | Current State | Status |
|--------|---------------|--------|
| **UI Components** | 3 Web Components (`home-standings`, `season-scorecards`, `admin-panel`) | Live |
| **Security** | Firebase Auth (Google) + Firestore rules; custom claim `admin: true` | Complete |
| **Data** | Firestore drives home page and scorecards; JSON scorecard files are permanent static assets per §II.5 | Live |
| **Testing** | Vitest unit tests for scoring engine, score service, schedule utils | Active |
| **Deployment** | GitHub Actions CI/CD (push to `main` → Firebase Hosting + Firestore rules) | Active |
| **Monitoring** | Manual Firebase console checks | Active |
| **Cost** | Firebase Spark free tier | Near 0% usage |
| **Platform** | 2 platforms (Firebase + GitHub) | Maintain at 2 |

**Key Metrics** (as of 2026-03-10):
- **Active Users**: 0 (pre-launch — still on AWS/CloudFront)
- **SPA Views**: 6 (`home`, `scorecards`, `rules`, `about`, `downloads`, `admin`)
- **Modules**: 7 (`main`, `router`, `navigation`, `ui`, `firebase-config`, `score-service`, `standings-service`)
- **Repositories**: 2 (`score-repository`, `repository-factory`)
- **Types**: 4 (`score`, `shooter`, `season`, `scorecard`)
- **Data files**: 7 JSON scorecard seasons (2019–2025)
- **Team Size**: 1 developer
- **Firebase Usage**: Hosting configured (DNS not yet cutover); Firestore live; Spark free tier usage <5%

**TypeScript**: All source files are `.ts`; `allowJs: false`; `strict: true`; `noUncheckedIndexedAccess: true`.

**Deployment Context** (current):
- Hosted on AWS S3 + CloudFront (legacy)
- Firebase Hosting configured but DNS not yet cut over
- Firestore enabled and live; security rules deployed; 7 seasons imported

### II.2 Evolution Triggers

**Before increasing architectural complexity**, consult `architectural-evolution-strategy.md` for domain-specific triggers.

**General Principle**: Don't add complexity until measurable pain justifies it.

**CITL-specific thresholds**:
- **Testing**: Trigger at 10+ modules (currently 7) OR production launch planned
- **CI/CD**: Trigger at DNS cutover decision
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
src/types/         TypeScript interfaces and types — no runtime code
src/views/         Page-level render functions (transitional — migrate to components)
src/data/          Static JSON data (scorecard seasons 2019–2025)
```

**Reference**: [.prompts/core/architecture/code-structure.md](.prompts/core/architecture/code-structure.md)

### II.5 CITL-Specific Data Architecture

CITL operates a **dual data layer**:

| Layer | Purpose | Lifecycle |
|-------|---------|-----------|
| `src/data/scorecards/*.json` | Historical scorecard display (2019–2025) | Permanent static assets |
| Firestore `seasons/{year}/weeks/{n}` | Live weekly results for home page | Active |

The JSON scorecard data is **never replaced by Firestore** — it serves the Scorecards page
accordion display. Firestore drives the home page results feed and standings.

**Firestore Schema**:
```
seasons/{year}                              → Season metadata + awards
seasons/{year}/teams/{teamId}              → Team roster + totals arrays
seasons/{year}/weeks/{weekNumber}          → Weekly results + standings snapshot + accolades
```

See [.specs/technical/firestore-schema.md](.specs/technical/firestore-schema.md) for the full schema reference.

---

## III. Quality Standards

### III.1 Testing Requirements

**Current state**: Vitest unit tests for pure business logic functions.

**Test Pyramid target** (when integration testing is triggered):
- **70% Unit Tests**: Fast, isolated, individual functions / services
- **20% Integration Tests**: Service ↔ repository interactions
- **10% E2E Tests**: Full user workflows

**Coverage targets** (when unit testing is adopted broadly):
- Overall: ≥80% code coverage
- Auth + Firestore security rule paths: 100%

**Trigger**: 10+ modules OR production launch planned

**Reference**: [.prompts/core/testing/testing-principles.md](.prompts/core/testing/testing-principles.md)

### III.2 Security Standards

**Authentication & Authorization**:
- CITL uses **admin-only auth** (Google sign-in). Public pages are unauthenticated.
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
- 1-hour in-memory TTL cache for season / team data (already implemented in `score-service.ts`)
- 5-minute TTL for `getLatestWeekResult()` (active-season data)
- Store and call `unsubscribe()` on any `onSnapshot()` listener

**Reference**:
- [.prompts/core/operations/monitoring-principles.md](.prompts/core/operations/monitoring-principles.md)
- [.prompts/platforms/firebase/firebase-finops.md](.prompts/platforms/firebase/firebase-finops.md)

### III.4 Code Quality Standards

**Language standards (TypeScript):**
- Always `const` / `let`. Never `var`.
- Always ES6+ module syntax (`import`/`export`). No global function declarations.
- Arrow functions for callbacks; named `function` declarations for module-level exports.
- No inline event handlers in HTML (`onclick=`, `onload=`). Attach listeners in JS.
- Prefer `textContent` over `innerHTML`. Sanitize before any HTML insertion.
- Absolute imports using `@/` path alias (configured in `vite.config.ts` and `tsconfig.json`)
- `noUncheckedIndexedAccess: true` — array/object access always returns `T | undefined`; use `!= null` not just `!== null` for array guard
- `strict: true` — no implicit `any`; all parameters and return types must be explicit
- Prefer `as unknown as T` over `as T` for Firestore snapshot casts
- TypeScript `interface` and `type` declarations in `src/types/*.ts` — no `@typedef` JSDoc comments

**Naming conventions**:
| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `score-service.ts` |
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
- **Language**: TypeScript (strict mode, `allowJs: false`; Vite strips types via esbuild — no tsc emit)
- **UI Pattern**: SPA with hash-based router; views migrating to Web Components
- **Styling**: CSS design system — two-layer custom properties (primitive palette `--color-*` + semantic tokens `--c-*`); system-aware dark/light mode via `@media (prefers-color-scheme: dark)`; no framework
- **Type checking**: `tsconfig.json` with `strict: true`, `allowJs: false`, `noUncheckedIndexedAccess: true` — full strict type checking; `src/vite-env.d.ts` types `ImportMetaEnv` for all VITE_* vars

**Backend / Platform**:
- **Platform**: Firebase (`citl` project, Spark plan)
  - Firestore (NoSQL, `us-central1` region, production mode)
  - Hosting (SPA rewrite, security headers, cache rules)
  - Auth (Google, admin-only)
- **SDK**: `firebase` npm package (installed; imported as ES modules)

**Development**:
- **Version Control**: Git + GitHub
- **Node.js**: 24.x (pinned in `.nvmrc`)
- **CI/CD**: GitHub Actions (see `.specs/technical/cicd-pipeline.md`)
- **Testing**: Vitest (unit tests for business logic)

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

1. **Consult Constitution**: Read this document for project constraints and current state
2. **Create Specification**: Use `/speckit-specify <feature-name>` to create feature requirements
   - Reference constitutional constraints (current state, quality standards, forbidden patterns)
   - Cite applicable `.prompts/core/*` patterns for architecture approach
3. **Plan Implementation**: Use `/speckit-plan` to design technical approach
   - Reference `.prompts/platforms/firebase/*` for Firebase guidance
   - Consider evolution triggers — does this feature justify increased complexity?
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
- ✅ `score-service.ts` caches reads with 1-hour TTL
- ✅ All Firestore queries use `limit()` in `score-repository.ts`

**Ongoing monitoring**:
- Check Firebase console weekly (during active season: April–July)
- Alert at 70% of any daily limit
- Seasonal traffic pattern: peaks April–July (league season), near-zero off-season

---

## VII. References

### VII.1 Foundational Guidance (Always Consult)

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

### VII.2 Platform Implementation (Reference as Needed)

**Firebase**:
- [firebase-best-practices.md](.prompts/platforms/firebase/firebase-best-practices.md) — SDK patterns, Firestore, Auth
- [firebase-security.md](.prompts/platforms/firebase/firebase-security.md) — Security rules, custom claims
- [firebase-testing.md](.prompts/platforms/firebase/firebase-testing.md) — Emulator usage, rules testing
- [firebase-monitoring.md](.prompts/platforms/firebase/firebase-monitoring.md) — Performance monitoring, logging
- [firebase-finops.md](.prompts/platforms/firebase/firebase-finops.md) — Free tier optimization
- [firebase-resilience.md](.prompts/platforms/firebase/firebase-resilience.md) — Error handling, retry patterns

### VII.3 Strategic Frameworks

**Meta Guidance**:
- [architectural-evolution-strategy.md](.prompts/meta/architectural-evolution-strategy.md) — Evolution triggers, decision framework
- [architectural-decision-log.md](.prompts/meta/architectural-decision-log.md) — Historical decisions, current state
- [prompt-gap-protocol.md](.prompts/meta/prompt-gap-protocol.md) — Handling insufficient guidance
- [prompt-maintenance.md](.prompts/meta/prompt-maintenance.md) — Keeping prompts current

### VII.4 Technical Specifications

- [.specs/technical/build-system.md](.specs/technical/build-system.md) — Vite 7 configuration
- [.specs/technical/cicd-pipeline.md](.specs/technical/cicd-pipeline.md) — GitHub Actions
- [.specs/technical/firebase-deployment.md](.specs/technical/firebase-deployment.md) — Firebase Hosting deployment
- [.specs/technical/firestore-schema.md](.specs/technical/firestore-schema.md) — Firestore collection/document reference

### VII.5 Spec-Kit Workflow Commands

| Command | Description |
|---------|-------------|
| `/speckit-specify <feature>` | Create feature requirement spec |
| `/speckit-plan` | Generate technical implementation plan |
| `/speckit-tasks` | Break down into actionable tasks |
| `/speckit-implement` | Execute implementation |
| `/speckit-constitution` | View this constitutional spec |

---

## VIII. Maintenance & Review

### VIII.1 Review Schedule

**Quarterly reviews** (every 3 months):
- Update §II.1 Current Architectural State with latest metrics
- Review evolution triggers — any domains approaching a complexity increase?
- Check Firebase free tier quotas (verify limits unchanged)

**When to amend**:
- **Minor** (metrics, current state): increment patch version (1.0.0 → 1.0.1), update date
- **Major** (new standards, changed principles): increment minor version (1.0.0 → 1.1.0), document in decision log
- **Breaking** (removed/incompatible standards): increment major version, migration plan required

### VIII.2 Quick Reference

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
- 1.0.1 (2026-02-28): Minor metrics update
- 1.1.0 (2026-03-01): TypeScript migration complete; CSS design system; dark mode; inline SVGs
- 1.2.0 (2026-03-10): Removed phase references throughout; constitution is now state-based and timing-agnostic
