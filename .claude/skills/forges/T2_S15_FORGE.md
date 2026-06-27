# T2 S15 MASTER FORGE · GLOBAL INDEX WIRING + NUMEROLOGY EVENTS + NEOTOPIA FLOW
# NeoTopia · post S14 complete
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.
# T2 lane: src/lib/ · src/store/ · src/hooks/ · api/ · scripts/ · migrations/

## S14 WHAT SHIPPED (T2)
  292eb69: Global NeoTopia Index (migration 009) + SECURITY DEFINER RPC
    - All writes through definer RPC (no direct INSERT path)
    - Clamp guard (99999→999), score re-derived server-side
    - Idempotent re-fire (ON CONFLICT DO NOTHING)
    - Forged player_id rejected
    - Live proven: clamp + block + idempotent all verified
  bd0230f: Bot v4.5 honest proxy
    - placed counter increments ONLY when .hex-element-in grows
    - No phantom click inflation
    - 10 placed, zero [WARN] lines on clean run

## RULES 58-60 (learn and apply)
  Rule 58: read X before building X (blank-slate premise is still a premise)
  Rule 59: public write needs server-side trust boundary. RLS-insert-own prevents wrong-ROW
           writes, not wrong-VALUE writes. The RPC pattern is the correct design.
  Rule 60: a tool's contract is part of the premise. Silent wrong-behavior = assumed contract.

