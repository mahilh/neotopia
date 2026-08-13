// THE WALLET READOUT · driven with the feature ON, because a suite that only runs in the default
// configuration tests the default (T2's Rule 135, one week old, applied in my lane).
//
// ── WHY THIS FILE NEEDS NO MOCK, WHICH IS THE POINT ──────────────────────────────────────────────
// ActionBar takes `wallet` as a PROP, not from the flag. So the enabled engine is reachable by
// passing a number, and every assertion here drives the real component in the real state · no
// vi.mock, nothing that can silently fail to take effect (Rule 135a's hazard removed rather than
// guarded). GameRoom.wallet.test.jsx is where the FLAG is exercised, and it needs the mock.
//
// ── THE ARITHMETIC THESE ASSERTIONS DEFEND ───────────────────────────────────────────────────────
// Measured at HEAD, Chromium, 320px, live game: 298.1px of demand into a 296px content box, so the
// bar is ALREADY 2.1px over and already two rows (End Turn alone on the second, at x=12). Adding a
// 46px readout + 10px gap makes it 354.1; deleting the three action dots returns 64 and lands at
// 290.1 · one row, 5.9px spare. Deleting the numeral instead returns 26 and does not.
// So the swap is not a style choice, and these tests exist because the two halves must move
// TOGETHER: a build where both render is 64px over and wraps, and a build where neither does has
// lost the action count entirely.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ActionBar from './ActionBar'
import { formatMoney, MONEY_SLOT_PX, MONEY_STRING_PX, reachableBalances } from '../utils/formatMoney'

afterEach(() => cleanup())

