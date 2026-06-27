# T3 S18 MASTER FORGE · LIVE-DB FLOW E2E + BOT HEALTH CI + DRAW RPC WIRE
# NeoTopia · post S17 complete · June 27 2026
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T3 lane: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/

## S17 COMPLETE (T3 committed · 4 commits on origin):
  1929db2: Flow E2E (gray-box via __neotopia_store · deterministic · <5s · no Supabase)
  8e75feb: factory 44px hard-gate (Rule 63+67 · waited for commit boundary)
  17f5931: sim-draw characterization (concurrent draws CLOBBER · T2 design hand-off)
  90637ec: presence mode-aware (in_lobby/in_game/in_flow_game · 3 tests)
  Rule 67 (T3 S17): CI gate must key on commit boundary, not working-tree truth

## KEY S17 FINDINGS THAT DRIVE S18:
  1. Sync is SNAPSHOT-based (not event-reducer). No 'draw_card' reducer exists.
     Concurrent draws are last-write-wins · a draw CAN be lost.
     Fix: T2 designs atomic draw RPC in S18 · T3 wires it.
  2. Flow E2E is gray-box only (no DB). Need live-DB variant for real coverage.
  3. Bot-health CI has no Flow mode nightly run yet.
  4. Cluster points now implemented by T2 S18 · T3's tests should verify score change.

## RULES MOST AT RISK:
  Rule 63: live-DB E2E must use real Supabase · no mocking the network layer
  Rule 67: all CI gates key on commit boundaries
  Rule 40+65: draw RPC wire touches T2's new RPC + T3's channel · trace composed value
  Rule 62: the draw fix is NOT adding a case 'draw_card': reducer · wrong architecture
  Rule 1: pathspec commits only

## GATES (all 7 required)
Gate 1: git pull --rebase · cat .claude/CLAUDE.md | head -80
  Confirm: 1929db2 8e75feb 17f5931 90637ec in log (T3 S17 done)
  Check T2 comms: has T2 S18 Task A (cluster points) shipped?
  Check T2 comms: has T2 S18 Task C (migration 011 draw RPC) shipped?
  Task D gates on migration 011 being in git log.
Gate 2: cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Note T2's atomic draw RPC spec (function name, parameters, return type)
  Note T1's landing page changes (affects E2E if it tested the counter)
Gate 3 (MANDATORY before Task A):
  cat src/hooks/useGameRoom.js FULL
  cat src/hooks/useGameSync.js | grep -n 'broadcast\|snapshot\|state\|channel' | head -30
  Answer:
    a. What test-ids does T1's lobby expose? (data-testid=mode-flow confirmed in 5d759aa)
    b. How does the room creation URL or route work? (needed for E2E navigation)
    c. What is the Supabase channel name pattern? (needed to verify real-time sync)
Gate 4: npx vitest run 2>&1 | tail -8 · 137 green required (or 141 if T2 S18 Task A shipped)
Gate 5: npm run build 2>&1 | tail -5 · 0 errors
Gate 6: git log --oneline -12 && git status --short
Gate 7: verify the Flow E2E still passes from S17:
  npx playwright test tests/e2e/flow-mode.e2e.js --reporter=dot 2>&1 | tail -5
  Must pass before adding new tests.

---

## TASK A · Live-DB UI Flow E2E (target 47/50)
# The S17 Flow E2E is gray-box (no Supabase). This is the real version.
# Uses T1's lobby testids (data-testid=mode-flow from 5d759aa) to test the full flow:
# create room → select Flow mode → start game → game is in Flow mode → verify.

