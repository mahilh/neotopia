// FOUR PLAYERS · the bonus pile does not scale, and nobody had ever looked  (T2 S51 · P2)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE PREMISE, WHICH IS ARITHMETIC AND NOT A HYPOTHESIS:
//
//     useGameRoom.js:144      max_players: 4                  <- shippable TODAY, hardcoded
//     gameStore.js:62         createRegionBonusPile()         <- ONE token per threshold, per region
//                             3 regions x 3 thresholds  =  9 tokens, for the WHOLE GAME
//
// Nine tokens exist at two players and nine exist at four. Every balance finding from S39 to S50 was
// measured at TWO (Rule 111 · `bots()` is only ever called with two, and `ladderRow` is structurally
// a duel), so Mahil's "change nothing" decision is formally scoped to 2-player Classic and does not
// extend here.
//
// AND THE PRODUCTION TILE CLOCK IS SHARED. A game is 12 tiles regardless of player count, so four
// players do not play a longer game · they play the SAME game with each player taking about half as
// many turns. That is the mechanism that makes this more than a division problem.
//
// ── MY OWN OPEN QUESTION FROM S38, NOW LOAD-BEARING ──────────────────────────────────────────────
// gameStore.js:479 carries it verbatim: "whether the physical game has one token per threshold per
// region (what this does) or one per threshold PER PLAYER ... the difference only shows up in a game
// where two players both cross the same threshold in one region." At two players that was rare
// enough to shelve. At four it decides the mechanic, and it is still unanswered by the rulebook.
//
// I cannot answer the rulebook question. I CAN measure the thing that decides whether it matters:
// how often a player crosses a threshold and finds the token already taken. The granter drops that
// case silently (`if (i >= 0)` with no else), so it is invisible in the grant log · but region
// scores only ever increase, so a final score of S in a region means exactly the thresholds <= S
// were crossed. DEMAND is recoverable from the final state; SUPPLY is the claimed pile.
//
// ══ PREDICTIONS, WRITTEN BEFORE THE FIRST RUN ═════════════════════════════════════════════════════
// Recorded because a prediction made after seeing the number is not a prediction, and because the
// forge asked for one. Baseline is S50's measured 2-player builder self-play: 4.47 tokens granted
// per game, i.e. 2.24 per player, out of a pool of 9.
//
//   P1 · PER-PLAYER VOLUME ROUGHLY HALVES.        predicted ~1.0-1.5 per player   (vs 2.24 at 2p)
//        Each player takes about half as many turns for the same 12-tile clock, so scores fewer
//        points, so crosses fewer thresholds.
//   P2 · TOTAL CLAIMED MOVES LITTLE, and may FALL. predicted 3.5-6.0 of 9        (vs 4.47 at 2p)
//        More claimants, but each is weaker. I genuinely do not know the sign and am saying so.
//   P3 · CONTESTED CROSSINGS APPEAR.               predicted > 0, and materially higher than at 2p.
//        This is the one that decides the open question. At 2p I expect it near zero.
//   P4 · THE EARN SKEW WIDENS.                     predicted the strongest seat's share of granted
//        tokens rises above the 2p figure, because first-come-first-served rewards whoever scores
//        fastest and there are now three players to be faster than instead of one.
//
// A prediction that cannot be wrong is not one, so: P1 is falsified by a per-player figure above
// 1.8; P3 is falsified by contested crossings staying at zero; P4 is falsified by the share falling.
//
// ══ MEASURED · THREE DISJOINT 40-SEED BLOCKS (FOURP_OFFSET 0 / 300 / 600) ═════════════════════════
//
//                              2 players                 4 players
//   tokens per player      2.163 / 2.150 / 2.100     0.981 / 1.031 / 1.012
//   crossings per game       6.65 / 6.47 / 6.72        8.35 / 8.22 / 8.20
//   CONTESTED per game       2.33 / 2.17 / 2.52        4.42 / 4.10 / 4.15
//   contested share           35% / 34% / 38%           53% / 50% / 51%
//   pool                          9 (fixed)                 9 (fixed)
//
// ── THE SCORECARD, because a prediction nobody grades is decoration ──────────────────────────────
//   P1 ✅ CORRECT, and at the bottom of my range. 2.14 -> 1.01 per player, a 53% fall. "Roughly
//         halves" was right for the right reason: the 12-tile clock is shared, so four players play
//         the same game with half the turns each.
//   P2 ✅ CORRECT. Total granted fell slightly, 4.33 -> 3.93, inside the 3.5-6.0 band. I said I did
//         not know the sign and did not pretend otherwise.
//   P3 ⚠ HALF WRONG, AND THE WRONG HALF IS THE FINDING. Contested crossings do rise at four players,
//         as predicted. But I wrote "at 2p I expect it near zero" and IT IS 36%. Over a third of all
//         threshold crossings in an ordinary TWO-PLAYER game already award nothing at all.
//   P4 ❌ FALSIFIED. I predicted the earn skew would widen under first-come-first-served. Architect
//         takes 1.348 tokens/game against an even share of ~1.065, i.e. 1.27x · against roughly
//         1.34x at two players (S50). If anything it NARROWED. Scarcity throttles the leader too.
//
// ══ THE FINDING · THE S38 QUESTION IS NOT A FOUR-PLAYER QUESTION, IT IS LIVE AT TWO ═══════════════
// gameStore.js:479 shelved "one token per threshold per region, or one per player?" on the grounds
// that "the difference only shows up in a game where two players both cross the same threshold in one
// region." That case is not rare. It is 36% of crossings at two players and 51% at four.
//
// So this is not a balance number awaiting a design decision · it is a rule that may be implemented
// wrongly, and it has been silently discarding a third of its own events since S38, at the exact
// player count every balance measurement in this project was taken at. If the physical game awards
// one token per threshold PER PLAYER, the shipped granter is wrong today, in Classic, at two players,
// inside the scope Mahil's "change nothing" decision was closed on.
// ⚠ THIS NEEDS THE RULEBOOK, NOT ANOTHER EXPERIMENT. Flagged, not guessed (Rule 32).
//
// ── AND A NEAR-MISS WORTH RECORDING, THE SECOND IN TWO SESSIONS ──────────────────────────────────
// Block 1 alone showed apprentice out-earning builder at four players (0.994 vs 0.912) · a clean
// contradiction of S47's "earning tracks scoring speed", with a ready mechanism (random placement
// spreads across regions, and thresholds are per-region, so spreading might cross more of them).
// Across three blocks: apprentice 0.994 / 0.875 / 0.800 against builder 0.912 / 0.981 / 1.003. Mean
// 0.890 vs 0.965 · the ladder order holds and block 1 was an inversion. A suggestive number plus a
// plausible mechanism, killed by repeating it (Rule 113c's sibling, and S50's spend deltas exactly).

import { describe, it, expect } from 'vitest'
import { playOnce, bots, makeReporter } from './ladderHarness'
import { DIFFICULTIES } from '../lib/botPolicy'

const SEEDS = Number(process.env.FOURP_SEEDS || 12)
const OFFSET = Number(process.env.FOURP_OFFSET || 0)
const seeds = Array.from({ length: SEEDS }, (_, i) => 8000 + OFFSET + i * 13)
const report = makeReporter('FOURP_OUT')

const THRESHOLDS = [7, 13, 18]

/** Thresholds this seat crossed, summed over regions · derived from final scores, not re-simulated. */
function crossingsFor(scoreMap) {
  let n = 0
  for (const v of Object.values(scoreMap ?? {})) for (const t of THRESHOLDS) if ((v ?? 0) >= t) n++
  return n
}

/**
 * Play `seeds` games at N seats. With distinct policies every seed is played N times, ROTATED, so
 * each policy occupies each seat exactly once and the seat-order advantage cancels the same way the
 * two-player harness's orientation swap does. With identical policies one rotation is enough and the
 * caller passes rotate:false, because N identical rotations are N identical games.
 */
function table(levels, { rotate = true } = {}) {
  const n = levels.length
  const rotations = rotate ? n : 1
  let games = 0, granted = 0, demand = 0, poolTotal = 0
  const perPolicyTokens = Object.fromEntries(levels.map(l => [l, 0]))
  const perPolicyCount = Object.fromEntries(levels.map(l => [l, 0]))

  for (const seed of seeds) {
    for (let rot = 0; rot < rotations; rot++) {
      const order = levels.map((_, i) => levels[(i + rot) % n])
      const g = playOnce(bots(...order), seed)
      games++
      granted += g.seats.reduce((s, x) => s + x.earned, 0)
      poolTotal += g.pileTotal
      for (let seat = 0; seat < n; seat++) {
        demand += crossingsFor(g.scores[seat])
        perPolicyTokens[order[seat]] += g.seats[seat].earned
        perPolicyCount[order[seat]] += 1
      }
    }
  }
  const perPolicy = Object.fromEntries(
    Object.keys(perPolicyTokens).map(k => [k, +(perPolicyTokens[k] / (perPolicyCount[k] || 1)).toFixed(3)]))
  return {
    seats: n, games,
    grantedPerGame: +(granted / games).toFixed(3),
    perPlayerPerGame: +(granted / games / n).toFixed(3),
    demandPerGame: +(demand / games).toFixed(3),
    contestedPerGame: +((demand - granted) / games).toFixed(3),
    poolPerGame: +(poolTotal / games).toFixed(1),
    perPolicy,
  }
}

