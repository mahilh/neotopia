# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (post S9 · June 26 2026):
  ✅ TUTORIAL SHIPPED · Tutorial.jsx · 3-step · first-turn only · game now playable
  ✅ FACTORY PULSE + INSTRUCTION TEXT · uiPhase machine
  ✅ COPY CODE BUTTON · 44px · username edit · 6 banned names removed
  ✅ game_end WIRED · buildGameEndEvent→sync.pushState
  ✅ FINALSCORE STAGGER + COUNT-UP · reduced-motion aware
  ✅ ENGINE FUZZ · 150 games · 100% terminate · 0 violations · permanent guard
  ✅ purge_e2e_test_data() · migration 006 · authenticated-only (007)
  ✅ 99 TESTS GREEN (14 files) · BUILD CLEAN
  ✅ PHASE-OVER-WIRE E2E · PASS 2×+ · definitive proof
  ✅ GLOBAL TEARDOWN · tests/e2e/global-teardown.js · signInAnon→purge · authenticated
  ✅ data-testid SHIPPED · T1 S9 53cba84 · factory · my-turn-badge · end-turn-btn · hex-valid
  ✅ CARD FRAME · src/components/CardFrame.jsx · ancient esoteric
  ✅ ART PIPELINE · scripts/generate-art.js · 56 cards defined
  🔴 CRITICAL BUG FIXED (T3 S8): sessionPhaseColumn · game_sessions.phase CHECK rejects 'scoring'
     Natural game-end was silently 400ing on every game. Fixed in useGameSync.js.

  ⏳ T1 S10: data-testid for Ready + tutorial-dismiss · SVG element icons · CardFrame in hand
  ⏳ T2 S10: turnTimeRemaining in store · terrain biomes · bonus data (6th ask if needed)
  ⏳ T3 S10: bot selector update with data-testid · rate-limit handling
  ⏳ MAHIL: git pull · bonus hex data · neotopia.io domain · pixel art card generation

BOT SIMULATION ANALYSIS (prod run · June 26 2026 · full breakdown):
  WORKING: Landing → room creation (TAB357/JMDDFY/TTU4N5) → joining → game board ✅
  ERROR BREAKDOWN: { ready-failed:3, no-tutorial:3, stuck-state:90 }
  ROOT CAUSE CASCADE:
    ready-failed:3 → bot uses button:has-text("Ready") but button text/timing changed in T1 S8
    → game starts with player sync broken
    → isMyTurn never correctly set for bot player
    → tutorial gate {showTutorial && isMyTurn}: isMyTurn=false → tutorial never mounts
    → no-tutorial:3 (tutorial IS there but never renders because isMyTurn=false)
    → text=/your turn/i never matches (no data-testid yet at time of run)
    → stuck-state:30 per game × 3 games = 90
  FIX REQUIRED (T1 S10):
    Add data-testid="ready-btn" to Ready button
    Add data-testid="tutorial-dismiss" to tutorial dismiss button
    Decouple tutorial gate from isMyTurn: show tutorial on game mount, not on isMyTurn

CRITICAL BUG FIXED (T3 S8 · sessionPhaseColumn):
  game_sessions.phase CHECK is (playing|endgame|finished) — NOT 'scoring'
  pushState wrote s.phase='scoring' → CHECK rejected → 400 → game-over never persisted
  Fix: sessionPhaseColumn('scoring')→'finished' at write boundary in useGameSync.js
  Guard: useGameSync.phasecolumn.test.js locked by unit test
  Implication: No game could ever reach FinalScore via natural end before this fix.

CARD ART DIRECTION (FINAL · after 3 iterations):
  REJECTED: photorealistic 3D render (too AI-sloppy, unreadable at card size)
  REJECTED: MTG painterly (beautiful but direction pivoted · second image 155/200)
  FINAL: 16-bit isometric pixel art · SNES RPG style · esoteric solarpunk
  Why: reads at 120px card size · cannot look like AI slop · unique genre nobody has
  Style: Stardew Valley + Chrono Trigger + ancient mystery school
  Palette: jewel-tone · teal blue green amber gold · limited 8-16 colors
  Frame: CardFrame.jsx (dark obsidian frame unchanged) + pixel art inside
  Prompts: docs/ART_DIRECTION_PIXEL.md · batch 1 reprompts + batch 2 prompts

