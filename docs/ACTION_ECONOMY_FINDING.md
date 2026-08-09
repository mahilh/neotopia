# The action economy is deciding games the board is supposed to decide

**T2 · S32 measurement, S33 write-up · input to a design decision, not a proposal**

This document exists because a bot difficulty ladder failed to work, and the reason it failed turned
out to be a fact about NeoTopia rather than a fact about the bot. It is deliberately written as
evidence first and options last. Nothing here has been acted on.

---

## 1 · What was being attempted

Practice mode needed three ordered opponents. The obvious axis was **placement quality**: a novice
that places at random, a middle bot that grows clusters, an expert that grows clusters *and* defends
its weakest region (worst region is multiplied by three in the final score, so it is the highest-
leverage square on the board).

That is the ladder any experienced player would describe. It did not work.

## 2 · What was measured

All games are full games played by the real `src/store/gameStore` engine, no network, deterministic
seeded shuffles. Every matchup is played **both ways with the same seed**, so turn-order advantage
cancels exactly. Draws are excluded from the denominator rather than counted as halves, because this
game ties often at low scores and folding ties in drags every rate toward 50%.

**Result A · placement quality is noise.**

| matchup | win rate of the "stronger" policy |
|---|---|
| greedy cluster-builder vs random placement | **56%** (44/56 · indistinguishable from a coin flip) |

**Result B · the novice beat the expert by playing "badly".**

| matchup | result |
|---|---|
| a bot that "wastes" actions drawing cards vs the greedy placer | **novice wins 85%** |

**Result C · once the ladder was rebuilt on draw rate, it ordered immediately.** Measured against a
frozen reference opponent (20 seeds × both seatings), which is the yardstick added in S33 so the
levels are on one scale instead of only relative to each other:

| policy | draw bias | win rate vs the fixed reference |
|---|---|---|
| apprentice | 0.05 | **13%** |
| reference | 0.25 | 50% (control · exactly a coin flip) |
| builder | 0.30 | **68%** |
| architect | 0.55 | **100%** |

One number changed. Nothing else about how these bots place elements differs between apprentice and
the reference at all.

### A caveat that matters

Every one of these is **bot versus bot**. They prove the levels are ordered; they say nothing about
how any of them feels to a person, and a human will find lines a greedy one-ply bot cannot see. It is
possible — not likely, but possible — that placement skill has a ceiling these bots never approach and
that the finding is really "shallow placement skill is worth nothing", which is a weaker claim. The
honest reading is: **at every skill level we can currently produce, the draw rate dominates.**

## 3 · Why this happens

All actions come out of one shared per-turn budget. Under that rule:

- **A drawn card is a future district.** It is optionality, and it compounds — a bigger hand means more
  chances that whatever the board happens to offer matches something you hold.
- **A placed element is only a step toward one.** A single element rarely completes anything on its own,
  and an element placed toward a card you do not hold may be worth nothing at all.

So spending an action on a card strictly dominates spending it on a hex, until the hand is large
enough that completion is no longer the constraint. The board is where the game *looks* like it is
being played. The hand is where it is actually being decided.

The cluster rule (1 point per element in the biggest cluster per region, board rulebook p9) was meant
to be the counterweight that makes placement location matter. Measured, it is not carrying that
weight: cluster-aware placement scored 56% against placing at random.

## 4 · What this costs the game, if it is real

- **The board becomes decoration.** The hex grid, the pattern matching and the cluster rule are the
  most visible and most expensive parts of NeoTopia, and they are being out-voted by a hand-size
  heuristic a new player can be told in one sentence.
- **The skill ceiling is low and the skill floor is high.** "Draw more" is learnable in one game. After
  that there is little left to get better at, which is a problem for something meant to be replayed.
- **The difficulty ladder cannot teach.** Right now the only way to make a bot easier is to make it draw
  less, so an easy bot is not a gentler opponent, it is one making a mistake the player will copy.

## 5 · Levers that exist

Listed for completeness with the obvious objection to each. **No recommendation is being made here**
— this needs a decision from Mahil, and probably a played game before any of it is worth trying.

1. **Separate the budgets.** One draw plus N placements per turn, rather than one pool. Removes the
   trade-off entirely, which also removes a real decision from the game.
2. **Cap the hand.** A hard limit makes drawing self-limiting and restores placement as the tiebreak
   once the cap is reached. Cheapest change; adds a fiddly rule.
