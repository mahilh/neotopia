# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: The Architect (first name: Mahil) | Started: June 25 2026
# PRIVACY: Never use full surname in any file. "The Architect" or "Mahil" only.

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Vercel project ID: prj_SXwt61VZjo2vNWmzUFZ3PLSs2Yub
GitHub: mahilh/neotopia (public) · Vercel: auto-deploy from main

STATUS (post S17 · June 27 2026 · ALL THREE COMPLETE):
  ✅ T1 S17: factory 44px (2086628) · Flow lobby toggle (5d759aa) · cluster viz (52b6d65) · art shimmer (2a69be5)
  ✅ T2 S17: getClusterDetail engine (b092dd6) · simultaneous-draw gate (b092dd6) · bot v4.6 Flow (a33b0c5+7537b30)
  ✅ T3 S17: Flow E2E (1929db2) · factory 44px hard-gate (8e75feb) · sim-draw characterization (17f5931) · presence (90637ec)
  ✅ 137 TESTS GREEN · 0 runtime errors · 67 rules · all deployments READY

  PRODUCTION HEAD: c0a8cb2 (T1 S17 review polish)
  VERIFIED LIVE via Vercel MCP + Playwright:
    factory touch: 91px (was 23px) · Rule 4 closed
    Flow lobby toggle: data-testid=mode-flow LIVE
    cluster visualization: LIVE in FinalScore
    art shimmer: LIVE in CardFrame (Rule 58 reroute from ProjectCard)
    Flow E2E: in CI (gray-box via window.__neotopia_store)
    presence: mode-aware (in_lobby / in_game / in_flow_game)

  🔴 CARD ART: 0/56 · shimmer is graceful fallback · real PNGs are the civilization's face
  🔴 CLUSTER POINTS: missing from scoring · BOARD GAME RULE: 1pt per element in biggest cluster per region
     T2 S18 Task A is the highest-value unimplemented feature in the game
  🔴 SIMULTANEOUS DRAW: engine gate correct · channel is snapshot-based (not event-reducer)
     T2 must design atomic seat-scoped draw RPC · T3 wires it after
  🟡 LANDING PAGE COUNTER: 147,823 is HARDCODED · needs real getGlobalCivilizationTotal · T1 S18
  🟡 BONUS HEX DATA: 10th request · bonus hex (q,r) per region still pending from Mahil
  🟡 CLUSTER VIZ: shows count-only (no points) · T1 S18 updates once T2 S18 implements the rule
  🟡 CLEAN FLOW BOT GAME: pending (tree was dirty during S17 run) · T2 S18
  🟡 LIVE-DB UI FLOW E2E: pending · T3 S18

VERCEL MCP: permanently connected via claude_desktop_config.json
  Project: neotopia · ID: prj_SXwt61VZjo2vNWmzUFZ3PLSs2Yub
  No OAuth flip needed · permanent token · auto-loads on Claude Desktop restart

MAC TERMINAL:
```
cd ~/NeoTopia && git pull && git log --oneline -10
```
```
bash .claude/relay.sh 2>&1 | tail -40
```

COMMS: .claude/comms/ · GITIGNORED · NEVER commit · relay reads from disk
FORCE:TRUE IS LOAD-BEARING: hexPulse keeps bbox moving. NEVER remove.

CLUSTER SCORING RULE (board game · page 9 of rulebook):
  "Before calculating final score on each Region, each player gains 1 Point for each
   Element Token of their color on the biggest cluster in each Region."
  Implementation: for each region + each element type → find biggest connected group
  → add 1pt per element in that group to the region score.
  T2 S18 Task A must implement this. It is the highest-value missing feature.

SIMULTANEOUS DRAW ARCHITECTURE (T3 S17 finding):
  The channel uses whole-state SNAPSHOTS, not event reducers.
  There is no 'draw_card' event reducer in useGameSync.
  T3's proof: concurrent draws CLOBBER (last-write-wins · a draw can be LOST).
  Fix: atomic seat-scoped draw RPC at Supabase level (T2 designs · T3 wires).
  DO NOT add case 'draw_card': to useGameSync — wrong architecture (Rule 62).

CRITICAL PATTERNS:
  sessionPhaseColumn: maps store 'scoring'→'finished'
  Tutorial gate: {showTutorial && phase==='playing'} — NOT isMyTurn
  data-my-turn: on GameRoom root div · flips per turn
  Bot: ALL steps force:true
  game_sessions.phase CHECK: (playing|endgame|finished) — NEVER 'scoring'
  COMMS: NEVER commit
  sacredMilestone symbol: NEVER ✡ hexagram
  getClusterDetail: element keys are LOWERCASE ('energy' not 'Energy')
  Cluster viz: count-only until T2 S18 ships the points rule

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/index.css
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ migrations/
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short before every edit. M from other terminal = STOP.

