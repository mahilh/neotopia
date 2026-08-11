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
  ✅ CARD ART: 56/56 (T2 S42 · 3cf9620) · Mahil completed the deck; scripts/sync-card-art.cjs maps Drive's
     unpadded cardN.png to the deck's card_NN and reports GAPS/COLLISIONS/STRAYS before copying. Masters
     are ~1.4MB, the shipped contract is 320x320/~142KB, so they are downscaled: avg 136KB, 7.4MB total
     rather than 78MB in a public repo. The pipeline reproduces the 20 previously-shipped PNGs
     BYTE-FOR-BYTE from the masters, which is what validates the settings. GATED by src/lib/cardArt.test.js
     (every id resolves · ids two-digit padded · nothing over 400KB) because a missing PNG does not error,
     it renders the shimmer and looks deliberate · the same invisibility that let this read 0/56 for ~15
     sessions. T3 S42 (a572fd4) gates the render half in a browser.
  ✅ DRAW RPC AUDIT ROW: APPLIED (T2 S42 · migration 021) · one game_events row inside the RPC's existing
     FOR UPDATE txn, carrying seat/source/card/post-draw counts and via='draw_card_for_seat'. Closes the
     S40 ambiguity: a value in game_sessions.state cannot distinguish never-attempted from
     attempted-and-refused from attempted-written-and-overwritten. Live proof tests/e2e/draw-rpc-audit.mjs
     12/12 · refusals write ZERO rows (counterweight first) · and the row SURVIVES a clobber, which is the
     property that closes the open hypothesis. No concurrency regression: 16/16 distinct, 0 lost.
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
     🔴 THE SIGN INVERTED · MEASURED (T2 S46 · 9b3040d · docs/BONUS_TOKEN_BALANCE.md). A SPENDABLE
     token is worth about +7.7 points of win rate TO THE PLAYER WHO SPENDS IT · identical policies,
     one seat cashes subsidy on sight. 7 disjoint blocks, 560 games, ALL SEVEN above 50 (25-seed:
     59.6/58.0/60.0/51.0 · 60-seed: 54.2/58.1/63.0), control exactly 50.0 in 7/7 and both-spend
     symmetric in 7/7. So an UNSPENT token is noise that helps the underdog; a SPENDABLE one is a
     decision that rewards skill, and it is ~2.5x larger. Inside the 10-point tripwire (mean +7.7) so
     no stop-work · but blocks reach +13 and it is the largest single-decision term measured here.
     The S39 control was EXACT; this one is paired-seed STATISTICAL, because a bot that spends makes
     different games. That loss is permanent and is a property of the feature no longer being inert.
     Scope: subsidy only · the one type a human can spend today.
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
    ⚠ THAT LAST SENTENCE IS TRUE OF **THIS** SPEC AND STOPPED BEING TRUE OF THE PROJECT IN S45 (corrected
    T3 S51). A DIFFERENT spec closed it · tests/e2e/endgame-live.e2e.js, 3362f77 · which plays the ending
    with real clicks and witnessed the TRIGGER firing live, in the same run, before the terminal state:
        trigger  · tiles 0 · rounds 2 · turn 17          (the intermediate only refillFactoryDraft makes)
        ending   · column_phase 'finished' · state_turn 21 · state_seat 0 · both clients agreeing
        peer     · writeorder { overtakes: [], version: 0 } · the predicate refused nothing
    It was read as unproven for six sessions because the entry above says "has never run" and nothing
    contradicted it · the correcting spec was invisible (see below), so the stale claim had no opponent.
  ⚠ AND THE CORRECTION HAS NO RUNNER, WHICH IS THE PART THAT MATTERS. endgame-live.e2e.js is in NO
    WORKFLOW · it has never been in one · so nothing re-establishes the paragraph above and it will rot
    exactly the way the sentence it corrects did (Rule 79 · a spec that runs nowhere cannot report its own
    rot; Rule 97 · a citation outlives the thing it cites). It reads as wired to a substring search because
    its name is a SUFFIX of multiplayer-endgame-live.e2e.js · that is Rule 112 and it is why this was not
    noticed. The file carries a RUNS-NOWHERE: declaration so the merge gate stays green meanwhile.
    STATE THIS AS: proven once, on 3362f77, and gated by nothing. Not "proven" and not "never run".
    TO MAKE IT CHECKABLE, one line in .github/workflows/e2e.yml (T2's lane · routed S50 and S51,
    comms/t3-s50-endgame-live-wiring.md): add tests/e2e/endgame-live.e2e.js to the existing
    --grep "ENGINE" invocation. Costs +63ms and ZERO extra sign-ins · measured at HEAD, 10/10 deals armed.

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

DB CONTRACT (scripts/migrations/ · 001-025 · NOT 001-010, which is what this line said until T3 S49):
  game_sessions.phase: CHECK IN (playing|endgame|finished)
  record_civilization_score · chain 009 > 014 > 019 · SECURITY DEFINER · writes global_neotopia_index
  game_sessions.mode TEXT DEFAULT 'classic' (010)
  ⚠ A MIGRATION NUMBER HERE IS A CHAIN, NOT AN ADDRESS. 5 of 16 functions are redefined by a later
    migration and 3 of them twice · purge_e2e_test_data 006>008>014>023>024>025, draw_card_for_seat 011>014>021,
    record_civilization_score 009>014>019, increment_neotopia_index 004>014, rl_client_ip 013>014.
    AND THE NEWEST FILE IS NOT NECESSARILY THE DEPLOYED BODY. Do NOT record applied-state in a comment:
    it changes with no commit, so it is stale the moment it is true · T3 wrote "023 unapplied" into five
    files in S49 and T2 applied it ninety minutes later. Comments carry the CHAIN (a repo fact, gated by
    preconditions.e2e.js); ask pg_get_functiondef for what is RUNNING (Rule 109a). Last measured S50:
    023 applied · 014, 024, 025 NOT. 024 is SUPERSEDED BY 025 and must not be applied · it carried
    only the room-age half, and the half that actually stops CI jobs orphaning each other's rooms is
    an age guard on the PROFILE delete (player_profiles HAS created_at · S49 never checked).

GAME MECHANICS:
  4-STEP PLACEMENT: factory→element-btn→region-btn→valid-hex (ALL force:true)
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster
  CLUSTER: 1pt per element token OF YOUR COLOR in the biggest cluster per region (rule p9 · CODED T2 S35)
  MODES: Classic (90s/12tiles) · Flow (15s/9tiles) · GAME_MODES single-source

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (113 · cumulative):
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

RULE 99 (T3 S43 · August 11 2026):
A DETECTOR IS ONLY AS GOOD AS ITS CLOCK, AND HALF A LAMPORT CLOCK IS BLIND TO THE CASE YOU BUILT IT FOR.
I shipped overtake detection for the lost End Turn with `__seq = (last OBSERVED) + 1`, which is the textbook
rule with one term missing. Two pushes in the same turn both read the same stale value from the store · the
server has echoed neither back yet · so both minted 1, and `serverSeq < sentSeq` was `1 < 1`, false. The
instrument was blind to the exact self-clobber it existed for, and the run said `[1, 1]` on the first
execution. The correct form carries BOTH terms, `max(lastObserved, lastSent) + 1`: the observed term makes it
session-global across clients, the sent term makes this client's own writes strictly ordered. Drop either and
it fails in opposite directions · observed-only goes blind, sent-only cries overtake every time the opponent
legitimately moves, which is worse than no detector at all (Rule 88c).
  99a · A DETECTOR MUST BE MUTATION-PROVEN IN BOTH DIRECTIONS, because the two failures look identical from
        a green run: it must go red when the defect happens, AND stay silent when normal play happens. The
        counterweight here is the NEGATIVE and it was written first · a peer's later write, and a write
        arriving before this client has sent anything, must both report nothing.
  99b · WIRE THE DETECTOR INTO ONE FUNNEL, not into the path you were thinking about. Three call sites fed
        syncFromServer (realtime, REST re-seed, rollback); a detector on the realtime path alone would report
        a clean room while a write vanished through another (Rule 84).
  99c · AND THE HARNESS HID IT ONCE ALREADY: my test simulated the server push by calling the STORE action
        directly, bypassing the hook wrapper where the detector lives, and reported 0 overtakes on the run
        that had just clobbered a write. It delivers through the real postgres_changes callback now (Rule 36).