const dots = () => screen.queryByTestId('action-dots')
const readout = () => screen.queryByTestId('wallet-readout')

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the readout is switchable, and both states are real', () => {
  it('with no wallet the bar is byte-identical to S66 · dots present, no readout', async () => {
    // THE SHIPPED STATE. WALLET_ENABLED is false in gameConfig, so GameRoom passes null and this is
    // what every player sees today. If this ever fails, the flag stopped gating the UI.
    render(<ActionBar wallet={null} actionsRemaining={2} />)
    expect(dots(), 'the action dots are gone with no wallet to replace them · the swap fired without ' +
      'anything to swap in, and the bar lost information for free').not.toBeNull()
    expect(readout(), 'a wallet readout with no wallet').toBeNull()
  })

  it('and a wallet turns it ON · otherwise the absence above proves nothing', async () => {
    // Rule 120 · the positive control has to exercise the same mechanism in the same file, or "no
    // readout" is indistinguishable from "the readout never renders under any circumstances".
    render(<ActionBar wallet={930_000_000} actionsRemaining={2} />)
    expect(readout(), 'a balance was passed and nothing renders it').not.toBeNull()
    expect(readout().textContent).toContain('$930M')
  })

  it('the swap is EXCLUSIVE · never both, never neither', async () => {
    // The defining property (Rule 110), and the one the header's arithmetic rests on. Both present
    // is 64px over a bar that is already 2.1px over; neither is an action counter with no counter.
    for (const w of [null, 0, 70_000_000, 1_000_000_000]) {
      cleanup()
      render(<ActionBar wallet={w} actionsRemaining={1} />)
      const hasDots = !!dots(), hasMoney = !!readout()
      expect(hasDots !== hasMoney, `wallet=${w} · dots ${hasDots} and readout ${hasMoney} · the two ` +
        'halves of the swap moved independently').toBe(true)
    }
  })

  it('the ACTION COUNT survives the swap · a duplicate was deleted, not the information', async () => {
    // The whole justification for taking the dots is that the numeral says the same integer. If the
    // numeral ever goes too, this stops being a de-duplication and becomes a removal.
    render(<ActionBar wallet={930_000_000} actionsRemaining={2} />)
    expect(dots()).toBeNull()
    expect(screen.getByTestId('actions-left').textContent.trim(),
      'the action count vanished with the dots · nothing on the bar says how many actions remain').toBe('2')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE WIDTH BOUND · the named failure this design is built against
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the slot is fixed over the WHOLE reachable domain, not sized at the starting balance', () => {
  it('every reachable balance renders into the same 46px slot', async () => {
    // NAMED FAILURE: a readout whose width depends on its value. $1.00B and $70M differ by 9.5px and
    // the bar has 5.9px of slack, so a width sized at the starting balance would be correct on turn
    // one and overflow after the first purchase · at a value no fresh fixture ever visits. That is
    // the same defect as S64's per-character title budget and S66's 4px of strip padding, and it
    // would have been the third.
    const domain = reachableBalances()
    expect(domain.length, 'the reachable domain collapsed · the bound below is over nothing').toBeGreaterThan(5)
    for (const b of domain) {
      cleanup()
      render(<ActionBar wallet={b} actionsRemaining={3} />)
      const el = readout()
      expect(el, `balance ${b} renders no readout`).not.toBeNull()
      expect(el.style.width, `balance ${b} sizes its own slot · the bar's width is a function of the ` +
        'balance and can wrap mid-game').toBe(`${MONEY_SLOT_PX}px`)
    }
  })

  it('and every string it can emit has a MEASURED width under that slot', async () => {
    // Rule 96b · gate the PREMISE, not the conclusion. jsdom has no layout, so this cannot measure
    // px; what it can do is assert that the formatter never emits a string nobody measured. If T2
    // retunes STARTING_WALLET or CARD_PRICE the domain moves, an unmeasured string appears, and this
    // reds with a precise alarm and a provisional remedy (Rule 98a): re-run the Chromium probe.
    const emitted = [...new Set(reachableBalances().map(formatMoney))]
    const unmeasured = emitted.filter(s => !(s in MONEY_STRING_PX))
    expect(unmeasured, `the formatter emits ${JSON.stringify(unmeasured)}, which has no measured ` +
      'width · re-measure in the action bar font before trusting the 46px slot').toEqual([])
    expect(Math.max(...emitted.map(s => MONEY_STRING_PX[s])),
      'the widest reachable string does not fit its own slot').toBeLessThanOrEqual(MONEY_SLOT_PX)
  })

  it('refuses a balance it cannot render rather than printing a plausible number', async () => {
    // Rule 80. NaN formatted as "$NaNM" in a 46px slot is a number-shaped thing a player would read
    // as a balance. No readout at all is the honest state, and the dots come back with it.
    for (const bad of [NaN, Infinity, undefined]) {
      cleanup()
      render(<ActionBar wallet={bad} actionsRemaining={3} />)
      expect(readout(), `wallet=${bad} rendered a readout`).toBeNull()
      expect(dots(), `wallet=${bad} took the dots without giving anything back`).not.toBeNull()
    }
  })
})

describe('the readout says what it is', () => {
  it('carries the raw balance as data, so a probe never has to parse the display string', async () => {
    render(<ActionBar wallet={860_000_000} actionsRemaining={3} />)
    expect(readout().getAttribute('data-wallet')).toBe('860000000')
    expect(readout().textContent).toContain(formatMoney(860_000_000))
  })

  it('is labelled for a screen reader at ZERO width', async () => {
    // It sits between two other bare numbers on this bar (seconds left, actions left). The `$` is
    // the visible label and costs 8.3px, which is why the format keeps it; the sr-only word is the
    // spoken one and costs nothing. NOT a live region · see the component comment.
    render(<ActionBar wallet={510_000_000} actionsRemaining={3} />)
    const sr = readout().querySelector('.sr-only')
    expect(sr, 'the readout announces as a bare number · "$510M" beside "3" and "89s" with nothing ' +
      'to say which is which').not.toBeNull()
    expect(sr.textContent.toLowerCase()).toContain('wallet')
  })
})
