# AGENTS.md — Central Illinois Trap League (citl.club)

This file provides mandatory context and guidelines for AI coding agents working in this repository.
Read this entire file before making any architectural or implementation decisions.

---

## Project Overview

**citl.club** is the web presence for the Central Illinois Trap League.

### Migration Context

This project is undergoing a significant modernization:

| Aspect | Current State | Target State |
|---|---|---|
| Hosting | AWS S3 + CloudFront | Firebase Hosting (`citl` project) |
| Build | None (raw HTML/CSS/JS) | Vite 7.x SPA |
| JavaScript | ES5 globals, `var`, inline handlers | ES6+ modules, `const`/`let` |
| Data | Static HTML, hand-edited | Firestore (scores, standings, results) |
| Auth | None | Firebase Auth (Google) — admin users only |
| CI/CD | GitHub Actions → S3 sync + Terraform | GitHub Actions → Firebase Hosting deploy |
| Infrastructure | Terraform (AWS) | Firebase (no Terraform needed) |

**Reference project**: `/home/td000/salmoncow` — a working Firebase + Vite SPA using the
same patterns this project should adopt. Consult it when implementing any new module.

**Firebase project ID**: `citl` (already exists in Firebase console; Hosting-only so far)

---

## Target Directory Structure

```
citl-static/
├── src/
│   ├── components/        # Web Components (UI layer — custom elements)
│   ├── modules/           # Application orchestration (auth, navigation, router, ui)
│   ├── services/          # Business logic (scores, standings, auth, admin)
│   ├── repositories/      # Data access layer (Firestore impl + factory pattern)
│   ├── types/             # JSDoc @typedef type definitions
│   ├── assets/
│   │   ├── images/        # Logos, trophy images, season calendars
│   │   ├── score_sheets/  # PDF score sheets (static, served as-is)
│   │   └── styles/        # Shared/component CSS
│   ├── styles/
│   │   └── main.css       # Global base styles
│   ├── firebase-config.js # Firebase SDK init (reads VITE_ env vars)
│   ├── main.js            # Application entry point / orchestrator
│   └── index.html         # Vite HTML entry point
├── public/                # Static assets copied to dist/ as-is (favicon, robots.txt)
├── dist/                  # Build output — gitignored
├── .env                   # Firebase config secrets — gitignored, never commit
├── .env.example           # Template for required env vars — commit this
├── firebase.json          # Firebase Hosting config (rewrites, headers, cache)
├── .firebaserc            # Firebase project binding ("citl")
├── vite.config.js         # Vite build configuration
├── tsconfig.json          # TypeScript config (type-checking only, allowJs: true)
├── package.json
└── AGENTS.md              # This file
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Local development (Vite dev server with HMR at http://localhost:3000)
npm run dev

# Production build → dist/
npm run build

# Preview production build locally (serves dist/)
npm run preview

# Remove build output
npm run clean

# Build + deploy to Firebase Hosting (production)
npm run deploy

# Build + deploy to Firebase preview channel (7-day expiry, shareable URL)
npm run deploy:preview
```

**No tests exist yet** (Phase 1: manual testing). A `npm test` script will be added when
the module count reaches 10+. See Testing section below.

**No linter/formatter is configured yet.** One will be added when the project stabilizes.
Until then, follow the code style rules in this file manually.

---

## Environment Setup

```bash
# 1. Install Node.js 24.x (required — pin with .nvmrc)
nvm use 24

# 2. Install Firebase CLI globally
npm install -g firebase-tools

# 3. Install project dependencies
npm install

# 4. Copy env template and fill in Firebase config values
cp .env.example .env
# Edit .env with values from Firebase console → Project Settings → Your apps

# 5. Authenticate Firebase CLI
firebase login
firebase use citl
```

