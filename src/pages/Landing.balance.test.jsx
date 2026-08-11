// THE "HOW IT WORKS" SECTION SHOWS THE GAME NOW · AND BALANCE IS NOT A THIRD MECHANIC (T1 S48).
//
// Two changes, one test file, because they are the same argument. The section used to be three
// paragraphs and three equal cards: PLACE, SCORE, BALANCE. The first two are mechanics · what you do
// on your turn · and the animation above now teaches both far better than a card can. BALANCE is not
// a third thing to do at all; it is the reason the first two are hard, and at identical width,
// padding, border and type it read as one more item on a list.
//
// THE PART THAT MUST NOT ROT: the panel's numbers come from demoFinalScore(), which calls
// patternMatcher.calculateFinalScore. The landing page therefore cannot state a scoring rule the
// engine has stopped implementing (Rule 97 · a citation outlives the thing it cites). It is also the
// reduced-motion fallback for the animation's fourth beat, which is why the demo deliberately does
// NOT render its own balance overlay under `prefers-reduced-motion` · two renderings of one formula,
// one of which is always available.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { calculateFinalScore } from '../lib/patternMatcher'
import { demoFinalScore, DEMO_SCORES, GOLD } from '../components/HowItWorksDemo'

vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
}))

const Landing = (await import('./Landing')).default
const mount = () => render(<MemoryRouter><Landing /></MemoryRouter>)
afterEach(cleanup)

describe('the BALANCE panel', () => {
  it('states the engine\'s formula, not a copy of it', () => {
    mount()
    const s = demoFinalScore()
    const line = screen.getByTestId('balance-formula')
    // Read from the engine at assert time · if calculateFinalScore changes, this moves with it.
    expect(s.total).toBe(calculateFinalScore(DEMO_SCORES))
    expect(line).toHaveTextContent(`${s.best} + ${s.second} + (${s.worst} × 3) = ${s.total}`)
  })

  it('is NOT a peer of the two mechanic cards any more', () => {
    mount()
    const panel = screen.getByTestId('balance-panel')
    // It carries the section's gold rule, which nothing else in the row does. Compared against the
    // EXPORTED constant rather than a retyped hex · a test that holds its own copy of the value it
    // is checking cannot fail (Rule 92a). jsdom serialises to rgb(), so normalise both sides.
    const toRgb = (hex) => {
      const n = parseInt(hex.slice(1), 16)
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
    }
    expect(panel.style.borderLeftColor).toBe(toRgb(GOLD))
    expect(parseInt(panel.style.borderLeftWidth, 10)).toBeGreaterThan(1)
    // And the row above it now holds exactly the two mechanics.
    const cardRow = panel.previousElementSibling
    expect(cardRow.children).toHaveLength(2)
    expect(cardRow.textContent).toContain('PLACE')
    expect(cardRow.textContent).toContain('SCORE')
    expect(cardRow.textContent).not.toContain('BALANCE')
  })

  it('says the multiplication out loud, in the panel that owns the argument', () => {
    mount()
    expect(within(screen.getByTestId('balance-panel')).getByText(/multiplied by three/i))
      .toBeInTheDocument()
  })
})

describe('the animation is mounted above the prose', () => {
  it('the demo comes BEFORE the explanatory paragraphs in document order', () => {
    mount()
    const demo = screen.getByTestId('hiw-demo')
    const section = document.getElementById('how-it-works')
    const prose = within(section).getByText(/hexagonal strategy game set in the year 2055/i)
    // Node.DOCUMENT_POSITION_FOLLOWING === 4 · show first, explain second.
    expect(demo.compareDocumentPosition(prose) & 4).toBeTruthy()
  })
})
