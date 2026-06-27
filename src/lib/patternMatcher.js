// NeoTopia pattern matching engine · THE most critical file in the game.
// Without it, no project card can ever be scored.
//
// Algorithm: for each card in hand, try all 6 hex rotations at every occupied
// anchor hex. Returns every current match as {cardId, rotation, anchorQ, anchorR,
// matchedHexKeys}.
//
// Coords: axial (q,r), flat-top hexes. Hexes are keyed as 'q,r' strings in the store.

// Geometry has ONE owner: the 60deg cube-rotation primitive lives in hexUtils
// (hexRotate60CCW: (q,r) -> (-r, q+r)). Importing it here keeps pattern matching and the
// board layer from drifting. Order-6, so applying it 6 times enumerates all orientations ·
// the direction (CW vs CCW) is irrelevant since we collect all six.
import { hexRotate60CCW } from '../utils/hexUtils'

// All 6 rotations of a pattern (array of {q,r,type}), each normalized so its
// first cell sits at the origin (0,0).
function getAllRotations(pattern) {
  const rotations = []
  let current = pattern
  for (let i = 0; i < 6; i++) {
    const { q: oq, r: or } = current[0]
    const normalized = current.map(cell => ({
      q: cell.q - oq,
      r: cell.r - or,
      type: cell.type,
    }))
    rotations.push(normalized)
    current = current.map(cell => ({
      ...hexRotate60CCW(cell.q, cell.r),
      type: cell.type,
    }))
  }
  return rotations
}

/**
 * Find every card in hand that is currently buildable given the region state.
 * Called after each element placement.
 *
 * Because every rotation is normalized to anchor at its first cell, and we try
 * that anchor against every occupied hex, this finds a match wherever one exists
 * (a real placement always lands the first cell on an occupied hex).
 *
 * @param {Object} regionHexes - {[key:'q,r']: {element: string|null, ...}}
 * @param {Array}  playerHand  - [{id, illustration, pattern:[{q,r,type}], ...}]
 * @param {string|null} lastBuiltIllustration - Diverse City: skip this illustration
 * @param {string|null} lastPlacedKey - completing-element rule: if given, only return
 *        matches that include this just-placed hex (so already-scored patterns don't
 *        resurface). Omit to get every complete pattern regardless of last move.
 * @returns {Array} of {cardId, rotation, anchorQ, anchorR, matchedHexKeys}
 */
export function findBuildableCards(regionHexes, playerHand, lastBuiltIllustration, lastPlacedKey = null) {
  const results = []

  for (const card of playerHand) {
    // Diverse City: cannot build the same illustration type consecutively in a region.
    if (card.illustration === lastBuiltIllustration) continue

    const rotations = getAllRotations(card.pattern)
    let found = false

    for (const [rotIndex, rotatedPattern] of rotations.entries()) {
      for (const [hexKey, hexData] of Object.entries(regionHexes)) {
        if (!hexData.element) continue
        const [anchorQ, anchorR] = hexKey.split(',').map(Number)

        let matches = true
        const matchedKeys = []
        for (const cell of rotatedPattern) {
          const targetKey = `${anchorQ + cell.q},${anchorR + cell.r}`
          const targetHex = regionHexes[targetKey]
          if (!targetHex || targetHex.element !== cell.type) {
            matches = false
            break
          }
          matchedKeys.push(targetKey)
        }

        // Completing-element rule: the scored pattern must include the just-placed hex.
        if (matches && lastPlacedKey && !matchedKeys.includes(lastPlacedKey)) {
          matches = false
        }

        if (matches) {
          results.push({
            cardId: card.id,
            rotation: rotIndex,
            anchorQ,
            anchorR,
            matchedHexKeys: matchedKeys,
          })
          found = true
          break // one match per card is enough to mark it buildable
        }
      }
      if (found) break
    }
  }

  return results
}

const HEX_NEIGHBORS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
]

/**
 * Size of the largest connected cluster of one element type (BFS).
 * Consumed by getClusterDetail / getClusterTotal (the cluster bonus · board game rule p9) and the
 * getLargestCluster store selector. This is the ONE cluster walk · never reimplement it (rule 10).
 *
 * @param {Object} regionHexes - {[key:'q,r']: {element: string|null}}
 * @param {string} elementType
 * @returns {number} largest connected-component size
 */
export function findLargestCluster(regionHexes, elementType) {
  const keys = Object.keys(regionHexes).filter(k => regionHexes[k].element === elementType)
  if (keys.length === 0) return 0

  const visited = new Set()
  let largest = 0

  for (const startKey of keys) {
    if (visited.has(startKey)) continue
    const queue = [startKey]
    visited.add(startKey)
    let size = 0
    while (queue.length) {
      const key = queue.shift()
      size++
      const [q, r] = key.split(',').map(Number)
      for (const dir of HEX_NEIGHBORS) {
        const nKey = `${q + dir.q},${r + dir.r}`
        if (!visited.has(nKey) && regionHexes[nKey]?.element === elementType) {
          visited.add(nKey)
          queue.push(nKey)
        }
      }
    }
    largest = Math.max(largest, size)
  }

  return largest
}

// The four element types · the LOWERCASE engine keys, identical to ELEMENT_COLORS (hexUtils/ProjectCard/
// HexCell) so the UI keys a colour straight off `element` (rule 62 · the forge's 'Energy'/'BioFarming'
// were wrong · verified live against ELEMENT_COLORS). Shared by the cluster-detail walk below.
const ELEMENT_TYPES = ['energy', 'biofarming', 'technology', 'community']

