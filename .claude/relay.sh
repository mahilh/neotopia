#!/bin/bash
# NeoTopia relay · bash .claude/relay.sh · last step of every forge
# Copy everything from the FIRST ⏺ in this terminal to the bottom border below
# Paste to NeoTopia AI (claude.ai) prefixed with:  AUTODRIVE! S[N] · T[N] S[N]:

cd ~/NeoTopia 2>/dev/null || { echo "❌ run from ~/NeoTopia"; exit 1; }

printf "╔══════════════════════════════════════════════════════════════╗\n"
printf "║  PASTE TO NEOTOPIA AI:  AUTODRIVE! S[N] · T[N] S[N]:        ║\n"
printf "║  Copy from first ⏺ in this terminal to the bottom ╚═╝ line  ║\n"
printf "╠══════════════════════════════════════════════════════════════╣\n"
printf "║  RELAY · %s                     ║\n" "$(date '+%Y-%m-%d %H:%M PKT')"
printf "╚══════════════════════════════════════════════════════════════╝\n\n"

git pull --quiet 2>&1 | grep -v "^$" | head -3

printf "\n── GIT LOG ──────────────────────────────────────────────────────\n"
git log --oneline -8

printf "\n── TESTS ────────────────────────────────────────────────────────\n"
npx vitest run 2>&1 | tail -16

printf "\n── BUILD ────────────────────────────────────────────────────────\n"
npm run build 2>&1 | tail -4

printf "\n── SOURCE ───────────────────────────────────────────────────────\n"
find src -name "*.js" -o -name "*.jsx" | grep -v test | sort

printf "\n── TESTS LIST ───────────────────────────────────────────────────\n"
find src -name "*.test.*" | sort

printf "\n── COMMS ────────────────────────────────────────────────────────\n"
cat .claude/comms/tomorrow.md 2>/dev/null || echo "(empty)"

printf "\n── GIT STATUS ───────────────────────────────────────────────────\n"
git status --short

printf "\n╔══════════════════════════════════════════════════════════════╗\n"
printf "║  END OF RELAY · Paste everything above to NeoTopia AI       ║\n"
printf "║  Prefix: AUTODRIVE! S[N] · T[N] S[N]:                       ║\n"
printf "╚══════════════════════════════════════════════════════════════╝\n"
