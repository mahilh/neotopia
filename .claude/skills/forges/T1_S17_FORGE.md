# T1 S17 MASTER FORGE · FACTORY 44px + FLOW LOBBY + CLUSTER VIZ + ART SKELETON
# NeoTopia · post S16 complete · June 27 2026
# DEEP AUTODRIVE! post-council · 65 rules · 124 tests · Flow mode real end-to-end
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T1 lane: src/components/ · src/pages/ · src/index.css

## S16 COMPLETE (T1 committed · HEAD 133f0b9):
  4b8d055: sacredMilestone overlay (✷ · 2500ms · amber-gold · symbol from live store)
  b18ebba: FinalScore "Civilization Index · 14 points" · Stage 2 of 5
  b810a6a: Mobile fix · board 55px→343px at 375px · desktop no-regression
  bea3bca: sessionId wire · Rule-61 console.log · null=skips, UUID=records
  Rule 64 (T1 S16): A premise re-verified at boot is not verified at the moment you act.
  Rule 65 (T3 S16): When two lanes touch one seam, trace the composed value after both edits.

## WHAT T2+T3 HAVE SHIPPED (T1 must know before coding):
  86d0220: GAME_MODES config · getModeConfig() · classic 90s/12tiles · flow 15s/9tiles
  133f0b9: startGame passes gameMode · flow seeds 9 tiles/15s REAL end-to-end
  ced8133: createRoom(mode) · passes mode to game_sessions
  1e9e249: useGameSync exposes sessionId
  Mobile guard: board ≥200px HARD · factories 32px MEASURED (not yet 44px)

## RULES MOST AT RISK THIS SESSION:
  Rule 4: 44px touch targets. Factories at 32px is a Rule 4 violation. Task A fixes this.
  Rule 55: screenshot every visual task · Task A needs before+after mobile screenshots
  Rule 64: re-check every premise at the moment of the decision, not just at boot
  Rule 1: NEVER git add -A · T3 files still in working tree
  Rule 37: CSS height is a request · verify SVG factory sizing before adding CSS

## GATES (all 7 required)

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  Confirm: 4b8d055 b18ebba b810a6a bea3bca 133f0b9 all in log
  Check: git log | grep -i 'factory\|44px\|touch' (has T1 already touched factory sizing?)
  Check: git log | grep -i 'lobby\|flow toggle\|mode select' (lobby toggle shipped?)
  Read current mobile guard measurements from T3's comms

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Note: exact factory element class/selector from T3's guard measurements
  Note: T2's simultaneous draw plan — does it affect the lobby toggle design?
  HARD STOP if another terminal claims src/pages/Lobby.jsx or src/index.css mid-session.

Gate 3 (10 min — READ FULLY):
  cat src/pages/Lobby.jsx FULL
  Answer before coding Task B:
    a. How does Lobby currently create a room? (what function, what arguments?)
    b. Is there a mode selector UI already? (even partially)
    c. What state does Lobby hold? (look for useState calls)
    d. How does Lobby call createRoom? (via useGameRoom? directly?)
  cat src/index.css FULL — find factory selectors:
    grep -n 'factory\|hex-factory\|hex-btn' src/index.css src/components/GameBoard.jsx
  Answer before coding Task A:
    a. What CSS class or selector targets the factory buttons?
    b. What is their current size at mobile? (already measured by T3: 32px)
    c. What prevents them from reaching 44px? (flex shrink? fixed width? SVG constraints?)

Gate 4: npx vitest run 2>&1 | tail -8 · 124 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors required
Gate 6: git log --oneline -12 && git status --short
  Only T1 files in working tree. Any T3 file = DO NOT TOUCH.
Gate 7: Open dev server and screenshot factories at 375px viewport (Rule 55 baseline).
  npm run dev & · resize browser · measure factory hit area.
  This is your before screenshot for Task A.

---

