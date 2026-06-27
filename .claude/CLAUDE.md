# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: The Architect (first name: Mahil) | Started: June 25 2026
# PRIVACY: Never use full surname in any file. "The Architect" or "Mahil" only.

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq
GitHub: mahilh/neotopia (public) · Vercel: auto-deploy from main

STATUS (post S16 · June 27 2026 · ALL THREE SESSIONS COMPLETE):
  ✅ sacredMilestone OVERLAY (T1 S16 · 4b8d055) · ✷ symbol · 2500ms auto-dismiss · amber-gold
  ✅ FinalScore GLOBAL INDEX (T1 S16 · b18ebba) · "Civilization Index · 14 points" · Stage 2 of 5
  ✅ MOBILE LAYOUT FIX (T1 S16 · b810a6a) · board 55px→343px @375px · desktop no-regression
  ✅ sessionId WIRE (T1 S16 · bea3bca) · Rule-61 console.log live · null in solo → skips
  ✅ sessionId EXPOSURE (T3 S16 · 1e9e249) · useGameSync returns sessionId
  ✅ createRoom(mode) WIRING (T3 S16 · ced8133) · passes mode to game_sessions
  ✅ SEAM FIX (T3 S16 · 133f0b9) · startGame passes gameMode → Flow seeds 9 tiles/15s real end-to-end
  ✅ FLOW MODE ENGINE (T2 S16 · 86d0220) · 9-tile end + 15s timer from getModeConfig · 5 tests
  ✅ MOBILE GUARD UPGRADED · board ≥200px HARD GATE · factories 32px MEASURED (not yet 44px · honest)
  ✅ 124 TESTS GREEN · relay v3.1 LIVE · rules 64+65 earned

  🔴 CARD ART: 0/56 files · art MUST be named card_NN.png · prompts in docs/ART_DIRECTION_ALL_56_CARDS.md
  🔴 FACTORY TOUCH 44px: mobile factories at 32px (Rule 4 violation) · T1 S17 Task A PRIORITY 1
  🟡 BONUS EARN DATA: 9th request · bonus hex (q,r) per region still pending from Mahil
  🟡 FLOW MODE LOBBY TOGGLE: config+engine+createRoom ready · T1 S17 Task B needs lobby UI
  🟡 FINALSCORE CLUSTER VISUALIZATION: cluster bonus counts but display shows no detail · T1 S17
  🟡 SIMULTANEOUS DRAW: Flow mode's defining feature · T2 S17 Task A · T3 S17 assists
  🟡 FLOW MODE E2E TEST: no test for complete flow game · T3 S17 Task A

  CURRENT FORGES: .claude/skills/forges/T1_S17 + T2_S17 + T3_S17 (post DEEP AUTODRIVE! · maximum depth)

ART FILENAME MAPPING (card_01 APPROVED · master reference):
  Priority 1 (2pt cards · every turn): card_01 to card_12
  Priority 2 (5pt milestone cards): card_49 to card_56
  Priority 3 (4pt infrastructure): card_31 to card_48
  Priority 4 (3pt): card_13 to card_30
  All 56 prompts: docs/ART_DIRECTION_ALL_56_CARDS.md
  Drop ALL art in: ~/NeoTopia/public/art/cards/
  ALSO upload to Google Drive "NeoTopia Card Art" folder (backup + NeoTopia AI review)

MAC TERMINAL (June 27 2026):
```
cd ~/NeoTopia && git pull && node scripts/check-art.js
```
```
bash .claude/relay.sh 2>&1 | tail -50
```
```
cat .claude/skills/forges/T1_S17_FORGE.md
```

COMMS SYSTEM: .claude/comms/ · GITIGNORED · NEVER commit · relay.sh reads from disk

FORCE:TRUE IS LOAD-BEARING (T3 S12): hexPulse keeps bbox moving. NEVER remove.

