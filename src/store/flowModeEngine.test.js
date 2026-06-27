import { describe, it, expect } from 'vitest'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from './gameStore'
import { DECK } from '../lib/projectCards'
import { GAME_MODES, getModeConfig } from './gameConfig'

// Flow mode engine integration (T2 S16): initGame reads getModeConfig(mode) to size the production-tile clock
// (END_GAME_TILE) and seed the turn budget (TURN_TIME_LIMIT) · endTurn resets the budget from the same config.
// mode is a LAZY synced field (set only for non-default modes) so a Classic game's shape is unchanged.
const players = [{ userId: 'a', username: 'A' }, { userId: 'b', username: 'B' }]
const start = (mode) => useGameStore.getState().initGame(
  players, shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]), mode,
)

describe('Flow mode engine integration', () => {
  it('getModeConfig: classic = 12 tiles / 90s · flow = 9 tiles / 15s (config is the single source)', () => {
    expect(getModeConfig('classic').END_GAME_TILE).toBe(12)
    expect(getModeConfig('classic').TURN_TIME_LIMIT).toBe(90)
    expect(getModeConfig('flow').END_GAME_TILE).toBe(9)
    expect(getModeConfig('flow').TURN_TIME_LIMIT).toBe(15)
  })

  it('Flow mode: initGame seeds a 9-tile clock + 15s budget + persists mode (the endgame-on-tile-9 wiring)', () => {
    start('flow')
    const s = useGameStore.getState()
    expect(s.productionTilesRemaining).toBe(GAME_MODES.flow.END_GAME_TILE) // 9 · the existing remaining===0 trigger now ends the game at tile 9
    expect(s.turnTimeRemaining).toBe(15)
    expect(s.mode).toBe('flow') // synced to both clients via syncFromServer
  })

  it('Classic mode: initGame keeps the 12-tile clock + 90s budget AND leaves no mode field (guard-safe shape)', () => {
    start('classic')
    const s = useGameStore.getState()
    expect(s.productionTilesRemaining).toBe(12)
    expect(s.turnTimeRemaining).toBe(90)
    // Lazy field: classic never sets `mode`, so the serialized shape the seededState guard pins is unchanged.
    const serialized = JSON.parse(JSON.stringify(s))
    expect('mode' in serialized).toBe(false)
  })

  it('default (no mode arg) is Classic · backward-compatible with every existing caller', () => {
    useGameStore.getState().initGame(players, shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]))
    const s = useGameStore.getState()
    expect(s.productionTilesRemaining).toBe(12)
    expect(s.turnTimeRemaining).toBe(90)
  })

  it('endTurn resets the budget from mode: Flow → 15s, Classic → 90s (rule-32-safe constant, not a clock)', () => {
    start('flow')
    useGameStore.setState(s => { s.turnTimeRemaining = 3 }) // simulate a countdown mid-turn
    useGameStore.getState().endTurn()
    expect(useGameStore.getState().turnTimeRemaining).toBe(15)

    start('classic')
    useGameStore.setState(s => { s.turnTimeRemaining = 3 })
    useGameStore.getState().endTurn()
    expect(useGameStore.getState().turnTimeRemaining).toBe(90)
  })

  // NOTE: the end-game-on-stack-exhaustion LOGIC itself (remaining===0 → endGameTriggered → 'scoring') is
  // pre-existing and covered by engineFuzz.test.js (which plays full random games to termination). This file
  // verifies the NEW wiring: the stack length (clock) and the turn budget are mode-derived, not hardcoded.
})
