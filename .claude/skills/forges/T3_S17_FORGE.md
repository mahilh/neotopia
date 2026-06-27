# T3 S17 MASTER FORGE · FLOW E2E TEST + 44px GUARD UPGRADE + SIMULTANEOUS DRAW REALTIME
# NeoTopia · post S16 complete · June 27 2026
# DEEP AUTODRIVE! · 65 rules · 124 tests · HEAD 133f0b9
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T3 lane: src/hooks/useGameRoom.js · useGameSync.js · tests/e2e/

## S16 COMPLETE (T3 committed · HEAD 133f0b9):
  1e9e249: sessionId exposure (unblocked T1's Global Index wire)
  ced8133: createRoom(mode) wiring
  133f0b9: SEAM FIX · startGame passes gameMode · Flow seeds 9 tiles/15s REAL
  Mobile guard: board ≥200px HARD · factory 32px MEASURED (not faked-green)
  Rule 65 (T3 S16): When two lanes touch one seam, trace the composed value after both edits.

## WHAT T1+T2 SHIPPED (T3 must know):
  b810a6a: mobile layout fix (board 343px at 375px)
  4b8d055: sacredMilestone overlay
  86d0220: Flow mode engine (9-tile/15s)
  T1 S17 will ship: factory 44px fix + lobby toggle + cluster viz
  T2 S17 will ship: simultaneous draw engine + cluster detail + bot Flow verify

## RULES MOST AT RISK THIS SESSION:
  Rule 63: write tests that tell the truth · gate only what's verified true
  Rule 65: simultaneous draw channel touches T2's engine · trace the composed value
  Rule 55: screenshot mobile guard upgrade · verify T1's factory fix visually first
  Rule 40: when T2 ships simultaneous draw engine and T3 ships the channel, trace the seam
  Rule 1: pathspec commits only

## GATES (all 7 required)

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  Confirm: 133f0b9 in log
  Check T1 comms: factory 44px shipped? (affects Task B gate)
  Check T2 comms: simultaneous draw engine design (needed for Task C)
  HARD STOP if useGameSync.js or useGameRoom.js has M from another terminal.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Note T2's simultaneous draw comms entry (exact channel events expected)
  Note T1's factory fix method (needed for guard upgrade)

Gate 3 (12 min — READ FULLY before Task C):
  cat src/hooks/useGameSync.js FULL
  cat src/hooks/useGameRoom.js FULL
  Answer before coding Task C:
    a. How are game events currently broadcast? (Supabase Realtime channel)
    b. What channel does draw_card use? (the same as place_element?)
    c. Is there any turn-gating on the realtime event reception?
    d. What happens if TWO draw_card events arrive simultaneously from both players?
    e. Does the channel handle event ordering? (important for determinism)

Gate 4: npx vitest run 2>&1 | tail -8 · 124 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors required
Gate 6: git log --oneline -12 && git status --short
Gate 7: verify Flow mode is ACTUALLY real end-to-end:
  node -e "
    // Check the seam: does getModeConfig('flow') return END_GAME_TILE: 9?
    const {getModeConfig} = require('./src/store/gameConfig.js');
    console.log('flow config:', getModeConfig('flow'));
  " 2>/dev/null || echo '(run from ~/NeoTopia · verify manually)'

---

## TASK A · Flow Mode E2E Test (target: 48/50)
# Flow mode is real end-to-end (133f0b9 seam fix). But there is NO E2E test for it.
# This test will catch any future regression of the 9-tile end or 15s timer.

### WHAT TO BUILD: tests/e2e/flow-mode.e2e.js

  This test verifies the complete Flow mode game lifecycle:
    1. Create a room in Flow mode
    2. Start the game
    3. Play until the game ends
    4. Verify: game ended at exactly 9 tiles (not 12)
    5. Verify: FinalScore appeared
    6. Verify: the timer was 15s (check the DOM for timer display if present)

  Pattern (solo bot game for CI-cheapness like mobile.e2e.js):
    - Solo /game in Flow mode (no Supabase peer)
    - Create room with mode='flow'
    - Let the game auto-play (or use the bot helper)
    - Assert: game ends before 12 tiles
    - Assert: phase transitions to 'finished' or FinalScore renders

  Read tests/e2e/game-ux.e2e.js and mobile.e2e.js for pattern before writing.
  The test must be INDEPENDENT (no shared state between tests · Rule 33).
  The test must be CI-cheap (< 60s · no Supabase required).

  Hard assertions:
    expect(tilesPlaced).toBeLessThanOrEqual(9)  // Flow mode ends at 9 tiles
    expect(finalScoreVisible).toBe(true)          // FinalScore must appear

  Soft assertions (measure, not gate):
    expect(turnDuration).toBeLessThan(20000)       // 15s + 5s grace

### ADD TO CI:
  In .github/workflows/ci.yml or the fast-guard:
  Add flow-mode.e2e.js alongside the other E2E tests.
  Verify: the test file runs independently with playwright.

### VITEST + PLAYWRIGHT:
  The E2E test uses playwright (not vitest).
  npx playwright test tests/e2e/flow-mode.e2e.js --reporter=dot 2>&1 | tail -5
  Verify: PASSES before committing (Rule 63 · write tests that tell the truth).

### COMMIT:
  git add tests/e2e/flow-mode.e2e.js (+ CI yaml if changed)
  git commit -m 'test(e2e): Flow mode complete game · 9-tile end-gate · FinalScore verify · NeoTopia T3 S17'

---

## TASK B · Factory 44px Guard Upgrade (CONDITIONAL on T1 S17 Task A)
# The mobile guard currently measures factory size but does NOT hard-gate at 44px.
# Once T1 ships the fix, upgrade the guard to hard-gate.
# Rule 63: gate only what's verified true. Measure first. Gate after.

### PREREQUISITE CHECK:
  git log | grep -i 'factory\|44px\|touch'
  IF T1's factory fix is NOT in log: write 'Task B SKIPPED pending T1 S17 Task A' in comms.
  IF T1's fix IS in log: proceed.

### IF T1's FIX LANDED:
  Run the mobile test FIRST:
    npx playwright test tests/e2e/mobile.e2e.js --reporter=dot 2>&1 | tail -8
  Measure the actual factory size:
    const factorySize = await page.evaluate(() => {
      const f = document.querySelector('[class*="factory"], [data-factory]');
      return f ? f.getBoundingClientRect() : null;
    });
  IF factorySize.height >= 44 AND factorySize.width >= 44:
    UPGRADE the soft assertion to hard:
      expect(factoryMaxDim).toBeGreaterThanOrEqual(44)  // now a hard gate
    SCREENSHOT (Rule 55): factory at 375px showing ≥44px measured
  IF factorySize < 44: DON'T upgrade · measure and route back to T1 · write to comms.

### COMMIT (if upgrade done):
  git add tests/e2e/mobile.e2e.js
  git commit -m 'test(e2e): factory touch target guard → 44px hard-gate · NeoTopia T3 S17'

---

## TASK C · Simultaneous Draw Realtime Channel (target: 44/50)
# T2 S17 ships the engine-side simultaneous draw logic.
# T3 ships the channel-side: Supabase Realtime must handle concurrent draw events.
# Rule 65: trace the composed value after BOTH edits (T2 engine + T3 channel).
# Rule 40: two lanes touching one seam. Trace end-to-end.

### PREREQUISITE: read T2's comms entry for simultaneous draw.
  The comms will say exactly:
    - What event type is used (draw_card?)
    - What the draw_card event payload looks like
    - What the engine expects from the channel
  If T2 comms entry is missing: wait for it. DO NOT design the channel blind.

### THE SEAM:
  Current flow:
    T2 engine: drawCard() action (turn-gated in Classic, now turn-agnostic in Flow)
    T3 channel: receives draw_card events from Supabase and updates the opponent's view

  The problem to solve:
    In Flow mode, BOTH players draw simultaneously. The channel must:
    1. Accept draw_card events from BOTH players at the same time (no mutual exclusion)
    2. Update EACH player's hand state correctly (player A's draw only updates player A's hand)
    3. NOT apply player A's drawn card to player B's hand (this would be a bug)
    4. Handle event ordering: if events arrive out of order, the game state must still be consistent

  Gate 3 answer drives the implementation:
    IF events are already player-scoped (payload includes player seat):
      Each player only applies events where event.seat === mySeat
      Simultaneous draw is already safe — add a test to prove it
    IF events are NOT player-scoped:
      Add seat scoping to the draw_card event handler
      Each player's draw only mutates their own hand

### IMPLEMENTATION:
  Read useGameSync.js's event handler for draw_card.
  Find: does it check event.seat before applying?
  If YES: write a unit test proving simultaneous draw doesn't cross-contaminate
  If NO: add the seat check:
    case 'draw_card':
      if (event.seat !== mySeat) return  // in Flow: other players draw their own hands
      // apply to local state only

  ADD TESTS:
    test('Simultaneous draw does not apply opponent card to own hand')
    test('Both players can receive draw_card events without collision')

### COMMIT:
  git add src/hooks/useGameSync.js (and useGameRoom.js if event source changes)
  git commit -m 'feat(sync): simultaneous draw channel · seat-scoped events · no cross-contamination · NeoTopia T3 S17'

---

## TASK D · Presence Improvements (target: 43/50)
# Show who is online and what mode they are in.
# This makes the lobby feel alive and the civilization feel real.

### WHAT TO BUILD:
  In usePresence.js, the presence payload already tracks connected users.
  Add to the presence payload:
    { userId, username, status: 'in_lobby' | 'in_game' | 'in_flow_game' | 'idle' }

  In the Lobby.jsx (T1's file — write to comms, don't edit it):
    T1 can display a presence counter: "3 players online · 1 in a game"

  In the actual presence hook:
    const presencePayload = {
      userId: auth.user.id,
      username: auth.user.email?.split('@')[0] ?? 'Architect',
      status: isInGame ? (currentMode === 'flow' ? 'in_flow_game' : 'in_game') : 'in_lobby',
      mode: currentMode,
    }

### COMMIT:
  git add src/hooks/usePresence.js
  git commit -m 'feat(presence): mode-aware status · in_flow_game · in_lobby · NeoTopia T3 S17'

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · src/lib/ · src/store/ · migrations/
  Rule 63: Flow E2E test must PASS before committing · gate only true things
  Rule 65: simultaneous draw channel seam · read T2 comms BEFORE designing
  Rule 40: trace composed value after T2 engine + T3 channel are both shipped
  Evolution lesson → comms · NEVER commit comms

## SELF-RATE
  Task A /50 · Task B /50 (conditional) · Task C /50 · Task D /50
  Session /300 · Forge /200 retroactive
