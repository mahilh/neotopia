import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import GameBoard from './GameBoard'
import { REGIONS, hexToPixel } from '../../utils/hexUtils'

afterEach(cleanup)

// ── A LABEL IS NOT A CONTROL (T1 S40, from T3's measurement) ─────────────────────────────────────
// T3 drove one solo game at 1280x720 and applied the Rule 78 probe to every hex the UI offered:
//
//     legal hexes offered (data-testid="hex-valid")            97
//     unreachable at their own centre                          13   (13.4%)
//     what document.elementFromPoint returned instead          an SVG <text>, all 13 times
//
// Twice the ONLY legal placement in the game was one of those, and the turn could not progress at
// all. force:true does not rescue it · force skips the actionability WAIT, not hit-testing, so the
// topmost node still takes the event and a player is in exactly the same position.
//
// I enumerated all 57 cells in a real browser rather than trusting the count, and the honest number
// is smaller and more useful than 13: exactly THREE POSITIONS on the whole board are covered, the
// top-centre hex of each region, all three by the DISTRICT NAME. (The three factory centres also
// report a <text> on top, but that text lives inside the <g> carrying onFactoryClick, so the click
// reaches the right handler · a probe that does not credit the group counts those as broken and
// they are not.) Blockage is a property of the LAYOUT rather than of legality, so T3's 13 blocked
// offers are these three positions coming up again on different turns.
//
// jsdom has no text metrics and no hit-testing, so it cannot re-measure any of that (Rule 78's
// corollary). What it CAN hold, and what this file holds, is the two things that make the fix a fix
// rather than a nudge: the geometry that causes the overlap is still there, and no <text> on this
// board is hit-testable regardless.

const board = (props = {}) => render(<GameBoard {...props} />).container

// How far above its region's centre each label is actually DRAWN, read out of the rendered SVG.
//
// The first version of this file retyped `HEX_SIZE * 3.55` as a constant and compared that to the
// hex rows · which is a second contract (Rule 45) wearing the costume of a derivation. Mutating the
// component to `HEX_SIZE * 4.1`, i.e. the exact wrong fix this test exists to forbid, left it green:
// the test was checking its own copy of the number against itself. Reading the attribute is the
// difference between pinning the layout and pinning a comment about the layout.
const labelOffsets = (container) => {
  const out = []
  for (const reg of REGIONS) {
    const terrain = container.querySelector(`text[data-terrain-label="${reg.terrain}"]`)
    const group = terrain?.parentElement
    if (!group) continue
    // TWO rows since T1 S63 · the district name (which now carries the terrain word, so
    // data-terrain-label rides on it) and the score. There was a third, a bare terrain caption above
    // the name, and it went when the names stopped needing a translation.
    const [nText, sText] = [...group.querySelectorAll('text')]
    const cy = hexToPixel(reg.cq, reg.cr).y
    out.push({
      region: reg.name,
      name: cy - Number(nText.getAttribute('y')),
      score: cy - Number(sText.getAttribute('y')),
      nameSize: Number(nText.getAttribute('font-size')),
      scoreSize: Number(sText.getAttribute('font-size')),
    })
  }
  return out
}

// Where the region's own hex centres actually sit, derived (Rule 32 · never bake a derived value).
const rowsAboveCentre = (() => {
  const c = hexToPixel(0, 0)
  const rows = new Set()
  for (let q = -2; q <= 2; q++) {
    for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) {
      rows.add(+(c.y - hexToPixel(q, r).y).toFixed(3))
    }
  }
  return [...rows].filter(v => v > 0).sort((a, b) => b - a) // 124.708, 93.531, 62.354, 31.177
})()

const isInert = (node, root) => {
  for (let n = node; n && n !== root.parentElement; n = n.parentElement) {
    if (n.style?.pointerEvents === 'none') return true
  }
  return false
}

