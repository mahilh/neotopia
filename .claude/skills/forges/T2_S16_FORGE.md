# T2 S16 MASTER FORGE · FLOW MODE ENGINE + GLOBAL INDEX VERIFY + BONUS DATA
# NeoTopia · post S15 complete · June 27 2026
# LLM Council verdict: Flow mode engine wiring · live data verify · bonus hex if Mahil provides
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T2 lane: src/lib/ · src/store/ · migrations/ · scripts/

## S15 COMPLETE (T2 committed):
  69fbc14: sacredMilestone events (tryScoreCard fires at 7/9/13/18/27/36)
  4780e00: getGlobalCivilizationTotal() query function
  14400bc: GAME_MODES config + migration 010 (game_sessions.mode)
  Key lesson Rule 62: forge asked to rebuild something already built better. Reconciled.
  The RPC is record_civilization_score. There is no record_civilization_contribution.

## RULES MOST AT RISK THIS SESSION:
  Rule 62: reconcile not rebuild. If a task asks you to replace something that already works,
           verify the existing implementation first. Treat forge code as a sketch of intent.
  Rule 56: verify column names live before coding any DB query.
  Rule 32: never Math.random() in synced/replayable actions.
  Rule 7: premise check: read the engine files before touching them.

## GATES (all 7 required)

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  Confirm: 69fbc14 4780e00 14400bc in log (T2 S15 done)
  Confirm: Rules 61 + 62 + 63 are in CLAUDE.md
  Check T3 comms: did T3 ship sessionId exposure? If yes: T1 can proceed with wire.
  HARD STOP if any rule you are about to violate appears here.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Confirm: T1 is on overlay + FinalScore + mobile fix.
  Confirm: T3 is on sessionId + Flow mode createRoom + mobile guard.
  HARD STOP if T1 or T3 has claimed src/store/ mid-session.

Gate 3 (10 min — READ FULLY before coding):
  cat src/store/gameStore.js | grep -n 'turnTimeRemaining\|endGame\|mode\|phase\|tileStack\|productionTile' | head -30
  cat src/store/gameConfig.js  (FULL FILE — verify GAME_MODES structure)
  Answer before coding:
    a. Where does the game end (what triggers the endgame phase)?
    b. Does turnTimeRemaining decrement via a store action or local timer? (Rule 32 critical)
    c. What is the exact field name for the mode on a game session? (from migration 010)
    d. How does the game read the production tile stack? (to find the end-game tile)
    e. Does getModeConfig() already exist? What does it return?
  Rule 58: read before prescribing. Rule 62: the config is already built. Wire to existing.

Gate 4: npx vitest run 2>&1 | tail -8 · 111 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors required
Gate 6: git log --oneline -10 && git status --short
Gate 7: Read migration 010 to confirm the mode column schema:
  cat migrations/010_*.sql
  Verify: the column is 'mode' TEXT DEFAULT 'classic'. Know what values are valid.

---

## TASK A · Flow Mode Engine Integration (target: 47/50)
# GAME_MODES config shipped in S15. Migration 010 live.
# Now: wire the config to the game engine.
# Flow mode: END_GAME_TILE:9 (not 12) · TURN_TIME_LIMIT:15s (not 90s)

### WHAT TO INTEGRATE:

  1. END GAME on TILE 9 when mode=flow:
    The game currently ends when tile 12 is revealed (last production tile).
    In flow mode, it ends when tile 9 is revealed.
    FIND: the code that checks if the last tile has been revealed.
    Read Gate 3 answer (a) to know exactly where this happens.
    ADD: before the end-game check, read getModeConfig(mode).END_GAME_TILE.
    DO NOT hardcode 9 or 12 anywhere. Read from getModeConfig().

  2. TURN TIMER 15s when mode=flow:
    Rule 32: turnTimeRemaining is a LOCAL countdown tick, never in the store.
    Read Gate 3 answer (b) to find where the timer initializes.
    The timer init value must come from getModeConfig(mode).TURN_TIME_LIMIT.
    DO NOT hardcode 90 or 15. Read from config.

  3. MODE READING PATTERN:
    The game session's mode comes from Supabase (game_sessions.mode column).
    Verify: is the mode already read into the Zustand store? (grep 'mode' in gameStore.js)
    If yes: useGameStore(s => s.mode) or similar.
    If no: it needs to be read from the game_events or game_sessions row on session load.
    Read the session hydration code before deciding.
    DO NOT read mode from a local useState. It must come from the synced store.

  4. DO NOT implement SIMULTANEOUS_DRAW yet.
    SIMULTANEOUS_DRAW=true is the most complex part of Flow mode (all players draw at once).
    It requires T3 coordination (realtime channel changes) and T1 UI changes.
    Mark it as SCOPE OUT in your comms. Wire only END_GAME_TILE and TURN_TIME_LIMIT.

