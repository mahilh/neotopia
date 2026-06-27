# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (post S13 · June 27 2026):
  ✅ 36 ELEMENTS PLACED IN PRODUCTION (bot v4.3 · room HF9QYE · June 27 2026)
  ✅ BOT v4.4 (T2 S13) · zero ready-failed errors · rate-limit retry · DB-verified count
  ✅ DB MISMATCH CAUGHT (T2 S13) · proxy 21 vs DB 19 · Rule 53 now self-enforcing
  ✅ 28 ESOTERIC CARD NAMES (T2 S13 · c09f81d) · Fibonacci Solar Terrace · Fohat Activation Node · etc.
  ✅ SACRED GEOMETRY PLACEHOLDERS (T1 S13 · 06ac10e) · 4 element-specific SVG patterns · zIndex fixed
  ✅ DUAL-PLAYER SCORE (T1 S13 · c8c0395) · side-by-side · solo fallback works
  ✅ ELEMENT-COLOR INSTRUCTION BAR (T1 S13 · c8c0395) · energy=red · biofarming=green etc.
  ✅ CI PLACEMENT GUARD LIVE (T3 S13 · 6df6e32) · e2e-placement-guard.yml · green 49s
  ✅ REJOIN PROVEN (T3 S13 · df6df83) · persistence witness test · board re-hydrates on refresh
  ✅ 7/7 E2E TESTS GREEN (T3 S13) · game-ux+two-human+reconnect+phase-over-wire all pass
  ✅ FORCE:TRUE LOAD-BEARING (T3 S12) · hexPulse animation · never remove
  ✅ ESOTERIC KNOWLEDGE SKILL · .claude/skills/esoteric-knowledge/SKILL.md
  🔴 COMMS TRACKED-BUT-GITIGNORED · M state is expected · T3 S14 fixes it (git rm --cached)
  🟡 FINAL SCORE SCREEN · not upgraded yet · T1 S14 Task A
  🟡 BONUS EARN DATA · 7th request · still pending from Mahil · T2 S14 Task A
  🟡 GLOBAL NEOTOPIA INDEX · T2 S14 Task B · migration 009 pending
  🟡 CARD ART · 9 prompts defined · art must be saved as card_NN.png NOT esoteric name

  ART FILENAME MAPPING (card.id → file):
    ennead-source-temple → card_50.png (Source Temple · 5pt Community)
    orichalcum-arc-station prompt → card_05.png (Orichalcum Arc Node · 2pt)
    fohat-resonance-spire prompt → card_17.png (Orichalcum Energy Spire · 3pt)
    solar-fibonacci-array prompt → card_01.png (Fibonacci Solar Terrace · 2pt)
    naacal-seed-vault prompt → card_06.png (Naacal Seed Archive · 2pt)
    lemurian-resonance-garden → card_20.png (Food Forest · 3pt)
    metatrons-cube-processor → card_33.png (Holographic Research Center · 4pt)
    akashic-information-matrix → card_28.png (Akashic Living Archive · 3pt)
    ennead-council-chamber → card_39.png (Ennead Council Chamber · 4pt)
    Drop all in: ~/NeoTopia/public/art/cards/ · CardFrame auto-loads by card.id

COMMS SYSTEM (permanent):
  .claude/comms/tomorrow.md · filesystem-shared between terminals · GITIGNORED (policy)
  T3 S14 fixes the tracked-but-gitignored M state: git rm --cached .claude/comms/tomorrow.md
  NEVER: git add .claude/comms/ · NEVER: git commit comms
  relay.sh v2.0: cats comms to relay output without committing

FORCE:TRUE IS LOAD-BEARING (T3 S12 · permanent):
  hexPulse animation (scale 1↔1.08) keeps <g data-valid> bbox moving
  Playwright click-stability times out without force:true · NEVER remove

CIVILIZATION MILESTONES:
  June 27 2026: 11 elements placed (DB-proven · room YQZHRB · T3 S12)
  June 27 2026: 36 elements in 20 turns (bot v4.3 · room HF9QYE)
  June 27 2026: CI placement guard live · 7/7 E2E green · rejoin proven
  June 27 2026: 28 card names upgraded to esoteric vocabulary