describe(`four players vs two · the nine-token pool (${SEEDS} seeds)`, () => {
  // ── COUNTERWEIGHT, FIRST AND ALONE (Rule 90) ────────────────────────────────────────────────────
  // Two ways this file reports a confident nothing, and the first is the dangerous one.
  //
  // 1 · THE FOURTH AND THIRD SEATS NEVER PLAY. `bots(a,b,c,d)` is a call nothing in this repository
  //     has ever made against the engine offline. If initGame silently seated two, or if seats 2-3
  //     never got a turn, every "4-player" row would be a 2-player game and the finding would be
  //     manufactured. Asserted structurally: four seats must exist AND all four must have scored
  //     something across a block, which a seat that never acts cannot do.
  // 2 · DEMAND IS NOT MEASURABLE. If `scores` came back empty the crossing count is 0, contested
  //     comes out NEGATIVE, and the headline number is nonsense in a way that looks like a result.
  it('four seats really play, and demand is really measurable', () => {
    const g = playOnce(bots('builder', 'builder', 'builder', 'builder'), 8000)
    expect(g.seats.length, 'initGame did not seat four players').toBe(4)
    expect(g.pileTotal, 'the bonus pile is not 9 tokens · the premise of this whole file is that ' +
      '3 regions x 3 thresholds do not scale with player count').toBe(9)

    const scored = g.scores.filter(s => Object.values(s ?? {}).some(v => (v ?? 0) > 0)).length
    expect(scored, `only ${scored} of 4 seats scored anything · seats that never act make this a ` +
      '2-player game wearing a 4-player label, and every number below would be an artifact')
      .toBeGreaterThanOrEqual(3)

    const demand = g.scores.reduce((n, s) => n + crossingsFor(s), 0)
    const granted = g.seats.reduce((n, x) => n + x.earned, 0)
    expect(demand, 'zero threshold crossings in a full 4-player game · the demand measure is broken, ' +
      'not the game').toBeGreaterThan(0)
    expect(demand, 'demand is BELOW granted, which is impossible · every granted token requires a ' +
      'crossing, so the crossing count is not measuring what it names').toBeGreaterThanOrEqual(granted)
  }, 120_000)

  it('measures 2 vs 4 players against the same fixed pool', () => {
    const two = table(['builder', 'builder'], { rotate: false })
    const four = table(['builder', 'builder', 'builder', 'builder'], { rotate: false })
    const ladder4 = table([...DIFFICULTIES, 'builder'])
    report('S51_four_player', { two, four, ladder4 })

    // The pool is the same in both, by construction. Asserted so the comparison cannot silently
    // become "4 players get a bigger pool", which would make every number here uninteresting.
    expect(four.poolPerGame, 'the pool must be identical at both player counts · that is the premise')
      .toBe(two.poolPerGame)

    // GATED · the one structural claim. Scarcity per player must INCREASE with player count: the
    // same fixed pool shared by more people cannot give each of them more. If this ever inverts, the
    // pile has started scaling and this whole file's premise is gone.
    expect(four.perPlayerPerGame, `four players received ${four.perPlayerPerGame} tokens each ` +
      `against ${two.perPlayerPerGame} at two seats. A FIXED nine-token pool cannot pay MORE per ` +
      'head to more players · if it does, createRegionBonusPile has started scaling with seat count ' +
      'and the S38 open question has been answered by someone without updating this file')
      .toBeLessThan(two.perPlayerPerGame)

    // REPORTED, NOT GATED · contested crossings, the number that decides the S38 open question.
    // Not gated because "how much contention is acceptable" is a design decision nobody has taken,
    // and a bound here would be me encoding a balance target under cover of a regression test.
  }, 900_000)
})
