# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (post S7-S8 · June 26 2026 · FIRST REAL PLAYTEST COMPLETED):
  ✅ ANON AUTH FIXED · INITIAL_SESSION pattern (d420342)
  ✅ MULTIPLAYER LOOP VERIFIED · move→DB→postgres_changes→rejoin
  ✅ LANDING.JSX LIVE · "Enter the Civilization" · at route /
  ✅ FINALSCORE.JSX · 8/8 checks · civilization record · REAL Global Index
  ✅ GLOBAL INDEX LIVE · migration 004 · get_global_neotopia_index() + increment_neotopia_index()
  ✅ game_events FIXED · resolveDbEventType (T3) + short names (T1) · both correct
  ✅ MIGRATION 005 · rooms_delete_host · FK cascade · CI cleanup
  ✅ gameEndEvent.js · game_end audit payload · wiring for T1 FinalScore
  ✅ TWO-HUMAN E2E · tests/e2e/two-human.e2e.js · 8/8 checks · stable 2×
  ✅ PLAYWRIGHT RECONNECT E2E · CDP offline · visibilitychange · 2 tests
  ✅ CI PIPELINE · .github/workflows/e2e.yml · secrets added
  ✅ 91 TESTS GREEN (11 files) · BUILD CLEAN
  ✅ MOLTBOOK · neotopian claimed · /m/neotopia · heartbeat 4h · 1 organic follower
  ✅ BOT SIMULATION · scripts/bot-simulate.js · autonomous 2-bot Playwright playtest
  ❌ PLAYTEST FINDING: Players never placed elements (Turn 17 · 27 cards · 0 points)
  ⏳ T1 S8: Tutorial overlay · factory pulse · copy button · card names · instruction text
  ⏳ T2 S9: Bot simulation fixes · bonus data (Mahil) · CLAUDE.md function names fix
  ⏳ T3 S8: Phase-over-wire E2E · turn timer · purge job
  ⏳ MAHIL: bonus hex positions from physical board · neotopia.io custom domain

FIRST PLAYTEST (June 26 2026 · Mahil + Shahzaman · Karachi):
  RESULT: Turn 17 · 27 cards in hand · Score 0/0/0 · Board empty
  ROOT CAUSE: Players only drew cards · never placed elements on board (Action B)
  NO TUTORIAL EXISTS · factories not obviously clickable · board appeared static
  CRITICAL FIX: T1 S8 MUST add tutorial overlay before anything else

