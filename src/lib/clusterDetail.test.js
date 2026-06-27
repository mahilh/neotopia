import { describe, it, expect } from 'vitest'
import { getClusterDetail, getClusterTotal } from './patternMatcher'

// Cluster scoring DETAIL (T2 S17 · Task B): the data layer behind T1's FinalScore cluster visualization
// AND the cluster bonus (T2 S18). getClusterDetail(regions) reports, per region per element, the LARGEST
// connected cluster (the existing findLargestCluster BFS · rule 10) when it is >= 2, with `bonus === count`
// · the board game rule p9 (1 point per element token on the biggest cluster of that element per region).
// The board is shared (region.hexes carries `element` only · no per-hex placer) so clusters · and the bonus
// · are board-global (civilization-level). `element` is the lowercase ELEMENT_COLORS key.

// Helper: a region whose hexes map is built from a list of [q, r, element] triples.
const region = (id, name, cells) => ({
  id, name,
  hexes: Object.fromEntries(cells.map(([q, r, element]) => [`${q},${r}`, { element }])),
})

describe('getClusterDetail', () => {
  it('identifies an Energy cluster of size 3 (a contiguous line of three energy hexes)', () => {
    // 0,0 - 1,0 - 2,0 are pairwise adjacent (neighbor dir [1,0]) · one connected cluster of 3.
    const regions = [region(0, 'Sacred City', [[0, 0, 'energy'], [1, 0, 'energy'], [2, 0, 'energy']])]
    const detail = getClusterDetail(regions)
    expect(detail).toEqual([{ regionId: 0, regionName: 'Sacred City', element: 'energy', count: 3, bonus: 3 }])
  })

  it('returns empty for no clusters (empty board AND scattered single elements)', () => {
    expect(getClusterDetail([region(0, 'Sacred City', [])])).toEqual([])
    // Two energy hexes that are NOT adjacent (0,0 and 3,0) → largest cluster is 1 each → no cluster.
    expect(getClusterDetail([region(0, 'Sacred City', [[0, 0, 'energy'], [3, 0, 'energy']])])).toEqual([])
    // No regions at all · and a malformed region without hexes · both safe → [].
    expect(getClusterDetail([])).toEqual([])
    expect(getClusterDetail([{ id: 0, name: 'X' }])).toEqual([])
  })

  it('ignores singletons but reports each element that forms a real >=2 cluster · lowercase keys', () => {
    // A 2-biofarming cluster (0,0 - 0,1 adjacent via dir [0,1]) plus a lone technology singleton (5,5).
    const regions = [region(1, 'Living Earth', [
      [0, 0, 'biofarming'], [0, 1, 'biofarming'], // cluster of 2
      [5, 5, 'technology'],                        // singleton · excluded
    ])]
    const detail = getClusterDetail(regions)
    expect(detail).toEqual([{ regionId: 1, regionName: 'Living Earth', element: 'biofarming', count: 2, bonus: 2 }])
    // Element key matches the lowercase ELEMENT_COLORS contract T1 imports.
    expect(detail[0].element).toBe('biofarming')
  })

  it('walks every region and every element in deterministic order (region, then element-type order)', () => {
    const regions = [
      region(0, 'Sacred City', [[0, 0, 'energy'], [1, 0, 'energy']]),            // energy x2
      region(2, 'Free Energy', [
        [0, 0, 'community'], [0, 1, 'community'], [0, 2, 'community'],            // community x3
        [4, 0, 'technology'], [5, 0, 'technology'],                              // technology x2
      ]),
    ]
    const detail = getClusterDetail(regions)
    // Region 0 first, then region 2. Within region 2, ELEMENT_TYPES order puts technology before community.
    expect(detail).toEqual([
      { regionId: 0, regionName: 'Sacred City', element: 'energy', count: 2, bonus: 2 },
      { regionId: 2, regionName: 'Free Energy', element: 'technology', count: 2, bonus: 2 },
      { regionId: 2, regionName: 'Free Energy', element: 'community', count: 3, bonus: 3 },
    ])
  })
})

// Cluster BONUS (T2 S18 · board game rule p9): each >= 2 cluster carries bonus === count (1 point per element
// token on the biggest cluster of that element per region). getClusterTotal sums every cluster's bonus into the
// single board-global number calculateFinalScore folds in. The bonus is CIVILIZATION-level (the shared board has
// no per-hex placer, so it cannot be attributed per player · documented divergence from the per-colour rulebook text).
describe('cluster bonus (getClusterDetail.bonus + getClusterTotal)', () => {
  it('bonus equals count on every reported cluster', () => {
    const regions = [region(0, 'Sacred City', [
      [0, 0, 'energy'], [1, 0, 'energy'], [2, 0, 'energy'],   // energy cluster of 3 → bonus 3
      [0, 2, 'community'], [0, 3, 'community'],               // community cluster of 2 → bonus 2
    ])]
    const detail = getClusterDetail(regions)
    expect(detail.every(c => c.bonus === c.count)).toBe(true)
    expect(detail.map(c => c.bonus).sort()).toEqual([2, 3])
  })

  it('getClusterTotal sums every cluster bonus across the whole board', () => {
    const regions = [
      region(0, 'Sacred City', [[0, 0, 'energy'], [1, 0, 'energy'], [2, 0, 'energy']]),   // 3
      region(2, 'Free Energy', [
        [0, 0, 'community'], [0, 1, 'community'], [0, 2, 'community'],                     // 3
        [4, 0, 'technology'], [5, 0, 'technology'],                                        // 2
      ]),
    ]
    // 3 (energy@0) + 2 (technology@2) + 3 (community@2) = 8
    expect(getClusterTotal(regions)).toBe(8)
  })

  it('bonus is 0 for elements with no neighbours (a lone token is not a cluster)', () => {
    // Two non-adjacent energy hexes (largest cluster 1 each) and a single biofarming → no >= 2 cluster at all.
    const regions = [region(0, 'Sacred City', [[0, 0, 'energy'], [3, 0, 'energy'], [9, 9, 'biofarming']])]
    expect(getClusterDetail(regions)).toEqual([])
    expect(getClusterTotal(regions)).toBe(0)
    // Empty board / no regions also total 0 (defensive).
    expect(getClusterTotal([])).toBe(0)
    expect(getClusterTotal([{ id: 0, name: 'X' }])).toBe(0)
  })

  it('does not double-count: each region+element cluster contributes its bonus exactly once', () => {
    // The SAME element type clusters in two different regions · each must be counted once, summed (not merged,
    // not duplicated). Energy-2 in region 0 + energy-3 in region 1 → 5, not 6 (merge) and not 2/3 alone.
    const regions = [
      region(0, 'Sacred City', [[0, 0, 'energy'], [1, 0, 'energy']]),                       // energy 2
      region(1, 'Living Earth', [[0, 0, 'energy'], [1, 0, 'energy'], [2, 0, 'energy']]),     // energy 3
    ]
    const detail = getClusterDetail(regions)
    expect(detail.filter(c => c.element === 'energy').map(c => c.regionId)).toEqual([0, 1]) // one entry per region
    expect(getClusterTotal(regions)).toBe(5)
  })
})
