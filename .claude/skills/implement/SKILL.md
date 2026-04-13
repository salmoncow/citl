---
name: implement
description: Execute a feature spec from `.specs/features/`. Triggers on phrases like "implement feature", "execute spec", "build the feature", "run the spec".
---

Execute a feature spec from `.specs/features/`.

## Arguments
If an argument is provided (e.g., `/implement scoring-engine`), look for `.specs/features/<argument>.md`.
If no argument, use the most recently modified file in `.specs/features/`.

## Process

### 1. Load the spec
Read the feature spec file. If it doesn't exist, list available specs in `.specs/features/` and ask the user which one to implement.

### 2. Load referenced context
Read `.specs/constitution.md` sections cited in "Constitutional Constraints". If the spec references project-specific files (`.specs/technical/*`, `.prompts/meta/*`), read those too.

Note: Foundational guidance (architecture, security, testing, Firebase patterns) is provided by global Claude Code skills that auto-activate. You do not need to manually read guidance files.

### 3. Implement
Follow the spec's "Implementation Plan" and "Task Breakdown" in order. For each task:
- Create or modify the specified files
- Follow the layer direction: `components → modules → services → repositories`
- Use strict TypeScript: no implicit `any`, explicit return types, `@/` absolute imports
- Use `const`/`let` only (never `var`)
- Any new async Web Component must use `.skeleton` shimmer loading (§III.3)
- Any Firestore query must use `where()` + `limit()`
- Keep files under 500 lines (hard limit 750)

### 4. Verify
After implementation is complete:
- Run `npm run typecheck` — must pass
- Run `npm run test` — must pass
- Report results

If either fails, diagnose and fix before reporting completion.

### 5. Summary
Report what was implemented, which files were created/modified, and any decisions made during implementation.
