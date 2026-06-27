# T3 S15 MASTER FORGE · MOBILE + BOT RACE + NUMEROLOGY CI
# NeoTopia · June 27 2026 · Overnight AUTODRIVE! pre-written
# Prerequisite: T3 S14 complete (comms cleanup · bot race fix · bot health CI)

## S15 MISSION
  Task A: Mobile portrait mode E2E test (verify game works on 375px viewport)
  Task B: Numerological milestone CI assertion (sacred scores appear at right moments)
  Task C: Full suite timing audit (E2E suite should complete in under 3 minutes)

## TASK A · Mobile Portrait E2E (target: 48/50)
  65% of Colonist games are on mobile. NeoTopia should be the same.
  Add a mobile test to game-ux.e2e.js:

  test('game is playable on mobile viewport (375px)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await context.newPage()
    // Navigate to /game
    // Confirm: board is visible (not hidden behind sidebar)
    // Confirm: at least one factory is visible and clickable (44px+ target)
    // Confirm: End Turn button is visible and at full opacity
    // Confirm: no horizontal scroll (body width = 375px)
    await context.close()
  })

  This test catches any future regression where desktop CSS breaks mobile.

## TASK B · Numerological Milestone Assertion (target: 47/50)
  When T2 S15 ships the milestone event system:
  Add a test that confirms the milestone fires at the correct score:

  test('sacred milestone fires at score 9', async () => {
    // Use vitest unit test, not E2E
    // Import the gameStore or the scoring utility
    // Set up a mock game state where a player's score crosses 9
    // Assert: sacredMilestone state is set with milestone=9
    // Assert: message contains 'Nine' and 'Completion'
  })

  This protects the numerology system from regression.

## TASK C · E2E Suite Timing Audit (target: 46/50)
  Run each test file with timing and report:
    npx playwright test tests/e2e/game-ux.e2e.js --reporter=dot 2>&1 | tail -5
    npx playwright test tests/e2e/reconnect.e2e.js --reporter=dot 2>&1 | tail -5
    npx playwright test tests/e2e/two-human.e2e.js --reporter=dot 2>&1 | tail -5
    npx playwright test tests/e2e/phase-over-wire.e2e.js --reporter=dot 2>&1 | tail -5

  If any file exceeds 90s: identify the slow test and add a timeout or mark as slow.
  The CI pipeline should complete in under 3 minutes total.
  Document findings in comms for T3 S16.

## RULES
  NEVER git add -A · NEVER commit comms
  Rule 57: prove before patching · persistence witness before claiming fix
  Evolution lesson → comms (disk only)