CRITICAL PATTERNS (confirmed fixed · never revert):
  Auth: INITIAL_SESSION event · signingIn flag · storageKey 'neotopia-auth' · detectSessionInUrl:false
  game_events event_type: short names (place_element etc) → resolveDbEventType translates
  game_events: must be one of {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  FinalScore: triggers on phase==='scoring' (NOT 'ended') · navigate('/lobby') for lobby
  calculateFinalScore: (scores[], unusedCount)→number (NOT breakdown object)
  Global index RPCs: get_global_neotopia_index() · increment_neotopia_index() (NOT the old names)
  Dev gate: Cmd+Shift+E (NOT Cmd+F) · triggers phase='scoring' · import.meta.env.DEV only
  Landing route: / → Landing.jsx · /lobby → Lobby.jsx · /game/:roomId → GameRoom

DOC-DRIFT FIX (T2 flagged · now corrected):
  WRONG (old): neotopia_global_index_aggregate · neotopia_increment_index
  CORRECT (live): get_global_neotopia_index · increment_neotopia_index

CARD NAMES (BANNED — never use in any card):
  AetherMind · AetherNet · AetherFlux · AetherProject · KnowBrand · Hameed · Mahil
  See docs/CARD_NAMES_REDESIGN.md for full 56-card replacement list

BOT SIMULATION:
  Script: scripts/bot-simulate.js
  Run: node scripts/bot-simulate.js (while npm run dev running)
  Remote: BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
  Reports to: .bot-reports/report-[timestamp].json
  Tests: tutorial missing · stuck state · element placement · room code visibility

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ (NOT useGameActions/useGameRoom/useGameSync/usePresence)
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short [lane] before every edit. M from other terminal = STOP.

SELF-RATING: Forge /100 before (<85=rewrite) · Task /50 after (<35=redo) · Session /300

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -100
  cat .claude/comms/tomorrow.md 2>/dev/null
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6
  npm run build 2>&1 | tail -3

COMMS: .claude/comms/tomorrow.md · T[N] LESSON: · T[N]→T[M]: · T[N] S[N+1] FIRST:

MOLTBOOK:
  Agent: neotopian · API key: $MOLTBOOK_API_KEY (in .env.local)
  Submolt owned: /m/neotopia · 1 organic follower · last active confirmed
  Heartbeat: GitHub Actions every 4h · Posts ready: docs/MOLTBOOK_POST_QUEUE.md

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Near-miss: usePatternHighlight(regionId) → {completeKeys, partialKeys, completionCandidates}
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean · scoreCard delegates
  Final score: calculateFinalScore(scores[], unusedCount)→number (NOT breakdown object)
  Global index: getGlobalIndex() → Promise<number> · recordCivilizationContribution(userId,count)
  Game end event: src/lib/gameEndEvent.js · buildGameEndPayload(players,regions) · wire in FinalScore
  FinalScore trigger: phase === 'scoring' (not 'ended')
  Event types: short names → resolveDbEventType in useGameSync.js
  Serialization: serializableState()=JSON.parse(JSON.stringify(store)) · NOT structuredClone

DB CONTRACT (5 tables · all RLS · migrations 001-005):
  room_code: char(6) CHECK(length=6) · status IN ('waiting','playing','finished')
  game_events.session_id → FK game_sessions.id (uuid · NOT room_id)
  game_events.sequence_num: GENERATED ALWAYS AS IDENTITY · DO NOT set explicitly
  game_events.event_type: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  Migration 004: get_global_neotopia_index() · increment_neotopia_index() (SECURITY DEFINER)
  Migration 005: rooms_delete_host policy · host_id=auth.uid() AND status='finished' · FK cascade

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

PERMANENT ANTI-REGRESS RULES (42 · cumulative):
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
  31. When live verification blocked: isolate precisely, prove wiring fires (403=code ran), convert to deterministic test
  32. Never bake guessed game data into engine · never Math.random() in synced/replayable actions
  33. Run unit tests first · live E2E second · NEVER concurrently
  34. Gate-skip is a pause not an abort · re-check gate when tree moves
  35. Prove data layer when browser unavailable · never claim 'fixed live' when only 'data-proven'
  36. Test harness must mirror real code setup path exactly
  37. A fixed CSS height is a request not a guarantee · flex children shrink past it · pin flexShrink:0
  38. In live multi-terminal repo, boot premise check has shelf life of minutes · 'file modified since read' = collision signal
  39. HTTP status is a witness · 400 proves insert reached DB · null ref = no HTTP call
  40. When two lanes touch one seam, trace the composed value after both edits · verify against HEAD-of-tree not boot-of-session · a green suite is false confidence when a guard pins a stale constant (T1 S7)
  41. Before writing a cross-lane bug flag, re-read the owner's current files · the bug you found at boot may already be mid-fix · prefer confirming a fix to re-raising it (T2 S8)
  42. "Two lanes both fixed it" can ADD a bug the combination owns · trace composed behavior end-to-end · a flaky-looking failure earns its root cause before any timeout bump (T3 S7)

CODEWORDS:
  T[N] AUTODRIVE! → paste output · I run: GitHub verify + XRAY!/200 + next forge
  FORGE! T[N] → just write forge · XRAY! → just audit · REFORGE! → 7-phase transcendence
  SKILLUPGRADE! → 6-phase · destroy worst skill · rebuild · push
  SCANSKILLS! → audit all skills · runs inside AUTODRIVE!
  DEEPDIVE! → 10-step · OVERDRIVE! → 7-agent council (NEOTOPIAN has Moltbook mandate)
  NIGHTSAVE! → save to Google Drive · Rate it → /300 session rating

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
SKILLS: .claude/skills/ · overdrive/SKILL.md · reforge/SKILL.md · supabase-patterns/SKILL.md
       neotopia-forge-patterns/SKILL.md · skillupgrade/SKILL.md · scanskills/SKILL.md
       moltbook/SKILL.md · moltbook-scan/SKILL.md · _registry/INDEX.md
