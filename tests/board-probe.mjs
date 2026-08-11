// NeoTopia · THE BOARD RENDER PROBE. Paste-able into any Playwright/devtools evaluate.
//
// WHY THIS FILE EXISTS. I have rebuilt this from scratch in S34, S35 and S37, and it has lied about
// three times per session before telling the truth · the same three ways every time, each of which
// returns a plausible number rather than an error:
//
//   1. SEEDING INTO A MAP THAT DOES NOT EXIST YET. `region.hexes` is a SPARSE map whose keys are
//      created on placement, not a pre-built grid. Indexing `Object.keys(hexes)[n]` on a fresh board
//      places nothing and then reports confident contrast ratios for twelve cells that are empty.
//   2. RASTERISING AT THE WRONG SCALE. An SVG carrying only a viewBox has an intrinsic size of its
//      own choosing · this board reports 143x150 · so drawImage into a full-size canvas upscales it
//      by 12x and every sampled pixel is a smeared average. "energy" then comes back 176 away from
//      red and nothing anywhere errors.
//   3. MAPPING THROUGH A LETTERBOX THAT IS NOT THERE. The live <svg> is letterboxed by
//      preserveAspectRatio, a rasterised clone stretched to a canvas is not, and applying the live
//      offsets to the clone puts every sample somewhere else on the board.
//
// Plus the one from S35 that predates all of it: getImageData returns UN-PREMULTIPLIED RGBA, so a
// canvas with no opaque backing fill reports a 13%-opaque token at its full strength.
//
// Every one of those is closed below, and `recognise()` is the read-back that would catch a fourth.
// Rule 81's corollary, made reusable instead of rediscovered.
//
// USAGE · two ways, neither of which is eval (do not eval this file · it is a module, and a probe
// that needs arbitrary code execution to run is a probe nobody will run):
//   · in a Playwright/devtools evaluate, paste the BODY of setup()/seedOneOfEach() inline. They are
//     written as self-contained closures with no imports between them precisely so this works.
//   · in any module context, `import probe from '../tests/board-probe.mjs'`.
//
//   const placed = probe.seedOneOfEach(window.__neotopia_store)  // a real token in every region
//   const p = await probe.setup()                                // rasterise the CURRENT board
//   p.recognise(q, r, 'energy')                                  // <- CHECK THIS FIRST
//   p.at(x, y)                                                   // svg user units -> [r,g,b]
//   p.contrast(a, b)                                             // WCAG ratio between two pixels
//
//   probe.reachability()                                         // Rule 78, both halves · see below
//   // from Playwright, where it crosses into the page as source:
//   const r = await page.evaluate(probe.reachability, { controls: 'g.hex-cell' })
//   expect(r.measured, r.reason).toBe(true)   // <- CHECK THIS FIRST · never assert ok alone
//   expect(r.failures).toEqual([])
//
// It reads the board and never writes to it, except through seedOneOfEach, which is explicit.

export const ELEMENT_COLORS = {
  energy: [226, 75, 74], biofarming: [29, 158, 117], technology: [127, 119, 221], community: [55, 138, 221],
}

// Flat-top hex → pixel. Duplicated from src/utils/hexUtils on purpose: this probe has to be
// paste-able into a page that has no module graph, and a probe that imports the thing it measures
// can agree with a bug rather than catch it.
export const hexToPixel = (q, r, size = 36) => ({ x: size * 1.5 * q, y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r) })
export const hexesInRadius = (cq, cr, rad) => {
  const out = []
  for (let q = -rad; q <= rad; q++) {
    for (let r = Math.max(-rad, -q - rad); r <= Math.min(rad, -q + rad); r++) out.push([cq + q, cr + r])
  }
  return out
}
export const REGION_META = [
  { id: 0, cq: 0, cr: 0, terrain: 'water' },
  { id: 1, cq: 8, cr: -4, terrain: 'grass' },
  { id: 2, cq: 4, cr: 5, terrain: 'desert' },
]

