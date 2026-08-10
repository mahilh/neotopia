import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import GameBoard from './GameBoard'
import { REGIONS, TERRAIN, FACTORIES, ELEMENT_COLORS, hexToPixel, hexesInRadius, HEX_SIZE } from '../../utils/hexUtils'

afterEach(cleanup)

// ── The regions are places now, not labels ───────────────────────────────────────────────────────
// Mahil compared the screen to the physical board: it shows desert, water and forest/grassland ·
// terrain you can see · where ours showed three abstract district names over three tinted blobs.
//
// Almost none of "it looks like a place" is testable. What IS testable is the small set of decisions
// that are cheap to break by accident and expensive to notice, because breaking them is silent:
//
//   · terrain drifting on top of the play  → the exact failure that got the LAST art attempt
//                                            rejected · detail frequency swallowing element tokens
//   · terrain drifting onto a factory      → the busiest control on the board, in the one part of
//                                            the ground the motifs are allowed to use
//   · the district names quietly vanishing → the owner asked for terrain AND district. A label at
//                                            3.5px is deleted whatever the DOM says, so size is
//                                            asserted in user units here and measured in the browser
//   · `color` following the terrain        → it is the ELEMENT identity and drives the target rings.
//                                            Repainting it teaches a second colour language.

const board = (props = {}) => render(<GameBoard {...props} />).container

// The furthest any part of a region's own hexes reaches from its centre · a hex CORNER, not a centre,
// which is the number that matters for "does the scenery touch the play".
const HEX_REACH = Math.max(
  ...hexesInRadius(0, 0, 2).map(h => {
    const p = hexToPixel(h.q, h.r)
    return Math.hypot(p.x, p.y)
  }),
) + HEX_SIZE

// The radius out to which the backdrop is FULLY masked, read from the rendered SVG rather than
// copied from the source: the hole is a radial gradient on a circle, so the solid core is the
// circle's r times the last offset that is still at full stop-opacity.
const maskSolidRadius = (c) => {
  const circle = c.querySelector('#neo-backdrop-mask circle')
  const stops = [...c.querySelectorAll('#neo-backdrop-hole stop')]
  const lastSolid = stops.filter(s => (s.getAttribute('stop-opacity') ?? '1') === '1').pop()
  return (+circle.getAttribute('r')) * (parseFloat(lastSolid.getAttribute('offset')) / 100)
}

// The furthest any CORNER of any play hex sits from its region's centre · the real number the hole
// has to clear. Deliberately not the region's inradius and not "centre distance + HEX_SIZE": the
// first is too small (corners stick out past it) and the second too large (the furthest corner is
// not radially aligned with its hex's centre). Computed, so it cannot be got wrong by hand.
const FURTHEST_CORNER = Math.max(...REGIONS.flatMap(reg => {
  const c = hexToPixel(reg.cq, reg.cr)
  return hexesInRadius(reg.cq, reg.cr, 2).flatMap(h => {
    const p = hexToPixel(h.q, h.r)
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i
      return Math.hypot(p.x + HEX_SIZE * Math.cos(a) - c.x, p.y + HEX_SIZE * Math.sin(a) - c.y)
    })
  })
}))

