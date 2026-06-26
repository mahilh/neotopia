import { describe, test, expect } from 'vitest'
import { TURN_TIME_LIMIT } from './gameConfig'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from './gameStore'
import { DECK } from '../lib/projectCards'

// TURN_TIME_LIMIT is the engine-owned static per-turn budget (seconds) · the single source for the value.
describe('TURN_TIME_LIMIT · engine config for the UI turn countdown', () => {
  test('is a 90-second budget', () => {
    expect(TURN_TIME_LIMIT).toBe(90)
  })

  test('is a finite positive number T1 can seed a countdown from', () => {
    expect(Number.isFinite(TURN_TIME_LIMIT)).toBe(true)
    expect(TURN_TIME_LIMIT).toBeGreaterThan(0)
  })
})

// turnTimeRemaining IS a synced store field (T3 S8 request · so the WAITING player sees the active player's
// clock via pushState). endTurn RESETS it to TURN_TIME_LIMIT — a constant, NOT a clock read (rule 32) — and
// the per-second decrement is T1's LOCAL component concern (never a pushState per tick · that would storm).
describe('turnTimeRemaining · synced per-turn countdown', () => {
  const startGame = () => useGameStore.getState().initGame(
    [{ userId: 'a', username: 'A' }, { userId: 'b', username: 'B' }],
    shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
  )

  test('a fresh game seeds the full budget', () => {
    startGame()
    expect(useGameStore.getState().turnTimeRemaining).toBe(TURN_TIME_LIMIT)
  })

  test('endTurn RESETS the budget so each player gets a full turn (no clock read · rule 32)', () => {
    startGame()
    useGameStore.setState(s => { s.turnTimeRemaining = 12 }) // simulate a countdown mid-turn
    useGameStore.getState().endTurn()
    expect(useGameStore.getState().turnTimeRemaining).toBe(TURN_TIME_LIMIT)
  })

  test('round-trips through game_sessions.state as a plain number (rule 22 · syncs to every client)', () => {
    startGame()
    const snapshot = JSON.parse(JSON.stringify(useGameStore.getState()))
    expect(snapshot.turnTimeRemaining).toBe(TURN_TIME_LIMIT)
    expect(Number.isFinite(snapshot.turnTimeRemaining)).toBe(true)
  })
})
