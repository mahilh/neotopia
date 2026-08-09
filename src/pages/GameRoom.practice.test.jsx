import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { BOT_OPPONENTS_READY } from '../components/PracticeStart'
import { clearSaved, PRACTICE_HUMAN_ID } from '../hooks/useLocalSession'

// A SPY, not a stub · one of the guarantees below is that this is never called at all.
const authSpy = vi.hoisted(() => vi.fn(() => ({ user: null, isLoading: false })))
const recordContribution = vi.hoisted(() => vi.fn(async () => {}))
const recordDetail = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: recordContribution,
  recordCivilizationDetail: recordDetail,
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: authSpy }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const GameRoom = (await import('./GameRoom')).default

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
  authSpy.mockClear()
  recordContribution.mockClear()
  recordDetail.mockClear()
})
afterEach(() => { cleanup(); clearSaved(); localStorage.clear() })

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// PracticeStart.test.jsx guards that the UI agrees with BOT_OPPONENTS_READY. It cannot guard that the
// FLAG agrees with reality · flipping it to true left all seven of those tests green, which is the
// same shape as a vacuous guard even though each individual assertion is sound. The flag is a claim
// about another lane's work, so the honest place to check it is the seam where that work shows up.
//
// S33 · that seam is now load-bearing, because the composition was genuinely broken while both halves
// were individually correct and individually tested. useLocalSession dealt bot seats with no `isBot`
// key; useBotTurns returns at `if (!me?.isBot) return`. Seats appeared, the turn reached seat 1, and
// the game stopped there forever. Neither lane's tests could see it: one asserts the bot USERIDS, the
// other builds its own fixtures WITH isBot already set. Only a test that holds both can.
//
// NAMING THE FALSE CASE FIRST, throughout. The failure that matters here is not a crash · it is a
// board that quietly does nothing, which reads as "still thinking" for as long as a player is willing
// to wait. So the assertions are about MOVEMENT and about the turn COMING BACK, never about a
// function having been reached.

const state = () => useGameStore.getState()
const seated = () => state().players.length
const boardSnapshot = () => JSON.stringify({
  seat: state().currentSeat,
  turn: state().turnNumber,
  actions: state().actionsRemaining,
  hands: state().players.map(p => p.hand.length),
  scores: state().players.map(p => p.scores),
  filled: state().regions.map(r => Object.values(r.hexes).filter(h => h.element).length),
})

const renderPractice = async (bots) => {
  const utils = render(<MemoryRouter><GameRoom practice practiceBots={bots} /></MemoryRouter>)
  await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
  return utils
}

describe('practice · the offer and the game have to agree about bots', () => {
  it('seats exactly as many opponents as the entry point promises', async () => {
    await renderPractice(2)
    if (BOT_OPPONENTS_READY) {
      expect(seated(), 'bots are advertised, so they must actually be seated').toBe(3)
    } else {
      expect(seated(), 'no bots yet · the local game seeds the one human it always has').toBe(1)
    }
  })

  it('gives every bot seat the key its driver actually reads, at the level Mahil chose', async () => {
    if (!BOT_OPPONENTS_READY) return
    await renderPractice(3)
    const bots = state().players.filter(p => p.userId !== PRACTICE_HUMAN_ID)
    expect(bots).toHaveLength(3)
    for (const b of bots) {
      // FALSE CASE, and the one that actually happened: the seat exists, is coloured, holds a hand,
      // and has no isBot · so it looks entirely correct in a roster and never moves.
      expect(b.isBot, `${b.username} must be drivable`).toBe(true)
      // Mahil's S33 decision · every practice game is the middle level, and no selector ships. Pinned
      // here rather than declared a fourth time, so a drift in useLocalSession, initGame's default or
      // botPolicy's DEFAULT_DIFFICULTY surfaces as a red test instead of a silently different opponent.
      expect(b.difficulty, 'practice defaults to builder · the ladder stays unexposed').toBe('builder')
    }
    // The human must NOT be drivable · a bot playing the player's seat is the same bug inverted.
    const human = state().players.find(p => p.userId === PRACTICE_HUMAN_ID)
    expect(Object.prototype.hasOwnProperty.call(human, 'isBot')).toBe(false)
  })

  it('a bot takes a real turn, and the turn comes back', async () => {
    if (!BOT_OPPONENTS_READY) return
    await renderPractice(1)
    expect(state().currentSeat).toBe(0)

    const before = boardSnapshot()
    act(() => { state().endTurn() })                 // the human's End Turn · now it is the bot's move
    expect(state().currentSeat).toBe(1)

    // FALSE CASE: nothing changes and seat stays 1 forever. That is exactly what shipped before this
    // session, so the wait is generous and the failure message says what the silence means.
    await waitFor(
      () => expect(boardSnapshot(), 'the bot seat never acted · the game is deadlocked').not.toBe(before),
      { timeout: 5000 },
    )
    // And it has to FINISH its turn, not just twitch once · a bot that acts and then stalls is the
    // same dead end one move later.
    await waitFor(
      () => expect(state().currentSeat, 'the bot never handed the turn back').toBe(0),
      { timeout: 15000 },
    )
  }, 25000)

  it('the player cannot act on a bot seat', async () => {
    if (!BOT_OPPONENTS_READY) return
    await renderPractice(1)
    act(() => { state().endTurn() })
    expect(state().currentSeat).toBe(1)

    // Clicked immediately, well inside the bot's own move delay, so this is the human's click and
    // nothing else. FALSE CASE: mySeat stays null in practice, isMyTurn is `mySeat == null || ...`,
    // and the player silently plays the bot's turn for it.
    fireEvent.click(screen.getAllByTestId('factory')[0])
    expect(document.querySelector('[data-ui-phase]').getAttribute('data-ui-phase')).toBe('idle')
  })

  it('changing the opponent count deals a new game instead of restoring the old one', async () => {
    if (!BOT_OPPONENTS_READY) return
    const first = await renderPractice(1)
    expect(seated()).toBe(2)
    first.unmount()

    // The saved game is still in sessionStorage · a player who left with the Back button and chose
    // differently must get what they chose. FALSE CASE: the transport restores first by design, so
    // without the caller resolving this the selector is decorative on every visit after the first.
    await renderPractice(3)
    expect(seated(), 'the count the player just picked must win over the saved game').toBe(4)
  })
})

