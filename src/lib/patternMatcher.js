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
 * Used in final scoring (cluster bonus).
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

/**
 * Final score for one player across all 3 regions.
 * Formula: best + 2nd + (worst x 3) + (unusedBonus x 3).
 * Cluster bonus is folded into the per-region scores before this is called.
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
