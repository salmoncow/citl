# CITL Migration Plan — Phase 1: Scaffolding & App Structure

**Branch**: `feat/phase-1-scaffolding`  
**Goal**: Go from zero build tooling to a working `npm run dev` local server, structured like the salmoncow reference project. All 5 pages render correctly as SPA routes. No Firebase required to run locally.

---

## Session Resumption Context

If this session is interrupted, resume from AGENTS.md for overall project context, then use this file to pick up where the work left off. Check git status and the todo list below to find the last completed step.

**Reference project**: `/home/td000/salmoncow` — verbatim patterns for all new files.  
**Key decision**: Pages become inline JS-rendered views (not separate HTML files).  
**Firebase**: No Firebase SDK in this phase — `firebase-config.js` is a stub with a dev-mode warning.  
**Terraform**: Deleted entirely (clean break, not deferred).

---

## Todo Checklist

- [ ] Write PLAN.md (this file)
- [ ] Create `feat/phase-1-scaffolding` branch
- [ ] Delete `src/terraform/` and `.github/workflows/main.yml`
- [ ] Create root scaffolding files: `.nvmrc`, `.gitignore`, `package.json`, `vite.config.js`, `tsconfig.json`, `.env.example`
- [ ] Create `public/` directory with `favicon.ico` and `robots.txt`
- [ ] Reorganize `src/` — move images/assets, remove `src/spa/`
- [ ] Create `src/styles/main.css` (migrated + cleaned from `src/spa/css/style.css`)
- [ ] Create `src/firebase-config.js` (stub, dev-mode warning, no SDK)
- [ ] Create `src/modules/router.js` (hash-based SPA router)
- [ ] Create `src/modules/navigation.js` (replaces `burgerNav`, `dropButton` globals)
- [ ] Create `src/modules/ui.js` (`escapeHtml`, `showToast` stubs)
- [ ] Create `src/index.html` (Vite entry point, clean of inline handlers)
- [ ] Create `src/main.js` (App class, 5 routes)
- [ ] Migrate page content as inline view functions (home, scorecards, rules, about, downloads)
- [ ] Run `npm install` and verify `npm run dev` works — all 5 routes, no console errors

---

## Step-by-Step Implementation

### Step 1 — Remove Terraform and Old CI/CD

Delete:
- `src/terraform/` (entire directory)
- `.github/workflows/main.yml` (Terraform + S3 sync pipeline)

The `.github/workflows/` directory will be empty until Phase 6 (Firebase CI/CD).

---

### Step 2 — Root Scaffolding Files

All modeled directly on `/home/td000/salmoncow`.

#### `.nvmrc`
```
24
```

#### `.gitignore`
Verbatim from salmoncow — covers: `.env*`, `.firebase/`, `node_modules/`, `dist/`, IDE files, OS files.

#### `package.json`
```json
{
  "name": "citl-static",
  "version": "1.0.0",
  "description": "Central Illinois Trap League — citl.club",
  "license": "MIT",
  "engines": { "node": ">=24.0.0 <25.0.0", "npm": ">=10.0.0" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "deploy": "npm run build && firebase deploy --only hosting",
    "deploy:preview": "npm run build && firebase hosting:channel:deploy preview"
  },
  "devDependencies": {
    "terser": "^5.44.1",
    "typescript": "^5.9.3",
    "vite": "^7.2.7"
  }
}
```

#### `vite.config.js`
- `root: 'src'`, `publicDir: '../public'`, `envDir: '..'`, `outDir: '../dist'`
- `@/` alias → `./src`
- Terser minify
- Firebase CDN URLs marked as external (for future phases)
- Dev server on port 3000

#### `tsconfig.json`
- `allowJs: true`, `checkJs: false` — types for IDE support only, no emit
- `@/` paths alias matching vite.config.js

#### `.env.example`
```
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=citl.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=citl
VITE_FIREBASE_STORAGE_BUCKET=citl.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
NODE_ENV=development
```

