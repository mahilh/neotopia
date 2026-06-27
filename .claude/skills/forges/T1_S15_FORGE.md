# T1 S15 MASTER FORGE · DIM-THE-REST + ACTION LOG + ELEMENT BURST
# NeoTopia · post S14 complete · 0/56 art files (check-art.js confirmed)
# This is the highest-impact visual session in the project.
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite. No exceptions.
# T1 lane: src/components/ · src/pages/ · src/App.jsx · src/utils/ · src/index.css

## S14 WHAT SHIPPED (verified commits, do NOT redo any of this)
  1da2f2f: FinalScore upgrade · winner headline + Stage line + play-again testid + districts count
    KEY: FinalScore already had winner gold, breakdown, formula — task was precision additions
    NOTE: 'FOUNDER record' used (not full name) — privacy protocol working correctly
  19e7497: art pipeline · check-art.js · 0/56 confirmed · card_NN.png mapping
  dced6f8: lobby theming · 4 element icons + Stage line + gold room code rgb(200,148,64)
  55b8a51: polish · tabular-nums + stage-line contrast

## RULE 58 (T1 S14, now permanent)
  Check if X exists before you "build X." A from-scratch forge task carries a blank-slate premise.
  Read the target first; the highest-value move is often adding the gap, not re-pouring the foundation.
  FinalScore already had most of what S14 asked for. The value was the 4-piece precision addition.

## SESSION GOAL · ALL THREE TASKS ARE HIGH IMPACT

  Task A: DIM-THE-REST — the single most impactful UI change from Colonist research
  Task B: LEFT ACTION LOG — the game's memory, real-time event stream
  Task C: ELEMENT PLACEMENT BURST — physical feedback when an element lands on a hex

  Read ALL gates before starting. This session touches 3 files: index.css, GameRoom.jsx, HexCell.jsx.
  These files are DENSE with established patterns. Misreading them is the #1 risk.

---

## GATES (read all 7 before writing a single character)

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  Confirm: S14 is in git log (1da2f2f, 19e7497, dced6f8, 55b8a51)
  Confirm: Rules 55, 56, 57, 58 are in the rules list
  Confirm: COMMS M state is GONE (T3 S14 git rm --cached landed)
  HARD STOP if you see any rule you are about to violate.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Confirm: T2 is on Global Index wiring + numerology events + Flow mode.
  Confirm: T3 is on mobile E2E + numerology CI + timing audit.
  HARD STOP if another terminal claims HexCell.jsx or GameRoom.jsx mid-session.

Gate 3 (10 min — DO NOT SKIM, DO NOT SKIP):
  cat src/index.css  (FULL FILE — every @keyframes, every CSS rule)
  cat src/pages/GameRoom.jsx  (FULL FILE — understand uiPhase, isMyTurn, data-my-turn)
  cat src/components/Board/HexCell.jsx  (FULL FILE — understand SVG structure, cx/cy, element rendering)
  Answer before touching ANYTHING:
    a. How many @keyframes exist in index.css? (hexPulse is one — what else?)
    b. What attributes does the GameRoom root <div> have? (data-game-phase, data-my-turn confirmed)
    c. What is the cx/cy of a hex element token in HexCell.jsx? (exact variable names)
    d. How does the existing element render in HexCell? (what SVG element? which props?)
    e. Is there an 'element' prop on HexCell? What does it look like when a hex is occupied?
  Rule 58: VERIFY all three of these exist as expected before prescribing changes to them.

Gate 4: npx vitest run 2>&1 | tail -8
  HARD STOP if any test is red. Do not edit under red.

Gate 5: npm run build 2>&1 | tail -5
  HARD STOP if build fails.

Gate 6: git log --oneline -8 && git status --short
  Confirm HEAD = origin/main after git pull.
  Confirm: only your lane files in working tree.
  If T2's migrations/ or T3's tests/e2e/ files appear: DO NOT touch them.

Gate 7 (SCREENSHOT GATE, Rule 55):
  npm run dev &
  Take a screenshot of /game in solo dev mode.
  Confirm: sacred geometry placeholders visible on offer cards (T1 S13)
  Confirm: dual-player score section visible (T1 S13)
  Confirm: element-color instruction bar (T1 S13)
  Confirm: lobby theming (T1 S14)
  This screenshot is your baseline. Every visual task needs a BEFORE and AFTER screenshot.
  DO NOT commit any visual change without an AFTER screenshot confirming the effect.

---

