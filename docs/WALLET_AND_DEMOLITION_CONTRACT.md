# The wallet contract, and what demolition does to the terminal proof

**T2 · S63 · DESIGN ONLY. Nothing in this document is built.** It exists so that T1 can design a UI
and T3 can design gates against a shape that has been written down, rather than against one each lane
infers separately. This project's own record is that a composition without a posted contract fails:
two lanes hand-rolled the same deadlock fixture and produced the identical bug, T1's cascade
assertion died unposted, and three of four pool members were invisible for a session because the
harness and the repo used different names for them (Rule 115 · a contract spanning two lanes has no
owner).

Measured input: **`docs/CARD_ECONOMY.md`**. Every quantity cited here comes from there.

> **This document is committed rather than left in `.claude/comms/`, on purpose.** comms is gitignored,
> so a contract posted only there is invisible to CI, to the next session, and to anyone who was not
> in this conversation. That is Rule 75 exactly: T1 wrote two rules into comms and they were not rules,
> because a rule is only a rule once it is in a file every terminal reads. A comms note pointing here
> is fine; comms as the only copy is not.

---

## 1 · Where the wallet lives

```js
// gameStore.js · initGame · players.map
{
  seat, userId, username, color,
  hand, bonusTokens, scores, scoredCardIds,
  wallet: STARTING_WALLET,        // <- new · a plain integer number of dollars, per player
}
```

