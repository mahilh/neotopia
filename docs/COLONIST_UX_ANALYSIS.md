# COLONIST.IO UX ANALYSIS · NeoTopia Game Design Reference
# Synthesized June 27 2026 · Live research from colonist.io + community feedback
# Purpose: steal every UI/UX pattern that makes colonist great and adapt for NeoTopia

## WHY COLONIST WORKS

Colonist.io has 15M+ games played per year (2025). It succeeds because:
1. Zero friction to start (no download, no sign-up required, play as guest)
2. Pure strategy with no luck (Catan has dice; colonist minimizes randomness feel through UI)
3. Clear persistent instruction ("what do I do next" is ALWAYS answered on screen)
4. Social texture (chat, emotes, friend system, tournaments)
5. Every player knows their position at all times
6. The board is always the hero (nothing covers it unnecessarily)

## COLONIST UI PATTERNS TO COPY FOR NEOTOPIA

### 1. TRANSPARENT PANELS (HIGHEST PRIORITY)
  Colonist principle: "Panels covering the island are transparent"
  NeoTopia now: sidebar is opaque and eats 288px of board space
  FIX FOR NEOTOPIA:
    - Make the sidebar panels transparent/semi-transparent (background: rgba(10,10,15,0.85))
    - When element selection is active, slide panel over board with backdrop-blur
    - Board should always be visible as the primary surface

### 2. PLAYER-COLORED PANELS
  Colonist principle: "Panels colored per owner"
  NeoTopia: score panel has no player color association
  FIX: When showing dual-player score (T1 S13 shipped), add subtle border-left in player's
       element affinity color. Player who primarily places Energy = red border on their score card.
       This is computed from their highest-scoring region.

### 3. ACTION LOG (LEFT SIDE) — CRITICAL
  Colonist principle: "Log & its scrollbar on left for left-to-right text to encroach less"
  NeoTopia: no action log at all
  ADD TO NEOTOPIA:
    A persistent event log on the left side of the board (not the sidebar).
    Events: "[Player] placed BioFarming in Living Earth" · "[Player] drew Naacal Seed Archive"
            "[Player] scored Ennead Council Chamber: +4 pts"
    Style: small text (11px), age-fades (newest = white, older = rgba(255,255,255,0.3))
    Width: 160px max · transparent background · overlays the board edge
    Log entries use element-colored text (energy=red, biofarming=green, etc.)
    Resource text pills (not just icons) — colonist research shows this reads faster

### 4. DICE & END TURN TOGGLE (REPLACE EACH OTHER)
  Colonist principle: "Dice & end turn buttons replace each other"
  This removes visual clutter: you only ever need ONE of the two
  NeoTopia adaptation:
    When actionsLeft > 0: show action dots (already have this)
    When actionsLeft === 0: ONLY show End Turn button (prominently)
    The remaining actions indicator DISAPPEARS when actionsLeft=0 and End Turn appears
    Currently both are visible simultaneously — this creates decision paralysis

### 5. ACTIONABLE ELEMENT HIGHLIGHTING
  Colonist community feedback: "Actionable elements should stand out. Outline, shine, animate, or dim the rest."
  NeoTopia now: factories pulse (hexPulse animation) but dim-the-rest doesn't happen
  FIX: When it's your turn and you have actions:
    - All non-interactable UI elements dim to 40% opacity
    - Factories and Offer cards are the ONLY elements at full opacity
    - Creates clear focus: "click one of these things"
  When factory is selected:
    - Dim everything except the element-type buttons
  When region is selected:
    - Dim everything except the valid hexes
  This "dim the rest" pattern is the most powerful attention tool in game UI

### 6. RESOURCE COUNT BADGES ON CARDS
  Colonist suggestion: "If we have 4 wood cards, it would help to show '4' on the resource"
  NeoTopia adaptation:
    Show the count of each element type in the player's hand somewhere visible
    Example: after scoring, show the element breakdown of cards in hand
    Small badges on the hand section: [Energy: 3] [BioFarming: 1] [Tech: 2] [Community: 4]
    This tells the player at a glance what patterns they can build

