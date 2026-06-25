#!/bin/bash
# NeoTopia session start script · run ONCE from Mac terminal before opening Claude Code tabs
# Usage: bash ~/NeoTopia/start.sh
#
# This syncs the local repo so every Claude Code terminal starts from current HEAD.
# Each forge's boot sequence also runs git pull --rebase, so this is belt-and-suspenders.

cd ~/NeoTopia 2>/dev/null || { echo '❌ ~/NeoTopia not found'; exit 1; }

printf '\n═══════════════════════════════════════════\n'
printf '  NEOTOPIA SESSION START\n'
printf '  %s\n' "$(date '+%Y-%m-%d %H:%M')"
printf '═══════════════════════════════════════════\n\n'

printf '── PULL ────────────────────────────────────\n'
git pull --rebase 2>&1

printf '\n── STATUS ──────────────────────────────────\n'
git log --oneline -4
git status --short

printf '\n── BUILD ───────────────────────────────────\n'
npm run build 2>&1 | tail -4

printf '\n── COMMS ───────────────────────────────────\n'
cat .claude/comms/tomorrow.md 2>/dev/null || echo '(no cross-terminal messages)'

printf '\n═══════════════════════════════════════════\n'
printf '  ✅ Ready. Open Claude Code tabs and paste forges.\n'
printf '  Each forge boot sequence also runs git pull --rebase.\n'
printf '  You never need to manually git pull again.\n'
printf '═══════════════════════════════════════════\n\n'
