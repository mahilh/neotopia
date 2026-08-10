import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ActionBar from './ActionBar'

afterEach(cleanup)

// ── End Turn has to stay on the screen, whatever the player is holding ───────────────────────────
// Rule 78b, fixed at its source. MEASURED in a real browser at a 320px viewport: the bar's three
// groups want 440px against a 292px content box, and flex has always coped by SHRINKING them, which
// is why End Turn sat at 300 and on screen. Bonus tokens are the case shrinking cannot absorb ·
// four of them put End Turn's right edge at 587, i.e. 267px off the side of the phone. That is not
// cosmetic. A player who cannot reach End Turn cannot play, and auto-end-turn only rescues the case
// where they have no actions left.
//
// It has never happened because nothing can grant a token yet (T2 S37: both granters read data that
// nothing seeds). It goes live the day the bonus-hex data lands, which is why it is fixed first.
//
// jsdom has no layout, so it cannot re-measure any of that · the browser did, and the numbers are in
// the commit. What jsdom CAN hold is the decision that produced those numbers, and the property that
// makes it safe: the bar wraps if and only if it is carrying tokens, so the case every player is in
// today is untouched.

const bar = () => document.querySelector('footer')

describe('the action bar cannot lose End Turn', () => {
  it('does not wrap when there are no tokens · every game played today is unchanged', () => {
    render(<ActionBar bonusTokens={[]} />)
    expect(bar().style.flexWrap, 'wrapping with nothing to wrap costs 25px of board on every phone').toBe('nowrap')
    expect(bar().style.padding).toBe('0px 20px')
    expect(screen.getByTestId('end-turn-btn')).toBeTruthy()
  })

  it('wraps as soon as a single token exists', () => {
    render(<ActionBar bonusTokens={['automatization']} />)
    // FALSE CASE, and the shipped one: nowrap, so the row overflows and End Turn leaves the screen
    // to the right · present in the DOM, correctly sized, and unreachable.
    expect(bar().style.flexWrap).toBe('wrap')
  })

  it('lets the token strip itself wrap · four tokens plus End Turn do not fit one row either', () => {
    // Wrapping the right group as a single unit is not enough: four tokens and End Turn are about
    // 380 units on their own, wider than a 320px phone. The fix has to reach the strip.
    render(<ActionBar bonusTokens={['automatization', 'subsidy', 'initiative', 'permits']} />)
    const strip = screen.getByTestId('end-turn-btn').parentElement
    expect(strip.style.flexWrap, 'the right group must be able to break').toBe('wrap')
    const tokens = [...bar().querySelectorAll('span[title]')]
    expect(tokens, 'four tokens must actually render for this to mean anything').toHaveLength(4)
    expect(tokens[0].parentElement.style.flexWrap, 'the token strip must be able to break too').toBe('wrap')
  })

  it('never mixes the gap shorthand with rowGap · React drops one of them', () => {
    // Not style pedantry: this exact pair logged a React warning in the live console while the fix
    // was being written, and the failure mode of a dropped gap is a layout that is subtly wrong
    // rather than one that errors.
    for (const tokens of [[], ['subsidy']]) {
      cleanup()
      render(<ActionBar bonusTokens={tokens} />)
      expect(bar().style.gap, 'use columnGap + rowGap, never gap + rowGap').toBe('')
      expect(bar().style.columnGap).not.toBe('')
      expect(bar().style.rowGap).not.toBe('')
    }
  })
})
