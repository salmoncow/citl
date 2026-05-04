# Project Constitution: citl.club (Central Illinois Trap League)

**Version:** 1.5.0
**Last Updated:** 2026-05-03
**Scope:** All development on the citl-static project
**Review Frequency:** Quarterly (next review: 2026-08-03)

---

## Introduction

This constitutional spec establishes the governing principles, standards, and constraints for
citl.club. It is the single source of truth for project-specific requirements.

Foundational guidance for architecture, security, testing, and Firebase patterns is provided
by global Claude Code skills (`~/.claude/skills/`) that auto-activate based on context.
Project-specific strategic frameworks remain in `.prompts/meta/`.

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
  - All decision triggers met (see `operations-principles` global skill)
  - Explicit justification why existing platforms are insufficient
  - Documented evaluation of extending current platforms first

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

**Last Updated**: 2026-05-03
**Last Architecture Review**: 2026-05-03

| Domain | Current State | Status |
|--------|---------------|--------|
| **UI Components** | 4 Web Components (`home-standings`, `season-scorecards`, `admin-panel`, `admin-users-panel`) | Live |
| **Security** | Phase 2: Firebase Auth (Google) + Firestore rules + App Check + custom-claim RBAC (`role: 'owner' \| 'admin' \| 'user'`); Cloud Functions are sole writer of role claim + mirror | Complete |
| **Data** | Firestore drives home page, scorecards, RBAC user mirror, audit log; JSON scorecard files are permanent static assets per §II.5 | Live |
| **Testing** | Vitest unit tests for scoring engine, score service, schedule utils; rules-unit-testing matrix (44 cases); function unit tests (15 cases) | Active |
| **Deployment** | GitHub Actions CI/CD (push to `main` → Firebase Hosting + Firestore rules + Functions) | Active |
| **Monitoring** | Manual Firebase console checks | Active |
| **Cost** | Firebase Blaze (pay-as-you-go); usage discipline targets Spark-equivalent quotas | Near 0% usage |
| **Platform** | 2 platforms (Firebase + GitHub) | Maintain at 2 |

**Key Metrics** (as of 2026-03-10):
- **Active Users**: 0 (pre-launch — still on AWS/CloudFront)
- **SPA Views**: 6 (`home`, `scorecards`, `rules`, `about`, `downloads`, `admin`)
- **Modules**: 7 (`main`, `router`, `navigation`, `ui`, `firebase-config`, `score-service`, `standings-service`)
- **Repositories**: 2 (`score-repository`, `repository-factory`)
- **Types**: 4 (`score`, `shooter`, `season`, `scorecard`)
- **Data files**: 7 JSON scorecard seasons (2019–2025)
- **Team Size**: 1 developer
- **Firebase Usage**: Hosting configured (DNS not yet cutover); Firestore live; Cloud Functions deployed (RBAC role-writer + auth trigger); Blaze plan, near-zero spend

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


### III.3 UX Loading States

**Requirement**: Every async Web Component that fetches Firestore data MUST show a shimmer skeleton placeholder while loading — never plain text such as `<p>Loading…</p>`.

**How to implement**:

1. At the top of any async load method (before the first `await`), set `this.innerHTML` to skeleton HTML built from the utility classes in `src/styles/main.css`.
2. Write the skeleton as a `private static` method on the component class so it can be called in both `connectedCallback` (initial render) and any year/week-change handler.
3. Shape the skeleton to match the real content — use the same number of rows, columns, and approximate widths. Exact pixel perfection is not required; structural resemblance is.

**Available CSS utilities** (`src/styles/main.css`):

| Class | Purpose |
|-------|---------|
| `.skeleton` | Base shimmer block (apply to every placeholder element) |
| `.skeleton--sm` | 0.75 rem tall — body text / meta lines |
| `.skeleton--md` | 1.1 rem tall — normal text rows |
| `.skeleton--lg` | 1.75 rem tall — headings / table rows |
| `.skeleton--xl` | 2.5 rem tall — buttons / large controls |
| `.skeleton-group` | `flex-direction: column` container with consistent gap |
| `.skeleton-row` | `flex-direction: row` container for inline placeholder groups |

**Example pattern** (inline in `connectedCallback`):

```ts
connectedCallback(): void {
  this.innerHTML = MyComponent._skeleton();
  void this._load();
}

private static _skeleton(): string {
  return `
    <div class="skeleton-group" style="padding-top:var(--space-2)">
      <span class="skeleton skeleton--lg" style="width:50%"></span>
      <span class="skeleton skeleton--md" style="width:90%"></span>
      <span class="skeleton skeleton--md" style="width:75%"></span>
    </div>`;
}
```

