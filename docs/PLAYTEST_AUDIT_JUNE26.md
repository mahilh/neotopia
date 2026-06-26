# NEOTOPIA UX AUDIT — FIRST REAL PLAYTEST
# Date: June 26 2026 · Players: Mahil + Shahzaman (Karachi)
# Written immediately after · AUTODRIVE! post-playtest analysis

## WHAT HAPPENED (the honest account)

  Players: 2 (Mahil + friend Shahzaman via WhatsApp code share)
  Session: Turn 17 reached · Score: 0/0/0 all regions · Hand: 27 cards
  Outcome: Game was played but core loop never activated
  Root cause: Both players only did Action A (draw cards) the entire session
                Neither player placed a single element on the board (Action B)
                Score stayed 0 because no elements = no patterns = no scoring

## THE ONBOARDING FAILURE (most critical finding)

  The UI presents two actions with no priority signal between them:
    A: Draw a card
    B: Place an element from factory to region

  New players default to A because:
    · Cards are visually prominent on the right panel
    · Drawing feels 'complete' — you get something and it goes somewhere
    · Placing requires understanding factories, adjacency, and movement
    · There is NO instruction, tooltip, arrow, or tutorial anywhere
    · The board looks static and uninteractable — players don't know to click it
    · The factories (hexagonal elements between regions) are visually confusing

  Fix: The first time a player's turn starts, the game must say:
    'Click a factory to select an element, then click a hex on the board to place it'
    Or show an animated arrow pointing from factory to region.

## COMPLETE BUG LIST (ranked by severity)

### SEVERITY 1 — GAME BREAKING
  BUG-01: No tutorial or onboarding. Players don't understand Action B (place element).
           Fix: First-turn tutorial overlay with step-by-step instructions.

  BUG-02: Factory interaction is not obvious. Players don't know factories are clickable.
           Fix: Pulse animation on factories when it's your turn + 'Click to take element' tooltip.

  BUG-03: Board appears uninteractable. Hexes don't signal they can receive elements.
           Fix: Highlight valid placement hexes when an element is selected from factory.

### SEVERITY 2 — MAJOR UX FAILURE
  BUG-04: No copy button for room code.
           Fix: Copy-to-clipboard button next to room code in lobby. Single-click.

  BUG-05: Username cannot be changed.
           Fix: Editable username field in lobby. Pencil icon next to name.

  BUG-06: Hand has 27 cards with no limit signal.
           Fix: Show hand count prominently. Consider hand limit of 10-15 cards.
           Alternative: Show a warning when hand exceeds 10 cards.

  BUG-07: No visual feedback after card draw.
           Fix: Brief animation when card enters hand. Flash the drawn card.

### SEVERITY 3 — POLISH
  BUG-08: Board is too dark. Regions are hard to distinguish.
           Fix: Increase region color intensity. Add subtle hex grid lines.

  BUG-09: Card element dots are too small to read.
           Fix: Increase dot size on cards. Show element count labels.

  BUG-10: No in-game chat or communication between players.
           Reference: colonist.io has a chat panel.
           Fix: Simple text chat in the game panel.

  BUG-11: Card names include personal products (AetherMind, KnowBrand) and personal names.
           Fix: Full card rename per CARD_NAMES_REDESIGN.md.

  BUG-12: Score shows 0 with no explanation that you need to match patterns to score.
           Fix: Tutorial hint on first turn: 'Match this card pattern on the board to score'.

  BUG-13: No turn timer. Players don't know how long to think.
           Reference: colonist.io shows timer (00:54 visible in screenshots).
           Fix: 90-second turn timer with visual countdown.

  BUG-14: The 'End Turn' button is prominent but there's no instruction on when to use it.
           Fix: End Turn should be grey/disabled until at least 1 action is used.
           Better: Show 'Actions remaining: 3' with clear countdown.

  BUG-15: No game chat between players.
           Fix: Basic message input in the side panel.

## COLONIST.IO FEATURES TO ADOPT

  Priority High:
  · Turn timer (00:54 style countdown) · creates urgency and pacing
  · 'Place [action]' instruction text at bottom center · always tells you what to do
  · Copy code button in lobby · single click
  · Resource/element counts visible at all times
  · Player comparison panel (who has what)

  Priority Medium:
  · In-game chat
  · Karma/rating system
  · Bot opponents for solo practice
  · Leaderboard

  Priority Low:
  · Multiple game modes (Casual / Ranked)
  · Cosmetics / visual customization

## VISUAL IMPROVEMENTS (colonist.io vs neotopia analysis)

  colonist.io: bright colorful hexes · clear borders · element tokens large + readable
  NeoTopia current: dark regions · small elements · factory hexes confusing

  Physical board reference (mebo.pt): vibrant illustrated world · score tracks visible
  The physical board looks 10x more alive than the digital version.
  The digital version should match the energy of the physical board.

  Priority visual fixes:
  · Increase region color saturation by 30%
  · Add clear hex border lines (subtle white at 10% opacity)
  · Make element tokens 20% larger
  · Pulse animation on clickable factories
  · Glow effect on valid placement hexes (selected element held)
  · Score flash animation when points are earned

## PATH TO GREAT FIRST PLAYTEST

  With these fixes, the next playtest should reach:
  · Players score at least 1 card in the first 5 turns
  · Players understand the 2-action system without being told
  · Players can share room code in <5 seconds
  · The game feels alive and reactive, not static

  Estimated sessions to get there: T1 S8 (onboarding) + T1 S9 (visual polish)
  Current state: 66/200 XRAY! score
  Target after fixes: 155/200+
