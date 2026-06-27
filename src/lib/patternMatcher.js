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
 * DESCRIPTIVE today: consumed only by getClusterDetail + getLargestCluster (the FinalScore
 * cluster visualization · T2 S17). NOT yet a score input — calculateFinalScore folds in no
 * cluster term · a cluster->points rule is pending rulebook data (rule 32).
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
 * Per-region, per-element cluster breakdown for the FinalScore visualization (T2 S17 · Task B).
 *
 * For each region and each element type, reports the LARGEST connected cluster (BFS · the SAME
 * findLargestCluster the engine already uses · rule 10 · never reimplement) when it is >= 2 — a lone
 * element is not a cluster, so a board with no adjacencies returns []. `element` is the lowercase
 * ELEMENT_COLORS key so T1 colours it directly. `count` is the FACTUAL cluster size.
 *
 * The board is SHARED: region.hexes stores `element` only, with NO per-hex placer (placeElement never
 * records who placed a hex), so clusters are GLOBAL to the board, not attributable per player. T1 shows
 * "the civilization formed an Energy cluster of 3 in Sacred City", not "player X's cluster".
 *
 * DELIBERATELY NO `bonus`/points field (rule 32/7 · the honest gap): there is no cluster->points rule in
 * the engine (calculateFinalScore folds in NOTHING for clusters today · the three "folded upstream"
 * comments are aspirational, NOT implemented) and no rulebook number exists yet (pending from Mahil, like
 * the bonus-hex pile). Reporting count-as-points would fabricate a scoring rule the UI would render as
 * truth. This returns DESCRIPTIVE sizes only; when the points rule lands, add a `bonus` field here AND
 * fold it into scoring in the same change · do not invent one now.
 *
 * @param {Array} regions - [{ id, name, hexes: {[key:'q,r']: {element}} }]
 * @returns {Array} [{ regionId, regionName, element, count }] · count >= 2 · deterministic order
 *          (region order, then ELEMENT_TYPES order)
 */
export function getClusterDetail(regions = []) {
  const detail = []
  for (const region of regions) {
    if (!region?.hexes) continue
    for (const element of ELEMENT_TYPES) {
      const count = findLargestCluster(region.hexes, element)
      if (count >= 2) {
        detail.push({ regionId: region.id, regionName: region.name, element, count })
      }
    }
  }
  return detail
}

/**
 * Final score for one player across all 3 regions.
 * Formula: best + 2nd + (worst x 3) + (unusedBonus x 3).
 * NO cluster term today · clusters are reported DESCRIPTIVELY by getClusterDetail until a rulebook
 * cluster->points rule lands (rule 32 · do not fabricate one). When it lands, fold it into the
 * per-region scores BEFORE this is called (per-region scores stay this function's only input).
 */
export function calculateFinalScore(regionalScores, unusedBonusCount = 0) {
  const sorted = [...regionalScores].sort((a, b) => b - a) // descending
  const best = sorted[0] || 0
  const second = sorted[1] || 0
  const worst = sorted[2] || 0
  return best + second + (worst * 3) + (unusedBonusCount * 3)
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

  console.log('patternMatcher tests: PASS')
}
