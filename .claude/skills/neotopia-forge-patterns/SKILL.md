# NEOTOPIA FORGE PATTERNS · SKILL
# Version: 3.0 · Rating: 196/200 · Upgraded: June 26 2026 (post S11)
# Prior: v2.0 · 178/200 · 20 patterns
# Added: Patterns 21-30 from S8-S11 lessons · evidence gate protocol · /200 rating system

## WHAT THIS SKILL DOES

Reads before every forge. Contains hard-won patterns from 34+ terminal sessions.
Every pattern has a file citation or a test that proves it.
When a pattern is violated: a session rating drops 10-20 points.
When ALL patterns applied: forge quality reaches 95+/100 · session 290+/300.

## FORGE RATING SYSTEM (Mahil-mandated · June 26 2026)

All forges are now rated /200 before execution (NOT /100).
Forge self-rate /100 was the old system. New system:
  /200 = evidence precision: every function name read from actual file, every selector
         proven by grep with results, SVG paths validated, lane collision checked,
         seededState fixture pre-empted, cross-lane deps mapped.
  Above 200 → rate /300 (adds: execution quality + integration + civilization narrative)
  <85 on internal /100 self-rate = HARD STOP and rewrite
  Gap from 200 is always: exact line numbers require live terminal reads.
  The evidence gates CLOSE the gap by running those reads before prescribing.

## EVIDENCE GATE PROTOCOL (the single most impactful pattern)

Before writing any task prescription, run these verifications:
  Gate N: grep/cat command → expected output → prescription based on actual output
  If gate output contradicts the forge prescription: update the prescription, not the gate
  Never skip a gate to save time — a violated gate costs 30min of debugging
  Re-run gates if the tree moved mid-session (rule 38)

