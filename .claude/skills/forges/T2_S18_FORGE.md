# T2 S18 MASTER FORGE · CLUSTER POINTS + DRAW RPC + CLEAN FLOW BOT GAME
# NeoTopia · post S17 complete · June 27 2026
# Highest-value session in S18. Cluster→points is the most critical missing feature.
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T2 lane: src/lib/ · src/store/ · scripts/ · migrations/

## S17 COMPLETE (T2 committed · 3 commits on origin):
  b092dd6: getClusterDetail(regions) + simultaneous-draw gate
    - getClusterDetail is PURE · reuses BFS · element keys LOWERCASE
    - count-only · no bonus field (correct — points rule not yet implemented)
  a33b0c5: bot v4.6 Flow mode support
  7537b30: bot honesty fix (mode reporting truth)
  T2 S17 forge was 150/200 (caught 4 stale premises) · gates worked
  Key finding: cluster→points rule not in CODE but IS in board game rulebook

## THE BOARD GAME RULE (page 9 of rulebook · previously missing from T2's knowledge):
  "Before calculating their final score on each Region, each player will gain
   1 Point for each Element Token of their color on the biggest cluster of
   those Elements in each Region."
  This means: for each region + element type → find biggest connected group
  → add 1pt per element in that group to the region score.
  This is the EXACT rule. Implementation is in T2 lane.
  T1 S18 Task B gates on this commit and updates the display.

## RULES MOST AT RISK:
  Rule 32: cluster points come from the board game rule · the rule is NOW KNOWN
           so implementing it is correct · not inventing data
  Rule 10: cluster BFS before final scoring (this rule exists because of THIS feature)
  Rule 62: getClusterDetail already exists · extend it, don't replace it
  Rule 7: read calculateFinalScore FULLY before touching it
  Rule 56: verify every field name live before coding

## GATES (all 7 required)
Gate 1: git pull --rebase · cat .claude/CLAUDE.md | head -80
  Confirm: b092dd6 a33b0c5 7537b30 in log (T2 S17 done)
  Read board game rule in CLAUDE.md: 1pt per element in biggest cluster per region
Gate 2: cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Note: T3's simultaneous draw design hand-off from S17 (4 composed-seam bugs listed)
  Note: T1's cluster viz details (namespace-guard · count-only · T1 is waiting)
Gate 3 (MANDATORY · read every function fully):
  grep -n 'calculateFinalScore\|getClusterDetail\|clusterBonus\|cluster' src/store/gameStore.js | head -30
  cat src/lib/patternMatcher.js | grep -A 30 'getClusterDetail\|BFS\|cluster'
  Answer before coding:
    a. What EXACTLY does getClusterDetail currently return? (field names + types)
    b. What does calculateFinalScore currently do with clusters? (does it call getClusterDetail?)
    c. Where does final score get applied to the store? (what action?)
    d. Are element keys in getClusterDetail lowercase? (VERIFIED in S17: yes)
Gate 4: npx vitest run 2>&1 | tail -8 · 137 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors
Gate 6: git log --oneline -12 && git status --short
Gate 7: verify the cluster BFS works correctly:
  node -e "const {getClusterDetail}=require('./src/lib/patternMatcher.js'); console.log(typeof getClusterDetail)"
  Confirm it exports correctly and runs without error.

---

## TASK A · Cluster Points Implementation (target 49/50)
# THE most critical missing feature. The board game rule is clear and known.
# This session: implement 1pt per element in biggest cluster per region.

### THE ALGORITHM (board game rule encoded):
  For each region in the game (Sacred City, Living Earth, Free Energy):
    For each element type (energy, biofarming, technology, community):
      Run BFS on that element's hex positions in the region
      Find the BIGGEST connected group (most elements touching each other)
      Cluster bonus = number of elements in that group
  Total cluster bonus across all regions = added to the player's final score.

### EXTEND getClusterDetail:
  Current: getClusterDetail(regions) → [{element, count}]
  After: getClusterDetail(regions) → [{element, count, bonus}]
    where bonus = count (1pt per element in biggest cluster)
  Rule 62: add the bonus field — do NOT replace count.
  Rule 32: bonus = count. This IS the rule. Not fabricated.

### INTEGRATE INTO calculateFinalScore:
  After calculating best+second+(worst×3)+(unused×3):
    const clusterDetail = getClusterDetail(regions)
    const clusterTotal = clusterDetail.reduce((sum, c) => sum + (c.bonus ?? 0), 0)
    total += clusterTotal
  Rule 7: read calculateFinalScore FULLY before deciding where to insert.
  Rule 62: if calculateFinalScore already calls getClusterDetail, reconcile — don't duplicate.

