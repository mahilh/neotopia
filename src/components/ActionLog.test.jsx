import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ActionLog from './ActionLog'

afterEach(cleanup)

// ── The log may have the gutter. It may not have the board. ──────────────────────────────────────
// Rule 83, applied to my own oldest untouched defect. This overlay is position:absolute over the
// board area, so it never pushed anything · it COVERED it, and the payer was the game itself.
// Enumerated in a real browser at 800px height, counting play cells whose centre sat underneath:
//
//     480  12 cells + the WATER label     900  12 cells
//     620  31 CELLS (54% of the board)   1100   3 cells
//     768  16 cells                      1280   0 · clear from here up
//
// I had carried this in three handoffs on the strength of one screenshot, believing it was a
// 480-600 problem. It ran 480 to ~1200 and was worst at 620 · just past the breakpoint where the
// sidebar becomes a column again and the board collapses while this kept its fixed 176px.
//
// `pointerEvents: none` made it worse, not safer: the covered cells stayed CLICKABLE while being
// invisible, so a player could place into and score hexes they could not see. Rule 78 inverted.
//
// jsdom has no layout, so the gutter cannot be measured here for real · but the DECISION function
// can be driven by handing it the two rects it reads. That is what these do, and the real widths
// are in the commit.

const entries = [
  { id: 1, text: 'drew Solar Temple', turn: 1, color: 'rgba(255,255,255,0.6)' },
  { id: 2, text: 'placed Energy in Free Energy', turn: 2, color: '#E24B4A' },
]

// Give the component the layout it asks for: a board container, and an svg whose viewBox it can
// scale. `drawnW` is what the board actually occupies, so gutter = (containerW - drawnW) / 2.
//
// THE STUB HAS TO BE IN PLACE BEFORE MOUNT, and my first version was not · it set the rects on the
// nodes after render() returned, by which time useLayoutEffect had already run and read jsdom's
// default zeroes. The component then took its "nothing to measure" branch and both hide-cases
// reported visible. A test that stubs a measurement after the measurement happened is the same
// family as a probe that measures the wrong thing: it produced a confident, wrong, green-adjacent
// answer. Overriding on the prototype is what makes the stub exist at mount time.
const ORIGINAL_RECT = Element.prototype.getBoundingClientRect
const rect = (w, h) => ({ width: w, height: h, x: 0, y: 0, top: 0, left: 0, right: w, bottom: h })

const renderInBoard = ({ containerW, drawnW, height = 600 }) => {
  const scale = drawnW / 828
  Element.prototype.getBoundingClientRect = function () {
    if (this.tagName === 'svg') return rect(828 * scale, 866 * scale)
    if (this.dataset?.boardContainer === 'true') return rect(containerW, height)
    return rect(0, 0)
  }
  render(
    <div data-board-container="true" style={{ position: 'relative' }}>
      <svg role="img" viewBox="0 0 828 866" aria-label="board" />
      <ActionLog entries={entries} />
    </div>,
  )
  return document.querySelector('.action-log-wrap')
}

afterEach(() => { Element.prototype.getBoundingClientRect = ORIGINAL_RECT })

describe('the action log never covers the board', () => {
  it('shows itself when the letterbox beside the board can hold it', () => {
    // 1280px measured live: gutter 186 against the 184 it needs.
    const log = renderInBoard({ containerW: 1280, drawnW: 908 })
    expect(log.getAttribute('data-has-gutter')).toBe('true')
    expect(log.style.visibility).toBe('visible')
  })

  it('hides itself when there is no gutter · this is the 620px case, 31 cells covered', () => {
    // FALSE CASE, and the shipped one: it renders anyway, over 54% of the play area, with the cells
    // underneath still clickable because pointer-events are off.
    const log = renderInBoard({ containerW: 620, drawnW: 588 })
    expect(log.getAttribute('data-has-gutter')).toBe('false')
    expect(log.style.visibility).toBe('hidden')
  })

  it('hides at the exact boundary rather than at a breakpoint · the rule is the measurement', () => {
    // 184 needed = 8 left + 168 wide + 8 clear of the board. One pixel either side of it.
    expect(renderInBoard({ containerW: 1000, drawnW: 1000 - 2 * 183 })
      .getAttribute('data-has-gutter'), 'one pixel short must still hide').toBe('false')
    cleanup()
    expect(renderInBoard({ containerW: 1000, drawnW: 1000 - 2 * 184 })
      .getAttribute('data-has-gutter'), 'exactly enough must show').toBe('true')
  })

  it('stays in the tree when hidden, so it can come back when the window widens', () => {
    // FALSE CASE: unmounting it takes its own ResizeObserver with it, and it could then never
    // observe the resize that would let it return.
    const log = renderInBoard({ containerW: 620, drawnW: 588 })
    expect(log, 'the element must persist · visibility, not unmount').not.toBeNull()
    expect(log.textContent).toContain('placed Energy in Free Energy')
  })

  it('defaults to VISIBLE when nothing can be measured', () => {
    // The safe default, and the reason it is safe: a null reading must reproduce the old behaviour
    // rather than delete a feature. Rendered with no board and no layout at all.
    render(<ActionLog entries={entries} />)
    const log = document.querySelector('.action-log-wrap')
    expect(log.getAttribute('data-has-gutter')).toBe('true')
    expect(log.style.visibility).toBe('visible')
  })
})

describe('what the log still does', () => {
  it('never takes a click, whatever it is doing', () => {
    render(<ActionLog entries={entries} />)
    expect(document.querySelector('.action-log-wrap').style.pointerEvents).toBe('none')
  })

  it('shows the last ten entries, oldest to newest', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: i, text: `entry ${i}`, turn: 1 }))
    render(<ActionLog entries={many} />)
    const lines = [...document.querySelector('.action-log-wrap').children].map(n => n.textContent)
    expect(lines).toHaveLength(10)
    expect(lines[0]).toBe('entry 4')
    expect(lines[9]).toBe('entry 13')
  })

  it('fades older turns but never to nothing', () => {
    const aged = [
      { id: 1, text: 'ancient', turn: 1 },
      { id: 2, text: 'recent', turn: 20 },
    ]
    render(<ActionLog entries={aged} />)
    const [old, recent] = [...document.querySelector('.action-log-wrap').children]
    expect(Number(recent.style.opacity)).toBe(1)
    expect(Number(old.style.opacity)).toBe(0.12) // the floor · still legible, clearly past
  })
})
