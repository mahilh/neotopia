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
