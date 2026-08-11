// NeoTopia · THE CARD ART PROBE. Paste-able into any Playwright/devtools evaluate.
//
// WHY THIS FILE EXISTS, and it is my own S42 critique promoted to code. I measured the thing this
// project's card-art decision turns on ONCE, by hand, in an evaluate I did not commit:
//
//   the slot is 104x80 and every master is square, so objectFit:cover discards 23.1% OF THE AREA
//   ...but only 2.1% OF THE INK (median over 20 files, max 10.9), because the art is centre-composed
//
// Those two numbers imply opposite actions · regenerate 56 masters, or ship a gate · and the second
// one is right. What I then committed was a PROXY for it ("every master must be square"), which is a
// good guard and is NOT the same claim: a square master composed with content at its edges passes
// that gate while the finding is silently false. Rule 79, in the costume where the measurement was
// mine and I knew it (Rule 96b · gate the premise, and this is the premise).
//
// IT NEEDS A COMPOSITOR. Decoding a PNG and sampling it is not something jsdom can do, so this lives
// in a browser probe and the DECISION it produced is pinned in CardFrame.assets.test.js. Same split
// as board-probe.mjs, for the same reason, and stated here so nobody re-litigates it.
//
// SELF-CONTAINED ON PURPOSE · no imports, no module-scope references, options are plain data. That
// is what lets it cross into a page: `page.evaluate(probe.inkLoss, opts)` serialises the FUNCTION,
// so a free variable from this module would arrive undefined there and throw only in the browser it
// exists to drive. tests/card-art-probe.test.js rebuilds it from its own source to prove that.
//
//   const r = await page.evaluate(probe.inkLoss, { ids, slot: { width: 104, height: 80 } })
//   expect(r.measured, r.reason).toBe(true)   // <- CHECK THIS FIRST · never assert on `worst` alone
//   expect(r.worst.inkLostPct).toBeLessThan(20)

// A pixel counts as INK when it differs from that file's own background by more than this, per
// channel-distance. The masters are dark navy fields with bright geometry, so the two populations
// are far apart · measured separations were 25-64% density inside versus 0-20% in the crop bands,
// which is why the exact threshold is not delicate. It is an option so a future art style can move
// it rather than quietly get the wrong answer.
export async function inkLoss({
  ids = [],                              // ['card_01', ...] · empty means "discover them"
  count = 56,                            // how many card_NN ids to build when none are given
  slot = { width: 104, height: 80 },     // the box CardFrame renders art into
  inkThreshold = 40,
  step = 2,                              // sample every Nth pixel · 2 is 4x faster and moved no result
} = {}) {
  const list = ids.length
    ? ids
    : Array.from({ length: count }, (_, i) => `card_${String(i + 1).padStart(2, '0')}`)

  const load = (src) => new Promise((ok, no) => {
    const im = new Image()
    im.onload = () => ok(im)
    im.onerror = () => no(new Error(`404 ${src}`))
    im.src = src
  })
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d', { willReadFrequently: true })

  const rows = []
  const missing = []
  for (const id of list) {
    const src = `/art/cards/${id}.png`
    let im
    try { im = await load(src) } catch { missing.push(id); continue }
    if (!im.naturalWidth || !im.naturalHeight) { missing.push(id); continue }

    cv.width = im.naturalWidth
    cv.height = im.naturalHeight
    // OPAQUE BACKING. getImageData returns UN-PREMULTIPLIED RGBA, so a transparent canvas reports a
    // 13%-opaque pixel at full strength · the S35 lie, and it belongs to every probe that samples.
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.drawImage(im, 0, 0)
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data
    const at = (x, y) => { const i = (y * cv.width + x) * 4; return [d[i], d[i + 1], d[i + 2]] }

    // Background is each file's OWN corners, not a constant · a probe that assumes one palette
    // measures the palette rather than the picture.
    const corners = [at(1, 1), at(cv.width - 2, 1), at(1, cv.height - 2), at(cv.width - 2, cv.height - 2)]
    const bg = [0, 1, 2].map(c => Math.round(corners.reduce((a, p) => a + p[c], 0) / corners.length))

    // objectFit:cover · scale so the image covers the slot, then discard the overflow on the long
    // axis. Which axis that is depends on the master, so it is derived rather than assumed.
    const sx = slot.width / cv.width, sy = slot.height / cv.height
    const s = Math.max(sx, sy)
    const visW = Math.min(cv.width, Math.round(slot.width / s))
    const visH = Math.min(cv.height, Math.round(slot.height / s))
    const cropX = Math.round((cv.width - visW) / 2)
    const cropY = Math.round((cv.height - visH) / 2)

    let inkIn = 0, inkOut = 0, nIn = 0, nOut = 0
    for (let y = 0; y < cv.height; y += step) {
      for (let x = 0; x < cv.width; x += step) {
        const p = at(x, y)
        const isInk = Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) > inkThreshold
        const kept = x >= cropX && x < cropX + visW && y >= cropY && y < cropY + visH
        if (kept) { nIn++; if (isInk) inkIn++ } else { nOut++; if (isInk) inkOut++ }
      }
    }
    const totalInk = inkIn + inkOut
    rows.push({
      id,
      natural: [cv.width, cv.height],
      areaLostPct: +(100 * (1 - (visW * visH) / (cv.width * cv.height))).toFixed(1),
      inkLostPct: +(100 * inkOut / (totalInk || 1)).toFixed(1),
      keptInkDensityPct: +(100 * inkIn / (nIn || 1)).toFixed(1),
      // THE READ-BACK · a file whose "ink" is 0% or 100% everywhere was not measured, it was
      // mis-thresholded, and its 0.0 would read as a perfect score (Rule 80).
      trustworthy: totalInk > 0 && inkIn / (nIn || 1) < 0.98,
    })
  }

  if (rows.length === 0) {
    return { measured: false, ok: false, reason: `no card art decoded · looked for ${list.length} ids`, missing, cards: [] }
  }
  const untrustworthy = rows.filter(r => !r.trustworthy).map(r => r.id)
  const sorted = [...rows].sort((a, b) => a.inkLostPct - b.inkLostPct)
  const worst = sorted[sorted.length - 1]
  return {
    measured: untrustworthy.length === 0,
    reason: untrustworthy.length ? `these files could not be thresholded: ${untrustworthy.join(', ')}` : null,
    cardsMeasured: rows.length,
    missing,
    median: sorted[Math.floor(sorted.length / 2)].inkLostPct,
    worst: { id: worst.id, inkLostPct: worst.inkLostPct },
    areaLostPct: rows[0].areaLostPct,
    cards: rows,
  }
}

export default { inkLoss }
