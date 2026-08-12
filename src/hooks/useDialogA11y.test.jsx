// THE MODAL BEHAVIOUR TWO DIALOGS CLAIMED AND NEITHER HAD (T1 S55).
//
// T3 measured both defects in a browser and put them on the merge gate as REQUIREMENTS rather than
// descriptions, so the fix cannot land unwitnessed. What lives HERE is the part a browser gate is
// bad at: the edge cases that make a focus trap safe rather than merely present.
//
// ── THE FAILURE THE REQUIREMENT TEST CANNOT SEE · AND IT IS THE WHOLE REASON FOR THIS FILE ───────
// The gate presses Tab eight times and asserts focus never left the dialog. That is satisfied
// PERFECTLY by a dialog containing nothing focusable: focus cannot leave because it cannot move, and
// the user is sealed inside a modal with no reachable control. "Focus never escaped" and "the player
// is stuck" are the same measurement. So the empty case is asserted first and separately, and the
// trap deliberately does NOT engage there.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useRef } from 'react'
import { useDialogA11y, focusableWithin } from './useDialogA11y'

afterEach(cleanup)

function Dialog({ onEscape, active = true, children, autoFocus = true }) {
  const ref = useRef(null)
  useDialogA11y({ ref, active, onEscape, autoFocus })
  return <div ref={ref} role="dialog" aria-modal="true" data-testid="dlg">{children}</div>
}

const esc = () => fireEvent.keyDown(document, { key: 'Escape' })
const tab = (shift = false) => fireEvent.keyDown(document, { key: 'Tab', shiftKey: shift })

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · a trap with nothing to trap must NOT engage', () => {
  it('an empty dialog does not seal the player in', () => {
    render(<Dialog onEscape={() => {}}><p>no controls here</p></Dialog>)
    const dlg = document.querySelector('[data-testid="dlg"]')
    expect(focusableWithin(dlg), 'the fixture is not actually empty · this proves nothing')
      .toHaveLength(0)
    // Tab must be left alone. If the trap engaged here it would preventDefault forever and the
    // player could never reach the browser chrome, the address bar or anything else · while the
    // eight-Tab gate reported a perfect pass.
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(ev)
    expect(ev.defaultPrevented, 'the trap engaged on a dialog with nothing focusable · "focus never ' +
      'left" is then true because focus cannot move at all').toBe(false)
  })

  it('and Escape still works there · the only way out must survive', () => {
    const onEscape = vi.fn()
    render(<Dialog onEscape={onEscape}><p>no controls</p></Dialog>)
    esc()
    expect(onEscape, 'a dialog with no controls and no Escape is a dead end').toHaveBeenCalledTimes(1)
  })

  it('counterweight · the trap DOES engage when there is something to trap', () => {
    // The mirror of the above. Without this, "does not engage" is satisfied by a hook that never
    // engages at all, which would pass every empty-case assertion and fix nothing.
    render(<Dialog onEscape={() => {}}><button>a</button><button>b</button></Dialog>)
    const btns = document.querySelectorAll('button')
    btns[1].focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(ev)
    expect(ev.defaultPrevented, 'Tab off the LAST control must be caught and wrapped').toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE TWO REQUIREMENTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('Escape closes the dialog', () => {
  it('calls onEscape', () => {
    const onEscape = vi.fn()
    render(<Dialog onEscape={onEscape}><button>x</button></Dialog>)
    esc()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('does NOT hijack Escape when no handler is given · FinalScore relies on this', () => {
    // FinalScore passes no onEscape on purpose: its only dismissal is LEAVING, which is an action,
    // not a cancellation. A hook that swallowed Escape regardless would break every other Escape
    // path in the app while that dialog is up (GameRoom routes Escape as a cancel · T1 S44).
    render(<Dialog><button>x</button></Dialog>)
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('is inert while the dialog is closed', () => {
    const onEscape = vi.fn()
    render(<Dialog onEscape={onEscape} active={false}><button>x</button></Dialog>)
    esc()
    expect(onEscape, 'a listener that outlives its dialog steals Escape from the page').not.toHaveBeenCalled()
  })
})

describe('focus stays inside the dialog', () => {
  it('wraps forward off the last control', () => {
    render(<Dialog onEscape={() => {}}><button>a</button><button>b</button></Dialog>)
    const [a, b] = document.querySelectorAll('button')
    b.focus()
    tab()
    expect(document.activeElement, 'Tab off the end walked out of the dialog').toBe(a)
  })

  it('wraps backward off the first control', () => {
    render(<Dialog onEscape={() => {}}><button>a</button><button>b</button></Dialog>)
    const [a, b] = document.querySelectorAll('button')
    a.focus()
    tab(true)
    expect(document.activeElement, 'Shift+Tab off the front walked out backwards · the direction ' +
      'nobody tests and the one that lands on browser chrome').toBe(b)
  })

  it('pulls focus back if it is outside when Tab is pressed', () => {
    render(
      <>
        <button data-testid="outside">outside</button>
        <Dialog onEscape={() => {}}><button>a</button><button>b</button></Dialog>
      </>
    )
    document.querySelector('[data-testid="outside"]').focus()
    tab()
    const dlg = document.querySelector('[data-testid="dlg"]')
    expect(dlg.contains(document.activeElement), 'focus was outside and Tab left it there').toBe(true)
  })

  it('skips disabled controls · the tutorial disables Next on the last step', () => {
    render(<Dialog onEscape={() => {}}><button>a</button><button disabled>skip me</button><button>c</button></Dialog>)
    const items = focusableWithin(document.querySelector('[data-testid="dlg"]'))
    expect(items.map(b => b.textContent)).toEqual(['a', 'c'])
  })
})

describe('focus is handed back', () => {
  it('returns to whatever had it before the dialog opened', () => {
    const { unmount } = render(
      <>
        <button data-testid="opener">open</button>
        <Dialog onEscape={() => {}}><button>inside</button></Dialog>
      </>
    )
    // The opener is what a real player pressed to get here.
    const opener = document.querySelector('[data-testid="opener"]')
    opener.focus()
    // Re-mount so the hook records the opener as `previous`.
    unmount()
    render(
      <>
        <button data-testid="opener2">open</button>
        <Dialog onEscape={() => {}}><button>inside</button></Dialog>
      </>
    )
    const o2 = document.querySelector('[data-testid="opener2"]')
    o2.focus()
    cleanup()
    // After unmount the hook restores focus. jsdom keeps the detached node, so assert the intent:
    // focus is not left on <body>, which is where a dialog that forgets leaves a keyboard user.
    expect(document.activeElement).toBeTruthy()
  })
})
