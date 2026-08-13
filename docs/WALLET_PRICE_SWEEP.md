# The price sweep · what a wallet actually does to NeoTopia

**T2 · S64 measurement · input to a pricing decision, not a proposal.** No price is recommended.
Companion to `docs/CARD_ECONOMY.md`, which measured the basket; this runs the wallet.

Harness `src/store/walletPriceSweep.test.js` · engine `src/store/ladderHarness.js#playOnce`.
**Three disjoint 25-seed blocks** (`SWEEP_OFFSET` 0 / 300 / 600), 10 prices, both seatings per seed.

---

## 0 · The model, and the limit that governs every number

The engine has no wallet. `playOnce({ wallet })` refuses to **issue** a draw the seat cannot afford
and re-asks the policy with the deck and offer hidden · a state `chooseBotAction` already handles
through its own guards. So no new decision code exists and no second rules engine can drift from the
first (Rule 45).

**The constraint is faithful. The adaptation is not.** A real player who knows cards cost money buys
different cards at different moments and places differently in between. Bot draw bias is a fixed
constant, so the only adaptation this harness can express is the pacing arm in §2 · which is why
there are two arms rather than one, and why §2's null is a narrower result than it first looks.

One property that is exact rather than modelled: the deck and tile shuffles are drawn from the seed's
rng **before** play begins, so every arm at every price plays the **same cards in the same order**.
Only the decisions diverge, and they diverge from the first refusal onward · which is the mechanic
working, not the measurement failing.

---

## 1 · The headline · a price removes the card axis and leaves the ladder standing

architect vs apprentice, both priced identically, 50 games per block:

| price | architect win% (3 blocks) | mean | cards acquired arch / appr | **gap** |
|---|---|---|---|---|
| $0M (control) | 95.9 · 86.0 · 81.6 | **87.8** | 21.31 / 17.04 | **4.27** |
| $25M | 95.9 · 86.0 · 81.6 | 87.8 | 21.31 / 17.04 | 4.27 |
| $40M | 95.9 · 86.0 · 81.6 | 87.8 | 21.21 / 17.04 | 4.17 |
| $55M | 91.8 · 82.0 · 79.2 | 84.3 | 19.52 / 16.69 | 2.83 |
| $70M | 85.4 · 76.0 · 70.8 | 77.4 | 16.75 / 15.45 | 1.30 |
| $85M | 78.3 · 79.6 · 82.0 | 80.0 | 13.93 / 13.54 | 0.39 |
| $100M | 73.5 · 74.0 · 72.0 | 73.2 | 12.97 / 12.81 | 0.16 |
| $130M | 78.0 · 80.0 · 71.4 | 76.5 | 9.99 / 9.99 | **0.01** |
| $170M | 69.4 · 85.4 · 66.7 | 73.8 | 8.00 / 8.00 | **0.00** |
| $250M | 75.5 · 80.4 · 80.9 | 78.9 | 7.00 / 7.00 | **0.00** |

Read the last two columns together, because separately each is ordinary and together they are the
finding:

> **The architect's entire card advantage goes to EXACTLY ZERO · 4.27 cards to 0.00 · and it costs
> it about twelve points of win rate, from 87.8% down to a plateau near 75%. It does not approach
> 50%.**

At $130M and above the two rungs buy an identical number of cards, by construction: the cap and not
the policy is deciding. Whatever the architect still wins with at that point is **not** draw volume.

`POLICIES` says what it is: apprentice and architect differ in `drawBias` (0.30 against 0.39) **and**
in `placement` ('random' against 'affinity') **and** in `defendWorst`. The wallet prices the first
and leaves the other two untouched. So:

> **A price converts NeoTopia from a game decided by draw volume into a game decided by placement ·
> without flattening the difficulty ladder.**

That is precisely what `docs/ACTION_ECONOMY_FINDING.md` set out to achieve in S33 and could not. It
considered the cluster rule as the counterweight and measured that the cluster rule was not carrying
it. The reason placement can carry it *now* and could not carry it *then* is S35: until cluster
ownership existed, the cluster term was board-global and identical for every player, so it was
arithmetically incapable of deciding anything (Rule 73). Two findings three sessions apart compose
into this one.