### VITEST: add 3 tests:
  test('getModeConfig classic returns 12-tile 90s', ...)
  test('getModeConfig flow returns 9-tile 15s', ...)
  test('Flow mode engine triggers endgame on tile 9 not 12', ...)
  111 + 3 = 114 green required.

### COMMIT:
  git add src/store/gameStore.js src/store/gameConfig.js (and any engine file touched)
  git commit -m 'feat(engine): Flow mode · 9-tile end-game · 15s timer from getModeConfig · NeoTopia T2 S16'

---

## TASK B · Global Index Live Verification (target: 48/50)
# getGlobalCivilizationTotal() was built in S15 but never run against live data.
# Before T1 wires it into FinalScore, verify it returns real data from production.

### VERIFY:
  Run the function against the live Supabase instance:
    node -e "const s = require('./src/lib/supabase'); s.supabase
      .from('global_neotopia_index').select('total_score')
      .then(({data,error}) => console.log('count:', data?.length, 'error:', error?.message))"
  (Adapt to actual export pattern — verify import path first)
  Expected: data has rows (from bot games) with total_score values.

  ALSO verify: what is the sum? Does it match the bot session totals?
  Compare with: bot-health CI last report's total placed count.
  If the table is empty: investigate why. Did any game actually call record_civilization_score?
  (The FinalScore wire hasn't shipped yet — so it may be empty. That's expected.)
  Document findings in comms for T1.

### IF EMPTY (expected):
  Manually insert a test record to verify the RPC works end-to-end:
  Run the bot (BOT_GAMES=1 BOT_TURNS=20 BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js)
  The bot should call record_civilization_score at game end IF FinalScore wiring exists.
  Since T1 hasn't wired it yet: verify by checking the game_sessions table for completed games.
  At minimum: confirm the RPC function itself exists in the DB.
  (Supabase SQL Editor: SELECT proname FROM pg_proc WHERE proname LIKE '%civilization%';)

### COMMIT:
  (Probably no code changes — this is a verification task)
  If you find and fix a bug in getGlobalCivilizationTotal(): commit with pathspec.
  Document everything in comms.

---

## TASK C · Bonus Hex Data Integration (CONDITIONAL)
# ONLY execute if Mahil provides the physical board game hex data TODAY (9th request).
# If data is NOT provided: skip entirely. DO NOT invent coordinates.

### WHAT IS NEEDED FROM MAHIL:
  For each region (Sacred City, Living Earth, Free Energy):
    - Axial (q,r) coordinates of bonus token spawn hexes
    - Token type at each hex (Government Subsidy / Automatization / Private Initiative / New Building Permits)
    - Score track bonus pile order at 7, 13, 18 points

  This is the 9th request. The earn mechanism is wired in the store.
  Without the coordinates: the bonus token activation cannot be triggered.
  The physical board game (Arcane Wonders 2023) has these coordinates in its board design.

### IF DATA IS PROVIDED:
  Create or update src/lib/boardLayout.js:
    export const BONUS_POSITIONS = {
      region0: [ { q: N, r: N, type: 'SUBSIDY' }, ... ],
      region1: [ ... ],
      region2: [ ... ],
    }
  Wire to the store: wherever bonus hex checks happen, use BONUS_POSITIONS.
  Run vitest: 114 + bonus tests green.
  Commit with pathspec.

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · tests/e2e/
  Rule 62: reconcile not rebuild · GAME_MODES config already exists, don't replace it
  Rule 32: NEVER Math.random() in synced actions · timer is local, mode is from store
  Evolution lesson → comms disk only

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 (if done) · Session /300 · Forge /200 retroactive
