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
  T1: src/components/ src/pages/ src/App.jsx src/utils/                          (board + visual layer)
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/                               (engine + backend)
  T3: src/hooks/useGameRoom.js src/hooks/useGameSync.js src/hooks/usePresence.js src/pages/Lobby.jsx
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
  ALWAYS end every session with: bash .claude/relay.sh

SELF-RATING SYSTEM (mandatory — game cannot improve without this):
  FORGE SELF-RATE /100 BEFORE any task — if < 85 rewrite before executing
  TASK RATE /50 after each task — REDO if < 35 before moving on
  SESSION RATE /300 (Prompt /100 + Code /200) at end
  ONE evolution lesson mandatory per session — written to .claude/comms/tomorrow.md

BOOT SEQUENCE (run every session, do not skip):
  cat .claude/CLAUDE.md | head -80
  cat .claude/comms/tomorrow.md 2>/dev/null || echo "no cross-terminal messages"
  git log --oneline -5
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

CODEWORD DICTIONARY (permanent — these never change):
  FORGE!        → write maximum-quality forge prompt · self-rate /100 · apply last ONE THING from comms
  XRAY!         → brutal audit /200 · evidence mandate · root causes with line citations
  DEEPDIVE!     → 10-step enforced analysis sequence · cannot skip steps
  OVERDRIVE!    → 6-agent LLM Council (BRUTUS/SOPHIA/MARCUS/ISABELLA/KARPATHY/CAESAR) · simultaneous verdicts
  NIGHTSAVE!    → end-of-session intelligence save to Google Drive
  REFORGE!      → 7-phase prompt transcendence · DESTROY → EVIDENCE → FOUNDATION → CONSTRUCT → STRESS TEST → SEAL → EVOLVE
                   skill file: .claude/skills/reforge/SKILL.md
                   output must: prevent a failure class the original could not · add 1 new rubric dimension
                   seal rating: must score ≥ 100/120 across 6 dimensions before claiming done
  XRAY! RELAY:  → paste terminal output here after bash .claude/relay.sh · triggers GitHub code verification + next forge
  Rate it       → 5-dimension /300 session rating (Prompt /100 + Code /200)
  BACKGROUND! S[N] → run during terminal sessions: update CLAUDE.md · push migration scripts · pre-write next forges
  LLM Council   → same as OVERDRIVE! 6 agents · use when 2+ approaches would give genuinely different outcomes

═══════════════════════════════════════════════════════
RED ERROR PREVENTION PROTOCOL — 4 PERMANENT RULES
═══════════════════════════════════════════════════════

RULE RE-1: NEVER use @ package names in bash glob checks.
  WRONG: for p in @supabase/supabase-js zustand; do test -d node_modules/$p
  RIGHT: node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies).join(' '))"
  WHY: zsh treats @scope/package as a glob, exits 1 even when package exists.

RULE RE-2: ALWAYS distinguish error types before treating as blocker.
  "permission denied for table" ≠ "table does not exist"
  "relation does not exist" = table missing (real blocker)
  "permission denied" = GRANT issue (diagnose, fix in parallel with independent work)

RULE RE-3: Supabase tables created via raw SQL ALWAYS need explicit GRANT.
  Migration at: scripts/migrations/001_grant_permissions.sql
  Run via Supabase MCP or dashboard SQL editor BEFORE DB integration tests.

RULE RE-4: Hard gates must be precise, not binary.
  Known root cause + fix exists + tasks are DB-independent = proceed and fix in parallel.
  Full stop only when: tables missing, env vars absent, build broken.

SUPABASE GATE DIAGNOSIS PATTERN:
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

