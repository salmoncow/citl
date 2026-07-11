# Prompt Gap Protocol

> **Purpose:** Ensure AI agents work within documented knowledge and flag gaps rather than hallucinating guidance.

## Protocol Overview

When given a development task, the AI agent must:

1. **Assess against existing prompts** - Check if adequate guidance exists
2. **Identify gaps** - Recognize when prompts are insufficient
3. **Flag gaps to user** - Don't guess or make assumptions
4. **Propose prompt creation** - Suggest creating missing guidance first
5. **Prioritize prompt work** - Include prompt creation in the plan before implementation

---

## Step-by-Step Process

### Step 1: Map Request to CLAUDE.md Decision Framework

When user requests a task:

```markdown
User Request → Check CLAUDE.md "When to Reference Which Prompt"
              ↓
              Does a mapping exist?
              ├─ Yes → Proceed to Step 2
              └─ No → FLAG GAP (no decision framework mapping)
```

### Step 2: Verify Prompt Coverage

For each referenced prompt file:

```markdown
Read referenced prompt(s)
↓
Does prompt have COMPREHENSIVE guidance for this specific task?
├─ Yes → Proceed to Step 4 (implement)
└─ No → Proceed to Step 3 (gap analysis)
```

**Comprehensive guidance means:**
- Specific patterns/examples for the task type
- Trade-off discussions for decision-making
- Anti-patterns to avoid
- Implementation examples (code snippets)
- Testing/validation strategies

**Insufficient guidance means:**
- Only tangential mentions
- No concrete patterns
- Missing critical decisions
- Implementation-specific only (no core principles) or vice versa

### Step 3: Gap Analysis & Communication

When gap detected, communicate to user:

```markdown
## Prompt Gap Detected

**Task:** [User's request]

**Expected Guidance:**
- [What prompts should exist based on CLAUDE.md structure]

**Current Coverage:**
- ✅ [What exists and is adequate]
- ⚠️ [What exists but is insufficient]
- ❌ [What's completely missing]

**Gap Assessment:**
[Describe what's missing and why it prevents proceeding]

**Recommendation:**
Create the following prompt(s) before implementation:
1. `path/to/new-prompt.md` - [Purpose]
2. `path/to/another-prompt.md` - [Purpose]

**Proposed Plan:**
1. **Prompt Creation Phase**
   - Review [existing similar prompts]
   - Draft new prompt covering [specific topics]
   - Update CLAUDE.md decision framework

2. **Implementation Phase** (after prompts exist)
   - Implement feature following new guidance
   - Document which prompts influenced decisions
```

### Step 4: Implementation with Citations

If prompts are sufficient, proceed with:

```markdown
**Guidance References:**
- `prompt-file.md` (lines X-Y) - [Specific principle applied]
- `another-prompt.md` (section Z) - [Pattern used]

**Patterns Applied:**
- [Concrete pattern from prompts]

**Implementation:**
[Code/solution following documented patterns]
```

---

## Gap Detection Examples

### Example 1: Data Modeling (REAL GAP)

**User Request:**
"Design a Firestore database schema for a multi-tenant SaaS application with users, organizations, projects, and permissions."

**Gap Analysis:**

**Expected Guidance:**
- `core/architecture/data-modeling-principles.md` - Platform-agnostic data design
- `platforms/firebase/firebase-best-practices.md` - Firestore implementation

**Current Coverage:**
- ✅ `firebase-best-practices.md` has basic Firestore patterns (documents, collections)
- ❌ No core data modeling principles (normalization, entity relationships, multi-tenancy patterns)
- ❌ No comprehensive Firestore multi-tenancy guidance

