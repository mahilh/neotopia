// CAN A PLAYER SEE WHICH RUNG THEY ARE PLAYING?  (T2 S51 · P3)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THIS FILE EXISTS BECAUSE OF A CLAIM I MADE WITHOUT MEASURING IT, IN THE SESSION WHOSE WHOLE THEME
// WAS THAT UNSTATED ASSUMPTIONS EXPIRE.
//
// S50 measured `defendWorst` at exactly ZERO win rate (50.0%, margin +3.00, 80 games) on code whose
// own comment called it "the one genuinely strategic idea in the file". I kept it anyway and wrote
// the justification into botPolicy.js and into docs/LADDER_CALIBRATION.md:
//
//     "Kept as flavour · it gives architect a visible character, steering toward the region
//      multiplied by three · and now labelled as such."
//
// That is a claim about HUMAN PERCEPTION with zero evidence behind it, made three paragraphs after
// demonstrating that the same feature's effect on the win column was nil. It was nearly free to
// check and I did not check it (Rule 81 · a number you reasoned to is a claim).
//
// AND IT MATTERS MORE NOW THAN IT DID BEFORE THE RETUNE. v1's rungs were 8.9 points apart in win
// rate and a player could feel the difference in the result. v2's are 1.7 apart by design. When the
// SCOREBOARD stops distinguishing the settings, whatever is left has to be visible on the BOARD, or
// the difficulty picker is three labels over one experience.
//
// ── WHAT IS MEASURED, AND WHY THESE TWO ──────────────────────────────────────────────────────────
// Not "perception" · that needs a person. Two proxies for it that are properties of the finished
// board, both taken from the REAL scoring functions rather than re-derived (Rule 45):
//
//   CLUSTERING   getClusterTotal = 1 point per element of your colour in the biggest cluster per
//                region (board rule p9). It is literally a count of how clumped your pieces are, so
//                it is the closest thing in the engine to "does this board look deliberate".
//                Discriminates `placement: random` from `placement: affinity`.
//
//   REGION SPREAD  max(region score) - min(region score) for a seat. `defendWorst` steers scoring
//                into the weakest region, so if it does anything a person could name, it is this:
//                an architect's three regions should finish more even than a builder's.
//                THIS IS THE ONE THAT TESTS MY CLAIM. If the spread is identical to builder's, the
//                "visible character" justification is empty and defendWorst should be deleted rather
//                than relabelled a second time.
//
// SELF-PLAY ONLY. Each policy is measured against ITSELF, so the numbers describe what that policy
// does to a board rather than what it does to an opponent · a mixed table would confound the two.
//
// ══ MEASURED · THREE DISJOINT 40-SEED BLOCKS (VIS_OFFSET 0 / 400 / 800) ═══════════════════════════
//
//                    CLUSTERING (higher = clumpier)      REGION SPREAD (lower = more even)
//   apprentice        15.95 / 15.15 / 15.63  = 15.6       11.49 / 12.15 / 12.43  = 12.0
//   builder           24.95 / 24.89 / 24.93  = 24.9       15.45 / 14.78 / 15.41  = 15.2
//   architect         25.45 / 25.65 / 25.61  = 25.6        9.76 /  9.54 /  9.18  =  9.5
//   builder+defendWorst  (isolated axis)      25.4         8.19 /  7.13 /  7.70  =  7.7
//
// ── THE CLAIM I MADE WITHOUT EVIDENCE IN S50 IS CORRECT, AND IT IS NOT A SMALL EFFECT ────────────
// `defendWorst`, isolated on builder, takes the region spread from 15.2 to 7.7 · IT HALVES IT. So a
// feature measured at EXACTLY ZERO win rate produces the single largest board-shape difference
// anywhere in the ladder. "Kept as flavour, it gives architect a visible character" turns out to be
// true and to be an understatement, and it is now a measurement rather than a thing I asserted while
// arguing for keeping code I had just shown to be worth nothing.
//
// That is the useful shape of the result, not just a personal correction: WIN RATE AND BOARD SHAPE
// ARE ALMOST ORTHOGONAL HERE. The one axis worth 0 points is the most visible; drawBias, which is
// worth essentially the entire ladder, leaves almost no visual trace (builder 24.9 vs architect 25.6
// in clustering, and those two differ by 0.09 of draw bias). A difficulty setting a player can SEE
// and a difficulty setting a player can BEAT are two different design levers, and this ladder happens
// to have one of each.
//
// ── AND THE BOTTOM RUNG IS VISIBLE TOO ───────────────────────────────────────────────────────────
// apprentice clusters 15.6 against builder's 24.9 · about 37% less clumped, in every block, with a
// between-block spread under 0.8. Random placement leaves an obviously scattered board. So the
// answer to "can a player see which rung they are playing" is YES on both steps, by two different
// mechanisms: the bottom step is scattered, the top step is even.
//
// ── ONE THING THE SPREAD METRIC DOES NOT DO, stated so nobody reads the table as a ladder ────────
// Region spread is NON-MONOTONE across the rungs: apprentice 12.0, builder 15.2, architect 9.5.
// BUILDER IS THE MOST LOPSIDED PLAYER ON THE BOARD. Random placement scatters evenly by accident,
// affinity placement concentrates deliberately, and only defendWorst evens up on purpose. This is a
// reported observation and is deliberately not gated · it is a property of the current policies, not
// a requirement on them.