## TASK A · DIM-THE-REST UX PATTERN (target: 49/50)
# The single highest-impact UX change from Colonist research.
# When it's your turn: ONLY interactable elements are at full opacity. Everything else dims to 40%.
# This is what creates the psychological "flow state" and clarity in colonist.io.

### WHAT IT DOES:
  Game state: idle, your turn, actionsLeft > 0
    → Factories at full opacity (100%) · Offer cards at full opacity (100%)
    → Score section, hand, element buttons: opacity 40%
    → Instruction bar: full opacity (it's always communicating)

  Game state: factory selected (uiPhase='factorySelected')
    → ONLY element-type buttons: full opacity (100%)
    → Everything else: opacity 40%
    → The board factories: opacity 70% (dimmed but visible)

  Game state: element selected (uiPhase='elementSelected')
    → ONLY region buttons: full opacity (100%)
    → Everything else: opacity 40%

  Game state: region selected (uiPhase='regionSelected')
    → ONLY valid hexes (board): full opacity (already hexPulse animated)
    → Sidebar: opacity 40%

  Game state: not your turn (isMyTurn=false)
    → EVERYTHING at normal opacity (40% dim doesn't apply)
    → The opponent controls the focus. Stay neutral.

### IMPLEMENTATION:

  Step 1: In GameRoom.jsx, add data-ui-phase to the root div:
    <div
      data-game-phase={phase}
      data-my-turn={isMyTurn ? 'true' : 'false'}
      data-ui-phase={uiPhase}  // ADD THIS
      ...
    >

  Step 2: In src/index.css, add the dim rules.
  VERIFY: data-ui-phase values from useGameActions: 'idle', 'factorySelected',
          'elementSelected', 'regionSelected', 'scorePending'.
  These are the exact string values — do NOT guess, read useGameActions.jsx first.

  The CSS system:
  /* BASE: when it's your turn and idle, dim the sidebar sections */
  [data-my-turn='true'][data-ui-phase='idle'] .score-panel,
  [data-my-turn='true'][data-ui-phase='idle'] [data-hand] {
    opacity: 0.4;
    transition: opacity 0.2s ease;
  }

  /* When factory selected: dim offer + score + hand — only element buttons matter */
  [data-my-turn='true'][data-ui-phase='factorySelected'] [data-offer],
  [data-my-turn='true'][data-ui-phase='factorySelected'] .score-panel,
  [data-my-turn='true'][data-ui-phase='factorySelected'] [data-hand] {
    opacity: 0.35;
    transition: opacity 0.2s ease;
  }

  /* When element/region selected: dim offer + score + hand + factory (board primary) */
  [data-my-turn='true'][data-ui-phase='elementSelected'] [data-offer],
  [data-my-turn='true'][data-ui-phase='regionSelected'] [data-offer] {
    opacity: 0.35;
    transition: opacity 0.2s ease;
  }

  /* Score-pending: hand cards glow, offer dims */
  [data-my-turn='true'][data-ui-phase='scorePending'] [data-offer] {
    opacity: 0.3;
    transition: opacity 0.2s ease;
  }

  IMPORTANT:
  ✓ Add class names or existing data attributes to the sidebar panels BEFORE writing CSS.
    Verify: does data-offer exist on the offer container? (GameRoom.jsx line ~250 area)
    Verify: is data-hand on the hand container? Does a .score-panel class exist?
    Verify: do not add new classes to files T2/T3 own.

  The transition: opacity 0.2s ease on all rules ensures smooth state changes.
  Never use visibility or display: none — opacity is compositor-thread.

### EVIDENCE GATE (Rule 55 — screenshot REQUIRED):
  After implementing, reload the game in solo dev mode.
  TAKE SCREENSHOT: factory click → element-type buttons are at full opacity, offer is dimmed.
  TAKE SCREENSHOT: idle state → factories and offer cards are at full opacity, score is dimmed.
  TAKE SCREENSHOT: opponent's turn → everything at normal opacity.
  If screenshots don't confirm visual dimming: DO NOT commit. Debug first.

### COMMIT:
  git add src/index.css src/pages/GameRoom.jsx
  git commit -m 'feat(ui): dim-the-rest attention focus · uiPhase-driven opacity · colonist UX pattern · NeoTopia T1 S15'

---

## TASK B · LEFT-SIDE ACTION LOG (target: 47/50)
# The game's memory. Both players see what just happened. Colonist's most useful UI element.
# Position: LEFT side of the board (overlaying board edge, never the sidebar)

### WHAT IT SHOWS:
  '[Player] placed BioFarming in Living Earth'
  '[Player] drew Naacal Seed Archive'
  '[Player] scored Ennead Council Chamber: +4 pts'
  'Factory refilled'
  'Turn [N] · [Player]'

### DESIGN:
  Position: absolute, left:8px, top:56px (below header), bottom:60px (above ActionBar)
  Width: max-width: 160px
  Background: transparent (board shows through)
  Font: 11px, fontFamily: serif, letterSpacing: 0.5
  New entries: full opacity (1.0)
  Aging: entries fade from opacity 1 → 0.15 over 8 turns (using CSS custom property)
  Max visible entries: 10 (older entries are removed)
  On mobile portrait (< 480px): show only 1 entry (last action only, 3 lines max)
  z-index: 5 (above board, below modals)
  pointer-events: none (never blocks board interaction)

### IMPLEMENTATION:

  Step 1: Create src/components/ActionLog.jsx:

    import { useState, useEffect, useRef } from 'react'
    const MAX_ENTRIES = 10
    export function ActionLog({ entries }) {
      // entries = [{text, color, turn}] from GameRoom
      const currentTurn = entries[entries.length - 1]?.turn ?? 0
      const visible = entries.slice(-MAX_ENTRIES)
      return (
        <div style={{
          position: 'absolute',
          left: 8, top: 56, bottom: 60,
          width: 160, pointerEvents: 'none', zIndex: 5,
          display: 'flex', flexDirection: 'column-reverse',
          gap: 4, padding: '0 4px', overflow: 'hidden',
        }}>
          {visible.map((entry, i) => {
            const age = currentTurn - entry.turn
            const opacity = Math.max(0.15, 1 - age * 0.12)
            return (
              <div key={i} style={{
                fontSize: 11, fontFamily: 'serif',
                letterSpacing: 0.4, lineHeight: 1.3,
                color: entry.color ?? 'rgba(255,255,255,0.6)',
                opacity,
                transition: 'opacity 0.4s',
              }}>
                {entry.text}
              </div>
            )
          })}
        </div>
      )
    }

  Step 2: In GameRoom.jsx, maintain the log state:

    const [actionLog, setActionLog] = useState([])
    const addLogEntry = (text, color = 'rgba(255,255,255,0.6)') => {
      setActionLog(prev => [...prev, { text, color, turn: turnNumber }])
    }

  Step 3: Wire to existing game events. Read GameRoom.jsx to find where:
    - Cards are scored (ScoreFlash is set) → add 'scored [card.name]: +[N]pts' in gold
    - Cards are drawn (handleDrawCard) → add 'drew [card.name]' in white
    - Elements are placed (handleHexClick) → add 'placed [element] in [region]' in element color
    - Turn ends (handleEndTurn) → add 'Turn [N+1] · [player]' in rgba white 0.4
    VERIFY: find the exact function names before wiring.
    READ: what does handleDrawCard return or call? What is available after a placement?

  Step 4: Add ActionLog to GameRoom render, inside the main board area:
    <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
      <GameBoard ... />
      <ActionLog entries={actionLog} />
    </div>

  Step 5: Add the mobile hide CSS in src/index.css:
    @media (max-width: 479px) {
      .action-log-wrap { display: none; }
    }
    (Add className='action-log-wrap' to the ActionLog div wrapper)

### EVIDENCE GATE (Rule 55):
  SCREENSHOT: make 3 actions (draw, place, draw). Confirm log shows 3 entries on left.
  SCREENSHOT: verify entries fade with age (older = lower opacity).
  SCREENSHOT: mobile viewport (375px) → log is hidden.

### COMMIT:
  git add src/components/ActionLog.jsx src/pages/GameRoom.jsx src/index.css
  git commit -m 'feat(ui): left-side action log · age-fade entries · element-colored events · NeoTopia T1 S15'

---

## TASK C · ELEMENT PLACEMENT BURST ANIMATION (target: 46/50)
# Pure CSS SVG animation. No library needed. When a hex token appears: 6 particles burst.
# This creates physical feedback — the element 'lands' with visible energy.

### WHAT IT DOES:
  When an element token first appears on a hex (element count 0 → 1):
  6 small circles (r=3px each) burst from the hex center at 0°, 60°, 120°, 180°, 240°, 300°
  Each travels 24px in its direction, shrinking from scale(1) to scale(0)
  Duration: 400ms total · fill: the element's color · opacity 1 → 0
  After 400ms: burst elements are removed from DOM (state cleared)

### IMPLEMENTATION:

  Step 1: In src/index.css, add the 6 burst keyframes:
  (6 keyframes, one per direction, using translate to avoid DOM reflow)

  @keyframes burst0 { 0%{transform:translate(0,0)scale(1);opacity:1} 100%{transform:translate(0,-24px)scale(0);opacity:0} }
  @keyframes burst1 { 0%{transform:translate(0,0)scale(1);opacity:1} 100%{transform:translate(21px,-12px)scale(0);opacity:0} }
  @keyframes burst2 { 0%{transform:translate(0,0)scale(1);opacity:1} 100%{transform:translate(21px,12px)scale(0);opacity:0} }
  @keyframes burst3 { 0%{transform:translate(0,0)scale(1);opacity:1} 100%{transform:translate(0,24px)scale(0);opacity:0} }
  @keyframes burst4 { 0%{transform:translate(0,0)scale(1);opacity:1} 100%{transform:translate(-21px,12px)scale(0);opacity:0} }
  @keyframes burst5 { 0%{transform:translate(0,0)scale(1);opacity:1} 100%{transform:translate(-21px,-12px)scale(0);opacity:0} }

  (21px = 24 * cos(30°) = 24 * sqrt(3)/2 for flat-top hex geometry)

  Step 2: In HexCell.jsx, add burst state:

  const ELEMENT_FILL = {
    energy: '#E24B4A', biofarming: '#1D9E75',
    technology: '#7F77DD', community: '#378ADD',
  }

  const prevElement = useRef(element)
  const [bursting, setBursting] = useState(false)

  useEffect(() => {
    if (!prevElement.current && element) {
      // transition from no-element → element = burst
      setBursting(true)
      const id = setTimeout(() => setBursting(false), 450)
      return () => clearTimeout(id)
    }
    prevElement.current = element
  }, [element])

  Step 3: In the HexCell SVG render, inside the main <g> but AFTER the main element circle:

  {bursting && element && (
    [0,1,2,3,4,5].map(i => (
      <circle
        key={i}
        cx={cx}  // the hex center x
        cy={cy}  // the hex center y
        r={3}
        fill={ELEMENT_FILL[element] ?? '#ffffff'}
        style={{
          animationName: `burst${i}`,
          animationDuration: '400ms',
          animationTimingFunction: 'ease-out',
          animationFillMode: 'forwards',
          pointerEvents: 'none',
        }}
      />
    ))
  )}

  CRITICAL: verify the exact variable names for cx and cy in HexCell.jsx BEFORE implementing.
  They may be called cx/cy, or x/y, or px/py, or something else. Read the file first (Gate 3).
  The burst circles must NOT intercept pointer events (pointerEvents: 'none' required).
  Do NOT affect the existing element token rendering or the force:true click chain.

### EVIDENCE GATE (Rule 55):
  Place an element on the board (click factory → element → region → hex).
  SCREENSHOT: burst particles visible for ~400ms, then gone.
  SCREENSHOT: the underlying element token is still there after burst.
  Verify: no DOM errors, no test failures.

### COMMIT:
  git add src/components/Board/HexCell.jsx src/index.css
  git commit -m 'feat(ui): element placement burst · 6-particle CSS SVG animation · 400ms · NeoTopia T1 S15'

---

## CROSS-LANE NOTE FROM T2
  T2 S14 created the Global NeoTopia Index (migration 009) and a `recordCivilizationDetail()`
  function in src/lib/gameEndEvent.js (or supabase.js). The FinalScore.jsx already has
  the display section. T1 needs to CALL that function from FinalScore.jsx once per game end.
  Check T2's comms for the exact function signature.
  This is ONE LINE in FinalScore.jsx — likely something like:
    `await recordCivilizationDetail({ sessionId: sync?.sessionId, scores: players.map(p=>p.scores), cardsBuilt: players.map(p=>p.hand.length) })`
  DO NOT add this if you cannot verify the exact function signature from T2's actual code.
  Rule 58: read the existing code before prescribing.

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/lib/ · scripts/ · migrations/ · tests/e2e/ · src/hooks/useGameRoom*
  NEVER commit .claude/comms/
  Rule 55: screenshot every visual task · before and after
  Rule 58: read the target before building it
  Evolution lesson → .claude/comms/tomorrow.md (disk only)

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive
