# WHY ROOMS ARE ORPHANED · everything measured, and what is still unknown

**T2 S55 · August 12 2026 · measured against production. Routed to T3, because the leading candidate
is in `useGameRoom.js`. Nothing in another lane was touched.**

---

## ⚠ FIRST · A CORRECTION TO MY OWN S54 FRAMING

S54 reported "33 of 34 rooms created since 026 are orphaned" and treated it as **a second mechanism
that appeared after 026**. Measured over a wider window, it did not appear after 026 · it has been the
steady state throughout:

| hour bucket (last 30h) | rooms | orphaned |
|---|---|---|
| all 19 active hours | **177** | **176** |

Essentially every room created in the last thirty hours is orphaned, including many hours **before**
026 was applied at 22:49. So 026 neither caused this nor was expected to fix it. My S54 correction was
right that a second producer exists and wrong to imply it was new. **The rate is also not steady:** it
is bursty and activity-driven (0 rooms in several hours, 22 in one), so the "~8 per hour" I quoted is
an average over a spiky series and should not be used as a forecast without saying so.

---

## WHAT THE ORPHANED ROOMS LOOK LIKE

172 of the 175 orphaned rooms from the last 30 hours share one profile, exactly:

| property | value |
|---|---|
| `room_players` rows | **0** · the host is not seated and no one else is either |
| `player_count` | **0** in all 172 |
| `status` | **`finished`** in all 172 · none `waiting`, none `playing` |
| has a `game_sessions` row | **175 of 175** |
| host appears in `global_neotopia_index` | **0** |
| distinct hosts | **172** · one room each, so not a retry loop |

The other 3 have a `room_players` row whose username is `E2E`-prefixed.

## WHAT IS RULED OUT, AND HOW

- **The purge is not doing it.** 026's invariant holds and was re-checked: a room survives only if it
  is young AND unfinished, and such a room protects its own profile from the profile delete. Every
  one of these rooms is `finished`, so it would have been deleted, not orphaned.
- **Nothing else can delete a profile.** `pg_proc` says exactly one function in `public` contains a
  delete against `player_profiles`: `purge_e2e_test_data`. RLS offers no DELETE policy to clients
  (`profiles_own` is `ALL` on `user_id = auth.uid()`, and the app never issues a delete).
- **Not the room-code retry.** `insertRoomWithRetry` retries once on a 23505; a stuck retry would show
  as one host owning several rooms. 172 rooms, 172 distinct hosts.
- **Not an abandoned create.** An abort between the room insert (`useGameRoom.js:303`) and the profile
  upsert (`:311`) would leave `status='waiting'`. All 172 are `finished`.

## WHAT REMAINS · and it is genuinely open

`status='finished'` is set in exactly one place the app owns · `useGameRoom.js:614`, when the **host
leaves**. So these rooms reached a normal end-of-life. That means either

  (a) the host had a profile which was later removed by a route not yet found, or
  (b) the host never had a profile, and something sets `finished` on a room whose host never seated.

(b) fits the evidence better · no `room_players` row ever survived, no ledger row, and `player_count`
sits at 0 rather than at the 1 the insert supplies. **Worth checking first, and it is a five-minute
read in T3's lane:** does the `player_count` trigger SET an absolute count, or increment/decrement? If
it sets `count(*)`, then `player_count = 0` is consistent with *never seated* and this is squarely
option (b) · which would point at a spec or helper that creates a room and marks it finished without
ever claiming a seat.

**I did not open the trigger, and I am not editing `useGameRoom.js`.** Routed rather than guessed
(Rule 32).

---

## THE OTHER LEAK, WHICH IS FULLY DIAGNOSED AND IS MINE

Separate from the rooms, and simpler: **49 of 71 player_profiles (69%) can never be deleted by the
purge**, because they carry no reserved prefix.

    unreachable prefixes, last 48h:
    A11yEsc | A11yEsc2 | A11yProb | Probe320 | T3PRBH9E | T3PRBH9G | T3PRBP9E | test

`healthcheck.cjs` is a latent fifth producer: it mints `hc_<hex>` every thirty minutes and deletes its
own fixtures, so one failed cleanup is one permanent row.