describe('practice · what it must never cost, and never touch', () => {
  it('never mints an identity · useAuth is not in the practice tree at all', async () => {
    await renderPractice(1)
    // FALSE CASE: useAuth is called and returns null-user, which looks identical from the outside ·
    // it is the CALL that mints, so the assertion has to be on the call, not on the result.
    expect(authSpy, 'practice must cost zero anonymous sign-ins · useAuth mints one when it runs')
      .not.toHaveBeenCalled()
  })

  it('a real game still authenticates · the guarantee above is not just a dead branch', async () => {
    // Without this, deleting useAuth entirely would leave the previous test green.
    render(<MemoryRouter><GameRoom /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    expect(authSpy).toHaveBeenCalled()
  })

  it('a finished practice game writes nothing to the civilization record', async () => {
    if (!BOT_OPPONENTS_READY) return
    await renderPractice(1)
    act(() => {
      // Give the human a scored district, then end the game · this is the state in which a REAL game
      // records. FALSE CASE: mySeat is now set in practice (it has to be, for the turn gate), and
      // mySeat != null was the only thing that had ever stopped this write.
      // A REAL deck id. 'c1' was the first draft of this line and it made the test vacuous: FinalScore
      // maps scoredCardIds through DECK and drops anything it cannot find, so myDistricts was 0, the
      // `myDistricts <= 0` branch skipped the write, and the test passed with the practice guard
      // deleted. Caught by mutating the guard rather than by reading the test back. (Rule 63.)
      const players = state().players.map(p =>
        p.seat === 0 ? { ...p, scoredCardIds: ['card_01'], scores: [3, 0, 0] } : p)
      useGameStore.setState({ players }, false)
      state().setPhase('scoring')
    })
    await screen.findByText(/NeoTopia|Districts|Final/i, {}, { timeout: 3000 }).catch(() => {})
    await new Promise(r => setTimeout(r, 50))
    expect(recordContribution, 'bots must not build the real NeoTopia').not.toHaveBeenCalled()
    expect(recordDetail, 'a practice game has no session to belong to').not.toHaveBeenCalled()
  })

  it('a real room is never a practice game', async () => {
    render(<MemoryRouter><GameRoom /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    const root = document.querySelector('[data-practice-bots]')
    expect(root.getAttribute('data-practice-bots')).toBe('0')
    expect(screen.queryByTestId('practice-badge')).toBeNull()
    expect(screen.queryByTestId('leave-practice')).toBeNull()
    // No seat may be drivable outside practice · initGame is the only writer of isBot and only the
    // local transport ever passes it, but that is a claim about two other lanes, so it is checked here.
    expect(state().players.some(p => p.isBot)).toBe(false)
  })

  it('offers the way out that the store actually needs', async () => {
    if (!BOT_OPPONENTS_READY) return
    const onExit = vi.fn()
    render(<MemoryRouter><GameRoom practice practiceBots={2} onExitPractice={onExit} /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByTestId('factory').length).toBeGreaterThan(0))
    expect(seated()).toBe(3)

    fireEvent.click(screen.getByTestId('leave-practice'))
    expect(onExit).toHaveBeenCalled()
    // FALSE CASE: navigating away without endPractice leaves phase 'playing' and the finished game in
    // the store, so the next practice game is the last one · "replayable indefinitely" quietly false.
    expect(state().phase, 'the store must be returned to a blank slate').toBe('lobby')
    expect(sessionStorage.getItem('neotopia-practice-v1')).toBeNull()
  })
})
