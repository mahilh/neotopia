# Who has actually played NeoTopia

**T1 · S30 · 2026-08-08.** Measured against the live database (read-only) and against the running app.
Player usernames are deliberately not reproduced here · this repo is public.

---

## 1. The denominator was wrong

The number in circulation was *"339 production sessions, one element placed, zero cards scored."* It was
read as a conversion problem: hundreds of arrivals, one of them getting anywhere.

`game_sessions` actually holds **354 rows**, and they break down like this:

| who | sessions |
|---|---:|
| `Alice` + `Bob` · the E2E fixture in `tests/e2e/fixtures/seededState.json` | 332 |
| `BotAlpha*` / `BotBeta*` · the bot harness | 12 |
| `E2E*` / `HostReal` · Playwright specs | 7 |
| **human beings** | **3** |

So there is no funnel of hundreds. **351 of the 354 sessions are our own test equipment**, and the
fixture those 332 use seeds a board and never places anything, which is the entire reason the placement
count is near zero. The statistic was measuring the harness and reporting it as player behaviour.

The one session in the whole table with elements on its board is a `HostReal` harness run from
2026-06-25 with two tokens placed. **No human has ever placed an element in production.** That part of
the claim was not overstated · it was understated, because the true denominator is 3.

## 2. The three human sessions

| when (UTC) | players | turn reached | events | board |
|---|---|---:|---|---|
| 2026-06-26 11:56 | 2 | 17 | none | empty |
| 2026-08-07 19:35 | 2 | 4 | 3 × `turn_end` | empty |
| 2026-08-07 20:29 | 2 | 1 | none | empty |

The first is the Karachi playtest already recorded in `Tutorial.jsx`'s header comment. The database
confirms it exactly: turn 17, nothing on the board.

The second is the one that matters, because it is timestamped to the second:

```
19:35:58  session starts
19:38:19  seat 1 ends turn      (2m 21s on the first turn)
19:39:44  seat 0 ends turn      (1m 25s)
19:40:10  seat 1 ends turn      (26s)
          — nothing further, ever
```

Two people spent over two minutes on a single turn and produced one `End Turn`. Then the other did the
same. Then they left. **No card was drawn either** · not one action of any kind was taken by a human in
four minutes of trying. The audit only records *committed* actions, so this shows what they failed to
do, not which controls they clicked. It is the signature of being stuck, not a recording of the moment.

Both 2026-08-07 sessions predate `b5417ff` (2026-08-08 22:29 UTC), so all three saw the **old** tutorial.

## 3. The old tutorial, followed literally, strands you

The claim that the copy was the cause was untested. It is now, by running it both ways against the same
build, same viewport, same board · the only variable being the text (`literal-follow.mjs`).

The copy those three sessions saw:

> Click any factory token (the colored icons between the regions). **An element leaves the factory. Then
> click any empty hex in the adjacent region to place it there.**

Following it exactly · click a factory, then click empty hexes:

```
OLD COPY · 375x812      after "click a factory token":  ui phase factorySelected · lit hexes 0
                        after "click any empty hex" × 12:  elements placed 0
                        VERDICT: STRANDED
NEW COPY · 375x812      factory → element → region → lit hex
                        VERDICT: PLACED
```

Identical at 1280x800. The sentence "an element leaves the factory" is simply false · nothing leaves,
and no hex becomes clickable, because the game is waiting to be told which element and which region.
A player told about two steps has no reason to look for the other two.

**This proves the copy strands a literal reader.** It does not prove the three sessions failed *for that
reason* · nobody recorded what they clicked. It is the strongest available evidence, and it is
consistent with every measurement, but the causal step from "this text strands a reader" to "this text
stranded those two people" is an inference, not a record.

## 4. The board was not helping either

Measured on the running app, at the moment the player clicks a factory:

| viewport | what changes on the board | distance from the factory to the panel that answers |
|---|---|---:|
| 375 × 812 | a ring on the factory · nothing else | **381 px** |
| 1280 × 800 | a ring on the factory · nothing else | **651 px** |

The player's eye is on the board, because they just clicked it. Every response was in a side panel
further away than the width of the phone. And the header line whose entire job is *"here is what to do
next"* was absolutely positioned over the wordmark: 43 px of overlap at 320, 31 px at 375, 23 px at 414,
36 px at 600, and truncated at all of them. At 375 px it rendered as
`N E O T O P I Ack an element from the factory`.

Both are fixed in `81fb5cf`: the board now previews every hex the picked factory can reach, aiming at
one of them chooses its region, and the instruction line sits in the header flow where it cannot collide
or clip. The four-click sequence is now reachable without reading anything.

## 5. Two things this turned up that belong to other lanes

- **`player_profiles.games_played` is 0 for all 35 rows**, including the people who demonstrably played.
  It is never incremented. Same family as the global-index finding in `578716d`.
- **`room_players` is emptied when a room is deleted** (332 sessions have zero player rows), so the
  roster history for almost every session is gone. Only `game_sessions.state->'players'` survives, which
  is why the table in §1 had to be reconstructed from JSON.

## 6. What is still not known

Nothing here explains why **33 profiles exist and only 3 sessions started**. A profile row is created
when someone types a name, so people got that far and then did not end up in a game. Roughly a third of
those rows are harness names; the rest are not accounted for. That gap is upstream of everything above
and is the next thing worth measuring.