**My S52 leak guard should have caught this and cannot.** It enumerates two producer *call shapes* ·
`uniqueName('X')` in specs and `enterLobbyWithRetry` in `bot-simulate.js` · and every name above is
constructed dynamically, so none of them appears as a literal anywhere in the repo. That is precisely
the failure I described when I wrote it ("there is one sink and an unbounded number of ways to reach
it") and only half-fixed: I moved the guard to the sink **inside `src/`**, where the sink is a small
closed set of writes, and left the *test-side* producers enumerated by shape.

**And it is the Council tripwire's second strike.** `src/lib/reservedNames.js` records: *"if the prefix
scheme collides a SECOND time, the flag column stops being a destination and becomes the fix."* The
first collision was a player being able to CLAIM a reserved name (S51). This is the mirror image ·
producers failing to USE it, 49 times. Sophia's dissent predicted this exactly, on the grounds that
every new spec is a new producer. **Recorded, not called: that is Mahil's decision.**

### What I shipped for it

`scripts/migrations/027` · **written, verified, NOT applied.** It adds `profiles_unreachable` and
`rooms_orphaned` to the purge's jsonb receipt, which every CI job already prints. Read-only; no delete
predicate changes.

**My first design put this metric in `healthcheck.cjs` and it could not have worked.** `player_profiles`
carries one RLS policy, `profiles_own` = `ALL (user_id = auth.uid())`, so a client counting profiles
sees its own and nothing else · the metric would have reported 1 or 0 forever, inside the workflow
whose entire job is noticing things. A false zero in the alerting path (Rule 80). `game_rooms` is
world-readable, but the orphan count needs the profile join, so it is unreadable for the same reason.
The only component with the privilege to see this leak is a SECURITY DEFINER function, and the purge
is one that already runs on every job and prints its result.

---

# ⚠ S58 · THE PRODUCER IS CLOSED, AND MY S57 HEADLINE WAS WRONG

I closed S57 with: *"20 orphans in the last 3 hours, post BOTH of T3's fixes, every one finished with
`player_count` 0 and zero seat rows · byte-identical to the 535 older ones. A third producer at
~7/hour."* That became the next session's P2 and Mahil's reason to hold the mass delete.

**It is false.** The window was anchored to my clock, not to the change I was measuring:

| | UTC |
|---|---|
| `0cd6b60` cleanupSeeded fix | 05:06:53 |
| `954d362` softCleanup fix | 05:14:33 |
| **last orphan pair** | **05:08:40 / 05:08:48** |
| since `954d362` (11.8 h) | **zero** |

Every room I attributed to "after the fix" was created **before** it. The last pair landed between
the two fixes, which means `softCleanup` was still the live producer at that instant, exactly as T3
diagnosed. There is no third producer. See Rule 126.

## The producer's fingerprint, which is the part that was right

Orphans arrive in **pairs, 6-8 seconds apart** · every pair `max_players 4`, `phase 'playing'`, two
players in state, **seat rows stripped**, session surviving, host profile gone. One pair per
`NeoTopia E2E` run, which invokes `reconnect.e2e.js` and `backend-down.e2e.js` in a single
Playwright call. The pairing is the tell: two specs, one invocation, one room each.

## Two controls arrived free, and neither was designed

- **June 30 → August 8: zero orphans across 39 days.** The project was idle. Production resumes
  precisely when the autodrive sessions resume, so this was never a background process.
- **`NeoTopia CI` (canary) ran on schedule at 07:15 and 12:55 UTC and produced nothing.** It is
  vitest and build with no browser. So the producer is a browser workflow, and browser workflows here
  are push-triggered.

Which is also why the cadence looked like a cron. T3's observation · *"6 per 30 minutes for four
hours; three lanes pushing irregularly doesn't produce that"* · was a real pattern with the opposite
cause: during an autodrive session three lanes push **steadily**, and steady pushes make a comb.

## What the evidence for "closed" actually is, stated at its true strength

Not "five runs, zero orphans" · **three of those five were cancelled** (`scripts/ci-receipt.cjs`).
And `game_rooms` cannot supply its own denominator, because a *successful* cleanup deletes the
evidence: 11.8 hours of CI left exactly **one** surviving room.

The honest measure is exposure from a table no purge can touch:

```
identities_3h  24      auth identities minted in the last 3 hours
orphans_3h      0
```

**24 identities against 0 orphans** · that window was exercised, not idle. That is real evidence the
fix landed, and it is a different and weaker claim than "the producer is gone forever", which needs
a full autodrive session's worth of pushes to earn.

## The instrument defect this exposes, which is mine and one session old

`rooms_orphaned_1d = 0` cannot distinguish **closed** from **nobody ran**. Mahil's precondition for
the mass delete is "a flat day" · a quiet weekend satisfies that sentence while proving nothing.
`029_orphan_zero_gets_a_denominator.sql` adds `identities_1d` / `_total` / `_nonanon` so the receipt
reads itself. **HELD, not applied**: it reads the `auth` schema, which is a new class of access for a
function every authenticated player can execute, and that is Mahil's call rather than mine.