3. **Make drawing cost something.** Draw as a full turn, or draw-then-discard. Directly prices the
   dominant action. Risks making the early game feel slow.
4. **Raise what placement pays.** Increase the cluster bonus, or make the biggest cluster score
   super-linearly, so location competes with optionality. Touches the scoring rule from the physical
   board game, which is a bigger decision than it looks.
5. **Do nothing.** Genuinely on the table. This was measured against bots, the physical game may
   already balance it through the production tile stack, and a real playtest may not reproduce it.

## 6 · The one cheap experiment

Play one practice game to completion against the current default and note whether you ever felt that
placing was worth more than drawing. That single game also does the other job this needs: it locates a
human on the same reference scale as the three bot levels, which is why the frozen reference opponent
was built (`src/lib/botPolicy.js` · `REFERENCE_POLICY`). One game calibrates the ladder and sanity-
checks this finding at the same time.

Until then the ladder stays in code and unexposed, and `DRAW_BIAS` stays exactly where it is.

---

# Part 2 · what the strongest lever would cost  (T2 S34)

Section 5 listed five levers with no recommendation. This part prices them. It is still not a
recommendation · it is the cost sheet, and two of the numbers overturn what Part 1 assumed.

## 7 · The cheap lever was measured, and it does not work

Lever 2 (cap the hand) looked cheapest: one rule, self-limiting, restores placement as the tiebreak.
Measured directly · greedy cluster-building against uniformly random placement, both sides on the
same draw bias, seat-controlled, 15 seeds x both seatings at each cap:

| hand cap | greedy beats random | avg final score | stalled games |
|---|---|---|---|
| none | 43% | 83.4 | 0 |
| 7 | 37% | 78.2 | 0 |
| 5 | 33% | 72.6 | 0 |
| 3 | 50% | 61.5 | 0 |
| 2 | 53% | 54.6 | 0 |

**Placement quality never rises above noise at any cap**, while average scores deflate by a third.
The cap costs a visibly less generous game and buys nothing. Lever 3 (pricing the draw) acts on the
same variable and should be assumed to behave the same way until measured.

## 8 · Why · the rule meant to reward placement cannot change who wins

`getClusterTotal(regions)` takes regions and nothing else. It returns **one number for the whole
board**, and `calculateFinalScore` adds that same number to every player's total. Verified in a real
finished game: a board-global cluster bonus of **40 points, added identically to both players**.

A term that is equal for everyone cannot decide anything. It inflates the scoreboard and moves nobody.
The single mechanism in NeoTopia intended to make *where* you place matter is mathematically incapable
of doing so, which explains every measurement in Part 1 far better than the action economy does.

The reason is in the data model, not the arithmetic: a placed hex records `element` and nothing else.
There is no seat, owner or colour on it, so the engine **cannot** attribute a token to a player.

This diverges from the physical rule recorded in CLAUDE.md:

> "each player gains 1 Point for each Element Token **of their color** on the biggest cluster in each
> Region."

Held weakly, and worth saying: the flat board-global reading may have been a deliberate adaptation
precisely *because* hexes carry no ownership, and `patternMatcher.js` does flag the flat-vs-folded
choice to Mahil in its own comment. What it does not flag is global-vs-per-player, which is the part
that has the balance consequence.

## 9 · Cost of implementing the rulebook wording

| what | cost | notes |
|---|---|---|
| **Data model** · hex records the placing seat | small | +9 bytes/hex. A 4-player full board: **8.3 KB → 8.8 KB serialized, against the 32 KB broadcast cap** (Rule 21). Not a constraint. |
| **Engine** · per-seat `getClusterDetail` / `getClusterTotal`, `calculateFinalScore` 3rd arg per player | medium | `src/lib/patternMatcher.js` · T2 lane |
| **Audit** · `buildGameEndEvent` computes one shared bonus today | small | becomes per-player, `version: 1 → 2`. All 3 historical rows are 0-0 · no real history to migrate |
| **Display** · cluster viz shows one shared "+N total" | medium | `FinalScore` · **T1's lane**, and it is the visible half |
| **Fixtures / sync** | small | shape change reaches `seededState.json` + `seededState.guard.test.js` |
| **Card point spread 12/18/18/8** | **zero** | cluster is a flat meta-term, not card points. **No card needs repointing.** |
| **150-game fuzz suite** | **holds, and that is the problem** | `engineFuzz` asserts termination and invariants, never balance. It would stay green through any balance change · it is not a safety net here. A balance gate would have to be written. |

