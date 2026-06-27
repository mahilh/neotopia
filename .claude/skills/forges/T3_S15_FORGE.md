# T3 S15 MASTER FORGE · MOBILE E2E + NUMEROLOGY CI + TIMING AUDIT + BONUS DATA
# NeoTopia · post S14 complete · CI green · 29 DB-verified elements in production
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.
# T3 lane: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/

## S14 WHAT SHIPPED (T3)
  comms untrack: git rm --cached landed · M state GONE · verified on T3's own write
  bot room race: diagnosed (no pg_cron; race = concurrent E2E teardown or rate-limit phantom)
    readPlacedCount({url,key,roomId}) in seedHelpers.js · validated live (count 1→4→8)
  bot-health CI: GREEN · 29 elements DB-verified in production (proxy 31)
    grades on totalPlacedDB > 0 (correct design · tolerates degraded games)
    Fixed: upload-artifact@v4 needs include-hidden-files: true for dot-dirs

## RULE 60 (T3 S14, now permanent)
  A tool's contract is part of the premise — verify it like a schema.
  git commit -- path partial-commits from working tree (ignored staged rm).
  upload-artifact@v4 skips dot-dirs.
  Both did plausible-but-wrong things silently. When a command opposes your intent: suspect contract.

## SESSION GOAL (4 tasks — Task D is conditional on Mahil providing bonus data)
  Task A: Mobile portrait mode E2E test (375px viewport game works)
  Task B: Numerological milestone CI test (sacred scores fire at correct thresholds)
  Task C: E2E suite timing audit (<3 minutes total, documented in comms)
  Task D: Bonus hex data integration helper (ONLY if Mahil provides the data today)

---

## GATES

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  Confirm: comms M state GONE in git status
  Confirm: e7b20e4 in log (T3 S14 HEAD per wrap-up)
  Confirm: Rules 58, 59, 60 are in the list
  HARD STOP if any rule you are about to violate appears here.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Confirm: T1 on dim-the-rest + action log + burst. T2 on Global Index wiring + numerology events.
  HARD STOP if another terminal has claimed tests/e2e/ mid-session.

Gate 3 (8 min — READ FULLY):
  ls tests/e2e/  (confirm which files exist: game-ux, two-human, reconnect, phase-over-wire)
  cat tests/e2e/game-ux.e2e.js  (FULL FILE — understand structure before adding tests)
  cat playwright.config.js  (confirm viewport defaults, webServer config)
  Answer before writing:
    a. Does playwright.config.js set a default viewport? If yes: what is it?
    b. Does game-ux.e2e.js use page.setViewportSize? Or test.beforeEach viewport?
    c. What is the pattern for creating a 2-player game in the existing tests? (reuse it)
    d. Is there a vitest test for gameStore.js? (find where to add the milestone assertion)
    e. Does the store expose sacredMilestone? (T2 may not have shipped it yet
       — if T2 S15 is not done: write the milestone test as a placeholder that fails gracefully)
  Rule 58: read the existing tests before adding to them.
  Rule 60: playwright.config.js viewport is a tool contract — verify it.

Gate 4: npx vitest run 2>&1 | tail -8 · all tests green
Gate 5: npm run build 2>&1 | tail -5 · 0 errors
Gate 6: git log --oneline -8 && git status --short
  Confirm HEAD = origin/main. Only T3 files in working tree.
Gate 7: Run the E2E timing baseline:
  time npx playwright test tests/e2e/game-ux.e2e.js --reporter=dot 2>&1 | tail -8
  Record the time. This is your S15 baseline to compare against.

---

## TASK A · Mobile Portrait Mode E2E Test (target: 49/50)
# Strategy gaming is moving to mobile. NeoTopia must work at 375px portrait.
# This test catches any future regression where the board is hidden or buttons are too small.

### WHAT TO TEST:
  At 375px wide × 812px tall (iPhone SE/standard size):
  1. Landing page loads: username input visible, Create/Join buttons visible
  2. Game board is visible (not behind sidebar)
  3. At least one factory is visible and clickable (≥44px target)
  4. The end-turn button is visible and at full opacity when actionsLeft=0
  5. No horizontal scroll (body.scrollWidth === 375 or close)
  6. The action log (if T1 shipped it) is hidden on mobile (or shows max 1 line)

