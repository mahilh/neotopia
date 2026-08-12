// LADDER SPACING · what the difficulty dial reaches, and what v2 is made of  (T2 S50 · P1)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// S49 measured the shipped ladder against ITSELF for the first time and found no usable middle:
// apprentice v builder 6.3%, builder v architect 15.2%, apprentice v architect 0.0% in 80 games.
// Mahil's call: a launch blocker rather than a curiosity, because a beginner who picks the middle
// setting and wins one game in sixteen concludes the GAME is unfair, not that they picked wrong.
//
// This file is the measurement that retune rests on, and it stays in the repo as its derivation.
//
//   ALWAYS (cheap · the regression gate)
//     the object-policy counterweight, and the SHIPPED v2 ladder measured rung against rung.
//
//   SPACING_FULL=1 (heavy · the derivation, run by scripts/run-balance-blocks.sh)
//     A · DECOMPOSITION of why v1 was a rout, and
//     B · the drawBias RESPONSE CURVE across its whole range.
//   Split by COST rather than by importance (Rule 79b): the two heavy sections play ~500 games and
//   this project has already destabilised another lane's tests once with an over-eager balance run
//   (botPolicy.test.js carries that note). They are wired into the nightly so they are not orphaned.
//
// WHY THE SWEEP IS AGAINST A FIXED MIDPOINT AND THAT IS NOT RULE 111 AGAIN. Rule 111 (mine, S49) says
// a constant at every call site of an experiment is a hidden parameter. The distinction is that here
// the fixed opponent is the SUBJECT · a response curve is by definition relative to a reference
// point, which is named in every row label. What S39-S48 did was different: they used a fixed
// opponent while believing they were characterising the levels absolutely.
//
// THE RNG CAVEAT, stated because it would otherwise be a silent confound. The 'random' placement
// branch consumes one rng() call and 'affinity' consumes none, so switching that axis shifts the
// whole downstream random stream, not just the placements. Over 40 seeds x 2 orientations that is
// noise rather than bias, but a SINGLE game's difference cannot be attributed to the axis · only the
// aggregate can.

import { describe, it, expect } from 'vitest'
import { ladderRow, makeReporter } from './ladderHarness'
import { POLICIES, DIFFICULTIES } from '../lib/botPolicy'

const SEEDS = Number(process.env.SPACING_SEEDS || 10)
const seeds = Array.from({ length: SEEDS }, (_, i) => 5000 + i * 7)
const report = makeReporter('SPACING_OUT')
const FULL = process.env.SPACING_FULL === '1'

// Builder is the base for every synthetic policy here, so a row differs from it in exactly the axes
// its label names. Taken from POLICIES rather than retyped · a retyped constant is a second contract
// and S48 shipped one three lines long (Rule 92a).
const B = POLICIES.builder

const row = (label, a, b) => {
  const r = ladderRow(a, b, seeds)
  report(label, { winPct: r.winPctEarned, margin: r.marginEarned, games: r.games })
  return r
}

