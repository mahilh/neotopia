# NEOTOPIA REFORGE · SKILL
# Version: 3.0 · Rating: 190/200 · Upgraded: June 26 2026 (post S11)
# Prior: v2.0 · patterns for forge regeneration
# Added: /200 rating system · evidence gate protocol · session improvement scale

## WHAT THIS SKILL DOES

Activated by REFORGE! codeword or when a forge self-rates <85/100.
Transforms a weak forge into a 195+/200 forge through 7 phases.
Contains the complete quality criteria for forge excellence.

## THE 7 PHASES OF REFORGING

### PHASE 1 · Identify the false premises
  List every claim in the forge that requires reading a file to verify.
  These are NOT evidence. They are assumptions.
  EXAMPLES:
    'calculateFinalScore returns an object' — is it actually an object?
    'data-testid=my-turn-badge is conditionally mounted' — always mounted or conditional?
    'the biome object has an emptyFill field' — what fields does it actually have?
  ACTION: For each assumption: write the grep/cat command that proves or disproves it.

### PHASE 2 · Convert assumptions to evidence gates
  For every assumption identified in Phase 1:
  Write: GATE [N] · [the specific claim]:
           [exact command]
           Expected: [specific value, not 'present']
           If missing: [exact fallback action]
  RULE: If the gate output would change the prescription → it is a REQUIRED gate.
        If the gate output cannot change the prescription → it is optional.
  RESULT: All false premises become evidence gates that execute before any code.

### PHASE 3 · Elevate the acceptance criteria
  Every task must have:
    □ Specific verification step (not 'verify it works' — 'DevTools → Element → confirm attr value')
    □ Test command with expected output ('npx vitest run 2>&1 | tail -4 → 102 passed')
    □ Live-verify step for browser changes ('Open localhost · two incognito · do X → see Y')
    □ Commit command (pathspec, per task)
    □ Task rating criterion (/50, with named evidence required for full score)

### PHASE 4 · Add the cross-terminal coordination section
  Every forge must specify:
    □ Which files from other lanes are READ (not edited) by this session
    □ Which seams are shared with T1/T2/T3 and what the composed behavior must be
    □ What this terminal tells the others in comms (specific, actionable, no vagueness)
    □ What testids/attributes/exports this session provides that the bot needs
  EXAMPLE: 'T1→T2: data-my-turn attr now on game root · bot selector: [data-my-turn="true"]'

### PHASE 5 · Add the commit protocol
  Per task, not per session. Every task must specify:
    npx vitest run 2>&1 | tail -4 (or relevant test)
    npm run build 2>&1 | tail -2
    git status --short → pathspec (lane files only)
    git add [exact files — no wildcards]
    git commit -m '[type]([scope]): [description] · NeoTopia T[N] S[N]'
    git pull --rebase && git push

### PHASE 6 · Rate the reforged forge /200
  Apply the 4-dimension scoring system:
    Evidence precision (0-60): gates for every function name, selector, field name
    Task completeness (0-60): verification steps, crash prevention, anti-regress
    Coordination quality (0-40): comms, relay trigger, evolution lesson
    Civilization narrative (0-40): placard test strings, district mapping
  Gap from 200: honest assessment of what live greps would fill in.
  If <190: identify which dimension is lowest and target it.

### PHASE 7 · Self-improvement lesson
  State the one thing this reforge reveals about the previous forge's weakness.
  Format: 'The forge failed at [specific pattern] because [root cause].
           Future forges must [specific change] before [specific action].'
  This lesson becomes a candidate for Pattern 21+ in neotopia-forge-patterns skill.

## FORGE QUALITY RUBRIC (/200)

  190-200: Evidence gates close all false premises · tasks verified live ·
           comms specify exact selectors for other terminals · every string passes
           placard test · zero churn expected · session 280+/300 likely

  175-189: Most false premises gated · some assumptions remain · good but risks
           one unexpected skip (like T1 S10's Task C correctly gating off)

  160-174: Several assumptions not gated · 1-2 tasks will hit false premise during
           execution · session 260-270/300 likely

  <160: Significant false premises · multiple tasks will require mid-execution
        replanning · session <260/300 · consider full reforge

## WHAT MAKES THE BEST FORGES (T1 S9 · T2 S10 · T3 S9 examples)

  T1 S9 (283/300): Forge read actual bot selector consumers before prescribing testids.
    Result: bot selectors were already exactly what was needed — zero script changes.
  T2 S10 (278/300): Conceded the turnTimeRemaining debate gracefully after 3 requests.
    Result: the feature shipped correctly with immer-safe countdown recipe.
  T3 S9 (271/300): Proved purge RPC scope + auth boundary live before wiring teardown.
    Result: the teardown ran correctly in production, purging 20 residual profiles.

## SESSION IMPROVEMENT SCALE

  How to get from 265→282/300:
    Add 2 more evidence gates per task (the proven way — T1 S9→S10)
    Verify cross-terminal seams composed correctly (T3 lesson)
    State the evolution lesson in the forge header (pre-commit it mentally)

  How to get from 282→295/300:
    Read the actual bot-simulate.js before prescribing any selector change
    Pre-state what totalPlaced should be after the session (commit to the metric)
    Catch the seededState fixture drift BEFORE it fails CI (T2 S10 lesson)

  How to get 295→300/300 (theoretical maximum):
    Every gate output pre-populated with actual line numbers
    Evolution lesson proven by bot-simulation output (not inferred)
    Card art verified at 120px card size before committing

## SELF-IMPROVEMENT TRIGGER

  REFORGE! → activate this skill
  After every session where forge rated <85/100 → add one new pattern to neotopia-forge-patterns
  After every 'evolution lesson' → check if it matches an existing pattern or needs a new one