**Recommendation:**
```markdown
## Proposed Prompt Creation

### 1. `core/architecture/data-modeling-principles.md`

**Should cover:**
- Entity-relationship design patterns
- Normalization vs. denormalization trade-offs
- Data integrity strategies
- One-to-many, many-to-many relationship patterns
- Hierarchical data modeling
- Multi-tenancy patterns (shared database, database-per-tenant, schema-per-tenant)
- Transaction boundaries and consistency
- Data migration strategies
- Temporal data modeling (history, versioning)

**Why needed:**
Universal data modeling principles apply regardless of database type
(SQL, NoSQL, document, graph). Current prompts only have
implementation-specific patterns.

### 2. Enhance `platforms/firebase/firebase-best-practices.md`

**Add section:** Multi-Tenancy Patterns for Firestore

**Should cover:**
- Security rules for tenant isolation
- Collection design for multi-tenant (shared collections vs. tenant-specific)
- Query patterns with tenant filtering
- Cost implications of different approaches
- Cross-tenant data access patterns
- Tenant-specific subcollections vs. top-level collections

### 3. Update CLAUDE.md Decision Framework

**Add mapping:**
```markdown
**Database/Data Modeling** →
- `core/architecture/data-modeling-principles.md` (universal patterns)
- Then: `platforms/firebase/firebase-best-practices.md` (Firestore implementation)
```

**Plan:**
1. Create `data-modeling-principles.md` (1-2 hours)
2. Enhance `firebase-best-practices.md` with multi-tenancy section
3. Update CLAUDE.md decision framework
4. Then proceed with schema design using new guidance
```

---

### Example 2: No Gap - Proceed

**User Request:**
"Implement Firebase Authentication with Google sign-in and custom claims for admin users."

**Gap Analysis:**

**Expected Guidance:**
- `core/security/security-principles.md`
- `platforms/firebase/firebase-security.md`

**Current Coverage:**
- ✅ `security-principles.md` has authentication and authorization principles
- ✅ `firebase-security.md` has custom claims patterns (lines 45-67)
- ✅ Comprehensive implementation examples exist

**Assessment:** No gap, proceed with implementation.

**Guidance References:**
- `platforms/firebase/firebase-security.md` (lines 45-67) - Custom claims for RBAC
- `core/security/security-principles.md` (lines 22-35) - Authentication best practices

[Implement using documented patterns]

---

### Example 3: Partial Gap - Decide

**User Request:**
"Set up performance monitoring with custom metrics and alerting."

**Gap Analysis:**

**Expected Guidance:**
- `core/operations/monitoring-principles.md`
- `platforms/firebase/firebase-monitoring.md`

**Current Coverage:**
- ✅ `monitoring-principles.md` has observability pillars and metrics
- ✅ `firebase-monitoring.md` has Performance Monitoring integration
- ⚠️ Firebase monitoring has basic alerting but limited free-tier alerting patterns
- ⚠️ No custom metrics implementation examples for Firebase

**Assessment:** Partial gap - can proceed with caveats

**Options:**
1. **Proceed with current guidance** - Implement basic monitoring, note limitations
2. **Enhance prompts first** - Add custom metrics section to firebase-monitoring.md
3. **Ask user** - Which approach do they prefer?

**Recommended:**
Ask user: "Current firebase-monitoring.md has basic patterns but doesn't cover
custom metrics in depth. I can:
A) Implement using general patterns (may not follow best practices)
B) First enhance the prompt with custom metrics guidance
C) You provide specific requirements and I'll document them as we go

Which do you prefer?"

---

## When to Flag Gaps vs. Proceed

### Always Flag Gap If:
- ❌ No core principle exists for the domain (data modeling, state management, etc.)
- ❌ Security-critical implementation without documented security patterns
- ❌ Complex architectural decision without decision framework
- ❌ Platform-specific implementation exists but no core principles
- ❌ Pattern contradicts existing prompts (inconsistency risk)

### Proceed with Caution If:
- ⚠️ Core principles exist but implementation lacks examples
- ⚠️ Related patterns exist that can be adapted
- ⚠️ Simple, low-risk implementation
- ⚠️ User explicitly wants quick prototype before formalizing

### Proceed Confidently If:
- ✅ Comprehensive guidance exists with examples
- ✅ Clear decision framework mapping
- ✅ Multiple related prompts cover the topic
- ✅ Testing/validation guidance included

---

## Prompt Creation Guidelines

When recommending new prompts:

