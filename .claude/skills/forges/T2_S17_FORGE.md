# T2 S17 MASTER FORGE · SIMULTANEOUS DRAW + CLUSTER DETAIL + BOT FLOW VERIFY
# NeoTopia · post S16 complete · June 27 2026
# DEEP AUTODRIVE! · 65 rules · 124 tests · Flow mode real end-to-end
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T2 lane: src/lib/ · src/store/ · src/hooks/ · api/ · scripts/ · migrations/

## S16 COMPLETE (T2 committed · HEAD 133f0b9):
  86d0220: GAME_MODES config · getModeConfig() · 5 tests · Flow mode engine wired
  Global Index: WORKING · 0 rows (expected) · RPC exists · bea3bca wires the writer
  Key lesson Rule 62: reconcile over rebuild. Rule 65: trace composed values.

## WHAT T1+T3 SHIPPED (T2 must know):
  4b8d055: sacredMilestone overlay live (reads from store correctly)
  133f0b9: startGame passes gameMode · seam fixed by T3 (T2's initGame was correct)
  1e9e249: sessionId exposed · ced8133: createRoom(mode) wiring
  b810a6a: mobile layout fixed · bea3bca: Global Index wire live
  T1 S17 will ship: factory 44px · lobby toggle · cluster visualization · art skeleton

## RULES MOST AT RISK THIS SESSION:
  Rule 32: NEVER Math.random() in synced/replayable actions.
  Rule 62: reconcile not rebuild. GAME_MODES and getModeConfig are already correct.
  Rule 65: simultaneous draw touches T3's realtime lane. Trace the composed value.
  Rule 56: verify any new DB schema live before coding.
  Rule 40: when two lanes touch one seam, trace the composed value.

## GATES (all 7 required)

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  Confirm: 86d0220 in log · all S16 commits present
  Check comms: what did T1 S17 ship? (factory 44px · lobby toggle — do these affect T2?)
  HARD STOP if any T2 engine file was touched by T1 or T3 mid-session.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Note: T1's cluster visualization request (may ask T2 to add clusterDetail to calculateFinalScore)
  Note: T3's simultaneous draw realtime plan (T2 engine + T3 channel must compose correctly)
  Note: any T3 factory 44px measurements that affect T2 tests

Gate 3 (15 min — READ FULLY · this session touches the game engine core):
  cat src/store/gameStore.js | grep -n 'drawCard\|phase\|mode\|simultaneous\|production_tiles' | head -40
  cat src/lib/patternMatcher.js | head -50
  Answer before coding:
    a. Where does drawCard happen? Is it gated by phase? By turn?
    b. What is the current turn structure? (whose turn is it? how is a turn ended?)
    c. Does the store have a "drawing" phase or sub-phase?
    d. What happens when the last production tile is revealed? (the endgame trigger)
    e. How does tryScoreCard know which player's turn it is?
  cat src/lib/projectCards.js | head -30 (what is the card data structure?)

Gate 4: npx vitest run 2>&1 | tail -8 · 124 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors required
Gate 6: git log --oneline -12 && git status --short
Gate 7: read calculateFinalScore FULLY:
  cat src/store/gameStore.js | grep -A 50 'calculateFinalScore'
  OR: grep -rn 'calculateFinalScore' src/ and read the actual function
  Answer: does it return cluster bonus count? Does it return WHICH clusters?
  This drives Task B (clusterDetail) and T1's visualization.

---

## TASK A · Simultaneous Draw Engine (target: 46/50)
# Flow mode's defining mechanic: when mode=flow, ALL players draw cards in their
# own turn simultaneously, without waiting for the opponent to finish drawing.
# This is architecturally significant. Read Gate 3 fully before designing.

### THE DESIGN QUESTION:
  Current flow: Player A draws → Player A places → Player A ends turn → Player B draws
  Simultaneous flow: BOTH players can draw in parallel within their own turn timeline

  The key insight: in Flow mode with 15s turns, both players should be drawing and
  placing at the same time — not waiting. This means:
  - Draw phase is NOT gated by whose turn it is (in Flow mode)
  - Each player can draw from their own hand at any point in their 15s window
  - The realtime channel needs to handle concurrent draws (T3's lane)

  T2's piece: ENGINE-SIDE logic
    getModeConfig(mode).SIMULTANEOUS_DRAW: false for classic, true for flow
    In the store action that handles drawCard:
      if (SIMULTANEOUS_DRAW && currentPhase === 'playing'):
        allow ANY player to draw (not just the current turn holder)
        each player draws from their own hand (no shared deck collision)
    This is safe because each player has their own hand — no concurrency conflict
    The conflict prevention: server-side RLS (player can only write their own events)

  CRITICAL (Rule 32): the draw action must NOT use Math.random() for which card is drawn
  The draw must be deterministic (seeded from game_session seed + event sequence)
  Verify the existing draw mechanism is already deterministic before modifying.

### IMPLEMENTATION:
  Read the drawCard action in gameStore.js FULLY.
  Verify: is the card draw order deterministic? (seeded from the game seed?)
  If YES: add a conditional:
    if (getModeConfig(currentMode).SIMULTANEOUS_DRAW || isMyTurn) {
      // allow drawing
    }
  If NO: flag it in comms for T3 before touching simultaneous draw.

  Add to getModeConfig return: { ...existing, SIMULTANEOUS_DRAW: mode === 'flow' }

### VITEST: 3 new tests:
  test('Flow mode allows simultaneous draw for non-turn player')
  test('Classic mode gates drawing to current turn player only')
  test('Simultaneous draw does not share cards between players')
  124 + 3 = 127 green required.

### COMMIT:
  git add src/store/gameStore.js src/store/gameConfig.js
  git commit -m 'feat(engine): simultaneous draw for Flow mode · turn-agnostic draw gate · NeoTopia T2 S17'

### WRITE TO COMMS:
  'T3: simultaneous draw engine shipped. The draw gate is now mode-dependent.
   In Flow mode, drawCard allows any player to draw regardless of turn.
   T3 needs: Supabase channel to handle concurrent draw_card events from both players
   without collision. The engine is deterministic; the channel is the remaining seam.
   See getModeConfig().SIMULTANEOUS_DRAW for the flag.'

---

## TASK B · Cluster Scoring Detail (target: 47/50)
# calculateFinalScore knows how many cluster bonus points were earned.
# Players should know WHICH elements formed the clusters.
# T1 is building the visualization — T2 provides the data.

### VERIFY FIRST (Gate 7 answer):
  Read calculateFinalScore FULLY. Find where cluster bonus is computed.
  If it already returns clusterDetail: document the shape for T1 in comms.
  If it only returns the total cluster bonus: add the detail.

### WHAT TO ADD:
  The cluster BFS (Rule 10) groups connected scored cards by element.
  We want: for each cluster, which element and how large?
  Add to calculateFinalScore return:
    clusterDetail: [
      { element: 'Energy', count: 3, bonus: 3 },
      { element: 'BioFarming', count: 2, bonus: 2 },
    ]
  Where bonus = count (or whatever the actual cluster scoring rule is — read it).

  If changing calculateFinalScore is risky (many callers): add a new companion function:
    getClusterDetail(scores[], scoredCards[]) → clusterDetail[]
  T1 can call this separately in FinalScore.

### VITEST: 2 new tests:
  test('getClusterDetail identifies Energy cluster of size 3')
  test('getClusterDetail returns empty for no clusters')
  127 + 2 = 129 green required.

### WRITE TO COMMS:
  'T1: cluster detail function is [calculateFinalScore.clusterDetail / getClusterDetail()].
   Shape: [{element, count, bonus}]. Import from: [exact path].
   Each element matches the ELEMENT_COLORS keys you already import.'

### COMMIT:
  git add src/lib/projectCards.js (or gameStore.js — wherever calculateFinalScore lives)
  git commit -m 'feat(engine): cluster scoring detail · element+count+bonus per cluster · NeoTopia T2 S17'

---

## TASK C · Bot Flow Mode Verification (target: 45/50)
# Flow mode is real end-to-end (133f0b9). But the bot has never played a Flow game.
# Verify the bot correctly plays a 9-tile Flow game to completion.

### WHAT TO DO:
  Run the bot against a Flow mode game:
    BOT_GAMES=1 BOT_TURNS=15 BOT_MODE=flow BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
  (Check if bot-simulate.js supports a mode flag — read it first)
  If it does NOT support mode: add a BOT_MODE env var:
    const mode = process.env.BOT_MODE || 'classic'
    // pass mode to createRoom or startGame

  Expected result of a Flow mode game:
    - Game ends after 9 production tiles (not 12)
    - Each turn is 15s timer (bot should complete faster)
    - FinalScore appears with correct scoring
    - Global Index should receive the first real civilization record!

  Document in comms:
    - Did the Flow game end at tile 9?
    - Did the FinalScore appear?
    - Did global_neotopia_index receive a row? (check via Supabase)
    - Any errors in bot output?

### BOT HEALTH CI:
  Update bot-health.yml to also run a Flow mode bot game:
    BOT_GAMES=1 BOT_MODE=flow node scripts/bot-simulate.js
  Add after the classic game verification.

### COMMIT (if bot changes needed):
  git add scripts/bot-simulate.js .github/workflows/bot-health.yml
  git commit -m 'feat(bot): Flow mode support · BOT_MODE env · verify 9-tile end · NeoTopia T2 S17'

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · tests/e2e/
  Rule 32: NEVER Math.random() in simultaneous draw · must be deterministic
  Rule 62: GAME_MODES and getModeConfig are correct — reconcile not rebuild
  Rule 65: simultaneous draw touches T3's realtime · write to comms BEFORE T3 needs it
  Evolution lesson → comms · NEVER commit comms

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive
