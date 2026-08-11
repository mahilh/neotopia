import { describe, it, expect, afterEach } from 'vitest'
import probe, { inkLoss } from './card-art-probe.mjs'

// ── The card-art probe, tested rather than trusted ───────────────────────────────────────────────
// This measures the number the whole card-art decision turns on: objectFit:cover discards 23.1% of
// the AREA of every master, and only 1.8% of the INK, because the art is centre-composed. Those two
// figures imply opposite actions · regenerate 56 masters, or ship a gate · so the measurement is
// load-bearing and it had better not be able to lie.
//
// jsdom has no compositor, so the SAMPLING cannot run here (Rule 78's corollary, again: the
// measurement lives in a browser and the decision it produced is pinned in a unit test). What jsdom
// can hold is the two ways this function could report a confident nothing, and whether it survives
// being serialised into a page.

const ORIGINAL_IMAGE = globalThis.Image

afterEach(() => { globalThis.Image = ORIGINAL_IMAGE })

// An Image that always 404s · which is what every card looks like from a test runner with no server.
const failingImage = () => {
  globalThis.Image = class {
    set src(_v) { queueMicrotask(() => this.onerror && this.onerror(new Error('404'))) }
  }
}
// An Image that "loads" but decodes to nothing · the broken-image case, which is the dangerous one
// because it looks like a success everywhere except naturalWidth.
const emptyImage = () => {
  globalThis.Image = class {
    naturalWidth = 0
    naturalHeight = 0
    set src(_v) { queueMicrotask(() => this.onload && this.onload()) }
  }
}

describe('it reports UNMEASURED rather than a clean score', () => {
  // WRITTEN FIRST (Rule 90), and it is the same counterweight the reachability probe needed, for the
  // same reason: this one's output is a PERCENTAGE, and the failure mode of a percentage is that
  // zero looks like the best possible answer. If no art decodes, "0% of the ink was lost" is true
  // and worthless, and a gate asserting `worst < 20` would pass forever on a broken art pipeline.
  it('says so when nothing decoded, instead of scoring 0% loss', async () => {
    failingImage()
    const r = await inkLoss({ ids: ['card_01', 'card_02'] })
    expect(r.measured, 'a run that decoded no art must never read as measured').toBe(false)
    expect(r.reason).toMatch(/no card art decoded/i)
    expect(r.cards).toEqual([])
    expect(r.missing).toEqual(['card_01', 'card_02'])
    expect(r.worst, 'there must be no score to accidentally assert on').toBeUndefined()
  })

  it('counts a decoded-but-empty image as MISSING, not as a perfect card', async () => {
    // The broken-image case: complete fires, naturalWidth is 0. Treating that as a card measures a
    // 0x0 canvas and reports 0% ink lost · the exact shape of a counter resting at a plausible zero.
    emptyImage()
    const r = await inkLoss({ ids: ['card_01'] })
    expect(r.measured).toBe(false)
    expect(r.missing).toEqual(['card_01'])
  })

  it('names every id it could not decode, so a partial run is not silently partial', async () => {
    failingImage()
    const r = await inkLoss({ count: 5 })
    expect(r.missing).toEqual(['card_01', 'card_02', 'card_03', 'card_04', 'card_05'])
  })
})

describe('it can cross into a page', () => {
  it('is self-contained · no module-scope reference survives serialisation', () => {
    // page.evaluate serialises the FUNCTION and re-creates it inside the page, so a free variable
    // from this module arrives undefined there and throws only in the browser it exists to drive.
    // T3 found exactly this defect in seedPlayedBoard, which I shipped without this test · the
    // reachability probe had it and the seeder did not, because I applied the guard to one member
    // of a class and then grew the class.
    const rebuilt = new Function(`return (${inkLoss.toString()})`)()
    expect(typeof rebuilt).toBe('function')
    failingImage()
    return rebuilt({ ids: ['card_01'] }).then((r) => {
      expect(r.measured).toBe(false)
      expect(r.missing).toEqual(['card_01'])
    })
  })

  it('takes only serialisable options · a function option would arrive as undefined', () => {
    const src = inkLoss.toString()
    const defaults = src.slice(src.indexOf('{'), src.indexOf('} = {}') + 1)
    expect(defaults).not.toMatch(/=>\s*[^,\n]*\(/)
  })

  it('is on the default export, where a caller will look for it', () => {
    expect(probe.inkLoss).toBe(inkLoss)
  })
})

describe('the measurement it produced, pinned', () => {
  // These are the numbers from the browser run over ALL 56 masters (T1 S43). They are recorded here
  // rather than asserted against pixels, because the assertion that CAN run lives in T3's card-art
  // E2E where a canvas exists. What this holds is the shape of the claim, so the bound in that gate
  // has a stated provenance instead of being a number somebody liked.
  const MEASURED = { cards: 56, areaLostPct: 23.1, median: 1.8, worst: { id: 'card_37', pct: 13.2 } }

  it('sizes the gate from the data rather than from taste (Rule 88c)', () => {
    // S42 measured 20 files and found card_15 worst at 10.9. T2 then shipped the other 36, and the
    // worst case MOVED: card_37 at 13.2. The median improved (2.2 -> 0.9 for the new 36), so the
    // conclusion held while its extremum did not · which is Rule 87 for the second time on this
    // exact quantity. A 20% bound is 52% of headroom over the measured max and still fires long
    // before the 23.1% area figure would.
    const BOUND = 20
    expect(MEASURED.worst.pct).toBeLessThan(BOUND)
    expect(BOUND - MEASURED.worst.pct, 'headroom over the measured worst case').toBeGreaterThan(5)
    expect(BOUND).toBeLessThan(MEASURED.areaLostPct)
  })

  it('keeps the two quantities distinct · this is the whole finding', () => {
    // 23.1% of the area is 1.8% of the picture. Conflating them is what nearly bought a 56-master
    // regeneration (Rule 96).
    expect(MEASURED.areaLostPct / MEASURED.median).toBeGreaterThan(10)
  })
})
