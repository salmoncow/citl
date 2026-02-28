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
