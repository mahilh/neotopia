import { describe, it, expect } from 'vitest'
import { getClusterDetail, getClusterTotal } from './patternMatcher'

// Cluster scoring DETAIL (T2 S17 · Task B): the data layer behind T1's FinalScore cluster visualization
// AND the cluster bonus (T2 S18). getClusterDetail(regions) reports, per region per element, the LARGEST
// connected cluster (the existing findLargestCluster BFS · rule 10) when it is >= 2, with `bonus === count`
// · the board game rule p9 (1 point per element token on the biggest cluster of that element per region).
// The board is shared (region.hexes carries `element` only · no per-hex placer) so clusters · and the bonus
// · are board-global (civilization-level). `element` is the lowercase ELEMENT_COLORS key.

// Helper: a region whose hexes map is built from a list of [q, r, element] triples · an optional 4th
// entry is the placing seat (T2 S35 · `placedBy`), omitted for the pre-ownership boards above.
const region = (id, name, cells) => ({
  id, name,
  hexes: Object.fromEntries(cells.map(([q, r, element, placedBy]) => [
    `${q},${r}`,
    placedBy === undefined ? { element } : { element, placedBy },
  ])),
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

  it('a board with no placedBy still returns the legacy global reading when no seat is asked for', () => {
    // The no-seat call is what the FinalScore cluster VISUALIZATION uses (it shows the board, not a player),
    // and what any pre-S35 caller still gets. It must keep meaning "every token on the biggest cluster".
    const regions = [region(0, 'Sacred City', [[0, 0, 'energy'], [1, 0, 'energy'], [2, 0, 'energy']])]
    expect(getClusterTotal(regions)).toBe(3)
    expect(getClusterDetail(regions)[0].bonus).toBe(3)
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

// ── PER-PLAYER CLUSTER OWNERSHIP · board game rule p9, in full (T2 S35) ──────────────────────────────
//
// "each player gains 1 Point for each Element Token OF THEIR COLOR on the biggest cluster in each Region."
//
// From S18 until S35 the engine implemented that rule with the colour clause dropped, because a placed hex
// recorded `element` and nothing else. The result was one board-global number added identically to every
// player · measured live at 40 points, to both, in a real finished game. A term equal for everyone cannot
// change a ranking, so the only rule in NeoTopia meant to make WHERE you place matter was arithmetically
// incapable of doing it (docs/ACTION_ECONOMY_FINDING.md §8). placeElement now stamps `placedBy`.
//
// Note carefully what stays global: the CLUSTER. Adjacency is adjacency on a shared board, so a cluster can
// be built by several players together and `count` remains its factual size. Only the BONUS is attributed.
describe('per-player cluster bonus · getClusterDetail(regions, seat)', () => {
  it('splits one cluster between the players who built it · this is the whole change', () => {
    // A single connected energy cluster of 4. Seat 0 placed three of the tokens, seat 1 placed one.
    const regions = [region(0, 'Sacred City', [
      [0, 0, 'energy', 0], [1, 0, 'energy', 0], [2, 0, 'energy', 0], [3, 0, 'energy', 1],
    ])]

    // The cluster itself is still one shared cluster of 4 · ownership does not fragment it.
    expect(getClusterDetail(regions).map(c => c.count)).toEqual([4])

    expect(getClusterTotal(regions, 0)).toBe(3)
    expect(getClusterTotal(regions, 1)).toBe(1)
    expect(getClusterTotal(regions, 2)).toBe(0) // a seat that placed nothing scores nothing

    // THE CLAIM THAT MATTERS, asserted directly rather than inferred from the numbers: the term differs
    // between players. Every measurement in ACTION_ECONOMY_FINDING traced back to it not doing so.
    expect(getClusterTotal(regions, 0)).not.toBe(getClusterTotal(regions, 1))
  })

  it('the per-seat bonuses sum to the cluster size when every token is owned (nothing is invented or lost)', () => {
    const regions = [
      region(0, 'Sacred City', [[0, 0, 'energy', 0], [1, 0, 'energy', 1], [2, 0, 'energy', 1]]),
      region(1, 'Living Earth', [[0, 0, 'community', 1], [0, 1, 'community', 0]]),
    ]
    const boardTotal = getClusterTotal(regions)              // 3 + 2 = 5, the no-seat reading
    const summed = [0, 1].reduce((n, s) => n + getClusterTotal(regions, s), 0)
    expect(summed).toBe(boardTotal)
    expect(summed).toBe(5)
  })

  it('an UNOWNED token scores for nobody · the per-seat bonuses can sum to LESS than the cluster', () => {
    // Mixed board: a hex with no placedBy (a game in flight when S35 shipped, or any saved fixture).
    // It counts toward the cluster's size · it is really on the board · but no player may claim it.
    const regions = [region(0, 'Sacred City', [
      [0, 0, 'energy', 0], [1, 0, 'energy'], [2, 0, 'energy', 1],
    ])]
    expect(getClusterDetail(regions)[0].count).toBe(3)
    expect(getClusterTotal(regions, 0)).toBe(1)
    expect(getClusterTotal(regions, 1)).toBe(1)
    expect(getClusterTotal(regions, 0) + getClusterTotal(regions, 1)).toBe(2) // < 3 · the orphan pays nobody
  })

  it('only the BIGGEST cluster of an element scores · owning a smaller one is worth zero', () => {
    // Seat 1 owns a separate, smaller energy group. The rule scores the biggest cluster only, so seat 1's
    // two tokens earn nothing here. This is the rule's actual teeth and it is easy to lose in a refactor.
    const regions = [region(0, 'Sacred City', [
      [0, 0, 'energy', 0], [1, 0, 'energy', 0], [2, 0, 'energy', 0],   // biggest · 3, all seat 0
      [8, 0, 'energy', 1], [9, 0, 'energy', 1],                        // a rival group of 2, all seat 1
    ])]
    expect(getClusterDetail(regions)[0].count).toBe(3)
    expect(getClusterTotal(regions, 0)).toBe(3)
    expect(getClusterTotal(regions, 1)).toBe(0)
  })

  it('reports a cluster with bonus 0 rather than hiding it · a player must be able to see what they missed', () => {
    // The >= 2 threshold is about the CLUSTER, not the bonus. Dropping zero-bonus rows would make the
    // end screen silently omit exactly the clusters a losing player failed to contest.
    const regions = [region(0, 'Sacred City', [[0, 0, 'energy', 0], [1, 0, 'energy', 0]])]
    const detail = getClusterDetail(regions, 1)
    expect(detail).toHaveLength(1)
    expect(detail[0]).toMatchObject({ count: 2, bonus: 0 })
  })

  it('seat 0 is a real seat, not a falsy skip · the classic off-by-truthiness bug', () => {
    // `typeof seat === 'number'` rather than `if (seat)`. With a truthiness check, seat 0 · the host, the
    // most common human seat in this game · would fall through to the board-global reading and be handed
    // every token on the board. Worth its own test because it would look correct in every other seat.
    const regions = [region(0, 'Sacred City', [
      [0, 0, 'energy', 1], [1, 0, 'energy', 1], [2, 0, 'energy', 1],
    ])]
    expect(getClusterTotal(regions, 0)).toBe(0)  // NOT 3
    expect(getClusterTotal(regions, 1)).toBe(3)
  })
})
