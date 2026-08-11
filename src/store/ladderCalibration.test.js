import { test, expect } from 'vitest'
import { REFERENCE_POLICY, DIFFICULTIES } from '../lib/botPolicy'
import { ladderRow, makeReporter } from './ladderHarness'

// T2 S49 · IS THE DIFFICULTY LADDER A LADDER, OR THREE POLICIES MEASURED AGAINST ONE OPPONENT?
//
// ONE GREP CLOSED THE PREMISE AND IT IS AN UNCOMFORTABLE ONE. Every duel in this repository · S39's,
// S46's, S47's, S48's · pits a rung against REFERENCE_POLICY:
//
//     bonusBalance:520      duel(REFERENCE_POLICY, level, SEEDS)      for each level
//     spendableBalance:274  duel(level, REFERENCE_POLICY, HEAVY, ...) for each level
//     flatGrantBalance:224  ladderRow(level, REFERENCE_POLICY, ...)   for each level
//
// NOTHING HAS EVER PLAYED APPRENTICE AGAINST BUILDER, OR BUILDER AGAINST ARCHITECT. Five sessions of
// "ladder" measurement, and the ladder has never been asked whether its own rungs are separated.
//
// ── WHY THIS IS LOAD-BEARING AND NOT TIDINESS ──────────────────────────────────────────────────────
// In S48 I read apprentice ~5% and architect ~99% as SATURATION and then designed around that
// reading: I chose the score margin as the reported statistic because a win rate near a bound cannot
// move, I sized gates on it, and I wrote "both ends are pinned" into three documents including the
// roadmap Mahil reads. Every one of those numbers is a rung against ONE middling opponent.
//
// MY HYPOTHESIS WAS THAT A LADDER CAN BE PERFECTLY SPACED INTERNALLY WHILE LOOKING EXTREME AGAINST A
// COMMON REFERENCE · that apprentice-vs-architect might be a playable 25/75 and my saturation story
// an artifact of the comparison partner.
//
// ⚠ MEASURED, IT IS THE REVERSE, AND BY A LOT. 40 seeds, 80 games per row, at HEAD cdcab77:
//
//     apprentice vs builder      6.3%   margin -30.9
//     builder    vs architect   15.2%   margin -28.7
//     apprentice vs architect    0.0%   margin -76.5    <- ZERO wins in 80 games
//
//     (for scale, the rung-vs-reference rows everything else in this repo is built on:
//      apprentice 5.1% / builder 77.2% / architect 98.8%)
//
// THE LADDER IS MORE EXTREME AGAINST ITSELF THAN AGAINST THE REFERENCE. One step of difficulty takes
// a player from an even game to roughly one win in seven, and the two ends are not a contest at all.
// So S48's saturation reading was right and UNDERSTATED: the ends are not merely pinned against a
// middling opponent, adjacent rungs are pinned against each other. There is no competitive pairing in
// this ladder except a policy against itself.
//
// The hypothesis is kept above rather than deleted, because the shape of being wrong is the useful
// part: I reached for "the instrument is distorting the reading" when the reading was conservative.
//
// That is Rule 106 · "a measurement between equals cannot answer a question about a ladder, and the
// two answers can both be true" · which I wrote in S47, applied to the instrument I then built on top
// of it in S48. The rule was about WHO the comparison was against. I asked it of the bonus token and
// not of the thing doing the comparing.
//
// ── WHAT THIS DOES NOT MEASURE, said plainly ───────────────────────────────────────────────────────
// Bot-vs-bot. No human has ever finished a recorded multiplayer game (S48 · 60 of 63 ledger rows are
// our own harness, the other 3 are bots and an 'Anonymous' from June 28), so nothing here predicts
// what a human finds hard. It answers the narrower question the ladder's own design implies: are
// these three policies distinguishable from each other, in the right order, by a usable amount?

const SEEDS = Number(process.env.LADDER_SEEDS || 40)
const OFFSET = Number(process.env.SEED_OFFSET || 0)
const seedList = Array.from({ length: SEEDS }, (_, i) => 9000 + OFFSET + i)
const REPORT = makeReporter('LADDER_OUT')

// The three ordered pairs, plus the reference for continuity with every previous session's numbers.
const PAIRS = [
  ['apprentice', 'builder'],
  ['builder', 'architect'],
  ['apprentice', 'architect'],
]

