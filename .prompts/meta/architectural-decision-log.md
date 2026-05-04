# Architectural Decision Log — citl.club

Tracks key architectural decisions made during the development of citl.club.
Provides historical context for future developers and AI agents.

**How to use**: Before making a new architectural decision, review this log to understand
prior context. After making a significant decision, add an entry using the template below.

---

## How to Add a New Decision

```markdown
### ADR-NNN: [Short Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded by ADR-NNN
**Domains Affected**: UI | Security | Data | Testing | Deployment | Monitoring | Cost | Platform

**Context**
What situation or pain point prompted this decision?

**Decision**
What was decided?

**Rationale**
Why was this chosen over alternatives?

**Alternatives Considered**
- Alternative A: reason rejected
- Alternative B: reason rejected

**Consequences**
What does this decision enable? What does it constrain?

**Review Date**: YYYY-MM-DD (quarterly)
```

---

## Decision Log

---

### ADR-001: Migrate from AWS S3 + CloudFront to Firebase Hosting

**Date**: 2025-11-01 (estimated — pre-AGENTS.md)
**Status**: Accepted
**Domains Affected**: Platform, Deployment, Data, Security

**Context**

citl.club was a raw HTML/CSS/JS static site hosted on AWS S3 with CloudFront CDN, managed
by Terraform. The league had no dynamic data layer — all standings and results were
hand-edited HTML. Adding live scores, admin entry, and dynamic standings required either
extending AWS (API Gateway + Lambda + DynamoDB — significant complexity) or migrating to a
simpler platform. The project has one developer and a $0 infrastructure budget.

**Decision**

Migrate to Firebase Hosting + Firestore + Firebase Auth on the Spark (free) plan.

**Rationale**

- Firebase Hosting: zero-configuration HTTPS, CDN, SPA rewrite support — replaces
  S3 + CloudFront + Terraform with a single `firebase.json`
- Firestore: document database with real-time capabilities — appropriate for weekly
  sports scores (low write volume, medium read volume)
- Firebase Auth: Google sign-in for admin-only access — no custom auth backend needed
- Spark plan is free indefinitely for low-traffic sites (CITL is a hobbyist league)
- Single platform reduces operational overhead; no Terraform to maintain
- Firebase SDK is well-supported by AI agents (high migration confidence)

**Alternatives Considered**

- **Extend AWS**: API Gateway + Lambda + DynamoDB — rejected; high complexity, ongoing cost
- **Netlify + PlanetScale**: Netlify for hosting, PlanetScale for MySQL — rejected; adds
  a third platform, more cost risk, less AI-migration-friendly
- **Vercel + Supabase**: rejected for same reasons — 2 platforms vs Firebase's 1

**Consequences**

- Enables: live Firestore standings, admin score entry, preview channel deploys, no Terraform
- Constrains: Firestore document model (not relational), Spark plan free tier limits,
  Cloud Functions unavailable on free tier (admin logic must stay client-side for now)
- Migration sequenced in phases to avoid disrupting live site during transition

**Review Date**: 2026-05-27

---

### ADR-002: Rewrite from Raw HTML to Vite 7 SPA

**Date**: 2025-11-15 (estimated — Phase 1 scaffolding)
**Status**: Accepted
**Domains Affected**: UI, Deployment, Data

**Context**

The legacy site consisted of multiple separate HTML files (`index.html`, `scorecards.html`,
`about.html`, etc.) with inline `<script>` tags, `var` globals, and `onclick=` handlers.
Migrating to Firebase required a build step (for `import.meta.env.VITE_*` env vars) and
a single-page app structure for SPA routing (`#/about`, `#/scorecards`, etc.).

**Decision**

Use Vite 7.x as the build tool. Implement a hash-based SPA router (`src/modules/router.js`)
replacing separate HTML files with JS-rendered views mounted at `<main>`.

**Rationale**

- Vite provides ES6 module bundling, `import.meta.env.*` injection, asset fingerprinting,
  HMR dev server, and Terser minification with minimal config
