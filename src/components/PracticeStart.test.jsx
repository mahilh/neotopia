import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import PracticeStart, { BOT_OPPONENTS_READY, OPPONENT_CHOICES } from './PracticeStart'

afterEach(cleanup)

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// Arriving alone is the only broken path in the product and it is what nearly everyone does. This is
// the entry point that finally gives that person somewhere to go. The thing worth guarding is not
// that the buttons render · it is that this component NEVER OFFERS SOMETHING THAT DOES NOT WORK.
// Bot seats are T2's and are not wired yet; a selector that looks live and then hands the player an
// empty board is the same broken promise as the Start button that could never enable.
//
// NAMING THE FALSE CASE FIRST (the harness lesson all three terminals learned in one session): for
// each assertion below, the failing shape is written down before the passing one. "Absent" and
// "present but disabled" are different states and are checked as different states · my S31 harness
// reported success because absent is falsy, and that is the mistake this file is written against.

const start = (props = {}) => {
  const onStart = vi.fn()
  render(<PracticeStart onStart={onStart} {...props} />)
  return onStart
}

describe('PracticeStart · the door for somebody who arrived alone', () => {
  it('offers every opponent count the product intends to have', () => {
    start()
    // FALSE CASE: a missing option renders nothing and queryBy returns null · so each is fetched by
    // its own testid rather than counted, and a count alone would pass on four copies of one button.
    for (const c of OPPONENT_CHOICES) {
      expect(screen.getByTestId(`practice-bots-${c.bots}`), `bots=${c.bots} must be offered`).toBeTruthy()
    }
    expect(OPPONENT_CHOICES.map(c => c.bots)).toEqual([0, 1, 2, 3])
  })

  it('does not let a player pick an opponent count that is not wired yet', () => {
    start()
    for (const c of OPPONENT_CHOICES) {
      const btn = screen.getByTestId(`practice-bots-${c.bots}`)
      const shouldWork = c.bots === 0 || BOT_OPPONENTS_READY
      // FALSE CASE: `btn.disabled` on a button that was never rendered throws, and on a live button
      // reads false · both are distinguishable from the assertion being made here.
      expect(btn.disabled, `bots=${c.bots} enabled state`).toBe(!shouldWork)
    }
  })

  it('starts on a choice that actually works, so the primary button is never dead on arrival', () => {
    // A default pointing at a disabled option would rebuild the exact wall this component exists to
    // remove: a button you can see, cannot use, and are given no reason for.
    start()
    const selected = OPPONENT_CHOICES
      .map(c => screen.getByTestId(`practice-bots-${c.bots}`))
      .filter(b => b.getAttribute('data-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0].disabled, 'the pre-selected option must be usable').toBe(false)
  })

  it('hands the chosen count to the caller', () => {
    const onStart = start()
    fireEvent.click(screen.getByTestId('practice-start-btn'))
    expect(onStart).toHaveBeenCalledTimes(1)
    const [bots] = onStart.mock.calls[0]
    expect(Number.isInteger(bots)).toBe(true)
    expect(bots).toBeGreaterThanOrEqual(0)
    expect(bots).toBeLessThanOrEqual(3)
  })

  it('a disabled count cannot be selected by clicking it', () => {
    // fireEvent.click on a disabled button does not fire onClick, but the guard is in the handler too
    // (`enabled && setBots`) · asserting the RESULT rather than the mechanism means either one alone
    // failing is caught.
    const onStart = start()
    const three = screen.getByTestId('practice-bots-3')
    fireEvent.click(three)
    fireEvent.click(screen.getByTestId('practice-start-btn'))
    if (!BOT_OPPONENTS_READY) expect(onStart).toHaveBeenCalledWith(0)
  })

  it('says why the missing counts are missing, instead of leaving grey rectangles', () => {
    start()
    const detail = screen.getByTestId('practice-detail').textContent
    if (!BOT_OPPONENTS_READY) {
      expect(detail, 'the player is told bots are coming and what works now').toMatch(/bot/i)
      expect(detail).toMatch(/exploration|ready now/i)
    } else {
      expect(detail).toBeTruthy()
    }
  })

  it('never speaks the language of rooms', () => {
    // The zero-sign-in constraint means practice is not a room. If this component ever grows a code,
    // an invite or a Start-gate word, the constraint has been lost somewhere upstream.
    const { container } = render(<PracticeStart onStart={() => {}} />)
    expect(container.textContent).not.toMatch(/room code|invite|waiting for|host\b/i)
  })
})
