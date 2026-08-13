// THE PRICE SWEEP · deriving the number, and falsifying my own prediction about it (T2 S64)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// S63 bracketed the price and did not derive it: below ~$32M the wallet constrains nobody, above
// ~$200M it constrains everybody. This runs the wallet and measures what happens in between.
//
// THE MODEL, AND ITS LIMIT, FIRST. The engine has no wallet. `playOnce({ wallet })` refuses to ISSUE
// a draw the seat cannot afford and re-asks the policy with the deck and offer hidden, which is a
// state chooseBotAction already handles. So the CONSTRAINT is faithful and the ADAPTATION is not: a
// real player who knows cards cost money buys different cards at different moments. Bot draw bias is
// a fixed constant. That is exactly why there are two pacing arms · they are the only adaptation
// this harness can express, and the gap between them is the upper bound on what budgeting is worth.
//
// ══ PREDICTIONS, WRITTEN BEFORE THE FIRST RUN ════════════════════════════════════════════════════
// Recorded because a prediction made after seeing the number is not one, and because S63's closing
// recommendation was a prediction I asked to have tested.
//
//   P1 · NAIVE BEATS PACED.  A card bought early has more turns left in which to be completed, and
//        S63 measured completion as time-limited: 5-point cards finish 9.2% of the time in Classic
//        and 5.0-7.2% in Flow, which is the same deck in a game 3 tiles shorter. Front-loading
//        should therefore dominate, and "budgeting" should be worth nothing or less.
//        FALSIFIED IF paced wins at any price by more than the control's own spread.
//   P2 · THE LADDER COMPRESSES AS PRICE RISES.  This is my S63 closing claim and the thing to kill:
//        architect's edge IS draw bias (0.39 against 0.30), so a flat cap truncates the bigger
//        appetite harder · 19.8 draws against 13.9 at a 10-card cap. FALSIFIED IF the architect vs
//        apprentice gap holds or widens across the sweep.
//   P3 · BASKETS CONVERGE.  At a high enough price every rung buys the same number of cards, because
//        the cap and not the policy is deciding. FALSIFIED IF the spread between rungs is flat.
//   P4 · THE GAME GETS SHORTER.  A player who cannot draw places instead; placements consume
//        production tiles; the tile stack is the clock. So a price should drain the clock faster.
//        FALSIFIED IF turns rise or stay level as price rises.
//
// P2 is the one that matters. If it holds, a flat $1B is a handicap system and the price must scale
// with something · which is S63's own sentence, "the decision is not what the number is, it is what
// the number scales with".

import { describe, it, expect } from 'vitest'
import { playOnce, bots, makeReporter } from './ladderHarness'

const SEEDS = Number(process.env.SWEEP_SEEDS || 8)
const OFFSET = Number(process.env.SWEEP_OFFSET || 0)
const seeds = Array.from({ length: SEEDS }, (_, i) => 6200 + OFFSET + i * 23)
const report = makeReporter('SWEEP_OUT')

const WALLET = 1_000_000_000
const M = 1_000_000
// The sweep runs from below S63's "constrains nobody" figure to above its "constrains everybody"
// one, so both ends of the bracket are inside the measured range rather than assumed.
const PRICES = [0, 25 * M, 40 * M, 55 * M, 70 * M, 85 * M, 100 * M, 130 * M, 170 * M, 250 * M]

const sum = a => a.reduce((n, x) => n + x, 0)
const mean = a => (a.length ? sum(a) / a.length : 0)
const round = (x, n = 2) => +x.toFixed(n)
const pctile = (a, p) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
/** price 0 means NO wallet at all · the unpriced control, not a wallet with a free price. */
const walletFor = (price, pacing) => (price === 0 ? null : { price, budget: WALLET, pacing })

/**
 * One matchup at one price, played both ways round on every seed so seat order cancels exactly
 * (the same device ladderRow uses, and an S48 mutation proved it carries).
 */
