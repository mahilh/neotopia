#!/bin/bash
# NeoTopia relay v2.0 · bash .claude/relay.sh · last step of every forge
#
# PASTE TO NEOTOPIA AI: T[N] AUTODRIVE!
# Copy from the first ⌕ in this terminal to the bottom ╔═╗ line.
#
# COMMS FIX (T1 S12): .claude/comms is gitignored (filesystem-shared between
# terminals · local only). relay.sh writes comms on disk but NEVER commits them.
# The Error: exit code 1 from git add .claude/comms/ is expected + correct.
# Terminals: write tomorrow.md on disk only. Do NOT attempt git commit on comms.
#
# AUTODRIVE! system (v2.0 improvements):
# - Bot health check (last report summary)
# - Rule 53 proxy-vs-DB reminder
# - Comms never committed (local only per gitignore)
# - Session improvement trajectory in relay output

cd ~/NeoTopia 2>/dev/null || { echo "❌ run from ~/NeoTopia"; exit 1; }

# Detect which terminal from the lane
T_NUM="T?"
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q "^src/components\|^src/pages\|^src/App\|^src/utils"; then T_NUM="T1"; fi
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q "^src/lib\|^src/store"; then T_NUM="T2"; fi
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q "useGameRoom\|useGameSync\|usePresence\|Lobby"; then T_NUM="T3"; fi

printf "\u2554══════════════════════════════════════════════════════════╗\n"
printf "║  PASTE TO NEOTOPIA AI:  %s AUTODRIVE!                   ║\n" "$T_NUM"
printf "║  Copy: first ⌕ in this terminal → bottom ╚═══╝ line     ║\n"
printf "╠══════════════════════════════════════════════════════════╣\n"
printf "║  RELAY v2.0 · %s                   ║\n" "$(date '+%Y-%m-%d %H:%M PKT')"
printf "╚══════════════════════════════════════════════════════════╝\n\n"

git pull --quiet 2>&1 | grep -v "^$" | head -2

printf "\n── GIT LOG ─────────────────────────────────────────────────\n"
git log --oneline -8

printf "\n── TESTS ──────────────────────────────────────────────────\n"
npx vitest run 2>&1 | tail -10

printf "\n── BUILD ──────────────────────────────────────────────────\n"
npm run build 2>&1 | tail -3

printf "\n── BOT HEALTH (Rule 53: DB is truth, not proxy) ────────────────────\n"
LATEST_REPORT=$(ls -t .bot-reports/report-*.json 2>/dev/null | head -1)
if [ -n "$LATEST_REPORT" ]; then
  node -e "
    const fs=require('fs');
    const r=JSON.parse(fs.readFileSync('$LATEST_REPORT'));
    const s=r.summary;
    console.log('v'+r.botVersion+' | placed:'+s.totalPlaced+' drew:'+s.totalDrew+' errors:'+s.totalErrors);
    console.log('types:', JSON.stringify(s.errorTypes));
    console.log('games placed>0:', s.gamesWithPlacement+'/'+r.results.length);
    console.log('report:', '$LATEST_REPORT');
  " 2>/dev/null || echo "(no valid report)"
else
  echo "(no bot reports yet · run: BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js)"
fi

printf "\n── COMMS (filesystem-local, NOT committed) ────────────────────\n"
cat .claude/comms/tomorrow.md 2>/dev/null | tail -60 || echo "(empty)"

printf "\n── SOURCE ─────────────────────────────────────────────────\n"
find src -name "*.jsx" | grep -v test | sort | head -30

printf "\n── GIT STATUS ──────────────────────────────────────────────\n"
git status --short

printf "\n╔══════════════════════════════════════════════════════════╗\n"
printf "║  END RELAY · Paste above to NeoTopia AI                  ║\n"
printf "║  Prefix:  %s AUTODRIVE!                                  ║\n" "$T_NUM"
printf "╚══════════════════════════════════════════════════════════╝\n"
