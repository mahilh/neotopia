# DID BONUS TOKENS BREAK BALANCE?
**T2 S39 · August 10 2026 · 360 seeds, three disjoint blocks**

> ## ⚠ SCOPE STAMP · T2 S50 · EVERY NUMBER BELOW WAS MEASURED AGAINST LADDER v1, WHICH NO LONGER EXISTS
> S50 retuned the bot difficulty ladder (`docs/LADDER_CALIBRATION.md`): apprentice and architect both
> moved, builder is byte-identical. **The bonus-token RULES are unchanged** — thresholds stay 7/13/18,
> the token stays 3 points, and Mahil's "change nothing" decision stands. What moved is the *opponent*
> in every duel these numbers came from, so the effect SIZES below describe games that nobody will play
> again.
>
> **What survives unconditionally**, because it is structural rather than statistical: the S48 finding
> that the earn skew is redundant with skill rather than additive to it, which was re-measured
> rung-against-rung in S49 (flattening moved the matchups by 0.0, 1.3 and 0.0 points) and is gated by
> ordering assertions that carried through the retune untouched.
>
> **What needs re-measuring before it is quoted again**: the +7.7-point spendable-token figure and the
> per-rung deltas, both of which are magnitudes against a specific opponent. The nightly runner
> (`scripts/run-balance-blocks.sh`, 3 disjoint blocks) re-stamps them on the next run and is the right
> place for it — a doc re-stamped by hand is the citation-rot this project keeps finding (Rule 97).
>
> This stamp exists rather than a silent edit because the numbers are still the correct record of what
> was measured; they have lost their *scope*, not their integrity (Rule 101b).