BOOT SEQUENCE:
  git pull --rebase && cat .claude/CLAUDE.md | head -80
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6 && npm run build 2>&1 | tail -3

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean
  Final score: calculateFinalScore(scores[], unusedCount)→number
  Cluster: getClusterDetail(regions)→[{element,count}] · element keys LOWERCASE
  MISSING: cluster→points rule (T2 S18 Task A)
  Flow mode config: getModeConfig(mode) · GAME_MODES.classic + GAME_MODES.flow

DB CONTRACT (migrations 001-010):
  game_sessions.phase: CHECK IN (playing|endgame|finished)
  Migration 009: global_neotopia_index · SECURITY DEFINER · record_civilization_score
  Migration 010: game_sessions.mode TEXT DEFAULT 'classic'

GAME MECHANICS:
  4-STEP PLACEMENT: factory→element-btn→region-btn→valid-hex (ALL force:true)
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster
  CLUSTER: 1pt per element in biggest cluster per region (BOARD GAME RULE · NOT YET CODED)
  MODES: Classic (90s/12tiles) · Flow (15s/9tiles) · GAME_MODES single-source

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (67 · cumulative):
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
  29. Validate Y fully BEFORE debiting X
  30. information_schema != full DB contract
  31. When live verification blocked: isolate, prove wiring, convert to deterministic test
  32. Never bake guessed game data · never Math.random() in synced actions
  33. Unit tests first · live E2E second · NEVER concurrently
  34. Gate-skip is a pause not an abort · re-check when tree moves
  35. Prove data layer when browser unavailable
  36. Test harness must mirror real code setup path
  37. CSS height is a request not a guarantee
  38. Boot premise check has shelf life of minutes in live multi-terminal repo
  39. HTTP status is a witness
  40. When two lanes touch one seam, trace the composed value after both edits
  41. Before writing a cross-lane bug flag, re-read the owner's current files
  42. "Two lanes both fixed it" can ADD a bug · trace composed behavior
  43. Commit per task not per session
  44. A SECURITY DEFINER callable by anon is an unauthenticated-destruction vector
  45. A denormalized column is a second contract
  46. Before wiring a destructive function into unattended hook, prove scope + auth
  47. Hold strong opinions weakly
  48. Honor the forge's own gates
  49. A falling error count over flat-zero means the wall moved, not fell
  50. A data-testid on a permanently-mounted element is useless for state — FLIP attribute
  51. Before editing selectors that fail on production, run bot against localhost first
  52. When cross-lane harness fails, isolate local vs prod before routing
  53. Before routing a bot failure, model your own harness against the real UI flow
  54. A stale forge premise is not a stop — it is what evidence gates exist to catch
  55. The render is the witness. Screenshot every visual task.
  56. A prescriptive forge can carry a wrong schema. Verify column names live.
  57. Distinguish a product bug from a harness race before patching.
  58. Check if X exists before you "build X." Read the target file first.
  59. A public write needs a server-side trust boundary.
  60. A tool's contract is part of the premise.
  61. Verify the value, not just the signature.
  62. When the forge asks you to rebuild something already built better, reconcile.
  63. Write the test that tells the truth, then gate only what's true.
  64. A premise re-verified at boot is not verified at the moment you act.
      Re-run the value-check at the instant of the decision, from its real source.
  65. When two lanes touch one seam, trace the composed value after both edits.
      "Both shipped their half" is exactly when the composed bug hides.
  66. In a live shared working tree, a cross-lane dependency may already be
      half-built — uncommitted — in your tree. Read it before you stub it.
      git status is a premise-check tool, not just a pre-commit check.
      Sharpens Rules 25/62/64 with the shared-tree dimension. (T1 S17 ·
      read T2's uncommitted getClusterDetail before building the display)
  67. A CI-run gate must key on the COMMIT boundary, not the working-tree truth.
      Gating on local truth is a green light that turns red the moment CI checks
      out origin. Gate what's true WHERE the gate runs, not where you are.
      Sharpens Rule 63 with the CI-boundary dimension. (T3 S17 · factory was
      58px locally but T1's fix was uncommitted · gate-skip held until 2086628
      appeared in the log)

CODEWORDS: T[N] AUTODRIVE! · SKILLUPGRADE! · DEEPDIVE! · XRAY! · NIGHTSAVE!
FORGES: .claude/skills/forges/ · T1_S18 + T2_S18 + T3_S18 (latest)
DOCS: docs/ · CIVILIZATION_SOUL_DOCUMENT · NEOTOPIA_STAGE_3_VISION · NEOTOPIA_PITCHDECK_EXPANDED
