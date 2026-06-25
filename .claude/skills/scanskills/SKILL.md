# SCANSKILLS! — BACKGROUND SKILL INSPECTOR
# Version: 1.0 · Created: June 25 2026
# Codeword: SCANSKILLS!
# Purpose: Audit all skills while terminals are coding. Read-only. No changes.
#          The best command to run while T1/T2/T3 are busy — maximum intelligence, zero interruption.

## ACTIVATION

SCANSKILLS! runs automatically inside AUTODRIVE! after each terminal relay.
SCANSKILLS! can also be typed standalone at any time.
Output: a skills dashboard — what exists, what's stale, what's missing, what to upgrade next.

## SCAN SEQUENCE

### STEP 1 — INVENTORY (what skills exist)
  find .claude/skills -name SKILL.md | sort
  For each: read the version header. If no version header: rate as v0 (never upgraded).
  Output: file path · version · size in lines

### STEP 2 — USAGE ANALYSIS (which terminal uses which skill most)

  T1 (Visual Layer) most-used skills:
    · frontend-design (HexCell, GameBoard, animations, 44px targets)
    · reforge (prompt quality for forge writes)
    · neotopia-forge-patterns (game-specific UI patterns)
    · overdrive (UX decisions, psychology research integration)

  T2 (Engine) most-used skills:
    · supabase-patterns (RLS, schema, session persistence)
    · reforge (prompt quality)
    · verification-quality (run code against tests before trusting)
    · overdrive (architecture decisions)

  T3 (Multiplayer) most-used skills:
    · supabase-patterns (Realtime, Presence, Broadcast limits)
    · reforge (prompt quality)
    · overdrive (security decisions)
    · neotopia-forge-patterns (move sync patterns)

### STEP 3 — GAP ANALYSIS (skills that should exist but don't)

  CRITICAL GAPS (blocking real work right now):
    supabase-patterns: 12 bugs came from Supabase misuse · no skill exists
    neotopia-forge-patterns: T1/T2/T3 rediscover same patterns every session
    verification-engine: "run code against tests before trusting" needs a skill
    cross-terminal-protocol: T1/T2/T3 lane rules repeated every forge, not centralized

  HIGH-VALUE GAPS:
    psychology-integration: docs/GAME_PSYCHOLOGY_RESEARCH.md findings → skill format
    final-scoring-debug: most complex rule in the game · no skill for it
    moltbook-engagement: how to respond to comments, build karma, engage authentically

### STEP 4 — STALENESS CHECK
  For each skill: when was it last updated vs. when was the relevant code last changed?
  If the code changed but the skill didn't: flag as STALE.
  Stale skills give terminals outdated advice.

### STEP 5 — UPGRADE PRIORITY MATRIX
  Score each skill on: (rating gap from 200) × (usage frequency) × (staleness factor)
  Sort descending. Top 3 = next SKILLUPGRADE! targets.

### STEP 6 — OUTPUT DASHBOARD
  ┌─────────────────────────────────────────────────────────────┐
  │ NEOTOPIA SKILLS DASHBOARD · [date]                          │
  ├──────────────────────┬───────┬──────────┬──────────────────┤
  │ Skill                │ v     │ Rating   │ Status           │
  ├──────────────────────┼───────┼──────────┼──────────────────┤
  │ reforge              │ v2.0  │ 188/200  │ ✅ healthy       │
  │ overdrive            │ v2.0  │ 182/200  │ ✅ healthy       │
  │ moltbook             │ v1.12 │ 153/200  │ ⚠️ upgrade soon  │
  │ moltbook-scan        │ v2.0  │ 165/200  │ ✅ healthy       │
  │ skillupgrade         │ v1.0  │ new      │ 🆕 just created  │
  │ scanskills           │ v1.0  │ new      │ 🆕 just created  │
  │ supabase-patterns    │ v1.0  │ new      │ 🆕 just created  │
  │ neotopia-forge-patts │ v1.0  │ new      │ 🆕 just created  │
  ├──────────────────────┴───────┴──────────┴──────────────────┤
  │ GAPS: verification-engine · psychology-integration          │
  │ NEXT UPGRADE: moltbook (153) · moltbook-scan if <v2.0      │
  └─────────────────────────────────────────────────────────────┘

## INTEGRATION WITH AUTODRIVE!

After every T[N] AUTODRIVE! relay:
  SCANSKILLS! runs automatically and appends the dashboard to the AUTODRIVE! output.
  This means every session automatically surfaces what skills need upgrading.
  No manual trigger required.

## ANTI-REGRESS
  Never rate a skill from memory — always read the file first.
  Never claim a skill is healthy without reading its version header.
  Never skip the gap analysis — missing skills cause more bugs than weak skills.
