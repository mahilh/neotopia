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
// ── HOW WIDE IS A DISTRICT NAME · MEASURED, NOT MODELLED FROM ONE STRING (T1 S64) ────────────────
// ⚠ THIS REPLACES `UNITS_PER_CHAR = 198.6 / 15`, which I shipped in S63 and criticised in the same
// breath without fixing: two strings of the SAME length are ONE sample, and FOREST/DESERT DISTRICT
// measuring 198.6 and 198.3 read as confirmation when it was the same character count twice.
// Calibrated properly in a real browser on the deployed board, at the shipped font-size 20 /
// letterSpacing 2.2, each advance isolated from side bearings by differencing two lengths:
//
//     W 21.149   M 19.22   O/Q 17.086   H 16.626   G 16.576   N 16.53   U 16.42   D 16.177
//     C 16.081   X 15.44   A 15.414     V 15.329   Y 14.989   K 14.979  B 14.873  Z 14.848
//     R 14.822   S 14.53   P 14.434     T 14.332   E 13.615   F 13.135  L 13.059  J 12.715
//     I 7.211    space 6.91
//
// A CHARACTER COUNT CANNOT BOUND A WIDTH, and the calibration is what proves it rather than my
// opinion: the advances span 2.9x, so fifteen characters is 108.2 units of "IIIIIIIIIIIIIII" or
// 317.3 of "WWWWWWWWWWWWWWW" · and the second OVERFLOWS this 309.6-unit box while the first uses a
// third of it. My old budget said both were fine at 23 characters.
// Width is affine in length with a ~zero intercept (M x 1/2/4/8/16/24 measured 19.24 / 38.45 / 76.9
// / 153.79 / 307.55 / 461.3, i.e. 19.22 per M throughout), so SUMMING advances is the right form.
// A SPACE MEASURES 0 IN ISOLATION because SVG strips leading and trailing whitespace · taking that
// at face value would model a space as free. Isolated in context instead: w('M M') - w('MM').
const ADVANCE = {
  A: 15.414, B: 14.873, C: 16.081, D: 16.177, E: 13.615, F: 13.135, G: 16.576, H: 16.626,
  I: 7.211,  J: 12.715, K: 14.979, L: 13.059, M: 19.22,  N: 16.53,  O: 17.086, P: 14.434,
  Q: 17.086, R: 14.822, S: 14.53,  T: 14.332, U: 16.42,  V: 15.329, W: 21.149, X: 15.44,
  Y: 14.989, Z: 14.848, ' ': 6.91,
}
// The board renders the name UPPERCASE (textTransform), so the advance is looked up uppercased.
// An unknown character must NOT contribute 0 · that is the silent way a name with a digit, a hyphen
// or an accent reads as narrower than it is and sails through the gate (Rule 80's shape, inside a
// model). It returns Infinity so the fit assertion fails loudly and names the character.
const predictWidth = (s) => [...s.toUpperCase()]
  .reduce((w, ch) => w + (ADVANCE[ch] ?? Infinity), 0)
const unknownChars = (s) => [...s.toUpperCase()].filter(ch => !(ch in ADVANCE))

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

describe('counterweight · the width model asserts its own premise before anything uses it', () => {
  // WRITTEN BEFORE THE ASSERTION IT DEFENDS (Rule 90). A width model is exactly the construct that
  // can be confidently wrong: it produces a plausible number for any input and nothing here can see
  // a real glyph. So it is checked against widths MEASURED IN THE BROWSER, on the deployed board,
  // in the same run as the calibration · three strings, three independent chances to be wrong.
  const MEASURED = {                       // getBBox, user units, deployed board, fs 20 / ls 2.2
    'WATER DISTRICT': 187.55,
    'FOREST DISTRICT': 198.47,
    'DESERT DISTRICT': 198.15,
    'GRASSLAND DISTRICT': 248.08,
    'MOUNTAIN DISTRICT': 232.11,
    WWWWWWWWWWWWWWW: 317.29,
    IIIIIIIIIIIIIII: 108.23,
  }

  it('reproduces every string measured in a real browser, within 2%', () => {
    for (const [s, real] of Object.entries(MEASURED)) {
      const p = predictWidth(s)
      expect(Math.abs(p - real) / real,
        `"${s}" predicts ${p.toFixed(2)} against a measured ${real} · the advance table has drifted ` +
        'from the font, or the board changed size/spacing. Re-calibrate in a browser; do not widen ' +
        'this tolerance.').toBeLessThan(0.02)
    }
  })

  it('a character count could NOT have done this · the reason the model exists', () => {
    // The disproof of the thing I shipped in S63. Same length, 2.9x the width, and the wide one is
    // over the box the narrow one uses a third of. Any budget expressed in characters passes both.
    expect('WWWWWWWWWWWWWWW'.length).toBe('IIIIIIIIIIIIIII'.length)
    expect(MEASURED.WWWWWWWWWWWWWWW / MEASURED.IIIIIIIIIIIIIII).toBeGreaterThan(2.5)
    expect(MEASURED.WWWWWWWWWWWWWWW, 'fifteen wide characters must OVERFLOW the focus box, or this ' +
      'file is arguing for a model it does not need').toBeGreaterThan(computeViewBox(0).width)
    expect(MEASURED.IIIIIIIIIIIIIII).toBeLessThan(computeViewBox(0).width)
  })

  it('an unknown character is not free · it must fail loudly, never silently narrow', () => {
    // A digit, a hyphen or an accent would otherwise contribute 0 and make a name read as narrower
    // than it renders · a plausible number from a model that did not measure (Rule 80, in a model).
    expect(unknownChars('WATER-9 DISTRICT')).toEqual(['-', '9'])
    expect(predictWidth('WATER-9 DISTRICT')).toBe(Infinity)
    expect(unknownChars('WATER DISTRICT'), 'the shipped names must be fully covered by the table')
      .toEqual([])
  })

  it('every shipped district name is covered by the table', () => {
    for (const r of REGIONS) {
      expect(unknownChars(r.name), `"${r.name}" contains characters the advance table has never ` +
        'measured · re-calibrate before trusting any width claim about it').toEqual([])
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
    // TWO rows since T1 S63 (district name + score). It was THREE while a terrain caption sat on
    // top; the districts now carry their own terrain, so that row would have said the same word
    // twice. This floor is the vacuity guard, not the claim · it fired correctly on the collapse.
    expect(labels.length, 'no labels found for this region · the containment check would be vacuous')
      .toBeGreaterThanOrEqual(2)
    for (const t of labels) {
      const y = Number(t.getAttribute('y'))
      const half = Number(t.getAttribute('font-size') || 20) / 2
      expect(inY(y - half), `label "${t.textContent}" at y=${y} is clipped off the top`).toBe(true)
    }

    // 3 · HORIZONTALLY, which nothing here could hold until the label became the long one.
    // jsdom has no layout, so the width cannot be measured here (Rule 78's corollary · do not write
    // a test that pretends to). What lives here is the DECISION, computed from advances measured in
    // a real browser on the deployed board · see ADVANCE above.
    const predicted = predictWidth(reg.name)
    // The label is centred on the region (textAnchor="middle"), so it must fit the whole focus width.
    expect(predicted,
      `"${reg.name}" predicts ${predicted.toFixed(1)} units against a ${vb.width.toFixed(0)}-unit ` +
      'one-region viewBox at 320px. It will be clipped at both ends on a phone, silently, because ' +
      'an SVG outside its viewBox does not error and the focus view sets overflow:hidden.')
      .toBeLessThan(vb.width)
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
