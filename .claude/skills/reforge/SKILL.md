# REFORGE! — PROMPT TRANSCENDENCE PROTOCOL
# Version: 2.0 · Rating: 188/200 · Upgraded: June 26 2026
# Codeword: REFORGE! [prompt or task description]
# Improvement from v1.0:
#   Added: file-citation mandate in Phase 1 (v1.0 had no evidence requirement)
#   Added: cross-skill integration (OVERDRIVE!, supabase-patterns, neotopia-forge-patterns)
#   Added: version tracking + session stamping
#   Added: CLAUDE.md anti-regress check before Phase 4 (prevents rewriting broken patterns)
#   Added: dynamic stress tests (context-specific, not always the same 3 scenarios)
#   Fixed: Phase 7 evolution now stores findings with timestamp, not just describes them

## ACTIVATION

REFORGE! [prompt] → 7-phase transcendence of any forge, task description, or instruction.
REFORGE! (standalone) → applies to the most recent forge in context.

Output: a forge so precise it could run without the human present.
Minimum bar: no false premise survives into Phase 4.
Every claim in the new forge has a file path or test result behind it.

## THE 7 PHASES

### PHASE 1 — DESTRUCTION (what is wrong with this prompt?)

Read the forge literally. List every flaw:
  · False premises: claims about file structure, function signatures, phase names, variable types
    MANDATE: for each false premise, cite the ACTUAL file and line that contradicts it
    Example: 'calculateFinalScore returns breakdown object — FALSE: src/lib/patternMatcher.js:47 shows (scores[], unusedCount)→number'
  · Missing premise checks: what file should have been read before this claim was made?
  · Lane violations: is this forge touching files outside its terminal's lane?
  · Anti-regress violations: does this forge repeat a failure class from rules 1-39?
    MANDATE: grep CLAUDE.md anti-regress rules before completing Phase 1
  · Civilization Narrative Coherence failures (Dimension 35): does any string fail the placard test?
  · Missing: what does this forge not do that it should?

Output: numbered list. Brutal. Specific. Every claim evidence-backed.

### PHASE 2 — ROOT CAUSE (why did those flaws exist?)

For each flaw from Phase 1:
  · Was it written from memory of an API that changed?
  · Was it a lane assumption that wasn't verified?
  · Was it a copy of a pattern that was correct last session but stale now?
  · Was it a guess about game mechanics not verified against the rulebook?
  · Was it an HTTP status misread (rule 39: 400 = row reached DB, 403 = RLS wall)?

This phase is not about blame. It's about what file should have been read first.

### PHASE 3 — PREREQUISITE MAP (what must be true before any line is written?)

List every file that must be read before the first code change.
List every gate that must pass before the first task.
List every cross-terminal dependency that must be checked.

Format:
  MUST READ: [file path] — checking for: [specific thing]
  MUST VERIFY: [node command or grep] — expected: [specific output]
  MUST CHECK COMMS: [grep pattern] — for: [what another terminal shipped]

This becomes the BOOT SEQUENCE + HARD GATES section of the new forge.

### PHASE 4 — REBUILD (write the forge from scratch)

Rules:
  · Every task starts with PREMISE CHECK commands that read actual files
  · Every function signature is cited from the actual source file
  · Every phase name, store field, route path, and event type is verified
  · The forge can be pasted without modification — zero hand-editing required
  · CLAUDE.md anti-regress rules 1-39 are applied — especially rules active in the area being forged
  · Civilization Narrative Coherence (Dimension 35): all user-facing strings pass the placard test
  · Self-rating gate: 'FORGE SELF-RATE: ___/100 · state before Task A · <85=rewrite'

Cross-skill integration:
  · If the forge touches Supabase: prepend 'cat .claude/skills/supabase-patterns/SKILL.md | head -40'
  · If the forge involves a major architecture decision: trigger OVERDRIVE!
  · If the forge introduces a new pattern: note it for neotopia-forge-patterns/SKILL.md

### PHASE 5 — STRESS TESTS (forge-specific adversarial scenarios)

Generate 3 adversarial scenarios that are SPECIFIC to this forge's context.
Not generic scenarios — scenarios that would actually break this specific task.

Format for each:
  SCENARIO: [what happens]
  EXPECTED TERMINAL BEHAVIOR: [what the forge should cause the terminal to do]
  FAILURE MODE IF FORGE IS WRONG: [what breaks]

Examples of context-specific scenarios:
  'T2 shipped migration 004 but T1 hasn't pulled yet — getGlobalIndex() not in their tree'
  'phase is \'scoring\' in code but the forge says \'ended\' — FinalScore never mounts'
  'Room code is char(6) CHECK but forge generates 4-char codes — 23514 on insert'

### PHASE 6 — SEAL (rate the new forge · stamp the version)

Rate the rebuilt forge on 6 dimensions /20 each (total /120):
  1. Premise correctness: every claim file-cited or verified by a gate command
  2. Task completeness: all tasks have acceptance criteria, not just descriptions
  3. Runtime crash prevention: no false function signatures, wrong phase names, missing imports
  4. Anti-regress coverage: applies relevant rules from CLAUDE.md 1-39
  5. Self-improvement mechanism: forge produces an evolution lesson for neotopia-forge-patterns
  6. Relay integration: ends with bash .claude/relay.sh and T[N] AUTODRIVE! instruction

If any dimension scores below 14/20: back to Phase 4.
Target: 100/120 minimum before shipping.

Stamp the version: 'REFORGE! v2.0 · [date] · T[N] S[N] · score: [N]/120'

### PHASE 7 — EVOLUTION (what does REFORGE! itself learn?)

After every REFORGE! session:
  · What false premise type appeared that wasn't in Phase 1 detection?
    Add it to the list in Phase 1 with a specific NeoTopia example.
  · What stress test scenario was the most useful?
    Add it to Phase 5 as a standing scenario for future forges in this area.
  · Did the forge produce an evolution lesson for the terminal?
    Ensure it flows to neotopia-forge-patterns/SKILL.md via SKILLUPGRADE!

Store with timestamp:
  'REFORGE! v2.0 evolution · June 26 2026 · [finding]'

This file grows with every REFORGE! session. The detection gets sharper.
The stress tests get more precise. The skill improves the prompt that improves the forge.

## CROSS-SKILL INTEGRATION

  OVERDRIVE! → call for architecture decisions caught in Phase 1
  supabase-patterns → read before any forge touching DB or auth
  neotopia-forge-patterns → read before any forge · receive new patterns after
  SKILLUPGRADE! → trigger if REFORGE! itself scores below 180/200 in _registry
  SCANSKILLS! → runs automatically in AUTODRIVE! after REFORGE! ships

## WHEN TO TRIGGER REFORGE!

  Mandatory: when forge self-rate < 85/100 (rule 13)
  Mandatory: when premise check finds false assumption before first task
  Recommended: when previous session's session rating was below 260/300
  Recommended: when 3+ false premises appeared in the last session
  Optional: any time maximum quality is needed

## EVOLUTION LOG

  v1.0: 7 phases defined · no evidence mandate · static stress tests · no version tracking
  v2.0: file-citation mandate · anti-regress gate · CLAUDE.md integration · dynamic stress tests
        cross-skill links · version stamping · Civilization Narrative Coherence check

## ANTI-REGRESS

  Never ship a rebuilt forge without running Phase 5 stress tests.
  Never allow a false premise to survive from Phase 1 into Phase 4 — that's the core failure mode.
  Never mark Phase 6 complete below 100/120.
  Never skip Phase 7 — REFORGE! only improves if it learns from every use.