/**
 * Per-region, per-element cluster breakdown · the data behind the FinalScore visualization AND the
 * cluster bonus (T2 S17 · `bonus` added T2 S18 once the rulebook number was known).
 *
 * For each region and each element type, reports the LARGEST connected cluster (BFS · the SAME
 * findLargestCluster the engine already uses · rule 10 · never reimplement) when it is >= 2 · a lone
 * element is not a cluster, so a board with no adjacencies returns []. `element` is the lowercase
 * ELEMENT_COLORS key so T1 colours it directly. `count` is the FACTUAL cluster size and `bonus` is the
 * points that cluster is worth.
 *
 * THE BOARD GAME RULE (rulebook p9 · now KNOWN, so encoding it is the rule, not invented data · rule 32):
 *   "Before calculating the final score on each Region, gain 1 Point for each Element Token on the biggest
 *    cluster of those Elements in each Region." → bonus === count (count IS that token count). The >= 2
 *    threshold means a lone token scores nothing here (matches the existing cluster definition the viz uses;
 *    flagged to Mahil in case the rulebook intends a singleton = 1pt · comms T2 S18).
 *
 * The board is SHARED: region.hexes stores `element` only, with NO per-hex placer (placeElement never
 * records who placed a hex), so clusters · and therefore the bonus · are GLOBAL to the board (a
 * CIVILIZATION bonus), not the board game's per-colour attribution. The data model carries no token colour
 * to split the bonus by; a future per-player placer would restore per-colour scoring (documented divergence
 * · comms T2 S18). getClusterTotal sums `bonus`; calculateFinalScore folds that one number in as a flat term.
 *
 * @param {Array} regions - [{ id, name, hexes: {[key:'q,r']: {element}} }]
 * @returns {Array} [{ regionId, regionName, element, count, bonus }] · count >= 2 · bonus === count ·
 *          deterministic order (region order, then ELEMENT_TYPES order)
 */
export function getClusterDetail(regions = []) {
  const detail = []
  for (const region of regions) {
    if (!region?.hexes) continue
    for (const element of ELEMENT_TYPES) {
      const count = findLargestCluster(region.hexes, element)
      if (count >= 2) {
        // bonus === count · 1 point per element token on the biggest cluster (board game rule p9).
        detail.push({ regionId: region.id, regionName: region.name, element, count, bonus: count })
      }
    }
  }
  return detail
}

/**
 * Total cluster bonus across the whole board · the single number calculateFinalScore folds in.
 * Sums the per-cluster `bonus` (= count) of every >= 2 cluster getClusterDetail finds, so it reuses that
 * one BFS (rule 10) and can never disagree with the per-cluster figures T1 renders. The board is SHARED
 * with no per-hex placer, so this is a CIVILIZATION-level bonus · the SAME number for every player · not
 * the board game's per-colour split (the data model carries no token colour · documented divergence).
 *
 * @param {Array} regions - same shape getClusterDetail takes
 * @returns {number} sum of biggest-cluster sizes (>= 2) over every region+element · 0 when none
 */
export function getClusterTotal(regions = []) {
  return getClusterDetail(regions).reduce((sum, c) => sum + (c.bonus || 0), 0)
}

/**
 * Final score for one player across all 3 regions.
 * Formula: best + 2nd + (worst x 3) + (unusedBonus x 3) + clusterBonus.
 * `clusterBonus` is the board-global cluster term (getClusterTotal · board game rule p9 · 1pt per element
 * token on the biggest cluster of that element per region). It is a FLAT peer term · added like the unused-
 * token bonus, NOT folded into a region score before the worst x3 weighting: CLAUDE.md's final-score
 * shorthand lists it as "+cluster", the unused bonus sets the flat-meta-term precedent, and the bonus is a
 * civilization quantity (the same for every player) so weighting it by an individual's worst region would be
 * arbitrary. (The region-fold reading is flagged to Mahil in comms · trivially swappable if he prefers it.)
 * Defaults to 0 so every existing caller · and the no-regions audit path · is unchanged until it passes the term.
 */
export function calculateFinalScore(regionalScores, unusedBonusCount = 0, clusterBonus = 0) {
  const sorted = [...regionalScores].sort((a, b) => b - a) // descending
  const best = sorted[0] || 0
  const second = sorted[1] || 0
  const worst = sorted[2] || 0
  return best + second + (worst * 3) + (unusedBonusCount * 3) + clusterBonus
}

// Lightweight self-test · throws on failure so `node` exits non-zero (a real gate).
// The thorough suite lives in patternMatcher.test.js.
export function _runTests() {
  const assert = (cond, msg) => { if (!cond) throw new Error('patternMatcher test FAILED: ' + msg) }

  // Rotation enumeration
  const p = [{ q: 1, r: 0, type: 'energy' }, { q: 0, r: 1, type: 'biofarming' }, { q: 1, r: -1, type: 'energy' }]
  const rots = getAllRotations(p)
  assert(rots.length === 6, 'expected 6 rotations')
  assert(rots.every(r => r[0].q === 0 && r[0].r === 0), 'each rotation normalized to origin')

  // Cluster detection
  const hexes = {
    '0,0': { element: 'energy' }, '1,0': { element: 'energy' },
    '0,1': { element: 'energy' }, '2,0': { element: 'biofarming' },
    '-1,0': { element: 'energy' },
  }
  assert(findLargestCluster(hexes, 'energy') === 4, 'expected energy cluster of 4')

  // Final score formula: 18 + 15 + (6*3) + (2*3) = 57
  assert(calculateFinalScore([18, 15, 6], 2) === 57, 'expected final score 57')
  // Cluster bonus is a flat add on top: 57 + 4 = 61
  assert(calculateFinalScore([18, 15, 6], 2, 4) === 61, 'expected final score 61 with cluster bonus')

  console.log('patternMatcher tests: PASS')
}
