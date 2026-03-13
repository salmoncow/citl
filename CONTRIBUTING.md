# Contributing

## Prerequisites

- **Node 24** — use `nvm use 24` (`.nvmrc` is included)
- **Firebase CLI** — needed for deploy commands; optional for most contributors
- **Environment** — copy `.env.example` → `.env` and fill in `VITE_FIREBASE_*` vars

## Dev Workflow

```bash
npm install
npm run dev       # localhost:3000
npm test          # Vitest unit suite
npm run typecheck # tsc --noEmit (must be 0 errors)
npm run build     # production build
```

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

- [`AGENTS.md`](AGENTS.md) — architecture overview, key files, agentic framework commands
- [`.specs/constitution.md`](.specs/constitution.md) — single source of truth for project standards
- [`.prompts/meta/architectural-decision-log.md`](.prompts/meta/architectural-decision-log.md) — why key decisions were made
