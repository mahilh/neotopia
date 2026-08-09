import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react'

// ── The dead-invite screen · every way a link can fail to let somebody in ────────────────────────
// T3 S32 found the tenth outcome and deliberately did not add the code: a member of a FINISHED room
// was READMITTED, into a lobby for a game that was already over · nobody in presence, and a Start
// button that could never enable. The fix needs a distinct outcome, and a tenth JOIN_FAILURE lands
// here as an unhandled branch, so they routed it instead of smuggling it in. This is that branch.
//
// NAMING THE FALSE CASE FIRST. Two of them, and I had the first one wrong until I mutated it:
//   1. A branch that fires when it should not. I expected this to be the live risk · ROOM_FINISHED is
//      undefined in the real module, so I assumed `reason === undefined` would be true on healthy
//      screens. It is not: `reason` falls through to null and `null === undefined` is false under
//      `===`. The guard below stays anyway, because it is what stops a future rewrite from loosening
//      that comparison, but it is a guard against a bug that was never live. Said plainly rather than
//      left as a scary-sounding comment that a reader would believe.
//   2. The one that IS live: a branch that can never fire. Without the fallback the comparison is
//      against undefined forever, so the screen reads as handled and does nothing. That is what the
//      join-time test below actually pins, and it is the only test that reddens when the fallback goes.
vi.mock('../lib/supabase', () => ({ supabase: {}, GLOBAL_INDEX_BASE: 147823, getGlobalIndex: async () => 147823 }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-me' }, username: 'Wanderer', isLoading: false, authError: null, isClaimed: true, claimUsername: vi.fn() }),
}))
vi.mock('../hooks/useConnectionHealth', () => ({
  useBackendHealth: () => ({ status: 'online', source: null, attempt: 0, reason: null, isDegraded: false, isOffline: false }),
}))

// Mirrors the REAL object, which as of T3's 12c1130 carries the tenth code. A mock is the one place a
// seam can be faked into looking finished, so the real module is asserted separately below rather than
// trusted through this fixture (T3 S32's own lesson: a fixture must not impersonate the interface).
const room = { current: {} }
vi.mock('../hooks/useGameRoom', () => ({
  JOIN_FAILURE: {
    BACKEND_OFFLINE: 'BACKEND_OFFLINE', NOT_AUTHENTICATED: 'NOT_AUTHENTICATED', NAME_REQUIRED: 'NAME_REQUIRED',
    INVALID_CODE: 'INVALID_CODE', NOT_FOUND: 'NOT_FOUND', ALREADY_STARTED: 'ALREADY_STARTED',
    ROOM_FULL: 'ROOM_FULL', SEAT_CONFLICT: 'SEAT_CONFLICT', BUSY: 'BUSY', NETWORK: 'NETWORK',
    ROOM_FINISHED: 'ROOM_FINISHED',
  },
  useGameRoom: () => room.current,
}))

const Lobby = (await import('./Lobby')).default

const CODE = 'KD3XE8' // valid shape · no I, O, 0 or 1

const arrive = ({ peek, joinReason, onPractice } = {}) => {
  room.current = {
    roomId: null, roomCode: null, isHost: false, isReady: false, lobbyPlayers: [],
    lobbyError: null, roomPhase: 'idle', gameMode: 'classic',
    createRoom: vi.fn(), setReady: vi.fn(), startGame: vi.fn(), leaveRoom: vi.fn(), setGameMode: vi.fn(),
    peekRoom: vi.fn(async () => peek ?? { ok: true, status: 'waiting', playerCount: 1, maxPlayers: 4, players: [], canJoin: true, rejoinable: false }),
    joinRoom: vi.fn(async () => (joinReason ? { ok: false, reason: joinReason } : { ok: true, seat: 1 })),
  }
  render(<Lobby initialCode={CODE} onGameStart={() => {}} onPractice={onPractice} />)
}

const blockedText = async () => {
  const card = await screen.findByTestId('invite-blocked')
  return card.textContent
}

beforeEach(() => { localStorage.clear() })
afterEach(cleanup)

