import { test, expect } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'
import { chooseBotAction, makeRng, REFERENCE_POLICY } from '../lib/botPolicy'
import { calculateFinalScore, getClusterTotal } from '../lib/patternMatcher'

// T2 S46 · IS A SPENDABLE TOKEN A DIFFERENT TERM FROM AN UNSPENT ONE?
//
// S39 measured bonus tokens and found they favour the WEAKER player: apprentice -2.4, builder -3.0,
// architect -0.8, replicated 9/9 cells. The mechanism was the whole finding · builder earns +1.68
// points of mean token edge against 7.44 of spread, signal-to-noise 0.23, and noise helps the underdog.
//
// THAT MEASUREMENT IS ABOUT A CONSTANT. Every token in those 360 games was UNSPENT, worth a flat 3
// points, because nothing called useBonus. T1 has since shipped the control, so for a human a token is
// now a DECISION: spend it and you trade its 3 points for an effect (subsidy draws 2 cards). A decision
// is exactly the kind of term that rewards skill instead of diluting it, so the sign can invert.
//
// ── WHAT THIS EXPERIMENT GIVES UP, STATED RATHER THAN ABSORBED ──────────────────────────────────────
// S39's strongest property is GONE and cannot be recovered. There, bots never read tokens, so seeding
// changed scoring only and each game was played ONCE and scored TWICE · an EXACT control with not even
// a sampling difference between arms (Rule 74). A bot that spends makes DIFFERENT GAMES: it draws two
// extra cards, its hand diverges, and every later decision diverges with it. So this is a PAIRED-SEED
// STATISTICAL control · same seed, same deck, same tile order, same policies, one variable · and the
// arms diverge from the first spend onward. Weaker than S39 by construction. Saying so is the point:
// the previous design's exactness was a property of the feature being inert, and the feature is not
// inert any more.
//
// SCOPE · subsidy only. It is the one type a human can actually spend today: automatization has no
// route into the game (the bonus-hex data is still missing) and initiative/permits need a placement
// payload the UI does not yet collect. Measuring what ships, not what is implemented.

const api = () => useGameStore.getState()
const shuffled = (arr, rng) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// One game. `spenders` is the set of seats that spend subsidy the moment they hold one.
// Returns per-seat finals PLUS the instrumentation that decides whether this measured anything.
function playOut(configs, seed, spenders = new Set()) {
  useGameStore.setState(useGameStore.getInitialState(), true)
  const rng = makeRng(seed)
  api().initGame(configs, shuffled(PROJECT_CARDS, rng), shuffled(PRODUCTION_TILES, rng))
  let lastPlacedKey = null
  let spends = 0
  const trace = []
  for (let i = 0; i < 4000 && api().phase === 'playing'; i++) {
    const s = api(); const seat = s.currentSeat

    // THE DECISION. A spender cashes subsidy as soon as it holds one: forfeit 3 points, draw 2 cards.
    // Deliberately the simplest possible policy · this measures whether the TRADE is favourable at all,
    // which has to be answered before any cleverer timing heuristic means anything.
    if (spenders.has(seat) && !s.bonusUsedThisTurn) {
      const p = s.players.find(x => x.seat === seat)
      if (p?.bonusTokens?.includes('subsidy')) {
        const before = p.bonusTokens.length
        api().useBonus(seat, 'subsidy')
        if ((api().players.find(x => x.seat === seat)?.bonusTokens.length ?? before) < before) spends++
      }
    }

    const a = chooseBotAction({
      state: api(), seat, difficulty: configs[seat].difficulty,
      getValidPlacements: api().getValidPlacements, getBuildableCards: api().getBuildableCards, lastPlacedKey, rng,
    })
    if (a.type === 'placeElement') { api().placeElement(seat, a.factoryId, a.elementType, a.q, a.r, a.regionId); lastPlacedKey = `${a.q},${a.r}` }
    else if (a.type === 'scoreCard') { api().scoreCard(seat, a.cardId, a.regionId, a.lastPlacedKey); lastPlacedKey = null }
    else if (a.type === 'drawCard') api().drawCard(seat, a.source, a.cardIndex)
    else { api().endTurn(); lastPlacedKey = null }
    if (trace.length < 40) trace.push(`${seat}${a.type[0]}`)
  }
  const st = api()
  return {
    spends,
    fingerprint: trace.join(''),   // divergence detector · see the counterweight
    seats: configs.map((_, seat) => {
      const p = st.players.find(x => x.seat === seat)
      const cluster = getClusterTotal(st.regions, seat)
      return { total: calculateFinalScore(p.scores, p.bonusTokens.length, cluster), tokensHeld: p.bonusTokens.length }
    }),
  }
}

const bots = (...levels) => levels.map((difficulty, i) => ({ userId: null, username: `B${i}`, isBot: true, difficulty }))

// Seat-controlled duel: every seed is played both ways round so seat order cannot carry the result.
// `spendSeatIs` names WHICH logical player spends ('a' | 'b' | 'none' | 'both').
function duel(levelA, levelB, seeds, spendSeatIs) {
  let aWins = 0, bWins = 0, draws = 0, spends = 0, diverged = 0
  const fingerprints = []
  for (const seed of seeds) {
    for (const swap of [false, true]) {
      const configs = bots(swap ? levelB : levelA, swap ? levelA : levelB)
      const aSeat = swap ? 1 : 0
      const spenders = new Set(
        spendSeatIs === 'both' ? [0, 1]
          : spendSeatIs === 'a' ? [aSeat]
            : spendSeatIs === 'b' ? [1 - aSeat] : [],
      )
      const r = playOut(configs, seed, spenders)
      spends += r.spends
      fingerprints.push(r.fingerprint)
      const aTotal = r.seats[aSeat].total, bTotal = r.seats[1 - aSeat].total
      if (aTotal > bTotal) aWins++; else if (bTotal > aTotal) bWins++; else draws++
    }
  }
  const decided = aWins + bWins
  return { aWinPct: decided ? +(100 * aWins / decided).toFixed(1) : 50, aWins, bWins, draws, spends, fingerprints }
}

