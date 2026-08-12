// WHAT IS THE RULEBOOK DIVERGENCE WORTH?  (T2 S53 · P1)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// S52 read the printed rulebook's page 6 and found the shipped granter diverges from it TWICE:
//
//                    printed rulebook (p6 + setup step 8)        shipped code
//   award rule       "the token ON TOP OF THE PILE"              threshold -> its own token type
//   pile depth       3 stacks of FOUR tiles  (12 tokens)         3 tokens  (9)
//
// That matters because S51's headline · 36% of threshold crossings award nothing at two players,
// 51% at four · is the evidence that closed the S38 open question, and it is computed against a pool
// the printed book says is a quarter larger. My measurement, in the load-bearing position, possibly
// wrong by a third of its denominator.
//
// ── THE THING I FOUND WHILE DESIGNING THIS, AND IT RESHAPED THE EXPERIMENT ───────────────────────
// The brief asked for "depth 4 against depth 3". THAT IS NOT MEASURABLE ON ITS OWN, and the reason is
// in the granter (gameStore.js:500):
//
//     const i = r.bonusPile?.findIndex(b => b.threshold === t && !b.claimed)
//
// A token is found BY ITS THRESHOLD. SCORE_THRESHOLDS is [7, 13, 18], so a FOURTH token can only ever
// be claimed if it carries one of those three values · and nobody knows which, because nobody knows
// what the fourth tile is. Under the shipped award rule a fourth tile is INERT: it sits in the pile
// and no crossing can ever match it.
//
// SO THE TWO DIVERGENCES ARE COUPLED. Depth only does anything if the award rule is top-of-pile,
// because a stack does not consult a threshold at all · it just hands over the next tile. Measuring
// depth alone would have produced an exact zero, and an exact zero that is an artifact of the OTHER
// divergence is the worst possible answer to hand back (Rule 73: check whether the term can matter).
//
// ── THE THREE ARMS, AND ALL THREE ARE GUESS-FREE (Rule 32) ───────────────────────────────────────
//   A · SHIPPED      threshold-matched, depth 3   the code today
//   C · BOOK RULE    top-of-pile,       depth 3   isolates the AWARD RULE
//   B · BOOK         top-of-pile,       depth 4   adds DEPTH on top of the award rule
//
// Nothing here needs to know the fourth tile's TYPE or THRESHOLD: top-of-pile consults neither, and
// an unspent token scores by COUNT (calculateFinalScore's 2nd arg is `unusedBonusCount`, called with
// `player.bonusTokens.length` at gameStore.js:734). Verified at the artifact before writing a line.
//
// ⚠ SCOPE, because "type-independent" is true in a narrower sense than it sounds. Types DO matter
// when a token is SPENT · useBonus implements subsidy / initiative / automatization differently and
// silently rejects a type it does not handle. The bots here spend nothing (botPolicy.js contains zero
// references to bonus state), so every token is unspent and scores its flat 3. This measures the
// SCORING consequence of the divergence, which is the half that decides whether the two games differ
// on a mechanic players feel. It does not measure the spending consequence, and cannot until the
// fourth tile has a name.
//
// ── WHY THIS IS AN EXACT CONTROL, NOT A PAIRED-SEED ONE (Rule 74) ────────────────────────────────
// Bots read no bonus state, so who holds a token changes no decision. One game is played ONCE and
// scored THREE WAYS from its recorded crossing sequence. Not three samples of three rule-sets · the
// same games, three scorings. That is the property S48's flat-grant experiment had and the two
// spending sessions had to give up.

