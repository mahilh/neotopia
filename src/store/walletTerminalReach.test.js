// CAN THE MONEY-TERMINAL ACTUALLY BE REACHED BY PLAY?  (T2 S67)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// S67 re-pointed the balance harness at the engine's `tryDrawCard`, and the depth re-measurement at
// $70M came back BIT-IDENTICAL to the S65 numbers it was checked against · 79.4 / 60.0 / 68.8, the
// same pooled rates, the same Wilson intervals, the same per-block spreads. That is a stronger
// result than "inside the interval" and it is exactly the kind of result to distrust (Rule 130 · ask
// of a green how many ways it could have been produced).
//
// It has an honest explanation. The two rules were the SAME PREDICATE written twice:
//     harness   spent + price <= budget      <=>   budget - spent >= price   <=>   wallet >= price
//     engine    player.wallet >= priceOf(card)
// and the refusal had the same consequence in both (re-ask the policy with the supply hidden). So an
// identical result is what agreement LOOKS like, and the interesting question is not the rates.
//
// ⚠ THE INTERESTING QUESTION IS THE ONE STRUCTURAL DIFFERENCE, AND IT IS NOT IN THAT PREDICATE.
// `maybeForceDeadlockEndgame` ends a game in which cards exist, NOBODY can afford one, and no
// placement is possible. The old harness could never express it: it ran with the shipped flag OFF,
// so `!WALLET_ENABLED` short-circuited that term to "affordable" in every game ever measured. Now it
// is live. If it fires, it ends games EARLY, which is a real behaviour change that the identical
// win rates would be hiding rather than excluding.
//
// So this file asks the reachability question directly, the way Rule 102's corollary says to: when a
// guard is proven only on a constructed state, measure whether PLAY can reach it before claiming
// what it changed. walletEnabled.test.js already proves the branch works on a hand-built board.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./gameConfig', async (importOriginal) => ({ ...(await importOriginal()), WALLET_ENABLED: true }))

import { playOnce, bots } from './ladderHarness'
import { WALLET_ENABLED, CARD_PRICE } from './gameConfig'

const WALLET = 1_000_000_000
const M = 1_000_000
const budgetFor = (price) => (price === 0 ? Infinity : CARD_PRICE * (WALLET / price))

/**
 * A game that ENDED WITH CARDS ON THE TABLE THAT NOBODY COULD BUY. That is the state in which the
 * money term of the terminal condition is the one deciding anything · with a card affordable, or
 * with no card at all, the pre-existing terms decide and the money term is inert.
 */
const endedUnaffordable = (g) =>
  (g.deckAtEnd + g.offerAtEnd) > 0 && g.seats.every(s => s.walletAtEnd < CARD_PRICE)