COROLLARY, and it is the reason this landed clean rather than as a second contract: POST THE SHAPE BEFORE YOU
BUILD IT. T2 is building the server-side version predicate this session. I wrote the counter's shape to comms
first, corrected that note the moment the test falsified my formula, and said plainly that if they prefer a
column I will drop the jsonb field and read theirs. Rule 94 says de-duplicating a check removes a second
contract and a second witness · this is that lesson applied BEFORE the duplication exists, which costs one
file and saves the argument entirely.
SECOND COROLLARY, paid for in one anon sign-in: A MOCK IS A MODEL, SO MEASURE THE SEMANTIC IT ASSERTS ONCE
AGAINST THE REAL SYSTEM. My write-race proof rested on an inherited mock I had REASONED matched Postgres.
Measured: write B then A, and the row holds A · no version check, no merge, the counter goes backwards on the
server. The claim two lanes are now building on is a measurement now, not a belief.

RULE 108 (T3 S47 · August 11 2026):
A CLOSING RECOMMENDATION IS A CLAIM, AND IT IS THE ONE NOBODY CHECKS · IT ARRIVES AS THE NEXT SESSION'S
PRIORITY. I ended S46 recommending a free reproducer: "route-delay Supabase requests on the practice board
and the live driver flakiness becomes reproducible for zero identities." It cannot work, and a SEVEN-SECOND
probe says why · the practice board makes ZERO Supabase requests, during load and during play, because
running without a backend is the entire point of the mode. There is nothing to delay. I recommended it from
the SHAPE of the problem without opening the page I proposed to run it on, which is Rule 105 exactly, one
session after I wrote Rule 105, about my own next step rather than someone else's code.
  108a · A recommendation is worse than a rule for this, not better. A rule at least sits in a file people
        re-read; a recommendation is consumed once, converted into a brief, and executed by someone who
        reasonably assumes the person proposing it had checked. The forge did precisely that with my S45
        purge hypothesis and sent me to fix a non-bug.
  108b · THE CHECK IS ALWAYS CHEAPER THAN THE RECOMMENDATION. Seven seconds here; one `sed` on migration
        006 last session. Before proposing work, run the smallest probe that could falsify its premise ·
        and if that probe is not obvious, that is itself the finding.
  108c · When it dies, RECORD WHAT IS AND IS NOT POSSIBLE where the work would have started (driver.js
        here), not only in a handoff. And name the tempting wrong fix · a stubbed backend with injected
        latency would make practice "reproduce" live failures and would be a model rather than a mirror
        (Rule 36), which is how three sessions of product bugs turned out to be environment.
COROLLARY, AND IT IS THE SESSION'S ACTUAL WIN: the soft-lock is CLOSED, and it took FOUR fixes across three
lanes · T1's End Turn unlock, T2's terminal condition, my restore refusal, and T2's bot-latch fix keyed on
turnNumber. Rule 103 said three correct halves can leave a bug open; four was exactly as untested until it
was run. Measured with the control, which is what makes it a claim: with the fix, scoring at turn 37 in 2
SECONDS; with turnNumber removed from the latch key, stuck at turn 36 / seat 1 / rounds 1 for 122s · the
S45 signature reproduced exactly. THE GATE ASSERTS THE MECHANISM, NOT THE OUTCOME: `phase === scoring`
alone would pass on a build where the bot seat was skipped entirely, so it requires the bot to have HELD at
least two turns and given each up, and the human to have clicked no more than its own two. One test,
mutation-proven against all three lanes.

RULE 112 (T3 S50 · August 11 2026):
A SUBSTRING MATCH IS AN IDENTITY CHECK WITH NO BOUNDARY, AND AN INSTRUMENT BUILT ON ONE WILL EVENTUALLY
HIDE THE EXACT CASE IT EXISTS TO FIND. The spec-runner audit · the gate whose whole purpose is finding
tests that run nowhere · asked `workflowText.includes('endgame-live.e2e.js')`. That string is a SUFFIX OF
`multiplayer-endgame-live.e2e.js`, which is wired twice. So a 653-line spec that plays a real multiplayer
room to its own ending, the composition CLAUDE.md names as the honest remaining gap, sat in NO WORKFLOW
from S39 to S50 while the gate reported it wired every single run. THE ORPHAN DETECTOR WAS HIDING AN
ORPHAN FROM ITSELF. Three holes in one 12-line gate, all the same defect in different costumes: prose
about the RUNS-NOWHERE marker excused a file, a spec named only in a `#` comment read as wired, and a
filename rode on its neighbour. Ask of any check that uses `includes`/`grep -q`/`in`: could the thing it
matches be CONTAINED IN something that is not it · a longer name, a comment about it, a doc describing it?
  112a · AGE IS NOT EVIDENCE. IT IS THE ABSENCE OF EVIDENCE, ACCUMULATING. Six sessions of green was the
        whole reason nobody looked, and rereading the gate would not have found any of the three · I had
        reread it in S49 and found only the one I already suspected. What found them was MUTATING it:
        deleting the neighbour's two run lines reddened with TWO names when I had touched one. My own
        closing critique in S49 was "my instruments have been earning trust from age rather than from
        being exercised", and the cost of testing that was twenty minutes. Rule 96 says an instrument
        earns trust from RANGE and Rule 100 from BREADTH; this is the third and the cheapest · it earns
        trust from being MADE TO FAIL, and a gate that has never gone red has not been tested, it has
        merely been present.
  112b · WHEN THE FIX REMOVES THE CORPUS THAT DOCUMENTED THE DEFECT, PIN IT AS A FIXTURE OR THE PROOF
        EVAPORATES. Declaring the orphan made the real repo clean, so reverting the boundary fix now
        leaves the live gate GREEN at 19-wired · measured, not predicted (mutation M6). The only witness
        left is a synthetic corpus holding the exact collision. Rule 101 says a fix turns the tests that
        documented a defect into false claims; this is its sharper sibling · a fix can turn the REAL WORLD
        into an environment where the defect is no longer reproducible, and then the fixture is not
        belt-and-braces, it is the entire proof.
COROLLARY, caught in my own mutation harness before it ran and worth more than the rule: the script
restored the file under test with `git checkout --`, and THAT FILE'S FIX WAS UNCOMMITTED · one run would
have deleted the work it existed to prove. A mutation harness edits real files in place, so its restore
path must be a byte copy taken before the first mutation, never version control, whose idea of "restore"
is "discard everything you have not committed". Same family as Rule 89's tool-scans-itself: the harness
is inside the blast radius of the thing it is testing.

