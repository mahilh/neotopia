import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import GameBoard, { computeViewBox } from './GameBoard'
import { REGIONS, TERRAIN, FACTORIES, ELEMENT_COLORS, hexToPixel, hexesInRadius, HEX_SIZE } from '../../utils/hexUtils'

afterEach(cleanup)

// The DRAWING AREA, derived. Read from the same exported function the component calls, never typed:
// four literals frozen from a computed viewBox are a snapshot that goes stale with no diff, and the
// coverage assertion below would then be describing a board that no longer exists (Rule 92 · a check
// whose two sides come from one source, here separated by time rather than by file).
const VB = computeViewBox(null)

// Real pixel dimensions out of a JPEG's SOF marker · no decoder, ~15 lines. Used to bind the TYPED
// fileW/fileH against the actual asset (Rule 128 · a guard about an artifact must read the artifact).
function jpegSize(file) {
  const b = fs.readFileSync(file)
  if (b.readUInt16BE(0) !== 0xffd8) return null   // not a JPEG
  let i = 2
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue }
    const m = b[i + 1]
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue }
    const len = b.readUInt16BE(i + 2)
    // every SOF except DHT(c4)/JPG(c8)/DAC(cc) carries the frame header
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  return null
}

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
  // ⚠ WHAT THESE TWO USED TO ASSERT, kept because the old number is the argument for the new one
  // (Rule 101b). Until T1 S63 the board drew TWO rows per region · a terrain caption reading
  // 'Water'/'Grass'/'Desert', and the district name under it · and the first of these pinned exactly
  // those three strings while the second pinned "the district name survived". Both were true and both
  // stopped being true the moment the districts were renamed to Water/Forest/Desert District: the
  // stack would have read "WATER" over "WATER DISTRICT". One row now, carrying the district name,
  // which contains the terrain. The pair of claims collapses into one and it is a stronger one.
  it('names each region exactly ONCE on the board · one row, not a word repeated in two sizes', () => {
    const labels = [...board().querySelectorAll('[data-terrain-label]')].map(n => n.textContent)
    expect(labels.length, 'one label row per region').toBe(REGIONS.length)
    expect(labels.slice().sort()).toEqual(REGIONS.map(r => r.name).slice().sort())
    // and the terrain word is IN that name rather than above it
    for (const r of REGIONS) {
      const label = labels.find(l => l === r.name)
      expect(label.toLowerCase(), `${r.name} no longer says what it is made of`)
        .toContain(TERRAIN[r.terrain].name.toLowerCase())
    }
  })

  it('the district name is the only place the region is named · no second row to drift', () => {
    // The counterweight to the collapse. If someone re-adds a terrain caption, the board says the
    // same word twice again and this reds · which is the thing the rename existed to remove.
    const c = board()
    const texts = [...c.querySelectorAll('text')].map(n => n.textContent)
    for (const r of REGIONS) {
      const terrainWord = TERRAIN[r.terrain].name
      const bare = texts.filter(t => t === terrainWord || t === terrainWord.toUpperCase())
      expect(bare, `the board draws a bare "${terrainWord}" caption as well as "${r.name}"`).toEqual([])
    }
    // and the district name is still ON the board · this whole block would pass on an empty board
    for (const r of REGIONS) expect(c.textContent, `${r.name} is not drawn at all`).toContain(r.name)
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
    // ⚠ THESE WERE FOUR TYPED LITERALS (-198 / -214 / 630 / 651) UNTIL T1 S63. They were a correct
    // snapshot of computeViewBox() on the day they were written and nothing bound them to it, so any
    // change to a region, a factory or the pad would have moved the viewBox while the guard went on
    // certifying coverage of the old one · silently, with no diff on this file. Derived now.
    expect(bx, 'unpainted ground at the LEFT edge').toBeLessThanOrEqual(VB.minX)
    expect(by, 'unpainted ground at the TOP edge').toBeLessThanOrEqual(VB.minY)
    expect(bx + bw, 'unpainted ground at the RIGHT edge').toBeGreaterThanOrEqual(VB.minX + VB.width)
    expect(by + bh, 'unpainted ground at the BOTTOM edge').toBeGreaterThanOrEqual(VB.minY + VB.height)
  })

  it('the painting is admitted to all four CORNERS · the porthole cannot come back', () => {
    // T1 S64. Nothing gated this, which is why an inscribed ellipse survived from S37 to S64 leaving
    // the four corners of a nearly-square viewBox fully black at every viewport · a disc in a void.
    //
    // THE ASSERTION IS THE PROPERTY, NOT THE TAG. "It must be a <rect>" would be a rule about syntax
    // and would say nothing about why; and the tempting geometric check, comparing BOUNDING BOXES,
    // cannot fail at all here · an ellipse with rx = w/2 has exactly the same bbox as the rect that
    // replaced it, so a bbox test greens on the thing it exists to forbid (Rule 92 · two sides that
    // agree by construction). So this asks the shape whether it CONTAINS each corner, which is the
    // question, and an inscribed ellipse answers no at all four.
    const c = board()
    const shape = c.querySelector('#neo-backdrop-mask [data-board-admit]')
    expect(shape, 'no admitting shape · the backdrop is masked out entirely and the board is black')
      .not.toBeNull()

    const contains = (el, px, py) => {
      const n = el.tagName.toLowerCase()
      if (n === 'rect') {
        const x = +el.getAttribute('x'), y = +el.getAttribute('y')
        const w = +el.getAttribute('width'), h = +el.getAttribute('height')
        return px >= x && px <= x + w && py >= y && py <= y + h
      }
      if (n === 'ellipse' || n === 'circle') {
        const cx = +el.getAttribute('cx'), cy = +el.getAttribute('cy')
        const rx = +(el.getAttribute('rx') ?? el.getAttribute('r'))
        const ry = +(el.getAttribute('ry') ?? el.getAttribute('r'))
        return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1
      }
      return false   // an unknown shape is not proof of coverage
    }

    // the corners of the DRAWING AREA, derived · these are the pixels that were black
    const corners = [
      [VB.minX, VB.minY], [VB.minX + VB.width, VB.minY],
      [VB.minX, VB.minY + VB.height], [VB.minX + VB.width, VB.minY + VB.height],
    ]
    for (const [px, py] of corners) {
      expect(contains(shape, px, py),
        `the viewBox corner ${px.toFixed(0)},${py.toFixed(0)} is NOT admitted by the ` +
        `<${shape.tagName.toLowerCase()}> · that corner renders black. An inscribed ellipse fails ` +
        'all four by construction, which is what the porthole was.').toBe(true)
    }

    // COUNTERWEIGHT · the check must be able to say no. If `contains` returned true for everything
    // the four assertions above would be decoration, and this is the exact shape that was there.
    const inscribed = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    inscribed.setAttribute('cx', String(VB.minX + VB.width / 2))
    inscribed.setAttribute('cy', String(VB.minY + VB.height / 2))
    inscribed.setAttribute('rx', String(VB.width / 2))
    inscribed.setAttribute('ry', String(VB.height / 2))
    for (const [px, py] of corners) {
      expect(contains(inscribed, px, py),
        'the containment test admits a corner of an INSCRIBED ELLIPSE · it cannot detect the porthole ' +
        'it exists to forbid').toBe(false)
    }
    // and it must accept the centre, or it is simply always-false
    expect(contains(inscribed, VB.minX + VB.width / 2, VB.minY + VB.height / 2),
      'the containment test rejects the dead centre · it is always-false and proves nothing').toBe(true)
  })

  it('the DECLARED file shape matches the file on disk · a swapped terrain is silent otherwise', () => {
    // T1 S63. THE HAZARD THIS SESSION WAS ABOUT. BACKDROP.fileW/fileH are typed constants and the
    // image is placed at fileW*scale x fileH*scale, so dropping a 16:9 terrain in over a 0.956 one
    // WITHOUT editing them renders the painting squashed to 54% of its width. Nothing throws, nothing
    // is missing, and the failure looks like an art problem rather than a code one.
    //
    // COUNTERWEIGHT, and it is the whole reason this can be trusted: the file measured is the one the
    // BOARD names, resolved from the rendered href · not a path retyped here. A gate that reads a
    // file the component does not use agrees with itself by construction (Rule 92) and would pass
    // while the board pointed somewhere else entirely (Rule 125b · an absence needs a presence anchor).
    const c = board()
    const img = c.querySelector('[data-board-backdrop]')
    expect(img, 'no backdrop · this assertion would be about nothing').not.toBeNull()
    const href = img.getAttribute('href') || img.getAttribute('xlink:href')
    expect(href, 'the backdrop has no href to follow').toBeTruthy()

    const file = path.resolve(__dirname, '../../../public', href.replace(/^\//, ''))
    expect(fs.existsSync(file), `the board points at ${href} and there is no such file in public/`).toBe(true)
    const real = jpegSize(file)
    expect(real, `${href} is not a JPEG this reader understands · it cannot be checked, which is a red`).not.toBeNull()
    expect(real.w, 'degenerate width').toBeGreaterThan(0)
    expect(real.h, 'degenerate height').toBeGreaterThan(0)

    const declared = (+img.getAttribute('width')) / (+img.getAttribute('height'))
    const actual = real.w / real.h
    expect(Math.abs(declared - actual),
      `the board draws ${href} at aspect ${declared.toFixed(4)} and the file is ${real.w}x${real.h} = ` +
      `${actual.toFixed(4)} · the painting is being stretched by ${((declared / actual - 1) * 100).toFixed(0)}%. ` +
      'Update BACKDROP.fileW/fileH to the new file, and re-fit anchorX/anchorY/scale · a new terrain ' +
      'is not a drop-in (see the v6 note in GameBoard.jsx).')
      .toBeLessThan(0.005)
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