## TASK A · Factory 44px Touch Targets at Mobile (target: 47/50)
# Rule 4 violation. Factories at 32px at 375px. Must reach 44px minimum.
# CSS only if possible. Zero game logic changes. Zero force:true interference.

### APPROACH:
  The hex factories are SVG elements rendered in the game board SVG.
  Their tap area is determined by their SVG geometry (cx,cy,r for circles or
  x,y,width,height for rects).

  Gate 3 answer drives approach:
  IF factories are HTML elements: add min-width/height in @media (max-width: 600px)
  IF factories are SVG circles: increase r attribute OR add a transparent hit-area circle
    The hit-area approach: add <circle r="22" fill="transparent" class="factory-hit" />
    centered on each factory, making the tap area 44px diameter without changing visuals.
  IF factories are SVG rects: increase width/height OR add transparent hit rect

  NEVER remove force:true from factory click handlers (Rule 53).
  NEVER change the factory position coordinates — only the tap area size.

### EVIDENCE GATE:
  SCREENSHOT 1: factory at 375px BEFORE (shows 32px)
  SCREENSHOT 2: factory at 375px AFTER (shows ≥44px hit area)
  If the hit area change is invisible: test with a temporary bright border on the factory element.
  Measure with browser DevTools: Elements > Computed > height ≥44px

### COMMIT:
  git add src/components/GameBoard.jsx (or src/index.css — whichever you touched)
  git commit -m 'fix(ui): factory touch targets 32px→44px at mobile · Rule 4 · NeoTopia T1 S17'

### WRITE TO COMMS:
  'T3: factory touch target fix shipped. Upgrade mobile guard hard-gate from 32px to 44px.
   Factory selector: [exact selector you used]. Method: [SVG hit area / CSS / other].'

---

## TASK B · Flow Mode Lobby Toggle (target: 48/50)
# GAME_MODES config: T2 S15. createRoom(mode): T3 S16. Engine: T2 S16. Seam: T3 S16.
# The final piece: a UI in Lobby.jsx to let the host choose Classic or Flow mode.
# Read Gate 3 answer for Lobby.jsx structure before writing a single line.

