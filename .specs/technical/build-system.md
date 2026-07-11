# Build System — citl.club

**Stack**: Vite 8.x · Terser · TypeScript (type-check only) · Node 24.x
**Last Updated**: 2026-07-10

---

## Overview

citl.club uses Vite 8.x as its build tool. The project is a TypeScript SPA with no framework;
Vite handles module bundling, asset fingerprinting, dev-server HMR, and production minification.

**Configuration file**: `vite.config.js` (project root)

---

## Project Configuration

### Directory Structure

```
citl-static/           ← project root (git repo)
├── src/               ← Vite root (index.html lives here)
│   ├── index.html     ← Vite entry point
│   ├── main.ts        ← Application entry point
│   ├── firebase-config.ts
│   ├── vite-env.d.ts
│   ├── components/    ← includes admin-tabs/
│   ├── views/
│   ├── modules/
│   ├── services/
│   ├── repositories/
│   ├── infrastructure/
│   ├── utils/
│   ├── types/
│   ├── assets/
│   └── styles/
├── public/            ← Copied verbatim to dist/ (favicon, robots.txt)
├── dist/              ← Build output (gitignored)
├── .env               ← Firebase secrets (gitignored)
├── .env.example       ← Secret template (committed)
├── vite.config.js
├── tsconfig.json
└── package.json
```

### Vite Configuration Principles

See [`vite.config.js`](../../vite.config.js) for the full configuration. Key decisions:

- **`root: 'src'`** — `index.html` lives inside `src/`, so all paths are relative to it
- **`publicDir: '../public'`** — `public/` is at the project root, not inside `src/`
- **`envDir: '..'`** — `.env` files are at the project root, not inside `src/`
- **`build.outDir: '../dist'`** — output resolves to project root `/dist/`
- **`build.minify: 'terser'`** — Terser for maximum minification (requires `terser` in devDependencies)
- **`build.sourcemap: true`** — source maps in production for error debugging
- **`build.cssCodeSplit: true`** — separate CSS chunk, enabling parallel loading
- **Rollup asset routing** — images to `assets/images/`, styles to `assets/styles/`, JS to `assets/js/`, all content-hashed
- **`envPrefix: 'VITE_'`** — only variables prefixed `VITE_` are embedded in the client bundle

### Path Alias (`@/`)

The `@/` alias maps to `src/`. Use it for all internal imports:

```ts
// ✅ Correct
import { ScoreService } from '@/services/score-service';
import { db } from '@/firebase-config';

// ❌ Wrong — relative paths break on refactor
import { ScoreService } from '../../services/score-service';
```

Note: `.ts` extensions are omitted in TypeScript imports — `allowImportingTsExtensions: true` handles resolution.

The alias is also registered in `tsconfig.json` for IDE type resolution:
```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## Environment Variables

### Configuration

All Firebase credentials live in `.env` (gitignored). Copy `.env.example` to get started:

```bash
cp .env.example .env
# Fill in values from Firebase console → Project Settings → Your apps
```

### Required Variables

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=citl-baed2
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
NODE_ENV=development
```

### Access in Source Code

```js
// ✅ Always use import.meta.env.VITE_*
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// ❌ Never — process.env is not available in Vite
const apiKey = process.env.VITE_FIREBASE_API_KEY;
```

Vite strips unused `import.meta.env.*` references at build time (tree-shaken).

### Non-`VITE_` Prefix

Variables without `VITE_` prefix are **not** embedded in the client bundle.
`NODE_ENV` is used server-side only (e.g., in `vite.config.js`).

---

## Development Workflow

```bash
# Install dependencies (first time or after package.json changes)
npm install

# Start dev server with HMR at http://localhost:3000
npm run dev

# Preview the production build locally
npm run build && npm run preview
```

### Dev Server Behavior

- HMR enabled — JS + CSS changes reflect without full reload
- Opens browser automatically on start
- Port 3000 (matches Firebase Hosting local emulator default)
- `VITE_FIREBASE_*` vars injected from `.env` at dev-server start

---

## Production Build

```bash
npm run build    # → dist/
npm run clean    # rm -rf dist/
```

### Build Output Structure

```
dist/
├── index.html                              ← SPA entry, all routes rewrite here
├── assets/
│   ├── images/
│   │   └── logo_full_large_white_bg-[hash].png
│   ├── styles/
│   │   └── index-[hash].css
│   └── js/
│       └── index-[hash].js                ← Entire app bundle
└── (assets from public/ copied verbatim)
```

### Bundle Size Targets

