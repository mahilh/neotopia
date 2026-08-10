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

export default { setup, seedOneOfEach, hexToPixel, hexesInRadius, contrast, luminance, ELEMENT_COLORS, REGION_META }
