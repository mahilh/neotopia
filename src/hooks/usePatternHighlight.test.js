import { describe, test, expect } from 'vitest'
import { findPatternHighlights } from './usePatternHighlight'

// 2-energy line · the simplest pattern (maximally symmetric, so bounds make tests deterministic).
const lineCard = {
  id: 'c1',
  illustration: 'solar',
  points: 2,
  pattern: [
    { q: 0, r: 0, type: 'energy' },
    { q: 1, r: 0, type: 'energy' },
  ],
}

describe('findPatternHighlights (near-miss engine)', () => {
  test('empty region returns no highlights', () => {
    const { completeKeys, partialKeys, completionCandidates } =
      findPatternHighlights({}, [lineCard], null, ['0,0', '1,0'])
    expect(completeKeys.size).toBe(0)
    expect(partialKeys.size).toBe(0)
    expect(completionCandidates).toHaveLength(0)
  })

  test('an already-complete pattern is in completeKeys and is EXCLUDED from near-miss', () => {
    // Both hexes filled · the card is buildable now, so it is a complete glow, NOT a near-miss.
    const hexes = { '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }
    const { completeKeys, partialKeys, completionCandidates } =
      findPatternHighlights(hexes, [lineCard], null, ['0,0', '1,0'])
    expect(completeKeys.has('0,0')).toBe(true)
    expect(completeKeys.has('1,0')).toBe(true)
    expect(partialKeys.size).toBe(0)
    expect(completionCandidates).toHaveLength(0)
  })

  test('n-1 near-miss returns the ONE completion hex + requiredType (missing hex is pattern[0] · no blind spot)', () => {
    // Only (1,0) is filled · the completing hex (0,0) corresponds to the pattern's FIRST cell —
    // the exact case a pattern[0]-anchor algorithm would miss. Bounds allow only (0,0).
    const hexes = { '1,0': { element: 'energy' } }
    const { completeKeys, partialKeys, completionCandidates } =
      findPatternHighlights(hexes, [lineCard], null, ['0,0', '1,0'])
    expect(completeKeys.size).toBe(0)
    expect(partialKeys.has('1,0')).toBe(true)
    expect(completionCandidates).toHaveLength(1)
    expect(completionCandidates[0]).toMatchObject({
      cardId: 'c1',
      missingKey: '0,0',
      requiredType: 'energy',
      filledKeys: ['1,0'],
    })
  })

  test('Diverse City: a card whose illustration matches lastBuiltIllustration is skipped', () => {
    const hexes = { '1,0': { element: 'energy' } }
    const { completeKeys, partialKeys, completionCandidates } =
      findPatternHighlights(hexes, [lineCard], 'solar', ['0,0', '1,0'])
    expect(completeKeys.size).toBe(0)
    expect(partialKeys.size).toBe(0)
    expect(completionCandidates).toHaveLength(0)
  })

  test('a wrong element blocking the line is NOT a near-miss (matcher rejects blocked completions)', () => {
    // 3-in-a-row energy card · a biofarming hex sits mid-line. The two empty legal hexes
    // (-1,0 and 2,0) are tested but neither yields a 3-energy line, so no near-miss surfaces.
    const rowCard = {
      id: 'c2',
      illustration: 'grid',
      points: 4,
      pattern: [
        { q: 0, r: 0, type: 'energy' },
        { q: 1, r: 0, type: 'energy' },
        { q: 2, r: 0, type: 'energy' },
      ],
    }
    const hexes = { '0,0': { element: 'energy' }, '1,0': { element: 'biofarming' } }
    const { partialKeys, completionCandidates } =
      findPatternHighlights(hexes, [rowCard], null, ['-1,0', '0,0', '1,0', '2,0', '3,0'])
    expect(partialKeys.size).toBe(0)
    expect(completionCandidates).toHaveLength(0)
  })
})
