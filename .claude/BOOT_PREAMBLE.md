# NEOTOPIA · BOOT PREAMBLE
Read before the first tool call of every session. Every line has a session behind it.

## 0 · BOOT
Five lines, in order. SERIAL vitest, always — T3 measured 8 failures at load 52, 3 at 27, 0 at 6.78
on identical code. A red suite is not a regression until you have a serial run. State the load
average; above ~5 on 8 cores means another lane is mid-run and any red is suspect.

## 1 · PREMISE GATE — before writing a line
The brief is a hypothesis from someone with less context than you.
- Premise-check the ARTIFACT, not the reasoning. Two sides from one source agree by construction
  (92). A browser probe reading the same base polygon as the source read is not a second source.
- A source read cannot answer a question whose answer is composed (116). Tell: could more than one
  place contribute? A stack, a cascade, a build step, a minifier.
- Dangerous artifacts are the ones passing through a transform. index.css lost a fallback to
  Lightning CSS; a JSX template literal survived byte-for-byte. A minifier deletes what looks
  redundant, and a deliberate fallback is redundant by definition (116e).
- A gitignore is not a build. Vite copies public/ wholesale — 238 ignored files reached dist.
- Never cite a migration number for current behaviour (109). create-or-replace makes migrations a
  log, not a state. Ask pg_get_functiondef.
- Comments carry the CHAIN (checkable), never applied-state (changes with no diff).
- ENUMERATE THE CALL SITES, READ THEM, THEN CONCLUDE — in that order, and each step catches a different
  failure. Enumerating catches the FALSE NEGATIVE: the producer you never put in the candidate set. I
  named a room leak on the one cleanup path I happened to be looking at, and the real one was a sibling
  I had not listed. Reading catches the FALSE POSITIVE: a grep cannot see DELEGATION. solo-host looked
  like it never deleted its room and it calls a helper that does. Both directions bit me in one session,
  from the same grep, because I concluded from it before I had enumerated with it.
- A claim you have already written down is the expensive kind to be wrong about. I put a wrong producer
  in a commit message, a code comment and a handoff, then spent the next hour disproving myself — and
  the evidence that would have stopped me was the enumeration I only ran afterwards.
If the brief's premise is false, say so and do the better task. Six times now, every time worth more.

## 2 · COUNTERWEIGHT FIRST
The test most likely to be vacuous is written last, exercised least, and must fail in a scenario you
are deliberately not creating (86).
- Write it before the assertions it defends; with nothing else in the file its vacuity is obvious.
- Assert the arm's DEFINING property, not its outputs. A definition does not feel like a claim.
- Redundant guards make each other untestable. Two guards, either sufficient, no mutation can red
  either. Delete one.
- Read the BASELINE green first (110b). A mutation that breaks compilation tests nothing.
- A MUTATION THAT LANDED IN THE FILE MAY NOT HAVE LANDED IN THE MEASUREMENT. Mutating to a constant
  (0, [], false, null) is inert whenever the fixture already rests there · faking deckAtEnd to 0 stayed
  green because the 4-player fixture exhausts its deck. Print the unmutated value at that line before
  believing a green, and repair it with a positive control on the term, not a better mutation (132).
- AND THE SECOND WAY IT MISSES THE MEASUREMENT IS THAT NOTHING LOADED YOUR FILE (132, T3's instance,
  same night, different mechanism · two lanes reaching one rule separately is a missing instrument,
  not carelessness). Three mutations in a worktree came back green with an unmutated baseline,
  identical to the character, because playwright reuseExistingServer handed the run the MAIN clone's
  dev server on the shared port. Specs came from the worktree, the app came from somewhere else.
  So ask of a green mutation both questions: could the fixture already equal the mutant, AND is the
  artifact under test the one I edited? A dev server, a stale dist/, a cached bundle, a deployed
  origin and another checkout all answer the second one wrong, and all of them answer it GREEN.
  The generalisation: mutation testing verifies a MEASUREMENT PATH, so mutate one thing you are
  certain must red before trusting any mutation that does not.
- Size a rate guard against its baseline, never zero. spends > 0 passed at 0.01/game.
- A wire sized from the run that produced it is a flake with a delay. Derive from a structural
  constant, not an observed rate.
