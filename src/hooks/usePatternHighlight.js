// NeoTopia · the NEAR-MISS engine. T2 owns this file.
//
// Psychology (the whole point): when a player is ONE legal placement away from completing
// a project card, that is the near-miss · the strongest "one more turn" hook in the game.
// This hook surfaces, per region:
//   completeKeys         — hexes that are part of an already-buildable pattern (solid glow)
//   partialKeys          — the n-1 filled hexes of a near-miss (amber glow)
//   completionCandidates — [{cardId, missingKey, requiredType, filledKeys}] · the ONE empty
//                          hex (and the element it needs) that completes a not-yet-buildable card
//
// CORRECTNESS: we do NOT reimplement rotation/matching. We reuse patternMatcher.findBuildableCards
// (the single, fuzz-tested matcher owner) by HYPOTHETICALLY placing each element type on each
// LEGAL empty hex and asking "would that complete a card, including this hex?". This is why:
//   · candidates are restricted to legal placements (empty · adjacent to an element · in-region) —
//     no phantom near-misses at coordinates the rules would never allow a piece on.
//   · a card already complete on the board is EXCLUDED from near-miss (it's a complete glow, not
//     a near-miss) — placing to "extend" it is not a near-miss.
//   · there is NO pattern[0]-anchor blind spot: the candidate hex becomes occupied in the
//     hypothetical board, so the matcher anchors on it like any other element.

import { useMemo } from 'react'
import { findBuildableCards } from '../lib/patternMatcher'
import { hexesInRadius, REGIONS as REGION_DEFS, ELEMENT_COLORS } from '../utils/hexUtils'
import { useGameStore } from '../store/gameStore'

// The 4 canonical element types · single source of truth is hexUtils.ELEMENT_COLORS.
const ELEMENT_TYPES = Object.keys(ELEMENT_COLORS)

// Six axial neighbor directions (flat-top) · matches gameStore.NEIGHBOR_DIRS / placeElement.
const NEIGHBOR_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]

// Legal empty placement hexes: empty · adjacent to an existing element · within region bounds.
// Mirrors placeElement's adjacency rule. `boundSet` (region hex keys) is optional: when omitted
// the candidates are only constrained by adjacency (used by callers that have no bounds).
function legalEmptyPlacements(regionHexes, occupiedKeys, boundSet) {
  const candidates = new Set()
  for (const occKey of occupiedKeys) {
    const [q, r] = occKey.split(',').map(Number)
    for (const [dq, dr] of NEIGHBOR_DIRS) {
      const nKey = `${q + dq},${r + dr}`
      if (regionHexes[nKey]?.element) continue            // occupied · not placeable
      if (boundSet && boundSet.size > 0 && !boundSet.has(nKey)) continue // outside the region
      candidates.add(nKey)
    }
  }
  return [...candidates]
}

/**
 * Pure near-miss analysis for ONE region. No side effects · safe inside useMemo.
 *
 * @param {Object} regionHexes  {[key:'q,r']: {element: string|null}}
 * @param {Array}  playerHand   [{id, illustration, pattern:[{q,r,type}], points}]
 * @param {string|null} lastBuiltIllustration  Diverse City: skip this illustration
 * @param {Array<string>|Set<string>} [regionHexKeys]  the region's full hex-key set (bounds)
 * @returns {{completeKeys: Set, partialKeys: Set, completionCandidates: Array}}
 */
export function findPatternHighlights(regionHexes, playerHand, lastBuiltIllustration, regionHexKeys) {
  const completeKeys = new Set()
  const partialKeys = new Set()
  const completionCandidates = []

  const occupiedKeys = Object.entries(regionHexes).filter(([, h]) => h.element).map(([k]) => k)
  // A near-miss needs at least one placed element to build from.
  if (occupiedKeys.length === 0) return { completeKeys, partialKeys, completionCandidates }

  // 1. Already-buildable patterns on the current board (the single matcher owner).
  const completeCardIds = new Set()
  for (const m of findBuildableCards(regionHexes, playerHand, lastBuiltIllustration)) {
    m.matchedHexKeys.forEach(k => completeKeys.add(k))
    completeCardIds.add(m.cardId)
  }

  // 2. Near-miss: cards in hand that are NOT already complete and NOT Diverse-City-blocked.
  const nearMissHand = playerHand.filter(
    c => c.illustration !== lastBuiltIllustration && !completeCardIds.has(c.id),
  )
  if (nearMissHand.length === 0) return { completeKeys, partialKeys, completionCandidates }

  const boundSet = regionHexKeys instanceof Set ? regionHexKeys : new Set(regionHexKeys || [])
  const candidateHexes = legalEmptyPlacements(regionHexes, occupiedKeys, boundSet)

  const seen = new Set() // dedup per (cardId, completion hex)
  for (const emptyKey of candidateHexes) {
    for (const type of ELEMENT_TYPES) {
      // Hypothetically drop `type` on `emptyKey` and ask the matcher if that completes a card.
      const hypothetical = { ...regionHexes, [emptyKey]: { element: type } }
      const matches = findBuildableCards(hypothetical, nearMissHand, lastBuiltIllustration, emptyKey)
      for (const m of matches) {
        const dedupKey = `${m.cardId}|${emptyKey}`
        if (seen.has(dedupKey)) continue
        seen.add(dedupKey)
        const filledKeys = m.matchedHexKeys.filter(k => k !== emptyKey)
        filledKeys.forEach(k => partialKeys.add(k))
        completionCandidates.push({ cardId: m.cardId, missingKey: emptyKey, requiredType: type, filledKeys })
      }
    }
  }

  return { completeKeys, partialKeys, completionCandidates }
}

/**
 * React hook: near-miss highlights for the current player in a specific region.
 * Recomputes only when the board, hand, or current seat changes (Zustand slice subscriptions).
 * T1 calls this once per region render.
 */
export function usePatternHighlight(regionId) {
  const currentSeat = useGameStore(s => s.currentSeat)
  const players = useGameStore(s => s.players)
  const regions = useGameStore(s => s.regions)

  return useMemo(() => {
    const player = players.find(p => p.seat === currentSeat)
    const region = regions.find(r => r.id === regionId)
    if (!player || !region) {
      return { completeKeys: new Set(), partialKeys: new Set(), completionCandidates: [] }
    }
    const regionDef = REGION_DEFS.find(rd => rd.id === regionId)
    const regionHexKeys = regionDef
      ? hexesInRadius(regionDef.cq, regionDef.cr, regionDef.radius).map(h => `${h.q},${h.r}`)
      : []
    return findPatternHighlights(region.hexes, player.hand, region.lastBuiltIllustration, regionHexKeys)
  }, [players, regions, currentSeat, regionId])
}
