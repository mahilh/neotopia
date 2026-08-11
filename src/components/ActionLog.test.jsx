import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import ActionLog from './ActionLog'
import { PROJECT_CARDS } from '../lib/projectCards'

// ── The log may have a letterbox. It may not have the board. ─────────────────────────────────────
// Rule 83, applied to my own oldest untouched defect. This overlay is position:absolute over the
// board area, so it never pushed anything · it COVERED it, and the payer was the game itself. It
// hid 12 play cells at 480, 16 at 768 and 31 · 54% of the board · at 620, twenty pixels outside the
// band it had been reported in for three sessions. `pointerEvents: none` made that worse rather
// than safer: the covered cells stayed CLICKABLE while invisible.
//
// S39 confined it to the left letterbox, which cost the log on every screen below 1280. S40 is the
// other half, and it comes from the same sweep: the two letterboxes are COMPLEMENTARY, because a
// fixed-aspect board in a variable-aspect container spends its slack in exactly one direction.
//
// jsdom has no layout, so nothing here is measured for real. What it does have is the model: the
// component reads exactly two rects, and the relationship between them is arithmetic. The stub
// below reproduces the live geometry to the decimal · every containerW/containerH pair in the table
// is what a real browser reported at that viewport, and every gutter this file asserts is the one
// the browser produced from it. That is the difference between a test that pretends to measure and
// a test that computes the same constraint the product does.
const BOARD_VIEWBOX = '-198 -214.7076581449592 828 865.8921197972754'
const VB_W = 828
const VB_H = 865.8921197972754
const CONTAINER_PAD = 16 // GameRoom's board container · the svg fits the CONTENT box, not the border box

const entries = [
  { id: 1, text: 'drew Solar Temple', turn: 1, color: 'rgba(255,255,255,0.6)' },
  { id: 2, text: 'placed Energy in Free Energy', turn: 2, color: '#E24B4A' },
  { id: 3, text: 'scored Fibonacci Solar Terrace: +6', turn: 2, color: '#C89440' },
  { id: 4, text: 'Turn 3 · Architect', turn: 3, color: 'rgba(255,255,255,0.4)' },
]

// THE STUB HAS TO BE IN PLACE BEFORE MOUNT, and my first version was not · it set the rects on the
// nodes after render() returned, by which time useLayoutEffect had already run and read jsdom's
// default zeroes. The component then took its "nothing to measure" branch and both hide-cases
// reported visible. A test that stubs a measurement after the measurement happened is the same
// family as a probe that measures the wrong thing: confident, wrong, and green-adjacent.
const ORIGINAL_RECT = Element.prototype.getBoundingClientRect
const ORIGINAL_RO = globalThis.ResizeObserver
const rect = (w, h) => ({ width: w, height: h, x: 0, y: 0, top: 0, left: 0, right: w, bottom: h })

const stubGeometry = ({ containerW, containerH }) => {
  const s = Math.min((containerW - 2 * CONTAINER_PAD) / VB_W, (containerH - 2 * CONTAINER_PAD) / VB_H)
  Element.prototype.getBoundingClientRect = function () {
    if (this.tagName === 'svg') return rect(VB_W * s, VB_H * s)
    if (this.dataset?.boardContainer === 'true') return rect(containerW, containerH)
    return rect(0, 0)
  }
  return { sideGutter: (containerW - VB_W * s) / 2, bottomGutter: (containerH - VB_H * s) / 2 }
}

const board = (entriesProp = entries) => (
  <div data-board-container="true" style={{ position: 'relative' }}>
    <svg role="img" viewBox={BOARD_VIEWBOX} aria-label="board" />
    <ActionLog entries={entriesProp} />
  </div>
)

const renderInBoard = (geom, entriesProp) => {
  stubGeometry(geom)
  render(board(entriesProp))
  return document.querySelector('.action-log-wrap')
}

const mode = () => document.querySelector('.action-log-wrap')?.getAttribute('data-log-mode')

