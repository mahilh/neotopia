import { describe, test, expect } from 'vitest'
import { placementVerdicts, allPlacementVerified } from './botVerdict'

describe('bot placement verification (Rule 53 · Rule 61)', () => {
  test('THE SIX-WEEK BUG: proxy 42 with an unreadable DB is NOT a pass', () => {
    // The literal shape of the June-28 production report that read as healthy for six weeks.
    const results = [{ game: 1, placedElements: 42, dbPlacedCount: null }]
    expect(placementVerdicts(results)[0].verdict).toBe('unverifiable')
    expect(allPlacementVerified(results)).toBe(false)
  })

  test('a proxy that over-counts swallowed clicks is a mismatch', () => {
    // T3 S12 caught exactly this live: proxy said 8, the board held 0.
    expect(placementVerdicts([{ game: 1, placedElements: 8, dbPlacedCount: 0 }])[0].verdict).toBe('mismatch')
  })

  test('agreement passes · the guard is not vacuous', () => {
    const results = [{ game: 1, placedElements: 11, dbPlacedCount: 11 }, { game: 2, placedElements: 0, dbPlacedCount: 0 }]
    expect(placementVerdicts(results).map(v => v.verdict)).toEqual(['match', 'match'])
    expect(allPlacementVerified(results)).toBe(true)
  })

  test('per-game, so two opposite errors cannot cancel into a green run', () => {
    // The old whole-run sum compared 5+0 against 2+3 and called it verified.
    const results = [{ game: 1, placedElements: 5, dbPlacedCount: 2 }, { game: 2, placedElements: 0, dbPlacedCount: 3 }]
    expect(placementVerdicts(results).map(v => v.verdict)).toEqual(['mismatch', 'mismatch'])
    expect(allPlacementVerified(results)).toBe(false)
  })

  test('one bad game among good ones still fails the run', () => {
    expect(allPlacementVerified([
      { game: 1, placedElements: 4, dbPlacedCount: 4 },
      { game: 2, placedElements: 4, dbPlacedCount: null },
    ])).toBe(false)
  })

  test('a run with no games is not a pass', () => {
    expect(allPlacementVerified([])).toBe(false)
  })
})
