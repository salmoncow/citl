#!/bin/bash
# Constitutional pattern checker for CITL
# Used by Claude Code PostToolUse hook to catch forbidden patterns after file edits.
# See .specs/constitution.md §IV.2 for the authoritative list.
#
# Input: JSON on stdin with tool_input.file_path
# Exit 0: no violations found (or not a .ts file)
# Stdout: JSON warnings for Claude to see

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check TypeScript files
if [[ -z "$FILE" ]] || [[ ! "$FILE" == *.ts ]] || [[ ! -f "$FILE" ]]; then
  exit 0
fi

ISSUES=""

# Check for var declarations (excluding comments and strings)
if grep -n '\bvar ' "$FILE" | grep -v '^\s*//' | grep -v '^\s*\*' | head -3 | grep -q .; then
  MATCHES=$(grep -n '\bvar ' "$FILE" | grep -v '^\s*//' | grep -v '^\s*\*' | head -3)
  ISSUES="${ISSUES}Forbidden pattern (§IV.2): 'var' declaration found. Use const/let.\n${MATCHES}\n\n"
fi

# Check for inline event handlers
if grep -n 'onclick=\|onload=\|onerror=\|onsubmit=\|onchange=' "$FILE" | head -3 | grep -q .; then
  MATCHES=$(grep -n 'onclick=\|onload=\|onerror=\|onsubmit=\|onchange=' "$FILE" | head -3)
  ISSUES="${ISSUES}Forbidden pattern (§IV.2): Inline event handler found. Attach listeners in JS.\n${MATCHES}\n\n"
fi

# Check for unfiltered Firestore reads
if grep -n 'getDocs(collection(' "$FILE" | head -3 | grep -q .; then
  MATCHES=$(grep -n 'getDocs(collection(' "$FILE" | head -3)
  ISSUES="${ISSUES}Warning (§IV.2): getDocs(collection(...)) found — verify where() + limit() are present.\n${MATCHES}\n\n"
fi

# Check file size
LINES=$(wc -l < "$FILE")
if [[ "$LINES" -gt 750 ]]; then
  ISSUES="${ISSUES}Forbidden (§II.3): File exceeds 750-line hard limit (${LINES} lines). Split by responsibility.\n\n"
elif [[ "$LINES" -gt 500 ]]; then
  ISSUES="${ISSUES}Warning (§II.3): File exceeds 500-line target (${LINES} lines). Consider splitting.\n\n"
fi

if [[ -n "$ISSUES" ]]; then
  # Output as a message Claude will see
  echo -e "Constitutional check for $(basename "$FILE"):\n${ISSUES}"
fi

exit 0
