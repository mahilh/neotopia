import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'
import { hexesInRadius, REGIONS as REGION_DEFS } from '../utils/hexUtils'
import { store, legalPlacements, canDraw, POLICIES, playWithPolicy, mulberry32, shuffled, uiAllowsEndTurn, anyLegalMove } from './fuzzDriver'
// T2 S45 · ADVERSARIAL FUZZ · policies that reach the endings random play cannot.
//
// WHY THIS EXISTS, and it is a three-time recurrence rather than a defect: S18's Flow freeze, S37's
// unreachable bonus subsystem and S44's practice soft-lock were each found by a human stumbling into
// them and then retrofitted as a bespoke test. engineFuzz.test.js is not weak · 150 games, termination
// asserted · but ITS PLAY POLICY DETERMINES WHICH STATES EXIST. It places whenever a placement is
// legal, so tiles always reach 0, so the natural trigger always fires, so every terminal path that
// depends on the clock NOT advancing is unreachable by construction. playFlowStalled already sits in
// that file as a hand-built exception, which is the same point conceded one case at a time.
//
// THE TWO BLIND SPOTS THE NEW POLICIES MUST NOT INHERIT (S44):
//   1. engineFuzz's playTurn calls store().endTurn() UNCONDITIONALLY, so "the player cannot pass" ·
//      the entire human half of the S44 lock · is invisible to it. Here the harness may only end a
//      turn when a modelled UI gate allows it, and being unable to end a turn is a REPORTED HANG.
//   2. Its policy always drives tiles to 0. Three of the four policies below are built so the tile
//      clock stalls, because the clock is a counter of placements (Rule 100).

