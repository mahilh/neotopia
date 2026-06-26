# NEOTOPIA VISUAL STRATEGY — DEEPDIVE! MASTERPLAN
# Written: June 26 2026 · Post-playtest · AUTODRIVE!
# DEEPDIVE! reference for T1 · integrated into neotopia-forge-patterns

## THE VISION (what we're building toward)

The board should feel like SimCity meets Civilization VII.
Every element placed shows what it actually IS.
A Healing Temple shows a healing temple.
A Fusion Ring glows like a reactor.
When you score a pattern, the district BUILDS on the board in front of you.
The board is a live diorama of the civilization being constructed.

## WHAT 'SEED DANCE' IS (Mahil's reference clarified)

  'Seed Dance' = most likely Seedream by ByteDance
  Seedream 4.5/5: 4K native · fast · excellent text rendering
  Best for: product photography · commercial visuals · multilingual content
  NOT best for: highly stylized consciousness civilization art
  Decision: NOT the primary tool for NeoTopia art

## WHAT 'GPT 5.5 HIGHEST OPTION' IS (Mahil's reference clarified)

  'GPT 5.5' = ChatGPT's image generation via GPT Image 2 (OpenAI)
  Note: DALL-E 3 deprecated May 12 2026 · replaced by GPT Image 2
  Best for: prompt-accurate illustrations · rapid iteration · free tier available
  Excellent at: complex multi-element prompts · exact specifications
  Use for: RAPID PROTOTYPING of card concepts (first drafts)
  NOT the leader for: artistic/cinematic quality (Midjourney wins there)

## RECOMMENDATION BY USE CASE

  Card art (56 building illustrations): MIDJOURNEY V8 · primary tool
  Rapid concept testing: GPT Image 2 · fast + free tier
  Photorealism reference: Flux 2 Pro · if needed
  Terrain textures: Custom CSS/SVG · no AI needed · always better performance
  Board building icons: Custom SVG · animated · no AI · perfect consistency

## WHY MIDJOURNEY V8 FOR CARD ART

  - 'Omni Reference' feature: locks visual style across ALL 56 card generations
  - Aesthetic leadership: solarpunk + sacred geometry + 2055 = Midjourney's native strength
  - Civilization VII used 'readable realism' — Midjourney v8 exactly matches this
  - $10/month pays back immediately for a game project
  - Art Director: describe what it FEELS like, not just what it IS
    Correct prompt: 'healing sanctuary 2055, sacred geometry integrated with nature, warm golden light, bioluminescent, solarpunk consciousness civilization, game card art'
    Wrong prompt: 'building with plants and lights'

## THE MASTER STYLE PROMPT (generate this first · use as Omni Reference)

  Style anchor prompt for ALL 56 card illustrations:
  'Consciousness civilization 2055 · solarpunk architecture · sacred geometry · isometric view ·
   warm golden hour light · crystal resonance technology integrated with living systems ·
   hydrogen fuel infrastructure · regenerative ecosystem · ancient wisdom meets quantum science ·
   photovoltaic surfaces · living walls · water channels · detailed illustration ·
   game card art style · cinematic depth of field · warm teal-gold palette · no text'

  Generate ONE master image first. Save its Omni Reference code.
  Use that code for all 56 subsequent card generations.
  Result: Every card looks like it belongs to the same civilization.

## 56-CARD ART GENERATION WORKFLOW

  Step 1: Generate master style image (Midjourney v8) · save Omni Reference code
  Step 2: For each card, generate:
    '[Card name], [card type], [primary element color], consciousness civilization 2055, solarpunk --oref [master code]'
  Step 3: Export at 512×512 PNG
  Step 4: Place in /public/art/cards/[card-id].png
  Step 5: Card React component uses art as background with overlay text

  Estimated time: 2-3 hours for all 56 cards
  Estimated cost: $10/month Midjourney Basic (worth it)

## BOARD VISUAL ARCHITECTURE (4 phases)

### PHASE 1 (T1 S8-S9): Element icons on hexes
  When element placed on hex: animated SVG icon appears
  Icon type matches element:
    energy: solar panel / lightning bolt / arc reactor
    biofarming: tree / seed / leaf cluster
    technology: crystal spire / circuit node / quantum ring
    community: people circle / temple arch / gathering ring
  Animation: scale 0 → 1 with spring easing over 0.4s
  Style: single-color SVG · matches element color · 60% of hex size

### PHASE 2 (T1 S9-S10): Terrain biomes per region
  Each region gets distinct visual biome:
    Sacred City (purple): ancient desert with crystal formations · warm amber-purple palette
    Living Earth (green): lush bioregion with water channels · deep green-teal palette
    Free Energy (red): volcanic coastal landscape with wind + solar arrays · red-orange palette
  Implementation: SVG radial gradient fills on region hex backgrounds
  NO external images needed · pure SVG · instant load · mobile friendly

### PHASE 3 (T1 S10-S11): Score moment = building materializes
  When pattern scored: the completed hexes show the BUILDING illustration from the card
  Animation: crossfade from element icons → building illustration over 1.5s with glow
  The building appears on the board where the pattern exists
  This is the SimCity moment · civilization is being built in real time
  Implementation: show card art (Phase 1 Midjourney images) on the scored hexes
  Size: 256×256 centered on the pattern area · rounded corners · slight glow

### PHASE 4 (Post-launch): Full world evolution
  As score climbs: the region's terrain level increases
  Threshold 7: first buildings appear · sparse
  Threshold 13: district grows · denser · more color
  Threshold 18: full civilization · vibrant · landmark appears
  Reference: Civ VII hex building density scaling
  This is the final vision: the board IS the civilization you're building

## CIV VII LESSONS APPLIED TO NEOTOPIA

  Civ VII approach: 'Readable realism' (between V style + photorealism)
  NeoTopia equivalent: 'Solarpunk readable realism' (warm + illustrative + detailed)

  Civ VII: Buildings fill hex from center outward as city grows
  NeoTopia equivalent: Elements appear one-by-one as placed · patterns show buildings

  Civ VII: Navigable rivers break hex grid → required new building placement logic
  NeoTopia equivalent: Factory token bridges → visual connection between regions via paths

  Civ VII: Procedural environment art (GDC 2025 session)
  NeoTopia equivalent: CSS-procedural terrain biomes (gradient-based · deterministic · instant)

  Civ VII: Unique quarters = hero buildings with special hex layouts
  NeoTopia: 5-point cards are hero buildings · should have special animation when scored

## IMMEDIATE ACTION PLAN (for T1)

  T1 S8: Add SVG element icons per hex (Phase 1) · 4 icon types · animated placement
  T1 S9: Add terrain biomes per region (Phase 2) · CSS gradient fills
  T1 S10: Score moment building illustration (Phase 3) · wire with card art
  (Card art Midjourney generation: Mahil can do this in parallel · 2-3 hours · $10/month)

## TECHNICAL CONSTRAINTS (never violate)

  NO EXTERNAL IMAGE FETCHES during gameplay · too slow
  All board visuals: inline SVG or CSS · zero network dependency during game
  Card art: lazy-loaded ONCE when card panel opens · cached · ≤100KB per image
  Animation budget: 60fps minimum · GPU-composited only (transform + opacity)
  Mobile support: all visuals scale correctly on 390px width