### WHAT TO BUILD:
  A mode selector component in the Lobby.jsx (host side — the room creator sees it,
  not the joiner). Two choices: Classic and Flow mode.

  UI design (Colonist.io-inspired but NeoTopia-voiced):
    Two toggle buttons, side by side:
      [Classic · 12 tiles · 90s turns]    [Flow · 9 tiles · 15s turns]
    The selected mode has amber-gold border (#C89440). Unselected is muted.
    Below the toggle, a single line of description changes based on selection:
      Classic: "Place 12 elements. 90 seconds per turn. The original way."
      Flow: "Place 9 elements. 15 seconds. All players draw simultaneously."
    The mode is passed to createRoom() when the host starts the game.

  React implementation:
    const [gameMode, setGameMode] = useState('classic')
    // Pass to createRoom:
    const handleStart = () => createRoom({ mode: gameMode })
    // Two buttons:
    <button onClick={() => setGameMode('classic')
      style={{ border: gameMode==='classic' ? '2px solid #C89440' : '...' }}>
      Classic
    </button>
    <button onClick={() => setGameMode('flow')
      style={{ border: gameMode==='flow' ? '2px solid #C89440' : '...' }}>
      Flow
    </button>

  VERIFY (Gate 3 answer a): createRoom takes { mode: string } — confirm from useGameRoom.
  DO NOT hardcode mode names. Import GAME_MODES from gameConfig if available in T1 lane.
  Check: is gameConfig.js in src/store/ (T2 lane)? If so: import it. If not: use string literals.

### EVIDENCE GATE (Rule 55):
  Screenshot 1: Lobby showing Classic mode selected (amber-gold border on Classic)
  Screenshot 2: Lobby showing Flow mode selected (amber-gold border on Flow)
  Screenshot 3: Game starts in Flow mode — verify the mode is passed (check Supabase
    row via console: console.log('room mode:', sessionMode) in the game component)

### COMMIT:
  git add src/pages/Lobby.jsx (and any related component files)
  git commit -m 'feat(ui): Flow mode lobby toggle · Classic/Flow selector · NeoTopia T1 S17'

---

## TASK C · FinalScore Cluster Visualization (target: 46/50)
# calculateFinalScore returns the cluster bonus number but not WHICH clusters scored.
# The player sees their total but doesn't know which pattern earned the cluster bonus.
# This is the most educational moment in the game — teach through the end screen.

### WHAT calculateFinalScore returns (read src/lib/ to verify before coding):
  Read the function: cat src/lib/*.js | grep -A 20 'calculateFinalScore'
  It likely returns: { total, best, second, worst, unused, cluster }
  Task: expose WHICH clusters scored, not just the count.

### APPROACH:
  Read calculateFinalScore FULLY. Find where cluster bonus is counted.
  The cluster bonus uses BFS (Rule 10) to find connected scored cards.
  What we need: which element types formed the clusters?
  Add to the return: { ...existing, clusterDetail: [{element, count, bonus}] }
  OR: return the clustered card IDs so T1 can display them highlighted.

  IF calculateFinalScore is in T2 lane (src/lib/): read it, propose T2 adds clusterDetail,
  write to comms: 'T2: need clusterDetail array from calculateFinalScore · see spec'
  THEN: build the T1 display that reads whatever clusterDetail shape T2 provides.

  T1 display: in FinalScore.jsx, below the score breakdown:
    {clusterDetail?.map(c => (
      <div key={c.element}>
        {c.element}: {c.count} connected · +{c.bonus} pts
      </div>
    ))}
  Color each cluster entry by its element color (use ELEMENT_COLORS import).

### COMMIT:
  git add src/components/FinalScore.jsx
  git commit -m 'feat(ui): FinalScore cluster visualization · element-colored · NeoTopia T1 S17'

---

## TASK D · Card Art Skeleton Loader (target: 45/50)
# When card_NN.png doesn't exist yet: smooth skeleton, not jarring placeholder.
# The procedural geometry shows when art is missing. This task makes it graceful.

### WHAT TO BUILD:
  In ProjectCard.jsx (or wherever cards render their image):
  Read the current img/art loading code first (grep -n 'card_\|art\|img' src/components/ProjectCard.jsx)

  Add an onError handler to the img element:
    <img
      src={`/art/cards/card_${String(cardId).padStart(2,'0')}.png`}
      onError={e => { e.currentTarget.style.display='none'; setArtMissing(true); }}
      alt={cardName}
    />
    {artMissing && <div className="art-skeleton">...</div>}

  Art skeleton design:
    Background: the existing procedural geometry placeholder (already shown)
    Add a subtle animated shimmer: CSS animation, opacity 0.5→0.8→0.5, 2s loop
    Add the card name as a small text label in the skeleton area
    The shimmer makes it clear "art is loading" not "art is broken"

  In src/index.css:
    @keyframes artShimmer {
      0%,100% { opacity: 0.5; }
      50% { opacity: 0.8; }
    }
    .art-skeleton { animation: artShimmer 2s ease-in-out infinite; }

### COMMIT:
  git add src/components/ProjectCard.jsx src/index.css
  git commit -m 'feat(ui): card art skeleton loader · shimmer while art missing · NeoTopia T1 S17'

---

## RULES
  NEVER git add -A · pathspec only (T3 files in working tree)
  NEVER touch: src/lib/ · src/store/ · migrations/ · tests/e2e/
  Rule 64: re-check every premise at the moment of decision, not just at boot
  Rule 4: factory hit area must reach 44px MEASURED (not assumed)
  Rule 55: screenshot every visual task · Tasks A+B+C each need screenshots
  Evolution lesson → comms disk only · NEVER commit comms

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Task D /50
  Session /300 · Forge /200 retroactive