### 7. ZERO-COUNT GRAYING
  Colonist suggestion: "0 count cards should be grayed out"
  NeoTopia adaptation:
    In the element-type selection buttons (step 2 of placement):
    When a factory shows 0 of an element type, gray it out entirely instead of hiding it
    This tells the player "this factory doesn't have Energy right now" vs "Energy doesn't exist"

### 8. CONSTRUCTION DETAIL (BUILT & STOCK)
  Colonist suggestion: "Construction buttons should detail built & in stock"
  NeoTopia adaptation:
    Show per-region placement stats: "Sacred City: 8 placed · 11 empty"
    This helps players understand board density and where to push
    Display in the score section alongside the score numbers

### 9. EMBARGO/BLOCK INDICATORS ON PLAYER ICONS
  Colonist: "Embargo done & seen directly on player icons"
  NeoTopia: when it's the opponent's turn, show their current UI phase on their score display
    "[Opponent] · Selecting region..." in small text under opponent's name
    This creates social presence — you can see them deciding

### 10. FREE SPACE ABOVE PLAYERS FOR LOG AND DETAILS
  Colonist principle: "Free space above players for more player details, log"
  NeoTopia: the header is underused (only NEOTOPIA title + turn number + instruction)
  FIX: Move instruction to header center (already done), add player turn indicator on the RIGHT
       of the header (show whose turn it is with a colored dot and name)

## COLONIST RUSH → NEOTOPIA FLOW MODE (FUTURE FEATURE)

Colonist Rush = real-time Catan where all players act simultaneously
"No waiting. Full matches in under 10 minutes."
"There are no player turns; everyone can build at the same time, in parallel."

NeoTopia Flow Mode design:
  All players can draw cards simultaneously (no turn order for draw actions)
  Placement actions are still turn-ordered (to prevent hex conflicts)
  Time limit per player action: 15 seconds (instead of 90 second turn timer)
  The board shows all players' intentions in real-time with ghost elements
  First player to complete a valid pattern in a region scores it
  This creates URGENCY and EXCITEMENT that turn-based play doesn't have
  Target session time: 10-15 minutes instead of 30-45 minutes

## MATCHMAKING PATTERNS FROM COLONIST

1. Guest play immediately (no account) — NeoTopia already has this via anon auth
2. Private room codes (6 characters) — NeoTopia has this
3. Spectator mode (watch ongoing games) — future feature
4. Ranked ELO system with visible rating — future feature
5. Tournament mode (bracket play) — future feature
6. Shuffle matchmaking (auto-pair with strangers) — future feature

## COLONIST SOCIAL LAYER

Features that create community:
  In-game chat (public/private)
  Player emotes (6-8 quick reactions)
  Friend list and private games
  Discord integration
  Leaderboards (global/weekly/regional)
  Achievement system with unlock cosmetics

NeoTopia social layer (Phase 3+):
  Same fundamentals, but with civilization-vocabulary:
  Emotes = consciousness frequencies (Energy burst, Wisdom glow, Love pulse, etc.)
  Achievements = "District Guardian" (place 5 elements in one region)
               = "Ennead Awakened" (score a Council card)
               = "Source Connection" (reach Sacred City score 9)
  Titles = "Consciousness Architect" (win 10 games)
         = "Wanderer" (play first game)
         = "Naacal Scholar" (score all 6 BioFarming cards in one game)

## WHAT COLONIST DOES WRONG (NeoTopia does better)

1. Colonist board looks like a "toddler Hasbro farm set" (user complaint) → NeoTopia has
   sacred geometry, pixel art, esoteric vocabulary, amber-gold + teal aesthetic
2. Colonist has luck (dice) → NeoTopia is pure strategy (no dice, no randomness in moves)
3. Colonist theme is generic (farming, settlement) → NeoTopia theme is consciousness
   civilization (2055, sacred districts, esoteric card names)
4. Colonist has no soul narrative → NeoTopia connects to a real vision (2055 civilization)
5. Colonist has no spiritual layer → NeoTopia has numerology, sacred geometry, the
   Council of Nine, Lemuria/Atlantis card vocabulary
