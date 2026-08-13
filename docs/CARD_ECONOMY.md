# The card economy · what a player buys, before anybody prices anything

**T2 · S63 measurement · input to a pricing decision, not a proposal.**
Nothing here has been acted on. No price is recommended, because Mahil ruled that prices are derived
and not invented, and a derivation needs the denominator first.

Harness `src/store/cardEconomics.test.js` · engine `src/store/ladderHarness.js#playOnce` · the real
`src/store/gameStore`, no network, deterministic seeded shuffles.
**Three disjoint 60-seed blocks** (`ECON_OFFSET` 0 / 500 / 1000), 13 cells, 103,750 acquired cards.
Every figure below is the mean of three blocks; where a shape is claimed, all three blocks are shown.

---

## 0 · The one limit that governs every number here

This measures the basket players take **when cards are free**. Under a wallet they will take a
different one · that is the entire point of charging for them · so nothing here predicts behaviour,
and no line should be read as though it does.

It is decisive for exactly one question, which happens to be the first one a price has to answer:
**at which price does the wallet first bind?** Below the cheapest observed basket the wallet
constrains nobody and is decoration; above the dearest it constrains everybody at every skill level
in every game. Those two numbers bracket every sane price and they are facts about the game that
exists rather than opinions about the next one.

The counterweight to that limit, because a stated limit gets believed harder than a finding: one
result here is **not** behavioural and does not decay under a wallet at all. The completion rate by
card value (§3) is a property of the *patterns*, and it is measured to be indifferent to policy
across the entire difficulty ladder. It will still be true after every other number in this file has
been invalidated.

---

## 1 · The basket

`acquired` = dealt + drawn. `purchased` = acquired - 3, since every player is dealt three cards at
setup and only the rest could ever be bought. `held` = still in hand when the game ended, i.e. paid
for and never built.

| cell | acquired | purchased | scored | held | acq:scored | p10-p90 | deck left | deck emptied | never binds | binds 50% | always binds |
|---|---|---|---|---|---|---|---|---|---|---|---|
| classic 2p apprentice | 16.90 | 13.90 | 10.25 | 6.65 | 1.65 | 12-22 | 18.2 | 2% | $36M | $60M | $107M |
| classic 2p builder | 17.56 | 14.56 | 9.88 | 7.68 | 1.78 | 13-22 | 16.9 | 1% | $36M | $57M | $101M |
| classic 2p architect | 22.76 | 19.76 | 12.08 | 10.67 | 1.88 | 18-28 | 7.0 | 27% | $32M | $44M | $85M |
| classic 4p apprentice | 12.06 | 9.06 | 7.17 | 4.89 | 1.68 | 9-15 | 4.4 | 61% | $51M | $83M | $189M |
| classic 4p builder | 12.34 | 9.34 | 6.83 | 5.51 | 1.81 | 9-15 | 4.0 | 58% | $53M | $81M | $151M |
| classic 4p architect | 13.68 | 10.68 | 7.34 | 6.34 | 1.86 | 11-16 | 0.2 | **98%** | $49M | $71M | $131M |
| flow 2p apprentice | 13.87 | 10.87 | 6.90 | 6.97 | 2.01 | 10-18 | 24.3 | 0% | $40M | $75M | $151M |
| flow 2p builder | 14.68 | 11.68 | 7.44 | 7.24 | 1.98 | 10-19 | 22.7 | 0% | $42M | $68M | $137M |
| flow 2p architect | 18.93 | 15.93 | 9.01 | 9.92 | 2.10 | 14-24 | 14.3 | 4% | $34M | $53M | $106M |
| flow 4p apprentice | 10.63 | 7.63 | 5.23 | 5.41 | 2.03 | 8-13 | 9.5 | 24% | $57M | $97M | $200M |
| flow 4p builder | 11.03 | 8.03 | 5.45 | 5.57 | 2.02 | 8-14 | 8.3 | 22% | $57M | $91M | $198M |
| flow 4p architect | 12.67 | 9.67 | 6.02 | 6.65 | 2.10 | 10-16 | 2.2 | 81% | $52M | $79M | $145M |