**Dark mode**: The shimmer uses `--c-surface` and `--c-border` design tokens, which switch automatically — no additional dark-mode work is needed.

### III.4 Performance Standards

**Targets** (measurable at production launch):
- Page Load Time: <3 seconds (p95)
- Time to Interactive (TTI): <5 seconds (p95)
- First Contentful Paint (FCP): <1.5 seconds (p95)
- JS bundle: <250 kB gzipped (currently ~34 kB gzipped ✅)

**Firebase Quota Constraints** (Blaze, with Spark-equivalent discipline — see §VI.1):
| Resource | Daily target ceiling | Alert Threshold (70%) |
|----------|---------------------|----------------------|
| Firestore reads | 50,000 | 35,000 |
| Firestore writes | 20,000 | 14,000 |
| Hosting transfer | 360 MB | 252 MB |

**Optimization requirements**:
- Always use `limit()` + `where()` on Firestore queries — never read entire collections
- 1-hour in-memory TTL cache for season / team data (already implemented in `score-service.ts`)
- 5-minute TTL for `getLatestWeekResult()` (active-season data)
- Store and call `unsubscribe()` on any `onSnapshot()` listener


### III.5 Code Quality Standards

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
- **Platform**: Firebase (`citl-baed2` project, Blaze plan with Spark-equivalent usage discipline per §VI.1)
  - Firestore (NoSQL, `us-central1` region, production mode)
  - Hosting (SPA rewrite, security headers, cache rules)
  - Auth (Google, role-based custom claims)
  - Cloud Functions (TypeScript, Node 22, us-central1 — RBAC role-writer + auth trigger)
  - App Check (reCAPTCHA Enterprise, enforced in prod, relaxed under FUNCTIONS_EMULATOR)
- **SDK**: `firebase` npm package (installed; imported as ES modules); `firebase-admin` + `firebase-functions` in `functions/` package

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
❌  <p>Loading…</p> in async components      Use .skeleton shimmer classes (§III.3)
```

**Process anti-patterns**:
```
❌  Direct commits to main                   Always open a PR
❌  git commit -m "wip" / "fix"             Use conventional commit format
❌  Force push to main                       Never
❌  Skipping security rules in Emulator      Test rules before deploying
```


### IV.3 Technology Evaluation Criteria

Before adopting new technology, evaluate:
1. Does it fit within current platforms (Firebase, GitHub)?
2. Can existing platforms provide this capability?
3. What complexity does it add?
4. What is AI migration capability? (target: ≥80%)
5. What are the long-term maintenance implications?


---

## V. Development Workflow

### V.1 Feature Development Process

1. **Consult Constitution**: Read this document for project constraints and current state
2. **Create Specification**: Invoke `@speckit` with the feature request
   - References constitutional constraints (current state, quality standards, forbidden patterns)
   - Creates spec + implementation plan + task breakdown
3. **Implement**: Run `/implement <feature-name>` to execute the spec
   - Global Claude Code skills auto-activate for architecture, security, testing, and Firebase guidance
   - Consider evolution triggers — does this feature justify increased complexity?
4. **Review**: Invoke `@reviewer` to audit changes and draft PR description
5. **Test**: Validate against constitutional standards (security, performance, Firestore queries)
6. **Commit**: Conventional commit format with constitutional references

**Example commit message**:
```
feat(standings): add standings-table Web Component

Implements live Firestore-backed standings for home view.

