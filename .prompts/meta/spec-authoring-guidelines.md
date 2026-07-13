# Spec Authoring Guidelines

**Purpose**: Rules for writing specs, prompts, **and agent files** that stay accurate and
maintainable over time. The same rule applies to `.claude/agents/*` and `.claude/skills/*`:
agents reference the source of truth, they never restate rules — a restated rule drifts from
the spec it copied (e.g. the `@scoring` agent must point at `.specs/domain/scoring-rules.md`, not summarize it).

---

## Core Rule: Reference, Don't Reproduce

**Never copy code or configuration from project files into specs.**

If a file exists in the repository, the spec should reference it — not reproduce it.
Copied content creates two sources of truth. When the source file changes, the spec silently
becomes wrong.

```
✅ See [`firebase.json`](../../firebase.json) for the full hosting configuration.
✅ See [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

❌ Copy-pasting the firebase.json content into the spec
❌ Reproducing workflow YAML in a technical spec
```

---

## What Belongs in a Spec vs. a Source File

| Content Type | Where it lives |
|---|---|
| The actual configuration | The config file |
| Why the config is structured this way | The spec |
| The workflow steps | The workflow file |
| What each workflow does and why | The spec |
| Schema definitions | The schema file or types |
| What the schema means for the domain | The spec |

---

## When a Code Block Is Acceptable

A code block in a spec is acceptable only when it **cannot go stale** because it doesn't
mirror any source file:

- **Illustrative patterns** — short snippets showing a concept (correct import style,
  forbidden anti-pattern), not taken from a specific file
- **Usage examples** — how to call a CLI command, how to write a query
- **Output examples** — what a command prints, what a data structure looks like at runtime
- **Explanatory excerpts** — a single key line from a config file with a comment explaining
  *why* it exists, clearly labelled as an excerpt not the full file

When in doubt, ask: *"If the source file changes, does this spec block need to change too?"*
If yes — replace the block with a reference.

---

## How to Reference Project Files

Use a relative Markdown link from the spec file's location:

```markdown
See [`vite.config.ts`](../../vite.config.ts) for the full configuration.
See [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).
Key settings are documented in [`tsconfig.json`](../../tsconfig.json).
```

Two hard rules (adopted 2026-07, deep-review F-58):

- **Never link paths outside the repo.** A machine-local path (`/Users/...`,
  `~/.claude/...`) is unresolvable on every other checkout; if the content matters,
  copy it into the repo and link that.
- **No `file.ts:22`-style link targets.** Line-suffixed targets don't resolve as
  files; write the location as a plain code span (`` `src/foo.ts:22` ``) instead.

For config files where the *decisions* need explanation, describe the key settings in
prose and link to the file:

```markdown
**`build.minify: 'terser'`** — Terser produces smaller output than esbuild for this
bundle size. Requires `terser` in devDependencies (esbuild is the default).

See [`vite.config.ts`](../../vite.config.ts) for the full configuration.
```

---

## Checklist Before Adding a Code Block to a Spec

- [ ] Does this code exist in a project file? → **Reference the file instead**
- [ ] Is this an exact copy of config? → **Reference the file instead**
- [ ] Is this a full workflow, schema, or multi-line config? → **Reference the file instead**
- [ ] Is this a short illustrative pattern that has no source file? → **OK to include**
- [ ] Is this prose-like explanation using code notation? → **OK to include**

---

## References

- [Constitution §VII](../../.specs/constitution.md) — what belongs in the constitution vs. specs vs. global skills
- [.specs/README.md](../../.specs/README.md) — spec-kit layout and feature-spec conventions
