import { describe, it, expect, afterEach } from 'vitest'
import probe, { reachability } from './board-probe.mjs'

// ── The Rule 78 probe, tested rather than trusted ────────────────────────────────────────────────
// This function is the one instrument that has caught every overlay-vs-control defect this project
// has shipped, and I had hand-written it four times before committing it. In S40 I found a real
// defect in my own fourth writing · it called three factory cells unreachable when their click
// reaches the right handler through the <g> that owns it · so "I will write it correctly again next
// time" is not supported by the evidence. It is shared with T3's live E2E gate now, which makes its
// own correctness load-bearing for a lane I do not own.
//
// jsdom has no layout and no hit-testing, so it cannot answer the question this probe asks (Rule
// 78's corollary, and the reason the DECISION lives here while the MEASUREMENT lives in the
// browser). What it can do is hand the probe the two readings it consumes · a rect and an
// elementFromPoint · and check what it concludes from them. That is the whole logic.

const ORIGINAL_RECT = Element.prototype.getBoundingClientRect
const ORIGINAL_EFP = document.elementFromPoint
const ORIGINAL_W = window.innerWidth
const ORIGINAL_H = window.innerHeight

afterEach(() => {
  Element.prototype.getBoundingClientRect = ORIGINAL_RECT
  document.elementFromPoint = ORIGINAL_EFP
  window.innerWidth = ORIGINAL_W
  window.innerHeight = ORIGINAL_H
  document.body.innerHTML = ''
})

// Lay out a strip of controls at known boxes and decide by fiat what is on top of each. `topFor`
// receives the control's index and returns the node elementFromPoint should report.
const scene = ({ html, boxes, topFor, viewport = [1000, 800] }) => {
  document.body.innerHTML = html
  window.innerWidth = viewport[0]
  window.innerHeight = viewport[1]
  const nodes = [...document.querySelectorAll('[data-box]')]
  const rects = new Map()
  nodes.forEach((n) => {
    const [x, y, w, h] = n.getAttribute('data-box').split(',').map(Number)
    rects.set(n, { x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h })
  })
  Element.prototype.getBoundingClientRect = function () {
    return rects.get(this) || { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }
  }
  const controls = [...document.querySelectorAll('.ctl')]
  document.elementFromPoint = () => null
  document.elementFromPoint = (cx, cy) => {
    const i = controls.findIndex((c) => {
      const r = rects.get(c.querySelector('[data-box]') || c) || rects.get(c)
      return r && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
    })
    return i === -1 ? document.body : topFor(i, controls[i])
  }
  return controls
}

// Three controls in a row, each 40x40, each with a child shape that defines its centre.
const THREE = `
  <div class="ctl" id="c0"><span data-box="0,0,40,40" class="shape"></span><em id="child0">x</em></div>
  <div class="ctl" id="c1"><span data-box="100,0,40,40" class="shape"></span><em id="child1">x</em></div>
  <div class="ctl" id="c2"><span data-box="200,0,40,40" class="shape"></span><em id="child2">x</em></div>
  <div id="thief">thief</div>
`

describe('the probe says UNMEASURED rather than OK', () => {
  // WRITTEN FIRST, BEFORE EVERY ASSERTION IT DEFENDS (Rule 90, and Rule 92 is why it is this one).
  // The cheapest way for a reachability gate to go green forever is for its selector to stop
  // matching · a renamed class, a board that did not mount, a page that navigated · and then
  // `blocked === 0` is true because nothing was ever checked. That is the same shape as a counter
  // resting at a plausible zero (Rule 80), and it is the failure a SHARED probe would spread to
  // both lanes at once. So the empty case is a FAILURE with a reason, not a pass.
  it('reports ok:false and names the selector when nothing matches', () => {
    document.body.innerHTML = '<div class="something-else"></div>'
    const r = reachability({ controls: 'g.hex-cell' })
    expect(r.measured, 'an unmatched selector must never read as measured').toBe(false)
    expect(r.ok, 'ZERO BLOCKED OUT OF ZERO CHECKED IS NOT A PASS').toBe(false)
    expect(r.reason).toContain('g.hex-cell')
    expect(r.total).toBe(0)
  })

  it('a caller who asserts only `ok` still cannot get a false green', () => {
    // The realistic misuse, and the reason `ok` and `measured` are not two separate opinions:
    // somebody writes expect(r.ok).toBe(true) and nothing else. That has to be safe.
    document.body.innerHTML = ''
    expect(reachability({ controls: '.gone' }).ok).toBe(false)
  })
})

