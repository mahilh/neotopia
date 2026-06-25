# NEOTOPIA FORGE PATTERNS — SESSION QUALITY HANDBOOK
# Version: 1.0 · Rating: new · Created: June 25 2026
# Purpose: Hard-won patterns from T1/T2/T3 sessions. Read before writing any forge.
#          Prevents the same mistakes being rediscovered every session.

## ACTIVATION

Read this skill when:
  · Writing a forge prompt for T1, T2, or T3
  · A terminal self-rates its forge below 85/100
  · A terminal asks 'how should I approach this?'
  · REFORGE! is about to run

## FORGE QUALITY PATTERNS

### Pattern 1 · Premise before prescription (rule 7 + 25 + 28)
ANTI-PATTERN: 'In GameRoom.jsx, add this code'
CORRECT: 'cat src/pages/GameRoom.jsx | head -50 — then, based on what you see, add...'
WHY: T1 S2 first read of gameStore.js was stale. T2 S3 algo failed its own tests.
IMPLEMENTATION: Every task starts with PREMISE CHECK commands. No exceptions.

### Pattern 2 · Pathspec re-derived from git status (rule 1)
ANTI-PATTERN: git add src/store/gameStore.js src/store/gameStore.test.js
CORRECT: git status --short — then add ONLY the M/A files that are yours
WHY: T2 S2 forge's pathspec omitted useAuth.test.js. T2 committed 5 files not 4.
IMPLEMENTATION: Every forge's COMMIT section must say 'pathspec re-derived from git status'

### Pattern 3 · Run code against tests before trusting either (rule 27)
ANTI-PATTERN: 'Tests pass and the code looks right'
CORRECT: Run the tests WITH the new code. Check if tests actually exercise the code path.
WHY: T2 S3 — forge's algorithm failed its own tests (phantom candidates).
IMPLEMENTATION: 'npx vitest run [specific test file] 2>&1' after every task, not just at end.

### Pattern 4 · Never reimplement a tested primitive (rule 27 corollary)
ANTI-PATTERN: Write a new rotation function because it's slightly different
CORRECT: Import hexRotate60CCW from hexUtils — one geometry owner, always.
WHY: T2 S3 forge's rotation reimplementation had a blind spot when empty hex is pattern[0].
IMPLEMENTATION: grep for existing implementations before writing new ones.

### Pattern 5 · No Math.random() in synced game actions (rule 32)
ANTI-PATTERN: const randomBonus = available[Math.floor(Math.random() * available.length)]
CORRECT: Use deterministic seed (game state) or accept data from rulebook source
WHY: T2 S5 — random token assignment can't be replayed or verified across clients.
IMPLEMENTATION: Any game action that writes to DB must produce identical output for identical input.

### Pattern 6 · Validate before debit (rule 29)
ANTI-PATTERN: consume the bonus token, then check if the action is valid
CORRECT: validate the entire action → only if valid: set consumed=true → only if consumed: remove token
WHY: T2 S4 — forge's useBonus burned a 3pt token on rejected initiative.
IMPLEMENTATION: Every 'spend resource to do action' has validation BEFORE resource removal.

### Pattern 7 · Isolate before believing a failure (rule 33)
ANTI-PATTERN: '2 tests failed → something is broken'
CORRECT: re-run isolated → if green: it was a flake from resource contention
WHY: T3 S4 — '2 failed' was the unit suite and realtime E2E running concurrently.
IMPLEMENTATION: Unit tests first. Live E2E second. Never concurrently.

### Pattern 8 · 403 means the code ran — diagnose the wall (rule 31)
ANTI-PATTERN: '403 = my code is wrong'
CORRECT: 403 proves your code executed and hit a security wall. The wall is RLS/auth, not wiring.
WHY: T1 S4 — a 403 on game_events proved pushState fired. The wall was unstable anon session.
IMPLEMENTATION: Every HTTP error: read the error body fully before concluding anything.

### Pattern 9 · Cross-lane reads before integration (rule 25)
ANTI-PATTERN: write integration code based on what you remember the other lane doing
CORRECT: git show HEAD:src/hooks/useGameActions.js before writing code that calls it
WHY: T1 S2 first read of gameStore.js was stale on two points, nearly flagged correct code as a bug.
IMPLEMENTATION: Every integration task starts with git show HEAD:[other lane file]

### Pattern 10 · Dead code prevention (REFORGE! T3 lesson)
ANTI-PATTERN: build useOptimisticMove because it might be useful later
CORRECT: build it when a real consumer exists. Not speculatively.
WHY: T2 S3 — forge had useOptimisticMove as dead code. T3's sendMove was already the single owner.
IMPLEMENTATION: Before building a utility: grep for a consumer. If none exists: skip.

## TERMINAL-SPECIFIC PATTERNS

### T1 (Visual Layer)
  · 44px touch targets — non-negotiable, mobile-first
  · tabular-nums on ALL numbers (scores, actions, counts)
  · All animations via CSS keyframes in index.css — never inline
  · district is a NUMBER not a string (caught T1 S3)
  · Never reimplement game logic in components — always read from store

### T2 (Engine)
  · findBuildableCards is the single pattern-matching owner — never reimplement
  · tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean is the single scoring API
  · Zustand set() returns void — use get() before set() for boolean actions
  · Every bonus action: validate → debit → confirm (never debit before validate)
  · 1-bonus-per-turn enforced via bonusUsedThisTurn boolean

### T3 (Multiplayer)
  · DB changes = authoritative state (all game moves)
  · Broadcast = ephemeral signals ONLY, max 32KB
  · Presence = lobby tracking only
  · channelRef cleanup before every new channel creation
  · window 'online' + visibilitychange = reconnect handlers (mobile coverage!)
  · serializableState() = JSON.parse(JSON.stringify(store)) — never structuredClone

## SELF-IMPROVEMENT HOOK

Every new pattern discovered in a session:
  1. Add it as Pattern N+1 to this file
  2. Format: ANTI-PATTERN → CORRECT → WHY (which session, what broke) → IMPLEMENTATION
  3. Run SKILLUPGRADE! neotopia-forge-patterns to push
  This skill grows with every session. It is the institutional memory of the project.
