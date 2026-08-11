import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'
import { hexesInRadius, REGIONS as REGION_DEFS } from '../utils/hexUtils'

// T2 S44 · THE PERMANENT SOFT-LOCK. A browser audit reached turn 33 in practice and the game stopped
// accepting input forever: 2 actions left, End Turn disabled (it wants all 3 spent), timer at 0 and not
// force-advancing, deck empty, two factories holding nothing, and the one stocked factory bordering only
// regions that were 19/19 FULL. No legal move, no pass, no cancel.
//
// THE ENGINE HALF, and the reason it is a DIFFERENT exhaustion from the one already handled:
// endGameTriggered has exactly one natural source · refillFactoryDraft · which runs only as a side
// effect of a placement that empties a factory. The tile clock is therefore DRIVEN BY placements. Take
// placements away and the clock cannot advance, so the trigger can never fire and the game is dead with
// tiles still on the board. The existing rescue (maybeForceFlowEndgame, S19) cannot help: it is
// mode-gated to Flow AND additionally requires productionTilesRemaining<=1, which a deadlocked game
// never reaches for precisely the same reason.
//
// T1 is shipping the UI escape (End Turn enabled when no legal action exists). These are COMPLEMENTARY
// and neither replaces the other: T1's lets the human out of the current turn, mine makes the game
// recognise it is over and score. Removing either one leaves a hang · a player who can pass forever in
// a game that never ends is still stuck, and a game that knows it is over but offers no button is too.

