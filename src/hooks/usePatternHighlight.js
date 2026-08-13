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

  // 2. Near-miss: cards in hand that are NOT already complete.
  //
  // ⚠ THIS USED TO RE-CHECK DIVERSE CITY (`c.illustration !== lastBuiltIllustration`) AND THAT
  // MADE THE REAL RULE UNTESTABLE (T2 S67, from T1's S66 measurement · Rule 118). The matcher
  // applies the rule itself, unconditionally and first · patternMatcher.js:58, `if (card.
  // illustration === lastBuiltIllustration) continue` · so the rule was enforced in two places,
  // either was sufficient, and NO SINGLE MUTATION COULD RED EITHER. T1 measured all three arms
  // against their near-miss badge spec: remove the pre-filter GREEN, remove the matcher's argument
  // GREEN, remove both RED. Two guards that make each other invisible while both report as present.
  //
  // T1 ROUTED IT RATHER THAN DELETING A LINE IN MY FILE, and asked the right question: the
  // pre-filter shrinks the hand before the O(candidateHexes x 4 types) hypothetical loop, so it is
  // real work as an OPTIMISATION even where it is redundant as a RULE. That is a design call, and
  // a declared redundancy would have been a perfectly good answer.
  //
  // MEASURED, BECAUSE A PERFORMANCE ARGUMENT IS A CLAIM (Rule 122a · the justification is the
  // least-audited place in a diff). The deck holds 44 distinct illustrations across 56 cards and at
  // most THREE share one, so the filter usually removes nothing at all. At the largest overlap the
  // deck permits · a 12-card hand with all 3 'garden' cards blocked, i.e. a quarter of the hand ·
  // four blocks of 40 reps measured the saving at +0.8%, -4.8%, -24.4%, +1.7%. It flips sign and
  // the spread dwarfs it: there is no effect to keep. The blocked cards are cheap for the matcher
  // to reject too, so removing them early saves almost nothing.
  //
  // SO THE MATCHER IS THE SINGLE ENFORCEMENT POINT, which is also what this file's own header
  // promises ("we do NOT reimplement rotation/matching · the single, fuzz-tested matcher owner").
  // A second copy of a matcher rule is a second contract (Rule 45), and this one would have failed
  // SILENTLY and toward under-reporting if the two ever diverged.
  //
  // THE `completeCardIds` CLAUSE STAYS AND IS NOT REDUNDANT · the matcher has no idea which cards
  // are already complete on the real board, and an already-complete card is a solid glow rather
  // than a near-miss (see the header). Deleting it would put complete cards back into the near-miss
  // set, which is why the two clauses are not the same kind of thing despite sharing a line.
  const nearMissHand = playerHand.filter(c => !completeCardIds.has(c.id))
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
