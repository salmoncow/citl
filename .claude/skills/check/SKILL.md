---
name: check
description: Run a quick constitutional compliance check on the current working tree changes. Triggers on phrases like "check compliance", "pre-commit check", "run checks", "constitutional check", "validate changes".
---

Run a quick constitutional compliance check on the current working tree changes.

## Steps

### 1. Identify changed files
Run `git diff --name-only` and `git diff --cached --name-only` to find all modified files (staged and unstaged). If no changes exist, report "No changes to check" and stop.

### 2. Check each changed `.ts` file for forbidden patterns (§IV.2)
For each changed TypeScript file, check for:

| Pattern | Check | Fix |
|---------|-------|-----|
| `var ` declarations | grep for `\bvar\b` (excluding comments) | Use `const` or `let` |
| Inline event handlers | grep for `onclick=\|onload=\|onerror=` | Attach listeners in JS |
| Unfiltered Firestore reads | grep for `getDocs(collection(` without nearby `where`/`limit` | Add `where()` + `limit()` |
| Unsanitized innerHTML | grep for `.innerHTML =` with non-static content | Use `textContent` or `escapeHtml()` |
| Plain loading text | grep for `Loading…\|Loading...` in HTML strings | Use `.skeleton` shimmer classes (§III.3) |
| File size | check line count | Target <500, hard limit 750 |

### 3. Check dependency direction (§II.3)
For changed files only:
- Files in `src/repositories/` must NOT import from `src/services/` or `src/modules/` or `src/components/`
- Files in `src/services/` must NOT import from `src/modules/` or `src/components/`
- Files in `src/components/` must NOT import directly from `firebase/`

### 4. Run typecheck
Run `npm run typecheck` and report pass/fail.

### 5. Run tests
Run `npm run test` and report pass/fail.

### 6. Report
Present results as a checklist:
```
✅ No var declarations
✅ No inline event handlers
❌ File size: src/components/admin-panel.ts (1781 lines > 750 limit)
✅ Dependency direction OK
✅ Typecheck passed
✅ Tests passed
```

If all checks pass, report "All constitutional checks passed — ready to commit."
If any fail, list the violations with file:line references.
