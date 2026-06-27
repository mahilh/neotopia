import { describe, test, expect } from 'vitest'
import { buildGameEndEvent, GAME_END_EVENT_TYPE } from './gameEndEvent'
import { calculateFinalScore } from './patternMatcher'
import { EVENT_TYPE_DB } from '../hooks/useGameSync'

// The game_end audit payload (T2 S8) · the permanent civilization record written when phase→'scoring'.
// These tests pin TWO things the forge got wrong / a live seam bug got wrong:
//   1. the final total must come from the engine (calculateFinalScore), not a non-existent player.total
//   2. the event key must resolve through useGameSync.EVENT_TYPE_DB to a CHECK-allowed DB value, or the
//      audit insert is silently skipped (exactly how the move-event log went empty after the S6 double-fix).

const threePlayerScoringState = () => ({
  phase: 'scoring',
  players: [
    { seat: 0, userId: 'u0', username: 'Mahil',   scores: [10, 4, 2], bonusTokens: ['subsidy'],                 scoredCardIds: ['c1', 'c2', 'c3'] },
    { seat: 1, userId: 'u1', username: 'Builder', scores: [6, 6, 0],  bonusTokens: [],                          scoredCardIds: ['c4'] },
    { seat: 2, userId: 'u2', username: 'Aether',  scores: [3, 3, 3],  bonusTokens: ['initiative', 'automatization'], scoredCardIds: [] },
  ],
})

describe('buildGameEndEvent', () => {
  test('every player total is the engine total (calculateFinalScore · single source of truth)', () => {
    const { eventData } = buildGameEndEvent(threePlayerScoringState())
    const bySeat = Object.fromEntries(eventData.final_scores.map(p => [p.seat, p]))
    // seat 0: [10,4,2] u1 → 10+4+(2*3)+(1*3) = 23 · seat 1: [6,6,0] u0 → 12 · seat 2: [3,3,3] u2 → 3+3+9+6 = 21
    expect(bySeat[0].total).toBe(calculateFinalScore([10, 4, 2], 1))
    expect(bySeat[0].total).toBe(23)
    expect(bySeat[1].total).toBe(12)
    expect(bySeat[2].total).toBe(21)
  })

  test('cluster bonus (board game rule p9) folds into every total when the snapshot carries regions · T2 S18', () => {
    // A shared board with one energy cluster of 3 in Sacred City → getClusterTotal = 3, added to EVERY player
    // (civilization-level · the same number for all · no per-hex placer to attribute it per player).
    const state = {
      ...threePlayerScoringState(),
      regions: [
        { id: 0, name: 'Sacred City', hexes: { '0,0': { element: 'energy' }, '1,0': { element: 'energy' }, '2,0': { element: 'energy' } } },
        { id: 1, name: 'Living Earth', hexes: {} },
        { id: 2, name: 'Free Energy', hexes: {} },
      ],
    }
    const { eventData } = buildGameEndEvent(state)
    const bySeat = Object.fromEntries(eventData.final_scores.map(p => [p.seat, p]))
    // Each player's total is its no-cluster total + 3 (23→26, 12→15, 21→24).
    expect(bySeat[0].total).toBe(calculateFinalScore([10, 4, 2], 1, 3))
    expect(bySeat[0].total).toBe(26)
    expect(bySeat[1].total).toBe(15)
    expect(bySeat[2].total).toBe(24)
  })

  test('NO regions in the snapshot → cluster bonus 0 → totals match the screen (the live { players } path)', () => {
    // The real-game caller (FinalScore) passes only { players }; absent regions must leave totals unchanged.
    const { eventData } = buildGameEndEvent(threePlayerScoringState())
    const bySeat = Object.fromEntries(eventData.final_scores.map(p => [p.seat, p]))
    expect(bySeat[0].total).toBe(23)
    expect(bySeat[1].total).toBe(12)
    expect(bySeat[2].total).toBe(21)
  })

  test('districts come from scoredCardIds · districts_built is their sum (the global-index contribution)', () => {
    const { eventData } = buildGameEndEvent(threePlayerScoringState())
    const bySeat = Object.fromEntries(eventData.final_scores.map(p => [p.seat, p]))
    expect(bySeat[0].districts).toBe(3)
    expect(bySeat[1].districts).toBe(1)
    expect(bySeat[2].districts).toBe(0)
    expect(eventData.districts_built).toBe(4)
  })

  test('final_scores is ranked by total desc · winner_seat is the top seat', () => {
    const { eventData } = buildGameEndEvent(threePlayerScoringState())
    expect(eventData.final_scores.map(p => p.seat)).toEqual([0, 2, 1]) // 23 > 21 > 12
    expect(eventData.winner_seat).toBe(0)
  })

  test('SEAM GUARD · eventType resolves through EVENT_TYPE_DB to the CHECK-allowed game_end', () => {
    // This is the assertion that would have caught the S6 move-event double-fix: an emitted key that
    // is NOT in EVENT_TYPE_DB falls through and the audit row is skipped. game_end MUST map.
    const { eventType } = buildGameEndEvent(threePlayerScoringState())
    expect(eventType).toBe(GAME_END_EVENT_TYPE)
    expect(EVENT_TYPE_DB[eventType]).toBe('game_end')
    const ALLOWED = ['draw_card', 'place_element', 'build_project', 'use_bonus', 'factory_refill', 'turn_end', 'game_end']
    expect(ALLOWED).toContain(EVENT_TYPE_DB[eventType])
  })

  test('defensive · a player missing scores/bonusTokens/scoredCardIds does not throw and reads as zero', () => {
    const { eventData } = buildGameEndEvent({ players: [{ seat: 0 }] })
    expect(eventData.final_scores[0].total).toBe(0)
    expect(eventData.final_scores[0].districts).toBe(0)
    expect(eventData.final_scores[0].unused_bonus).toBe(0)
    expect(eventData.districts_built).toBe(0)
  })

  test('defensive · empty / undefined state yields an empty record, not a crash', () => {
    for (const s of [undefined, {}, { players: [] }]) {
      const { eventData } = buildGameEndEvent(s)
      expect(eventData.final_scores).toEqual([])
      expect(eventData.districts_built).toBe(0)
      expect(eventData.winner_seat).toBeNull()
    }
  })
})
