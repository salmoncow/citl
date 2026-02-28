# AGENTS.md — Central Illinois Trap League (citl.club)

Agent orientation file. Read this first, then consult the documents below for all
architectural decisions, standards, and implementation guidance.

---

## What This Project Is

**citl.club** is the web presence for the Central Illinois Trap League — a hobbyist trap
shooting league in Central Illinois. The site publishes weekly standings, results, scorecards
(7 seasons, 2019–2025), league rules, and contact information.

The project is mid-migration from a legacy AWS S3 + raw HTML site to a modern
**Vite 7 SPA** hosted on **Firebase Hosting** with **Firestore** as the live data backend.

**Firebase project ID**: `citl-baed2`

---

## Mandatory Reading Before Acting

Start with these documents in order:

1. **[.specs/constitution.md](.specs/constitution.md)** — Single source of truth.
   Current architectural state, quality standards, forbidden patterns, tech stack,
   CITL-specific migration milestones, and DNS cutover checklist.

2. **[.prompts/README.md](.prompts/README.md)** — Foundational architecture, security,
   testing, git, and operations principles (platform-agnostic).

3. **[.prompts/meta/architectural-decision-log.md](.prompts/meta/architectural-decision-log.md)**
   — Why key decisions were made (AWS → Firebase, Vite SPA, JSON scorecards, repository pattern).

---

## Quick Reference

### Dev Commands

```bash
nvm use 24                           # Node 24 required (.nvmrc)
npm install                          # Install deps
npm run dev                          # Dev server → http://localhost:3000
npm run build                        # Production build → dist/
npm run preview                      # Serve dist/ locally
npm run deploy                       # build + firebase deploy --only hosting
npm run deploy:preview               # build + Firebase preview channel (7-day URL)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/main.js` | App entry point, route definitions |
| `src/modules/router.js` | Hash-based SPA router |
| `src/modules/navigation.js` | Responsive nav, burger menu |
| `src/firebase-config.js` | Firebase SDK init, exports `db` |
| `src/services/score-service.js` | Firestore reads + 1-hr cache |
| `src/services/standings-service.js` | Cumulative standings, results feed |
| `src/services/scoring-engine.js` | Pure scoring calculations (ADR-006) |
| `src/utils/csv-parser.js` | Parse `{year}-inputs.csv` → `SeasonData` |
| `src/components/standings-table.js` | Custom Element: cumulative season standings |
| `src/repositories/score-repository.js` | Raw Firestore operations |
| `src/repositories/repository-factory.js` | Factory: `firestore`, `stub`, or `localStorage` |
| `src/repositories/localstorage-score-repository.js` | localStorage backend |
| `src/views/home.js` | Home page (static HTML — Phase 4 target) |
| `src/views/scorecards.js` | Scorecards accordion (JSON-driven, all 7 seasons) |
| `src/data/scorecards/*.json` | Historical scorecard data 2019–2025 |
| `firebase.json` | Hosting config: SPA rewrite, CSP, cache headers |
| `.env.example` | Template for required `VITE_FIREBASE_*` env vars |

### Layer Dependency Direction

```
components → modules → services → repositories
                              ↑
                          (never reverse)
```

---

## Agentic Framework

This project uses a hybrid spec-kit + prompts framework:

| System | Directory | Contains |
|--------|-----------|---------|
| **Spec-Kit** | `.specs/` | CITL-specific constitution, current phase state, technical configs |
| **Prompts** | `.prompts/` | Universal patterns: architecture, security, testing, git, Firebase |

### Spec-Kit Commands

| Command | Action |
|---------|--------|
| `/speckit-specify <feature>` | Create feature requirement spec in `.specs/features/` |
| `/speckit-plan` | Design technical implementation referencing prompts |
| `/speckit-tasks` | Break down into actionable tasks |
| `/speckit-implement` | Execute with constitutional + prompt guidance |
| `/speckit-constitution` | View `.specs/constitution.md` |

---

## Migration TODO Checklist

Progress tracker for the AWS → Firebase modernization.

### Phase 0 — AI Enablement ✅
- [x] Create `feat/ai-enablement` branch
- [x] Write `AGENTS.md`

### Phase 1 — Project Scaffolding ✅
- [x] `package.json` with Vite 7.x, Terser, TypeScript devDependencies
- [x] `.nvmrc` pinned to Node 24
- [x] `vite.config.js` (`@/` alias, Terser, `outDir: ../dist`)
- [x] `tsconfig.json` (`allowJs: true`, `checkJs: false`, `@/` paths)
- [x] `.gitignore`, `.env.example`

### Phase 2 — Firebase Setup (partial)
- [x] `firebase.json` (Hosting config: SPA rewrite, security headers, cache rules)
- [x] `.firebaserc` (`default: citl`)
- [x] `src/firebase-config.js` (initializes Firebase app, exports `db`)
- [ ] Enable Firebase Hosting in console *(manual)*
- [ ] Enable Firebase Auth (Google) *(manual — deferred to Phase 5)*
- [ ] Enable Firestore in console (production mode, `us-east1`) *(manual — deferred to Phase 4)*