- A gate that asserts every file has a name does not assert every name has a caller.
- ENUMERATE THE MUTATIONS BEFORE WRITING THE MESSAGES. A failure message is the most-read line in a
  test and the only one that can never go red, so it is where claimed scope silently exceeds real
  scope. Mine named the Rule 107 latch class; the mutation for that class came back GREEN, and I
  found out only because I ran it afterwards out of curiosity. List what must red, then write prose.
- The fix you recommended is a hypothesis about a MECHANISM, and the measurement can keep the defect
  and kill the fix. Exact anchoring changed the turn deadline by zero at every off-grid offset · the
  error was the sampling period, not the anchor. Build both arms before believing either.

## 3 · THE INSTRUMENT IS A CLAIM
- A probe asserts its own output range. Contrast outside 1:1-21:1 must throw. One returned 97186:1.
- Report UNMEASURED, never a plausible zero (80). Zero blocked out of zero checked greens every lane
  forever. channels: [] meant "I did not look."
- A swallowed error is an unmeasured failure (93). A DELETE matching zero rows returns no error.
- A probe can lie by being FAST (82). isVisible({timeout}) ignores its timeout. Settle on three
  identical frames before reading mid-transition.
- Absence inside a truncated page is not absence. Assert the COUNT found, not the absence of pending.
- A probe that prints nothing is indistinguishable from one that found nothing. Guard the loop before
  writing it — assert the COUNT it observed, not that it finished. And route the summary somewhere the
  runner cannot eat: vitest swallowed stdout and reported '1 passed' for a probe that printed nothing,
  and the session's central finding nearly rested on it.
- An idempotency guard that greps for a symbol matches its USES, not its declaration. Mine skipped adding
  an import because the line it was about to add contained the name (112 in a script).
- EVERY ABSENCE-PROBE CARRIES A KNOWN-PRESENT CONTROL IN THE SAME RUN, and the cheap tell when you
  forgot one is that the ANSWER IS UNIFORM. A probe returning the same value for every input has not
  measured anything; the uniformity is the finding, not the value. I polled production fifteen times
  over eight minutes reading "not deployed" off a deploy that had been live the whole time —
  `$(curl …)` into a bash variable truncates a 636KB bundle at a NUL and `grep` then reclassifies it
  as binary, so it returned 0 for EVERY token. The only reason I caught it is that it also returned 0
  for a string I knew was there. Ask the probe something whose answer you already know, in the same
  run, or its zero is unreadable (Rule 120, aimed at the instrument rather than at the finding).
  Concretely for artifacts: `curl -s URL -o f` then read the FILE (python/`grep -a`), never the shell
  variable — and poll on CONTENT, because a hash differs between a local and a CI build whose env
  values are inlined.
  ⚠ AND THE FOURTH SHAPE, which the control CANNOT catch: A PROBE THAT ERRORED PRINTS THE SAME
  THING AS A PROBE THAT MEASURED ZERO. My corrected deploy check, inlined in a shell loop as
  `python3 -c` inside `$( )`, died on quoting; every field came back empty, including the
  known-present control, and the loop ran twenty times reporting "not deployed" off a live deploy.
  The control is a claim about the SUBJECT and says nothing when the HARNESS is what broke. Two
  defences, and they are cheap: WRITE THE PROBE TO A FILE and run the file (a syntax error is then
  loud and immediate instead of an empty string), and have it print a line that only a completed
  run can produce · then a missing verdict is distinguishable from a negative one. Never inline a
  probe inside a loop; the loop multiplies a silent failure into a convincing pattern.
  ⚠ AND THE FIFTH, WHICH IS THE ONE ABOVE INVERTED: THE CONTROL WAS PRESENT AND COULD NOT FAIL. A
  before/after claim rests entirely on its BEFORE half, and mine was not missing · it was vacuous.
  `expect.poll(() => JSON.stringify(snapshot)).toContain('"tiles":1')` was the gate proving a seeded
  state had ARRIVED, and `{"tiles":12,...}` contains `"tiles":1`, so a fresh game satisfied it. I then
  observed the later state differ and published "they adopted it and then LOST it" · reasoning toward
  a multiplayer sync defect that does not exist. A control that cannot fail is WORSE than a missing
  one, because a missing control still nags and a present one retires the worry (86). So the question
  to ask of a presence-half is not "is there a control" but "what value would make it red" · and if
  you cannot name one in a sentence, it is decoration. Numeric JSON fields are where this hides:
  compare the VALUE, never a substring of the stringified snapshot (112 · guarded now by
  tests/jsonSubstringAssertions.test.js, so it is a function rather than this paragraph).
  ⚠ THE THREE OTHER PLAUSIBLE ZEROES THIS PROJECT HAS PAID FOR ARE NOT ONE SHAPE, and flattening
  them is its own error: the deploy probe was uniform-zero, the district-settle count was a probe
  that answered too FAST (one snapshot at 90ms for a cue that peaks at 266ms), and the raster
  measured a
  letterboxed board that was not the one on screen. Same OUTCOME, three mechanisms. The control is
  what covers all three; the uniformity tell only covers the first.
