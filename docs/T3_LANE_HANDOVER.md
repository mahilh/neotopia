# T3 LANE · HANDOVER

Written S70, the last session in this lane. For a stranger, not for the people who were here.

**Lane:** `src/hooks/useGameRoom.js` · `useGameSync.js` · `usePresence.js` · `tests/e2e/`

---

## 1 · WHAT IS CLOSED, AND WHAT PROVES IT

| | proven by | where it runs |
|---|---|---|
| the soft-lock (4 fixes, 3 lanes) | `practice.e2e.js` S45 block | merge gate |
| the write race (last-write-wins) | migration 022 + `writeOrder` wiring | merge gate |
| the practice turn clock | `practice.e2e.js` | merge gate |
| the CI identity pool | `e2ePool` + `[pool]` log lines | all three E2E workflows |
| the endgame TRIGGER, live | `endgame-live.e2e.js` · witnessed **5 times**, always `tiles 0 · rounds 2 · turn 17` | **nowhere** — see §4 |

Every spec is wired to a workflow **except one**, and that one is deliberate.

---

## 2 · WHICH OF MY GATES TO TRUST, AND WHICH TO RE-DERIVE

The honest split. "Trust" means the assertion is a fact or an ordering; "re-derive" means it rests on
a number or a shape I chose.

### Trust — no threshold, mutation-proven, fails for one reason

- **`tests/phaseHeartbeat.test.js`** — pins live-spec stage keys from a *second file*, and enumerates
  the class (any spec with the reporter must be registered, and vice versa). 6 mutations, all red.
- **`tests/projectAgreement.test.js`** + `tests/e2e/projectAgreement.js` — the test process and the
  browser must be on one Supabase project. Throws only on two *present, disagreeing* hosts. Every
  call site's REQUIRED/WAIVED posture is pinned. 3 mutations, all red.
- **`tests/mutationHarness.js`** — refuses to report a run with no tally, or a mutation that did not
  land. It caught two uninterpretable runs of mine in S69 alone. No thresholds anywhere.
- **`tests/e2e/devServerTarget.js`** — derives a worktree's own port so a linked checkout cannot
  silently drive the main clone's dev server. Deterministic.
- **`tests/seededState.guard.test.js`** — fixture drift. Fired correctly on T2's `c4fc244`.
  ⚠ After a regeneration it is green *by construction* (both sides derive from `initGame`). Read the
  file, do not read the green.

### Re-derive before relying on them

- **`tests/walletTerminalSeam.js` · delegation depth = 1.** Measured S70: every entry point compares
  the money field at 0 hops, and the collapse Council ordered needs exactly 1. **Sufficient with zero
  margin.** Deeper reads as `blind`/UNMEASURED, never a false green — the safe direction, but if the
  predicate moves another level, this needs re-measuring, not re-reading.
- **`comparesField` line-scoping.** A comparison split across two lines reads as no gate. The error
  direction is deliberate (a false RED is loud; a false GREEN is the vacuity the term exists to
  close) — but it is a shape I chose, not one I measured against real formatting.
- **`waitForGameSyncJoined` 20s · `endgame-live` 210s budget / 30s stall / 30s adoption poll.**
  Every one of these is a number somebody typed. None has been swept under load. Preamble §3: a bound
  is a claim about a noise floor, and one sample of the floor is not a measurement of it.
- **`jsonSubstringAssertions`** — the *finding* is measured across the whole corpus (69 assertions,
  64 correctly non-JSON). The **regex** is the risk, as every regex here has been.

---

## 3 · HOW TO RUN A LIVE SPEC WITHOUT LOSING A DAY

```
npm run test:e2e -- tests/e2e/<spec>.js        ← NEVER a bare `npx playwright test`
```

`npx playwright test` skips `with-project-env`, so the **test process** inherits whatever Supabase
credentials your shell exports while the **browser** (started via `npm run dev`) gets the right ones.
That cost me two identities and produced a run that accused the product of dropping `postgres_changes`.
`assertProjectAgreement` now refuses it, but only where it is called.

- **Isolate first:** `git worktree add --detach <path> HEAD`, symlink `node_modules`, **copy
  `.env.local`** (it is gitignored, so a worktree has none — and `with-project-env` strips but never
  *injects*; still open in T2's lane).
- **Check CI is quiet first.** `purge_e2e_test_data` deletes E2E-prefixed rooms of any status, so your
  own push can delete the room your live run is playing in.
- **Cost:** 3 identities per local invocation (2 browser + 1 teardown). The pool credentials are repo
  secrets, so locally there is no way down from 3. Count them from `[pool]` lines, never from the yml.
- **No `--grep` through the env guard** — it spawns with `shell: true` and re-parses argv, so an
  alternation dies as `/bin/sh: <word>: command not found`. Run whole files.

---

## 4 · THE ONE OPEN ITEM, WITH A NAMED CAUSE

`tests/e2e/endgame-live.e2e.js` is `test.fixme(true)` and in **no workflow**. That is deliberate:
adding it would buy a green job containing a switched-off test, which `fixme` hides from the nightly's
skip-guard.

It has witnessed the live endgame trigger **five times**. What it cannot yet do is get past the
adoption gate reliably. S70 ran the four-way diagnostic and **eliminated three of four**:

```
channels    realtime:game-sync:<room>:joined     SUBSCRIBED
server      state_turn 17 · state_tiles 1        THE ROW MOVED
writeorder  { overtakes: [], version: 0 }        nothing refused
local       turn 1 · tiles 12                    on the FRESH game
```

A fourth is out from source: `useGameSync:182` gates on `v > 0`, and the harness never sets
`state_version`, so a 0-version frame is **applied**, not refused.

**Two survive, with identical signatures:**

1. **NEVER DELIVERED** — the subscription attached after the write. Mine, an ordering race.
2. **NOT APPLIED** — the client was told and did not act. A defect in **every live room**.

The probe read the channel at *failure* time (+43.8s); the write was at +12.9s. `waitForGameSyncJoined`
now blocks the write until both clients report joined and prints the state **at write time**.

> **A next run that still fails has eliminated the race, and the remaining explanation is the product.**
> That is the only outcome that changes the denominator from one fixme'd spec to every live room.

Do not read S69's asymmetric adoption as a shape — it happened once and did not reproduce.

---

## 5 · THINGS I GOT WRONG THAT WOULD COST YOU TOO

- **A guard can FORBID a correct design and send no invoice.** Mine made T2 keep a predicate inline
  against Council's instruction. Ask of every gate you add: *what does this forbid, and who was
  relying on doing it?*
- **`git add <pathspec>` writes to a shared index.** In a live multi-terminal tree, another lane's
  staging lands in your commit whatever you passed. Use `git commit -m … -- <paths>` and read
  `git show --stat HEAD` every time. Preamble §5 has the repair.
- **Four of my greps were wrong in one session** — a call site read as a declaration, a filename
  suffix, a comment read as code, a definition counted as a call. None found by rereading; all found
  by running the instrument. Preamble §1 has them.
- **Reading a rule does not apply it.** I reddened the merge gate for two lanes with Rule 100, on the
  day I wrote Rule 100 up twice.
