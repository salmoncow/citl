# Spec-Kit: Project Specifications — citl.club

Project-specific specifications, constraints, and technical configurations for citl.club
(Central Illinois Trap League). This is an **index** — it points to the canonical documents
rather than restating them.

**Note**: This directory works alongside the **Prompts** framework (`.prompts/meta/`) for a
hybrid architecture:
- **Spec-Kit** (this directory) = Project-specific constraints, current architectural state, technical configs
- **Prompts** (`.prompts/meta/`) = Strategic frameworks (ADR log, evolution strategy) + spec-authoring guidelines

The [constitution](./constitution.md) is the source of truth for project rules; [WORKFLOW-GUIDE.md](../WORKFLOW-GUIDE.md) and [CLAUDE.md](../CLAUDE.md) document the day-to-day agent/skill workflow.

---

## Directory Structure

```
.specs/
├── constitution.md              # Project constitutional spec (single source of truth)
├── technical/                   # Technical configurations
│   ├── build-system.md          # Vite 8 configuration and optimization
│   ├── cicd-pipeline.md         # GitHub Actions CI/CD workflows
│   ├── firebase-deployment.md   # Firebase Hosting deployment process
│   └── firestore-schema.md      # Firestore collection/document schema
├── features/                    # Per-feature specifications
│   ├── <feature-name>.md        # Small feature: flat single-file spec
│   ├── NNN-name/                # Large feature: spec directory
│   │   ├── spec.md              #   User stories + acceptance criteria
│   │   └── tasks.md             #   Task breakdown
│   └── archive/                 # Shipped specs moved here after merge
└── reviews/                     # Review artifacts
```

### Constitution

`constitution.md` is the **single source of truth** for:
- Core principles (progressive complexity, platform simplification, AI-assisted evolution)
- Current architectural state and phases for all domains
- Quality standards (testing coverage, security, performance, code quality)
- Technology stack decisions (approved technologies and forbidden patterns)
- Development workflows and cost constraints
- CITL-specific migration milestones (AWS → Firebase cutover sequence)

**Always consult the constitution before starting new features or making architectural decisions.**

### Technical Specifications

Project-specific technical configurations:
- **build-system.md** — Vite 8 configuration, `@/` alias, minification, env variables
- **cicd-pipeline.md** — GitHub Actions CI/CD workflows
- **firebase-deployment.md** — Firebase Hosting setup, `citl-baed2` project, deployment commands
- **firestore-schema.md** — Firestore collection/document schema

### Feature Specifications

Specs are authored by the **`@speckit` agent** (`.claude/agents/speckit.md`). The repo uses a
**hybrid convention** based on feature size:

- **Small feature** → a flat single file: `.specs/features/<feature-name>.md`
  (e.g. `scoring-engine.md`).
- **Large feature** → a numbered directory: `.specs/features/NNN-name/` containing
  `spec.md` (user stories + acceptance criteria) and `tasks.md` (task breakdown)
  (e.g. `002-multi-user-rbac/`).

**Lifecycle**: Created → Implemented → moved to `features/archive/` after the PR merges.

---

## When to Use Spec-Kit vs. Prompts

**Use Spec-Kit (`.specs/`) for:**
- Checking project-specific constraints (free tier limits, current phase)
- Understanding what has been built (Current Architectural State in constitution)
- Creating feature specifications and implementation plans
- Reviewing technical configurations (Vite, Firebase, CI/CD, Firestore schema)

**Use Prompts (`.prompts/meta/`) for:**
- Learning foundational architectural patterns (SOLID, modularity, DRY)
- Understanding universal security/testing principles
- Making strategic decisions (architectural evolution, platform selection)

---

## Feature Development Workflow

The workflow is driven by **agents** and **slash-command skills** — there are no `speckit-*`
slash commands. In order:

1. **`@speckit`** — author the feature spec (reads the constitution, writes to `.specs/features/`)
2. **`/implement <feature>`** — execute the spec (runs typecheck + tests when done)
3. **`@reviewer`** — audit the branch against the constitutional checks and draft the PR description
4. **`/check`** — quick pre-commit compliance pass before committing
5. **`/deploy-preview`** — build + typecheck + test, then deploy a 7-day Firebase preview channel

Canonical descriptions of this workflow live in:
- [WORKFLOW-GUIDE.md](../WORKFLOW-GUIDE.md) — hands-on cheat sheet with example prompts
- [CLAUDE.md](../CLAUDE.md) — "Agentic Framework" and "Feature Development Workflow" sections

---

## Cross-References

- [Constitution](./constitution.md) — CITL project constitutional spec
- [WORKFLOW-GUIDE.md](../WORKFLOW-GUIDE.md) — Hands-on agent/skill workflow cheat sheet
- [CLAUDE.md](../CLAUDE.md) — Agent orientation and quick-start
- [Spec-Authoring Guidelines](../.prompts/meta/spec-authoring-guidelines.md) — Reference the source of truth; never restate rules
- [Architectural Decision Log](../.prompts/meta/architectural-decision-log.md) — Historical decisions
- [Architectural Evolution Strategy](../.prompts/meta/architectural-evolution-strategy.md) — Evolution triggers and decision framework

---

**Maintained By**: Project lead
**Review Frequency**: Quarterly (with architectural review)
**Last Updated**: 2026-07-10
