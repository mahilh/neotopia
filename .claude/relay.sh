#!/bin/bash
# NeoTopia relay v3.1 · bash .claude/relay.sh · last step of every forge
# v3.1 fixes: migration count (find vs ls) · test count (total tests not file count)

cd ~/NeoTopia 2>/dev/null || { echo "ERROR run from ~/NeoTopia"; exit 1; }

# Detect which terminal from recent changes
T_NUM="T?"
RECENT=$(git diff --name-only HEAD~1 HEAD 2>/dev/null)
if echo "$RECENT" | grep -qE "^src/components|^src/pages|^src/App|^src/utils|^src/index"; then T_NUM="T1"; fi
if echo "$RECENT" | grep -qE "^src/lib|^src/store|^scripts|^migrations|^api"; then T_NUM="T2"; fi
if echo "$RECENT" | grep -qE "useGameRoom|useGameSync|usePresence|tests/e2e|bot-health"; then T_NUM="T3"; fi

printf "\u2554===========================================================\u2557\n"
printf "\u2551  PASTE TO NEOTOPIA AI:  %s AUTODRIVE!                    \u2551\n" "$T_NUM"
printf "\u2551  Copy this entire block from here to END RELAY below       \u2551\n"
printf "\u2560===========================================================\u2563\n"
printf "\u2551  RELAY v3.1  %-43s\u2551\n" "$(date '+%Y-%m-%d %H:%M PKT')"
printf "\u255a===========================================================\u255d\n\n"

printf "\n-- GIT LOG (last 8 commits) ------------------------------------\n"
git log --oneline -8

printf "\n-- SYNC STATUS -------------------------------------------------\n"
git pull --quiet 2>&1 | grep -v "^Already up to date" | grep -v "^$" | head -3
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "HEAD = origin/main: $LOCAL"
else
  echo "WARNING: LOCAL ($LOCAL) != REMOTE ($REMOTE)"
fi

printf "\n-- THIS SESSION CHANGES (diff from HEAD~1) ----------------------\n"
git diff --stat HEAD~1 HEAD 2>/dev/null | tail -10

printf "\n-- TESTS (vitest) ----------------------------------------------\n"
# v3.2 (T2 S37) · COUNT FROM THE MACHINE-READABLE REPORT, AND RUN SERIAL.
# Two separate bugs lived here. (1) FILE_COUNT grepped for "test files"; vitest v4 prints "Test Files",
# so it matched nothing and the footer has been printing "Files: " BLANK, silently, for every session.
# (2) the run was parallel, and Rule 77 says a suite run on a loaded machine measures the machine · the
# relay is the thing every terminal reads at close, so it is the last place that should report a number
# that moves with load. --no-file-parallelism costs ~30s and buys a figure that means something.
# Parsing prose was the root cause of both; --reporter=json is a contract rather than a sentence.
TEST_OUT=$(npx vitest run --no-file-parallelism --reporter=json --reporter=default \
  --outputFile.json=/tmp/neotopia-relay-vitest.json 2>&1)
echo "$TEST_OUT" | tail -8
FAILING=$(echo "$TEST_OUT" | grep -E " FAIL | × " | grep -v "Tests" | head -10)
if [ -n "$FAILING" ]; then
  printf "\n  FAILING TESTS:\n"
  echo "$FAILING" | while read line; do echo "  ! $line"; done