import { describe, it, expect } from 'vitest'
import { playOnce, bots, makeReporter } from './ladderHarness'
import { DIFFICULTIES, POLICIES } from '../lib/botPolicy'

const SEEDS = Number(process.env.VIS_SEEDS || 12)
const OFFSET = Number(process.env.VIS_OFFSET || 0)
const seeds = Array.from({ length: SEEDS }, (_, i) => 6000 + OFFSET + i * 17)
const report = makeReporter('VIS_OUT')

const spread = (scoreMap) => {
  const v = Object.values(scoreMap ?? {}).map(x => x ?? 0)
  return v.length ? Math.max(...v) - Math.min(...v) : 0
}

/** Self-play a policy and average the two seats' board shape over the block. */
function boardShape(policy) {
  let cluster = 0, sprd = 0, n = 0
  for (const seed of seeds) {
    const g = playOnce(bots(policy, policy), seed)
    for (let seat = 0; seat < 2; seat++) {
      cluster += g.seats[seat].cluster
      sprd += spread(g.scores[seat])
      n++
    }
  }
  return { cluster: +(cluster / n).toFixed(2), spread: +(sprd / n).toFixed(2), samples: n }
}

describe(`ladder visibility · is the difference on the BOARD, not just the scoreboard (${SEEDS} seeds)`, () => {
  // ── COUNTERWEIGHT, FIRST (Rule 90) ──────────────────────────────────────────────────────────────
  // The way this file certifies a confident nothing is that the two metrics cannot discriminate
  // ANYTHING · a cluster total that is constant regardless of placement policy, or a spread that is
  // always zero because nobody ever scores. Either would report "the policies look identical" and
  // that reads exactly like the finding I am testing for. So both metrics are first shown to move
  // between two policies that differ maximally on the axis each one is supposed to see.
  it('both metrics can discriminate at all', () => {
    const affinity = boardShape('builder')
    const random = boardShape({ ...POLICIES.builder, placement: 'random' })
    report('counterweight', { affinity, random })

    expect(affinity.cluster, 'nobody clustered anything · getClusterTotal is returning 0 for every ' +
      'seat and the clustering metric is measuring nothing').toBeGreaterThan(0)
    expect(affinity.spread + random.spread, 'every region finished on the same score in every game · ' +
      'the spread metric cannot see anything').toBeGreaterThan(0)
    expect(affinity.cluster, 'affinity placement did not out-cluster random placement · the ' +
      'clustering metric cannot distinguish the one axis it exists to see, so a null result below ' +
      'would be the instrument and not the policies').toBeGreaterThan(random.cluster)
  }, 300_000)

  it('reports what each shipped rung does to a board', () => {
    const shapes = Object.fromEntries(DIFFICULTIES.map(l => [l, boardShape(l)]))
    // The isolated architect axis, so the claim is tested on the FEATURE and not on the rung, which
    // also differs in draw bias.
    const builderPlusDefend = boardShape({ ...POLICIES.builder, defendWorst: true })
    report('S51_visibility', { ...shapes, builderPlusDefend })

    // GATED · the clustering difference, because it is the one that is structural rather than a
    // matter of degree: apprentice places at random and builder places for adjacency, so if their
    // boards are equally clumped then `placement` is not doing what its name says and the ladder's
    // bottom rung differs from the middle one in nothing a player could ever see.
    expect(shapes.apprentice.cluster, `apprentice clustered ${shapes.apprentice.cluster} against ` +
      `builder's ${shapes.builder.cluster}. The ONLY thing separating these two rungs is placement ` +
      'quality · if it leaves no mark on the board, the bottom of the ladder is invisible')
      .toBeLessThan(shapes.builder.cluster)

    // REPORTED, NOT GATED · the region spread. Gating it would pin my own S50 justification into a
    // test before the measurement has been repeated across blocks, which is exactly the "assert the
    // thing you hope is true" move. The number goes in the doc; see the header for what it decides.
  }, 600_000)
})