describe(`ladder spacing (${SEEDS} seeds x 2 orientations per row · full=${FULL})`, () => {
  // ── COUNTERWEIGHT, FIRST AND ALONE (Rule 90) ────────────────────────────────────────────────────
  // The wrong way to satisfy every assertion in this file is a harness that cannot tell two policies
  // apart, and the specific new risk in S50 is that `resolvePolicy` might not honour an OBJECT · if a
  // policy object silently fell through to DEFAULT_DIFFICULTY, every synthetic arm below would
  // secretly be builder, every duel would be builder-v-builder, and the whole sweep would report a
  // beautifully flat 50.0 that read as the finding "the dial does nothing".
  //
  // That is the exact shape of a false zero (Rule 80), so it is asserted before anything is measured,
  // in BOTH directions: an object policy must play DIFFERENTLY from the default, and an object equal
  // to the default must play the SAME. Only the pair distinguishes "objects work" from "objects are
  // ignored" · the first assertion alone passes on a harness that ignores them entirely.
  it('an object policy is honoured, and one equal to the default is a genuine no-op', () => {
    const control = row('control · builder-object v builder', { ...B }, 'builder')
    const extreme = row('vacuity · drawBias 0 v builder', { ...B, drawBias: 0 }, 'builder')

    expect(control.winPctEarned, 'a policy OBJECT identical to builder must be indistinguishable ' +
      'from the builder STRING · if this is not ~50 the two entry points disagree and every row ' +
      'in this file is measuring the wrong thing').toBeGreaterThan(35)
    expect(control.winPctEarned).toBeLessThan(65)
    expect(Math.abs(control.marginEarned), 'a policy object identical to builder carries a points ' +
      'advantage over the builder string · resolvePolicy is not returning the same policy')
      .toBeLessThan(1)
    expect(extreme.winPctEarned, 'drawBias 0 must be clearly worse than builder · if it is not, ' +
      'resolvePolicy is dropping the override and every synthetic arm here is secretly builder, ' +
      'which would render the entire sweep a flat 50 that reads as a finding')
      .toBeLessThan(control.winPctEarned - 10)
  }, 120_000)

  // ── THE SHIPPED LADDER, RUNG AGAINST RUNG · this is the claim S49 showed nobody had ever made ────
  it('v2 is ordered, evenly spaced, and each rung ties itself exactly', () => {
    const pairs = {
      app_v_bld: row('v2 · apprentice v builder', 'apprentice', 'builder'),
      bld_v_arc: row('v2 · builder v architect', 'builder', 'architect'),
      app_v_arc: row('v2 · apprentice v architect', 'apprentice', 'architect'),
    }
    // Self-play on every rung · the only rows whose answer is known in advance, which is what makes
    // them the counterweight. A policy against itself must tie; if any drifts, the harness has a side
    // and every asymmetric row above inherits it.
    const selves = {}
    for (const level of DIFFICULTIES) selves[level] = row(`v2 · ${level} v itself`, level, level)
    report('v2-summary', {
      app_v_bld: pairs.app_v_bld.winPctEarned, bld_v_arc: pairs.bld_v_arc.winPctEarned,
      app_v_arc: pairs.app_v_arc.winPctEarned,
      selves: Object.fromEntries(DIFFICULTIES.map(l => [l, selves[l].winPctEarned])),
    })

    for (const level of DIFFICULTIES) {
      expect(Math.abs(selves[level].marginEarned), `${level} against ITSELF carries a ` +
        `${selves[level].marginEarned}-point mean margin · a policy cannot beat itself, so the ` +
        'harness has a seat or orientation advantage and every spacing number here is measuring it')
        .toBeLessThan(1)
    }

    // ORDER. No threshold · three comparisons.
    expect(pairs.app_v_bld.winPctEarned, 'apprentice must lose to builder').toBeLessThan(50)
    expect(pairs.bld_v_arc.winPctEarned, 'builder must lose to architect').toBeLessThan(50)
    expect(pairs.app_v_arc.winPctEarned, 'apprentice must lose to architect').toBeLessThan(50)

    // ⚠ EVEN SPACING IS DELIBERATELY *NOT* ASSERTED HERE, and the reason is the whole of Rule 88c.
    // It is the property v1 lacked and the point of the retune (v1's steps were 6.3% and 15.2%, a
    // factor of 2.4 apart; v2's three disjoint 40-seed blocks gave 32.5/35.4/32.5 against
    // 34.2/29.5/31.2, worst step difference 5.9 points). I wrote the bound at 20 and then read what
    // this gate's own default block produces: 30% and 45%, FIFTEEN points apart on identical code.
    // A bound with five points of headroom against per-game variance is a flake with a delay on it,
    // and widening it to fit would be accommodating the defect rather than fixing the instrument
    // (Rule 110c). The instrument fix is a bigger block, which this gate cannot afford, so the claim
    // moves to the section that can · see the FULL-only evenness test below. Recorded in the report
    // above so the omission is visible rather than silent (Rule 79d · a skip is not a pass).

    // The ends must be further apart than either step, or these are three pairings, not a ladder.
    expect(pairs.app_v_arc.marginEarned).toBeLessThan(pairs.app_v_bld.marginEarned)
    expect(pairs.app_v_arc.marginEarned).toBeLessThan(pairs.bld_v_arc.marginEarned)
  }, 300_000)

  // ── EVENNESS · the claim that needs a block the merge gate cannot afford ─────────────────────────
  // Moved here rather than weakened. A win rate is a rate, so extra seeds buy PRECISION and not just
  // coverage (Rule 104's corollary · the opposite is true of a deterministic property, where they buy
  // only coverage). At 10 seeds the two steps sit 15 points apart on code whose 40-seed answer is 5.9;
  // at 40 the statistic can carry the assertion. SPACING_SEEDS is set to 40 by the nightly runner.
  it.runIf(FULL)('the two adjacent steps are within a few points of each other', () => {
    const lo = row('E · apprentice v builder', 'apprentice', 'builder')
    const hi = row('E · builder v architect', 'builder', 'architect')
    const stepGap = Math.abs(lo.winPctEarned - hi.winPctEarned)
    report('E-evenness', { app_v_bld: lo.winPctEarned, bld_v_arc: hi.winPctEarned, stepGap: +stepGap.toFixed(1) })
    expect(SEEDS, 'the evenness claim is a RATE comparison and needs the block it was sized on · ' +
      'run it with SPACING_SEEDS=40').toBeGreaterThanOrEqual(40)
    expect(stepGap, `the two adjacent steps are ${lo.winPctEarned}% and ${hi.winPctEarned}% · ` +
      `${stepGap.toFixed(1)} points apart. A ladder whose steps are wildly uneven is the v1 defect ` +
      'returning in a new place: one rung becomes the real wall and the other is decorative')
      .toBeLessThan(12)
  }, 300_000)

  // ── A · DECOMPOSITION · why v1 was a rout, kept as the derivation of the retune ──────────────────
  // The v1 constants are written as LITERALS here and not read from POLICIES, deliberately: v1 no
  // longer exists in the codebase, so deriving them from the current table would silently turn this
  // into a measurement of v2 against itself the moment anyone touched it. A historical measurement
  // must carry its own inputs (Rule 97 · a citation outlives the thing it cites).
  const V1_APPRENTICE = { drawBias: 0.05, scoreEager: false, placement: 'random', defendWorst: false }
  it.runIf(FULL)('the v1 apprentice gap decomposes across its three axes, and they ADD', () => {
    const shipped = row('A0 · v1 apprentice v builder', V1_APPRENTICE, 'builder')
    const drawOnly = row('A1 · builder+v1Draw v builder', { ...B, drawBias: V1_APPRENTICE.drawBias }, 'builder')
    const scoreOnly = row('A2 · builder+lazyScore v builder', { ...B, scoreEager: false }, 'builder')
    const placeOnly = row('A3 · builder+randomPlace v builder', { ...B, placement: 'random' }, 'builder')
    const sumOfParts = drawOnly.marginEarned + scoreOnly.marginEarned + placeOnly.marginEarned
    report('A-summary', {
      shippedWin: shipped.winPctEarned, shippedMargin: shipped.marginEarned,
      drawOnly: drawOnly.winPctEarned, scoreOnly: scoreOnly.winPctEarned, placeOnly: placeOnly.winPctEarned,
      sumOfParts: +sumOfParts.toFixed(2),
    })

    // THE FINDING, and it is the reason the retune is a re-spacing rather than a rewrite: the three
    // handicaps compose ADDITIVELY IN MARGIN (measured at 40 seeds: -16.35 + -9.31 + -6.69 = -32.35
    // against a combined -32.60) while the WIN RATE collapses to zero. A win rate is a threshold on
    // the margin, so three individually-survivable handicaps stack past the point where any game is
    // winnable. That is Rule 88 explaining its own mechanism.
    expect(Math.abs(sumOfParts - shipped.marginEarned), 'the three axes no longer add · the ' +
      `individual margins sum to ${sumOfParts.toFixed(2)} against a combined ${shipped.marginEarned}. ` +
      'If they have started interacting, the decomposition below is not a valid explanation of v1 ' +
      'and the retune needs re-deriving rather than re-tuning').toBeLessThan(8)

    // And each single axis must be gentler than all three together, or they are not stacking at all.
    for (const [name, r] of [['draw', drawOnly], ['score', scoreOnly], ['place', placeOnly]]) {
      expect(r.winPctEarned, `reverting the ${name} axis alone is as punishing as all three`)
        .toBeGreaterThan(shipped.winPctEarned)
    }
  }, 300_000)

  // ── F · THE SAME CURVE IN FLOW · does the Classic slope carry? (T2 S54 · P3) ─────────────────────
  // S50 found the ladder does not transfer: Flow's steps are 27.6 / 39.9 against Classic's
  // 33.5 / 31.6. S53 costed a Flow retune at five steps and recommended doing ONLY THE FIRST, because
  // every other step depends on it: the Classic slope (~0.86 points of margin per 0.01 of draw bias)
  // CANNOT BE ASSUMED TO CARRY, and the ladder failing to transfer is itself the evidence that it
  // does not. Tuning Flow off the Classic slope would be Rule 111 · a constant lifted out of the
  // context that gave it its value.
  //
  // NOT URGENT AND SAID SO: DIFFICULTY_SELECTABLE is false and no picker exists in any component or
  // page, so no player can reach a rung in either mode today. This measures the prerequisite so the
  // decision is available when the picker ships, and nothing more.
  // ══ MEASURED · 40 seeds. THE CLASSIC SLOPE DOES NOT CARRY, AND FLOW IS A SCALED COPY ═══════════
  //   bias      0.00   0.10   0.20   0.30   0.40   0.55   0.70   1.00
  //   FLOW     -12.1   -7.1   -4.4    0.0   +6.0  +13.4  +23.0  +31.9
  //   CLASSIC  -20.7  -12.8   -6.4    0.0  +10.8  +18.6  +36.8  +46.6
  //   ratio     0.58   0.55   0.69      -   0.56   0.72   0.63   0.68
  //
  // MID-RANGE SLOPE: Classic 0.20->0.40 spans 17.2 margin over 0.20 of bias = 0.86 per 0.01.
  //                  Flow    0.20->0.40 spans 10.4 margin over 0.20 of bias = 0.52 per 0.01.
  // So the Classic constant is ~40% TOO STEEP for Flow, which is exactly the assumption S53 refused to
  // make. Tuning Flow off it would have overshot every rung.
  //
  // ── AND THE BETTER HALF · THE RATIO IS CONSTANT, SO FLOW IS A RESCALE AND NOT A REDESIGN ────────
  // 0.55 to 0.72 across the whole range, with no trend. Flow is not a different curve, it is the same
  // curve compressed by roughly 0.6 · which makes sense of the mechanism: nine tiles instead of twelve
  // gives an advantage less time to compound, so every margin shrinks by about the same fraction.
  //
  // THIS MATERIALLY CHEAPENS MY OWN S53 RECOMMENDATION. I costed a Flow retune at five steps and
  // warned it "permanently doubles the tuning surface". If the axis is a scaled copy, a Flow ladder is
  // the Classic offsets divided by ~0.6 · i.e. bias offsets about 1.65x larger from the same midpoint ·
  // and the mode-aware table collapses from two independent tunings to ONE tuning plus ONE constant.
  // That is a much smaller thing than I described, and the difference is entirely this measurement.
  // ⚠ NOT A RETUNE, AND NOT A PROPOSAL TO SHIP ONE: no player can reach a rung in either mode
  // (DIFFICULTY_SELECTABLE false, no picker in any component or page), so this is a prerequisite
  // parked until the picker exists. Rule 121 · a finding needs a denominator before it gets a priority.
  it.runIf(FULL)('the drawBias curve in FLOW · measured, not assumed from Classic', () => {
    const BIASES = [0.00, 0.10, 0.20, 0.30, 0.40, 0.55, 0.70, 1.00]
    const curve = BIASES.map(x => {
      const r = ladderRow({ ...B, drawBias: x }, { ...B, drawBias: 0.30 }, seeds, 'flow')
      report(`F · flow drawBias ${x.toFixed(2)} v 0.30`, { winPct: r.winPctEarned, margin: r.marginEarned })
      return { bias: x, pct: r.winPctEarned, margin: r.marginEarned }
    })
    report('F-curve-flow', { curve })

    const mid = curve.find(c => c.bias === 0.30)
    expect(mid.pct, 'drawBias 0.30 against itself IN FLOW is the same policy played both ways round · ' +
      'it must be exactly 50.0 or the mode has handed a seat an advantage the swap does not cancel')
      .toBe(50)
    expect(mid.margin, 'and its margin must be exactly 0.00 for the same reason').toBe(0)
    // Ordered ends · the axis must still be an axis in Flow. Deliberately NOT asserting the slope:
    // whether it matches Classic is the FINDING, and gating it would pin the thing being measured.
    expect(curve[0].margin, 'drawBias 0.00 must lose to 0.30 in Flow too').toBeLessThan(0)
    expect(curve[curve.length - 1].margin, 'drawBias 1.00 must beat 0.00 in Flow too')
      .toBeGreaterThan(curve[0].margin)
  }, 600_000)

  // ── B · RESPONSE CURVE · the only continuous axis, across its whole range ────────────────────────
  it.runIf(FULL)('drawBias is monotone in margin, and saturates in win rate above ~0.7', () => {
    const BIASES = [0.00, 0.10, 0.20, 0.30, 0.40, 0.55, 0.70, 0.85, 1.00]
    const curve = BIASES.map(x => {
      const r = row(`B · drawBias ${x.toFixed(2)} v 0.30`, { ...B, drawBias: x }, { ...B, drawBias: 0.30 })
      return { bias: x, pct: r.winPctEarned, margin: r.marginEarned }
    })
    report('B-curve', { curve })

    const mid = curve.find(c => c.bias === 0.30)
    expect(mid.pct, 'drawBias 0.30 against drawBias 0.30 is the SAME policy played both ways round, ' +
      'so it must be exactly 50.0 · anything else is a seat advantage the orientation swap failed ' +
      'to cancel, and every other row in this curve inherits it').toBe(50)
    expect(mid.margin, 'and its margin must be exactly 0.00 for the same reason').toBe(0)

    // MONOTONE IN MARGIN, which is the statistic that has room to move at both ends. Asserted
    // strictly, because margin is what the curve is FOR: reading the slope off it is how the v2
    // constants were chosen (~0.86 points of margin per 0.01 of draw bias near the middle).
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].margin, `drawBias ${curve[i].bias} scored a lower margin than ` +
        `${curve[i - 1].bias} · the axis is not monotone and a ladder cannot be three points along it`)
        .toBeGreaterThan(curve[i - 1].margin)
    }
    // NOT monotone in win rate at the top, and that is recorded rather than gated: 0.70 / 0.85 / 1.00
    // measured 97.5 / 96.3 / 98.8 at 40 seeds. The rate has saturated and has no resolution left,
    // while the margin over the same three points goes 36.84 / 40.61 / 46.59 and is still climbing.
    // This is exactly Rule 88's saturation, visible in the same run as the statistic that avoids it.
    const top = curve.filter(c => c.bias >= 0.70)
    expect(Math.max(...top.map(c => c.pct)), 'the top of the draw-bias range is no longer saturated ' +
      '· if the rate has regained headroom up here the curve has changed shape and the v2 constants ' +
      'were chosen from a slope that no longer exists').toBeGreaterThan(90)
  }, 600_000)
})