- Hash-based routing (`#/route`) works natively with Firebase Hosting's SPA rewrite
  (all routes → `index.html`) without any client-side history manipulation
- SPA eliminates per-page full reloads; only the view content changes on navigation
- Vite provides a consistent, well-established SPA pattern suitable for Firebase-hosted apps
- Small bundle: ~34 kB gzipped (Firebase SDK tree-shaken; only imported modules bundled)

**Alternatives Considered**

- **Multi-page Vite MPA**: keep separate HTML files but add Vite — rejected; doesn't solve
  the navigation UX and requires duplicating nav/header in each page
- **React or Vue SPA**: rejected; framework overhead not justified for a site this small;
  vanilla JS is fully sufficient and 80%+ AI-migratable to React if needed later
- **No build step (raw ES modules)**: rejected; can't inject `VITE_FIREBASE_*` at runtime
  without a backend, and no asset fingerprinting or bundling for Firebase SDK

**Consequences**

- Enables: ES6 modules, `@/` path alias, `import.meta.env.*`, Terser minification, HMR
- Constrains: all pages must be rendered client-side via JS; page content is not in HTML
  (search-engine indexability not a concern for a members-only league site)
- All legacy inline event handlers and `var` globals eliminated in migration

**Review Date**: 2026-05-27

---

### ADR-003: Static JSON Scorecard Files as Permanent Historical Data Layer

**Date**: 2025-12-01 (estimated — Phase 3 scorecards migration)
**Status**: Accepted
**Domains Affected**: Data

**Context**

CITL has 7 completed seasons (2019–2025) of scorecard data — team rosters, individual
shooter scores, weekly totals (targets, rank points, bonus points), and season averages.
This data was previously encoded in static `scorecards.html` as HTML tables. The question
arose: should this data migrate to Firestore, or stay as static files?

**Decision**

Extract all 7 seasons into JSON files (`src/data/scorecards/*.json`) and keep them as
**permanent static assets** bundled with the application. Firestore is used exclusively
for *live / current season* weekly results (home page results feed).

**Rationale**

- Scorecard data is immutable once a season ends — it never changes after the final week
- Storing 7 seasons × ~10 teams × ~6 shooters × 15 weeks = thousands of rows in Firestore
  would consume significant Firestore read quota on every Scorecards page visit
- Static JSON bundled by Vite is loaded once at startup (sub-millisecond access) with zero
  Firestore reads and zero quota consumption — optimal for a free-tier project
- The JSON schema (parallel arrays for scores/targets/rankPoints/bonusPoints indexed by
  week 0–14) is compact, self-documenting, and easy for AI agents to maintain
- Historical data will never need real-time updates — no benefit to Firestore for this use case

**Alternatives Considered**

- **All data in Firestore**: rejected — excessive quota consumption for immutable data;
  adds latency; complicates the admin import process for historical data
- **All data as static HTML**: rejected — the original approach; not maintainable, hard
  to render dynamically, no structured data schema
- **External CMS**: rejected — adds a third platform, cost risk, setup complexity

**Consequences**

- Enables: zero Firestore reads for Scorecards page; data survives Firestore outages;
  dead-simple schema for AI agents to extend with new season JSON files
- Constrains: bundle size grows slightly with each new season (~20 kB per season JSON);
  scorecard data requires a git commit to update (no web-based editing)
- Clear separation: `src/data/` is historical; Firestore `seasons/{year}/weeks/` is live

**Review Date**: 2026-05-27

---

### ADR-004: Repository + Service Layer Pattern for Firestore Data Access

**Date**: 2026-02-27
**Status**: Accepted
**Domains Affected**: Data, UI

**Context**

With Firestore as the live data backend, the application needs a clean separation between
UI rendering code and Firestore SDK calls. Without an abstraction layer, components would
call `getDocs()` directly, making the code hard to test, hard to maintain, and tightly
coupled to Firestore.