// FIX 1 · build the keys from the geometry, the way the board itself does, instead of reading an
// index out of a map that is empty until somebody plays.
//
// SELF-CONTAINED AND OPTIONS-ONLY, for the same reason as seedPlayedBoard below · and this one was
// found by the guard rather than by a person. Extending the serialisation test from one function to
// a LIST caught this on its first run: it had read ELEMENT_COLORS, REGION_META and hexesInRadius off
// module scope since S38, and it takes the store as an argument, so it could never have run in a
// page either. Two of the three exports this file offers a page were broken the same way, which is
// the argument for the list over the memory.
export function seedOneOfEach({ seat = 0, store = null } = {}) {
  const s = store || (typeof window !== 'undefined' ? window.__neotopia_store : null)
  if (!s || typeof s.getState !== 'function') {
    return { placed: [], trustworthy: false, reason: 'no store · pass one, or expose window.__neotopia_store' }
  }
  const els = ['energy', 'biofarming', 'technology', 'community']
  const meta = [{ id: 0, cq: 0, cr: 0 }, { id: 1, cq: 8, cr: -4 }, { id: 2, cq: 4, cr: 5 }]
  const cellsOf = (cq, cr, rad) => {
    const out = []
    for (let q = -rad; q <= rad; q++) {
      for (let r = Math.max(-rad, -q - rad); r <= Math.min(rad, -q + rad); r++) out.push([cq + q, cr + r])
    }
    return out
  }
  const regions = JSON.parse(JSON.stringify(s.getState().regions))
  const placed = []
  for (const m of meta) {
    const cells = cellsOf(m.cq, m.cr, 2)
    els.forEach((el, i) => {
      const [q, r] = cells[2 + i * 4]
      regions[m.id].hexes[`${q},${r}`] = { element: el, placedBy: seat }
      placed.push({ region: m.id, q, r, element: el })
    })
  }
  s.setState({ regions }, false)
  const after = s.getState()
  const first = placed[0]
  const sample = first ? after.regions[first.region].hexes[`${first.q},${first.r}`] : null
  return { placed, sampleElement: sample ? sample.element : null, trustworthy: placed.length === 12 && !!sample }
}