CIVILIZATION MILESTONES:
  June 25 2026: First commit. Game concept established.
  June 26 2026: Multiplayer loop proven. Supabase realtime working.
  June 27 2026: 36 elements placed (bot v4.3) = 3+6 = 9 = COMPLETION (not coincidence)
  June 27 2026: S14 complete · S15 complete · S16 complete · 65 rules · 124 tests
  June 27 2026: Civilization Index live · 14 points · sacredMilestone overlay live
  June 27 2026: Flow mode real end-to-end (9 tiles/15s) · mobile board 343px at 375px

SACREDMILESTONE SYSTEM (COMPLETE):
  Events: T2 S15 (69fbc14) · Visual overlay: T1 S16 (4b8d055)
  Fires when player TOTAL crosses: 7 · 9 · 13 · 18 · 27 · 36
  Shape: { player, milestone, message, symbol } · clearMilestone() Zustand action
  Overlay: position:absolute · z-index:200 · 2500ms (2+5=7) · amber-gold #C89440
  NEVER use ✡ hexagram · use ✷ ◆ ⬟ or others
  Symbol comes from LIVE store signal (not hardcoded) · correct glyph guaranteed

GLOBAL INDEX SYSTEM (LIVE):
  RPC: record_civilization_score (verified: FinalScore.jsx:135 calls it)
  getGlobalCivilizationTotal(): reads global sum · FinalScore shows it
  sessionId: useGameSync.sessionId · null in solo (skips) · UUID in room (records)
  Current state: 0 rows (all pre-wire sessions) · first 2-player game writes row 1

FLOW MODE (REAL END-TO-END since 133f0b9):
  Engine: 9-tile end + 15s timer from getModeConfig · T2 S16 (86d0220)
  Seam: startGame passes gameMode · T3 S16 seam fix (133f0b9)
  DB: game_sessions.mode TEXT DEFAULT 'classic' (migration 010)
  Pending: T1 lobby toggle · T2 simultaneous draw · T3 flow E2E test

MOBILE STATUS:
  Board: 55px→343px at 375px ✅ (T1 S16 b810a6a)
  Factories: 32px at 375px (improved from 5px but below 44px Rule 4) · T1 S17 Task A
  Guard: board ≥200px HARD GATE ✅ · factory 32px MEASURED (not faked) · T3 S16

CRITICAL PATTERNS:
  sessionPhaseColumn: maps store 'scoring'→'finished'
  Tutorial gate: {showTutorial && phase==='playing'} — NOT isMyTurn
  data-my-turn: on GameRoom root div · flips per turn
  Bot: ALL steps force:true
  game_sessions.phase CHECK: (playing|endgame|finished) — NEVER 'scoring'
  COMMS: NEVER commit
  sacredMilestone symbol: NEVER ✡ hexagram

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/index.css
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ migrations/
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short before every edit. M from other terminal = STOP.

AUTODRIVE! SYSTEM (v2.0): FORGES MANDATORY · always ends with 3 forges
SELF-RATING: Forge /200 · <85=REWRITE · Task /50 · Session /300

BOOT SEQUENCE:
  git pull --rebase && cat .claude/CLAUDE.md | head -120
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6 && npm run build 2>&1 | tail -3

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean
  Final score: calculateFinalScore(scores[], unusedCount)→number
  sacredMilestone: fires in tryScoreCard when player total crosses SACRED thresholds
  Flow mode config: getModeConfig(mode) · GAME_MODES.classic + GAME_MODES.flow

DB CONTRACT (migrations 001-010):
  game_sessions.phase: CHECK IN (playing|endgame|finished) — NOT 'scoring'
  Migration 009: global_neotopia_index · SECURITY DEFINER · record_civilization_score
  Migration 010: game_sessions.mode TEXT DEFAULT 'classic'