**Decision**

Implement a three-layer data access architecture:

1. **Repository** (`src/repositories/`): Firestore SDK calls only; returns `Result` objects
2. **Service** (`src/services/`): Business logic, input validation, in-memory caching; wraps Repository
3. **Factory** (`src/repositories/repository-factory.js`): Creates repository instances;
   supports `firestore` and `stub` backends

**Rationale**

- Repository pattern isolates Firestore SDK from business logic — swapping backends
  (e.g., for testing) requires only changing the factory, not the service layer
- Service layer owns caching (1-hour TTL for season/team data; 5-min TTL for latest week)
  — reduces Firestore reads significantly for repeat visitors
- `stub` backend allows the app to run entirely offline during development without `.env`
  credentials — zero Firestore reads during scaffolding
- Result pattern (`{ success: true, data }` / `{ success: false, error, code }`) prevents
  unhandled exceptions from propagating to the UI — consistent error handling across all layers
- Pattern is consistent across all layers — reusable and testable across the full stack

**Alternatives Considered**

- **Direct Firestore calls in views**: rejected — untestable, mixes concerns, hard to cache
- **Single service with embedded Firestore calls**: rejected — coupling prevents backend swap,
  harder to add `stub` mode for offline dev
- **State management library (Redux, Zustand)**: rejected — overkill for a single-developer
  project at Phase 1; can be added when complexity justifies it

**Consequences**

- Enables: offline `stub` backend for dev; 1-hour cache reduces free tier quota usage;
  testable service layer (Vitest in Phase 2); clean separation of concerns
- Constrains: more files and more indirection than direct Firestore calls; requires
  discipline to keep dependency direction correct (no components importing from repositories)
- Current files: `score-repository.js`, `repository-factory.js`, `score-service.js`,
  `standings-service.js`

**Review Date**: 2026-05-27

---

### ADR-005: Admin-Only Authentication (No Public Auth)

**Date**: 2026-02-27
**Status**: Accepted (deferred to Phase 5)
**Domains Affected**: Security, UI

**Context**

CITL is a public-facing league website. All scoring data (standings, results) should be
publicly readable without authentication. However, score entry (writing to Firestore) needs
to be restricted to the league admin (one person).

**Decision**

Implement **admin-only authentication** using Firebase Auth (Google sign-in) with a
custom claim `admin: true` set on the admin user's account. Public users are never
prompted to sign in. Admin access is behind a hidden `#/admin` route.

**Rationale**

- Public visitors (league members, family) should see standings with zero friction — no
  sign-in wall, no account required
- One admin (league commissioner) needs to enter weekly scores — a simple Google sign-in
  popup is sufficient; no complex role system needed
- Firestore security rules enforce `admin: true` custom claim on write paths — client-side
  auth state is never trusted alone
- Delaying auth to Phase 5 is correct — auth is only needed when the admin score entry UI
  is built; implementing it earlier adds complexity with no user value

**Alternatives Considered**

- **Public auth (all users sign in)**: rejected — adds friction for a simple scoreboard site;
  no user-specific data exists to justify requiring accounts
- **Basic auth / password in firebase.json**: rejected — Firebase Hosting doesn't support
  HTTP basic auth; password would be in client code
- **Separate admin app**: rejected — unnecessary complexity; a hidden route with auth guard
  is sufficient for a single admin

**Consequences**

- Enables: zero-friction public experience; simple auth implementation (one provider, one user)
- Constrains: admin route must be guarded by auth check AND Firestore rules (defense in depth);
  admin can only use Google account linked to the `citl` Firebase project
- Implementation deferred to Phase 5; stub admin route returns 403 until implemented

**Review Date**: 2026-05-27

---

### ADR-006: Scoring Engine as Pure Computation Service

**Date**: 2026-02-27
**Status**: Accepted
**Domains Affected**: Data, UI

**Context**

