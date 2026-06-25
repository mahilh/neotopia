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
  cat .claude/CLAUDE.md | head -50
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

GAME MECHANICS (memorize completely — every algorithm depends on these):

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

  ELEMENT PLACEMENT RULES (T1+T2 must enforce together):
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

  PATTERN ROTATION ALGORITHM (mandatory — implement before ANY card scoring):
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
    Factory cleared (all elements moved) → IMMEDIATELY refill from top production tile
    Discard that production tile → productionTilesRemaining--
    When last production tile revealed → endGameTriggered = true
    All players finish current round + ONE MORE complete round → final scoring

  12 PRODUCTION TILES: defined in src/store/gameStore.js as PRODUCTION_TILES
    Tile 11 = end-of-game flag tile (isEndFlag: true)

  4 BONUS TOKEN TYPES (free actions, do NOT count toward 3-action limit):
    subsidy: draw 2 cards from Offer/deck
    automatization: one free extra action (either type)
    initiative: place any element from reserve in any region center or adjacent
    permits: place element from factory in outer semi-circle of adjacent region
    RULE: only 1 bonus per turn — unused at game end = 3pts each
    Earn by: covering bonus token spaces OR score marker passing 7/13/18

  END GAME TRIGGER: last production tile revealed
    Current round completes
    One more complete round
    Final scoring

  FINAL SCORING FORMULA:
    Step 1: cluster scoring (1pt per element in biggest same-color cluster per region)
    Step 2: best_region + second_region + (worst_region × 3) + (unused_bonus × 3)
    This is in src/lib/patternMatcher.js calculateFinalScore()

  56 PROJECT CARDS: defined in src/lib/projectCards.js
    Points: 12 cards×2pt, 18 cards×3pt, 18 cards×4pt, 8 cards×5pt = 56 total
    Each card: id, name, pattern, points, illustration, district, description
    illustration field drives Diverse City enforcement (must have 3+ cards per illustration type)

  SUPABASE SCHEMA (5 tables, all RLS enabled, all Realtime enabled):
    player_profiles: user_id · username · avatar_color · elo_rating · games_played · games_won · neotopia_index
    game_rooms:      id · room_code · host_id · status · max_players · player_count
    room_players:    room_id · user_id · username · player_color · seat_number · is_ready · character
    game_sessions:   room_id · state(jsonb) · current_seat · turn_number · actions_remaining · phase · production_tiles_remaining
    game_events:     session_id · seat_number · event_type · event_data · sequence_num

  SUPABASE REALTIME USAGE (T3 — always specify type):
    DB changes    → authoritative game state (verified moves, scored cards)
    Broadcast     → ephemeral events (hover, animation sync, cursor — bypass DB)
    Presence      → lobby state (who is connected, ready status)

  OPTIMISTIC UPDATES PATTERN (for any Supabase write):
    1. Apply move locally in Zustand immediately
    2. Send to Supabase
    3. On error → rollback Zustand to snapshot taken before step 1
    4. On success → Realtime event arrives, Zustand ignores if state already matches
    Use pendingMoves: Set<string> to track in-flight operations

  AUTHORITY: Supabase DB is SINGLE SOURCE OF TRUTH
    Zustand store = local mirror only
    syncFromServer() action merges server state → server always wins conflicts
    Never trust only client state for scoring or move validation

ELEMENT → CIVILIZATION MAPPING (the soul behind the game):
  energy:     Energy and Invention District · AetherFlux · Free Energy Lab
  biofarming: Food and Regeneration · Living Earth District · BioFarm Collective
  technology: Technology and AI · AetherNet · Conscious Tech District
  community:  Source and Spirituality · Culture and Symbols · Seats 1 + 8

NEOTOPIA CIVILIZATION (why this game exists):
  Stage 2 of 5 in Mahil's civilization roadmap (website → game → virtual world → community → land)
  Every project card scored = rehearsal of a real district that will exist by 2055
  Global NeoTopia Index: accumulate across all games → connects to real-world metrics
  9 Council Districts: Source/Spirituality · Healing · Education · Energy · Food · Architecture · Tech · Culture · Diplomacy

SKILLS (380 available via symlink to AetherProject/.claude/skills/):
  Top skills for NeoTopia tasks:
    aether-prompt-evolution, aether-self-rating, impeccable, apple-hig-expert
    aether-security, verification-quality, diagnose, aether-intelligence-layer
    aether-session-compass (DEEPDIVE), aether-ui-audit (XRAY), llm-council

PERMANENT ANTI-REGRESS RULES (learned through sessions — never repeat these mistakes):
  1. NEVER git add -A in multi-terminal — always pathspec
  2. NO em dashes — use · (middle dot)
  3. NO window.confirm() — hold-to-confirm (1000ms)
  4. 44px minimum touch targets everywhere
  5. tabular-nums on all numbers
  6. npm run build must pass before commit
  7. Read files before prescribing anything (PREMISE CHECK)
  8. pixelToHex ALWAYS implemented alongside hexToPixel — they are a paired function
  9. Pattern rotation algorithm MUST exist before any card scoring is written
  10. Cluster BFS MUST exist before any final scoring is written
  11. Production tile data structure MUST be initialized before factory logic
  12. Diverse City enforcement requires region.lastBuiltIllustration field
  13. Rate forge /100 BEFORE executing — if < 85, rewrite
  14. Rate task /50 AFTER each task — if < 35, redo before moving on
  15. Write ONE evolution lesson to .claude/comms/tomorrow.md every session
  16. Server is source of truth — never trust only client state for scoring

COLONIST.IO REFERENCE (our primary benchmark, 15M+ games in 2025):
  Stack: React + TypeScript + CSS + relational DB + REST APIs
  Mobile-first: 65% of their games are on mobile — match this
  Performance: game must feel smooth under heavy load
  Lesson: pure strategy (no dice) is NeoTopia's advantage
  Comparison: we use Supabase Realtime instead of Redis+WebSockets

HEX MATH CANONICAL REFERENCE:
  redblobgames.com/grids/hexagons — use this for any uncertain hex algorithm
  Use: axial (q,r) for storage, cube (q,r,s where q+r+s=0) for algorithms
  Orientation: FLAT-TOP hexagons
  Neighbor offsets (flat-top axial): (1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)
  pixelToHex formula (flat-top): q=(2/3*x)/size, r=(-1/3*x + √3/3*y)/size → hexRound()