- NAME THE FAILURE YOUR MEASUREMENT CANNOT SEE BEFORE TRUSTING IT. One sentence. For overlays it is
  occlusion; for animation, two firing at once; for a focus trap, a dialog with nothing focusable.
- A BOUND IS A CLAIM ABOUT A NOISE FLOOR, AND ONE SAMPLE OF THE FLOOR IS NOT A MEASUREMENT OF IT.
  I shipped a 500ms timing bound measured only on an idle machine and called it sound. Under a 6x CPU
  throttle the same probe reported a working clock firing 51ms EARLY · because I had sized the
  tolerance from the recorder's REQUESTED 25ms period, and a throttled 25ms interval is nothing like
  25ms. The defect was in the instrument and only load revealed it. Generalises past timing: any
  threshold on a rate, a latency, a retry count or a queue depth is implicitly "and the noise is
  smaller than this", which is unmeasured until you move the load. Sweep at least a quiet and a
  contended point before believing a bound · and where the floor can be measured IN the run, have the
  probe measure it and refuse a verdict it cannot support (mine now reports its own worst gap).
- WHEN THE SUBJECT UNDER TEST IS THE THING YOUR HARNESS SIMULATES, THE HARNESS IS MAXIMALLY SUSPECT
  AND A REAL-WORLD MEASUREMENT IS A PLANNED STEP, NOT A BONUS. Fake timers advance Date.now() and
  performance.now() together, so no test in this repo could tell them apart · I shipped a turn clock
  that measured excess 0 under fake timers, went green on all four CI jobs, and was reliably ~1000ms
  late in a browser. Same shape for a mocked network, a stubbed clock, an in-memory storage layer:
  the mock is a MODEL of exactly the thing you are changing (36). Ask before you start, not after:
  what does my harness replace, and is that the subject? If yes, book the real measurement in the
  plan. I found mine by accident, chasing an unrelated question, on a regression already pushed.

## 4 · WHAT YOU SAY IS AN ARTIFACT
- A stated LIMIT needs the same counterweight as a stated finding. Limitations get believed harder
  because they sound like rigour. One false limit cost three live runs, disproved in ninety seconds.
- AND THE LIMIT YOU STATE ABOUT SOMEONE ELSE'S INSTRUMENT IS THE ONE YOU WILL NEVER RUN, because
  running it means learning their tool and you already "know" the answer. I closed S63 saying the
  third CI rung · a commit with no run at all · was "the state nothing in the receipt currently
  names". It names it: `NO RUN for this commit`, on its own line, distinct from a cancelled run's
  `DID NOT COMPLETE · "<step>"`. One command. The claim had already become the next session's brief
  by then (108a), so a limit invented in a closing recommendation propagates faster than a finding
  does. Before writing "X cannot do Y", run X against Y · and if the honest gap survives, it is
  usually smaller and more specific than the one you were about to claim (here: the receipt is
  per-commit BY DESIGN and correct to be, and what was missing was only that nobody had counted
  across commits).
- A retraction is not self-verifying (109b). It reads as rigour, so it gets trust the claim had to earn.
- A CORRECT RECOMMENDATION PROTECTS A WRONG EXPLANATION FROM EVER BEING EXAMINED. Advice that works is
  never re-derived, so the mechanism bolted to it is the least-audited sentence you will ever write and
  it outlives every review. "Filter on --status=success" was right and my reason for it — cancellation
  destroys the log — was invented from one sample; the real reason is that an unfinished run has not
  written one yet. Nobody would have caught it, because the advice kept working. So state the mechanism
  separately from the recommendation, and when you next rely on the advice, re-ask WHY rather than
  whether. The tell is a "because" clause you have never tested standing next to a step you use often.
- A premise you checked and correctly ruled out can be reopened by someone else's commit. I killed the
  log-based conversion reader in S60 on sound reasoning — the app publishes to a BROWSER console, which
  no runner log sees — and T3 then shipped a node-side reporter, which made it the best instrument
  available. Re-check a closed premise when the code it rested on has moved, not when you doubt it.
