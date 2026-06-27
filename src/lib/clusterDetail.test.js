import { describe, it, expect } from 'vitest'
import { getClusterDetail } from './patternMatcher'

// Cluster scoring DETAIL (T2 S17 · Task B): the data layer behind T1's FinalScore cluster visualization.
// getClusterDetail(regions) reports, per region per element, the LARGEST connected cluster (the existing
// findLargestCluster BFS · rule 10) when it is >= 2. The board is shared (region.hexes carries `element`
// only · no per-hex placer) so clusters are board-global. `element` is the lowercase ELEMENT_COLORS key.
// DESCRIPTIVE sizes only · there is intentionally NO points field (no cluster->points rule exists yet · rule 32).

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
    expect(detail).toEqual([{ regionId: 0, regionName: 'Sacred City', element: 'energy', count: 3 }])
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
    expect(detail).toEqual([{ regionId: 1, regionName: 'Living Earth', element: 'biofarming', count: 2 }])
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
      { regionId: 0, regionName: 'Sacred City', element: 'energy', count: 2 },
      { regionId: 2, regionName: 'Free Energy', element: 'technology', count: 2 },
      { regionId: 2, regionName: 'Free Energy', element: 'community', count: 3 },
    ])
  })
})
