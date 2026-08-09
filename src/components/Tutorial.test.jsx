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

const placementStep = () => {
  render(<Tutorial onDismiss={() => {}} />)
  // Step 0 is the turn structure; step 1 is placement. fireEvent (not node.click) so React commits
  // the state change inside act.
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
  // The BODY PARAGRAPH ONLY, and it has to be selected rather than assumed. An early version walked
  // .closest('div') and picked up the whole dialog including the diagram caption · which contained the
  // words being asserted, so it passed against the exact broken copy it exists to catch. Then S30 gave
  // the diagram a step labelled "Click a factory token", so a bare getByText started matching two
  // nodes. Both failures are the same one: the scope has to be stated, not inferred (Rule 72).
  const body = screen.getAllByText(/factory token/i).find(el => el.tagName === 'P')
  expect(body, 'expected exactly one body <p> naming the factory token').toBeDefined()
  return body.textContent ?? ''
}

// Each assertion below was checked against the OLD broken copy and only kept if it actually failed
// there. Loose ones like /element/i and /region/i were dropped: the old text happened to contain both
// words incidentally ("An element leaves the factory", "in the adjacent region") while still teaching
// the wrong flow, so they discriminated nothing.
describe('Tutorial · the placement step teaches the flow the game actually has', () => {
  it('sends the player to the panel for the two choices the old copy skipped', () => {
    const body = placementStep()
    expect(body, 'the step must still start at the factory').toMatch(/factory/i)
    // The single thing the old copy never did: point at where the next two choices live. Without this
    // the player is looking at the board for a response that is happening in the side panel.
    expect(body, 'must send the player to the panel · this is the step nobody finds').toMatch(/panel/i)
  })

  it('says WHICH hexes can be clicked, and that placing still waits on the element', () => {
    const body = placementStep()
    // S30 changed what is true here. Clicking a hex straight after the factory now DOES something · it
    // aims · but only the previewed ones, and it still does not place. So the copy has two jobs it did
    // not have before: name the dashed preview so the player knows which hexes are live, and keep the
    // placing click distinct from the aiming one. "any empty hex" satisfies neither.
    expect(body, 'must name the dashed preview · that is how a player tells a live hex from a dead one')
      .toMatch(/dashed/i)
    expect(body, 'placing still happens on a lit hex, after the element is chosen')
      .toMatch(/light|lit /i)
  })
})