Trap league scores were previously computed in Excel. The RANK POINTS and BONUS POINTS
formula rows developed `#REF!` errors. The raw weekly shooter scores are authoritative;
all derived values (rank points, bonus points, standings, season awards) needed to be
rebuilt in code that is auditable, testable, and not locked to Excel.

**Decision**

Implement a pure computation service (`src/services/scoring-engine.js`) with no I/O,
no side effects, and no framework dependencies. CSV parsing is separated into
`src/utils/csv-parser.js`. Persistence uses the existing Repository + Factory pattern
with a new `localStorage` backend (`src/repositories/localstorage-score-repository.js`).

**Rationale**

- Pure functions are trivially testable and portable — Firestore migration requires no
  engine changes; only the factory backend reconfigures
- Separating parsing from calculation (SRP) keeps both units focused and independently
  testable
- localStorage backend fits the existing factory pattern; swapping to Firestore is a
  one-line `factory.reconfigure({ backend: 'firestore', db })` call
- Existing JSON data (7 seasons, 2019–2025) validates engine correctness without
  requiring a dedicated test framework

**Alternatives Considered**

- **Inline scoring in views**: rejected — untestable, mixes concerns, can't reuse for admin entry
- **Test-framework-first (Vitest)**: deferred — JSON validation is sufficient for Phase 1;
  Vitest added in Phase 2 when admin UI requires more rigorous coverage
- **Firestore-first (skip localStorage)**: rejected — localStorage allows offline dev and
  admin data entry before Firestore is provisioned in console

**Consequences**

- Enables: scoring logic is version-controlled and auditable; engine validates against
  7 seasons of known-good JSON data; Firestore migration path is clear
- Constrains: dummy going-in average computation is stateful (must process weeks
  sequentially; cannot parallelize weeks)
- Current files: `scoring-engine.js`, `csv-parser.js`, `localstorage-score-repository.js`

**Review Date**: 2026-08-27

---

### ADR-007: Full TypeScript Migration

**Date**: 2026-03-01
**Status**: Accepted
**Domains Affected**: UI, Data

**Context**

All source files were vanilla JavaScript with JSDoc @typedef comments for type hints.
As the codebase grew to 22 source files across 6 layers, JSDoc types provided insufficient
safety — implicit `any` propagation from Firestore snapshot casts, array index unsafe access,
and no compile-time feedback on interface mismatches. The scoring engine and repository layer
had subtle bugs caught only by cross-season JSON validation.

**Decision**

Migrate all 22 .js source files to .ts with strict TypeScript:
`allowJs: false`, `strict: true`, `noUncheckedIndexedAccess: true`.
@typedef comments replaced by exported interface/type declarations in `src/types/*.ts`.
Vite continues to strip types via esbuild — no tsc emit, no build config changes.

**Rationale**

- `noUncheckedIndexedAccess` catches array out-of-bounds at compile time (critical in scoring engine)
- Generic `Result<T>` type replaces `@typedef Result {success, data, error}` — eliminates `any` propagation
- `ScorecardShooter` vs `Shooter` disambiguation prevents accidental cross-type assignment
- `vite-env.d.ts` types `ImportMetaEnv` — eliminates implicit any on `import.meta.env.*`
- Zero new dependencies; TypeScript was already installed for IDE support

**Alternatives Considered**

- **JSDoc + checkJs**: rejected — `noUncheckedIndexedAccess` not supported in checkJs mode;
  complex generic types are poorly supported in JSDoc
- **Gradual migration (allowJs: true)**: rejected — mixed .js/.ts files create confusing import paths;
  clean cutover is simpler for a single-developer project

**Consequences**

- Enables: compile-time safety across all layers; IDE inline errors; reliable refactoring
- Constrains: all new files must be `.ts`; no `.js` source files in `src/`
- Current files: all 22 source files converted; old `.js` files deleted

**Review Date**: 2026-06-01

---

### ADR-008: CSS Design System + Visual Overhaul