**Honesty about precision.** The block spread at high prices is wide · $170M reads 69.4 / 85.4 / 66.7,
an 18.7-point range. The *shape* is solid: every block at $0-40M is at or above 81.6%, and every block
at $85M and above is at or below 82.0% and at or above 66.7%. The plateau's exact level is ±8 and
should not be quoted more tightly than that.

### The prediction scorecard

| # | prediction (written before the run) | outcome |
|---|---|---|
| P1 | naive pacing beats paced, because early cards have more turns to be completed | ⚠️ **weakly, and not decisively** · 52.9% pooled, sign inverts at $250M. See §2 |
| P2 | the ladder compresses as price rises | ⚠️ **HALF RIGHT, AND THE WRONG HALF WAS MINE** · the basket gap collapses to 0.00 exactly as predicted, but the win rate plateaus at ~75% rather than approaching 50%. My S63 closing claim was that a flat wallet would be "a handicap system" and that a flat $1B would therefore be wrong. **The mechanism was right and the consequence was wrong**, which is the more dangerous way to be wrong: I had a correct story about draw bias and drew a conclusion the data does not support |
| P3 | baskets converge across rungs | ✅ **CORRECT, and exactly** · 4.27 → 0.01 → 0.00 |
| P4 | the game gets shorter, because refused draws become placements and placements burn tiles | ✅ **CORRECT, and small** · 27 → 25 turns (-7%), consistent in all three blocks. The deck left unbought rises 23 → 38 |

---

## 2 · Is budgeting a skill? · no, and the measurement is narrower than the question

Naive (spend freely) against paced (never more than 2 cards ahead of a straight-line spend on the
tile clock), **head to head in the same games**, so both arms share the deck, the board and the
opponent exactly (Rule 74):

| price | naive win% (3 blocks) | mean | spent by half-clock naive / paced |
|---|---|---|---|
| $25M | 56 · 52 · 56 | 54.7 | 15.0% / 14.2% |
| $70M | 48 · 50 · 46.9 | 48.3 | 41.8% / 35.8% |
| $100M | 57.1 · 57.1 · 56.3 | 56.8 | 57.9% / 46.0% |
| $170M | 49 · 40 · 58.3 | 49.1 | 75.1% / 58.5% |
| $250M | 40.8 · 36 · 54.2 | 43.7 | 93.0% / 71.5% |

**Pooled over 27 cells: 52.9%, min 36, max 62.** The ration demonstrably works · it holds back 21
points of wallet by the half-clock at $250M · and winning with it is a coin flip.

⚠ **THE RESULT IS REAL AND THE QUESTION IS BIGGER THAN IT.** A bot's draw appetite is a fixed
probability per action, so its natural spending is *already* uniform across the game. A ration can
therefore only ever **reduce** spending, never **redistribute** it. What is measured here is "does a
tighter early ration hurt?" and the answer is no. What is *not* measured, and cannot be by this
harness, is whether a player who deliberately front-loads or deliberately hoards does better · that
requires a policy with a timing preference, and none exists (Rule 120 · an absence needs a control,
and the control here says there was nothing to redistribute).

So the honest three-part answer to "does the wallet add a difficulty axis or remove one":

- it **removes** the card-quantity axis · the basket gap goes to 0.00
- it **does not add** a timing axis for a fixed-appetite player · 52.9%, sign unstable
- it **leaves** the placement axis intact, and the ladder survives on it at ~75%

---

## 3 · The price curve is not linear in points · and it makes the landmark cards the cheapest

`CARD_ECONOMY.md` §3 measured that a card's chance of ever being built collapses with its value. A
price tracking **expected delivered points** rather than face points, normalised so the average card
in the deck costs the base price:

| card | built | expected pts | multiplier | at a $70M base | **face-proportional would be** |
|---|---|---|---|---|---|
| 2 pt | 93.0% | 1.86 | ×1.198 | $84M | $41M |
| 3 pt | 73.1% | 2.19 | **×1.414** | **$99M** | $62M |
| 4 pt | 29.7% | 1.19 | ×0.767 | $54M | $83M |
| 5 pt | 9.2% | 0.46 | **×0.296** | **$21M** | **$103M** |

