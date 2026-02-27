# CITL Migration Plan — Current State & Next Phase

**Branch**: `feat/phase-1-scaffolding`  
**Overall goal**: Migrate citl.club from AWS S3 + CloudFront to Firebase Hosting, with a
Vite 7 SPA, Firestore-backed data, and Google Auth for admin score entry.

---

## Session Resumption Context

If this session is interrupted, resume from `AGENTS.md` for overall project context and
architectural rules, then use this file to understand where the work stands.

**Firebase project ID**: `citl`  
**Active branch**: `feat/phase-1-scaffolding` — do **not** open PRs or merge to `main`
until the DNS cutover decision is made.  
**Deploy method**: Firebase CLI locally (`npm run deploy`) — no CI/CD yet.

---

## What Is Complete

### Vite 7 SPA (Phases 1 & 3)

The app builds and runs. All scaffolding and application structure is done:

- `package.json`, `.nvmrc`, `vite.config.js`, `tsconfig.json`, `.gitignore`, `.env.example`
- `src/index.html` — Vite entry point, no inline handlers
- `src/main.js` — App class, hash-based routing, 5 routes
- `src/modules/router.js` — hash-based SPA router
- `src/modules/navigation.js` — burger nav, dropdown, scroll progress bar, active links
- `src/modules/ui.js` — `escapeHtml`, `showToast` stubs
- `src/firebase-config.js` — stub (no SDK, reads `VITE_*` env vars, dev-mode warning)
- `src/styles/main.css` — migrated from legacy `style.css`
- `src/views/home.js` — 2025 standings and results (static HTML, Phase 4 target for Firestore)
- `src/views/scorecards.js` — all 7 seasons (2019–2025), JSON-driven, ~90 lines
- `src/views/rules.js` — league rules
- `src/views/about.js` — about page with Google Maps embed
- `src/views/downloads.js` — PDF score sheet links
- `src/assets/images/` — logos, trophies, season calendars (2021–2025)
- `src/assets/score_sheets/` — PDF score sheets (2020–2025) + yardage table
- `public/` — `favicon.ico`, `robots.txt`

### Scorecard JSON Data

All 7 seasons extracted from legacy HTML into structured JSON:

- `src/data/scorecards/2025.json` — 8 teams
- `src/data/scorecards/2024.json` — 9 teams
- `src/data/scorecards/2023.json` — 10 teams
- `src/data/scorecards/2022.json` — 12 teams
- `src/data/scorecards/2021.json` — 12 teams (all rookies; first season)
- `src/data/scorecards/2020.json` — 9 teams (12-week season due to COVID)
- `src/data/scorecards/2019.json` — 10 teams (inaugural season)

Each file follows a consistent schema: `season`, `teams[]` with `shooters[]` and `totals`
(targets, rankPoints, bonusPoints). All scores arrays are 15 elements; `null` = did not
shoot that week.

### Firebase Hosting Config (Phase 2 partial)

- `firebase.json` — Hosting config with SPA rewrite, long-cache for static assets, security
  headers (CSP, HSTS, X-Frame-Options, etc.), CITL-specific CSP additions for Font Awesome
  (cdnjs.cloudflare.com) and Google Maps iframe (maps.google.com)
- `.firebaserc` — binds to `citl` Firebase project

---

## Remaining Manual Steps Before First Deploy

These require action outside the codebase:

1. **Firebase console**: confirm Firebase Hosting is enabled on the `citl` project
2. **Local CLI**: `firebase login && firebase use citl`
3. **Build + deploy**: `npm run deploy` (= `npm run build && firebase deploy --only hosting`)
4. **Validate**: open `https://citl-baed2.web.app`, verify all 5 routes, nav, scorecards accordion,
   Google Maps embed, Font Awesome icons — check browser console for CSP violations

---

## Deploy Commands

```bash
# Build and deploy to Firebase Hosting live channel
npm run deploy

# Build and deploy to a named preview channel (7-day expiry, shareable URL)
npm run deploy:preview

# Local dev server (no Firebase needed)
npm run dev          # http://localhost:3000
```

---

## Next Automated Phase — Phase 4: Firestore Data Layer

When ready to begin Phase 4, create branch `feat/firestore-data-layer`.

**Goal**: Replace the static HTML in `src/views/home.js` with live Firestore data.
The scorecards JSON files already exist as a source of truth for historical data; Phase 4
will add a live data path for current-season scores and standings.

### Work items

1. **Enable Firestore** in Firebase console (`citl` project, production mode, `us-east1`)
2. **Install Firebase SDK**: `npm install firebase`
3. **Wire `src/firebase-config.js`**: import and initialize `firebase/app`, export `db`
4. **Design Firestore data model**:
   - `seasons/{year}` — season metadata (weeks, teams)
   - `seasons/{year}/teams/{teamId}` — team info
   - `seasons/{year}/weeks/{weekNum}/scores/{scoreId}` — individual score records
5. **Add JSDoc typedefs** in `src/types/`
6. **Add repositories** (`src/repositories/`):
   - `score-repository.js` — Firestore reads with `where()` + `limit()` + caching
   - `repository-factory.js` — factory pattern for swappable backends
7. **Add services** (`src/services/`):
   - `score-service.js` — business logic, Result pattern, 1-hour TTL cache
   - `standings-service.js` — aggregate standings from scores
8. **Replace `homeView()`** with a dynamic component that reads from Firestore
9. **Write `firestore.rules`** — public read, admin-write via custom claim `admin: true`
10. **Test rules** in Firebase Local Emulator before deploying

### Key constraints (from AGENTS.md)

- Always use `where()` + `limit()` on Firestore queries — never read full collections
- Always store and call the unsubscribe function for `onSnapshot` listeners
- Cache reference data with 1-hour TTL minimum to stay within free tier quotas
- All service/repository functions return `{ success, data }` or `{ success, error, code }`

---

## Deferred Phases

| Phase | Description | Trigger |
|---|---|---|
| Phase 5 | Admin Auth — Google sign-in, `#/admin` route, score entry UI | After Phase 4 is stable |
| Phase 6 | CI/CD — GitHub Actions deploy-production + deploy-preview workflows | After DNS cutover decision |
| Phase 7 | DNS Cutover — `citl.club` → Firebase Hosting, decommission AWS | Manual, when ready |

**Phase 6 note**: CI/CD is intentionally deferred. Local `npm run deploy` is the deploy
method until the AWS → Firebase transition is complete and the repo owner is ready to wire
GitHub Actions secrets and open a PR to `main`.