### Required Environment Variables (`.env`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=citl
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
NODE_ENV=development
```

Access in source via `import.meta.env.VITE_*`. Never access `process.env` directly.

---

## JavaScript Code Style

### Syntax Rules

- **Always** use `const` or `let`. **Never** use `var`.
- **Always** use ES6+ module syntax (`import`/`export`). No global function declarations.
- Use arrow functions for callbacks; named `function` declarations for module-level functions.
- No inline event handlers in HTML (no `onclick=`, `onload=`, etc.). Attach listeners in JS.
- Prefer `textContent` over `innerHTML`. When HTML insertion is required, sanitize first.

### Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `score-service.js`, `standings-table.js` |
| Classes / Web Components | PascalCase | `ScoreService`, `StandingsTable` |
| Functions / methods | camelCase | `getStandings()`, `formatScore()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_CACHE_TTL`, `FIRESTORE_LIMIT` |
| CSS custom properties | `--kebab-case` | `--color-primary`, `--font-size-base` |
| Custom elements | `kebab-case` | `<standings-table>`, `<score-card>` |

### Types (JSDoc — no TypeScript emit)

Use JSDoc `@typedef` for all data shapes. Mirror the pattern in `src/types/`:

```js
/**
 * @typedef {Object} Score
 * @property {string} id - Firestore document ID
 * @property {string} shooterId
 * @property {number} week
 * @property {number} score
 * @property {string} createdAt - ISO 8601 timestamp
 */
```

The `tsconfig.json` has `allowJs: true, checkJs: false` — types are for IDE support only.

### Error Handling — Result Pattern

All service and repository functions **must** return a `Result` object. Never throw across
module boundaries.

```js
// Return structure
{ success: true,  data: value }
{ success: false, error: 'Human-readable message', code: 'ERROR_CODE' }

// Usage
const result = await scoreService.getWeeklyScores(week);
if (!result.success) {
  console.error(result.error);
  return;
}
render(result.data);
```

### Imports

- Absolute imports using `@/` path alias (configured in `vite.config.js` and `tsconfig.json`)
- Group imports: (1) Firebase SDK, (2) internal modules, (3) types — separated by blank lines
- Import only what is used (tree-shaking friendly)

```js
import { getDoc, getDocs, query, where, limit } from 'firebase/firestore';

import { ScoreRepository } from '@/repositories/score-repository.js';
import { formatScore } from '@/modules/ui.js';

/** @type {import('@/types/score.js').Score} */
```

---

## Architecture Principles

### Layer Responsibilities

```
src/components/    Web Components — rendering, user events, no business logic
src/modules/       Orchestration — wires components + services, manages app state
src/services/      Business logic — validation, transformation, caching, rules
src/repositories/  Data access — Firestore reads/writes, localStorage fallback
src/types/         JSDoc typedefs only — no runtime code
```

Dependencies flow **inward only**: `components → modules → services → repositories`.
A repository must never import from a service. A component must never call Firestore directly.

### Module Size

- Target: <500 lines per file
- Hard limit: Split any file exceeding 750 lines into smaller, single-responsibility modules

### Repository Factory Pattern

Use a factory to make the data backend swappable (mirrors salmoncow `src/factories/`):

```js
// repositories/repository-factory.js
export function createRepositoryFactory(config) {
  if (config.backend === 'firestore') return new FirestoreRepositoryFactory(db);
  if (config.backend === 'localStorage') return new LocalStorageRepositoryFactory();
}
```

This allows running without Firebase during early development.

---

## Firebase / Firestore Guidelines

### Firestore Query Rules (enforce strictly)

```js
// ✅ CORRECT — always use limit() and where()
const q = query(
  collection(db, 'scores'),
  where('week', '==', currentWeek),
  orderBy('score', 'desc'),
  limit(50)
);

// ❌ WRONG — reading entire collection (breaks free tier quota)
const all = await getDocs(collection(db, 'scores'));
```

### Real-Time Listeners

Always store and call the unsubscribe function:

```js
// ✅ CORRECT
const unsubscribe = onSnapshot(doc(db, 'scores', id), (snap) => { ... });
// Call unsubscribe() when component is disconnected / destroyed

