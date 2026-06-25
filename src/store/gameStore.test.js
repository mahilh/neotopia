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