BOT TRUTH:
  Proxy counter ≠ DB truth (T3 S12 taught this · T2 S13 self-enforced via dbVerified)
  DB mismatch caught: proxy 21 vs DB 19 (T2 S13 run)
  Bot v4.4 emits: summary.totalPlacedProxy + summary.totalPlacedDB + summary.dbVerified
  Success metric: dbVerified === true over N runs

CARD ART DIRECTION:
  Master template: ONE octagonal amber-gold tower · dark navy background · teal dome · sacred symbol
  Image 6 confirmed 200/200 (June 27 2026) · Flower of Life · Community element
  Prompts in: docs/ART_DIRECTION_PIXEL.md
  Vocabulary in: .claude/skills/esoteric-knowledge/SKILL.md
  Files MUST be named card_NN.png (not esoteric name) · see ART FILENAME MAPPING above

CRITICAL PATTERNS (never revert):
  sessionPhaseColumn: maps store 'scoring'→'finished'
  Tutorial gate: {showTutorial && phase==='playing'} — NOT isMyTurn
  data-my-turn: on GameRoom root div · 'true'/'false' · flips per turn (Rule 50)
  Bot placement: factory→element-btn→region-btn→valid-hex · ALL force:true (Rule 53)
  purge_e2e_test_data: requires signInAnonymously() · mig 007+008
  game_sessions.phase CHECK: (playing|endgame|finished) — NEVER write 'scoring'
  COMMS: filesystem-local · NEVER git commit · relay.sh reads from disk

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ migrations/
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short before every edit. M from other terminal = STOP.

AUTODRIVE! SYSTEM (v2.0 · self-evolving):
  Protocol: 1.Rating table · 2.Milestone check · 3.Rule audit · 4.Skill upgrade ·
            5.Comms error · 6.Bot health · 7.Card vocabulary · 8.FORGE · 9.Cross-terminal matrix
  FORGES ARE MANDATORY: AUTODRIVE! always ends with all 3 session forges written.
  Self-evolution: every session lesson → permanent rule → next forge smarter.

SELF-RATING: Forge /200 · <85 internal = REWRITE · Task /50 · Session /300

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -120
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  git log --oneline -8 && git status --short
  npx vitest run 2>&1 | tail -6
  npm run build 2>&1 | tail -3

MOLTBOOK: Agent neotopian · /m/neotopia · 1 organic follower · heartbeat 4h

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean
  Final score: calculateFinalScore(scores[], unusedCount)→number
  Phase DB mapping: sessionPhaseColumn(storePhase) · 'scoring'→'finished'
  turnTimeRemaining: local countdown tick · NEVER decrements store (Rule 32)
  Terrain biomes: getBiomeForRegion(regionId) → {colors:{hex}}

DB CONTRACT (5 tables · all RLS · migrations 001-008):
  game_sessions.phase: CHECK IN (playing|endgame|finished) — NOT 'scoring'
  game_events: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  Migration 006: purge_e2e_test_data() · SECURITY DEFINER · authenticated-only
  Migration 008: purge any-status rooms for bot profiles · FK CASCADE verified
  Migration 009 (T2 S14): global_neotopia_index · civilization records across all games

GAME MECHANICS:
  4-STEP PLACEMENT: factory click → element-btn → region-btn → valid-hex (ALL force:true)
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (57 · cumulative):
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
      genuinely smallest, preserve another lane's documented design. (T1 S12)
  55. The render is the witness; the node-tree is not. A DOM assertion proves presence;
      only a screenshot proves visibility. When the goal is visual, screenshot-verify —
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

CODEWORDS:
  T[N] AUTODRIVE! → paste output · full v2.0 protocol · always ends with 3 forges
  SKILLUPGRADE! · SCANSKILLS! · DEEPDIVE! · OVERDRIVE! · NIGHTSAVE!

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
SKILLS: .claude/skills/ · reforge · supabase-patterns · neotopia-forge-patterns · esoteric-knowledge v1.0
FORGES: .claude/skills/forges/ · T1_S14 · T2_S14 · T3_S14 (latest)
