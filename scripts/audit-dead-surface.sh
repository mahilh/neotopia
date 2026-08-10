#!/bin/bash
# T2 S39 · WHO ACTUALLY CALLS EACH EXPORTED SYMBOL · re-runnable, and corrected.
#
# S38 ran this by hand and got two of five wrong, because it scanned only src/ api/ scripts/ and treated
# everything under tests/ as noise. That is wrong in one specific and important way: a UNIT test calling a
# function proves nothing about whether the function is needed, but an E2E SPEC THAT RUNS IN CI is a real
# consumer · deleting the symbol breaks the merge gate. factoryRefill and getFinalScore were both filed as
# dead on that basis and both are driven by specs that gate merges today.
#
# So references are classified into three buckets, not two:
#   PRODUCT  · src/ api/ scripts/, excluding test files · the only bucket that means "the app uses this"
#   CI-E2E   · tests/e2e/*.e2e.js that appear in a .github workflow · a real consumer, in CI
#   UNIT     · everything else under tests/ and *.test.* · proves the symbol is exercised, not that it is wanted
#
# A symbol with PRODUCT=0 and CI-E2E=0 is dead. A symbol with PRODUCT=0 and CI-E2E>0 is TEST-SUPPORT API:
# keep it, and say so, rather than rediscovering it as dead every few sessions.
#
# Usage: bash scripts/audit-dead-surface.sh
set -u
cd "$(dirname "$0")/.." || exit 1

# Which e2e specs actually run somewhere? (Rule 79 · a spec in no workflow is not a consumer either.)
WIRED=""
for f in tests/e2e/*.e2e.js; do
  b=$(basename "$f")
  grep -qs "$b" .github/workflows/*.yml && WIRED="$WIRED $f"
done

SYMS=$(
  { grep -hoE "^export (async )?function [a-zA-Z0-9_]+" src/lib/*.js | awk '{print $NF}'
    grep -hoE "^export const [a-zA-Z0-9_]+" src/lib/*.js | awk '{print $NF}'
    grep -oE "^  [a-zA-Z][a-zA-Z0-9_]*: \(" src/store/gameStore.js | sed 's/[ :(]//g'
  } | sort -u | grep -vE '^(supabase|_runTests)$'
)

printf "%-34s %-8s %-8s %-6s %s\n" SYMBOL PRODUCT CI-E2E UNIT VERDICT
printf "%-34s %-8s %-8s %-6s %s\n" "------" "-------" "------" "----" "-------"
dead=0
for s in $SYMS; do
  # Exclude THIS FILE. Its own header names symbols as examples, so without this the audit reads its
  # own documentation as a caller and reports them used · which it did, on the first run, plausibly
  # enough that it took a hand-check to catch (Rule 75b · a probe is a claim).
  prod=$(grep -rn "\b$s\b" src api scripts 2>/dev/null \
         | grep -v "scripts/audit-dead-surface.sh" \
         | grep -vE "\.test\.|\.spec\." \
         | grep -vE "(export (async )?function $s|export const $s|^src/store/gameStore\.js:[0-9]+:  $s:)" \
         | grep -vE ":[0-9]+: *(//|\*)" | grep -c .)
  ci=0
  [ -n "$WIRED" ] && ci=$(grep -l "\b$s\b" $WIRED 2>/dev/null | grep -c .)
  unit=$(grep -rln "\b$s\b" src tests 2>/dev/null | grep -E "\.test\.|\.spec\." | grep -c .)
  if [ "$prod" -gt 0 ]; then v="used"
  elif [ "$ci" -gt 0 ]; then v="TEST-SUPPORT (CI e2e drives it · keep)"
  else v="DEAD"; dead=$((dead+1)); fi
  [ "$prod" -eq 0 ] && printf "%-34s %-8s %-8s %-6s %s\n" "$s" "$prod" "$ci" "$unit" "$v"
done
echo
echo "$dead symbol(s) with no product and no CI-e2e consumer."
echo "NOTE a zero can be a FALSE positive: an RPC invoked as a string through supabase.rpc() reads as"
echo "uncalled (record_civilization_score did). Verify every zero by hand · Rule 69."
