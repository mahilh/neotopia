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