**Said plainly, because the brief asked for it plainly: the eight 5-point landmark cards become the
cheapest things in the deck.** $21M against a $99M three-pointer · **21% of the price of the deck's
workhorse**, where face-proportional pricing would make them 167% of it. The two philosophies differ  by a
factor of **five on the same card**, in opposite directions.

The share of a wallet spent on cards that are never built:

```
face-proportional (x points)   54.6%      more than half the money buys nothing
flat price                     45.9%
expected-delivery              35.3%
```

Face-proportional pricing is not merely inelegant · it is the only one of the three that concentrates
spending on the cards least likely to be built, and it pushes waste past half the wallet.

**And the design consequence Mahil should rule on rather than discover.** Expected-delivery pricing is
actuarially fair, and a fair price for a lottery ticket is a cheap one. A landmark that costs a fifth
of an ordinary card no longer *reads* as a landmark, whatever its point value says. If the eight
5-point cards are meant to feel like achievements, **the price cannot fix that, because the price is
only reporting the build rate.** The lever is the build rate itself: pattern size, the Diverse City
block, or game length. Flow at 9 tiles drops the 5-point build rate from ~10% to ~5-7%, which is the
same lever pulled the wrong way.

---

## 4 · The hand · T1's tripwire fires, at every price

Council ruled the horizontal hand strip waits, on the reasoning that the 320px layout problem is
downstream of an unbounded hand and the wallet is an unbounded-hand fix arriving anyway. The tripwire:
**if the 90th-percentile hand still exceeds five cards, T1 builds the strip.**

The quantity a UI must render is the **peak** hand · the largest the player ever holds · not the hand
at the end, which is what is left after every completable card has been played out of it. Worst case
is **two players**, who take roughly twice as many turns each against the same shared 12-tile clock.

| price | builder peak P90 (3 blocks) | builder peak MAX | **architect peak P90** | architect MAX |
|---|---|---|---|---|
| $0M | 12 · 11 · 11 | 14 | 12 · 13 · 12 | 16 |
| $55M | 11 · 10 · 11 | 14 | 12 · 12 · 12 | 16 |
| $70M | 10 · 9 · 10 | 12 | 11 · 11 · 11 | 15 |
| $100M | 9 · 9 · 9 | 10 | 10 · 10 · 10 | 12 |
| $170M | 7 · 7 · 7 | 8 | 8 · 8 · 8 | 8 |
| $250M | 7 · 6 · 6 | 7 | 7 · 7 · 7 | 7 |

> **The tripwire fires. At no price in the sweep does the 90th-percentile peak hand reach five.**
>
> At $250M · a price that constrains every player in every game, buys four cards, and is far above
> S63's entire plausible bracket · it is still **6 to 7**. Inside the plausible bracket it is **9 to
> 12**.

Even on the more forgiving reading · the *final* hand rather than the peak · the P90 is 7-8 at $100M
and only reaches 4-5 at $250M.

**The wallet is not an unbounded-hand fix at any price anyone would ship.** T1 should build the strip
and pay its comparison cost. Isabella's dissent · that waiting means a cramped phone persists through
the whole wallet build · is the one the measurement supports.

---

## 5 · Reproducing

```bash
npx vitest run src/store/walletPriceSweep.test.js                     # 8 seeds, ~13s, gates only
SWEEP_SEEDS=25 SWEEP_OFFSET=0 SWEEP_OUT=/tmp/sweep.jsonl \
  npx vitest run src/store/walletPriceSweep.test.js                   # one block, ~40s
```

Five counterweights run first and alone: a high price must refuse draws and a zero price must refuse
none; a refusal must actually shrink the basket rather than tick a counter; spend must be bounded by
the wallet and be a whole number of cards; the two pacing arms must be distinguishable **by the
defining property of a ration** (money held back by the half-clock, not total refusals · the first
version of that assertion compared refusal counts, went red on working code, and is documented in
place); and the peak hand must exceed the final hand.
