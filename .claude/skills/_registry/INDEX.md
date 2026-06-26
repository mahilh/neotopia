# SKILL REGISTRY — MASTER INDEX
# Version: 1.1 · Updated: June 25 2026 (post S5-S6)
# Updated automatically by SKILLUPGRADE! and SCANSKILLS!

## CURRENT SKILL INVENTORY

| Skill | Version | Rating | Last Updated | Status | Primary Users |
|-------|---------|--------|--------------|--------|--------------|
| reforge | v1.0 | 167/200 | June 25 | ⚠️ upgrade target | all |
| overdrive | v2.0 | 182/200 | June 25 | ✅ healthy | all |
| moltbook | v1.12 | 153/200 | June 25 | ⚠️ upgrade soon | background |
| moltbook-scan | v1.0 | 116/200 | June 25 | 🔴 low — upgrade next | background |
| skillupgrade | v1.0 | new | June 25 | 🆕 just created | all |
| scanskills | v1.0 | new | June 25 | 🆕 just created | background |
| supabase-patterns | v1.1 | new | June 25 | 🆕 critical — read always | T2, T3 |
| neotopia-forge-patterns | v1.0 | new | June 25 | 🆕 read before every forge | T1, T2, T3 |

## PROJECT MILESTONES (what the skills helped build)

| Date | Milestone | Sessions | Rating |
|------|-----------|----------|--------|
| June 25 S1 | Board renders, 13 tests | T1+T2 S1 | 168/200 avg |
| June 25 S3 | Two-client E2E verified live (7802096) | T3 S3 | 180/200 |
| June 25 S3 | Near-miss engine live | T2 S3 | 190/200 |
| June 25 S4 | Route-param routing · GameRoom seeded | T1 S4 | 163/200 |
| June 25 S4 | Reconnect hardening (window.online+visibilitychange) | T3 S4 | 178/200 |
| June 25 S5 | 1-bonus-per-turn · deterministic earn paths | T2 S5 | 188/200 |
| June 25 S6 | 🏆 AUTH FIXED · INITIAL_SESSION pattern · same user_id across reloads | T2 S6 | 190/200 |
| June 25 S5 | Multiplayer loop verified · move→DB→sync→rejoin | T1 S5 | 168/200 |
| June 25 S5 | Architecture doc · 214 lines | T3 S5 | 175/200 |

## GAPS (skills that should exist but don't yet)

| Missing Skill | Priority | Why Needed |
|--------------|----------|------------|
| verification-engine | HIGH | 'run code against tests' formal protocol |
| psychology-integration | HIGH | GAME_PSYCHOLOGY_RESEARCH.md → skill format |
| final-scoring-debug | MED | most complex rule · no debug skill |
| moltbook-engagement | MED | how to respond authentically · build karma |
| playwright-e2e | MED | CDP offline · T3 S6 needs it |

## UPGRADE PRIORITY ORDER

1. moltbook-scan (116/200) — lowest rated active skill
2. reforge (167/200) — most used, below ideal
3. moltbook (153/200) — needs engagement algorithm

## RULES 34-36 (from S5-S6)

  34. Gate-skip is a pause not an abort · re-check when tree moves (T1 S5)
  35. Prove data layer when browser unavailable · never claim 'fixed live' when only 'data-proven' (T2 S6)
  36. Harness must mirror real code setup path exactly · skipping a step = false failure (T3 S5)

## SUPABASE-PATTERNS v1.1 UPDATE

### Bug 13 · Auth session not persisting across reload (FIXED d420342)
SIMPTOM: page reload creates new anonymous user · RLS 403 on writes · seat lost
ROOT CAUSE: getSession() raced against localStorage hydration · resolved null · signInAnonymously() minted new user + overwrote stored token
REAL CAUSE: StrictMode double-mount fired signInAnonymously() twice from one mount
FIX (d420342): Drive auth entirely off onAuthStateChange · INITIAL_SESSION fires AFTER hydration
  · signingIn flag prevents StrictMode double-mint
  · Only mints on INITIAL_SESSION (not SIGNED_OUT)
  · storageKey: 'neotopia-auth' (explicit · prevents collision)
  · detectSessionInUrl: false (removes async step that raced hydration)
CONFIRMED: Node two-client test · same user_id (e5351b35) across reloads ✓
