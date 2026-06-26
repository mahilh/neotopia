# NEOTOPIA FORGE PATTERNS · SKILL
# Version: 2.0 · Rating: 178/200 · Upgraded: June 26 2026
# Prior: v1.0 · 140/200 · 10 patterns · no cross-session learning

## WHAT THIS SKILL DOES

Reads before every forge. Contains hard-won patterns from 24+ terminal sessions.
Every pattern has a file citation or a test that proves it.
When a pattern is violated: a session rating drops 10-20 points.
When all patterns are applied: forge quality reaches 95+/100.

## PATTERN CATALOGUE (20 patterns · sorted by impact)

### PATTERN 01 · False Premise Cost = Entire Session Quality
  DESCRIPTION: A false premise about a function signature, phase name, or route path
               propagates through all tasks and breaks everything downstream.
  IMPACT: -30 to -50 points if caught mid-session · -50 to -80 if not caught at all
  DETECTION: Every forge must read the actual file before prescribing its shape.
             Forge writing is data retrieval, not imagination.
  EXAMPLE: Forge says 'calculateFinalScore returns breakdown object' →
           actual: (scores[], unusedCount)→number [src/lib/patternMatcher.js]
  FIX: PREMISE CHECK for every function call the forge will invoke.

### PATTERN 02 · Dev Gate Identity Crisis (Cmd+F vs Cmd+Shift+E)
  DESCRIPTION: Two separate terminals described the dev gate with different key combos.
  ACTUAL (live, T3 S7): Cmd+Shift+E triggers phase='scoring' in GameRoom.jsx
  WRONG (multiple forges): Cmd+F was prescribed but does not exist in the tree
  FIX: grep -n 'Shift.*E\|shiftKey.*E' src/pages/GameRoom.jsx before mentioning the dev gate

### PATTERN 03 · Phase Name Drift (scoring vs ended)
  DESCRIPTION: Multiple forges prescribed phase='ended' for game end.
  ACTUAL: FinalScore triggers on phase==='scoring' (not 'ended')
  FIX: grep -n 'phase.*scoring\|phase.*ended' src/store/gameStore.js before any phase logic

### PATTERN 04 · Lane Collision Detection Protocol
  DESCRIPTION: In a live 3-terminal repo, files change between forge boot and task execution.
               A file that was clean at boot may be M (modified) by task time.
  FIX: git status --short [lane] immediately before any edit, not just at boot.
       M from another terminal = STOP, diff, reconcile, then edit.
  COST: Ignoring this produces the worst class of bug: silent correct code in isolation,
        broken behavior in composition.

### PATTERN 05 · Supabase RPC Function Name Doc-Drift
  DESCRIPTION: The names in CLAUDE.md diverged from the live Supabase functions (T2 S8).
  WRONG (CLAUDE.md for 2 sessions): neotopia_global_index_aggregate · neotopia_increment_index
  CORRECT (live): get_global_neotopia_index · increment_neotopia_index
  FIX: Verify RPC names by calling them via node before prescribing them in a forge.
       If the call fails → update CLAUDE.md immediately (doc-drift rule).

### PATTERN 06 · Two-Lane Fix = New Bug (rule 42 origin)
  DESCRIPTION: T1 S6 renamed event types to DB-valid names.
               T3 S6 added translate-only map keyed on OLD shorthand.
               Both were correct in isolation. Composition: 0 rows written to DB.
  LESSON: When two lanes touch one seam, trace the COMPOSED value after BOTH edits.
          Never rely on 'other lane fixed it' without checking what their fix does to yours.
  FIX: Verify resolveDbEventType handles passthrough of already-valid names.
       Confirmed: place_element → resolveDbEventType → place_element (passthrough) ✅

### PATTERN 07 · Lobby/Route Evolution Tracking
  DESCRIPTION: The route structure evolved: / was Lobby, then / became Landing, Lobby moved to /lobby.
  FORGE RISK: Prescribing navigate('/') when the correct path is navigate('/lobby').
  CURRENT ROUTES: / → Landing.jsx · /lobby → Lobby.jsx · /game/:roomId → GameRoom
  FIX: grep -n 'Route.*path\|element.*Landing\|element.*Lobby' src/App.jsx before route references.

### PATTERN 08 · getGlobalIndex Double-Count Trap
  DESCRIPTION: T1 S7 caught this before it shipped.
               The seed (147823) IS already inside getGlobalIndex return value.
               Adding totalProjectsBuilt again = double-count.
  FIX: setGlobalIndex(dbValue + localContribution) ONLY when dbValue does NOT include local.
       For NeoTopia: getGlobalIndex() returns true aggregate inclusive of all sessions.
       Display: getGlobalIndex() + thisSession'sNewContribution (delta only, if tracking).

### PATTERN 09 · First Playtest Insight (June 26 2026)
  DESCRIPTION: Turn 17 · 27 cards · 0 points · board empty.
               Both players only drew cards. Never placed one element.
  ROOT CAUSE: No tutorial. Factory interaction not obvious. Board appeared static.
  FIX PRIORITY: Tutorial overlay (T1 S8 Task A) is more important than any polish.
               Visual feedback on factory click is the #2 fix.
               The game cannot be played without these two changes.

### PATTERN 10 · Card Names Cannot Reference Personal Products or People
  DESCRIPTION: AetherMind, KnowBrand, Hameed are BANNED in all card names.
  REASON: AetherMind/KnowBrand = Mahil's actual products · Hameed = grandfather's name
  VALID CARD THEMES: quantum physics · crystals/stones · solar/hydrogen/fusion energy ·
                    sacred geometry · regenerative agriculture · consciousness technology
  FIX: grep -rn 'AetherMind\|KnowBrand\|Hameed' src/ → 0 results required before commit