## 10 · And it is necessary rather than sufficient

The obvious assumption is that per-player clustering fixes it. Measured, with ownership tracked in the
harness and scored by the rulebook's wording, 20 seeds x both seatings:

| scoring rule | greedy beats random |
|---|---|
| current · cluster shared | 45% |
| per-player · rulebook p9 | **53%** |

It creates a genuine differential · **6.7 points** on average between the two players · and a shallow
one-ply greedy policy still cannot convert that into wins. Eight points of movement is inside noise.

Two readings, and this measurement cannot separate them: either the differential is too small to
matter, or converting it needs multi-turn planning that no bot here does and a human might. The second
is plausible and is exactly what one playtest would settle.

**The honest summary: the cheap levers act on the wrong variable, and the correct-by-the-rulebook lever
is necessary but not proven sufficient.** No recommendation · "do nothing" remains genuinely on the
table, and nothing in this document has been changed in shipped code.

---

# Part 3 · the rule was implemented, and it works  (T2 S35 · August 9 2026)

Parts 1 and 2 ended with "no recommendation". Mahil made the decision after playing a game · turn 3,
hand of 7, all three regions on 0, and his words were "the gameplay isn't as fun". That is §7 rendered on
a screen. This part records what shipped and what it measured.

## 11 · What changed

`placeElement` now stamps `placedBy: seat` on the hex. That one field was the whole blocker: §8 established
that the cluster bonus had to be board-global because a placed hex recorded `element` and nothing else, so
the engine could not attribute a token to anybody. With ownership recorded, `getClusterDetail(regions, seat)`
implements the rulebook's actual wording · "1 Point for each Element Token **of their color** on the biggest
cluster in each Region" · and the term became the first thing in the final score that differs between players.

The **cluster** is still found board-globally. Adjacency is adjacency on a shared board, so a cluster can be
built by several players together and `count` remains its true size. Only the **bonus** is attributed.

## 12 · The measurement, with the control it needs

Greedy cluster-building against uniformly random placement. Same draw bias on both sides so the axis under
test is placement and not the action economy, seat-controlled (every seed both ways), draws excluded from the
denominator. 30 seeds, 60 finished games.

Crucially, **both scoring rules were applied to the same 60 games.** Each finished game was scored once by the
shipped per-player rule and once by recomputing the old shared bonus from that identical board. There is no
second run and no second tree, so the comparison cannot be confounded the way T3's S34 load experiment was.

| scoring rule | greedy beats random |
|---|---|
| OLD · one shared bonus, added to everybody (S18–S34) | **46.7%** · noise, as every prior measurement found |
| NEW · per-player, rulebook p9 (S35) | **64.3%** |

Control · identical policy both seats, same harness: **50.0%** under both rules, mean cluster advantage 0.00.
The gate is not vacuous.

Supporting figures: cluster scores differ between the two players in **60 of 60** games (before this change
they differed in 0 of any game ever played, by construction), and the mean cluster advantage to the greedy
policy is **7.57 points**.

## 13 · Part 2 was too pessimistic, and it is worth saying why

§10 predicted 53% from a harness that tracked ownership itself and scored the rulebook wording on the side.
The shipped engine measures **64.3%**. That harness was a model of the change; this is the change. The gap
is a reminder that a simulation of a fix and the fix are different objects, and the honest direction of the
error is the flattering one · I under-promised, which is luck rather than judgement.

So the §10 verdict "necessary but not proven sufficient" is now partly answered: placement skill went from
indistinguishable-from-noise to clearly winning. It is still a one-ply greedy bot, and a 64% edge is not the
same claim as "the board decides the game" · what can be said is that **where you place now changes who wins,
and this morning it could not.**

## 14 · What this does NOT settle

- **Drawing may still dominate.** §7's finding stands untouched: the hand cap experiment acted on the wrong
  variable, and nothing here rebalances the action economy. Mahil proposed cutting 3 actions to 1; that was
  argued against on the grounds that building requires placing the FINAL element yourself, so with one action
  per turn three opponents act between your placements and drawing becomes MORE dominant, not less. Not acted
  on, and no measurement here bears on it either way.
- **Still bot-versus-bot.** The §2 caveat is unchanged.
- **The difficulty ladder is now stale.** Apprentice 13 / builder 68 / architect 100 was measured in a world
  where placement could not matter. Re-measuring is §15.
