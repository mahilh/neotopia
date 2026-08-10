import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved, PRACTICE_HUMAN_ID, PRACTICE_STORAGE_KEY } from '../hooks/useLocalSession'

// ── The way out has to exist at the moment the player wants it ───────────────────────────────────
// T3 measured this live in S35 and left a `test.fail()` in tests/e2e/practice.e2e.js pointed at it:
// at phase 'scoring' the "Leave practice" button is still in the DOM, still passes a visibility
// check, and `document.elementFromPoint` at its centre returns the FinalScore dialog · which is
// position:fixed, inset:0, zIndex 300 and opaque. A real click times out. The only control a player
// could reach was "Start New Civilization", which navigates to the MULTIPLAYER lobby and never runs
// endPractice(), so a practice player who finishes a game is sent to the one screen that requires
// the sign-in practice exists to survive without, with the finished game left behind them in the
// store and in sessionStorage.
//
// jsdom has no layout, so it CANNOT reproduce "covered by an overlay" · asserting on visibility here
// would be a test that passes in both worlds, which is worse than no test. What jsdom can hold, and
// what the E2E cannot cheaply hold, is the OTHER half: that exactly one exit exists, that it is
// inside the dialog when the dialog is up, and that clicking it runs the teardown rather than a
// navigation. The reachability claim stays where it can be measured (T3's spec, no longer failing).
//
// NAMING THE FALSE CASE, as ever: none of these fail loudly. They fail as a button that is present
// and does nothing, which reads to a player as a broken game rather than as a bug worth reporting.

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
// The bot driver is silenced: these tests are about the exit, and a live driver would keep mutating
// the board underneath the assertions. Its own composition is pinned by GameRoom.practice.test.jsx.
vi.mock('../hooks/useBotTurns', () => ({ useBotTurns: () => {} }))

const GameRoom = (await import('./GameRoom')).default

const state = () => useGameStore.getState()
const exits = () => screen.queryAllByTestId('leave-practice')

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); clearSaved(); localStorage.clear() })

const renderPractice = async (bots, onExit = vi.fn()) => {
  const utils = render(
    <MemoryRouter><GameRoom practice practiceBots={bots} onExitPractice={onExit} /></MemoryRouter>,
  )
  await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
  return { ...utils, onExit }
}

const endTheGame = () => act(() => { state().setPhase('scoring') })

