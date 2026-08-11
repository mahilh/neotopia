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
export function seedOneOfEach(store, { seat = 0 } = {}) {
  const els = Object.keys(ELEMENT_COLORS)
  const regions = JSON.parse(JSON.stringify(store.getState().regions))
  const placed = []
  for (const m of REGION_META) {
    const cells = hexesInRadius(m.cq, m.cr, 2)
    els.forEach((el, i) => {
      const [q, r] = cells[2 + i * 4]
      regions[m.id].hexes[`${q},${r}`] = { element: el, placedBy: seat }
      placed.push({ region: m.id, q, r, element: el })
    })
  }
  store.setState({ regions }, false)
  return placed
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
export function reachability({
  controls = 'g.hex-cell',          // selector for every control to check
  hit = 'polygon',                  // child whose box defines the centre · '' uses the control itself
  handlerGroups = ['[data-factory]'], // ancestors that own a click handler for their whole subtree
  requireInViewport = true,
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
  const counts = { self: 0, group: 0, blocked: 0, offscreen: 0 }
  const failures = []
  nodes.forEach((node, i) => {
    const shape = (hit && node.querySelector(hit)) || node
    const r = shape.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const inside = r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh
    if (requireInViewport && !inside) {
      counts.offscreen++
      failures.push({ i, cx: Math.round(cx), cy: Math.round(cy), verdict: 'offscreen',
        rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], viewport: [vw, vh] })
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
    ok: counts.blocked === 0 && counts.offscreen === 0,
    total: nodes.length, ...counts, failures,
  }
}

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
export const luminance = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])
export const contrast = (a, b) => {
  const [x, y] = [luminance(a) + 0.05, luminance(b) + 0.05]
  return x > y ? x / y : y / x
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

export default { setup, seedOneOfEach, reachability, hexToPixel, hexesInRadius, contrast, luminance, ELEMENT_COLORS, REGION_META }
