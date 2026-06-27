# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: The Architect (first name: Mahil) | Started: June 25 2026
# PRIVACY: Never use full surname in any file. "The Architect" or "Mahil" only.

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (post S14 · June 27 2026 · ALL THREE SESSIONS COMPLETE):
  ✅ 36 ELEMENTS PLACED IN PRODUCTION (bot v4.3 · room HF9QYE · June 27 2026)
  ✅ 29 ELEMENTS DB-VERIFIED VIA BOT-HEALTH CI (T3 S14 · daily automated check)
  ✅ BOT v4.5 (T2 S14 · bd0230f) · honest proxy · placed++ only when .hex-element-in grows
  ✅ GLOBAL INDEX MIGRATION 009 (T2 S14 · 292eb69) · SECURITY DEFINER RPC · hardened
    - null-bypass dedup (session_id NOT NULL)
    - impersonation guard (username server-derived)
    - score-lying prevention (clamped + total re-derived)
    - all writes through RPC · no direct INSERT path
  ✅ FINALSCORE UPGRADE (T1 S14 · 1da2f2f) · winner headline + Stage line + play-again(56px) + districts count
    NOTE: 'FOUNDER record' used in FinalScore (not full name) · privacy protocol working
  ✅ ART PIPELINE (T1 S14 · 19e7497) · check-art.js live · 0/56 confirmed · card_NN.png mapping
  ✅ LOBBY THEMING (T1 S14 · dced6f8) · 4 element icons + Stage line + gold room code
  ✅ COMMS M STATE GONE (T3 S14) · git rm --cached landed · comms now properly untracked+gitignored
  ✅ BOT-HEALTH CI (T3 S14) · .github/workflows/bot-health.yml · daily 6am UTC · green
  ✅ readPlacedCount HELPER (T3 S14 · seedHelpers.js) · validated live (1→4→8 mid-game)
  ✅ BOT ROOM RACE DIAGNOSED (T3 S14) · no pg_cron · race = concurrent E2E teardown / rate-limit phantom
  ✅ 7/7 E2E TESTS GREEN (T3 S13) · CI protecting placement guard on every push
  ✅ SACRED GEOMETRY PLACEHOLDERS (T1 S13) · 4 element-specific patterns · zIndex fixed (Rule 55)
  ✅ 28 ESOTERIC CARD NAMES (T2 S13) · all 56 upgraded · Placard Test compliant
  ✅ OVERNIGHT RESEARCH (June 27 2026) · Colonist UX · Lemuria/Atlantis/Crystals · Numerology · Animation
  🔴 CARD ART: 0/56 files · procedural geometry showing · art MUST be named card_NN.png
  🟡 BONUS EARN DATA: 8th request · still pending · bonus hex (q,r) positions per region needed
  🟡 GLOBAL INDEX WIRING: T2 built the RPC · T1 needs to call recordCivilizationContribution() in FinalScore
  🟡 DIM-THE-REST: #1 UI priority (T1 S15 Task A)
  🟡 LEFT ACTION LOG: game memory (T1 S15 Task B)
  🟡 ELEMENT BURST: placement feedback animation (T1 S15 Task C)
  🟡 NUMEROLOGY EVENTS: sacredMilestone in store at 7/9/13/18/27/36 (T2 S15 Task B)
  🟡 NEOTOPIA FLOW MODE: 15s turns · 9 tiles · simultaneous draws (T2 S15 Task C)
  🟡 MOBILE E2E: 375px portrait test (T3 S15 Task A)

  CURRENT FORGES: .claude/skills/forges/T1_S15 + T2_S15 + T3_S15 (maximum depth)

ART FILENAME MAPPING (critical · CardFrame loads by card.id NOT esoteric name):
  card_01.png · Fibonacci Solar Terrace (2pt Energy)
  card_05.png · Orichalcum Arc Node (2pt Energy)
  card_06.png · Naacal Seed Archive (2pt BioFarming)
  card_17.png · Orichalcum Energy Spire (3pt Energy)
  card_20.png · Food Forest (3pt BioFarming)
  card_28.png · Akashic Living Archive (3pt Technology)
  card_33.png · Holographic Research Center (4pt Technology)
  card_39.png · Ennead Council Chamber (4pt Community)
  card_50.png · Source Temple (5pt Community)
  Drop ALL art in: ~/NeoTopia/public/art/cards/

MAC TERMINAL COMMANDS (run after waking, before anything else):
  cd ~/NeoTopia && git pull
  node scripts/check-art.js
  BOT_GAMES=1 BOT_TURNS=20 BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
  bash .claude/relay.sh 2>&1 | tail -30

