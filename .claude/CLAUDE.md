# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (post S8-S9 · June 26 2026 · ALL TERMINALS COMPLETE):
  ✅ TUTORIAL SHIPPED · Tutorial.jsx · 3-step · first-turn only · 5/5 checks · GAME NOW PLAYABLE
  ✅ FACTORY PULSE + INSTRUCTION TEXT · uiPhase machine · dynamic "Pick an element..." text
  ✅ COPY CODE BUTTON · 44px · "✓ Copied" · room code UX fixed
  ✅ USERNAME EDIT · pencil → Save · claimUsername upserts
  ✅ 6 BANNED NAMES REMOVED · incl Hameed (sacred boundary) · 56/56 unique
  ✅ game_end WIRED · buildGameEndEvent→sync.pushState · lowest-seat · per-room guard
  ✅ FINALSCORE STAGGER + COUNT-UP · reduced-motion aware · solo no-ops correctly
  ✅ ENGINE FUZZ · 150 games · 100% terminate · 0 violations · permanent guard
  ✅ purge_e2e_test_data() RPC · migration 006 · authenticated-only (migration 007)
  ✅ MIGRATION 007 · restrict purge to authenticated · anon_can_execute=false
  ✅ TURN_TIME_LIMIT CONFIG · in store · T1 wiring recipe in comms
  ✅ 99 TESTS GREEN (14 files) · BUILD CLEAN
  ✅ PHASE-OVER-WIRE E2E · phase-over-wire.e2e.js · PASS 2×+ · definitive proof
  ✅ E2E CLEANUP · 0 rooms after test · browser-owned rooms self-clean via setSession
  ✅ CARD FRAME · src/components/CardFrame.jsx · ancient esoteric · dark obsidian + element color
  ✅ ART PIPELINE · scripts/generate-art.js · 56 cards defined · OpenAI API ready
  🔴 CRITICAL BUG FIXED (T3 S8): game_sessions.phase CHECK rejects 'scoring' → 400 on every
     natural game-end. No game could ever naturally end before this fix. Fixed by sessionPhaseColumn()
     map at the write boundary. The playtest died at T17 so this never surfaced until T3 S8.

  ⏳ T1 S9: data-testid attributes (bot selectors) · SVG element icons on hexes · board terrain biomes
  ⏳ T2 S10: turnTimeRemaining in store · bonus data activation if provided
  ⏳ T3 S9: globalTeardown with signInAnonymously+purge RPC · turn timer E2E
  ⏳ MAHIL: git pull (CardFramePreview.html on disk) · bonus hex data · neotopia.io domain
  ⏳ MAHIL: OpenAI API key in .env.local (platform.openai.com/api-keys · ~$5 credit)
  ⏳ MAHIL: ChatGPT Batch 1 images → public/art/cards/ (MTG painterly style prompts in chat)

CRITICAL BUG FIXED (T3 S8 · sessionPhaseColumn):
  game_sessions.phase CHECK is (playing|endgame|finished) — NOT 'scoring'
  The store's terminal phase is 'scoring' — pushState was writing s.phase directly
  Result: every natural game-end UPDATE → 400 → game-over state never persisted
  Fix: sessionPhaseColumn('scoring')→'finished' at the write boundary in useGameSync.js
       The jsonb keeps 'scoring' that syncFromServer reads correctly
  Guard: useGameSync.phasecolumn.test.js — locked by unit test
  Implication: No game in production could ever reach FinalScore via natural end before this fix.
               The playtest died at T17 → latent until T3's phase-over-wire E2E proof surfaced it.

BOT SIMULATION FINDINGS (production run · June 26 2026):
  Result: 3 games · Landing page → rooms created → both bots on game board ✅
          THEN: placed 0 · drew 0 · 32 errors per game
  Root cause: CSS Modules hash class names at Vite build time
    Bot selectors [class*="factory"] → empty arrays in production (class = "factory_abc123")
    Bot selectors [class*="offer"] → same problem
  Fix: T1 must add data-testid attributes to key interactive elements:
    data-testid="factory-[regionId]" on factory hex elements
    data-testid="card-offer" on offer card rows
    data-testid="my-turn-badge" on Your Turn indicator
  The 32 errors = stuck-state (isMyTurn never detected) + action-errors (empty locators)
  Room creation + multiplayer routing: FULLY WORKING ✅ (TAB357, JMDDFY, TTU4N5 all worked)

