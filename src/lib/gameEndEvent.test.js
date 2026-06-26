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
