import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore } from './gameStore'

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

describe('bonus tokens · the granters are correct, and starved', () => {
  test('THE GAP, stated as a fact about shipped state · no region carries a pile and no hex carries a type', () => {
    // Not an assertion that this SHOULD be so · it is the measurement that makes the rest of the file
    // worth reading. If this ever goes red, somebody seeded the data and the feature became reachable.
    const s = useGameStore.getState()
    const piles = s.regions.map(r => r.bonusPile?.length ?? 0)
    const typedHexes = s.regions.flatMap(r => Object.values(r.hexes ?? {})).filter(h => h?.bonusType)
    expect(piles, 'every region ships with an empty bonus pile').toEqual([0, 0, 0])
    expect(typedHexes, 'no hex carries a bonusType, so the placement granter can never fire').toHaveLength(0)
  })

  // NOT COVERED HERE, and said out loud rather than papered over: the THRESHOLD granter (gameStore.js:389)
  // is not independently proven by this file. My first draft of that test seeded a pile and then asserted
  // pile[0] === 'subsidy' · which is true because I had just written it, and never ran the granter at all.
  // A vacuous test is worse than a missing one: it reports coverage that does not exist, which is the same
  // lie as a spec that runs in no workflow. Proving it properly needs a scorable board driven through
  // scoreCard (the path gameStore.test.js already builds), and it is left as a stated gap rather than
  // faked. The pile-ordering contract it depends on (shift() takes the top · deterministic, Rule 32) is
  // visible in the source and is the part a reader should check.

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
