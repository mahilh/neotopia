#!/bin/bash
# T2 S37 · TEETH CHECK for the relay's four counters.
# A counter that reports a plausible number when it cannot measure is the bug we are fixing, so the
# question is not "does it print 78" but "does it NOTICE when the thing it counts is gone".
# Each case breaks ONE input in a scratch copy and asserts the counter says UNMEASURED or flags a gap.
set -u
cd /Users/mahilhussain/NeoTopia
W=/private/tmp/claude-501/-Users-mahilhussain-NeoTopia/7a6a4837-c725-4028-8b4e-bddac33c31bb/scratchpad/teeth
rm -rf "$W"; mkdir -p "$W"
pass=0; fail=0
check() { # name expected actual
  if [ "$3" = "$2" ]; then echo "  TEETH OK   $1 -> $3"; pass=$((pass+1))
  else echo "  TEETH FAIL $1 -> got '$3', wanted '$2'"; fail=$((fail+1)); fi
}

# 1 · RULES · the old regex frozen at 69, and a CLAUDE.md that is gone entirely.
cp .claude/CLAUDE.md "$W/rules-ok.md"
grep -v '^RULE ' .claude/CLAUDE.md > "$W/rules-headers-lost.md"   # simulate the OLD list-only reading
rc() { grep -oE "^ *(RULE )?[0-9]+[.( ]" "$1" 2>/dev/null | grep -oE '[0-9]+' | sort -n -u | wc -l | tr -d ' '; }
rm_() { grep -oE "^ *(RULE )?[0-9]+[.( ]" "$1" 2>/dev/null | grep -oE '[0-9]+' | sort -n | tail -1; }
check "rules · intact"            "78"  "$(rc "$W/rules-ok.md")"
check "rules · headers deleted"   "69"  "$(rc "$W/rules-headers-lost.md")"
# and the gap detector must FIRE on that mutant (count 69 != max 69? no · max also drops).
# The sharper mutant: delete rule 50 from the middle so count and max disagree.
grep -v '^  50\. ' .claude/CLAUDE.md > "$W/rules-gap.md"
G_C=$(rc "$W/rules-gap.md"); G_M=$(rm_ "$W/rules-gap.md")
if [ "$G_C" != "$G_M" ]; then echo "  TEETH OK   rules · gap detector fires ($G_C != $G_M)"; pass=$((pass+1));
else echo "  TEETH FAIL rules · gap detector silent"; fail=$((fail+1)); fi
# missing file entirely
check "rules · file absent"       "0"   "$(rc "$W/nope.md")"

# 2 · MIGRATIONS · the exact historical bug, a path that does not exist.
mig() { D=""; for d in "$1/scripts/migrations" "$1/migrations" "$1/supabase/migrations"; do [ -d "$d" ] && D="$d" && break; done
        [ -z "$D" ] && echo "UNMEASURED" || find "$D" -name '*.sql' | wc -l | tr -d ' '; }
mkdir -p "$W/repo-ok/scripts/migrations"; touch "$W/repo-ok/scripts/migrations/001_a.sql" "$W/repo-ok/scripts/migrations/002_b.sql"
mkdir -p "$W/repo-nodir"
mkdir -p "$W/repo-empty/scripts/migrations"
check "migrations · 2 real files"   "2"           "$(mig "$W/repo-ok")"
check "migrations · NO directory"   "UNMEASURED"  "$(mig "$W/repo-nodir")"
check "migrations · empty dir is 0" "0"           "$(mig "$W/repo-empty")"

# 3 · ART · a genuinely empty dir must read 0, a MISSING dir must not.
art() { [ ! -d "$1" ] && echo "UNMEASURED" || find "$1" -maxdepth 1 -name 'card_*.png' | wc -l | tr -d ' '; }
mkdir -p "$W/art-empty"; mkdir -p "$W/art-three"; touch "$W/art-three/card_01.png" "$W/art-three/card_02.png" "$W/art-three/card_03.png"
check "art · 3 files"        "3"           "$(art "$W/art-three")"
check "art · empty dir"      "0"           "$(art "$W/art-empty")"
check "art · missing dir"    "UNMEASURED"  "$(art "$W/art-gone")"

# 4 · TESTS · the JSON report absent or corrupt must not resolve to a number.
tc() { node -e '
  const fs=require("fs");
  try { const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(r.numPassedTests,(r.testResults||[]).length); }
  catch(e){ console.log("UNMEASURED UNMEASURED"); }' "$1" 2>/dev/null || echo "UNMEASURED UNMEASURED"; }
echo '{"numPassedTests":507,"numFailedTests":0,"testResults":[{},{}]}' > "$W/vitest-ok.json"
echo 'not json at all' > "$W/vitest-corrupt.json"
check "tests · valid report"   "507 2"                 "$(tc "$W/vitest-ok.json")"
check "tests · corrupt report" "UNMEASURED UNMEASURED" "$(tc "$W/vitest-corrupt.json")"
check "tests · absent report"  "UNMEASURED UNMEASURED" "$(tc "$W/vitest-missing.json")"

# 5 · THE DRIFT GUARD, and the reason it exists.
# Everything above re-implements the relay's counter logic rather than calling it · relay.sh is a linear
# script with no functions to source, so there are now TWO copies of each rule. That is a second contract
# (Rule 45) and it is exactly the shape this suite is meant to police: these tests would keep passing
# while relay.sh regressed underneath them, which would make this file a green tick proving nothing ·
# the same pathology as a spec that runs in no workflow.
# Refactoring relay.sh into sourceable functions is the real fix and is deliberately NOT done here (it is
# a bigger change than the bug warrants tonight). Until then, assert that each fixed pattern is still
# present in the real file, so a divergence is loud rather than silent.
R=.claude/relay.sh
for pat in \
  'no-file-parallelism' \
  'outputFile.json' \
  'numPassedTests' \
  'scripts/migrations migrations supabase/migrations' \
  'RULE )?\[0-9\]+' \
  'public/art/cards does not exist'
do
  if grep -qF -- "$(printf '%s' "$pat" | sed 's/\\//g')" "$R" 2>/dev/null || grep -qE -- "$pat" "$R" 2>/dev/null; then
    echo "  TEETH OK   relay.sh still carries: $pat"; pass=$((pass+1))
  else
    echo "  TEETH FAIL relay.sh LOST: $pat · the tests above are now testing a copy, not the relay"; fail=$((fail+1))
  fi
done

echo
echo "TEETH: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
