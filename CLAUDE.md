# AGENTS.md — Central Illinois Trap League (citl.club)

Agent orientation file. Read this first, then consult the documents below for all
architectural decisions, standards, and implementation guidance.

---

## What This Project Is

**citl.club** is the web presence for the Central Illinois Trap League — a hobbyist trap
shooting league in Central Illinois. The site publishes weekly standings, results, scorecards
(7 seasons, 2019–2025), league rules, and contact information.

The site is live at **https://citl.club** — a **Vite 7 SPA** hosted on **Firebase Hosting**
with **Firestore** as the live data backend. The migration from the legacy AWS S3 + raw HTML
site is complete.

**Firebase project ID**: `citl-baed2`

---

## Mandatory Reading Before Acting

Start with these documents in order:

1. **[.specs/constitution.md](.specs/constitution.md)** — Single source of truth.
   Current architectural state, quality standards, forbidden patterns, tech stack,
   and CITL-specific milestones.

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
| `src/main.ts` | App entry point, route definitions |
| `src/modules/router.ts` | Hash-based SPA router |
| `src/modules/navigation.ts` | Responsive nav, burger menu |
| `src/firebase-config.ts` | Firebase SDK init, exports `db` and `auth` |
| `src/services/score-service.ts` | Firestore reads + 1-hr cache |
| `src/modules/auth.ts` | AuthModule: Google sign-in/out, isAdmin claim check |
| `src/services/scoring-engine.ts` | Pure scoring calculations (ADR-006) |
| `src/repositories/score-repository.ts` | Raw Firestore operations |
| `src/repositories/repository-factory.ts` | Factory: Firestore backend only |
| `src/utils/yardage.ts` | Yardage lookup table + `lookupYardage()` |
| `src/utils/schedule.ts` | Schedule utilities: `nthTuesdayOfMonth`, `computeSchedule` |
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