describe('the tenth outcome · a room that is over', () => {
  it('the code this screen branches on really exists in the real module', async () => {
    // THE MOCK ABOVE CANNOT ANSWER THIS. Every render test in this file would stay green if T3's
    // emitter were deleted tomorrow, because the fixture supplies the code itself · the screen and the
    // fixture would agree with each other about a world neither of them checks. Read the real module.
    const actual = await vi.importActual('../hooks/useGameRoom')
    expect(actual.JOIN_FAILURE.ROOM_FINISHED,
      'the branch below is dead unless useGameRoom still emits this').toBe('ROOM_FINISHED')
  })

  it('does NOT claim the game is over when nothing has failed', async () => {
    // THE TRAP. JOIN_FAILURE.ROOM_FINISHED is undefined in the real module today, and every
    // no-failure path carries reason === null/undefined. A bare property comparison shows this block
    // to a healthy invite. This assertion is the reason the fallback exists.
    arrive()
    await waitFor(() => expect(room.current.peekRoom).toHaveBeenCalled())
    expect(screen.queryByTestId('invite-blocked'), 'a working invite must not be told its game is over').toBeNull()
  })

  it('names a finished room from the preview, before any write is attempted', async () => {
    arrive({ peek: { ok: true, status: 'finished', playerCount: 3, maxPlayers: 4, players: [], canJoin: false, rejoinable: false } })
    const text = await blockedText()
    expect(text).toMatch(/game is over/i)
    // FALSE CASE, and this was the live behaviour: a finished room fell through to the capacity
    // branch and said "That room is full", which points at a remedy · waiting for a seat · that can
    // never work on a game that has ended.
    expect(text, 'a finished room is not a full room').not.toMatch(/full/i)
    expect(text, 'and the player is told what to do next').toMatch(/new game|fresh invite/i)
  })

  it('names it for its own MEMBER, who is the person this bug actually stranded', async () => {
    // rejoinable true is exactly the state that used to readmit them into the phantom lobby. The
    // finished check has to sit AHEAD of it, so this is the ordering assertion.
    arrive({ peek: { ok: true, status: 'finished', playerCount: 2, maxPlayers: 4, players: [], canJoin: false, rejoinable: true } })
    expect(await blockedText()).toMatch(/game is over/i)
  })

  it('handles the join-time code once T3 emits it', async () => {
    // The preview can be stale · a room can finish between the peek and the join. This is the branch
    // T3 asked for, reached through joinRoom's reason rather than through the preview.
    arrive({
      peek: { ok: true, status: 'waiting', playerCount: 1, maxPlayers: 4, players: [], canJoin: true, rejoinable: false },
      joinReason: 'ROOM_FINISHED',
    })
    await waitFor(async () => expect(await blockedText()).toMatch(/game is over/i))
  })
})

describe('the other nine still say what they always said', () => {
  it('a full room is still full', async () => {
    arrive({ peek: { ok: true, status: 'waiting', playerCount: 4, maxPlayers: 4, players: [], canJoin: false, rejoinable: false } })
    const text = await blockedText()
    expect(text).toMatch(/full/i)
    expect(text, 'the new branch must not have swallowed this one').not.toMatch(/game is over/i)
  })

  it('a game in progress is still in progress', async () => {
    arrive({ peek: { ok: true, status: 'playing', playerCount: 2, maxPlayers: 4, players: [], canJoin: false, rejoinable: false } })
    const text = await blockedText()
    expect(text).toMatch(/already started/i)
    expect(text).not.toMatch(/game is over/i)
  })

  it('a room that never existed is still missing', async () => {
    arrive({ peek: { ok: false, reason: 'NOT_FOUND' } })
    const text = await blockedText()
    expect(text).toMatch(/no longer exists/i)
    expect(text).not.toMatch(/game is over/i)
  })
})

describe('the way out', () => {
  it('offers practice to somebody a dead link has stranded', async () => {
    const onPractice = vi.fn()
    arrive({ peek: { ok: true, status: 'finished', playerCount: 2, maxPlayers: 4, players: [], canJoin: false, rejoinable: false }, onPractice })
    await blockedText()
    fireEvent.click(screen.getByTestId('invite-practice'))
    expect(onPractice, 'free exploration · the one path that needs no room and no sign-in').toHaveBeenCalledWith(0)
  })

  it('renders no practice button on a route that cannot honour it', async () => {
    // FALSE CASE: a button that is always present and sometimes does nothing is worse than no button.
    // JoinRoute passes the handler now; anything that does not must not show the affordance.
    arrive({ peek: { ok: true, status: 'finished', playerCount: 2, maxPlayers: 4, players: [], canJoin: false, rejoinable: false } })
    await blockedText()
    expect(screen.queryByTestId('invite-practice')).toBeNull()
  })

  it('always leaves the manual code path available', async () => {
    arrive({ peek: { ok: true, status: 'finished', playerCount: 2, maxPlayers: 4, players: [], canJoin: false, rejoinable: false } })
    await blockedText()
    expect(screen.getByTestId('invite-manual')).toBeTruthy()
  })
})
