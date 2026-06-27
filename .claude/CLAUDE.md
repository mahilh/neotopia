# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: The Architect (first name: Mahil) | Started: June 25 2026
# PRIVACY: Never use full surname in any file. "The Architect" or "Mahil" only.

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq
GitHub: mahilh/neotopia (public) · Vercel: auto-deploy from main

STATUS (post S15 · June 27 2026 · ALL THREE SESSIONS COMPLETE):
  ✅ DIM-THE-REST (T1 S15 · cc45e86) · per-phase computed opacity · screenshot verified
  ✅ ACTION LOG (T1 S15 · f8e8f56) · element-colored events · left of board · age-fade
  ✅ ELEMENT BURST (T1 S15 · 6a11c79) · 6 SVG particles · burst0-5 · DOM verified
  ✅ SACRED MILESTONE EVENTS (T2 S15 · 69fbc14) · sacredMilestone at 7/9/13/18/27/36
     Shape: { player, milestone, message, symbol } · clearMilestone() · 4 tests green
     SYMBOL: use ✷ NOT ✡ (hexagram BANNED — T2 S15 caught and corrected)
  ✅ getGlobalCivilizationTotal() (T2 S15 · 4780e00) · query built · FinalScore display T1 S16
  ✅ FLOW MODE FOUNDATION (T2 S15 · 14400bc) · GAME_MODES config · migration 010
     GAME_MODES.classic: 90s/12tiles · GAME_MODES.flow: 15s/9tiles/simultaneous
  ✅ MOBILE E2E GUARD (T3 S15) · mobile.e2e.js · 375px solo /game · CI green
  ✅ NUMEROLOGY TEST (T3 S15) · tests/numerology.test.js · SACRED=[7,9,13,18,27,36] locked
  ✅ E2E TIMING AUDIT (T3 S15) · ~53s total < 180s · 0 [CODE] failures
  ✅ 111 TESTS GREEN · relay v3.0 LIVE

  🔴 CARD ART: 0/56 files · art MUST be named card_NN.png
  🔴 CRITICAL MOBILE BUG: 55px board at 375px · T3 S15 found it live
     T1 S16 Task C: CSS only · flex-direction:column at <=600px + sidebar reflow
  🟡 BONUS EARN DATA: 9th request · bonus hex (q,r) per region STILL pending from Mahil
  🟡 sacredMilestone OVERLAY: store events ship · T1 S16 Task A (visual component)
  🟡 FinalScore: getGlobalCivilizationTotal DISPLAY · T1 S16 Task B (10 lines)
  🟡 sessionId EXPOSURE: useGameSync returns {sendMove,pushState,broadcast} — NO sessionId!
     T3 S16 Task A (URGENT · prerequisite for T1's Global Index wire)
     Rule 61: T1 caught this silent no-op in S15. Refused to ship. Flagged T3.
  🟡 FinalScore: recordCivilizationDetail WIRE · CONDITIONAL on T3 shipping sessionId
     RPC is record_civilization_score (NOT record_civilization_contribution · T2 S15)
  🟡 FLOW MODE UI: T1 lobby toggle + T3 createRoom(mode) · config ready since T2 S15
  🟡 MOBILE GUARD UPGRADE: T3 upgrades 55px measure to 44px hard-gate AFTER T1 ships fix

  CURRENT FORGES: .claude/skills/forges/T1_S16 + T2_S16 + T3_S16 (post LLM Council · 63 rules)

ART FILENAME MAPPING:
  card_01.png · Fibonacci Solar Terrace (2pt Energy) — PRIORITY 1
  card_06.png · Naacal Seed Archive (2pt BioFarming) — PRIORITY 2
  card_33.png · Holographic Research Center (4pt Technology) — grandfather's card
  card_50.png · Source Temple (5pt Community)
  Drop ALL in: ~/NeoTopia/public/art/cards/

MAC TERMINAL (June 27 2026 11:15 AM):
  cd ~/NeoTopia && git pull
  git log --oneline -15
  node scripts/check-art.js
  bash .claude/relay.sh 2>&1 | tail -50
  cat .claude/skills/forges/T1_S16_FORGE.md

COMMS SYSTEM: .claude/comms/ · GITIGNORED · NEVER commit · relay.sh v3.0 reads from disk

FORCE:TRUE IS LOAD-BEARING (T3 S12): hexPulse keeps bbox moving. NEVER remove.

CIVILIZATION MILESTONES:
  June 25 2026: First commit.
  June 26 2026: Multiplayer loop proven.
  June 27 2026: 36 elements placed (bot v4.3) = 3+6 = 9 = COMPLETION
  June 27 2026: S14 complete · S15 complete · 63 rules · 111 tests

SACREDMILESTONE SYSTEM (T2 S15 shipped · T1 S16 ships visual):
  Shape: { player, milestone, message, symbol } (see T2 S15 comms for full map)
  clearMilestone(): Zustand action · T1 calls after 2500ms (2+5=7 · spiritual perfection)
  NEVER use ✡ hexagram · use ✷ ◆ ⬟ or other symbols

GLOBAL INDEX SYSTEM (T2 S14 + T2 S15):
  RPC name: record_civilization_score (NOT record_civilization_contribution)
  getGlobalCivilizationTotal(): query function · returns sum of all games
  sessionId chain: T3 exposes → T1 console.logs → T1 wires (Rule 61: value not signature)

FLOW MODE:
  Config: src/store/gameConfig.js · GAME_MODES.classic + GAME_MODES.flow
  DB: game_sessions.mode TEXT DEFAULT 'classic' (migration 010)
  Pending: T2 engine integration · T1 lobby toggle · T3 createRoom(mode)

MOBILE STATUS (T3 S15 critical finding):
  AT 375px: sidebar=288px pushes board to 55px · factories=5px (unplayable)
  FIX (T1 S16 Task C): @media (max-width:600px) { flex-direction:column; sidebar:100%; }
  GUARD (T3 S16 Task C): upgrade to hard-gate 44px after T1 ships

CRITICAL PATTERNS:
  sessionPhaseColumn: maps store 'scoring'→'finished'
  Tutorial gate: {showTutorial && phase==='playing'} — NOT isMyTurn
  data-my-turn: on GameRoom root div · flips per turn
  Bot: ALL steps force:true
  game_sessions.phase CHECK: (playing|endgame|finished) — NEVER 'scoring'
  COMMS: NEVER commit
  sacredMilestone symbol: NEVER ✡ hexagram

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ migrations/
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short before every edit. M from other terminal = STOP.

AUTODRIVE! SYSTEM (v2.0):
  Protocol: 1.Rating · 2.Milestone · 3.Rule audit · 4.Skill upgrade ·
            5.Comms · 6.Bot health · 7.Card vocabulary · 8.FORGE · 9.Cross-terminal
  FORGES MANDATORY: always ends with all 3 forges.
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

DB CONTRACT (migrations 001-010):
  game_sessions.phase: CHECK IN (playing|endgame|finished) — NOT 'scoring'
  Migration 009: global_neotopia_index · SECURITY DEFINER RPC (record_civilization_score)
  Migration 010: game_sessions.mode TEXT DEFAULT 'classic'

GAME MECHANICS:
  4-STEP PLACEMENT: factory→element-btn→region-btn→valid-hex (ALL force:true)
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster
  MODES: Classic (90s/12tiles) · Flow (15s/9tiles/simultaneous) [config ready, UI pending]

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (63 · cumulative):
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
  40. When two lanes touch one seam, trace the composed value after both edits
  41. Before writing a cross-lane bug flag, re-read the owner's current files
  42. "Two lanes both fixed it" can ADD a bug · trace composed behavior end-to-end
  43. In a shared .git, commit per task not per session · recover autostash per-file
  44. A SECURITY DEFINER function callable by anon is an unauthenticated-destruction vector
  45. A denormalized column is a second contract · premise-check mirror column CHECKs
  46. Before wiring a destructive function into an unattended hook, prove scope + auth boundary live
  47. Hold strong opinions weakly. When the team asks 3× for a valid design change, concede.
  48. Honor the forge's own gates. Evidence-backed skip prevents regression.
  49. A falling error count over a flat-zero outcome means the wall moved, not fell.
  50. A data-testid on a permanently-mounted element is useless for state — use a FLIPPING attribute
  51. Before editing selectors that fail on production, run bot against localhost first
  52. When a cross-lane harness fails, isolate local vs prod before routing
  53. Before routing a bot failure cross-lane, model your own harness against the real UI flow.
      Before claiming a milestone, verify the persisted artifact (DB row · committed state) —
      a proxy counter that increments on 'attempted' fakes success. (T2+T3 S12)
  54. A stale forge premise is not a stop — it is exactly what evidence gates exist to catch.
      Honor the evidence over the task text: change only what is genuinely yours and
      genuinely smallest. (T1 S12)
  55. The render is the witness; the node-tree is not. Screenshot-verify every visual task.
      A DOM assertion proves presence; only a screenshot proves visibility. (T1 S13)
  56. A prescriptive forge can carry a wrong schema. Verify column names live before
      coding any DB query. (T2 S13)
  57. Distinguish a product bug from a harness race before patching the product.
      A persistence witness converts 'product or test?' into a deterministic gate. (T3 S13)
  58. Check if X exists before you "build X." A from-scratch forge task carries a blank-slate
      premise. Read the target file first. (T1 S14)
  59. A public write needs a server-side trust boundary. Check what can be WRITTEN, not
      just who can write. RLS-insert-own prevents wrong-ROW, not wrong-VALUE. (T2 S14)
  60. A tool's contract is part of the premise. When a command does the opposite of your
      intent silently, suspect an assumed contract, not a bug. (T3 S14)
  61. Verify the value, not just the signature. A matching function signature proves the
      socket fits; only following the value to its source proves the wire is live.
      The forge said sync?.sessionId — useGameSync returns {sendMove,pushState,broadcast}.
      sync.sessionId is undefined. Silent no-op forever. Refused to ship it. (T1 S15)
  62. When the forge asks you to rebuild something you already built better, reconcile —
      don't rebuild worse to match the prompt. Treat the forge's code as a sketch of intent;
      re-derive from the real contract. A prompt that post-dates your work can describe
      an earlier, worse version of it. (T2 S15 · wrong RPC name + RLS-impossible pattern)
  63. Write the test that tells the truth, then gate only what's true. A green test that
      lies ("mobile works") is worse than an honest test that names the gap. Gate the
      invariants that hold; measure the gap; route it to the right terminal. (T3 S15 ·
      55px board collapse measured, not faked-green, routed to T1 with fix spec)

CODEWORDS: T[N] AUTODRIVE! · SKILLUPGRADE! · SCANSKILLS! · DEEPDIVE! · NIGHTSAVE!
SKILLS: .claude/skills/ · esoteric-knowledge v2.0 · colonist-ux · animation-system · numerology-system
FORGES: .claude/skills/forges/ · T1_S16 + T2_S16 + T3_S16 (latest · post LLM Council)
DOCS: docs/ · COLONIST_UX_ANALYSIS · ANIMATION_DESIGN · NEOTOPIA_NUMEROLOGY ·
      CONSCIOUSNESS_RESEARCH · CIVILIZATION_SOUL_DOCUMENT · NEOTOPIA_GAME_RULEBOOK ·
      NEOTOPIA_PITCH_GUIDE · NEOTOPIA_LIBRARY_SYNTHESIS · CLAUDE_CODE_IMPROVEMENTS