describe('the labels cannot take a click from a cell', () => {
  // WRITTEN FIRST, BEFORE THE ASSERTIONS IT DEFENDS (Rule 90). Two ways the rest of this file could
  // report PRESENT while guarding nothing, and both are cheap:
  //   · `every()` over an empty NodeList is true, so a board that rendered no <text> at all would
  //     make every pointer-events assertion below pass vacuously;
  //   · somebody "fixes" this by nudging the district name up twenty units. The symptom goes away,
  //     the assertions below still pass, and the guarantee silently becomes a tolerance that the
  //     next font change breaks. So the OVERLAP ITSELF is pinned here: if the geometry moves, this
  //     reddens and the change has to be deliberate.
  it('still overlaps · the fix is pointer-events, not a nudge, and this proves it stayed that way', () => {
    const c = board()
    expect(c.querySelectorAll('text').length,
      'no text rendered · every assertion in this file would pass vacuously').toBeGreaterThanOrEqual(
        REGIONS.length * 2)   // name + score per region · was 3 rows until S63 collapsed the stack

    const offsets = labelOffsets(c)
    expect(offsets, 'no label groups found').toHaveLength(REGIONS.length)

    for (const o of offsets) {
      // The district name is drawn 127.80 above its region centre and a hex centre row sits at
      // 124.708 · 3.09 units apart, against a font-size of 20. Half an em is 10, and a glyph box is
      // never shorter than its em, so that row is inside the text's band under ANY typeface.
      // (Measured in Chromium: the box runs -139.6..-116.0 and the row at -124.7 is 8.7 units
      // inside each edge.) Nothing here is marginal and nothing depends on the font.
      expect(Math.abs(o.name - rowsAboveCentre[0]),
        `${o.region}: the district name no longer sits over a hex centre row · the geometry moved,
         which means somebody fixed this by nudging the label and the pointer-events guarantee has
         quietly become a tolerance again`).toBeLessThan(o.nameSize / 2)

      // And the reason this is a RULE about text rather than a patch to one label: the region score
      // is 0.79 units from the next row down. It misses only SIDEWAYS · measured at 44.1 units of
      // clearance, which a region score would need six digits to close · so it is one layout change
      // away from being the same bug, and nobody should have to re-measure it when that happens.
      expect(Math.abs(o.score - rowsAboveCentre[1]),
        `${o.region}: the score is a horizontal miss, not a vertical one`).toBeLessThan(o.scoreSize / 2)

      // ⚠ THE CONTRAST CASE IS GONE, AND SAYING SO IS THE POINT (T1 S63). A third assertion here
      // pinned the TERRAIN caption at 35.5 units clear of the nearest hex row · it was the label
      // that never had this problem, which is what made "one of the three overlaps" a finding
      // rather than a general remark about labels. That row no longer exists: the districts carry
      // their own terrain now, so the caption above them was the same word twice. The assertion is
      // not weakened, it is about a node the board does not draw · and deleting it silently would
      // leave the file reading as though the contrast had been tested today (Rule 101).
      // What survives is stronger anyway: with two rows instead of three, BOTH of them are now
      // asserted to sit over a hex row, so the pointer-events guarantee covers the whole stack.
    }
  })

  it('makes every <text> on the board inert', () => {
    const c = board({ factories: [{ id: 0, q: 2, r: -1, elements: [{ type: 'energy', count: 3 }] }] })
    const svg = c.querySelector('svg')
    const texts = [...svg.querySelectorAll('text')]
    const live = texts.filter(t => !isInert(t, svg)).map(t => t.textContent)
    // FALSE CASE, and the shipped one: the district names take the click at the top hex of every
    // region, and the factory count only escapes because of a wrapper three levels above it.
    expect(live, 'these <text> nodes can still swallow a placement').toEqual([])
  })

  it('names the three district labels specifically · they are the measured offenders', () => {
    const c = board()
    const svg = c.querySelector('svg')
    for (const reg of REGIONS) {
      const label = [...svg.querySelectorAll('text')].find(t => t.textContent === reg.name)
      expect(label, `${reg.name} is not on the board at all`).toBeTruthy()
      expect(isInert(label, svg), `${reg.name} still covers the top hex of its own region`).toBe(true)
    }
  })

  it('leaves the CELLS clickable · the wrong fix is one line up the tree', () => {
    // FALSE CASE, and the tempting one: pointer-events:none on the <svg> or on the region group.
    // That clears every blocked centre by making the entire board unclickable, and every assertion
    // above would go green.
    const c = board()
    const svg = c.querySelector('svg')
    const cells = [...svg.querySelectorAll('g.hex-cell')]
    expect(cells.length, 'no cells rendered').toBeGreaterThan(50)
    expect(cells.filter(g => isInert(g, svg)).length, 'the board itself has been switched off').toBe(0)
    expect(svg.style.pointerEvents ?? '').not.toBe('none')
  })

  it('keeps the labels visible · inert is not hidden', () => {
    // The other wrong fix: delete the district name, which is the thing that ties "Sacred City" to
    // the purple its score and target rings are drawn in (S35).
    const c = board()
    for (const reg of REGIONS) {
      const label = [...c.querySelectorAll('text')].find(t => t.textContent === reg.name)
      expect(label.getAttribute('fill')).toBe(reg.color)
      expect(label.style.opacity, 'the label must still be readable').not.toBe('0')
    }
  })
})
