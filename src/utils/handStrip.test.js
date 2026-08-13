// THE CARD BUDGET IS A CURVE · gated across it, not at the one point I happened to measure.
//
// ── THE DEFECT THIS REPLACES ─────────────────────────────────────────────────────────────────────
// S65 built the hand strip and measured it at 320. S66 found ONE fully-visible card at 768, 1280 and
// 1440 · worse than a phone · because the strip carried 4px of horizontal padding sized from that
// single 320 measurement. The desktop sidebar is a 256px content box and two cards need 248, so 4px
// each side left 248 against 248 (Rule 78b · "exactly fits" is where a control leaves the screen).
//
// ── THE SWEEP THAT WOULD HAVE CAUGHT IT (T1 S67 · Chromium, one run, real layout) ────────────────
//     viewport   strip clientW   pad   gap   cardW   fullyVisible   model   agrees
//        320            288      0/0     8     120         2          2      yes
//        375            343      0/0     8     120         2          2      yes
//        414            382      0/0     8     120         3          3      yes
//        768            255      0/0     8     120         2          2      yes
//       1280            255      0/0     8     120         2          2      yes
//       1440            255      0/0     8     120         2          2      yes
//   6 of 6 graded, 6 of 6 agree.
//
// TWO THINGS IN THAT TABLE ARE NOT VISIBLE FROM ANY SINGLE WIDTH, which is the argument for the
// sweep rather than for a better constant:
//   · the budget is NOT monotonic in the viewport · 414 fits THREE and 1440 fits two
//   · the desktop sidebar is 255px at 768 AND at 1440 · it is the NARROWEST strip in the product,
//     narrower than a 375 phone, and no amount of screen makes it wider. S66's defect was one
//     instance of that; the shape is permanent until somebody decides the sidebar should grow.
//
// ⚠ AND THE MODEL IS A SECOND CONTRACT (Rule 45). Flexbox does the layout; nothing in the product
// calls this. It earns its place ONLY from the agreement column above, and if it ever disagrees with
// a browser the browser is right. That is why the sweep is quoted here with its numbers rather than
// cited as "verified" (Rule 97 · a citation outlives the thing it cites).
import { describe, it, expect } from 'vitest'
import { handCardBudget, handStripWidthFor } from './handStrip'
import { CARD_SIZES } from '../components/CardFrame'

