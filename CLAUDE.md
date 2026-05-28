# CLAUDE.md — Central Illinois Trap League (citl.club)

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

2. **[.prompts/meta/architectural-decision-log.md](.prompts/meta/architectural-decision-log.md)**
   — Why key decisions were made (AWS → Firebase, Vite SPA, JSON scorecards, repository pattern).

---

## Quick Reference

### Dev Commands

```bash
nvm use 24                           # Node 24 required (.nvmrc)
npm install                          # Install deps
npm run dev                          # Dev server → http://localhost:3000 (reuses existing .emulator-data)
npm run dev:seeded                   # Same, but seeds the emulator first (fresh-checkout flow)
npm run seed:emulator                # Seed running emulators (also: -- clear | -- status)
npm run build                        # Production build → dist/
npm run preview                      # Serve dist/ locally
npm run deploy                       # build + firebase deploy --only hosting
npm run deploy:preview               # build + Firebase preview channel (7-day URL)
```

> **Fresh checkout?** `.emulator-data/` is git-ignored, so `npm run dev` starts an empty
> Firestore. Use `npm run dev:seeded` once to populate it. See
> [CONTRIBUTING.md](CONTRIBUTING.md#seeding-the-emulator) for details.

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

This project uses a spec-kit framework with Claude Code agents, skills, hooks, and global skills:

| System | Directory | Contains |
|--------|-----------|---------|
| **Spec-Kit** | `.specs/` | CITL-specific constitution, current phase state, technical configs |
| **Meta** | `.prompts/meta/` | Project-specific strategic frameworks (evolution strategy, decision log, gap protocol) |
| **Agents** | `.claude/agents/` | Specialized sub-agents for complex workflows |
| **Skills** | `.claude/skills/` | Slash-command skills for repeatable actions |
| **Hooks** | `.claude/settings.json` | Automated guardrails (constitutional pattern checks) |
| **Global Skills** | `~/.claude/skills/` | Universal guidance (architecture, security, testing, Firebase) — auto-activated |

### Custom Agents

| Agent | Invoke with | Purpose |
|-------|-------------|---------|
| **speckit** | `@speckit` | Full feature specification: reads constitution, creates spec in `.specs/features/`, produces implementation plan + task breakdown |
| **reviewer** | `@reviewer` | Code review: audits branch changes against 12 constitutional checks, drafts PR description |
| **scoring** | `@scoring` | Scoring engine expert: traces calculations, validates tests against business rules, identifies edge case gaps |

### Slash Commands (Skills)

| Command | Action |
|---------|--------|
| `/constitution` | Project state dashboard: architectural state, evolution triggers, forbidden patterns |
| `/implement <feature>` | Execute a feature spec from `.specs/features/` with constitutional compliance |
| `/check` | Quick pre-commit compliance check: forbidden patterns, typecheck, tests |
| `/deploy-preview` | Build + typecheck + test + Firebase preview channel deploy |

### Automated Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| Constitutional check | After any file edit/write | Checks `.ts` files for `var`, inline handlers, unfiltered Firestore reads, file size >750 lines |

### Feature Development Workflow

1. **Orient**: Run `/constitution` to see current project state
2. **Specify**: Invoke `@speckit` with the feature request — creates spec + plan + tasks
3. **Implement**: Run `/implement <feature>` to execute the spec
4. **Review**: Invoke `@reviewer` to audit changes and draft PR
5. **Check**: Run `/check` before committing for a quick compliance pass
6. **Deploy**: Run `/deploy-preview` to test on a preview channel

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
