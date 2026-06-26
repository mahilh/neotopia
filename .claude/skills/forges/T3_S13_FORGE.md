# T3 S13 MASTER FORGE · CI + RECONNECT RESILIENCE
# NeoTopia · June 27 2026 · post-bot-proven · 36 placed in production
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.
# T3 lane: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/

## WHAT CHANGED SINCE LAST FORGE
- Bot v4.3 placed 36 elements in 20 turns. 0/1 ready-failed (T2 fixing this session).
- Placement-commit guard (193fa08) is live in the test suite. Now needs CI automation.
- Game is fully playable by bots. Next: make it resilient for HUMANS.
- Rejoin after page refresh was not verified this session. It was designed in S9 but not stress-tested.
- useGameSync has the INITIAL_SESSION pattern for auth persistence.

## SESSION GOAL
Three tracks:

Task A: GitHub Actions CI workflow · protect the placement guard forever
Task B: Reconnect / rejoin resilience audit and hardening
Task C: Full E2E suite run + honest audit of every test file

---

## GATES

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -50
  Confirm: COMMS local-only · force:true LOAD-BEARING · comms NEVER committed

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  Confirm: T1 is on CardFrame/FinalScore. T2 is on projectCards + bot.
  HARD STOP if T2 has claimed scripts/bot-simulate.js mid-session.

Gate 3 (5 min):
  cat tests/e2e/game-ux.e2e.js
  List every test by name. Understand the placement guard test flow.
  cat playwright.config.js (or playwright.config.ts) — get webServer config, testDir, baseURL.
  You MUST know the playwright config before writing the CI yaml.

Gate 4 (3 min):
  ls .github/workflows/ 2>/dev/null || echo "NO CI YET"
  If exists: read existing workflows before adding a new one.
  cat src/hooks/useGameSync.js | head -60
  Understand INITIAL_SESSION pattern and rejoin logic.

Gate 5: npx vitest run 2>&1 | tail -6 · 102 green required
Gate 6: npm run build 2>&1 | tail -4 · 0 errors required
Gate 7: git log --oneline -8
  Confirm 193fa08 (placement guard) is in log.
  Confirm HEAD = origin/main.

---

## TASK A · GitHub Actions CI Workflow
# Target: 49/50 · Permanent regression protection on every push

CREATE: .github/workflows/e2e-placement-guard.yml

This workflow protects the placement-commit guard (game-ux.e2e.js) on every push.
DO NOT run the full E2E suite in CI — live Supabase + rate limits make that flaky.
RUN ONLY game-ux.e2e.js — it's isolated, runs in 8s, and catches the most critical regression.

WRITE THE YAML (adapt based on what you read in playwright.config.js):

  name: E2E Placement Guard
  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  jobs:
    placement-guard:
      runs-on: ubuntu-latest
      timeout-minutes: 10
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - run: npm ci
        - run: npx playwright install --with-deps chromium
        - name: Start dev server
          run: npm run dev &
          env:
            VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
            VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        - name: Wait for dev server
          run: npx wait-on http://localhost:5173 --timeout 30000
        - name: Run placement guard
          run: npx playwright test tests/e2e/game-ux.e2e.js --reporter=list
          env:
            VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
            VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        - uses: actions/upload-artifact@v4
          if: failure()
          with:
            name: playwright-report-${{ github.run_id }}
            path: playwright-report/
            retention-days: 7

PREMISE CHECKS:
  □ Does playwright.config.js have a webServer config? If yes, the 'Start dev server' step
    may be redundant — remove it and let playwright handle it, or set use.baseURL to localhost:5173.
  □ Is wait-on in package.json? If not: add `npx wait-on` directly (it's an npx call, fine).
  □ Does game-ux.e2e.js require live Supabase? If yes, the secrets MUST be in GitHub repo settings.
    Document this in a comment in the yaml.
  □ Replace the webServer section based on actual playwright config — never guess.

After creating the yaml:
  git add .github/workflows/e2e-placement-guard.yml
  git commit -m 'ci: E2E placement guard on push + PR · game-ux.e2e.js · chromium only · NeoTopia T3 S13'
  git push
  Navigate to: https://github.com/mahilh/neotopia/actions
  Verify the workflow appears. If it fails, read the artifact report and fix before moving on.

EVIDENCE GATE:
  The GitHub Actions page shows green for the E2E Placement Guard workflow.
  This is a hard requirement. Do not proceed to Task B if CI is red.

---

## TASK B · Reconnect + Rejoin Resilience Audit
# Target: 48/50 · Humans refresh pages. The game must survive it.

SCENARIO: Two players are mid-game. Player 2 accidentally closes their tab and reopens it.
What happens? Does the game resume? Does their board state reappear? Can they still make moves?

STEP 1: TRACE THE REJOIN PATH
  Read src/hooks/useGameSync.js (full file)
  Read src/hooks/useGameRoom.js (full file)
  Answer these questions before writing code:
  □ When the page loads with a roomId in the URL, what happens first?
  □ Does useGameSync re-subscribe to postgres_changes after a refresh?
  □ Does the board state re-hydrate from the DB on rejoin?
  □ Does the player's seat re-associate with their auth ID correctly?
  □ What is INITIAL_SESSION and how does it ensure the DB row is loaded before rendering?

STEP 2: IDENTIFY THE WEAKEST LINK
  After tracing, identify the one scenario most likely to fail:
  - Option 1: board state doesn't re-hydrate (player sees empty board on rejoin)
  - Option 2: seat re-association fails (player loses their "isMyTurn" status)
  - Option 3: subscription doesn't re-attach (player doesn't receive future moves)

  Write the diagnosis in .claude/comms/tomorrow.md before touching code.

