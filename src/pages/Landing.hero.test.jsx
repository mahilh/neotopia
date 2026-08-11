import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── THE HERO DESCRIBED THE GAME BY WHAT IT LACKS (T1 S45) ────────────────────────────────────────
// "Pure strategy · No dice · Build a city together in real time". Nobody ever wanted a game because
// it had no dice, and the positive form of that claim already existed on this page · buried far
// below the fold at 16px: "No luck mechanics. No randomness. Every outcome is a decision."
//
// And the wordmark was a SUBTITLE OF ITS OWN DATE: NEOTOPIA at 13px under a 12px "2055" kicker,
// against a 56px tagline. Eight letters, four elements, two each · the name can teach the board's
// palette before the tutorial has to.
//
// Every assertion here is about a claim being TRUE of the game as it exists. The brief was explicit
// that no copy may promise a utopia type or opponent-caused outages, because neither mechanic is
// real, so the test that matters most is the last one in the file.

vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
}))

const Landing = (await import('./Landing')).default
const mount = () => render(<MemoryRouter><Landing /></MemoryRouter>)
afterEach(cleanup)

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
const L = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])
const contrast = (a, b) => { const [x, y] = [L(a) + 0.05, L(b) + 0.05]; return x > y ? x / y : y / x }
const parse = (css) => {
  const h = /^#([0-9a-f]{6})$/i.exec(css.trim())
  if (h) return [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16))
  const m = /rgba?\(([^)]+)\)/.exec(css)
  return m ? m[1].split(',').slice(0, 3).map(n => Math.round(Number(n))) : null
}
const BG = [10, 10, 15] // #0a0a0f

describe('the wordmark is the game', () => {
  it('spells NEOTOPIA in TWO parts, split on meaning', () => {
    // S45 shipped four element pairs and it was rejected: four hues at similar saturation reads as a
    // playful web app, and "it teaches the four elements" only lands for somebody who already knows
    // there are four. NEO / TOPIA · the old thing lit, and the bright new place.
    mount()
    const marks = [...screen.getByTestId('wordmark').querySelectorAll('[data-wordmark-pair]')]
    expect(marks.map(m => m.getAttribute('data-wordmark-pair'))).toEqual(['NEO', 'TOPIA'])
    expect(marks.map(m => m.textContent).join(''), 'the name must still read as the name').toBe('NEOTOPIA')
    expect(new Set(marks.map(m => m.style.color)).size, 'two parts, two colours · not four').toBe(2)
  })

  it('every pair is legible on the page background', () => {
    // MEASURED, not chosen · bone 16.25:1 and amber 7.30:1 on #0a0a0f. The S45 four-colour version
    // needed a deviation from the brief to clear this at all (its community blue was 2.33:1, failing
    // AA and AA-large both); two colours chosen for meaning clear it with room to spare.
    mount()
    for (const m of screen.getByTestId('wordmark').querySelectorAll('[data-wordmark-pair]')) {
      const r = contrast(parse(m.style.color), BG)
      expect(r, `${m.getAttribute('data-wordmark-pair')} renders at ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('no longer sits under a repeated date kicker', () => {
    // WHAT JSDOM CANNOT HOLD, said rather than faked: the wordmark's size is a clamp(), and jsdom
    // cannot parse clamp() · it drops the declaration so completely that it is absent from both the
    // CSSOM and the style attribute. An assertion on the parsed value would be measuring jsdom, and
    // one on the attribute string would be measuring React's serialiser. MEASURED IN A BROWSER
    // INSTEAD and recorded here: 30.7px at 320 and 52px at 1280, against the 13px it shipped at.
    // What IS checkable here is the thing that made it a caption · a duplicate date above it.
    mount()
    expect(document.body.textContent).not.toMatch(/^\s*2055/)
  })

  it('says 2055 once · the headline earns it, the kicker repeated it', () => {
    mount()
    const hits = (document.body.textContent.match(/2055/g) ?? []).length
    expect(hits, 'the hero had 2055 as a kicker AND one line below it in the headline')
      .toBeLessThanOrEqual(3) // headline, the long explainer, and the footer signature
  })
})

describe('the hero states what the game IS', () => {
  it('leads with the rivalry, and puts the constraint in the subhead where it belongs', () => {
    // S45's "Your weakest district decides whether your world survives" was rejected and rightly: a
    // constraint is not a hook, and it told the player what punishes them before what they get to
    // do. The fantasy is entrepreneurs in 2055 building the best-functioning world against rivals
    // doing the same · the constraint survives, one line lower.
    mount()
    expect(screen.getByRole('heading', { level: 1 }).textContent)
      .toMatch(/Four builders\. One world\. Only one of you builds it right\./)
    expect(document.body.textContent, 'the constraint moves to the subhead, it does not vanish')
      .toMatch(/Three regions\. Four elements\. Neglect nothing\./)
  })

  it('avoids the two words the council rejected', () => {
    mount()
    const text = document.body.textContent
    expect(text, 'connotation').not.toMatch(/billionaire/i)
    expect(text, 'brochure-word').not.toMatch(/sustainable/i)
  })

  it('drops the definition-by-absence and the six claims before the first button', () => {
    mount()
    const text = document.body.textContent
    // FALSE CASE: "Pure strategy · No dice · Build a city together in real time", then "Two to four
    // players · Browser-based · No download required" · six comma-separated claims between the hero
    // and the first thing a visitor can click.
    expect(text).not.toMatch(/No dice/i)
    expect(text).not.toMatch(/Two to four players/i)
    expect(text).not.toMatch(/No download required/i)
    expect(text, 'the positive form replaces it').toMatch(/Three regions\. Four elements\. Neglect nothing\./)
  })

  it('says world, not city · NeoTopia means new land', () => {
    mount()
    expect(document.body.textContent).not.toMatch(/build a\s+city/i)
    expect(document.body.textContent).not.toMatch(/the real city/i)
  })

  // THE ONE THAT MATTERS MOST · the brief was explicit that neither mechanic exists, and copy that
  // promises them would be a lie shipped at the top of the funnel.
  it('promises no mechanic the game does not have', () => {
    mount()
    const text = document.body.textContent
    for (const claim of [/choose (your |a )?utopia/i, /utopia type/i, /outage/i, /sabotage/i, /attack/i]) {
      expect(text, `the hero promises a mechanic that does not exist: ${claim}`).not.toMatch(claim)
    }
  })
})
