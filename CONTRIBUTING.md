# Contributing to citl-static

This document covers the git workflow, commit conventions, and architectural guidelines for the citl-static project.

## Quick Start

```bash
git clone https://github.com/tdeknecht/citl-static.git
cd citl-static
npm install
npm run dev
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for full setup instructions including environment variables and Firebase CLI setup.

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b <type>/<description>
```

Branch naming format: `<type>/<description>`

| Type | Use for |
|---|---|
| `feat/` | New feature or page content |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring, no behavior change |
| `chore/` | Tooling, dependencies, config |
| `ci/` | CI/CD workflow changes |

**Rules:**
- Lowercase only, hyphens only (no underscores or spaces)
- Be descriptive: `feat/week-16-scores`, `fix/nav-dropdown-close`, `chore/update-vite`

### 2. Make Changes Following Architectural Guidance

Before making changes, read [AGENTS.md](AGENTS.md). It is the single source of truth for:

- Layer responsibilities (`components → modules → services → repositories`)
- JavaScript code style (no `var`, no inline handlers, ES6+ modules only)
- Firebase/Firestore query rules and quota guidelines
- Naming conventions (files, functions, constants, CSS custom properties)
- Error handling (Result pattern)
- Forbidden patterns

Key principles:
- No `var` — always `const` or `let`
- No inline event handlers in HTML — attach listeners in JS
- No `innerHTML` with unsanitized content — use `textContent` or `escapeHtml()`
- No direct Firestore collection reads without `where()` + `limit()`
- Keep files under 500 lines; split at 750

### 3. Commit Using Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>
```

**Types:**

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Restructuring, no behavior change |
| `test` | Adding or updating tests |
| `chore` | Maintenance, deps, config |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

**Examples from this project's domain:**

```bash
git commit -m "feat(scores): add week 16 standings table"
git commit -m "fix(nav): close dropdown on Escape key"
git commit -m "feat(auth): add Google sign-in admin flow"
git commit -m "refactor(router): extract route guard into separate function"
git commit -m "chore: upgrade vite to 7.3"
git commit -m "docs: update DEVELOPMENT.md deployment section"
git commit -m "ci: add Firebase preview channel deploy on PR"
```

**Guidelines:**
- Subject line: 50 characters or less
- Use imperative mood: "add" not "added", "fix" not "fixed"
- No period at the end of the subject line
- Use the commit body to explain *why*, not just *what*

### 4. Open a Pull Request

Push your branch and open a PR via GitHub:

```bash
git push -u origin <branch-name>
```

Every PR description must include three sections:

```
## Summary
Brief description of what changed and why.

## Changes
- Bullet list of specific changes

## Testing
- What was tested and how (e.g., npm run build passes, manual smoke test of all 5 routes)
```

---

## Pull Request Rules

- All changes to `main` must go through a Pull Request — no direct commits
- No force pushes to `main`
- Squash trivial fixup commits before opening a PR

---

## Architectural Guidance

**[AGENTS.md](AGENTS.md)** is the authoritative reference for all architectural decisions in this project. Consult it before:

- Adding a new module, service, or repository
- Making Firebase/Firestore queries
- Designing data models
- Implementing auth or admin features
- Writing security rules

The dependency flow is strict and must not be violated:

```
components → modules → services → repositories
```

A repository must never import from a service. A component must never call Firestore directly.

---

## Getting Help

- **Setup and build:** [DEVELOPMENT.md](DEVELOPMENT.md)
- **Architecture and code style:** [AGENTS.md](AGENTS.md)
- **Migration roadmap:** [PLAN.md](PLAN.md)
- **Issues:** Open a GitHub issue with steps to reproduce