GAME MECHANICS:
  4-STEP PLACEMENT: factory→element-btn→region-btn→valid-hex (ALL force:true)
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster
  MODES: Classic (90s/12tiles) · Flow (15s/9tiles/simultaneous) [REAL end-to-end]

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (65 · cumulative):
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
  30. information_schema != full DB contract
  31. When live verification blocked: isolate precisely, prove wiring fires, convert to deterministic test
  32. Never bake guessed game data into engine · never Math.random() in synced/replayable actions
  33. Run unit tests first · live E2E second · NEVER concurrently
  34. Gate-skip is a pause not an abort · re-check gate when tree moves
  35. Prove data layer when browser unavailable
  36. Test harness must mirror real code setup path exactly
  37. A fixed CSS height is a request not a guarantee · flex children shrink past it
  38. In live multi-terminal repo, boot premise check has shelf life of minutes
  39. HTTP status is a witness · 400 proves insert reached DB · null ref = no HTTP call
  40. When two lanes touch one seam, trace the composed value after both edits
  41. Before writing a cross-lane bug flag, re-read the owner's current files
  42. "Two lanes both fixed it" can ADD a bug · trace composed behavior end-to-end
  43. In a shared .git, commit per task not per session
  44. A SECURITY DEFINER callable by anon is an unauthenticated-destruction vector
  45. A denormalized column is a second contract
  46. Before wiring a destructive function into an unattended hook, prove scope + auth boundary live
  47. Hold strong opinions weakly. When the team asks 3× for a valid design change, concede.
  48. Honor the forge's own gates. Evidence-backed skip prevents regression.
  49. A falling error count over a flat-zero outcome means the wall moved, not fell.
  50. A data-testid on a permanently-mounted element is useless for state — use a FLIPPING attribute
  51. Before editing selectors that fail on production, run bot against localhost first
  52. When a cross-lane harness fails, isolate local vs prod before routing
  53. Before routing a bot failure cross-lane, model your own harness against the real UI flow.
      Before claiming a milestone, verify the persisted artifact. (T2+T3 S12)
  54. A stale forge premise is not a stop — it is exactly what evidence gates exist to catch. (T1 S12)
  55. The render is the witness; the node-tree is not. Screenshot every visual task. (T1 S13)
  56. A prescriptive forge can carry a wrong schema. Verify column names live. (T2 S13)
  57. Distinguish a product bug from a harness race before patching. (T3 S13)
  58. Check if X exists before you "build X." Read the target file first. (T1 S14)
  59. A public write needs a server-side trust boundary. Check what can be WRITTEN. (T2 S14)
  60. A tool's contract is part of the premise. (T3 S14)
  61. Verify the value, not just the signature. A matching function signature proves
      the socket fits; only following the value to its source proves the wire is live.
      useGameSync returns {sendMove,pushState,broadcast} — sync.sessionId is undefined.
      A silent no-op forever. Refused to ship it. (T1 S15)
  62. When the forge asks you to rebuild something already built better, reconcile.
      Treat the forge's code as a sketch of intent; re-derive from the real contract.
      The RPC is record_civilization_score, not record_civilization_contribution. (T2 S15)
  63. Write the test that tells the truth, then gate only what's true. A green test
      that lies is worse than an honest test that names the gap. (T3 S15 · 55px board
      collapse measured, not faked-green, routed to T1 with fix spec)
  64. A premise re-verified at boot is not verified at the moment you act. In a live
      multi-terminal repo it goes stale in minutes — re-run the value-check at the
      instant of the decision, from its real source. This sharpens Rule 61 with the
      temporal dimension (extends Rules 28+38). (T1 S16 · sessionId premise went stale
      mid-session · adversarial review caught it · Task D saved)
  65. When two lanes touch one seam, trace the composed value after both edits.
      "Both shipped their half" is exactly when the composed bug hides. T2 shipped
      initGame(mode); T3 shipped startGame — but startGame called initGame with 3 args,
      no gameMode. Each was correct in isolation; composed into a flow game that
      never shortened. Only following the mode value through BOTH edits to the seeded
      snapshot revealed it. (T3 S16 · 133f0b9 seam fix · extends Rule 40+42)

CODEWORDS: T[N] AUTODRIVE! · SKILLUPGRADE! · SCANSKILLS! · DEEPDIVE! · NIGHTSAVE!
SKILLS: .claude/skills/ · esoteric-knowledge v2.0 · colonist-ux · animation-system · numerology-system
FORGES: .claude/skills/forges/ · T1_S17 + T2_S17 + T3_S17 (latest · post DEEP AUTODRIVE!)
DOCS: docs/ · all major docs updated post DEEP AUTODRIVE!
