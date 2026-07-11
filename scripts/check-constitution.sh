#!/bin/bash
# Constitutional pattern checker for CITL.
# PostToolUse hook (Edit|Write) — executes the single-source ruleset in
# scripts/forbidden-patterns.json (constitution §IV.2 is the human canon).
#
# Contract:
#   Input : JSON on stdin with .tool_input.file_path
#   forbid violation  -> print reason to stderr, exit 2 (blocks; Claude sees it)
#   warn  only        -> print notes to stdout, exit 0 (advisory)
#   nothing / N/A file -> exit 0, silent
#
# Detects only what greps can detect reliably; rules with enforcedBy "review"
# are documented in the ruleset for @reviewer, not enforced here.

set -u
set -f  # no filename globbing — scope globs like *.ts are matched literally, not expanded against cwd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULESET="$SCRIPT_DIR/forbidden-patterns.json"

# Fail loud if jq is missing — do NOT silently pass (F-60).
if ! command -v jq >/dev/null 2>&1; then
  echo "check-constitution: jq not found — constitutional checks were SKIPPED. Install jq." >&2
  exit 0
fi
[[ -f "$RULESET" ]] || { echo "check-constitution: ruleset $RULESET missing — checks skipped." >&2; exit 0; }

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')

# Gate on scope: only .ts and .html files that exist (widened from .ts-only, F-60).
[[ -n "$FILE" && -f "$FILE" ]] || exit 0
case "$FILE" in
  *.ts|*.html) ;;
  *) exit 0 ;;
esac
BASE="$(basename "$FILE")"

# Strip line comments once for comment-excluding rules (BSD-safe: [[:space:]] not \s, F-59).
NOCOMMENT=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$FILE")

BLOCKING=""
WARNINGS=""

rule_count=$(jq '.rules | length' "$RULESET")
warn_limit=$(jq -r '.sizeLimits.warn' "$RULESET")
forbid_limit=$(jq -r '.sizeLimits.forbid' "$RULESET")

matches_scope() {
  # $1 = file, remaining = scope globs (space-separated from jq)
  local f="$1"; shift
  local g
  for g in "$@"; do
    case "$g" in
      "*.ts")            [[ "$f" == *.ts ]] && return 0 ;;
      "*.html")          [[ "$f" == *.html ]] && return 0 ;;
      "src/components/**") [[ "$f" == src/components/* ]] && return 0 ;;
      *)                 [[ "$f" == $g ]] && return 0 ;;
    esac
  done
  return 1
}

for i in $(seq 0 $((rule_count - 1))); do
  kind=$(jq -r ".rules[$i].kind" "$RULESET")
  enforced=$(jq -r ".rules[$i].enforcedBy" "$RULESET")
  [[ "$enforced" == "hook" ]] || continue

  scope=$(jq -r ".rules[$i].scope[]" "$RULESET")
  matches_scope "$FILE" $scope || continue

  id=$(jq -r ".rules[$i].id" "$RULESET")
  ref=$(jq -r ".rules[$i].ref" "$RULESET")
  sev=$(jq -r ".rules[$i].severity" "$RULESET")
  msg=$(jq -r ".rules[$i].message" "$RULESET")

  hits=""
  case "$kind" in
    regex)
      pat=$(jq -r ".rules[$i].pattern" "$RULESET")
      excl=$(jq -r ".rules[$i].excludeComments // false" "$RULESET")
      if [[ "$excl" == "true" ]]; then
        hits=$(printf '%s\n' "$NOCOMMENT" | grep -nE "$pat" | head -3)
      else
        hits=$(grep -nE "$pat" "$FILE" | head -3)
      fi
      ;;
    getdocs-unbounded)
      # Warn only if the file uses getDocs but has NO where()/limit() and no
      # explicit `unbounded-ok` annotation anywhere in the file.
      if grep -qE 'getDocs\(' "$FILE" \
         && ! grep -qE 'where\(|limit\(' "$FILE" \
         && ! grep -qi 'unbounded-ok' "$FILE"; then
        hits=$(grep -nE 'getDocs\(' "$FILE" | head -3)
      fi
      ;;
    *) continue ;;
  esac

  [[ -n "$hits" ]] || continue
  entry="[$id $ref] $msg"$'\n'"$hits"$'\n'
  if [[ "$sev" == "forbid" ]]; then
    BLOCKING="${BLOCKING}${entry}"$'\n'
  else
    WARNINGS="${WARNINGS}${entry}"$'\n'
  fi
done

# File-size rule (kind=filesize, handled specially with grandfathering).
grandfathered=$(jq -r '.grandfathered["file-size"][]? ' "$RULESET")
is_grandfathered=false
while IFS= read -r gf; do
  [[ -n "$gf" && "$FILE" == "$gf" ]] && is_grandfathered=true
done <<< "$grandfathered"

if [[ "$FILE" == *.ts ]]; then
  LINES=$(wc -l < "$FILE" | tr -d ' ')
  if [[ "$LINES" -gt "$forbid_limit" ]]; then
    if $is_grandfathered; then
      WARNINGS="${WARNINGS}[file-size §II.3] ${BASE} is ${LINES} lines (> ${forbid_limit} hard limit) — grandfathered; do not add to it, split it (WS-4)."$'\n\n'
    else
      BLOCKING="${BLOCKING}[file-size §II.3] ${BASE} is ${LINES} lines, over the ${forbid_limit}-line hard limit. Split by responsibility."$'\n\n'
    fi
  elif [[ "$LINES" -gt "$warn_limit" ]]; then
    WARNINGS="${WARNINGS}[file-size §II.3] ${BASE} is ${LINES} lines (> ${warn_limit} target) — consider splitting."$'\n\n'
  fi
fi

if [[ -n "$BLOCKING" ]]; then
  {
    echo "Constitutional check BLOCKED the edit to ${BASE} (§IV.2 / scripts/forbidden-patterns.json):"
    echo ""
    printf '%b' "$BLOCKING"
    [[ -n "$WARNINGS" ]] && { echo "Also (non-blocking):"; printf '%b' "$WARNINGS"; }
    echo "Fix the forbidden pattern(s) above, then re-apply the edit."
  } >&2
  exit 2
fi

if [[ -n "$WARNINGS" ]]; then
  echo "Constitutional check for ${BASE} (advisory):"
  printf '%b' "$WARNINGS"
fi
exit 0