CRITICAL PATTERNS (confirmed fixed · never revert):
  Auth: INITIAL_SESSION event · signingIn flag · storageKey 'neotopia-auth' · detectSessionInUrl:false
  game_events event_type: short names (place_element etc) → resolveDbEventType translates
  game_events: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  FinalScore: triggers on phase==='scoring' (NOT 'ended') · navigate('/lobby') for lobby
  calculateFinalScore: (scores[], unusedCount)→number (NOT breakdown object)
  Global index RPCs: get_global_neotopia_index() · increment_neotopia_index()
  Dev gate: Cmd+Shift+E · triggers phase='scoring' LOCAL ONLY · does NOT push to DB
  Landing route: / → Landing.jsx · /lobby → Lobby.jsx · /game/:roomId → GameRoom
  sessionPhaseColumn: maps store 'scoring'→'finished' at game_sessions write boundary
  gameEndEvent: buildGameEndEvent(state) (NOT buildGameEndPayload)
  purge_e2e_test_data RPC: requires signInAnonymously() first · authenticated-only (mig 007)
  Tutorial gate: decouple from isMyTurn — show on game mount (T1 S10 fix needed)

CARD NAMES (BANNED):
  AetherMind · AetherNet · AetherFlux · AetherProject · KnowBrand · Hameed · Mahil
  All removed in T1 S8 · 56/56 unique confirmed

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ (NOT useGameActions/useGameRoom/useGameSync/usePresence)
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short [lane] before every edit. M from other terminal = STOP.

SELF-RATING: Forge /100 before (<85=rewrite) · Task /50 after (<35=redo) · Session /300

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -120
  cat .claude/comms/tomorrow.md 2>/dev/null
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6
  npm run build 2>&1 | tail -3

COMMS: .claude/comms/tomorrow.md · T[N] LESSON: · T[N]→T[M]: · T[N] S[N+1] FIRST:

MOLTBOOK:
  Agent: neotopian · API key: $MOLTBOOK_API_KEY (in .env.local)
  Submolt: /m/neotopia · 1 organic follower · heartbeat 4h

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Near-miss: usePatternHighlight(regionId) → {completeKeys, partialKeys, completionCandidates}
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean · scoreCard delegates
  Final score: calculateFinalScore(scores[], unusedCount)→number (NOT breakdown object)
  Global index: getGlobalIndex() → Promise<number> · recordCivilizationContribution(userId,count)
  Game end event: src/lib/gameEndEvent.js · buildGameEndEvent(state) (NOT buildGameEndPayload)
  FinalScore trigger: phase === 'scoring' (not 'ended')
  Phase DB mapping: sessionPhaseColumn(storePhase) in useGameSync.js · 'scoring'→'finished'
  Event types: short names → resolveDbEventType in useGameSync.js
  Serialization: serializableState()=JSON.parse(JSON.stringify(store)) · NOT structuredClone

DB CONTRACT (5 tables · all RLS · migrations 001-007):
  room_code: char(6) CHECK(length=6) · status IN ('waiting','playing','finished')
  game_events.session_id → FK game_sessions.id (uuid · NOT room_id)
  game_events.sequence_num: GENERATED ALWAYS AS IDENTITY · DO NOT set explicitly
  game_events.event_type: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  game_sessions.phase: CHECK IN (playing|endgame|finished) — NOT 'scoring' · use sessionPhaseColumn()
  Migration 004: get_global_neotopia_index() · increment_neotopia_index() (SECURITY DEFINER)
  Migration 005: rooms_delete_host policy · host_id=auth.uid() AND status='finished' · FK cascade
  Migration 006: purge_e2e_test_data() RPC · E2E bot cleanup · SECURITY DEFINER
  Migration 007: restrict purge to authenticated · anon_can_execute=false

