import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import Tutorial from './Tutorial'

afterEach(cleanup)

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// The placement step of this overlay described a two-click interaction ("click a factory, then click
// any empty hex") for something that takes four. Following it literally strands the player: after the
// factory click NO hex is highlighted, because the game is waiting to be told which element and which
// region. This overlay is the whole reason the game is playable by a stranger, and it was teaching a
// flow that does not exist.
//
// Driving the real UI at 375px and 1280px (T1 S29) confirmed the interaction itself is fine and every
// control is on screen · only the instructions were wrong. So the regression to guard is textual: a
// future edit that shortens this back to factory-then-hex.

// SCOPE STATED, NOT INFERRED (Rule 72). An early version walked .closest('div') and picked up the
// whole dialog including the diagram caption · which contained the words being asserted, so it
// passed against the exact broken copy it exists to catch.
// S50 moved the four taps out of the paragraph and into an <ol data-testid="tutorial-taps">, so the
// step's instruction text is now the paragraph PLUS that list. Both are read here, and the list is
// required to exist · reading only the <p> would have silently started asserting against a third of
// the step, which is a vacuity of exactly the kind the note above is about.
const placementText = () => {
  render(<Tutorial onDismiss={() => {}} />)
  // Step 0 is the turn structure; step 1 is placement. fireEvent (not node.click) so React commits
  // the state change inside act.
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
  const list = screen.getByTestId('tutorial-taps')
  const body = [...document.querySelectorAll('p')].find(p => /four taps/i.test(p.textContent))
  expect(body, 'expected the placement body paragraph').toBeDefined()
  expect(list.querySelectorAll('li').length, 'the tap list is empty · every assertion below would ' +
    'be reading a third of the step').toBeGreaterThan(0)
  return `${body.textContent} ${list.textContent}`
}

// Each assertion below was checked against the OLD broken copy and only kept if it actually failed
// there. Loose ones like /element/i and /region/i were dropped: the old text happened to contain both
// words incidentally ("An element leaves the factory", "in the adjacent region") while still teaching
// the wrong flow, so they discriminated nothing.
// ── ⚠ TWO TESTS WERE REMOVED FROM HERE IN T1 S50, AND THE REASON IS THE ARGUMENT FOR WHAT REPLACED
//    THEM (Rule 101 · a fix's blast radius includes the tests that documented what it fixed).
// They asserted that the body paragraph contained /dashed/ and /light|lit/, pinning S30's aim-first
// copy: "click a factory · the board marks reachable hexes with a dashed outline · click the one you
// want · then pick an element · the hex lights up · click it to place."
// S50 replaced that copy, for two measured reasons (see PLACEMENT_TAPS in Tutorial.jsx): it tells a
// first-timer to tap a hex TWICE, and on a phone the hex it points at is behind the bottom sheet in
// exactly the phase it describes · 27 of 60 board cells covered at 320. So both assertions became
// claims about text that should not be there.
// THEY WERE NOT REWRITTEN, THEY WERE DELETED, because Tutorial.flow.test.jsx now CLICKS the sequence
// against a real GameRoom and requires each tap to advance the phase. A regex over a paragraph is
// strictly weaker than executing it, and keeping both would be a second witness that agrees today
// and drifts silently later (Rule 94 · Rule 95's reconcile-by-subtraction). What survives here is
// the one thing that file does not hold: that the step still points at the PANEL, which is the
// single thing the original S8 copy never did and the reason a playtest reached turn 17 with an
// empty board.
describe('Tutorial · the placement step still sends the player to the panel', () => {
  it('names the panel · two of the four taps happen there and nowhere else', () => {
    const text = placementText()
    expect(text, 'the step must still start at the factory').toMatch(/factory/i)
    // Without this the player watches the BOARD for a response that is happening in the panel · the
    // original failure, and the one this overlay was built for.
    expect(text, 'must send the player to the panel · this is the step nobody finds').toMatch(/panel/i)
    expect(text, 'and it must still name the region step').toMatch(/region/i)
  })
})
