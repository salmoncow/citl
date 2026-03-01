# Central Illinois Trap League

The official website for the Central Illinois Trap League — **[citl.club](https://citl.club)**

## Tech Stack

- **Build Tool**: Vite 7.x (HMR, optimized builds, Terser minification)
- **JavaScript**: TypeScript (strict mode, no emit — Vite strips types via esbuild)
- **Styling**: CSS design system — two-layer custom properties; system-aware dark/light mode
- **Hosting**: Firebase Hosting (CDN, automatic HTTPS, SPA routing)
- **Data**: Firestore (Phase 4+)
- **Auth**: Firebase Authentication — admin users only (Phase 5+)

## Quick Start

```bash
npm install
npm run dev
```

Opens at http://localhost:3000

## Documentation

- [DEVELOPMENT.md](DEVELOPMENT.md) — Setup, build process, environment variables, deployment
- [CONTRIBUTING.md](CONTRIBUTING.md) — Git workflow, branch naming, commit conventions, PR guidelines
- [AGENTS.md](AGENTS.md) — Architectural source of truth for AI-assisted development
- [PLAN.md](PLAN.md) — AWS → Firebase migration plan and phase checklist
