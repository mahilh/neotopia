// A board ONE LEGAL PLACEMENT from completing a real hand card (T1 S58, extracted T1 S59).
//
// Written for GameRoom.scorePending.test.jsx and now shared with GameRoom.cardreach.test.jsx. It is a
// module rather than a copy in each file for the ordinary reason: two copies of a geometry rule are
// two contracts, and the second one drifts silently (Rule 45). It follows src/store/deadlockFixture.js
// deliberately · a PURE function that takes the current regions and returns a PATCH, touching no
// store, so a browser page could seed the same board.
//
// ⚠ THE CALLER MUST CERTIFY IT WITH THE ENGINE, NOT WITH ME. A seeded board is a claim about
// geometry and this file is the wrong party to adjudicate it. Ask `getBuildableCards(regionId)`:
// the card must be absent BEFORE the missing hex is filled and present after. Without that the test
// quietly proves something about a board that cannot exist (Rule 102's corollary).
//
// It returns null when no hand card fits · that is UNMEASURED and must not read as a pass (Rule 80).

import { hexesInRadius, REGIONS as REGION_DEFS } from '../utils/hexUtils'

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]

export function completableStatePatch(regions, hand, regionId = 0) {
  const def = REGION_DEFS.find(rd => rd.id === regionId)
  if (!def) return null
  const inRegion = new Set(hexesInRadius(def.cq, def.cr, def.radius).map(h => `${h.q},${h.r}`))
  const region = regions.find(r => r.id === regionId)
  if (!region) return null
  const centre = region.center

  for (const card of hand) {
    const p = card.pattern
    if (!p || p.length < 2) continue
    // Anchor pattern[0] on the region centre · the identity rotation. The matcher handles rotation
    // itself, so a pattern seeded in its own orientation is the case least likely to be a fluke.
    const abs = p.map(h => ({ q: centre.q + (h.q - p[0].q), r: centre.r + (h.r - p[0].r), type: h.type }))
    if (!abs.every(h => inRegion.has(`${h.q},${h.r}`))) continue

    // Leave out the LAST hex. It must touch a seeded one or no legal placement can reach it · the
    // contiguity rule getValidPlacements enforces.
    const missing = abs[abs.length - 1]
    const seeded = abs.slice(0, -1)
    const touches = seeded.some(s => NEIGHBOURS.some(([dq, dr]) => s.q === missing.q + dq && s.r === missing.r + dr))
    if (!touches) continue

    const hexes = {}
    for (const h of seeded) hexes[`${h.q},${h.r}`] = { element: h.type, placedBy: 0 }
    return {
      card, regionId, requiredType: missing.type, missingKey: `${missing.q},${missing.r}`,
      patch: {
        regions: regions.map(r => (r.id === regionId ? { ...r, hexes: { ...r.hexes, ...hexes } } : r)),
      },
    }
  }
  return null
}