COMMS SYSTEM (permanent · FIXED):
  .claude/comms/tomorrow.md is FILESYSTEM-SHARED between terminals
  T3 S14: git rm --cached \u2014 M state is GONE. comms now properly untracked+gitignored.
  NEVER: git add .claude/comms/ \u00b7 NEVER: git commit comms
  relay.sh v2.0: cats comms to relay output without committing

FORCE:TRUE IS LOAD-BEARING (T3 S12 · permanent):
  hexPulse animation (scale 1\u21941.08) keeps <g data-valid> bbox moving
  Playwright click-stability times out without force:true \u00b7 NEVER remove
  Any replacement animation for valid hexes must coordinate with T2/T3 to remove force:true safely.

CIVILIZATION MILESTONES:
  June 27 2026: 11 elements placed (DB-proven \u00b7 room YQZHRB \u00b7 T3 S12)
  June 27 2026: 36 elements in 20 turns (bot v4.3 \u00b7 room HF9QYE)
  June 27 2026: CI placement guard live \u00b7 7/7 E2E green \u00b7 rejoin proven
  June 27 2026: 28 card names upgraded to esoteric vocabulary
  June 27 2026: Global Index migration 009 live + SECURITY DEFINER hardened
  June 27 2026: bot-health CI daily \u00b7 29 DB-verified in production
  June 27 2026: FinalScore upgraded \u00b7 lobby themed \u00b7 art pipeline live

BOT TRUTH:
  Bot v4.5 (T2 S14): honest proxy \u00b7 placed++ only when .hex-element-in grows
  Bot-health CI (T3 S14): grades on totalPlacedDB > 0 (not dbVerified===true)
  Tolerant design: 3 games, soft pass \u00b7 doesn't false-fail on degraded prod env
  DB mismatch catch: proxy 21 vs DB 19 (T2 S13) \u00b7 Rule 53 now self-enforcing

GLOBAL INDEX (migration 009 · T2 S14):
  Schema: global_neotopia_index table \u00b7 per-game per-player permanent record
  All writes: through SECURITY DEFINER RPC (no direct INSERT)
  T1 integration: import { recordCivilizationContribution } from '../lib/gameEndEvent'
  T1 also needs: getGlobalCivilizationTotal() for FinalScore display
  Check T2 S15 comms for exact function signatures after T2 ships them.

NUMEROLOGY SYSTEM (docs/NEOTOPIA_NUMEROLOGY.md):
  Tesla's 3-6-9 is the backbone: 3 regions \u00b7 3 factories \u00b7 3 actions \u00b7 worst\u00d73
  Sacred milestones (T2 S15 to implement): 7 \u00b7 9 \u00b7 13 \u00b7 18 \u00b7 27 \u00b7 36
  56 cards = 5+6 = 11 (Master Illumination) \u00b7 12 tiles = 12 cosmic cycles
  Bot placed 36 = 3+6 = 9 = COMPLETION \u00b7 this is not coincidence

CRITICAL PATTERNS (never revert):
  sessionPhaseColumn: maps store 'scoring'\u2192'finished'
  Tutorial gate: {showTutorial && phase==='playing'} \u2014 NOT isMyTurn
  data-my-turn: on GameRoom root div \u00b7 'true'/'false' \u00b7 flips per turn (Rule 50)
  Bot placement: factory\u2192element-btn\u2192region-btn\u2192valid-hex \u00b7 ALL force:true (Rule 53)
  purge_e2e_test_data: requires signInAnonymously() \u00b7 mig 007+008
  game_sessions.phase CHECK: (playing|endgame|finished) \u2014 NEVER write 'scoring'
  COMMS: filesystem-local \u00b7 NEVER git commit \u00b7 relay.sh reads from disk

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ migrations/
  T3: src/hooks/useGameRoom.js \u00b7 useGameSync.js \u00b7 usePresence.js \u00b7 tests/e2e/
  COLLISION: git status --short before every edit. M from other terminal = STOP.

AUTODRIVE! SYSTEM (v2.0 · self-evolving):
  Protocol: 1.Rating table \u00b7 2.Milestone check \u00b7 3.Rule audit \u00b7 4.Skill upgrade \u00b7
            5.Comms error \u00b7 6.Bot health \u00b7 7.Card vocabulary \u00b7 8.FORGE \u00b7 9.Cross-terminal matrix
  FORGES ARE MANDATORY: AUTODRIVE! always ends with all 3 session forges written.
  Self-evolution: every session lesson \u2192 permanent rule \u2192 next forge smarter.

