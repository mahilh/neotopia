import { describe, it, expect } from 'vitest'
import { GAME_MODES, DEFAULT_GAME_MODE, getModeConfig, TURN_TIME_LIMIT } from './gameConfig'

// NeoTopia game modes (T2 S15) · the config foundation for real-time "Flow" play.
describe('GAME_MODES · Flow mode foundation', () => {
  it('Flow mode: 15s turns · 9 tiles · simultaneous draw', () => {
    expect(GAME_MODES.flow.TURN_TIME_LIMIT).toBe(15)
    expect(GAME_MODES.flow.END_GAME_TILE).toBe(9)
    expect(GAME_MODES.flow.SIMULTANEOUS_DRAW).toBe(true)
  })

  it('Classic is the default · 90s · 12 tiles · sequential draws', () => {
    expect(DEFAULT_GAME_MODE).toBe('classic')
    expect(GAME_MODES.classic.TURN_TIME_LIMIT).toBe(TURN_TIME_LIMIT)
    expect(GAME_MODES.classic.TURN_TIME_LIMIT).toBe(90)
    expect(GAME_MODES.classic.END_GAME_TILE).toBe(12)
    expect(GAME_MODES.classic.SIMULTANEOUS_DRAW).toBe(false)
  })

  it('getModeConfig falls back to Classic for an unknown / missing mode', () => {
    expect(getModeConfig('flow').id).toBe('flow')
    expect(getModeConfig('nonsense').id).toBe('classic')
    expect(getModeConfig(undefined).id).toBe('classic')
  })
})