// ── REACHABILITY · THE RULE 78 PROBE, ONCE, FOR BOTH LANES (T1 S41) ─────────────────────────────
// Three overlay-vs-control defects have shipped in five sessions and every one of them failed this
// same check, which no unit test could hold because jsdom has no layout and no hit-testing:
//
//   S35  ScoreFlash · a fixed full-screen overlay with no dismiss, covering the board
//   S36  the practice Leave button · in the DOM, correctly sized, underneath FinalScore
//   S38  End Turn at 320 · correctly sized, 17px off the right of the screen
//   S39  the action log · 31 of 57 cells invisible AND still clickable underneath it
//   S40  the district names · 3 of 57 cells taking the click at their own centre
//
// Every time, a standard isVisible()/toBeVisible() passed. I have hand-written the probe from
// scratch on four of those occasions, and in S40 I found a real defect IN MY OWN VERSION: three
// factory cells report an SVG <text> on top and are NOT broken, because that text lives inside the
// <g> carrying onFactoryClick, so the click reaches the right handler. A fifth writing would have
// reported three false positives. That is the argument for this being a function rather than a
// habit (Rule 90's corollary), and for it being ONE function rather than one per lane (Rule 45).
//
// IT IS DELIBERATELY SELF-CONTAINED · no imports, no module-scope references, options are strings
// and booleans only. That is what lets it cross into a page: `page.evaluate(probe.reachability,
// opts)` serialises the function, so a free variable from this module would arrive undefined.
//
// WHAT IT CHECKS, which is both halves of Rule 78 and not just the famous one:
//   78a  COVERED    · the topmost element at the control's centre must BE the control, or sit
//                     inside it, or sit inside an ancestor that owns the handler for its subtree
//   78b  PUSHED OFF · the control's box must lie inside the viewport
// And Rule 83's correction: `el === top || el.contains(top)`, because a control with children has
// its own child at its centre. And S40's: credit the handler-bearing ancestor.
//
// IT REPORTS UNMEASURED RATHER THAN OK (Rule 80). If the selector matches nothing, `ok` is FALSE
// and `measured` is false. A reachability probe that answers "all clear" for a board it never found
// is the exact failure this whole family is about.
// OFF THE SCREEN AND BELOW THE FOLD ARE DIFFERENT BUGS, and conflating them is a false positive
// (T1 S42, found by pointing this at the card Hand). S38's End Turn sat 17px past the right edge of
// a 320px phone inside a FIXED footer · genuinely lost, no gesture recovers it. The Hand's cards sit
// 683px down a sidebar whose scrollHeight is 931 against a 239 clientHeight · one scroll away, and
// `scrollIntoView` then puts elementFromPoint right back on the card. Reporting those two the same
// way condemns a working screen, and Rule 94a is exactly that a false positive is not the safe
// error: a gate that cries wolf gets switched off before the day it is right.
// So: a control outside the window is `offscreen` only when NOTHING between it and the document can
// scroll it into view. Otherwise it is `belowFold` · surfaced, counted, and not a failure unless the
// caller says so. This is T3's third case from S39 (below the fold in a scrollable container, which
// is neither 78a nor 78b) given a name in the instrument rather than in a handoff.
export function reachability({
  controls = 'g.hex-cell',          // selector for every control to check
  hit = 'polygon',                  // child whose box defines the centre · '' uses the control itself
  handlerGroups = ['[data-factory]'], // ancestors that own a click handler for their whole subtree
  requireInViewport = true,
  foldIsFailure = false,            // true = demand it be on screen WITHOUT scrolling
} = {}) {
  const nodes = Array.from(document.querySelectorAll(controls))
  if (nodes.length === 0) {
    return { measured: false, ok: false, reason: `no element matched ${controls}`, total: 0, failures: [] }
  }
  const vw = window.innerWidth, vh = window.innerHeight
  const describe = (el) => {
    if (!el) return 'null'
    let s = el.tagName.toLowerCase()
    const tid = el.getAttribute && el.getAttribute('data-testid')
    if (tid) s += `[${tid}]`
    const txt = (el.textContent || '').trim()
    if (txt && txt.length <= 40) s += `("${txt}")`
    return s
  }
  // The nearest ancestor that could bring this into view. document.scrollingElement counts · a page
  // that scrolls is the commonest scrollport of all.
  const scrollerFor = (node) => {
    for (let n = node.parentElement; n; n = n.parentElement) {
      const cs = window.getComputedStyle(n)
      const scrollsY = /auto|scroll/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1
      const scrollsX = /auto|scroll/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1
      if (scrollsY || scrollsX) return n
    }
    const doc = document.scrollingElement || document.documentElement
    if (doc && (doc.scrollHeight > doc.clientHeight + 1 || doc.scrollWidth > doc.clientWidth + 1)) return doc
    return null
  }
  const counts = { self: 0, group: 0, blocked: 0, offscreen: 0, belowFold: 0 }
  const failures = []
  nodes.forEach((node, i) => {
    const shape = (hit && node.querySelector(hit)) || node
    const r = shape.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const inside = r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh
    if (requireInViewport && !inside) {
      const scroller = scrollerFor(node)
      const verdict = scroller ? 'belowFold' : 'offscreen'
      counts[verdict]++
      if (verdict === 'offscreen' || foldIsFailure) {
        failures.push({ i, cx: Math.round(cx), cy: Math.round(cy), verdict,
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
          viewport: [vw, vh],
          scroller: scroller ? describe(scroller) : null })
      }
      return
    }
    const top = document.elementFromPoint(cx, cy)
    if (top === node || node.contains(top)) { counts.self++; return }
    const group = handlerGroups.map(sel => node.closest(sel)).find(g => g && g.contains(top))
    if (group) { counts.group++; return }
    counts.blocked++
    failures.push({ i, cx: Math.round(cx), cy: Math.round(cy), verdict: 'blocked', top: describe(top) })
  })
  return {
    measured: true,
    ok: counts.blocked === 0 && counts.offscreen === 0 && (!foldIsFailure || counts.belowFold === 0),
    total: nodes.length, ...counts, failures,
  }
}