afterEach(() => {
  cleanup()
  Element.prototype.getBoundingClientRect = ORIGINAL_RECT
  globalThis.ResizeObserver = ORIGINAL_RO
})

// jsdom has NO ResizeObserver at all, so before S40 every test in this file ran the
// `typeof ResizeObserver === 'undefined'` branch · the one that measures once and never again. The
// entire re-entry story ("hide at 900, widen the window, the log comes back") was verified by
// nothing. This is the six lines that fix that, and it was my own closing critique of S39.
const installFakeRO = () => {
  const instances = []
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.observed = []; this.disconnected = false; instances.push(this) }
    observe(node) { this.observed.push(node) }
    unobserve() {}
    disconnect() { this.disconnected = true }
  }
  return instances
}

describe('the log re-measures when the window changes', () => {
  // WRITTEN FIRST, BEFORE THE ASSERTIONS IT DEFENDS (Rule 90). The cheap wrong fix for "it must come
  // back when the window widens" is to re-measure on every render · this component re-renders once a
  // second for the turn clock, so a compute() in the render body would make every test below pass
  // with no observer at all, and the observer could then be deleted without a single line going red.
  // This asserts the other half: with the geometry changed and the callback NOT fired, the answer
  // must be STALE. If it is fresh, the observer is not what is doing the work.
  it('does NOT update from a render alone · the observer is the only re-measure path', () => {
    installFakeRO()
    stubGeometry({ containerW: 992, containerH: 680 })
    const view = render(board())
    expect(mode()).toBe('side')

    stubGeometry({ containerW: 332, containerH: 614 })
    view.rerender(board(entries.slice(0, 2))) // different props · React genuinely reconciles

    expect(mode(), 'a plain render re-measured the layout · the ResizeObserver is not load-bearing')
      .toBe('side')
  })

  it('flips bottom → side when the observer fires with a wider container', () => {
    const ros = installFakeRO()
    renderInBoard({ containerW: 332, containerH: 614 })   // the 620px viewport
    expect(mode()).toBe('bottom')

    stubGeometry({ containerW: 992, containerH: 680 })     // the 1280px viewport
    act(() => { ros.at(-1).cb([]) })

    expect(mode(), 'the log never came back when the window widened').toBe('side')
    expect(document.querySelector('.action-log-wrap').style.width).toBe('168px')
  })

  it('flips side → none when the observer fires with a container that has no slack', () => {
    const ros = installFakeRO()
    renderInBoard({ containerW: 992, containerH: 680 })
    expect(mode()).toBe('side')

    stubGeometry({ containerW: 712, containerH: 680 })     // the 1000px viewport · 46px of gutter
    act(() => { ros.at(-1).cb([]) })

    expect(mode(), 'it must give the space back the moment the board needs it').toBe('none')
  })

  it('watches BOTH rects · either can change without the other', () => {
    const ros = installFakeRO()
    renderInBoard({ containerW: 992, containerH: 680 })
    const observed = ros.at(-1).observed
    expect(observed.some(n => n.dataset?.boardContainer === 'true'), 'the container is unwatched').toBe(true)
    expect(observed.some(n => n.tagName === 'svg'), 'the board itself is unwatched').toBe(true)
  })

  it('disconnects on unmount', () => {
    const ros = installFakeRO()
    renderInBoard({ containerW: 992, containerH: 680 })
    expect(ros.at(-1).disconnected).toBe(false)
    cleanup()
    expect(ros.at(-1).disconnected, 'a live observer on a dead component is a leak').toBe(true)
  })
})