describe('the money-terminal · reachable by play, or only by construction?', () => {
  it('the flag is ON here, or nothing below measures the branch at all', () => {
    expect(WALLET_ENABLED, 'the mock did not take effect · every game below runs the FREE engine, ' +
      'the money term is short-circuited, and a zero here would mean nothing').toBe(true)
  })

  // ── THE POSITIVE CONTROL, AND IT IS THE WHOLE TEST ─────────────────────────────────────────────
  // An absence needs a control that exercises the mechanism (Rule 120 / Rule 130b). "No game ended
  // broke" is produced both by a game nobody could bankrupt and by a harness that never applied a
  // price at all, and those are opposite findings. At a punishing price the wallet buys FOUR cards,
  // so exhaustion must be common · if it is not, the instrument is the subject.
  it('a punishing price really does bankrupt seats · the control for the zero below', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => 9000 + i * 31)
    const broke = seeds.filter(seed =>
      playOnce(bots('architect', 'architect'), seed, undefined, { wallet: { budget: budgetFor(250 * M) } })
        .seats.every(s => s.walletAtEnd < CARD_PRICE)).length
    expect(broke, 'not one seat in 20 games ran out of money at a 4-card budget · the price is not ' +
      'being applied and every reachability figure in this file is measuring the free game')
      .toBeGreaterThan(10)
  })

  // ── THE MEASUREMENT ────────────────────────────────────────────────────────────────────────────
  // ⚠ MY FIRST ASSERTION HERE MEASURED A PROXY AND WENT RED ON CORRECT CODE, which is Rule 96 in the
  // costume it always wears · the quantity that is easy to compute standing in for the one the
  // decision rests on. I asserted that no game ends with cards nobody can afford. It is 58 of 80 at
  // the shipping price, and that is FINE, because it is only the MONEY HALF of the condition.
  // maybeForceDeadlockEndgame also requires that no placement is possible, and a broke player can
  // still place · so the precondition is reached constantly and the composite never fires.
  //
  // MEASURED DIRECTLY rather than inferred, with the money term neutralised in the store and the
  // identical 80 games replayed: 0 of 80 differ in turns, deck, offer, base score, tokens, spend or
  // refusals. The term decides nothing under bot play at $70M. That is also why the S67 depth
  // re-measurement came back BIT-IDENTICAL to S65 across 5,650 games rather than merely close.
  //
  // So the assertion below is on the composite, and in Classic it is exact: the tile stack is the
  // only other route to endGameTriggered, so a game ending with tiles STILL ON IT ended by deadlock.
  // Cards-still-available separates the money route from the pre-existing no-cards-left route.
  it('the money precondition is common, and the composite still never ends a game', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => 9000 + i * 31)
    const rows = []
    for (const price of [70 * M, 250 * M]) {
      let unaffordable = 0, allBroke = 0, endedByMoney = 0
      for (const seed of seeds) {
        for (const swap of [false, true]) {
          const g = playOnce(bots(swap ? 'builder' : 'architect', swap ? 'architect' : 'builder'),
            seed, undefined, { wallet: { budget: budgetFor(price) } })
          if (g.seats.every(s => s.walletAtEnd < CARD_PRICE)) allBroke++
          if (endedUnaffordable(g)) unaffordable++
          // Tiles left on the stack in CLASSIC means the deadlock terminal fired; cards still
          // available means it was the MONEY term rather than the pre-existing empty-supply one.
          if (g.tilesAtEnd > 0 && endedUnaffordable(g)) endedByMoney++
        }
      }
      rows.push({ priceM: price / M, games: seeds.length * 2, allBroke, unaffordable, endedByMoney })
    }
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`TERMINAL $${String(r.priceM).padStart(3)}M  ${r.games} games  both seats broke ` +
        `${r.allBroke}  cards nobody could buy ${r.unaffordable}  ENDED BY MONEY ${r.endedByMoney}`)
    }

    // POSITIVE CONTROL ON THE PRECONDITION, so the zero below is readable. If the money half were
    // never reached either, "the composite never fires" would be true for an uninteresting reason
    // and would say nothing about the terminal term (Rule 120 · an absence needs a control that
    // exercises the mechanism, in the same run).
    const ship = rows.find(r => r.priceM === 70)
    expect(ship.unaffordable, 'not one game reached a board of cards nobody could afford · the ' +
      'money term of the terminal condition has no live inputs here, so the zero below is vacuous')
      .toBeGreaterThan(ship.games / 4)

    for (const r of rows) {
      expect(r.endedByMoney, `${r.endedByMoney} of ${r.games} games at $${r.priceM}M ended with ` +
        'tiles still on the stack AND cards nobody could buy · in Classic that is the deadlock ' +
        'terminal, and cards-available means it was the WALLET term. The old harness ran with the ' +
        'flag off and could not express this branch at all, so if it is now deciding games the S65 ' +
        'depth intervals describe a different game than the one the engine plays. Re-derive them ' +
        'before Council reads the tripwire against them.').toBe(0)
    }
  }, 300_000)
})
