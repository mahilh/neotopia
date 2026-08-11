import { test, expect } from 'vitest'
import { REFERENCE_POLICY, DIFFICULTIES } from '../lib/botPolicy'
import { ladderRow, makeReporter } from './ladderHarness'

// T2 S48 · IS THE 23x EARN GAP REDUNDANT WITH SKILL, OR COMPOUNDING IT?
//
// THE QUESTION, and it is the last open one in the bonus-token subsystem. Tokens are earned by
// crossing score thresholds at 7/13/18, so earning is a function of SCORING SPEED and therefore
// already favours whoever is winning. Measured in S47: architect 6.3 tokens/game against the
// reference's 1.3, apprentice 0.27 · roughly 23x across the ladder's ends, which at 3 points an
// unspent token is ~15 points of final score for one end and ~0.8 for the other, before any decision.
//
// But architect wins 98.8% WITH NO TOKENS AT ALL. So the gap may simply be another symptom of being
// better rather than an extra advantage, and those two readings look identical in an outcome table
// while licensing opposite balance decisions. That is what this measures.
//
// ── WHY THIS IS A REDISTRIBUTION AND NOT THE "FLAT SCHEDULE" I WROTE IN THE ROADMAP ────────────────
// docs/T2_ROADMAP.md proposed granting tokens on a flat schedule, "one per player every N turns".
// That changes the token VOLUME and its TIMING at the same time as its distribution, so a difference
// in the result could not be attributed to any of the three. Shipping the roadmap's intent rather
// than its literal step (Rule 69):
//
//   THRESHOLD ARM · tokens go to whoever crossed, which is the shipped rule
//   FLAT ARM      · the SAME tokens, the SAME count, granted at the SAME moments, dealt round-robin
//
// Only the RECIPIENT changes. Volume, timing and type distribution are held byte-identical, so the
// difference between the arms is the skew and nothing else.
//
// ── AND IT IS AN EXACT CONTROL, WHICH S46 AND S47 COULD NOT BE (Rule 74) ───────────────────────────
// S46/S47 measured SPENDING, and a bot that spends makes different games · paired-seed statistical,
// with the arms diverging from the first spend. Here the token is UNSPENT, worth a flat 3 points, and
// botPolicy.js contains no reference to bonus state (asserted live in bonusBalance.test.js premise B,
// and re-asserted below). So moving a token between players changes ZERO decisions: each game is
// played ONCE and scored TWICE. Not a sampling difference between arms · the same games, both ways.
// That is the property S39 had and the two spending sessions gave up, and it is recoverable here for
// exactly the reason S39's was: the quantity under test is inert.
//
// SCOPE, stated rather than absorbed. This measures the SCORING half of the skew · what the 3-point
// term does when it is distributed by merit versus evenly. It does not measure a skewed distribution
// of SPENDABLE tokens, because redistributing a resource a bot then spends re-introduces divergence
// and answers a muddier question. S47 already measured that spending is fair between equals; this
// asks whether the earning skew adds to the outcome on top of the skill that produced it.

// playOnce / flatDeal / ladderRow / bots moved to ./ladderHarness.js (T2 S49). S49 asks a different
// question of the same machinery · whether the DIFFICULTY LADDER is internally spaced · and a second
// copy of a playout engine is exactly the duplication that produced the same deadlock-board bug in two
// lanes three sessions ago. The consolidation costs a second witness (Rule 94), which is why
// flatDeal's evenness is asserted below as an IDENTITY rather than as a tolerance.

// SEED COUNT · 40, WHICH IS THE SAME BLOCK THE REPORTED FINDING USES.
//
// This is deliberately NOT the pattern spendableBalance.test.js uses, and the difference is the point.
// That file gates 12 seeds while docs/BONUS_TOKEN_BALANCE.md reports 40-seed blocks run by hand, so
// the committed gate gates a sixth of the measurement it names · it will stay green forever while the
// reported table drifts, which is the citation-with-no-runner failure Rule 97 is about, in my own
// harness. I logged that as debt in the roadmap and then had the chance to not incur it again here.
//
// It is affordable because the design is exact: each seed plays TWO games and scores each of them
// TWICE, so a 40-seed rung costs 80 playouts rather than the 160 an equivalent two-arm statistical
// comparison would need. Measured end to end at 16.5s for all four rungs, against a 172s suite.
// If that ever becomes the wrong trade, LOWER IT AND SAY SO IN THE DOC · do not leave the doc
// claiming a block the gate does not run.
const SEEDS = Number(process.env.SPEND_SEEDS || 40)
const OFFSET = Number(process.env.SEED_OFFSET || 0)
const seedList = Array.from({ length: SEEDS }, (_, i) => 9000 + OFFSET + i)

