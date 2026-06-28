# NEOTOPIA CONTEXT — Full Civilization + Game Context
# Read this at every session start — never needs to be re-explained

## THE FOUNDER
Mahil Hussain · born Oct 9 2003 · 7:29 AM · Houston TX
Moving: Karachi Pakistan → Austin TX July 2026
Human Design: Generator 1/3 · Emotional Authority · Gene Keys Gate 57
Role: Architect · AI Director · does NOT write code manually
GitHub: mahilh · Mac: mahilhussain@Mahils-MacBook-Air

## THE CIVILIZATION VISION
NeoTopia: consciousness civilization by 2055 · Stage 2 of 5 right now
Stage 1: Frequency · Stage 2: Game (now) · Stage 3: App · Stage 4: Community · Stage 5: Land
9 Districts: Source · Healing · Education · Energy · Food · Architecture · Technology · Culture · Diplomacy
Every card scored in the game = rehearsal of a real district built in physical reality

## THE GAME — neotopia.io
Browser multiplayer · based on Arcane Wonders board game (2023) · set in 2055
Pure strategy (no luck/dice) · 2-4 players · turn-based
4 elements: Energy(red) · BioFarming(green) · Technology(purple) · Community(blue)
3 regions: Sacred City · Living Earth · Free Energy
3 factories at junctions between regions
56 esoteric consciousness-themed project cards
Turn = EXACTLY 3 actions: draw card OR move element from factory to adjacent region
Final score: best + second + (worst×3) + (unused×3) + clusterBonus
Cluster rule (board game p9): 1pt per element in biggest connected group per region
Modes: Classic (90s/12tiles) · Flow (15s/9tiles · simultaneous draw)

## TECH STACK
React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer
Supabase Realtime (multiplayer sync) · Supabase Auth (anonymous)
Supabase project: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
GitHub: mahilh/neotopia (public) · Vercel: neotopia.vercel.app
Vercel project ID: prj_SXwt61VZjo2vNWmzUFZ3PLSs2Yub
Testing: Vitest · E2E: Playwright

## CURRENT STATE (auto-updated by NIGHTSAVE!)
Production HEAD: see SKILLS_MANIFEST
Tests: 155 green · Rules: 69 · Card art: 12/56

## TERMINAL LANES (NEVER cross these)
T1: src/components/ · src/pages/ · src/index.css
T2: src/lib/ · src/store/ · scripts/ · migrations/
T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/

## 69 ANTI-REGRESS RULES (top 10 most critical)
1.  NEVER git add -A · pathspec only
2.  NO em dashes · use ·
7.  Read files FULLY before prescribing (Rule 7 = never assume)
32. Never Math.random() in synced actions
55. Screenshot every visual task
62. Reconcile · don't rebuild what's already built better
66. In shared tree · read uncommitted cross-lane deps before stubbing
67. CI gate keys on commit boundary · not working-tree truth
68. Migration in git != deployed schema · verify on live DB
69. Forge task list is hypothesis · premise-check each task against HEAD
Full list: cat .claude/CLAUDE.md | grep -A 2 "RULES"

## DRIVE SKILLS SYSTEM
Folder: https://drive.google.com/drive/folders/16VcjTyJA95ELauwukSEGXFt3FCgHu1R2
Service account: neotopia-claude-code@neotopia-drive.iam.gserviceaccount.com
Sync: node scripts/sync-drive-skills.cjs --all (runs at every NIGHTSAVE!)
Self-improve: node scripts/sync-drive-skills.cjs --log-flaw <CAT> "<flaw>" <score>
