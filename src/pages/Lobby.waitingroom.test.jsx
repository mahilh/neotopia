import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

// The waiting room is the wall this session went looking for, so it is rendered here for real rather
// than reasoned about: lobbyGate can be perfect and still not be on screen if the page ignores it.
vi.mock('../lib/supabase', () => ({ supabase: {}, GLOBAL_INDEX_BASE: 147823, getGlobalIndex: async () => 147823 }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-host' }, username: 'Wanderer', isLoading: false, authError: null, isClaimed: true, claimUsername: vi.fn() }),
}))
vi.mock('../hooks/useConnectionHealth', () => ({
  useBackendHealth: () => ({ status: 'online', source: null, attempt: 0, reason: null, isDegraded: false, isOffline: false }),
}))

const room = { current: {} }
vi.mock('../hooks/useGameRoom', () => ({
  JOIN_FAILURE: { INVALID_CODE: 'invalid_code', NOT_FOUND: 'not_found', ROOM_FULL: 'room_full', ALREADY_STARTED: 'already_started', NETWORK: 'network', BUSY: 'busy', NOT_AUTHENTICATED: 'not_authenticated', NAME_REQUIRED: 'name_required' },
  useGameRoom: () => room.current,
}))

const Lobby = (await import('./Lobby')).default

const HOST = { userId: 'u-host', username: 'Wanderer', seat: 0, isHost: true }
const GUEST = (over = {}) => ({ userId: 'u-2', username: 'Friend', seat: 1, isHost: false, isReady: false, ...over })

const inLobby = (lobbyPlayers, isHost = true) => {
  room.current = {
    roomId: 'r-1', roomCode: 'KD3XE8', isHost, isReady: false, lobbyPlayers,
    lobbyError: null, roomPhase: 'lobby', gameMode: 'classic',
    createRoom: vi.fn(), joinRoom: vi.fn(), peekRoom: vi.fn(), setReady: vi.fn(),
    startGame: vi.fn(), leaveRoom: vi.fn(), setGameMode: vi.fn(),
  }
  render(<Lobby onGameStart={() => {}} />)
}

beforeEach(() => { localStorage.clear() })
afterEach(cleanup)

describe('Lobby waiting room · the screen a first visitor actually gets stuck on', () => {
  it('tells a host alone in a room what is missing and what to do about it', () => {
    inLobby([HOST])
    const start = screen.getByTestId('start-btn')
    expect(start.disabled, 'the gate itself is unchanged · one player still cannot start').toBe(true)
    expect(start.textContent, 'and it no longer reports 0 of 0 players ready').not.toMatch(/0\/0/)

    const hint = screen.getByTestId('lobby-hint')
    expect(hint.textContent).toMatch(/two players/i)
    // The invite button is already on this screen · before this the copy never pointed at it.
    expect(hint.textContent).toMatch(/invite|code/i)
    expect(screen.getByTestId('copy-invite-link')).toBeTruthy()
  })

  it('says nothing to a joiner, who cannot fix an empty room', () => {
    inLobby([HOST], false)
    expect(screen.queryByTestId('lobby-hint')).toBeNull()
    expect(screen.getByTestId('ready-btn')).toBeTruthy()
  })

  it('opens the gate and drops the explanation once everyone is ready', () => {
    inLobby([HOST, GUEST({ isReady: true })])
    expect(screen.getByTestId('start-btn').disabled).toBe(false)
    expect(screen.getByTestId('start-btn').textContent).toMatch(/start game/i)
    expect(screen.queryByTestId('lobby-hint'), 'nothing to explain when the button works').toBeNull()
  })

  it('distinguishes a roster that never arrived from a room nobody joined', () => {
    // Empty means the presence channel has not synced · the host is always in their own presence
    // state. Telling THIS host to invite a friend is advice that cannot work.
    inLobby([])
    expect(screen.getByTestId('lobby-hint').textContent).not.toMatch(/invite/i)
    expect(screen.getByTestId('start-btn').textContent).toMatch(/connect/i)
  })
})
