import { useEffect, useRef } from 'react'

// MODAL DIALOG BEHAVIOUR · ESCAPE AND A FOCUS TRAP (T1 S55).
//
// Two dialogs in this product claim `role="dialog"` and neither behaved like one. T3 measured it
// rather than reading the markup (S53/S54) and put the two findings on the merge gate as REQUIREMENTS
// rather than descriptions, so the fix cannot land unwitnessed:
//   · Escape did not close the tutorial · the markup already said aria-modal="true", so the promise
//     was made and not kept. For a keyboard user with no focus trap either, Escape was the only way
//     out that a dialog is supposed to offer.
//   · Tab walked straight out of the dialog into the page behind it · a keyboard user lands on
//     controls they cannot see, behind an opaque overlay, with no route back.
// A third dialog nobody had counted: FinalScore, the screen every finished game lands on.
//
// ONE IMPLEMENTATION, NOT THREE. A focus trap re-derived per component is a second rules engine
// (Rule 45), and this project has paid for that repeatedly. It is also why the trap has to be
// defended harder than any single copy would be (Rule 94): consolidating removes the second witness
// as well as the duplicate, so a bug here is wrong in every dialog at once, silently.
//
// ── THE FAILURE THE REQUIREMENT TEST CANNOT SEE, NAMED BEFORE TRUSTING IT ────────────────────────
// The gate presses Tab eight times and asserts focus never left the dialog. That assertion is
// satisfied PERFECTLY by a dialog containing nothing focusable at all · focus cannot leave because
// it can never move, and a keyboard user is then trapped in a modal with no reachable control and no
// Escape. "Focus never escaped" and "the user is stuck" produce identical measurements.
// So the empty case is handled explicitly and asserted separately: with no focusable children the
// trap does NOT engage, and Escape remains available. A trap is only safe where there is something
// to trap focus ON.
//
// Rule 76: the handler lives in a ref and the effect depends on VALUES (two booleans), so a caller
// re-rendering every second · which this app does, for the turn countdown · cannot tear the listener
// down and rebuild it, and cannot cancel it mid-flight.

// Focusable, in DOM order, excluding anything the browser would skip anyway. `disabled` and
// `[hidden]` matter here: the tutorial's own Next button is disabled on the last step, and a trap
// that cycles onto a disabled control strands the user just as effectively as one that lets go.
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

// ⚠ VISIBILITY IS DELIBERATELY ATTRIBUTE-BASED, AND THE FIRST DRAFT GOT THIS WRONG. It filtered on
// `el.offsetParent !== null` with a comment claiming that "behaves the same in jsdom as in a
// browser". It does not · offsetParent is a LAYOUT property and jsdom has no layout, so it returned
// null for every control and this function returned an empty list, which silently turned the trap
// off in every test. My own claim about a composed behaviour, unchecked, in the file I wrote to fix
// somebody else's unchecked claim (Rule 116).
// So: attributes only. `hidden` and `aria-hidden` are honoured because they are what this codebase
// actually uses to hide things (the Offer collapse, the tutorial steps), and a control hidden by CSS
// alone inside an open dialog is not a case this product produces. The browser gate on the merge
// path is what covers real visibility · this half is the DECISION, and it is decidable here.
export const focusableWithin = (root) => {
  if (!root) return []
  return [...root.querySelectorAll(FOCUSABLE)].filter(el =>
    !el.hasAttribute('hidden') &&
    !el.closest('[hidden]') &&
    el.getAttribute('aria-hidden') !== 'true')
}

/**
 * @param {object}   opts
 * @param {object}   opts.ref       ref to the dialog element
 * @param {boolean}  opts.active    whether the dialog is open
 * @param {Function} [opts.onEscape] called on Escape · omit to leave Escape alone (FinalScore has no
 *                                   non-destructive dismissal, so it deliberately passes nothing)
 * @param {boolean}  [opts.autoFocus=true] move focus into the dialog on open
 */
export function useDialogA11y({ ref, active, onEscape, autoFocus = true }) {
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape

  useEffect(() => {
    if (!active) return
    const node = ref?.current
    if (!node) return

    // Remember where focus was so it can be handed back · a dialog that dumps focus on <body> when
    // it closes leaves a keyboard user at the top of the document with no idea where they were.
    const previous = document.activeElement

    if (autoFocus) {
      const first = focusableWithin(node)[0]
      if (first) first.focus()
      else if (typeof node.focus === 'function') {
        // Nothing to focus inside · make the dialog itself the target so the user is at least
        // ANNOUNCED into it rather than left outside with an opaque overlay in the way.
        if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')
        node.focus()
      }
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (escapeRef.current) { e.preventDefault(); escapeRef.current() }
        return
      }
      if (e.key !== 'Tab') return
      const items = focusableWithin(node)
      // THE EMPTY CASE · do not engage. See the header: a trap with nothing to trap is
      // indistinguishable from a working one under the gate, and strictly worse for the user.
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      // Focus outside the dialog entirely (it was moved, or the dialog opened without autoFocus):
      // pull it back rather than letting the wrap arithmetic decide.
      if (!node.contains(current)) { e.preventDefault(); first.focus(); return }
      if (e.shiftKey && current === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && current === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus()
    }
  }, [active, autoFocus, ref])
}

export default useDialogA11y
