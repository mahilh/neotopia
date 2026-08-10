import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'

// DO BONUS TOKENS EXIST? (T2 S37 · the determination, made executable)
//
// THE ANSWER: the ENGINE exists and is correct for three of the four rulebook effects. The FEATURE does
// not exist, because nothing ever puts a token in a player's hand. Both granters read data that is never
// seeded, so `bonusTokens` is provably always [] in every real game:
//
//   gameStore.js:288 · placing on a hex that carries `bonusType` awards it. NOTHING ever writes bonusType
//                      to a hex · it would come from the per-region bonus hex (q,r) data that has been
//                      pending from Mahil for ten sessions (CLAUDE.md 'BONUS HEX DATA').
//   gameStore.js:389 · crossing a score threshold awards the top of that region's `bonusPile`. All three
//                      regions are declared with `bonusPile: []` (gameStore.js:48-50) and nothing pushes.
//
// So this is the award_game_win shape again, one level deeper. That was a writer with no caller; this is
// a caller with no DATA, resting at a value ([]) indistinguishable from "no player has earned one yet".
// Nobody would notice, because an empty hand is exactly what a player who has earned nothing should see.
//
// WHAT IS ACTUALLY MISSING, precisely · this is the point of the file:
//   1 · the seed data (bonus hex coordinates + each region's pile contents) · NOT a code problem
//   2 · a control that calls useBonus · GameRoom.jsx:410 states plainly that none exists
//   3 · 'permits' (New Building Permits · place from a factory into an off-map outer space) · a real TODO
//       at gameStore.js:505, since no outer-space tracking exists to place into
//
// WHY THIS FILE PINS THE ENGINE RATHER THAN THE GAP. A test that asserted "bonusTokens is always empty"
// would gate the BUG · it would go red the day the feature works, which is precisely backwards. Instead
// these tests SEED the data by hand and prove the granters do the right thing when it arrives. That
// converts "we think the engine is ready" into a measured claim, and leaves exactly one unproven step
// (the seeding itself) rather than a whole subsystem of unknown readiness.
//
// NOT WIRED, DELIBERATELY. The forge's instruction was to determine and report, not to half-wire, and
// there is a hard reason beyond that: T1's ActionBar is exactly 320px of 320 at its narrowest supported
// viewport with ZERO tokens (ActionBar.jsx:131). Rendering tokens pushes End Turn off the screen · Rule
// 78b, committed by T1 an hour after fixing 78a. Granting tokens before that bar is fixed would make the
// game unwinnable at 320px. Posted to comms.

const REGION_0 = 0
const center = { q: 0, r: 0 }

const seatWith = (bonusTokens = []) => ({
  seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [], bonusTokens, scores: [0, 0, 0],
})

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState(), true)
})

describe('what is still starved · the HEX granter, which the score track does not feed', () => {
  test('no hex carries a bonusType · the placement granter still cannot fire', () => {
    // WAS "no region carries a pile AND no hex carries a type". Half of that closed this session · the
    // score-track pile is seeded from the rulebook and the granter below is proven to run. This half
    // does not close without Mahil's bonus-hex (q,r) coordinates, and it is the ONLY route to
    // 'automatization', which is not a score-track reward. Guessing coordinates would be rule 32.
    // If this goes red, the data landed and the fourth token became reachable.
    const s = useGameStore.getState()
    const typedHexes = s.regions.flatMap(r => Object.values(r.hexes ?? {})).filter(h => h?.bonusType)
    expect(typedHexes, 'no hex carries a bonusType, so the placement granter can never fire').toHaveLength(0)
  })
})

