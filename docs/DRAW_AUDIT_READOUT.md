# THE DRAW-AUDIT READOUT · what the game_events corpus actually contains

**T2 S51 · August 11 2026 · read out of production BEFORE any destructive change, on Mahil's
instruction. These rows cascade from `game_rooms` and cannot be recovered once a purge runs.**

---

## WHY THIS EXISTS

Migration 021 (T2 S42) added an audit row inside `draw_card_for_seat`'s existing `FOR UPDATE`
transaction, because **a value in `game_sessions.state` cannot distinguish never-attempted from
attempted-and-refused from attempted-written-and-overwritten**. Mahil asked for the answer to be
read out before the evidence is considered for deletion. This is that read.

## ⚠ FIRST, A CORRECTION TO MY OWN S50 REPORT

In S50 I told Mahil the mass delete would destroy **"177 draw-audit rows from migration 021."**
That number is real and the description is wrong by a factor of 88. Split by payload:

| | rows | what it is |
|---|---|---|
| `draw_card` with `event_data = '{}'` | **175** | legacy client events, **all 2026-06-26**, zero information |
| `draw_card` with `via = 'draw_card_for_seat'` | **2** | the actual migration-021 audit rows |

I counted `event_type = 'draw_card'` and reported it as the audit corpus without opening the
payload. That is Rule 91 exactly - a count of a *type* read as a count of the *thing I cared about*
- and it was the strongest argument I gave against the mass delete.

## THE FULL CORPUS · 242 rows, all of it

| event_type | rows | sessions | empty payload | days | in orphaned rooms |
|---|---|---|---|---|---|
| `draw_card` | 177 | 8 | **175** | 2026-06-26 .. 08-11 | 177 |
| `turn_end` | 59 | 8 | **59** | 2026-06-26 .. 08-09 | 54 |
| `game_end` | 3 | 3 | 0 | 2026-06-26 | 3 |
| `place_element` | 3 | 1 | **3** | 2026-08-09 | 0 (survives) |

**234 of 242 rows carry an empty `{}` payload.** They record that an event happened and nothing else.

### The 2 real audit rows

```json
{"via":"draw_card_for_seat","mode":"flow","source":"offer","card_id":"audit_offer_0",
 "card_name":"Audit Offer Zero","card_index":0,"deck_after":2,"offer_after":0,"actions_after":3}
```

Both identical. Both seat 0, both `mode: flow`, both `source: offer`, 2026-08-11 01:44 and 04:18.

**`audit_offer_0` / "Audit Offer Zero" is a fixture card seeded by `tests/e2e/draw-rpc-audit.mjs`.**
Neither row is organic play. They are the harness observing itself, which is what it was built to do
- and it is reproducible on demand, so deleting them costs nothing that a re-run does not restore.

### The 3 `game_end` rows · the only non-empty payloads, and they are also empty of meaning

All three: two `E2E`-prefixed identities, `version: 1`, and

```
total 0 · scores [0,0,0] · districts 0 · unused_bonus 0    for BOTH seats, in all THREE games
```

Three E2E games that reached a terminal state having scored nothing. `version: 1` predates the S35
payload that carries `cluster_bonus`, so they cannot even serve as a schema sample for the current
format.

---

## THE ANSWER THE SUBSYSTEM WAS BUILT TO GIVE

**`draw_card_for_seat` has been invoked twice in the lifetime of this database, both times by the
E2E audit harness. No human has ever drawn a card through it.**

And this is *not* a wiring defect, which is the distinction the audit row exists to make. The path is
real and connected:

```
src/pages/GameRoom.jsx:185  ->  src/hooks/useDrawCard.js:46  ->  supabase.rpc('draw_card_for_seat')
```

So the corpus answers its question cleanly, in the one direction nobody framed it in: not
"attempted-and-refused", not "written-and-overwritten", but **never attempted**. That is consistent
with the rest of the production picture - only 3 non-E2E sessions exist, no human with a claimed
username has ever finished a recorded multiplayer game (S48), and no human has ever placed an
element. The audited RPC is silent because the game has not been played, not because it is broken.

## WHAT THIS MEANS FOR THE HELD MASS DELETE

**The evidence argument against it is gone.** I raised it in S50 and it was the strongest thing I
had; measured, the corpus contains 234 empty rows, 2 reproducible fixtures, and 3 all-zero E2E
games. Nothing here can answer a question anyone will ask.

That does **not** re-open the decision. Mahil's S51 call - ship the age-guard, hold the delete -
rests on the deletion being *housekeeping wearing the fix's clothes*, and that reasoning is
untouched by this readout. It is now simply better founded: the delete is cheap AND worthless, which
is exactly the profile of something that should wait for a reason rather than be done because it is
available.

**The tripwire stands**: if orphaned rooms pass ~1000 or begin affecting query performance, the mass
delete stops being housekeeping and becomes the fix.

## WHAT WOULD MAKE THE NEXT READOUT WORTH MORE

The audit row is well designed and has had nothing to observe. If the intent is to learn something
from real play, the missing ingredient is a human drawing a card in a multiplayer room - not another
column. Worth noting because the temptation, once a subsystem reports nothing, is to instrument it
further; here that would be building a second witness to an event that has not occurred (Rule 84 -
a well-tested symbol is not a tested path).