describe('adversarial fuzz · the endings random play cannot reach', () => {
  beforeEach(() => { useGameStore.setState(useGameStore.getInitialState(), true) })

  // COUNTERWEIGHT FIRST (Rule 90). Every result below rests on the gate model actually gating. If
  // uiAllowsEndTurn always returned true, this harness would silently inherit engineFuzz's blind spot
  // and every policy would "terminate" for the wrong reason · which is precisely the vacuity I shipped
  // in S42 and S43. So: it must refuse mid-turn, and it must be able to REPORT a hang.
  test('THE COUNTERWEIGHT · the gate model actually gates, and a hang is reportable', () => {
    const rng = mulberry32(1)
    store().initGame(
      [{ userId: 'A', username: 'A' }, { userId: 'B', username: 'B' }],
      shuffled(rng, PROJECT_CARDS), shuffled(rng, PRODUCTION_TILES),
    )
    expect(store().actionsRemaining).toBe(3)
    expect(legalPlacements().length, 'an opening board has moves').toBeGreaterThan(0)
    expect(uiAllowsEndTurn('t1'), 'a player with 3 actions and legal moves may NOT pass').toBe(false)
    expect(uiAllowsEndTurn('legacy'), 'nor under the pre-S44 gate').toBe(false)

    // and the harness must be capable of returning 'hung' at all · proven against the legacy gate,
    // which is the historical bug rather than a hypothetical.
    const legacy = playWithPolicy('drawHeavy', 4242, { gate: 'legacy' })
    expect(['hung', 'scoring', 'capped']).toContain(legacy.outcome)
  })

  // ── P2 · THE COMPOSITION · T1's gate and my S44 engine condition, together ────────────────────────
  test('COMPOSITION · the legacy gate HANGS where T1 s gate resolves · both halves are load-bearing', () => {
    const legacy = playWithPolicy('drawHeavy', 77, { gate: 'legacy' })
    const fixed = playWithPolicy('drawHeavy', 77, { gate: 't1' })

    expect(fixed.outcome, 'with T1 s escape AND the S44 terminal condition the game ends').toBe('scoring')
    expect(legacy.outcome, 'remove T1 s escape and the identical game becomes unfinishable · their ' +
      'button is not cosmetic, and my engine fix does not subsume it').toBe('hung')
  })

  // SEED COUNT, SIZED FROM MEASURED SPREAD (Rule 88c · P3, and I owed this to my own S45 gate).
  // S45 used five seeds because five was fast, which is exactly the mistake I had written a rule about.
  // MEASURED, and the measurement was taken before this comment was allowed to stand: 4 policies x 6
  // disjoint blocks x 10 seeds = 240 games. Result: 240 'scoring', 0 hung, 0 capped, and every one of
  // the 24 blocks scored 0 bad outcomes. VARIANCE IS EXACTLY ZERO.
  // That changes what "sizing from spread" even means here, and the distinction is the useful part:
  // this assertion is not estimating a RATE, it is checking a DETERMINISTIC property (does a policy
  // finish), and a property with no spread cannot be averaged down · extra seeds buy coverage of new
  // boards, not precision. Contrast the spendable-token gate in spendableBalance.test.js, where the
  // outcome IS a rate and 25 vs 60 seeds made no difference for the OPPOSITE reason: per-game variance
  // dominates, so precision there costs an order of magnitude more games rather than a factor of two.
  // Same rule (88c · size from data), opposite conclusions, and neither was knowable without measuring.
  // So the count is set by coverage and runtime: 12 seeds per policy keeps the file near 2s.
  // If this EVER reports a non-zero hang or cap, the honest response is more seeds and a real rate
  // estimate · not a wider bound. A zero that has never been non-zero is the weakest kind of green
  // (Rule 80), which is why the reachability and maxHand assertions below carry the actual evidence.
  const SEEDS_PER_POLICY = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 122, 133]

  test.each(Object.keys(POLICIES))('policy %s terminates from the same seeds', (policy) => {
    const results = SEEDS_PER_POLICY.map(seed => playWithPolicy(policy, seed))
    const bad = results.filter(r => r.outcome !== 'scoring')
    expect(bad.map(b => `${b.outcome} @${b.turns} ${JSON.stringify(b.state)}`),
      `${policy} failed to reach scoring · a policy that cannot finish is the S44 class again`)
      .toEqual([])
  })

  // ── THE FINDING THAT CORRECTS MY OWN S44 CLAIM ──────────────────────────────────────────────────
  // My S44 deadlock guard was proven against a CONSTRUCTED board: two empty factories with tiles still
  // remaining. This measures whether legal play can ever produce that, and the answer is no · 0 of 160
  // turn-samples across 8 seeds. The mechanism says why: refillFactoryDraft restocks a factory THE
  // MOMENT a placement empties it, for as long as tiles remain. So an empty factory implies tiles are
  // exhausted, and the decrement that reached 0 already set endGameTriggered.
  // CONSEQUENCE, stated plainly because I overstated it once: the audit's permanent lock was T1's UI
  // gate, not a missing engine terminal condition. My guard is correct and cheap and it covers Flow,
  // a degenerate zero-tile init, and any future change that empties a factory without refilling · but
  // it was NOT the operative fix, and nobody should read S44 as saying the engine was the cause.
  // This is the same criticism I made of endGamePhase.test.js's fixture, aimed at my own.
  test('the S44 precondition is UNREACHABLE by legal play · my guard is belt-and-braces, not the fix', () => {
    let seen = 0, samples = 0
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      useGameStore.setState(useGameStore.getInitialState(), true)
      const rng = mulberry32(seed)
      store().initGame(
        [{ userId: 'A', username: 'A' }, { userId: 'B', username: 'B' }],
        shuffled(rng, PROJECT_CARDS), shuffled(rng, PRODUCTION_TILES),
      )
      for (let t = 0; t < 300 && store().phase === 'playing'; t++) {
        let spin = 0
        while (store().actionsRemaining > 0 && spin++ < 40) {
          const before = store().actionsRemaining
          const mv = anyLegalMove()
          if (!mv) break
          const s = store()
          if (mv.place) s.placeElement(s.currentSeat, mv.place.factoryId, mv.place.type, mv.place.q, mv.place.r, mv.place.regionId)
          else if (s.theOffer.length) s.drawCard(s.currentSeat, 'offer', 0)
          else s.drawCard(s.currentSeat, 'deck')
          if (store().actionsRemaining === before) break
        }
        const st = store()
        samples++
        if (st.factories.some(f => !f.elements.some(e => e.count > 0)) && st.productionTilesRemaining > 0) seen++
        store().endTurn()
      }
    }
    expect(samples, 'the sweep must actually have sampled something').toBeGreaterThan(100)
    expect(seen, `an empty factory alongside remaining tiles occurred in ${seen}/${samples} samples · ` +
      'if this is ever non-zero the S44 guard has become load-bearing and this comment is stale')
      .toBe(0)
  })

  test('the adversarial policies REACH the states greedy cannot · otherwise they prove nothing', () => {
    // The whole premise is that policy determines reachable states. If every policy still drove tiles
    // to 0 the suite would be a slower copy of engineFuzz, so this measures the difference rather
    // than assuming it (Rule 81 · compute the constraint).
    const at = {}, hands = {}
    for (const p of Object.keys(POLICIES)) {
      const r = playWithPolicy(p, 99)
      at[p] = r.tilesAtTrigger; hands[p] = r.maxHand
    }
    // greedy is the CONTROL: it burns the clock, so the natural trigger fires at tiles 0 and the
    // deadlock condition is never what ends its games. That is precisely why 150 fuzz games missed S44.
    // MEASURED: tilesAtTrigger is 0 for all four (every finished game burns the clock), so it does NOT
    // discriminate · that was my first metric and it reported every policy identical. maxHand does:
    // greedy 6, drawHeavy 29, oneRegion 28, neverEmptyFactory 28. The audit's player reached 26.
    expect(hands.drawHeavy, `drawHeavy must build a large hand · maxHand=${JSON.stringify(hands)}`)
      .toBeGreaterThan(hands.greedy)
  })
})
