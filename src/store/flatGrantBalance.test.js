import { test, expect } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'
import { chooseBotAction, makeRng, REFERENCE_POLICY, DIFFICULTIES } from '../lib/botPolicy'
import { calculateFinalScore, getClusterTotal } from '../lib/patternMatcher'

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

const api = () => useGameStore.getState()
const shuffled = (arr, rng) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// One game, played once. Returns everything both scorings need · the per-seat region scores and
// cluster bonus (identical in both arms by construction) plus the token grants in ORDER.
function playOnce(configs, seed) {
  useGameStore.setState(useGameStore.getInitialState(), true)
  const rng = makeRng(seed)
  api().initGame(configs, shuffled(PROJECT_CARDS, rng), shuffled(PRODUCTION_TILES, rng))
  let lastPlacedKey = null
  const heldPrev = configs.map(() => 0)
  const grantOrder = []   // the seat that earned each token, in the order the tokens were granted

  for (let i = 0; i < 4000 && api().phase === 'playing'; i++) {
    const s = api(); const seat = s.currentSeat
    for (let k = 0; k < configs.length; k++) {
      const held = s.players.find(x => x.seat === k)?.bonusTokens.length ?? 0
      for (let n = heldPrev[k]; n < held; n++) grantOrder.push(k)
      heldPrev[k] = held
    }
    const a = chooseBotAction({
      state: api(), seat, difficulty: configs[seat].difficulty,
      getValidPlacements: api().getValidPlacements, getBuildableCards: api().getBuildableCards, lastPlacedKey, rng,
    })
    if (a.type === 'placeElement') { api().placeElement(seat, a.factoryId, a.elementType, a.q, a.r, a.regionId); lastPlacedKey = `${a.q},${a.r}` }
    else if (a.type === 'scoreCard') { api().scoreCard(seat, a.cardId, a.regionId, a.lastPlacedKey); lastPlacedKey = null }
    else if (a.type === 'drawCard') api().drawCard(seat, a.source, a.cardIndex)
    else { api().endTurn(); lastPlacedKey = null }
  }
  // Final sweep · a token granted by the last scoring action would otherwise be missed.
  const st = api()
  for (let k = 0; k < configs.length; k++) {
    const held = st.players.find(x => x.seat === k)?.bonusTokens.length ?? 0
    for (let n = heldPrev[k]; n < held; n++) grantOrder.push(k)
  }
  return {
    grantOrder,
    seats: configs.map((_, seat) => {
      const p = st.players.find(x => x.seat === seat)
      return {
        // calculateFinalScore is best + second + 3*worst + 3*unusedTokens + cluster · the token term is
        // purely additive, so a base computed with 0 tokens plus 3*n is EXACTLY the real score. Taking
        // the base from the real function rather than re-deriving the formula keeps this from becoming
        // a second scoring engine (Rule 45).
        base: calculateFinalScore(p.scores, 0, getClusterTotal(st.regions, seat)),
        earned: p.bonusTokens.length,
      }
    }),
  }
}

const bots = (...levels) => levels.map((difficulty, i) => ({ userId: null, username: `B${i}`, isBot: true, difficulty }))

// The flat deal: token i goes to seat i % nSeats, so an odd total leaves the extra token on SEAT 0.
//
// ⚠ THE FIRST VERSION ALTERNATED THE RECIPIENT PER GAME AND THAT WAS A BIAS, NOT A FIX. It took a
// `parity` that flipped once per game so the extra token "would not always land on seat 0". But the
// duel's own loop flips the orientation once per game too · `for (const swap of [false, true])` ·
// so the two alternations LOCKED IN PHASE and logical player A received the odd token in every
// single game. Measured: flatGap sat at +0.50 in all twelve rung-blocks when it must sit at 0, worth
// a silent +1.5 points per game to whichever side was under test, in the arm whose entire claim is
// that it is even. A randomisation scheme that shares a period with the thing it is meant to balance
// against does not balance anything · and volume, movement and the exactness identity all stayed
// green while it was wrong, which is why `flatGap` is now a counterweight rather than a report field.
//
// THE SECOND VERSION LEANED ON THE ORIENTATION SWAP and that was better but still seed-count
// dependent: "extra always to seat 0" is even across a seed's two orientations only when both games
// have the same token-count parity, so a residual survived and it grew as the block shrank. It held
// at 40 seeds (|flatGap| <= 0.09) and BROKE THE GATE AT 12 · which I found only because a teeth-check
// run at the smaller count went red before any mutation was applied. A bound that is correct at one
// block size and wrong at another is a flake with a delay on it, and SPEND_SEEDS is an env override
// anyone can turn down.
//
// SO THE REMAINDER IS SELF-CORRECTING INSTEAD OF BALANCED-IN-EXPECTATION. Each side's count is the
// even split; when the total is odd the extra token goes to whichever LOGICAL side has received
// fewer extras so far. That bounds the whole-block imbalance at ONE token no matter how many games
// are played, so |flatGap| <= 1/games at every seed count and the 0.15 wire means the same thing at
// 12 seeds as at 400. Fixing the instrument beats widening the tolerance that caught it.
//
// For two seats a round-robin over grantOrder is exactly this even split, so the order is not needed
// to compute the deal · it is kept because it is the honest record of WHICH grants happened and it
// generalises to more seats, where the round-robin is the actual rule.
function flatDeal(totalTokens, extras) {
  const half = Math.floor(totalTokens / 2)
  const deal = { a: half, b: half }
  if (totalTokens % 2) {
    if (extras.a <= extras.b) { deal.a++; extras.a++ } else { deal.b++; extras.b++ }
  }
  return deal
}

