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
import fs from 'node:fs'
import path from 'node:path'
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE OTHER TERM IN THE SAME ARITHMETIC · the gaps between the three groups
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the sub-480 column gap is 8, and it is a term in the demand above', () => {
  it('is declared at 8px, because 10 leaves the bar on two rows with NO readout at all', async () => {
    // The 290.1 in this file's header is `113 + gap + 70.6 + gap + 85.1` · so the gap is not
    // decoration, it is 2 of the ~5 terms. Swept in Chromium before the edit, and the boundary is
    // exactly between 9 and 8:
    //     gap 10 -> 2 rows, bar 72.5, board 586.0, End Turn at x=12   (the shipped state until S67)
    //     gap  9 -> 2 rows, bar 72.5, board 586.0, End Turn at x=12
    //     gap  8 -> 1 row,  bar 64.0, board 594.5, End Turn at x=222.9
    //
    // AND THE ONE ROW IS SCOPED TO ONE STRING. Demand is `237.1 + statusW` and 296 buys 58.9, so:
    // "Your turn" 57.0 fits with 1.9 to spare, "Waiting for Ana" 94.7 does not, and every longer
    // name wraps as it already did (measured to 232.3px; End Turn never left the viewport). The
    // margin is structural rather than lucky · "Your turn" is a LITERAL in ActionBar.jsx and cannot
    // vary with user data, which is exactly why the assertion below is worth having.
    //
    // ⚠ SCOPE, stated because a source read cannot answer a composed question (Rule 116): this
    // gates the DECLARATION, not the computed value. Lightning CSS owns index.css and may rewrite
    // it, and jsdom has no layout, so the row count and the 8.5px of board are the browser numbers
    // above and are not re-established here. What this catches is the realistic failure · someone
    // tidying the gap back to a round 10 with nothing to say the bar wraps again.
    const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')
    // THREE separate `max-width: 479px` blocks exist and only one carries `.action-bar` · my first
    // version took the FIRST match and reported "no column-gap declared" against a file that
    // declares one, which is a probe answering a question adjacent to mine (Rule 97's corollary).
    // Select by CONTENT, never by position.
    const blocks = [...css.matchAll(/@media \(max-width: 479px\)\s*\{[\s\S]*?\n\}/g)].map(m => m[0])
    expect(blocks.length, 'no sub-480 media block at all').toBeGreaterThan(0)
    const block = [blocks.find(b => b.includes('.action-bar'))]
    expect(block[0], 'no sub-480 block mentions .action-bar · the bar\'s padding and gap moved ' +
      'somewhere this cannot see, and every number in this file\'s header is unanchored').toBeDefined()
    const gap = block[0].match(/\.action-bar\s*\{[^}]*column-gap:\s*(\d+)px/)
    expect(gap, 'the action bar declares no column-gap below 480 · the browser default is 0, which ' +
      'happens to fit, but nothing says so on purpose').not.toBeNull()
    expect(Number(gap[1]),
      `column-gap is ${gap?.[1]}px below 480 · measured, anything above 8 puts the bar on two rows ` +
      'at 320 and costs 8.5px of board, with End Turn alone on the second row at the LEFT edge')
      .toBeLessThanOrEqual(8)
    // and the padding it is paired with, since the content box (296) is the other side of the sum
    const pad = block[0].match(/\.action-bar\s*\{[^}]*padding:\s*0\s+(\d+)px/)
    expect(Number(pad?.[1]), 'the sub-480 side padding moved · 296 was 320 - 2x12').toBe(12)
  })

  it('the string the one-row case depends on is a LITERAL, not user data', async () => {
    // The 1.9px of margin belongs to "Your turn" and to nothing else. If that ever becomes a
    // template · a name, a role, a translated phrase of unknown length · the margin stops being a
    // property of the code and becomes a property of whoever is playing, and the row silently goes
    // back to two. Rule 96b: gate the PREMISE, not the conclusion.
    const src = fs.readFileSync(path.resolve(__dirname, './ActionBar.jsx'), 'utf8')
    expect(src, 'the fixed turn label is gone · re-measure the bar, because the one-row result at ' +
      '320 rests entirely on that string being 57.0px and unable to vary').toContain("'Your turn'")
    // and the case that DOES vary is still allowed to wrap · flex-wrap is the net, not the bug
    expect(src.match(/flexWrap:\s*'wrap'/), 'the action bar no longer wraps · a long opponent name ' +
      'now overflows instead of taking a second row, which is Rule 78b with a control off screen')
      .not.toBeNull()
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