// The shipped parameters, taken from the component that owns them rather than retyped. Rule 92a:
// a check whose two sides come from the same source cannot fail · so cardW comes from CardFrame,
// and the gap/padding are pinned against the real rendered strip in GameRoom.hand.test.jsx.
const CARD_W = CARD_SIZES.hand.width
const GAP = 8
const SHIPPED = { cardW: CARD_W, gap: GAP, padX: 0 }

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90). Each one is a way this could be present and say nothing.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · this is a function of the container, not a constant wearing a signature', () => {
  it('returns MORE THAN ONE distinct answer across the widths the product actually renders', () => {
    // THE DEFINING PROPERTY, and the one nobody writes down because it is what "function" MEANS
    // (Rule 110). `return 2` satisfies every expectation below except this: the measured sweep is
    // 2/2/3/2/2/2, so a constant would be right at five of six widths and wrong at the interesting
    // one. A budget that cannot vary is the constant I already shipped twice.
    const answers = [288, 343, 382, 255].map(w => handCardBudget({ containerW: w, ...SHIPPED }))
    expect(new Set(answers).size,
      'the budget returns the same number at every width · it is a constant, which is the exact ' +
      'defect this file exists to make impossible').toBeGreaterThan(1)
    expect(answers).toEqual([2, 2, 3, 2])
  })

  it('REPRODUCES the S66 defect · the fixture is the only witness left, because the fix removed it', () => {
    // Rule 112b: a fix can turn the real world into an environment where the defect is no longer
    // reproducible, and then the fixture is not belt-and-braces, it is the whole proof. The strip
    // carries padX 0 today, so reverting nothing in the repo can show this any more.
    const desktop = 255
    expect(handCardBudget({ containerW: desktop, ...SHIPPED }), 'the shipped strip').toBe(2)
    expect(handCardBudget({ containerW: desktop, cardW: CARD_W, gap: GAP, padX: 4 }),
      '4px of horizontal padding does NOT cost the second card at the desktop sidebar width · then ' +
      'the S66 measurement (fullyVisible 1 at 768/1280/1440) had some other cause and this whole ' +
      'model is aimed at the wrong term').toBe(1)
  })

  it('REFUSES on input it cannot answer from, rather than returning a plausible zero', () => {
    // Rule 80. `cardW: 0` returning 0 would read as "the strip is too narrow"; it means "nobody told
    // me how wide a card is". Two different findings, one number, and the wrong one is comfortable.
    expect(() => handCardBudget({ containerW: 288, cardW: 0, gap: GAP })).toThrow(/cardW/)
    expect(() => handCardBudget({ containerW: 288, cardW: NaN, gap: GAP })).toThrow(/cardW/)
    expect(() => handCardBudget({ containerW: NaN, cardW: CARD_W, gap: GAP })).toThrow(/containerW/)
    expect(() => handCardBudget({ containerW: 288, cardW: CARD_W, gap: -1 })).toThrow(/gap/)
    expect(() => handCardBudget({ containerW: 288, cardW: CARD_W, gap: GAP, padX: -1 })).toThrow(/padX/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CURVE
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the budget across every width the product renders', () => {
  // Container widths MEASURED in Chromium (the table in the header), not derived from the viewport ·
  // the strip's width is composed from the sheet/sidebar layout and a source read cannot produce it
  // (Rule 116).
  it.each([
    [320, 288, 2, 'phone sheet'],
    [375, 343, 2, 'phone sheet'],
    [414, 382, 3, 'phone sheet · the widest strip in the product'],
    [768, 255, 2, 'desktop sidebar'],
    [1280, 255, 2, 'desktop sidebar'],
    [1440, 255, 2, 'desktop sidebar · no wider than at 768'],
  ])('viewport %i · strip %ipx · %i cards fully visible (%s)', (_vp, containerW, expected) => {
    expect(handCardBudget({ containerW, ...SHIPPED })).toBe(expected)
  })

  it('the boundary is EXACT, and `<` versus `<=` differs only there', () => {
    // Rule 135's boundary lesson. Two cards need exactly 248; at 247 the second is clipped. Getting
    // the comparison wrong makes the last width that fits the one width that does not, and every
    // other width in the table agrees either way · so no other case can catch it.
    const two = handStripWidthFor(2, SHIPPED)
    expect(two).toBe(248)
    expect(handCardBudget({ containerW: two, ...SHIPPED }), 'exactly 248 does not fit two cards').toBe(2)
    expect(handCardBudget({ containerW: two - 1, ...SHIPPED }), '247 fits two cards · off by one').toBe(1)
    expect(handCardBudget({ containerW: CARD_W, ...SHIPPED }), 'one card exactly').toBe(1)
    expect(handCardBudget({ containerW: CARD_W - 1, ...SHIPPED }), 'narrower than one card').toBe(0)
  })

  it('never claims more cards than the hand holds', () => {
    // A budget is an upper bound from the container AND from the hand. At 1440 with two cards in
    // hand the answer is two, not "the sidebar could take two".
    expect(handCardBudget({ containerW: 1000, ...SHIPPED, cards: 3 })).toBe(3)
    expect(handCardBudget({ containerW: 1000, ...SHIPPED, cards: 0 })).toBe(0)
  })

  it('the inverse is the sentence worth writing in a review', () => {
    // "Two cards need 248" is the form that would have caught S66 before it shipped, because it is
    // comparable against a container width at a glance. The two functions must agree by
    // construction, and this is the assertion that keeps them agreeing.
    for (const n of [1, 2, 3, 4]) {
      const w = handStripWidthFor(n, SHIPPED)
      expect(handCardBudget({ containerW: w, ...SHIPPED }), `${n} cards need ${w}px`).toBe(n)
      expect(handCardBudget({ containerW: w - 1, ...SHIPPED }), `${w - 1}px must NOT fit ${n}`).toBe(n - 1)
    }
  })

  it('padding is charged on BOTH sides · the term S66 got wrong', () => {
    expect(handStripWidthFor(2, { cardW: CARD_W, gap: GAP, padX: 4 })).toBe(256)
    expect(handCardBudget({ containerW: 256, cardW: CARD_W, gap: GAP, padX: 4 })).toBe(2)
    expect(handCardBudget({ containerW: 255, cardW: CARD_W, gap: GAP, padX: 4 })).toBe(1)
  })
})
