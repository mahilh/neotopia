import { describe, test, expect } from 'vitest'
import { useGameStore, shuffleArray, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'

describe('gameStore', () => {
  test('shuffleArray returns all elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const shuffled = shuffleArray(arr)
    expect(shuffled).toHaveLength(5)
    expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  test('initGame sets correct player count', () => {
    const store = useGameStore.getState()
    store.initGame(
      [{ userId: 'u1', username: 'Player1' }, { userId: 'u2', username: 'Player2' }],
      shuffleArray(PROJECT_CARDS),
      shuffleArray(PRODUCTION_TILES),
    )
    const state = useGameStore.getState()
    expect(state.players).toHaveLength(2)
    expect(state.phase).toBe('playing')
    expect(state.actionsRemaining).toBe(3)
    expect(state.players[0].hand).toHaveLength(3)
    expect(state.theOffer).toHaveLength(4)
  })

  test('initGame seeds every factory with exactly 1 of each element type', () => {
    // Rulebook setup: factories start 1-of-each · production tiles are refills only.
    useGameStore.getState().initGame(
      [{ userId: 'u1', username: 'P1' }, { userId: 'u2', username: 'P2' }],
      shuffleArray(PROJECT_CARDS),
      shuffleArray(PRODUCTION_TILES),
    )
    const state = useGameStore.getState()
    for (const factory of state.factories) {
      expect(factory.elements).toEqual([
        { type: 'energy', count: 1 },
        { type: 'biofarming', count: 1 },
        { type: 'technology', count: 1 },
        { type: 'community', count: 1 },
      ])
    }
    // Seeding must NOT consume the production stack · all 12 tiles remain for the clock.
    expect(state.productionTilesRemaining).toBe(12)
  })

  test('actionsRemaining decrements on drawCard', () => {
    const state = useGameStore.getState()
    const initialActions = state.actionsRemaining
    state.drawCard(0, 'deck', 0)
    expect(useGameStore.getState().actionsRemaining).toBe(initialActions - 1)
  })

  test('endTurn advances seat and resets actions', () => {
    const state = useGameStore.getState()
    state.endTurn()
    const next = useGameStore.getState()
    expect(next.actionsRemaining).toBe(3)
    expect(next.currentSeat).toBe(1)
  })

  test('factoryRefill decrements productionTilesRemaining', () => {
    const state = useGameStore.getState()
    const before = useGameStore.getState().productionTilesRemaining
    state.factoryRefill(0)
    expect(useGameStore.getState().productionTilesRemaining).toBe(before - 1)
  })

  test('last production tile triggers endGame', () => {
    const store = useGameStore.getState()
    store.initGame(
      [{ userId: 'u1', username: 'P1' }],
      shuffleArray(PROJECT_CARDS),
      [PRODUCTION_TILES[11]], // only the end flag tile
    )
    useGameStore.getState().factoryRefill(0)
    expect(useGameStore.getState().endGameTriggered).toBe(true)
  })

  test('placeElement moves an element from factory into an adjacent region', () => {
    const store = useGameStore.getState()
    store.initGame(
      [{ userId: 'u1', username: 'P1' }, { userId: 'u2', username: 'P2' }],
      shuffleArray(PROJECT_CARDS),
      shuffleArray(PRODUCTION_TILES),
    )
    // Factory 0 borders regions 0 and 1. Find an element it actually holds.
    const factory0 = useGameStore.getState().factories.find(f => f.id === 0)
    const elementType = factory0.elements[0].type
    const actionsBefore = useGameStore.getState().actionsRemaining

    useGameStore.getState().placeElement(0, 0, elementType, 0, 0, 0)

    const region0 = useGameStore.getState().regions.find(r => r.id === 0)
    expect(region0.hexes['0,0'].element).toBe(elementType)
    expect(useGameStore.getState().actionsRemaining).toBe(actionsBefore - 1)
  })

  test('placeElement rejects placing into a non-adjacent region', () => {
    const store = useGameStore.getState()
    store.initGame(
      [{ userId: 'u1', username: 'P1' }, { userId: 'u2', username: 'P2' }],
      shuffleArray(PROJECT_CARDS),
      shuffleArray(PRODUCTION_TILES),
    )
    const factory0 = useGameStore.getState().factories.find(f => f.id === 0)
    const elementType = factory0.elements[0].type
    const actionsBefore = useGameStore.getState().actionsRemaining

    // Factory 0 borders regions 0+1 · region 2 is not adjacent · move must be rejected.
    useGameStore.getState().placeElement(0, 0, elementType, 0, 0, 2)

    expect(useGameStore.getState().actionsRemaining).toBe(actionsBefore)
    const region2 = useGameStore.getState().regions.find(r => r.id === 2)
    expect(region2.hexes['0,0']).toBeUndefined()
  })
})

describe('placeElement placement rule (center-if-empty / adjacency)', () => {
  const freshGame = () =>
    useGameStore.getState().initGame(
      [{ userId: 'u1', username: 'P1' }, { userId: 'u2', username: 'P2' }],
      shuffleArray(PROJECT_CARDS),
      shuffleArray(PRODUCTION_TILES),
    )

  test('first element in an empty region must land on the center', () => {
    freshGame()
    const type = useGameStore.getState().factories.find(f => f.id === 0).elements[0].type
    const actionsBefore = useGameStore.getState().actionsRemaining

    // (5,5) is not region 0's center (0,0) · rejected, nothing consumed.
    useGameStore.getState().placeElement(0, 0, type, 5, 5, 0)
    expect(useGameStore.getState().regions.find(r => r.id === 0).hexes['5,5']).toBeUndefined()
    expect(useGameStore.getState().actionsRemaining).toBe(actionsBefore)

    // The center is accepted.
    useGameStore.getState().placeElement(0, 0, type, 0, 0, 0)
    expect(useGameStore.getState().regions.find(r => r.id === 0).hexes['0,0'].element).toBe(type)
  })

  test('a later element must be adjacent to an existing one', () => {
    freshGame()
    const type1 = useGameStore.getState().factories.find(f => f.id === 0).elements[0].type
    useGameStore.getState().placeElement(0, 0, type1, 0, 0, 0) // center

    const type2 = useGameStore.getState().factories.find(f => f.id === 0).elements[0].type
    const actionsBefore = useGameStore.getState().actionsRemaining

    // (5,5) is not adjacent to any existing element · rejected.
    useGameStore.getState().placeElement(0, 0, type2, 5, 5, 0)
    expect(useGameStore.getState().regions.find(r => r.id === 0).hexes['5,5']).toBeUndefined()
    expect(useGameStore.getState().actionsRemaining).toBe(actionsBefore)

    // (1,0) is adjacent to the center · accepted.
    useGameStore.getState().placeElement(0, 0, type2, 1, 0, 0)
    expect(useGameStore.getState().regions.find(r => r.id === 0).hexes['1,0'].element).toBe(type2)
  })
})

describe('scoreCard authoritative build validation', () => {
  const solarGarden = PROJECT_CARDS.find(c => c.id === 'card_01') // energy at (0,0) and (1,0)
  const seat0 = hexes => ({
    currentSeat: 0,
    players: [{ seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [solarGarden], bonusTokens: [], scores: [0, 0, 0] }],
    regions: [{ id: 0, name: 'Sacred City', center: { q: 0, r: 0 }, hexes, lastBuiltIllustration: null, scores: {} }],
  })

  test('rejects scoring when the pattern is not present on the board', () => {
    useGameStore.setState(seat0({}))
    useGameStore.getState().scoreCard(0, 'card_01', 0, null)
    const s = useGameStore.getState()
    expect(s.players[0].scores[0]).toBe(0)    // no points awarded
    expect(s.players[0].hand).toHaveLength(1) // card stays in hand
  })

  test('awards points when the pattern is completed and includes the placed hex', () => {
    useGameStore.setState(seat0({ '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }))
    useGameStore.getState().scoreCard(0, 'card_01', 0, '1,0')
    const s = useGameStore.getState()
    expect(s.players[0].scores[0]).toBe(2)    // 2pt card banked
    expect(s.players[0].hand).toHaveLength(0) // card consumed
    expect(s.regions.find(r => r.id === 0).lastBuiltIllustration).toBe('garden')
  })

  test('records the scored card id for the end-game civilization record', () => {
    useGameStore.setState(seat0({ '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }))
    expect(useGameStore.getState().tryScoreCard(0, 'card_01', 0, '1,0')).toBe(true)
    // scoredCardIds drives FinalScore "Districts Built" · guard self-initializes it for fixtures.
    expect(useGameStore.getState().players[0].scoredCardIds).toEqual(['card_01'])
  })
})

describe('getValidPlacements', () => {
  const freshGame = () =>
    useGameStore.getState().initGame(
      [{ userId: 'u1', username: 'P1' }, { userId: 'u2', username: 'P2' }],
      shuffleArray(PROJECT_CARDS),
      shuffleArray(PRODUCTION_TILES),
    )

  test('returns [] when actionsRemaining is 0', () => {
    freshGame()
    useGameStore.setState({ actionsRemaining: 0 })
    // Factory 0 borders region 0, but no actions remain.
    expect(useGameStore.getState().getValidPlacements(0, 0)).toEqual([])
  })

  test('returns only the region center when the region is empty', () => {
    freshGame()
    // Region 0 (Sacred City) center is (0,0); factory 0 borders it.
    expect(useGameStore.getState().getValidPlacements(0, 0)).toEqual([{ q: 0, r: 0 }])
  })

  test('returns the adjacent empty hexes when the region already has elements', () => {
    freshGame()
    // Drop one element on region 0's center, then ask where the next can go.
    useGameStore.getState().placeElement(0, 0, 'energy', 0, 0, 0)
    const valid = useGameStore.getState().getValidPlacements(0, 0)
    const keys = valid.map(h => `${h.q},${h.r}`).sort()
    // All 6 neighbors of (0,0) are empty and within radius 2 → all valid, center excluded.
    expect(keys).toEqual(['-1,0', '-1,1', '0,-1', '0,1', '1,-1', '1,0'].sort())
  })

  test('returns [] when the factory does not border the region', () => {
    freshGame()
    // Factory 0 borders regions 0 and 1 · region 2 is not adjacent.
    expect(useGameStore.getState().getValidPlacements(0, 2)).toEqual([])
  })
})

describe('production-tile end-game timing', () => {
  test('end-flag tile (pinned last) does not trigger end-game until the stack is exhausted', () => {
    useGameStore.getState().initGame(
      [{ userId: 'u1', username: 'P1' }],
      shuffleArray(PROJECT_CARDS),
      shuffleArray(PRODUCTION_TILES), // 12 tiles · initGame pins the flag to the bottom
    )
    for (let i = 0; i < 12; i++) {
      useGameStore.getState().factoryRefill(0)
      expect(useGameStore.getState().endGameTriggered).toBe(i >= 11)
    }
  })
})

describe('tryScoreCard (boolean scoring signal)', () => {
  const solarGarden = PROJECT_CARDS.find(c => c.id === 'card_01') // energy at (0,0)+(1,0) · illustration 'garden'
  const seat0 = (hexes, lastBuilt = null) => ({
    currentSeat: 0,
    players: [{ seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [solarGarden], bonusTokens: [], scores: [0, 0, 0] }],
    regions: [{ id: 0, name: 'Sacred City', center: { q: 0, r: 0 }, hexes, lastBuiltIllustration: lastBuilt, scores: {} }],
  })

  test('returns false when the pattern is not complete · no mutation', () => {
    useGameStore.setState(seat0({}))
    expect(useGameStore.getState().tryScoreCard(0, 'card_01', 0, null)).toBe(false)
    const s = useGameStore.getState()
    expect(s.players[0].scores[0]).toBe(0)
    expect(s.players[0].hand).toHaveLength(1)
  })

  test('returns true when complete · card removed from hand · score incremented', () => {
    useGameStore.setState(seat0({ '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }))
    expect(useGameStore.getState().tryScoreCard(0, 'card_01', 0, '1,0')).toBe(true)
    const s = useGameStore.getState()
    expect(s.players[0].scores[0]).toBe(2)
    expect(s.players[0].hand).toHaveLength(0)
    expect(s.regions.find(r => r.id === 0).lastBuiltIllustration).toBe('garden')
  })

  test('returns false on a Diverse City violation', () => {
    // Region's last build was already 'garden' · card_01 is also 'garden' → rejected.
    useGameStore.setState(seat0({ '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }, 'garden'))
    expect(useGameStore.getState().tryScoreCard(0, 'card_01', 0, '1,0')).toBe(false)
    expect(useGameStore.getState().players[0].scores[0]).toBe(0)
  })

  test('does not mutate state when returning false (wrong seat)', () => {
    useGameStore.setState(seat0({ '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }))
    const before = JSON.stringify(useGameStore.getState().players)
    expect(useGameStore.getState().tryScoreCard(1, 'card_01', 0, '1,0')).toBe(false) // currentSeat is 0
    expect(JSON.stringify(useGameStore.getState().players)).toBe(before)
  })
})

describe('bonus tokens (subsidy + initiative)', () => {
  const playerWith = (tokens, extra = {}) => ({
    currentSeat: 0,
    bonusUsedThisTurn: false, // reset · setState merges, so a prior test's flag would leak otherwise
    players: [{ seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [], bonusTokens: tokens, scores: [0, 0, 0] }],
    ...extra,
  })

  test('subsidy draws up to 2 cards (Offer first) and consumes the token', () => {
    useGameStore.setState(playerWith(['subsidy'], {
      theOffer: [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }],
      deck: [{ id: 'd1' }],
    }))
    useGameStore.getState().useBonus(0, 'subsidy')
    const s = useGameStore.getState()
    expect(s.players[0].hand.map(c => c.id)).toEqual(['o1', 'o2'])
    expect(s.theOffer.map(c => c.id)).toEqual(['o3'])
    expect(s.players[0].bonusTokens).toHaveLength(0)
  })

  test('subsidy draws 2 from the deck when the Offer is empty', () => {
    useGameStore.setState(playerWith(['subsidy'], { theOffer: [], deck: [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }] }))
    useGameStore.getState().useBonus(0, 'subsidy')
    expect(useGameStore.getState().players[0].hand.map(c => c.id)).toEqual(['d1', 'd2'])
  })

  test('initiative places an element at a valid adjacent hex and consumes the token', () => {
    useGameStore.setState(playerWith(['initiative'], {
      regions: [{ id: 0, name: 'SC', center: { q: 0, r: 0 }, hexes: { '0,0': { element: 'energy' } }, lastBuiltIllustration: null, scores: {} }],
    }))
    useGameStore.getState().useBonus(0, 'initiative', { elementType: 'community', toQ: 1, toR: 0, regionId: 0 })
    const s = useGameStore.getState()
    expect(s.regions[0].hexes['1,0'].element).toBe('community')
    expect(s.players[0].bonusTokens).toHaveLength(0)
  })

  test('initiative is rejected on an occupied hex and does NOT waste the token', () => {
    useGameStore.setState(playerWith(['initiative'], {
      regions: [{ id: 0, name: 'SC', center: { q: 0, r: 0 }, hexes: { '0,0': { element: 'energy' } }, lastBuiltIllustration: null, scores: {} }],
    }))
    useGameStore.getState().useBonus(0, 'initiative', { elementType: 'community', toQ: 0, toR: 0, regionId: 0 })
    const s = useGameStore.getState()
    expect(s.regions[0].hexes['0,0'].element).toBe('energy') // unchanged
    expect(s.players[0].bonusTokens).toEqual(['initiative']) // token preserved
  })
})

describe('one bonus per turn', () => {
  test('useBonus is rejected when a bonus was already used this turn', () => {
    useGameStore.setState({
      currentSeat: 0,
      bonusUsedThisTurn: true, // already spent a bonus this turn
      actionsRemaining: 3,
      players: [{ seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [], bonusTokens: ['automatization'], scores: [0, 0, 0] }],
    })
    useGameStore.getState().useBonus(0, 'automatization')
    const s = useGameStore.getState()
    expect(s.actionsRemaining).toBe(3) // no extra action granted
    expect(s.players[0].bonusTokens).toEqual(['automatization']) // token not consumed
  })

  test('bonusUsedThisTurn resets to false after endTurn', () => {
    useGameStore.setState({
      currentSeat: 0,
      bonusUsedThisTurn: true,
      players: [{ seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [], bonusTokens: [], scores: [0, 0, 0] }],
      theOffer: [],
      deck: [],
      endGameTriggered: false,
    })
    useGameStore.getState().endTurn()
    expect(useGameStore.getState().bonusUsedThisTurn).toBe(false)
  })
})

describe('bonus earn paths (cover-hex + score-threshold)', () => {
  const solarGarden = PROJECT_CARDS.find(c => c.id === 'card_01') // 2pt energy line at (0,0)+(1,0)
  const line2pt = (id, points) => ({ id, illustration: id, points, pattern: solarGarden.pattern })

  test('placeElement on a bonus hex awards the placer that token', () => {
    useGameStore.setState({
      currentSeat: 0,
      actionsRemaining: 3,
      bonusUsedThisTurn: false,
      players: [{ seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [], bonusTokens: [], scores: [0, 0, 0] }],
      factories: [{ id: 0, betweenRegions: [0, 1], q: 4, r: -2, elements: [{ type: 'energy', count: 1 }] }],
      // Region 0's center (0,0) is flagged as a 'subsidy' bonus space.
      regions: [{ id: 0, name: 'SC', center: { q: 0, r: 0 }, hexes: { '0,0': { bonusType: 'subsidy' } }, lastBuiltIllustration: null, scores: {}, bonusPile: [] }],
      productionTiles: [],
      productionTilesRemaining: 0,
    })
    useGameStore.getState().placeElement(0, 0, 'energy', 0, 0, 0)
    const s = useGameStore.getState()
    expect(s.regions[0].hexes['0,0'].element).toBe('energy')
    expect(s.players[0].bonusTokens).toEqual(['subsidy'])
  })

  test('tryScoreCard awards the top bonus-pile token when the score crosses a threshold (7)', () => {
    useGameStore.setState({
      currentSeat: 0,
      bonusUsedThisTurn: false,
      players: [{ seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [solarGarden], bonusTokens: [], scores: [6, 0, 0] }],
      regions: [{ id: 0, name: 'SC', center: { q: 0, r: 0 }, hexes: { '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }, lastBuiltIllustration: null, scores: {}, bonusPile: ['automatization'] }],
    })
    expect(useGameStore.getState().tryScoreCard(0, 'card_01', 0, '1,0')).toBe(true)
    const s = useGameStore.getState()
    expect(s.players[0].scores[0]).toBe(8) // 6 + 2 · crosses 7
    expect(s.players[0].bonusTokens).toEqual(['automatization'])
    expect(s.regions[0].bonusPile).toEqual([]) // top token consumed
  })

  test('crossing two thresholds (7 and 13) in one score awards two tokens, in pile order', () => {
    const bigCard = line2pt('mega', 7) // synthetic 7pt card · jumps the marker past both 7 and 13
    useGameStore.setState({
      currentSeat: 0,
      bonusUsedThisTurn: false,
      players: [{ seat: 0, userId: 'u', username: 'P', color: 'blue', hand: [bigCard], bonusTokens: [], scores: [6, 0, 0] }],
      regions: [{ id: 0, name: 'SC', center: { q: 0, r: 0 }, hexes: { '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }, lastBuiltIllustration: null, scores: {}, bonusPile: ['subsidy', 'permits', 'initiative'] }],
    })
    expect(useGameStore.getState().tryScoreCard(0, 'mega', 0, '1,0')).toBe(true)
    const s = useGameStore.getState()
    expect(s.players[0].scores[0]).toBe(13) // 6 + 7 · crosses 7 AND 13 (not 18)
    expect(s.players[0].bonusTokens).toEqual(['subsidy', 'permits']) // top two, in order
    expect(s.regions[0].bonusPile).toEqual(['initiative'])
  })
})

