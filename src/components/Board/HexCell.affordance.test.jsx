// THE BOARD'S STATE HIERARCHY · WHAT WEIGHT EACH STATE ACTUALLY GETS (T1 S51).
//
// ⚠ THIS FILE EXISTS BECAUSE I GOT THIS WRONG AND THE WRONG VERSION BECAME A SESSION BRIEF.
// I closed S50 recommending that "the emphasis hierarchy is inverted against actionability · the
// legal target gets 0.5, the thinnest stroke on the board, while three informational states get
// 2-5x the weight." That is FALSE, and it arrived back as this session's P1, which is Rule 108
// exactly: a closing recommendation is the claim nobody checks, and it becomes the next priority.
//
// HOW IT WAS WRONG, and it is the more useful part: a hex is a STACK of polygons · base, bevel,
// then a state ring drawn over them · and BOTH of my instruments looked only at the first one.
//   · the source read stopped at `HexCell.jsx:52`, which is the BASE polygon's width
//   · the browser probe used `g.querySelector('polygon')`, which returns that same base polygon
// So a source read and a live measurement agreed with each other, and they agreed because they
// were the same reading twice (Rule 92 · a check whose two sides come from one source cannot fail).
// `HexCell.jsx:126` draws the valid target its own ring at strokeWidth 2, pulsing. It was always
// there. Nothing measured it because nothing enumerated the stack.
//
// ── THE FAILURE THIS MEASUREMENT CANNOT SEE, NAMED BEFORE TRUSTING IT ─────────────────────────────
// 1 · MEASURING THE WRONG POLYGON. That is not a hypothetical here, it is the documented history of
//     this exact question. So the reader below enumerates EVERY polygon in the cell, and a state
//     that is supposed to carry a ring must be observed to have more than one · a stack of one is
//     reported as a defect, not silently averaged away.
// 2 · A STATE THAT NEVER OCCURS IN THE FIXTURE. If `completionCandidate` were never produced, the
//     hierarchy would be computed over the states that happened to render and would look complete.
//     So every state is asserted to have been OBSERVED before any comparison between them is made.
//     Zero cells of a state is UNMEASURED, never "that state is light" (Rule 80).

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import GameBoard from './GameBoard'
import { REGIONS, hexesInRadius } from '../../utils/hexUtils'

afterEach(cleanup)

const R = REGIONS[0]
const ring = hexesInRadius(R.cq, R.cr, R.radius)
const at = (i) => ({ q: ring[i].q, r: ring[i].r })

// One board carrying every state at once, so they are compared in the SAME render rather than
// across renders that could differ for reasons nobody wrote down.
const FIXTURE = {
  validTarget:         at(0),
  reachablePreview:    at(1),
  completionCandidate: at(2),
  patternMatch:        at(3),   // occupied · part of a complete pattern
  partialMatch:        at(4),   // occupied · near-miss
  occupiedPlain:       at(5),
  emptyPlain:          at(6),
}
const key = (h) => `${h.q},${h.r}`

const mount = () => {
  const regions = REGIONS.map(reg => ({ ...reg, hexes: {} }))
  for (const n of ['patternMatch', 'partialMatch', 'occupiedPlain']) {
    regions[0].hexes[key(FIXTURE[n])] = { element: 'energy', placedBy: 0 }
  }
  const { container } = render(
    <GameBoard
      regions={regions}
      validTargets={[FIXTURE.validTarget]}
      reachableTargets={[{ ...FIXTURE.reachablePreview, regionId: 0 }]}
      completionCandidates={[FIXTURE.completionCandidate]}
      patternHighlight={[FIXTURE.patternMatch]}
      partialHighlight={[FIXTURE.partialMatch]}
    />
  )
  return container.querySelector('svg[role="img"]')
}

