// NeoTopia · cluster-bonus scoring guard (T3 S18 · Task C).
// The board game rule (rulebook p9 · CLAUDE.md): "Before calculating the final score on each Region, gain 1
// Point for each Element Token on the biggest cluster of those Elements in each Region." T2 shipped this S18
// (2348daa · feat(engine): cluster bonus scoring) as getClusterDetail (now carries `bonus`), getClusterTotal,
// and a 3rd `clusterBonus` arg on calculateFinalScore. This file LOCKS the rule's three load-bearing claims so
// a future engine edit can't silently drift them: (1) the bonus is 1pt per token in the BIGGEST cluster, (2)
// it RAISES the final score, (3) it is 0 with no adjacency.
//
// Location: a neutral test file in tests/ (NOT src/lib/, which is T2's lane and where the engine lives · lane
// discipline · the same pattern numerology.test.js / seededState.guard.test.js use). vitest collects it
// project-wide (vite.config sets no `include` · default **/*.test.js applies); Playwright ignores it (testMatch
// is **/*.e2e.js).
//
// Rule 67 (why this is committed NOW, not S17): the dependency was UNCOMMITTED in the shared tree earlier this
// session (Rule 66 · I read T2's in-flight getClusterDetail.bonus before it landed). I did NOT commit these
// tests then — they would have gone GREEN locally but RED the instant CI checked out origin (no `bonus` there).
// They are committed only after 2348daa put the cluster bonus on origin, so the gate is true WHERE CI runs.

import { describe, test, expect } from 'vitest'
import { getClusterDetail, getClusterTotal, calculateFinalScore } from '../src/lib/patternMatcher'

// region.hexes is a flat map keyed 'q,r' → { element } (the engine's shape · src/lib/patternMatcher.js).
const region = (id, name, hexes) => ({ id, name, hexes })

// Axial adjacency the engine BFS uses (HEX_NEIGHBORS): (1,0)(1,-1)(0,-1)(-1,0)(-1,1)(0,1). So '0,0'·'1,0'·'0,1'
// form ONE connected energy cluster of 3 ('1,0' and '0,1' are both neighbours of '0,0' AND of each other).
const CONNECTED_3 = { '0,0': { element: 'energy' }, '1,0': { element: 'energy' }, '0,1': { element: 'energy' } }

describe('cluster bonus scoring · board game rule p9 (T3 S18 guard for T2 2348daa)', () => {

  // ── Forge test 1 ────────────────────────────────────────────────────────────────────────────────────
  test('cluster bonus increases final score over the no-cluster baseline', () => {
    const regions = [region('r1', 'Sacred City', CONNECTED_3)]
    const clusterBonus = getClusterTotal(regions)
    expect(clusterBonus, 'a connected energy cluster of 3 must yield a bonus of 3').toBe(3)

    const scores = [10, 8, 6]
    const unused = 1
    const withoutBonus = calculateFinalScore(scores, unused)            // default clusterBonus = 0 (the baseline)
    const withBonus = calculateFinalScore(scores, unused, clusterBonus)

    expect(withBonus, 'the cluster bonus must RAISE the final score').toBeGreaterThan(withoutBonus)
    expect(withBonus - withoutBonus, 'the score delta must equal exactly the cluster bonus (a flat peer term)').toBe(clusterBonus)
  })

  // ── Forge test 2 ────────────────────────────────────────────────────────────────────────────────────
  test('biggest cluster wins · the bonus is the LARGEST connected group, not the sum of all groups', () => {
    // One region, energy in TWO disconnected groups: a 3-cluster (CONNECTED_3) and a far-away 2-cluster.
    const hexes = {
      ...CONNECTED_3,
      '5,5': { element: 'energy' }, '6,5': { element: 'energy' }, // a separate, non-adjacent energy pair
    }
    const regions = [region('r1', 'Sacred City', hexes)]
    const detail = getClusterDetail(regions)

    const energy = detail.filter(d => d.element === 'energy')
    expect(energy.length, 'energy must report ONE biggest-cluster entry, not one per group').toBe(1)
    expect(energy[0].count, 'the biggest energy cluster is 3, not the 3+2=5 sum').toBe(3)
    expect(getClusterTotal(regions), 'the total must be the biggest cluster (3), never the sum of groups (5)').toBe(3)
    expect(getClusterTotal(regions)).not.toBe(5)
  })

  // ── Forge test 3 ────────────────────────────────────────────────────────────────────────────────────
  test('cluster bonus is 0 when no same-element tokens are adjacent', () => {
    // '0,0' and '0,2' are NOT neighbours (axial r differs by 2) · biofarming is a lone token. Every largest
    // cluster is 1 (< the >=2 threshold) → no clusters → bonus 0.
    const hexes = {
      '0,0': { element: 'energy' }, '0,2': { element: 'energy' }, '3,0': { element: 'biofarming' },
    }
    const regions = [region('r1', 'Sacred City', hexes)]

    expect(getClusterDetail(regions), 'isolated tokens form no clusters').toEqual([])
    expect(getClusterTotal(regions), 'no adjacency → 0 cluster bonus').toBe(0)
    // And a 0 bonus must leave the score identical to the no-bonus baseline (the default-arg contract).
    expect(calculateFinalScore([10, 8, 6], 1, 0)).toBe(calculateFinalScore([10, 8, 6], 1))
  })

  // ── Rule-precision guards (the exact wording of the board game rule) ──────────────────────────────────
  test('bonus is 1 point per element token in the biggest cluster, summed PER region (rulebook p9)', () => {
    // Two regions, each with one cluster: r1 energy×3, r2 community×2. The rule sums per region+element.
    const regions = [
      region('r1', 'Sacred City', CONNECTED_3),                                  // energy cluster of 3
      region('r2', 'Living Earth', { '0,0': { element: 'community' }, '1,0': { element: 'community' } }), // community of 2
    ]
    const detail = getClusterDetail(regions)

    // Every entry's bonus is exactly its token count (1pt per token · bonus === count).
    for (const c of detail) expect(c.bonus, `bonus must equal count for ${c.element}@${c.regionId}`).toBe(c.count)
    expect(detail.map(d => [d.regionId, d.element, d.bonus])).toEqual([
      ['r1', 'energy', 3],
      ['r2', 'community', 2],
    ])
    expect(getClusterTotal(regions), '3 (energy in r1) + 2 (community in r2) summed across regions').toBe(5)
  })

  test('getClusterTotal never disagrees with the sum of getClusterDetail bonuses (one BFS · rule 10)', () => {
    const regions = [
      region('r1', 'Sacred City', { ...CONNECTED_3, '5,5': { element: 'community' }, '6,5': { element: 'community' } }),
      region('r2', 'Free Energy', { '0,0': { element: 'technology' }, '1,0': { element: 'technology' }, '0,1': { element: 'technology' } }),
    ]
    const detail = getClusterDetail(regions)
    const summed = detail.reduce((s, c) => s + c.bonus, 0)
    expect(getClusterTotal(regions), 'getClusterTotal must equal the sum of the per-cluster bonuses it reports').toBe(summed)
  })
})
