import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { BOT_OPPONENTS_READY } from '../components/PracticeStart'

vi.mock('../lib/supabase', () => ({ supabase: {}, GLOBAL_INDEX_BASE: 147823, getGlobalIndex: async () => 147823 }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const GameRoom = (await import('./GameRoom')).default

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// PracticeStart.test.jsx guards that the UI agrees with BOT_OPPONENTS_READY. It cannot guard that the
// FLAG agrees with reality · flipping it to true left all seven of those tests green, which is the
// same shape as a vacuous guard even though each individual assertion is sound. The flag is a claim
// about another lane's work, so the honest place to check it is the seam where that work would show
// up: a local game asked for N opponents either seats them or it does not.
//
// This is the test that goes red if somebody advertises bots before they exist.

const seatedPlayers = () => useGameStore.getState().players.length

describe('practice · the offer and the game have to agree about bots', () => {
  it('seats exactly as many opponents as the entry point is allowed to promise', async () => {
    render(<MemoryRouter><GameRoom practiceBots={2} /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))

    if (BOT_OPPONENTS_READY) {
      // The flag says bots exist · then asking for 2 opponents must produce a three-player table.
      expect(seatedPlayers(), 'bots are advertised, so they must actually be seated').toBe(3)
    } else {
      // The flag says they do not · then the local game is one human, and PracticeStart must not be
      // offering anything else. Both halves are asserted, so the flag cannot be flipped alone.
      expect(seatedPlayers(), 'no bots yet · the local game seeds the one human it always has').toBe(1)
    }
  })

  it('carries the requested count to the board as an observable seam', async () => {
    // The request has to ARRIVE before anything can consume it. Asserting the seam separately means
    // T2 can wire seats against a value that is already proven to reach this component.
    render(<MemoryRouter><GameRoom practiceBots={3} /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    const root = document.querySelector('[data-practice-bots]')
    expect(root, 'the seam must exist on the board root').not.toBeNull()
    expect(root.getAttribute('data-practice-bots')).toBe('3')
  })

  it('a real room is never a practice game', async () => {
    // Practice defaults to zero everywhere else · a route that forgets to pass it must not silently
    // inherit somebody's opponent count.
    render(<MemoryRouter><GameRoom /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    expect(document.querySelector('[data-practice-bots]').getAttribute('data-practice-bots')).toBe('0')
  })
})