// ── A PLAYED BOARD, because a fresh one is not the hard case (T1 S42, from T3's gap) ────────────
// T3's merge gate runs `reachability` on a freshly dealt board · no tokens placed, every region
// score at 0 · which covers the FIX and not the CLASS. My own S40 measurement is why that matters:
// the region score sits 0.79 user units from the next hex centre row and clears it only SIDEWAYS,
// by 44.1, so it is a wide-enough score away from being the district-name bug again.
//
// MEASURED with this seeder, at 320 and 1280: every one of the 57 hexes holding a token and the
// three region scores rendered on screen as 128 / 256 / 999 · still 60 of 60 reachable, 0 blocked.
// The class IS closed, and it is closed for a reason worth keeping: the S40 fix made every board
// <text> pointer-events:none, so a score may grow as wide as it likes and still cannot take a
// click. That is the difference an identity makes over a tolerance · but it is also exactly the
// kind of property a later change removes silently, which is why it wants a gate rather than a
// paragraph. Three digits is past anything a real game reaches, deliberately.
// IT COULD NOT ACTUALLY CROSS INTO A PAGE, AND I SHIPPED IT ANYWAY (fixed T1 S43, found by T3).
// The first version took the store as an ARGUMENT and read ELEMENT_COLORS / REGION_META /
// hexesInRadius off module scope. Both are fatal to `page.evaluate`, and in different ways: the
// free variables arrive undefined, and a Zustand store is not serialisable as an argument at all.
// So the late-game reachability case read as covered and was reachable only from jsdom.
// WHAT MAKES THAT WORTH A PARAGRAPH: `reachability` right above has a test that rebuilds it from its
// own source with the module scope stripped, precisely to catch this. I wrote that guard, then added
// a second function to the same file and did not extend it · a guard applied to one member of a
// class while the class grows. It is now applied to every seeder here, and the store defaults to the
// page's own `window.__neotopia_store` so nothing needs to be passed across the boundary.
export function seedPlayedBoard({ seat = 0, scores = [128, 256, 999], store = null } = {}) {
  const s = store || (typeof window !== 'undefined' ? window.__neotopia_store : null)
  if (!s || typeof s.getState !== 'function') {
    return { placed: 0, trustworthy: false, reason: 'no store · pass one, or expose window.__neotopia_store' }
  }
  // Inlined rather than imported · see above. Kept identical to the module's own copies, and
  // board-probe.reach.test.js pins them against each other so the duplicate cannot drift.
  const els = ['energy', 'biofarming', 'technology', 'community']
  const meta = [{ id: 0, cq: 0, cr: 0 }, { id: 1, cq: 8, cr: -4 }, { id: 2, cq: 4, cr: 5 }]
  const cells = (cq, cr, rad) => {
    const out = []
    for (let q = -rad; q <= rad; q++) {
      for (let r = Math.max(-rad, -q - rad); r <= Math.min(rad, -q + rad); r++) out.push([cq + q, cr + r])
    }
    return out
  }

  const state = s.getState()
  const regions = JSON.parse(JSON.stringify(state.regions))
  let placed = 0
  for (const m of meta) {
    for (const [q, r] of cells(m.cq, m.cr, 2)) {
      regions[m.id].hexes[`${q},${r}`] = { element: els[placed % els.length], placedBy: seat }
      placed++
    }
  }
  s.setState({ regions, players: state.players.map(p => ({ ...p, scores: [...scores] })) }, false)

  // THE READ-BACK, because a seeder that silently places nothing is the exact lie this file was
  // built to stop (Rule 75b · check the probe measured the thing it names). Read a real value back
  // out of the store rather than trusting the count we just computed.
  const after = s.getState()
  const sample = after.regions[meta[0].id].hexes[`${meta[0].cq},${meta[0].cr}`]
  return {
    placed,
    scores: after.players[0] ? after.players[0].scores : null,
    sampleElement: sample ? sample.element : null,
    trustworthy: placed === 57 && !!sample && els.indexOf(sample.element) !== -1,
  }
}

