# DID BONUS TOKENS BREAK BALANCE?
**T2 S39 · August 10 2026 · 360 seeds, three disjoint blocks**

> ## ⚠️ SCOPE, added T2 S43 · THIS IS A MEASUREMENT OF **BOT PLAY**
>
> T1 shipped the spend control in `5381760`, so a human can now *use* a bonus token. **Everything below
> still stands exactly as measured, and it is now silent about human play.**
>
> The premise guard in `bonusBalance.test.js` fired on the day the control landed · which is what it was
> built for · but the remedy it prescribed ("re-run the measurement") was **wrong**, and the reason is
> the interesting part. This experiment plays *bot* games and scores each one twice. Bots still contain
> no reference to bonus state at all, so the control cannot change a single bot decision: a re-run
> replays the identical games and returns bit-identical numbers. Demonstrated, not argued · the balance
> test passed untouched in the same run that reddened the premise checks.
>
> So what the control invalidates is not the measurement, it is the **extrapolation**. For a bot, a token
> is a flat 3 points and therefore noise. For a human it is a *decision*, and a decision rewards skill
> instead of diluting it. **The sign may still invert for humans, and that is now a separate, unrun
> experiment** · it needs a spending policy, and the same-games control cannot survive one (a bot that
> spends makes different games, so the exact control becomes a statistical one).

## The verdict, first

**Bonus tokens systematically favour the WEAKER player. The effect is real, replicated and
statistically significant · and small: 0.8 to 3.0 points of win rate.**

**It is inside the council's 10-point tripwire, so the recommendation is NOT to stop feature work.**
Recorded rather than smoothed: the direction is consistent and it will get larger if the term is ever
re-weighted or if a control for spending tokens narrows the skill gap it currently widens.

## Why this control is exact rather than statistical

Bots never read or spend bonus tokens · `botPolicy.js` and `useBotTurns.js` contain neither
`bonusTokens` nor `useBonus`. Seeding the pile therefore changes **scoring only** and cannot change a
single decision.

So each game is played **once** and scored **twice**: with the tokens the player earned, and with
`unusedBonusCount` forced to 0. Same games, same commit, same data (Rule 74) · and unlike S35's cluster
measurement there is not even a sampling difference between the arms. `unusedBonusCount` is the second
argument of `calculateFinalScore`, so "unseeded" is exactly `calculateFinalScore(scores, 0, cluster)`.
Nothing is simulated.

## (a) and (b) · the ladder, both arms

Win rate of each policy against the frozen `REFERENCE_POLICY`, seat-controlled, draws excluded.

| policy | without tokens | with tokens | delta | replication (3 blocks) |
|---|---|---|---|---|
| apprentice | 11.5 / 12.2 / 11.3 | 9.2 / 9.3 / 9.2 | **-2.4** | 3/3 negative |
| builder | 75.6 / 77.1 / 77.2 | 73.0 / 73.0 / 75.0 | **-3.0** | 3/3 negative |
| architect | 98.3 / 97.5 / 98.3 | 97.5 / 97.1 / 97.1 | **-0.8** | 3/3 negative |
| **control** (identical policies) | **50.0 / 50.0 / 50.0** | **50.0 / 50.0 / 50.0** | **0.0** | net flips 0 of 52 |

**9 of 9 cells negative.** The control is the cleanest null I have measured on this project: exactly
50.0 in both arms in all three blocks, with the paired flips landing 26/26.

Paired significance (McNemar exact, pooled within a matchup across *independent* seed blocks · the
discordant games are the only ones carrying information):

| policy | discordant | to weaker | to stronger | p |
|---|---|---|---|---|
| apprentice | 27 | 20 | 7 | **0.019** |
| builder | 55 | 38 | 17 | **0.0065** |
| architect | 8 | 7 | 1 | 0.070 |
| control | 52 | 26 | 26 | 1.000 |

I originally pooled across the three *matchups* for a headline p=0.0125. That was wrong to lean on ·
they share seeds and an opponent, so they are not independent. Pooling within a matchup across disjoint
seed blocks is clean, and it says the same thing more honestly.

## (c) does the player who crosses 7 more often just win?

No · and the mechanism is the interesting part.

Tokens flipped the winner in **4.2%** of games (5 of 120), and all 5 flips went to the player holding
more tokens. So when the term decides, it decides in the obvious direction. It just rarely decides.

