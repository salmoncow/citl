# Spec-Kit Integration Guide

**Status**: Meta-Guidance
**Created**: 2025-12-11
**Purpose**: Document the integration between spec-kit (project specifications) and `.prompts/` (foundational patterns)

---

## Overview

This project uses a **hybrid guidance architecture** combining:
1. **Spec-Kit** (`.specs/`) - Project-specific, executable specifications
2. **Prompts** (`.prompts/`) - Foundational, universal patterns

**Philosophy**: Spec-kit defines **what this project must do**, prompts define **how good software is built**.

---

## I. System Architecture

### I.1 Clear Boundaries

**Spec-Kit (`.specs/`)** contains:
- ✅ Project-specific constraints (free tier limit, 2-platform max)
- ✅ Current architectural state per domain
- ✅ Technology stack decisions (Vanilla WC, Firebase, Vite)
- ✅ Quality thresholds for THIS project (80% coverage, <3s load time)
- ✅ Per-feature specifications (requirements, plans, tasks)
- ✅ Technical configurations (Vite config, CI/CD workflows)

**Prompts (`.prompts/`)** contains:
- ✅ Foundational architectural patterns (SOLID, modularity, DRY)
- ✅ Universal security principles (auth/authz, input validation)
- ✅ Platform-agnostic best practices (testing pyramid, FinOps)
- ✅ Firebase implementation guidance (SDK patterns, security rules)
- ✅ Strategic frameworks (architectural evolution, platform selection)

### I.2 File Structure

```
citl-static/
├── .specs/                          # Spec-Kit (Project-Specific)
│   ├── constitution.md             # Constitutional spec (single source of truth)
│   ├── technical/
│   │   ├── build-system.md        # Vite configuration
│   │   ├── cicd-pipeline.md       # GitHub Actions workflows
│   │   └── firebase-deployment.md # Firebase Hosting deployment
│   └── features/                   # Per-feature specifications (ephemeral)
│       └── <feature-name>.md      # Created via /speckit-specify
│
├── .prompts/                        # Prompts (Foundational Patterns)
│   ├── core/                       # Platform-agnostic principles
│   │   ├── architecture/           # Code structure, modularity, extensibility
│   │   ├── security/               # Auth, data protection, API security
│   │   ├── testing/                # Testing pyramid, strategies
│   │   ├── development/            # Git workflow, asset management
│   │   └── operations/             # Monitoring, budget, platform selection
│   ├── platforms/firebase/         # Firebase-specific implementations
│   │   ├── firebase-best-practices.md
│   │   ├── firebase-security.md
│   │   └── firebase-testing.md
│   └── meta/                       # Library maintenance and protocols
│
├── .claude/commands/                # Spec-Kit Slash Commands
│   ├── speckit-constitution.md
│   ├── speckit-specify.md
│   ├── speckit-plan.md
│   ├── speckit-tasks.md
│   └── speckit-implement.md
│
└── CLAUDE.md                        # Entry point with decision framework
```

---

## II. When to Use What

### II.1 Decision Tree

**Starting a new feature?**
→ `/speckit-specify` (creates `.specs/features/<feature>.md`)
→ References constitution + prompts

**Checking project constraints?**
→ `/speckit-constitution` (reads `.specs/constitution.md`)

**Understanding architectural patterns?**
→ Read `.prompts/core/architecture/` files

**Implementing Firebase integration?**
→ Read `.prompts/platforms/firebase/firebase-best-practices.md`

**Wondering if you should evolve architecture?**
→ Read `.prompts/meta/architectural-evolution-strategy.md`
→ Check decision triggers
→ If triggers met: Create spec via `/speckit-specify`

**Need to understand Git workflow?**
→ Read `.prompts/core/development/git-best-practices.md`

### II.2 Workflow Integration

**Feature Development Workflow**:
```
1. /speckit-constitution
   ↓ (read project constraints)
2. /speckit-specify <feature-name>
   ↓ (create requirement spec, references constitution + prompts)
3. /speckit-plan
   ↓ (design implementation, applies prompt patterns)
4. /speckit-tasks
   ↓ (break down work)
5. /speckit-implement
   ↓ (execute, following constitutional + prompt guidance)
6. Git commit (conventional format from prompts/core/development/git-best-practices.md)
7. Create PR (citing constitutional compliance + prompt references)
```

