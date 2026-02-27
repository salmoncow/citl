# Development Guide

## Prerequisites

- **Node.js 24.x** — pin with [nvm](https://github.com/nvm-sh/nvm): `nvm use` (reads `.nvmrc`)
- **Firebase CLI** — `npm install -g firebase-tools`
- A modern web browser

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in Firebase config values
cp .env.example .env
# Edit .env — see Environment Variables section below

# 3. Start the dev server
npm run dev
```

Opens at **http://localhost:3000** with Hot Module Replacement (HMR).

---

## Build Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR at localhost:3000 |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run clean` | Remove `dist/` |
| `npm run deploy` | Build and deploy to Firebase Hosting (production) |
| `npm run deploy:preview` | Build and deploy to a Firebase preview channel (7-day expiry) |

---

## Build Process

### Development (`npm run dev`)

- Instant server start using native ES modules — no bundling step
- Hot Module Replacement: changes are reflected in the browser immediately
- Vite resolves `@/` path aliases to `src/`
- `.env` is loaded automatically; `VITE_*` variables are exposed to client code

### Production (`npm run build`)

- Bundles and tree-shakes all modules
- Minifies JavaScript with Terser
- Content-hashes all asset filenames for long-term cache busting
- Generates source maps for debugging
- Outputs to `dist/` (gitignored)

---

## Environment Variables

All Firebase configuration is loaded from `.env` at the project root. This file is gitignored — never commit it.

```bash
cp .env.example .env
```

Fill in the values from **Firebase console → Project Settings → Your apps**:

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

Access in source code via `import.meta.env.VITE_*`. Never use `process.env` directly.

> **Note:** During Phase 1 (current), the Firebase SDK is not yet wired in. Running `npm run dev`
> without a `.env` file will show a `console.warn` in the browser; all 5 routes still function normally.

---

## Deployment

### Firebase CLI Setup

```bash
firebase login
firebase use citl
```

### Deploy to Production

```bash
npm run deploy
# Equivalent to: npm run build && firebase deploy --only hosting
```

Deploys the contents of `dist/` to Firebase Hosting at `citl.club`.

### Deploy a Preview Channel

```bash
npm run deploy:preview
# Equivalent to: npm run build && firebase hosting:channel:deploy preview
```

Creates a temporary URL (expires in 7 days) for sharing and review before pushing to production. The URL is printed to the console after the command completes.

---

## Project Structure

```
citl-static/
├── src/                        # Vite root (vite.config.js: root: 'src')
│   ├── index.html              # HTML entry point — zero inline handlers
│   ├── main.js                 # App class: registers routes, wires modules
│   ├── firebase-config.js      # Firebase SDK init (reads VITE_* env vars)
│   │
│   ├── views/                  # One JS module per page — returns HTML string
│   │   ├── home.js             # Standings, weekly results, trophies, season kickoff
│   │   ├── scorecards.js       # Per-team collapsible scorecard tables
│   │   ├── rules.js            # League rules
│   │   ├── about.js            # About + Google Maps embed
│   │   └── downloads.js        # PDF score sheets and yardage table links
│   │
│   ├── modules/                # Orchestration — wires views + services
│   │   ├── router.js           # Hash-based SPA router (#/home, #/scorecards, etc.)
│   │   ├── navigation.js       # Burger nav, resources dropdown, scroll progress bar
│   │   └── ui.js               # Shared DOM utilities (escapeHtml, showToast)
│   │
│   ├── services/               # Business logic (Phase 4+)
│   ├── repositories/           # Firestore data access (Phase 4+)
│   ├── components/             # Web Components (Phase 4+)
│   ├── types/                  # JSDoc @typedef type definitions (Phase 4+)
│   │
│   ├── styles/
│   │   └── main.css            # Global styles (nav, tables, collapsibles, responsive)
│   │
│   └── assets/
│       ├── images/             # Logos, trophy images, season calendar PNGs
│       └── score_sheets/       # PDF score sheets (2020–2025) + yardage-table.pdf
│
├── public/                     # Static assets — copied to dist/ as-is
│   ├── favicon.ico
│   └── robots.txt
│
├── dist/                       # Build output — gitignored
├── .env                        # Firebase config secrets — gitignored, never commit
├── .env.example                # Template for required env vars — commit this
├── firebase.json               # Firebase Hosting config (Phase 2+)
├── .firebaserc                 # Firebase project binding: citl (Phase 2+)
├── vite.config.js              # Vite config (root, alias, Terser, port 3000)
├── tsconfig.json               # TypeScript config (allowJs: true, @/ paths)
├── package.json
├── AGENTS.md                   # AI agent guidance — architectural source of truth
├── CONTRIBUTING.md             # Git workflow and commit conventions
└── PLAN.md                     # Migration plan and phase checklist
```

---

## Architecture Overview

The application is a vanilla JS SPA with four logical layers. Dependencies flow **inward only**:

```
views → modules → services → repositories
```

| Layer | Location | Responsibility |
|---|---|---|
| Views | `src/views/` | Return HTML strings; no business logic |
| Modules | `src/modules/` | Orchestrate views and services; manage app state |
| Services | `src/services/` | Business logic, validation, caching, Result pattern |
| Repositories | `src/repositories/` | Firestore reads/writes; never imported by views |

The router (`src/modules/router.js`) handles hash-based navigation (`#/`, `#/scorecards`, etc.) and renders view output into `<div id="main-content">`.

For full architectural detail — including the Result error pattern, Firestore quota rules, JSDoc type conventions, and forbidden patterns — see [AGENTS.md](AGENTS.md).
