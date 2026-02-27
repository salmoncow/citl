# Spec-Kit: Project Specifications — citl.club

Project-specific specifications, constraints, and technical configurations for citl.club
(Central Illinois Trap League).

**Note**: This directory works alongside **Prompts** (`.prompts/`) for a hybrid architecture:
- **Spec-Kit** (this directory) = Project-specific constraints, current architectural state, technical configs
- **Prompts** (`.prompts/`) = Foundational, universal patterns and best practices

See [Spec-Kit Integration Guide](../.prompts/meta/speckit-integration-guide.md) for full documentation.

---

## Directory Structure

```
.specs/
├── constitution.md          # Project constitutional spec (single source of truth)
├── technical/               # Technical configurations
│   ├── build-system.md     # Vite 7 configuration and optimization
│   ├── cicd-pipeline.md    # GitHub Actions CI/CD workflows (Phase 6)
│   └── firebase-deployment.md  # Firebase Hosting deployment process
└── features/                # Per-feature specifications (ephemeral)
    └── <feature-name>.md   # Created via /speckit-specify
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
- **build-system.md** — Vite 7 configuration, `@/` alias, Terser minification, env variables
- **cicd-pipeline.md** — GitHub Actions workflows (deferred to Phase 6, post-DNS cutover)
- **firebase-deployment.md** — Firebase Hosting setup, `citl` project, deployment commands

### Feature Specifications

Ephemeral specifications for individual features, created via `/speckit-specify`:
- User stories and acceptance criteria
- Implementation plans referencing prompts
- Task breakdowns
- Testing checklists

**Lifecycle**: Created → Implemented → Archived to `features/archive/` after merge

---

## When to Use Spec-Kit vs. Prompts

**Use Spec-Kit (`.specs/`) for:**
- Checking project-specific constraints (free tier limits, current phase)
- Understanding what has been built (§II.1 Current Architectural State in constitution)
- Creating feature specifications and implementation plans
- Reviewing technical configurations (Vite, Firebase, CI/CD)
- Checking the DNS cutover checklist (§VII.2)

**Use Prompts (`.prompts/`) for:**
- Learning foundational architectural patterns (SOLID, modularity, DRY)
- Understanding universal security/testing principles
- Implementing Firebase SDK features (SDK patterns, best practices)
- Making strategic decisions (architectural evolution, platform selection)

---

## Feature Development Workflow

```
1. /speckit-constitution
   ↓ Read project constraints and current architectural state
2. /speckit-specify <feature-name>
   ↓ Create feature spec (references constitution + prompts)
3. /speckit-plan
   ↓ Design implementation (applies prompt patterns)
4. /speckit-tasks
   ↓ Break down work into tasks
5. /speckit-implement
   ↓ Execute implementation (follows constitutional + prompt guidance)
6. Git commit with constitutional references
   ↓ Cite constitutional compliance + prompt guidance
```

---

## Cross-References

- [Constitution](./constitution.md) — CITL project constitutional spec
- [Spec-Kit Integration Guide](../.prompts/meta/speckit-integration-guide.md) — Hybrid architecture docs
- [AGENTS.md](../AGENTS.md) — Agent orientation and quick-start
- [Prompts Library](../.prompts/README.md) — Foundational patterns
- [Architectural Decision Log](../.prompts/meta/architectural-decision-log.md) — Historical decisions
- [Architectural Evolution Strategy](../.prompts/meta/architectural-evolution-strategy.md) — Phase transition framework

---

**Maintained By**: Project lead
**Review Frequency**: Quarterly (with architectural review)
**Last Updated**: 2026-02-27
