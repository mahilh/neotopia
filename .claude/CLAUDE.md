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

  ✅ GAMES_WON: award_game_win has a caller (T2 S35 · 4781b13 · FinalScore, every seat, retries 'no_game_end').
     Was applied S33 and invoked by nothing for 2 sessions · game_wins had 0 rows against 3 finished games.
  🟡 CARD ART: 20/56 · shimmer is graceful fallback for the other 36 · real PNGs are the civilization's face
     (was recorded as 0/56 for ~15 sessions while 20 PNGs sat in public/art/cards/ · corrected T2 S34)
  ✅ CARD NAMES: bucket B APPLIED · 20 renamed (T2 S34 · T1's audit 28c077a, Mahil approved) · zero
     esoteric proper nouns left in the deck · Node/Gateway gone from every name · 56 stays 56 ·
     bucket A 24 and bucket C 12 untouched by design
  ✅ CLUSTER OWNERSHIP: SHIPPED (T2 S35 · d1017c1) · placeElement stamps placedBy:seat · getClusterDetail(regions,
     seat)/getClusterTotal(regions, seat) score the rulebook's "of their color" clause · game_end payload v2 with
     final_scores[].cluster_bonus · MEASURED on the SAME 60 games under both rules: greedy-beats-random 46.7% (old
     shared) -> 64.3% (per-player), control 50.0%. The cluster term was board-global and identical for everybody
     from S18 to S35, so it could not change a ranking · that is why placement measured as noise all along.
  ✅ CLUSTER POINTS: SHIPPED · engine 2348daa (T2 S18 · getClusterDetail.bonus/getClusterTotal/calculateFinalScore
     3rd arg · 1pt per element in biggest cluster per region) · display 442b694 (T1 S19 · per-cluster +N pts +
     "+N total" line · folded into every player total + threaded regions→buildGameEndEvent so audit===screen)
  🔴 SIMULTANEOUS DRAW: engine gate correct · channel is snapshot-based (not event-reducer)
     T2 must design atomic seat-scoped draw RPC · T3 wires it after
  ✅ LANDING PAGE COUNTER: REAL · Landing.jsx reads getGlobalIndex() (sum of districts · seed 147823 fallback
     ONLY) · label "consciousness districts built" matches what the fn returns (T1 S19 Task C verified · Rule 63)
  🟢 BONUS TOKENS ARE EARNABLE (T2 S38 · c467656) · 156 tokens across 40 complete games, in 40 of 40,
     against 0 in every game ever played before. bonusPile seeded from docs/NEOTOPIA_GAME_RULEBOOK.md
     :115-125 (7 subsidy · 13 initiative · 18 permits per region · SOURCED, not guessed · rule 32) and
     the granter now matches a crossing to ITS OWN threshold instead of shift()-ing the stack top, which
     handed the second player to cross 7 the 13-token (rule 85). Measured subsidy 91 / initiative 42 /
     permits 23 · the shape thresholds 7/13/18 predict.
     BALANCE MEASURED (T2 S39 · 57be1f7 · docs/BONUS_TOKEN_BALANCE.md) · 360 seeds, 3 disjoint blocks,
     scored two ways on IDENTICAL games (bots never read tokens, so the control is exact not statistical).
     Tokens favour the WEAKER player: apprentice -2.4, builder -3.0, architect -0.8, 9/9 cells negative,
     control 50.0/50.0 with paired flips 26/26 of 52. McNemar within-matchup: builder p=0.0065.
     Mechanism: builder earns +1.68 pts of mean token edge against 7.44 pts of spread · signal/noise
     0.23, and noise helps the underdog. INSIDE the 10-point tripwire, so no rebalance recommended.
     RE-RUN THIS when a control for useBonus ships · every token measured was UNSPENT, and a spendable
     token is a decision, which rewards skill rather than diluting it. The sign may invert.
     ✅ AND THE GUARD NOW SAYS SO ITSELF (T2 S40 · 29ba6f0) · bonusBalance.test.js asserts its own two
     premises, not just its number: (A) no product code invokes useBonus, so the measured term is a flat
     constant · this fires the day T1 ships the control, and the failure message says RE-RUN rather than
     revert; (B) no bot decision code reads bonus state, so seeding changes scoring only and the control
     is EXACT. B is the dangerous one · it breaks silently, changes no number, and downgrades
     one-game-scored-twice into two different games. Teeth proven by 3 mutations, not by a passing run.
     STILL OPEN, neither guessed: (a) the HEX granter needs Mahil's bonus-hex (q,r) and is the only route
     to the fourth token 'automatization' · see docs/BONUS_HEX_DATA_REQUEST.md, every coordinate
     enumerated · (b) NOTHING CALLS useBonus, so every token earned is unspent and scores its rulebook
     3 points at the end. That is rulebook-correct but it is not yet a CHOICE · T1 owns the control.
     (S37 determined the subsystem was unreachable · 2eb18eb. S38 closed the score-track half.)
  🟡 BONUS HEX DATA: 12th request · bonus hex (q,r) per region · the PILE half is now answered from the
     rulebook (S38), so this is the last missing datum and the only route to 'automatization'
  ✅ CLUSTER VIZ: shows POINTS · per-cluster +N pts + "+N total" line · folded into player totals (T1 S19 · 442b694)
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

MULTIPLAYER ENDGAME PROOF · WHAT IT DOES AND DOES NOT PROVE (T3 S37/S38):
  tests/e2e/multiplayer-endgame-live.e2e.js · gate runs its ENGINE test, nightly runs the two live ones.
  THE COMPROMISE, stated because the next session will otherwise re-litigate it: a NATURAL 56-card game
  end is infeasible through the UI · hundreds of turns at four clicks per placement · and two-human.e2e.js
  has said so since S7. So the ending is played by the REAL ENGINE (src/store/gameStore driven directly,
  not reimplemented) to its own 'scoring', and that finished state reaches the browsers through the REAL
  wire: ONE game_sessions.state UPDATE by a real member, picked up by both clients' postgres_changes
  subscription and applied by syncFromServer. Nothing is service-role and nothing is dispatched into a tab.
  PROVES · the genuine lobby loop, two real anon identities, a real room + session, FinalScore rendering
    from a synced TERMINAL state, per-player cluster scores that DIFFER on screen and match the engine,
    record_civilization_score, games_played, award_game_win/games_won credited exactly once to the right
    player, the exact set of RPCs a finished game may send, and placedBy surviving the real round trip
    (T2 unit-tested that; nothing had watched it cross the network until S37).
  DOES NOT PROVE · that the endgame TRIGGER fires in a live synced room. refillFactoryDraft →
    endGameTriggered → endGameRoundsRemaining 2→1→0 → phase 'scoring' is proven by the engine offline
    (four-player-live) and in a real browser against bots (practice.e2e.js, ~90-115s to a natural end),
    but the composition of the two · a real multiplayer room reaching its own ending through play · has
    never run. That is the honest remaining gap, not a claim this file makes.

CRITICAL PATTERNS:
  sessionPhaseColumn: maps store 'scoring'→'finished'
  Tutorial gate: {showTutorial && phase==='playing'} — NOT isMyTurn
  data-my-turn: on GameRoom root div · flips per turn
  Bot: ALL steps force:true
  game_sessions.phase CHECK: (playing|endgame|finished) — NEVER 'scoring'
  COMMS: NEVER commit
  sacredMilestone symbol: NEVER ✡ hexagram
  getClusterDetail: element keys are LOWERCASE ('energy' not 'Energy')
  Cluster viz: shows points (T1 S19 · 1pt per element token on the biggest cluster · board game rule p9)

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
  Cluster ownership: hexes carry placedBy · PASS THE SEAT to getClusterTotal/getClusterDetail (T2 S35).
            No seat = the pre-S35 board-global reading, kept for the viz and for unowned pre-S35 boards.
  Flow mode config: getModeConfig(mode) · GAME_MODES.classic + GAME_MODES.flow

DB CONTRACT (migrations 001-010):
  game_sessions.phase: CHECK IN (playing|endgame|finished)
  Migration 009: global_neotopia_index · SECURITY DEFINER · record_civilization_score
  Migration 010: game_sessions.mode TEXT DEFAULT 'classic'

GAME MECHANICS:
  4-STEP PLACEMENT: factory→element-btn→region-btn→valid-hex (ALL force:true)
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster
  CLUSTER: 1pt per element token OF YOUR COLOR in the biggest cluster per region (rule p9 · CODED T2 S35)
  MODES: Classic (90s/12tiles) · Flow (15s/9tiles) · GAME_MODES single-source

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (92 · cumulative):
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
  68. A migration committed to git is NOT a deployed schema. The file in
      migrations/ proves INTENT, not STATE — the RPC/table exists in prod only
      after it is applied to the live DB. Verify against the system of record
      before depending on it; a PostgREST PGRST202 ("function not found") at
      runtime means the migration is committed but NOT yet deployed. Pairs with
      Rule 30 (information_schema != full contract) + Rule 56 (verify columns
      live). (S18 · migration 011 atomic-draw RPC committed 9ff577e · presence
      in git does not make supabase.rpc() resolve until it is pushed to the DB.)
  69. A forge task list is a HYPOTHESIS, not a fact. Premise-check each task
      against HEAD before executing it, and reconcile when reality has moved —
      ship the forge's INTENT, not its literal stale steps. Sharpens Rule
      28/54/64 (a premise has a shelf life) with the task-list dimension.
      (T1 S19 · the forge said "push 1252bb4 to unblock T2's 2348daa" but at
      boot local was already 6 ahead with 2348daa committed, and mid-session
      another terminal pushed the whole S18 set to origin · the literal first
      action was already done · executing it blindly would chase a vanished
      premise. Also caught the FinalScore/audit total divergence by re-reading
      the seam both lanes had touched, not the forge's description of it.)

CODEWORDS: T[N] AUTODRIVE! · SKILLUPGRADE! · DEEPDIVE! · XRAY! · NIGHTSAVE!
FORGES: .claude/skills/forges/ · T1_S18 + T2_S18 + T3_S18 (latest)
DOCS: docs/ · CIVILIZATION_SOUL_DOCUMENT · NEOTOPIA_STAGE_3_VISION · NEOTOPIA_PITCHDECK_EXPANDED

DRIVE SKILLS SYSTEM (permanent · June 29 2026):
  Folder: https://drive.google.com/drive/folders/16VcjTyJA95ELauwukSEGXFt3FCgHu1R2
  11 skill files · service account sync · never expires
  Boot: node scripts/sync-drive-skills.cjs --test
  Sync: node scripts/sync-drive-skills.cjs --all (NIGHTSAVE mandatory)
  Flaw log: node scripts/sync-drive-skills.cjs --log-flaw <CAT> "<flaw>" <score>
  Session log: node scripts/sync-drive-skills.cjs --log-session <name> <shipped> <score>
  EVERY SESSION CLOSE RUNS --all AND --log-session. NO EXCEPTIONS.

CLOSING RECOMMENDATION (standing · Mahil, August 9 2026 · applies to EVERY terminal, EVERY session):
  End every session with a NEXT BEST STEP for your own lane:
    1. what you would do next
    2. WHY it is the highest-value thing available to YOU SPECIFICALLY (not to the project in general)
    3. one concrete way the work you just did could be improved
  Base it on what you MEASURED this session, not on the brief · a recommendation resting on an
  unmeasured impression is the thing Rule 81 is about.
  "Nothing" is a permitted answer and must be DEFENDED. Under-claiming is a different inaccuracy,
  not humility · the same failure as a counter resting at a plausible zero (Rule 80).

RULE 70 (T1 S21 · June 29 2026):
A forge can report a feature as missing when it exists but is too subtle to perceive.
Always verify rendered output (screenshot + DOM measurement), not just code presence.
Enhance in your own lane rather than rebuild or cross into the owner's data file.

RULE 71 (T3 S21 · June 29 2026):
A self-improving system that syncs files but never refreshes the facts inside them
faithfully mirrors rot. Sync ≠ current. Boot premise-checks must validate HEAD
(git rev-parse --short HEAD) and test count (vitest) from live source at the moment
of use — never from the skill file's last-written content.

RULE 72 (T3 S22 · June 30 2026):
A freshness/drift gate cannot compare a committed artifact to its own live identity by equality.
Its recorded HEAD is at best its commit's parent. Gate on ancestry + bounded distance, never equality.
Running a verifier once proves it executes, not that its verdict is sound · adversarial review found
3 real logic flaws in the first --validate-manifest that a single passing run did not surface.

RULE 73 (T2 S35 · August 9 2026):
A scoring term that is IDENTICAL for every player cannot decide anything, however large it is.
The cluster bonus sat at 40 points in a real finished game and moved nobody, because it was added to
both totals equally · and every measurement of "placement skill is noise" for three sessions was
actually measuring that. Before concluding a mechanic does not matter, check whether it is even
capable of mattering: find the term, and ask whether it can DIFFER between players. A per-player
term with a small effect is a balance question; a shared term is an arithmetic no-op wearing the
costume of a balance question. Corollary for the data model: a rule quoted as "each player gains X
for their Y" cannot be implemented at all if the record of Y carries no owner · the divergence will
be documented as a compromise (S18 did document it, honestly) and then read for three sessions as
though it were the rule.

RULE 74 (T2 S35 · August 9 2026):
When comparing an OLD rule to a NEW one, score the SAME games under both rather than running the
experiment twice. Two runs invite exactly the confound that broke T3's S34 load experiment: the tree
moved between treatment and control. Recomputing the old rule from the finished state of the new
run's games costs nothing, removes the confound entirely, and makes the control auditable · here it
turned "greedy 64.3%" into "46.7% vs 64.3% on identical play, control 50.0%", which is a claim and
not a number. Sharpens T3's S31 stamping rule: a control must share the treatment's commit AND,
where possible, its actual data.

RULE 75 (T1 S33/S34, recorded S35 · August 9 2026):
Two lessons that were written into .claude/comms/ as "permanent rules 73 and 74" and therefore were
not permanent at all · comms is GITIGNORED, so T2 correctly took 73/74 in the shared record while
mine existed only on one disk. THE META-LESSON IS THE NUMBERING ITSELF: a rule is only a rule once
it is in the file every terminal reads. Write it to CLAUDE.md in the session that earns it.
  75a (T1 S33) · A composition proven on the COMMON path is not proven. The bot integration ran three
  clean turns in my first live check because the bot had never scored; the deadlock lived only in the
  rarest and most valuable action. Drive the highest-value branch, not the reachable one.
  75b (T1 S34) · A PROBE IS A CLAIM AND HAS TO BE DOUBTED LIKE ONE. Three lied in one session, each
  returning a plausible number rather than an error. Check that a probe measured the thing it names:
  read back an actual value you can recognise (a token's real colour, a non-null element), not just
  the summary statistic it computed from it.

RULE 76 (T1 S35 · August 9 2026):
A setTimeout inside a useEffect is cancelled by its own cleanup whenever a dep identity churns, so
any effect whose timer is LONGER than the app's fastest re-render interval can never fire · silently,
with nothing in the console. NeoTopia re-renders once a second for the turn countdown, which made
this a general hazard rather than a one-off: it had already killed ScoreFlash's 2200ms auto-unmount
in shipped code (a fixed, full-screen, dismiss-less overlay that therefore never left the screen once
a player scored), and it killed the first draft of auto-end-turn before a test caught it. Handlers and
callbacks belong in a ref; effect deps belong to VALUES. Same family as the S33 bot deadlock. And fix
it in the component, not by memoising the caller · that makes it correct for every caller instead of
for one careful one.

RULE 78 (T1 S36 · August 9 2026):
A VISIBILITY CHECK IS NOT A REACHABILITY CHECK, and the difference is the whole bug. Twice in one
session a control was in the DOM, not hidden, not disabled, correctly sized, and impossible for a
player to click · and a standard isVisible()/toBeVisible() passed both times.
  78a · COVERED. The practice "Leave" button sat under FinalScore (position:fixed, inset:0, zIndex
  300, opaque). T3 caught it because a real Playwright click TIMED OUT and elementFromPoint at the
  button's centre returned the dialog. Same shape as S35's ScoreFlash: a full-viewport overlay
  swallowing whatever is beneath it. When an overlay owns the screen, the control has to MOVE INTO
  it · raising a z-index just moves the argument.
  78b · PUSHED OFF. Fixing 78a did not stop me committing 78b an hour later: a 44px rules button
  added to the bottom ActionBar put End Turn's right edge at 337 in a 320px viewport. The bar was
  already at exactly 320 of 320, so it had no room at all and nothing said so · flex just overflowed.
THE PROBE THAT CATCHES BOTH, and it is two lines: at the control's centre, assert
document.elementFromPoint returns the control itself, AND assert its rect lies inside the viewport.
Run it at 320 as well as 375 · 320 is where "exactly fits" becomes "off the screen".
COROLLARY: jsdom has no layout, so it can hold neither claim. Do not write a test that pretends to ·
put the reachability check in the browser and keep the DECISION in the unit test (this control is
not in the footer; exactly one exit exists at a time). Sharpens Rule 55 (the render is the witness)
with the control dimension, and Rule 4 (44px) with the observation that a correct size at an
unreachable position is still a control the player does not have.

RULE 81 (T1 S37 · August 9 2026):
A NUMBER YOU REASONED TO IS A CLAIM. COMPUTE THE CONSTRAINT IN THE TEST, NOT IN YOUR HEAD.
Three times in one session a specific, plausible, carefully-argued figure was simply wrong, and every
one of them would have shipped as a comment explaining it:
  81a · I sized the backdrop mask so it would cover the play area "out to the region's inradius,
        135.9". The corners of the outer hexes stick past that. The test computed the real figure at
        144.0 and reddened · the hole had been two units too small at six places, which is a painted
        plateau under a token. The fix was not a better estimate, it was making the test derive the
        number from hexToPixel so it cannot be got wrong by hand.
  81b · "The action bar is exactly 320 of 320 at its narrowest, so it fits." It does not fit: its
        three groups want 440 against a 292 content box, and flex had been SHRINKING them all along.
        Not knowing which mechanism was absorbing the overflow is what made my first fix a
        regression · turning on flex-wrap replaced the shrink with a wrap and cost 25px of board on
        every phone in use, to solve a case no player can reach yet.
  81c · The brief read a rotation of "roughly 20-30 degrees" and an off-centre hub off the artwork by
        eye. Measured: 0.191 degrees, and the hub within 3px of the centroid. Acting on either would
        have rotated a correctly-aligned image · an eyeball reading of an image is a hypothesis, and
        the confident ones are the expensive ones.
COROLLARY, because a probe can point at the right coordinates and still measure nothing: an SVG
serialised with only a viewBox has an intrinsic size of its own choosing · this board reported
143x150 · so drawImage into a full-size canvas upscales that 12x and every sampled pixel is a smeared
average. Nothing errors. Stamp explicit width/height on the clone before serialising, and keep a
read-back that would notice: a token pixel 150 away from its own palette colour is not a token.
WHERE IT LEADS, and this is the better half: when a visual guarantee can be made STRUCTURAL, prove it
by identity instead of defending a tolerance. Masking the painting out of the play area let gate 3 be
"206,625 pixels across all 57 hexes, max channel difference 0, and the control differs" rather than a
contrast ratio somebody has to agree is close enough. Sharpens Rule 61 (verify the value) and Rule
75b (a probe is a claim) with the arithmetic dimension; adjacent to T2's Rule 80, where the wrong
number came from a counter that could not measure rather than from a person who could not.

RULE 92 (T1 S40 · August 10 2026):
A CHECK WHOSE TWO SIDES COME FROM THE SAME SOURCE CANNOT FAIL, AND IT FAILS SILENTLY BY AGREEING.
Two instruments lied to me tonight in the same shape, one in a test and one in a browser, and neither
looked broken · both looked STABLE, which is the disguise.
  92a · THE COUNTERWEIGHT THAT COMPARED A CONSTANT TO ITSELF. Rule 90 says write the guard-against-
        the-wrong-fix first, and I did. The wrong fix for a label covering a hex is to nudge the label,
        so the guard pinned the overlap: label offset vs hex row, "derived rather than retyped". It was
        retyped · `HEX_SIZE * 3.55` copied into the test file. Mutating the component to `* 4.1`, the
        exact fix the guard forbids, left it GREEN, because both sides of the comparison were the test's
        own copy of the number. Writing a counterweight first does not make it able to fail; only
        mutating it does. Reading the rendered `y` attribute reddened it immediately. This is Rule 45
        (a second contract) inside Rule 90, and the second contract was three words long.
  92b · THE SETTLE LOOP THAT SETTLED ON THE PREVIOUS ANSWER. Sweeping fifteen viewport widths in an
        iframe, I polled until the reading stopped changing · three stable reads, up to 3s. It reported
        the PREVIOUS width's layout at three of fifteen steps and called it settled, because I polled
        from the parent's timer queue while ResizeObserver notifications are delivered on the CHILD's
        rendering pipeline. Consecutive stale reads are equal, so "stable" meant unchanged, not correct.
        I spent twenty minutes about to file my own component as laggy · it was never wrong; at top
        level the same resize is right within one frame. Await the child's rAF, not the parent's clock.
THE GENERAL FORM: before trusting a comparison, name the two sources and check they are genuinely two.
A test that reads the code's constant, a probe that polls its own last answer, a counter that
re-implements the logic it is auditing (Rule 80) · all the same defect, and all of them report health.
The tell is available in both cases and it is the same tell: THE INSTRUMENT AGREED WITH ITSELF TOO
EASILY. A stable reading and a correct reading are different claims. Sharpens Rule 90 with the
observation that ordering is necessary and not sufficient, and Rule 82 with the observation that a
probe can lie by waiting on the WRONG CLOCK as well as by not waiting at all.

RULE 91 (T2 S40 · August 10 2026):
AN INCIDENTAL POSITION IN A DATA STRUCTURE GETS READ AS A SEMANTIC FIELD, AND THE READING SURVIVES
BECAUSE IT IS RIGHT ABOUT HALF THE TIME. A card rename pass arrived with four element corrections
derived from `pattern[0].type` · treated throughout as "the card's element". It is not a field. It is
whatever tile happens to sit at (q:0, r:0), the pattern's origin, and the engine assigns it no meaning
at all. Computed against the whole pattern it disagrees with or ties the majority element on 24 OF 56
CARDS. Two of the four "corrections" were therefore shaky and one was simply wrong in a new direction:
card_55 was moved off biofarming (correct, it is not biofarming) onto technology (also not · the card
is community 2, everything else 1). card_48 is a perfect 1/1/1/1 four-way tie on a card whose own
description reads "Where all four forces agree", so naming it for its origin hex contradicts its text.
WHY IT SURVIVED, and this is the transferable half: a positional proxy is not random, it is CORRELATED ·
anchor and majority agreed on 32 of 56, so every spot-check anybody ever ran confirmed it. A proxy that
was wrong every time would have been caught the first day. Ask whether the thing you are reading is a
DECLARED field or a position you have interpreted, and if it is a position, compute the real quantity
over the whole structure once · it cost one node -e here and the disagreement rate was the answer.
COROLLARY, paid for in the same document: I then attributed four description lines to card ids by
reading line numbers against the nearest heading I remembered, and got THREE OF FOUR WRONG (card_25 not
24, card_34 not 30, card_50 not 51) · which would have sent someone editing three innocent cards. Walk
the file and track the enclosing record. Rule 81 in the cheapest possible costume: the check was four
lines of node and I nearly shipped the recollection instead. Sharpens Rule 73 (ask whether a term can
even matter) with its sibling · ask whether a key means what its name suggests.

RULE 90 (T3 S39 · August 10 2026):
WRITE THE COUNTERWEIGHT FIRST · IT IS THE ONE ASSERTION THAT NEVER GETS TO DEMONSTRATE IT CAN FAIL.
Rule 86 recorded the FACT that a counterweight had shipped vacuous. This is the ORDERING that removes the
class, and it costs nothing: author the guard-against-the-wrong-fix BEFORE the assertions it defends, so
there is nothing else in the file for it to hide behind. Written last it is exercised least, its whole job
is to fail in a scenario you are deliberately not creating, and only a mutation run finds it · written
first it is the only thing there, and its vacuity is immediate.
Applied this session to the played-endgame spec: the counterweight is a state THE HARNESS CANNOT PRODUCE
(endGameTriggered true while phase is still 'playing' and the tile clock has reached 0 · exactly one code
path in the codebase makes that, refillFactoryDraft on a placement that empties a factory), and it was the
first thing in the test body, before the seeding, the play loop or the assertions.
COROLLARY, THE SAME THOUGHT ABOUT MEASUREMENT: when a mistake recurs a third time, stop writing the fix
down and put it in the harness. Multi-viewport measurement inherited the previous size's scrollTop three
sessions running · a plausible 489px where the truth was 1038. It is now impossible: forEachViewport
resizes, resets window and element scroll, settles, then measures, so no caller can get it wrong. A rule
stated as a fact gets rediscovered; a rule expressed as a function cannot be.
COROLLARY 2, paid for in eight live runs tonight: an instrument that cannot say WHERE it stopped has not
measured anything. Six of those runs reported only "Test timeout of 300000ms exceeded" with no step,
because the loop logged nothing per iteration and Playwright has NO DEFAULT ACTION TIMEOUT, so one
un-timeouted click hung forever. A heartbeat line and an explicit timeout on every click turned five
minutes of silence into a 20-second failure that named the state. Add both before the run, not after it.

RULE 87 (T1 S39 · August 10 2026):
A REPORTED RANGE IS A SAMPLE, NOT A BOUNDARY · MEASURE PAST BOTH ITS EDGES BEFORE TRUSTING IT.
The action-log overlap was carried for three sessions, by me, as a "480-600px" problem. It was
480 to ~1200, and the WORST CASE SAT 20 PIXELS OUTSIDE THE BAND I WAS HANDED: at 620 it covered 31
of the 57 play cells · 54% of the board · against 12 at the widest point anyone had looked at. The
band was not wrong through carelessness; it was the honest report of one screenshot at one width,
and a screenshot cannot know where a curve peaks. Ranges arrive attached to the observation that
produced them, and the observation is almost never the extremum.
WHY THE PEAK HID THERE, which is the transferable part: 620 is twenty pixels past the 600px
breakpoint where the sidebar becomes a column again, so the board collapses while a fixed-width
overlay goes on claiming the same 176px. DISCONTINUITIES ARE WHERE MAXIMA LIVE. Whatever the
reported band is, the first widths to check are just outside it and just past every breakpoint in
between · not the middle, which is where a uniform sample would put its effort.
COROLLARY, the technique that made this affordable: one same-origin IFRAME whose width you sweep
in a loop, measuring inside it. Thirteen viewport resizes become one call, the app lays out for
real, and re-measuring after the fix is the same loop again. Cheap enumeration is what turns "I
believe this is a 480-600 problem" into a table.
AND THE SECOND-ORDER FINDING, worth as much as the first: `pointerEvents: none` had been protecting
this overlay from criticism. Because it could not steal a click it was assumed harmless, when what
it actually produced was cells that stayed CLICKABLE WHILE INVISIBLE · a player placing into and
scoring hexes they cannot see. That is Rule 78 inverted: reachable but not perceivable, and the
property that made it safe is what made it deniable.

RULE 88 (T2 S39 · August 10 2026):
A SATURATED METRIC CANNOT DETECT A REGRESSION, AND AVERAGING ACROSS SATURATED CELLS HIDES ONE.
I built a guard asserting that bonus tokens must not move any ladder win rate by more than 10 points,
then mutated the term from 3 points to 12 · a fourfold overpowering · and the guard PASSED. Apprentice
sits near 10% and architect near 98%; both are pinned against a bound and can barely register a delta
at all, so the mutation produced -8.0 / -17.6 / +0.0 for a mean of 8.5, comfortably under the wire.
I had noticed the ceiling early, said so out loud, and then failed to carry it into the design.
  88a · Before trusting a metric, ask what its RANGE is at the operating point. A rate near 0 or 100
        has almost no room to move and contributes a structural zero to any average built from it.
  88b · Prefer a statistic that cannot saturate. The fix was tokenPointShare · the term as a fraction
        of the score it is added to · measured at 0.105-0.137 everywhere, 0.45 under the mutation and
        0.0 when the term is switched off. Magnitude detects re-weighting; win rate detects only what
        the ladder has headroom to express.
  88c · SIZE THE GATE FROM DATA BEFORE CHOOSING ITS THRESHOLD. The per-rung delta ranged to -10.2
        across eight 25-seed blocks · a 10-point wire would have gone red on working code once in eight
        runs. A gate that flakes trains people to ignore it (Rule 84's failure mode inverted). Measure
        the spread across disjoint blocks, then set the bound, then say which assertion is sharp and
        which is a coarse backstop.
Pairs with Rule 81 (compute the constraint, do not reason it) and Rule 73 (ask whether a term is even
capable of mattering) · here the question was whether the INSTRUMENT was capable of noticing.

RULE 89 (T2 S39 · August 10 2026):
A UNIT TEST IS NOT A CONSUMER; A CI-GATED E2E SPEC IS. My S38 dead-surface audit scanned src/ api/
scripts/ and dismissed everything under tests/ · and got two of five findings wrong in the direction
that would have caused damage. factoryRefill and getFinalScore have no product caller and are both
driven by specs that gate merges today, so "dead, delete it" would have broken the gate. The right
classification has three buckets, not two: PRODUCT means the app uses it; CI-E2E means it is
TEST-SUPPORT API and must be kept and labelled; UNIT means only that it is exercised. A hand pass also
MISSED two symbols entirely, which is the argument for making the audit a script
(scripts/audit-dead-surface.sh) rather than an act of attention.
COROLLARY, and it happened on the first run: the script reported two symbols as used because its own
header comment named them as examples and it was grepping itself. A tool that scans the repo must
exclude itself · Rule 75b, in the one costume where the probe and the subject are the same file.

RULE 84 (T2 S38 · August 10 2026):
A WELL-TESTED SYMBOL IS NOT A TESTED PATH. Ask what SHIPPING code calls it, not how many tests do.
The dead-surface audit found five exported symbols with no shipping caller, and the two that matter are
not the obvious ones:
  84a · factoryRefill is referenced by FOUR test files, which reads as "the refill path is well covered".
        Nothing in src/ calls it. The path that actually runs is the internal refillFactoryDraft, invoked
        from placeElement. Nothing is broken · the clock demonstrably advances · but that coverage is
        aimed at a public wrapper while the real path is exercised only incidentally. Test count is not
        coverage; test count against a function nobody calls is anti-coverage, because it buys confidence
        in the wrong place.
  84b · I did this myself. I gated getFinalScore in clusterOwnership.test.js in S35 and presented it as
        covering the score seam. getFinalScore has no shipping caller · FinalScore.jsx computes its own
        total · so the seam I claimed to have covered is the one I then had to hand-edit in T1's file.
        A comment in gameEndEvent.js asserted all three paths used the same fn, which made the wrong
        mental model durable for three sessions.
THE CHEAP INSTRUMENT: grep every export, subtract its own definition and all test files, and read what
survives. It takes twenty minutes and it found the two live bugs of the previous two sessions in one
pass · award_game_win (S35) and useBonus (S37) were both found INCIDENTALLY, which is the whole argument
for doing it on purpose. The column that matters in the report is not "uncalled" but WHY THE RESTING
VALUE LOOKS CORRECT: a writer that throws is fixed the same day, one resting at 0, [] or not-displayed
survives for months. Corollary, and the reason this is not just tidying: a symbol's zero can be a FALSE
positive · record_civilization_score reads as uncalled because it is an RPC string invoked through
supabase.rpc. Verify every zero by hand (Rule 69). Sharpens Rule 27 (grep consumers first) with the
observation that the consumer set has to exclude the tests.

RULE 85 (T2 S38 · August 10 2026):
A SCARCE PRIZE AWARDED BY STACK ORDER GIVES THE WRONG PRIZE THE MOMENT THERE IS A SECOND CLAIMANT.
The bonus granter did bonusPile.shift() on any threshold crossing, which is indistinguishable from
correct while exactly one player ever crosses anything · and nobody ever had, because the pile was
empty. Seeding it exposed the bug instantly: the rulebook names a token PER THRESHOLD (7 Subsidy, 13
Initiative, 18 Permits), so the second player to cross 7 in a region would have received the 13-token, a
strictly better prize for a lower achievement. Match the award to the condition that earned it, not to
a position in a container. Where a rulebook states a mapping, the mapping is the source and the ordering
is the guess · and I nearly shipped the guess because it was already in the code.
COROLLARY on representing spent things: mark `claimed`, do not remove. A shift() makes "this region has
no 18-token left" indistinguishable from "this region never had one" · the same
absence-looks-like-a-value shape as Rules 80 and 84, in a third costume.

RULE 79 (T2 S37 · August 9 2026):
A SPEC THAT RUNS IN NO WORKFLOW CANNOT REPORT ITS OWN ROT, and it decays in the direction of a lie.
practice.e2e.js · three sessions of work, including the ledger proof that bots never write to the real
public civilization record · ran nowhere. Running it in order to wire it found test.fail() still attached
to a defect T1 had fixed eight commits earlier, so it had been asserting expected-to-fail against working
code, and wiring it blind would have turned the merge gate red on arrival. The staleness was not the
interesting part: NOTHING WAS WATCHING, so nothing could have said so. Corollaries, all paid for tonight:
  79a · Run a spec locally BEFORE adding it to a workflow. The nightly's own header already said this and
        it is the reason the gate went green on the first push instead of red.
  79b · Route by COST, not by convenience. practice mints zero identities so it belongs on the merge gate;
        solo-host costs 4 anon sign-ins so it belongs on the nightly. Same audit, opposite destinations.
  79c · The coverage number is not how many specs exist, it is how many RUN. Audit mechanically (every
        spec grepped against every workflow), because the orphans are invisible by construction.
  79d · A green workflow is not proof the spec executed · read the log for the test lines. A skip is not
        a pass, which is what the nightly's skip-guard exists to say.
Sharpens Rule 63 (gate only what's true) and Rule 67 (gate at the commit boundary) with the question that
precedes both: is this gate connected to anything at all?

RULE 80 (T2 S37 · August 9 2026):
A COUNTER THAT CANNOT MEASURE MUST SAY SO, NEVER RESOLVE TO A NUMBER. The relay reported Rules 69 against
78, Migrations 0 against 20, and Files blank · four symptoms, one root cause: every counter degraded to a
plausible value when its input was missing, so a failure to read was indistinguishable from a reading.
The migrations counter is the pure case · it pointed at a directory that does not exist and `2>/dev/null`
swallowed the error that would have said so. "Handles an empty dir gracefully" and "hides a wrong path"
were the same line of code. Distinguish NO DIRECTORY from NO FILES, and emit UNMEASURED for the first.
This is the family of award_game_win at 0 rows, card art at 0/56 for fifteen sessions, and games_played:
a value resting at something that looks correct. The relay is the worst place for it, because every
terminal reads it at close and believes it. Parse machine-readable output, never prose · FILE_COUNT
grepped for "test files" while vitest prints "Test Files" and had been silently blank forever.
Corollary: teeth-check a counter by breaking its INPUT, not by reading its output once · and if the check
re-implements the logic instead of calling it, that is a second contract (Rule 45) and needs a drift guard
until the real refactor lands.

RULE 86 (T3 S38 · August 10 2026):
THE TEST MOST LIKELY TO BE VACUOUS IS THE ONE YOU WROTE TO PREVENT THE WRONG FIX.
Pinning sessionId stability, I added a counterweight so nobody could satisfy every stability assertion the
cheap way · by deleting the cleanup that nulls it on room change, which would let one game's FinalScore
write its ledger row against the previous game's session. The counterweight COULD NOT FAIL. It unmounted
the hook and asserted that a FRESH renderHook read null · a new instance with its own useState(null), so it
read null whether the cleanup ran or not. Deleting `setSession(null)` left it green. Fixed by keeping the
SAME instance and changing the room underneath it.
WHY THIS CLASS AND NOT ANOTHER: a counterweight is written last, exercised least, and its entire job is to
fail in a scenario you are deliberately not creating · so it is the one assertion in the file that never
gets to demonstrate it can. And a guard against the wrong fix that reports itself as PRESENT is worse than
no guard: it retires the worry. The only instrument that finds it is mutation testing, and it finds it
immediately · this cost one run and would otherwise have shipped as a green line nobody reread.
COROLLARY, from the same session and the same family: an ordering that makes two measurements share state
turns the second one into a plausible lie. Measuring the score screen at 320 straight after 1280 inherited
the first pass's scrollTop, so "how far below the fold ON ARRIVAL" was read from a dialog somebody had
already scrolled · 489px and 2 gestures instead of the true 1038px and 3. Reset the shared state between
measurements, then check the two instruments AGREE (the in-test number now matches the standalone probe
exactly). Sharpens Rule 63 (write the test that tells the truth) and Rule 82 (a probe can lie by being
fast) with the dimension that a test can lie by being STRUCTURALLY UNABLE TO FAIL · and pairs with Rule 79d,
which is the same thought one level up: a green workflow is not proof the spec executed.

RULE 83 (T1 S38 · August 10 2026):
"IT FITS" IS NOT A MEASUREMENT. WHEN A LAYOUT ABSORBS AN OVER-SUBSCRIPTION, ASK WHAT PAID FOR IT.
The action bar's three groups want ~448px inside a 292px content box at 320. I measured it in S36,
S37 and S38, wrote "it fits" every time, and was checking the wrong thing every time: I looked at
End Turn, the control I was worried about, saw it on screen, and stopped. Flex had been closing the
156px gap by shrinking the only thing in the row that CAN shrink · the status text · so at 320 AND at
375 the span reading "Your turn" / "Waiting for Alice" rendered at 0.0px. The turn-ownership signal
has been absent from every multiplayer game on a phone, in shipped code, behind three green reports.
THE GENERAL FORM, which is not about CSS: a system that copes with an over-subscription has not
absorbed it, it has CHARGED it to something. Flex charges the most compressible element; a cache
charges the coldest entry; a retry budget charges the slowest caller. Find the payer by name before
calling the thing healthy · and note that the payer is by construction the component least able to
complain, which is why nobody reports it.
THE FIX FOLLOWS FROM THAT: reduce demand rather than arbitrate the remainder. 133px came off by
dropping a word and a progress bar that were each a second rendering of information already on
screen, and the deficit stopped existing. Fighting over who gets the 292 would have moved the
casualty, not removed it.
COROLLARY on the Rule 78 probe, which produced a false negative this session: "the topmost element
at the centre has my testid" fails for any control with children · the bonus chip's own row of
colour dots sits under its centre at four tokens and nowhere else, so one button read as reachable
at 1 and 2 and unreachable at 4. The check is `el === top || el.contains(top)`.
Sharpens Rule 81 (a number you reasoned to is a claim) with its sibling: a number you MEASURED is
still only an answer to the question you asked.

RULE 82 (T3 S37 · August 9 2026):
A PROBE THAT ANSWERS INSTANTLY HAS NOT ANSWERED A QUESTION ABOUT WAITING · AND THE SPEED IS THE TELL.
Instrumenting a lobby-loop timeout I reached for `locator.isVisible({ timeout: 25_000 })`. isVisible() is a
POINT-IN-TIME check and ignores the timeout option entirely, so the guard fired microseconds after the click,
reported "the joiner never reached the waiting room", and was measuring nothing but its own impatience ·
while looking exactly like the product failure it had been built to diagnose. Use expect(locator)
.toBeVisible({ timeout }), which retries. Generalised: when a probe returns much faster than the thing it
claims to have waited for, that gap IS the finding · compare the probe's own wall-clock against the timeout
it says it honoured and disbelieve any probe that beat it. Descendant of Rule 75b (a probe is a claim),
sharpened with the dimension that a probe can lie by being FAST rather than by returning a plausible number.
COROLLARY, and the more expensive half: three separate runs this session looked like three different product
bugs · a winner who was never credited, a lobby that would not join, a room code that never rendered · and
ALL THREE WERE ENVIRONMENT. Two were another lane hot-reloading components into the dev server I was driving
(the S35 hazard, again); one was React's DEVELOPMENT double-invoke killing an async retry loop whose effect
burns its one-shot latch before the loop and cancels it in cleanup. The instrument that settled every one was
the same: CHANGE EXACTLY ONE THING, ON THE SAME COMMIT, IN A TREE NOBODY ELSE CAN TOUCH · `git worktree add
--detach <path> <sha>` with symlinked node_modules and its own port. Rule 74 already says a control needs the
same commit; S35 said use a worktree for live measurement. They are one habit, and the cost of not having it
is filing your own environment as a product defect · which this project has now nearly done four sessions
running. Pairs with Rule 57 and Rule 77.

RULE 77 (T1 S35 · August 9 2026):
A test suite run on a loaded machine is a measurement of the machine. Boot reported 3 red, then 6 red
with a DIFFERENT set including one of my own · the give-away being that the sets disagreed. Load
average was 19 on 8 cores. Serial (--no-file-parallelism) it was 450/450. Before routing a red to a
lane, check `uptime`: wall-clock-bounded tests lose under contention and the failure moves around,
which is the signature. Pairs with Rule 33 (unit tests and live E2E never concurrently).