### IMPLEMENTATION:
  Add to tests/e2e/game-ux.e2e.js (or create a new mobile.e2e.js — decide based on file size):

  test.describe('mobile portrait (375px)', () => {
    test('game board visible and playable at 375px', async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: 375, height: 812 },
        hasTouch: true,  // simulate touch device
      })
      const page = await ctx.newPage()

      // Navigate to game (solo dev mode)
      await page.goto(process.env.BASE_URL || 'http://localhost:5173/game')
      await page.waitForSelector('[data-game-phase]', { timeout: 15000 })

      // Confirm: no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      expect(bodyWidth).toBeLessThanOrEqual(380)  // 375 + small tolerance

      // Confirm: SVG game board is in the viewport
      const boardBox = await page.locator('svg[role="img"]').boundingBox()
      expect(boardBox).not.toBeNull()
      expect(boardBox.width).toBeGreaterThan(0)

      // Confirm: at least one factory exists and is touchable
      const factories = page.locator('[data-testid="factory"]')
      const count = await factories.count()
      expect(count).toBeGreaterThan(0)
      // Confirm 44px minimum touch target (Rule 4)
      const factoryBox = await factories.first().boundingBox()
      if (factoryBox) {
        // SVG element bounding box — width OR height >= 44 (hex-shaped, aspect varies)
        const maxDim = Math.max(factoryBox.width, factoryBox.height)
        expect(maxDim).toBeGreaterThanOrEqual(44)
      }

      // Confirm: end-turn button is visible (data-testid="end-turn-btn")
      const endTurn = page.locator('[data-testid="end-turn-btn"]')
      // End turn is only visible when actionsLeft=0. Verify it exists in DOM:
      const endTurnCount = await endTurn.count()
      expect(endTurnCount).toBeGreaterThanOrEqual(1)

      await ctx.close()
    })
  })

  PREMISE CHECKS:
    Verify: does the game render at /game without a roomId? (solo dev mode)
    Verify: does it require auth first? (if yes, need to set up anon auth in context)
    If E2E requires live Supabase: add the env vars to the test comment.
    If the game can't run without a room: test only the lobby page at 375px instead.

  COMMIT:
    git add tests/e2e/game-ux.e2e.js (or tests/e2e/mobile.e2e.js)
    git commit -m 'test(e2e): mobile portrait 375px · board visible · factories touchable · no horizontal scroll · NeoTopia T3 S15'

---

## TASK B · Numerological Milestone CI Test (target: 47/50)
# Protect the numerology system forever.
# When T2 adds sacredMilestone to the store, this test catches any regression.

### WHAT TO TEST (unit test, not E2E):
  The sacred milestones fire at exactly: 7, 9, 13, 18, 27, 36
  The messages and symbols are correct for each milestone
  No milestone fires at non-sacred numbers (6, 8, 10, 11, etc.)

### IMPLEMENTATION:
  Find the existing store tests (vitest files for gameStore.js):
    grep -r 'gameStore' src --include='*.test.js' -l
  Add to the appropriate test file:

  describe('numerological milestones', () => {
    const SACRED = [7, 9, 13, 18, 27, 36]
    const NON_SACRED = [1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 14, 15, 16, 17]

    test('milestone fires at all sacred thresholds', () => {
      // This test is PENDING until T2 S15 ships sacredMilestone
      // If sacredMilestone doesn't exist in the store: skip this test gracefully
      const store = useGameStore.getState()
      if (!('sacredMilestone' in store)) {
        console.warn('sacredMilestone not yet in store — test pending T2 S15')
        return  // graceful skip, not a failure
      }
      SACRED.forEach(score => {
        // Set up store state with player at score N
        // Assert: sacredMilestone is set with the correct milestone
        // (Exact implementation depends on T2's store structure)
      })
    })

    test('SACRED numbers array is numerologically correct', () => {
      // This test passes regardless of T2's progress
      // It protects the numerology constants themselves
      const expected = [7, 9, 13, 18, 27, 36]
      // Verify: all reduce to sacred numbers
      // 7 = spiritual perfection
      // 9 = completion (9 = 9 × any → digital root 9)
      // 13 = 1+3 = 4 (earth, sacred feminine cycle)
      // 18 = 1+8 = 9 = life doubled
      // 27 = 2+7 = 9 = triple completion
      // 36 = 3+6 = 9 = four elements times nine
      const digitalRoot = n => {
        while (n > 9) n = String(n).split('').reduce((a,c) => a + Number(c), 0)
        return n
      }
      // 9, 18, 27, 36 all reduce to 9
      expect(digitalRoot(9)).toBe(9)
      expect(digitalRoot(18)).toBe(9)
      expect(digitalRoot(27)).toBe(9)
      expect(digitalRoot(36)).toBe(9)
      // 7 = spiritual perfection (not reducible further, stays 7)
      expect(digitalRoot(7)).toBe(7)
      // 13 = sacred feminine (1+3=4=earth)
      expect(digitalRoot(13)).toBe(4)
    })
  })

  This test always runs (even before T2 S15). The sacred numbers test is pure math.
  The milestone state test is gracefully pending if T2 hasn't shipped yet.

  COMMIT:
    git add [relevant test file]
    git commit -m 'test(numerology): sacred milestone thresholds · digital root math protection · NeoTopia T3 S15'