**Why it helps the weaker player despite that:** `builder` earns a small mean token *advantage* over the
reference (+0.56 tokens = **+1.68 points**) but the term's spread is **sd 2.48 tokens = 7.44 points**.
Signal-to-noise **0.23**. Adding a term whose variance is four times its mean edge is adding noise to a
contest, and noise always helps the underdog. That is the whole effect, and it predicts the sign of
every cell in the table above.

`architect` earns far more tokens (+4.62 mean) and still loses 0.8 points of win rate · because at 98%
it has no headroom left to convert them into wins.

## What I got wrong building this, because it changes how much to trust the guard

**The first version of the standing guard had no teeth, and I nearly shipped it.**

I asserted the tripwire on the mean of the three rungs' win-rate deltas. Then I mutated the token term
from 3 points to 12 · a fourfold overpowering · and the test **passed**: apprentice -8.0, builder -17.6,
architect +0.0, mean 8.5, under a 10-point wire.

The cause is saturation, and I had spotted it early and then failed to carry it into the design.
`apprentice` sits near 10% and `architect` near 98%; both are pinned against a bound and can barely
register a delta at all, so including them in a mean drags any win-rate statistic toward zero. Only
`builder` has headroom. **A win-rate statistic cannot detect overpowering in a ladder that is already
saturated at both ends.**

The fix is a statistic that does not saturate: `tokenPointShare`, the token term as a fraction of the
score it is added to. Measured at **0.105 to 0.137** across every rung and every block; the 3→12
mutation takes it to **0.45**; switching the term off takes it to **0.0**. Both now fail.

**Also sized rather than assumed:** the per-rung win-rate delta is not measurable at any sample this
suite can afford. Across eight 25-seed blocks it ranged to **-10.2** · it would have tripped a 10-point
wire once in eight runs *on working code*. At 60 seeds it still reached 8.3, for 20s a run. So the
standing guard asserts the share band (sharp, stable), the control (exact in 8/8 and 6/6 blocks), and
keeps the win-rate wire only as a coarse backstop with an honest note saying so.

## Reproduce

```
BALANCE_SEEDS=120 SEED_OFFSET=0   BALANCE_OUT=/tmp/bal.jsonl npx vitest run src/store/bonusBalance.test.js --no-file-parallelism
BALANCE_SEEDS=120 SEED_OFFSET=120 BALANCE_OUT=/tmp/bal.jsonl npx vitest run src/store/bonusBalance.test.js --no-file-parallelism
BALANCE_SEEDS=120 SEED_OFFSET=240 BALANCE_OUT=/tmp/bal.jsonl npx vitest run src/store/bonusBalance.test.js --no-file-parallelism
```
vitest v4 only surfaces `console.log` on failure, so `BALANCE_OUT` is how a passing run reports its
numbers at all.

## What this does not settle

Every token measured here was **unspent**, because nothing calls `useBonus`. The whole finding is about
a flat 3-points-each term. The day a control ships, tokens become a *decision*, and a decision is
exactly the kind of term that rewards skill rather than diluting it · the sign could invert. **This
measurement must be re-run then.**

## The guard now watches its own premise (T2 S40)

The line above used to end *"and the standing guard will not tell anyone to do it."* That was true and
it was the weakest part of this document: the guard asserts the term's **magnitude**
(`tokenPointShare`), and magnitude is exactly what does *not* change when a 3-point token becomes a
3-point token you had to choose. It would have stayed green on the precise day its own conclusion
expired · a gate watching a number rather than watching its assumptions.

`bonusBalance.test.js` now asserts the two premises directly, and both fail *loudly with instructions*
rather than quietly with a diff:

| premise | why it matters | how it breaks |
|---|---|---|
| **A** · no product code invokes `useBonus` | tokens are unspent, so the measured term is a flat constant | T1 ships the control · **expected**, and the failure message says re-run rather than revert |
| **B** · no bot decision code reads bonus state | seeding changes scoring only, so the control is **exact** (Rule 74) | silently · it changes no number, it downgrades one-game-scored-twice into two different games, and nothing else in the repo would ever say so |

B is the dangerous one. A is the one that will actually fire.

**Teeth verified by mutation, not by a passing run** (Rule 86): a real `useBonus(0, 'subsidy')` added to
product code fails A by filename; one `bonus` mention appended to `botPolicy.js` fails B; and making the
detector return `false` · maximal toothlessness · is caught by the counterweight, which drives the same
pure function against a whole real product file rather than a tidy snippet, so an over-greedy
comment-stripper cannot make the guard vacuous without going red where it is visible.
