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
  T1: src/components/ src/pages/ src/App.jsx src/utils/   (board + visual layer)
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/         (engine + backend)
  T3: src/hooks/useGameRoom.js src/hooks/useGameSync.js api/game-action.js  (realtime)
  COLLISION RULE: git status --short [your lane] before every edit. M from other terminal = STOP.

RULES — ABSOLUTE (violating any = task fail):
  NO em dashes (—) — use · instead, always
  NO window.confirm() — hold-to-confirm only (1000ms press)
  44px minimum touch targets on ALL interactive elements
  tabular-nums on ALL game numbers and scores
  Tailwind v4 CSS-first (@import "tailwindcss" in index.css)
  npm run build MUST pass (0 errors) before every commit
  NEVER git add -A — always explicit pathspec: git add [specific files]
  ALWAYS read .claude/comms/tomorrow.md on boot to get cross-terminal messages
  ALWAYS write to .claude/comms/tomorrow.md at session end

SELF-RATING SYSTEM (mandatory — game cannot improve without this):
  FORGE SELF-RATE /100 BEFORE any task — if < 85 rewrite before executing
  TASK RATE /50 after each task — REDO if < 35 before moving on
  SESSION RATE /300 (Prompt /100 + Code /200) at end
  ONE evolution lesson mandatory per session — written to .claude/comms/tomorrow.md

BOOT SEQUENCE (run every session, do not skip):
  cat .claude/CLAUDE.md | head -60
  cat .claude/comms/tomorrow.md 2>/dev/null || echo "no cross-terminal messages"
  git log --oneline -3
  git status --short
  npm run build 2>&1 | tail -3

CROSS-TERMINAL COMMUNICATION PROTOCOL:
  .claude/comms/tomorrow.md is the shared nervous system between T1, T2, T3
  Format when writing:
    T[N] S[N] LESSON: [exact discovery]
    T[N] → T[M] MESSAGE: [what the other terminal needs to know]
    T[N] S[N+1] FIRST TASK: [next priority]
    T[N] S[N+1] FILES TO CREATE: [list]
  Read all messages. Acknowledge each. Proceed.

═══════════════════════════════════════════════════════
RED ERROR PREVENTION PROTOCOL — 4 PERMANENT RULES
(These eliminated the S1 false-positive exit code 1)
═══════════════════════════════════════════════════════

RULE RE-1: NEVER use @ package names in bash glob checks.
  WRONG: for p in @supabase/supabase-js zustand; do test -d node_modules/$p
  RIGHT: use Python or node -e to check packages:
    node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies).join(' '))"
  WHY: zsh treats @scope/package as a glob, exits 1 on non-match even when package exists.

RULE RE-2: ALWAYS distinguish error types before treating as blocker.
  "permission denied for table" ≠ "table does not exist"
  "relation does not exist" = table is genuinely missing (real blocker)
  "permission denied" = table exists, RLS/GRANT issue (diagnose, then decide)
  NEVER stop S1 engine work because of a Supabase GRANT issue — engine code is DB-independent.

RULE RE-3: Supabase tables created via raw SQL ALWAYS need explicit GRANT.
  Supabase dashboard auto-grants SELECT/INSERT/UPDATE/DELETE to anon + authenticated.
  Raw SQL migrations DO NOT auto-grant. You must add:
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
  The migration is at: scripts/migrations/001_grant_permissions.sql
  Run via Supabase MCP or dashboard SQL editor BEFORE any DB integration tests.

RULE RE-4: Hard gates must be precise, not binary.
  A gate that fails with a known, solvable, documented cause is NOT a full stop.
  The gate intent is "don't build on a broken foundation."
  If the failure is: known root cause + fix exists + S1 tasks are provably independent of it
  → Document the fix, proceed with independent tasks, fix the gate in parallel.
  The gate IS a full stop only when: tables don't exist, env vars missing, build broken.

SUPABASE GATE DIAGNOSIS PATTERN (use this exact check):
  node --input-type=module <<'EOF'
  import { createClient } from '@supabase/supabase-js'
  import { readFileSync } from 'fs'
  const env = Object.fromEntries(
    readFileSync('.env.local','utf8').trim().split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
  )
  const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  for (const t of ['player_profiles','game_rooms','game_sessions','room_players','game_events']) {
    const {error} = await s.from(t).select('count').limit(1).single()
    const status = !error ? '✅' : error.message.includes('does not exist') ? '❌ MISSING' : '⚠️ GRANT'
    console.log(t+':', status, error?.message ?? '')
  }
  EOF
  ✅ = good · ❌ MISSING = tables need creating · ⚠️ GRANT = run 001_grant_permissions.sql