| Metric | Target | Current |
|--------|--------|---------|
| JS bundle (gzipped) | <250 kB | ~34 kB ✅ |
| CSS (gzipped) | <20 kB | ~2 kB ✅ |
| Total initial load | <500 kB | ~36 kB ✅ |

The Firebase SDK (`firebase` npm package) is tree-shaken — only imported modules are bundled.

### Build Optimization Notes

- Terser is the minifier (configured via `"devDependencies": { "terser": "..." }`)
- `cssCodeSplit: true` creates a separate CSS chunk, enabling parallel loading
- Source maps enabled in production (`.map` files in `dist/`) for error debugging

---

## Asset Management

### Import Patterns

```js
// Images (processed by Vite, fingerprinted)
import logoUrl from '@/assets/images/logo_full_large_white_bg.png';

// CSS (imported in JS entry, extracted to CSS chunk)
import '@/styles/main.css';

// PDF score sheets — NOT imported; served directly from public/
// Reference as: /assets/score_sheets/2025_score_sheet.pdf
```

### Static Assets (`public/`)

Files in `public/` are copied to `dist/` as-is with no processing:
- `public/favicon.ico` → `dist/favicon.ico`
- `public/robots.txt` → `dist/robots.txt`

PDF score sheets in `src/assets/score_sheets/` are processed by Vite but served under
`/assets/score_sheets/` — the path is referenced directly where the score sheets are linked.

---

## TypeScript Configuration

TypeScript is used for strict compile-time checking. Vite strips types via esbuild at build
time — tsc never emits; it only type-checks.

```json
// tsconfig.json — key settings
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "strict": true,
    "allowJs": false,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- `allowImportingTsExtensions: true` — enables `.ts` imports without `.js` suffix
- `strict: true` — all strict checks enabled
- `allowJs: false` — `.js` source files forbidden
- `noUncheckedIndexedAccess: true` — `array[i]` returns `T | undefined`
- `noEmit: true` — Vite (esbuild) handles emit

`src/vite-env.d.ts` types `import.meta.env.VITE_*` for all Firebase config variables.
Run `npx tsc --noEmit` to type-check the full project without building.

TypeScript `interface` and `type` declarations in `src/types/*.ts` provide full compile-time type safety across all layers.

---

## Firebase Hosting Integration

The Vite build output (`dist/`) is what Firebase Hosting serves. See
[.specs/technical/firebase-deployment.md](./firebase-deployment.md) for deployment details.

**SPA rewrite**: `firebase.json` rewrites all routes to `dist/index.html` so hash-based
routing (`#/about`, `#/scorecards`, etc.) works correctly.

---

## Common Issues and Solutions

### Issue: `import.meta.env.VITE_*` is `undefined` at runtime

**Cause**: `.env` file not present or variable name doesn't start with `VITE_`
**Fix**: Verify `.env` exists, copy from `.env.example`, restart dev server

### Issue: `@/` alias not resolving in IDE

**Cause**: `tsconfig.json` paths not picked up
**Fix**: Ensure `"moduleResolution": "bundler"` in tsconfig; restart TypeScript server

### Issue: PDF files not served correctly

**Cause**: PDFs in `src/assets/` get fingerprinted; path in HTML won't match
**Fix**: Reference PDFs via their Vite-processed path, or move to `public/` for static serving

### Issue: Build succeeds but Firebase Hosting returns 404

**Cause**: `dist/` was built with wrong `outDir` or SPA rewrite missing
**Fix**: Verify `vite.config.js` → `build.outDir: '../dist'`; verify `firebase.json` rewrite

### Issue: App bundle not updating in production

**Cause**: Browser caching an old bundle
**Fix**: Vite content-hashes bundles — a new build always produces new file names. Clear
Firebase Hosting cache if needed: `firebase hosting:channel:delete preview --force`

---

## Dependency Management

```bash
# Check for outdated packages
npm outdated

# Update within semver range
npm update

# Pin Node version (uses .nvmrc)
nvm use 24
```

**Key dependencies**:
| Package | Role | Version |
|---------|------|---------|
| `vite` | Build tool + dev server | `^8.x` (see `package.json`) |
| `terser` | JS minifier | `^5.x` |
| `typescript` | Type checking (IDE only) | `^5.x` |
| `firebase` | Firebase SDK | `^12.x` |

---

## References

- [Vite Documentation](https://vitejs.dev/guide/)
- [.specs/constitution.md](../constitution.md) — §III.3 Performance Standards, §IV.1 Tech Stack