Gate template:
  GATE [N] · [what you're verifying]:
    grep -n '[pattern]' [file] | head -[N]
    Expected: [description]
    If missing: [fallback action]

## SKILLS USAGE AUDIT (what each terminal uses vs should use)

  T1 (Visual): neotopia-forge-patterns ✅ · frontend-design ✅ · reforge ✅
               SHOULD ALSO USE: engineering:accessibility-review (touch targets)
               SHOULD ALSO USE: design:ux-copy (button text placard test)
               MISSING: game-ux audit integration after each session

  T2 (Engine): neotopia-forge-patterns ✅ · supabase-patterns ✅
               SHOULD ALSO USE: engineering:debug (when bot fails — isolate local vs prod)
               SHOULD ALSO USE: engineering:deploy-checklist (before each push)
               MISSING: Local-vs-prod isolation as explicit step in every bot run

  T3 (Realtime): neotopia-forge-patterns ✅ · supabase-patterns ✅ · reforge ✅
                 SHOULD ALSO USE: engineering:incident-response (when prod bot fails)
                 SHOULD ALSO USE: engineering:testing-strategy (E2E suite design)
                 MISSING: totalPlaced as the stated success metric in every session

## SELF-IMPROVEMENT SCALE (each terminal)

  T1: 282/300 (S11) · peak 283/300 (S9) · trend: stable · gap: gate-skip on Task C
      HOW TO IMPROVE: Read CardFrame field names before prescribing (false premise cost -5 in S10)
      NEXT LEVEL: 290+/300 → requires perfect gate discipline + Civilization string check

  T2: 282/300 (S11) · peak 282/300 · trend: rising · gap: deploy-lag/code confusion
      HOW TO IMPROVE: Always run bot against localhost FIRST (Rule 51)
      NEXT LEVEL: 290+/300 → requires bot totalPlaced > 0 confirmed live

  T3: 268/300 (S11) · peak 271/300 (S9) · trend: volatile · gap: lane violation risk
      HOW TO IMPROVE: Evidence gate on migration ownership (T2 lane, not T3)
      NEXT LEVEL: 280+/300 → requires bot totalPlaced > 0 + game-ux gates pass

## PATTERN CATALOGUE (30 patterns · sorted by impact)

### PATTERN 01 · False Premise Cost = Entire Session Quality
  DESCRIPTION: A false premise about a function signature, phase name, or route path
               propagates through all tasks and breaks everything downstream.
  IMPACT: -30 to -50 points if caught mid-session · -80 if not caught at all
  FIX: PREMISE CHECK for every function call the forge will invoke.
       Read the actual file before prescribing its shape. No exceptions.
  EXAMPLE: Forge says 'calculateFinalScore returns breakdown object' →
           actual: (scores[], unusedCount)→number [src/lib/patternMatcher.js]

### PATTERN 02 · Dev Gate Identity Crisis (Cmd+Shift+E, not Cmd+F)
  ACTUAL (live, T3 S7): Cmd+Shift+E triggers phase='scoring' in GameRoom.jsx
  FIX: grep -n 'Shift.*E\|shiftKey.*E' src/pages/GameRoom.jsx before mentioning the dev gate

### PATTERN 03 · Phase Name Drift (scoring vs ended vs finished)
  ACTUAL: FinalScore triggers on phase==='scoring' (store) · game_sessions stores 'finished'
  MAPPING: sessionPhaseColumn('scoring')→'finished' in useGameSync.js · never bypass this
  FIX: grep -n 'phase.*scoring\|phase.*ended\|sessionPhaseColumn' src/ before any phase logic

### PATTERN 04 · Lane Collision Detection Protocol
  FIX: git status --short [lane] immediately before ANY edit, not just at boot.
       M from another terminal = STOP, diff, reconcile, then edit.
  COST: Lane collision = worst class of bug: correct in isolation, broken in composition.

### PATTERN 05 · Supabase RPC Function Name Doc-Drift
  WRONG (had): neotopia_global_index_aggregate · neotopia_increment_index
  CORRECT (live): get_global_neotopia_index · increment_neotopia_index
  FIX: Verify RPC names by calling them via node before prescribing in a forge.

### PATTERN 06 · Two-Lane Fix = New Bug (rule 42 origin)
  LESSON: When two lanes touch one seam, trace the COMPOSED value after BOTH edits.
  FIX: resolveDbEventType handles passthrough — verified: place_element → place_element ✅

### PATTERN 07 · Lobby/Route Evolution Tracking
  CURRENT ROUTES: / → Landing.jsx · /lobby → Lobby.jsx · /game/:roomId → GameRoom
  FIX: grep -n 'Route.*path\|element.*Landing\|element.*Lobby' src/App.jsx before route references.

### PATTERN 08 · getGlobalIndex Double-Count Trap
  FIX: getGlobalIndex() returns true aggregate. Display delta only if tracking per-session.

### PATTERN 09 · First Playtest Insight (June 26 2026)
  ROOT CAUSE: No tutorial + factory interaction not obvious → players only drew cards
  FIX PRIORITY ORDER: 1. Tutorial 2. Factory pulse 3. Board visual feedback 4. Art

### PATTERN 10 · Card Names Banned
  BANNED: AetherMind · AetherNet · AetherFlux · AetherProject · KnowBrand · Hameed · Mahil
  FIX: grep -rn 'AetherMind\|KnowBrand\|Hameed' src/ → 0 results required before commit

### PATTERN 11 · SEAM GUARD Test Pattern (T2 S8)
  When two lanes fix the same seam: the SEAM GUARD test goes in the first lane.
  Confirmed: resolveDbEventType passthrough works for all existing event types.

### PATTERN 12 · Vercel Deployment Propagation Delay
  Newly created projects don't appear in list_projects for 2-3 minutes.
  T1 S10 CONFIRMED DEPLOYED: Tutorial gate fix was live on prod (tutorial dismissed in bot run).

### PATTERN 13 · Moltbook Post Trigger Discipline
  TRIGGERS: Session 280+ · new feature live · Global Index >1000
  FORMAT: Civilization voice · placard test · no 'check out' or 'amazing'

### PATTERN 14 · Bot Script Syntax Discipline
  FIX: node --check scripts/filename.js before pushing any Node script.
       Never mix backtick and single-quote in template literals.

### PATTERN 15 · Tutorial = Game-Breaking Without It
  PRIORITY: Tutorial overlay must ship before any visual polish. It is function, not UX.
  GATE FIX (T1 S10): Tutorial gate MUST use {showTutorial && phase==='playing'}
  NEVER: {showTutorial && isMyTurn} — the joiner never sees isMyTurn in time

### PATTERN 16 · Visual Architecture Phase Order
  Phase 1: SVG element icons per hex · Phase 2: Terrain biomes · Phase 3: Card art
  Phase 4: Region evolution with score thresholds
  Status: Phase 1 ✅ (S9) · Phase 2 ✅ (S11) · Phase 3 in progress (Mahil generating)

### PATTERN 17 · NeoTopia Card Art Direction (FINAL after 3 iterations)
  REJECTED: photorealistic 3D · painterly MTG style
  FINAL: 16-bit isometric pixel art · SNES RPG · esoteric solarpunk
  CRITICAL: 'ONE BUILDING ONLY' in every prompt — ChatGPT generates entire cities without it
  SYMBOL: Flower of Life (NOT hexagram/Star of David — causes alarming cultural associations)
  BACKGROUND: Dark deep navy blue · building fills 65-70% of frame
  PALETTE: Warm amber-gold stone + teal crystal glow

### PATTERN 18 · AI Art Tool Selection (2026)
  CARD ART: ChatGPT GPT Image 2 (16-bit pixel art prompts working as of S10-S11)
  RAPID CONCEPTS: Same (ChatGPT free tier)
  WRONG: Seedream for stylized game art

### PATTERN 19 · Civilization Narrative Coherence (Placard Test)
  PASSES: 'Sacred City · 0 districts' · 'Enter the Civilization' · 'Plasma Fusion Ring'
  FAILS: 'Score: 0' · 'Game Over' · 'AetherMind Campus'
  APPLY TO: Card names · buttons · FinalScore screen · instruction text · bot log messages

### PATTERN 20 · Anti-Regress Rule Addition Protocol
  PROCESS: Evolution lesson → abstract to rule → add to CLAUDE.md → commit
  CURRENT COUNT: 52 rules (updated June 26 2026 post-S11)

### PATTERN 21 · data-testid On Permanently-Mounted Element = Useless State Check (Rule 50 · T1 S11)
  DESCRIPTION: data-testid='my-turn-badge' was ALWAYS in the DOM — span renders regardless of turn.
               isVisible() was always true → bot could never distinguish whose turn it was.
               This caused stuck-state:90 despite the game running correctly.
  FIX: For state detection, use a FLIPPING ATTRIBUTE on the container element:
       data-my-turn='true'/'false' on the GameRoom root div.
       Bot uses: waitForSelector('[data-my-turn="true"]', {timeout:3000}) — race-free.
  PRINCIPLE: State detection needs a VALUE that FLIPS, not an ELEMENT that EXISTS.
  GATE: grep -n 'data-my-turn\|data-game-phase' src/pages/GameRoom.jsx
        Expected: both present on the outermost game container div.

### PATTERN 22 · Local vs Prod Isolation Protocol (Rules 51/52 · T2 S11 + T3 S11)
  DESCRIPTION: When a bot or E2E fails against production, there are 3 possible causes:
               A) Code is wrong in the deployed build
               B) Deployment is stale (prod hasn't caught up with main)
               C) The test/bot script itself has a bug
  WRONG APPROACH: Edit the selectors assuming A without testing C
  CORRECT APPROACH: Run the SAME bot/E2E against localhost (latest code) immediately
  RESULT:
    Both local AND prod fail → it's the script (C) → edit the script
    Only prod fails → it's deploy lag (B) → wait or trigger redeploy
    Only local fails → something broke in latest commit (A) → check the diff
  EVIDENCE: T2 S11 nearly edited correct selectors that prod just hadn't deployed yet.
            T3 S11 isolated v4 room-code-not-visible to the script (identical on local+prod).
  GATE: Always run: node scripts/bot-simulate.js (no BOT_URL = localhost)
        AND: BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
        BEFORE editing any selectors.

### PATTERN 23 · 5-Strategy Room Code Extraction Pattern (Bot v4.1)
  DESCRIPTION: Room code extraction fails if any single selector doesn't match.
               T1 S8 changed the lobby UI → the old single-selector approach broke.
  STRATEGY ORDER (most to least reliable):
    1. Known CSS class: [class*='room-code'] · [class*='roomCode']
    2. data-testid='room-code' (add this to T1's next session list)
    3. Style-based: [style*='letter-spacing'][style*='monospace'] (MATCHED AZRHUE IN PROD)
    4. <code> HTML tag
    5. Full text scan: TreeWalker looking for /^[A-Z0-9]{6}$/ pattern
    6. URL extraction: page.url().match(/[A-Z0-9]{6}/)
  LESSON: A single-strategy extractor is a single point of failure.
          Implement all 6 strategies with fallthrough. Takes 20 lines.
  PERMANENT FIX: T1 must add data-testid='room-code' → strategy 2 hits first, never fails.

### PATTERN 24 · Tutorial Gate Coupling = Bot Cascade (T1 S10)
  DESCRIPTION: Tutorial gate was {showTutorial && isMyTurn}.
               The joining player's isMyTurn was false during initial render.
               Tutorial never mounted for P2 → P2's overlay blocked all clicks.
               Bot reported: no-tutorial → stuck-state for every turn.
  FIX: {showTutorial && phase === 'playing'} — both players see it on game start
  NEVER REVERT: This gate fix is guarded by the anti-regress system.
  GATE: grep -n 'showTutorial.*isMyTurn\|showTutorial.*phase' src/pages/GameRoom.jsx
        Expected: phase==='playing' version, NOT isMyTurn version.

### PATTERN 25 · Bot Turn Alternation Assumption = Root Cause of stuck-state:90 (Bot v4)
  DESCRIPTION: Bot used: activePage = turn % 2 === 0 ? p1 : p2
               This assumes p1 goes first, p2 second. But seat assignment is DB-driven.
               If BotAlpha gets seat 1 and BotBeta gets seat 0, every turn check is wrong.
               The bot was checking the wrong page for 12 seconds per turn, every turn.
  ROOT CAUSE PROOF: Bot ran 3min7sec (15 turns × 12s each = 180s = 3 min). Exact match.
  FIX (bot v4): detectActiveTurn(p1, p2) polls BOTH pages sequentially:
    for (const sel of TURN_SELECTORS) {
      if (await p1.locator(sel).first().isVisible({timeout:1800})) return {page:p1}
      if (await p2.locator(sel).first().isVisible({timeout:1800})) return {page:p2}
    }
  PRINCIPLE: Never assume seat-to-player mapping. Let the UI tell you whose turn it is.

### PATTERN 26 · Forge Rating /200 System (Mandated by Mahil · June 26 2026)
  OLD: Rate forge /100 before execution (<85=rewrite)
  NEW: Rate forge /200 · dimensions:
    Evidence precision (0-60): every function name from actual file,
      every selector proven by grep, SVG paths validated, lane collision checked
    Task completeness (0-60): acceptance criteria stated, verification steps included,
      runtime crash prevention, anti-regress coverage
    Coordination quality (0-40): comms mandate, cross-terminal deps mapped,
      relay trigger, evolution lesson pre-stated
    Civilization narrative (0-40): every string passes placard test,
      element-to-district mapping maintained, 2055 framing consistent
  ABOVE 200 → rate /300 (adds execution quality + integration quality dimensions)
  GAP FROM 200: Always because exact line numbers require live terminal reads.
    The EVIDENCE GATES close this gap by running those reads before acting.

### PATTERN 27 · Evidence Gate Protocol (the single highest-ROI pattern)
  DESCRIPTION: Running 8 evidence gates before a forge takes 5 minutes.
               Violating any of them takes 30-60 minutes to unwind.
               Net time savings: 25-55 minutes per session.
  GATE TEMPLATE:
    GATE [N] · [specific claim to verify]:
      [exact command with exact flags]
      Expected: [specific output description]
      If NOT found: [precise fallback action, not 'investigate']
  GATE DISCIPLINE:
    Never write 'Expected: present' — write the actual expected value.
    Never skip a gate because 'it was fine last session' — state is live.
    When gate output contradicts forge prescription: change the prescription.
  PROOF: T1 S11 evidence gates corrected 3 false premises before any code was written:
    biome.emptyFill → biome.colors.hex (field name)
    var(--color-primary-rgb) → does not exist (CSS var)
    my-turn-badge testid 'always present' (conditional mounting assumption)

### PATTERN 28 · Both-Page Tutorial Dismiss (T2 S11 discovery)
  DESCRIPTION: Prior bot versions only dismissed P1's (host's) tutorial.
               Tutorial.jsx gates on phase==='playing' → BOTH players see it.
               P2's tutorial overlay was blocking ALL clicks on P2's turns.
               Bot reported: elements never placed despite successful turn detection.
  FIX: Dismiss tutorial for BOTH players, in parallel:
    const [t1ok, t2ok] = await Promise.all([
      dismissTutorial(p1, 'host'),
      dismissTutorial(p2, 'joiner'),
    ])
  PRINCIPLE: When a modal gates on a shared condition (not user-specific),
             every session participant must dismiss it explicitly.

