import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import GameBoard from './GameBoard'
import CivilizationMark from './CivilizationMark'
import { REGIONS, hexToPixel } from '../../utils/hexUtils'

afterEach(cleanup)

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// The board stopped being three flat fills on black. Almost none of that is testable as "it looks
// better" · what IS testable is the set of decisions that are cheap to undo by accident and expensive
// to notice, because the failure is visual and nobody gets a red.
//
// NAMING THE FALSE CASE FIRST for each:
//   · the mark swallowing a click        → a placement that silently does nothing, at the exact centre
//                                          of the board where three factories live
//   · the bevel returning to occupied    → measured, it costs ~1 point of token contrast ratio; the
//     cells                                screenshot still looks fine, so only a number catches it
//   · a hard-coded board centre          → moving a region leaves the emblem off-centre forever
//   · the ray count drifting             → nine is the Council of Nine, not a styling choice

const board = (props = {}) => render(<GameBoard {...props} />).container

describe('the board sits somewhere', () => {
  it('gives every region a slab to rest on', () => {
    const c = board()
    expect(c.querySelectorAll('[data-region-slab]')).toHaveLength(REGIONS.length)
  })

  it('draws the mark at the derived centre of the three regions, not at a typed-in point', () => {
    const c = board()
    const mark = c.querySelector('[data-testid="civilization-mark"]')
    expect(mark).not.toBeNull()
    const centres = REGIONS.map(r => hexToPixel(r.cq, r.cr))
    const cx = centres.reduce((s, p) => s + p.x, 0) / centres.length
    const cy = centres.reduce((s, p) => s + p.y, 0) / centres.length
    // FALSE CASE: a literal 216,145.5 passes today and is wrong the moment a region moves (Rule 32).
    expect(mark.getAttribute('transform')).toBe(`translate(${cx},${cy})`)
  })

  it('never intercepts a click · the emblem sits under three factories', () => {
    const c = board()
    const mark = c.querySelector('[data-testid="civilization-mark"]')
    expect(mark.style.pointerEvents, 'a placement click at the board centre must reach the factory').toBe('none')
    for (const slab of c.querySelectorAll('[data-region-slab]')) {
      expect(slab.style.pointerEvents, 'the slab covers every hex in its region').toBe('none')
    }
  })

  it('defines the bevel once, so 57 hexes share one gradient', () => {
    const c = board()
    expect(c.querySelector('#neo-bevel'), 'the hexes reference this by id · without it they render unfilled').not.toBeNull()
    expect(c.querySelectorAll('#neo-bevel')).toHaveLength(1)
  })
})

describe('the bevel keeps off the cells that carry a token', () => {
  const occupied = { 0: { hexes: { '0,0': { element: 'energy' } } } }
  const regionsWith = (map) => REGIONS.map(r => ({ ...r, hexes: map[r.id]?.hexes ?? {} }))

  it('bevels an empty cell', () => {
    const c = board({ regions: regionsWith({}) })
    const bevels = [...c.querySelectorAll('polygon')].filter(p => p.getAttribute('fill') === 'url(#neo-bevel)')
    // Three slabs also use it, so the count is hexes + slabs · the point is simply that empty cells get it.
    expect(bevels.length).toBeGreaterThan(REGIONS.length)
  })

  it('does NOT bevel a cell that holds an element', () => {
    const empty = board({ regions: regionsWith({}) })
    const emptyCount = [...empty.querySelectorAll('polygon')].filter(p => p.getAttribute('fill') === 'url(#neo-bevel)').length
    cleanup()
    const withToken = board({ regions: regionsWith(occupied) })
    const tokenCount = [...withToken.querySelectorAll('polygon')].filter(p => p.getAttribute('fill') === 'url(#neo-bevel)').length
    // FALSE CASE: the two counts are equal, meaning the bevel is still painted over the token cell.
    // Measured cost of that: token contrast 13.6:1 falls to 12.6:1 · invisible in a screenshot review.
    expect(tokenCount, 'one occupied cell must lose exactly one bevel').toBe(emptyCount - 1)
  })
})

describe('the emblem', () => {
  const mark = () => render(<CivilizationMark cx={0} cy={0} r={90} />).container

  it('has nine rays, because nine is the Council of Nine', () => {
    expect(mark().querySelectorAll('line')).toHaveLength(9)
  })

  it('carries no animation · it is behind the game, permanently', () => {
    const c = mark()
    for (const n of c.querySelectorAll('*')) {
      expect(n.getAttribute('class') ?? '', 'nothing in the mark may animate').not.toMatch(/pulse|breathe|appear/)
      expect(n.style?.animation ?? '').toBe('')
    }
  })

  it('is drawn only in gold, and only the centre point is allowed to be bright', () => {
    // The rejected art attempt failed by competing with the tokens. This pins the discipline rather
    // than the appearance: one hue, and one exception to the opacity ceiling.
    const c = mark()
    const alphas = []
    for (const n of c.querySelectorAll('*')) {
      for (const attr of ['stroke', 'fill']) {
        const v = n.getAttribute(attr)
        if (!v || v === 'none') continue
        expect(v, `${attr} must be the civilization gold`).toMatch(/^rgba\(200,148,64,/)
        alphas.push(parseFloat(v.split(',')[3]))
      }
    }
    expect(alphas.length).toBeGreaterThan(8)
    const loud = alphas.filter(a => a > 0.20)
    expect(loud, 'only the Source point may exceed 20% opacity').toHaveLength(1)
  })

  it('scales entirely from r · nothing is pinned to one viewport', () => {
    const small = render(<CivilizationMark cx={0} cy={0} r={45} />).container
    const rays = [...small.querySelectorAll('line')]
    // FALSE CASE: a hard-coded coordinate would keep the same value at both radii.
    const maxExtent = Math.max(...rays.map(l => Math.abs(+l.getAttribute('x2'))))
    expect(maxExtent).toBeLessThanOrEqual(45)
  })
})
