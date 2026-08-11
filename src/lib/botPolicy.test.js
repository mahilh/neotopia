import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from '../store/gameStore'
import { PROJECT_CARDS } from './projectCards'
import { chooseBotAction, enumeratePlacements, makeRng, DIFFICULTIES, REFERENCE_POLICY, DIFFICULTY_SELECTABLE } from './botPolicy'
import { makeReporter } from '../store/ladderHarness'

// Deterministic shuffle so a win-rate measurement measures the POLICY, not one lucky deck.
function shuffled(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const api = () => useGameStore.getState()

function startGame(configs, seed) {
  const rng = makeRng(seed)
  api().initGame(configs, shuffled(PROJECT_CARDS, rng), shuffled(PRODUCTION_TILES, rng))
  return rng
}

/** Play one whole game with every seat driven by its own policy. Returns final scores by seat. */
function playOut(configs, seed, maxActions = 4000) {
  const rng = startGame(configs, seed)
  let lastPlacedKey = null
  for (let i = 0; i < maxActions && api().phase === 'playing'; i++) {
    const s = api()
    const seat = s.currentSeat
    const cfg = configs[seat]
    const action = chooseBotAction({
      state: s, seat, difficulty: cfg.difficulty,
      getValidPlacements: s.getValidPlacements, getBuildableCards: s.getBuildableCards,
      lastPlacedKey, rng,
    })
    switch (action.type) {
      case 'placeElement':
        api().placeElement(seat, action.factoryId, action.elementType, action.q, action.r, action.regionId)
        lastPlacedKey = `${action.q},${action.r}`
        break
      case 'scoreCard':
        api().scoreCard(seat, action.cardId, action.regionId, action.lastPlacedKey)
        lastPlacedKey = null
        break
      case 'drawCard':
        api().drawCard(seat, action.source, action.cardIndex)
        break
      default:
        api().endTurn()
        lastPlacedKey = null
    }
  }
  return { phase: api().phase, scores: configs.map((_, seat) => api().getFinalScore(seat)) }
}

const bots = (...levels) => levels.map((difficulty, i) => ({
  userId: null, username: `Bot${i}`, isBot: true, difficulty,
}))

/**
 * Win rate of `strong` over `weak`, SEAT-CONTROLLED: every seed is played both ways so turn-order
 * advantage cancels exactly. Draws are excluded from the denominator rather than counted as halves ·
 * this game ties often at low scores and folding those in would drag every rate toward 50% and hide
 * a real difference. `decisive` is returned so a caller can refuse to conclude from too few games.
 */
// T2 S50 · ALSO RETURNS THE MEAN SCORE MARGIN, and that is not a convenience. A win rate is a
// THRESHOLD on the margin · it throws away how much a game was won by and keeps only the sign · so
// its variance at these sample sizes is large and it saturates near 0 and 100 (Rule 88). That was
// tolerable while the ladder was 92-100% and every gap was enormous. Under the S50 retune the rungs
// are ~35 points apart by design, which is exactly the regime where a 20-game win rate cannot tell
// two policies apart: the reference test below INVERTED apprentice and builder on its first v2 run
// (75.0% vs 73.7%) on data whose margins were cleanly ordered. Ties are excluded from `rate` as
// before, but they are KEPT in the margin, where a 0 is a real observation rather than a missing one.
function winRate(weak, strong, seeds) {
  let strongWins = 0, decisive = 0, marginSum = 0, completed = 0
  for (let seed = 1; seed <= seeds; seed++) {
    for (const flip of [false, true]) {
      useGameStore.setState(useGameStore.getInitialState(), true)
      const r = playOut(flip ? bots(strong, weak) : bots(weak, strong), seed)
      if (r.phase !== 'scoring') continue
      const s = flip ? r.scores[0] : r.scores[1]
      const w = flip ? r.scores[1] : r.scores[0]
      completed++
      marginSum += s - w
      if (s === w) continue
      decisive++
      if (s > w) strongWins++
    }
  }
  return {
    rate: decisive ? strongWins / decisive : 0,
    decisive,
    margin: completed ? +(marginSum / completed).toFixed(2) : 0,
    completed,
  }
}

describe('bot policy · practice mode', () => {
  beforeEach(() => { useGameStore.setState(useGameStore.getInitialState(), true) })

  test('initGame marks a bot seat and leaves a human seat shape untouched', () => {
    api().initGame(
      [{ userId: 'u0', username: 'Human' }, { userId: null, username: 'Sol', isBot: true, difficulty: 'architect' }],
      PROJECT_CARDS, PRODUCTION_TILES)
    const [human, bot] = api().players
    // The human seat must NOT gain the keys · tests/seededState.guard.test.js pins that shape.
    expect(Object.prototype.hasOwnProperty.call(human, 'isBot')).toBe(false)
    expect(bot.isBot).toBe(true)
    expect(bot.difficulty).toBe('architect')
    expect(bot.color).toBe('red') // an ordinary seat · same SEAT_COLORS list
  })

  test('the reference is a measuring instrument, not a difficulty', () => {
    // It must never appear in a picker · DIFFICULTIES is what any UI would enumerate.
    expect(DIFFICULTIES).not.toContain(REFERENCE_POLICY)
    // And the ladder stays unexposed until the rates are calibrated against a human (Mahil · S33).
    expect(DIFFICULTY_SELECTABLE).toBe(false)
  })

  test('a bot never proposes an illegal placement', () => {
    startGame(bots('builder', 'builder'), 7)
    const s = api()
    for (const p of enumeratePlacements(s, s.getValidPlacements)) {
      const legal = s.getValidPlacements(p.factoryId, p.regionId)
      expect(legal.some(h => h.q === p.q && h.r === p.r)).toBe(true)
    }
  })

  test('every difficulty drives a complete game to scoring · no soft-lock', () => {
    for (const level of DIFFICULTIES) {
      useGameStore.setState(useGameStore.getInitialState(), true)
      const r = playOut(bots(level, level), 42)
      expect(r.phase, `${level} stalled on '${r.phase}'`).toBe('scoring')
    }
  })

  test('the policy reads no hidden information', () => {
    // A real guard, not a comment: the source must never touch another seat's hand or the deck order.
    // (deck.length is fine · that is the visible clock. deck[0] / .hand of a foreign seat is not.)
    const src = chooseBotAction.toString() + enumeratePlacements.toString()
    expect(src).not.toMatch(/deck\s*\[/)
    expect(src).not.toMatch(/players\s*\.\s*(map|filter|forEach)[^)]*hand/)
  })

  test('difficulty is ORDERED · seat-controlled, measured, and the control sits at 50%', () => {
    // THE GATE THAT MATTERS, and my first version of it was VACUOUS. It played each matchup with the
    // strong policy always in seat 1, so it was measuring TURN-ORDER ADVANTAGE: it passed unchanged
    // when every level was collapsed into one. Only the teeth check caught that.
    // Fixed by mirroring · every matchup is played both ways with the same seed, so seat advantage
    // cancels exactly. The identical-vs-identical control below is the proof the harness is fair:
    // builder vs builder must land at 50%, and with the levels collapsed EVERY row becomes that row.
    const run = winRate

    // ⚠ THE OLD WIRE HERE WAS `rate > 0.65`, AND THE S50 RETUNE IS EXACTLY WHAT EXPOSES IT.
    // It was written when the ladder was 92-100% and it read as a loose backstop. It is not loose ·
    // it is a requirement that the stronger rung win MORE THAN 65% of decisive games, which is the
    // precise opposite of the calibration target Mahil set ("adjacent rungs at roughly 65/35"). A
    // properly-spaced ladder sits ON this wire, so the gate encoded the very miscalibration S50
    // exists to remove, and would have had to be widened by whoever fixed the ladder · which is the
    // move Rule 110c says is always wrong (a tolerance widened to accommodate a defect is a defect
    // with permission). The right fix is not a wider bound, it is a statistic that can carry the
    // claim: see the margin note on winRate.
    //
    // WHAT IS ASSERTED NOW: the ORDER, on the margin, against a control measured in the SAME run
    // (my own S49 P4 lesson · a backstop derived from an observed number is a wire sized from the
    // run it guards). These runs are fully DETERMINISTIC · winRate walks seeds 1..n · so the values
    // cannot drift with luck and a tight gate cannot flake. Only a code change moves them, which is
    // the only thing this should ever report.
    //
    // MEASURED AT v2 (8 seeds x 2 seatings = 16 games per row, written by the run, not by hand):
    const REPORT = makeReporter('BOTPOLICY_OUT')
    const control = run('builder', 'builder', 8)
    const pairs = {}
    for (const [weak, strong] of [['apprentice', 'builder'], ['apprentice', 'architect'], ['builder', 'architect']]) {
      const r = run(weak, strong, 8)
      pairs[`${weak}_v_${strong}`] = { rate: r.rate, margin: r.margin, decisive: r.decisive }
      expect(r.decisive, `${weak} vs ${strong} · too few decisive games to measure`).toBeGreaterThan(8)
      // The stronger policy must be ahead ON POINTS by more than the control's own residual. The
      // control is a policy against itself, so its margin is 0.00 by construction and any non-zero
      // value in it is a harness side · using it as the floor means this bound re-sizes itself if
      // the harness ever acquires one, instead of silently absorbing it.
      expect(r.margin, `${strong} is not ahead of ${weak} on points · margin ${r.margin} against a ` +
        `control residual of ${control.margin}`).toBeGreaterThan(Math.abs(control.margin) + 3)
    }
    REPORT('S50_rung_v_rung_16g', { control: { rate: control.rate, margin: control.margin }, ...pairs })

    // Transitivity, which is what makes it a LADDER rather than three ordered pairs: the ends must be
    // further apart than either single step. This is the assertion that a collapsed or reordered
    // ladder cannot satisfy, and it needs no threshold at all.
    expect(pairs.apprentice_v_architect.margin, 'the ladder ends must be further apart than either ' +
      'adjacent step, or these are three pairings and not a ladder')
      .toBeGreaterThan(pairs.apprentice_v_builder.margin)
    expect(pairs.apprentice_v_architect.margin)
      .toBeGreaterThan(pairs.builder_v_architect.margin)

    // The control. Same policy both sides must be a coin flip · if this drifts, the harness is biased
    // and every number above is worthless.
    expect(control.rate).toBeGreaterThan(0.3)
    expect(control.rate).toBeLessThan(0.7)
    expect(Math.abs(control.margin), 'builder against ITSELF carries a points advantage · the ' +
      'orientation swap is not cancelling and every margin above inherits it').toBeLessThan(1)
  }, 30000) // 64 full games. 3.3s in isolation, 7.1s under full-suite contention · it FAILED the first
            // full run on the 5s default, which is the same trap I fixed for engineFuzz one session ago
            // and then walked straight into. Sized on the measured contended number with headroom.

  test('every level is measured against the FIXED reference · one scale, not three pairings', () => {
    // WHY THIS EXISTS ON TOP OF THE TEST ABOVE. That one proves the levels are ordered relative to
    // EACH OTHER, which is a closed loop: tuning any level moves the yardstick for the other two, and
    // no rate in it means anything in human terms. Measured against the frozen REFERENCE_POLICY they
    // all land on ONE scale, so a single human game against the reference locates the player on that
    // same scale and calibrates all three at once. That is the whole point · one game, not three.
    //
    // MEASURED THIS SESSION (record the numbers, gate on the ORDERING, which is what is stable):
    //             seeds=8      10      12      14      20
    //   apprentice   13%     15%     17%     14%     13%
    //   builder      53%     58%     61%     62%     68%
    //   architect   100%    100%    100%    100%    100%
    //   control      50%     50%     50%     50%     50%   <- exactly a coin flip at every size
    // Builder's POINT VALUE drifts with sample size (53 -> 68) so gating on it would buy a flaky test
    // and no information. The ORDERING never wavers, at any size, so that is what is asserted.
    //
    // 10 seeds AND NOT 20, and this is a cross-lane fix, not a shortcut. At 20 this test plays 160 full
    // games, and that load starved the workers enough to make T1's in-flight practice tests fail
    // intermittently under the full suite · a different one each run, all passing 10/10 in isolation.
    // Proven both ways: skip this test and the whole suite went 3/3 clean. My benchmark, my lane, my
    // fix. A heavy test that destabilises somebody else's is a bug in mine even when both pass alone.
    // ⚠ T2 S50 · WHAT THIS TEST USED TO ASSERT, AND WHY IT NO LONGER CAN. Kept in full rather than
    // silently edited, because the old claim is the argument for the new one (Rule 101b).
    //
    //     expect(rates.apprentice).toBeLessThan(0.4)      // the ladder STRADDLES the yardstick
    //     expect(rates.architect).toBeGreaterThan(0.85)
    //
    // Both were true of ladder v1 (5.1 / 77.2 / 98.8 against the reference) and both are false of v2,
    // and that is arithmetic rather than regression. The reference is frozen at drawBias 0.25 with
    // random placement · which is v2's apprentice with a slightly lower draw bias · so once the rungs
    // were pulled close enough together to be playable, the whole ladder ended up above it. Rungs
    // that are ~35 points apart from each other are necessarily close to any third party too: the
    // span against the yardstick compressed from 94 points to 25.
    //
    // AND THE WIN RATE CAN NO LONGER ORDER THE BOTTOM TWO. On the first v2 run this test reported
    // apprentice 75.0% and builder 73.7% · INVERTED · on games whose margins were cleanly ordered
    // (2.60 vs 10.10). That is not noise in the usual sense (winRate walks seeds 1..n and is
    // deterministic); it is a threshold statistic being asked to resolve a difference smaller than
    // one game's worth of sign-flips. The margin sees it at every size tried: 10, 14 and 20 seeds
    // gave apprentice 2.60 / 5.14 / 4.90 against builder 10.10 / 9.96 / 13.53 and architect 32.45 /
    // 32.68 / 34.67, ordered 3 of 3. So the ordering is asserted on the margin (Rule 88b · prefer a
    // statistic that cannot saturate) and the rate is reported rather than gated.
    //
    // THE YARDSTICK STILL DOES ITS JOB, which is the reason to keep it frozen rather than re-cut it:
    // it is a FIXED point, so a number recorded against it tonight is comparable with one from S39,
    // and one human game against it still locates that human on the same scale. What it has lost is
    // resolution between apprentice and builder specifically. That is the honest price of freezing
    // an instrument, and the alternative · moving it · voids five sessions of recorded rates and is
    // exactly what its own header forbids.
    const REPORT = makeReporter('BOTPOLICY_OUT')
    const vsRef = {}
    for (const level of DIFFICULTIES) {
      const { rate, decisive, margin } = winRate(REFERENCE_POLICY, level, 10)
      expect(decisive, `${level} vs reference · too few decisive games`).toBeGreaterThan(12)
      vsRef[level] = { rate, margin, decisive }
    }
    const refControl = winRate(REFERENCE_POLICY, REFERENCE_POLICY, 20)
    REPORT('S50_rung_v_reference_20g', { ...vsRef, control: { rate: refControl.rate, margin: refControl.margin } })

    // Strictly increasing against the fixed opponent, ON POINTS. Collapse any two levels and this
    // fails · which is the property that makes the reference a SCALE rather than just an opponent.
    expect(vsRef.apprentice.margin, `apprentice (${vsRef.apprentice.margin}) is not below builder ` +
      `(${vsRef.builder.margin}) against the reference`).toBeLessThan(vsRef.builder.margin)
    expect(vsRef.builder.margin, `builder (${vsRef.builder.margin}) is not below architect ` +
      `(${vsRef.architect.margin}) against the reference`).toBeLessThan(vsRef.architect.margin)
    // Every rung must be located ABOVE the yardstick's own control, not merely ordered among
    // themselves · that is what says the reference is a floor of the v2 ladder rather than adrift
    // somewhere inside it. Compared against the control measured in this same run, never a constant.
    expect(vsRef.apprentice.margin, 'even the weakest rung must beat the frozen reference on points ' +
      'under v2 · if this goes red the ladder has drifted back below its own yardstick and the ' +
      'compression note above needs re-measuring, not deleting')
      .toBeGreaterThan(refControl.margin)

    // The instrument checks itself: the reference against a copy of itself must be a coin flip. If
    // this drifts, the harness is biased and every rate recorded above is worthless.
    expect(refControl.rate).toBeGreaterThan(0.3)
    expect(refControl.rate).toBeLessThan(0.7)
    expect(Math.abs(refControl.margin), 'the reference against a COPY OF ITSELF carries a points ' +
      'advantage · seat or orientation is worth something and every margin above inherits it')
      .toBeLessThan(1)
  }, 30000) // 80 full games · ~3s in isolation. Sized like its sibling for full-suite contention.
})