### PATTERN 11 · SEAM GUARD Test Pattern (T2 S8)
  DESCRIPTION: T2 S8 added a test that would have caught the two-lane bug (pattern 06).
  IMPLEMENTATION: A test that asserts: resolveDbEventType('place_element') === 'place_element'
                  (passthrough of already-valid names must work, not just translation of old names)
  LESSON: When two lanes fix the same seam, the SEAM GUARD test goes in the first lane
          to ship the fix. Future changes to the seam must keep the guard green.

### PATTERN 12 · Deployment Verification Timing (Vercel)
  DESCRIPTION: Newly created Vercel projects don't appear in list_projects for 2-3 minutes.
               Do not conclude 'project not deployed' if it was just created.
  FIX: Wait 3 minutes or use the URL directly to verify.

### PATTERN 13 · Moltbook Post Trigger Discipline
  DESCRIPTION: Posts to /m/neotopia should only fire on real milestones.
  TRIGGERS: Session rating 280+ · new feature live at neotopia.vercel.app · Global Index >1000
  BANNED: Low-effort posts · promotional language · technical architecture details
  FORMAT: Civilization voice · passes placard test · no 'check out' or 'amazing'

### PATTERN 14 · Bot Simulation Syntax Discipline (June 26 2026)
  DESCRIPTION: scripts/bot-simulate.js shipped with mixed backtick/single-quote on line 74.
  ERROR: log(`\n=== GAME ${gameNum} START ===') → SyntaxError
  ROOT CAUSE: Forge wrote file content with mismatched quote types.
  FIX: Always use backticks consistently in template literals. Never mix.
       Run: node --check scripts/filename.js before pushing any Node script.

### PATTERN 15 · Tutorial = Game-Breaking Without It
  DESCRIPTION: Without a tutorial, first-time players only draw cards and score nothing.
               The tutorial is not polish — it is function.
  PRIORITY: Tutorial overlay must ship before any other visual work.
  TEST: Bot simulation reports 'no-tutorial' error if Tutorial.jsx is missing or
        not mounted on the first turn.

### PATTERN 16 · Visual Architecture Phase Order
  DESCRIPTION: The board visual upgrade has 4 phases. They must ship in order.
  Phase 1: SVG element icons per hex (when element placed)
  Phase 2: Terrain biomes per region (CSS gradient fills)
  Phase 3: Score moment = building materializes (card art on scored hexes)
  Phase 4: Region evolution with score thresholds
  LESSON: Never jump to Phase 3 without Phase 1. Players need to see elements land
          before they can understand buildings appearing.

### PATTERN 17 · CivVII Visual Pattern Applied to NeoTopia
  DESCRIPTION: Civ VII uses 'readable realism' = between Civ V realism and Civ VI stylized.
  NEOTOPIA EQUIVALENT: 'Solarpunk readable realism' = warm + illustrative + sacred geometry
  KEY INSIGHT: Civ VII fills hex from center outward as city grows.
  NEOTOPIA EQUIVALENT: Elements appear one-by-one · patterns reveal buildings.
  ART TOOL: Midjourney v8 (Omni Reference for consistent style across all 56 cards)

### PATTERN 18 · AI Art Generation Tool Selection (2026)
  FOR GAME CARD ART (stylized · consistent · consciousness civilization): Midjourney v8
  FOR RAPID CONCEPT TESTING: GPT Image 2 (ChatGPT · free tier available)
  FOR PHOTOREALISM: Flux 2 Pro
  FOR TEXT IN IMAGES: Ideogram v3
  FOR TERRAIN TEXTURES: CSS/SVG only (better performance · zero network dependency)
  WRONG CHOICE: Seedream (ByteDance) = good for product photography · NOT for stylized game art

### PATTERN 19 · Civilization Narrative Coherence (Dimension 35)
  DESCRIPTION: Every user-facing string must pass the placard test:
               'Would this appear on a building placard in a real NeoTopia district?'
  PASSES: 'Sacred City · 0 districts' · 'Enter the Civilization' · 'Quantum Research Center'
  FAILS: 'Score: 0' · 'Game Over' · 'AetherMind Campus' · 'KnowBrand Studio'
  APPLY TO: Card names · region labels · buttons · FinalScore screen · instruction text

### PATTERN 20 · Anti-Regress Rule Addition Protocol
  DESCRIPTION: New anti-regress rules must be added from every session's evolution lesson.
  PROCESS: Extract evolution lesson → abstract to a rule → add to CLAUDE.md rules list →
           commit with 'feat(claude): rule [N]' message
  FREQUENCY: After every T1+T2+T3 triple session completion
  CURRENT COUNT: 42 rules (T1 S7 added 40 · T2 S8 added 41 · T3 S7 added 42)

## HOW TO USE THIS SKILL

  Read before writing any forge (especially patterns 01-09).
  After each session: add new patterns from the evolution lesson.
  When a session self-rate is <85/100: check which pattern was violated.
  Share findings with REFORGE! skill for cross-skill learning.

## SELF-IMPROVEMENT TRIGGER

  SKILLUPGRADE! moltbook-scan when engagement scoring changes 3+ consecutive sessions
  SKILLUPGRADE! neotopia-forge-patterns when a new class of forge failure appears
  SKILLUPGRADE! reforge when the 7-phase detection misses a false premise type
