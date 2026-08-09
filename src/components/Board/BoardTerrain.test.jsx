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

const motifPoints = (g) => {
  const pts = []
  for (const n of g.querySelectorAll('polyline')) {
    for (const pair of (n.getAttribute('points') || '').trim().split(/\s+/)) {
      const [x, y] = pair.split(',').map(Number)
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y })
    }
  }
  for (const n of g.querySelectorAll('line')) {
    pts.push({ x: +n.getAttribute('x1'), y: +n.getAttribute('y1') })
    pts.push({ x: +n.getAttribute('x2'), y: +n.getAttribute('y2') })
  }
  return pts
}

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

describe('terrain never reaches the play', () => {
  it('keeps every motif stroke outside the region it decorates', () => {
    // THE ASSERTION THIS FILE EXISTS FOR. The previous art attempt was rejected for competing with
    // the element tokens, so the drawn terrain is confined to ground no token can occupy. This checks
    // the geometry rather than the intent: not one point of any motif may fall within reach of a hex.
    const c = board()
    for (const reg of REGIONS) {
      const centre = hexToPixel(reg.cq, reg.cr)
      const g = c.querySelector(`[data-terrain-motif="${reg.terrain}"]`)
      const pts = motifPoints(g)
      expect(pts.length, `${reg.terrain} drew nothing · the assertion below would pass vacuously`).toBeGreaterThan(10)
      const nearest = Math.min(...pts.map(p => Math.hypot(p.x - centre.x, p.y - centre.y)))
      expect(nearest, `${reg.terrain} motif reaches ${nearest.toFixed(1)} from the centre · hexes reach ${HEX_REACH.toFixed(1)}`)
        .toBeGreaterThan(HEX_REACH)
    }
  })

  it('keeps every motif stroke clear of all three factory tap circles', () => {
    // Each factory carries a 70-unit invisible hit circle (Rule 4). The motifs are pointer-events
    // none so they cannot steal the click, but crowding the busiest control on the board is its own
    // failure · and this is what pins the outward-facing arc to being a decision rather than a guess.
    const c = board()
    const FACTORY_HIT_R = 70
    const fs = FACTORIES.map(f => hexToPixel(f.q, f.r))
    for (const reg of REGIONS) {
      const pts = motifPoints(c.querySelector(`[data-terrain-motif="${reg.terrain}"]`))
      let nearest = Infinity
      for (const p of pts) for (const f of fs) nearest = Math.min(nearest, Math.hypot(p.x - f.x, p.y - f.y))
      expect(nearest, `${reg.terrain} motif comes within ${nearest.toFixed(1)} of a factory`).toBeGreaterThan(FACTORY_HIT_R)
    }
  })

  it('never takes a click', () => {
    for (const n of board().querySelectorAll('[data-terrain-motif]')) {
      expect(n.style.pointerEvents).toBe('none')
    }
  })

  it('draws the same board twice · nothing here is random', () => {
    // Rule 32. A Math.random in the scenery would desync two clients' screenshots and make every
    // visual diff from here on unreadable.
    const a = motifPoints(board().querySelector('[data-terrain-motif="desert"]'))
    cleanup()
    const b = motifPoints(board().querySelector('[data-terrain-motif="desert"]'))
    expect(a).toEqual(b)
  })
})