---

## TASK C · E2E Suite Timing Audit (target: 45/50)
# Goal: full suite completes in under 3 minutes on any modern CI runner.
# Document the findings in comms for T3 S16.

### HOW TO RUN:
  Run each file independently (Rule 33: NEVER concurrent):
  time npx playwright test tests/e2e/game-ux.e2e.js --reporter=dot 2>&1 | tail -8
  time npx playwright test tests/e2e/reconnect.e2e.js --reporter=dot 2>&1 | tail -8
  time npx playwright test tests/e2e/two-human.e2e.js --reporter=dot 2>&1 | tail -8
  time npx playwright test tests/e2e/phase-over-wire.e2e.js --reporter=dot 2>&1 | tail -8
  (If mobile.e2e.js was created in Task A: time that too)

### FOR EACH FILE RECORD:
  - Number of tests
  - Pass / fail / skip count
  - Wall-clock time (from the 'time' command)
  - Failure classification: [CODE] (regression) / [RATE] (Supabase limit) / [TIMEOUT] (network lag)
  - If [CODE]: root-cause BEFORE committing any fix
  - If [RATE] or [TIMEOUT]: document but do NOT count as regression

### CLASSIFICATION RULES:
  [CODE]: our code is broken → fix immediately before end of session
  [RATE]: Supabase anon-signin rate limit (~30/hr) → expected, not our code
  [TIMEOUT]: network or server latency → increase timeout in test OR mark slow
  [UNKNOWN]: investigate and classify before end of session

### TARGET TIMES:
  game-ux.e2e.js: < 30s (was 49s in CI, should be faster locally)
  reconnect.e2e.js: < 45s (was 52s in CI)
  two-human.e2e.js: < 60s
  phase-over-wire.e2e.js: < 30s
  TOTAL: < 3 minutes for all 4 files

### IF ANY FILE EXCEEDS TARGET:
  Add test.setTimeout() to the slow test:
    test.setTimeout(90000)  // 90 second timeout for slow live-DB tests
  Mark as slow in the test title:
    test('slow · player 2 rejoins mid-game', ...)

### WRITE THE FULL AUDIT to .claude/comms/tomorrow.md:
  === T3 S15 E2E TIMING AUDIT ===
  game-ux.e2e.js:         [N] tests · PASS/FAIL · [time]s
  reconnect.e2e.js:       [N] tests · PASS/FAIL · [time]s
  two-human.e2e.js:       [N] tests · PASS/FAIL · [time]s
  phase-over-wire.e2e.js: [N] tests · PASS/FAIL · [time]s
  mobile.e2e.js (Task A): [N] tests · PASS/FAIL · [time]s
  TOTAL: [sum]s · TARGET <180s · [PASS/FAIL]
  Failures: [none / [CODE] X / [RATE] Y]
  S16 follow-up: [what needs addressing]
  ==================================

  NO COMMIT needed for this task (it's an audit + comms write).
  If you make code changes to fix [CODE] failures: commit with pathspec.

---

## TASK D · Bonus Hex Data Integration Helper (CONDITIONAL)
# ONLY execute this task if Mahil provides the physical board game hex data today.
# If data is NOT provided: skip Task D entirely. Do NOT invent data.

### WHAT IS NEEDED FROM MAHIL:
  For each of the 3 regions (Sacred City, Living Earth, Free Energy):
    • The axial (q,r) coordinates of each bonus token spawn hex
    • The token type at each hex (Government Subsidy / Automatization / Private Initiative / New Building Permits)
    • The pile order for bonus tokens at score thresholds 7, 13, 18

  This is the 8th request for this data. It is the ONLY remaining data dependency.
  The earn mechanism is fully wired in the store (bonusPile, bonusType hexes, 7/13/18 thresholds).
  Without the hex positions: bonuses cannot be activated.

### IF DATA IS PROVIDED:
  Create src/lib/boardLayout.js (or update if exists):
    export const BONUS_POSITIONS = {
      region0: [ { q: N, r: N, type: 'SUBSIDY' }, ... ],
      region1: [ ... ],
      region2: [ ... ],
    }
    export const SCORE_TRACK_BONUSES = {
      7: 'SUBSIDY', 13: 'INITIATIVE', 18: 'AUTOMATIZATION'
    }
  Wire to the game store: wherever bonus hexes are checked, use BONUS_POSITIONS.
  Run vitest: confirm all tests still green.
  Commit with the bonus data.

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/lib/ · src/store/ · src/components/ · scripts/
  NEVER commit .claude/comms/
  Rule 60: verify tool contracts (playwright.config, viewport, etc.)
  Rule 57: prove before patching · distinguish product from harness

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Task D /50 if attempted
  Session /300 · Forge /200 retroactive
  Evolution lesson → .claude/comms/tomorrow.md (disk only)