// ── THE THRESHOLD GRANTER, ACTUALLY RUN (T2 S38) ─────────────────────────────────────────────────────
// My S37 draft of this seeded a pile and then asserted the pile contained what I had just written. It
// never invoked the granter, and I deleted it and recorded the gap rather than ship coverage that did
// not exist. These drive the real `scoreCard` reducer, so the granter executes or the test is red.
//
// The granter also CHANGED this session. It used to `bonusPile.shift()` on any crossing, which is only
// correct while exactly one player ever crosses anything: the rulebook names a token per threshold, so
// the second player to cross 7 in a region would have been handed the 13-token. It now matches the
// crossing to its own entry.
describe('the score-track granter · it runs, and it hands over the right token', () => {
  // A REAL card and a REAL completed pattern, because tryScoreCard validates the board before it
  // mutates anything · a synthetic one-hex card is silently rejected and every assertion below would
  // then be measuring nothing. (First attempt did exactly that: five reds, all reading [] because the
  // granter never ran. Rule 36 · the harness has to mirror the real setup path.)
  //
  // card_01 is energy at (0,0)+(1,0). Its point value is small, so rather than score a card six times
  // to reach a threshold · which Diverse City blocks anyway · the seat's score is set just BELOW the
  // threshold and one real scoring carries it across. prevScore is read from that same field, so the
  // crossing the granter sees is a genuine one.
  const CARD = PROJECT_CARDS.find(c => c.id === 'card_01')
  const BOARD = { '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }

  const setup = (startScores = [0, 0, 0], startScores1 = [0, 0, 0]) => {
    useGameStore.setState(useGameStore.getInitialState(), true)
    const regions = useGameStore.getState().regions.map(r => ({ ...r, hexes: { ...BOARD } }))
    useGameStore.setState({
      phase: 'playing',
      currentSeat: 0,
      regions,
      players: [
        { ...seatWith(), hand: [CARD], scores: [...startScores] },
        { ...seatWith(), seat: 1, userId: 'u1', hand: [CARD], scores: [...startScores1] },
      ],
    }, false)
  }

  // Cross a threshold for real: put the seat one card short of it, then score.
  const crossInto = (regionId, target, seat = 0) => {
    useGameStore.setState(state => {
      state.currentSeat = seat
      const p = state.players[seat]
      p.scores[regionId] = target - CARD.points
      // Diverse City forbids repeating an illustration in a region · clear it so a second seat can score.
      state.regions.find(r => r.id === regionId).lastBuiltIllustration = null
      if (!p.hand.some(c => c.id === CARD.id)) p.hand.push(CARD)
    }, false)
    useGameStore.getState().scoreCard(seat, CARD.id, regionId, null)
  }

  test('the pile is SEEDED · every region offers the three rulebook tokens', () => {
    // The fact that made the granter dead for 23 sessions. If this goes red the feature is off again.
    for (const r of useGameStore.getState().regions) {
      expect(r.bonusPile.map(b => [b.threshold, b.type])).toEqual([[7, 'subsidy'], [13, 'initiative'], [18, 'permits']])
      expect(r.bonusPile.every(b => b.claimed === false)).toBe(true)
    }
  })

  test('crossing 7 in a region awards Government Subsidy · the granter EXECUTES', () => {
    setup()
    crossInto(REGION_0, 7)
    const s = useGameStore.getState()
    expect(s.players[0].scores[REGION_0]).toBeGreaterThanOrEqual(7)
    expect(s.players[0].bonusTokens, 'nothing has ever granted a token before this session').toEqual(['subsidy'])
    expect(s.regions[REGION_0].bonusPile[0].claimed).toBe(true)
  })

  test('NO single card can cross two thresholds · computed, not assumed', () => {
    // Rule 81, and I broke it writing this file. The first version asserted that scoring into 13 from
    // (13 - card.points) would take BOTH the 7 and the 13 token, on the reasoning that the start was
    // below 7. It is not: card_01 is worth 2, so the start was 11.
    // MEASURED instead of argued: the deck's point values are 2/3/4/5, max 5.
    // AND THE ARITHMETIC BIT BACK A SECOND TIME, which is why it is written out rather than asserted.
    // Crossing both t1 and t2 in one score needs prevScore < t1 AND prevScore + points >= t2, so the
    // cheapest case starts at t1-1 and the card must be worth t2 - t1 + 1. For (7,13) that is 7; for
    // (13,18) it is 6. The bar is 6, not the naive gap of 5 · my first version compared against the
    // gap, and a 5-point card failed it. Max is 5, so a double crossing is unreachable · but I got
    // there by letting the test compute it twice, not by thinking harder.
    // The granter's loop still handles it, which is correct defensive code for an unreachable case ·
    // and this test exists so that a future card worth 6+ or a re-spaced score track is a DECISION
    // rather than a surprise. It would make double-award reachable for the first time.
    const maxPoints = Math.max(...PROJECT_CARDS.map(c => c.points))
    const T = [7, 13, 18]
    const needed = T.slice(1).map((t2, i) => t2 - T[i] + 1)   // [7, 6]
    expect(needed).toEqual([7, 6])
    expect(maxPoints, 'a card worth this much would make a double crossing reachable for the first time')
      .toBeLessThan(Math.min(...needed))
  })

  test('scoring straight into 13 from below it takes ONLY the 13-token', () => {
    setup()
    crossInto(REGION_0, 13)
    expect(useGameStore.getState().players[0].bonusTokens).toEqual(['initiative'])
  })

  test('THE BUG THE OLD STACK HAD · the second player to cross 7 does not get the 13-token', () => {
    // With shift(), seat 1 crossing 7 would have received 'initiative' · a strictly better token, for
    // reaching a lower threshold, because someone else got there first. This is the whole reason the
    // granter changed rather than merely being fed data.
    setup()
    crossInto(REGION_0, 7, 0)
    crossInto(REGION_0, 7, 1)
    const s = useGameStore.getState()
    expect(s.players[0].bonusTokens).toEqual(['subsidy'])
    expect(s.players[1].bonusTokens, 'seat 1 crossed 7, so seat 1 gets the 7-token or nothing').toEqual([])
  })

  test('each region has its OWN pile · Sacred City running dry does not starve Living Earth', () => {
    setup()
    crossInto(0, 7)
    crossInto(1, 7)
    expect(useGameStore.getState().players[0].bonusTokens).toEqual(['subsidy', 'subsidy'])
  })

  test('a threshold pays ONCE · scoring past 7 again grants nothing further', () => {
    setup()
    crossInto(REGION_0, 7)
    crossInto(REGION_0, 10)  // 10-CARD.points is already past 7 · crosses nothing new
    expect(useGameStore.getState().players[0].bonusTokens).toEqual(['subsidy'])
  })
})

describe('bonus tokens · the granters are correct, and starved', () => {
  test('automatization buys exactly one extra action, and is spent doing it', () => {
    useGameStore.setState({ phase: 'playing', players: [seatWith(['automatization'])], actionsRemaining: 0 }, false)
    useGameStore.getState().useBonus(0, 'automatization')
    const s = useGameStore.getState()
    expect(s.actionsRemaining, 'a free action · this is the effect that makes a token spendable at zero').toBe(1)
    expect(s.players[0].bonusTokens).toEqual([])
  })

  test('a REJECTED bonus never burns the token · it is worth 3 points unspent', () => {
    // The false case that matters. A token silently consumed by an illegal move costs the player 3
    // points at final score and there is no UI that could tell them why.
    useGameStore.setState({
      phase: 'playing', players: [seatWith(['initiative'])], actionsRemaining: 3, bonusUsedThisTurn: false,
    }, false)
    // An illegal hex: region 0 is empty, so the first placement must be the centre, and this is not.
    useGameStore.getState().useBonus(0, 'initiative', { elementType: 'community', toQ: 5, toR: 5, regionId: REGION_0 })
    const s = useGameStore.getState()
    expect(s.players[0].bonusTokens, 'the token survives a rejected bonus').toEqual(['initiative'])
    expect(s.bonusUsedThisTurn, 'and the once-per-turn budget is not spent either').toBe(false)
  })

  test("initiative's placement is OWNED · the one route onto the board that could have scored nobody", () => {
    // Rule p9 scores tokens of your colour. placeElement stamps placedBy (T2 S35); useBonus is a SECOND
    // way an element reaches the board, and if it did not stamp, Private Initiative would be the single
    // placement in the game worth zero cluster points. Checked here because the two writers are separate.
    useGameStore.setState({
      phase: 'playing', players: [seatWith(['initiative'])], actionsRemaining: 3, bonusUsedThisTurn: false,
    }, false)
    useGameStore.getState().useBonus(0, 'initiative', {
      elementType: 'community', toQ: center.q, toR: center.r, regionId: REGION_0,
    })
    const hex = useGameStore.getState().regions[REGION_0].hexes[`${center.q},${center.r}`]
    expect(hex?.element).toBe('community')
    expect(hex?.placedBy, 'an element placed by a bonus is still that player\'s token').toBe(0)
  })

  test("'permits' is the one effect that is NOT implemented · and it fails safe", () => {
    // New Building Permits (place from a factory into an off-map outer space) is a TODO at
    // gameStore.js:505 because no outer-space tracking exists. The thing worth gating is that an
    // unimplemented effect does nothing AND keeps the token, rather than consuming it for no benefit ·
    // which is the difference between a missing feature and a bug that steals 3 points.
    useGameStore.setState({
      phase: 'playing', players: [seatWith(['permits'])], actionsRemaining: 3, bonusUsedThisTurn: false,
    }, false)
    useGameStore.getState().useBonus(0, 'permits')
    const s = useGameStore.getState()
    expect(s.players[0].bonusTokens, 'an unimplemented bonus must not eat the token').toEqual(['permits'])
    expect(s.bonusUsedThisTurn).toBe(false)
  })
})
