# T1 S13 MASTER FORGE
# Target: 200/200 · Tasks A/B/C rated /50 · Forge self-rated /200 before execution
# NeoTopia T1 · Visual Layer · src/components/ · src/pages/ · src/App.jsx · src/utils/
# Date: June 27 2026 (post S12 · 36 placed confirmed · bot v4.3 live)

## MISSION

T1 S13 has THREE tasks. All are T1-lane visual improvements.
The game is mechanically proven (36 placed in production). Now it needs to FEEL like a civilization.

Task A: CardFrame procedural sacred geometry placeholder (makes every card beautiful even without pixel art)
Task B: Dual-player score display (opponent scores visible alongside your own)
Task C: Instruction bar element-color theming (visual feedback when selecting elements)

FORGE SELF-RATING BEFORE EXECUTION: If any gate fails below 85/100 · REWRITE before touching code.

---

## GATES (read ALL before writing a single line)

Gate 1: `cat .claude/CLAUDE.md | head -60`
  Verify: STATUS block, force:true is load-bearing, comms are LOCAL ONLY (never commit)
  HARD STOP if: you see a rule you are about to violate

Gate 2: `cat .claude/comms/tomorrow.md 2>/dev/null | tail -60`
  Verify: T2 and T3 have no pending tasks that affect sidebar or CardFrame
  HARD STOP if: another lane owns a file you need to edit

Gate 3: Read these files FULLY before touching them:
  - src/components/CardFrame.jsx (image load/error state, artUrl = /art/cards/${card.id}.png)
  - src/pages/GameRoom.jsx (currentPlayer, players array, sectionLabel style object)
  - src/components/ActionBar.jsx (turn timer display)
  Verify: CardFrame already auto-loads art. DO NOT re-implement what already exists.

Gate 4: `npx vitest run 2>&1 | tail -6`
  HARD STOP if: any test is red. Do not edit under red.

Gate 5: `npm run build 2>&1 | tail -4`
  HARD STOP if: build fails. Premise is broken.

Gate 6: `git log --oneline -6 && git status --short`
  Verify: HEAD is origin/main. Working tree has only T1 files staged/modified.
  HARD STOP if: you see T2 or T3 files modified. NEVER touch them.

Gate 7 (soft): Read T3's game-ux.e2e.js touch-target gate.
  Verify: 44px touch-target gate is HARD (zero violations required).
  Element/region buttons in GameRoom.jsx are already 44px height.
  DO NOT reduce any touch target below 44px.

---

## TASK A · CardFrame Sacred Geometry Placeholder (target: 50/50)

CURRENT STATE:
  CardFrame.jsx lines 144-156: when no pixel art, shows ElementIcon + card.id text
  This looks like a dev tool. The game deserves better even before Mahil generates all 56 images.

WHAT TO BUILD:
  Replace the fallback `<div>` placeholder with a procedural SVG sacred geometry illustration.
  The SVG should be element-specific and beautiful.

  Energy (red): Torus rings — 2 concentric circles with 4 radiating arc lines, all in #E24B4A
  BioFarming (green): Seed of Life — 7 overlapping circles, central + 6 around, in #1D9E75
  Technology (purple): Metatron grid — hexagonal dot grid (3x3 hex centers) with connecting lines, in #7F77DD
  Community (blue): Flower of Life — 7 circles (inner) with 6 partial outer circles, in #378ADD

  All on the existing #060612 art background.
  All have 20% opacity to remain subtle (placeholders, not art).
  Card id text moves to a subtle 8px caption at bottom of placeholder area.

IMPLEMENTATION:
  Replace the existing `{(imgError || !imgLoaded) && (...))}` block in CardFrame.jsx
  with a function `ProceduralArt({ element, colors, artSize, cardId })` that returns the SVG.
  Compute viewBox based on artSize prop (s.artSize from the sizes object).

  // Seed of Life example (BioFarming):
  const R = artSize * 0.18  // radius per circle
  const cx = artSize / 2, cy = artSize / 2
  const centers = [
    [cx, cy],
    ...Array.from({length:6}, (_,i) => [cx + R*Math.cos(i*Math.PI/3), cy + R*Math.sin(i*Math.PI/3)])
  ]
  // render 7 <circle> elements

  Keep: ElementIcon approach for fallback if SVG computation fails
  Keep: the card.id caption (helps Mahil know which art to generate next)
  DO NOT: change the card frame SVG borders, corners, title, or element label

