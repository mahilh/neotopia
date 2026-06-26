import { describe, test, expect } from 'vitest'
import { TURN_TIME_LIMIT } from './gameConfig'

// TURN_TIME_LIMIT is the engine-owned static per-turn budget (seconds) for the colonist.io-style
// countdown. It is a CONSTANT, not store state · so it never bloats game_sessions.state and never
// changes the engine state shape (which would break the E2E seededState guard). The live countdown +
// auto-end-turn is T1's LOCAL UI concern (comms T2 S9 → T1) · endTurn never reads a clock (rule 32).
describe('TURN_TIME_LIMIT · engine config for the UI turn countdown', () => {
  test('is a 90-second budget', () => {
    expect(TURN_TIME_LIMIT).toBe(90)
  })

  test('is a finite positive number T1 can seed a countdown from', () => {
    expect(Number.isFinite(TURN_TIME_LIMIT)).toBe(true)
    expect(TURN_TIME_LIMIT).toBeGreaterThan(0)
  })
})