function duel(levelA, levelB, price, { pacing = 'naive', mode, pacingB = null } = {}) {
  let winsA = 0, winsB = 0, games = 0
  const rows = []
  for (const seed of seeds) {
    for (const swap of [false, true]) {
      const aSeat = swap ? 1 : 0, bSeat = 1 - aSeat
      const configs = bots(swap ? levelB : levelA, swap ? levelA : levelB)
      // Per-seat pacing, so an arm can be measured HEAD TO HEAD rather than only between blocks ·
      // two policies in one game share the deck, the seeds and the board exactly.
      const g = playOnce(configs, seed, mode, {
        wallet: walletFor(price, pacing),
        walletBySeat: pacingB ? { [bSeat]: walletFor(price, pacingB) } : null,
      })
      games++
      const A = g.seats[aSeat], B = g.seats[bSeat]
      const scoreA = A.base + 3 * A.earned, scoreB = B.base + 3 * B.earned
      if (scoreA > scoreB) winsA++; else if (scoreB > scoreA) winsB++
      // Tagged by ARM (the logical side) and not by difficulty name · in a self-play pacing duel both
      // seats carry the same level, so keying on the level would collapse the two arms into one row
      // and report the paced side as `null`. Arm is what varies; level is what happens to be equal.
      for (const [arm, s] of [['A', A], ['B', B]]) {
        rows.push({ arm, acquired: s.scoredPoints.length + s.handAtEnd, scored: s.scoredPoints.length,
          held: s.handAtEnd, peak: s.handPeak, spent: s.spent, spentAtHalf: s.spentAtHalf,
          refused: s.refusedByPrice })
      }
    }
  }
  const of = (arm) => rows.filter(r => r.arm === arm)
  const stat = (rs) => ({
    acquired: round(mean(rs.map(r => r.acquired))), scored: round(mean(rs.map(r => r.scored))),
    peak: round(mean(rs.map(r => r.peak))), peakP90: pctile(rs.map(r => r.peak), 0.9),
    peakMax: Math.max(...rs.map(r => r.peak)),
    heldP90: pctile(rs.map(r => r.held), 0.9),
    refused: round(mean(rs.map(r => r.refused))),
    spentPct: round(100 * mean(rs.map(r => r.spent)) / WALLET, 1),
    spentAtHalfPct: round(100 * mean(rs.map(r => r.spentAtHalf)) / WALLET, 1),
  })
  return {
    games, winPctA: winsA + winsB ? round(100 * winsA / (winsA + winsB), 1) : 50,
    a: stat(of('A')), b: stat(of('B')),
    all: stat(rows),
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST AND ALONE (Rule 90)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('price sweep · the wallet is real before any of it is read', () => {
  // 1 · THE DEFINING PROPERTY OF THE ARM. A wallet that does not actually stop anybody produces a
  //     complete, self-consistent sweep in which every price behaves like price 0 · and the finding
  //     would be "price does not matter", which is the most publishable wrong answer available.
  it('a high price REFUSES draws, and a zero price refuses none', () => {
    const free = playOnce(bots('builder', 'builder'), 6200)
    const dear = playOnce(bots('builder', 'builder'), 6200, undefined, { wallet: { price: 250 * M, budget: WALLET } })
    expect(sum(free.seats.map(s => s.refusedByPrice)), 'the unpriced control refused a draw · then ' +
      'the control is not a control').toBe(0)
    expect(sum(dear.seats.map(s => s.refusedByPrice)), 'a $250M price refused NOTHING against a $1B ' +
      'wallet, which buys 4 cards · the wallet is not being applied and every row below is price 0')
      .toBeGreaterThan(0)
  })

  // 2 · AND IT MUST CHANGE THE GAME, not merely the bookkeeping. A refusal that still lets the draw
  //     through would tick the counter and leave the basket identical.
  it('a refused draw does not happen · the basket really shrinks', () => {
    const free = playOnce(bots('builder', 'builder'), 6200)
    const dear = playOnce(bots('builder', 'builder'), 6200, undefined, { wallet: { price: 250 * M, budget: WALLET } })
    const cards = g => sum(g.seats.map(s => s.scoredPoints.length + s.handAtEnd))
    expect(cards(dear), `priced game acquired ${cards(dear)} cards against ${cards(free)} free · the ` +
      'refusal is cosmetic and the seat drew anyway').toBeLessThan(cards(free))
  })

  // 3 · SPENDING IS BOUNDED BY THE WALLET. If it is not, "the wallet binds" is not what is being
  //     measured and every price on the curve is really a smaller price.
  it('no seat ever spends more than it has', () => {
    for (const price of [40 * M, 100 * M, 250 * M]) {
      const g = playOnce(bots('architect', 'architect'), 6200, undefined, { wallet: { price, budget: WALLET } })
      for (const s of g.seats) {
        expect(s.spent, `a seat spent ${s.spent} of a ${WALLET} wallet at price ${price}`)
          .toBeLessThanOrEqual(WALLET)
        expect(s.spent % price, 'spend is not a whole number of cards · the debit is not the price')
          .toBe(0)
      }
    }
  })

  // 4 · THE PACED ARM MUST ACTUALLY PACE. `paced` that behaves identically to `naive` would make the
  //     headline comparison a control against itself · two names for one policy, and a null result
  //     that reads as "budgeting is worth nothing" (Rule 130 · how many ways could this be produced).
  it('paced and naive are different policies, measured rather than named', () => {
    // ⚠ THE FIRST VERSION OF THIS ASSERTED A PROXY AND WENT RED ON WORKING CODE. It compared total
    // REFUSALS on one seed and got 1 against 1 · while the arms were demonstrably different (spend
    // 560M against 630M in the same game). A rationing policy holds money back EARLY, which leaves
    // it more money LATE, so its total refusals can land either side of naive's: measured 3 against
    // 2 at $100M, i.e. the ration refused FEWER, which is the opposite of the naive expectation.
    //
    // The defining property of a ration is not how often it says no, it is WHEN the money is gone.
    // Asserted on an aggregate rather than one seed, because a refusal changes the game from that
    // point on (the bot places instead) and two arms are two different games after their first
    // divergence · which is a property of the mechanic, not a flaw in the measurement.
    const price = 100 * M
    const run = (pacing) => sum([6200, 6223, 6246, 6269, 6292].map(seed =>
      sum(playOnce(bots('builder', 'builder'), seed, undefined,
        { wallet: { price, budget: WALLET, pacing } }).seats.map(s => s.spentAtHalf))))
    const n = run('naive'), p = run('paced')
    expect(p, `paced had spent ${(p / 1e9).toFixed(2)}B by the half-clock and naive ${(n / 1e9).toFixed(2)}B ` +
      '· the ration is not holding anything back, so the two arms are one policy under two names and ' +
      'the budgeting-is-a-skill question cannot be answered by this file (Rule 130)').toBeLessThan(n)
  })

  // 5 · THE PEAK HAND IS A REAL PEAK. If it equalled handAtEnd it would be the same field twice, and
  //     T1 would size a layout against a number that has already had its completable cards played out.
  it('the peak hand is at least the final hand, and usually more', () => {
    const g = playOnce(bots('architect', 'architect'), 6200)
    for (const s of g.seats) expect(s.handPeak).toBeGreaterThanOrEqual(s.handAtEnd)
    expect(Math.max(...g.seats.map(s => s.handPeak)), 'peak never exceeded the final hand in a whole ' +
      'game · the sampler is reading the wrong moment')
      .toBeGreaterThan(Math.min(...g.seats.map(s => s.handAtEnd)))
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE SWEEP · reported. Nothing here is gated: what a price SHOULD be is Mahil's decision and a
// gate on it would be a wire sized from the run that produced it.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe(`the price curve · ${SEEDS} seeds x ${PRICES.length} prices (offset ${OFFSET})`, () => {
  it('sweeps price against the ladder, the basket, the hand and the clock', () => {
    const out = { seeds: SEEDS, offset: OFFSET, prices: [] }
    for (const price of PRICES) {
      const ladder = duel('architect', 'apprentice', price)
      const selfB = duel('builder', 'builder', price)
      const g = playOnce(bots('builder', 'builder'), 6200, undefined, { wallet: walletFor(price, 'naive') })
      out.prices.push({
        priceM: price / M,
        architectWinPct: ladder.winPctA,
        architect: ladder.a, apprentice: ladder.b,
        builderSelf: selfB.all,
        turns: g.turnsPlayed, deckAtEnd: g.deckAtEnd,
      })
    }
    report(`S64_price_sweep_offset_${OFFSET}`, out)
    for (const r of out.prices) {
      // eslint-disable-next-line no-console
      console.log(`$${String(r.priceM).padStart(3)}M  archWin ${String(r.architectWinPct).padStart(5)}%  ` +
        `acq A/B ${String(r.architect.acquired).padStart(5)}/${String(r.apprentice.acquired).padStart(5)}  ` +
        `peakP90 ${String(r.builderSelf.peakP90).padStart(2)} peakMax ${String(r.builderSelf.peakMax).padStart(2)}  ` +
        `refused ${String(r.builderSelf.refused).padStart(5)}  spent ${String(r.builderSelf.spentPct).padStart(5)}%  ` +
        `turns ${r.turns}  deck ${r.deckAtEnd}`)
    }
    expect(out.prices.length).toBe(PRICES.length)
  }, 900_000)

  it('naive against paced, head to head in the same games', () => {
    const out = []
    for (const price of PRICES.filter(p => p > 0)) {
      const d = duel('builder', 'builder', price, { pacing: 'naive', pacingB: 'paced' })
      out.push({ priceM: price / M, naiveWinPct: d.winPctA, naive: d.a, paced: d.b })
    }
    report(`S64_pacing_offset_${OFFSET}`, { rows: out })
    for (const r of out) {
      // eslint-disable-next-line no-console
      console.log(`PACING $${String(r.priceM).padStart(3)}M  naive wins ${String(r.naiveWinPct).padStart(5)}%  ` +
        `acq ${r.naive.acquired}/${r.paced.acquired}  spentAtHalf ${r.naive.spentAtHalfPct}%/${r.paced.spentAtHalfPct}%  ` +
        `refused ${r.naive.refused}/${r.paced.refused}`)
    }
    expect(out.length).toBeGreaterThan(0)
  }, 900_000)
})
