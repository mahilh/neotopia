# T1 S15 MASTER FORGE · ANIMATION + DIM-THE-REST + LEFT LOG
# NeoTopia · June 27 2026 · Overnight AUTODRIVE! pre-written
# Prerequisite: T1 S14 must be complete (FinalScore + art pipeline + landing page)
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.

## WHAT S14 WILL HAVE SHIPPED (assumed)
  FinalScore: winner · breakdown · formula · Play Again btn
  Art pipeline: docs updated with card_NN.png mapping · check-art.js
  Landing page: tagline · element icons · stage indicator

## S15 MISSION
  Task A: Dim-the-rest UX pattern (Colonist's most powerful attention mechanic)
  Task B: Left-side action log (persistent game history)
  Task C: First animation from TIER 1 list (element placement burst)

## GATES
  Gate 1: git pull · cat CLAUDE.md head-60 · confirm S14 is in log
  Gate 2: comms check · T2 on bonus data/Global Index · T3 on CI/bot race
  Gate 3: read src/pages/GameRoom.jsx FULLY · read src/index.css FULLY
  Gate 4: vitest 102 green · build clean
  Gate 5: git log -8 · HEAD=origin/main
  Gate 6: read docs/COLONIST_UX_ANALYSIS.md (the dim-the-rest section)
  Gate 7: read docs/ANIMATION_DESIGN.md (TIER 1, element burst section)

## TASK A · Dim-The-Rest UX Pattern (target: 49/50)

  The most impactful single UX change from Colonist research.
  When it's your turn and you have actions:
    - ALL elements NOT interactable dim to 40% opacity
    - Factories and Offer cards remain at full opacity
    - The instruction bar remains at full opacity
  When factory selected:
    - ONLY element-type buttons are at full opacity
    - Everything else dims
  When region selected:
    - ONLY valid hexes + hint text at full opacity
    - Everything else dims

  IMPLEMENTATION:
    Add a CSS class to GameRoom's root div that tracks the current UI phase:
    data-ui-phase={uiPhase}  (already available from useGameActions)
    data-is-my-turn={isMyTurn ? 'true' : 'false'}  (already set as data-my-turn)

    Add CSS in src/index.css:

    [data-my-turn='true'] .game-sidebar > *:not([data-active]) {
      opacity: 0.4;
      transition: opacity 0.2s;
    }
    [data-my-turn='true'][data-game-phase='playing'] .factory-g {
      opacity: 1;  /* factories always visible when your turn */
    }
    /* When factory selected: dim offer, dim score, keep element buttons */
    [data-ui-phase='factorySelected'] [data-offer],
    [data-ui-phase='factorySelected'] .score-section {
      opacity: 0.3;
      transition: opacity 0.2s;
    }

    Add data-active attribute to the currently-relevant sidebar section:
    - When uiPhase='idle': data-active on both offer and hand sections
    - When uiPhase='factorySelected': data-active on element-type buttons
    - When uiPhase='elementSelected'/'regionSelected': data-active on region buttons
    - When uiPhase='scorePending': data-active on hand cards that are scoreable

  EVIDENCE GATE (Rule 55 — screenshot required):
    Take screenshot with it being your turn (data-my-turn=true)
    Confirm: only factories and offer cards are at full opacity
    Confirm: score section and other elements are visually dimmed
    DO NOT commit until screenshot confirms visual effect

  COMMIT:
    git add src/index.css src/pages/GameRoom.jsx
    git commit -m 'feat(ui): dim-the-rest UX · attention focus on interactable elements per turn phase · NeoTopia T1 S15'

## TASK B · Left-Side Action Log (target: 47/50)

  A persistent event log on the LEFT side of the board (overlaying the board edge)
  NOT the same as the sidebar (right side).
  This is how Colonist handles it: "Log on left for left-to-right text to encroach less"

  WHAT THE LOG SHOWS:
    [Player] placed [element] in [region] · [element-colored]
    [Player] drew [card-name] from The Offer · [white]
    [Player] scored [card-name]: +[N]pts in [region] · [gold]
    Factory refilled · [grey]
    Turn [N] begins · [Player]'s move · [dim white]
    [Numerology milestone] · [gold] (if any)

  DESIGN:
    Position: absolute, left: 8px, top: 56px (below header), bottom: 60px (above ActionBar)
    Width: 160px max · z-index: 5 (above board, below sidebar)
    Background: transparent (board shows through)
    Font: 11px monospace or serif · letterSpacing: 0.5
    New entries: slide in from left, full opacity
    Aging: entries fade from 100% to 20% over 10 turns (CSS custom property --age)
    Max visible entries: 12 (older ones removed from DOM)
    On mobile: collapse to 1 visible entry (last action only)

  IMPLEMENTATION:
    Create src/components/ActionLog.jsx:
      const [entries, setEntries] = useState([])
      // Called from GameRoom via useGameSync events
      // Each entry: { text, color, timestamp, turn }
      // Age = currentTurn - entry.turn (opacity = 1 - (age * 0.08))

    Wire to useGameSync: when a game_event comes in via postgres_changes,
    add it to the action log. The log reads from the real event stream.

  EVIDENCE GATE:
    Play a few turns. Confirm log entries appear on left side of board.
    Confirm older entries fade relative to newer ones.
    Screenshot for visual verification (Rule 55).

  COMMIT:
    git add src/components/ActionLog.jsx src/pages/GameRoom.jsx
    git commit -m 'feat(ui): left-side action log · age-fade · element-colored events · NeoTopia T1 S15'

## TASK C · Element Placement Burst Animation (target: 46/50)

  Pure CSS SVG animation. No motion library required.
  When an element token appears on a hex (element count 0→1):
  6 small particles burst from the hex center and fade.

  IMPLEMENTATION:
    In src/index.css add:

    @keyframes elementBurst0 {
      0% { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(0px,-24px) scale(0); opacity: 0; }
    }
    @keyframes elementBurst1 {
      0% { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(20px,-12px) scale(0); opacity: 0; }
    }
    /* ...6 total (0°, 60°, 120°, 180°, 240°, 300°) */
    .element-burst-particle {
      animation-duration: 400ms;
      animation-timing-function: ease-out;
      animation-fill-mode: forwards;
    }

    In HexCell.jsx:
      Track previous element state: const prevEl = useRef(element)
      When element changes from null/undefined to a value:
        setBursting(true)
        setTimeout(() => setBursting(false), 450)

      Render when bursting:
      {bursting && [0,60,120,180,240,300].map((angle, i) => (
        <circle key={i} cx={cx} cy={cy} r={3}
          fill={ELEMENT_COLORS[element]}
          className={`element-burst-particle`}
          style={{ animationName: `elementBurst${i}` }}
        />
      ))}

  EVIDENCE GATE (Rule 55):
    Place an element on the board manually (or via bot).
    Confirm: tiny particle burst visible when element token appears.
    Does not affect click stability (bursting is display-only, no DOM interaction needed).

  COMMIT:
    git add src/index.css src/components/Board/HexCell.jsx
    git commit -m 'feat(ui): element placement particle burst animation · pure CSS SVG · NeoTopia T1 S15'

## RULES
  NEVER git add -A
  NEVER commit .claude/comms/
  Rule 55: screenshot-verify EVERY visual task
  All 3 commits: separate, pathspec
  Evolution lesson → .claude/comms/tomorrow.md (disk only)
  Session /300 · Forge /200 retroactive
