# REFORGE! — PROMPT TRANSCENDENCE SKILL
# Version: 1.0 · Created: June 25 2026
# Codeword: REFORGE!
# Purpose: Destroy a prompt and rebuild it categorically better.
#          Not incremental improvement. Transcendence.
#
# Usage: Type REFORGE! followed by any prompt, forge, output, or codeword.
# The result is always categorically better and expands the quality rubric.

## ACTIVATION

When Mahil types REFORGE! [any prompt/output/forge]:
  The response is the 7-phase protocol below. No skipping phases.
  Self-rate the NEW prompt across 6 dimensions BEFORE claiming done.
  State ONE new rubric dimension discovered that wasn't in the original.
  This dimension becomes permanently added to the rating system.

## THE 7 PHASES

### PHASE 1 — DESTRUCTION (no mercy)
  Read the prompt/output critically.
  List every flaw. No "given the constraints." No "reasonably good for its purpose."
  Every false premise. Every missing acceptance criterion. Every runtime crash waiting to happen.
  Every place where "verify it works" was used instead of a numeric delta check.
  Every gap in anti-regress coverage. Every missing adversarial scenario.
  Format: numbered list. Specific. Brutal. Evidence-cited.

### PHASE 2 — EVIDENCE (what actually breaks)
  For each flaw from Phase 1:
    State EXACTLY what happens at runtime if left unfixed.
    Not "could cause issues." Not "may lead to."
    "This throws a TypeError at line N when X because Y."
    "This causes an infinite re-render loop when the component mounts because Z."
    "This silently drops the mutation because Zustand's set() creates a new draft."
  No vague language. If you can't state the exact failure, you don't understand the flaw.

### PHASE 3 — FOUNDATION (new premises)
  For each flaw, state the correct assumption the rebuilt prompt makes instead.
  These become the KARPATHY READS section of the rebuilt prompt.
  Example: "WRONG: factory seeding from tile[0]. RIGHT: rulebook setup gives each factory 1 of each element type."
  Format: WRONG: [old assumption] → RIGHT: [correct assumption]

### PHASE 4 — CONSTRUCTION (rebuild from scratch)
  Write the new version completely. No copy-paste from the original.
  Every task has:
    · Specific numeric acceptance check (not "verify it looks right")
    · PREMISE CHECK commands (cat / grep / node -e BEFORE prescribing anything)
    · Anti-regress rules specific to THIS task (not generic)
    · Relay format pre-defined so terminal knows exactly what to report back
    · Self-rate line at bottom of every task
  The overall forge must include:
    · FORGE SELF-RATE /100 before any code
    · TASK RATE /50 after each task (redo if <35)
    · bash .claude/relay.sh as the final line
    · Write to .claude/comms/tomorrow.md as mandatory last step

### PHASE 5 — STRESS TEST (3 adversarial scenarios)
  Generate 3 scenarios that should break the new prompt:
    Scenario A: What happens if a terminal runs this without the prerequisite files?
    Scenario B: What happens if the test suite is green but the browser crashes?
    Scenario C: What happens if T2 pushes to main between T1's fetch and T1's push?
  For each: state the expected outcome. If the outcome is "prompt fails" → back to Phase 4.

### PHASE 6 — SEAL (6-dimension self-rating)
  Before claiming done, rate the NEW prompt across these 6 dimensions:
    1. Premise correctness (0-20): every claim sourced from file reads, not memory
    2. Task completeness (0-20): every deliverable specified with acceptance criteria
    3. Runtime crash prevention (0-20): adversarial review caught pre-runtime bugs
    4. Anti-regress coverage (0-20): rules are specific to THIS task, not generic
    5. Self-improvement mechanism (0-20): terminal learns one thing and writes it to comms
    6. Relay integration (0-20): bash .claude/relay.sh is the final automated step
  Total: /120
  A REFORGE! output below 100/120 must go back to Phase 4.

### PHASE 7 — EVOLUTION (expand the rubric)
  State exactly one new quality dimension discovered in this REFORGE! session.
  This dimension was not in the original rubric. It is now.
  Format: "NEW DIMENSION [N]: [name] — [definition]"
  This gets added to CLAUDE.md as a permanent anti-regress rule in the next session.

## WHAT REFORGE! IS NOT

REFORGE! is NOT:
  · Asking for a "better version" (that's just FORGE! again)
  · Asking for a "higher score" (scores without methodology are meaningless)
  · Incremental polish (adding bullet points, fixing typos)
  · Rewriting in a different tone

REFORGE! IS:
  · Systematic destruction of wrong assumptions
  · Evidence-based proof of why each flaw causes real runtime failures
  · Categorical improvement — the new prompt prevents failure classes the old one couldn't
  · Rubric expansion — the quality system is larger after REFORGE! than before

## ON NUMBERS AND RATINGS

"280/200" means the output found quality dimensions beyond what the 200-point scale measures.
"350/200" does NOT automatically produce a better prompt than "280/200".
The NUMBER is a signal, not the cause.

What pushes beyond the scale:
  · The prompt discovers and blocks a failure class that had no name before
  · The terminal learns something from the session that prevents a new category of error
  · The rubric itself grows — next session measures things this session couldn't name

The correct question is never "how do I get 350/200?"
The correct question is "what failure class does this prompt not prevent that it should?"
Answer that and the score takes care of itself.

## COMPOUND IMPROVEMENT LOOP

Every REFORGE! session:
  1. Adds at least 1 new anti-regress rule to CLAUDE.md
  2. Adds at least 1 new dimension to this skill file
  3. Adds a "what REFORGE! discovered" entry to .claude/comms/tomorrow.md
  4. The next forge prompt is better because this session ran

This is the compounding mechanism. The skill improves itself by using itself.

## SKILL SELF-IMPROVEMENT

If REFORGE! is applied to a prompt that was itself created by REFORGE!:
  The Phase 7 dimension from the first REFORGE! is now a Phase 1 criterion for the second.
  The rubric compounds with each application.
  There is no ceiling.

## ANTI-REGRESS FOR THIS SKILL

Never use REFORGE! to inflate scores without methodology change.
Never claim REFORGE! output is better without running Phase 5 stress tests.
Never skip Phase 7 — if no new dimension was discovered, the REFORGE! was too shallow.
Never treat the number as the goal — the goal is the failure class prevented.
