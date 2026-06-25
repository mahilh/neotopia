# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# Domain: neotopia.io | GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Started: June 25 2026 | Founder: Syed Mahil Hussain | Born: Oct 9 2003 | Houston TX

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq (ap-south-1 Mumbai) | URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) | Domain target: neotopia.io
Vercel: auto-deploy from main branch

TERMINAL LANES (strict — check before every edit):
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js  (board + visual layer)
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/                                    (engine + backend)
       T2 does NOT own: useGameActions.js (T1) · useGameRoom.js (T3) · useGameSync.js (T3) · usePresence.js (T3)
  T3: src/hooks/useGameRoom.js · src/hooks/useGameSync.js · src/hooks/usePresence.js · src/pages/Lobby.jsx
  COLLISION RULE: git status --short [your lane files] before every edit. M from other terminal = STOP.
  LANE AMBIGUITY RULE: src/hooks/ belongs to T2 BROADLY. Specific files listed above are owned by T1/T3.
    If a file is not listed in T1 or T3's lane, assume T2 owns it.

RULES — ABSOLUTE (violating any = task fail):
  NO em dashes (—) — use · instead, always
  NO window.confirm() — hold-to-confirm only (1000ms press)
  44px minimum touch targets on ALL interactive elements
  tabular-nums on ALL game numbers and scores
  Tailwind v4 CSS-first (@import "tailwindcss" in index.css)
  npm run build MUST pass (0 errors) before every commit
  NEVER git add -A — always explicit pathspec re-derived from git status
  ALWAYS read .claude/comms/tomorrow.md on boot to get cross-terminal messages
  ALWAYS write to .claude/comms/tomorrow.md at session end
  ALWAYS end every session with: bash .claude/relay.sh

SELF-RATING SYSTEM (mandatory — game cannot improve without this):
  FORGE SELF-RATE /100 BEFORE any task — if < 85 rewrite before executing
  TASK RATE /50 after each task — REDO if < 35 before moving on
  SESSION RATE /300 (Prompt /100 + Code /200) at end
  ONE evolution lesson mandatory per session — written to .claude/comms/tomorrow.md

BOOT SEQUENCE (run every session, do not skip):
  cat .claude/CLAUDE.md | head -80
  cat .claude/comms/tomorrow.md 2>/dev/null || echo "no cross-terminal messages"
  git log --oneline -8
  git status --short
  npm run build 2>&1 | tail -3

CROSS-TERMINAL COMMUNICATION PROTOCOL:
  .claude/comms/tomorrow.md is the shared nervous system between T1, T2, T3
  Format when writing:
    T[N] LESSON: [exact discovery — one sentence, actionable]
    T[N] → T[M]: [what the other terminal needs to know]
    T[N] S3 FIRST TASK: [next priority]
    T[N] S3 FILES TO CREATE: [list]
  Read all messages. Acknowledge each. Proceed.

CODEWORD DICTIONARY (permanent):
  T1 AUTODRIVE!  → paste T1 terminal output · I run: GitHub verify + XRAY! /200 + T1 S3 forge
  T2 AUTODRIVE!  → paste T2 terminal output · I run: GitHub verify + XRAY! /200 + T2 S3 forge
  T3 AUTODRIVE!  → paste T3 terminal output · I run: GitHub verify + XRAY! /200 + T3 S3 forge
  AUTODRIVE! is XRAY! + FORGE! + background research + GitHub push. No session number needed.
  FORGE! T[N]    → just write next forge for terminal N (no review of past output)
  XRAY! [thing]  → just audit something specific (no forge written)
  REFORGE!       → 7-phase prompt transcendence · skill at .claude/skills/reforge/SKILL.md
  DEEPDIVE!      → 10-step enforced analysis
  OVERDRIVE!     → 6-agent LLM Council (BRUTUS/SOPHIA/MARCUS/ISABELLA/KARPATHY/CAESAR)
  NIGHTSAVE!     → save session intelligence to Google Drive
  Rate it        → /300 session rating (Prompt /100 + Code /200)

═══════════════════════════════════════════════════════
RED ERROR PREVENTION PROTOCOL — 4 PERMANENT RULES
═══════════════════════════════════════════════════════

RULE RE-1: NEVER use @ package names in bash glob checks.
  RIGHT: node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies).join(' '))"

RULE RE-2: ALWAYS distinguish error types before treating as blocker.
  "permission denied for table" ≠ "table does not exist"
  "relation does not exist" = real blocker · "permission denied" = GRANT issue, fix in parallel

RULE RE-3: Supabase tables created via raw SQL ALWAYS need explicit GRANT.
  Migration at: scripts/migrations/001_grant_permissions.sql

RULE RE-4: Hard gates must be precise, not binary.
  Known root cause + fix exists + tasks are DB-independent = proceed in parallel.
  Full stop only when: tables missing, env vars absent, build broken.

