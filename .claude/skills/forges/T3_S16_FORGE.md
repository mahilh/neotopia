# T3 S16 MASTER FORGE · sessionId EXPOSURE + FLOW MODE CREATEROOM + MOBILE GUARD
# NeoTopia · post S15 complete · June 27 2026
# LLM Council verdict: T3 S16 is the PREREQUISITE session. sessionId unblocks T1's wire.
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T3 lane: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/

## S15 COMPLETE (T3 committed):
  5ee8ef8: CI fast guard + mobile-render at 375px
  mobile.e2e.js: mobile guard (375px solo /game)
  tests/numerology.test.js: SACRED=[7,9,13,18,27,36] locked
  E2E timing audit: ~53s total < 180s
  CRITICAL FINDING: 55px board at 375px · sidebar squeezes board · ROUTED TO T1 S16
  Key lesson Rule 63: write tests that tell the truth. Gate what's true. Name the gap.

## RULES MOST AT RISK THIS SESSION:
  Rule 60: a tool's contract is a premise. Read useGameSync.js FULLY before adding to it.
  Rule 63: the mobile guard is currently honest (measuring the gap). Keep it honest.
           Upgrade to hard-gate ONLY after T1 ships the fix and you verify it visually.
  Rule 55: if you upgrade the mobile guard, screenshot-verify the fix first.
  Rule 1: NEVER git add -A. Only T3 files.

## GATES (all 7 required)

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  Confirm: T3 S15 commits in log (5ee8ef8 + mobile.e2e.js + numerology.test.js)
  Confirm: Rule 61 + 62 + 63 in list
  Check: has T1 S16 Task C (mobile fix) landed? git log | grep -i 'mobile'
  This answer determines Task C execution.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Confirm: T1 on overlay + FinalScore + mobile fix.
  Confirm: T2 on Flow mode engine + Global Index verify.
  HARD STOP if T1 or T2 has claimed useGameSync.js.

Gate 3 (10 min — READ FULLY before coding Task A):
  cat src/hooks/useGameSync.js  (FULL FILE)
  Answer before coding:
    a. What does useGameSync currently return? (List every field in the return object)
    b. Does useGameSync read from Zustand? Which store fields?
    c. Is there a sessionId in the Zustand store at all? (grep 'sessionId' in gameStore.js)
       If not: where does the session ID live? (in Supabase? in useGameRoom? in the URL?)
    d. How does useGameRoom.js load a session? (Does it store the session ID on load?)
  Rule 60: the hook's contract is a premise. Understand the full return shape before changing it.
  Rule 61: only after understanding the chain can you prove the value will be non-null.

Gate 4: npx vitest run 2>&1 | tail -8 · 111 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors required
Gate 6: git log --oneline -10 && git status --short
  Confirm only T3 files in working tree.
Gate 7: Read src/hooks/useGameRoom.js FULLY
  Find: where does the session ID first become available to the frontend?
  This is the chain: Supabase row → React state/store → useGameSync return.
  Trace it fully before prescribing.

---

## TASK A · sessionId EXPOSURE FROM useGameSync (target: 49/50)
# URGENT PREREQUISITE. T1 cannot wire recordCivilizationDetail without this.
# T1 S15 refused to ship a silent no-op (Rule 61). This is the fix.
# One line. But must be the RIGHT one line.

### WHAT T1 FOUND:
  T1's forge said: sync?.sessionId
  Reality: useGameSync returns { sendMove, pushState, broadcast }
  sync.sessionId is undefined. The wire to recordCivilizationDetail would have been a silent no-op.
  T1 correctly refused and flagged T3.

### THE FIX (after Gate 3 research):
  STEP 1: Trace the session ID chain (Gate 3 answers b,c,d).
  STEP 2: If sessionId is in the Zustand store:
    In useGameSync.js, read it:
      const sessionId = useGameStore(s => s.sessionId)
    Add it to the return:
      return { sendMove, pushState, broadcast, sessionId }
  STEP 3: If sessionId is NOT in the Zustand store:
    Find where the session row is loaded in useGameRoom.js.
    When the session is created or loaded, store the ID:
      useGameStore.setState({ sessionId: session.id })
    Then follow Step 2.
  STEP 4: Write a unit test:
    test('useGameSync returns sessionId when session is loaded', () => {
      // mock useGameStore to return a sessionId
      // verify the hook's return includes it
    })