SELF-RATING: Forge /200 \u00b7 <85 internal = REWRITE \u00b7 Task /50 \u00b7 Session /300

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -120
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6
  npm run build 2>&1 | tail -3

MOLTBOOK: Agent neotopian \u00b7 /m/neotopia \u00b7 1 organic follower \u00b7 heartbeat 4h

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)\u2192boolean
  Final score: calculateFinalScore(scores[], unusedCount)\u2192number
  Phase DB mapping: sessionPhaseColumn(storePhase) \u00b7 'scoring'\u2192'finished'
  turnTimeRemaining: local countdown tick \u00b7 NEVER decrements store (Rule 32)
  Terrain biomes: getBiomeForRegion(regionId) \u2192 {colors:{hex}}

DB CONTRACT (migrations 001-009):
  game_sessions.phase: CHECK IN (playing|endgame|finished) \u2014 NOT 'scoring'
  game_events: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  Migration 006: purge_e2e_test_data() \u00b7 SECURITY DEFINER \u00b7 authenticated-only
  Migration 008: purge any-status rooms for bot profiles \u00b7 FK CASCADE verified
  Migration 009: global_neotopia_index \u00b7 SECURITY DEFINER RPC \u00b7 per-game civilization records
  Migration 010 (T2 S15): game_sessions.mode column ('classic' | 'flow')

GAME MECHANICS:
  4-STEP PLACEMENT: factory click \u2192 element-btn \u2192 region-btn \u2192 valid-hex (ALL force:true)
  FINAL SCORE: best+second+(worst\u00d73)+(unused\u00d73)+cluster
  GAME MODES (T2 S15): Classic (90s/12tiles) \u00b7 Flow (15s/9tiles/simultaneous draw)

