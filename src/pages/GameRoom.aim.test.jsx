import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'

// GameRoom pulls the whole backend in through its hooks. None of it is under test here · what is under
// test is the four-click placement chain, driven from the BOARD.
vi.mock('../lib/supabase', () => ({ supabase: {}, GLOBAL_INDEX_BASE: 147823, getGlobalIndex: async () => 147823 }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const GameRoom = (await import('./GameRoom')).default

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1') // the overlay is not what is being measured here
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

const placedCount = () => useGameStore.getState().regions
  .reduce((n, reg) => n + Object.values(reg.hexes).filter(h => h.element).length, 0)

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// Placement is four clicks: factory → element → region → hex. Two of them live in a side panel, which
// at a 375px viewport is 381px away from the factory the player just clicked (651px at 1280px), and
// until this session the board showed NOTHING in between. Three human sessions exist in production
// history and none of them ever placed an element; the pair on 2026-08-07 pressed End Turn three
// times over four minutes and left.
//
// The chain below never touches a region button. If it still reaches a placed element, the board
// alone carried the player · which is the whole claim.

describe('GameRoom · a player who only ever looks at the board can place an element', () => {
  it('goes factory → aim → element → hex, and the region step never has to be found', async () => {
    render(<MemoryRouter><GameRoom /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    expect(placedCount()).toBe(0)

    // 1 · the only thing the resting board invites (the factories are the pulsing element).
    fireEvent.click(screen.getAllByTestId('factory')[0])

    // 2 · the board answers: here is where this factory can actually reach.
    const preview = await screen.findAllByTestId('hex-reachable')
    expect(preview.length, 'the board must answer the factory click').toBeGreaterThan(0)
    // Nothing is placeable yet · the preview must not be pretending otherwise.
    expect(screen.queryAllByTestId('hex-valid')).toHaveLength(0)

    // 3 · point at one of them. This is the click that used to do nothing at all.
    fireEvent.click(preview[0])
    expect(screen.getByTestId('instruction').textContent, 'aiming must be acknowledged in words too')
      .toMatch(/it goes into/i)

    // 4 · pick what to put there. THE REGION BUTTON IS NEVER CLICKED: the aim already answered that
    // question, so choosing an element is enough to light the target.
    fireEvent.click(screen.getAllByTestId('element-btn')[0])
    const lit = await screen.findAllByTestId('hex-valid')
    expect(lit.length, 'the aimed hex must light up without a trip to the region panel').toBeGreaterThan(0)

    // 5 · place it. The commit is still the player's own click on a live target · aiming never places.
    fireEvent.click(lit[0])
    await waitFor(() => expect(placedCount()).toBe(1))
  })

  it('never carries an aim onto a factory that cannot serve it', async () => {
    // The failure this guards is a WORSE dead end than the one being fixed. Factory 0 borders regions
    // 0 and 1; factory 1 borders 1 and 2. Aim into region 0, change your mind, pick factory 1, choose
    // an element · a surviving aim would select region 0 for a factory that cannot reach it, leaving
    // the player at 'regionSelected' being told to "click a highlighted hex" with none on the board.
    // Nothing would be broken in the engine and nothing would look wrong: the game would simply stop.
    // Two guards stand in the way (the aim is cleared when a factory is picked, and the effect re-checks
    // the border rule at the moment it acts). Removing EITHER one leaves this green; removing both turns
    // it red · which is the right shape. The test is pinned to the property, not to either mechanism.
    render(<MemoryRouter><GameRoom /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    const factories = screen.getAllByTestId('factory')

    fireEvent.click(factories[0])
    fireEvent.click((await screen.findAllByTestId('hex-reachable'))[0]) // aim, from factory 0
    fireEvent.click(factories[1])                                       // change of mind
    fireEvent.click(screen.getAllByTestId('element-btn')[0])

    const phase = document.querySelector('[data-ui-phase]').getAttribute('data-ui-phase')
    const lit = screen.queryAllByTestId('hex-valid').length
    expect(phase === 'regionSelected' && lit === 0, `stranded: phase=${phase} with ${lit} lit hexes`).toBe(false)
    expect(placedCount(), 'and nothing may be placed by aiming alone').toBe(0)
  })
})