GAME MECHANICS:
  BOARD: R0 Sacred City(#7F77DD)cq=0cr=0 · R1 Living Earth(#1D9E75)cq=8cr=-4 · R2 Free Energy(#E24B4A)cq=4cr=5
  Factories: F0(4,-2)·F1(6,1)·F2(2,3) · 4 ELEMENTS: energy⚡·biofarming◈·technology◉·community✦
  TURN=3 ACTIONS · PLACEMENT: empty·first→center·else→adjacent·key 'q,r'
  SCORING: 6 rotations·completing-element·Diverse City · district=NUMBER not string
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster · PHASE: 'scoring' (not 'ended')
  BONUS: 1 per turn enforced · earn paths wired (data pending from physical board)
  REALTIME: DB=authoritative · Broadcast=ephemeral<32KB · Presence=lobby

ELEMENT→CIVILIZATION: energy→Energy/Invention·biofarming→Food/Regen·technology→Tech/AI·community→Source/Culture
NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (46 · cumulative):
  1.  NEVER git add -A · pathspec from git status
  2.  NO em dashes · use ·
  3.  NO window.confirm() · hold-to-confirm
  4.  44px touch targets
  5.  tabular-nums on game numbers
  6.  npm run build before commit
  7.  PREMISE CHECK — read files before prescribing
  8.  pixelToHex paired with hexToPixel
  9.  Pattern rotation before scoring
  10. Cluster BFS before final scoring
  11. Production tile structure before factory logic
  12. Diverse City needs region.lastBuiltIllustration
  13. Rate forge /100 before · <85=rewrite (hard stop)
  14. Rate task /50 after · <35=redo
  15. ONE evolution lesson per session
  16. Server is source of truth for scoring
  17. No @ in bash globs · node -e
  18. 'permission denied' != 'does not exist'
  19. Raw SQL needs GRANT
  20. Known-cause gate + independent tasks = parallel
  21. Broadcast max 32KB · signal only
  22. Zustand→Supabase must be JSON-serializable
  23. useCallback deps never include store reference
  24. Channel MUST be removed before new one
  25. Re-read other lane's module right before integration
  26. Premise-check DB contract: types·FKs·CHECKs·RLS per-command·auth config
  27. Run code against tests before trusting either · grep consumers first
  28. Premise check is stale · re-run right before acting
  29. Validate Y fully BEFORE debiting X in any spend action
  30. information_schema != full DB contract · GENERATED ALWAYS AS IDENTITY rejects explicit inserts
  31. When live verification blocked: isolate precisely, prove wiring fires, convert to deterministic test
  32. Never bake guessed game data into engine · never Math.random() in synced/replayable actions
  33. Run unit tests first · live E2E second · NEVER concurrently
  34. Gate-skip is a pause not an abort · re-check gate when tree moves
  35. Prove data layer when browser unavailable · never claim 'fixed live' when only 'data-proven'
  36. Test harness must mirror real code setup path exactly
  37. A fixed CSS height is a request not a guarantee · flex children shrink past it
  38. In live multi-terminal repo, boot premise check has shelf life of minutes · 'file modified since read' = collision signal
  39. HTTP status is a witness · 400 proves insert reached DB · null ref = no HTTP call
  40. When two lanes touch one seam, trace the composed value after both edits · verify against HEAD-of-tree (T1 S7)
  41. Before writing a cross-lane bug flag, re-read the owner's current files · the bug may already be mid-fix (T2 S8)
  42. "Two lanes both fixed it" can ADD a bug · trace composed behavior end-to-end (T3 S7)
  43. In a shared .git, commit per task not per session · uncommitted work can be silently stashed · recover autostash per-file (T1 S8)
  44. A SECURITY DEFINER function callable by anon is an unauthenticated-destruction vector · destructive RPCs must require authenticated (T2 S9)
  45. A denormalized column is a second contract · premise-check mirror column CHECKs against all blob values — especially terminal states (T3 S8 · game_sessions.phase)
  46. Before wiring a destructive function into an unattended hook, read its definition and prove scope + auth boundary live · an automated cleanup you didn't scope-check is a foot-gun pointed at prod data (T3 S9)

CODEWORDS:
  T[N] AUTODRIVE! → paste output · I run: GitHub verify + XRAY!/200 + next forge
  FORGE! T[N] → just write forge · XRAY! → just audit · REFORGE! → 7-phase transcendence
  SKILLUPGRADE! → 6-phase · SCANSKILLS! → audit all · DEEPDIVE! → 10-step
  OVERDRIVE! → 7-agent council · NIGHTSAVE! → Google Drive · Rate it → /300

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
SKILLS: .claude/skills/ · reforge · supabase-patterns · neotopia-forge-patterns · moltbook
