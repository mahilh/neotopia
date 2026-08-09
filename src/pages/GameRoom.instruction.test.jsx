import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'

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
// This one line is the colonist.io "what do I do next" pattern, and it is the only thing on the game
// screen that speaks to the player in sentences. It was absolutely positioned at left:50% with
// translateX(-50%) OVER the flow, plus maxWidth:58% and nowrap · so at every width up to 600px it both
// SAT ON TOP OF the wordmark and truncated itself. Measured this session, in device pixels:
//
//     320 → 43px of overlap    375 → 31px    414 → 23px    600 → 36px    768+ → clear
//     and "Click a factory to take an element · or draw a card from the Offer" was clipped at all of them
//
// The screenshot at 375px read "N E O T O P I Ack an element from the factory". jsdom has no layout, so
// the overlap itself cannot be re-measured here (the rects live in the session's Playwright evidence).
// What CAN be pinned is the pair of properties that made it geometrically possible · an out-of-flow box
// cannot collide with its siblings if it is not out of flow.

describe('GameRoom · the instruction line', () => {
  const mount = async () => {
    render(<MemoryRouter><GameRoom /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    return screen.getByTestId('instruction')
  }

  it('sits in the header flow, so it cannot be painted over its neighbours', async () => {
    const el = await mount()
    expect(getComputedStyle(el).position, 'an absolutely-placed instruction is what collided with the wordmark')
      .not.toBe('absolute')
  })

  it('is allowed to wrap rather than clip its own sentence', async () => {
    const el = await mount()
    // nowrap + a percentage maxWidth is what produced "Click a factory to take an ele…" on a phone.
    expect(getComputedStyle(el).whiteSpace, 'the sentence must be free to take a second line').not.toBe('nowrap')
    expect(getComputedStyle(el).textOverflow, 'nothing here should be ellipsised away').not.toBe('ellipsis')
  })

  it('never goes silent · it names the next choice as the player makes it', async () => {
    const el = await mount()
    expect(el.textContent, 'the resting board must invite the first action').toMatch(/factory/i)
    fireEvent.click(screen.getAllByTestId('factory')[0])
    expect(el.textContent, 'after picking a factory it must say what is being chosen next').toMatch(/element/i)
    fireEvent.click((await screen.findAllByTestId('hex-reachable'))[0])
    expect(el.textContent, 'and where the element is headed once a hex is aimed at').toMatch(/it goes into/i)
  })
})