## SESSION GOAL (3 tasks, all T2 lane)
  Task A: Wire Global Index to FinalScore (T1 can't call recordCivilizationDetail without you)
  Task B: Numerological milestone events in the game store
  Task C: NeoTopia Flow mode config (15s turns, 9 tiles, simultaneous draw foundation)

---

## GATES

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  Confirm: 292eb69 and bd0230f in log
  Confirm: comms M state GONE (T3 S14 landed)
  HARD STOP if any rule you are about to violate appears here.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Confirm: T1 is on dim-the-rest + action log + burst.
  Confirm: T3 is on mobile E2E + numerology CI + timing audit.
  HARD STOP if T1 or T3 has claimed src/lib/ or src/store/ mid-session.

Gate 3 (10 min — READ EVERYTHING before writing anything):
  cat src/lib/gameEndEvent.js  (FULL FILE — where does the game-end logic live?)
  cat src/store/gameStore.js | grep -n 'score\|phase\|scoring\|endgame\|bonus\|milestone' | head -40
  cat src/components/FinalScore.jsx | grep -n 'recordCivil\|Global\|Index\|sessionId' | head -20
  Answer before coding:
    a. What is the exact function name T1 needs to call from FinalScore? (find it in gameEndEvent.js)
    b. What parameters does it expect? (sessionId? scores? cardsBuilt?)
    c. What is the Zustand store field for the game session ID? (grep for sessionId in gameStore.js)
    d. Is there already a 'milestone' or 'sacredMilestone' state in the store? (if yes: reuse it)
    e. What does T2's RPC actually accept? (read the migration 009 file)
  Rule 58: VERIFY ALL FOUR before writing a single line.

Gate 4: npx vitest run 2>&1 | tail -8 · 102 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors required
Gate 6: git log --oneline -8 && git status --short
  Confirm HEAD = origin/main. Only T2 files in working tree.
Gate 7: Read migration 009 (find the exact RPC name + parameter schema)
  cat migrations/009_global_neotopia_index.sql
  This is the contract. The RPC signature is the source of truth.

---

## TASK A · Wire Global Index to FinalScore (target: 49/50)
# T1's FinalScore is complete. The Global Index RPC is live (292eb69).
# The missing piece: FinalScore calls the RPC after the game ends.
# T1 CANNOT do this — the RPC function lives in src/lib/ (T2 lane).
# YOU give T1 a single exported function they can call from src/components/FinalScore.jsx.

### WHAT TO BUILD:
  In src/lib/gameEndEvent.js (or src/lib/supabase.js — verify which file has the RPC wrapper):

  /**
   * Called once per game end from FinalScore.jsx.
   * Writes this game's contribution to the Global NeoTopia Index via the SECURITY DEFINER RPC.
   * @param {object} params
   * @param {string} params.sessionId - The game session ID (from sync or store)
   * @param {Array<{userId, username, scores: [number,number,number], hand}>} params.players
   * @param {string} params.mySeat - The calling client's seat (to prevent double-write)
   */
  export async function recordCivilizationContribution({ sessionId, players, mySeat }) {
    // Only the host (seat 0) writes, to prevent double-write from 2 clients
    if (mySeat !== 0) return
    // Find the calling player's data
    const myPlayer = players.find(p => p.seat === mySeat)
    if (!myPlayer) return
    const scores = myPlayer.scores ?? [0, 0, 0]
    try {
      await supabase.rpc('record_civilization_contribution', {
        p_session_id: sessionId,
        p_player_id: myPlayer.userId,
        p_username: myPlayer.username ?? 'The Architect',
        p_sacred_city: scores[0] ?? 0,
        p_living_earth: scores[1] ?? 0,
        p_free_energy: scores[2] ?? 0,
        p_cards_built: myPlayer.hand?.length ?? 0,
      })
    } catch (err) {
      // Non-blocking: civilization record failure never interrupts the game UI
      console.warn('[NeoTopia Index] record failed:', err.message)
    }
  }

  PREMISE CHECK REQUIRED:
    The RPC name (`record_civilization_contribution`) and ALL parameter names MUST match
    what is in migration 009 exactly. Read the file before writing.
    If the actual RPC name differs: use the actual name.
    If the actual parameter names differ: use the actual names.
    Rule 56: verify schema live, never guess.

  After creating the function:
  Write a comment in .claude/comms/tomorrow.md telling T1 the exact function call:
    'T1: import { recordCivilizationContribution } from "../lib/gameEndEvent"
    Call in FinalScore: useEffect(() => { recordCivilizationContribution({sessionId, players, mySeat}) }, [])'

  Run vitest: 102 green required before commit.

  COMMIT:
    git add src/lib/gameEndEvent.js (or whichever file)
    git commit -m 'feat(db): recordCivilizationContribution · FinalScore-callable Global Index writer · host-only · NeoTopia T2 S15'

### ALSO: Query the Global Index for display
  Add a companion function:
  export async function getGlobalCivilizationTotal() {
    const { data, error } = await supabase
      .from('global_neotopia_index')
      .select('total_score')
    if (error) return 0
    return data.reduce((sum, row) => sum + (row.total_score ?? 0), 0)
  }
  T1's FinalScore can call this to show: 'Civilization Index: [N] total'

---

## TASK B · Numerological Milestone Events (target: 48/50)
# When a player's score crosses 7, 9, 13, 18, 27, 36 — the game knows.
# This knowledge flows as a Zustand store event that T1 animates.
# The game teaches numerology through play, never by announcing it.

### WHAT TO BUILD:
  In src/store/gameStore.js (or the tryScoreCard function):

  Step 1: Add milestone state to the store:
    sacredMilestone: null, // { player: seat, milestone: number, message: string }
    clearMilestone: () => set({ sacredMilestone: null }),

  Step 2: After any score update that increases a player's score:
    Check if the new total crosses any of: [7, 9, 13, 18, 27, 36]
    If yes: set sacredMilestone with the milestone and its message.

  const SACRED_MILESTONES = {
    7:  { message: 'Sacred Seven · Spiritual Perfection Awakens', symbol: '✴' },
    9:  { message: 'Nine · Completion · The Ennead Speaks', symbol: '✡' },
    13: { message: 'Thirteen · Sacred Feminine · Transformation', symbol: '☽' },
    18: { message: 'Eighteen · Life Doubled · The District Breathes', symbol: '♞' },
    27: { message: 'Twenty-Seven · Three Nines · Mastery', symbol: '△' },
    36: { message: 'Thirty-Six · The Four Elements Complete', symbol: '◆' },
  }

  The milestone is the player's TOTAL score across all regions.
  Not per-region (that would fire too often). Total only.

  Step 3: In GameRoom.jsx (T1 lane), listen to sacredMilestone:
    const sacredMilestone = useGameStore(s => s.sacredMilestone)
    const clearMilestone = useGameStore(s => s.clearMilestone)
    // When milestone appears, show a brief overlay
    // Auto-dismiss after 2.5s, clearMilestone on dismiss
  Write the EXACT shape of sacredMilestone in comms for T1 to read.
  T1 handles the visual display (their lane). You handle the data.

  PREMISE CHECK:
    Read the tryScoreCard function fully before adding hooks to it.
    Find where player scores are incremented.
    Add the milestone check AFTER the score increment, not before.
    The total = sum of all 3 region scores for the player.
    Implement the check only once per score update, not per-region.

  VITEST: add a unit test:
    test('milestone fires when total crosses 9', () => {
      // set up a mock store state with player scoring to 9
      // assert sacredMilestone is set with milestone: 9
    })
  102 + 1 = 103 green required.

  COMMIT:
    git add src/store/gameStore.js (and test file)
    git commit -m 'feat(engine): numerological milestone events · 7/9/13/18/27/36 sacred thresholds · NeoTopia T2 S15'

---

## TASK C · NeoTopia Flow Mode Config (target: 45/50)
# The real-time game mode inspired by Colonist Rush.
# 15-second turns. 9 production tiles. Simultaneous card draws.
# Target: 10-15 minute sessions (vs 30-45 for Classic).

### WHAT TO BUILD:
  In src/store/gameConfig.js (create if it doesn't exist, or update if it does):
  READ: does gameConfig.js already exist? (grep in src/store/) If yes: extend it.
  VERIFY: does TURN_TIME_LIMIT exist in gameStore.js or gameConfig.js already?

  export const GAME_MODES = {
    classic: {
      id: 'classic',
      label: 'Classic',
      description: 'Full civilization building · 90s turns · 12 production tiles',
      TURN_TIME_LIMIT: 90,
      END_GAME_TILE: 12,
      SIMULTANEOUS_DRAW: false,
    },
    flow: {
      id: 'flow',
      label: 'Flow',
      tagline: 'Pure creation · No waiting',
      description: 'NeoTopia Flow · 15s turns · 9 tiles · simultaneous draws',
      TURN_TIME_LIMIT: 15,
      END_GAME_TILE: 9,  // game ends after 9th tile (numerology: 9=completion)
      SIMULTANEOUS_DRAW: true,
    },
  }

  export const DEFAULT_GAME_MODE = 'classic'

  Add to the game_sessions Supabase row: a 'mode' field ('classic' | 'flow')
  (Check if game_sessions already has a mode column before adding to INSERT)
  If it doesn't exist: add migration 010:
    ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'classic';
  Don't add CHECK constraints yet (keep it extensible).

  Add mode selection to the lobby (verify: find the lobby/start-game file first):
    A simple two-button toggle: [Classic] [Flow]
    Default: Classic
    The selection is passed to the game start flow.
    Touch targets: ≥44px height (Rule 4).

  NUMEROLOGY NOTE: 9 tiles in Flow mode = the game achieves completion (9=indestructible)
  in half the time. The civilization is built in pure flow state.

  VITEST: test that GAME_MODES.flow.TURN_TIME_LIMIT === 15 and END_GAME_TILE === 9.
  103 + 2 = 105 green required (or 102 + 2 if Task B test is separate).

  COMMIT:
    git add src/store/gameConfig.js migrations/010_add_mode_column.sql src/pages/Lobby.jsx
    git commit -m 'feat(engine): NeoTopia Flow mode · 15s turns · 9 tiles · simultaneous draw config · NeoTopia T2 S15'

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ except Lobby.jsx (game mode selector)
  NEVER touch: tests/e2e/ (T3 lane)
  NEVER commit .claude/comms/
  Rule 56: verify schema live before coding any DB query
  Rule 59: public writes = server-side trust boundary always
  102+ green tests required

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive
  Evolution lesson → .claude/comms/tomorrow.md (disk only)