// ❌ WRONG — memory leak + unnecessary quota consumption
onSnapshot(doc(db, 'scores', id), (snap) => { ... });
```

### Client-Side Caching

Cache Firestore reads to reduce quota usage (1-hour TTL minimum for reference data):

```js
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getCached(key, fetchFn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;
  const data = await fetchFn();
  cache.set(key, { data, ts: Date.now() });
  return data;
}
```

### Free Tier Quotas (Spark plan — stay within these)

| Resource | Daily Limit | Alert Threshold (70%) |
|---|---|---|
| Firestore reads | 50,000 | 35,000 |
| Firestore writes | 20,000 | 14,000 |
| Hosting transfer | 360 MB | 252 MB |

Monitor weekly in the Firebase console. Trigger an optimization sprint at 70% of any limit.

### Security Rules Principles

- Scores/standings: public **read**, admin-only **write** (custom claim `admin: true`)
- User profiles: owner read/write only (`request.auth.uid == userId`)
- Test all rules in the Firebase Local Emulator before deploying

---

## Security

- **Never** commit secrets or API keys. All Firebase config goes in `.env` (gitignored).
- **Never** rely on client-side auth checks alone — always enforce with Firestore security rules.
- **Always** validate and sanitize inputs before writing to Firestore.
- Use `textContent` / `escapeHtml()` helper for any user-supplied content rendered to DOM.
- `firebase.json` must include security headers on all routes: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.

---

## Testing

**Current phase: Phase 1 (manual browser testing).** No test framework is configured.

**Trigger for Phase 2 (unit tests)**: 10+ modules OR production launch planned.

When Phase 2 is triggered, adopt Vitest (consistent with Vite toolchain). Target:
- ≥80% overall code coverage
- 70% unit / 20% integration / 10% E2E test pyramid
- 100% coverage on auth and Firestore security rule paths

---

## Git Workflow

### Branch Naming

```
feat/<description>      # New feature
fix/<description>       # Bug fix
docs/<description>      # Documentation only
refactor/<description>  # Refactor, no behavior change
chore/<description>     # Tooling, deps, config
ci/<description>        # CI/CD changes
```

### Conventional Commits (required)

```
feat(scores): add weekly standings Firestore query
fix(auth): resolve Google sign-in popup blocked on Safari
docs: update AGENTS.md with Firestore caching pattern
refactor(router): extract route guard into separate module
chore: add .nvmrc pinning Node 24
ci: add Firebase preview channel deploy on PR
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

### Pull Request Rules

- All changes to `main` via Pull Request — no direct commits
- No force pushes to `main`
- PR description must include: **Summary**, **Changes**, **Testing** sections
- Squash trivial fixup commits before merge

---

## CI/CD Pipeline (Target State)

| Trigger | Workflow | Action |
|---|---|---|
| Push to `main` | `deploy-production.yml` | `npm ci` → `npm run build` → Firebase Hosting (live) |
| PR opened/updated | `deploy-preview.yml` | `npm ci` → `npm run build` → Firebase preview channel (7d) |

`VITE_FIREBASE_*` values are injected at build time from GitHub Actions secrets.
The Firebase service account (`FIREBASE_SERVICE_ACCOUNT`) is stored as a GitHub secret.
Uses `FirebaseExtended/action-hosting-deploy@v0` action (same as salmoncow).

---

## Forbidden Patterns

```
❌  var x = ...                          Use const / let
❌  onclick="myFunction()"               Attach listeners in JS
❌  element.innerHTML = userInput        Use textContent or sanitize
❌  getDocs(collection(db, 'scores'))    Always add where() + limit()
❌  onSnapshot(...) without cleanup      Store and call unsubscribe()
❌  Hardcoded Firebase config in source  Use import.meta.env.VITE_*
❌  God modules > 500 lines              Split by responsibility
❌  Circular imports between modules     Dependencies flow inward only
❌  Skipping PR for changes to main      Always open a PR
❌  git commit -m "wip" / "fix"          Use conventional commit format
❌  Force push to main                   Never
```

---

## TODO — Migration Work Items

The following tasks represent the full scope of the AWS → Firebase modernization.
Work through these in order; check off items as they are completed.

### Phase 0 — AI Enablement (current branch)
- [x] Create `feat/ai-enablement` branch
- [x] Write `AGENTS.md` (this file)