PACKAGE CHECK PATTERN (safe, no zsh glob issues):
  node -e "
  const p = require('./package.json')
  const deps = {...p.dependencies, ...p.devDependencies}
  const check = ['zustand','immer','@supabase/supabase-js','vitest','framer-motion']
  check.forEach(d => console.log(d+':', deps[d] ? '✅ '+deps[d] : '❌ MISSING'))
  "

═══════════════════════════════════════════════════════
GAME MECHANICS (memorize completely)
═══════════════════════════════════════════════════════

  BOARD STRUCTURE:
    3 Regions (hexagonal clusters, ~19 hexes each, radius=2 in axial coords):
      Region 0: Sacred City    (purple #7F77DD) — cq=0,  cr=0
      Region 1: Living Earth   (green  #1D9E75) — cq=8,  cr=-4
      Region 2: Free Energy    (red    #E24B4A) — cq=4,  cr=5
    3 Factories at junctions (q,r):
      Factory 0: between regions 0+1 at (4,-2)
      Factory 1: between regions 1+2 at (6,1)
      Factory 2: between regions 0+2 at (2,3)

  4 ELEMENTS (25 tokens each):
    energy:     red     #E24B4A  ⚡  Energy and Invention District
    biofarming: green   #1D9E75  ◈   Food and Regeneration District
    technology: purple  #7F77DD  ◉   Technology and AI District
    community:  blue    #378ADD  ✦   Source and Spirituality District

  TURN = EXACTLY 3 ACTIONS. No more, no fewer.
    Action A: Draw 1 project card (from The Offer face-up row OR top of deck)
    Action B: Move 1 element from any Factory into an ADJACENT Region

  ELEMENT PLACEMENT RULES:
    Hex must be EMPTY
    AND either: region is empty → place at center, region has elements → must be adjacent to 1+
    "Adjacent" = hex shares an edge (6 neighbors in flat-top hex, axial coords)
    Key format for hexes in store: 'q,r' string (e.g. '0,0', '1,-1', '-2,3')

  BUILDING PROJECT CARDS (THE CORE SCORING MECHANIC):
    After placing element, check if region now matches any card pattern in player hand
    Pattern can be in ANY of 6 rotations (60° increments)
    Player MUST be the one who placed the COMPLETING element
    Only ONE card scored per completing move
    Diverse City rule: cannot score same card.illustration type consecutively in same region
    Check region.lastBuiltIllustration before scoring

  PATTERN ROTATION ALGORITHM (mandatory before ANY card scoring):
    Cube rotation 60° CCW: (q,r) → (-r, q+r)  [where s=-q-r in cube coords]
    Get 6 rotations: apply rotation 6 times, normalize each to (0,0) origin
    Match: for each rotation, try each occupied hex as anchor, check all pattern cells
    This is in src/lib/patternMatcher.js — DO NOT reimplement, import from there

  CLUSTER DETECTION ALGORITHM (mandatory for final scoring):
    BFS from each unvisited element of target type
    Track visited set, find connected component size
    Largest component = cluster score for that player+region+element
    This is in src/lib/patternMatcher.js — DO NOT reimplement

  FACTORY AUTO-PRODUCTION (the game clock):
    Factory cleared → IMMEDIATELY refill from top production tile
    Discard that tile → productionTilesRemaining--
    When last tile revealed → endGameTriggered = true
    All players finish current round + ONE MORE complete round → final scoring

  12 PRODUCTION TILES: defined in src/store/gameStore.js as PRODUCTION_TILES
    Tile 11 = end-of-game flag tile (isEndFlag: true)

  4 BONUS TOKEN TYPES (free actions, do NOT count toward 3-action limit):
    subsidy · automatization · initiative · permits
    RULE: only 1 bonus per turn · unused at end = 3pts each
    Earn by: covering bonus token spaces OR score marker passing 7/13/18

  FINAL SCORING FORMULA:
    Step 1: cluster scoring (1pt per element in biggest same-color cluster per region)
    Step 2: best_region + second_region + (worst_region × 3) + (unused_bonus × 3)
    In src/lib/patternMatcher.js calculateFinalScore()

  56 PROJECT CARDS: in src/lib/projectCards.js
    12×2pt · 18×3pt · 18×4pt · 8×5pt = 56 total
    illustration field drives Diverse City (need 3+ cards per illustration type)

  SUPABASE SCHEMA (5 tables, all RLS + Realtime enabled, GRANT applied via migration 001):
    player_profiles: user_id · username · avatar_color · elo_rating · games_played · games_won · neotopia_index
    game_rooms:      id · room_code · host_id · status · max_players · player_count
    room_players:    room_id · user_id · username · player_color · seat_number · is_ready · character
    game_sessions:   room_id · state(jsonb) · current_seat · turn_number · actions_remaining · phase · production_tiles_remaining
    game_events:     session_id · seat_number · event_type · event_data · sequence_num

  SUPABASE REALTIME (always specify channel type — never generic):
    DB changes  → authoritative game state (verified moves)
    Broadcast   → ephemeral events (hover, animation — no DB write)
    Presence    → lobby state (connected players, ready status)

  OPTIMISTIC UPDATES:
    1. Snapshot Zustand state
    2. Apply locally immediately
    3. Write to Supabase
    4. On error → rollback to snapshot
    5. On success → incoming Realtime event ignored if state already matches

ELEMENT → CIVILIZATION MAPPING:
  energy:     Energy and Invention District · AetherFlux · Free Energy Lab
  biofarming: Food and Regeneration · Living Earth · BioFarm Collective
  technology: Technology and AI · AetherNet
  community:  Source and Spirituality · Culture and Symbols · Seats 1+8

NEOTOPIA CIVILIZATION:
  Stage 2 of 5 (website → game → virtual world → community → land)
  Every project card scored = rehearsal of a real district that will exist by 2055
  Global NeoTopia Index connects game contributions to real-world civilization metrics
  9 Districts: Source · Healing · Education · Energy · Food · Architecture · Tech · Culture · Diplomacy

SKILLS: 380 via symlink to AetherProject/.claude/skills/
  Best for NeoTopia: aether-prompt-evolution · aether-self-rating · impeccable · apple-hig-expert
  aether-security · verification-quality · diagnose · llm-council

PERMANENT ANTI-REGRESS RULES (20 rules — S1 added rules 17-20):
  1.  NEVER git add -A — always pathspec
  2.  NO em dashes — use · (middle dot)
  3.  NO window.confirm() — hold-to-confirm (1000ms)
  4.  44px minimum touch targets everywhere
  5.  tabular-nums on all game numbers
  6.  npm run build must pass before commit
  7.  PREMISE CHECK — read source files before prescribing anything
  8.  pixelToHex ALWAYS paired with hexToPixel
  9.  Pattern rotation algorithm MUST exist before any card scoring
  10. Cluster BFS MUST exist before any final scoring
  11. Production tile data structure MUST be initialized before factory logic
  12. Diverse City needs region.lastBuiltIllustration field
  13. Rate forge /100 BEFORE executing — < 85 = rewrite
  14. Rate task /50 AFTER each task — < 35 = redo
  15. Write ONE evolution lesson to .claude/comms/tomorrow.md every session
  16. Server is source of truth — never trust only client state
  17. NEVER use @ package names in bash glob checks — use Python or node -e (S1 LESSON)
  18. "permission denied" ≠ "does not exist" — always diagnose exact error type (S1 LESSON)
  19. Supabase raw SQL tables need explicit GRANT — dashboard auto-grants, SQL does not (S1 LESSON)
  20. Hard gate failure with known/solvable cause + DB-independent tasks = proceed, fix in parallel (S1 LESSON)

HEX MATH REFERENCE: redblobgames.com/grids/hexagons
  Flat-top orientation · axial (q,r) storage · cube (q,r,s) for algorithms
  Neighbor offsets (flat-top): (1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)
  pixelToHex: q=(2/3*x)/size, r=(-1/3*x + √3/3*y)/size → hexRound()

COLONIST.IO REFERENCE (benchmark — 15M+ games 2025):
  Mobile-first: 65% mobile play — 44px targets non-negotiable
  Performance: smooth under heavy load
  Our edge: pure strategy (no dice) + consciousness civilization theme