**Per player, not a shared pool** (Mahil's ruling). Not always-present-by-spread like `isBot`: every
player has a wallet in every game, so an absent one is a bug and should read as `undefined` loudly,
not be papered over with `?? STARTING_WALLET` at the read sites. **One default, in `initGame`.**

`STARTING_WALLET` and the price belong in `src/store/gameConfig.js` beside `TURN_TIME_LIMIT` and
`GAME_MODES`, not in the store. That file's own header states the rule: a value identical for every
game has no business being serialized into `game_sessions.state` on every realtime payload.

### ⚠ THE SHAPE GUARD CANNOT SEE THIS FIELD, AND I CHECKED RATHER THAN ASSUMED

`gameStore.js` says twice that adding a per-player key would break `tests/seededState.guard.test.js`.
Measured: **it would not**, and that is the problem. The guard compares only

```js
expect(Object.keys(fixture).sort()).toEqual(Object.keys(fresh).sort())   // TOP LEVEL ONLY
```

so a top-level key reddens it and a per-player key sails through. The fixture's player shape is
currently correct and undrifted (`bonusTokens, color, hand, scoredCardIds, scores, seat, userId,
username`), so nothing is broken today.

The day `wallet` lands, `tests/e2e/fixtures/seededState.json` still has eight keys per player and the
guard is still green, while **the reconnect E2E seeds a live game in which every player's wallet is
`undefined`** · cards are free, or every price comparison is `NaN`, silently, in the one spec whose
whole subject is a client rejoining a real game.

**T3 · this is the ask, and it is two lines:** extend the guard to compare `players[0]` and
`regions[0]` key sets the same way it compares the top level, and regenerate the fixture. Doing it
*before* the wallet lands means the guard goes red on arrival instead of never. It is worth doing on
its own merits regardless of whether the wallet is ever built.

---

## 2 · Is a price a card property or a function of points?

**Neither, at first. It is a function whose body is a constant.**

```js
// gameConfig.js
export const CARD_PRICE = /* the one number, derived from CARD_ECONOMY.md, not invented here */
export const priceOf = (card) => CARD_PRICE          // card is accepted and ignored, deliberately
```

Three reasons, in order of strength:

1. **A price proportional to points is measurably backwards.** `CARD_ECONOMY.md` §3: of every card
   acquired, 93.0% of 2-pointers get built and **9.2% of 5-pointers** do. Expected points delivered
   per card is 1.86 / 2.19 / 1.19 / **0.46**. Charging 2.5× more for the card that delivers a quarter
   as much makes the eight most beautiful cards in the deck irrational to buy.
2. **Per-card prices are game data, and game data is not guessed** (Rule 32). Fifty-six numbers are
   Mahil's to author, or nobody's.
3. **Taking `card` from day one costs nothing and buys the migration.** If per-card pricing ever
   arrives it is a change to one function body; if the call sites take a bare constant instead, it is
   a change to every call site, in three lanes, later.

### The blind-purchase problem, which has to be settled before T1 draws anything

There are two ways to acquire a card and they are not symmetric:

| source | buyer sees | can a per-card price even work? |
|---|---|---|
| **The Offer** (4 face-up) | the actual card | yes · this is a shop |
| **The deck** (blind `shift()`) | nothing | **no** · you cannot quote a price for an unknown object |

So a per-card price makes the deck a lottery ticket at a fixed price and the Offer a market. That is
a genuinely interesting game and it is a *different* game from flat pricing. **Flat pricing makes the
question disappear**, which is the fourth argument for starting there.

---

## 3 · What a purchase returns when the player cannot afford it

**Follow `tryScoreCard`'s precedent exactly**, because the store already has this shape and a second
one would be a second contract (Rule 45):

```js
tryDrawCard(seat, source, cardIndex) -> { ok: false, reason: 'insufficient_funds', cost, balance }
drawCard(seat, source, cardIndex)     // void wrapper, delegates · for callers that do not care
```

`reason` is an enumerated string and **not** a bare boolean, for one measured reason: T1 has to tell
"you are broke" apart from "it is not your turn" apart from "you have no actions left", and a boolean
collapses all three into a silent no-op. This project has now paid for that four times (Rule 80 · a
counter that cannot measure must say so; Rule 114 · `if (found) { act }` with no else makes demand
unmeasurable).

The reasons that must be distinguishable: `not_your_turn`, `no_actions`, `insufficient_funds`,
`no_card` (the deck is empty), `ok`.

### ⚠ VALIDATE BEFORE DEBITING · there is already a live instance of this bug and it costs an action today

```js
// gameStore.js drawCard, as shipped
} else {
  const card = state.deck.shift()          // undefined when the deck is empty
  if (card) player.hand.push(card)         // no else · nothing recorded
}
if (isCurrentSeat) state.actionsRemaining--   // ...spent regardless
```

No bot has ever hit this because `chooseBotAction` guards `deck.length > 0` first · measured across
103,750 acquisitions, **zero** refused draws. A human clicking an empty deck can. Today it costs an
action. **Under a wallet it costs money and delivers nothing**, which is Rule 29 (validate Y fully
before debiting X) in the most literal form this project has produced.

---

## 4 · Serialisation, and the debit that can be lost

**Yes, the wallet must serialize into `game_sessions.state`**, and the brief's reason is the right
one: without it a refresh gives everyone their money back. `hand`, `scores` and `bonusTokens` already
live in `players[]` and round-trip; a plain integer is JSON-safe (Rule 22) and adds nothing
meaningful to the 32KB broadcast ceiling (Rule 21).

**But this is where the wallet stops being a UI feature.** Flow mode sets `SIMULTANEOUS_DRAW: true`,
so two players can draw inside the same window. The channel is snapshot-based: the whole state is
written and the last write wins. Today a lost write costs a *card*, which is a known and documented
hazard (`simultaneousDraw.test.js`, and the reason `draw_card_for_seat` exists at all). **With a
wallet, the same lost write costs a debit** · so a clobbered draw is a card that was received and
never paid for, or money spent for a card that vanished.

The infrastructure already exists and it must be used rather than re-invented:

- `draw_card_for_seat` (migrations 011 → 014 → 021) already does the draw inside a `FOR UPDATE`
  transaction and already writes an audit row carrying seat/source/card/post-draw counts.
- migration 022's `state_version` write-order predicate already refuses an out-of-order snapshot.

**The debit belongs inside that RPC's existing transaction, not in the client reducer.** That is a T2
migration (the next number after 029) and it is the single largest engineering item the wallet
implies. It is not optional in Flow and it is not needed at all in Classic, which is turn-locked ·
so if the wallet ships Classic-first, this can be sequenced rather than solved up front, and that is
probably the right order.

---

## 5 · The terminal proof, which is the part only this lane can see

The current dead-position proof (`gameStore.js:180-188`) is a closed argument, not a heuristic, and
that is precisely why it breaks cleanly:

> · drawing needs deck or offer · both empty, and nothing refills them
> · placing needs a stocked factory with a legal hex in a region it borders
> · a factory can ONLY be restocked by `refillFactoryDraft`, which only runs on a placement
> **So with no draw and no placement, no future state differs from this one.**

### With a wallet · one new exhaustion, and it is monotone

Drawing now needs deck-or-offer **and money**. Money only ever decreases, so "no money" is permanent
and the proof stays closed:

```
DEAD  ⇔  (no card available OR no money)  AND  no legal placement
```

`maybeForceDeadlockEndgame` currently returns early on `deck.length > 0 || theOffer.length > 0`.
**That early return becomes wrong the moment cards cost money**: a player with 40 cards in the deck
and an empty wallet is exactly as stuck as one with an empty deck, and the function would decline to
notice. This is a one-line change and it is the whole wallet-side terminal fix.

### With demolition · the monotonicity dies, and that is the real cost

Demolition refunds money, so money is no longer monotone, and if it also returns elements there is a
**second restock path** that does not run through a placement · which is the exact clause the proof
leans on.

```
DEAD  ⇔  no legal placement  AND  no affordable draw  AND  nothing worth demolishing
```

"Nothing worth demolishing" is a far harder predicate than the other two, because it is not "nothing
demolishable" but "no demolition that changes the position". **This is the soft-lock class that took
four fixes across three lanes to close** (Rule 103 · T1's End Turn unlock, T2's terminal condition,
T3's restore refusal, T2's bot-latch fix), and it would become reachable three ways instead of one.

**Stated now, not built now**, so that T1's End Turn unlock and T3's composition gate are designed
against a condition that exists rather than one they infer from the current source.

---

## 6 · Demolition · four questions, reasoned

### 6a · The recovery fraction

**It must be strictly less than 1, and the argument is not aesthetic.**

The brief's reasoning is that 100% makes demolition free so no decision matters, and 0% means nobody
ever does it. Both true. The stronger argument is that **r = 1.0 breaks termination outright**:
demolish → refund the full price → rebuy → demolish is a closed loop that consumes no production
tile, so the clock never advances and the game provably never ends. With r < 1 the same loop is
bounded, and the bound is arithmetic rather than hoped for:

```
max demolish-rebuy cycles  =  wallet / ((1 - r) x price)
      at r = 0.8, price $60M, wallet $1B   ->   83 cycles      (bounded, and slow)
      at r = 1.0                           ->   unbounded      (a perpetual motion machine)
```

So r is not a taste parameter with a safety margin at the top. **1.0 is a correctness boundary.** A
useful consequence: the cost of a demolition is `(1 - r) x price`, which is the number to reason
about, and at r = 0.8 that is one fifth of a card · cheap enough to use, expensive enough to count.

### 6b · Do the elements return? · **the one that rewrites the proof, and it has a cheap answer**

**Measured first, because the obvious mental model of this game is wrong: scoring does not consume
elements.** After `tryScoreCard` the hexes read

```
{"0,0":{"element":"energy","placedBy":0},"1,0":{"element":"energy","placedBy":0}}
```

There is no consumption marker anywhere in a hex, so `findBuildableCards` structurally *cannot*
exclude a used hex. Elements are permanent, reusable board furniture; a district is built *on* them,
not *out of* them.

That collapses the question. The three options are not equal:

| option | consequence |
|---|---|
| elements return to the **factory** | A second restock path. Kills the terminal proof's third clause, and lets players place without ever emptying a factory · so the tile clock can be starved indefinitely. **Worst option by a distance.** |
| elements return to a **reserve** | Same problem if the reserve can restock a factory; harmless and pointless if it cannot. |
| **elements stay on the board** | Costs nothing. The proof keeps its third clause verbatim, `placedBy` stays write-once, contiguity is untouched, and cluster scoring does not move. |

**Recommendation: the elements stay.** It is also the reading that matches what Mahil actually said ·
*"like you're paying for the labour and materials"* is a claim about recovering their **value in
money**, not about recovering the tokens.

Two consequences worth knowing before choosing it:

- **`placedBy` is documented as write-once by construction** (`gameStore.js:366`: *"a hex is placed
  once and never cleared · placement requires an EMPTY hex, checked above"*). Any option that clears
  a hex makes an S35 invariant conditional, and the cluster-ownership rule that made placement matter
  at all rests on it. Elements-stay keeps the invariant literally true.
- **Elements-stay makes demolition a pure points-for-money trade**, which is thin unless money still
  buys something. From `CARD_ECONOMY.md` §1: at two players the deck ends with **7 to 24 cards left**,
  so there is always something to buy; **at four players the deck empties in 58% to 98% of games**, so
  late-game money is worthless and demolition would be a dead button in exactly the games with the
  most players. That is a measured bound on the mechanic's value, and it is the argument for demolition
  refunding something more useful than cash · or for shipping it Classic/2p first.

### 6c · One action or a whole turn?

Mahil said a turn, and a turn is the right weight. **Express it as the existing action budget rather
than as a new concept**: require `actionsRemaining === 3` and set it to `0`. That makes "a whole turn"
exact, needs no new state, cannot be half-spent, and naturally forbids demolishing after you have
already done something.

One measured caveat, and it is the same structural issue the price has: a turn is **not** a
constant-sized cost. `turnNumber` increments once per **seat** turn (`endTurn` advances it and
`currentSeat` together), so the measured 28.6 and 31.5 turns are 14.3 each at two players and 7.9
each at four: one turn is **7.0% of your game at two players and 12.7% at four**. Every cost in
NeoTopia denominated in turns or actions is about 1.8×
more expensive at four players, because the 12-tile clock is shared and does not scale with seats.
That is the same finding as `CARD_ECONOMY.md` §2 arriving by a different road, and it means seat count
is a scaling parameter for the *whole* design and not just for the price.

### 6d · The interactions nobody had named

**Diverse City.** `region.lastBuiltIllustration` holds only the *last* illustration built there, with
no history. So demolishing the last-built card **cannot** revert it without new state.

- *Do not revert* (recommended): needs nothing, and refusing to revert closes an exploit rather than
  creating one. If demolition did reset the block, a player could buy their way out of the diversity
  rule for `(1 - r) x price` plus a turn, which converts a design constraint into a purchase.
- *Revert properly* would require `region.builtIllustrations: []`, i.e. a new per-region array, which
  is a shape change with the same fixture problem as §1.

**Cluster scoring.** Under elements-stay, demolition does not touch clusters at all · which is a
feature, because the alternative is severe: clusters are scored per element **of your colour**
(Rule 73 / S35), so removing your own tokens would shrink your own biggest connected group and cost
you points you would not see coming. Demolition would then be a scoring move wearing an economic
costume, and its true price would be invisible in the UI at the moment of decision.

**The one that is unavoidable in every variant · region scores stop being monotone.** Un-scoring a
card must subtract `card.points`, and two live instruments assume scores only ever rise:

1. `fourPlayerBalance.test.js#crossingsFor` derives token **demand** from final scores, and states the
   assumption in terms: *"region scores only ever increase, so a final score of S means precisely the
   thresholds <= S were crossed"*. After demolition that derivation silently **under-counts**, with no
   error and no red test · the exact shape of Rule 114, in the instrument built to fix Rule 114.
2. The bonus granter fires on `prevScore < t && now >= t`. Falling scores let a threshold be crossed
   twice; the `claimed` flag happens to save it (the token cannot be re-taken), so this one is safe
   **by accident** rather than by design, and should be made deliberate before it is relied on.

`sacredMilestone` has the same shape on the running total and the same accidental protection.

---

## 7 · The sequencing this implies

Not a plan, an ordering that falls out of the above:

1. **T3 · fix the shape guard to compare the player and region key sets.** Two lines, worth doing
   whether or not any of this is built, and it is the difference between the wallet reddening a gate
   on arrival and seeding `undefined` into a live reconnect forever.
2. **Classic first.** The atomic-debit RPC (§4) is required only by Flow's simultaneous draw. Shipping
   Classic first turns the largest engineering item into a later, separately-testable one.
3. **The price is a re-calibration, not a constant.** `docs/CARD_ECONOMY.md` §7: the difficulty ladder's
   only real axis is draw bias, and a price on cards prices that axis directly. The ladder must be
   re-measured after pricing, and it is cheaper to accept that once than to tune a price against a
   ladder that the price itself invalidates.
4. **Demolition last.** It is the only item here that breaks a closed proof, and §6b shows its value
   is bounded by leftover deck · which is the thing the wallet changes most.

---

## ✅ WHAT LANDED · T2 S66 (`b9feec8`) · the engine half

Design above is unchanged; this records which parts are now code and which are still design.

| contract § | state |
|---|---|
| §1 store shape · `player.wallet`, one default in `initGame` | **BUILT** · always present, never spread-conditionally |
| §1 the shape guard cannot see a per-player field | **FIXED IN S64**, and it reddened on arrival exactly as intended |
| §2 price is a FUNCTION whose body is a constant | **BUILT** · `priceOf(card)` in `gameConfig.js`, flat $70M |
| §3 a refusal returns a REASON, not a boolean | **BUILT** · `tryDrawCard` → `ok / not_your_turn / no_actions / no_card / insufficient_funds / no_seat` |
| §3 validate before debiting · the empty-deck draw | **BUILT** · `no_card` refuses before an action or a dollar is spent |
| §4 serialises into `game_sessions.state` | **BUILT** · plain number, round-trip asserted both empty and spent |
| §4 the atomic debit inside `draw_card_for_seat` | **NOT BUILT** · required only by Flow's simultaneous draw. Classic is turn-locked, so this is correctly sequenced after, and it is the largest remaining engineering item |
| §5 terminal condition accounts for money | **BUILT** · inlined in `maybeForceDeadlockEndgame`, both cases driven |
| §6 demolition | **NOT BUILT, deliberately** · Council put it after T3's guard and T1's readout because it is the part that touches the terminal proof |

**The flag is OFF.** `WALLET_ENABLED = false` in `gameConfig.js`, so every price is 0 and nothing is
refused for money. Flipping it is one line, and §4's note applies before it goes to a real room: a
module constant is identical for every client of one BUILD, so a client on an older bundle would
disagree with its peer about whether cards cost money · a divergence in a replayed reducer (Rule 32).
**It should become per-game state, the shape `mode` already has, before it is ever true in production.**

### The tripwire Council attached, and where the numbers to check it live

If any of the three re-measurements moves outside its stated interval once the wallet is live, stop
before demolition is added:

```
ladder at $70M     architect vs apprentice 79.4% [76.7, 81.8]   docs/WALLET_PRICE_SWEEP.md §1b
                   architect vs builder    60.0% [56.8, 63.1]
                   builder vs apprentice   68.8% [65.7, 71.6]
hand P90 (peak)    9-12 inside the plausible price bracket       docs/WALLET_PRICE_SWEEP.md §4
basket             13.9-19.8 purchases at 2 players              docs/CARD_ECONOMY.md §2
```

⚠ Those were measured with a HARNESS wallet (`playOnce({ wallet })`), which models the constraint
faithfully and adaptation not at all. The engine wallet is the real thing, so a re-measurement is a
genuine second reading rather than a repeat · and the harness should be re-pointed at the store's own
`tryDrawCard` once the flag is live, so there is one purchase rule rather than two (Rule 45).