// THE TABLE IS THE ENUMERATION, and every row of it was read out of a real browser: containerW and
// containerH are what GameRoom's board container measured at that viewport, and side/bottom are the
// gutters the browser produced. The stub recomputes them from the same two numbers and agrees to
// within a tenth of a pixel, so what is asserted below is the live geometry, not a model of it.
//
//   viewport  container   side  bottom  mode      viewport  container   side  bottom  mode
//        320   320x346    16.0    22.4  none          768    480x680    16.0   105.7  bottom
//        375   375x355    33.1    16.0  none          900    612x680    16.0    36.7  bottom
//        480   480x366    80.3    16.0  none         1000    712x680    46.1    16.0  none
//        540   540x374   106.4    16.0  none         1100    812x680    96.1    16.0  none
//        600   600x374   136.5    16.0  side         1200    912x680   146.1    16.0  side
//        620   332x614    16.0   150.1  bottom       1280    992x680   186.2    16.0  side
//        700   412x614    16.0   108.3  bottom       1440   1152x680   266.2    16.0  side
//
// 16 is the container's own padding · that is NO slack, not a small amount of it. The pattern is the
// finding: the bottom band exists exactly where the side band does not, because the 600px
// breakpoint flips the sidebar between a stacked row (board wide and short) and a 288px column
// (board narrow and tall). Only 320-540 and 1000-1100 have neither, and those are named rather than
// hidden.
const SWEEP = [
  { vp: 320, containerW: 320, containerH: 346, side: 16.0, bottom: 22.4, expect: 'none' },
  { vp: 375, containerW: 375, containerH: 355, side: 33.1, bottom: 16.0, expect: 'none' },
  { vp: 480, containerW: 480, containerH: 366, side: 80.3, bottom: 16.0, expect: 'none' },
  { vp: 540, containerW: 540, containerH: 374, side: 106.4, bottom: 16.0, expect: 'none' },
  { vp: 600, containerW: 600, containerH: 374, side: 136.5, bottom: 16.0, expect: 'side' },
  { vp: 620, containerW: 332, containerH: 614, side: 16.0, bottom: 150.1, expect: 'bottom' },
  { vp: 700, containerW: 412, containerH: 614, side: 16.0, bottom: 108.3, expect: 'bottom' },
  { vp: 768, containerW: 480, containerH: 680, side: 16.0, bottom: 105.7, expect: 'bottom' },
  { vp: 900, containerW: 612, containerH: 680, side: 16.0, bottom: 36.7, expect: 'bottom' },
  { vp: 1000, containerW: 712, containerH: 680, side: 46.1, bottom: 16.0, expect: 'none' },
  { vp: 1100, containerW: 812, containerH: 680, side: 96.1, bottom: 16.0, expect: 'none' },
  { vp: 1200, containerW: 912, containerH: 680, side: 146.1, bottom: 16.0, expect: 'side' },
  { vp: 1280, containerW: 992, containerH: 680, side: 186.2, bottom: 16.0, expect: 'side' },
  { vp: 1440, containerW: 1152, containerH: 680, side: 266.2, bottom: 16.0, expect: 'side' },
]