// ── HOW BIG IS THE BOARD, AND WHAT IS IT PAYING FOR (T1 S46) ────────────────────────────────────
// Two competent measurements of the same screen disagreed on BOTH axes for two sessions · a browser
// audit said 288x82 and I said 288x102 · and neither was wrong. THE HEADER WRAPS ON THE LENGTH OF
// THE INSTRUCTION STRING, and the board pays for it out of its own height:
//     66 chars ("Click a factory to take an element · or draw a card from the Offer")
//         instruction 2 lines · header 142px · board 288x82  · cell 6.8x5.9 · 15.5% of 44px
//     34 chars ("No legal move left · end your turn")
//         instruction 1 line  · header 122px · board 288x102 · cell 8.4x7.3 · 19.2% of 44px
// 20px of header is 24% of the board's height. So a 320px gate that pins only the VIEWPORT flakes
// the first time anybody edits a sentence · which is not hypothetical: I improved the instruction
// copy in S44 and silently changed the board's height by a quarter, and nothing noticed.
//
// FALSIFIED ALONG THE WAY, so nobody re-runs it: post-resize measurement lag is NOT the cause
// (stable at t0, 2 frames, 100/300/700/1500ms), and the board is INVARIANT to hand size, offer size
// and mid-placement state (the sidebar's scrollHeight swings 931 -> 277 and the board does not move).
//
// So this returns the string and its line count ALONGSIDE the geometry. A caller that asserts on
// `cell` without asserting on `instructionLines` is measuring a number it does not control.
export function boardMetrics() {
  const svg = document.querySelector('svg[role="img"]')
  if (!svg) return { measured: false, reason: 'no board svg · the game did not mount' }
  const container = svg.parentElement
  const cellNode = document.querySelector('g.hex-cell polygon')
  if (!cellNode) return { measured: false, reason: 'no hex cells · the board mounted empty' }

  const sr = svg.getBoundingClientRect()
  const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number)
  if (vb.length !== 4 || !vb[2] || !vb[3]) return { measured: false, reason: 'board has no usable viewBox' }
  const scale = Math.min(sr.width / vb[2], sr.height / vb[3])
  const cell = cellNode.getBoundingClientRect()
  const header = document.querySelector('header')
  const ins = document.querySelector('[data-testid="instruction"]')
  const bar = document.querySelector('footer')
  // One rendered line of the instruction, read from the element rather than assumed · its font-size
  // and line-height are inline styles that a future edit may move.
  const insRect = ins ? ins.getBoundingClientRect() : null
  const lineH = ins ? Number.parseFloat(window.getComputedStyle(ins).lineHeight) || 18 : 18

  return {
    measured: true,
    viewport: [window.innerWidth, window.innerHeight],
    svgBox: [Math.round(sr.width), Math.round(sr.height)],
    drawn: [+(vb[2] * scale).toFixed(1), +(vb[3] * scale).toFixed(1)],
    cell: [+cell.width.toFixed(1), +cell.height.toFixed(1)],
    cellPctOf44: +(100 * Math.max(cell.width, cell.height) / 44).toFixed(1),
    // THE THING A GATE MUST PIN ALONGSIDE THE GEOMETRY.
    instruction: ins ? ins.textContent.trim() : null,
    instructionChars: ins ? ins.textContent.trim().length : 0,
    instructionLines: insRect ? Math.max(1, Math.round(insRect.height / lineH)) : 0,
    headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
    actionBarH: bar ? Math.round(bar.getBoundingClientRect().height) : null,
    containerH: Math.round(container.getBoundingClientRect().height),
  }
}