### 1. Determine Correct Layer

**Core (`core/`):**
- Platform-agnostic principles
- Universal patterns
- Applicable across any tech stack
- Example: Data modeling, caching strategies, state management

**Platform (`platforms/[name]/`):**
- Technology-specific implementation
- Configuration examples
- SDK usage patterns
- Example: Firebase data modeling, AWS Lambda patterns

**Meta (`meta/`):**
- Prompt library maintenance
- AI agent protocols
- Documentation about documentation

### 2. Reference Existing Prompt Structure

New prompts should follow established format:

```markdown
# [Topic] Principles (or Guide/Best Practices)

> **Last Updated:** YYYY-MM-DD
> **Next Review:** YYYY-MM-DD (if applicable)

## Overview
[Brief description and scope]

## Core Principles / Patterns
[Main content with examples]

## Anti-Patterns to Avoid
[What NOT to do]

## Platform Implementations
[Links to platform-specific prompts]

## References
[External resources]
```

### 3. Update CLAUDE.md

Always update decision framework with new prompts:

```markdown
**[Task Type]** →
- `new-prompt.md` (description)
- Then: `implementation-prompt.md` (if applicable)
```

### 4. Cross-Reference Related Prompts

Link to related existing prompts:

```markdown
See also:
- [Related Topic](./related-prompt.md)
- Platform implementation: [Firebase Guide](../platforms/firebase/...)
```

---

## AI Agent Commitments

When following this protocol, the AI agent commits to:

1. **Honesty about knowledge gaps** - Never pretend prompts exist when they don't
2. **No hallucinated guidance** - Don't invent "best practices" without prompt basis
3. **Transparent citations** - Always show which prompts informed decisions
4. **Proactive gap detection** - Flag gaps before implementing
5. **Constructive recommendations** - Suggest specific prompts to create
6. **Plan prioritization** - Put prompt creation before implementation when needed

---

## User Expectations

Users can expect:

1. **No blind spots** - Agent won't miss obvious gaps in guidance
2. **Consistent patterns** - Same task types get same guidance over time
3. **Traceable decisions** - Every choice links back to documented patterns
4. **Growing knowledge base** - Gaps become prompts, prompts improve over time
5. **Right-sized guidance** - Only create prompts when actually needed

---

## Workflow Integration

### Standard Development Flow WITH Gap Protocol

```
1. User: "Build feature X"
   ↓
2. Agent: Check CLAUDE.md for mapping
   ↓
3. Agent: Read referenced prompts
   ↓
4. Agent: Assess coverage
   ├─ Sufficient → Implement (cite prompts)
   └─ Gap detected → Flag to user
                     ↓
5. User: Decides to create prompt or proceed anyway
   ↓
6. [If prompt created] Agent: Implement using new guidance
   [If skip prompt] Agent: Implement with caveats, document decisions
```

### Iterative Prompt Building

```
Gap detected (no prompt exists)
↓
User + Agent collaborate to create prompt
↓
Prompt added to library
↓
Future similar tasks reference this prompt
↓
Pattern becomes standard practice
↓
Library grows organically based on real needs
```

---

## Benefits of This Protocol

### For Users:
- ✅ Confidence AI isn't making up "best practices"
- ✅ Consistent patterns across projects
- ✅ Knowledge base grows intentionally, not speculatively
- ✅ Clear audit trail for architectural decisions

### For AI Agents:
- ✅ Clear boundaries of documented knowledge
- ✅ Framework for handling uncertainty
- ✅ Mechanism to improve guidance over time
- ✅ Reduced hallucination risk

### For Teams:
- ✅ Shared knowledge repository
- ✅ Onboarding resource for new developers
- ✅ Documentation-driven development
- ✅ Architectural decisions recorded

---

## Related Documentation

- `CLAUDE.md` - Core decision framework
- `meta/prompt-maintenance.md` - Keeping prompts current
- `meta/agentic-development-workflow.md` - AI collaboration patterns (if created)

---

## Version History

**v1.0** (2025-11-23): Initial protocol based on user requirement for gap detection
