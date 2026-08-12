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
If the brief's premise is false, say so and do the better task. Six times now, every time worth more.

## 2 · COUNTERWEIGHT FIRST
The test most likely to be vacuous is written last, exercised least, and must fail in a scenario you
are deliberately not creating (86).
- Write it before the assertions it defends; with nothing else in the file its vacuity is obvious.
- Assert the arm's DEFINING property, not its outputs. A definition does not feel like a claim.
- Redundant guards make each other untestable. Two guards, either sufficient, no mutation can red
  either. Delete one.
- Read the BASELINE green first (110b). A mutation that breaks compilation tests nothing.
- Size a rate guard against its baseline, never zero. spends > 0 passed at 0.01/game.
- A wire sized from the run that produced it is a flake with a delay. Derive from a structural
  constant, not an observed rate.
- A gate that asserts every file has a name does not assert every name has a caller.

## 3 · THE INSTRUMENT IS A CLAIM
- A probe asserts its own output range. Contrast outside 1:1-21:1 must throw. One returned 97186:1.
- Report UNMEASURED, never a plausible zero (80). Zero blocked out of zero checked greens every lane
  forever. channels: [] meant "I did not look."
- A swallowed error is an unmeasured failure (93). A DELETE matching zero rows returns no error.
- A probe can lie by being FAST (82). isVisible({timeout}) ignores its timeout. Settle on three
  identical frames before reading mid-transition.
- Absence inside a truncated page is not absence. Assert the COUNT found, not the absence of pending.
- A probe that prints nothing is indistinguishable from one that found nothing. Guard the loop before
  writing it.
- NAME THE FAILURE YOUR MEASUREMENT CANNOT SEE BEFORE TRUSTING IT. One sentence. For overlays it is
  occlusion; for animation, two firing at once; for a focus trap, a dialog with nothing focusable.

## 4 · WHAT YOU SAY IS AN ARTIFACT
- A stated LIMIT needs the same counterweight as a stated finding. Limitations get believed harder
  because they sound like rigour. One false limit cost three live runs, disproved in ninety seconds.
- A retraction is not self-verifying (109b). It reads as rigour, so it gets trust the claim had to earn.
- A closing recommendation is the claim nobody checks (108) — it arrives as the next session's
  priority. Premise-check it before writing it.
- A citation with no runner is a claim. Migration 011 cited a proof that died on import for 19 sessions.
- Prove a mechanism, then write no unscoped consequence beside it (122) — the proof makes the
  neighbour look checked.
- A finding needs a denominator before a priority (121). Say who it reaches.
- Measure in a window that predates your own change, or you will find your change.
- When a mechanism resists three rounds of reasoning, stop deriving and look at what the rows are.

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
Copy is a layout input: a 66-char instruction wraps and costs the board 24% of its height at 320. A
layout gate pins the STRING, not just the viewport.
Put long reasoning in the test file, where it cannot become a render. // in JSX children is text.