**Architectural Evolution Workflow**:
```
1. Read .prompts/meta/architectural-decision-log.md
   ↓ (check current phase)
2. Read .prompts/meta/architectural-evolution-strategy.md
   ↓ (check decision triggers)
3. If triggers met:
   a. /speckit-specify architectural-evolution-<domain>
   b. Document in architectural-decision-log.md
   c. Update .specs/constitution.md with new phase
4. If triggers NOT met:
   Stay in current phase, cite unmet triggers
```

---

## III. Cross-Reference Conventions

### III.1 In Constitutional Spec

**Pattern**: Distill project-specific constraints, reference prompts for details

```markdown
## II.3 Modularity Requirements

**Principles** (distilled from modular-architecture-principles.md):
1. Single Responsibility: Each module has one clear purpose
2. Clear Interfaces: Module contracts documented and stable

**Reference**: [.prompts/core/architecture/modular-architecture-principles.md]

For detailed patterns and examples, see modular-architecture-principles.md.
```

### III.2 In Feature Specs

**Pattern**: Cite constitutional section + prompt pattern

```markdown
## Architecture Approach

**Constitutional Constraints**: §II.3 Modularity Requirements
**Pattern Reference**: .prompts/core/architecture/modular-architecture-principles.md

This feature follows single-responsibility principle (one service module).
Dependency direction: Component → Service → Firebase Infrastructure.
```

### III.3 In Prompts

**Pattern**: Reference constitution for project application

```markdown
---
**Project Application**: See `.specs/constitution.md` for project-specific constraints and current architectural phase.
```

### III.4 In Git Commits

**Pattern**: Cite both constitutional compliance + prompt guidance

```markdown
git commit -m "feat: implement user profile data layer

Constitutional compliance:
- §III.2: Input validation on all boundaries
- §III.3: Firestore query uses limit(10)
- §VI.2: 1-hour cache TTL for free tier

Guidance references:
- .prompts/platforms/firebase/firebase-best-practices.md - Query patterns
- .prompts/core/security/security-principles.md - Input validation
- .specs/constitution.md §VI.2 - Caching requirements"
```

---

## IV. Content Organization Principles

### IV.1 What Belongs in Constitution

**Include**:
- Current architectural phase for each domain (UI, Security, Data, etc.)
- Project-specific quality thresholds (80% coverage, <3s load time)
- Technology stack decisions (Vanilla WC, Firebase, Vite, GitHub Actions)
- Forbidden patterns specific to this project (Firebase anti-patterns)
- Current team size, component count, module count (metrics)
- Cost constraints (Firebase free tier: 50K reads/day, 20K writes/day)

**Exclude**:
- Detailed implementation patterns (those go in prompts)
- Historical decisions (those go in architectural-decision-log.md)
- Universal principles (those go in .prompts/core/)
- Platform tutorials (those go in .prompts/platforms/)

### IV.2 What Belongs in Prompts

**Include**:
- Foundational patterns applicable to ANY project
- Universal best practices (SOLID, DRY, testing pyramid)
- Platform implementation guidance (Firebase SDK patterns)
- Strategic frameworks (evolution strategy, platform selection)
- Examples and code snippets illustrating patterns

**Exclude**:
- Project-specific constraints (those go in constitution)
- Current architectural state (those go in constitution)
- Per-feature requirements (those go in .specs/features/)
- Project-specific configurations (those go in .specs/technical/)

### IV.3 What Belongs in Feature Specs

**Include** (per feature, ephemeral):
- User stories and acceptance criteria
- Feature-specific requirements
- Implementation plan referencing prompts
- Task breakdown
- Testing checklist

**Lifecycle**: Created → Implemented → Archived to `.specs/features/archive/`

**Exclude**:
- Long-lived documentation (goes in README)
- Reusable patterns (goes in prompts)
- Project constraints (goes in constitution)

---

## V. Avoiding Duplication

### V.1 Duplication Detection

**Quarterly Review** (with architectural review):
```bash
# Search for duplicate content
rg -i "single responsibility" .prompts/ .specs/
rg -i "test pyramid" .prompts/ .specs/

# Check for similar patterns
diff .specs/constitution.md .prompts/core/architecture/modular-architecture-principles.md
```

