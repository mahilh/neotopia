// ARROW KEYS ON AN AXIAL GRID (T1 S60).
//
// ── THE DECISION, STATED RATHER THAN ASSUMED ─────────────────────────────────────────────────────
// A flat-top hex has SIX neighbours and a keyboard has FOUR arrows. From hexToPixel the six land at
// N · S · NE · SE · NW · SW · there is NO due east and no due west. So every mapping of four arrows
// onto six axial neighbours must drop two directions or lie about which hex is adjacent, and a false
// adjacency model is worse than no keyboard support because the player learns it and it is wrong.
//
// SO ARROWS ARE NOT MAPPED TO NEIGHBOURS AT ALL. An arrow means "the nearest LEGAL TARGET in that
// direction on screen". The 6-vs-4 problem dissolves because no adjacency is ever claimed, and the
// claim that IS made is true of what the code does. Two measurements drove this:
//   · the legal set runs 1 to 11 of a region's 19 hexes · 58% at its peak, not a sparse minority
//   · at high occupancy it splits into TWO disconnected components (10 and 14 tokens placed), which
//     a neighbour-walk cannot cross and a direction can
//
// ── COUNTERWEIGHTS FIRST (Rule 90) ───────────────────────────────────────────────────────────────
// Each kills a cheap wrong implementation that would satisfy the claims below:
//   1 · returning ANY other target regardless of direction · then "arrows navigate" is true and the
//       mapping is noise, which is precisely the false model this design exists to avoid.
//   2 · a tie resolved by array order · then the NE/SE pair (exactly symmetric about the horizontal)
//       moves differently depending on how the set happened to be built, and the player cannot learn it.

import { describe, it, expect } from 'vitest'
import { hexToPixel, hexesInRadius, nextTargetInDirection, targetsInReadingOrder, HEX_SIZE } from './hexUtils'

const key = (h) => `${h.q},${h.r}`
const px = (k) => { const [q, r] = k.split(',').map(Number); return hexToPixel(q, r) }
// A full radius-2 region · 19 cells · the real shape a player navigates.
const REGION = hexesInRadius(0, 0, 2).map(key)

describe('counterweight · a direction is a direction, not "some other target"', () => {
  it('never returns a target BEHIND the one you are on, for any cell and any arrow', () => {
    // The whole risk named in the brief: a wrong mapping teaches a false model. If any arrow can
    // return a hex on the wrong side, the model is false and every claim below is decoration.
    let checked = 0
    for (const from of REGION) {
      const a = px(from)
      for (const [dir, ax, ay] of [['up',0,-1], ['down',0,1], ['left',-1,0], ['right',1,0]]) {
        const got = nextTargetInDirection(from, REGION, dir)
        if (!got) continue
        const b = px(got)
        const along = (b.x - a.x) * ax + (b.y - a.y) * ay
        checked++
        expect(along, `${dir} from ${from} returned ${got}, which is ${along.toFixed(1)}px in the ` +
          'direction pressed · a non-positive value means the cursor went backwards').toBeGreaterThan(0)
      }
    }
    // POSITIVE CONTROL · without it, a function returning null for everything passes the loop above
    // by never entering it (Rule 120 · an absence needs a control in the same run).
    expect(checked, 'no direction returned any target · the loop asserted nothing').toBeGreaterThan(50)
  })
})

describe('counterweight · the horizontal tie is broken deterministically, not by array order', () => {
  it('resolves the exactly-symmetric NE/SE pair the same way whatever order the set is in', () => {
    // From the origin, (+1,0) and (+1,-1) are both 1.5s across and 0.866s away vertically · an EXACT
    // tie under any distance-and-angle score. If the tie fell to array order the same board would
    // navigate differently depending on how validTargets happened to be built.
    const ne = '1,-1', se = '1,0'
    expect(Math.abs(px(ne).x - px(se).x), 'the fixture assumes these two are equidistant horizontally').toBeLessThan(1e-6)
    expect(Math.abs((px(ne).y - px(se).y)), 'the fixture assumes they straddle the axis').toBeGreaterThan(1)

    const a = nextTargetInDirection('0,0', [ne, se], 'right')
    const b = nextTargetInDirection('0,0', [se, ne], 'right')
    expect(a, 'the tie moved with the input order · not learnable').toBe(b)
    expect(a, 'documented tie-break is UPWARD (smaller r), matching reading order').toBe(ne)
  })
})

describe('arrows move across the legal set', () => {
  it('up and down are exact · they are real neighbours on a flat-top grid', () => {
    // (0,-1) and (0,+1) ARE due north and due south, so these two arrows carry no compromise at all.
    expect(nextTargetInDirection('0,0', REGION, 'up')).toBe('0,-1')
    expect(nextTargetInDirection('0,0', REGION, 'down')).toBe('0,1')
    expect(px('0,-1').y, 'north must be smaller y').toBeLessThan(px('0,0').y)
  })

  it('left and right pick the nearest target in that half-plane', () => {
    const right = nextTargetInDirection('0,0', REGION, 'right')
    const left = nextTargetInDirection('0,0', REGION, 'left')
    expect(px(right).x, 'right did not move right').toBeGreaterThan(px('0,0').x)
    expect(px(left).x, 'left did not move left').toBeLessThan(px('0,0').x)
  })

  it('CROSSES A GAP · the case a neighbour walk cannot do, and the reason for this design', () => {
    // Two disconnected clumps, which the engine really does produce at high occupancy (measured: 2
    // components at 10 and 14 tokens down). A walk over adjacency is stuck at the edge of its own
    // clump; a direction reaches the far one.
    const near = '0,0'
    const far = '2,0'   // two columns right, not adjacent
    const got = nextTargetInDirection(near, [near, far], 'right')
    expect(got, 'a non-adjacent target to the right was unreachable · the legal set splits in two ' +
      'late in a game and this is exactly that case').toBe(far)
  })

  it('an arrow with nothing that way returns null, so the caller can leave focus alone', () => {
    // Returning the current cell, or the first cell, would both "work" and both would move the
    // cursor somewhere the player did not ask for. Null is the only honest answer.
    expect(nextTargetInDirection('0,0', ['0,0'], 'right')).toBeNull()
    expect(nextTargetInDirection('0,0', ['0,-1'], 'down'),
      'the only other target is ABOVE · down must find nothing').toBeNull()
  })

  it('reading order is screen order, because a hex row is not a constant r', () => {
    const ordered = targetsInReadingOrder(REGION)
    expect(ordered.length).toBe(REGION.length)
    for (let i = 1; i < ordered.length; i++) {
      const a = px(ordered[i - 1]), b = px(ordered[i])
      expect(a.y < b.y || (Math.abs(a.y - b.y) < 1e-6 && a.x <= b.x),
        `${ordered[i-1]} then ${ordered[i]} is not top-to-bottom, left-to-right`).toBe(true)
    }
    // And it must NOT be axial order · if it were, the announced position would not match the board.
    const axial = [...REGION].sort()
    expect(ordered.join('|'), 'reading order is identical to sorting the keys as strings · then it is '
      + 'not screen order and the "choice N of M" in each name is about nothing').not.toBe(axial.join('|'))
  })

  it('size is a parameter, so the mapping cannot be wrong at a different scale', () => {
    // The board rescales with the viewport. Direction is scale-invariant and this pins that.
    expect(nextTargetInDirection('0,0', REGION, 'right', HEX_SIZE))
      .toBe(nextTargetInDirection('0,0', REGION, 'right', HEX_SIZE * 3))
  })
})
