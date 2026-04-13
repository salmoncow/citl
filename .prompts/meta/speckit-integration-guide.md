# Spec-Kit Integration Guide

**Status**: Meta-Guidance
**Created**: 2025-12-11
**Updated**: 2026-04-12
**Purpose**: Document the integration between spec-kit (project specifications) and guidance systems

> **Architecture Change (2026-04-12):** Foundational guidance (architecture, security, testing,
> Firebase) has been migrated to global Claude Code skills at `~/.claude/skills/`. These
> auto-activate based on context. Only `.prompts/meta/` remains for project-specific strategic
> frameworks. References to `.prompts/core/` and `.prompts/platforms/` below are historical.

---

## Overview

This project uses a **layered guidance architecture** combining:
1. **Spec-Kit** (`.specs/`) - Project-specific, executable specifications
2. **Global Skills** (`~/.claude/skills/`) - Foundational, universal patterns (auto-activated)
3. **Meta Prompts** (`.prompts/meta/`) - Project-specific strategic frameworks

**Philosophy**: Spec-kit defines **what this project must do**, global skills define **how good software is built**, meta prompts define **when and why to evolve**.

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

**Global Skills (`~/.claude/skills/`)** provide:
- ✅ Foundational architectural patterns (SOLID, modularity, DRY)
- ✅ Universal security principles (auth/authz, input validation)
- ✅ Platform-agnostic best practices (testing pyramid, FinOps)
- ✅ Firebase implementation guidance (SDK patterns, security rules)

**Meta Prompts (`.prompts/meta/`)** contain:
- ✅ Strategic frameworks (architectural evolution, platform selection)
- ✅ Historical decisions and decision log
- ✅ Gap detection protocol
- ✅ Guidance maintenance procedures

### I.2 File Structure

```
citl-static/
├── .specs/                          # Spec-Kit (Project-Specific)
│   ├── constitution.md             # Constitutional spec (single source of truth)
│   ├── technical/
│   │   ├── build-system.md        # Vite configuration
│   │   ├── cicd-pipeline.md       # GitHub Actions workflows
│   │   ├── firebase-deployment.md # Firebase Hosting deployment
│   │   └── firestore-schema.md    # Firestore collection/document reference
│   └── features/                   # Per-feature specifications (ephemeral)
│       └── <feature-name>.md      # Created via @speckit agent
│
├── .prompts/meta/                   # Project-Specific Strategic Frameworks
│   ├── architectural-evolution-strategy.md  # Evolution triggers, decision framework
│   ├── architectural-decision-log.md        # Historical decisions, current state
│   ├── prompt-gap-protocol.md               # Handling insufficient guidance
│   ├── prompt-maintenance.md                # Keeping guidance current
│   ├── speckit-integration-guide.md         # This file
│   └── spec-authoring-guidelines.md         # Reference, don't reproduce
│
├── .claude/
│   ├── agents/                      # Custom Claude Code Agents
│   │   ├── speckit.md              # Feature specification (specify + plan + tasks)
│   │   ├── reviewer.md            # Code review + PR preparation
│   │   └── scoring.md             # Scoring engine domain expert
│   ├── skills/                      # Slash Command Skills
│   │   ├── constitution/           # Project state dashboard
│   │   ├── implement/              # Execute a feature spec
│   │   ├── check/                  # Quick compliance check
│   │   └── deploy-preview/         # Preview deployment
│   └── settings.json               # Hooks (post-edit constitutional checks)
│
├── ~/.claude/skills/                # Global Claude Code Skills (auto-activated)
│   ├── software-architecture/      # SOLID, modular design, extensibility
│   ├── security-principles/        # Auth, data protection, API security
│   ├── testing-principles/         # Testing pyramid, strategies
│   ├── operations-principles/      # Monitoring, budget, platform selection
│   ├── git-conventions/            # Conventional commits, branching
│   ├── asset-reusability/          # DRY for resources
│   ├── firebase-best-practices/    # SDK patterns, Firestore, Auth
│   ├── firebase-security/          # Security rules, custom claims
│   ├── firebase-testing/           # Emulator testing, rules testing
│   ├── firebase-monitoring/        # Performance monitoring, logging
│   └── firebase-cost-resilience/   # Free tier optimization, retry patterns
│
└── CLAUDE.md                        # Entry point with decision framework
```

---

## II. When to Use What

### II.1 Decision Tree

**Starting a new feature?**
→ Invoke `@speckit` agent (creates `.specs/features/<feature>.md` + plan + tasks)
→ References constitution + prompts

