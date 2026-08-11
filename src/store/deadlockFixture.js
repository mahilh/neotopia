// NeoTopia · THE DEADLOCK BOARD, in one place (T2 S47 · requested by T3 S46).
//
// WHY THIS IS A MODULE AND NOT A COPY. T3 rebuilt this board for their browser gate and their first
// fill reproduced my first-draft bug EXACTLY: 2 legal placements in a state meant to have none · the
// same number my own comment in deadlockEndgame.test.js records. Two lanes, same bug, same 2. They
// asked for the export rather than keeping a silent second copy, which is the right instinct and the
// opposite of what usually happens (Rule 45 · the copy that drifts is the one nobody is looking at).
//
// THE TRAP, so it cannot be re-derived wrongly a third time: a region's `hexes` map only contains the
// keys that have been TOUCHED. Filling "every hex in region.hexes" therefore leaves every untouched
// hex empty and still placeable, and the board silently keeps a couple of legal moves. The fill has to
// enumerate the region's full radius from REGION_DEFS. That is the whole content of the bug, twice.
//
// SCOPE, carried from deadlockEndgame.test.js so it travels with the fixture: this board is
// UNREACHABLE BY LEGAL PLAY (0 occurrences in 160 turn-samples · adversarialFuzz.test.js), because
// refillFactoryDraft restocks a factory the moment a placement empties it while tiles remain. It is a
// guard fixture, not an observed position, and anything seeded from it is testing a belt-and-braces
// path rather than the audit's actual soft-lock (which was T1's UI gate).

import { hexesInRadius, REGIONS as REGION_DEFS } from '../utils/hexUtils'

// The audit's geometry: factory 0 is STOCKED but borders regions 0 and 1, both full. Factories 1 and 2
// border region 2 but hold nothing and can never restock, because restocking only happens on a
// placement. So there is no legal placement anywhere, from any factory, for any seat.
export const DEADLOCK_FACTORIES = [
  { id: 0, betweenRegions: [0, 1], q: 4, r: -2, elements: [{ type: 'energy', count: 2 }] },
  { id: 1, betweenRegions: [1, 2], q: 6, r: 1, elements: [] },
  { id: 2, betweenRegions: [0, 2], q: 2, r: 3, elements: [] },
]

export const DEADLOCK_FULL_REGIONS = [0, 1]

// Fill EVERY hex in the region's radius · not merely the keys already present. See THE TRAP above.
export function fillRegion(region, { element = 'energy', placedBy = 0 } = {}) {
  const def = REGION_DEFS.find(rd => rd.id === region.id)
  if (!def) return region
  const hexes = { ...region.hexes }
  for (const h of hexesInRadius(def.cq, def.cr, def.radius)) {
    hexes[`${h.q},${h.r}`] = { ...(hexes[`${h.q},${h.r}`] ?? {}), element, placedBy }
  }
  return { ...region, hexes }
}

// A plain, JSON-serialisable state patch. Takes the CURRENT regions (so a caller can build it from a
// freshly initialised game, in node or inside a browser page) and returns only the keys to apply.
// Deliberately returns data rather than touching the store: T3 seeds a real page, I seed a unit test,
// and neither should have to adopt the other's setState idiom.
export function deadlockStatePatch(regions, { tiles = 3, deck = [], offer = [], actionsRemaining = 2 } = {}) {
  return {
    phase: 'playing',
    currentSeat: 0,
    actionsRemaining,
    deck,
    theOffer: offer,
    productionTilesRemaining: tiles,
    endGameTriggered: false,
    endGameRoundsRemaining: 2,
    factories: DEADLOCK_FACTORIES.map(f => ({ ...f, elements: f.elements.map(e => ({ ...e })) })),
    regions: regions.map(r => (DEADLOCK_FULL_REGIONS.includes(r.id) ? fillRegion(r) : r)),
  }
}

// The assertion both lanes need, exported so neither has to re-derive "is this actually deadlocked".
// Pass the store's getValidPlacements (bound to the live state) · returns the count, which must be 0.
export function countLegalPlacements(state, getValidPlacements) {
  let n = 0
  for (const f of state.factories) {
    const types = [...new Set(f.elements.filter(e => e.count > 0).map(e => e.type))]
    if (!types.length) continue
    for (const rid of f.betweenRegions) n += (getValidPlacements(f.id, rid) ?? []).length * types.length
  }
  return n
}