- WHEN YOU FIX A WORDING DEFECT, GREP THE FILE FOR ITS SIBLINGS BEFORE COMMITTING. The sibling is
  almost always adjacent, because it was written in the same sitting by the same hand with the same
  wrong idea. I changed `NO RUN` to `no run YET` for one branch and left "the RUN did not complete"
  four lines below it, asserting a finished state about a run still executing — same tense, same
  meaning error, same file, one branch fixed. Tense is meaning: "has not completed YET" asks the
  reader to look again, "did not complete" sends them to investigate. The fix is never the word.
- A closing recommendation is the claim nobody checks (108) — it arrives as the next session's
  priority. Premise-check it before writing it.
- A citation with no runner is a claim. Migration 011 cited a proof that died on import for 19 sessions.
- Prove a mechanism, then write no unscoped consequence beside it (122) — the proof makes the
  neighbour look checked.
- A finding needs a denominator before a priority (121). Say who it reaches.
- Measure in a window that predates your own change, or you will find your change.
- When a mechanism resists three rounds of reasoning, stop deriving and look at what the rows are.
- A SAFETY EXPLANATION IS A CLAIM WITH A FOUR-SECOND TEST, WRITTEN AT THE EXACT MOMENT YOU ARE LEAST
  LIKELY TO RUN IT. I typed "raw node ESM does not resolve this, because e2ePool imports
  ./reservedNames extensionless · Rule 97" INTO THE COMMENT ON THE IMPORT, while adding the import
  that did exactly that. Naming the mechanism in the same edit did not stop me; a gate did. The tell
  is the word BECAUSE in your own prose: you have just stated a testable proposition and reached for
  a comment instead of a command. `node --input-type=module -e "import('...')"` was four seconds and
  I had already typed the reason it would fail. Run it, then keep the sentence as the record.

## 5 · LANES — canonical
T1: src/components/ src/pages/ src/App.jsx src/utils/ src/index.css
T2: src/lib/ src/store/ src/hooks/ api/ scripts/ migrations/ .github/
T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/
- Lane discipline covers COMMANDS. git stash -u swept eight foreign files; git add committed another
  lane's mid-edit prose. Pathspec only, never git add -A.
- Pre-push: read your own diff.
- Cross-lane exports get a comms post BEFORE the requester builds.
- Route line-level. The collision rule exists for the moment crossing it feels justified.
- Never red a shared gate for another lane. Use test.fail() with the requirement named, plus a WORKS
  test as setup guard — a test.fail() cannot notice its own broken setup.
- A red in the shared tree is not a bug report until proven in a detached worktree at committed HEAD.

## 6 · SHIPPED MEANS PRODUCTION
- Localhost proves correct; only deployed origin proves live.
- Verify the BUNDLE. Comments strip, declarations collapse, flag names vanish under substitution.
- Poll on CONTENT, not hash. Three lanes push inside minutes.
- A 200 is not a file — an SPA fallback returns text/html.
- A cancelled CI job is not a pass (79d). Say unmeasured.
- A spec that runs nowhere cannot report its own rot (79).
- An instrument's age is not evidence. Any gate older than three sessions gets mutation-proven once.

## 7 · CLOSING RITUAL
1 Everything pushed, nothing of yours uncommitted.
2 CI per-commit, not by window. Name any cancelled or running job.
3 Drive synced, manifest validated, retried past a write quota.
4 NEXT BEST STEP — what, why highest-value FOR YOU specifically, and its denominator.
  Premise-check it against the artifact first.
5 ONE CONCRETE IMPROVEMENT to this session's work, from what you measured. "Nothing worth a session"
  is a valid answer if defended.

## 8 · DESIGN — absolute
No em dashes, use ·  |  no window.confirm(), hold-to-confirm  |  44px targets  |  tabular-nums
npm run build passes before commit
Copy is a layout input · a layout gate pins the STRING, not just the viewport. ⚠ THE 66 THIS LINE
CARRIED FOR SIXTEEN SESSIONS WAS NOT THE WRAP POINT (measured T1 S59, in a browser at 320: 13px font,
288px box). The instruction is ALREADY two lines for every string the game ships, from 37 chars up;
the cliff is the THIRD line at 73. Prefer an ordering against the longest sentence the product already
renders over any remembered number.
Put long reasoning in the test file, where it cannot become a render. // in JSX children is text.