// Play `seeds` x 2 orientations ONCE each, and score every game both ways.
function ladderRow(levelA, levelB, seeds) {
  let earnedWinsA = 0, earnedWinsB = 0, flatWinsA = 0, flatWinsB = 0
  let marginEarned = 0, marginFlat = 0, flips = 0, moved = 0
  let tokensA = 0, tokensB = 0, flatA = 0, flatB = 0, totalTokens = 0, games = 0
  let volumePreserved = true
  const extras = { a: 0, b: 0 }   // whole-block ledger of the odd token · keeps the flat deal even

  for (const seed of seeds) {
    for (const swap of [false, true]) {
      const configs = bots(swap ? levelB : levelA, swap ? levelA : levelB)
      const aSeat = swap ? 1 : 0, bSeat = 1 - aSeat
      const g = playOnce(configs, seed)
      const earnedTok = [g.seats[0].earned, g.seats[1].earned]
      const deal = flatDeal(earnedTok[0] + earnedTok[1], extras)
      const flat = []
      flat[aSeat] = deal.a; flat[bSeat] = deal.b
      games++

      if (flat[0] + flat[1] !== earnedTok[0] + earnedTok[1]) volumePreserved = false
      if (flat[aSeat] !== earnedTok[aSeat]) moved++

      totalTokens += earnedTok[0] + earnedTok[1]
      tokensA += earnedTok[aSeat]; tokensB += earnedTok[bSeat]
      flatA += flat[aSeat]; flatB += flat[bSeat]

      const eA = g.seats[aSeat].base + 3 * earnedTok[aSeat]
      const eB = g.seats[bSeat].base + 3 * earnedTok[bSeat]
      const fA = g.seats[aSeat].base + 3 * flat[aSeat]
      const fB = g.seats[bSeat].base + 3 * flat[bSeat]

      marginEarned += eA - eB
      marginFlat += fA - fB
      if (eA > eB) earnedWinsA++; else if (eB > eA) earnedWinsB++
      if (fA > fB) flatWinsA++; else if (fB > fA) flatWinsB++
      if ((eA > eB) !== (fA > fB) || (eA === eB) !== (fA === fB)) flips++
    }
  }
  const pct = (w, l) => (w + l ? +(100 * w / (w + l)).toFixed(1) : 50)
  return {
    games, volumePreserved, moved, flips,
    winPctEarned: pct(earnedWinsA, earnedWinsB),
    winPctFlat: pct(flatWinsA, flatWinsB),
    marginEarned: +(marginEarned / games).toFixed(2),
    marginFlat: +(marginFlat / games).toFixed(2),
    earnedPerGameA: +(tokensA / games).toFixed(2),
    earnedPerGameB: +(tokensB / games).toFixed(2),
    earnGap: +((tokensA - tokensB) / games).toFixed(2),
    flatGap: +((flatA - flatB) / games).toFixed(2),
    tokensPerGame: +(totalTokens / games).toFixed(2),
    // Unrounded, for the exactness identity below · the rounded fields above are for the report and
    // comparing them at 1e-9 would be comparing rounding error.
    raw: { marginEarned: marginEarned / games, marginFlat: marginFlat / games,
      earnGap: (tokensA - tokensB) / games, flatGap: (flatA - flatB) / games },
  }
}

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

const REPORT = (label, obj) => {
  if (process.env.SPEND_OUT) {
    // eslint-disable-next-line no-undef
    require('node:fs').appendFileSync(process.env.SPEND_OUT, JSON.stringify({ label, ...obj }) + '\n')
  }
}

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
  //     asserted rather than reported. Bounded at 0.15 tokens/game: the residual is the odd token in
  //     odd-total games, which the orientation swap balances in expectation but not exactly.
  for (const level of GUARDED) {
    expect(Math.abs(rows[level].flatGap), `${level}: the "flat" arm gave one side ` +
      `${rows[level].flatGap} more tokens per game than the other · it is not flat, so the ` +
      'difference between the arms is partly a bias I introduced rather than the skew under test')
      .toBeLessThanOrEqual(0.15)
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
  expect(rows.apprentice.winPctEarned, 'apprentice must lose to the reference').toBeLessThan(40)
  expect(rows.architect.winPctEarned, 'architect must beat it').toBeGreaterThan(80)

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
  expect(rows.apprentice.winPctFlat, 'flattening tokens handed the apprentice the ladder · the token ' +
    'term now dominates skill').toBeLessThan(50)
  expect(rows.architect.winPctFlat, 'flattening tokens cost the architect the ladder · the token term ' +
    'now dominates skill').toBeGreaterThan(70)

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
