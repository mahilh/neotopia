import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'

// ── There has to be a way BACK to the rules ──────────────────────────────────────────────────────
// docs/TUTORIAL_GAP_AUDIT.md gap 9, and the only one of the nine that is structural rather than
// copy: the tutorial shows once ever per browser (localStorage `neotopia_tutorial_v1`) and
// `setShowTutorial` had exactly ONE caller · the tutorial's own dismiss handler. So a player who hit
// Skip, or who read it on turn 1 and needed it on turn 4, had no route to the rules from anywhere
// inside the game. Every other gap in that audit therefore had to land in one pass, on turn 1,
// before the player had any context to hang it on.
//
// NAMING THE FALSE CASE: this does not fail as an error. It fails as a player who cannot remember
// how to place an element and has nowhere to look · which is the exact playtest that made the
// tutorial exist (Karachi, 2 players, 17 turns, 0 points).
//
// Written at the GAME SCREEN, not against ActionBar in isolation, because the claim is "the route
// exists in the product". An ActionBar test would stay green with the prop unwired, which is the
// same vacuous shape as testing that a button can render.

const authSpy = vi.hoisted(() => vi.fn(() => ({ user: null, isLoading: false })))
vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}),
  recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: authSpy }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))
vi.mock('../hooks/useBotTurns', () => ({ useBotTurns: () => {} }))

const GameRoom = (await import('./GameRoom')).default
const KEY = 'neotopia_tutorial_v1'
const rules = () => screen.queryByRole('dialog', { name: /how to play/i })

beforeEach(() => {
  localStorage.clear()
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

const renderGame = async ({ seen = true } = {}) => {
  if (seen) localStorage.setItem(KEY, '1')
  const utils = render(<MemoryRouter><GameRoom /></MemoryRouter>)
  await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
  return utils
}

describe('the rules are reachable after the first turn', () => {
  it('re-opens the tutorial from inside a game that has already dismissed it', async () => {
    await renderGame()
    // The precondition IS the bug: this player has seen it, so nothing shows it to them again.
    expect(rules(), 'the tutorial must not be up · that is not what is being tested').toBeNull()

    fireEvent.click(screen.getByTestId('open-rules'))

    // FALSE CASE, and the shipped one: nothing happens, because setShowTutorial has no other caller.
    expect(rules(), 'there is no route back to the rules from inside the game').not.toBeNull()
    expect(screen.getByText(/three actions per turn/i)).toBeTruthy()
  })

  it('closes again, and asking a second time still works', async () => {
    await renderGame()
    fireEvent.click(screen.getByTestId('open-rules'))
    fireEvent.click(screen.getByTestId('tutorial-skip'))
    await waitFor(() => expect(rules()).toBeNull())

    // FALSE CASE: the route is a one-shot · dismiss latches something and the button goes dead.
    fireEvent.click(screen.getByTestId('open-rules'))
    expect(rules(), 'the rules opened once and then stopped opening').not.toBeNull()
  })

  it('does not make the tutorial start ambushing the player again', async () => {
    await renderGame()
    fireEvent.click(screen.getByTestId('open-rules'))
    fireEvent.click(screen.getByTestId('tutorial-skip'))
    // FALSE CASE: re-opening clears the "seen" key, so the next game opens with an unasked-for modal
    // over the board · the route back becomes a route back to being interrupted.
    expect(localStorage.getItem(KEY), 'the seen flag was lost · the first-turn overlay returns').toBe('1')
  })

  it('is reachable on somebody else\'s turn, when End Turn beside it is not', async () => {
    await renderGame()
    act(() => {
      // Two seats, and it is not ours. useGameActions gates on mySeat, so this is the "waiting"
      // screen · the one where a player has the most time to want the rules and the least to do.
      const p = useGameStore.getState().players
      useGameStore.setState({ players: [...p, { ...p[0], seat: 1, userId: 'other' }], currentSeat: 1 }, false)
    })
    const btn = screen.getByTestId('open-rules')
    expect(btn.disabled, 'the rules are readable whether or not it is your turn').toBeFalsy()
    fireEvent.click(btn)
    expect(rules()).not.toBeNull()
  })

  it('keeps the control at a real touch size', async () => {
    // Rule 4 · asserted on the inline style because jsdom has no layout to measure. This is the one
    // claim it CAN hold honestly; the rendered size is checked in the browser, not here.
    await renderGame()
    const btn = screen.getByTestId('open-rules')
    expect(btn.style.width).toBe('44px')
    expect(btn.style.height).toBe('44px')
    expect(btn.getAttribute('aria-label'), 'a bare "?" needs a name for anyone not reading the glyph').toMatch(/how to play/i)
  })

  it('stays OUT of the bottom action bar · that bar has no room and this was measured', async () => {
    // THE DECISION, kept rather than the reasoning behind it. The ActionBar is the obvious home for a
    // help control and it is the wrong one: measured in a real browser at a 320px viewport, holding
    // no bonus tokens (the state every player is in today · both award paths in gameStore are no-ops
    // until the bonus-hex data lands), that bar is exactly 320 of 320 wide with End Turn's right edge
    // at 300. Putting a 44px button in it moved End Turn to 337 · SEVENTEEN PIXELS OFF THE SCREEN.
    // That is the same defect as the practice exit fixed in this session, caused by me this time.
    // jsdom cannot re-measure that, so what it CAN hold is the decision: not in the footer.
    await renderGame()
    const footer = document.querySelector('footer')
    expect(footer, 'the action bar must exist for this assertion to mean anything').not.toBeNull()
    expect(footer.querySelector('[data-testid="open-rules"]')).toBeNull()
    expect(screen.getByTestId('end-turn-btn').closest('footer')).toBe(footer)
  })

  it('is not offered while the tutorial is already up · nothing painted under a z-500 modal', async () => {
    // A first-time player: the tutorial mounts itself. A "?" rendered underneath a full-viewport
    // overlay is a control that exists and cannot be clicked, which is the whole theme of this session.
    await renderGame({ seen: false })
    expect(rules(), 'the first-turn tutorial should be showing').not.toBeNull()
    expect(screen.queryByTestId('open-rules')).toBeNull()

    // `tutorial-dismiss` only exists on the LAST step · this is step 1 of 3, so Skip is the control.
    fireEvent.click(screen.getByTestId('tutorial-skip'))
    await waitFor(() => expect(rules()).toBeNull())
    expect(screen.getByTestId('open-rules'), 'and it comes back the moment the overlay leaves').toBeTruthy()
  })
})