describe('leaving practice, at the moment the game ends', () => {
  it('keeps exactly one exit in the document · in the header while playing, in the dialog after', async () => {
    await renderPractice(1)
    expect(exits(), 'a practice game must always offer a way out').toHaveLength(1)
    // While there is a board, the exit belongs to the header · not inside a dialog that is not up.
    expect(screen.queryByRole('dialog')).toBeNull()

    endTheGame()
    await screen.findByRole('dialog', { name: /final civilization record/i })

    // FALSE CASE, and the shipped one: TWO exits · the header copy still mounted underneath an opaque
    // full-viewport overlay, plus whatever the fix added. A getByTestId then resolves to a strict-mode
    // violation in Playwright and to an ambiguous element here, and the "extra" one is the unclickable
    // one. One control, wherever the player is looking.
    expect(exits(), 'exactly one leave-practice may exist at a time').toHaveLength(1)
    expect(
      screen.getByRole('dialog').contains(exits()[0]),
      'the exit is outside the dialog that covers the whole viewport · a player cannot reach it',
    ).toBe(true)
  })

  it('runs the practice teardown from the end screen, not a bare navigation', async () => {
    const { onExit } = await renderPractice(2)
    expect(state().players.length).toBe(3)
    endTheGame()
    await screen.findByRole('dialog', { name: /final civilization record/i })

    fireEvent.click(screen.getByTestId('leave-practice'))

    // FALSE CASE: the player lands on another page and the store still holds a finished practice game
    // at phase 'scoring', so the next visit stares at the old score screen · and sessionStorage still
    // holds it too, which survives an in-app navigation AND a reload.
    expect(onExit, 'the player is still standing on the finished game').toHaveBeenCalled()
    expect(state().phase, 'the store must be returned to a blank slate').toBe('lobby')
    expect(sessionStorage.getItem(PRACTICE_STORAGE_KEY)).toBeNull()
  })

  it('does not offer a practice exit in a real game · this is not a control everyone gets', async () => {
    render(<MemoryRouter><GameRoom /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    endTheGame()
    await screen.findByRole('dialog', { name: /final civilization record/i })
    expect(exits()).toHaveLength(0)
    // And the multiplayer CTA still says what it always said · the practice branch must not leak.
    expect(screen.getByTestId('play-again-btn').textContent).toMatch(/new civilization/i)
  })
})

describe('playing again, which in practice means practice', () => {
  it('deals a fresh table instead of sending a practice player to the multiplayer lobby', async () => {
    await renderPractice(2)
    // Make the finished game recognisable, so "a new game" is a claim about state and not about a
    // render having happened.
    act(() => {
      const players = state().players.map(p => (p.seat === 0 ? { ...p, scoredCardIds: ['card_01'], scores: [5, 1, 0] } : p))
      useGameStore.setState({ players, turnNumber: 17 }, false)
    })
    endTheGame()
    await screen.findByRole('dialog', { name: /final civilization record/i })
    expect(screen.getByTestId('play-again-btn').textContent).toMatch(/play again/i)

    fireEvent.click(screen.getByTestId('play-again-btn'))

    // FALSE CASE #1 (what shipped): navigate('/lobby') · the player leaves practice for a screen that
    // needs the sign-in this mode exists without, and the teardown never runs.
    // FALSE CASE #2 (the one the re-arm dance exists to avoid): the transport's one-game latch never
    // resets, so the store is left at 'lobby' with a blank slate and nothing ever deals · a dead
    // screen, which is the failure mode with no error message.
    await waitFor(() => expect(state().phase, 'nothing dealt a new board').toBe('playing'), { timeout: 3000 })
    expect(state().players.length, 'the same opponents the player chose').toBe(3)
    expect(state().turnNumber, 'this is the OLD game, restored').toBe(1)
    expect(state().players[0].scoredCardIds ?? [], 'the finished game came back with it').toHaveLength(0)
    // The dialog has to go with it · a new board under an old score screen is the worst of both.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(exits(), 'the header exit comes back with the board').toHaveLength(1)
  })

  it('deals a fresh table with zero opponents too · a different code path, same promise', async () => {
    // Zero opponents never touches the local transport at all (GameRoom's own local-init effect owns
    // it), so the two halves of "play again" are genuinely separate paths and both are asserted.
    await renderPractice(0)
    expect(state().players.length).toBe(1)
    act(() => { useGameStore.setState({ turnNumber: 9 }, false) })
    endTheGame()
    await screen.findByRole('dialog', { name: /final civilization record/i })

    fireEvent.click(screen.getByTestId('play-again-btn'))

    await waitFor(() => expect(state().phase).toBe('playing'), { timeout: 3000 })
    expect(state().turnNumber, 'the old free-exploration board was restored').toBe(1)
    expect(state().players.length).toBe(1)
    expect(state().players[0].userId).toBe(PRACTICE_HUMAN_ID)
  })

  it('leaves nothing restorable behind · the new game is not the old one wearing a fresh phase', async () => {
    await renderPractice(1)
    act(() => { useGameStore.setState({ turnNumber: 12 }, false) })
    endTheGame()
    await screen.findByRole('dialog', { name: /final civilization record/i })
    fireEvent.click(screen.getByTestId('play-again-btn'))
    await waitFor(() => expect(state().phase).toBe('playing'), { timeout: 3000 })

    // The saved snapshot is what a refresh restores. FALSE CASE: it still carries the finished game,
    // so the fresh board survives exactly until the player reloads the page.
    const saved = JSON.parse(sessionStorage.getItem(PRACTICE_STORAGE_KEY) ?? 'null')
    expect(saved, 'a practice game that persists nothing does not survive a refresh').not.toBeNull()
    expect(saved.turnNumber, 'the snapshot is still the finished game').toBe(1)
    expect(saved.phase).toBe('playing')
  })
})