describe('the terrain data itself', () => {
  it('gives every region a terrain that actually exists', () => {
    for (const r of REGIONS) {
      expect(TERRAIN[r.terrain], `region ${r.id} (${r.name}) names a terrain with no palette`).toBeTruthy()
    }
  })

  it('gives the three regions three DIFFERENT terrains', () => {
    // FALSE CASE: two regions sharing a terrain. The whole point is that a player can tell the
    // regions apart by looking, and "grass, water and desert" is the owner's mapping of a real board.
    const set = new Set(REGIONS.map(r => r.terrain))
    expect(set.size, 'a duplicated terrain makes two regions indistinguishable').toBe(REGIONS.length)
    expect([...set].sort()).toEqual(['desert', 'grass', 'water'])
  })

  it('leaves `color` as the ELEMENT identity, untouched by terrain', () => {
    // The split this whole change rests on: terrain is scenery, `color` is instruction. These are the
    // values the valid-target ring, the near-miss ring and the region score are drawn in, and they are
    // byte-identical to the element palette. FALSE CASE: someone "finishes the job" by repainting
    // these in terrain colours, and the board starts teaching two colour languages at once.
    expect(REGIONS.find(r => r.id === 0).color).toBe(ELEMENT_COLORS.technology)
    expect(REGIONS.find(r => r.id === 1).color).toBe(ELEMENT_COLORS.biofarming)
    expect(REGIONS.find(r => r.id === 2).color).toBe(ELEMENT_COLORS.energy)
  })

  it('keeps the wash as a bare RGB triple the board can build a gradient from', () => {
    // The board interpolates several alphas out of this. A full rgba() string here produces
    // `rgba(rgba(..),0.02)` · which browsers drop silently, so the ground would just stop rendering
    // with nothing in the console to say so.
    for (const t of Object.values(TERRAIN)) {
      expect(t.wash, 'wash must be "r,g,b" with no rgba() wrapper and no alpha').toMatch(/^\d{1,3},\d{1,3},\d{1,3}$/)
    }
  })
})

describe('the board shows what each region is made of', () => {
  it('names the terrain once per region', () => {
    const labels = [...board().querySelectorAll('[data-terrain-label]')].map(n => n.textContent)
    expect(labels.sort()).toEqual(['Desert', 'Grass', 'Water'])
  })

  it('still names the district · terrain was added, not swapped in', () => {
    // The owner's explicit constraint. The physical game carries both: the district lives in the
    // rulebook, the terrain is what is painted.
    const text = board().textContent
    for (const r of REGIONS) expect(text, `${r.name} must survive the terrain rename`).toContain(r.name)
  })

  it('draws every label big enough to survive the phone', () => {
    // MEASURED, not assumed: the board is height-constrained at 375px and renders at 0.326 of user
    // units there, so a 9.5-unit district name came out at 3.5px. This asserts the floor in user
    // units · 20 units is ~6.5px at that scale, which is the smallest thing here worth shipping.
    const c = board()
    const sizes = [...c.querySelectorAll('text')]
      .filter(n => n.textContent.length > 1)
      .map(n => +n.getAttribute('font-size'))
    expect(sizes.length).toBeGreaterThan(0)
    for (const s of sizes) expect(s, 'a board label below 20 user units is unreadable at 375px').toBeGreaterThanOrEqual(20)
  })

  it('gives each region a wash of its own terrain', () => {
    const c = board()
    const washes = [...c.querySelectorAll('[data-terrain-wash]')].map(n => n.getAttribute('data-terrain-wash'))
    expect(washes.sort()).toEqual(['desert', 'grass', 'water'])
    for (const n of c.querySelectorAll('[data-terrain-wash]')) {
      expect(n.getAttribute('fill')).toBe(`url(#neo-wash-${n.getAttribute('data-terrain-wash')})`)
    }
  })
})