describe('what counts as reachable', () => {
  it('passes when the control itself is on top', () => {
    const controls = scene({ html: THREE, topFor: (i, c) => c })
    expect(controls).toHaveLength(3)
    const r = reachability({ controls: '.ctl', hit: '.shape', handlerGroups: [] })
    expect(r).toMatchObject({ measured: true, ok: true, total: 3, self: 3, blocked: 0, offscreen: 0 })
  })

  it('passes when the control OWNS the topmost node · Rule 83s correction', () => {
    // FALSE CASE, and one I shipped: `top.dataset.testid === mine` reads a control with children as
    // unreachable, because at four bonus tokens the chip's own row of dots sits under its centre.
    // The check is `el === top || el.contains(top)`.
    scene({ html: THREE, topFor: (i) => document.getElementById(`child${i}`) })
    const r = reachability({ controls: '.ctl', hit: '.shape', handlerGroups: [] })
    expect(r.self, 'a control was called unreachable because its own child was on top').toBe(3)
    expect(r.ok).toBe(true)
  })

  it('passes when a HANDLER-BEARING ANCESTOR owns the topmost node · the S40 correction', () => {
    // The defect I found in my own fourth writing of this probe. Three factory cells report an SVG
    // <text> on top and are not broken at all: that text is a sibling inside the <g> carrying
    // onFactoryClick, so the click bubbles to the right handler. Without this the probe reports
    // three false positives on a board that works, which is worse than not running it · a gate that
    // cries wolf gets switched off (Rule 88c's failure mode).
    document.body.innerHTML = `
      <div data-factory="0">
        <div class="ctl"><span data-box="0,0,40,40" class="shape"></span></div>
        <em id="sibling">3</em>
      </div>`
    window.innerWidth = 1000; window.innerHeight = 800
    const shape = document.querySelector('.shape')
    Element.prototype.getBoundingClientRect = function () {
      return this === shape
        ? { x: 0, y: 0, width: 40, height: 40, left: 0, top: 0, right: 40, bottom: 40 }
        : { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }
    }
    document.elementFromPoint = () => document.getElementById('sibling')

    expect(reachability({ controls: '.ctl', hit: '.shape', handlerGroups: ['[data-factory]'] }))
      .toMatchObject({ ok: true, group: 1, blocked: 0 })
    // ...and WITHOUT the ancestor rule the very same DOM is a failure, which is the false positive.
    expect(reachability({ controls: '.ctl', hit: '.shape', handlerGroups: [] }))
      .toMatchObject({ ok: false, blocked: 1 })
  })

  it('FAILS when something unrelated is on top · 78a, the defect that ships', () => {
    const thief = () => document.getElementById('thief')
    scene({ html: THREE, topFor: (i) => (i === 1 ? thief() : document.querySelectorAll('.ctl')[i]) })
    const r = reachability({ controls: '.ctl', hit: '.shape', handlerGroups: ['[data-factory]'] })
    expect(r.ok).toBe(false)
    expect(r.blocked).toBe(1)
    expect(r.failures[0]).toMatchObject({ verdict: 'blocked', i: 1 })
    expect(r.failures[0].top, 'a failure has to NAME the culprit or it cannot be acted on')
      .toContain('thief')
  })

  it('FAILS when the control is off the screen · 78b, the half everybody forgets', () => {
    // S38: End Turn was 85x44, not hidden, not disabled, and its right edge was at 337 in a 320px
    // viewport. Every visibility check passed. A probe that only asks "what is on top" reports that
    // board as perfect, because nothing is on top of a control nobody can see.
    // AND THE BOUNDARY IS THE POINT, because "exactly fits" is where this turns into "off the
    // screen" · the third box ends at x=240, so 240 is clean and 239 is a defect. I first wrote
    // this expecting two failures at a 220px viewport and it found one, which is Rule 81 in
    // miniature: the second box ends at 140 and 140 < 220. The probe was right and I was not.
    scene({ html: THREE, topFor: (i, c) => c, viewport: [240, 800] })
    expect(reachability({ controls: '.ctl', hit: '.shape', handlerGroups: [] }),
      'a control whose right edge lands exactly on the viewport edge is reachable')
      .toMatchObject({ ok: true, offscreen: 0 })

    scene({ html: THREE, topFor: (i, c) => c, viewport: [239, 800] })
    const r = reachability({ controls: '.ctl', hit: '.shape', handlerGroups: [] })
    expect(r.ok, 'one pixel of overflow is a control the player does not have').toBe(false)
    expect(r.offscreen).toBe(1)
    expect(r.failures[0]).toMatchObject({ verdict: 'offscreen', i: 2, viewport: [239, 800] })
    expect(r.failures[0].rect[2], 'the failure has to carry the number that made it fail').toBe(240)
  })

  it('separates BELOW THE FOLD from OFF THE SCREEN · they are different bugs', () => {
    // Found by pointing this at the real card Hand at 320 (T1 S42). Three cards sat 683px down a
    // sidebar with scrollHeight 931 against clientHeight 239 · this probe called all three
    // unreachable, and scrollIntoView then put elementFromPoint straight back on the card. That is a
    // FALSE POSITIVE on a working screen, and Rule 94a is exactly that a false positive is not the
    // safe error. S38's End Turn is the case that IS a defect: 17px past the edge inside a fixed
    // footer, where no gesture recovers it.
    document.body.innerHTML = `
      <div id="scroller"><div class="ctl"><span data-box="0,900,40,40" class="shape"></span></div></div>
      <div id="fixed"><div class="ctl"><span data-box="900,0,40,40" class="shape"></span></div></div>`
    window.innerWidth = 300; window.innerHeight = 300
    const scroller = document.getElementById('scroller')
    Object.defineProperty(scroller, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(scroller, 'clientHeight', { value: 300, configurable: true })
    scroller.style.overflowY = 'auto'
    const rects = new Map()
    document.querySelectorAll('[data-box]').forEach(n => {
      const [x, y, w, h] = n.getAttribute('data-box').split(',').map(Number)
      rects.set(n, { x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h })
    })
    Element.prototype.getBoundingClientRect = function () {
      return rects.get(this) || { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }
    }
    document.elementFromPoint = () => null

    const r = reachability({ controls: '.ctl', hit: '.shape', handlerGroups: [] })
    expect(r.belowFold, 'the one in a scrollport is one gesture away, not lost').toBe(1)
    expect(r.offscreen, 'the one in a fixed container is genuinely unreachable').toBe(1)
    expect(r.ok, 'a real offscreen control still fails').toBe(false)
    expect(r.failures.map(f => f.verdict), 'belowFold must not be reported as a failure by default')
      .toEqual(['offscreen'])
    expect(r.failures[0].scroller, 'and the genuine one has no scrollport to blame').toBeNull()
  })

  it('can be told that below the fold IS the bug · the FinalScore case', () => {
    // S39: the score screen was reachable by scrolling and still a defect, because there was no
    // passive affordance · the macOS overlay scrollbar is 0px wide until you are already scrolling.
    // That is a judgement about a particular screen, so it is a caller's flag rather than a default.
    document.body.innerHTML = `<div id="scroller"><div class="ctl"><span data-box="0,900,40,40" class="shape"></span></div></div>`
    window.innerWidth = 300; window.innerHeight = 300
    const scroller = document.getElementById('scroller')
    Object.defineProperty(scroller, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(scroller, 'clientHeight', { value: 300, configurable: true })
    scroller.style.overflowY = 'auto'
    const shape = document.querySelector('.shape')
    Element.prototype.getBoundingClientRect = function () {
      return this === shape ? { x: 0, y: 900, width: 40, height: 40, left: 0, top: 900, right: 40, bottom: 940 }
        : { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }
    }
    document.elementFromPoint = () => null
    const r = reachability({ controls: '.ctl', hit: '.shape', handlerGroups: [], foldIsFailure: true })
    expect(r.ok).toBe(false)
    expect(r.failures.map(f => f.verdict)).toEqual(['belowFold'])
    expect(r.failures[0].scroller, 'name the scrollport so the fix has somewhere to go').toBeTruthy()
  })

  it('can be told not to care about the viewport, and then says so in its counts', () => {
    scene({ html: THREE, topFor: (i, c) => c, viewport: [220, 800] })
    const r = reachability({ controls: '.ctl', hit: '.shape', handlerGroups: [], requireInViewport: false })
    expect(r).toMatchObject({ ok: true, offscreen: 0, self: 3 })
  })

  it('falls back to the control itself when it has no hit shape', () => {
    document.body.innerHTML = '<div class="ctl" data-box="0,0,40,40"></div>'
    window.innerWidth = 1000; window.innerHeight = 800
    const ctl = document.querySelector('.ctl')
    Element.prototype.getBoundingClientRect = function () {
      return this === ctl ? { x: 0, y: 0, width: 40, height: 40, left: 0, top: 0, right: 40, bottom: 40 }
        : { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }
    }
    document.elementFromPoint = () => ctl
    expect(reachability({ controls: '.ctl', hit: '', handlerGroups: [] })).toMatchObject({ ok: true, self: 1 })
  })
})

describe('seedPlayedBoard · a fresh board is not the hard case', () => {
  const fakeStore = () => {
    let state = {
      regions: probe.REGION_META.map(m => ({ id: m.id, hexes: {} })),
      players: [{ seat: 0, scores: [0, 0, 0] }],
    }
    return { getState: () => state, setState: (p) => { state = { ...state, ...p } } }
  }

  it('reports trustworthy:false rather than a count when it seeded nothing', () => {
    // WRITTEN FIRST. `seedOneOfEach` exists because the original probe indexed a sparse map that is
    // empty until somebody plays, placed nothing, and then reported confident numbers for twelve
    // cells. A seeder that returns `placed: 57` computed from its own loop rather than from the
    // store has learned nothing from that · it is Rule 92 exactly, both sides from the same source.
    // So this one reads a real element back out and says so when it cannot.
    const broken = { getState: () => ({ regions: probe.REGION_META.map(m => ({ id: m.id, hexes: {} })), players: [] }), setState: () => {} }
    const r = probe.seedPlayedBoard({ store: broken })
    expect(r.trustworthy, 'a seeder whose write did not land must never look successful').toBe(false)
    expect(r.sampleElement).toBeNull()
  })

  it('fills every hex of every region and reads one back', () => {
    const store = fakeStore()
    const r = probe.seedPlayedBoard({ store })
    expect(r.placed, '3 regions x 19 hexes').toBe(57)
    expect(r.trustworthy).toBe(true)
    expect(Object.keys(probe.ELEMENT_COLORS)).toContain(r.sampleElement)
    for (const m of probe.REGION_META) {
      expect(Object.keys(store.getState().regions[m.id].hexes)).toHaveLength(19)
    }
  })

  it('drives the region scores to a width no real game reaches', () => {
    // The point of the seeder. My S40 measurement: the region score sits 0.79 units from the next
    // hex centre row and clears it only SIDEWAYS, by 44.1 · so it is a wide-enough score away from
    // being the district-name bug again. Three digits is deliberately past a real game.
    const store = fakeStore()
    const r = probe.seedPlayedBoard({ store })
    expect(r.scores).toEqual([128, 256, 999])
    expect(String(Math.max(...r.scores)).length,
      'a two-digit ceiling would test the number today rather than the class').toBeGreaterThanOrEqual(3)
  })

  it('stamps placedBy, so cluster ownership still reads correctly off a seeded board', () => {
    const store = fakeStore()
    probe.seedPlayedBoard({ store, seat: 1 })
    const hexes = Object.values(store.getState().regions[0].hexes)
    expect(hexes.every(h => h.placedBy === 1)).toBe(true)
  })
})

describe('it can cross into a page', () => {
  // ── EVERY function this file exports to a page, not just the one I remembered (T1 S43) ─────────
  // T3 found that seedPlayedBoard could not cross into a page at all: it read ELEMENT_COLORS,
  // REGION_META and hexesInRadius off module scope, and it took the STORE as an argument, which is
  // not serialisable either. So the late-game reachability case read as covered and was reachable
  // only from jsdom · which is the citation-rot shape T2 named in Rule 97, in my own harness.
  // THE INTERESTING PART IS THAT THE GUARD ALREADY EXISTED. The test below it has rebuilt
  // `reachability` from its own source since S41, for exactly this. I wrote that, then added a
  // second page-bound function to the same file and did not extend it · a guard applied to one
  // member of a class while the class grew. So it is a LIST now, and adding an export without
  // adding it here is the thing that fails.
  const PAGE_BOUND = ['reachability', 'seedPlayedBoard', 'seedOneOfEach', 'boardMetrics']

  it.each(PAGE_BOUND)('%s survives being serialised into a page', (name) => {
    const fn = probe[name]
    expect(fn, `${name} is not on the default export · a caller cannot page.evaluate it`).toBeTypeOf('function')
    const src = fn.toString()
    const rebuilt = new Function(`return (${src})`)()
    expect(rebuilt.name || name).toBeTruthy()
    // The real check: rebuilt with the module scope GONE, calling it must not throw a ReferenceError.
    // Each is given the least input that reaches its own guard rather than a crash.
    const call = () => {
      if (name === 'reachability') return rebuilt({ controls: '.nothing-matches-this' })
      // boardMetrics takes no options and reads the document · on an empty one it must report
      // measured:false rather than throw, which is the same UNMEASURED contract as the others.
      if (name === 'boardMetrics') {
        const r = rebuilt()
        expect(r.measured, 'an empty document must read as unmeasured, not as a board').toBe(false)
        expect(r.reason).toBeTruthy()
        return r
      }
      const store = {
        getState: () => ({ regions: [0, 1, 2].map(id => ({ id, hexes: {} })), players: [{ seat: 0, scores: [0, 0, 0] }] }),
        setState: () => {},
      }
      return rebuilt({ store })
    }
    expect(call, `${name} references module scope · it would throw only in the browser`).not.toThrow()
  })

  it('every page-bound export is in that list · a new one cannot be forgotten the way mine was', () => {
    // The counterweight to the list itself, which is otherwise a comment that ages. Anything on the
    // default export that takes options and is meant to run in a page belongs above; this catches the
    // NEXT function added to this file, which is exactly how seedPlayedBoard slipped through.
    const exported = Object.keys(probe).filter(k => typeof probe[k] === 'function')
    const notCovered = exported.filter(k => !PAGE_BOUND.includes(k) && !['setup', 'contrast', 'luminance', 'hexToPixel', 'hexesInRadius'].includes(k))
    expect(notCovered, 'new export · add it to PAGE_BOUND or to the known-not-page-bound list').toEqual([])
  })

  it('the inlined constants still agree with the module ones · the duplicate must not drift', () => {
    // seedPlayedBoard inlines the element list and the region centres so it can be serialised. That
    // is a deliberate second contract (Rule 45), so it gets a test rather than a promise · the same
    // deal hexToPixel already has in board-probe.test.js.
    const src = probe.seedPlayedBoard.toString()
    for (const el of Object.keys(probe.ELEMENT_COLORS)) {
      expect(src, `element "${el}" is missing from the inlined copy`).toContain(`'${el}'`)
    }
    for (const m of probe.REGION_META) {
      expect(src, `region ${m.id} centre (${m.cq},${m.cr}) drifted from REGION_META`)
        .toContain(`cq: ${m.cq}, cr: ${m.cr}`)
    }
  })

  it('is self-contained · no module-scope reference survives serialisation', () => {
    // T3 runs this as `page.evaluate(probe.reachability, opts)`, which serialises the FUNCTION and
    // re-creates it inside the page. Any free variable from this module arrives undefined there and
    // the probe throws in a browser while passing every test here · a defect that is invisible in
    // exactly the environment that tests it. So: rebuild it from its own source, with the module
    // scope gone, and check it still works.
    const rebuilt = new Function(`return (${reachability.toString()})`)()
    document.body.innerHTML = '<div class="ctl"><span data-box="0,0,40,40" class="shape"></span></div>'
    window.innerWidth = 1000; window.innerHeight = 800
    const shape = document.querySelector('.shape')
    Element.prototype.getBoundingClientRect = function () {
      return this === shape ? { x: 0, y: 0, width: 40, height: 40, left: 0, top: 0, right: 40, bottom: 40 }
        : { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }
    }
    document.elementFromPoint = () => document.querySelector('.ctl')
    expect(rebuilt({ controls: '.ctl', hit: '.shape', handlerGroups: [] }))
      .toMatchObject({ measured: true, ok: true, self: 1 })
  })

  it('takes only serialisable options · a function option would arrive as undefined', () => {
    // Playwright JSON-serialises the argument, so `hit: (el) => ...` silently becomes nothing. The
    // contract is strings and booleans, and this is the assertion that keeps it that way.
    const src = reachability.toString()
    const defaults = src.slice(src.indexOf('{'), src.indexOf('} = {}') + 1)
    expect(defaults).not.toMatch(/=>\s*[^,\n]*\(/)
  })

  it('is on the default export, where the other probes live', () => {
    expect(probe.reachability).toBe(reachability)
  })
})

describe('boardMetrics asserts its own claim, not just that it runs', () => {
  // MY OWN S46 CRITIQUE. The tests I shipped with this probe checked the UNMEASURED contract and
  // that it survives serialisation · the plumbing. The claim it EXISTS to make · that the header's
  // wrap and the board's height move together · was asserted nowhere: it lived in a commit message
  // and a comms table. A future edit could break the line-count derivation, every test would stay
  // green, and the gate I handed T3 would report a number nobody should trust. That is the same
  // shape as the vacuous `everyHexStamped: true` I caught myself writing hours earlier.
  //
  // THE SPLIT IS THE HONEST ONE: jsdom has no layout, so it cannot witness the coupling. What it CAN
  // hold is the arithmetic that turns two rects into a line count, and that is the part an edit
  // breaks silently. The coupling itself is asserted in a browser · numbers in the commit, and the
  // gate is T3's.
  const stubInstruction = ({ height, lineHeight, text = 'x' }) => {
    document.body.innerHTML = `
      <header></header>
      <div><svg role="img" viewBox="0 0 828 866"><g class="hex-cell"><polygon/></g></svg></div>
      <footer></footer>
      <div data-testid="instruction">${text}</div>`
    const ins = document.querySelector('[data-testid="instruction"]')
    const rects = new Map([[ins, { width: 200, height, left: 0, top: 0, right: 200, bottom: height }]])
    Element.prototype.getBoundingClientRect = function () {
      return rects.get(this) || { width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100 }
    }
    const realComputed = window.getComputedStyle
    window.getComputedStyle = (el) => (el === ins ? { lineHeight: `${lineHeight}px` } : realComputed(el))
    return () => { window.getComputedStyle = realComputed }
  }

  it.each([
    [18, 18, 1, 'one line'],
    [39, 19.5, 2, 'two lines · the real 320px case, 13px at 1.5'],
    [58, 19.5, 3, 'three lines'],
    // ROUND, NOT CEIL · a line box is routinely a pixel or two taller than its line-height (descenders,
    // font metrics), so ceil() would report two lines for one. Found because the ceil mutation passed
    // my first table and a mutation that cannot cross the threshold proves nothing (S41's lesson).
    [20, 18, 1, 'a single line box slightly taller than its line-height is still ONE line'],
    [34, 18, 2, 'and two short lines are still two'],
    [0, 18, 1, 'a zero-height instruction still counts as one · never 0 lines'],
  ])('derives %ipx / %ipx line-height as %i (%s)', (height, lineHeight, want) => {
    const restore = stubInstruction({ height, lineHeight })
    try {
      expect(probe.boardMetrics().instructionLines).toBe(want)
    } finally { restore() }
  })

  it('falls back to 18px when the line-height is not a number · never NaN lines', () => {
    // computedStyle.lineHeight is 'normal' by default in several engines, and Number.parseFloat of
    // that is NaN · which would make every line count NaN and every comparison in T3's gate silently
    // false. FALSE CASE: drop the `|| 18` and this returns NaN.
    const restore = stubInstruction({ height: 36, lineHeight: 'normal' })
    try {
      const n = probe.boardMetrics().instructionLines
      expect(Number.isNaN(n), 'a NaN line count makes every assertion in the gate quietly false').toBe(false)
      expect(n).toBe(2)
    } finally { restore() }
  })

  it('reports the string itself, so a gate can pin what it is measuring', () => {
    const restore = stubInstruction({ height: 39, lineHeight: 19.5, text: 'Click a factory to take an element' })
    try {
      const m = probe.boardMetrics()
      expect(m.instruction).toBe('Click a factory to take an element')
      expect(m.instructionChars).toBe(34)
      expect(m.measured).toBe(true)
    } finally { restore() }
  })
})
