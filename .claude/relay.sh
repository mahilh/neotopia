#!/bin/bash
# NeoTopia relay · bash .claude/relay.sh · last step of every forge
#
# When the terminal finishes, copy everything from the first ⏺ to the bottom ╚═╝
# Paste to NeoTopia AI (claude.ai) with the prefix shown at the top and bottom:
#   T1 AUTODRIVE!
#   T2 AUTODRIVE!
#   T3 AUTODRIVE!
# That's it. Two words. Session number is in the output — no need to type it.

cd ~/NeoTopia 2>/dev/null || { echo "❌ run from ~/NeoTopia"; exit 1; }

# Detect which terminal this is from the lane
T_NUM="T?"
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q "^src/components\|^src/pages\|^src/App\|^src/utils"; then T_NUM="T1"; fi
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q "^src/lib\|^src/store"; then T_NUM="T2"; fi
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q "useGameRoom\|useGameSync\|usePresence\|Lobby"; then T_NUM="T3"; fi

printf "╔══════════════════════════════════════════════════════════╗\n"
printf "║  PASTE TO NEOTOPIA AI:  %s AUTODRIVE!                   ║\n" "$T_NUM"
printf "║  Copy: first ⏺ in this terminal → bottom ╚═══╝ line     ║\n"
printf "╠══════════════════════════════════════════════════════════╣\n"
printf "║  RELAY · %s                   ║\n" "$(date '+%Y-%m-%d %H:%M PKT')"
printf "╚══════════════════════════════════════════════════════════╝\n\n"

git pull --quiet 2>&1 | grep -v "^$" | head -2

printf "\n── GIT LOG ─────────────────────────────────────────────\n"
git log --oneline -8

printf "\n── TESTS ───────────────────────────────────────────────\n"
npx vitest run 2>&1 | tail -16

printf "\n── BUILD ───────────────────────────────────────────────\n"
npm run build 2>&1 | tail -4

printf "\n── SOURCE ──────────────────────────────────────────────\n"
find src -name "*.js" -o -name "*.jsx" | grep -v test | sort

printf "\n── TEST FILES ──────────────────────────────────────────\n"
find src -name "*.test.*" | sort

printf "\n── COMMS ───────────────────────────────────────────────\n"
cat .claude/comms/tomorrow.md 2>/dev/null || echo "(empty)"

printf "\n── GIT STATUS ──────────────────────────────────────────\n"
git status --short

printf "\n╔══════════════════════════════════════════════════════════╗\n"
printf "║  END RELAY · Paste above to NeoTopia AI                  ║\n"
printf "║  Prefix:  %s AUTODRIVE!                                  ║\n" "$T_NUM"
printf "╚══════════════════════════════════════════════════════════╝\n"