PACKAGE CHECK PATTERN (safe — no zsh glob issues):
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
    AND either: region is empty → place at center · region has elements → must be adjacent to 1+
    "Adjacent" = hex shares an edge (6 neighbors in flat-top hex, axial coords)
    Key format for hexes in store: 'q,r' string (e.g. '0,0' · '1,-1' · '-2,3')

  BUILDING PROJECT CARDS (THE CORE SCORING MECHANIC):
    After placing element, check if region now matches any card pattern in player hand
    Pattern can be in ANY of 6 rotations (60° increments)
    Player MUST be the one who placed the COMPLETING element
    Only ONE card scored per completing move
    Diverse City rule: cannot score same card.illustration type consecutively in same region

  PATTERN ROTATION ALGORITHM (mandatory before ANY card scoring):
    Cube rotation 60° CCW: (q,r) → (-r, q+r)
    Get 6 rotations · normalize each to (0,0) · try at each occupied hex as anchor
    In src/lib/patternMatcher.js — DO NOT reimplement

  CLUSTER DETECTION ALGORITHM (mandatory for final scoring):
    BFS from each unvisited element of target type · largest component = cluster score
    In src/lib/patternMatcher.js — DO NOT reimplement

  FACTORY AUTO-PRODUCTION (the game clock):
    Factory cleared → IMMEDIATELY refill from top production tile
    Discard tile → productionTilesRemaining--
    When last tile revealed → endGameTriggered = true
    All players finish current round + ONE MORE complete round → final scoring

  FACTORY INITIAL SETUP (RULEBOOK — different from refill):
    Each factory starts with 1 of EACH element type: energy:1 · biofarming:1 · technology:1 · community:1
    Production tiles are for REFILLS ONLY (not initial seeding)

  12 PRODUCTION TILES: in src/store/gameStore.js as PRODUCTION_TILES
    Tile 11 = end-of-game flag tile (isEndFlag: true) · always sorted to end of shuffled stack

  4 BONUS TOKEN TYPES (free actions · do NOT count toward 3-action limit):
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

  SUPABASE SCHEMA (5 tables · all RLS + Realtime enabled · GRANT via migration 001):
    player_profiles: user_id · username · avatar_color · elo_rating · games_played · games_won · neotopia_index
    game_rooms:      id · room_code · host_id · status · max_players · player_count
    room_players:    room_id · user_id · username · player_color · seat_number · is_ready · character
    game_sessions:   room_id · state(jsonb) · current_seat · turn_number · actions_remaining · phase · production_tiles_remaining
    game_events:     session_id · seat_number · event_type · event_data · sequence_num

  SUPABASE REALTIME (always specify type — never generic "channel"):
    DB changes  → authoritative game state (verified moves · all clients sync)
    Broadcast   → ephemeral ONLY (hover · cursor · animation · NEVER game state · max 32KB)
    Presence    → lobby player tracking (who is connected · ready status)

  OPTIMISTIC UPDATES:
    1. Snapshot Zustand state (structuredClone with pendingMoves as [])
    2. Apply locally immediately
    3. Write to Supabase
    4. On error → rollback to snapshot
    5. On success → incoming Realtime event ignored if state already matches

  SUPABASE BROADCAST PAYLOAD RULE: NEVER send deck · hand · tiles via Broadcast (32KB limit)
    Game start signal: {signal:'game_start', roomId} ONLY · clients pull state from DB themselves

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
  reforge: .claude/skills/reforge/SKILL.md (7-phase prompt transcendence)
  relay:   bash .claude/relay.sh (auto-relay at session end)

PERMANENT ANTI-REGRESS RULES (24 rules — adds compound on every session):
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
  16. Server is source of truth — never trust only client state for scoring
  17. NEVER use @ package names in bash glob checks — use node -e instead (S1)
  18. "permission denied" ≠ "does not exist" — diagnose exact error before stopping (S1)
  19. Supabase raw SQL tables need explicit GRANT — dashboard auto-grants, SQL does not (S1)
  20. Hard gate failure with known cause + independent tasks = proceed in parallel (S1)
  21. Supabase Broadcast max 32KB · never send deck/hand/tiles · signal only + clients pull from DB (REFORGE! T3)
  22. Zustand state written to Supabase must be JSON-serializable · Set/Map/undefined are NOT (REFORGE! T3)
  23. useCallback dependency arrays NEVER include store object reference · use getState() inside instead (T2 S1)
  24. Supabase Realtime channel MUST be removed before creating a new one · never overwrite channelRef without cleanup (REFORGE! T3)

HEX MATH REFERENCE: redblobgames.com/grids/hexagons
  Flat-top orientation · axial (q,r) storage · cube (q,r,s) for algorithms
  Neighbor offsets (flat-top): (1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)
  pixelToHex: q=(2/3*x)/size, r=(-1/3*x + √3/3*y)/size → hexRound()

COLONIST.IO REFERENCE (benchmark — 15M+ games 2025):
  Mobile-first: 65% mobile play — 44px targets non-negotiable
  Performance: smooth under heavy load
  Our edge: pure strategy (no dice) + consciousness civilization theme