### EXPORT getClusterDetail (T1 needs it from namespace):
  Verify it's already exported from patternMatcher.js (T1's namespace-guard depends on it).
  If not: add export.

### VITEST: 4 new tests:
  test('getClusterDetail returns bonus=count for each cluster')
  test('getClusterDetail bonus=0 for elements with no neighbors')
  test('calculateFinalScore includes cluster bonus in total')
  test('cluster bonus does not double-count across regions')
  137 + 4 = 141 green required.

### WRITE TO COMMS (T1 is waiting for this):
  'T1: getClusterDetail now returns [{element, count, bonus}].
   bonus = 1pt per element in biggest cluster per region.
   Import path: same as before. Shape change: bonus field added.
   calculateFinalScore already includes it. Your cluster viz can now show points.'

### COMMIT:
  git add src/lib/patternMatcher.js src/store/gameStore.js (and any file touched)
  git commit -m 'feat(engine): cluster bonus 1pt/element (board game rule p9) · getClusterDetail+bonus · calculateFinalScore wired · 4 tests · NeoTopia T2 S18'

---

## TASK B · Clean Full-Flow Bot Game (target 46/50)
# During S17, the bot run was confounded by T1's uncommitted WIP in the shared tree.
# The tree is now clean (c0a8cb2 is production). Run a clean Flow game.

### RUN THE BOT IN FLOW MODE:
  BOT_GAMES=1 BOT_MODE=flow BOT_TURNS=20 BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js 2>&1 | tail -30
  Expected: game ends at 9 tiles (not 12) · FinalScore appears · cluster bonus included in score
  Verify: does the Global Index receive a row? (first real Flow game = first real row)
    SELECT * FROM global_neotopia_index ORDER BY created_at DESC LIMIT 1;
  Document in comms:
    - Tiles when game ended (should be 9)
    - FinalScore total (with cluster bonus now included)
    - Global Index row written? (YES/NO + value)

### COMMIT (if bot changes needed):
  Only commit if the bot needed code changes. If it ran clean: just document in comms.

---

## TASK C · Atomic Seat-Scoped Draw RPC (DESIGN ONLY · target 44/50)
# T3 S17 proved: the channel uses whole-state SNAPSHOTS, not event reducers.
# Concurrent draws CLOBBER (last-write-wins · draw can be LOST).
# T2 designs the fix · T3 wires it in S18.
# This session: design + migration only. NOT the full implementation.

### THE DESIGN:
  The fix is a Supabase RPC (SECURITY DEFINER) that:
    1. Draws a card atomically for a specific seat (player)
    2. Validates the seat matches auth.uid() (server-side — no spoofing)
    3. Returns the drawn card to the caller
    4. Updates game state server-side in a transaction
  This replaces the client-side draw + snapshot broadcast pattern.
  It makes concurrent draws SAFE: each seat draws independently at the DB level.

### WRITE THE MIGRATION (design-ready to implement):
  Create migrations/011_atomic_draw_rpc.sql:
    CREATE OR REPLACE FUNCTION draw_card_for_seat(
      p_session_id UUID,
      p_seat INT
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_player_id UUID := auth.uid();
      -- draw logic here (read deck, pop card, update game state)
      v_drawn_card JSONB;
    BEGIN
      -- Verify the calling player owns this seat
      -- Draw the next card for this seat
      -- Update game_events
      -- Return the drawn card
      RETURN v_drawn_card;
    END;
    $$;
  Note: leave the implementation stubs clear. T3 and T2 S19 complete the body.
  Apply: supabase db push (or manual migration)

### WRITE TO COMMS (T3 is waiting for this design):
  'T3: atomic draw RPC spec ready.
   Function: draw_card_for_seat(p_session_id, p_seat) RETURNS JSONB.
   Migration 011 is committed. Apply it before wiring.
   T3 wires: when drawCard is called, invoke the RPC instead of local state + broadcast.
   The RPC returns the drawn card. Apply it to local state. No broadcast needed (RPC updates DB · Supabase realtime handles sync).'

### COMMIT:
  git add migrations/011_atomic_draw_rpc.sql
  git commit -m 'feat(db): atomic seat-scoped draw RPC design · migration 011 · concurrent draw fix · NeoTopia T2 S18'

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · tests/e2e/
  Rule 10: BFS before scoring — this rule exists for THIS feature
  Rule 32: cluster points = 1pt per element = the BOARD GAME RULE · not invented
  Rule 62: extend getClusterDetail · don't replace it
  Evolution lesson → comms disk only

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive
