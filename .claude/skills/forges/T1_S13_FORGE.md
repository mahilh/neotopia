# T1 S13 MASTER FORGE · VISUAL CIVILIZATION LAYER
# NeoTopia · June 27 2026 · post-bot-proven · 36 placed in production
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.
# T1 lane: src/components/ · src/pages/ · src/App.jsx · src/utils/

## WHAT CHANGED SINCE LAST FORGE
- Bot v4.3 placed 36 elements in 20 turns. The game is mechanically proven.
- DOM-DIAG confirmed: factories=3, cardsByOffer=4, myTurn=1 · all working
- CardFrame.jsx already auto-loads /art/cards/${card.id}.png with fade-in + fallback
- 56 card names being upgraded by T2 this session · your CardFrame renders them
- 12px labels done (S12) · turn timer done (S12)
- FinalScore.jsx exists but has NOT been visually verified as "civilization-worthy"

## SESSION GOAL
Make NeoTopia FEEL like a civilization. Three tasks:

Task A: CardFrame procedural sacred geometry placeholder (beautiful without pixel art)
Task B: FinalScore screen visual audit and upgrade (the end-game moment must be epic)
Task C: Dual-player score sidebar + element-color instruction bar

---

## GATES — READ ALL BEFORE WRITING A LINE

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -50
  Confirm: COMMS are local-only, NEVER commit .claude/comms/, force:true is load-bearing
  HARD STOP if any rule you are about to violate appears here.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  Confirm: T2 is working on projectCards.js (card names). T3 is on CI + reconnect.
  HARD STOP if T3 has claimed src/hooks/useGameRoom.js — that is their file.

Gate 3 (5 min — READ, DO NOT SKIM):
  cat src/components/CardFrame.jsx
  cat src/components/FinalScore.jsx
  cat src/pages/GameRoom.jsx | head -100
  You MUST understand these files before touching them.
  Key facts: CardFrame imgLoaded/imgError state · artUrl = /art/cards/${card.id}.png
  FinalScore receives: players · mySeat · sync · roomId

Gate 4: npx vitest run 2>&1 | tail -6
  HARD STOP if any test is red.

Gate 5: npm run build 2>&1 | tail -4
  HARD STOP if build fails.

Gate 6: git log --oneline -8 && git status --short
  Confirm HEAD = origin/main (up to date with T2/T3 card name changes if they pushed first)
  HARD STOP if T2/T3 files appear in your working tree.

Gate 7 (soft): Check touch targets in game-ux.e2e.js.
  Any button you add must be ≥44px height. This is a hard gate in CI.

---

## TASK A · CardFrame Sacred Geometry Placeholder
# Target: 48/50 · Max impact: every card looks intentional before art exists

PROBLEM:
  Current fallback (when no PNG art exists): shows ElementIcon + card.id text.
  Looks like a developer placeholder. Players see 56 grey boxes with IDs.
  This session's game deserves better.

SOLUTION: Replace the fallback div in CardFrame.jsx with a procedural SVG.
Element-specific sacred geometry, subtle (20% opacity), beautiful.

FOUR PATTERNS:
  energy (red #E24B4A):
    - A torus cross-section: 2 concentric circles + 4 radial arc lines at 90° intervals
    - Outer circle r = artSize*0.40, inner r = artSize*0.22
    - 4 straight lines from inner to outer circle at top/bottom/left/right
    - All strokes: 1.5px, element color, 20% opacity

  biofarming (green #1D9E75):
    - Seed of Life: 7 circles, each r = artSize*0.18
    - Centers: [cx,cy], then 6 around it at distance r along 0°,60°,120°,180°,240°,300°
    - All strokes: 1.5px, element color, 20% opacity

  technology (purple #7F77DD):
    - Metatron grid: 7 dot centers (same as Seed of Life pattern) connected by straight lines
    - Draw lines between EVERY pair of the 7 centers (21 lines total)
    - Each line: 0.8px, element color, 12% opacity
    - Then overlay 7 small filled circles: r=3px at each center, element color, 25% opacity

  community (blue #378ADD):
    - Flower of Life inner core: 7 circles (same centers as Seed of Life)
    - PLUS 6 partial arcs around the outside (completing the outer ring of the flower)
    - All strokes: 1.5px, element color, 20% opacity

IMPLEMENTATION:
  1. Add a ProceduralArt component above CardFrame's default export:

     function ProceduralArt({ element, color, artSize, cardId, fontSize }) {
       const cx = artSize / 2
       const cy = artSize / 2
       const R = artSize * 0.18
       // compute centers, paths, etc. per element
       return (
         <svg width={artSize} height={artSize} style={{ opacity: 0.9 }}>
           {/* pattern shapes here */}
           {/* card.id caption */}
           <text x={artSize/2} y={artSize-6} textAnchor="middle"
             fill={color} opacity={0.35} fontSize={fontSize-2} fontFamily="serif">
             {cardId}
           </text>
         </svg>
       )
     }

  2. Replace the `{(imgError || !imgLoaded) && (<div>...ElementIcon...</div>)}` block with:
     {(imgError || !imgLoaded) && (
       <div style={{
         position: 'absolute',
         left: s.borderW + 6, top: s.borderW + s.fontSize + 14,
         width: s.width - (s.borderW + 6) * 2, height: s.artSize,
         zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
       }}>
         <ProceduralArt element={el} color={colors.primary}
           artSize={s.artSize} cardId={card.id} fontSize={s.fontSize} />
       </div>
     )}

EVIDENCE GATE:
  Open browser: /game (solo dev mode)
  Confirm: offer cards show element-specific sacred geometry, not grey boxes
  Confirm: drop ennead-source-temple.png into public/art/cards/ → card fades to pixel art

COMMIT:
  git add src/components/CardFrame.jsx
  git commit -m 'feat(ui): CardFrame procedural sacred geometry placeholder · 4 element patterns · NeoTopia T1 S13'

---

## TASK B · FinalScore Screen Civilization Upgrade
# Target: 48/50 · Max impact: the end-game moment must feel like a civilization milestone

PROBLEM:
  You have not audited FinalScore.jsx. A bot just played 20 turns. The game ends.
  What does the player see? You do not know. The forge's job is to make it worthy.

READ FinalScore.jsx FULLY first. Then answer:
  - Does it show a clear winner? (yes/no — find it in the code)
  - Does it show all three region scores per player?
  - Does it show the civilization story (what districts were built)?
  - Does it show the global NeoTopia Index contribution?
  - Is there a "Play Again" button? (data-testid="play-again-btn")
  - Is there an animation or just a static screen?

AFTER READING, implement whichever of these is missing:

  MUST HAVE (if not present):
  □ Clear winner announcement: "[PlayerName] built the stronger civilization"
  □ Per-player per-region breakdown: Sacred City / Living Earth / Free Energy scores
  □ Final score formula displayed: best + 2nd + (worst×3) + cluster + unused×3
  □ Play Again button (data-testid="play-again-btn") → navigates to /
  □ A civilization rating line: e.g. "Stage 2 of 5 · 2055 approaches"

  NICE TO HAVE (add one of these for soul):
  □ Card count built (how many cards scored) per player
  □ Most active district (which region had the most elements)
  □ A brief esoteric closing line (from projectCards descriptions, or a fixed NeoTopia phrase)

  DO NOT:
  □ Add complex animations that break on slow connections
  □ Fetch new data in FinalScore (it already receives everything via props)
  □ Touch useGameSync or any T3 hook

COMMIT:
  git add src/components/FinalScore.jsx
  git commit -m 'feat(ui): FinalScore civilization upgrade · winner · breakdown · Play Again btn · NeoTopia T1 S13'

---

## TASK C · Dual-Player Score + Instruction Color Theming
# Target: 46/50 · Quick wins that transform gameplay clarity

### C1: Dual-Player Score in Sidebar

  CURRENT: GameRoom.jsx Score section shows only currentPlayer scores.
  ADD: Show opponent scores alongside for comparison.

  const myPlayer = players.find(p => p.seat === mySeat)
  const opponent = players.find(p => p.seat !== mySeat && p.seat !== null)

  Layout (3 columns, flex):
    Region name (left)   |  My score (white, bold)  |  Opp score (white, 35%)
    Sacred City          |  8                        |  6
    Living Earth         |  4                        |  3
    Free Energy          |  0                        |  2

  If !opponent → single column (solo dev mode works unchanged)
  Touch targets: display only, no buttons needed

### C2: Instruction Bar Element-Color Theming

  CURRENT: instruction bar is always rgba(255,255,255,0.5)
  UPGRADE: when the player has picked an element type (uiPhase === 'elementSelected'
           or 'regionSelected'), color the instruction in that element's primary color.

  const ELEMENT_COLOR_MAP = {
    energy: '#E24B4A', biofarming: '#1D9E75',
    technology: '#7F77DD', community: '#378ADD'
  }

  const instructionColor = (() => {
    if (uiPhase === 'scorePending') return '#1DC864'
    if ((uiPhase === 'elementSelected' || uiPhase === 'regionSelected') && selectedElement)
      return ELEMENT_COLOR_MAP[selectedElement]
    return 'rgba(255,255,255,0.5)'
  })()

  Replace the hardcoded color in the instruction div style with instructionColor.
  selectedElement is already available from useGameActions destructuring.

  EVIDENCE GATE:
    Click factory → pick Energy → instruction bar turns red #E24B4A.
    Pick BioFarming → instruction turns green #1D9E75.
    Opponent's turn → instruction stays rgba(255,255,255,0.5).

COMMIT:
  git add src/pages/GameRoom.jsx
  git commit -m 'feat(ui): dual-player score sidebar + element-color instruction bar · NeoTopia T1 S13'

---

## COMMIT RULES (non-negotiable)
  Commit per task. NEVER git add -A.
  NEVER touch: scripts/ · migrations/ · tests/e2e/ · src/lib/ · src/store/ · src/hooks/useGameRoom*
  NEVER commit: .claude/comms/ (gitignored, filesystem local)
  Check git status --short before every add.

## SESSION SELF-RATING
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive.
  Evolution lesson → .claude/comms/tomorrow.md (disk only, never commit)