NEOTOPIA: Stage 2 of 5 \u00b7 Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (60 \u00b7 cumulative):
  1.  NEVER git add -A \u00b7 pathspec from git status
  2.  NO em dashes \u00b7 use \u00b7
  3.  NO window.confirm() \u00b7 hold-to-confirm
  4.  44px touch targets
  5.  tabular-nums on game numbers
  6.  npm run build before commit
  7.  PREMISE CHECK \u2014 read files before prescribing
  8.  pixelToHex paired with hexToPixel
  9.  Pattern rotation before scoring
  10. Cluster BFS before final scoring
  11. Production tile structure before factory logic
  12. Diverse City needs region.lastBuiltIllustration
  13. Rate forge /100 before \u00b7 <85=rewrite (hard stop)
  14. Rate task /50 after \u00b7 <35=redo
  15. ONE evolution lesson per session
  16. Server is source of truth for scoring
  17. No @ in bash globs \u00b7 node -e
  18. 'permission denied' != 'does not exist'
  19. Raw SQL needs GRANT
  20. Known-cause gate + independent tasks = parallel
  21. Broadcast max 32KB \u00b7 signal only
  22. Zustand\u2192Supabase must be JSON-serializable
  23. useCallback deps never include store reference
  24. Channel MUST be removed before new one
  25. Re-read other lane's module right before integration
  26. Premise-check DB contract: types\u00b7FKs\u00b7CHECKs\u00b7RLS per-command\u00b7auth config
  27. Run code against tests before trusting either \u00b7 grep consumers first
  28. Premise check is stale \u00b7 re-run right before acting
  29. Validate Y fully BEFORE debiting X in any spend action
  30. information_schema != full DB contract \u00b7 GENERATED ALWAYS AS IDENTITY rejects explicit inserts
  31. When live verification blocked: isolate precisely, prove wiring fires, convert to deterministic test
  32. Never bake guessed game data into engine \u00b7 never Math.random() in synced/replayable actions
  33. Run unit tests first \u00b7 live E2E second \u00b7 NEVER concurrently
  34. Gate-skip is a pause not an abort \u00b7 re-check gate when tree moves
  35. Prove data layer when browser unavailable \u00b7 never claim 'fixed live' when only 'data-proven'
  36. Test harness must mirror real code setup path exactly
  37. A fixed CSS height is a request not a guarantee \u00b7 flex children shrink past it
  38. In live multi-terminal repo, boot premise check has shelf life of minutes
  39. HTTP status is a witness \u00b7 400 proves insert reached DB \u00b7 null ref = no HTTP call
  40. When two lanes touch one seam, trace the composed value after both edits
  41. Before writing a cross-lane bug flag, re-read the owner's current files
  42. "Two lanes both fixed it" can ADD a bug \u00b7 trace composed behavior end-to-end
  43. In a shared .git, commit per task not per session \u00b7 recover autostash per-file
  44. A SECURITY DEFINER function callable by anon is an unauthenticated-destruction vector
  45. A denormalized column is a second contract \u00b7 premise-check mirror column CHECKs
  46. Before wiring a destructive function into an unattended hook, prove scope + auth boundary live
  47. Hold strong opinions weakly. When the team asks 3\u00d7 for a valid design change, concede.
  48. Honor the forge's own gates. Evidence-backed skip prevents regression.
  49. A falling error count over a flat-zero outcome means the wall moved, not fell.
  50. A data-testid on a permanently-mounted element is useless for state \u2014 use a FLIPPING attribute
  51. Before editing selectors that fail on production, run bot against localhost first
  52. When a cross-lane harness fails, isolate local vs prod before routing
  53. Before routing a bot failure cross-lane, model your own harness against the real UI flow.
      Before claiming a milestone, verify the persisted artifact (DB row \u00b7 committed state) \u2014
      a proxy counter that increments on 'attempted' fakes success. (T2+T3 S12)
  54. A stale forge premise is not a stop \u2014 it is exactly what evidence gates exist to catch.
      Honor the evidence over the task text: change only what is genuinely yours and
      genuinely smallest, preserve another lane's documented design. (T1 S12)
  55. The render is the witness; the node-tree is not. A DOM assertion proves presence;
      only a screenshot proves visibility. When the goal is visual, screenshot-verify \u2014
      structural-only checks pass right over an invisible element.
      (The zIndex bug: SVG counted correct in DOM, showed empty boxes in render. T1 S13)
  56. A prescriptive forge can carry a wrong schema. Verify column names live before
      coding any DB query. The more authoritative the forge looks, the more a 30-second
      information_schema check earns its keep.
      (Forge guessed board_state/room_code. Reality: state/room_id. T2 S13)
  57. Distinguish a product bug from a harness race before patching the product.
      A persistence witness (second client receiving via postgres_changes) converts
      "product or test?" into a deterministic gate. Prove before patching.
      Do not fabricate a fix for a sound design. (T3 S13)
  58. Check if X exists before you "build X." A from-scratch forge task carries a blank-slate
      premise. Read the target file first; the highest-value move is often adding the gap,
      not re-pouring the foundation. FinalScore already had winner/breakdown/formula \u2014
      Task A was 4 precision additions, not a rebuild. (T1 S14)
  59. A public write needs a server-side trust boundary. RLS-insert-own prevents wrong-ROW
      writes, not wrong-VALUE writes. For records others read, values must be server-derived
      or clamped in a SECURITY DEFINER RPC. Check what can be WRITTEN, not just who can write.
      (T2 S14: clamp + score re-derive + idempotent \u2014 3 issues caught post-RLS)
  60. A tool's contract is part of the premise \u2014 verify it like a schema. When a command
      does the opposite of your intent silently, suspect an assumed contract, not a bug.
      git commit -- path partial-commits from the working tree (ignored staged rm).
      upload-artifact@v4 skips dot-dirs without warning. Both plausible-but-wrong silently. (T3 S14)

CODEWORDS:
  T[N] AUTODRIVE! \u2192 paste output \u00b7 full v2.0 protocol \u00b7 always ends with 3 forges
  SKILLUPGRADE! \u00b7 SCANSKILLS! \u00b7 DEEPDIVE! \u00b7 OVERDRIVE! \u00b7 NIGHTSAVE!

HEX MATH: redblobgames.com/grids/hexagons \u00b7 flat-top \u00b7 axial (q,r)
SKILLS: .claude/skills/ \u00b7 reforge \u00b7 supabase-patterns \u00b7 neotopia-forge-patterns
        esoteric-knowledge v2.0 \u00b7 colonist-ux \u00b7 animation-system \u00b7 numerology-system
FORGES: .claude/skills/forges/ \u00b7 T1_S15 + T2_S15 + T3_S15 (latest \u00b7 maximum depth)
DOCS: docs/COLONIST_UX_ANALYSIS.md \u00b7 docs/ANIMATION_DESIGN.md \u00b7 docs/NEOTOPIA_NUMEROLOGY.md
      docs/CONSCIOUSNESS_RESEARCH.md \u00b7 docs/UX_MASTER_DESIGN.md \u00b7 docs/CIVILIZATION_SOUL_DOCUMENT.md