### Phase 3 — Application Structure ✅
- [x] `src/index.html` → Vite entry point
- [x] `src/main.js` — app orchestrator
- [x] `src/modules/router.js` — hash-based SPA router
- [x] `src/modules/navigation.js` — responsive nav
- [x] `src/modules/ui.js` — shared DOM utilities
- [x] `src/styles/main.css` — consolidated CSS
- [x] Static pages as SPA routes: `about`, `rules`, `downloads`
- [x] `src/views/scorecards.js` — JSON-driven accordion, all 7 seasons

### Phase 3.5 — Agentic Framework ✅
- [x] `.prompts/` — universal patterns (architecture, security, testing, operations)
- [x] `.specs/constitution.md` — CITL project constitution
- [x] `.specs/README.md`
- [x] `.specs/technical/build-system.md`
- [x] `.specs/technical/cicd-pipeline.md`
- [x] `.specs/technical/firebase-deployment.md`
- [x] `.prompts/meta/architectural-decision-log.md` — pre-populated (ADR-001 through ADR-005)
- [x] `AGENTS.md` slimmed to orientation + pointers

### Phase 3.5 — Tech Debt Resolution ✅
Identified during post-migration architectural review (2026-02-27):

- [x] `src/types/scorecard.js` — created JSDoc typedefs for `Shooter`, `TeamTotals`, `Team`, `SeasonData` (was missing; `scorecards.js` referenced it)
- [x] Firebase project ID `citl` → `citl-baed2` corrected in `AGENTS.md`, `PLAN.md`, `.env.example`
- [x] `http://` → `https://` links updated in `src/views/home.js` and `src/index.html`
- [x] Stale `gstatic.com` CDN external rule removed from `vite.config.js` (Firebase SDK is npm-installed, not CDN-loaded)
- [x] `innerHTML` in `main.js:_renderView()` documented as accepted transitional debt (static strings only; resolved in Phase 4 when views become Web Components)
- [x] `CONTRIBUTING.md`, `DEVELOPMENT.md`, `PLAN.md` removed — superseded by `AGENTS.md` + `.specs/constitution.md`
- [x] `src/components/` directory — created for Phase 4 `standings-table` Web Component

### Phase 4 — Scoring Engine + Standings Component ✅
- [x] Firestore data model designed (see ADR-004 + constitution §II.5)
- [x] `src/types/score.js`, `src/types/shooter.js`, `src/types/season.js`
- [x] `src/repositories/score-repository.js`
- [x] `src/repositories/repository-factory.js` (now supports `firestore`, `stub`, `localStorage`)
- [x] `src/services/score-service.js`
- [x] `src/services/standings-service.js`
- [x] `src/services/scoring-engine.js` — pure scoring calculation functions (ADR-006)
- [x] `src/utils/csv-parser.js` — parse `{year}-inputs.csv` → `SeasonData`
- [x] `src/repositories/localstorage-score-repository.js` — localStorage backend
- [x] `.specs/features/scoring-engine.md` — formal business rules spec
- [x] Cross-validate `computeSeasonTotals(parseSeasonCsv(...))` against JSON scorecards — 2023, 2024, 2025
- [x] `src/components/standings-table.js` Web Component

### Phase 5 — Admin Portal (localStorage backend)
Goal: ship a working admin score-entry UI backed by localStorage. Validate the
admin workflow before committing to Firestore writes.

- [ ] `src/firebase-config.js` — add `getAuth()` export alongside existing `db`
- [ ] `src/modules/auth.js` — Google sign-in (`signInWithPopup`), `signOut`, `onAuthStateChanged`, `currentUser` getter
- [ ] `src/views/admin.js` — admin view: login gate + panel (no separate /login route)
- [ ] `src/components/admin-panel.js` — score entry form; saves via `localStorage` backend
- [ ] `src/main.js` — register `#/admin` route; use `router.onBeforeNavigate()` for auth guard

### Phase 6 — Firestore Live
Goal: move admin-entered data from localStorage → Firestore; enforce security.

- [ ] Enable Firestore in console (production mode, `us-east1`) *(manual)*
- [ ] `firestore.rules` — public read, admin-write (`admin: true` custom claim)
- [ ] Set `admin: true` custom claim on admin user UID *(Firebase Admin SDK or console)*
- [ ] Migrate localStorage data → Firestore (one-time import utility)
- [ ] Test security rules in Firebase Local Emulator
- [ ] Update repository-factory default: `localStorage` → `firestore`

### Phase 7 — CI/CD *(deferred until after DNS cutover)*
- [ ] `.github/workflows/deploy-production.yml`
- [ ] `.github/workflows/deploy-preview.yml`
- [ ] GitHub Actions secrets: `FIREBASE_SERVICE_ACCOUNT`, all `VITE_FIREBASE_*`
- [ ] Decommission AWS/Terraform pipeline

### Phase 8 — DNS Cutover
- [ ] Add `citl.club` + `www.citl.club` as custom domains in Firebase console
- [ ] Update DNS records (A/CNAME) from CloudFront → Firebase Hosting IPs
- [ ] Verify SSL provisioning
- [ ] Validate production site at `citl.club`
- [ ] `terraform destroy` — decommission AWS

---

## Git Conventions

```
feat(scope): add weekly standings Firestore query
fix(auth): resolve Google sign-in popup blocked on Safari
docs: update constitution with new phase state
refactor(router): extract route guard into separate module
chore: add .nvmrc pinning Node 24
ci: add Firebase preview channel deploy on PR
```

All changes to `main` via Pull Request. No direct commits. No force pushes to `main`.