// ══ MEASURED · THREE DISJOINT 40-SEED BLOCKS (PILE_OFFSET 0 / 500 / 1000) ════════════════════════
//
//   builder self-play          contested crossings        tokens per game
//   A · shipped  (thresh, 3)   32.7 / 33.6 / 31.1 = 32.5%       4.52
//   C · book rule (stack, 3)   22.2 / 27.2 / 23.4 = 24.3%       5.07
//   B · book      (stack, 4)   10.5 / 13.2 / 10.6 = 11.4%       5.93
//
//   apprentice v architect     33.0 / 33.6 / 34.1 = 33.6%  ->  21.0 / 21.1 / 19.9 = 20.7%
//                                                          ->   9.8 /  8.8 /  8.2 =  8.9%
//
// ── THE ANSWER, IN THE TERMS THE QUESTION WAS ASKED IN ───────────────────────────────────────────
// The brief set the two outcomes in advance: "36% -> 30% makes the discrepancy a footnote; 36% -> 12%
// means 'if any' is a rare edge in the real game and routine in ours."
//
//   IT IS THE SECOND. 32.5% -> 11.4%, a 65% reduction. Not a footnote.
//
// AND THE DECOMPOSITION SAYS WHICH HALF, which is why both arms were needed:
//   award rule alone (A -> C)   32.5% -> 24.3%    worth ~8 points
//   depth on top     (C -> B)   24.3% -> 11.4%    worth ~13 points
// DEPTH IS THE BIGGER HALF · and depth is the half that is INERT under the shipped award rule. Fix
// only the award rule and you buy a quarter of the gap; fix only the depth and you buy nothing at all.
//
// ── BUT THE WIN RATE DOES NOT MOVE, AND THAT IS THE OTHER HALF OF THE ANSWER ─────────────────────
// builder self-play is EXACTLY 50.0 in all three arms in all three blocks (structural · identical
// policies). apprentice-v-architect: A 13.9/12.7/11.4, C 15.0/11.4/10.0, B 15.0/12.5/11.4 · means of
// 12.7 / 12.1 / 13.0, with the between-BLOCK spread larger than the between-ARM spread. No direction.
//
// So the divergence is worth a great deal to how the game FEELS · under the printed rules a threshold
// crossing pays about eight times in nine, under ours about two times in three · and essentially
// nothing to who WINS. Those license different decisions, and conflating them is how a balance number
// gets spent on an experience problem or the reverse (Rule 106's shape).
//
// STATED PRECISELY, because the brief's phrasing invites one overstatement: 11.4% is NOT "rare". One
// crossing in nine still awards nothing under the printed rules, so "if any" is a real clause in the
// physical game too · it is simply a third as common as ours makes it.
//
// ⚠ WHAT THIS DOES NOT SETTLE. Which arm is CORRECT. That is the photograph of setup step 8, and this
// measurement exists so the photograph confirms a number instead of starting a new question. If the
// stacks turn out to be 4 deep and top-of-pile, arm B is the target and the shipped game is three
// times harsher than the printed one at the moment a player crosses a threshold.

import { describe, it, expect } from 'vitest'
import { playOnce, bots, makeReporter } from './ladderHarness'
import { DIFFICULTIES } from '../lib/botPolicy'

const SEEDS = Number(process.env.PILE_SEEDS || 12)
const OFFSET = Number(process.env.PILE_OFFSET || 0)
const seeds = Array.from({ length: SEEDS }, (_, i) => 4000 + OFFSET + i * 19)
const report = makeReporter('PILE_OUT')

/**
 * Replay an award rule against a recorded crossing sequence.
 * `mode` 'threshold' matches each crossing to a token of its own threshold (the shipped rule);
 * 'stack' hands over the next unclaimed tile in the region regardless of which threshold was crossed.
 * Returns tokens per seat and the number of crossings that awarded nothing.
 */
function award(crossings, seats, { mode, depth }) {
  const tokens = Array.from({ length: seats }, () => 0)
  const pile = {}                                   // regionId -> remaining state
  let contested = 0
  for (const c of crossings) {
    if (!pile[c.regionId]) {
      pile[c.regionId] = mode === 'threshold'
        ? { byThreshold: new Set([7, 13, 18]) }     // one tile per threshold, depth is implicitly 3
        : { left: depth }                           // a stack: just a count
    }
    const p = pile[c.regionId]
    if (mode === 'threshold') {
      if (p.byThreshold.has(c.threshold)) { p.byThreshold.delete(c.threshold); tokens[c.seat]++ }
      else contested++
    } else {
      if (p.left > 0) { p.left--; tokens[c.seat]++ }
      else contested++
    }
  }
  return { tokens, contested }
}

const ARMS = [
  { key: 'A_shipped', mode: 'threshold', depth: 3, label: 'shipped · threshold-matched, 3' },
  { key: 'C_stack3', mode: 'stack', depth: 3, label: 'book award rule · top-of-pile, 3' },
  { key: 'B_stack4', mode: 'stack', depth: 4, label: 'book · top-of-pile, 4' },
]

