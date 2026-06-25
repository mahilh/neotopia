# SKILLUPGRADE! — MASTER SKILL IMPROVEMENT PROTOCOL
# Version: 1.0 · Created: June 25 2026
# Codeword: SKILLUPGRADE!
# Purpose: Read ALL skills. Rate them brutally. Destroy the weakest. Rebuild categorically better.
#          Integrated into both Claude (this session) and Claude Code terminals.
#          Every call leaves the skill system stronger than it found it.

## ACTIVATION

When SKILLUPGRADE! is typed (standalone or with a specific skill name):
  Standalone: audit ALL skills → upgrade bottom 3 → push → update registry
  SKILLUPGRADE! [skill-name]: audit just that skill → destroy → rebuild → push
  SKILLUPGRADE! SCAN: run SCANSKILLS! without upgrading (read-only audit)

After every SKILLUPGRADE! session:
  · At least 1 skill is categorically better (not just polished)
  · The skill registry is updated with new ratings and version numbers
  · CLAUDE.md receives any new anti-regress rules discovered
  · The rating rubric itself may expand (new dimensions added)

## THE 6-PHASE PROTOCOL

### PHASE 1 — SCAN (inventory + brutal ratings)
  List every skill file in .claude/skills/ (find .claude/skills -name SKILL.md)
  For each skill, rate it across 5 dimensions /200:
    Methodology completeness (0-40): are all steps defined with specific acceptance criteria?
    Evidence requirements (0-40): does every claim require a file citation or empirical proof?
    Self-improvement mechanism (0-40): does the skill improve itself when used?
    Real-world integration (0-40): is it wired to relay.sh, CLAUDE.md, comms, other skills?
    Anti-regress coverage (0-40): does it prevent the failure classes this project has actually hit?
  Total /200. Anything below 150 is flagged for immediate upgrade.
  Output: sorted table, lowest first.

### PHASE 2 — TARGET (select worst 3)
  Pick the 3 lowest-rated skills. If fewer than 3 exist: pick all below 150.
  For each: state exactly WHY it scored low. Evidence only. No vague "could be better."
  This becomes the destruction brief for Phase 3.

### PHASE 3 — DESTROY (no mercy)
  For each targeted skill:
    List every structural flaw: missing evidence mandates, vague acceptance criteria,
    no self-improvement loop, no relay integration, no version tracking.
    List every false premise baked into the skill.
    State the exact failure mode each flaw causes in practice.
    Format: numbered list. Brutal. Specific. Past tense where this already caused a real bug.

### PHASE 4 — REBUILD (from scratch, no copy-paste)
  Rewrite each destroyed skill completely from the foundation.
  Every rebuilt skill MUST have:
    · Version header: # Version: X.0 · Rating: NNN/200 · Upgraded: [date]
    · ACTIVATION section: exact trigger phrases that invoke the skill
    · EVIDENCE MANDATE: every step that makes a claim requires a file citation or test result
    · SELF-IMPROVEMENT HOOK: one thing the skill learns from each use and stores
    · RELAY INTEGRATION: where bash .claude/relay.sh appears in the workflow
    · ANTI-REGRESS: the specific failure classes this skill was built to prevent
    · CROSS-SKILL LINKS: which other skills this one calls or is called by

### PHASE 5 — VERIFY (stress test the rebuild)
  For each rebuilt skill, generate 2 adversarial scenarios:
    A: What happens if this skill is used by a terminal that hasn't read CLAUDE.md?
    B: What happens if this skill calls another skill that doesn't exist yet?
  Expected outcome: the rebuilt skill handles both gracefully.
  If not: back to Phase 4.

### PHASE 6 — PUSH + REGISTRY UPDATE
  Commit all rebuilt skills to GitHub with explicit pathspec.
  Update .claude/skills/_registry/INDEX.md with:
    · New version numbers
    · New ratings
    · Date of last upgrade
    · What was fixed
  Update CLAUDE.md with any new codewords or anti-regress rules.
  Write session summary to .claude/comms/tomorrow.md.

## SKILLUPGRADE! SELF-IMPROVEMENT

After every SKILLUPGRADE! session:
  The rubric dimensions in Phase 1 may be expanded based on what was discovered.
  If a new failure class was found that no current dimension covers: add it.
  The next SKILLUPGRADE! runs with a larger rubric.
  The skill improves the system that improves the skill. No ceiling.

## INTEGRATION WITH OTHER CODEWORDS

  REFORGE! [prompt] → improves a specific prompt (SKILLUPGRADE! for prompts)
  OVERDRIVE! [decision] → uses the 7-agent council (must read overdrive/SKILL.md)
  SCANSKILLS! → Phase 1 only (read-only audit, no changes)
  SKILLUPGRADE! → full 6-phase protocol (read + destroy + rebuild + push)
  AUTODRIVE! → runs SCANSKILLS! automatically during session processing

## ANTI-REGRESS

  Never upgrade a skill without running Phase 3 first. Polish ≠ upgrade.
  Never rate a skill from memory — read the actual file before rating.
  Never claim a skill is upgraded without pushing to GitHub.
  Never skip the registry update — stale ratings mislead future upgrades.
  Never apply SKILLUPGRADE! to a skill that was upgraded in the last 24h without new evidence.