**Checking project constraints?**
→ `/constitution` (summarizes `.specs/constitution.md` as a dashboard)

**Understanding architectural patterns?**
→ Global skills auto-activate (`software-architecture`, `security-principles`, etc.)

**Implementing Firebase integration?**
→ Global skills auto-activate (`firebase-best-practices`, `firebase-security`, etc.)

**Wondering if you should evolve architecture?**
→ Read `.prompts/meta/architectural-evolution-strategy.md`
→ Check decision triggers
→ If triggers met: Create spec via `@speckit` agent

**Need to understand Git workflow?**
→ Global `git-conventions` skill auto-activates

### II.2 Workflow Integration

**Feature Development Workflow**:
```
1. /constitution
   ↓ (project state dashboard — current state, triggers, constraints)
2. @speckit <feature-name>
   ↓ (creates spec + implementation plan + task breakdown in one conversation)
3. /implement <feature-name>
   ↓ (executes the spec with constitutional + prompt compliance)
4. @reviewer
   ↓ (audits changes, drafts PR description)
5. /check
   ↓ (quick compliance pass before commit)
6. Git commit (conventional format from prompts/core/development/git-best-practices.md)
7. Create PR (using @reviewer's drafted description)
```

Note: The `@speckit` agent replaces the former `/speckit-specify`, `/speckit-plan`, and
`/speckit-tasks` workflow — all three steps are now handled in a single agent conversation.

**Architectural Evolution Workflow**:
```
1. Read .prompts/meta/architectural-decision-log.md
   ↓ (check current phase)
2. Read .prompts/meta/architectural-evolution-strategy.md
   ↓ (check decision triggers)
3. If triggers met:
   a. @speckit architectural-evolution-<domain>
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

**Reference**: See `software-architecture` global skill for detailed patterns and examples.
```

### III.2 In Feature Specs

**Pattern**: Cite constitutional section; global skills provide the patterns automatically

```markdown
## Architecture Approach

**Constitutional Constraints**: §II.3 Modularity Requirements

This feature follows single-responsibility principle (one service module).
Dependency direction: Component → Service → Firebase Infrastructure.
```

### III.3 In Global Skills

Global skills auto-activate based on context. They don't reference project-specific files.
The constitution provides project-specific constraints; skills provide universal patterns.

### III.4 In Git Commits

**Pattern**: Cite constitutional compliance

```markdown
git commit -m "feat: implement user profile data layer

Constitutional compliance:
- §III.2: Input validation on all boundaries
- §III.3: Firestore query uses limit(10)
- §VI.2: 1-hour cache TTL for free tier"
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
- Detailed implementation patterns (those go in global skills)
- Historical decisions (those go in architectural-decision-log.md)
- Universal principles (those go in global skills at ~/.claude/skills/)
- Platform-specific patterns (those go in global Firebase skills)

### IV.2 What Belongs in Global Skills

Global skills at `~/.claude/skills/` contain universal patterns and are maintained separately.
They auto-activate based on context — no manual consultation needed.

### IV.3 What Belongs in Meta Prompts

**Include** (`.prompts/meta/`):
- Strategic frameworks (evolution strategy, platform selection triggers)
- Historical decisions (architectural decision log)
- Gap detection protocol
- Guidance maintenance procedures

**Exclude**:
- Universal patterns (those go in global skills)
- Project-specific constraints (those go in constitution)
- Per-feature requirements (those go in .specs/features/)

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
- Check that constitutional constraints don't duplicate global skill content
- Constitution should distill project-specific rules, not re-explain universal patterns
- Global skills are maintained separately and auto-activate

**If duplication found**:
1. Identify which is more specific (constitutional constraint vs. universal pattern)
2. Keep universal pattern in global skills
3. Distill project-specific constraint in constitution

### V.2 Duplication Prevention

**Use "Distilled From" Notation**:
```markdown
## II.3 Modularity Requirements

**Principles** (distilled from modular-architecture-principles.md):
- Single responsibility per module
- [Condensed version of principles]

**Reference**: See `software-architecture` global skill for full details
```

**Cross-Reference Instead of Duplicate**:
```markdown
## Security Standards

For foundational security principles, see:
Global `security-principles` and `firebase-security` skills (auto-activated)

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

### VI.2 Global Skills Maintenance

Global skills at `~/.claude/skills/` are maintained separately from this project.
They evolve independently and auto-activate based on context.

### VI.3 Meta Prompts Maintenance

**Frequency**: Bi-annual (reduced from quarterly since more stable)

