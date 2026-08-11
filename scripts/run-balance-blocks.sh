#!/usr/bin/env bash
# NeoTopia · THE BALANCE TABLE GETS A RUNNER  (T2 S48)
#
# WHY THIS EXISTS. Every number in docs/BONUS_TOKEN_BALANCE.md came from a block someone ran by hand
# and then typed into a document. The committed gates run a SIXTH of that (spendableBalance gates 12
# seeds against a reported 40), so they will stay green forever while the doc drifts · which is a
# citation with no runner, Rule 97, inside my own harness. I logged it as debt in the S47 roadmap and
# this is the discharge.
#
# WHAT IT DOES: runs each balance experiment across DISJOINT seed blocks and appends every result to
# one JSONL file, each line STAMPED WITH THE COMMIT it was measured at. A stamp is the whole point ·
# T3's S34 load experiment was confounded because treatment and control came from two different trees
# (Rule 74), and a table whose rows cannot name their commit cannot rule that out.
#
#   ./scripts/run-balance-blocks.sh [blocks] [seeds] [outfile]
#   ./scripts/run-balance-blocks.sh 3 40                # the reported block size
#   ./scripts/run-balance-blocks.sh 1 12                # smoke
#
# Serial by construction (--no-file-parallelism): a suite run on a loaded machine measures the machine
# (Rule 77), and these are wall-clock-insensitive but CPU-hungry.

set -euo pipefail
cd "$(dirname "$0")/.."

BLOCKS="${1:-3}"
SEEDS="${2:-40}"
OUT="${3:-.balance-reports/blocks.jsonl}"

HEAD_SHA="$(git rev-parse --short HEAD)"
# DIRTY MATTERS AND MUST BE RECORDED, not silently ignored. A measurement taken on an uncommitted tree
# cannot be reproduced from its stamp, and the stamp would claim otherwise (Rule 67 · gate what is true
# WHERE the gate runs). Reported rather than refused, because the useful time to run this is while
# iterating.
if [ -n "$(git status --porcelain -- src/ scripts/)" ]; then TREE="dirty"; else TREE="clean"; fi

mkdir -p "$(dirname "$OUT")"
: > "$OUT"

echo "── balance blocks · HEAD $HEAD_SHA ($TREE) · $BLOCKS blocks x $SEEDS seeds ─────────────────"

RAW="$(mktemp)"
trap 'rm -f "$RAW"' EXIT

for b in $(seq 0 $((BLOCKS - 1))); do
  OFFSET=$((b * SEEDS))
  echo "  block $b · seed offset $OFFSET"

  # ONE TEMP FILE PER EXPERIMENT, so every row can name the file that produced it. The first version
  # pointed all three at one temp file, and two rows per block came out with NO label at all ·
  # bonusBalance and spendableBalance's headline test append a bare object, only the S47/S48 REPORT()
  # helper adds one. An unattributable row in a stamped archive is barely better than no row, and the
  # workflow's `grep '"label"'` guard passed anyway because its NEIGHBOURS had labels. Attribution
  # belongs to the runner, which knows what it invoked, rather than to the emitter, which does not
  # have to cooperate (Rule 95b · say what was measured, in the output, not in someone's memory).
  : > "$RAW"
  emit() {  # emit <source-file> <env-var-name> <spec>
    local src="$1" var="$2" spec="$3" tmp; tmp="$(mktemp)"
    # SPACING_FULL=1 unlocks ladderSpacing's two heavy derivation sections, which are skipped on the
    # merge gate because they play ~500 games each (T2 S50). SPACING_SEEDS is passed for the same
    # reason every other seed var is: the evenness assertion is a RATE comparison and refuses to run
    # below 40 seeds rather than silently reporting a number its block cannot support.
    env "$var=$tmp" SEED_OFFSET="$OFFSET" BALANCE_SEEDS="$SEEDS" SPEND_SEEDS="$SEEDS" \
        SPACING_SEEDS="$SEEDS" SPACING_FULL=1 \
        npx vitest run "$spec" --no-file-parallelism >/dev/null 2>&1 || true
    if [ -s "$tmp" ]; then
      while IFS= read -r line; do
        printf '%s\n' "$line" | SRC="$src" HEAD_SHA="$HEAD_SHA" TREE="$TREE" \
          SEEDS="$SEEDS" OFFSET="$OFFSET" python3 -c "
import json, os, sys
o = json.loads(sys.stdin.read())
o.setdefault('label', os.environ['SRC'])          # a bare row inherits its source as its label
o['source'] = os.environ['SRC']                   # and always carries where it came from
o['head'] = os.environ['HEAD_SHA']; o['tree'] = os.environ['TREE']
o['seeds'] = int(os.environ['SEEDS']); o['offset'] = int(os.environ['OFFSET'])
print(json.dumps(o))
" >> "$OUT"
      done < "$tmp"
      cat "$tmp" >> "$RAW"
    else
      # PER-EXPERIMENT, NOT PER-BLOCK. The first version only noticed a block that emitted NOTHING, so
      # a block where two of three experiments died looked identical to a complete one · it just had
      # fewer rows, and nothing counts rows it never expected. Found by running the smoke: at 3 seeds
      # two harnesses fail a counterweight BEFORE their REPORT line and vanished silently while the
      # summary cheerfully printed "4 rows". A missing source must name itself (Rule 80).
      printf '{"label":"UNMEASURED","source":"%s","head":"%s","tree":"%s","seeds":%s,"offset":%s,"note":"this experiment emitted no rows · it failed before REPORT or did not run. NOT a zero."}\n' \
        "$src" "$HEAD_SHA" "$TREE" "$SEEDS" "$OFFSET" >> "$OUT"
    fi
    rm -f "$tmp"
  }

  emit bonusBalance     BALANCE_OUT src/store/bonusBalance.test.js
  emit spendableBalance SPEND_OUT   src/store/spendableBalance.test.js
  emit flatGrant        SPEND_OUT   src/store/flatGrantBalance.test.js
  # T2 S50 · the ladder retune's derivation. Wired here rather than left standalone because a spec in
  # no workflow cannot report its own rot (Rule 79) · and the two sections this unlocks are precisely
  # the ones the merge gate skips, so without this line they would run NOWHERE.
  emit ladderSpacing    SPACING_OUT src/store/ladderSpacing.test.js

  # `|| true` inside emit is deliberate · a red assertion still writes its REPORT and that row is
  # evidence. It is also why the NEXT branch matters: a block that produced nothing must be visible as
  # nothing rather than silently skipped (Rule 80 · unmeasured is not zero).
  if [ -s "$RAW" ]; then
    :
  else
    printf '{"label":"UNMEASURED","head":"%s","tree":"%s","seeds":%s,"offset":%s,"note":"the block emitted no rows · a harness died before REPORT, this is not a zero"}\n' \
      "$HEAD_SHA" "$TREE" "$SEEDS" "$OFFSET" >> "$OUT"
  fi
done

echo
echo "── $(wc -l < "$OUT" | tr -d ' ') rows → $OUT ──"
python3 - "$OUT" <<'PY'
import json, sys, collections
rows = [json.loads(l) for l in open(sys.argv[1])]
by = collections.Counter(r.get('label', '?') for r in rows)
for label, n in sorted(by.items()):
    print(f"  {label:<22} {n} block(s)")
unm = [r for r in rows if r.get('label') == 'UNMEASURED']
if unm:
    print(f"\n  ⚠ {len(unm)} block(s) produced NO rows · investigate before reading the table")
PY
