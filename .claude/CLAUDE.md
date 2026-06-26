# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (as of S6-S7 · June 26 2026):
  ✅ ANON AUTH FIXED · INITIAL_SESSION pattern (d420342 · T2 S6)
  ✅ MULTIPLAYER LOOP VERIFIED · move→DB→postgres_changes→rejoin
  ✅ FINALSCORE.JSX SHIPPED · 8/8 browser checks · civilization record
  ✅ GLOBAL NEOTOPIA INDEX LIVE · migration 004 SECURITY DEFINER · true aggregate
  ✅ game_events 400 FIXED · EVENT_TYPE_DB map · CHECK constraint aligned
  ✅ PLAYWRIGHT E2E LIVE · reconnect + visibilitychange · stable 2×
  ✅ CI PIPELINE · .github/workflows/e2e.yml · needs 2 secrets from Mahil
  ✅ NEAR-MISS ENGINE LIVE · SCOREFLASH LIVE · ACTIONBAR LIVE · REGIONLABELS LIVE
  ✅ 1-BONUS-PER-TURN ENFORCED · DETERMINISTIC EARN PATHS (data-pending)
  ✅ RECONNECT HARDENING · window.online + visibilitychange (T3 S4)
  ✅ MOLTBOOK · neotopian claimed · /m/neotopia live · heartbeat 4h
  ✅ 82 TESTS GREEN (9 files) · BUILD CLEAN
  ⏳ PENDING: two-human complete browser E2E (T1 S7) · bonus hex data (Mahil) · CI secrets (Mahil)

MAHIL ACTION NEEDED:
  1. Add GitHub Actions secrets: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
     URL: https://github.com/mahilh/neotopia/settings/secrets/actions
  2. Provide bonus hex positions from physical Neotopia board game
     (axial q,r per region + token type per spot + pile order for 7/13/18)