// ── WHAT A STYLESHEET STRING MATCH CANNOT ANSWER (T1 S48) ────────────────────────────────────────
// My own S47 gate asserts that index.css CONTAINS `flex: 3 1 0` inside the 600px block, and I wrote
// in the roadmap that this pins the STRING and not the BEHAVIOUR: it passes if the rule is beaten
// later in the cascade, if a more specific selector wins, or if an !important lands somewhere that
// outranks it. jsdom cannot close that gap · it has no cascade resolution for layout and no viewport
// · so the question belongs in a browser and the answer is getComputedStyle, which is the ONLY thing
// that knows who actually won.
//
// Returns the RESOLVED values, not the authored ones. The caller decides what they should be at a
// given width, because the expectation is a layout decision and this is an instrument.
//
// AND IT REPORTS `measured: false` RATHER THAN A PLAUSIBLE ZERO. A missing element gives a reason
// string, never a flexGrow of 0 that reads exactly like a rule that lost (Rule 80).
export function cascadeFacts() {
  const board = document.querySelector('.game-board-area')
  const side = document.querySelector('.game-sidebar')
  const main = document.querySelector('.game-main')
  if (!board) return { measured: false, reason: 'no .game-board-area · the board container is unclassed again' }
  if (!side) return { measured: false, reason: 'no .game-sidebar' }
  if (!main) return { measured: false, reason: 'no .game-main' }

  const read = (el) => {
    const cs = window.getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      // `position` is the DEFINING property of the S49 sheet layout and the reason it is reported
      // first. A flex term cannot express "this element left the flow", and the share below cannot
      // either · see the warning on boardShareOfMain.
      position: cs.position,
      flexGrow: cs.flexGrow,
      flexShrink: cs.flexShrink,
      flexBasis: cs.flexBasis,
      minHeight: cs.minHeight,
      maxHeight: cs.maxHeight,
      width: Math.round(r.width),
      height: Math.round(r.height),
    }
  }
  return {
    measured: true,
    viewport: [window.innerWidth, window.innerHeight],
    flexDirection: window.getComputedStyle(main).flexDirection,
    board: read(board),
    sidebar: read(side),
    // ⚠ NOT A DISCRIMINATOR BETWEEN THE S47 AND S49 LAYOUTS · MEASURED, after I claimed it was.
    // It divides by the sum of both heights, and an ABSOLUTELY POSITIONED sidebar still has a
    // height · it simply is not in the flow. So the sheet build reports 0.633 against the 3:2
    // build's 0.588, two numbers close enough to prove nothing. I wrote "expect > 0.95" into a
    // handoff for T3 before running it; it is 0.633 (Rule 104's corollary · a measurement asserted
    // from expectation is a guess with a number).
    // Use `sidebar.position` for that question. This stays because it is still the right reading of
    // "how the column was actually divided" WHEN both children are in the column.
    boardShareOfMain: (() => {
      const b = board.getBoundingClientRect().height
      const s = side.getBoundingClientRect().height
      return b + s > 0 ? +(b / (b + s)).toFixed(3) : null
    })(),
  }
}

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
// ── A CONTRAST RATIO THAT CANNOT BE PLAUSIBLE-BUT-WRONG (T1 S49) ─────────────────────────────────
// In S48 an ad-hoc version of this reported 97186:1 for #C89440, because its alpha regex captured
// the BLUE CHANNEL of `rgb(200, 148, 64)` and composited the colour against the page 64 times over.
// I caught it only because the number was absurd. At 4.9:1 · one notch over the AA line · I would
// have shipped it, and it would have retro-justified nine sessions of contrast claims.
//
// SO THE FUNCTION ASSERTS ITS OWN RANGE AND THROWS. WCAG contrast is bounded by construction:
// luminance is in [0,1], the ratio is (L1+0.05)/(L2+0.05), so it cannot leave [1, 21]. A value
// outside that is not a low reading or a high reading · it is proof the INPUT was not a colour, and
// the only honest response is to refuse rather than to return. This is the same contract as
// `measured: false` elsewhere in this file (Rule 80), in the one case where the wrong answer is a
// number a human will believe.
// Channels are validated too, because [0,1]-scaled floats and 0-255 ints are the mistake that makes
// a bad ratio LOOK reasonable · 0.78 read as a channel is simply very dark, and reports 19:1.
const channelOk = (v) => Number.isFinite(v) && v >= 0 && v <= 255
export const luminance = (p) => {
  if (!Array.isArray(p) || p.length < 3 || !p.slice(0, 3).every(channelOk)) {
    throw new Error(`board probe: luminance needs [r,g,b] in 0..255, got ${JSON.stringify(p)}`)
  }
  // THE 0..1 CASE, WHICH IS THE DANGEROUS ONE AND THE ONLY HEURISTIC HERE. Everything else above is
  // a proof: out of [0,255] cannot be a channel. This is not · [0.78,0.58,0.25] is a perfectly legal
  // near-black, so I cannot reject fractional channels outright, and I must not, because compositing
  // an alpha produces them (255*0.65 + 10*0.35 = 169.25 is a real, correct input).
  // What is NOT plausible is all three channels at or below 1 AND at least one fractional: that is
  // a 0..1-scaled colour, and it reports ~19:1 against a dark page instead of the true ~7:1 · a
  // believable number in the direction of PASSING, which is the worst possible failure for a check
  // whose whole job is to catch things that are too faint.
  const c = p.slice(0, 3)
  if (c.every(v => v <= 1) && c.some(v => !Number.isInteger(v))) {
    throw new Error(
      `board probe: ${JSON.stringify(c)} looks like 0..1 floats, not 0..255 channels · multiply by `
      + '255. (Heuristic, not a proof: a genuine near-black with fractional channels would trip it, '
      + 'and that is the trade · a false alarm on a colour nobody uses beats a plausible pass.)',
    )
  }
  return 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])
}
export const contrast = (a, b) => {
  const [x, y] = [luminance(a) + 0.05, luminance(b) + 0.05]
  const r = x > y ? x / y : y / x
  if (!(r >= 1 && r <= 21.000001)) {
    throw new Error(
      `board probe: contrast ${r} is outside the possible range 1..21 · the inputs were not colours `
      + `(${JSON.stringify(a)} vs ${JSON.stringify(b)}). See S48: an alpha regex ate a blue channel.`,
    )
  }
  return r
}