describe('the log takes a letterbox or it takes nothing', () => {
  it('reproduces the live gutters from the live container sizes', () => {
    // If this drifts, every mode assertion below is being made about a board that does not exist.
    for (const row of SWEEP) {
      const g = stubGeometry(row)
      expect(g.sideGutter, `side gutter at ${row.vp}`).toBeCloseTo(row.side, 0)
      expect(g.bottomGutter, `bottom gutter at ${row.vp}`).toBeCloseTo(row.bottom, 0)
    }
  })

  it.each(SWEEP)('resolves $vp to $expect', ({ expect: want, ...geom }) => {
    expect(renderInBoard(geom).getAttribute('data-log-mode')).toBe(want)
  })

  it('draws a column in side mode and a strip in bottom mode', () => {
    const col = renderInBoard({ containerW: 992, containerH: 680 })
    expect(col.style.flexDirection).toBe('column')
    expect(col.style.width).toBe('168px')
    expect(col.style.visibility).toBe('visible')
    cleanup()
    // FALSE CASE, and the shipped one until S39: a 168px column drawn over 31 of the 57 cells here.
    // FALSE CASE, and the shipped one after S39: nothing at all, on every screen below 1280.
    const strip = renderInBoard({ containerW: 332, containerH: 614 })
    expect(strip.style.flexDirection).toBe('row')
    expect(strip.style.bottom).toBe('0px')
    expect(strip.style.height).toBe('24px')
    expect(strip.style.visibility).toBe('visible')
  })

  it('keeps the strip inside the band that measured it · it cannot reach the board', () => {
    // The structural guarantee, and the reason this is a fix rather than a smaller overlap: bottom
    // mode only exists when the band is at least 28px, and the strip is 24 pinned to bottom: 0. Its
    // top edge is therefore always below the board's bottom edge, at every width, by construction ·
    // there is no tolerance here to get wrong later.
    const worst = SWEEP.filter(r => r.expect === 'bottom').sort((a, b) => a.bottom - b.bottom)[0]
    expect(worst.vp, 'the tightest bottom band in the sweep').toBe(900)
    expect(worst.bottom - 4, 'band minus the clearance must still hold a 24px row').toBeGreaterThanOrEqual(24)
    const strip = renderInBoard(worst)
    expect(strip.getAttribute('data-log-mode')).toBe('bottom')
    expect(Number.parseInt(strip.style.height, 10) + 4).toBeLessThanOrEqual(worst.bottom)
  })

  it('narrows the column rather than dropping it · 120 is measured, not chosen', () => {
    // The longest string this log can produce is "scored Consciousness Broadcast Tower: +12" at
    // 212.9px natural, then "drew Consciousness Broadcast Tower" at 180.4. Rendered at 11px serif
    // and wrapped, the line counts run 1-2 at 168, 1-2 at 130, 1-2 at 120, 1-FOUR at 104 and 2-4 at
    // 88. So 120 is the narrowest width at which the log is still a list rather than a paragraph,
    // and it comes from the strings rather than from taste. It is what recovers 1200 (146.1px of
    // gutter → a 130px column) and 600 (136.5 → exactly 120), where S39's flat 184 showed nothing.
    const at = (gutter) => ({ containerW: VB_W + 2 * gutter, containerH: VB_H + 2 * CONTAINER_PAD })
    expect(renderInBoard(at(135)).getAttribute('data-log-mode'),
      'one pixel short of a legible column must fall through, not render a paragraph').toBe('none')
    cleanup()
    const log = renderInBoard(at(136))
    expect(log.getAttribute('data-log-mode')).toBe('side')
    expect(log.style.width, 'gutter 136 minus 8 of margin either side').toBe('120px')
  })

  it('never lets the column grow past the width it was designed at', () => {
    expect(renderInBoard({ containerW: 2400, containerH: 680 }).style.width).toBe('168px')
  })

  it('stays in the tree when hidden, so it can come back', () => {
    // FALSE CASE: unmounting it takes its own ResizeObserver with it, and it could then never
    // observe the resize that would let it return.
    const log = renderInBoard({ containerW: 712, containerH: 680 })
    expect(log.getAttribute('data-log-mode')).toBe('none')
    expect(log.style.visibility).toBe('hidden')
    expect(log.textContent, 'the element must persist · visibility, not unmount')
      .toContain('placed Energy in Free Energy')
  })

  it('defaults to the full side column when nothing can be measured', () => {
    // The safe default, and the reason it is safe: a null reading must reproduce the old behaviour
    // rather than delete a feature. Below 480px the stylesheet catches this case as a second net.
    render(<ActionLog entries={entries} />)
    const log = document.querySelector('.action-log-wrap')
    expect(log.getAttribute('data-log-mode')).toBe('side')
    expect(log.style.visibility).toBe('visible')
  })
})