// EVERY polygon in the cell, not the first one. This is the whole correction.
const strokesOf = (svg, hex) => {
  const cells = [...svg.querySelectorAll('g.hex-cell')]
  // Cells are rendered per region in hexesInRadius order; match on the rendered points instead of
  // an index, so a reordering upstream cannot silently re-point this at a different hex.
  const target = cells.find(g => g.getAttribute('data-hex') === key(hex))
    ?? cells[ring.findIndex(h => h.q === hex.q && h.r === hex.r)]
  if (!target) return null
  const polys = [...target.querySelectorAll('polygon')]
  return {
    n: polys.length,
    widths: polys.map(p => Number(p.getAttribute('stroke-width') ?? 0))
      .filter(w => Number.isFinite(w) && w > 0),
    dashed: polys.some(p => !!p.getAttribute('stroke-dasharray')),
  }
}

const table = () => {
  const svg = mount()
  const out = {}
  for (const [name, hex] of Object.entries(FIXTURE)) {
    const s = strokesOf(svg, hex)
    out[name] = s ? { ...s, max: s.widths.length ? Math.max(...s.widths) : 0 } : null
  }
  return out
}

// ── COUNTERWEIGHTS FIRST (Rule 90) ───────────────────────────────────────────────────────────────

describe('the reader enumerates the STACK · the defect that produced the false claim', () => {
  it('every state was actually observed · a missing state is UNMEASURED, not "light"', () => {
    const t = table()
    for (const [name, s] of Object.entries(t)) {
      expect(s, `${name} produced no cell · every comparison below would be over a partial set`)
        .toBeTruthy()
      expect(s.widths.length, `${name} rendered no stroked polygon at all`).toBeGreaterThan(0)
    }
  })

  it('a state with a ring has MORE THAN ONE stroked polygon · reading only the base is the bug', () => {
    const t = table()
    // These four draw a dedicated ring over the base. If any reports a single stroked polygon, the
    // reader has fallen back to the base-only view that produced the S50 claim.
    for (const name of ['validTarget', 'reachablePreview', 'completionCandidate', 'patternMatch']) {
      expect(t[name].widths.length,
        `${name} shows ${t[name].widths.length} stroked polygon(s) · this reader is looking at the ` +
        'base only, which is exactly how "the legal target is 0.5" was concluded').toBeGreaterThan(1)
    }
    // And the base really is 0.5 on an empty cell · so the base reading was not wrong, it was
    // incomplete, which is the harder kind to notice.
    expect(t.emptyPlain.max).toBe(0.5)
  })
})

// ── THE CLAIM · AND IT IS THE OPPOSITE OF WHAT I RECOMMENDED ─────────────────────────────────────

describe('the actionable states are the heaviest · the S50 recommendation was false', () => {
  it('a legal target outweighs every informational state', () => {
    const t = table()
    // "you may tap this hex right now" vs the three states that only tell you something.
    expect(t.validTarget.max).toBeGreaterThan(t.partialMatch.max)   // near-miss · amber
    expect(t.validTarget.max).toBeGreaterThan(t.patternMatch.max)   // complete pattern · green
    expect(t.validTarget.max).toBeGreaterThan(t.occupiedPlain.max)
    expect(t.validTarget.max).toBeGreaterThan(t.emptyPlain.max)
  })

  it('and the ONE hex that scores outweighs a merely-legal one', () => {
    const t = table()
    // completionCandidate is "place here and you score THIS turn" · strictly more urgent than
    // "this is a legal square", and it is drawn that way.
    expect(t.completionCandidate.max).toBeGreaterThan(t.validTarget.max)
  })

  it('a preview hex is NOT drawn as a live target · same weight, different pattern, on purpose', () => {
    const t = table()
    // Documented at HexCell.jsx:106 · a hex that can be AIMED at but cannot take a token this
    // instant must not make the promise the old tutorial made. It is separated by DASH, not weight,
    // and that is a deliberate choice rather than an oversight · pinned so nobody "fixes" it.
    expect(t.reachablePreview.dashed).toBe(true)
    expect(t.validTarget.dashed).toBe(false)
  })
})