Constitutional compliance:
- §III.3: Firestore query uses where() + limit() to stay within free tier
- §III.2: Admin-write enforced via Firestore rules (not client-side only)
- §IV.2: onSnapshot() unsubscribed in disconnectedCallback()
```

### V.2 Prompt Gap Protocol

If guidance is insufficient for a task:
1. **STOP** — do not guess or proceed without guidance
2. Flag the gap following [`.prompts/meta/prompt-gap-protocol.md`](.prompts/meta/prompt-gap-protocol.md)
3. Determine: constitutional gap, skill gap, or technical spec gap
4. Recommend creation / update of the appropriate file
5. **Do NOT proceed** until the gap is addressed

**Reference**: [.prompts/meta/prompt-gap-protocol.md](.prompts/meta/prompt-gap-protocol.md)

---

## VI. Cost Constraints

### VI.1 Firebase Blaze Plan with Spark-Equivalent Discipline

CITL is on Blaze (pay-as-you-go) but operates with usage discipline that
targets the former Spark free-tier quotas. The plan was upgraded as part
of the multi-user RBAC feature (002-multi-user-rbac, 2026-05-03) to
unlock Cloud Functions, which the RBAC role-writer pattern requires.

| Resource | Daily target ceiling | Alert at 70% |
|----------|---------------------|--------------|
| Firestore reads | 50,000 | 35,000 |
| Firestore writes | 20,000 | 14,000 |
| Firestore deletes | 20,000 | 14,000 |
| Hosting storage | 10 GB total | — |
| Hosting transfer | 360 MB/day | 252 MB |
| Authentication | Unlimited | — |
| Cloud Functions invocations | 2,000,000/month | 1,400,000/month |
| Cloud Functions GB-seconds | 400,000/month | 280,000/month |

**Hard constraints**:
- MUST stay within target ceilings above; spend should round to ~$0/mo at
  CITL's traffic volume. CITL is a hobby league with no operational
  budget — Blaze is enabled to unlock the Functions runtime, NOT to fund
  free-spending architecture.
- MUST implement caching before hitting 70% of any read/write limit.
- New Cloud Functions require justification documented in this section
  or a feature spec — they should solve a specific problem (e.g.
  privileged writes, atomic cross-system operations) that the client
  SDK + Firestore rules cannot satisfy alone.
- Set a Blaze budget alert at $5/mo as a safety net; investigate any
  spend above $1/mo immediately.


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

### VII.1 Global Claude Code Skills (Auto-Activated)

Foundational guidance for architecture, security, testing, operations, and Firebase is provided
by global Claude Code skills at `~/.claude/skills/`. These auto-activate based on context — no
manual consultation needed. Key skills: `software-architecture`, `security-principles`,
`testing-principles`, `operations-principles`, `git-conventions`, `asset-reusability`,
`firebase-best-practices`, `firebase-security`, `firebase-testing`, `firebase-monitoring`,
`firebase-cost-resilience`.

### VII.2 Strategic Frameworks

**Meta Guidance**:
- [architectural-evolution-strategy.md](.prompts/meta/architectural-evolution-strategy.md) — Evolution triggers, decision framework
- [architectural-decision-log.md](.prompts/meta/architectural-decision-log.md) — Historical decisions, current state
- [prompt-gap-protocol.md](.prompts/meta/prompt-gap-protocol.md) — Handling insufficient guidance
- [prompt-maintenance.md](.prompts/meta/prompt-maintenance.md) — Keeping prompts current

### VII.3 Technical Specifications

- [.specs/technical/build-system.md](.specs/technical/build-system.md) — Vite 7 configuration
- [.specs/technical/cicd-pipeline.md](.specs/technical/cicd-pipeline.md) — GitHub Actions
- [.specs/technical/firebase-deployment.md](.specs/technical/firebase-deployment.md) — Firebase Hosting deployment
- [.specs/technical/firestore-schema.md](.specs/technical/firestore-schema.md) — Firestore collection/document reference

### VII.4 Agents & Skills

| Command | Description |
|---------|-------------|
| `@speckit` | Create feature spec + implementation plan + task breakdown |
| `@reviewer` | Audit branch changes, draft PR description |
| `@scoring` | Scoring engine domain expert |
| `/constitution` | Project state dashboard |
| `/implement <feature>` | Execute a feature spec |
| `/check` | Quick pre-commit compliance check |
| `/deploy-preview` | Build + test + Firebase preview deploy |

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
- ✅ Any new async Web Component loading state uses `.skeleton` classes — no `<p>Loading…</p>` (§III.3)

**Mandatory before every PR**:
- ✅ PR description includes Summary, Changes, Testing, Constitutional Compliance
- ✅ No force push to main
- ✅ Build passes (`npm run build`)
- ✅ No merge conflicts

---

**Version History:**
- 1.0.0 (2026-02-27): Initial constitution established for CITL
- 1.0.1 (2026-02-28): Minor metrics update
- 1.1.0 (2026-03-01): TypeScript migration complete; CSS design system; dark mode; inline SVGs
- 1.2.0 (2026-03-10): Removed phase references throughout; constitution is now state-based and timing-agnostic
- 1.3.0 (2026-03-13): Added §III.3 UX Loading States — skeleton shimmer placeholders required for all async Web Components; added corresponding forbidden pattern and commit checklist item
- 1.4.0 (2026-04-12): Migrated foundational guidance to global Claude Code skills; removed `.prompts/core/` and `.prompts/platforms/` references; retained `.prompts/meta/` for project-specific strategic frameworks; updated §V.1 workflow and §VII references