export async function setup({ scale = 2, inlineImages = true } = {}) {
  const svg = document.querySelector('svg[role="img"]')
  if (!svg) throw new Error('board probe: no svg[role="img"] · is this the game screen?')
  const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number)

  // FIX 4 · the page's REAL background, walking ancestors. `transparent` here is what made a
  // 13%-opaque token read as full strength, because getImageData is un-premultiplied.
  let bg = null
  for (let n = svg; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor
    if (c && !/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(c)) { bg = c; break }
  }
  bg = bg || 'rgb(10,10,15)'

  const rasterise = async (mutate) => {
    // FIX 2 · stamp explicit dimensions on the clone. Without these the browser picks an intrinsic
    // size (143x150 on this board) and everything sampled afterwards is an average of a 12x upscale.
    const clone = svg.cloneNode(true)
    clone.setAttribute('width', vw * scale)
    clone.setAttribute('height', vh * scale)
    let xml = new XMLSerializer().serializeToString(clone)

    // An <img> loading a serialised SVG may not fetch external resources, so any <image href> would
    // be silently absent · and a before/after comparison would then measure the same thing twice.
    if (inlineImages) {
      for (const m of [...xml.matchAll(/href="(\/[^"]+\.(?:jpg|jpeg|png|webp))"/g)]) {
        const blob = await fetch(m[1]).then(r => r.blob())
        const uri = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob) })
        xml = xml.split(m[1]).join(uri)
      }
    }
    if (mutate) xml = mutate(xml)

    // FIX 3 · canvas takes the viewBox's OWN aspect, so drawImage cannot letterbox and the mapping
    // below is a pure linear scale with no offsets to get wrong.
    const cv = document.createElement('canvas')
    cv.width = Math.round(vw * scale); cv.height = Math.round(vh * scale)
    const ctx = cv.getContext('2d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, cv.width, cv.height)
    const im = new Image()
    await new Promise((ok, err) => { im.onload = ok; im.onerror = err; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml) })
    ctx.drawImage(im, 0, 0, cv.width, cv.height)
    return { data: ctx.getImageData(0, 0, cv.width, cv.height), w: cv.width, h: cv.height, intrinsic: [im.naturalWidth, im.naturalHeight] }
  }

  const R = await rasterise()
  const at = (ux, uy) => {
    const x = Math.round((ux - vx) * scale), y = Math.round((uy - vy) * scale)
    if (x < 0 || y < 0 || x >= R.w || y >= R.h) return null
    const i = (y * R.w + x) * 4
    return [R.data.data[i], R.data.data[i + 1], R.data.data[i + 2]]
  }

  // THE READ-BACK. Find the pixel inside a cell nearest that element's own palette colour and report
  // how far off it is. A probe that cannot find a token within ~60 of its real colour has not
  // measured a token, whatever ratio it goes on to compute. Call this before believing anything.
  const recognise = (q, r, element) => {
    const c = hexToPixel(q, r), want = ELEMENT_COLORS[element]
    let best = Infinity, px = null
    for (let rad = 0; rad <= 20; rad += 1) {
      for (let a = 0; a < 360; a += 10) {
        const p = at(c.x + rad * Math.cos(a * Math.PI / 180), c.y + rad * Math.sin(a * Math.PI / 180))
        if (!p) continue
        const d = Math.hypot(p[0] - want[0], p[1] - want[1], p[2] - want[2])
        if (d < best) { best = d; px = p }
      }
    }
    return { pixel: px, error: Math.round(best), trustworthy: best < 60 }
  }

  return { at, recognise, contrast, luminance, viewBox: [vx, vy, vw, vh], scale, background: bg, intrinsic: R.intrinsic, rasterise, width: R.w, height: R.h }
}

export default { setup, seedOneOfEach, seedPlayedBoard, reachability, boardMetrics, cascadeFacts, hexToPixel, hexesInRadius, contrast, luminance, ELEMENT_COLORS, REGION_META }