### WHAT TO BUILD: tests/e2e/flow-mode-live.e2e.js
  This test:
    1. Navigates to the lobby
    2. Clicks data-testid=mode-flow (T1's toggle)
    3. Creates a room (solo or via the bot)
    4. Verifies game_sessions.mode = 'flow' in the DB
    5. Verifies the game timer shows 15s (not 90s)
    6. Verifies the game ends when 9 tiles are placed (not 12)

  Pattern: use seedHelpers.js to create a Supabase client for verification
  The test DOES talk to Supabase (that's the point — live-DB coverage).
  Read tests/e2e/two-human.e2e.js for the Supabase pattern before writing.
  Read tests/e2e/seedHelpers.js for the DB verification helpers.

### CI:
  This is a more expensive test (needs Supabase) — put it in the slow E2E group.
  NOT in the fast-guard CI. In the nightly or PR CI.
  Check .github/workflows/ci.yml to see which group it belongs in.

### VITEST: no vitest changes (this is playwright)
  npx playwright test tests/e2e/flow-mode-live.e2e.js --reporter=dot 2>&1 | tail -5
  Must pass before committing (Rule 63).

### COMMIT:
  git add tests/e2e/flow-mode-live.e2e.js (+ CI yaml if changed)
  git commit -m 'test(e2e): live-DB Flow mode UI · lobby toggle · DB mode verify · 15s timer · NeoTopia T3 S18'

---

## TASK B · Bot-Health CI: Add Flow Mode Nightly Run (target 45/50)
# T2's bot v4.6 supports BOT_MODE=flow. The CI should verify it nightly.
# bot-health.yml is T3's file.

### WHAT TO ADD:
  In .github/workflows/bot-health.yml:
  After the existing classic bot game step, add:
    - name: Bot Flow mode game
      run: BOT_GAMES=1 BOT_MODE=flow BOT_TURNS=20 BOT_URL=${{ env.BOT_URL }} node scripts/bot-simulate.js 2>&1 | tail -20
  The step should fail CI if BOT_MODE=flow was not achieved (bot v4.6 reports this).
  Read bot-health.yml FULLY before editing (Rule 58).

### COMMIT:
  git add .github/workflows/bot-health.yml
  git commit -m 'ci: bot-health nightly Flow mode game · BOT_MODE=flow verify · NeoTopia T3 S18'

---

## TASK C · Cluster Score Impact Test (target 44/50)
# T2 S18 Task A implements cluster→points. T3 should add an E2E-level guard.
# GATE: git log | grep -i 'cluster.*point\|cluster.*bonus' (needs T2 S18 Task A)

### IF T2 HAS SHIPPED:
  Add to tests/numerology.test.js (or a new cluster-scoring.test.js):
    test('cluster bonus increases final score over no-cluster baseline')
    test('biggest cluster wins, not sum of all clusters')
    test('cluster bonus is 0 when no elements are adjacent')
  These tests verify the board game rule is implemented correctly.
  Read T2's getClusterDetail export before writing (Rule 25).

### COMMIT:
  git add tests/numerology.test.js (or new test file)
  git commit -m 'test: cluster scoring guard · 1pt/element in biggest cluster · board game rule · NeoTopia T3 S18'

---

## TASK D · Draw RPC Channel Wire (CONDITIONAL on T2 S18 Task C + migration 011)
# GATE: git log | grep -i 'migration 011\|atomic.*draw\|draw_card.*rpc'
# If migration 011 is NOT in log: SKIP and write 'Task D SKIPPED pending T2 S18 Task C' in comms.

### IF MIGRATION 011 SHIPPED:
  Read T2's comms entry for the exact RPC spec:
    - Function name: draw_card_for_seat(p_session_id, p_seat)
    - Returns: JSONB (the drawn card)
  In useGameRoom.js, find the drawCard action.
  VERIFY: how does the current drawCard work? (local state + broadcast? or RPC?)
  Add the atomic RPC call:
    const drawnCard = await supabase.rpc('draw_card_for_seat', {
      p_session_id: sessionId,
      p_seat: mySeat
    })
  Replace the current local-state draw with the RPC result.
  DO NOT add a 'draw_card' case to the event reducer — that architecture is wrong (Rule 62).
  The RPC updates DB · Supabase realtime handles sync to other player.

### COMPOSE-VALUE TRACE (Rule 40+65):
  After T2's RPC and T3's channel wire are both in origin, verify:
    1. Player A draws → RPC called → DB updated → Player B's realtime fires → B sees A's card gone
    2. Player B draws simultaneously → same path → no CLOBBER
  Write a unit test for this composed behavior.

### COMMIT:
  git add src/hooks/useGameRoom.js
  git commit -m 'feat(sync): atomic draw RPC wire · no-clobber concurrent draws · NeoTopia T3 S18'

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · src/lib/ · src/store/ · migrations/
  Rule 62: DO NOT add case 'draw_card': to useGameSync · wrong architecture
  Rule 67: all CI gates key on commit boundaries · not working-tree truth
  Rule 40+65: trace composed value after T2 RPC + T3 wire (Task D)
  Evolution lesson → comms disk only

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 (conditional) · Task D /50 (conditional)
  Session /300 · Forge /200 retroactive
