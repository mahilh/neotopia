import { describe, it, expect } from 'vitest'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from './gameStore'
import { DECK } from '../lib/projectCards'

// Simultaneous draw (T2 S17 · Task A): Flow mode's defining mechanic. drawCard's TURN GATE is mode-aware —
// in Flow (getModeConfig.SIMULTANEOUS_DRAW = true) ANY seat may draw into its OWN hand; Classic stays locked
// to the current seat. The draw is deterministic (offer index / deck.shift on a once-shuffled, persisted deck ·
// rule 32). A non-current simultaneous draw must NOT spend the active turn-holder's shared actionsRemaining
// (rule 65 · the composed seam). Each player has their own hand, so concurrent draws never share a card.
const players = [{ userId: 'a', username: 'A' }, { userId: 'b', username: 'B' }]
const start = (mode) => useGameStore.getState().initGame(
  players, shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]), mode,
)
const handOf = (seat) => useGameStore.getState().players.find(p => p.seat === seat).hand

describe('Simultaneous draw (Flow mode)', () => {
  it('Flow mode allows simultaneous draw for the non-turn player (draws into their own hand)', () => {
    start('flow')
    expect(useGameStore.getState().currentSeat).toBe(0) // it is seat 0's turn
    const before = handOf(1).length
    useGameStore.getState().drawCard(1, 'deck') // seat 1 draws though it is NOT their turn
    expect(handOf(1).length).toBe(before + 1)     // permitted in Flow
  })

  it('Classic mode gates drawing to the current turn player only (non-turn draw is rejected)', () => {
    start('classic')
    expect(useGameStore.getState().currentSeat).toBe(0)
    const before = handOf(1).length
    useGameStore.getState().drawCard(1, 'deck') // seat 1 is not current → no-op in Classic
    expect(handOf(1).length).toBe(before)         // unchanged · turn-locked
  })

  it('Simultaneous draw does not share cards between players (each draws a distinct card)', () => {
    start('flow')
    const before0 = handOf(0).length
    const before1 = handOf(1).length
    useGameStore.getState().drawCard(0, 'deck') // current seat
    useGameStore.getState().drawCard(1, 'deck') // non-current · simultaneous
    const hand0 = handOf(0), hand1 = handOf(1)
    expect(hand0.length).toBe(before0 + 1)
    expect(hand1.length).toBe(before1 + 1)
    // The two freshly drawn cards are different objects with different ids (sequential deck.shift · no sharing).
    const drawn0 = hand0[hand0.length - 1]
    const drawn1 = hand1[hand1.length - 1]
    expect(drawn0.id).not.toBe(drawn1.id)
  })

  it('a non-current Flow draw does NOT spend the active player\'s shared action budget (rule 65)', () => {
    start('flow')
    expect(useGameStore.getState().actionsRemaining).toBe(3)
    useGameStore.getState().drawCard(1, 'deck')  // non-current simultaneous draw
    expect(useGameStore.getState().actionsRemaining).toBe(3) // active seat 0's budget untouched
    useGameStore.getState().drawCard(0, 'deck')  // the current seat DOES spend
    expect(useGameStore.getState().actionsRemaining).toBe(2)
  })
})