// ── THE SIGNALS ARE PINNED TO PIXELS · THE VARIANCE NOBODY CHOSE (T1 S51) ────────────────────────
// A stroke-width in USER UNITS is multiplied by the board's scale, and this board's scale is not a
// constant · it is 0.358 on an idle 320x568 phone and 1.308 on a focused 375x667 one, because S50's
// region focus changed the viewBox per state. MEASURED, rendered px, before this change:
//     patternMatch  "your pattern is COMPLETE, score it"   0.54px on a 320x568 phone
//     partialMatch  "you are close"                        0.36px
//     validTarget   "tap here now"                         1.17px (768) .. 2.62px (375) · 2.24x
// So the signal that says a card is scorable renders at half a pixel on the smallest phone, and the
// legal-target ring varies by more than a factor of two depending on a viewport the player did not
// choose. `vector-effect="non-scaling-stroke"` pins each ring to its authored width in CSS px, at
// every scale and every state.
// ⚠ SCOPE IS DELIBERATE: only the state RINGS, never the base polygon or the bevel. The base carries
// the terrain grid, and pinning that would change the texture of all 57 cells to fix 6. Verified by
// screenshot at the measured phone scale · the rings become legible and the board is otherwise
// pixel-identical.
describe('every state ring is pinned to pixels · and a NEW ring cannot be added unpinned', () => {
  it('enumerates · every stroked ring is non-scaling, the base is not', () => {
    const svg = mount()
    const unpinnedRings = []
    const pinnedBases = []
    for (const g of svg.querySelectorAll('g.hex-cell')) {
      for (const p of g.querySelectorAll('polygon')) {
        if (!p.getAttribute('stroke-width')) continue
        // A RING is a stroked polygon with no fill · that is what every state signal is, and it is a
        // property of the element rather than a name in a list, so a ring added next session is
        // classified by this rule automatically (Rule 100 · the tell is a guard whose subject is a
        // NAME rather than a SET).
        const isRing = (p.getAttribute('fill') ?? '') === 'none'
        const pinned = p.getAttribute('vector-effect') === 'non-scaling-stroke'
        const id = `${g.getAttribute('data-hex')} sw=${p.getAttribute('stroke-width')}`
        if (isRing && !pinned) unpinnedRings.push(id)
        if (!isRing && pinned) pinnedBases.push(id)
      }
    }
    expect(unpinnedRings, 'a state ring in user units renders sub-pixel on a phone · ' +
      'patternMatch measured 0.54px at 320x568 before this was pinned').toEqual([])
    expect(pinnedBases, 'the BASE polygon must stay scale-proportional · it is the terrain grid, ' +
      'and pinning it changes all 57 cells to fix 6').toEqual([])
  })

  it('counterweight · the check actually found rings to check', () => {
    // The assertions above are both "expect([]) " · they pass perfectly if the loop found nothing.
    // That is the vacuity this project keeps meeting (Rule 80 · zero is the pass value).
    const svg = mount()
    const rings = [...svg.querySelectorAll('g.hex-cell polygon')]
      .filter(p => p.getAttribute('stroke-width') && (p.getAttribute('fill') ?? '') === 'none')
    expect(rings.length, 'no rings found at all · both assertions above are vacuous').toBeGreaterThan(4)
    expect(rings.every(p => p.getAttribute('vector-effect') === 'non-scaling-stroke')).toBe(true)
    // and bases exist too, so the second assertion is not vacuous either
    const bases = [...svg.querySelectorAll('g.hex-cell polygon')]
      .filter(p => p.getAttribute('stroke-width') && (p.getAttribute('fill') ?? '') !== 'none')
    expect(bases.length, 'no base polygons found · the pinnedBases assertion is vacuous')
      .toBeGreaterThan(10)
  })
})

