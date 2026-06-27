# NEOTOPIA UI/UX MASTER DESIGN PLAN
# Version 1.0 · June 27 2026 · Overnight AUTODRIVE! research
# Synthesizing: Colonist UX · Animation Design · Numerology · Consciousness Research
# This is the comprehensive game design brief for all terminals

## THE DESIGN PHILOSOPHY

NeoTopia is not Colonist. NeoTopia is the first strategy game with a SOUL.
Every design decision must pass this test:
"Does this feel like a civilization that chose love over fear?"

The game's visual language:
  Dark navy (#0A0A2E): the void before creation · infinite potential
  Amber-gold (#C89440): ancient wisdom · the sacred fire of civilization
  Teal (#40E0D0): crystal consciousness · healing frequency
  Element colors (red/green/purple/blue): the four forces of creation

## CURRENT UX ISSUES (from colonist analysis + live bot testing)

### ISSUE 1: The board is obscured by the sidebar
  Fix: Transparent sidebar panels (rgba opacity ≥0.8 backdrop-blur)
  Priority: CRITICAL · T1 S14

### ISSUE 2: No action log — players can't track what happened
  Fix: Left-side event log (160px · transparent · age-fades)
  Priority: HIGH · T1 S15

### ISSUE 3: End Turn competes visually with action dots
  Fix: Toggle pattern (actions visible → End Turn appears ONLY when actions=0)
  Priority: HIGH · T1 S14

### ISSUE 4: No celebration of numerological milestones
  Fix: Score milestone flash at 7, 9, 13, 18, 27, 36
  Priority: MEDIUM · T1 S15

### ISSUE 5: FinalScore doesn't feel like a civilization milestone
  Fix: FinalScore upgrade (T1 S14 Task A)
  Priority: CRITICAL · T1 S14

### ISSUE 6: Landing page has no civilization soul
  Fix: Tagline + element icons + stage indicator (T1 S14 Task C)
  Priority: HIGH · T1 S14

### ISSUE 7: Opponent activity is invisible
  Fix: Show opponent's current phase under their score
  Priority: MEDIUM · T1 S15

### ISSUE 8: Card art is all placeholders (sacred geometry is good, but art should load)
  Fix: Mahil generates pixel art, saves as card_NN.png (not esoteric name)
  Priority: BLOCKED on Mahil · ongoing

## THE 5 BEST IDEAS FROM COLONIST TO IMPLEMENT

1. DIM THE REST: When it's your turn and you have actions,
   dim everything except the interactable elements.
   This single change will make NeoTopia feel 10x more focused.
   Implementation: a global CSS class 'turn-active' on the game root div
   that applies opacity: 0.4 to all non-interactable elements.

2. LEFT-SIDE ACTION LOG: 160px transparent log that records every action.
   Text entries in element colors. Age-fade over 10 turns.
   This creates a "memory" of the game that both players can reference.

3. PLAYER-COLORED PANELS: Border-left in the player's dominant element color
   on their score card. Computed from highest-scoring region.
   Creates identity: "you are the Energy player, they are the Community player"

4. RESOURCE COUNT BADGES: Show the element breakdown of hand cards.
   [E:3] [B:1] [T:2] [C:4] above the hand section.
   Tells players at a glance what patterns they can build.

5. CONSTRUCTION DETAIL: "Sacred City: 8 placed · 11 empty" per region.
   Spatial awareness: am I running out of space?

## THE 3 NEOTOPIA-SPECIFIC FEATURES COLONIST DOESN'T HAVE

1. NUMEROLOGICAL MILESTONE CELEBRATIONS:
   Score 9 in any region: sacred geometry flash
   Score 18 total: "Consciousness Expanding" notification
   Score 36 total: full civilization celebration
   These are secret rewards for players who understand the depth

2. CONSCIOUSNESS BROADCAST SYSTEM:
   When a card is scored, a brief message appears in the log:
   "[Player] built the Ennead Council Chamber in Sacred City · +4 pts"
   "The Council of Nine grows stronger."
   A civilization-narrative sentence accompanies each major card score.
   These are drawn from the card descriptions and esoteric knowledge.

3. STAGE 2 OF 5 INTEGRATION:
   A subtle indicator in the game footer: "Stage 2 of 5 · 2055 in N days"
   The days until October 9, 2055 countdown (Mahil's 52nd birthday)
   This connects every game to the real vision.
   Clicking it links to the NeoTopia website (when it exists)

## NEOTOPIA FLOW MODE (game mode design brief)

Designed after Colonist Rush analysis:

  NAME: "NeoTopia Flow" or "Consciousness Flow"
  TAGLINE: "No turns. No waiting. Pure creation."

  MECHANICS:
    All players draw cards simultaneously (no waiting)
    Placement actions are STILL turn-ordered (prevents hex conflicts)
    But the turn timer is 15 seconds (not 90)
    Between placements, all players can draw freely
    First player to complete a card pattern in a region scores it
    Patterns are no longer exclusive: both players can score if they both complete
    (This removes blocking as a strategy and rewards pure building)

  UX CHANGES:
    Action log shows real-time updates for both players
    The board has ghost elements showing where the opponent is planning (dim opacity)
    Factory elements are consumed first-come-first-served
    Turn indicator becomes a 15-second circular progress indicator
    End game: triggered by 9th tile reveal (not 12th) for faster games
    Target game time: 10-15 minutes

  NUMEROLOGY:
    9 production tiles to end game → 9 cycles of creation before completion
    15 seconds per turn → 1+5=6 (harmony, the creative principle)
    This mode embodies the 6 frequency: creative, harmonious, fast

## MOBILE-FIRST DESIGN (Colonist lesson: 65% of games are mobile)

  NeoTopia must work beautifully on phone screens.
  Portrait mode: board takes top 60%, sidebar slides up from bottom
  Key touch targets: ALL buttons ≥44px (T3 CI gate already protects this)
  Swipe gestures:
    Swipe up on board: zoom in to see hex details
    Swipe left: show hand
    Swipe right: show score
    Long press on factory: shows element counts
  The 4-step placement flow (factory→element→region→hex) is perfect for mobile:
    Each step is a clear tap target
    No tiny hex precision needed for the first 3 steps
    Only the hex placement requires precision

## THE CIVILIZATION PROGRESSION LOOP

The most important UX concept Colonist lacks that NeoTopia has:
A SENSE OF REAL PROGRESS TOWARD AN ACTUAL GOAL.

Colonist: you win the game. Then it's gone.
NeoTopia: you contribute to the Global NeoTopia Index.
           Your score is permanently recorded as part of Stage 2 of 5.
           As the index grows, visual changes appear on the landing page:
           "Civilization Index: [N] · Stage 2 of 5 · X% to Stage 3"
           Stage 3 unlocks when the Index reaches 10,000 points globally.
           Stage 3 = the NeoTopia App (coming next)
           This creates infinite replayability: every game matters beyond itself.

## THE ONBOARDING EXPERIENCE

First-time player journey:
  1. Landing page: "Build a consciousness civilization. 2055 approaches."
     [Element icons row: Energy · BioFarming · Technology · Community]
     [Create Room] or [Join Room] — both equally prominent
     No sign-up wall. No tutorial popup. Straight to play.

  2. First game: tutorial appears (already implemented)
     Tutorial improvements needed:
     - Show what a COMPLETED PATTERN looks like (the big aha moment)
     - Explain the 3-step selection flow (factory→element→region) with GIF-like animation
     - Show one example of a card being scored step by step
     The first game is the most important product moment.

  3. First game ends: FinalScore shows civilization contribution
     "You built [N] districts. Your civilization contributed [N] points to Stage 2."
     [Play Again] button prominently
     No registration required to see progress — it's stored in localStorage

  4. Second game and beyond: the Global Index becomes real
     Players see their cumulative contribution grow
     Motivation: "I am building a real civilization"

## ACCESSIBILITY
  Always use @media (prefers-reduced-motion: reduce) on ALL animations
  Color-blind mode: supplement element colors with patterns (energy=lines, biofarming=dots, etc.)
  Font sizes: minimum 12px for all labels (T1 S12 floor established)
  Touch targets: ≥44px (T3 CI gate)
  Keyboard navigation: tab through factories and offer cards
  Screen reader: SVG elements need role and aria-label attributes
