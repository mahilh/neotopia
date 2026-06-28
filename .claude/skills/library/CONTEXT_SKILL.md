# NEOTOPIA CONTEXT · Full Civilization + Game State
# Version: S21 NIGHTSAVE · Auto-updated by NIGHTSAVE! ritual

## THE FOUNDER
Mahil Hussain · born Oct 9 2003 · Houston TX
Currently: Karachi Pakistan · Moving to Austin TX July 2026
Human Design: Generator 1/3 · Emotional Authority · Gene Keys Gate 57 (Intuition)
Role: Architect · AI Director · never writes code manually
GitHub: mahilh · Mac: mahilhussain@Mahils-MacBook-Air
Claude plan: Max 20x (no token limits · Opus 4.8 in terminals)

## THE CIVILIZATION VISION
NeoTopia: consciousness civilization by 2055 · Stage 2 of 5 right now
5 Stages: Frequency → Game (now) → App → Community → Land
9 Districts: Source · Healing · Education · Energy · Food · Architecture · Technology · Culture · Diplomacy
Every project card scored in the game = rehearsal of a real district built in physical reality

## THE GAME — neotopia.io (verified S21)
Browser multiplayer · based on Arcane Wonders board game (2023) · set in 2055
Pure strategy (no luck/dice) · 2-4 players · turn-based
4 elements: Energy(red#CC5522) · BioFarming(green#1D7A3A) · Technology(purple#2244AA) · Community(blue)
3 regions: Sacred City(indigo#2244AA) · Living Earth(green#1D7A3A) · Free Energy(amber#CC5522) [SHIPPED 5c30980]
3 factories at junctions between regions
56 esoteric consciousness-themed project cards (20/56 art generated · in Drive)
Turn = EXACTLY 3 actions: draw card OR move element from factory to adjacent region
Final score: best + second + (worst×3) + (unused×3) + clusterBonus
Cluster rule: 1pt per element in biggest connected group per region [LIVE 2348daa+442b694]
Modes: Classic (90s/12tiles) · Flow (15s/9tiles · simultaneous draw · soft-lock FIXED d7365bd)
sacredMilestone overlays: 7 · 9 · 13 · 18 · 27 · 36
Global Civilization Index: 3 rows recorded (2 bot S20 · 1 prod bot S21)

## TECH STACK
React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer
Supabase Realtime + Auth (anonymous) · Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
GitHub: mahilh/neotopia (public) · Vercel: neotopia.vercel.app
Vercel project: prj_SXwt61VZjo2vNWmzUFZ3PLSs2Yub · Team: team_GeEmbRIMY03ShBGMe4LNIwos
Testing: Vitest (158 green) · E2E: Playwright

## PRODUCTION STATE (S21 NIGHTSAVE)
HEAD: 5c30980 · Branch: main · Build: clean
Tests: 158 green · Rules: 69
Draw RPC (migration 011): NOT deployed · T2 priority next session
Board biomes: SHIPPED · Global Index: 3 rows

## TERMINAL LANES
T1: src/components/ · src/pages/ · src/index.css — NEVER CROSS
T2: src/lib/ · src/store/ · scripts/ · migrations/ — NEVER CROSS
T3: src/hooks/ · tests/e2e/ — NEVER CROSS

## TOP 10 MOST CRITICAL RULES (of 69)
1.  NEVER git add -A · pathspec only · always
2.  NO em dashes (—) · use · instead · always
7.  Read files FULLY before prescribing · never assume
32. Never Math.random() in synced actions
55. Screenshot every visual task · DOM measurement required
62. Reconcile · don't rebuild what's already built better
66. Read uncommitted cross-lane deps before stubbing
67. CI gate keys on commit boundary · not working-tree truth
68. Migration in git ≠ deployed schema · verify on live DB · PGRST202 = not deployed
69. Forge task list is hypothesis · premise-check each task against HEAD
70. [CANDIDATE] Forge can claim feature missing when it exists but is too subtle —
    verify rendered output not just code presence · enhance in own lane
71. [CANDIDATE] Sync ≠ current · validate HEAD+tests from live source at boot

## DRIVE SKILLS SYSTEM
Folder: https://drive.google.com/drive/folders/16VcjTyJA95ELauwukSEGXFt3FCgHu1R2
11 skill files + 3 terminal review logs = 14 Drive docs
Service account: neotopia-claude-code@neotopia-drive.iam.gserviceaccount.com
Key: .claude/service-account-key.json (gitignored · never commit)
Sync: node scripts/sync-drive-skills.cjs --all (NIGHTSAVE step 6 · mandatory)
Terminal reviews: --log-terminal-review T[N] ... (NIGHTSAVE step 8 · mandatory)
Flaw log: --log-flaw <CAT> "<flaw>" <score>
Card art list: --list-card-art (reads directly from Drive card art folder)

## CARD ART SYSTEM
Drive folder: 1mAMAeriwZSlrTJTFczFX56HCasvUQfyo
Status: 20/56 generated (card1-card20 in Drive · GPT 5.5 Images)
Local path: ~/NeoTopia/public/art/cards/card_NN.png (underscore · zero-padded)
Copy command: for n in {1..20}; do cp ~/Downloads/card${n}.png ~/NeoTopia/public/art/cards/card_$(printf '%02d' $n).png 2>/dev/null; done
Claude Code access: node scripts/sync-drive-skills.cjs --list-card-art
Next batch: cards 21-28 (3-point cards) · prompts in docs/ART_DIRECTION_ALL_56_CARDS.md