describe('what the log still does', () => {
  it('never takes a click, in either mode', () => {
    expect(renderInBoard({ containerW: 992, containerH: 680 }).style.pointerEvents).toBe('none')
    cleanup()
    expect(renderInBoard({ containerW: 332, containerH: 614 }).style.pointerEvents).toBe('none')
  })

  it('shows the last ten entries in the column, oldest to newest', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: i, text: `entry ${i}`, turn: 1 }))
    render(<ActionLog entries={many} />)
    const lines = [...document.querySelector('.action-log-wrap').children].map(n => n.textContent)
    expect(lines).toHaveLength(10)
    expect(lines[0]).toBe('entry 4')
    expect(lines[9]).toBe('entry 13')
  })

  it('shows the last THREE in the strip, and the newest is the one that survives', () => {
    // A row runs out of width long before a column runs out of height, and justifyContent flex-end
    // means the OLDEST is what gets clipped · the same promise the column makes, on the other axis.
    const many = Array.from({ length: 14 }, (_, i) => ({ id: i, text: `entry ${i}`, turn: 1 }))
    const wrap = renderInBoard({ containerW: 332, containerH: 614 }, many)
    expect(wrap.getAttribute('data-log-mode')).toBe('bottom')
    expect([...wrap.children].map(n => n.textContent).filter(t => t !== '·'))
      .toEqual(['entry 11', 'entry 12', 'entry 13'])
    expect(wrap.style.justifyContent).toBe('flex-end')
  })

  it('delivers the NEWEST whatever else is clipped · the three properties that make that true', () => {
    // S40 shipped "the last three entries" as a claim I reasoned to. Measured at the four widths
    // bottom mode actually occurs at, the typical late game delivers 1 / 2 / 3 / 3 and the three
    // longest strings deliver 1 / 2 / 2 / 2 · so at 316, the width where this feature matters most,
    // it is one entry and part of a second. Three is still the right MAX (clipped entries cost
    // nothing and all three arrive when the strings are short), but the promise that holds at every
    // width is the newest one, and it is delivered by exactly these three properties.
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i, text: `entry ${i}`, turn: 1 }))
    const wrap = renderInBoard({ containerW: 332, containerH: 614 }, many)
    const kids = [...wrap.children]

    expect(wrap.style.overflow, 'without this the strip overflows its band and reaches the board').toBe('hidden')
    expect(wrap.style.justifyContent, 'flex-start would clip the NEWEST instead of the oldest').toBe('flex-end')
    // FALSE CASE that looks harmless: leave flexShrink off and flex squeezes all three entries into
    // the width, so the player gets three unreadable stubs rather than one readable line.
    const texts = kids.filter(n => n.textContent !== '·')
    expect(texts.every(n => n.style.flexShrink === '0'), 'the entries must not be squeezed').toBe(true)
    expect(kids[kids.length - 1].textContent, 'the newest must be last · it is the one that survives')
      .toBe('entry 8')
    expect(kids[kids.length - 1].textContent).not.toBe('·')
  })

  it('keeps the longest line the log can produce narrower than the narrowest strip', () => {
    // The newest entry can only be lost if IT ALONE is wider than the strip. Measured: the longest
    // line is "scored <longest card>: +12" at 212.9px against a 316px minimum strip · 40 characters
    // at ~5.32px each. That ratio is a browser fact and jsdom cannot recompute it, but the CHARACTER
    // COUNT is derivable right here, and it is the thing that actually changes: T2 renames cards.
    // 316 / 5.32 = 59, so 56 leaves real headroom and still fires long before the guarantee breaks.
    const longest = PROJECT_CARDS.reduce((a, c) => (c.name.length > a.length ? c.name : a), '')
    const line = `scored ${longest}: +12`
    expect(line.length, `"${line}" would overflow the 316px strip · the newest entry stops being guaranteed`)
      .toBeLessThanOrEqual(56)
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

  it('says the same things in both modes · the strip is a layout, not a second feature', () => {
    const col = [...renderInBoard({ containerW: 992, containerH: 680 }).children].map(n => n.textContent)
    cleanup()
    const strip = [...renderInBoard({ containerW: 332, containerH: 614 }).children]
      .map(n => n.textContent).filter(t => t !== '·')
    expect(col).toContain('Turn 3 · Architect')
    expect(strip).toContain('Turn 3 · Architect')
    expect(strip.every(t => col.includes(t)), 'the strip invented an entry the column does not have')
      .toBe(true)
  })
})