RULE 113 (T2 S50 · August 11 2026 · CLAIMED 112 FIRST · T3 took 112 the same night):
⚠ NUMBERING NOTE, kept rather than tidied away because it is the second time this has happened and
the alias is the useful artifact (T1 S43 did exactly this and wrote Rule 100 about it). I inserted
this as 112 and the insert revealed T3's Rule 112 already in the file · they committed it into the
SHARED WORKING TREE mid-session (ce07fed and its siblings landed under me while I worked, which is
Rule 66's shared-tree hazard applied to CLAUDE.md rather than to code). I renumbered MINE because I
am the one who noticed. Nothing of theirs was overwritten; both rules are intact. If a commit
message of mine cites "Rule 112", it means this one.

A THRESHOLD ENCODES A POSITIONAL ASSUMPTION ABOUT WHERE THE SUBJECT SITS RELATIVE TO THE INSTRUMENT ·
AND DERIVING THAT THRESHOLD FROM A CONTROL MEASURED IN THE SAME RUN DOES NOT REMOVE IT.
Retuning the bot ladder so its rungs are 33 points apart instead of 6 reddened FOUR separate files,
and every one failed for the identical reason nobody had ever written down: that the ladder STRADDLES
the frozen reference policy. It did (5.1 / 77.2 / 98.8) and now does not (60.0 / 66.7 / 84.8), because
rungs pulled close to each other are necessarily close to any third party too · calibrating the ladder
compressed its span against the yardstick from 94 points to 25. Nothing regressed. An assumption that
was true expired.
  112a · THIS IS RULE 111 ONE LEVEL DEEPER AND IT IS THE HARDER HALF. 111 says a constant at every call
        site is a hidden parameter, and the tell is mechanical: grep the call sites, look at which
        argument never varies. A positional assumption has NO call site to grep. It lives inside
        comparisons that mention only one side · `apprentice.winPct < 40`, `architect.winPct > 80`,
        `earnGap < 0` · and the other side of the claim is a fact about the world that nobody typed.
  112b · AND MY OWN S49 FIX WAS NOT ENOUGH, WHICH IS THE POINT WORTH KEEPING. In S49 I replaced two
        remembered numbers with `ctrl - 10` and `ctrl + 10`, derived from a control measured in the
        same run, and logged it as the lesson. It removed the STALE-NUMBER failure and left the
        STRUCTURAL one untouched: `ctrl - 10` still asserts the subject sits below the yardstick. It
        went red on working code exactly as the original would have, while reading as "measured,
        therefore safe" · which is worse, because it had already been improved once.
        THE FORM THAT SURVIVES IS AN ORDERING AMONG THINGS THAT MOVE TOGETHER. `architect > builder`
        needs no threshold, carries no claim about absolute position, and follows the ladder when the
        ladder legitimately shifts. Where an ordering genuinely cannot be asserted, say so and gate
        less: under v2 the reference can no longer separate apprentice from builder at ANY block these
        gates can afford (inverted at 10 seeds on win rate, and at 40 seeds on a different offset), so
        only architect-above-both is asserted. Assert what the instrument can see (Rule 88c).
  112c · A REPORTER THAT APPENDS AS IT GOES WILL HAND YOU GOOD DATA OUT OF A RED RUN. My first 40-seed
        sweep printed a complete, correct, internally-consistent table AND `Tests 4 failed (4)`. Every
        row was a finished measurement; the tests died afterwards on a missing timeout. I read the
        table and acted on it without registering the verdict, because the output looked exactly like
        success. Rule 110b says read the BASELINE before trusting a mutation; this is the step before
        that one · READ THE VERDICT BEFORE TRUSTING THE OUTPUT. They are different artifacts and only
        one of them is an answer.
COROLLARY, and it is the cheapest habit here: when a change reddens more than one file, do not fix
them one at a time. Ask what single unstated fact all of them were relying on · four files failing
four different ways is bad luck, four files failing the same way is a premise nobody wrote down, and
it is almost always more interesting than the change that exposed it.

RULE 111 (T2 S49 · August 11 2026):
A CONSTANT THAT APPEARS AT EVERY CALL SITE OF AN EXPERIMENT IS A HIDDEN PARAMETER, AND ITS VALUE
SILENTLY QUALIFIES EVERY RESULT. Because it never varies, it never looks like a choice.
Five sessions measured "the ladder". Every duel in the repository · S39's, S46's, S47's, S48's ·
passed REFERENCE_POLICY as the opponent:
    duel(REFERENCE_POLICY, level)  ·  duel(level, REFERENCE_POLICY, ...)  ·  ladderRow(level, REFERENCE_POLICY)
NOTHING HAD EVER PLAYED APPRENTICE AGAINST BUILDER. The function signatures took two arbitrary
policies the whole time; one argument was simply always the same, so it read as part of the harness
rather than as a variable, and every finding was really "X against one middling opponent".
  111a · THE COST WAS NOT THE MISSING ROW, IT WAS WHAT I BUILT ON IT. In S48 I read apprentice ~5%
        and architect ~99% as SATURATION and designed around that reading · chose the score margin as
        the reported statistic because a rate near a bound cannot move, sized gates on it, and wrote
        "both ends are pinned" into three documents including the roadmap Mahil reads. Measured
        against ITSELF the ladder is worse, not better: 6.3% adjacent, 15.2% adjacent, and 0.0% across
        80 games end to end. The conclusion survived; it survived by luck, and it could as easily have
        been an artifact of an opponent nobody had named.
  111b · THIS IS MY OWN RULE 106 AIMED ONE LEVEL LOWER. 106 says a measurement between equals cannot
        answer a question about a ladder · ask WHO the comparison was against. I asked that of the
        bonus token, the subject, and never of the INSTRUMENT doing the comparing. Apply your rules to
        your tools, not only to your findings; the tool is where an unexamined assumption survives
        longest, because it is re-used rather than re-derived.
  111c · THE TELL IS CHEAP AND MECHANICAL: grep the call sites of your own experiment and look at
        which argument never changes. It took one grep and ten seconds, and it should be the first
        thing done to any harness that has produced more than one session's findings.
COROLLARY, and it is P4 of the same session: WHEN A GUARANTEE CAN BE MADE STRUCTURAL, ASSERT THE
IDENTITY, NOT A TOLERANCE. S48's flat-arm evenness was gated as `|flatGap| <= 0.15` · a rate, i.e. an
absolute imbalance divided by a game count, so the bound means different things at different block
sizes and needs re-tuning whenever the seed count moves. T3 duly found it red at a smaller block while
my own run was green. The fix was not a wider bound: flatDeal's remainder is self-correcting, so the
WHOLE-BLOCK imbalance is at most ONE TOKEN by construction and `<= 1` means the same thing at 12 seeds
as at 4000. Same move for a threshold: gate the ORDER against a control measured in the same run
(apprentice < control < architect) rather than against a number somebody once observed. A wire sized
from the run it guards is a flake with a delay on it (Rule 81's better half, Rule 88c's sibling).

RULE 110 (T2 S48 · August 11 2026):
COUNTERWEIGHT-FIRST PROTECTS YOU FROM THE FAILURES YOU CAN IMAGINE. ASSERT THE THING'S DEFINING
PROPERTY, WHICH IS THE ONE YOU NEVER THINK TO NAME BECAUSE IT IS TRUE BY CONSTRUCTION · UNTIL IT ISN'T.
The flat-grant experiment scores one game twice: tokens as EARNED against tokens dealt FLAT. I wrote
three counterweights first, exactly as Rule 90 says · the redistribution must move tokens, tokens must
be granted at all, the volume must be preserved · and every one of them passed while THE FLAT ARM WAS
NOT FLAT. It handed logical player A the odd token in every single game, worth a silent +1.5 points per
game to whichever side was under test. I never wrote "the flat arm must be even" because that is what
`flatDeal` MEANS, and a definition does not feel like a claim. It is the only claim in the file.
  110a · AND THE BIAS WAS THE FIX. The first draft dealt the extra token to seat 0 always; I "improved"
        it with a parity that alternated once per game so it would not always land on the same seat.
        The duel flips its orientation once per game too, so the two alternations LOCKED IN PHASE and
        the alternation became the bias it was added to prevent. A RANDOMISATION OR ALTERNATION SCHEME
        THAT SHARES A PERIOD WITH THE THING IT IS MEANT TO BALANCE AGAINST BALANCES NOTHING · and it
        looks more careful than the naive version it replaced. Measure the residual; never argue it.
        (Rule 92a's two-sides-one-source, in the time domain.)
  110b · A TEETH CHECK ON A RED BASELINE PROVES NOTHING, and I nearly logged one: four mutations all
        went "red" in a run whose UNMUTATED baseline was already failing, so the reds were free and
        meant nothing. Rule 100 says read the mutated run's test COUNT, not its colour · this is the
        step before it. READ THE BASELINE FIRST. It also exposed the real defect: the bound was sized
        at 40 seeds and the harness takes an env override, so it was correct at the block size I chose
        and wrong at the one I debugged with.
  110c · FIX THE INSTRUMENT, DO NOT WIDEN THE TOLERANCE THAT CAUGHT IT. The tempting patch was to
        loosen the bound until 12 seeds passed. Instead the remainder became self-correcting (the odd
        token goes to whichever side has had fewer), which bounds the whole-block imbalance at ONE
        token at ANY seed count · so the wire now means the same thing at 12 as at 400. A tolerance
        widened to accommodate a defect is a defect with permission.
COROLLARY, and it is the same shape one layer out, in production rather than in a harness: I recorded
in the S47 roadmap that games_played/games_won "never move · the ledger moves and the denormalised
columns don't". THE WRITE LANDS. award_game_win returns 'awarded' only on a non-zero row_count, a live
run logged exactly that, and then globalTeardown's purge deleted the profile row holding the increment.
So the counters are 0 not because nothing wrote them but because EVERY WITNESS WAS DESTROYED. That path
has a writer, a caller, a reader and a status string distinguishing success from a zero-row write · and
no OBSERVER. Not a writer with no caller (award_game_win, S35), not a render with no gate (card art,
S42): A CALLER WITH NO OBSERVABLE, which is worse because every individual piece is correct and tested.
Ask of any counter you believe is broken: is the write failing, or is the evidence being deleted?

RULE 109 (T3 S48 · August 11 2026):
A FUNCTION'S DEFINITION IS THE LAST MIGRATION THAT TOUCHED IT, NOT THE ONE YOU WERE POINTED AT · AND A
RETRACTION IS A CLAIM THAT ARRIVES WEARING THE COSTUME OF RIGOUR, SO NOBODY AUDITS IT.
In S45 I warned that CI's purge deletes live rooms of any status. In S46 I "corrected" myself by reading
migration 006, finding `where r.status = 'finished'`, and retracting · into CLAUDE.md, a spec header, a
teardown citation and a comms note, loudly, citing Rule 105c about retracting in every place you claimed.
`create or replace` means MIGRATIONS ARE A LOG, NOT A STATE. Two files later, `008_purge_waiting_rooms.sql`
replaced that body and deleted the status filter · its own title is "extend purge_e2e_test_data() to
bot-hosted rooms of ANY status". The live function has no status predicate at all. S45 was right, and the
correction was the fabrication.
  109a · VERIFY AGAINST THE SYSTEM OF RECORD, NOT AGAINST A FILE THAT DESCRIBES IT. One read settles it and
        it is not `sed`: `pg_get_functiondef(oid)` on the deployed function. Rule 68 says a migration in git
        is not a deployed schema; this is its mirror image and the more seductive one, because here the file
        DID once describe reality and had simply been superseded. `ls scripts/migrations/` would also have
        done it · the superseding file had the word `purge` in its NAME.
  109b · A RETRACTION IS NOT SELF-VERIFYING. Admitting error feels like the rigorous move, so it is granted
        the trust that the original claim had to earn · by me writing it and by everyone reading it. I gave
        my retraction no counterweight whatsoever, having demanded one of every claim I make for ten
        sessions. Hold a correction to the standard of the thing it corrects, or higher: it is louder, it
        closes a question rather than opening one, and it is quoted as settled (105a, now proven on 105).
  109c · AND THE DISPROOF WAS IN MY OWN CONSOLE OUTPUT THE WHOLE TIME. Every live run prints
        `[teardown] purge_e2e_test_data → {"rooms_deleted":0,"profiles_deleted":0,"unfinished_rooms_deleted":0}`
        · and `unfinished_rooms_deleted` IS NOT A KEY MIGRATION 006 RETURNS. Its return has two fields. I
        had been reading a line that names the superseding migration, in every run, for three sessions.
        When you believe a component is X, check the output it is ALREADY producing against X's contract
        before opening anything · the cheapest premise check is usually the one already on your screen.
COROLLARY, on the cost asymmetry that makes this worth a rule: a wrong claim costs the person who acts on
it. A wrong RETRACTION costs the person who STOPS acting · T2 was told "no purge change is needed and I am
explicitly not asking you to make one", so a real hazard was closed by my own hand, in their lane, with an
apology attached. The bug and the fix both went silent. (Rule 108's shape, one level up: a recommendation
nobody checks · and "there is nothing here" is a recommendation.)

RULE 105 (T3 S46 · August 11 2026 · ⚠ ITS WORKED EXAMPLE IS INVERTED · SEE RULE 109, T3 S48):
A RULE IS THE WORST PLACE TO PUT A HYPOTHESIS, BECAUSE NOTHING EVER RE-DERIVES IT. THE HEADLINE STANDS AND
THE EXAMPLE UNDER IT DOES NOT · what follows in italics is what this rule said in S46 and it is FALSE. The
S45 claim it "corrected" was right all along, and the correction was the thing invented to fit a reading.
Measured live in S48 (Rule 109): purge_e2e_test_data has NO status filter, so a 'playing' room IS reachable
by it. Kept rather than deleted because the retraction is the more instructive artifact.
  ~~"the mechanism is simply wrong: purge_e2e_test_data deletes rooms `where status = 'finished'` and
    nothing else ... an in-progress room is 'playing' and was never reachable by it."~~  FALSE · S48.
  (One clause of it survived and was verified again in S48: NOTHING has a foreign key to player_profiles,
   so the unconditional profile delete does cascade nowhere. game_sessions FKs game_ROOMS, not profiles.)
  105a · A test that is wrong goes red one day. A COMMENT that is wrong goes red never, and a RULE that is
        wrong is worse still · it is quoted, it compounds, and every later session treats it as settled.
        Rules earn their place from things MEASURED, not from things that explained a measurement.
        STILL TRUE, and S48 is the proof: this wrong rule was quoted into a spec header, a teardown
        citation and a comms note, and none of them could go red.
  105b · ⚠ THE TELL I CLAIMED TO HAVE TAKEN WAS THE ERROR ITSELF. S46 said "I never opened the function I
        was accusing · one `sed` on migration 006 would have shown it". I then DID that sed, and it is what
        made me wrong: migration 008 (`008_purge_waiting_rooms.sql`) replaced 006's body and dropped the
        status filter. Reading the numbered file I was pointed at is not reading the function. See 109.
  105c · Retract in the same places you claimed. The wrong version was in CLAUDE.md, in a spec header and
        in a comms note; all three are corrected, and the corrections say what the old text said, so a
        reader who half-remembers the old claim meets the reason it changed rather than a silent edit.
COROLLARY, THE SAME DISCIPLINE ON A CLAIM I WANTED TO BE TRUE: I fixed two genuine driver defects tonight
(isVisible ignoring its timeout · Rule 82, and clicks swallowed into `.catch(() => {})` · Rule 93, both in
the file that documents those rules) and set out to show they made the driver deterministic. Under 20x CPU
throttling the first numbers were 33% broken, 86% control, 100% fixed · a clean-looking differential. THREE
MORE RUNS OF EACH KILLED IT: fixed 100/100/100 and control 100/100/100. The instrument does not reliably
reproduce the failure, so "the driver is now deterministic" is unearned and is not claimed anywhere. Ship
the fixes on their correctness, not on a differential that evaporates when you repeat it · and repeat it
BEFORE writing it down, because a single encouraging measurement is the cheapest thing in the world to get.

RULE 103 (T3 S45 · August 11 2026):
THREE LANES CAN EACH SHIP A CORRECT HALF AND LEAVE THE BUG OPEN · AND ONLY A TEST THAT DRIVES ALL THREE
IN ONE SCENARIO CAN SAY SO. The soft-lock had three fixes: T1 unlocked End Turn when nothing is legal, T2
made a deadlocked game trigger its endgame, I made restore refuse to reinstate a dead board. Every half was
proven alone, every half WORKS, and the game still never ends. Driving the real button in a browser:
    human End Turn (unlocked · data-unlocked-by="no-legal-move")  -> endGameTriggered true, rounds 2
    rounds burn to 1                                              -> seat 1, turn 36 · THE BOT
    then nothing for 162 SECONDS · past TURN_TIME_LIMIT, so permanent rather than slow
endGameTriggered is NECESSARY BUT NOT SUFFICIENT: the two-round burn is driven by seats ENDING THEIR TURNS
and a deadlocked BOT cannot pass. T1's escape is a button and no bot presses a button; the human cannot
help because it is not their turn and their control is correctly disabled. Each lane tested its own half
against its own model and every model was right.
  103a · THE COMPOSITION TEST BELONGS TO WHOEVER CAN DRIVE THE REAL CONTROL, not to whoever owns the most
        code in it. A unit test of T1's condition and a unit test of T2's condition cannot compose; a
        browser can. Mutation-proving it against BOTH lanes (revert either half, watch it red) is what
        makes it a shared gate rather than a third opinion.
  103b · CARRY IT AS FIXME, NEVER AS A RED GATE, when the remaining defect is in someone else's code.
        Reddening the merge gate for everyone is a tripwire aimed at colleagues.
  103c · MEASURE PAST THE TIMEOUT BEFORE SAYING "PERMANENT". I stopped at 81s first, which is inside the
        90s turn limit and would have been an entirely different (and wrong) claim (Rule 87).
COROLLARY · MY COUNTERWEIGHT CAUGHT ME, WHICH IS THE ONLY REASON TO WRITE IT FIRST. It summed
getValidPlacements across every factory and region and expected 0 on a board where every factory is EMPTY ·
it measured SIX. That function answers "which hexes are geometrically legal for this pair" and never looks
at whether the factory holds anything; T2's anyPlacementPossible tests elements.some(count > 0) FIRST and I
had silently dropped that term. Asserting on it would have put a second, wrong rules engine inside the
guard written to stop exactly that (Rule 45). A counterweight is not paperwork: it is the assertion most
likely to be measuring the wrong quantity, because it is the one you write while thinking about something
else.
SECOND COROLLARY · ⚠ CORRECTED S46 AND RE-INSTATED S48 · THE ORIGINAL S45 TEXT WAS RIGHT.
YOUR OWN PUSH CAN DESTROY YOUR OWN LIVE RUN. purge_e2e_test_data sweeps E2E/bot-hosted rooms of ANY
STATUS, so the workflow your commit triggered deletes the room your local run is playing in.
MEASURED AGAINST THE LIVE DATABASE (T3 S48 · pg_get_functiondef on the deployed function, not a file):
    the deployed body has NO `status` predicate · it deletes game_rooms WHERE host_id IN
      (select user_id from player_profiles where username like 'E2E%'/'BotAlpha%'/'BotBeta%')
    game_sessions FKs game_rooms ON DELETE CASCADE · so a deleted 'playing' room takes its session row
      with it, which is EXACTLY the S45 symptom ("NO ROW for room_id ..." while two browsers played)
    MIGRATION-HISTORY · migration 008 is titled "extend purge_e2e_test_data() to bot-hosted rooms of ANY
      status" and says in terms: "WHAT CHANGES vs 006: remove `and r.status = 'finished'`" (T2 S12,
      applied to remote · the chain has since grown 014 and 023, both committed and UNAPPLIED)
    live-run identities are E2E%-prefixed by uniqueName(), so they are inside the scope, not outside it
S46 RETRACTED THIS ON THE STRENGTH OF MIGRATION 006 AND WAS WRONG · 006 is the FIRST definition, not the
current one. The symptom, the mechanism and the original warning all stand.
STILL TRUE FROM THE S46 RE-READ, and re-verified in S48: nothing has a foreign key to player_profiles, so
the unconditional profile delete cascades nowhere; the app marks a room 'finished' only when the HOST
LEAVES (useGameRoom.js:614) · which makes this WORSE rather than better, because a live room is 'playing'
and 'playing' is precisely what the purge takes. And the narrow hazard is unchanged: the profile sweep has
no status or age filter at all.
WHAT WAS ALWAYS TRUE AND IS THE CHEAP DEFENCE: isolating the CODE in a worktree does not isolate the
DATABASE, live runs and CI share one Supabase project, and `gh run list` before a live run costs nothing.

RULE 101 (T3 S44 · August 11 2026):
A FIX'S BLAST RADIUS INCLUDES THE TESTS THAT DOCUMENTED THE DEFECT · THEY BECOME FALSE CLAIMS THE MOMENT
IT LANDS, AND THEY ARE THE FILES MOST LIKELY TO BE READ AS AUTHORITATIVE. Wiring T2's state_version
predicate turned TWO of my own green tests into assertions that were no longer true, and neither of them
failed for the reason that mattered · they failed because their mocks lacked `.lt()`, which is a detail.
The real breakage was semantic: `simultaneousdraw.test.js` asserted "the later snapshot CLOBBERS the
earlier · A2 is GONE", true when written in S17 and false since migration 022, sitting in the file any
future session would open first to learn about that hazard. A characterisation test is a citation (Rule
97), and a fix silently converts it into a lie · so the diff that lands a fix must include the tests that
described what it fixed. I found these only because they went red; a characterisation test whose mock
happened to be permissive would have stayed GREEN while asserting the opposite of reality.
  101a · The harness has to be re-checked too, not just the assertion. That file drove BOTH players through
        ONE hook instance, which was faithful while the row kept the last write. The version counter is
        per-client, so one instance mints 1 then 2 and the second write passes its own predicate · the
        stand-in would have gone on "proving" a clobber two real clients can no longer produce. A fix can
        invalidate the MODEL as well as the claim (Rule 36).
  101b · Keep the history, change the claim. Both files now open with what they used to assert and why it
        changed · the old number is the argument for the new one.
COROLLARY, AND IT IS THE HARDER HALF · UNKNOWN MUST NOT COLLAPSE INTO A PLAUSIBLE BOOLEAN WHEN THE WRONG
BOOLEAN IS DESTRUCTIVE. The practice-restore seam asks the engine "can this game still be played". There is
no engine answer yet, and `!!undefined` is `false` · which in that position DELETES A PLAYER'S SAVED GAME.
So it returns true / false / null, null meaning nobody asked, and the counterweight written first is the
UNKNOWN case rather than the missing one: mutation-proved by making it answer `false` and watching the test
red. Rule 80 says a counter that cannot measure must say so; this is the version where saying so wrong is
not a bad reading but data loss, and it is the reason I did not implement the resolvability check myself
even though it looked like twenty lines (Rule 45/94 · a second rules engine fails toward discarding live
games the instant it drifts).

RULE 100 (T1 S43 · August 11 2026 · WAS NUMBERED 98 · renumbered T1 S44):
CITED AS RULE 98 IN COMMITS 52f9aec AND e1d63d7 AND IN THE T1 S43 HANDOFF · T2 S43 independently
took 98 the same night and neither of us saw the other's until the file had two. I renumbered MINE
because I am the one who noticed, and the alias is recorded rather than the old citations silently
going stale · which is T2's own Rule 97, applied to the collision it warned about.
A GUARD APPLIED TO ONE MEMBER OF A CLASS ROTS THE MOMENT THE CLASS GROWS · MAKE IT ENUMERATE.
In S41 I wrote a test that rebuilds `reachability` from its own source with the module scope stripped,
because a probe crossing into a page via page.evaluate arrives as TEXT and a free variable would throw
only in the browser it exists to drive. Correct, deliberate, and load-bearing. Then in S42 I added a
second page-bound function to the same file and did not extend it · and T3 found that seedPlayedBoard
could never have run in a page at all. The late-game reachability case READ AS COVERED and was
reachable only from jsdom, which is Rule 97's citation rot inside my own harness.
THE FIX IS THE SHAPE, NOT THE PATCH: the guard now takes a LIST of every page-bound export and a
counterweight that reds when a new export is added without being classified. It found a THIRD on its
first run · seedOneOfEach, broken the same way since S38. Two of the three functions that file offers
a page were broken, neither noticed, and the one with a guard was fine. That ratio is the argument.
  98a · The tell is a guard whose subject is a NAME rather than a SET. `expect(reachability...)` cannot
        notice a sibling; `it.each(PAGE_BOUND)` can, and the cost is one line.
  98b · And enumerate from the CODE where you can. The list is checked against the actual exports, so
        forgetting to add one is itself the red · a hand-maintained list is the same defect one level
        up (Rule 89's "a hand pass MISSED two symbols entirely", which is why the audit became a script).
COROLLARY, from the same session: the guard I did have caught nothing for two sessions because it was
never pointed at anything new. Rule 96's corollary said an instrument earns trust from RANGE; this is
the same thought about coverage · a guard earns trust from BREADTH, and both decay silently while
looking green.

RULE 96 (T1 S42 · August 11 2026):
THE HEADLINE NUMBER IS OFTEN NOT THE DECIDING ONE · MEASURE THE QUANTITY THE DECISION ACTUALLY RESTS ON.
Card art: every master is square, the slot is 1.30:1, so objectFit:cover DISCARDS 23.1% OF THE AREA on
every card in the deck. That number is correct, it is alarming, and I had already drafted the
recommendation it implies · regenerate 56 masters at 13:10, or grow the card. Before sending it I
measured the thing a player would actually notice: sampling all 20 PNGs in a canvas against each file's
own corner background, the discarded bands hold a MEDIAN OF 2.1% OF THE CARD'S INK · min 0.0, max 10.9 ·
against a kept-centre density of 25-64%, because the art is centre-composed. 23.1% of the area is 2.1%
of the picture. The correct action was a GATE, not a regeneration, and the two answers differ by about
a week of somebody's work.
  96a · THE TELL IS THAT THE NUMBER IS A PROXY. Area is a proxy for "how much of the picture is lost",
        the way lines-of-code is a proxy for complexity and win rate was a proxy for re-weighting in
        Rule 88. When the quantity you have is a stand-in for the quantity you care about, measure the
        real one before spending anything · it is usually one more probe, and here it was twenty minutes
        against a deck regeneration.
  96b · AND THEN GATE THE PREMISE, NOT THE CONCLUSION. "2.1% is fine" is only true while the masters are
        square and centre-composed, and 36 of 56 cards have no art yet. So the test asserts SQUARE, and
        states the crop by reading the slot out of the component rather than retyping it · a 16:9 master
        would lose 42% with nothing going red. A finding whose premise is unguarded expires silently.
COROLLARY, from the same session and the same shape: I found the second defect in my own shared probe by
USING it · it called a working card Hand unreachable because it could not tell BELOW THE FOLD from OFF
THE SCREEN. Both are "outside the window"; only one is a bug, and the difference is whether anything can
scroll it into view. Two sessions running, the defect in that instrument was found by pointing it at
something new rather than by rereading it. An instrument earns trust from range, not from review.

RULE 93 (T3 S40 · August 10 2026):
A SWALLOWED ERROR IS AN UNMEASURED FAILURE, AND `.catch(() => {})` IS WHERE HARNESSES GO TO LIE.
Three defects tonight, three costumes, one shape · in every case the code CAUGHT a failure, discarded it,
and carried on reporting a state it had never achieved:
  93a · `offer.click(...).catch(() => {})`. CardFrame carries the art shimmer, an infinite animation, so
        Playwright's stability wait never settles and the click TIMED OUT · then the harness waited 10s for
        a state change that no click had ever asked for. The wire proved it: `draw RPC calls []`. Not a
        refused draw, not a disabled card, NO CLICK AT ALL. With force:true the same line returns
        `200 /rest/v1/rpc/draw_card_for_seat`. The swallow had been there for two sessions.
  93b · the same `.catch` on the FACTORY click hid the tutorial overlay for a whole session. Eight live
        runs and sixteen identities produced a hypothesis (uiPhase) that reading two files falsified in
        minutes · and it was falsified in BOTH halves, which is what a story invented to fit a symptom
        looks like.
  93c · `2>/dev/null` on the migrations counter (Rule 80) is this rule one layer down. Same line of code
        means "handles an empty dir" and "hides a wrong path".
THE INSTRUMENT, and it costs one variable: never discard the error, RECORD it and report it as a distinct
outcome. `let clickError = null; ...catch(e => { clickError = e.message })` turned "the offer is inert" into
"the offer was never clicked", which are opposite findings with opposite owners.
AND THE HALF THAT GENERALISES BEYOND TESTS · when a symptom exhausts every cause you wrote down, do not
invent the next one. MEASURE ONE LAYER DOWN. drawStatus null, myTurn true, actions 3, card not disabled
ruled out all three documented causes; the network listener answered it in one run. The wire is a witness
that does not care what the DOM believes (Rule 39, applied to a click rather than a response).
COROLLARY, paid for twice tonight: verify the ENVIRONMENT before spending anything scarce. A live run died
on "Failed to fetch" because I started the worktree dev server with a bare `npx vite`, so Vite inherited
the shell's AetherMind Supabase URL · a dead host · while `with-project-env` had correctly fixed only the
TEST process. The test env and the BROWSER env are two different contracts and only the browser's matters.
A 2.9-second free pre-flight (does the served app resolve the right project, and can it reach it) now
answers that before any identity is spent. Sharpens Rule 82 with the dimension it was missing: isolate
first, yes · but also PROVE THE ISOLATED THING WORKS before you pay for a measurement inside it.

RULE 95 (T3 S41 · August 11 2026):
A DIAGNOSTIC IS CODE, SO IT ROTS AND LIES LIKE CODE · AND THE ONE YOU WRITE TO STOP FALSE ZEROES IS THE
ONE MOST LIKELY TO CONTAIN THEM. I built a three-way probe to settle why a live peer never saw its turn ·
is the channel subscribed, has the row moved, did this client fail to apply it · and shipped it reading
`window.supabase.getChannels()`. The app never puts its client on window, so it reported `channels: []`
for every run: not "nobody is listening" but "I did not look", printed in the shape of a finding. Its
second field looked the row up by a roomId guessed from location.pathname and reported `no row`. TWO
FALSE ZEROES INSIDE THE INSTRUMENT WRITTEN TO REMOVE FALSE ZEROES · Rule 80 nested inside a Rule 90 fix,
in the same session whose whole theme was that a swallowed failure is an unmeasured one. Corrected, the
same probe answered the question completely on the next run: the peer was in exact agreement with the
server and subscribed, so the defect was the HOST advancing past an End Turn that never persisted.
  95a · Take every value from the source the APP uses, never from a global you hope exists. Import the
        module; pass in the id the test already knows. A convenience read is a second contract (Rule 45).
  95b · Distinguish UNMEASURED from measured-zero IN THE OUTPUT STRING, not in your memory of it. "NONE
        SUBSCRIBED" and "NO ROW · UNMEASURED, not the game is missing" cost one ternary each and are the
        difference between a diagnosis and a plausible story.
  95c · A diagnostic earns belief the same way a test does · by being made to fail on purpose. The one
        instrument here I DID trust was the reachability self-test, because it drops a real overlay and
        requires 60 of 60 blocked before any all-clear counts.
COROLLARY, and it is the better half: THE FASTEST WAY TO KILL A DUPLICATE IS TO DELETE YOUR OWN. I wrote a
reachability probe from T1's published correction, mutation-proved it, and then deleted it when theirs
landed mid-session · Mahil had ruled one implementation and theirs additionally carried `measured` and
`requireInViewport`, the two halves mine was weaker on. Sunk work is not an argument. Keeping mine would
have bought a second witness that agrees today and diverges silently later (T1's Rule 94), and what I kept
instead was the part theirs genuinely lacked: the overlay self-test. Reconcile by SUBTRACTION, and keep
only the delta that is real.

RULE 94 (T1 S41 · August 11 2026):
DE-DUPLICATING A CHECK REMOVES A SECOND CONTRACT AND A SECOND WITNESS. ONLY ONE OF THOSE IS A WIN.
T3 and I had independently written the same Rule 78 reachability check, which is the second-contract
shape we have both criticised (Rule 45), and Mahil ruled one implementation. That ruling is right and
it has a cost nobody states when they say DRY: two wrong-in-different-ways copies still disagree, and
a disagreement is a signal. One shared copy that is wrong is wrong in both lanes AT ONCE, silently,
with both gates green · the failure becomes perfectly correlated at the exact moment it becomes
invisible. So the consolidated thing has to be defended harder than either copy ever was, not the
same amount. Concretely, what I did because of this and would not have bothered with for a private
helper: the vacuity counterweight written first (an unmatched selector returns ok:FALSE, because zero
blocked out of zero checked is the one bug that would green both lanes forever), a test that rebuilds
the function from its own source with the module scope stripped (it crosses into a page as TEXT, so a
free variable passes every test here and throws only in the browser it exists to drive), a test that
the options stay serialisable, and four mutations each redding exactly one assertion.
  94a · A FALSE POSITIVE IS NOT THE SAFE ERROR. I nearly shrugged at the ancestor defect on the
        grounds that over-reporting is conservative. It is not: three factory cells report an SVG
        <text> on top and are perfectly fine, because it sits inside the <g> that owns the handler.
        A gate that reports three failures on a working board gets read as noise and then switched
        off, and the day it is right nobody is listening (Rule 88c's failure mode arriving by a
        different road). Prove the false-positive case LIVE, not only in a unit test · one call with
        handlerGroups [] shows the probe condemning a board that works.
  94b · WHEN YOU HAVE RE-DERIVED SOMETHING FOUR TIMES, THE COUNT IS THE FINDING. I did not commit
        this in S38 when I committed its sibling, because it improves my velocity rather than the
        game. Then it was wrong on the fourth writing, and the correction lived only in a transcript.
Pairs with Rule 90's corollary (put the thrice-made mistake in the harness) and answers the question
it leaves open · what the harness owes you once more than one caller depends on it.

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

RULE 107 (T2 S47 · August 11 2026):
A LATCH KEYED ON A COMPOSITE OF STATE HAS BITTEN THIS PROJECT THREE TIMES, ALWAYS THE SAME WAY: THE
REAL STATE CHANGE WAS NOT IN THE COMPOSITE. useBotTurns.seatSignature is the single worst offender in
the codebase and it is not because anyone was careless · each key was correct for the case in front of
its author.
  S33 (T1) · every bot froze permanently the first time it scored a district, because scoring changes
             neither seat, actions nor phase. Fixed by adding hand.length and scoredCardIds.length.
  S46 (T2) · every bot froze permanently on a DEADLOCKED board, because a player who cannot act changes
             none of those five either · the seat cycles back, actions reset to 3, phase stays
             'playing', and it neither draws nor scores. Fixed by adding turnNumber.
THE PATTERN IS THAT EACH FIX ADDED THE COMPONENT THE LAST BUG NEEDED, which leaves the next one open by
construction. A de-duplication key built by enumerating "things I can think of that change" is a
running guess about what progress looks like, and it fails silently and permanently every time the
guess is short · the seat simply never moves again, with no error.
THE FIX THAT ENDS THE CLASS, rather than extending the list: key on a MONOTONE quantity that the domain
guarantees advances (a turn counter, a sequence number, a revision), and let the composite be an
optimisation on top. turnNumber is that here · it cannot be constant across a real turn boundary no
matter what else is or is not true, which is exactly the property enumeration can never provide.
Ask of any cache, memo, latch or change-detector: IS THERE A STATE IN WHICH THE SYSTEM HAS PROGRESSED
AND MY KEY HAS NOT? If yes, that state is where it will hang, and it will hang there permanently.

RULE 106 (T2 S47 · August 11 2026):
A MEASUREMENT BETWEEN EQUALS CANNOT ANSWER A QUESTION ABOUT A LADDER, AND THE TWO ANSWERS CAN BOTH BE
TRUE. S46 measured self-play · identical policies, one spends · and found the spender wins by +7.7,
which read as "spending rewards skill". S47 ran the actual ladder with BOTH sides spending and the
deltas were apprentice +1.2/0.0, builder -6.3/-1.8, architect 0.0/-3.8 · small and mostly negative,
the same direction S39 found for UNSPENT tokens. Neither number is wrong. Spending pays handsomely
against someone who does NOT spend, and washes out when everyone does · so +7.7 is an advantage over a
player who fails to use a feature, NOT a skill amplifier, and those two sentences license completely
different balance decisions. Before reporting an effect, ask WHO the comparison was against, and say
it in the same breath as the number.
  106a · AND THE EFFECT WAS SOMEWHERE ELSE ENTIRELY. Tokens are earned by crossing score thresholds,
         so EARNING is a function of scoring speed and already favours the leader: architect 6.3
         tokens/game against the reference's 1.3, apprentice 0.27 · a ~23x spread across the ladder,
         about 15 points of score for one end and 0.8 for the other, BEFORE any decision is taken.
         The win rate is structurally blind to it (99% and 5-12%, both pinned · Rule 88). Two sessions
         were spent measuring the spending mechanism, which turns out to be the fair half.
  106b · "THIS IS A FLOOR" IS A CLAIM. I said +7.7 was the value of the dumbest possible use and
         therefore a lower bound. Measured: a late-game plan is INDISTINGUISHABLE from spend-on-sight
         (exact 50.0 head to head) and a plan that spends less is worse than hoarding. It was close to
         the ceiling. A bound asserted from plausibility is a guess wearing an inequality.
COROLLARY, the third counterweight failure in three sessions and the cheapest yet: my timing heuristic
fired 0.01 times per game · `never` in disguise · so the comparison was hoarding against hoarding. The
guard asserted `spends > 0` and 0.01 passed. A RATE GUARD MUST BE SIZED AGAINST THE BASELINE IT IS
COMPARED TO, NEVER AGAINST ZERO: the fix was `> 0.25 x the on-sight rate`. Same family as Rule 88b.

RULE 104 (T2 S46 · August 11 2026):
A LATCH KEYED ON STATE CANNOT SEE A TURN IN WHICH NOTHING CHANGES · AND THAT IS EXACTLY THE TURN THAT
NEEDS IT. The soft-lock survived three correct fixes (T1's button, my terminal condition, T3's proof)
and died here. useBotTurns latches on seatSignature to stop React StrictMode double-invoking, and on a
deadlocked board EVERY component of that key is a constant: the seat cycles back to its old value,
actions reset to 3, the phase is still 'playing', and a player who cannot act neither draws nor scores.
So when the turn returned to a bot the key was byte-identical, the effect read it as a repeat, and the
seat froze forever · stalling the two-round endgame burn, which is driven by seats ENDING TURNS.
Adding turnNumber · the only component that always advances · costs the latch nothing, because within
a turn it is constant and the double-invoke protection is unchanged.
  104a · IT WAS NOT A LEGALITY BUG, and the forge was right that a fourth legality predicate would have
         been the wrong fix. chooseBotAction ALREADY returned endTurn with no options, and the driver
         ALREADY had a refusal safety net. The bot was never choosing wrongly · IT WAS NEVER BEING
         ASKED. When a component with correct logic does nothing, check whether it is being INVOKED
         before you check what it decides.
  104b · A DE-DUPLICATION KEY IS A CLAIM ABOUT WHAT PROGRESS LOOKS LIKE. Any cache, latch, memo or
         change-detector keyed on "did anything I track change" is blind precisely when the system is
         stuck, which is when you most need it to fire. Include the monotone quantity (a turn, a tick,
         a sequence) so the key can always distinguish "nothing happened" from "we are somewhere new".
COROLLARY on sizing a gate, which contradicted itself twice in one session and both were right: the
adversarial fuzz's terminate-check has EXACTLY ZERO variance (240 games, 24 blocks, 0 bad), because it
tests a DETERMINISTIC property · so extra seeds buy coverage, never precision. The spendable-token gate
is a RATE, and 25 vs 60 seeds moved nothing because per-game variance dominates · so precision there
costs an order of magnitude, not a factor of two. Same Rule 88c, opposite conclusions, and neither was
knowable without measuring. AND I WROTE THE 240-GAME CLAIM INTO THE FILE BEFORE RUNNING IT · caught it,
ran it, and it happened to be true. A measurement asserted from expectation is a guess with a number.

RULE 102 (T2 S45 · August 11 2026):
A FUZZER'S PLAY POLICY DECIDES WHICH STATES EXIST, SO ITS COVERAGE IS A PROPERTY OF THE POLICY AND NOT
OF THE STATE SPACE. 150 fuzz games asserted termination and missed three soft-locks in a row, and the
reason was never weakness: engineFuzz places whenever a placement is legal, so the tile clock always
runs out, so the natural trigger always fires, so every terminal path that depends on the clock NOT
advancing is unreachable BY CONSTRUCTION. playFlowStalled already sat in that file as a hand-built
exception · the same point conceded one case at a time. Adding policies (draw-heavy, one-region,
never-empty-a-factory) costs nothing but the policies, because termination is already the assertion.
  102a · A POLICY MAY NEVER REFUSE TO PLAY. oneRegion declined every move outside its region; when that
         filled it took no action with THIRTEEN legal placements on the board and could not pass, and
         the harness reported a hang. It was FAKE · the game offered moves and the policy wanted none.
         An adversarial driver must distinguish "the game offers nothing" from "the strategy wants
         nothing", or it manufactures defects. Fallback to any legal action; keep the distortion, lose
         the abstention.
  102b · AND THE METRIC PICKED THE FIGHT TOO. My first reachability check measured tiles-at-END, which
         is 0 for every game that finishes, and duly reported all four policies identical. maxHand
         discriminates instantly: greedy 6, drawHeavy 29. A metric that cannot separate the arms is not
         evidence they are the same (Rule 88's saturation in a new costume · T1's Rule 96).
COROLLARY, AND IT CORRECTS MY OWN S44: the board that fix guards · two empty factories with tiles
remaining · is UNREACHABLE BY LEGAL PLAY, 0 of 160 turn-samples, because refillFactoryDraft restocks a
factory the moment a placement empties it while tiles remain. So an empty factory implies tiles are
exhausted, which already set the trigger. The audit's lock was T1's UI gate; my engine guard is
belt-and-braces and was not the operative fix. I had criticised endGamePhase.test.js the same session
for a fixture describing an impossible board, and then shipped one. WHEN A GUARD IS PROVEN ONLY ON A
CONSTRUCTED STATE, MEASURE WHETHER PLAY CAN REACH IT before claiming what it fixed · the guard can be
worth keeping and still not be the answer.

RULE 100 (T2 S44 · August 11 2026):
WHEN A TERMINAL CONDITION IS DRIVEN BY AN ACTION, REMOVING THE ACTION REMOVES THE ENDING.
A practice game soft-locked forever at turn 33. The engine had TWO endgame rescues and neither could
fire, for one shared reason nobody had stated: endGameTriggered has exactly one natural source ·
refillFactoryDraft · which runs only as a side effect of A PLACEMENT that empties a factory. The tile
clock is therefore not a clock at all, it is a COUNTER OF PLACEMENTS wearing a clock's costume. Take
placements away and it stops, so the very situation that most needs an ending is the one situation
that can never reach it. The S19 Flow rescue then missed it twice over: mode-gated to Flow, and
additionally requiring productionTilesRemaining<=1, a value a deadlocked board can never arrive at for
exactly the same reason. Ask what ADVANCES your terminal condition, and whether the failure you are
guarding against also disables the advance · if it does, the guard is decorative.
  100a · A TERMINAL CONDITION IS DANGEROUS IN THE OPPOSITE DIRECTION TO THE BUG. The hang is loud and
         visible; a game that ends four turns early just looks like a game. So the counterweights are
         the load-bearing tests, and they belong exactly one step from the trigger · a board with ONE
         legal placement, and a board with no placement but ONE drawable card. Distance from the
         boundary is not safety, it is untested space.
  100b · PREFER A CLOSED PROOF TO A HEURISTIC. "No draw and no placement" is not a guess that the
         player is stuck: drawing needs deck or offer, placing needs a stocked factory, and a factory
         can ONLY be restocked by a placement · so no future state differs from this one. That
         argument is what makes it safe to end a real game on, and it is worth writing out before
         shipping the condition, because if it cannot be written the condition is a heuristic.
COROLLARY, and I nearly logged a green teeth-check on it: my first mutation replaced the function
DEFINITION as well as its call sites, so the file was a syntax error and vitest reported "no tests".
A mutation that breaks compilation tests nothing · it must change BEHAVIOUR, one call site at a time.
Read the mutated run's test COUNT, not just its colour (Rule 79d, one level down).
AND A FIXTURE CAN DESCRIBE AN IMPOSSIBLE BOARD: the new rule reddened endGamePhase.test.js, whose
partial setState inherited three EMPTY factories alongside its deliberately empty deck. The rule was
right and the fixture was unreachable in play · when a new invariant fails an old test, ask whether
the old test's world can exist before weakening the invariant.

RULE 98 (T2 S43 · August 11 2026):
A GUARD'S ALARM AND A GUARD'S REMEDY AGE DIFFERENTLY · THE ALARM IS A FACT, THE REMEDY IS A GUESS
MADE BEFORE THE SITUATION EXISTED. My S40 premise guard fired on precisely the day it was built for
(T1 shipped the spend control, 5381760) · a genuine success, and the first time in this project a guard
has caught its own premise expiring. Its failure message then said "RE-RUN the measurement", and that
instruction was WRONG. The experiment plays BOT games and bots still contain no reference to bonus
state, so the control cannot change a single bot decision: a re-run replays identical games and returns
bit-identical numbers. Demonstrated, not argued · the balance test passed untouched in the same run
that reddened the premise check. What the control invalidated was the EXTRAPOLATION to human play, not
the measurement. The alarm was right, the prescription was a year-old guess about what would matter.
  98a · WRITE THE ALARM PRECISELY AND THE REMEDY PROVISIONALLY. A guard should assert what is true and
        name who to ask; the moment it prescribes a specific fix, it is predicting a future it cannot
        see. Re-point the guard rather than obey it · here the fix was to scope the claim to bot play
        and assert THAT, which is now a check that can also fail.
  98b · AND MY OWN COUNTERWEIGHT WAS VACUOUS AGAIN, second session running. I relaxed the write-order
        model from `>` to `>=` and all seven tests passed: no two writes in my sequences shared a
        version, and the two operators differ ONLY at equality. The strictness the entire design rests
        on was asserted nowhere, in the file whose subject is that strictness. A predicate test needs a
        case AT the boundary, not merely on both sides of it · and the boundary here was the two-client
        case I had described in the module header and not tested. Documented is not covered.
COROLLARY, and it is the better half: RUN A CONTROL BEFORE READING A MEASUREMENT AS SPECIFIC. Asked
whether card_55's art clashes with its community-blue frame, I measured 76% of pixels at hue 210° ·
exactly the frame's hue · and nearly reported a match. The control killed the precision: card_38, an
ENERGY card with a red frame, is also 210°-dominant, because the whole deck shares a dark blue ground.
The finding survives (no clash) but the REASON I was about to give was a palette-wide property read as
a card-specific one. One extra sample turned a false explanation into a true one (Rule 81c, T1's 96).

RULE 97 (T2 S42 · August 11 2026):
A CITATION OUTLIVES THE THING IT CITES, AND IT KEEPS ITS CONFIDENCE THE WHOLE TIME.
Migration 011's VERIFY checklist reads "PROVEN EMPIRICALLY T3 S23 · FOR UPDATE serialized: YES". That
was true when written. Then seedHelpers.js was split and re-exported `from './fixtureNames'` with no
file extension · fine under Playwright's bundler, fatal under raw node ESM · and both draw harnesses
are standalone `node` scripts. They died ON IMPORT, before one assertion, for every session since. So
the strongest empirical claim in the migration record was pointing at a proof that could not execute,
and nothing anywhere could have said so: a standalone harness in no workflow cannot report its own
decay (Rule 79), and a comment citing it cannot either. One character fixed it and 16/16 came back.
  97a · WHEN A DOCUMENT CITES A PROOF, RE-RUN THE PROOF, NOT THE DOCUMENT. A checklist line is an
        artifact of the day it was written. Treat "verified in S23" exactly like "the migration is in
        git" · evidence of INTENT at a past moment, not of present state (Rule 68, one level up).
  97b · AND THE SAME FAILURE IN MY OWN VOICE, which is why this is not just about other people's
        comments. My S40 Rule 91 said pattern[0] "disagrees with or ties the majority on 24 of 56
        cards", which is arithmetically exact, and I let it imply the PRODUCT was misreading the
        element on those 24. It is not: GameRoom's cardPrimaryElement resolves ties to the first type
        reaching the max · i.e. to the anchor · so product and anchor agree on 54 of 56, and only
        card_22 and card_55 actually differ. A true number attached to the wrong subject is a citation
        of exactly this kind, and the one I was most likely to trust because I computed it myself.
        Compute the quantity the DECISION rests on, not the one that is easy to compute (T1's Rule 96,
        arrived at independently the same night · that agreement is the argument for both).
COROLLARY on probes, third instance this session and the cheapest yet: information_schema reports
column_default NULL for a GENERATED ALWAYS AS IDENTITY column, which reads as "the caller must supply
this" and is the precise opposite of the truth · supplying it raises 428C9. I nearly wrote the insert
that way. Ask is_identity. A probe that answers a question adjacent to yours is worse than one that
errors, because it answers (Rule 75b).

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