**Update Triggers**:
- Architectural phase transition
- New strategic decision made
- Gap protocol updated

**Process**:
1. Update relevant meta file
2. Update "Last Updated" date
3. Cross-reference with constitution if needed

### VI.3 Feature Specs Lifecycle

**Created**: Via `@speckit` agent
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
2. Global skills auto-activate for universal guidance
3. If guidance insufficient, follow prompt-gap-protocol.md
4. Document which guidance influenced the decision

**Priority Order**:
1. Constitutional spec (project-specific constraints)
2. Global Claude Code skills (universal patterns — auto-activated)
3. Meta prompts (strategic frameworks, evolution decisions)

### VII.2 Gap Detection

**If guidance is insufficient**:
1. STOP - don't guess or hallucinate
2. Identify gap type:
   - Constitutional gap? (update .specs/constitution.md)
   - Skill gap? (update global skill or create new one)
   - Technical spec gap? (create .specs/technical/ file)
3. Flag gap and recommend creation
4. Wait for gap to be filled before proceeding

**See**: `.prompts/meta/prompt-gap-protocol.md`

---

## VIII. Success Metrics

### VIII.1 Adoption Metrics (3 months)

- ✅ 100% of new features use `@speckit` agent workflow
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
1. /constitution
   Review project state dashboard — note §II.1 (Security Phase 1) and §III.2 (security standards)

2. @speckit user-authentication
   Agent reads constitution, creates spec at .specs/features/user-authentication.md
   References:
   - Constitutional constraints (§II.1, §III.2)
   - Global skills auto-activate for security and Firebase patterns
   Produces implementation plan + task breakdown

3. /implement user-authentication
   Executes the spec with constitutional + prompt compliance

4. @reviewer
   Audits changes, drafts PR description

5. /check
   Quick compliance pass before commit
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
   Global `firebase-best-practices` skill provides query patterns.
   Use Firestore query with where() clause instead.
```

### Scenario 4: Finding Implementation Guidance

**Question**: How do I implement caching for Firestore reads?

**Answer**:
```
1. Read .specs/constitution.md §VI.2 (Cost Optimization)
   Requirement: Implement caching before 70% of read limit
   Pattern: 1-hour TTL

2. Global `firebase-cost-resilience` skill auto-activates with caching patterns

3. Implement:
   Apply pattern from skill, respect TTL from constitution
```

---

## X. Troubleshooting

### Issue: Can't Find Guidance

**Symptom**: Unclear which file to consult

**Solution**:
1. Start with CLAUDE.md decision framework
2. Global skills auto-activate for relevant topics
3. If still unclear, check this integration guide

### Issue: Conflicting Guidance

**Symptom**: Constitution says X, global skill says Y

**Resolution**:
- Constitutional spec takes precedence (project-specific override)
- Global skills provide default/recommended approach
- If constitutional spec contradicts universal best practice, that's intentional (document why in decision log)

### Issue: Gap in Guidance

**Symptom**: No clear guidance for the task

**Solution**:
1. Follow `.prompts/meta/prompt-gap-protocol.md`
2. STOP - don't guess
3. Flag gap (constitutional, skill, or technical spec)
4. Recommend creation
5. Proceed only after gap filled

---

## XI. References

**Entry Points**:
- `CLAUDE.md` - Decision framework, mandatory consultation protocol
- `.specs/constitution.md` - Project constitutional spec
- `~/.claude/skills/` - Global Claude Code skills (auto-activated)

**Agents** (`.claude/agents/`):
- `@speckit` - Feature specification (specify + plan + tasks in one conversation)
- `@reviewer` - Code review + PR preparation
- `@scoring` - Scoring engine domain expert

**Slash Commands** (`.claude/skills/`):
- `/constitution` - Project state dashboard
- `/implement <feature>` - Execute a feature spec
- `/check` - Quick constitutional compliance check
- `/deploy-preview` - Preview deployment with gates

**Hooks** (`.claude/settings.json`):
- Post-edit constitutional pattern check on `.ts` files

**Meta-Guidance** (`.prompts/meta/`):
- `spec-authoring-guidelines.md` - Rules for writing specs (reference vs. reproduce)
- `architectural-evolution-strategy.md` - Evolution framework
- `architectural-decision-log.md` - Historical decisions
- `prompt-gap-protocol.md` - Gap detection and handling

---

**Maintained By**: Project lead
**Review Frequency**: Quarterly (with architectural review)
**Last Review**: 2026-04-12
**Next Review**: 2026-07-12
