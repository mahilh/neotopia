import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore, shuffleArray, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'

// CLUSTER OWNERSHIP AT THE STORE BOUNDARY (T2 S35 · board game rule p9).
//
// clusterDetail.test.js proves the pure arithmetic given hexes that carry `placedBy`. This file proves the
// two things that arithmetic depends on and that live OUTSIDE it, which is where a change like this actually
// dies:
//   1. placeElement really stamps the seat · a correct scorer over an unstamped board silently scores zero
//      for everybody, which looks exactly like "no clusters formed" and would never throw.
//   2. the stamp survives the network round trip · state is broadcast as a whole-state JSON snapshot and
//      merged back with Object.assign, and a field that does not survive that is a field that only works
//      in single player. The forge named this hazard explicitly; it is checked rather than reasoned about.
//
// Rule 61: verify the VALUE, not the signature. Every assertion below reads the number the engine would
// actually score, not merely that a function exists or a key is present.

const twoPlayerGame = () => {
  useGameStore.getState().initGame(
    [{ userId: 'u0', username: 'Zero' }, { userId: 'u1', username: 'One' }],
    shuffleArray(PROJECT_CARDS),
    shuffleArray(PRODUCTION_TILES),
  )
}

// Place one element for `seat` at (q,r) in `regionId` through the REAL reducer (factory → element → region →
// hex) · Rule 36: a harness that writes the hex directly proves nothing about the code path that writes it in
// a game. The only thing this controls is SUPPLY: it tops up a bordering factory so the test is about
// ownership rather than about whether the production tile stack happened to deal the right element. The turn
// budget is likewise set rather than played around · neither is the behaviour under test.
function place(seat, elementType, q, r, regionId) {
  useGameStore.setState(st => {
    st.currentSeat = seat
    st.actionsRemaining = 3
    const f = st.factories.find(x => x.betweenRegions.includes(regionId))
    if (!f) return
    const el = f.elements.find(e => e.type === elementType)
    if (el) el.count = Math.max(el.count, 1)
    else f.elements.push({ type: elementType, count: 1 })
  })
  const factory = useGameStore.getState().factories.find(f => f.betweenRegions.includes(regionId))
  if (!factory) return false
  useGameStore.getState().placeElement(seat, factory.id, elementType, q, r, regionId)
  return useGameStore.getState().regions.find(r2 => r2.id === regionId).hexes[`${q},${r}`]?.element === elementType
}

describe('placeElement stamps the placing seat onto the hex', () => {
  beforeEach(twoPlayerGame)

  test('a placed hex records WHO placed it, not just what', () => {
    const region = useGameStore.getState().regions[0]
    const { q, r } = region.center
    // The first element in an empty region must be the centre (the store's own placement rule).
    expect(place(0, 'energy', q, r, region.id) || place(0, 'biofarming', q, r, region.id)).toBe(true)

    const hex = useGameStore.getState().regions.find(x => x.id === region.id).hexes[`${q},${r}`]
    expect(hex.element).toBeTruthy()
    expect(hex.placedBy).toBe(0)
  })

  test('two players placing into one region produce DIFFERENT cluster scores · the point of the change', () => {
    const region = useGameStore.getState().regions[0]
    const { q, r } = region.center

    // Build one contiguous same-element run: centre, then two adjacent hexes. Whichever element the
    // bordering factories can supply · the rule does not care which, only that they connect.
    const el = ['energy', 'biofarming', 'technology', 'community'].find(e => place(0, e, q, r, region.id))
    expect(el, 'a first element must be placeable at the region centre').toBeTruthy()

    // Neighbours of the centre, in the store's own neighbour order.
    const neighbours = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
    let placedBySeat0 = 1
    let placedBySeat1 = 0
    for (const [dq, dr] of neighbours) {
      if (placedBySeat0 >= 2 && placedBySeat1 >= 1) break
      const seat = placedBySeat0 < 2 ? 0 : 1
      if (place(seat, el, q + dq, r + dr, region.id)) {
        if (seat === 0) placedBySeat0++; else placedBySeat1++
      }
    }
    expect(placedBySeat0, 'the factories must have supplied enough of one element to build a run').toBe(2)
    expect(placedBySeat1).toBe(1)

    const s = useGameStore.getState()
    expect(s.getClusterTotal(0)).toBe(2)
    expect(s.getClusterTotal(1)).toBe(1)
    // The claim the whole session exists to make: this term is no longer the same for both players.
    expect(s.getClusterTotal(0)).not.toBe(s.getClusterTotal(1))
    // And it reaches the final score · not just the selector.
    expect(s.getFinalScore(0) - s.getFinalScore(1)).toBe(2 - 1)
  })

  test('getFinalScore threads the SEAT · passing the board total instead would give both players the same', () => {
    const region = useGameStore.getState().regions[0]
    const { q, r } = region.center
    const el = ['energy', 'biofarming', 'technology', 'community'].find(e => place(0, e, q, r, region.id))
    const neighbours = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
    let n = 1
    for (const [dq, dr] of neighbours) { if (n >= 2) break; if (place(0, el, q + dq, r + dr, region.id)) n++ }
    expect(n).toBe(2)

    const s = useGameStore.getState()
    // Seat 0 built the whole cluster; seat 1 touched nothing. Board total is 2, seat 1's share is 0.
    expect(s.getClusterTotal()).toBe(2)   // no seat · the legacy board reading, used by the viz
    expect(s.getClusterTotal(1)).toBe(0)  // seat 1 · the honest zero
    expect(s.getFinalScore(1)).toBe(0)    // no regions scored, no bonus tokens, no cluster of its own
  })
})