function measure(levels) {
  const n = levels.length
  const acc = Object.fromEntries(ARMS.map(a => [a.key, { tokens: 0, contested: 0, winsA: 0, winsB: 0, margin: 0 }]))
  let games = 0, crossingsTotal = 0, shippedMatches = 0

  for (const seed of seeds) {
    for (const swap of [false, true]) {
      const order = swap ? [...levels].reverse() : levels
      const g = playOnce(bots(...order), seed)
      games++
      crossingsTotal += g.crossings.length
      // aSeat is the seat holding levels[0] this orientation · the swap cancels seat advantage.
      const aSeat = swap ? n - 1 : 0, bSeat = n - 1 - aSeat

      for (const arm of ARMS) {
        const { tokens, contested } = award(g.crossings, n, arm)
        const a = acc[arm.key]
        a.tokens += tokens.reduce((s, x) => s + x, 0)
        a.contested += contested
        const sA = g.seats[aSeat].base + 3 * tokens[aSeat]
        const sB = g.seats[bSeat].base + 3 * tokens[bSeat]
        a.margin += sA - sB
        if (sA > sB) a.winsA++; else if (sB > sA) a.winsB++
        // COUNTERWEIGHT DATA · the shipped arm must reproduce the REAL token counts exactly.
        if (arm.key === 'A_shipped') {
          if (tokens.every((t, i) => t === g.seats[i].earned)) shippedMatches++
        }
      }
    }
  }
  const out = { games, crossingsPerGame: +(crossingsTotal / games).toFixed(2), shippedMatches }
  for (const arm of ARMS) {
    const a = acc[arm.key]
    out[arm.key] = {
      tokensPerGame: +(a.tokens / games).toFixed(2),
      contestedPerGame: +(a.contested / games).toFixed(2),
      contestedPct: crossingsTotal ? +(100 * a.contested / crossingsTotal).toFixed(1) : 0,
      winPct: (a.winsA + a.winsB) ? +(100 * a.winsA / (a.winsA + a.winsB)).toFixed(1) : 50,
      margin: +(a.margin / games).toFixed(2),
    }
  }
  return out
}

describe(`pile depth and award rule · what the rulebook divergence is worth (${SEEDS} seeds)`, () => {
  // ── COUNTERWEIGHT, FIRST AND ALONE (Rule 90) ────────────────────────────────────────────────────
  // THE REPLAY IS A MODEL OF THE GRANTER, and a model that has drifted from the system reports a
  // confident difference between two things it invented (Rule 36). Two ways it goes wrong and both
  // look like findings: the crossing SEQUENCE could be mis-derived (wrong count, wrong order), or the
  // shipped arm's award logic could disagree with gameStore's.
  //
  // So before any arm is compared: replaying the SHIPPED rule against the recorded sequence must
  // reproduce the REAL per-seat token counts EXACTLY, in every game. Not approximately · exactly.
  // That single assertion validates the derivation and the replay together, and it is the only thing
  // standing between this file and three numbers about nothing.
  it('replaying the SHIPPED rule reproduces the real token counts exactly', () => {
    const r = measure(['builder', 'builder'])
    report('counterweight', { games: r.games, shippedMatches: r.shippedMatches, crossingsPerGame: r.crossingsPerGame })

    expect(r.crossingsPerGame, 'no threshold crossings were recorded at all · the sequence derivation ' +
      'is broken and every arm below is scoring an empty list').toBeGreaterThan(1)
    expect(r.shippedMatches, `the shipped replay reproduced the engine's real token counts in only ` +
      `${r.shippedMatches} of ${r.games} games. The model has drifted from the granter, so the ` +
      'differences between arms below are differences between two inventions of mine, not between ' +
      'two rules (Rule 36). Fix the model · do not interpret the numbers.').toBe(r.games)
  }, 300_000)

  it('measures the shipped rule against both halves of the rulebook divergence', () => {
    const rows = {}
    rows.builder_self = measure(['builder', 'builder'])
    rows.app_v_arc = measure(['apprentice', 'architect'])
    rows.ladder = measure([DIFFICULTIES[0], DIFFICULTIES[1]])
    report('S53_pile_depth', rows)

    const self = rows.builder_self
    // GATED · the two structural facts, both threshold-free.
    // 1 · The book's award rule must be at least as generous as the shipped one. A stack of the same
    //     depth can never award FEWER tokens than threshold matching, because every crossing that
    //     matches its own threshold also finds a non-empty stack at that point. If this inverts, the
    //     replay is wrong in a way the counterweight did not catch.
    expect(self.C_stack3.tokensPerGame, 'top-of-pile at the SAME depth awarded fewer tokens than ' +
      'threshold-matching · that is impossible, so the stack replay is wrong')
      .toBeGreaterThanOrEqual(self.A_shipped.tokensPerGame)
    // 2 · And a deeper stack cannot award fewer than a shallower one.
    expect(self.B_stack4.tokensPerGame, 'a 4-deep stack awarded fewer tokens than a 3-deep one')
      .toBeGreaterThanOrEqual(self.C_stack3.tokensPerGame)

    // NOT GATED · the sizes. They are the finding, and a bound on them would be me pinning a number
    // the printed rulebook is about to settle from a photograph.
  }, 900_000)
})