EVIDENCE GATE (before commit):
  Open browser dev tools. Navigate to /game (solo dev mode).
  Verify: offer cards show the element-specific sacred geometry (not just a grey box or icon)
  Verify: when you drop ennead-source-temple.png into public/art/cards/ennead-source-temple.png,
          the card fades from placeholder to pixel art (imgLoaded triggers opacity: 1)

---

## TASK B · Dual-Player Score Display (target: 50/50)

CURRENT STATE:
  GameRoom.jsx lines 254-272: only shows currentPlayer?.scores
  Opponent score is invisible. A human player has no sense of how they're competing.

WHAT TO BUILD:
  Replace the single-player Score section in the sidebar with a two-player comparison.

  Layout:
    [My Score] vs [Opponent]
    Sacred City:  [8]    [6]
    Living Earth: [4]    [3]
    Free Energy:  [0]    [2]

  Show currentPlayer's scores in white, opponent in rgba(255,255,255,0.35)
  Show player names (truncated to 10 chars) as column headers
  If no opponent (solo dev mode), show single column as before

IMPLEMENTATION:
  In GameRoom.jsx, inside the Score `<div>` section:

  const myPlayer = players.find(p => p.seat === mySeat)
  const opponent = players.find(p => p.seat !== mySeat && p.seat !== null)

  Render a 3-column table-style layout using flexbox:
  - Column 1: region name (left-aligned, rgba white 0.45)
  - Column 2: my score (right-aligned, white, fontWeight 700)
  - Column 3: opponent score (right-aligned, rgba white 0.35) · only if opponent exists

  DO NOT use <table> element. Use divs + flex.
  Touch target: this is display-only, no buttons.

EVIDENCE GATE:
  Two-player dev game or actual bot run. Confirm both scores visible side by side.
  Confirm solo mode still shows single score column (no crash when opponent=undefined).

---

## TASK C · Instruction Bar Element-Color Theming (target: 50/50)

CURRENT STATE:
  GameRoom.jsx lines 143-154: instruction line is always rgba(255,255,255,0.5)
  Exception: scorePending is #1DC864 (green)
  Missing: when uiPhase=elementSelected or regionSelected, the instruction should pulse
           in the SELECTED ELEMENT'S color to confirm what was just picked.

WHAT TO BUILD:
  Add element-color theming to the instruction bar based on uiPhase + selectedElement.

  const instructionColor = (() => {
    if (uiPhase === 'scorePending') return '#1DC864'
    if (uiPhase === 'elementSelected' || uiPhase === 'regionSelected') {
      const el = selectedElement
      return el ? ELEMENT_COLORS_MAP[el] : 'rgba(255,255,255,0.5)'
    }
    return 'rgba(255,255,255,0.5)'
  })()

  Where ELEMENT_COLORS_MAP = {
    energy: '#E24B4A',
    biofarming: '#1D9E75',
    technology: '#7F77DD',
    community: '#378ADD',
  }

  Replace the `color:` in the instruction bar style with `instructionColor`.
  Also: when uiPhase=regionSelected, add `fontWeight: 500` to the instruction span.
  This is a VISUAL ONLY change. No state changes. No store writes.

IMPLEMENTATION:
  ELEMENT_COLORS_MAP can be derived from ELEMENT_COLORS in hexUtils.js (already imported).
  Or define inline in GameRoom.jsx (simpler, no new import).
  selectedElement is already destructured from useGameActions.

EVIDENCE GATE:
  Click a factory · pick Energy element · instruction bar turns red (#E24B4A) · verify in browser.
  Click BioFarming · instruction turns green (#1D9E75).
  Joiner's turn (not my turn) · instruction is still rgba white 0.5 (no color theming while waiting).

---

## COMMIT SEQUENCE

Commit per task (not per session):
  git add src/components/CardFrame.jsx
  git commit -m 'feat(ui): CardFrame procedural sacred geometry placeholder per element type · NeoTopia T1 S13'

  git add src/pages/GameRoom.jsx
  git commit -m 'feat(ui): dual-player score display + element-color instruction bar · NeoTopia T1 S13'

NEVER: git add -A
NEVER: touch scripts/ migrations/ tests/e2e/ (T2 and T3 lanes)
NEVER: commit .claude/comms/ (gitignored, filesystem local)

## SELF-RATE AFTER EACH TASK
  Task A: rate /50 after implementation. <35 = redo.
  Task B: rate /50. <35 = redo.
  Task C: rate /50. <35 = redo.
  Session: rate /300 at end.
  Forge: rate /200 retroactively.

## EVOLUTION LESSON (record one per session in comms)
  Write to .claude/comms/tomorrow.md · FILESYSTEM ONLY · DO NOT git commit