fi
# A counter that cannot measure must SAY SO rather than resolve to a number. "0" and "" are both
# indistinguishable from a true reading, which is this project's signature bug (a writer resting at a
# plausible value) wearing a shell-script costume.
read -r PASS_COUNT FAIL_COUNT FILE_COUNT <<EOF
$(node -e '
  const fs = require("fs");
  try {
    const r = JSON.parse(fs.readFileSync("/tmp/neotopia-relay-vitest.json", "utf8"));
    const t = r.testResults || [];
    console.log(r.numPassedTests, r.numFailedTests, t.length);
  } catch (e) { console.log("UNMEASURED UNMEASURED UNMEASURED"); }
' 2>/dev/null || echo "UNMEASURED UNMEASURED UNMEASURED")
EOF
echo "Summary: Tests=$PASS_COUNT passed | Files=$FILE_COUNT | Failed=$FAIL_COUNT  (serial · Rule 77)"
[ "$PASS_COUNT" = "UNMEASURED" ] && echo "  !! vitest produced no JSON report · the counts below are NOT a reading"

printf "\n-- BUILD -------------------------------------------------------\n"
BUILD_OUT=$(npm run build 2>&1)
echo "$BUILD_OUT" | tail -5
BUILD_WARNS=$(echo "$BUILD_OUT" | grep -iE "warn" | grep -v "^$" | head -5)
if [ -n "$BUILD_WARNS" ]; then
  echo "  WARNINGS:"
  echo "$BUILD_WARNS" | while read w; do echo "  W: $w"; done
fi

printf "\n-- BUNDLE SIZE -------------------------------------------------\n"
if [ -d dist/assets ]; then
  TOTAL_KB=$(ls dist/assets/*.js 2>/dev/null | xargs wc -c 2>/dev/null | tail -1 | awk '{printf "%.1f", $1/1024}')
  echo "Total JS: ${TOTAL_KB}KB"
  ls dist/assets/*.js 2>/dev/null | awk -F'/' '{print $NF}' | while read f; do
    SIZE=$(wc -c < "dist/assets/$f" 2>/dev/null | awk '{printf "%.0f", $1/1024}')
    echo "  $f: ${SIZE}KB"
  done | head -8
else
  echo "(no dist/ yet)"
fi

printf "\n-- ART STATUS --------------------------------------------------\n"
# v3.2 (T2 S37) · this one currently reads CORRECTLY (20), and is hardened anyway because it is the
# counter with the worst history: it reported 0/56 for about fifteen sessions while 20 PNGs sat in this
# exact directory, and the deck was planned around a number that was never true. The `2>/dev/null` is
# the same swallow that hid the migrations path · a missing directory and an empty one are different
# facts and only one of them is "no art has been made yet".
if [ ! -d public/art/cards ]; then
  ART_COUNT="UNMEASURED"
  echo "!! public/art/cards does not exist · this is NOT the same as 0/56"
else
  ART_COUNT=$(find public/art/cards -maxdepth 1 -name 'card_*.png' | wc -l | tr -d ' ')
  echo "${ART_COUNT}/56 card art files"
fi
if [ "$ART_COUNT" -gt 0 ] 2>/dev/null; then
  echo "Cards with art:"
  ls public/art/cards/card_*.png 2>/dev/null | xargs -I{} basename {} .png | tr '\n' ' '
  echo
fi
echo "Missing priority 2pt (01-12):"
for i in $(seq 1 12); do
  F="public/art/cards/card_$(printf '%02d' $i).png"
  [ ! -f "$F" ] && echo -n "card_$(printf '%02d' $i) "
done
echo

printf "\n-- MIGRATION STATUS --------------------------------------------\n"
# v3.2 (T2 S37) · IT WAS LOOKING IN A DIRECTORY THAT DOES NOT EXIST.
# The migrations live in scripts/migrations/, not migrations/. `find migrations/ ... 2>/dev/null`
# suppressed the "No such file or directory" that would have said so and piped nothing into wc, so the
# relay has reported "Migrations: 0" against 20 real .sql files. The 2>/dev/null was the bug: "handles
# an empty dir gracefully" and "hides a wrong path" are the same line of code.
# Resolve the path instead of assuming it, and distinguish NO DIRECTORY from NO FILES.
MIG_DIR=""
for d in scripts/migrations migrations supabase/migrations; do
  [ -d "$d" ] && MIG_DIR="$d" && break
done
if [ -z "$MIG_DIR" ]; then
  MIG_COUNT="UNMEASURED"
  echo "!! no migrations directory found (looked in scripts/migrations, migrations, supabase/migrations)"
else
  MIG_COUNT=$(find "$MIG_DIR" -name "*.sql" | wc -l | tr -d ' ')
  echo "${MIG_COUNT} migration files in ${MIG_DIR}:"
  find "$MIG_DIR" -name "*.sql" | sort | xargs -I{} basename {} | head -25
fi

printf "\n-- ANTI-REGRESS RULE COUNT -------------------------------------\n"
# v3.2 (T2 S37) · IT ONLY KNEW ONE OF THE TWO FORMATS A RULE IS WRITTEN IN.
# Rules 1-69 are indented list items ("  12. ..."); rules 70+ are block headers ("RULE 78 (T1 S36 ...)").
# The old grep matched the first form only, so it has reported 69 while CLAUDE.md carried 78 · and it
# would keep reporting 69 no matter how many more were added, because every new rule uses the second
# form. A counter that is frozen at a plausible number is worse than one that is obviously broken.
# Count the union of both forms as a SET of numbers, so a duplicate cannot inflate it.
RULE_COUNT=$(grep -oE "^ *(RULE )?[0-9]+[.( ]" .claude/CLAUDE.md 2>/dev/null \
  | grep -oE '[0-9]+' | sort -n -u | wc -l | tr -d ' ')
RULE_MAX=$(grep -oE "^ *(RULE )?[0-9]+[.( ]" .claude/CLAUDE.md 2>/dev/null \
  | grep -oE '[0-9]+' | sort -n | tail -1)
[ -z "$RULE_COUNT" ] || [ "$RULE_COUNT" = "0" ] && RULE_COUNT="UNMEASURED"
echo "${RULE_COUNT} permanent rules in CLAUDE.md (highest number: ${RULE_MAX:-none})"
# A gap or a reused number means the list disagrees with itself · surface it rather than average it away.
if [ "$RULE_COUNT" != "UNMEASURED" ] && [ -n "$RULE_MAX" ] && [ "$RULE_COUNT" != "$RULE_MAX" ]; then
  echo "  !! count ${RULE_COUNT} != highest ${RULE_MAX} · the rule numbering has a gap or a duplicate"
fi

printf "\n-- ANTI-REGRESS VIOLATION SCAN ---------------------------------\n"
VIOLS=$(grep -rn "git add -A\|window.confirm\|Math.random()" src/ scripts/ 2>/dev/null | grep -v "node_modules" | head -5)
if [ -n "$VIOLS" ]; then
  echo "WARNING - Potential violations found:"
  echo "$VIOLS" | while read v; do echo "  VIOL: $v"; done
else
  echo "No Rule 1/3/32 violations detected in src/"
fi

printf "\n-- HOT FILES (modified recently) -------------------------------\n"
find src migrations scripts -newer .claude/CLAUDE.md \( -name "*.jsx" -o -name "*.js" -o -name "*.sql" \) 2>/dev/null | sort | head -15
HOT_COUNT=$(find src migrations scripts -newer .claude/CLAUDE.md \( -name "*.jsx" -o -name "*.js" -o -name "*.sql" \) 2>/dev/null | wc -l | tr -d ' ')
echo "(${HOT_COUNT} hot files)"

printf "\n-- CROSS-TERMINAL COLLISION CHECK ------------------------------\n"
GIT_STATUS=$(git status --short)
if [ -n "$GIT_STATUS" ]; then
  echo "$GIT_STATUS" | head -15
  CONFLICT=$(echo "$GIT_STATUS" | grep -E "^UU|^AA" | head -5)
  [ -n "$CONFLICT" ] && echo "MERGE CONFLICT: $CONFLICT"
else
  echo "Working tree clean"
fi

printf "\n-- SCREENSHOT COUNT (Rule 55) ----------------------------------\n"
SSHOT_COUNT=$(ls tmp/.playwright-mcp/page-*.yml 2>/dev/null | wc -l | tr -d ' ')
echo "${SSHOT_COUNT} screenshots this session"
[ "$SSHOT_COUNT" -eq 0 ] 2>/dev/null && echo "WARNING: 0 screenshots — Rule 55 requires screenshot for every visual task"

printf "\n-- BOT HEALTH (Rule 53) ----------------------------------------\n"
LATEST_REPORT=$(ls -t .bot-reports/report-*.json 2>/dev/null | head -1)
if [ -n "$LATEST_REPORT" ]; then
  node -e "
    const fs=require('fs');
    const r=JSON.parse(fs.readFileSync('$LATEST_REPORT'));
    const s=r.summary;
    console.log('Bot v'+r.botVersion);
    console.log('Proxy: '+s.totalPlacedProxy+' | DB: '+s.totalPlacedDB+' | Verified: '+s.dbVerified);
    if(s.totalPlacedProxy!==s.totalPlacedDB) console.log('MISMATCH: proxy '+s.totalPlacedProxy+' vs DB '+s.totalPlacedDB);
  " 2>/dev/null || echo "(error reading report)"
else
  echo "(no reports yet)"
fi

printf "\n-- COMMS (filesystem-local, NEVER committed) -------------------\n"
cat .claude/comms/tomorrow.md 2>/dev/null | tail -80 || echo "(empty)"
COMMS_STATUS=$(git status --short .claude/comms/ 2>/dev/null)
if echo "$COMMS_STATUS" | grep -q "^A"; then
  echo "CRITICAL: comms is STAGED. Run: git restore --staged .claude/comms/"
fi

printf "\n-- SOURCE FILE MAP (T1/T2/T3 lanes) ---------------------------\n"
echo "T1 lane:"
find src/components src/pages -name "*.jsx" 2>/dev/null | sort | head -12
echo ""
echo "T2 lane:"
find src/lib src/store migrations -name "*.js" -o -name "*.sql" 2>/dev/null | sort | head -15
echo ""
echo "T3 lane:"
find src/hooks -name "*.js" 2>/dev/null | sort
find tests/e2e -name "*.js" 2>/dev/null | sort

printf "\n== NEOTOPIA STATUS SUMMARY ====================================\n"
echo "Stage: 2 of 5 | Art: ${ART_COUNT}/56 | Rules: ${RULE_COUNT} | Migrations: ${MIG_COUNT}"
echo "Tests: $PASS_COUNT | Files: $FILE_COUNT | Screenshots: ${SSHOT_COUNT} | Hot: ${HOT_COUNT}"
echo ""

printf "\n\u2554===========================================================\u2557\n"
printf "\u2551  END RELAY · Paste above to NeoTopia AI                     \u2551\n"
printf "\u2551  Prefix: %-50s\u2551\n" "$T_NUM AUTODRIVE!"
printf "\u255a===========================================================\u255d\n"