> ## ✅ T2 S48 · THE LAST OPEN QUESTION IS ANSWERED · the earn skew is REDUNDANT, not compounding
> **Measured at HEAD `faa27c7` · 4 disjoint 40-seed blocks · 320 games per rung · `src/store/flatGrantBalance.test.js`**
>
> S47 found the skew: tokens are earned by crossing 7/13/18, so earning tracks scoring speed and the
> architect out-earns the reference ~23x. **That left one question, and it decides whether the
> thresholds need touching at all: is the gap an EXTRA advantage, or just another symptom of being
> better?** Both readings fit S47's data and they license opposite decisions.
>
> ### The experiment · one game, scored two ways
>
> Same games, same tokens, same count, same grant moments · **only the recipient changes.** Threshold
> arm: whoever crossed. Flat arm: dealt evenly. Because `botPolicy.js` contains no reference to bonus
> state, moving a token changes **zero decisions**, so each game is played once and scored twice.
> **This is an EXACT control** (Rule 74) · the property S39 had and the two spending sessions had to
> give up, recoverable here for the same reason S39's was: the quantity under test is inert.
>
> | rung | win% as earned | win% flattened | mean Δ | **games flipped** | earn gap | margin earned → flat | token share of margin |
> |---|---|---|---|---|---|---|---|
> | **control** (ref v ref) | 50.0 ×4 | 50.0 ×4 | **0.0 in 4/4** | 10.0 / 80 | 0.00 | 0 → 0 | — |
> | apprentice | 5.1–11.3 | 7.6–15.0 | −3.8 | 4.5 / 80 | −1.94 | −20.1 → −14.3 | 0.41 |
> | builder | 68.4–77.2 | 75.0–79.5 | −4.1 | 10.5 / 80 | +0.48 | +11.5 → +10.1 | 0.14 |
> | **architect** | 98.8–100 | 98.8–100 | **0.0 in 4/4** | **0 / 80, 4/4** | +4.94 | +59.2 → +44.4 | **0.33** |
>
> ### THE ANSWER
>
> **The architect's token surplus is a third of its entire winning margin and it decides NOTHING.**
> ~5 extra tokens per game, ~15 points, on a 44-point lead · redistribute every one of them evenly and
> **zero games out of 320 change hands**, in 4 of 4 blocks. Not "a small effect": an exact zero, while
> the same instrument demonstrably flips ~10 games per 80 in the symmetric control. **The tokens are a
> receipt for winning, not a cause of it.**
>
> **And where the skew does bite, it bites the opposite way to the fear.** The shipped threshold rule
> *costs* the builder ~4.1 points of win rate and the apprentice ~3.8 (negative in 4/4 and 4/4).
> Flattening would **help** them. So the distribution is mildly **anti**-compounding in the middle · it
> hands the reference policy an edge against the builder, not the other way round.
>
> *Mechanism, so the sign is not a mystery: flattening compresses the token term toward equality, which
> shrinks every margin. A side that wins wide and loses narrow gains from compression, and every ladder
> rung has that shape against the reference. The **control is what makes this readable** · with
> identical policies the compression still flips ~10 games per 80 and moves the win rate by exactly
> 0.0, so the redistribution works and has no direction of its own.*
>
> ### RECOMMENDATION · change nothing. Thresholds stay at 7/13/18.
>
> This is the pre-committed call from `docs/T2_ROADMAP.md` §2 ("ladder unchanged → the earn gap is
> cosmetic → change nothing"), and it is worth saying that the pre-commit was written about a
> *different* statistic (S47's both-spend-minus-no-spend delta). What was measured is more direct, so
> the mapping is stated rather than assumed: the compounding case required the skew to ADD to the
> stronger player's edge, and in no rung does it. **The one thing that would reopen this is a rung
> whose flip count is non-zero AND whose delta is positive.** Neither exists here.
>
> ### What I got wrong, in the experiment itself
>
> **My first flat deal was not flat.** It alternated the odd token's recipient once per game so it
> "would not always land on seat 0" · but the duel flips the orientation once per game too, so the two
> alternations **locked in phase** and logical player A received the extra token in every single game.
> `flatGap` read **+0.50 in 12 of 12 rung-blocks** when it must read 0, worth a silent +1.5 points to
> whichever side was under test, in the arm whose only job is to be even. Volume, movement and the
> exactness identity all stayed green while it was wrong. **A randomisation scheme that shares a period
> with the thing it is meant to balance against balances nothing** · and the tell was printed in my own
> report, small enough to read past. `flatGap` is a gated counterweight now, not a report field.

> ## 📊 T2 S47 · THE THREE THINGS S46 COULD NOT SEE · and they change the advice
>
> S46 measured **self-play**: identical policies, one spends, spender wins +7.7. That is a real number
> and it is **not the number a balance decision needs**. Three follow-ups, two disjoint 40-seed blocks
> each.
>
> ### 1 · Timing does not matter · quantity does
>
> | plan | spends/game | vs hoarder | vs on-sight |
> |---|---|---|---|
> | on-sight | 1.14 | 56.0 | — |
> | late-game (tiles ≤5) | 1.15 | 56.0 | **50.0** |
> | hand-short (≤3) | 0.49 | **47.3** | 46.7 |
>
> Late-game is **indistinguishable** from on-sight (exact 50.0 head-to-head, same spend rate). The plan
> that spends *less* is **worse than hoarding**. So **+7.7 is not a floor, it is near the ceiling** ·
> the dumbest use of the decision is as good as the timed ones. The gradient is on how OFTEN you spend,
> not when. (A fourth plan, "spend when hand is empty", fired 0.01 times per game · it was `never` in
> disguise and is excluded from the finding. My first counterweight asserted `>0` and passed it.)
>
> ### 2 · The ladder · spendable tokens do NOT re-order skill
>
> Win rate vs `REFERENCE_POLICY`, neither side spending → both sides spending:
>
> | rung | without | with | delta (block 1 / block 2) |
> |---|---|---|---|
> | apprentice | 5.1 / 12.5 | 6.3 / 12.5 | **+1.2 / 0.0** |
> | builder | 77.2 / 71.4 | 70.9 / 69.6 | **−6.3 / −1.8** |
> | architect | 98.8 / 98.8 | 98.8 / 95.0 | **0.0 / −3.8** |
>
> Small, and **mostly negative · the same direction S39 found for unspent tokens.**
>
> **This reconciles the apparent contradiction with S46**, and the reconciliation is the finding:
> spending pays handsomely **against someone who does not spend** (+7.7), and washes out **when
> everyone does** (ladder deltas ≈ 0). The +7.7 is an advantage over a player who fails to use the
> feature · it is **not a skill amplifier.**
>
> ### 3 · 🔴 The compounding question · EARNING is where the skew is
>
> | rung | tokens earned/game | reference earns | gap |
> |---|---|---|---|
> | apprentice | 0.25 / 0.29 | 2.96 / 3.15 | **−2.7 / −2.9** |
> | architect | 6.55 / 6.13 | 1.25 / 1.43 | **+5.3 / +4.7** |
>
> Tokens are earned by crossing score thresholds at 7/13/18, so **earning is a function of scoring
> speed** and therefore already favours the leader. Replicated across both blocks: roughly a **23×
> spread between the ladder's ends** (architect ~6.3 tokens/game, apprentice ~0.27). At 3 points each
> unspent that is **~15 points of final score for architect against ~0.8 for apprentice, before any
> spending decision is taken.**
>
> **And the win rate cannot see it**, because architect sits at ~99% and apprentice at ~5–12%, both
> pinned against a bound (Rule 88). That is why this is reported and gated on the **earn gap** rather
> than on a win-rate delta · the delta is structurally incapable of expressing it.
>
> **For Mahil, the balance picture in one line:** the *spending* mechanism is fair (it washes out when
> both players use it); the *earning* mechanism is steeply skewed to whoever is already ahead. If
> anything wants rebalancing it is the 7/13/18 thresholds, not the token's effect or its 3 points.
> **Not recommending a change · this is the evidence you asked for first.**

> ## 🔴 THE SIGN INVERTED · T2 S46 · measured, 560 games
>
> **S39 (below): an UNSPENT token favours the WEAKER player** · apprentice −2.4, builder −3.0,
> architect −0.8. The mechanism was that a flat 3 points is *noise* (signal-to-noise 0.23) and noise
> helps the underdog.
>
> **S46: a SPENDABLE token favours the player who spends it, by roughly +7.7 points of win rate.**
> Identical policies on both sides, one seat cashes subsidy the moment it holds one:
>
> | block (disjoint seeds) | control | spender win % |
> |---|---|---|
> | 25-seed × 4 | 50.0 / 50.0 / 50.0 / 50.0 | 59.6 · 58.0 · 60.0 · 51.0 |
> | 60-seed × 3 | 50.0 / 50.0 / 50.0 | 54.2 · 58.1 · 63.0 |
>
> **7 of 7 blocks above 50** (binomial p≈0.008). Control exactly 50.0 in all seven, and the
> both-spend arm symmetric at 50.0 in all seven. Roughly 1.2 spends per game.
>
> So the prediction made in S39 held: *"a decision is exactly the kind of term that rewards skill
> rather than diluting it · the sign could invert."* It did, and it got **about 2.5× larger** than the
> whole S39 effect. Spending trades the token's 3 points for two cards, and that trade is favourable.
>
> **Tripwire verdict:** the pre-committed bound was 10 points. The mean effect is **+7.7 · inside it**,
> so this is *not* a recommendation to stop feature work. But it is the largest single-decision term
> measured in this project, individual blocks reach **+13**, and it is worth Mahil deciding whether a
> 3-point token that swings ~8 points of win rate is the intended weight.
>
> **What this experiment gives up, stated rather than absorbed:** S39's control was *exact* · bots
> never read tokens, so each game was played once and scored twice, with not even a sampling difference
> between arms. A bot that spends makes **different games**. This is a paired-seed *statistical*
> control: same seed, deck, tile order and policies, one variable, arms diverging from the first spend.
> Weaker by construction, and the weakness is a property of the feature no longer being inert.
>
> Reproduce: `SPEND_SEEDS=60 SEED_OFFSET=0|100|200 SPEND_OUT=/tmp/s.jsonl npx vitest run
> src/store/spendableBalance.test.js --no-file-parallelism`
>
> Scope: **subsidy only** · it is the one type a human can spend today. `automatization` still has no
> route into the game and `initiative`/`permits` need a placement payload the UI does not collect.

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