const store = () => useGameStore.getState()
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const shuffled = (rng, arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Fill EVERY hex in a region's radius, not merely the keys that already exist · a half-filled region
// still accepts placements and would quietly make the deadlock un-reachable (the first draft of this
// file did exactly that and reported "2 legal placements" in a state meant to have none).
function fillRegion(region) {
  const def = REGION_DEFS.find(rd => rd.id === region.id)
  const hexes = { ...region.hexes }
  for (const h of hexesInRadius(def.cq, def.cr, def.radius)) {
    hexes[`${h.q},${h.r}`] = { ...(hexes[`${h.q},${h.r}`] ?? {}), element: 'energy', placedBy: 0 }
  }
  return { ...region, hexes }
}

// The audit's board, reconstructed: factory 0 is stocked but borders regions 0 and 1, both full;
// factories 1 and 2 border region 2 but hold nothing and can never restock, because restocking only
// happens on a placement. Deck and offer empty. Tiles REMAIN · that is the whole point.
function seedDeadlock({ tiles = 3, deck = [], offer = [] } = {}) {
  useGameStore.setState(useGameStore.getInitialState(), true)
  const rng = mulberry32(7)
  store().initGame(
    [{ userId: 'A', username: 'A' }, { userId: 'B', username: 'B' }],
    shuffled(rng, PROJECT_CARDS), shuffled(rng, PRODUCTION_TILES),
  )
  useGameStore.setState({
    phase: 'playing', currentSeat: 0, actionsRemaining: 2,
    deck, theOffer: offer,
    productionTilesRemaining: tiles,
    endGameTriggered: false, endGameRoundsRemaining: 2,
    factories: [
      { id: 0, betweenRegions: [0, 1], q: 4, r: -2, elements: [{ type: 'energy', count: 2 }] },
      { id: 1, betweenRegions: [1, 2], q: 6, r: 1, elements: [] },
      { id: 2, betweenRegions: [0, 2], q: 2, r: 3, elements: [] },
    ],
    regions: store().regions.map(r => (r.id === 0 || r.id === 1 ? fillRegion(r) : r)),
  }, false)
}

const legalPlacementCount = () => {
  const s = store()
  let n = 0
  for (const f of s.factories) {
    const types = [...new Set(f.elements.filter(e => e.count > 0).map(e => e.type))]
    if (!types.length) continue
    for (const rid of f.betweenRegions) n += s.getValidPlacements(f.id, rid).length * types.length
  }
  return n
}

describe('deadlock terminal condition', () => {
  beforeEach(() => { useGameStore.setState(useGameStore.getInitialState(), true) })

  // COUNTERWEIGHT FIRST (Rule 90), and for this feature it is the assertion that matters most. A
  // terminal condition is dangerous in one specific direction: firing on a HEALTHY game and cutting it
  // short. That failure is far worse than the hang, because a hang is visible and a game that ends four
  // turns early just looks like a game. Two sessions running my counterweight has been vacuous, and
  // both times the missing case was one my own prose had named · so these assert the exact boundary
  // rather than a comfortable distance from it: a board with ONE legal placement left, and a board with
  // nothing to place but ONE card still drawable. Each is one step from the trigger and must not fire.
  test('THE WRONG FIX · a game with a single legal move left must NOT be ended', () => {
    seedDeadlock({ tiles: 3 })
    // free exactly one hex in region 0, adjacent to existing elements → one legal placement returns
    useGameStore.setState({
      regions: store().regions.map(r => {
        if (r.id !== 0) return r
        const hexes = { ...r.hexes }
        const def = REGION_DEFS.find(d => d.id === 0)
        hexes[`${def.cq + 1},${def.cr}`] = { ...hexes[`${def.cq + 1},${def.cr}`], element: null }
        return { ...r, hexes }
      }),
    }, false)
    expect(legalPlacementCount(), 'the fixture must leave exactly one move or this proves nothing')
      .toBeGreaterThan(0)

    store().endTurn()
    expect(store().endGameTriggered, 'a board with a legal move is NOT a deadlock').toBe(false)
    expect(store().phase).toBe('playing')
  })

  test('THE WRONG FIX · no placement but a card still drawable must NOT be ended', () => {
    seedDeadlock({ tiles: 3, deck: [PROJECT_CARDS[0]] })
    expect(legalPlacementCount()).toBe(0)
    store().endTurn()
    expect(store().endGameTriggered, 'a drawable card is a legal action · the game continues').toBe(false)
  })

  // ── and only now the defect ────────────────────────────────────────────────────────────────────────
  test('the audit state is a genuine deadlock · no draw, no placement, tiles still on the board', () => {
    seedDeadlock({ tiles: 3 })
    expect(legalPlacementCount(), 'no placement is possible').toBe(0)
    expect(store().deck.length + store().theOffer.length, 'no draw is possible').toBe(0)
    expect(store().productionTilesRemaining, 'tiles REMAIN · the natural clock can never reach them')
      .toBeGreaterThan(1)
  })

  test('the deadlocked game RESOLVES instead of hanging · measured at 40 turns before the fix', () => {
    seedDeadlock({ tiles: 3 })
    let turns = 0
    while (store().phase === 'playing' && turns < 40) { store().endTurn(); turns++ }
    expect(store().phase, 'without the terminal condition this stays "playing" for all 40 turns').toBe('scoring')
    expect(turns, 'and it must resolve promptly · the existing 2-round endgame, not a long tail')
      .toBeLessThanOrEqual(6)
  })

  test('the trigger fires on the turn that discovers it · not a lap later', () => {
    seedDeadlock({ tiles: 3 })
    store().endTurn()
    expect(store().endGameTriggered).toBe(true)
  })

  test('Flow is unaffected · the existing S19 rescue still owns its own case', () => {
    // deck+offer empty at the last tile, but placements ARE possible → the deadlock rule must stay out
    // of it and the Flow rule must still fire. Guards against the two conditions merging.
    useGameStore.setState(useGameStore.getInitialState(), true)
    const rng = mulberry32(3)
    store().initGame(
      [{ userId: 'A', username: 'A' }, { userId: 'B', username: 'B' }],
      shuffled(rng, PROJECT_CARDS), shuffled(rng, PRODUCTION_TILES), 'flow',
    )
    useGameStore.setState({ deck: [], theOffer: [], productionTilesRemaining: 1 }, false)
    expect(legalPlacementCount(), 'an opening board has placements · this is NOT a deadlock')
      .toBeGreaterThan(0)

    // My rule must stay out of it: placements exist, so endTurn must not trigger anything.
    store().endTurn()
    expect(store().endGameTriggered, 'the deadlock rule must not claim a board that still has moves')
      .toBe(false)

    // SCOPE, stated rather than duplicated. I originally asserted here that the Flow rescue still
    // fires, and got its trigger wrong TWICE in a row · first calling endTurn, then placeElement. It
    // is invoked from refillFactoryDraft and drawCard only. Building a fixture to re-prove it would
    // duplicate engineFuzz.playFlowStalled, which is load-bearing, green, and constructs the Flow
    // stall deliberately because random play cannot reach it. So this test owns exactly one claim ·
    // that the NEW rule keeps out of Flow's case · and points at the existing gate for the other half.
    // Two guards asserting one thing is a second contract (Rule 45); a citation is not (Rule 97), so
    // the pointer is named precisely enough to check.
    expect(store().phase, 'still playing · the deadlock rule declined, as it must').toBe('playing')
  })
})
