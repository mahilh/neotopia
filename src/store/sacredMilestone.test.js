import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'

// card_01 · Fibonacci Solar Terrace · 2pt · pattern energy@(0,0)+energy@(1,0) · the simplest scorable shape.
const card2 = PROJECT_CARDS.find(c => c.id === 'card_01')
// card_17 · Orichalcum Energy Spire · 3pt · 3 energy in a line · for the multi-threshold case.
const card3 = PROJECT_CARDS.find(c => c.id === 'card_17')

// Numerological milestones (T2 S15): tryScoreCard fires a one-shot `sacredMilestone` when a player's TOTAL
// score (sum across all regions) crosses 7/9/13/18/27/36. Total, not per-region. Highest crossed wins.
describe('sacredMilestone · numerological thresholds', () => {
  beforeEach(() => {
    // Minimal scorable state: region 0 carries card_01's exact pattern · seat 0 holds the card.
    useGameStore.setState(s => {
      s.phase = 'playing'
      s.currentSeat = 0
      s.sacredMilestone = null
      s.players = [{ seat: 0, userId: 'a', username: 'A', hand: [{ ...card2 }], scores: {}, scoredCardIds: [], bonusTokens: [] }]
      s.regions = [
        { id: 0, name: 'Sacred City', hexes: { '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }, lastBuiltIllustration: null, scores: {}, bonusPile: [] },
        { id: 1, name: 'Living Earth', hexes: {}, lastBuiltIllustration: null, scores: {}, bonusPile: [] },
        { id: 2, name: 'Free Energy', hexes: {}, lastBuiltIllustration: null, scores: {}, bonusPile: [] },
      ]
    })
  })

  it('fires when the player TOTAL crosses 9', () => {
    useGameStore.setState(s => { s.players[0].scores = { 1: 7 } }) // 7 → +2 = 9
    expect(useGameStore.getState().tryScoreCard(0, 'card_01', 0)).toBe(true)
    const m = useGameStore.getState().sacredMilestone
    expect(m?.milestone).toBe(9)
    expect(m?.player).toBe(0)
    expect(typeof m?.message).toBe('string')
  })

  it('takes the HIGHEST threshold when one score crosses several', () => {
    useGameStore.setState(s => {
      s.players[0].hand = [{ ...card3 }]
      s.players[0].scores = { 1: 6 } // 6 → +3 = 9 · crosses BOTH 7 and 9 · highest (9) wins
      s.regions[0].hexes = { '0,0': { element: 'energy' }, '1,0': { element: 'energy' }, '2,0': { element: 'energy' } }
    })
    expect(useGameStore.getState().tryScoreCard(0, 'card_17', 0)).toBe(true)
    expect(useGameStore.getState().sacredMilestone?.milestone).toBe(9)
  })

  it('does NOT fire when no sacred number is crossed', () => {
    useGameStore.setState(s => { s.players[0].scores = { 1: 10 } }) // 10 → 12 crosses nothing
    expect(useGameStore.getState().tryScoreCard(0, 'card_01', 0)).toBe(true)
    expect(useGameStore.getState().sacredMilestone).toBeNull()
  })

  it('clearMilestone resets it to null', () => {
    useGameStore.setState(s => { s.players[0].scores = { 1: 5 } }) // 5 → 7 crosses 7
    useGameStore.getState().tryScoreCard(0, 'card_01', 0)
    expect(useGameStore.getState().sacredMilestone?.milestone).toBe(7)
    useGameStore.getState().clearMilestone()
    expect(useGameStore.getState().sacredMilestone).toBeNull()
  })

  // NOTE: the LAZY-field contract (initGame never seeds sacredMilestone, so the synced shape the E2E
  // seededState guard pins stays stable) is proven by tests/seededState.guard.test.js on a FRESH store —
  // asserting it here would be polluted by this file's beforeEach (which sets sacredMilestone=null).
})
