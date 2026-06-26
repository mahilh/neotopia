# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (post S12 · June 27 2026 · MORNING):
  ✅ 11 ELEMENTS PLACED IN PRODUCTION (DB-PROVEN · T3 S12 · room YQZHRB)
  ✅ BOT v4.3 (T2 S12) · 4-step placement: factory→element→region→hex · force:true LOAD-BEARING
  ✅ force:true ROOT CAUSE (T3 S12): hexPulse animation keeps bbox moving → Playwright times out
  ✅ MIGRATION 008 (T2 S12) · purge any-status rooms for bot profiles · FK CASCADE verified
  ✅ PLACEMENT-COMMIT GUARD (T3 S12 · 193fa08) · permanent CI test · hex-element token 0→1
  ✅ data-testid="room-code" (T1 S12) · bot strategy 2 now primary
  ✅ 12px FONT FLOOR (T1 S12) · The Offer/Hand/Score/Actions labels + region names
  ✅ LIVE TURN TIMER (T1 S12 · 77bbd60) · local tick countdown · never writes store (Rule 32)
  ✅ 4-AGENT ADVERSARIAL REVIEW (T1 S12) · A/B/C/cross-cutting clean
  ✅ ESOTERIC KNOWLEDGE SKILL (.claude/skills/esoteric-knowledge/SKILL.md) · Council of 9 · Atlantis · Ra Material
  ✅ 3 SKILLS UPGRADED · neotopia-forge-patterns v3 · supabase-patterns v3 · reforge v3
  ✅ relay.sh v2.0 · comms never committed · bot health in relay · Rule 53 reminder
  🔴 COMMS ARE FILESYSTEM-LOCAL · .claude/comms is gitignored · NEVER git add/commit comms
  🟡 CARD ART: master template established (image 6 · 200/200) · need energy/biofarming/tech cards
  🟡 BONUS EARN DATA: still pending from Mahil (6th request incoming)
  🟡 Bot v4.4 needed: proxy count → DB-read for true placed count + rate-limit retry

  ⏳ T1 S13: terrain biome integration with CardFrame · pixel art card loading · UX from game-ux gates
  ⏳ T2 S13: v4.4 (DB-read placed count + rate-limit retry) · bonus data integration
  ⏳ T3 S13: CI workflow for placement-commit guard · re-run bot with DB verification
  ⏳ MAHIL: git pull + run bot v4.3 · generate pixel art cards (prompts in docs/ART_DIRECTION_PIXEL.md)

COMMS SYSTEM (PERMANENT FIX · T1 S12):
  .claude/comms/tomorrow.md is FILESYSTEM-SHARED between terminals
  It is GITIGNORED (intentional "Session comms · local only" configuration)
  Terminals: write to tomorrow.md on disk ONLY
  NEVER: git add .claude/comms/ (this produces the "Error: Exit code 1" that T1 S12 saw)
  relay.sh v2.0: explicitly handles this · cat comms in relay output without committing
  The error from T1 S12 will never appear again

FORCE:TRUE IS LOAD-BEARING (T3 S12 · permanent):
  The valid-hex ring runs infinite hexPulse scale animation (scale 1↔1.08 in src/index.css)
  The <g data-valid> bbox never settles → Playwright click-stability check times out
  Without force:true: click swallowed · nothing commits · placed counter shows 8 · DB shows 0
  With force:true: 4-step chain commits real elements · T3 verified 11 in game_sessions
  NEVER remove force:true from valid-hex clicks in bot-simulate.js

CIVILIZATION MILESTONE (June 27 2026 · room YQZHRB):
  11 elements placed in production: 8 Sacred City + 3 Living Earth
  First machine-played game session verified against Supabase DB
  Milestone proved: NeoTopia is mechanically playable by autonomous agents

BOT SIMULATION TRUTH:
  Proxy counter (placedElements in report) ≠ DB truth
  T3 S12: proxy said 8 · DB said 0 (before force:true) · proxy said 11 · DB said 11 (after force:true)
  Success metric = SELECT COUNT FROM game_sessions WHERE room_id=X AND board_state IS NOT NULL
  Bot v4.4 (T2 S13): implement DB-read placed count instead of proxy

CARD ART DIRECTION (FINAL MASTER TEMPLATE):
  Image 6 (latest · June 27 2026 · 200/200): ONE octagonal temple · dark navy background
  Amber-gold brick + teal crystal dome + Flower of Life on facade + teal crystal door
  This is the master template — ALL 56 cards match this style
  Element-specific variations: only the building function and sacred symbol changes
  Prompts: docs/ART_DIRECTION_PIXEL.md (updated with exact per-card names + element symbols)
  Card art skill: .claude/skills/esoteric-knowledge/SKILL.md has vocabulary for all card names