The distribution, not the mean, since that is what a price actually meets. Classic 2p builder,
block 0, one row per player-game:

```
acquired   9:1  10:2  11:4  12:3  13:9  14:8  15:8  16:8  17:24  18:15  19:10  20:7  21:8  22:3  23:4  24:2  25:1  27:3
           p10 13   p50 17   p90 22   min 9   max 27
```

A basket is not a point. At one skill level, in one mode, at one seat count, the fattest game buys
**3.0× what the thinnest does** (27 against 9) and the p10-to-p90 range is still 1.7× (13 to 22) ·
and a single price meets all of it. Any price argued from a mean is an argument about a player who
does not exist.

---

## 2 · The answer to the $1B / $100M hypothesis · half right, and the half that is wrong is structural

> *"if a player scores ~8 cards averaging 3.5 points, prices near $100M make the wallet tight but not
> crippling"*

**Scores ~8 cards** is right for four players (6.8-7.3) and wrong for two (9.9-12.1).
**Averaging 3.5 points** is wrong in the safe direction: the mean *scored* card is **2.77-2.93**
points, never 3.5, because players build cheap cards and hoard expensive ones (§3).
And the wallet does not pay for scored cards. It pays for **acquired** ones, which is 1.65-2.10× more.

At a uniform **$100M**, a $1B wallet buys **10 cards**:

| | purchased today | $100M buys | verdict |
|---|---|---|---|
| classic 4p | 9.06 - 10.68 | 10 | **almost exactly right** |
| flow 4p | 7.63 - 9.67 | 10 | slightly loose · binds rarely |
| flow 2p | 10.87 - 15.93 | 10 | 8% - 37% short |
| classic 2p | 13.90 - 19.76 | 10 | **28% - 49% short** |

So $100M is not one price that is tight everywhere. It is *the four-player price*, and at two
players it removes between a quarter and a half of the basket.

**The mechanism is not a balance accident and it will not go away.** The production-tile clock is
shared: a game is 12 tiles whether two people or four are playing, so two players take roughly twice
as many turns each and therefore buy roughly twice as many cards each. Any per-player wallet with a
flat per-card price makes the *card budget* constant while the *number of turns to spend it in*
varies 2× with seat count.

> **The pricing decision is therefore not "what is the number". It is "what does the number scale
> with".** Wallet ∝ 1/seats, or price ∝ seats, or a per-turn allowance rather than a lump sum · those
> are three different games, and picking none of them means picking the first by default.

---

## 3 · The finding that outlives the wallet · a card's chance of being built collapses with its value

Of every card *acquired* at each point value, the percentage ever built. Pooled across all 13 cells
and all three blocks:

| card | supply in deck | % of acquired ever built | expected points delivered per card |
|---|---|---|---|
| **2 pt** | 12 | **93.0%** | 1.86 |
| **3 pt** | 18 | **73.1%** | **2.19** |
| **4 pt** | 18 | **29.7%** | 1.19 |
| **5 pt** | 8 | **9.2%** | 0.46 |
| | | *n = 22,591 / 32,415 / 33,636 / 15,108* | |

Monotone in **all 13 cells**, no exceptions. The consequences:

- **The 3-point card is the best object in the deck**, and the 5-point card delivers less than a
  quarter of its expected value. A 5-point card needs five elements in one rotated pattern, in one
  region, with the completing element placed last, and past a Diverse City block. It is not five
  times a 2-point card; it is a lottery ticket.
- **A price proportional to points is exactly backwards.** It would charge 2.5× more for the card
  that delivers 0.25× the points. Under points-proportional pricing a rational player never buys a
  5-point card, and the eight most beautiful cards in the deck become economically irrational to own.