SUPABASE GATE DIAGNOSIS:
  node --input-type=module <<'EOF'
  import { createClient } from '@supabase/supabase-js'
  import { readFileSync } from 'fs'
  const env = Object.fromEntries(readFileSync('.env.local','utf8').trim().split('\n')
    .filter(l=>l&&!l.startsWith('#'))
    .map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
  const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  for (const t of ['player_profiles','game_rooms','game_sessions','room_players','game_events']) {
    const {error} = await s.from(t).select('count').limit(1).single()
    console.log(t+':', !error?'✅':error.message.includes('does not exist')?'❌ MISSING':'⚠️ GRANT')
  }
  EOF

═══════════════════════════════════════════════════════
GAME MECHANICS (memorize completely)
═══════════════════════════════════════════════════════

  BOARD: 3 Regions (radius=2 axial):
    Region 0: Sacred City  (purple #7F77DD) cq=0,  cr=0
    Region 1: Living Earth (green  #1D9E75) cq=8,  cr=-4
    Region 2: Free Energy  (red    #E24B4A) cq=4,  cr=5
  3 Factories: F0(4,-2) between 0+1 · F1(6,1) between 1+2 · F2(2,3) between 0+2

  4 ELEMENTS (25 tokens each):
    energy: red #E24B4A ⚡ · biofarming: green #1D9E75 ◈ · technology: purple #7F77DD ◉ · community: blue #378ADD ✦

  TURN = EXACTLY 3 ACTIONS:
    A: Draw 1 project card (from Offer OR deck)
    B: Move 1 element from Factory into ADJACENT Region

  PLACEMENT RULES:
    Hex must be EMPTY · first in region → center only · else → adjacent to existing element
    Key format: 'q,r' string

  SCORING: pattern matches in any of 6 rotations · completing-element rule · Diverse City rule
  FACTORY SEEDING (RULEBOOK): each factory starts 1-of-each-type · tiles for REFILLS ONLY
  FINAL SCORE: best + second + (worst × 3) + (unusedBonus × 3) + cluster bonus
  56 PROJECT CARDS: 12×2pt · 18×3pt · 18×4pt · 8×5pt · in src/lib/projectCards.js

  SUPABASE SCHEMA (5 tables · all RLS + Realtime · GRANT via migration 001):
    player_profiles · game_rooms · room_players · game_sessions · game_events

  REALTIME: DB changes = authoritative state · Broadcast = ephemeral <32KB · Presence = lobby
  BROADCAST LIMIT: NEVER send deck/hand/tiles · signal only · clients pull from DB

ELEMENT → CIVILIZATION:
  energy → Energy/Invention · biofarming → Food/Regeneration · technology → Tech/AI · community → Source/Culture

NEOTOPIA CIVILIZATION:
  Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055
  Global NeoTopia Index: individual games contribute to real-world civilization metrics

PERMANENT ANTI-REGRESS RULES (25 — compounds every session):
  1.  NEVER git add -A · always pathspec re-derived from git status at commit time
  2.  NO em dashes · use · (middle dot)
  3.  NO window.confirm() · hold-to-confirm (1000ms)
  4.  44px minimum touch targets everywhere
  5.  tabular-nums on all game numbers
  6.  npm run build must pass before commit
  7.  PREMISE CHECK — cat/grep source files before prescribing anything
  8.  pixelToHex ALWAYS paired with hexToPixel
  9.  Pattern rotation algorithm must exist before card scoring
  10. Cluster BFS must exist before final scoring
  11. Production tile structure must be initialized before factory logic
  12. Diverse City needs region.lastBuiltIllustration
  13. Rate forge /100 BEFORE executing · < 85 = rewrite
  14. Rate task /50 AFTER each · < 35 = redo
  15. ONE evolution lesson to comms/tomorrow.md every session
  16. Server is source of truth for scoring
  17. NEVER use @ package names in bash globs · use node -e (S1)
  18. "permission denied" ≠ "does not exist" · diagnose before stopping (S1)
  19. Supabase raw SQL needs explicit GRANT (S1)
  20. Known-cause gate + independent tasks = proceed in parallel (S1)
  21. Broadcast max 32KB · signal only · never game state (REFORGE! T3)
  22. Zustand → Supabase must be JSON-serializable · no Set/Map/undefined (REFORGE! T3)
  23. useCallback deps never include store object reference · use getState() inside (T2 S1)
  24. Supabase channel MUST be removed before creating new one · no channelRef overwrite (REFORGE! T3)
  25. Re-read other lane's module RIGHT BEFORE writing integration code · first read is stale in live multi-terminal repo (T1 S2)

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r) · cube for algorithms
  Neighbors (flat-top): (1,0)(1,-1)(0,-1)(-1,0)(-1,1)(0,1)

COLONIST.IO BENCHMARK: 15M+ games 2025 · 65% mobile · our edge: pure strategy + consciousness theme
