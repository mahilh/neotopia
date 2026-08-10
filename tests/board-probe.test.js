import { describe, it, expect } from 'vitest'
import probe, { hexToPixel, hexesInRadius, contrast, luminance, ELEMENT_COLORS, REGION_META } from './board-probe.mjs'
import { hexToPixel as realHexToPixel, hexesInRadius as realHexesInRadius, REGIONS, ELEMENT_COLORS as REAL_COLORS } from '../src/utils/hexUtils'

// ── A harness nobody checks is the thing it was built to prevent ─────────────────────────────────
// board-probe.mjs exists because I rebuilt the same measurement in S34, S35 and S37 and it lied
// roughly three times per session. Committing it only helps if the fixes it encodes are pinned, so:
//
//   · the SEEDING fix is testable here in full · it is where lie #1 lived (indexing a sparse map
//     that is empty until somebody plays, placing nothing, and reporting confident numbers anyway)
//   · the GEOMETRY the probe carries is testable against the real hexUtils · the probe duplicates it
//     on purpose, so this file is the thing that stops the duplicate drifting into agreement with a
//     bug instead of catching one
//   · the RASTER fixes (intrinsic size, letterbox, un-premultiplied alpha) need a real compositor
//     and CANNOT be checked in jsdom. They are not faked here · they are verified in the browser and
//     the numbers live in the commit. Asserting them in jsdom would be a test that passes in both
//     worlds, which is exactly the failure this whole file is about.

const fakeStore = () => {
  let state = {
    regions: REGION_META.map(m => ({ id: m.id, hexes: {} })),
  }
  return {
    getState: () => state,
    setState: (patch) => { state = { ...state, ...patch } },
    peek: () => state,
  }
}

describe('the probe agrees with the board it measures', () => {
  it('computes the same hex positions as the real engine', () => {
    // The probe duplicates hexToPixel so it can be pasted into a page with no module graph. That is
    // a deliberate second contract (Rule 45), so it gets a test rather than a promise.
    for (const [q, r] of [[0, 0], [2, -1], [8, -4], [4, 5], [-2, 2], [6, 7]]) {
      expect(hexToPixel(q, r)).toEqual(realHexToPixel(q, r))
    }
  })

  it('enumerates the same cells as the real engine', () => {
    for (const m of REGION_META) {
      const mine = hexesInRadius(m.cq, m.cr, 2).map(([q, r]) => `${q},${r}`).sort()
      const real = realHexesInRadius(m.cq, m.cr, 2).map(h => `${h.q},${h.r}`).sort()
      expect(mine).toEqual(real)
    }
  })

  it('carries the real region centres and the real element palette', () => {
    // FALSE CASE: the probe drifts to a stale board · every sample then lands on empty ground and
    // every ratio it reports is a measurement of the floor.
    for (const m of REGION_META) {
      const real = REGIONS.find(r => r.id === m.id)
      expect([m.cq, m.cr], `region ${m.id} moved`).toEqual([real.cq, real.cr])
      expect(m.terrain).toBe(real.terrain)
    }
    for (const [k, rgb] of Object.entries(ELEMENT_COLORS)) {
      const hex = REAL_COLORS[k]
      expect(hex, `${k} is not an element any more`).toBeTruthy()
      const real = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
      expect(rgb, `${k} palette drifted`).toEqual(real)
    }
  })
})

describe('seeding · lie number one, closed', () => {
  it('actually places twelve tokens on a board whose hex map starts EMPTY', () => {
    const store = fakeStore()
    // This is the real shape: `hexes` is a sparse map created on placement, so there is nothing to
    // index into. The probe that indexed `Object.keys(hexes)[n]` placed NOTHING and then reported
    // contrast for twelve cells that did not exist.
    expect(Object.keys(store.getState().regions[0].hexes)).toHaveLength(0)

    const placed = probe.seedOneOfEach(store)

    expect(placed).toHaveLength(12)
    for (const reg of store.peek().regions) {
      const keys = Object.keys(reg.hexes)
      expect(keys, `region ${reg.id} got no tokens`).toHaveLength(4)
      expect(Object.values(reg.hexes).map(h => h.element).sort())
        .toEqual(['biofarming', 'community', 'energy', 'technology'])
    }
  })

  it('puts every token inside its own region', () => {
    const store = fakeStore()
    for (const p of probe.seedOneOfEach(store)) {
      const m = REGION_META.find(x => x.id === p.region)
      const inside = hexesInRadius(m.cq, m.cr, 2).some(([q, r]) => q === p.q && r === p.r)
      expect(inside, `${p.element} landed outside region ${p.region}`).toBe(true)
    }
  })

  it('stamps a seat, so cluster ownership is measurable too', () => {
    const store = fakeStore()
    probe.seedOneOfEach(store, { seat: 2 })
    for (const reg of store.peek().regions) {
      for (const h of Object.values(reg.hexes)) expect(h.placedBy).toBe(2)
    }
  })

  it('is deterministic · two runs seed the identical board', () => {
    // Rule 32. A probe with any randomness in it makes every before/after comparison unreadable.
    const a = JSON.stringify(probe.seedOneOfEach(fakeStore()))
    const b = JSON.stringify(probe.seedOneOfEach(fakeStore()))
    expect(a).toBe(b)
  })
})

describe('the colour maths', () => {
  it('matches the WCAG anchors', () => {
    expect(contrast([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1)
    expect(contrast([0, 0, 0], [0, 0, 0])).toBeCloseTo(1, 5)
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 5)
    expect(luminance([0, 0, 0])).toBeCloseTo(0, 5)
  })

  it('is symmetric · the order of the two pixels must not change the answer', () => {
    const a = [226, 75, 74], b = [10, 10, 15]
    expect(contrast(a, b)).toBeCloseTo(contrast(b, a), 10)
  })
})