describe('the painted world never reaches the play', () => {
  // THE ASSERTIONS THIS FILE EXISTS FOR, now aimed at the mechanism that replaced the drawn motifs
  // (T1 S37). The rule has not changed since the S24/S25 art was rejected: nothing painted may
  // compete with an element token. What changed is that it is now guaranteed by GEOMETRY rather than
  // by choosing quiet colours · the backdrop is masked out of a disc that fully contains every play
  // hex, so no token is ever read against the painting and there is no opacity left to get wrong.
  //
  // Worth stating why that is not optional: an occupied hex is 13% opaque and its token is the
  // element's own mid-tone colour, so whatever lies under a cell is most of what the token is read
  // against. Technology purple on the painted sand computes to 2.0 : 1 against a 3 : 1 floor. There
  // is no opacity at which a pale floor under a mid-tone token is legible.

  it('masks the backdrop out past the furthest corner of the furthest hex', () => {
    const c = board()
    const solid = maskSolidRadius(c)
    expect(solid, 'no mask · the assertion below would pass vacuously').toBeGreaterThan(0)
    expect(solid, `the mask is solid only to ${solid.toFixed(1)} but a hex corner reaches ${FURTHEST_CORNER.toFixed(1)} · painted ground would sit under a token`)
      .toBeGreaterThan(FURTHEST_CORNER)

    // One hole per region, centred on that region · a hole in the wrong place is the same failure.
    const holes = [...c.querySelectorAll('#neo-backdrop-mask circle')]
      .map(n => ({ x: +n.getAttribute('cx'), y: +n.getAttribute('cy') }))
    expect(holes).toHaveLength(REGIONS.length)
    for (const reg of REGIONS) {
      const centre = hexToPixel(reg.cq, reg.cr)
      const nearest = Math.min(...holes.map(h => Math.hypot(h.x - centre.x, h.y - centre.y)))
      expect(nearest, `${reg.name} has no mask hole on it`).toBeLessThan(0.5)
    }
  })

  it('keeps the hole TIGHT · a wide fade reads as a black disc, not as a district', () => {
    // The decision the first screenshot forced. A 78-unit ramp put every region at the bottom of a
    // shadow pit and made the painted world look like it had three holes cut in it. This pins the
    // ramp rather than the look, because the ramp is the thing that produced the look.
    const c = board()
    const solid = maskSolidRadius(c)
    const fade = +c.querySelector('#neo-backdrop-mask circle').getAttribute('r')
    expect(fade - solid, `the fade runs ${(fade - solid).toFixed(0)} units · past ~45 it stops being a rim`)
      .toBeLessThan(45)
  })

  it('anchors the painting on the board, not on a typed-in number', () => {
    // Rule 32 · the placement is derived from BOARD_CX/BOARD_CY, which are themselves derived from
    // the regions. FALSE CASE: someone moves a region and the painted world silently stops lining up
    // with it, which is exactly the class of fault that got v2 refused.
    const c = board()
    const img = c.querySelector('[data-board-backdrop]')
    expect(img, 'no backdrop · every assertion here is about nothing').not.toBeNull()
    const bx = +img.getAttribute('x'), by = +img.getAttribute('y')
    const bw = +img.getAttribute('width'), bh = +img.getAttribute('height')
    const centres = REGIONS.map(r => hexToPixel(r.cq, r.cr))
    const bcx = centres.reduce((s, p) => s + p.x, 0) / centres.length
    const bcy = centres.reduce((s, p) => s + p.y, 0) / centres.length
    // The painted triangle's centroid must land on the board's own centroid, within a pixel.
    const anchorX = bx + bw * (460.667 / 922)
    const anchorY = by + bh * (401.667 / 964)
    expect(Math.hypot(anchorX - bcx, anchorY - bcy),
      'the painting is no longer anchored on the middle of the board').toBeLessThan(1)
    // And it has to cover the whole drawing area, or the world ends in a straight cut.
    expect(bx).toBeLessThanOrEqual(-198)
    expect(by).toBeLessThanOrEqual(-214)
    expect(bx + bw).toBeGreaterThanOrEqual(630)
    expect(by + bh).toBeGreaterThanOrEqual(651)
  })

  it('never takes a click', () => {
    const c = board()
    const nodes = [...c.querySelectorAll('[data-board-ground]')]
    expect(nodes.length, 'nothing painted behind the play · assertion would be vacuous').toBeGreaterThan(0)
    for (const n of nodes) expect(n.style.pointerEvents, 'ground must not take clicks').toBe('none')
  })

  it('keeps the drawn motifs deleted · the painting says it better and once is enough', () => {
    // A DECISION RECORD, like the emblem's in BoardDepth. The ripples, dune crests and grass tufts
    // lived on the same outward arc the painting now occupies, so keeping both was drawing coastline
    // on top of coastline. If they come back, they come back on purpose and this test is deleted.
    expect(board().querySelector('[data-terrain-motif]')).toBeNull()
  })

  it('draws the same board twice · nothing here is random', () => {
    // Rule 32. A Math.random in the scenery would desync two clients' screenshots and make every
    // visual diff from here on unreadable.
    const read = () => {
      const img = board().querySelector('[data-board-backdrop]')
      return ['x', 'y', 'width', 'height', 'href', 'mask'].map(a => img.getAttribute(a)).join('|')
    }
    const a = read()
    cleanup()
    expect(read()).toBe(a)
  })
})