- **A flat price is also not neutral**, it just distorts less: expected value per card runs
  1.86 / 2.19 / 1.19 / 0.46, so even flat pricing makes 4s and 5s bad buys. If those cards are to be
  worth owning it has to come from a rule, not from the price.

> ### §3b · WHAT WOULD MOVE THE 9.2%, ASKED BY MAHIL AFTER RULING FLAT PRICING (T2 S65)
>
> The ruling is that price cannot fix a build-rate problem, only report it · so if a 5-point card is
> meant to feel like an achievement, the lever is the rate itself. Measured from the same three
> blocks, no new run required:
>
> | | production tiles | element supply | turns per player | **5pt built** |
> |---|---|---|---|---|
> | Classic | 12 | 60 | 11.6 | **10.6%** |
> | Flow | 9 | 48 | 9.3 | **6.4%** |
>
> **The lever is ELEMENT SUPPLY, and it is not time.** 1.25× the elements gives 1.65× the build rate.
> The controlled comparison is inside the table and it is the decisive one: `classic 4p` gives each
> player **7.9** turns and builds 8.8% of its 5-pointers, while `flow 2p` gives each player **11.4**
> turns and builds **7.2%**. More time, fewer landmarks. Offline the only thing separating the two
> modes is the tile count (Flow's other difference, simultaneous draw, is not exercised by this
> harness), so this is a clean two-point dose-response on supply.
>
> The mechanism is why it is superlinear rather than proportional: completing a 5-cell pattern is a
> combinatorial function of how densely the board is populated, so each additional element raises the
> chance of finishing a large pattern faster than it raises the chance of finishing a small one. That
> is also why the effect is invisible on 2-point cards, which sit at 93% in both modes.
>
> **So: add production tiles.** Each tile is four more elements. A 13th and 14th tile would raise the
> whole board's density, and the cards it would help most are exactly the eight that currently
> almost never get built.
>
> ⚠ **Two points cannot establish a curve.** "Larger than proportional" is supported; the shape is
> not, and a third tile count would settle it. That measurement does not exist because the tile count
> is fixed per mode in `gameConfig.js` rather than being a parameter · which is itself the cheapest
> next step if this becomes a live question (Rule 111 · a constant at every call site is a hidden
> parameter).

**This is a property of the patterns, not of the players.** The three difficulty rungs span a policy
range that has historically produced a 94-point win-rate spread, and the 5-point completion rate
across all of them in Classic is 11.2% / 10.0% / 10.9% · flat. What *does* move it is game length:
Flow, at 9 tiles instead of 12, drops it to 5.0% / 7.2% / 7.2%. Shorter game, fewer 5-point cards
ever finished.

The mirror image, from the same counts: what sits unbuilt at the end is 75-85% 4s and 5s, against
46.4% of the deck. **Players score their cheap cards and die holding their expensive ones**, in every
cell, at every skill level, in both modes.

---

## 4 · What the wallet would actually be taxing

**Scoring is free.** `actionsRemaining--` exists in `placeElement` and in `drawCard` and nowhere
else, so the action budget is spent on exactly two things and the draw share has a two-term
denominator. This is not a reading of the code, it is a measurement: actions go 1 → 1 across a
successful `tryScoreCard`, and separately the arithmetic refused the alternative before any code was
opened (a three-term budget makes 102.6 actions taken against 85.8 granted, which is impossible).

> ⚠ **I had it wrong in the first draft of this document and my own counterweight caught it.** The
> comment at `gameStore.js:402` described `actionsRemaining` as a *"place/draw/score counter"*, I took
> the third term from it, and every draw share below was understated by about seven points. A comment
> that is wrong goes red never (Rule 105a); the assertion that computed the constraint went red
> immediately (Rule 81). The comment is corrected in the same commit as this file.

