// REGION FOCUS · THE GEOMETRY (T1 S50).
//
// THE CLAIM: scoping the viewBox to one region is the only thing that gives a phone a 44px hex, and
// it does. THE PREMISE UNDER IT: the whole board cannot, at any layout. Both are asserted here,
// because a fix whose reason has quietly stopped being true is a fix nobody can evaluate.
//
// ⚠ EVERY NUMBER IN THIS FILE IS COMPUTED, NONE IS QUOTED, AND THAT IS NOT STYLE · IT IS A DIRECT
// RESPONSE TO GETTING THIS EXACT QUANTITY WRONG TWICE IN THREE SESSIONS:
//   S47 · "only the bottom sheet reaches 44px"   · WRONG. I reasoned from the HEIGHT budget; the
//          board is width-bound at 320, so no vertical layout change could ever have reached it.
//          Mahil chose a design on that sentence.
//   S49 · "the board is 720 x 749, so 32px at 320" · WRONG. It is 828 x 865.9 and 27.8px. That
//          figure went into a handoff, an index.css comment and a test header.
// Both were arithmetic done in my head about a geometry that is three lines to evaluate (Rule 81).
// So the component EXPORTS computeViewBox and hexPxIn, and this file derives the constraint from
// hexUtils · the board's actual data · rather than restating a figure anybody has to trust.
//
// ── THE FAILURE THE MEASUREMENT CANNOT SEE, NAMED BEFORE TRUSTING IT ──────────────────────────────
// For a zoomed board it is CLIPPING. An element outside its viewBox does not error, does not warn
// and does not render · it is simply absent, which is the same invisibility that let card art read
// 0/56 for fifteen sessions and let a label print across the hexes it named. And the most valuable
// thing on this board is exactly where it would go: the region SCORE and the two name lines sit
// ABOVE the hexes, 173 units up against a hex field that stops at 155.9, so a focus box built from
// the hex positions alone clips all three and every other assertion here still passes.
// Hence the containment test reads the RENDERED <text> and <polygon> elements out of the DOM and
// checks them against the RENDERED viewBox attribute · two things the component actually produced,
// not two calls to the same function agreeing with each other (Rule 92a).

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import GameBoard, { computeViewBox, hexPxIn } from './GameBoard'
import { REGIONS, hexesInRadius, hexToPixel, HEX_SIZE } from '../../utils/hexUtils'

afterEach(cleanup)

const readViewBox = (svg) => {
  const [minX, minY, width, height] = svg.getAttribute('viewBox').split(/\s+/).map(Number)
  return { minX, minY, width, height }
}
const mount = (focusRegion = null) => {
  const { container } = render(<GameBoard focusRegion={focusRegion} />)
  return container.querySelector('svg[role="img"]')
}

// ── COUNTERWEIGHTS FIRST (Rule 90) ───────────────────────────────────────────────────────────────

describe('focus is a CAMERA MOVE · the guard against the wrong fix', () => {
  // THE WRONG FIX IS OBVIOUS AND TEMPTING: make the hexes bigger. Bump HEX_SIZE, or put a CSS
  // transform on the <svg>. Either would satisfy "the hex is 44px" and both are wrong · HEX_SIZE is
  // the unit every pattern, every placement and the backdrop's own anchor are expressed in, and a
  // CSS transform on an SVG does not move the coordinate system its click targets live in.
  // So: the hexes must occupy the IDENTICAL user-space coordinates in both modes. Only the window
  // onto them moves.
  it('does not move a single hex in user space · only the window onto them', () => {
    const posOf = (svg) => [...svg.querySelectorAll('g.hex-cell polygon')]
      .map(p => p.getAttribute('points')).sort()
    const full = posOf(mount(null))
    cleanup()
    const focused = posOf(mount(0))
    // Every hex the focused board draws must be drawn at exactly the same coordinates as before.
    const fullSet = new Set(full)
    expect(focused.length, 'the focused board drew no hexes at all').toBeGreaterThan(0)
    for (const p of focused) expect(fullSet.has(p), `hex moved in user space: ${p}`).toBe(true)
    expect(HEX_SIZE, 'HEX_SIZE is the unit patterns and placement are expressed in').toBe(36)
  })

  it('the containment probe can FAIL · a box one unit too small must be caught', () => {
    // Written before the containment test itself, because "everything is inside the box" is the
    // assertion that passes when the probe found nothing to check.
    const vb = computeViewBox(0)
    const shrunk = { ...vb, minY: vb.minY + 1, height: vb.height - 2 }
    const c = hexToPixel(REGIONS[0].cq, REGIONS[0].cr)
    const labelY = c.y - HEX_SIZE * 4.45
    const inside = (y, b) => y >= b.minY && y <= b.minY + b.height
    expect(inside(labelY, vb), 'the real box must contain the terrain label').toBe(true)
    expect(inside(vb.minY + 0.5, shrunk), 'the shrunk box must NOT contain a point above it').toBe(false)
  })
})

// ── THE PREMISE · IF THIS STOPS BEING TRUE, THE FEATURE HAS NO REASON ─────────────────────────────