CRITICAL PATTERNS (confirmed fixed · never revert):
  Auth: INITIAL_SESSION event · signingIn flag · storageKey 'neotopia-auth' · detectSessionInUrl:false
  game_events: event_type must be one of {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  game_events: use EVENT_TYPE_DB map in useGameSync.js at the persistence boundary
  FinalScore: triggers on phase==='scoring' (NOT 'ended') · navigate('/') for lobby
  calculateFinalScore: signature is (scores[], unusedCount)→number (not breakdown object)
  getGlobalIndex(): in src/lib/supabase.js · uses migration 004 SECURITY DEFINER fn
  scoredCardIds: tracked in player state · pushed in tryScoreCard

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ (NOT useGameActions/useGameRoom/useGameSync/usePresence)
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short [lane] before every edit. M from other terminal = STOP.

SELF-RATING: Forge /100 before (<85=rewrite) · Task /50 after (<35=redo) · Session /300

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  cat .claude/comms/tomorrow.md 2>/dev/null
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6
  npm run build 2>&1 | tail -3

COMMS: .claude/comms/tomorrow.md · T[N] LESSON: · T[N]→T[M]: · T[N] S[N+1] FIRST:

MOLTBOOK:
  Agent: neotopian · API key: $MOLTBOOK_API_KEY (in .env.local)
  Submolt owned: /m/neotopia · Profile: https://www.moltbook.com/u/neotopian
  Heartbeat: GitHub Actions every 4h (MOLTBOOK_API_KEY secret required)
  Posts ready: docs/MOLTBOOK_POST_QUEUE.md

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Near-miss: usePatternHighlight(regionId) → {completeKeys, partialKeys, completionCandidates}
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean · scoreCard delegates
  Final score: calculateFinalScore(scores[], unusedCount)→number (NOT breakdown object)
  Global index: getGlobalIndex() → Promise<number> · recordCivilizationContribution(userId, count)
  FinalScore trigger: phase === 'scoring' (not 'ended')
  Event types: EVENT_TYPE_DB map in useGameSync.js · translated at persistence boundary
  Serialization: serializableState()=JSON.parse(JSON.stringify(store)) · NOT structuredClone
  Bonus: automatization+subsidy+initiative done · permits TODO · earn paths wired (data pending)

DB CONTRACT (5 tables · all RLS · all realtime):
  room_code: char(6) CHECK(length=6) · status IN ('waiting','playing','finished')
  game_events.session_id → FK game_sessions.id (uuid · NOT room_id)
  game_events.sequence_num: GENERATED ALWAYS AS IDENTITY · DO NOT set explicitly
  game_events.event_type: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  Migration 004: SECURITY DEFINER neotopia_global_index_aggregate + neotopia_increment_index
  serializableState() = JSON.parse(JSON.stringify(store)) · NOT structuredClone

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
GLOBAL INDEX: getGlobalIndex() in src/lib/supabase.js · migration 004 · starts at 0 (honest)

PERMANENT ANTI-REGRESS RULES (39 · cumulative):
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
  17. No @ in bash globs · node -e (S1)
  18. 'permission denied' != 'does not exist' (S1)
  19. Raw SQL needs GRANT (S1)
  20. Known-cause gate + independent tasks = parallel (S1)
  21. Broadcast max 32KB · signal only (REFORGE!)
  22. Zustand→Supabase must be JSON-serializable (REFORGE!)
  23. useCallback deps never include store reference (T2 S1)
  24. Channel MUST be removed before new one (REFORGE!)
  25. Re-read other lane's module right before integration (T1 S2)
  26. Premise-check DB contract: types·FKs·CHECKs·RLS per-command·auth config (T3 S2)
  27. Run code against tests before trusting either · grep consumers first (T2 S3)
  28. Premise check is stale · re-run right before acting (T1 S3)
  29. Validate Y fully BEFORE debiting X in any spend action (T2 S4)
  30. information_schema != full DB contract · GENERATED ALWAYS AS IDENTITY rejects explicit inserts (T3 S3)
  31. When live verification blocked: isolate precisely, prove wiring fires (403=code ran), convert to deterministic test (T1 S4)
  32. Never bake guessed game data into engine · never Math.random() in synced/replayable actions (T2 S5)
  33. Run unit tests first · live E2E second · NEVER concurrently (T3 S4)
  34. Gate-skip is a pause not an abort · re-check gate when tree moves (T1 S5)
  35. Prove data layer when browser unavailable · never claim 'fixed live' when only 'data-proven' (T2 S6)
  36. Test harness must mirror real code setup path exactly (T3 S5)
  37. A fixed CSS height is a request not a guarantee · flex children shrink past it · pin flexShrink:0 + verify computed height in-browser (T1 S6)
  38. In live multi-terminal repo, boot premise check has shelf life of minutes · treat 'file modified since read' as collision signal (stop+diff, not retry) (T2 S7)
  39. HTTP status is a witness · 400 proves insert reached DB (not null ref) · null ref = no HTTP call · read status then premise-check live constraint (T3 S6)

CODEWORDS:
  T[N] AUTODRIVE! → paste output · I run: GitHub verify + XRAY!/200 + next forge
  FORGE! T[N] → just write forge · XRAY! → just audit · REFORGE! → 7-phase transcendence
  SKILLUPGRADE! → 6-phase · destroy worst skill · rebuild · push · registry update
  SCANSKILLS! → audit all skills · runs inside AUTODRIVE! automatically
  DEEPDIVE! → 10-step analysis · OVERDRIVE! → 7-agent council (NEOTOPIAN has Moltbook mandate)
  NIGHTSAVE! → save to Google Drive · Rate it → /300 session rating

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
SKILLS: .claude/skills/ · overdrive/SKILL.md · reforge/SKILL.md · supabase-patterns/SKILL.md
       neotopia-forge-patterns/SKILL.md · skillupgrade/SKILL.md · scanskills/SKILL.md
       moltbook/SKILL.md · moltbook-scan/SKILL.md · _registry/INDEX.md
