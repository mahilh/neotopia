import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import GameBoard from './GameBoard'
import { REGIONS } from '../../utils/hexUtils'

afterEach(cleanup)

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// The board stopped being three flat fills on black. Almost none of that is testable as "it looks
// better" · what IS testable is the set of decisions that are cheap to undo by accident and expensive
// to notice, because the failure is visual and nobody gets a red.
//
// NAMING THE FALSE CASE FIRST for each:
//   · decoration swallowing a click      → a placement that silently does nothing, at the exact centre
//                                          of the board where three factories live
//   · the bevel returning to occupied    → measured, it costs ~1 point of token contrast ratio; the
//     cells                                screenshot still looks fine, so only a number catches it
//   · the centre filling up again        → the emblem was removed by the owner for taking up space and
//                                          answering nothing · a test is where that decision survives

const board = (props = {}) => render(<GameBoard {...props} />).container

describe('the board sits somewhere', () => {
  it('gives every region a slab to rest on', () => {
    const c = board()
    expect(c.querySelectorAll('[data-region-slab]')).toHaveLength(REGIONS.length)
  })

  it('leaves the centre empty · the emblem was removed and does not come back by accident', () => {
    // S34 put a golden mark between the three regions. S35 took it out on Mahil's call: it was the
    // only thing on the board a player might read as interactive, and it answered no question. This
    // is the decision, written where a future "the middle looks bare" impulse will meet it.
    expect(board().querySelector('[data-testid="civilization-mark"]')).toBeNull()
  })

  it('nothing painted behind the play may intercept a click', () => {
    // Three factories converge on the board centre, and every decorative layer added here is drawn
    // across them. FALSE CASE: a placement click at the middle of the board lands on scenery and does
    // nothing at all · silent, and indistinguishable from the game being broken.
    const c = board()
    for (const sel of ['[data-region-slab]', '[data-board-ground]']) {
      const nodes = [...c.querySelectorAll(sel)]
      expect(nodes.length, `${sel} must exist for this assertion to mean anything`).toBeGreaterThan(0)
      for (const n of nodes) expect(n.style.pointerEvents, `${sel} must not take clicks`).toBe('none')
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

describe('nothing behind the play animates', () => {
  it('the scenery holds still · every moving thing on this board is a game signal', () => {
    // The board already spends motion on meaning: the valid-target ring pulses, the completion
    // candidate pulses faster, the reachable preview breathes, the factories pulse to invite the
    // first action. FALSE CASE: decoration that also moves, which spends the one channel those
    // signals rely on and leaves the player scanning a board where everything twitches.
    const c = board()
    for (const sel of ['[data-region-slab]', '[data-board-ground]']) {
      for (const n of c.querySelectorAll(sel)) {
        for (const node of [n, ...n.querySelectorAll('*')]) {
          expect(node.getAttribute('class') ?? '', `${sel} must not animate`).not.toMatch(/pulse|breathe|appear/)
          expect(node.style?.animation ?? '').toBe('')
        }
      }
    }
  })
})
