# CITL Workflow Quick Reference

Personal guide for using the agent/skill-based development workflow.

---

## Daily Orientation

Start any session with:
```
/constitution
```
Returns a dashboard summary — current state, evolution triggers, forbidden patterns. Fast and cheap. Use often.

---

## Feature Development

### 1. Specify — `@speckit`

Prompt with the *what* and *why*, not the *how*:
```
@speckit: I want to add a season calendar view that shows the 15 Tuesday
shoot dates for the current season. Shooters keep asking when the next
shoot night is.
```

The agent will:
- Read the constitution
- Create a spec in `.specs/features/<name>.md`
- Produce an implementation plan + task breakdown
- Stop and flag if guidance is missing

**Review the spec before moving on.**

### 2. Implement — `/implement`

```
/implement season-calendar
```

Picks up the spec file and executes the plan. Runs typecheck and tests when done.

If no argument given, uses the most recently modified spec in `.specs/features/`.

### 3. Review — `@reviewer`

```
@reviewer
```

Invoke on your branch before opening a PR. It will:
- Diff against `main`
- Audit all 12 constitutional checks
- Draft the PR description

To focus on a specific concern:
```
@reviewer: Pay extra attention to the Firestore query patterns —
I added a new query and want to make sure it's free-tier safe.
```

### 4. Pre-commit check — `/check`

```
/check
```

Quick sanity pass: forbidden patterns, typecheck, tests. Lighter than the full reviewer.

### 5. Deploy preview — `/deploy-preview`

```
/deploy-preview
```

Runs build, typecheck, tests, then deploys a 7-day Firebase preview channel. Stops on any failure.

---

## Scoring Engine Work

Use `@scoring` when working on scoring logic:

```
@scoring: Walk me through what happens when a team has 2 dummies and
3 real shooters in week 8. One rookie has a going-in avg of exactly 35.
```

Good for:
- Tracing calculations step-by-step
- Validating test coverage against business rules
- Identifying missing edge case tests
- Reviewing scoring changes against all rules

---

## Automatic Guardrails

The **post-edit hook** runs silently after every file write/edit. It checks `.ts` files for:
- `var` declarations
- Inline event handlers (`onclick=`, etc.)
- Unfiltered Firestore reads
- Files exceeding 750 lines

No action needed unless it flags a violation.

---

## Prompting Tips

| Do | Don't |
|----|-------|
| Describe the user need and why | Prescribe the implementation |
| Let agents handle constitutional compliance | Front-load section numbers in prompts |
| Use `/check` before every commit | Skip compliance and hope for the best |
| Use `@reviewer` before every PR | Write PR descriptions from scratch |
| Start sessions with `/constitution` | Assume you remember current state |

---

## Quick Command Cheat Sheet

| Action | Command |
|--------|---------|
| Orient | `/constitution` |
| Specify a feature | `@speckit <description>` |
| Implement a spec | `/implement <feature-name>` |
| Review for PR | `@reviewer` |
| Pre-commit check | `/check` |
| Deploy preview | `/deploy-preview` |
| Scoring help | `@scoring <question>` |