### PATTERN 29 · Terrain Biome Field Names (T2 S10 · T1 S11)
  DESCRIPTION: T2's terrainBiomes.js exposes getBiomeForRegion(regionId).
               The forge assumed the field was 'emptyFill'.
               The actual field is 'colors.hex'.
  CORRECT USAGE: const biome = getBiomeForRegion(hex.regionId); fill = biome.colors.hex
  WRONG: biome.emptyFill · biome.fill · biome.color
  LESSON: Read the actual module shape from T2's file before consuming it in T1.
  GATE: cat src/lib/terrainBiomes.js | head -40
        Look for the exact field name the biome object exposes.

### PATTERN 30 · NIGHTSAVE! Protocol (Google Drive Context Doc)
  DESCRIPTION: The Google Drive master context doc (ID: 1gs4EgKyG0oFZKE5X0nsc3OFzUVDajPN5lBMchNCP7_I)
               is the external, shareable single source of truth for NeoTopia context.
               It must be updated after every major session cluster.
  CURRENT STATE: June 25 2026 (day 1) — severely outdated.
  MISSING: 52 anti-regress rules · tutorial fix · bot simulation · CardFrame ·
           pixel art direction · terrain biomes · Element icons · 102 tests · 7 migrations
  TRIGGER: NIGHTSAVE! codeword → AI writes full update in CLAUDE.md style
           → Mahil pastes into Google Drive document
  FREQUENCY: At least once every 5 sessions or after major milestones.

## HOW TO USE THIS SKILL

  Read before writing any forge (especially patterns 01, 21-27).
  After each session: add new patterns from the evolution lesson.
  When session self-rate is <85/100: which pattern was violated?
  Share findings with REFORGE! skill for cross-skill learning.

## SKILL SELF-IMPROVEMENT SCALE

  v1.0: 140/200 · 10 patterns · no cross-session learning · no forge rating system
  v2.0: 178/200 · 20 patterns · S1-S7 lessons encoded · forge /100 system
  v3.0: 196/200 · 30 patterns · S8-S11 lessons · /200 system · evidence gate protocol
        local-vs-prod isolation · data-my-turn pattern · tutorial cascade documented
        skills usage audit per terminal · self-improvement scale per terminal
  TARGET v4.0: 200/200 · will require: exact line numbers embedded for all greps
               (needs live terminal execution) · totalPlaced>0 confirmed as pattern

## SELF-IMPROVEMENT TRIGGER

  SKILLUPGRADE! neotopia-forge-patterns → run after every triple-session (T1+T2+T3)
  SKILLUPGRADE! reforge → when 7-phase detection misses a false premise type
  SKILLUPGRADE! supabase-patterns → when a migration ownership violation occurs