STEP 3: FIX THE WEAKEST LINK
  Whatever you identified in Step 2 — fix it.
  Common fix patterns:

  For board re-hydration:
    In useGameSync, after INITIAL_SESSION resolves, add an explicit board state read:
    const { data } = await supabase.from('game_sessions').select('*').eq('id', sessionId).single()
    if (data) useGameStore.getState().loadFromDB(data)  // or equivalent hydration call

  For subscription re-attach:
    Ensure the postgres_changes subscription is set up AFTER auth is confirmed, not before.
    Add a reconnection guard: if the subscription drops, auto-resubscribe after 3s.

  For seat re-association:
    Ensure mySeat computation in GameRoom.jsx uses the user.id from useAuth()
    AND that useGameSync seeds player.userId from the DB on load, not just on join.

STEP 4: ADD AN E2E TEST FOR REJOIN
  Add a test in tests/e2e/reconnect.e2e.js (already exists — extend it):

  test('player 2 rejoins mid-game and sees correct board state', async ({ browser }) => {
    // 1. Start a 2-player game, make a few moves
    // 2. Close p2's context
    // 3. Re-open p2's context and navigate to the same room URL
    // 4. Assert: p2 sees the correct board state (elements on board from before)
    // 5. Assert: p2 can still make moves (data-my-turn flips correctly)
  })

  If reconnect.e2e.js already has this test: verify it passes. Fix if it doesn't.

COMMIT (code changes only, not the test if it was already there and passing):
  git add src/hooks/useGameSync.js src/hooks/useGameRoom.js tests/e2e/reconnect.e2e.js
  git commit -m 'fix(realtime): reconnect resilience · board re-hydration + subscription re-attach · NeoTopia T3 S13'

---

## TASK C · Full E2E Suite Audit
# Target: 47/50 · Know exactly what is green, what is flaky, what needs fixing

RUN EACH FILE INDEPENDENTLY (Rule 33: never concurrent):
  npx playwright test tests/e2e/game-ux.e2e.js --reporter=list 2>&1 | tail -20
  npx playwright test tests/e2e/two-human.e2e.js --reporter=list 2>&1 | tail -20
  npx playwright test tests/e2e/reconnect.e2e.js --reporter=list 2>&1 | tail -20
  npx playwright test tests/e2e/phase-over-wire.e2e.js --reporter=list 2>&1 | tail -20

FOR EACH FILE, RECORD:
  - Number of tests
  - Pass / fail / skip count
  - Duration
  - If fail: root cause classification
    [CODE] = our code is broken → fix immediately
    [RATE] = Supabase rate limit → expected environmental, not our code
    [TIMEOUT] = network latency → increase timeout or mark as flaky
    [UNKNOWN] → investigate before claiming

DO NOT claim "suite is green" if any test fails with [CODE] classification.
For [RATE] failures: document them as expected. They are not regressions.

WRITE THE AUDIT SUMMARY to .claude/comms/tomorrow.md:
  === T3 S13 E2E AUDIT ===
  game-ux.e2e.js:        [N] tests · PASS · [time]s
  two-human.e2e.js:      [N] tests · PASS/FAIL ([classification]) · [time]s
  reconnect.e2e.js:      [N] tests · PASS/FAIL ([classification]) · [time]s
  phase-over-wire.e2e.js:[N] tests · PASS/FAIL ([classification]) · [time]s
  =======================
  Total: [N] pass · [N] fail [CODE] · [N] fail [RATE]
  Next: [what needs fixing]

This audit becomes T3 S14's starting state. Accuracy matters more than optimism.

---

## COMMIT RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · src/lib/ · src/store/ · scripts/ · migrations/
  NEVER commit .claude/comms/
  Evolution lesson → .claude/comms/tomorrow.md · FILESYSTEM ONLY

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive
