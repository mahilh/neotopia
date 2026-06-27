#!/bin/bash
# NeoTopia relay v3.0 · bash .claude/relay.sh · last step of every forge
# AUTODRIVE! upgrade: maximally informative output for NeoTopia AI
# New in v3.0: failing test names · bundle size · art scan · hot files ·
#              anti-regress violation scan · migration count · rule count ·
#              cross-terminal collision detection · screenshot count

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
printf "\u2551  RELAY v3.0  %-43s\u2551\n" "$(date '+%Y-%m-%d %H:%M PKT')"
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
TEST_OUT=$(npx vitest run 2>&1)
echo "$TEST_OUT" | tail -8
FAILING=$(echo "$TEST_OUT" | grep -E "FAIL|Error:|AssertionError" | grep -v "Tests" | head -10)
if [ -n "$FAILING" ]; then
  printf "\n  FAILING TESTS:\n"
  echo "$FAILING" | while read line; do echo "  ! $line"; done
fi
PASS_COUNT=$(echo "$TEST_OUT" | grep -oE '[0-9]+ passed' | head -1)
FAIL_COUNT=$(echo "$TEST_OUT" | grep -oE '[0-9]+ failed' | head -1)
echo "Summary: $PASS_COUNT / $FAIL_COUNT"

printf "\n-- BUILD -------------------------------------------------------\n"
BUILD_OUT=$(npm run build 2>&1)
echo "$BUILD_OUT" | tail -5
BUILD_WARNS=$(echo "$BUILD_OUT" | grep -i "warn" | grep -v "^$" | head -5)
if [ -n "$BUILD_WARNS" ]; then
  echo "  WARNINGS:"
  echo "$BUILD_WARNS" | while read w; do echo "  W: $w"; done
fi

printf "\n-- BUNDLE SIZE -------------------------------------------------\n"
if [ -d dist/assets ]; then
  TOTAL_KB=$(ls dist/assets/*.js 2>/dev/null | xargs wc -c 2>/dev/null | tail -1 | awk '{printf "%.1f", $1/1024}')
  EAGER_KB=$(ls dist/assets/index-*.js 2>/dev/null | xargs wc -c 2>/dev/null | tail -1 | awk '{printf "%.1f", $1/1024}')
  echo "Total JS: ${TOTAL_KB}KB | Eager (index): ${EAGER_KB}KB"
  ls dist/assets/*.js 2>/dev/null | awk -F'/' '{print $NF}' | while read f; do
    SIZE=$(wc -c < "dist/assets/$f" 2>/dev/null | awk '{printf "%.0f", $1/1024}')
    echo "  $f: ${SIZE}KB"
  done | head -8
else
  echo "(no dist/ -- run npm run build first)"
fi

printf "\n-- ART STATUS --------------------------------------------------\n"
ART_COUNT=$(ls public/art/cards/card_*.png 2>/dev/null | wc -l | tr -d ' ')
echo "${ART_COUNT}/56 card art files exist"
if [ "$ART_COUNT" -gt 0 ] 2>/dev/null; then
  echo "Cards with art:"
  ls public/art/cards/card_*.png 2>/dev/null | xargs -I{} basename {} .png | tr '\n' ' '
  echo
fi
if [ "$ART_COUNT" -lt 56 ] 2>/dev/null; then
  echo "Missing (first 12 priority):"
  for i in $(seq 1 12); do
    F="public/art/cards/card_$(printf '%02d' $i).png"
    [ ! -f "$F" ] && echo -n "card_$(printf '%02d' $i) "
  done
  echo
fi

printf "\n-- MIGRATION STATUS --------------------------------------------\n"
MIG_COUNT=$(ls migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "${MIG_COUNT} migration files:"
ls migrations/*.sql 2>/dev/null | xargs -I{} basename {} | head -15

printf "\n-- ANTI-REGRESS RULE COUNT -------------------------------------\n"
RULE_COUNT=$(grep -c '^  [0-9][0-9]*\.' .claude/CLAUDE.md 2>/dev/null || echo 0)
echo "${RULE_COUNT} permanent rules in CLAUDE.md"

printf "\n-- ANTI-REGRESS VIOLATION SCAN ---------------------------------\n"
VIOLS=$(grep -rn "git add -A\|window.confirm\|Math.random()" src/ scripts/ 2>/dev/null | grep -v "node_modules" | head -5)
if [ -n "$VIOLS" ]; then
  echo "WARNING - Potential violations found:"
  echo "$VIOLS" | while read v; do echo "  VIOL: $v"; done
else
  echo "No Rule 1/3/32 violations detected in src/"
fi

printf "\n-- HOT FILES (changed in last 30 min) -------------------------\n"
find src migrations scripts -newer .claude/CLAUDE.md -name "*.jsx" -o -newer .claude/CLAUDE.md -name "*.js" -o -newer .claude/CLAUDE.md -name "*.sql" 2>/dev/null | sort | head -15
HOT_COUNT=$(find src migrations scripts -newer .claude/CLAUDE.md -name "*.jsx" -o -newer .claude/CLAUDE.md -name "*.js" 2>/dev/null | wc -l | tr -d ' ')
echo "(${HOT_COUNT} hot files)"

printf "\n-- CROSS-TERMINAL COLLISION CHECK ------------------------------\n"
GIT_STATUS=$(git status --short)
if [ -n "$GIT_STATUS" ]; then
  echo "$GIT_STATUS" | head -15
  CONFLICT=$(echo "$GIT_STATUS" | grep -E "^UU|^AA" | head -5)
  [ -n "$CONFLICT" ] && echo "MERGE CONFLICT DETECTED: $CONFLICT"
else
  echo "Working tree clean"
fi

printf "\n-- SCREENSHOT COUNT (Rule 55) ----------------------------------\n"
SSHOT_COUNT=$(ls tmp/.playwright-mcp/page-*.yml 2>/dev/null | wc -l | tr -d ' ')
echo "${SSHOT_COUNT} screenshots taken this session"
if [ "$SSHOT_COUNT" -eq 0 ] 2>/dev/null; then
  echo "WARNING: 0 screenshots -- Rule 55 requires screenshot for every visual task"
fi
ls tmp/.playwright-mcp/page-*.yml 2>/dev/null | tail -5 | xargs -I{} basename {} 2>/dev/null

printf "\n-- BOT HEALTH (Rule 53: DB is truth, not proxy) ----------------\n"
LATEST_REPORT=$(ls -t .bot-reports/report-*.json 2>/dev/null | head -1)
if [ -n "$LATEST_REPORT" ]; then
  node -e "
    const fs=require('fs');
    const r=JSON.parse(fs.readFileSync('$LATEST_REPORT'));
    const s=r.summary;
    console.log('Bot v'+r.botVersion);
    console.log('Proxy placed: '+s.totalPlacedProxy+' | DB placed: '+s.totalPlacedDB+' | DB verified: '+s.dbVerified);
    console.log('Drew: '+s.totalDrew+' | Errors: '+s.totalErrors+' | Errors by type:', JSON.stringify(s.errorTypes||{}));
    console.log('Games: '+r.results.length+' | Placements per game:', r.results.map(g=>g.placed||0).join(','));
    if(s.totalPlacedProxy !== s.totalPlacedDB) console.log('MISMATCH: proxy '+s.totalPlacedProxy+' vs DB '+s.totalPlacedDB);
    console.log('Report: $LATEST_REPORT');
  " 2>/dev/null || echo "(error reading report)"
else
  echo "(no bot reports yet)"
  echo "Run: BOT_GAMES=1 BOT_TURNS=20 BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js"
fi

printf "\n-- COMMS (filesystem-local, NEVER committed) -------------------\n"
cat .claude/comms/tomorrow.md 2>/dev/null | tail -80 || echo "(empty)"
COMMS_STATUS=$(git status --short .claude/comms/ 2>/dev/null)
if [ -n "$COMMS_STATUS" ]; then
  echo "GIT STATUS OF COMMS: $COMMS_STATUS"
  echo "If M or ?? shows: good (untracked/modified = correct behavior)"
  echo "If A shows: STOP and run: git restore --staged .claude/comms/"
fi

printf "\n-- SOURCE FILE MAP (T1/T2/T3 lanes) ---------------------------\n"
echo "T1 lane (src/components, src/pages, src/index.css):"
find src/components src/pages -name "*.jsx" 2>/dev/null | sort | head -15
echo ""
echo "T2 lane (src/lib, src/store, migrations):"
find src/lib src/store migrations -name "*.js" -o -name "*.sql" 2>/dev/null | sort | head -15
echo ""
echo "T3 lane (useGame*, tests/e2e):"
find src/hooks -name "useGame*.js" -o -name "usePresence.js" 2>/dev/null | sort
find tests/e2e -name "*.js" 2>/dev/null | sort

printf "\n== NEOTOPIA STATUS SUMMARY ====================================\n"
echo "Stage: 2 of 5 | Art: ${ART_COUNT}/56 | Rules: ${RULE_COUNT} | Migrations: ${MIG_COUNT}"
echo "Tests: $PASS_COUNT | Screenshots: ${SSHOT_COUNT} | Hot files: ${HOT_COUNT}"
echo ""

printf "\n\u2554===========================================================\u2557\n"
printf "\u2551  END RELAY · Paste above to NeoTopia AI                     \u2551\n"
printf "\u2551  Prefix: %-50s\u2551\n" "$T_NUM AUTODRIVE!"
printf "\u255a===========================================================\u255d\n"
