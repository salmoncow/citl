# Contributing

## Prerequisites

- **Node 24** — use `nvm use 24` (`.nvmrc` is included)
- **Firebase CLI** — needed for deploy commands; optional for most contributors
- **Environment** — copy `.env.example` → `.env` and fill in `VITE_FIREBASE_*` vars

## Dev Workflow

```bash
npm install
npm run dev       # localhost:3000 (uses existing .emulator-data)
npm test          # Vitest unit suite
npm run typecheck # tsc --noEmit (must be 0 errors)
npm run build     # production build
```

## Seeding the emulator

A fresh checkout has no `.emulator-data/` (it's git-ignored), so `npm run dev` will
start an empty Firestore — every view that reads scorecards, standings, or
announcements will render blank.

To get a realistic dataset (2024 season in progress + 2025 season complete, four
teams, three test accounts) running on the local emulator:

```bash
npm run dev:seeded        # one-shot: boot emulators, seed, start Vite
```

Or, if you prefer running emulators in their own terminal:

```bash
npm run emulators         # terminal 1 — keep alive
npm run seed:emulator     # terminal 2 — populates and exits
npm run dev               # terminal 3 — Vite against the seeded emulators
```

The seed script is idempotent — re-running it clears the seeded collections
(`users`, `audit`, `announcements`, `config`, `seasons`) plus the three
`seed-*@citl.test` auth users, then rewrites them. Other emulator state (e.g.
docs you've created by hand while clicking around) is left alone but will get
swept by `--export-on-exit` if you let the emulator persist on shutdown.

Test sign-in (emulator accepts any password):

| Role  | Email              |
| ----- | ------------------ |
| owner | owner@citl.test    |
| admin | admin@citl.test    |
| user  | user@citl.test     |

Other subcommands:

```bash
npm run seed:emulator -- clear    # wipe seeded collections only
npm run seed:emulator -- status   # print doc counts
```

The script refuses to run without `FIREBASE_*_EMULATOR_HOST` set — it cannot
touch production data.

## Contribution Guidelines

- Branch from `main`; open PRs against `main`
- No direct commits to `main`
- Commit message format: `type(scope): description` (feat, fix, docs, refactor, chore, ci)
- Business logic belongs in `src/services/scoring-engine.ts` — never reinlined elsewhere
- Schedule logic belongs in `src/utils/schedule.ts` — same rule
- Full TypeScript: `allowJs: false`, `strict: true` — no `any`, no type suppressions
- Every pure function exported from `scoring-engine.ts` or `schedule.ts` needs a unit test
- Layer order: components → modules → services → repositories (never reverse)
- Async Web Components must show shimmer skeleton placeholders while loading — never `<p>Loading…</p>` (see §III.3 of the constitution for the pattern and CSS utilities)

## Further Reading

- [`CLAUDE.md`](CLAUDE.md) — architecture overview, key files, agentic framework commands
- [`.specs/constitution.md`](.specs/constitution.md) — single source of truth for project standards
- [`.prompts/meta/architectural-decision-log.md`](.prompts/meta/architectural-decision-log.md) — why key decisions were made