test('the ladder measured against ITSELF · are the rungs separated?', () => {
  const rows = {}
  for (const [a, b] of PAIRS) rows[`${a}_v_${b}`] = ladderRow(a, b, seedList)

  // Self-play on each rung: the ONLY rows here whose answer is known in advance, which is exactly what
  // makes them the counterweight. A policy against itself must tie. If any of these three drifts from
  // 50 the harness has acquired a side · a seat advantage, an orientation bug, a non-deterministic
  // policy · and every asymmetric row above it is measuring that instead of the ladder. Written and
  // asserted FIRST (Rule 90), because the asymmetric rows are the ones I want to believe.
  for (const level of DIFFICULTIES) rows[`${level}_self`] = ladderRow(level, level, seedList)

  // ── COUNTERWEIGHTS FIRST ─────────────────────────────────────────────────────────────────────────
  // 1 · EVERY SELF-PLAY ROW MUST TIE. Bounded at 42-58, the same wire the other balance files use for
  //     their controls · not at the exact 50.0 they tend to produce, because a wire set to an
  //     observed value is a flake waiting for the first legitimate change (Rule 88c).
  for (const level of DIFFICULTIES) {
    const s = rows[`${level}_self`]
    expect(s.winPctEarned, `${level} vs ITSELF came out at ${s.winPctEarned}% · a policy cannot beat ` +
      'itself, so the harness has a side and every rung-vs-rung number in this file is measuring it')
      .toBeGreaterThan(42)
    expect(s.winPctEarned, `${level} vs ITSELF came out at ${s.winPctEarned}%`).toBeLessThan(58)
    // And the margin, which is the statistic this file actually reports · a win rate can sit at 50
    // while a systematic points advantage hides inside it, because the win rate only counts the sign.
    expect(Math.abs(s.marginEarned), `${level} vs itself carries a ${s.marginEarned}-point mean margin ` +
      '· the sign balances but the magnitude does not, so seat or orientation is worth points')
      .toBeLessThan(4)
  }

  // 2 · THE GAMES MUST ACTUALLY BE DIFFERENT GAMES. Two rows built from identical playouts would
  //     produce a beautiful ordered table that means nothing. Cheapest honest check: the three
  //     asymmetric pairs must not all report the identical margin.
  const margins = PAIRS.map(([a, b]) => rows[`${a}_v_${b}`].marginEarned)
  expect(new Set(margins).size, `all three matchups reported the same mean margin (${margins[0]}) · ` +
    'they are not distinct measurements').toBeGreaterThan(1)

  const out = {}
  for (const key of Object.keys(rows)) {
    const r = rows[key]
    out[key] = {
      win: r.winPctEarned, margin: r.marginEarned,
      // Reported because S48's whole reading rested on it: a rate near 0 or 100 has no room to move
      // and contributes a structural zero to any average built from it (Rule 88). This says whether
      // THIS matchup is in that condition, per pair, rather than assuming it from the reference rows.
      saturated: r.winPctEarned <= 5 || r.winPctEarned >= 95,
      tokensA: r.earnedPerGameA, tokensB: r.earnedPerGameB, earnGap: r.earnGap,
      // Free, because ladderRow scores every game both ways: does the S48 finding (the earn skew
      // decides nothing) survive when BOTH sides are real ladder rungs rather than rung-vs-reference?
      winFlat: r.winPctFlat, flips: r.flips, games: r.games,
    }
  }
  // The reference rows, so this table can be laid beside every previous session's without anyone
  // having to re-run those files.
  for (const level of DIFFICULTIES) {
    const r = ladderRow(level, REFERENCE_POLICY, seedList)
    out[`${level}_v_reference`] = {
      win: r.winPctEarned, margin: r.marginEarned,
      saturated: r.winPctEarned <= 5 || r.winPctEarned >= 95,
      tokensA: r.earnedPerGameA, tokensB: r.earnedPerGameB, earnGap: r.earnGap,
      winFlat: r.winPctFlat, flips: r.flips, games: r.games,
    }
  }
  REPORT('S49_ladder_calibration', out)

  // ── THE ONE STRUCTURAL CLAIM WORTH GATING ────────────────────────────────────────────────────────
  // The ORDER. Whatever the spacing turns out to be, a ladder whose rungs are out of order is broken
  // in a way no amount of tuning fixes, and the ordering is transitive so it is three comparisons.
  // Deliberately NOT gating the spacing: that is the finding, and its value is not known before this
  // file runs for the first time. Sizing a wire around it now would be sizing it from the run I am
  // about to do, which is the defect I spent P4 removing from flatGrantBalance.
  expect(rows.apprentice_v_builder.winPctEarned, 'apprentice must lose to builder').toBeLessThan(50)
  expect(rows.builder_v_architect.winPctEarned, 'builder must lose to architect').toBeLessThan(50)
  expect(rows.apprentice_v_architect.winPctEarned, 'apprentice must lose to architect').toBeLessThan(50)
  // And transitivity has to hold in the MARGIN as well as the sign, or "ordered" is an accident of
  // where the wins fell: the ladder's ends must be further apart than either adjacent pair.
  expect(rows.apprentice_v_architect.marginEarned,
    'apprentice-vs-architect must be a wider gap than apprentice-vs-builder, or the rungs are not ' +
    'ordered by strength at all')
    .toBeLessThan(rows.apprentice_v_builder.marginEarned)
  expect(rows.apprentice_v_architect.marginEarned,
    'apprentice-vs-architect must be a wider gap than builder-vs-architect')
    .toBeLessThan(rows.builder_v_architect.marginEarned)
}, 900_000)