| cell | draws | placements | **draw share of the real budget** |
|---|---|---|---|
| classic 2p apprentice | 13.9 | 27.5 | 33.2% |
| classic 2p builder | 14.6 | 26.8 | 34.9% |
| classic 2p architect | 19.8 | 27.3 | **41.7%** |
| classic 4p apprentice | 9.1 | 13.8 | 39.3% |
| classic 4p builder | 9.3 | 13.4 | 40.8% |
| classic 4p architect | 10.7 | 13.6 | 43.9% |
| flow 2p architect | 15.9 | 21.8 | 41.7% |
| flow 4p architect | 9.7 | 10.9 | **46.7%** |

**A third to a half of every action taken in NeoTopia is a card purchase**, and the share rises
monotonically with skill in all four mode/seat combinations · 33.2% → 34.9% → 41.7% in 2p Classic,
with the same ordering in the other three. The wallet is not taxing a corner of the game.

**This is the wallet's real significance, and it is larger than pricing.**
`docs/ACTION_ECONOMY_FINDING.md` has been open since S33 and its finding is:

> *"spending an action on a card strictly dominates spending it on a hex... The board is where the
> game looks like it is being played. The hand is where it is actually being decided."*

That document went looking for a counterweight, considered the cluster rule, and measured that the
cluster rule was not carrying it. **A price on cards is the first mechanism in this project's history
that puts a cost on the dominant strategy.** Whether or not it was chosen for that reason, the price
is now the exchange rate between the two actions that document is about · set it too low and drawing
still dominates and nothing has changed; set it too high and placement dominates and the hand stops
mattering. There is a correct answer in there and it is a design target, not a taste.

Corroboration that the instrument measures what it names, which is worth more than a passing test:
`POLICIES` sets drawBias to 0.30 / 0.30 / 0.39 for apprentice / builder / architect. The measured
baskets came back 16.90 / 17.56 / 22.76 · the two equal-bias rungs equal, and the third larger by a
ratio of **1.32** against the **1.30** its policy predicts. The harness reproduces the parameter table
it was never shown.

---

## 5 · Contested supply · the strong player is *not* running away with the deck

`architect` and `apprentice` at one table, rotated so neither keeps a seat, three blocks:

| | acquired | scored | held | points acquired |
|---|---|---|---|---|
| architect | 21.71 / 20.86 / 21.85 | 13.72 / 12.62 / 13.78 | 7.98 / 8.24 / 8.07 | 73.9 / 71.6 / 73.9 |
| apprentice | 17.48 / 17.07 / 17.03 | 10.88 / 10.75 / 10.76 | 6.60 / 6.32 / 6.28 | 59.2 / 58.0 / 57.5 |

**Ratio 1.25×.** For comparison, the ladder's spread in *token earning* is 23× (S47). A correction to
the reasoning behind an existing ruling, recorded because the reasons for a decision deserve the same
audit as the reasons against one:

> The $1B-per-player ruling cites the 23× runaway I measured. That figure is about **token earning**,
> not **card buying**. The card basket spreads only **1.25×-1.41×** across the whole ladder, so a
> shared pool would have run away an order of magnitude less than the number that motivated the
> ruling. **The ruling still stands** · symmetric wallets have *zero* runaway by construction, which
> beats a small one · but it should stand on that, not on a number imported from a different subsystem.

---

## 6 · Two silent no-ops a wallet turns into a refund bug

Measured across all 103,750 acquisitions: **0 refused draws, 0 refused scores.** The accounting
closes exactly, which is why every figure above can be trusted. But it closes because *bots* guard
themselves, not because the *engine* does:

```js
// gameStore.js drawCard
} else {
  const card = state.deck.shift()      // undefined when the deck is empty
  if (card) player.hand.push(card)     // no else · nothing is recorded
}
if (isCurrentSeat) state.actionsRemaining--   // ...and the action is spent regardless
```

`chooseBotAction` checks `deck.length > 0` before asking, so no bot has ever hit this. A human
clicking the deck can. Today it costs an action; **under a wallet it would cost money and deliver
nothing.** Rule 29 of this project is "validate Y fully BEFORE debiting X", and this is the exact
shape it names. Same for `tryScoreCard`, which returns false and consumes nothing today.

