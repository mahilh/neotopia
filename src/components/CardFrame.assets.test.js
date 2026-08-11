import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_CARDS } from '../lib/projectCards'
import { artSlot } from './CardFrame'

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// S28 measured the card art costing 4.41 MB for one /game screen: 1254x1254 masters served into a box
// that renders at 104x80 css px. S29 resampled all 20 to 320x320 and the per-card cost fell 10.7x.
//
// That fix is a one-off unless something guards it. 36 cards still have no art, and the natural way to
// add one is to drop the generated master straight into public/art/cards/ · which silently restores the
// exact problem, one card at a time, with nothing going red. This is that guard (Rule 63 · gate what is
// actually true, and Rule 45 · the filesystem is a second contract the code depends on).
//
// It reads the real directory rather than a manifest, so it cannot drift from what ships.

const ART_DIR = path.resolve(__dirname, '../../public/art/cards')

// CardFrame renders art into 104x80 css px at size="hand" (the only size the game uses today). A dpr3
// display needs 312 device px across. 384 leaves headroom for a future size="full" (202 css) at dpr2
// without licensing a return to multi-megabyte masters.
const MAX_EDGE_PX = 384
const MAX_BYTES = 250 * 1024

// PNG stores width/height as two big-endian uint32 at offset 16 in the IHDR chunk, right after the
// 8-byte signature and the chunk length/type. No image library needed to read it.
function pngSize(file) {
  const buf = fs.readFileSync(file)
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (!isPng) return { isPng: false }
  return { isPng: true, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length }
}

const files = fs.existsSync(ART_DIR) ? fs.readdirSync(ART_DIR).filter(f => f.endsWith('.png')).sort() : []

describe('card art assets are sized for the box they render into', () => {
  it('has art to check at all', () => {
    // A guard that silently passes on an empty directory would be worse than no guard (Rule 72 ·
    // running a verifier proves it executed, not that its verdict means anything).
    expect(files.length, `no PNGs found in ${ART_DIR}`).toBeGreaterThan(0)
  })

  it.each(files)('%s is a real PNG no larger than the render needs', (name) => {
    const { isPng, width, height, bytes } = pngSize(path.join(ART_DIR, name))
    expect(isPng, `${name} is not a PNG · CardFrame builds /art/cards/<id>.png and nothing converts it`).toBe(true)
    expect(Math.max(width, height),
      `${name} is ${width}x${height}. Card art renders at 104x80 css (312 device px at dpr3), so anything ` +
      `over ${MAX_EDGE_PX}px is pixels no player can see. Resample it: sips -Z 320 ${name} --out ${name}`,
    ).toBeLessThanOrEqual(MAX_EDGE_PX)
    expect(bytes,
      `${name} is ${(bytes / 1024).toFixed(0)}KB. The S29 pipeline lands cards at about 140KB; over ` +
      `${MAX_BYTES / 1024}KB means it was not resampled.`,
    ).toBeLessThanOrEqual(MAX_BYTES)
  })

  it('every art file belongs to a card that actually exists in the deck', () => {
    // A PNG for a card id the deck does not contain is weight nobody can ever see.
    const ids = new Set(PROJECT_CARDS.map(c => c.id))
    const orphans = files.map(f => f.replace(/\.png$/, '')).filter(id => !ids.has(id))
    expect(orphans, `art files with no matching card: ${orphans.join(', ')}`).toEqual([])
  })

  it.each(files)('%s is SQUARE · the crop budget depends on it', (name) => {
    // T1 S42. Nothing checked the masters' SHAPE, only their size and weight · and shape is what
    // decides how much of the picture a player never sees. The slot is 104x80 (1.30:1) and every
    // existing master is 320x320, so objectFit:cover discards 23.1% of the area. I measured what
    // that actually costs by sampling all 20 in a browser canvas against each file's own background:
    // a MEDIAN of 2.1% of the card's ink, max 10.9 (card_15), because the art is centre-composed.
    // 23.1% of the area is 2.1% of the picture, and that is why this is a gate rather than a
    // regeneration ticket.
    // BUT THE CONCLUSION IS ONLY AS GOOD AS THE PREMISE, and 36 cards have no art yet. A 16:9 master
    // dropped in here loses 42% of its area with nothing going red, and nobody would look again.
    const { width, height } = pngSize(path.join(ART_DIR, name))
    expect(width / height,
      `${name} is ${width}x${height}. Card art is generated square and the 104x80 slot crops it ` +
      `centrally · that budget was measured on square masters (2.1% of ink, median). A different ` +
      `aspect changes how much of the picture is discarded, so either regenerate this square or ` +
      `re-measure the crop before changing this gate.`,
    ).toBeCloseTo(1, 2)
  })

  it('states the crop the slot imposes, from the component rather than from memory', () => {
    // The two sides of this check are genuinely two (Rule 92): the ART comes off the filesystem and
    // the SLOT comes out of CardFrame. Retyping 104x80 here would be a check comparing a constant to
    // its own copy · which is the exact defect that let a nudge-fix pass in S41.
    const slot = artSlot('hand')
    expect(slot).toEqual({ width: 104, height: 80 })
    const shown = (slot.width / slot.height)
    // cover from a 1:1 master · scale to the wider axis, discard the overflow on the other.
    const areaKept = (slot.width * slot.height) / (slot.width * slot.width)
    expect(+(100 * (1 - areaKept)).toFixed(1),
      'the measured crop · if this moves, the 2.1%-of-ink finding needs re-measuring').toBe(23.1)
    expect(shown).toBeGreaterThan(1) // the slot is landscape; the masters are not
  })

  it('keeps a whole /game screen under a megabyte of art', () => {
    // The screen shows 7 CardFrames (3 hand + 4 offer). The honest worst case is the 7 heaviest files,
    // because a shuffle can deal exactly those. S28 baseline for the same 7: 10.29 MB.
    const heaviest = files
      .map(f => fs.statSync(path.join(ART_DIR, f)).size)
      .sort((a, b) => b - a)
      .slice(0, 7)
      .reduce((a, b) => a + b, 0)
    expect(heaviest / 1e6, `worst-case 7-card screen is ${(heaviest / 1e6).toFixed(2)} MB`).toBeLessThan(1.5)
  })
})