---

### Step 3 — Reorganize `src/` Directory

Move assets to new locations:

| Source (old) | Destination (new) |
|---|---|
| `src/spa/images/favicon.ico` | `public/favicon.ico` |
| `src/spa/robots.txt` | `public/robots.txt` (updated for SPA) |
| `src/spa/images/*.png` | `src/assets/images/` |
| `src/spa/assets/score_sheets/` | `src/assets/score_sheets/` |
| `src/spa/assets/yardage-table.pdf` | `src/assets/score_sheets/yardage-table.pdf` |
| `src/spa/css/style.css` | `src/styles/main.css` (cleaned) |

Delete `src/spa/` entirely after migration.

---

### Step 4 — `src/index.html` (Vite Entry Point)

Clean HTML shell — no inline handlers, no `onload=`, no `onclick=`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Central Illinois Trap League</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
</head>
<body>
  <div id="progress-container" class="progress-container">
    <div id="progress-bar" class="progress-bar"></div>
  </div>

  <nav class="topnav" id="topnav">
    <!-- logo, nav links, burger button, resources dropdown -->
    <!-- All listeners attached by navigation.js -->
  </nav>

  <div class="header"> ... </div>

  <main id="main-content" class="main">
    <!-- Router renders view content here -->
  </main>

  <footer class="footer"> ... </footer>

  <script type="module" src="/main.js"></script>
</body>
</html>
```

Key changes from old `index.html`:
- `<body onload="onLoad()">` removed
- `onclick="burgerNav()"` removed — listener attached in `navigation.js`
- `onclick="dropButton()"` removed — listener attached in `navigation.js`
- `<script src="js/scripts.js">` removed — replaced by `<script type="module" src="/main.js">`
- All page-specific content (standings tables, scorecard tables, etc.) removed — rendered by JS views

---

### Step 5 — `src/firebase-config.js` (Stub)

```js
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // ... all VITE_FIREBASE_* keys
};

export function validateFirebaseConfig() { ... }

// Dev mode: warn that Firebase is not yet configured
if (import.meta.env.DEV) {
  console.warn('Firebase not configured — running in local mode. See .env.example.');
}
```

No Firebase SDK imported. Safe to run locally without a `.env` file.

---

### Step 6 — `src/modules/router.js`

Hash-based SPA router (modeled on salmoncow):
- `register(path, handler)` — maps `#/path` to a handler function
- `navigate(path)` — sets `window.location.hash`
- `init()` — handles initial route on page load + `hashchange` listener
- `onBeforeNavigate(cb)` — guard hook (returns false to cancel)
- Default route: `#/` → home view

Routes registered:
- `#/` → `showHome()`
- `#/scorecards` → `showScorecards()`
- `#/rules` → `showRules()`
- `#/about` → `showAbout()`
- `#/downloads` → `showDownloads()`

---

### Step 7 — `src/modules/navigation.js`

Replaces all global functions from `scripts.js`:

| Old (scripts.js) | New (navigation.js) |
|---|---|
| `burgerNav()` + `onclick=` | `addEventListener('click')` on `#burger-btn` |
| `dropButton()` + `onclick=` | `addEventListener('click')` on `#dropbtn` |
| `window.onscroll = progressBar` | `window.addEventListener('scroll', updateProgressBar)` |
| `window.onclick` (close dropdown) | `document.addEventListener('click', handleClickOutside)` |

`NavigationModule` class:
- `init()` — caches elements, attaches all listeners
- `updateAuthState(user)` — no-op stub (ready for Phase 5)
- `closeDropdown()` — public method for router to call on nav
- `setActiveLink(path)` — highlights current route in nav

---

### Step 8 — `src/modules/ui.js`

Minimal DOM utilities:

```js
export function escapeHtml(str) { ... }   // textContent trick
export function showToast(type, msg) { ... }  // console.log stub for Phase 1
```