// SEED COUNT, SIZED FROM MEASURED SPREAD rather than chosen for speed (Rule 88c · the P3 I owed
// myself, and it bit inside this very test: the first version ran 20 seeds, measured 60.5% and tripped
// its own 10-point tripwire on working code).
// SEVEN disjoint blocks, 560 games: 25-seed blocks gave 59.6 / 58.0 / 60.0 / 51.0; 60-seed blocks gave
// 54.2 / 58.1 / 63.0. MORE SEEDS DID NOT TIGHTEN IT · the range is ~9 points at both sizes, because the
// variance is per-GAME not per-block: at ~1.2 spends per game a single token frequently decides the
// result. So buying precision here costs an order of magnitude more games, not a factor of two, and 30
// is chosen as the cheapest block that still exercises the machinery on every commit.
const SEEDS = Number(process.env.SPEND_SEEDS || 30)
const OFFSET = Number(process.env.SEED_OFFSET || 0)
const seedList = Array.from({ length: SEEDS }, (_, i) => 9000 + OFFSET + i)

test('a spendable token is a different term · does cashing subsidy pay?', () => {
  // ── COUNTERWEIGHT FIRST (Rule 90), and here it is the ONLY thing standing between this experiment
  // and a confident measurement of nothing. If bots never hold a subsidy, or useBonus silently
  // refuses, the SPEND arm is byte-identical to the HOARD arm and the honest-looking answer
  // "spending makes no difference" would be produced by a spend that never happened. That is the
  // exact shape of award_game_win at 0 rows and card art at 0/56 · a result resting at a plausible
  // value (Rule 80). So: spends must actually occur, AND the games must actually diverge.
  const control = duel(REFERENCE_POLICY, REFERENCE_POLICY, seedList, 'none')
  const spendA = duel(REFERENCE_POLICY, REFERENCE_POLICY, seedList, 'a')

  expect(spendA.spends, 'NO SUBSIDY WAS EVER SPENT · the arms are identical and any result below is ' +
    'a measurement of nothing').toBeGreaterThan(0)
  const identical = spendA.fingerprints.every((f, i) => f === control.fingerprints[i])
  expect(identical, 'the spend arm played byte-identical games to the control · useBonus is not ' +
    'changing behaviour, so this experiment cannot see anything').toBe(false)

  // The control must still be a clean null · identical policies, neither spending.
  expect(control.aWinPct, 'identical non-spending policies must tie').toBeGreaterThan(42)
  expect(control.aWinPct, 'identical non-spending policies must tie').toBeLessThan(58)

  // ── THE QUESTION · same policy on both sides, one seat spends. Anything away from 50 is the value
  // of the DECISION itself, with skill held constant.
  const bothSpend = duel(REFERENCE_POLICY, REFERENCE_POLICY, seedList, 'both')

  const out = {
    seeds: seedList.length, games: seedList.length * 2,
    control: control.aWinPct,
    spenderWinPct: spendA.aWinPct,
    spendsPerGame: +(spendA.spends / (seedList.length * 2)).toFixed(2),
    bothSpendControl: bothSpend.aWinPct,
  }
  // vitest v4 only surfaces console.log on failure, so a passing run reports through a file.
  if (process.env.SPEND_OUT) {
    // eslint-disable-next-line no-undef
    require('node:fs').appendFileSync(process.env.SPEND_OUT, JSON.stringify(out) + '\n')
  }

  // Symmetry check: if BOTH spend, we are back to a fair fight and it must tie again. This catches a
  // spend implementation that simply advantages whichever seat calls it first. Exact in 7/7 blocks.
  expect(bothSpend.aWinPct, `both-spend must be symmetric · got ${bothSpend.aWinPct}`).toBeGreaterThan(40)
  expect(bothSpend.aWinPct, `both-spend must be symmetric · got ${bothSpend.aWinPct}`).toBeLessThan(60)

  // ── WHICH ASSERTIONS ARE SHARP AND WHICH ARE COARSE, said out loud (Rule 88c) ────────────────────
  // SHARP · the control at exactly 50.0 and both-spend symmetric. Both were exact in 7/7 blocks and
  //         they are what would break first if the harness stopped measuring the right thing.
  // SHARP · the vacuity guards above (a spend occurred, the games diverged). Without them a broken
  //         useBonus reports "spending makes no difference", which is the answer that looks correct.
  // NOT GATED · the DIRECTION. It is the real finding (7/7 blocks above 50, binomial p≈0.008) but the
  //         weakest block came in at 51.0, so a single 30-seed block can plausibly cross 50 by chance.
  //         Asserting it per-run would train people to ignore a red (Rule 84's failure mode inverted).
  //         The evidence lives in docs/BONUS_TOKEN_BALANCE.md across 560 games, where it belongs.
  // COARSE · the magnitude backstop below. Observed max was 63.0 (+13), so 20 is the smallest bound
  //         that cannot flake on working code while still catching a doubling of the effect.
  expect(Math.abs(spendA.aWinPct - 50), `spending subsidy moved the win rate to ${spendA.aWinPct}% ` +
    `against a ${control.aWinPct}% control. The measured effect across 560 games is about +7.7 with ` +
    'blocks ranging to +13; this backstop is deliberately coarse and a breach means the trade has ' +
    'been re-weighted, not that a block ran hot.').toBeLessThanOrEqual(20)
}, 300_000)