---

## 7 · The bill · which existing measurements survive a wallet

This is the last measurement of the free-draw game. Every number this project holds was taken in a
world where a draw costs one action and nothing else. Itemised, so the cost of the decision is
visible rather than discovered later:

| measurement | survives? | why |
|---|---|---|
| **Difficulty ladder** (S49/S50 · 60.0 / 66.7 / 84.8, spacing, calibration) | ❌ **DEAD** | The ladder's only real axis is drawBias. A wallet prices drawBias directly, and architect's 30% larger basket becomes its 30% larger bill. The rungs must be re-calibrated and may need re-designing: under a wallet "difficulty" becomes partly a budgeting skill. **The single biggest item.** |
| **Bonus token balance** (S39 -2.4/-3.0/-0.8 · S46 spendable +7.7) | ❌ **DEAD** | Tokens are earned by crossing score thresholds; thresholds are crossed by scoring; scoring is fed by cards. Every magnitude moves. Worse, `Government Subsidy` **draws 2 cards** · under a wallet that token stops being 3 points and becomes a cash grant of 2× the card price, which is a different mechanic wearing the same name. |
| **Four-player contention** (S51 · 36% / 51% contested crossings) | ❌ re-run | Same chain. Also §1 shows the 4p deck already empties in 58-98% of games, so the wallet is a *second* scarcity stacked on an existing one. |
| **Pile depth three-arm** (S53 · 32.5% → 24.3% → 11.4%) | ❌ re-run | Same chain. |
| **Spendable supply curve** (S54) | ❌ re-run | Same chain. |
| **Flow-mode balance** (S50) | ❌ re-run, **and it will move most** | Flow's acquired:scored ratio is 2.01-2.10 against Classic's 1.65-1.88, so Flow players buy proportionally more speculation and a price hits them harder for the same money. |
| **Cluster ownership** (S35 · greedy 46.7 → 64.3 under per-player scoring) | ⚠️ **survives in kind** | It is a claim about a *scoring rule* · that a per-player cluster term can decide a game and a shared one cannot (Rule 73). That stays true. The magnitude changes, because a player who cannot afford a draw places instead and placement volume rises. |
| **Adversarial fuzz · termination** (S45/S46) | ⚠️ assertion survives, **proof is void** | Games must still terminate, but the dead-position condition gains a fourth exhaustion (no money) and demolition would add a second restock path. See `docs/WALLET_AND_DEMOLITION_CONTRACT.md` §3. |
| **Completion rate by card value** (§3, this file) | ✅ **survives** | A property of the patterns, measured indifferent to policy across the whole ladder. |
| **Deck conservation, action split** (§1, §4) | ✅ survives as a *baseline* | These become the before-picture of the wallet's effect, which is the one thing that cannot be re-measured later. |

**Read that column honestly: a wallet invalidates most of the quantitative work of sessions 39-54.**
That is not an argument against building it. It is the bill, and Mahil said there is no rush, which
is the condition under which paying it is reasonable. What it does argue is that the wallet should
land *before* any further balance measurement is commissioned, because everything measured between
now and then is measured on a game that is about to stop existing.

---

## 8 · Reproducing

```bash
npx vitest run src/store/cardEconomics.test.js                       # 10 seeds, ~6s, gates only
ECON_SEEDS=60 ECON_OFFSET=0 ECON_OUT=/tmp/econ.jsonl \
  npx vitest run src/store/cardEconomics.test.js                     # one 60-seed block, ~30s
```

Six counterweights run first and alone: per-seat conservation, whole-deck conservation to all 56
cards, non-vacuity of draws and scores, point-lookup resolution, `flow ≠ classic` on one seed (Rule
111 · the mode argument was silently dropped by every balance harness in this repo for eleven
sessions), and all four seats acting in a four-player game.
