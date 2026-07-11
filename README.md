# Central Illinois Trap League

The official website for the Central Illinois Trap League — **[citl.club](https://citl.club)**

## Tech Stack

- **Build Tool**: Vite 8.x (HMR, optimized builds, Terser minification)
- **JavaScript**: TypeScript (strict mode, no emit — Vite strips types via esbuild)
- **Styling**: CSS design system — two-layer custom properties; system-aware dark/light mode
- **Hosting**: Firebase Hosting (CDN, automatic HTTPS, SPA routing)
- **Data**: Firestore
- **Auth**: Firebase Authentication — admin users only

## Quick Start

```bash
npm install
npm run dev
```

Opens at http://localhost:3000

## Documentation

See [CLAUDE.md](CLAUDE.md) for architecture, dev commands, and contribution guidelines.
