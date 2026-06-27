import { describe, test, expect } from 'vitest'
import {
  findBuildableCards,
  findLargestCluster,
  calculateFinalScore,
  _runTests,
} from './patternMatcher'

const card = (id, illustration, pattern) => ({ id, illustration, pattern, points: 2 })

describe('findBuildableCards', () => {
  const twoEnergy = card('t1', 'garden', [
    { q: 0, r: 0, type: 'energy' },
    { q: 1, r: 0, type: 'energy' },
  ])

  test('detects a completed pattern in its base orientation', () => {
    const hexes = { '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }
    const res = findBuildableCards(hexes, [twoEnergy], null)
    expect(res).toHaveLength(1)
    expect(res[0].cardId).toBe('t1')
    expect(res[0].matchedHexKeys.sort()).toEqual(['0,0', '1,0'])
  })

  test('detects the same pattern in a rotated orientation', () => {
    // Two adjacent energy hexes along a different axis than the pattern is written in.
    const hexes = { '0,0': { element: 'energy' }, '0,1': { element: 'energy' } }
    const res = findBuildableCards(hexes, [twoEnergy], null)
    expect(res).toHaveLength(1)
    expect(res[0].matchedHexKeys.sort()).toEqual(['0,0', '0,1'])
  })

  test('returns nothing when the pattern is incomplete', () => {
    const hexes = { '0,0': { element: 'energy' } }
    expect(findBuildableCards(hexes, [twoEnergy], null)).toHaveLength(0)
  })

  test('returns nothing when an element type mismatches', () => {
    const hexes = { '0,0': { element: 'energy' }, '1,0': { element: 'community' } }
    expect(findBuildableCards(hexes, [twoEnergy], null)).toHaveLength(0)
  })

  test('Diverse City: skips a card whose illustration matches lastBuilt', () => {
    const hexes = { '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }
    expect(findBuildableCards(hexes, [twoEnergy], 'garden')).toHaveLength(0)
    expect(findBuildableCards(hexes, [twoEnergy], 'forest')).toHaveLength(1)
  })

  test('completing-element rule: only matches that include lastPlacedKey', () => {
    const hexes = { '0,0': { element: 'energy' }, '1,0': { element: 'energy' } }
    // The just-placed hex is part of the pattern · match returned.
    expect(findBuildableCards(hexes, [twoEnergy], null, '1,0')).toHaveLength(1)
    // A hex not part of any match · pattern was completed earlier, not now.
    expect(findBuildableCards(hexes, [twoEnergy], null, '9,9')).toHaveLength(0)
  })

  test('handles a 5-element pattern across rotations', () => {
    const ring = card('t5', 'heart', [
      { q: 0, r: 0, type: 'community' },
      { q: 1, r: 0, type: 'energy' },
      { q: -1, r: 1, type: 'biofarming' },
      { q: 0, r: 1, type: 'technology' },
      { q: 1, r: -1, type: 'community' },
    ])
    const hexes = {
      '0,0': { element: 'community' },
      '1,0': { element: 'energy' },
      '-1,1': { element: 'biofarming' },
      '0,1': { element: 'technology' },
      '1,-1': { element: 'community' },
    }
    const res = findBuildableCards(hexes, [ring], null)
    expect(res).toHaveLength(1)
    expect(res[0].matchedHexKeys).toHaveLength(5)
  })
})

describe('findLargestCluster', () => {
  test('finds a connected cluster of 4', () => {
    const hexes = {
      '0,0': { element: 'energy' }, '1,0': { element: 'energy' },
      '0,1': { element: 'energy' }, '2,0': { element: 'biofarming' },
      '-1,0': { element: 'energy' },
    }
    expect(findLargestCluster(hexes, 'energy')).toBe(4)
  })

  test('returns the larger of two disconnected clusters', () => {
    const hexes = {
      // cluster A: 2 connected
      '0,0': { element: 'energy' }, '1,0': { element: 'energy' },
      // cluster B: 3 connected, separated by a gap
      '5,0': { element: 'energy' }, '6,0': { element: 'energy' }, '5,1': { element: 'energy' },
    }
    expect(findLargestCluster(hexes, 'energy')).toBe(3)
  })

  test('returns 0 when the element type is absent', () => {
    expect(findLargestCluster({ '0,0': { element: 'energy' } }, 'community')).toBe(0)
  })
})

describe('calculateFinalScore', () => {
  test('best + 2nd + worst*3 + bonus*3', () => {
    expect(calculateFinalScore([18, 15, 6], 2)).toBe(57)
  })

  test('orders regions regardless of input order', () => {
    expect(calculateFinalScore([6, 18, 15], 2)).toBe(57)
  })

  test('defaults bonus to 0 and tolerates fewer than 3 regions', () => {
    expect(calculateFinalScore([10, 5])).toBe(15) // 10 + 5 + 0*3 + 0
  })

  test('folds the cluster bonus in as a flat term (board game rule p9 · T2 S18)', () => {
    // 18 + 15 + (6*3) + (2*3) = 57 · then + 4 cluster bonus = 61.
    expect(calculateFinalScore([18, 15, 6], 2, 4)).toBe(61)
  })

  test('cluster bonus is flat, NOT weighted by the worst-region x3', () => {
    // Same regions/unused, cluster bonus 5: the bonus adds exactly 5, never 15 (it is not tripled).
    expect(calculateFinalScore([10, 8, 4], 0, 5)).toBe(10 + 8 + (4 * 3) + 5) // 35
    // And it defaults to 0 when omitted, so the legacy 2-arg total is unchanged.
    expect(calculateFinalScore([10, 8, 4], 0)).toBe(30)
  })
})

test('_runTests smoke test passes', () => {
  expect(() => _runTests()).not.toThrow()
})