**If duplication found**:
1. Identify which is more specific (constitutional constraint vs. universal pattern)
2. Keep universal pattern in prompts
3. Distill project-specific constraint in constitution
4. Add cross-reference to prevent future duplication

### V.2 Duplication Prevention

**Use "Distilled From" Notation**:
```markdown
## II.3 Modularity Requirements

**Principles** (distilled from modular-architecture-principles.md):
- Single responsibility per module
- [Condensed version of principles]

**Reference**: [Full details in .prompts/core/architecture/modular-architecture-principles.md]
```

**Cross-Reference Instead of Duplicate**:
```markdown
## Security Standards

For foundational security principles, see:
[.prompts/core/security/security-principles.md]

Project-specific requirements:
- Firestore security rules tested in emulator BEFORE deployment
- App Check enabled for production (Phase 2)
```

---

## VI. Maintenance & Updates

### VI.1 Constitutional Spec Maintenance

**Frequency**: Quarterly (with architectural review)

**Update Triggers**:
- Architectural phase transition (e.g., UI Phase 1 → Phase 2)
- New technology adopted (e.g., TypeScript added)
- Quality thresholds changed (e.g., coverage target increased)
- Cost constraints changed (e.g., Firebase pricing update)

**Process**:
1. Update §II.1 Current Architectural State
2. Update version (increment minor: 1.0.0 → 1.1.0)
3. Update "Last Updated" date
4. Document change in architectural-decision-log.md

### VI.2 Prompts Maintenance

**Frequency**: Bi-annual (reduced from quarterly since more stable)

**Update Triggers**:
- Firebase SDK version update (major version)
- GitHub Actions version update (v4 → v5)
- Node.js LTS version update
- Deprecated patterns discovered

**Process**:
1. Update technology versions in files
2. Update "Last Updated" date
3. Test examples still work
4. Maintain foundational patterns (rarely change)

### VI.3 Feature Specs Lifecycle

**Created**: Via `/speckit-specify`
**Active**: During development
**Archived**: After feature merged to main

**Archive Process**:
```bash
# After feature merged
mkdir -p .specs/features/archive
git mv .specs/features/user-profile.md .specs/features/archive/
git commit -m "docs: archive user-profile spec (feature completed)"
```

---

## VII. Claude's Consultation Protocol

### VII.1 Mandatory Consultation

**Before ANY architectural or implementation decision**:
1. Read `.specs/constitution.md` for project constraints
2. Check if prompts provide comprehensive guidance for the task
3. If prompts insufficient, follow prompt-gap-protocol.md
4. Document which guidance influenced the decision

**Priority Order**:
1. Constitutional spec (project-specific constraints)
2. Foundational prompts (universal patterns)
3. Platform prompts (implementation guidance)
4. Strategic meta-prompts (evolution decisions)

### VII.2 Gap Detection

**If guidance is insufficient**:
1. STOP - don't guess or hallucinate
2. Identify gap type:
   - Constitutional gap? (update .specs/constitution.md)
   - Prompt gap? (create/update .prompts/ file)
   - Technical spec gap? (create .specs/technical/ file)
3. Flag gap and recommend creation
4. Wait for gap to be filled before proceeding

**See**: `.prompts/meta/prompt-gap-protocol.md`

---

## VIII. Success Metrics

### VIII.1 Adoption Metrics (3 months)

- ✅ 100% of new features use `/speckit-specify` workflow
- ✅ 80%+ of commits cite constitutional compliance
- ✅ 100% of PRs include guidance references
- ✅ Zero features violate forbidden patterns

### VIII.2 Quality Metrics (6 months)

- ✅ Zero duplication detected between constitution and prompts
- ✅ Constitutional spec updated quarterly (on schedule)
- ✅ Prompt maintenance completed bi-annually
- ✅ All architectural decisions reference decision triggers

### VIII.3 Long-Term Health (12 months)

- ✅ Hybrid system maintained with minimal friction
- ✅ Clear boundaries respected (no confusion about what goes where)
- ✅ Spec-kit natural part of workflow (not burdensome)
- ✅ Prompt library stays evergreen and relevant

---

## IX. Common Scenarios

### Scenario 1: Adding New Feature

**Question**: How do I start implementing user authentication?

