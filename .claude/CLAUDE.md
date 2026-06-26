# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (post S11 · June 26 2026 · EVENING):
  ✅ TUTORIAL GATE FIXED (T1 S10) · {showTutorial && phase==='playing'} · cascade broken
  ✅ data-my-turn ATTR (T1 S11) · 'true'/'false' on GameRoom root div · bot race-free
  ✅ data-game-phase on GameRoom root · turn-pulse animation on badge when active
  ✅ TERRAIN BIOMES WIRED (T1 S11) · getBiomeForRegion · colors.hex on empty hexes
  ✅ ELEMENTICON.JSX EXTRACTED (T1 S11) · one source of truth · HexCell + CardFrame share
  ✅ TURN TIMER + BIOMES (T2 S10+S11) · synced in store · terrainBiomes.js shipped
  ✅ BOT 3 BUGS FIXED (T2 S11) · both-player tutorial dismiss · unique usernames · class selector
  ✅ UX HEALTH CI (T2 S11) · ux-health.yml · every 12h scan of prod
  ✅ GAME-UX E2E (T3 S11) · tests/e2e/game-ux.e2e.js · reaches /game · touch targets HARD GATE
  ✅ BOT v4.1 (June 26 2026) · 5-strategy room code extraction · both-page turn detection
  ✅ 102 TESTS GREEN (14 files) · BUILD CLEAN
  ✅ 3 SKILLS UPGRADED · neotopia-forge-patterns v3.0 (196/200) · supabase-patterns v3.0 · reforge v3.0
  🔴 CRITICAL BUG FIXED (T3 S8): sessionPhaseColumn · game_sessions.phase rejects 'scoring'
  🟡 BOT totalPlaced STILL 0: all fixes deployed · v4.1 has data-my-turn selector · needs test run
     Next test: cd ~/NeoTopia && git pull && BOT_GAMES=1 BOT_TURNS=20 BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
  🟡 MIGRATION 008 PENDING (T2 S12): extend purge to 'waiting' rooms · T3 S11 handed SQL to T2
  🟡 CARD ART: 4th image (182/200) · excellent but hexagram must be replaced with Flower of Life
  🟡 data-testid="room-code" needed on room code display (T1 S12) · would make bot strategy 2 hit

  ⏳ T1 S12: data-testid="room-code" · turn timer display wired · 10-11px font labels from game-ux
  ⏳ T2 S12: run bot v4.1 (totalPlaced > 0 target) · migration 008 apply · bonus data handling
  ⏳ T3 S12: confirm totalPlaced > 0 · game-ux.e2e.js gates pass · launch readiness final
  ⏳ MAHIL: git pull && run bot v4.1 · generate corrected pixel art (Flower of Life symbol) · neotopia.io domain

BOT SIMULATION PROGRESSION (the real success metric):
  Baseline (S9): { ready-failed:3, no-tutorial:3, stuck-state:90 } · 0 placed
  After S10: errors 90→20 · tutorial dismissed · wall moved in-game
  After S11 + v4.1: errors 16→? · data-my-turn deployed · both-page detection · 5-strategy extraction
  TARGET: totalPlaced > 0 on NEXT RUN · game completes within 5 sessions

SKILLS USAGE PER TERMINAL:
  T1 (Visual): neotopia-forge-patterns v3 · frontend-design · reforge v3
               SHOULD ALSO: engineering:accessibility-review · design:ux-copy
  T2 (Engine): neotopia-forge-patterns v3 · supabase-patterns v3
               SHOULD ALSO: engineering:debug · engineering:deploy-checklist
  T3 (Realtime): neotopia-forge-patterns v3 · supabase-patterns v3 · reforge v3
               SHOULD ALSO: engineering:incident-response · engineering:testing-strategy

SELF-IMPROVEMENT SCALE PER TERMINAL:
  T1: 283→282/300 (S9→S11) · stable high · gap: gate-skip on optional tasks
  T2: 278→282/300 (S10→S11) · rising · gap: local-vs-prod isolation step
  T3: 271→268/300 (S9→S11) · volatile · gap: lane violation risk + bot metric vs outcome

CARD ART DIRECTION (FINAL):
  Image 4 (latest): 182/200 · NEAR PERFECT · ONE FIX: replace hexagram with Flower of Life
  Style: 16-bit isometric pixel art · ONE building · dark navy background · amber-gold + teal
  Never: hexagram/Star of David · ALWAYS: Flower of Life as sacred symbol
  Symbol replacement prompt: 'FLOWER OF LIFE sacred geometry symbol — overlapping circles in petal rosette pattern. NOT hexagram. NOT Star of David.'
  Prompts: docs/ART_DIRECTION_PIXEL.md