### RULE 61 IN ACTION:
  After shipping this: add a console.log in your own test:
    console.log('[T3 S16] sessionId exposed:', sessionId)
  The non-null, non-undefined value is the proof. Log it in the commit message:
  "sessionId exposed: verified non-null in live dev session"

### WRITE TO COMMS:
  Tell T1 the exact sessionId value type and field name:
  "T1: sessionId is now available as sync.sessionId (string UUID).
   Import path: ... · verified non-null in [session ID]"

### COMMIT:
  git add src/hooks/useGameSync.js (and gameStore.js if sessionId field added)
  git commit -m 'feat(sync): expose sessionId from useGameSync · unblocks FinalScore Global Index wire · NeoTopia T3 S16'

---

## TASK B · Flow Mode createRoom(mode) Wiring (target: 46/50)
# T2 S15 shipped GAME_MODES config and migration 010.
# T1 will ship the lobby toggle.
# T3 ships the createRoom(mode) wiring: pass mode to Supabase on room creation.

### WHAT TO BUILD:
  Find where a new game session is created in T3's lane (useGameRoom.js or similar).
  Read Gate 3 + Gate 7 answers to find the createRoom or initSession call.
  Currently: INSERT into game_sessions with default mode ('classic').
  After fix: INSERT into game_sessions with mode from the lobby's selection.

  The mode value is determined by T1's lobby toggle.
  T3 needs to receive it and pass it through.
  Pattern:
    // Wherever createRoom is called:
    const { mode = 'classic' } = options
    // Verify GAME_MODES includes the mode:
    const config = getModeConfig(mode)  // from gameConfig.js
    // INSERT with mode:
    .insert({ ..., mode })

  VERIFY: migration 010 is applied (Gate 7). The column exists.
  DO NOT add CHECK constraint on mode column (keep it extensible for future modes).

### VITEST: add 2 tests:
  test('createRoom with flow mode passes mode=flow to Supabase')
  test('createRoom defaults to classic mode when no mode specified')
  111 + 2 = 113 green required (or 114 if T2 shipped their tests).

### COMMIT:
  git add src/hooks/useGameRoom.js (or wherever createRoom lives)
  git commit -m 'feat(sync): createRoom accepts mode param · passes to game_sessions · Flow mode wiring · NeoTopia T3 S16'

---

## TASK C · Mobile Guard Upgrade (CONDITIONAL on T1 S16 Task C ship)
# Rule 63: gate only what's true. The current guard is honest (measures 55px gap).
# Upgrade to hard 44px gate ONLY after T1's fix is in git log and visually verified.

### PREREQUISITE CHECK:
  git log | grep -i 'mobile layout\|mobile fix\|flex-direction\|sidebar column'
  If T1's mobile fix is in log: proceed.
  If NOT: write 'T3 Task C SKIPPED pending T1 S16 Task C' in comms. Stop.

### IF T1'S FIX LANDED:
  First: run the mobile test against the fix:
    npx playwright test tests/e2e/mobile.e2e.js --reporter=dot 2>&1 | tail -5
  If the test now passes (board > 44px): upgrade the assertion.
  Open tests/e2e/mobile.e2e.js:
    FIND the soft assertion (the one that measures but doesn't hard-fail on 55px).
    CHANGE: expect(boardWidth).toBeGreaterThan(0) [or similar soft gate]
    TO: expect(boardWidth).toBeGreaterThanOrEqual(200)  // board must be at least 200px
  ALSO CHANGE the factory touch target assertion:
    FROM: the soft measure-and-log
    TO: expect(factoryMaxDim).toBeGreaterThanOrEqual(44)  // Rule 4: 44px minimum

### SCREENSHOT BEFORE COMMITTING (Rule 55 + Rule 63):
  Screenshot the game at 375px AFTER the upgrade shows the guard passing.
  This proves the hard gate is legitimate, not aspirational.

### COMMIT:
  git add tests/e2e/mobile.e2e.js
  git commit -m 'test(e2e): upgrade mobile guard to hard-gate · 44px factory targets · 200px board min · NeoTopia T3 S16'

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · src/lib/ · src/store/ · migrations/
  Rule 60: tool contracts are premises · useGameSync return shape is a contract
  Rule 63: truth-gating only · never upgrade a guard before verifying the fix
  Evolution lesson → comms disk only

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 (if done) · Session /300 · Forge /200 retroactive