describe('the whole board cannot deliver 44px on a phone · which is why focus exists', () => {
  it('is width-bound at 320 no matter how tall the box is', () => {
    const vb = computeViewBox(null)
    // Height taken to absurdity · this is the CEILING, not a measurement of the current layout.
    const ceiling = hexPxIn(vb, 320, 100_000)
    expect(ceiling).toBeLessThan(44)
    // And it is bound by WIDTH, which is the part I got wrong in S47 · so assert the mechanism,
    // not just the outcome. If this ever flips to height-bound the reasoning above is stale.
    expect(320 / vb.width).toBeLessThan(100_000 / vb.height)
    expect(ceiling).toBeCloseTo(2 * HEX_SIZE * (320 / vb.width), 6)
  })

  // ⚠ AND THE FIRST VERSION OF THIS BLOCK OVERSTATED THE PREMISE · MY OWN ASSERTION CAUGHT IT.
  // I wrote "the full board is under 44px at every phone width the sheet covers" and ran it: at
  // 600px wide the width-bound ceiling is 52.2px, comfortably OVER. The ceiling-with-unbounded-
  // height is only the binding constraint at 320; from about 480 up it is HEIGHT that binds on a
  // phone-shaped screen, which is exactly why S49 measured 28.1px at 600 rather than 52. I had
  // reached for the quantity that was easy to compute instead of the one the claim rests on
  // (Rule 96), in the same file whose header is about doing that twice already.
  // So the premise is stated where it is true, and the general argument is made as a RATIO, which
  // holds at every width because it is a property of the two viewBoxes and not of the box.
  it('focus is worth ~2.6x the scale at any box · the argument that does not depend on a viewport', () => {
    const full = computeViewBox(null)
    const foc = computeViewBox(0)
    expect(full.width / foc.width).toBeGreaterThan(2.5)
    for (const [w, h] of [[320, 300], [375, 340], [414, 360], [600, 330], [768, 600]]) {
      const ratio = hexPxIn(foc, w, h) / hexPxIn(full, w, h)
      expect(ratio, `focus/full at ${w}x${h}`).toBeGreaterThan(2)
    }
  })
})

// ── THE CLAIM ────────────────────────────────────────────────────────────────────────────────────

describe('a focused region clears 44px', () => {
  it('clears it at 320 for every box height the phone layout can produce', () => {
    const vb = computeViewBox(0)
    // The board area on a 568px-tall phone is ~300-360px after header, action bar and the 44px
    // sheet handle. Asserted across a range that brackets it generously in both directions rather
    // than at one convenient number.
    for (const h of [240, 280, 320, 360, 400]) {
      expect(hexPxIn(vb, 320, h), `focus at 320x${h}`).toBeGreaterThanOrEqual(44)
    }
  })

  it('states its own floor · the box height below which the claim stops holding', () => {
    const vb = computeViewBox(0)
    // Derived, not chosen: at 320 wide, the height at which the hex is exactly 44px.
    const floorH = 44 * vb.height / (2 * HEX_SIZE)
    expect(floorH).toBeLessThan(240)   // ...and the layout's smallest realistic box clears it
    expect(hexPxIn(vb, 320, floorH)).toBeCloseTo(44, 6)
    // The honest statement of the limit: below this the feature does not deliver Rule 4 either.
    expect(floorH).toBeGreaterThan(0)
  })

  it('all three regions, not just the one I measured', () => {
    for (const reg of REGIONS) {
      expect(hexPxIn(computeViewBox(reg.id), 320, 320), `region ${reg.id} ${reg.name}`)
        .toBeGreaterThanOrEqual(44)
    }
  })
})

describe('nothing is clipped · the failure that is invisible by construction', () => {
  it.each(REGIONS.map(r => [r.id, r.name]))('region %i (%s) · every hex and every label is inside the viewBox', (id) => {
    const svg = mount(id)
    const vb = readViewBox(svg)
    const inX = (x) => x >= vb.minX && x <= vb.minX + vb.width
    const inY = (y) => y >= vb.minY && y <= vb.minY + vb.height

    // 1 · every hex of the focused region, derived from hexUtils rather than from the component.
    const reg = REGIONS.find(r => r.id === id)
    const hexes = hexesInRadius(reg.cq, reg.cr, reg.radius).map(h => hexToPixel(h.q, h.r))
    expect(hexes, 'a region with no hexes would make this vacuous').toHaveLength(19)
    const halfH = Math.sqrt(3) / 2 * HEX_SIZE
    for (const p of hexes) {
      expect(inX(p.x - HEX_SIZE) && inX(p.x + HEX_SIZE), `hex x ${p.x} outside`).toBe(true)
      expect(inY(p.y - halfH) && inY(p.y + halfH), `hex y ${p.y} outside`).toBe(true)
    }

    // 2 · the label stack, read from what the component RENDERED. This is the half that a box built
    // from the hexes alone silently loses · and the score is in it.
    const labels = [...svg.querySelectorAll('text')]
      .filter(t => {
        const y = Number(t.getAttribute('y'))
        const c = hexToPixel(reg.cq, reg.cr)
        return Number.isFinite(y) && Math.abs(Number(t.getAttribute('x')) - c.x) < 1 && y < c.y
      })
    expect(labels.length, 'no labels found for this region · the containment check would be vacuous')
      .toBeGreaterThanOrEqual(3)
    for (const t of labels) {
      const y = Number(t.getAttribute('y'))
      const half = Number(t.getAttribute('font-size') || 20) / 2
      expect(inY(y - half), `label "${t.textContent}" at y=${y} is clipped off the top`).toBe(true)
    }
  })

  it('the full board is unchanged · same viewBox as before this feature', () => {
    const svg = mount(null)
    const vb = readViewBox(svg)
    expect(vb).toEqual(computeViewBox(null))
    expect(svg.getAttribute('data-focus-region')).toBe('none')
    // overflow stays visible off-focus · glows and the hex pulse reach past their own bbox.
    expect(svg.style.overflow).toBe('visible')
  })

  it('clips when focused, because the other two regions are outside the box', () => {
    const svg = mount(1)
    expect(svg.getAttribute('data-focus-region')).toBe('1')
    expect(svg.style.overflow, 'visible would paint regions 0 and 2 across the page AND leave them ' +
      'hit-testable · the live reachability check is what holds the second half').toBe('hidden')
    expect(svg.getAttribute('aria-label')).toMatch(/zoomed to/i)
  })
})
