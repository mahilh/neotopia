# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (post S10 · June 26 2026):
  ✅ TUTORIAL SHIPPED · Tutorial.jsx · 3-step · first-turn only
  ✅ TUTORIAL GATE FIXED (T1 S10) · {showTutorial && phase==='playing'} · NOT isMyTurn
  ✅ data-testid="ready-btn" on Ready button · "tutorial-dismiss" · "tutorial-skip"
  ✅ UX SCAN 23→14 (T1 S10) · 9 font-size violations fixed · 14 remaining = false positives
  ✅ BOT CASCADE BROKEN (T1 S10) · Landing→username→join→board→tutorial dismissed ✅
  ✅ FULL E2E SUITE GREEN (T3 S10) · 5/5 fresh window · globalTeardown {rooms:0, profiles:4}
  ✅ ELEMENT ICONS · bespoke SVG per type · hex-appear animation · S9 already shipped
  ✅ CARDFRAME WIRED · hand + offer · art auto-loads when PNGs land
  ✅ TURN TIMER SYNCED (T2 S10) · turnTimeRemaining in store + seededState fixture
  ✅ TERRAIN BIOMES (T2 S10) · terrainBiomes.js · getBiomeForRegion · T1 import recipe
  ✅ AUTHENTICATED TEARDOWN (T3 S9) · signInAnon→purge · 20 residual profiles cleaned
  ✅ 102 TESTS GREEN (14 files) · BUILD CLEAN
  🔴 CRITICAL BUG FIXED (T3 S8): sessionPhaseColumn · game_sessions.phase rejects 'scoring'
  🟡 BOT STILL 0 PLACED: errors 90→20 (lobby fixed) but totalPlaced=0 · wall moved in-game
     Bot can't detect isMyTurn via my-turn-badge (800ms timeout too short OR badge timing)
     Fix: T1 S11 (badge render timing) + T2 S11 (bot timeout 800→2000ms)
  🟡 PURGE RPC only deletes 'finished' rooms → bot 'waiting' rooms accrue (21 hand-purged T3 S10)
     Fix: T3 S11 migration 008 extending purge to 'waiting' rooms for bot profiles
  🟡 UX SCAN false positives: checks /game testids on Landing/Lobby routes (can't reach /game)
     Fix: T3 S11 (scope scan to /game or create authenticated scan path)

  ⏳ T1 S11: my-turn-badge render timing fix · terrain biomes wired · ElementIcon.jsx extraction
  ⏳ T2 S11: bot selector timeout 800→2000ms · ux-health.yml CI workflow · bonus data 5th ask
  ⏳ T3 S11: migration 008 (purge 'waiting' rooms) · /game UX scan · bot totalPlaced > 0 confirm
  ⏳ MAHIL: bonus hex data (5th request) · neotopia.io domain · pixel art card generation

BOT SIMULATION PROGRESSION:
  Baseline (June 26 pre-S10): { ready-failed:3, no-tutorial:3, stuck-state:90 } · 0 placed
  After T1 S10 + T3 fixes: errors 90→20 · bot reaches board + dismisses tutorial ✅
  Still failing: stuck-state:20 · my-turn-badge not detected in turn loop
  ROOT: 800ms isVisible timeout too short for DB-sync-driven turn badge render
  TARGET: totalPlaced > 0 · game completes · confirmed by T3 S11

CRITICAL BUG FIXED (T3 S8 · sessionPhaseColumn):
  game_sessions.phase CHECK is (playing|endgame|finished) — NOT 'scoring'
  pushState wrote s.phase='scoring' → CHECK rejected → 400 → game-over never persisted
  Fix: sessionPhaseColumn('scoring')→'finished' at write boundary in useGameSync.js
  Guard: useGameSync.phasecolumn.test.js locked by unit test

CARD ART DIRECTION (FINAL after 3 iterations):
  REJECTED: photorealistic 3D render · REJECTED: MTG painterly (155/200, wrong direction)
  FINAL: 16-bit isometric pixel art · SNES RPG style · esoteric solarpunk · one building per card
  COMMON MISTAKE: ChatGPT generates entire cities → always add "ONE BUILDING ONLY"
  Image 3 (latest): 127/200 · pixel art ✅ · too complex (whole city) · wrong colors (grey not amber)
  Fix: add "ONE BUILDING ONLY. Simple ground 5 tiles. Simple sky. Building fills 65%." to every prompt
  Palette: warm amber-gold stone + teal crystal glow · NOT cold grey stone + blue
  Frame: CardFrame.jsx (dark obsidian unchanged) · art sits inside
  Prompts: docs/ART_DIRECTION_PIXEL.md

CRITICAL PATTERNS (never revert):
  Auth: INITIAL_SESSION event · signingIn flag · storageKey 'neotopia-auth' · detectSessionInUrl:false
  game_events: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  FinalScore: triggers on phase==='scoring' · navigate('/lobby')
  calculateFinalScore: (scores[], unusedCount)→number (NOT breakdown object)
  sessionPhaseColumn: maps store 'scoring'→'finished' at game_sessions write boundary
  gameEndEvent: buildGameEndEvent(state) (NOT buildGameEndPayload)
  purge_e2e_test_data RPC: requires signInAnonymously() first · authenticated-only (mig 007)
  Tutorial gate: {showTutorial && phase==='playing'} — NOT isMyTurn (T1 S10 fix · never revert)
  game_sessions.phase CHECK: (playing|endgame|finished) — NEVER write 'scoring' directly

CARD NAMES (BANNED):
  AetherMind · AetherNet · AetherFlux · AetherProject · KnowBrand · Hameed · Mahil

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ (NOT useGameActions/useGameRoom/useGameSync/usePresence)
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short [lane] before every edit. M from other terminal = STOP.

SELF-RATING: Forge /100 before (<85=rewrite) · Task /50 after (<35=redo) · Session /300
Forge quality target: 200/200 · above 200 = rate /300 · gap = file reads before prescribing

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -120
  cat .claude/comms/tomorrow.md 2>/dev/null | head -60
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6
  npm run build 2>&1 | tail -3

COMMS: .claude/comms/tomorrow.md · T[N] LESSON: · T[N]→T[M]: · T[N] S[N+1] FIRST:

MOLTBOOK: Agent neotopian · /m/neotopia · 1 organic follower · heartbeat 4h

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean
  Final score: calculateFinalScore(scores[], unusedCount)→number
  Phase DB mapping: sessionPhaseColumn(storePhase) · 'scoring'→'finished'
  Event types: short names → resolveDbEventType in useGameSync.js
  Serialization: serializableState()=JSON.parse(JSON.stringify(store)) · NOT structuredClone
  turnTimeRemaining: in store (T2 S10) · seeded from TURN_TIME_LIMIT · reset on endTurn

DB CONTRACT (5 tables · all RLS · migrations 001-008):
  room_code: char(6) · status IN ('waiting','playing','finished')
  game_events.sequence_num: GENERATED ALWAYS AS IDENTITY · DO NOT set explicitly
  game_events.event_type: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  game_sessions.phase: CHECK IN (playing|endgame|finished) — NOT 'scoring'
  Migration 006: purge_e2e_test_data() · SECURITY DEFINER
  Migration 007: restrict purge to authenticated
  Migration 008 (T3 S11 pending): extend purge to 'waiting' rooms for bot profiles

GAME MECHANICS:
  BOARD: R0 Sacred City(#7F77DD)cq=0cr=0 · R1 Living Earth(#1D9E75)cq=8cr=-4 · R2 Free Energy(#E24B4A)cq=4cr=5
  Factories: F0(4,-2)·F1(6,1)·F2(2,3) · 4 ELEMENTS: energy⚡·biofarming◈·technology◉·community✦
  TURN=3 ACTIONS · PLACEMENT: empty·first→center·else→adjacent·key 'q,r'
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster · PHASE: 'scoring' (not 'ended')
  BONUS: 1 per turn enforced · earn paths wired (data pending)
  REALTIME: DB=authoritative · Broadcast=ephemeral<32KB · Presence=lobby

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (49 · cumulative):
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
  38. In live multi-terminal repo, boot premise check has shelf life of minutes
  39. HTTP status is a witness · 400 proves insert reached DB · null ref = no HTTP call
  40. When two lanes touch one seam, trace the composed value after both edits · verify against HEAD-of-tree (T1 S7)
  41. Before writing a cross-lane bug flag, re-read the owner's current files (T2 S8)
  42. "Two lanes both fixed it" can ADD a bug · trace composed behavior end-to-end (T3 S7)
  43. In a shared .git, commit per task not per session · recover autostash per-file (T1 S8)
  44. A SECURITY DEFINER function callable by anon is an unauthenticated-destruction vector (T2 S9)
  45. A denormalized column is a second contract · premise-check mirror column CHECKs (T3 S8)
  46. Before wiring a destructive function into an unattended hook, prove scope + auth boundary live (T3 S9)
  47. Hold strong opinions weakly. When the team asks for a design change with a valid use case three times,
      concede and implement it well — a local optimum that creates friction is worth less than shipping (T2 S10)
  48. Honor the forge's own gates. When a task's precondition gate proves it's already done, skip rather
      than re-implement — evidence-backed skip prevents regression. Reading files before prescribing proved
      Task C done and caught its element.type bug before it shipped (T1 S10)
  49. A falling error count over a flat-zero outcome means the wall moved, not fell. Pair the error trend
      with the terminal outcome (elements placed, game completed) — not just the error count (T3 S10)

CODEWORDS:
  T[N] AUTODRIVE! → paste output · I run: GitHub verify + XRAY!/200 + next forge (now /200 rated)
  FORGE! T[N] → just write forge · XRAY! → just audit · REFORGE! → 7-phase transcendence
  Forge self-rate /100 before (<85=rewrite) · above 200/200 → rate /300
  SKILLUPGRADE! · SCANSKILLS! · DEEPDIVE! · OVERDRIVE! · NIGHTSAVE! (Google Drive update)

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
SKILLS: .claude/skills/ · reforge · supabase-patterns · neotopia-forge-patterns · moltbook