**Date**: 2026-03-01
**Status**: Accepted
**Domains Affected**: UI, Platform

**Context**

The site used a flat CSS file (~180 lines) with hardcoded color values, a 400px
logo-only header, and Font Awesome icons loaded via CDN. The CDN dependency created a CSP
requirement for `cdnjs.cloudflare.com`, added a network round-trip on every page load, and
was a single-point-of-failure for icon rendering. No dark mode support existed despite
modern OS preference APIs being widely available.

**Decision**

1. Replace flat CSS with a two-layer custom property design system:
   - Layer 1: primitive palette (`--color-orange`, `--color-blue-dark`, etc.)
   - Layer 2: semantic tokens (`--c-bg`, `--c-surface`, `--c-text`, `--c-nav-bg`, etc.)
   System-aware dark mode via `@media (prefers-color-scheme: dark)` overrides semantic layer only.
2. Reduce brand strip from 400px to 80px; always-white background (logo has white bg).
3. Replace Font Awesome CDN with three inline SVGs (hamburger, home, caret-down).
4. Adopt BEM-style nav class names (`.site-nav`, `.site-nav__link`, `.is-active`, `.is-open`)
   replacing flat names (`.topnav`, `.active`, `.dropdown-show`, `.responsive`).
5. Add utility classes: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.map-container`,
   `.admin-header`, `.admin-status--success`, `.admin-status--error`.

**Rationale**

- Two-layer token system: primitive palette rarely changes; semantic layer drives dark mode
  by overriding `--c-*` tokens only — no per-component dark mode rules needed
- Brand always-white: logo asset has white background; dark mode bg does not apply to brand
- Inline SVGs: zero network dependency; zero CSP change; accessible (`aria-hidden`, `focusable=false`)
- BEM nav names: eliminate ambiguous `.active`/`.responsive` collisions with other CSS
- No new npm packages: native CSS + platform only; aligns with §I.2 Platform Simplification

**Alternatives Considered**

- **CSS framework (Tailwind)**: rejected — adds build complexity, large dependency, overkill for
  a small site; native CSS custom properties achieve the same theming capability
- **Separate dark-mode stylesheet**: rejected — two-layer token system is cleaner; single file,
  single paint; no flash-of-unstyled-content risk
- **Keep Font Awesome**: rejected — CDN dependency, CSP complexity, network risk; inline SVGs
  are smaller and zero-dependency for the three icons we use

**Consequences**

- Enables: system-aware dark mode with no JS; per-token overrides; CSP simplified (no CDN)
- Constrains: color changes must be made to token definitions, not component-level rules;
  inline SVGs must be manually updated if icons change
- `firebase.json` CSP: remove `style-src`/`font-src` `cdnjs.cloudflare.com` allowances

**Review Date**: 2026-06-01

---

### ADR-009: Adopt Blaze + Multi-User RBAC (Security Phase 1 → Phase 2)

**Date**: 2026-05-03
**Status**: Accepted
**Domains Affected**: Security · Cost · Platform · UI · Testing

**Context**

The single `admin: true` boolean custom claim that gated the legacy
admin portal made it hard to grant access to multiple league
volunteers without giving every one of them the keys to the kingdom.
Sub-admins (score keepers, content managers) needed a path to perform
content writes without being able to grant or revoke access. The
constitution's stated cost posture (Spark only, no Cloud Functions)
also drifted from reality: Blaze had been enabled on the project to
unlock the runtime needed for safe role-write semantics.

**Decision**

Replace the boolean claim with a three-role system
(`role: 'owner' | 'admin' | 'user'`). The custom claim is the
rules-engine source of truth (Firestore rules read
`request.auth.token.role`); a `users/{uid}` Firestore mirror is the
admin-UI source of truth; an append-only `audit/` collection tracks
every role change. The `setUserRole` Cloud Function is the sole writer
of the role claim — it validates input with zod, enforces a
last-owner guard, rate-limits at 20 calls/hour/owner, and orders the
auth claim write *before* the queued Firestore writes inside one TX
so a partial failure fails closed for revocations (see feature spec
§VI Design Decisions for the full failure-mode analysis). An
`onUserCreate` auth trigger seeds users/{uid} on first sign-in. A CLI
(`scripts/set-role.js`) provides bootstrap (first owner) and
recovery (lockout) paths; day-to-day promote/demote happens through
an in-app role dropdown rendered for owner only on the Admin Portal
Users panel.

This advances the **Security domain from Phase 1 to Phase 2** (App
Check + custom-claim RBAC) per the architectural-evolution-strategy.

**Rationale**

- **Privilege separation**: admins do content; only owner changes
  trust boundaries. The legacy `admin: true` couldn't represent this.
- **Security-first ordering**: claim-first inside the TX guarantees
  fail-closed on revocations even if the second-system write fails —
  see feature spec §VI for the trade-table.
- **Server-authoritative writes**: all role mutations go through the
  callable (or the Admin-SDK CLI for bootstrap). Clients can never
  write the `role` field — Firestore rules deny it explicitly.
- **Audit trail**: every role change writes an audit entry with
  actor, target, from-role, to-role, timestamp. The audit collection
  is owner-readable only; no client can write it.
- **Test coverage**: 44 rules-unit-testing cases (the full
  {owner, admin, user, anon} matrix on every protected collection)
  + 15 Cloud Function unit cases against the local emulator.

**Alternatives Considered**

- **Stay on Spark, extend the CLI to handle three roles**: rejected
  because it forces all role writes through a CLI that operators run
  on their dev machines, with no rate-limiting, no in-app UX, and no
  end-state path to a self-service admin UI.
- **TX-first ordering** (set claim *after* the TX commits): rejected
  because a failed claim write after a successful TX leaves the
  user with stale privileges (mirror says new role, claim still
  old) — fail-open on revocation. Would require a scheduled
  reconciliation job to be production-safe.
- **Defer the in-app dropdown to v2, ship CLI-only v1**: rejected
  after user feedback — production-ready end state should not depend
  on operators running a script for routine role changes.

**Consequences**

- **Enables**:
  - Granular access for league volunteers (admins) without
    full owner privileges
  - Full audit trail of every role change
  - Cloud Functions runtime for any future server-side privileged
    operations (only with documented justification per §VI.1)
  - Emulator-first local dev workflow — `npm run dev` boots the
    auth+firestore+functions emulators and connects Vite via
    `VITE_USE_EMULATOR=true`, eliminating accidental writes to
    production from localhost
- **Constrains**:
  - `firestore.rules`, `setUserRole.ts`, `onUserCreate.ts`, and
    `scripts/set-role.js` are all part of the security-critical
    surface — changes require running the rules + function test
    suites and ideally an `@reviewer` pass
  - Cloud Functions are now a deployable surface; CI must include
    `firebase deploy --only functions` (see updated
    `npm run deploy`)
  - Constitution §VI.1 requires Blaze budget alerts and per-function
    justification documentation
  - `admin-panel.ts` is now a known constitution-§II.3 violation
    (1781 lines); follow-up task tracked to refactor into per-tab
    modules and integrate `<admin-users-panel>` as a 4th tab

**Review Date**: 2026-08-03

---

## How AI Agents Should Use This Log

1. **Before implementing a new feature**: Check if a relevant decision exists that constrains
   the approach (e.g., ADR-003 explains why scorecard data is JSON, not Firestore)

2. **Before proposing an architectural change**: Check if the change conflicts with an
   existing decision — if so, update this log with a new ADR superseding the old one

3. **After making a significant architectural decision**: Add a new ADR entry using the
   template at the top of this file

4. **For context on current phase**: See `constitution.md` §II.1 for current state, and
   `architectural-evolution-strategy.md` for phase transition triggers

---

**Reference**: [.specs/constitution.md](../../.specs/constitution.md) — §II Architectural Standards