CRITICAL PATTERNS (confirmed fixed · never revert):
  Auth: INITIAL_SESSION event · signingIn flag · storageKey 'neotopia-auth' · detectSessionInUrl:false
  game_events event_type: short names (place_element etc) → resolveDbEventType translates
  game_events: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  FinalScore: triggers on phase==='scoring' (NOT 'ended') · navigate('/lobby') for lobby
  calculateFinalScore: (scores[], unusedCount)→number (NOT breakdown object)
  Global index RPCs: get_global_neotopia_index() · increment_neotopia_index()
  Dev gate: Cmd+Shift+E (NOT Cmd+F) · triggers phase='scoring' LOCAL ONLY · does NOT push to DB
  Landing route: / → Landing.jsx · /lobby → Lobby.jsx · /game/:roomId → GameRoom
  sessionPhaseColumn: maps store 'scoring'→'finished' at game_sessions write boundary
  gameEndEvent: buildGameEndEvent(state) (NOT buildGameEndPayload) · in src/lib/gameEndEvent.js
  purge_e2e_test_data RPC: requires signInAnonymously() first · authenticated-only (mig 007)

CARD NAMES (BANNED — never use in any card):
  AetherMind · AetherNet · AetherFlux · AetherProject · KnowBrand · Hameed · Mahil
  All 6 removed from projectCards.js in T1 S8 · 56/56 unique names confirmed

CARD ART DIRECTION:
  Style: MTG card art · painterly oil illustration · single focal building · visible brushstrokes
         NOT photorealistic · NOT 3D render · dramatic sky background
  Frame: src/components/CardFrame.jsx · ancient esoteric · dark obsidian · serif Roman numerals
  Art files: public/art/cards/[card-id].png · auto-detected by CardFrame
  Generation: node scripts/generate-art.js (needs OPENAI_API_KEY in .env.local)
  Manual: docs/ART_PROMPTS_BATCH1.md (MTG painterly prompts for ChatGPT)

BOT SIMULATION:
  Script: scripts/bot-simulate.js (fixed for Landing page routing)
  Run against dev: npm run dev (tab 1) · node scripts/bot-simulate.js (tab 2)
  Run against prod: BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
  KNOWN: prod run gives 32 errors (CSS Module class names hashed · need data-testid in T1 S9)
  Reports: .bot-reports/report-[timestamp].json

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
  Submolt owned: /m/neotopia · 1 organic follower · last active confirmed
  Heartbeat: GitHub Actions every 4h

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

PERMANENT ANTI-REGRESS RULES (45 · cumulative):
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
  40. When two lanes touch one seam, trace the composed value after both edits · verify against HEAD-of-tree not boot-of-session (T1 S7)
  41. Before writing a cross-lane bug flag, re-read the owner's current files · the bug may already be mid-fix (T2 S8)
  42. "Two lanes both fixed it" can ADD a bug · trace composed behavior end-to-end (T3 S7)
  43. In a shared .git, commit per task not per session · uncommitted work can be silently stashed by another terminal's pull --rebase --autostash · recover shared autostash per-file (never pop) · commit immediately after recovery (T1 S8)
  44. A SECURITY DEFINER function callable by anon is an unauthenticated-destruction vector · destructive RPCs must require authenticated role · verify with pg_proc.proacl after GRANT (T2 S9)
  45. A denormalized column is a second contract · when pushState writes both jsonb blob and mirror columns, premise-check every mirror column's CHECK against every value the blob can carry — especially terminal states never reached in testing (T3 S8 · found: game_sessions.phase rejects 'scoring' · every natural game-end was silently 400ing)

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
