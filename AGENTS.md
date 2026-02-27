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

**Firebase project ID**: `citl`

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
| `src/repositories/score-repository.js` | Raw Firestore operations |
| `src/repositories/repository-factory.js` | Factory: `firestore` or `stub` backend |
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

### Phase 4 — Firestore Data Layer (partial)
- [x] Firestore data model designed (see ADR-004 + constitution §II.5)
- [x] `src/types/score.js`, `src/types/shooter.js`, `src/types/season.js`
- [x] `src/repositories/score-repository.js`
- [x] `src/repositories/repository-factory.js`
- [x] `src/services/score-service.js`
- [x] `src/services/standings-service.js`
- [ ] Enable Firestore in console (production mode, `us-east1`) *(manual)*
- [ ] `src/components/standings-table.js` Web Component
- [ ] `firestore.rules` — public read, admin-write
- [ ] Test security rules in Firebase Local Emulator

### Phase 5 — Admin Auth
- [ ] `src/modules/auth.js` — Google sign-in, auth state
- [ ] `#/admin` route with auth guard
- [ ] `src/components/admin-panel.js` — score entry UI
- [ ] Set `admin: true` custom claim on admin user

### Phase 6 — CI/CD *(deferred until after DNS cutover)*
- [ ] `.github/workflows/deploy-production.yml`
- [ ] `.github/workflows/deploy-preview.yml`
- [ ] GitHub Actions secrets: `FIREBASE_SERVICE_ACCOUNT`, all `VITE_FIREBASE_*`
- [ ] Decommission AWS/Terraform pipeline

### Phase 7 — DNS Cutover
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
