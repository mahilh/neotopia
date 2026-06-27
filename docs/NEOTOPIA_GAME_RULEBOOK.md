# NEOTOPIA.IO — COMPLETE GAME RULEBOOK
# Version 1.0 · June 27 2026 · The definitive reference for all game rules
# For players, testers, and the terminals building the game

## WHAT IS NEOTOPIA?

NeoTopia is a 2-player browser strategy game where players build a consciousness
civilization across three sacred districts. It is pure strategy — no dice, no luck,
no randomness. Every decision matters. The best thinker wins.

Set in 2055. The game is Stage 2 of a 5-stage civilization vision.
Every card scored is a rehearsal of a real district being built by 2055.

## THE OBJECTIVE

Build the highest-scoring civilization across three districts by placing elements
on the hexagonal board, drawing building cards, and scoring them when your
element patterns match the card's requirements.

FINAL SCORE = best_region + second_region + (worst_region × 3) + (unused_bonuses × 3) + cluster_bonus

The worst region is multiplied by 3 as a GIFT, not a penalty.
The civilization reveals its deepest truth through its weakest district.
Balanced builders score higher than specialists.

## THE GAME BOARD

Hexagonal grid divided into 3 regions:

  SACRED CITY (innermost) — amber/gold aesthetic
    The spiritual center. Council halls. Temples. Source connection.
    Atlantean Acropolis equivalent. The highest vibration district.
    Optimal strategy: score cards combining multiple element types.

  LIVING EARTH (middle ring) — green/emerald aesthetic
    The agricultural heart. Food forests. Healing chambers. Crystal gardens.
    Lemurian Mu equivalent. The feminine principle in material form.
    Optimal strategy: build wide, many connections, mycelial network.

  FREE ENERGY (outer ring) — red/crimson aesthetic
    The innovation district. Free energy labs. Technology research. Fohat conduits.
    Atlantean outer ring equivalent. The mind of the civilization.
    Optimal strategy: efficient early placements, maximize cluster adjacency.

3 FACTORIES sit at the junctions between regions (the Atlantean bridges).
Factories are the source of all element tokens.
Each factory can produce any of the 4 element types.

## THE 4 ELEMENTS

  SUSTAINABLE ENERGY (red · orichalcum · Fohat)
    Atlantean technological intelligence.
    The fire that powers the civilization without burning the Earth.
    Numerological resonance: 1 (unity, the divine source)

  BIOFARMING (green · Lemurian · crystal earth)
    Lemurian heart-consciousness made material.
    Food forests, healing gardens, mycelial networks.
    Numerological resonance: 2 (duality, the feminine principle)

  TECHNOLOGY (purple · Akashic · 5th density)
    Mental plane intelligence in service of consciousness.
    Holographic computing, Metatron's Cube architecture.
    Numerological resonance: 3 (trinity, creation, the mental plane)

  COMMUNITY (blue · Ennead · council consciousness)
    The glue that makes the civilization LIVE.
    Ceremony, teaching, gathering, the Council of Nine.
    Numerological resonance: 4 (earth, stability, material foundation)

## TURN STRUCTURE

