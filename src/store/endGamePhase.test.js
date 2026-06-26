import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore } from './gameStore'

// End-game phase transition · the condition FinalScore (T1) mounts on and GameRoom gates on
// (phase === 'scoring'), which was load-bearing yet untested. Rulebook: when the last production
// tile is revealed the game finishes the current round and plays ONE more, then scores. In the store:
//   factoryRefill (last tile / end-flag) → endGameTriggered = true
//   endTurn → on each seat-wrap-to-0 (a round boundary) endGameRoundsRemaining-- (starts at 2);
//             when it reaches 0 → phase = 'scoring'.
// So for N players exactly 2 full rounds (2N endTurns from a round start) elapse after the trigger.
// Kept in its own file · gameStore.test.js had concurrent in-flight edits from another lane (T1 S6).

const twoPlayersMidEndgame = (extra = {}) => ({
  phase: 'playing',
  players: [{ seat: 0 }, { seat: 1 }],
  currentSeat: 0,
  actionsRemaining: 0,
  turnNumber: 1,
  theOffer: [],
  deck: [],
  endGameTriggered: true,
  endGameRoundsRemaining: 2,
  ...extra,
})

const endTurn = () => useGameStore.getState().endTurn()
const phase = () => useGameStore.getState().phase

describe('end-game phase transition', () => {
  beforeEach(() => useGameStore.setState(twoPlayersMidEndgame()))

  test('plays exactly two more full rounds after the trigger, then enters scoring', () => {
    endTurn(); expect(phase()).toBe('playing') // seat 0→1
    endTurn(); expect(phase()).toBe('playing') // seat 1→0 · round boundary · rounds 2→1
    endTurn(); expect(phase()).toBe('playing') // seat 0→1
    endTurn(); expect(phase()).toBe('scoring') // seat 1→0 · round boundary · rounds 1→0 → scoring
    expect(useGameStore.getState().endGameRoundsRemaining).toBe(0)
  })

  test('does NOT enter scoring while the end-game has not been triggered', () => {
    useGameStore.setState(twoPlayersMidEndgame({ endGameTriggered: false }))
    for (let i = 0; i < 6; i++) endTurn() // three full rounds
    expect(phase()).toBe('playing')
    expect(useGameStore.getState().endGameRoundsRemaining).toBe(2) // untouched
  })

  test('the transition is irreversible · further endTurns stay in scoring', () => {
    for (let i = 0; i < 4; i++) endTurn()
    expect(phase()).toBe('scoring')
    endTurn(); endTurn()
    expect(phase()).toBe('scoring') // rounds clamped at 0 · the end-game never reopens
  })
})