**Answer**:
```
1. /speckit-constitution
   Read §II.1 (current phase: Security Phase 1 - Basic Auth + Rules)
   Read §III.2 (security standards: input validation, server-side checks)

2. /speckit-specify user-authentication
   Create feature spec at .specs/features/user-authentication.md
   Reference:
   - Constitutional constraints (§II.1, §III.2)
   - .prompts/core/security/security-principles.md (OAuth, RBAC)
   - .prompts/platforms/firebase/firebase-security.md (Firebase Auth SDK)

3. /speckit-plan
   Design implementation applying Firebase Auth patterns

4. /speckit-tasks
   Break down: Setup → Auth UI → Firebase integration → Security rules

5. /speckit-implement
   Execute following constitutional + prompt guidance
```

### Scenario 2: Evolving Architecture

**Question**: Should we migrate from Vanilla WC to Lit?

**Answer**:
```
1. Read .prompts/meta/architectural-decision-log.md
   Current: UI Phase 1 (Vanilla Web Components), ~3-4 components

2. Read .prompts/meta/architectural-evolution-strategy.md
   Check Phase 1 → Phase 2 triggers:
   - Requires 10+ components (currently 3-4) ❌
   - Requires 3+ pain points (manual state sync errors, etc.) ❌

3. Decision: NOT YET
   Triggers not met. Stay in Phase 1.
   Revisit when component count reaches 10.

4. Document non-decision
   No need to create spec or update decision log.
   Just cite unmet triggers.
```

### Scenario 3: Checking If Pattern Allowed

**Question**: Can I use client-side filtering for this Firestore query?

**Answer**:
```
1. Read .specs/constitution.md §IV.2 (Forbidden Patterns)
   ❌ Client-side filtering (use Firestore queries: where(), limit(), orderBy())

2. Decision: NO
   This is explicitly forbidden to preserve free tier.

3. Alternative:
   Read .prompts/platforms/firebase/firebase-best-practices.md
   Use Firestore query with where() clause instead.
```

### Scenario 4: Finding Implementation Guidance

**Question**: How do I implement caching for Firestore reads?

**Answer**:
```
1. Read .specs/constitution.md §VI.2 (Cost Optimization)
   Requirement: Implement caching before 70% of read limit
   Pattern: 1-hour TTL

2. Read .prompts/platforms/firebase/firebase-finops.md
   Example caching pattern with Map and TTL

3. Implement:
   Apply pattern from prompts, respect TTL from constitution
```

---

## X. Troubleshooting

### Issue: Can't Find Guidance

**Symptom**: Unclear which file to consult

**Solution**:
1. Start with CLAUDE.md decision framework
2. Maps task types to specific prompts
3. If still unclear, check this integration guide

### Issue: Conflicting Guidance

**Symptom**: Constitution says X, prompts say Y

**Resolution**:
- Constitutional spec takes precedence (project-specific override)
- Prompts provide default/recommended approach
- If constitutional spec contradicts universal best practice, that's intentional (document why in decision log)

### Issue: Gap in Guidance

**Symptom**: No clear guidance for the task

**Solution**:
1. Follow `.prompts/meta/prompt-gap-protocol.md`
2. STOP - don't guess
3. Flag gap (constitutional, prompt, or technical spec)
4. Recommend creation
5. Proceed only after gap filled

---

## XI. References

**Entry Points**:
- `/CLAUDE.md` - Decision framework, mandatory consultation protocol
- `.specs/constitution.md` - Project constitutional spec
- `.prompts/README.md` - Prompt library navigation

**Slash Commands**:
- `/speckit-constitution` - View constitutional spec
- `/speckit-specify` - Create feature spec
- `/speckit-plan` - Design implementation
- `/speckit-tasks` - Break down work
- `/speckit-implement` - Execute

**Meta-Guidance**:
- `.prompts/meta/spec-authoring-guidelines.md` - Rules for writing specs (reference vs. reproduce)
- `.prompts/meta/architectural-evolution-strategy.md` - Evolution framework
- `.prompts/meta/architectural-decision-log.md` - Historical decisions
- `.prompts/meta/prompt-gap-protocol.md` - Gap detection and handling

---

**Maintained By**: Project lead
**Review Frequency**: Quarterly (with architectural review)
**Last Review**: 2025-12-11
**Next Review**: 2026-03-11