### Phase 1 — Project Scaffolding
- [ ] Initialize `package.json` with Vite 7.x, Terser, TypeScript devDependencies
- [ ] Add `.nvmrc` pinned to Node 24
- [ ] Add `vite.config.js` (modeled after salmoncow; `@/` alias, Terser minifier)
- [ ] Add `tsconfig.json` (`allowJs: true`, `checkJs: false`, `@/` paths)
- [ ] Add `.gitignore` (node_modules, dist, .env, .firebase)
- [ ] Add `.env.example` with all required `VITE_FIREBASE_*` keys

### Phase 2 — Firebase Setup
- [ ] Add `firebase.json` (Hosting config: rewrites → index.html, security headers, cache rules)
- [ ] Add `.firebaserc` (`default: citl`)
- [ ] Enable Firebase Hosting in the `citl` Firebase console project
- [ ] Enable Firebase Authentication (Google provider) in `citl` project
- [ ] Enable Firestore in `citl` project (production mode, `us-east1` region)
- [ ] Add `src/firebase-config.js` (reads `import.meta.env.VITE_*`)

### Phase 3 — Application Structure
- [ ] Migrate `src/index.html` → Vite entry point (strip inline handlers, add `<script type="module">`)
- [ ] Create `src/main.js` — application orchestrator (modeled after salmoncow)
- [ ] Create `src/modules/router.js` — hash-based SPA router
- [ ] Create `src/modules/navigation.js` — responsive nav (replacing `burgerNav()` global)
- [ ] Create `src/modules/ui.js` — shared DOM utilities (`escapeHtml`, `showToast`, etc.)
- [ ] Create `src/modules/auth.js` — Firebase Auth (Google sign-in, auth state listener)
- [ ] Migrate CSS: consolidate `src/spa/css/style.css` → `src/styles/main.css`
- [ ] Migrate static pages: `about.html`, `rules.html`, `downloads.html` as SPA routes
- [ ] Migrate `scorecards.html` collapsible logic → `src/components/scorecard-list.js` Web Component

### Phase 4 — Firestore Data Layer
- [ ] Design Firestore data model (collections: `scores`, `shooters`, `seasons`, `weeks`)
- [ ] Add `src/types/score.js`, `src/types/shooter.js` (JSDoc typedefs)
- [ ] Add `src/repositories/score-repository.js` (Firestore impl)
- [ ] Add `src/repositories/repository-factory.js` (factory pattern)
- [ ] Add `src/services/score-service.js` (business logic, caching, Result pattern)
- [ ] Add `src/services/standings-service.js`
- [ ] Create `src/components/standings-table.js` Web Component (replaces static `index.html` tables)
- [ ] Write `firestore.rules` — public read on scores/standings; admin-write via custom claim
- [ ] Test security rules in Firebase Local Emulator before deploying

### Phase 5 — Admin Auth
- [ ] Create `src/modules/auth.js` admin sign-in flow (Google popup)
- [ ] Add admin route (`#/admin`) with auth guard
- [ ] Create `src/components/admin-panel.js` — score entry UI (write to Firestore)
- [ ] Set `admin: true` custom claim on admin user(s) via Firebase Admin SDK or console

### Phase 6 — CI/CD Migration
- [ ] Add `.github/workflows/deploy-production.yml` (push to main → Firebase Hosting)
- [ ] Add `.github/workflows/deploy-preview.yml` (PR → Firebase preview channel)
- [ ] Add GitHub Actions secrets: `FIREBASE_SERVICE_ACCOUNT`, all `VITE_FIREBASE_*` vars
- [ ] Remove old `.github/workflows/main.yml` (AWS/Terraform pipeline)
- [ ] Decommission Terraform infrastructure (S3, CloudFront, Route53, ACM) after DNS cutover

### Phase 7 — DNS Cutover
- [ ] Add `citl.club` and `www.citl.club` as custom domains in Firebase Hosting console
- [ ] Update DNS records (A/CNAME) from CloudFront → Firebase Hosting IPs
- [ ] Verify SSL certificate provisioning by Firebase
- [ ] Validate production site at `citl.club`
- [ ] Decommission AWS resources via `terraform destroy`