CRITICAL PATTERNS (never revert):
  sessionPhaseColumn: maps store 'scoring'→'finished' at game_sessions write boundary
  Tutorial gate: {showTutorial && phase==='playing'} — NOT isMyTurn
  data-my-turn: on GameRoom root div · 'true'/'false' · flips per turn (Rule 50)
  Bot turn detection: detectActiveTurn(p1, p2) polls BOTH pages
  Bot placement: factory→element-btn→region-btn→valid-hex · ALL with force:true (Rule 53)
  force:true on valid-hex clicks: LOAD-BEARING forever (hexPulse animation)
  purge_e2e_test_data: requires signInAnonymously() · authenticated-only (mig 007+008)
  game_sessions.phase CHECK: (playing|endgame|finished) — NEVER write 'scoring' directly
  COMMS: filesystem-local · NEVER git commit · relay.sh reads from disk

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/ migrations/
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
  COLLISION: git status --short [lane] before every edit. M from other terminal = STOP.

AUTODRIVE! SYSTEM (v2.0 · self-evolving):

  WHAT AUTODRIVE! IS:
  T[N] AUTODRIVE! → Mahil pastes terminal relay output → I run the full analysis protocol below
  Every session, AUTODRIVE! gets smarter because every evolution lesson becomes a rule/pattern

  AUTODRIVE! PROTOCOL (what I do with every output):
  1. RATING TABLE: T1/T2/T3 ratings + key wins + new rules
  2. MILESTONE CHECK: totalPlaced from DB (not proxy) · any new civilization milestones?
  3. RULE AUDIT: did any rule get violated? Add new rule if yes.
  4. SKILL UPGRADE CHECK: should any skill be upgraded from this session's lessons?
  5. COMMS ERROR CHECK: were there any "Exit code 1" from comms? (should be 0 now)
  6. BOT HEALTH: what did the last bot report say? (now auto-included in relay v2.0)
  7. CARD VOCABULARY CHECK: do any new elements/buildings need esoteric naming?
  8. FORGE: write the next session's forge at max quality (/200 self-rated)
  9. CROSS-TERMINAL MATRIX: what does each terminal need from the others?

  AUTODRIVE! WHAT'S BEEN MISSING (permanently fixed in v2.0):
  - Bot health was not in relay output → NOW: relay.sh v2.0 includes bot report summary
  - Comms commit error appeared in T1 output → NOW: relay.sh never commits comms
  - No civilization vocabulary check → NOW: esoteric-knowledge skill auto-referenced
  - No milestone verification protocol → NOW: Rule 53 mandates DB verification
  - No AUTODRIVE! self-evolution mechanism → NOW: every evolution lesson = permanent rule

  AUTODRIVE! SELF-EVOLUTION:
  After every T[N] AUTODRIVE! response, I ask: "Did this session teach something that
  would make the next forge better if it were a rule?" If yes → new rule added to CLAUDE.md.
  The system learns from every session. Each AUTODRIVE! is smarter than the last.

SELF-RATING: Forge /200 target · <85 internal /100 = REWRITE · Task /50 · Session /300

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -180
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
  turnTimeRemaining: local countdown tick (display-only · NEVER decrements store · Rule 32)
  Terrain biomes: getBiomeForRegion(regionId) → {colors:{hex}} · biome.colors.hex

DB CONTRACT (5 tables · all RLS · migrations 001-008):
  game_sessions.phase: CHECK IN (playing|endgame|finished) — NOT 'scoring'
  game_events: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  Migration 006: purge_e2e_test_data() · SECURITY DEFINER · authenticated-only
  Migration 007: restrict purge to authenticated
  Migration 008 (T2 S12): purge any-status rooms for bot profiles · FK CASCADE verified

GAME MECHANICS (4-STEP PLACEMENT · T2 S12 DISCOVERY):
  Click factory → element-type button appears → region button appears → valid hexes appear
  Bot must complete ALL 4 steps: factory click → element-btn click → region-btn click → hex click
  force:true on valid-hex clicks is LOAD-BEARING (hexPulse animation, Rule 53)
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster

CARD ART (for reference):
  src/components/CardFrame.jsx: dark obsidian frame · unchanged · all 56 cards use it
  public/art/cards/[card-id].png: pixel art images auto-load when dropped in
  56 card IDs in src/lib/projectCards.js
  Card naming vocabulary: .claude/skills/esoteric-knowledge/SKILL.md

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (54 · cumulative):
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

CODEWORDS:
  T[N] AUTODRIVE! → paste output · I run the full v2.0 AUTODRIVE! protocol above
  Forge target: 200/200 → rate /300 · <85 internal = REWRITE
  SKILLUPGRADE! · SCANSKILLS! · DEEPDIVE! · OVERDRIVE! · NIGHTSAVE!

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
SKILLS v3: .claude/skills/ · reforge (190/200) · supabase-patterns (192/200) · neotopia-forge-patterns (196/200) · esoteric-knowledge v1.0