CRITICAL PATTERNS (never revert):
  Auth: INITIAL_SESSION event · signingIn flag · storageKey 'neotopia-auth' · detectSessionInUrl:false
  game_events: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  FinalScore: triggers on phase==='scoring' · navigate('/lobby')
  calculateFinalScore: (scores[], unusedCount)→number (NOT breakdown object)
  sessionPhaseColumn: maps store 'scoring'→'finished' at game_sessions write boundary
  Tutorial gate: {showTutorial && phase==='playing'} — NOT isMyTurn (T1 S10 · never revert)
  data-my-turn: on GameRoom root div · 'true'/'false' · bot uses waitForSelector (T1 S11)
  Bot turn detection: detectActiveTurn(p1, p2) polls BOTH pages · NOT alternating assumption
  Room code extraction: 5-strategy with [style*="letter-spacing"] as strategy 3 (matched AZRHUE)
  purge_e2e_test_data: requires signInAnonymously() · authenticated-only (mig 007)
  game_sessions.phase CHECK: (playing|endgame|finished) — NEVER write 'scoring' directly

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ migrations (NOT T3 files)
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short [lane] before every edit. M from other terminal = STOP.

SELF-RATING: Forge /200 target · <85 internal /100 = REWRITE · Task /50 · Session /300

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -140
  cat .claude/comms/tomorrow.md 2>/dev/null | head -80
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6
  npm run build 2>&1 | tail -3

COMMS: .claude/comms/tomorrow.md · T[N] LESSON: · T[N]→T[M]: · T[N] S[N+1] FIRST:

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean
  Final score: calculateFinalScore(scores[], unusedCount)→number
  Phase DB mapping: sessionPhaseColumn(storePhase) · 'scoring'→'finished'
  Event types: short names → resolveDbEventType in useGameSync.js
  Serialization: serializableState()=JSON.parse(JSON.stringify(store)) · NOT structuredClone
  turnTimeRemaining: in store (T2 S10) · seeded from TURN_TIME_LIMIT · reset on endTurn
  Terrain biomes: getBiomeForRegion(regionId) → {colors:{hex}} · biome.colors.hex for empty hexes
  Element icons: src/components/Board/ElementIcon.jsx · imported by HexCell + CardFrame

DB CONTRACT (5 tables · all RLS · migrations 001-008):
  room_code: char(6) · status IN ('waiting','playing','finished')
  game_events.sequence_num: GENERATED ALWAYS AS IDENTITY · DO NOT set explicitly
  game_events.event_type: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  game_sessions.phase: CHECK IN (playing|endgame|finished) — NOT 'scoring'
  Migration 006: purge_e2e_test_data() · SECURITY DEFINER · deletes finished rooms
  Migration 007: restrict purge to authenticated
  Migration 008 (T2 S12): extend purge to 'waiting'+'playing' rooms for bot-named profiles

GAME MECHANICS:
  BOARD: R0 Sacred City(#1a1528)cq=0cr=0 · R1 Living Earth(#0d1f14)cq=8cr=-4 · R2 Free Energy(#1f0d0d)cq=4cr=5
  Biome empty fill: R0=#1a1528 · R1=#0d1f14 · R2=#1f0d0d (dark tones from terrainBiomes.js)
  Factories: F0(4,-2)·F1(6,1)·F2(2,3) · 4 ELEMENTS: energy⚡·biofarming◈·technology◉·community✦
  TURN=3 ACTIONS · PLACEMENT: empty·first→center·else→adjacent·key 'q,r'
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster · PHASE: 'scoring' (not 'ended')
  BONUS: 1 per turn enforced · earn paths wired (data pending)
  REALTIME: DB=authoritative · Broadcast=ephemeral<32KB · Presence=lobby

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (52 · cumulative):
  1-49: [see prior versions · all preserved]
  50. A data-testid on a permanently-mounted element returns isVisible()=true regardless of state.
      For state detection, use a FLIPPING ATTRIBUTE (data-my-turn='true'/'false') on the container —
      not a conditional element that may never unmount (T1 S11)
  51. Before editing selectors that fail on production, run the same bot/test against localhost
      to isolate deploy-lag from code-wrong. One local run turns a guess into precise actionable
      routing (T2 S11)
  52. When a cross-lane harness fails at a new point each session, isolate the variable by running
      against both local and prod. Both fail = script bug. Only prod fails = deploy lag.
      Never route a guess (T3 S11)

[Rules 1-49 preserved from previous version — see git history for full list]

CODEWORDS:
  T[N] AUTODRIVE! → paste output · GitHub verify + XRAY!/200 + next forge
  FORGE! T[N] → write forge · XRAY! → audit · REFORGE! → 7-phase transcendence
  Forge target: 200/200 → rate /300 · <85 internal = REWRITE
  SKILLUPGRADE! · SCANSKILLS! · DEEPDIVE! · OVERDRIVE! · NIGHTSAVE!
  NIGHTSAVE! → Google Drive update (ID: 1gs4EgKyG0oFZKE5X0nsc3OFzUVDajPN5lBMchNCP7_I)

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
SKILLS v3: .claude/skills/ · reforge (190/200) · supabase-patterns (192/200) · neotopia-forge-patterns (196/200)