---

### Step 9 — `src/main.js`

App class (modeled on salmoncow):

```js
class App {
  async init() {
    this.navigation = new NavigationModule();
    this.router = new RouterModule();
    this.navigation.init();
    this.setupRoutes();
    this.router.init();
  }

  setupRoutes() {
    this.router.register('/', () => this.showHome());
    this.router.register('/scorecards', () => this.showScorecards());
    this.router.register('/rules', () => this.showRules());
    this.router.register('/about', () => this.showAbout());
    this.router.register('/downloads', () => this.showDownloads());
  }

  showHome()       { renderView(homeView()); }
  showScorecards() { renderView(scorecardsView()); this.initCollapsibles(); }
  showRules()      { renderView(rulesView()); }
  showAbout()      { renderView(aboutView()); }
  showDownloads()  { renderView(downloadsView()); }
}
```

View functions imported from `src/views/` (one file per page).

---

### Step 10 — View Files (`src/views/`)

Each page's content becomes a JS module that exports a function returning an HTML string.

| File | Exports | Source |
|---|---|---|
| `src/views/home.js` | `homeView()` | Migrated from `index.html` body content |
| `src/views/scorecards.js` | `scorecardsView()` | Migrated from `scorecards.html` body content |
| `src/views/rules.js` | `rulesView()` | Migrated from `rules.html` body content |
| `src/views/about.js` | `aboutView()` | Migrated from `about.html` body content |
| `src/views/downloads.js` | `downloadsView()` | Migrated from `downloads.html` body content |

**Transformations applied during migration:**
- `var` → `const`/`let`
- All inline `onclick=` handlers removed
- `window.onscroll=` → `addEventListener`
- Collapsible accordion logic moved to `navigation.js` or initialized after view render
- Fix `downloads.html` date labels (says "2024", should be "2025")
- Remove blank 9th team template from scorecards
- Remove dead CSS classes: `.cookie-footer`, `.form-popup`, `.open-button`, `.modal`

---

### Step 11 — `src/styles/main.css`

Migrated from `src/spa/css/style.css` (562 lines) with these cleanups:
- Remove dead/unused CSS: `.cookie-footer`, `.form-popup`, `.open-button`, `.form-container`, `.modal`, `.modal-content`, `.modal-close`
- Remove commented-out sticky column experiment
- Update image paths: `images/logo_full_large_white_bg.png` → `/assets/images/logo_full_large_white_bg.png`
- Keep all functional styles: nav, progress bar, tables, collapsibles, responsive breakpoints

---

### Step 12 — Verify Local Dev

```bash
nvm use 24
npm install
npm run dev  # → http://localhost:3000
```

Success criteria:
- `http://localhost:3000` loads home page with 2025 standings tables
- `#/scorecards` loads and collapsible team accordions work
- `#/rules` renders league rules
- `#/about` renders about content + Google Maps embed
- `#/downloads` renders PDF links (2025 dates correct)
- Mobile burger nav opens/closes
- Resources dropdown opens/closes, closes on outside click
- Scroll progress bar updates on scroll
- No browser console errors

---

## Future Phases (not in this branch)

| Phase | Branch | Content |
|---|---|---|
| Phase 2 | `feat/firebase-setup` | `firebase.json`, `.firebaserc`, enable Firebase services in console, wire `firebase-config.js` |
| Phase 3 | `feat/app-structure` | (merged into Phase 1 above) |
| Phase 4 | `feat/firestore-data` | Firestore schema, repositories, services, replace static view content with live data |
| Phase 5 | `feat/admin-auth` | Google sign-in, admin route, score entry UI |
| Phase 6 | `feat/cicd` | GitHub Actions workflows (deploy-production.yml, deploy-preview.yml) |
| Phase 7 | manual | DNS cutover: citl.club → Firebase Hosting, decommission AWS |