const REPORT = makeReporter('SPEND_OUT')

test('the earn skew · does flattening the distribution change who wins?', () => {
  const rows = {}
  for (const level of DIFFICULTIES) rows[level] = ladderRow(level, REFERENCE_POLICY, seedList)
  // THE SYMMETRIC CONTROL, and it is not optional (Rule 98). Flattening COMPRESSES the token term
  // toward equality, which mechanically shrinks every margin · so it converts narrow losses into wins
  // more often than it converts wide wins into losses, and a side that wins big and loses narrowly
  // gains from it for reasons that have nothing to do with the skew under test. Every ladder rung has
  // exactly that shape against the reference, so without this row "flattening helps A" is unreadable:
  // it could be the finding or it could be a property of the redistribution. Identical policies both
  // sides · if flattening is neutral here, the ladder movements above are the matchup and not the
  // instrument. This is the row that decides whether the other three mean anything.
  rows.control = ladderRow(REFERENCE_POLICY, REFERENCE_POLICY, seedList)
  // Every counterweight below covers the control row as well · a guard that skips the control leaves
  // the one row whose job is to detect instrument bias as the only unguarded row in the file.
  const GUARDED = [...DIFFICULTIES, 'control']

  // ── COUNTERWEIGHTS FIRST (Rule 90) ───────────────────────────────────────────────────────────────
  // Four ways this experiment reports a confident nothing, in the order they are most likely.

  // 1 · THE REDISTRIBUTION NEVER MOVED A TOKEN. If flat == earned in every game the two scorings are
  //     identical and "flattening changes nothing" is produced by a flattening that never happened.
  //     This is the exact shape of award_game_win at 0 rows (Rule 80), and it is the assertion I would
  //     bet on being wrong. Sized against the game count, NOT against zero: S47's counterweight passed
  //     at 0.01 events per game and certified a comparison between hoarding and hoarding (Rule 106).
  for (const level of GUARDED) {
    const r = rows[level]
    expect(r.moved / r.games, `${level}: the flat deal changed nobody's token count in ` +
      `${r.games - r.moved} of ${r.games} games · the arms are the same scoring and every number ` +
      'below is a measurement of nothing').toBeGreaterThan(0.25)
  }

  // 2 · NO TOKENS WERE GRANTED AT ALL. The pile sat empty from S15 to S38 and nobody noticed for
  //     fifteen sessions, because an absent token and an unspent one both read as 0.
  for (const level of GUARDED) {
    expect(rows[level].tokensPerGame, `${level}: no bonus tokens were granted · the granter or the ` +
      'pile has regressed and this file is measuring an empty subsystem').toBeGreaterThan(1)
  }

  // 2b · AND THE FLAT ARM MUST ACTUALLY BE FLAT. Preserving the token TOTAL is not the same as
  //     distributing it EVENLY: a deal that hands the odd token to the same logical player every
  //     game passes every other guard in this file while quietly paying that player 1.5 points a
  //     game, in the arm whose only job is to be even. That is not hypothetical · the first version
  //     of flatDeal did exactly this (see its header), flatGap read +0.50 in 12 of 12 rung-blocks,
  //     and I read past it once because the number was small and the other three guards were green.
  //     THE FLAT ARM'S TOKEN GAP IS THE ONE QUANTITY THAT MUST BE ZERO BY CONSTRUCTION, so it is
  //     asserted rather than reported.
  //
  //     ⚠ S48 ASSERTED IT AS A RATE WITH A 0.15 TOLERANCE, WHICH WAS THE SAME MISTAKE ONE LEVEL DOWN.
  //     flatGap is an absolute imbalance DIVIDED BY THE GAME COUNT, so a bound on it means different
  //     things at different block sizes and needs re-tuning whenever SPEND_SEEDS moves · and T3 duly
  //     found it red at a smaller block in the shared tree while my own 40-seed run was green. I had
  //     criticised exactly this pattern in flatDeal's own header ("a bound correct at one block size
  //     and wrong at another is a flake with a delay on it") and then committed it one function down.
  //
  //     SO IT IS AN IDENTITY NOW. flatDeal gives the odd token to whichever side has had fewer, which
  //     bounds the WHOLE-BLOCK imbalance at ONE TOKEN by construction at any seed count. Nobody has
  //     to decide whether 0.15 is close enough, and this means precisely the same thing at 12 seeds
  //     as at 4000. When a guarantee can be made structural, prove it by identity rather than defend
  //     a tolerance (Rule 81's better half).
  for (const level of GUARDED) {
    expect(rows[level].flatTokenImbalance, `${level}: the "flat" arm dealt one side ` +
      `${rows[level].flatTokenImbalance} more tokens than the other ACROSS THE WHOLE BLOCK · that ` +
      'cannot exceed 1 unless flatDeal\'s self-correcting remainder is broken. The arm is not flat, ' +
      'so part of the difference between the arms is a bias I introduced, not the skew under test')
      .toBeLessThanOrEqual(1)
  }

  // 3 · VOLUME MUST BE PRESERVED EXACTLY. If the flat deal loses or invents a token, the flat arm is
  //     systematically poorer or richer and the whole difference is an artifact of my arithmetic
  //     rather than of the distribution. This is the one confound the roadmap's "flat schedule"
  //     design could not avoid, so it is the one this design has to prove it avoided.
  for (const level of GUARDED) {
    expect(rows[level].volumePreserved, `${level}: the flat deal did not preserve the token total · ` +
      'the arms differ in VOLUME as well as distribution and nothing here isolates the skew').toBe(true)
  }

  // 4 · THE EXACTNESS CLAIM ITSELF, which is the whole reason this design is worth more than S46's.
  //     Both arms come from ONE playout, so the non-token part of every score is identical and the
  //     margin difference must equal exactly 3x the token-count difference · arithmetic, not a
  //     tendency. If a future edit re-plays the game for the flat arm (the obvious "cleaner" rewrite),
  //     the games diverge, this identity breaks, and the exact control has silently become a
  //     statistical one while every other number still looks fine.
  //     THE FIRST DRAFT OF THIS ASSERTION COULD NOT FAIL and I nearly shipped it: it derived the flat
  //     token gap by rearranging the identity it then checked, so both sides came from one source
  //     (Rule 92a). The four quantities below are accumulated INDEPENDENTLY inside the play loop ·
  //     two margins summed from scores, two token gaps summed from counts · so the identity is a
  //     genuine cross-check and goes red the moment the arms stop sharing a base.
  for (const level of GUARDED) {
    const { marginEarned, marginFlat, earnGap, flatGap } = rows[level].raw
    expect(Math.abs((marginEarned - marginFlat) - 3 * (earnGap - flatGap)), `${level}: the two arms ` +
      'do not share a base score · this is no longer ONE GAME SCORED TWICE, so the exact control ' +
      'claimed in this file header is gone and every delta below carries sampling noise').toBeLessThan(1e-9)
  }

  // ── AND THE LADDER MUST STILL BE A LADDER, or nothing compares to S39/S47 ────────────────────────
  // ⚠ T2 S50 · THIS PAIR USED TO READ, and both halves have now been falsified by a legitimate change:
  //       expect(rows.apprentice.winPctEarned).toBeLessThan(40)   // apprentice must LOSE to the reference
  //       expect(rows.architect.winPctEarned).toBeGreaterThan(80)
  // They were written against ladder v1, where the rungs straddled the frozen reference (5.1 / 77.2 /
  // 98.8). The S50 retune pulled the rungs together so they are playable against each other, and a
  // ladder whose rungs are ~35 points apart is necessarily close to any third party too · so the whole
  // ladder now sits ABOVE the reference (60.0 / 66.7 / 84.8) and "apprentice must lose to it" is
  // simply false. Nothing regressed; an assumption I never wrote down expired.
  //
  // THE ASSUMPTION WAS THE STRADDLE, and it was invisible because it was true. That is Rule 111 in the
  // place I would least expect it after writing Rule 111: not a constant at every call site this time,
  // but a POSITIONAL relationship between the subject and the yardstick, baked into a threshold.
  //
  // WHAT SURVIVES IS THE ORDERING, and it needs no threshold at all · it is three comparisons against
  // ONE common opponent, and it is the only thing this file needs from the ladder in order for its own
  // measurement to be readable. Magnitudes are deliberately not gated here: under a calibrated ladder
  // they are small BY DESIGN, so any floor on them would be encoding a spacing target, which belongs
  // in ladderSpacing.test.js and ladderCalibration.test.js where it is the subject rather than a
  // background assumption.
  // ⚠ ONLY THE ARCHITECT IS SEPARABLE BY THIS YARDSTICK UNDER v2. The rungs sit ~6.7 points apart
  // against the frozen reference (v1: 72 apart), so no block any gate here can afford resolves
  // apprentice from builder · spendableBalance's copy of this assertion inverted them at
  // SEED_OFFSET=500, and botPolicy.test.js inverted them on win rate at 10 seeds. Asserting the
  // bottom-two order would be asserting more resolution than the comparison has, which is how a gate
  // becomes a coin flip nobody trusts (Rule 88c). docs/LADDER_CALIBRATION.md Part 3 tradeoff 2.
  expect(rows.architect.winPctEarned, 'architect must sit above builder against the reference')
    .toBeGreaterThan(rows.builder.winPctEarned)
  expect(rows.architect.winPctEarned, 'architect must sit above apprentice against the reference')
    .toBeGreaterThan(rows.apprentice.winPctEarned)

  const out = {}
  for (const level of [...DIFFICULTIES, 'control']) {
    const r = rows[level]
    out[level] = {
      winEarned: r.winPctEarned, winFlat: r.winPctFlat,
      winDelta: +(r.winPctEarned - r.winPctFlat).toFixed(1),
      marginEarned: r.marginEarned, marginFlat: r.marginFlat,
      // THE QUANTITY THE DECISION RESTS ON (Rule 96). 15 points of token edge is alarming or
      // irrelevant depending entirely on what it is added to, and the win rate cannot say which
      // because both ends of the ladder are pinned against a bound (Rule 88). This is the token
      // term as a fraction of the skill margin it sits on top of.
      tokenShareOfMargin: r.marginFlat === 0 ? null
        : +Math.abs(3 * r.earnGap / r.marginFlat).toFixed(3),
      flips: r.flips, flipPct: +(100 * r.flips / r.games).toFixed(1),
      earnGap: r.earnGap, flatGap: r.flatGap, movedPct: +(100 * r.moved / r.games).toFixed(1),
      earnedA: r.earnedPerGameA, earnedB: r.earnedPerGameB,
      tokensPerGame: r.tokensPerGame, games: r.games,
    }
  }
  REPORT('S48_flat_grant', out)

  // ── WHAT IS GATED AND WHAT IS NOT (Rule 88c) ─────────────────────────────────────────────────────
  // GATED · the four counterweights above and the ladder ordering. They are what would break first if
  //         this stopped measuring the right thing, and three of the four are exact rather than
  //         statistical, so they cannot flake.
  // NOT GATED · the finding itself (how far winFlat sits from winEarned). It is a rate on 24 games at
  //         the committed seed count and would flake; the reported measurement runs 40 seeds and
  //         lives in docs/BONUS_TOKEN_BALANCE.md with the commit it was taken at.
  // COARSE · one backstop, below. Flattening the token distribution entirely must not re-order the
  //         ladder · if it ever does, the token term has become a primary driver of outcomes rather
  //         than a garnish on one, and that is a balance emergency rather than a tuning question.
  //
  // ⚠ S48 WROTE THIS AS `apprentice.winPctFlat < 50` AND `architect.winPctFlat > 70`, AND BOTH
  // NUMBERS CAME OUT OF THE VERY MEASUREMENT THEY GUARD. I flagged that pattern in my own closing
  // note the same night: a wire sized to what a run happened to produce is a flake with a delay, and
  // 70 in particular had no derivation at all · it was "below the 98.8 I saw, with room".
  //
  // DERIVED FROM THE CONTROL INSTEAD. rows.control is identical policies on both sides, so it sits at
  // 50.0 for a STRUCTURAL reason rather than an observed one, and it is measured in the same run on
  // the same commit. The claim worth gating is not "the architect stays above some remembered
  // number" · it is THE LADDER IS STILL ORDERED, and ordering is a comparison, not a threshold:
  //     apprentice < control < architect,
  // with a margin wide enough that a tie cannot pass. Everything on the right-hand side is measured
  // here; nothing is a number I once saw. If the whole ladder shifts for a legitimate reason, this
  // follows it instead of reddening (Rule 88c), and if flattening genuinely re-orders the rungs it
  // still fires.
  // ⚠ T2 S50 · AND THE CONTROL-DERIVED FORM WAS STILL CARRYING THE SAME BURIED ASSUMPTION.
  // S49 replaced two remembered numbers (50 and 70) with `ctrl - 10` and `ctrl + 10`, and that fixed
  // the right half of the problem · the bound now moves with the run instead of with my memory. But
  // it still asserted a POSITION relative to the control, which silently required the apprentice to
  // be below the reference and the architect above it. Under v2 the apprentice is above it, so the
  // improved wire went red on working code exactly as the original would have.
  //
  // The lesson is one level past S49's: deriving a bound from a control measured in the same run
  // removes the STALE-NUMBER failure and not the STRUCTURAL-ASSUMPTION one. `ctrl - 10` reads as
  // "measured, therefore safe" and it is still a claim about where the subject sits relative to the
  // yardstick. An ORDERING among the rungs makes no such claim: it compares things that are all
  // moving together, so a wholesale shift of the ladder carries it along instead of breaking it,
  // which is precisely the event that happened here.
  const ctrl = rows.control.winPctFlat
  expect(rows.architect.winPctFlat, `under flattening the architect (${rows.architect.winPctFlat}%) fell ` +
    `below the apprentice (${rows.apprentice.winPctFlat}%) against the same opponent · the token term ` +
    'has become a primary driver of outcomes rather than a garnish on one, which is a balance ' +
    'emergency rather than a tuning question').toBeGreaterThan(rows.apprentice.winPctFlat)
  expect(rows.architect.winPctFlat, 'flattening re-ordered architect and builder')
    .toBeGreaterThan(rows.builder.winPctFlat)
  // The control is a SYMMETRIC matchup, so it is the one row whose flat win rate is pinned to 50 for
  // a structural reason. Every asymmetric row must be distinguishable from it in the direction its
  // matchup implies · this is the check that the flat arm has not simply collapsed everything to a
  // coin flip, and it is stated against the measured control rather than against 50.
  expect(rows.architect.winPctFlat, `the architect is indistinguishable from a symmetric ${ctrl}% ` +
    'control under flattening · the flat arm has collapsed the matchup').toBeGreaterThan(ctrl + 5)

  // AND THE CONTROL MUST BE A CLEAN NULL IN BOTH ARMS.
  // ⚠ I WROTE PLAUSIBLE NUMBERS INTO THIS COMMENT BEFORE RUNNING IT · "48.8/51.2/50.0/48.8, never
  // differing by more than 1.3 points" · which is a guess wearing a measurement's clothes, and the
  // second time in three sessions (Rule 104's corollary). The real figures are cleaner than my guess
  // and that is not luck I get to keep: measured across four disjoint 40-seed blocks, 320 games,
  //     earned 50.0 / 50.0 / 50.0 / 50.0      flat 50.0 / 50.0 / 50.0 / 50.0      delta 0.0 in 4/4
  // and the instrument is NOT idle while producing that zero · it flipped 16/10/10/4 individual games
  // per 80, because within a single game one side often earns 3 and the other 1 and the flat deal
  // makes it 2/2. So the control demonstrates the redistribution WORKS and has no side, which is
  // exactly the pair of facts the ladder rows need in order to mean anything.
  // Bounded at 42-58 and 5 points rather than at the observed exactness · a wire set to what a
  // measurement happened to produce is a flake waiting for the first legitimate change (Rule 88c).
  expect(rows.control.winPctEarned, 'identical policies must tie under the shipped rule').toBeGreaterThan(42)
  expect(rows.control.winPctEarned, 'identical policies must tie under the shipped rule').toBeLessThan(58)
  expect(Math.abs(rows.control.winPctEarned - rows.control.winPctFlat), 'flattening moved a SYMMETRIC ' +
    `matchup by ${(rows.control.winPctEarned - rows.control.winPctFlat).toFixed(1)} points · the ` +
    'redistribution has a direction of its own, so every ladder number above is partly measuring the ' +
    'instrument rather than the skew').toBeLessThanOrEqual(5)
}, 600_000)

// The premise this file's exactness rests on, asserted here as well as in bonusBalance.test.js.
// Duplicated ON PURPOSE and the duplication is the point: bonusBalance's copy protects a claim about
// SEEDING, this one protects a claim about REDISTRIBUTION, and a reader of either file should not
// have to know the other exists to know why one-game-scored-twice is legitimate. If botPolicy ever
// reads bonus state both go red, which is correct · they are two claims with one shared premise, not
// one claim checked twice (Rule 45 does not apply to a premise, only to a rule).
test('PREMISE · bots are token-blind, so moving a token changes no decision', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  for (const f of ['lib/botPolicy.js', 'hooks/useBotTurns.js']) {
    const src = readFileSync(join(process.cwd(), 'src', f), 'utf8')
    expect(/bonus/i.test(src), `${f} now reads bonus state · redistributing a token can change a ` +
      'DECISION, so the two scorings are no longer the same game and this file\'s exact control is ' +
      'gone. RE-POINT this experiment at a paired-seed design; do not just widen the bound.').toBe(false)
  }
})