Each turn consists of:

  ACTION PHASE (3 actions per turn · numerology: trinity)
    Draw a card from the Offer OR place an element on the board.
    The player chooses how to spend each action.
    Actions cannot be split: you draw OR place, never partial.

  THE 4-STEP PLACEMENT FLOW (all steps required in order):
    1. Click a factory (choose which of the 3 to activate)
    2. Select an element type from that factory's production
    3. Select which region to place in
    4. Click a valid hex in that region
    All 4 steps are required. No shortcuts.

  SCORING PHASE (automatic)
    After any element placement, the game checks if any card in your hand
    can be scored (elements on board match the card's region + pattern requirement).
    If yes: the score is added and the card is moved to scored pile.
    tryScoreCard() runs automatically — the player does not trigger scoring.

  END TURN
    Player clicks End Turn (visible only when actionsLeft = 0).
    The turn timer resets for the next player.
    Opponent's turn begins.

## THE OFFER

A shared pool of face-up building cards available to both players.
Both players can draw from the same Offer.
The first player to have the right elements on the board scores the card.
This creates competition without conflict: no one destroys another's elements.

## PRODUCTION TILES

12 production tiles determine what elements are available each turn.
Tiles are revealed one at a time as turns progress.
The game ends when the LAST production tile is revealed.
Planning around tile reveals is a core strategic element.
Sacred numerology: 12 tiles = 12 cosmic cycles = one great year.

## BONUS TOKENS

Earned at regional score thresholds: 7, 13, 18 points per region.

  7 points: Soul Crystal (carnelian) — Government Subsidy
    Numerology: 7 = spiritual perfection. The district is awakening.

  13 points: Heart Crystal (rose quartz) — Private Initiative
    Numerology: 13 = sacred feminine. The district transforms.

  18 points: Amethyst Crown — New Building Permits
    Numerology: 18 = 1+8 = 9 = life doubled. The district is complete.

Unused bonus tokens score 3 points each in the final calculation.
Bonus tokens × 3: the universe's gift for restraint.

## SCORING MECHANICS

  PATTERN MATCHING
    Each building card requires a specific pattern of elements in a specific region.
    The elements must be physically adjacent on the hexagonal grid.
    Patterns can be rotated (6 possible orientations per pattern).
    The game automatically checks all rotations.

  CLUSTER BONUS
    At game end, the largest connected group of same-element-type hexes
    in any region scores a bonus.
    Adjacency = resonance: the crystal grid theory in mechanical form.
    Place elements strategically to maximize your cluster.

  THE FINAL SCORE FORMULA (decoded)
    best_region: your highest-scoring district
    second_region: your middle district (raw score)
    worst_region × 3: your lowest district × 3 (the civilization gift)
    unused_bonuses × 3: tokens not spent × 3
    cluster_bonus: largest connected same-element group

    WHY WORST × 3? The civilization reveals its truth through its weakest expression.
    A player who maxes one region but ignores another is building an imbalanced civilization.
    The score system rewards the builder who tends ALL three districts.
    This is the Jung encoded in mechanics: worst × 3 = integration is the highest reward.

## GAME MODES

  CLASSIC MODE (default)
    90-second turn timer.
    12 production tiles (game ends on tile 12).
    Turn-based: one player at a time.
    Target session time: 30-45 minutes.

  NEOTOPIA FLOW MODE (coming in S15)
    15-second turn timer.
    9 production tiles (game ends on tile 9).
    Simultaneous card draws between placements.
    Target session time: 10-15 minutes.
    Numerology: 9 tiles = the game achieves completion in pure flow.
    1+5 = 6 = harmony and the creative principle (15-second turns).

## THE 56 CARDS (numerology: 5+6 = 11, Master Illumination)

  12 × 2-point cards (the foundation patterns)
  18 × 3-point cards (the growth patterns)
  18 × 4-point cards (the mastery patterns)
  8 × 5-point cards (the source patterns)

  MASTER NUMBER CARDS (special significance):
  card_11 Open Source Consciousness (11 = illumination)
  card_22 Sound Frequency Gateway (22 = master builder)
  card_33 Holographic Research Center (33 = master teacher, grandfather)
  card_44 Healing Arts Center (44 = double earth, double stability)
  card_55 Living City Core (55 = 5+5 = 10 = cycle complete)
  card_56 2055 Horizon (the final card, the destination)

## HIDDEN NUMEROLOGICAL CODES

The game contains sacred milestones that are never announced:

  Total score reaches 7: "Sacred Seven · Spiritual Perfection"
  Total score reaches 9: "Nine · Completion · The Ennead Speaks"
  Total score reaches 13: "Thirteen · Sacred Feminine · Transformation"
  Total score reaches 18: "Eighteen · Life Doubled · The District Breathes"
  Total score reaches 27: "Twenty-Seven · Three Nines · Mastery"
  Total score reaches 36: "Thirty-Six · The Four Elements Complete"

These appear as brief overlays when crossed. They are discovered, not documented.
Discovery is the deepest form of education.

  36 elements total placed = 3+6 = 9 = COMPLETION
  The bot first achieved this in bot v4.3. Room HF9QYE. June 27 2026.
  This is not coincidence. Nine is indestructible.

## THE GLOBAL NEOTOPIA INDEX

Every game's final score is written permanently to the Global NeoTopia Index.
This is the collective Akashic Record of all consciousness civilizations ever built.

  After enough games: the Index unlocks Stage 3 (neotopia.io website)
  After more games: the Index unlocks Stage 4 (consciousness app)
  The players of NeoTopia.io ARE the civilization-builders.
  Each game is a vote for the real civilization.

  Stage 3 unlocks when: Global Index >= 10,000 points OR 50 human players
  Stage 4 unlocks when: Global Index >= 100,000 points OR 500 human players
  Stage 5: the physical community — 2055

## BRANDING AND VISUAL LANGUAGE

  COLOR PALETTE:
  Deep navy #0A0A2E — the void before creation, infinite potential
  Amber-gold #C89440 — ancient wisdom, the sacred fire of civilization
  Teal #40E0D0 — crystal consciousness, healing frequency
  Energy red #E24B4A — Fohat, orichalcum, the fire element
  BioFarming green #1D9E75 — Lemurian earth, living systems
  Technology purple #7F77DD — Akashic mind, 5th density
  Community blue #378ADD — Ennead council, water consciousness

  TYPOGRAPHY TONE:
  Esoteric but not inaccessible. Sacred but not preachy.
  "Ennead Council Chamber" not "Community Hall"
  "Naacal Seed Archive" not "Seed Storage"
  "Fohat Activation Node" not "Energy Generator"
  Every card name should pass the Placard Test:
  Would this appear on a building placard in NeoTopia 2055?

  AESTHETIC REFERENCE:
  The Holographic Universe (Talbot) made visible.
  Ancient Egypt meeting 2055 consciousness technology.
  Lemuria's crystal gardens in digital form.
  Plato's Atlantis rebuilt with love, not ego.

## VERSION HISTORY

  June 25 2026: First commit. Game concept established.
  June 26 2026: Full multiplayer loop proven. Supabase realtime working.
  June 27 2026: 36 elements placed in production. 29 DB-verified.
                Bot-health CI live. FinalScore upgraded. Lobby themed.
                60 anti-regress rules. Global Index migration live.
                Art pipeline active (0/56 art files — next priority).

  NEXT: S15 — dim-the-rest UX · left action log · element burst animation ·
              Global Index FinalScore wiring · numerology milestone events ·
              NeoTopia Flow mode config · mobile portrait E2E
