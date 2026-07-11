---
name: check
description: Run a quick constitutional compliance check on the current working tree changes. Triggers on phrases like "constitutional check", "compliance check", "pre-commit check".
---

Run a quick constitutional compliance check on the current working tree changes.

## Steps

### 1. Identify changed files
Run `git diff --name-only` and `git diff --cached --name-only` to find all modified files (staged and unstaged). If no changes exist, report "No changes to check" and stop.

### 2. Check each changed `.ts`/`.html` file against the forbidden-pattern ruleset (§IV.2)
Run the **single-source ruleset** on each changed file — the same one the PostToolUse hook
uses, so `/check` and the hook can never disagree:

```bash
for f in $(git diff --name-only; git diff --cached --name-only | sort -u); do
  case "$f" in *.ts|*.html)
    printf '{"tool_input":{"file_path":"%s"}}' "$f" | bash scripts/check-constitution.sh ;;
  esac
done
```

A non-zero exit (2) means a **forbid** violation; stdout notes are advisory warnings. The
rules live in [`scripts/forbidden-patterns.json`](../../../scripts/forbidden-patterns.json) —
do not restate them here.

### 3. Check dependency direction (§II.3) and the review-only rules
The hook can't grep these — verify them by eye on the changed files (they are the
`enforcedBy: review` rules in the ruleset):
- Files in `src/repositories/` must NOT import from `src/services/`, `src/modules/`, or `src/components/`
- Files in `src/services/` must NOT import from `src/modules/` or `src/components/`
- Files in `src/components/` must NOT import the firebase SDK for runtime use (type-only imports are fine)
- `onSnapshot()` listeners store and call their unsubscribe on teardown

### 4. Run typecheck
Run `npm run typecheck` and report pass/fail.

### 5. Run tests
Run `npm run test` and report pass/fail.

### 6. Report
Present results as a checklist:
```
✅ No var declarations
✅ No inline event handlers
❌ File size: src/services/some-service.ts (812 lines > 750 limit)
✅ Dependency direction OK
✅ Typecheck passed
✅ Tests passed
```

If all checks pass, report "All constitutional checks passed — ready to commit."
If any fail, list the violations with file:line references.