describe('placedBy survives the network round trip', () => {
  beforeEach(twoPlayerGame)

  // THE HAZARD THE FORGE NAMED. Live state travels as a whole-state JSON snapshot and comes back through
  // syncFromServer, which is Object.assign · a top-level shallow merge. `regions` is a top-level key, so the
  // server's array replaces ours wholesale; the risk is not a stale merge but a field that JSON drops or that
  // a peer's older client never wrote. A number survives JSON, so this passes · which is exactly why it needs
  // to be an assertion and not a paragraph. If placedBy ever became a Symbol, a Map, or undefined-by-default,
  // cluster scoring would silently return to zero-for-everyone in multiplayer and stay correct in practice
  // mode, which is the hardest possible bug to notice.
  test('a JSON snapshot round-tripped through syncFromServer keeps every seat stamp AND every score', () => {
    const region = useGameStore.getState().regions[0]
    const { q, r } = region.center
    const el = ['energy', 'biofarming', 'technology', 'community'].find(e => place(0, e, q, r, region.id))
    const neighbours = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
    let placed = 1
    for (const [dq, dr] of neighbours) {
      if (placed >= 3) break
      if (place(placed === 1 ? 0 : 1, el, q + dq, r + dr, region.id)) placed++
    }
    expect(placed).toBe(3)

    const before = [useGameStore.getState().getClusterTotal(0), useGameStore.getState().getClusterTotal(1)]
    expect(before).toEqual([2, 1]) // seat 0 placed centre + one, seat 1 placed one

    // The real serialisation path: JSON.parse(JSON.stringify(getState())) is what useGameSync broadcasts.
    const snapshot = JSON.parse(JSON.stringify(useGameStore.getState()))
    // Prove the stamp is IN the payload, not merely in memory.
    const sentHexes = snapshot.regions.find(x => x.id === region.id).hexes
    expect(Object.values(sentHexes).filter(h => typeof h.placedBy === 'number')).toHaveLength(3)

    // Wipe local state to something clearly wrong, then let the server win.
    useGameStore.setState(st => { st.regions = st.regions.map(x => ({ ...x, hexes: {} })) })
    expect(useGameStore.getState().getClusterTotal(0)).toBe(0) // the wipe really took

    useGameStore.getState().syncFromServer(snapshot)

    const after = [useGameStore.getState().getClusterTotal(0), useGameStore.getState().getClusterTotal(1)]
    expect(after, 'cluster scores must be identical on every client after a sync').toEqual(before)
  })

  // Rule 21 · the broadcast cap is 32 KB and this change adds a field to every placed hex. Measured rather
  // than estimated: a fully placed board, serialised the way the channel serialises it.
  test('the ownership field keeps a full board well inside the 32 KB broadcast cap (rule 21)', () => {
    useGameStore.getState().initGame(
      [0, 1, 2, 3].map(i => ({ userId: `u${i}`, username: `Player${i}` })),
      shuffleArray(PROJECT_CARDS),
      shuffleArray(PRODUCTION_TILES),
    )
    // Fill every region's hexes directly with a stamped element · this measures the SHAPE at full occupancy,
    // which no reachable game state exceeds (the production tile stack runs out long before the board fills).
    useGameStore.setState(st => {
      st.regions.forEach((rg, i) => {
        Object.keys(rg.hexes).forEach((k, j) => {
          rg.hexes[k].element = ['energy', 'biofarming', 'technology', 'community'][j % 4]
          rg.hexes[k].placedBy = (i + j) % 4
        })
      })
    })
    const bytes = new TextEncoder().encode(JSON.stringify(useGameStore.getState())).length
    expect(bytes).toBeLessThan(32 * 1024)
  })
})
