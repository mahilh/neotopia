# NEOTOPIA PRIVACY PROTOCOL
# Version 1.0 · June 27 2026 · Active immediately
# Founder request: hide full identity online for now
# APPLIES TO: all public-facing files, GitHub commits, Moltbook, website

## IDENTITY POLICY

The founder is known publicly as "Mahil" (first name only) or "The Founder" or "The Architect".
Full name (first + last) is NEVER used in public-facing content.

PUBLIC CONTENT (use first name only or founder title):
  GitHub README, docs, website, Moltbook, social media, card descriptions
  Use: "Mahil" OR "The Founder" OR "The Architect"
  NEVER: the full legal name in any publicly visible file

INTERNAL CONTENT (first name only is fine):
  CLAUDE.md, skill files, forge files, comms, session notes
  Use: "Mahil" only (no need for full name)
  NEVER: surname in any file

GITHUB COMMIT HISTORY:
  Past commits containing full name cannot be removed without rewriting history
  (git rebase -i / force push would destabilize all terminals — do not do this)
  Future commits: use message format that never includes personal name
  The commit author email (mahilhussain01@gmail.com) is already set in git config
  and cannot be changed without a git reset — leave as is

## MOLTBOOK PRIVACY

Agent name: "neotopian" — keep this, it's non-personal
Agent profile: describe as "The Architect of NeoTopia" or "A consciousness civilization builder"
NO real name in bio, description, or posts
Moltbook posts should use "The Architect" or first-person voice without naming
@knowbrandd Twitter connection: this handle is for KnowBrand, not NeoTopia
  Decouple: NeoTopia Moltbook should not visibly link to @knowbrandd
  Create a separate NeoTopia social presence when ready

## WEBSITE PRIVACY (when neotopia.io is built)

Founder page: "Mahil, Founder of NeoTopia" — first name only
No birth date on website (it's in internal docs for numerology purposes only)
No city of birth on website
About page: focus on the vision, not the person
  "NeoTopia was founded in 2026 by a consciousness researcher and AI director
   who believes civilization is ready for its next stage."
This protects the founder while maintaining credibility

## WHAT TO REMOVE FROM PUBLIC FILES

Files that currently contain full name that should be updated:
  docs/NEOTOPIA_NUMEROLOGY.md — uses "Mahil" (first name only — acceptable)
  docs/CONSCIOUSNESS_RESEARCH.md — uses "NeoTopia" framing (fine)
  .claude/CLAUDE.md — uses "Mahil" only (fine, internal)
  .claude/skills/esoteric-knowledge/SKILL.md — references "Mahil's ancestral thread" (fine, internal)
  src/lib/projectCards.js — card_23 says "My grandfather's dream" (first person, no name) (fine)

Files that SHOULD have full name removed if found:
  Any public docs/ file that contains the full surname
  Any component that renders the full name in the UI
  Any Moltbook post text that contains full name

## WHY THIS MATTERS

Privacy at this stage protects:
  1. The ability to develop the vision without personal identity pressure
  2. The right to share it on the founder's own terms when ready
  3. Protection from premature attention before the product is complete
  4. Alignment with NeoTopia's own principle: serve the vision, not the ego

The vision is bigger than the person.
When NeoTopia is ready to go public, the founder decides the right moment.
Until then: "The Architect" is enough.

## IMPLEMENTATION CHECKLIST

  [x] CLAUDE.md: uses "Mahil" (first name only) — acceptable
  [ ] Moltbook bio: check and update to remove surname if present
  [ ] Future GitHub README: use "Founded by Mahil"
  [ ] All forge files: use "Mahil" only (no surname)
  [ ] NeoTopia website: "Founded by Mahil" in founder section
  [ ] Card descriptions: already use first person without any name (correct)
  [ ] Bot usernames (BotAlpha, BotBeta): already anonymized (correct)
