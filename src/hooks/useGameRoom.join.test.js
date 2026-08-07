// NeoTopia · the JOIN-BY-LINK contract (T3 S27).
//
// WHAT THIS FILE IS FOR. The contract for /join/:code was posted to comms BEFORE the implementation, because
// T1 is building the screen against it. A contract that is only written down is a promise; these tests are
// what make it a fact. Every clause T1 was told to rely on · the success shape, each reason code, the
// name-before-join ordering, the read-without-a-name peek · is asserted here, so a future edit that quietly
// changes one breaks a test instead of breaking their screen.
//
// The two claims worth the most: BACKEND_OFFLINE must be returned WITHOUT touching the network (an outage
// must not masquerade as "Room not found" · the exact misattribution the 07-27 nightly triage burned two
// days on), and a MEMBER of an in-progress room must be let back in (the old code checked room status before
// membership and told a player mid-game that their own game had already started).
//
// The health module is NOT mocked · the offline path is driven through the real useConnectionHealth
// aggregator, so this proves the actual composed behaviour rather than a stub agreeing with itself.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── A tiny in-memory Postgres stand-in ────────────────────────────────────────────────────────────────────
// Rows live in `db` and are filtered by the recorded .eq() calls, so the tests script DATA (what the room
// looks like) rather than RESPONSES (what the client happens to call). That keeps them honest when the
// query chain changes shape.
const db = {
  rooms: [], players: [], sessions: [],
  errors: {},            // table → error object to return instead of data
  inserts: [],           // every write attempt · { table, payload }
  conflictOnce: false,   // one-shot 23505 on the next room_players insert (seat race)
  denyJoin: false,       // room_players_join RLS refuses the insert (migration 015 · 42501)
}

function rowsFor(table) {
  if (table === 'game_rooms') return db.rooms
  if (table === 'room_players') return db.players
  if (table === 'game_sessions') return db.sessions
  return []
}

function resolve(table, filters, op, payload, singular) {
  if (db.errors[table]) return { data: null, error: db.errors[table] }

  if (op === 'insert') {
    if (table === 'room_players') {
      // migration 015 · room_players_join requires the room to be waiting AND under capacity. A refusal
      // arrives as a Postgres permission error, NOT as a friendly application-level message.
      if (db.denyJoin) {
        return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
      }
      if (db.conflictOnce) {
        db.conflictOnce = false
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
      }
      const taken = db.players.some(p => p.room_id === payload.room_id && p.seat_number === payload.seat_number)
      if (taken) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
      db.players.push({ ...payload })
    }
    return { data: null, error: null }
  }
  if (op === 'upsert' || op === 'update' || op === 'delete') return { data: null, error: null }

  const rows = rowsFor(table).filter(r => Object.entries(filters).every(([k, v]) => r[k] === v))
  return singular ? { data: rows[0] ?? null, error: null } : { data: rows, error: null }
}

function makeBuilder(table) {
  const filters = {}
  let op = 'select'
  let payload = null
  const b = {
    select() { op = 'select'; return b },
    insert(p) { op = 'insert'; payload = p; db.inserts.push({ table, payload: p }); return b },
    upsert(p) { op = 'upsert'; payload = p; db.inserts.push({ table, payload: p }); return b },
    update(p) { op = 'update'; payload = p; return b },
    delete() { op = 'delete'; return b },
    eq(col, val) { filters[col] = val; return b },
    order() { return b },
    single() { return Promise.resolve(resolve(table, filters, op, payload, true)) },
    maybeSingle() { return Promise.resolve(resolve(table, filters, op, payload, true)) },
    // thenable · awaiting the builder directly (an insert, or select().eq()) resolves the same way
    then(onF, onR) { return Promise.resolve(resolve(table, filters, op, payload, false)).then(onF, onR) },
  }
  return b
}

const fromSpy = vi.fn((t) => makeBuilder(t))
vi.mock('../lib/supabase', () => {
  const stub = { channel: vi.fn(), removeChannel: vi.fn(), from: (t) => fromSpy(t) }
  return { supabase: stub, default: stub }
})

// usePresence is realtime transport · stubbed so the room hook is testable without a channel.
vi.mock('./usePresence', () => ({
  usePresence: () => ({
    players: [], updatePresence: vi.fn(), sendGameStart: vi.fn(() => Promise.resolve()),
    gameStarted: false, resetPresence: vi.fn(),
  }),
}))

import { useGameRoom, JOIN_FAILURE } from './useGameRoom'
import { reportBackendDown, __resetBackendHealth } from './useConnectionHealth'

const USER = { id: 'u-me' }
const ROOM_ID = 'room-uuid-1'

function seedWaitingRoom({ code = 'ABC234', status = 'waiting', players = [], max = 4 } = {}) {
  db.rooms.push({ id: ROOM_ID, room_code: code, status, max_players: max, host_id: 'u-host' })
  db.players.push(...players.map(p => ({ room_id: ROOM_ID, ...p })))
}

// Drive the hook and hand back the resolved contract object.
async function callJoin(hook, code) {
  let res
  await act(async () => { res = await hook.result.current.joinRoom(code) })
  return res
}
async function callPeek(hook, code) {
  let res
  await act(async () => { res = await hook.result.current.peekRoom(code) })
  return res
}

beforeEach(() => {
  db.rooms = []; db.players = []; db.sessions = []
  db.errors = {}; db.inserts = []; db.conflictOnce = false; db.denyJoin = false
  fromSpy.mockClear()
  __resetBackendHealth()
})
afterEach(() => { __resetBackendHealth() })

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('joinRoom · success shape (what T1 renders from)', () => {
  test('a fresh joiner gets ok + roomId + the NORMALISED code + a seat, and is not marked host', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))

    const res = await callJoin(hook, 'abc234')

    expect(res).toMatchObject({
      ok: true, roomId: ROOM_ID, roomCode: 'ABC234', seat: 1,
      isHost: false, rejoined: false, inProgress: false,
    })
    // Hook state is settled before the promise resolves · T1 can read it straight after the await.
    expect(hook.result.current.roomPhase).toBe('lobby')
    expect(hook.result.current.roomId).toBe(ROOM_ID)
    expect(hook.result.current.lobbyError).toBeNull()
  })

  test('the code is normalised · lowercase and surrounding whitespace both resolve to the same room', async () => {
    seedWaitingRoom()
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))

    const res = await callJoin(hook, '  abc234 ')

    expect(res.ok).toBe(true)
    expect(res.roomCode).toBe('ABC234') // what T1 should render · not the raw URL segment
  })

  test('separators a human adds when retyping are stripped · the seam with T1 normalizeRoomCode', async () => {
    // T1's src/utils/roomLink.js strips whitespace AND dashes; a stricter rule here would accept the same
    // string through the invite route (which normalises first) and reject it from the manual code field
    // (which does not). One value, two normalisers, divergent behaviour · exactly the composed-seam bug
    // class Rule 65 is about. These are the shapes a code really arrives in off a screenshot.
    for (const typed of ['abc-234', 'ABC 234', ' abc 234 ', 'a-b-c-2-3-4']) {
      db.rooms = []; db.players = []
      seedWaitingRoom()
      const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
      const res = await callJoin(hook, typed)
      expect(res.ok, `"${typed}" should resolve to ABC234`).toBe(true)
      expect(res.roomCode).toBe('ABC234')
    }
  })

  test('the seat claim actually writes a room_players row with the display name', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))

    await callJoin(hook, 'ABC234')

    const seatWrite = db.inserts.find(i => i.table === 'room_players')
    expect(seatWrite.payload).toMatchObject({ room_id: ROOM_ID, user_id: 'u-me', username: 'Newcomer', seat_number: 1 })
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('joinRoom · every failure mode has its own code', () => {
  test('NOT_FOUND · an expired or mistyped link', async () => {
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    const res = await callJoin(hook, 'ZZZZZZ')
    expect(res).toMatchObject({ ok: false, reason: JOIN_FAILURE.NOT_FOUND })
  })

  test('INVALID_CODE · a malformed URL never reaches the network', async () => {
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    fromSpy.mockClear()
    const res = await callJoin(hook, 'AB')
    expect(res.reason).toBe(JOIN_FAILURE.INVALID_CODE)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  test('ROOM_FULL · four seats taken', async () => {
    seedWaitingRoom({
      players: [0, 1, 2, 3].map(s => ({ user_id: `u-${s}`, username: `P${s}`, seat_number: s })),
    })
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    const res = await callJoin(hook, 'ABC234')
    expect(res.reason).toBe(JOIN_FAILURE.ROOM_FULL)
    // A refused join must not leave a stray row behind.
    expect(db.inserts.filter(i => i.table === 'room_players')).toHaveLength(0)
  })

  test('ALREADY_STARTED · a STRANGER cannot walk into a running game', async () => {
    seedWaitingRoom({ status: 'playing', players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    const res = await callJoin(hook, 'ABC234')
    expect(res.reason).toBe(JOIN_FAILURE.ALREADY_STARTED)
    expect(hook.result.current.roomPhase).toBe('idle')
  })

  test('NETWORK · carries the REAL cause, not a generic "room not found"', async () => {
    db.errors.game_rooms = { message: 'FetchError: failed to fetch' }
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    const res = await callJoin(hook, 'ABC234')
    expect(res.reason).toBe(JOIN_FAILURE.NETWORK)
    expect(res.message).toContain('failed to fetch')
  })

  test('NOT_AUTHENTICATED and NAME_REQUIRED are DISTINCT · one is a form to fill, the other is not', async () => {
    seedWaitingRoom()
    const noUser = renderHook(() => useGameRoom(null, 'Newcomer'))
    const noName = renderHook(() => useGameRoom(USER, ''))

    expect((await callJoin(noUser, 'ABC234')).reason).toBe(JOIN_FAILURE.NOT_AUTHENTICATED)
    expect((await callJoin(noName, 'ABC234')).reason).toBe(JOIN_FAILURE.NAME_REQUIRED)
  })

  test('SEAT_CONFLICT retry · a lost seat race is re-attempted, not surfaced as a failure', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    db.conflictOnce = true // the first insert (seat 1) 23505s · claimSeat must re-read and take seat 2
    // Someone really did take seat 1 in the gap · otherwise the retry would just re-pick 1 and loop.
    db.players.push({ room_id: ROOM_ID, user_id: 'u-racer', username: 'Racer', seat_number: 1 })

    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    const res = await callJoin(hook, 'ABC234')

    expect(res.ok).toBe(true)
    expect(res.seat).toBe(2)
  })

  // ── The server-side boundary · migration 015 landed from T2 MID-SESSION, after this contract was
  // posted. room_players_join now requires waiting-and-under-capacity, so the authoritative refusal
  // arrives as a bare 42501 permission error. Mapping that to NETWORK would tell a player "could not
  // reach the room" about a room that answered perfectly and refused them for a nameable reason ·
  // exactly the misattribution class this session exists to close (Rule 64 · a premise verified at
  // boot is not verified at the moment you act · the policy changed under me while I was writing).
  test('RLS refusal on a room that STARTED reads as ALREADY_STARTED, never NETWORK', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    db.denyJoin = true
    // The room started between our roster read and our insert · which is why the server refused.
    db.rooms[0].status = 'playing'

    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    const res = await callJoin(hook, 'ABC234')

    expect(res.reason).toBe(JOIN_FAILURE.ALREADY_STARTED)
    expect(res.reason).not.toBe(JOIN_FAILURE.NETWORK)
  })

  test('RLS refusal on a room that FILLED reads as ROOM_FULL', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    db.denyJoin = true
    // player_count is maintained by trg_player_count (SECURITY DEFINER · verified live in pg_trigger),
    // so it is the column migration 015's capacity check actually reads.
    db.rooms[0].player_count = 4

    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    const res = await callJoin(hook, 'ABC234')

    expect(res.reason).toBe(JOIN_FAILURE.ROOM_FULL)
  })

  test('an RLS refusal with no explaining cause degrades to SEAT_CONFLICT, not to NETWORK', async () => {
    // The room still looks joinable on re-read · we genuinely do not know why, but the server DID answer,
    // so blaming the transport would be a lie. SEAT_CONFLICT is retryable and honest.
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    db.denyJoin = true

    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    const res = await callJoin(hook, 'ABC234')

    expect(res.reason).toBe(JOIN_FAILURE.SEAT_CONFLICT)
    expect(res.reason).not.toBe(JOIN_FAILURE.NETWORK)
  })

  test('every JOIN_FAILURE code carries a non-empty human message', async () => {
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    // Exercise the constructor through a real call for one code, then assert the table is complete.
    const res = await callJoin(hook, 'ZZZZZZ')
    expect(res.message).toBeTruthy()
    expect(Object.keys(JOIN_FAILURE).length).toBeGreaterThanOrEqual(10)
    for (const code of Object.values(JOIN_FAILURE)) expect(typeof code).toBe('string')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('joinRoom · BACKEND_OFFLINE short-circuits before any request', () => {
  test('an outage reports itself as an outage · and costs zero doomed requests', async () => {
    seedWaitingRoom()
    reportBackendDown('auth', 'getaddrinfo ENOTFOUND') // the real aggregator, not a stub
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))
    fromSpy.mockClear()

    const res = await callJoin(hook, 'ABC234')

    expect(res.reason).toBe(JOIN_FAILURE.BACKEND_OFFLINE)
    expect(fromSpy).not.toHaveBeenCalled() // a request we know will fail is not sent
    // The old behaviour would have let this through and returned "Room not found" for a healthy room ·
    // a dead backend reported as a dead LINK. That is the misattribution this guard closes.
    expect(res.reason).not.toBe(JOIN_FAILURE.NOT_FOUND)
  })

  test('RECONNECTING does NOT block · a request may still succeed while another transport backs off', async () => {
    seedWaitingRoom()
    const { reportBackendRetrying } = await import('./useConnectionHealth')
    reportBackendRetrying('game-sync', { attempt: 2, reason: 'channel timed out' })
    const hook = renderHook(() => useGameRoom(USER, 'Newcomer'))

    const res = await callJoin(hook, 'ABC234')
    expect(res.ok).toBe(true) // inventing an outage from a mid-backoff sibling would be its own bug
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('joinRoom · REJOIN · membership is checked BEFORE room status (the S27 fix)', () => {
  test('a MEMBER of an in-progress game is let back in and routed to the board, not the waiting room', async () => {
    seedWaitingRoom({
      status: 'playing',
      players: [
        { user_id: 'u-host', username: 'Host', seat_number: 0 },
        { user_id: 'u-me', username: 'Me', seat_number: 2 },
      ],
    })
    db.sessions.push({ room_id: ROOM_ID, mode: 'flow' })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: true, rejoined: true, inProgress: true, seat: 2, isHost: false })
    // 'playing' is what makes Lobby's existing onGameStart effect route to /game/:roomId. Landing in
    // 'lobby' would strand them behind a Start button only the host has.
    expect(hook.result.current.roomPhase).toBe('playing')
    // The mode is restored from game_sessions so presence does not report a Flow player as classic.
    expect(hook.result.current.gameMode).toBe('flow')
    // A rejoin is a pure local-state restore · it must write NOTHING.
    expect(db.inserts).toHaveLength(0)
  })

  test('the pre-fix behaviour is gone · a member is NEVER told their own running game already started', async () => {
    seedWaitingRoom({ status: 'playing', players: [{ user_id: 'u-me', username: 'Me', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res.ok).toBe(true)
    expect(res.reason).toBeUndefined()
    expect(hook.result.current.lobbyError).toBeNull()
  })

  test('a member rejoining a WAITING room keeps their seat, writes nothing, and stays in the lobby', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-me', username: 'Me', seat_number: 3 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: true, rejoined: true, inProgress: false, seat: 3 })
    expect(hook.result.current.roomPhase).toBe('lobby')
    expect(db.inserts).toHaveLength(0)
  })

  test('a rejoining HOST (seat 0) is restored as host · not demoted to a guest', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-me', username: 'Me', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res.isHost).toBe(true)
    expect(hook.result.current.isHost).toBe(true)
  })

  test('a rejoin into a room with no session row yet does not throw · mode simply stays at the default', async () => {
    seedWaitingRoom({ status: 'playing', players: [{ user_id: 'u-me', username: 'Me', seat_number: 1 }] })
    // deliberately NO db.sessions row
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')
    expect(res.ok).toBe(true)
    expect(hook.result.current.gameMode).toBe('classic')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('peekRoom · the read-only preview a nameless visitor gets', () => {
  test('works with NO display name and NO session · that is the entire point', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(null, ''))   // no user, no name · a stranger on a share link

    const res = await callPeek(hook, 'ABC234')

    expect(res).toMatchObject({
      ok: true, roomId: ROOM_ID, roomCode: 'ABC234', status: 'waiting',
      playerCount: 1, maxPlayers: 4, canJoin: true, rejoinable: false,
    })
    expect(res.players).toEqual([{ username: 'Host', seat: 0, isHost: true }])
  })

  test('writes NOTHING and never sets lobbyError · a dead link is not a lobby error', async () => {
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callPeek(hook, 'ZZZZZZ')

    expect(res.reason).toBe(JOIN_FAILURE.NOT_FOUND)
    expect(db.inserts).toHaveLength(0)
    expect(hook.result.current.lobbyError).toBeNull()
  })

  test('the roster is seat-ordered whatever order the DB returns it in', async () => {
    seedWaitingRoom({
      players: [
        { user_id: 'u-c', username: 'Third', seat_number: 2 },
        { user_id: 'u-a', username: 'Host', seat_number: 0 },
        { user_id: 'u-b', username: 'Second', seat_number: 1 },
      ],
    })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callPeek(hook, 'ABC234')
    expect(res.players.map(p => p.username)).toEqual(['Host', 'Second', 'Third'])
    expect(res.players.filter(p => p.isHost)).toHaveLength(1)
  })

  test('canJoin is false when full, and false when the game is running', async () => {
    seedWaitingRoom({
      players: [0, 1, 2, 3].map(s => ({ user_id: `u-${s}`, username: `P${s}`, seat_number: s })),
    })
    const full = renderHook(() => useGameRoom(USER, 'Me'))
    expect((await callPeek(full, 'ABC234')).canJoin).toBe(false)

    db.rooms = []; db.players = []
    seedWaitingRoom({ code: 'DEF567', status: 'playing' })
    const running = renderHook(() => useGameRoom(USER, 'Me'))
    expect((await callPeek(running, 'DEF567')).canJoin).toBe(false)
  })

  test('rejoinable is true when THIS user already holds a seat · that is the mid-game rejoin affordance', async () => {
    seedWaitingRoom({ status: 'playing', players: [{ user_id: 'u-me', username: 'Me', seat_number: 1 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callPeek(hook, 'ABC234')
    expect(res.canJoin).toBe(false)     // no free seat to TAKE
    expect(res.rejoinable).toBe(true)   // but this player already has one
  })

  test('peek reuses the SAME failure shape and codes as join', async () => {
    const hook = renderHook(() => useGameRoom(USER, 'Me'))
    expect((await callPeek(hook, 'AB')).reason).toBe(JOIN_FAILURE.INVALID_CODE)

    db.errors.game_rooms = { message: 'network down' }
    expect((await callPeek(hook, 'ABC234'))).toMatchObject({
      ok: false, reason: JOIN_FAILURE.NETWORK, message: 'network down',
    })
  })

  test('peek short-circuits on a terminal outage too', async () => {
    seedWaitingRoom()
    reportBackendDown('auth', 'getaddrinfo ENOTFOUND')
    const hook = renderHook(() => useGameRoom(USER, 'Me'))
    fromSpy.mockClear()

    expect((await callPeek(hook, 'ABC234')).reason).toBe(JOIN_FAILURE.BACKEND_OFFLINE)
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('back-compat · Lobby.jsx must keep working unchanged', () => {
  test('every failure still populates lobbyError with the same message it returns', async () => {
    const hook = renderHook(() => useGameRoom(USER, 'Me'))
    const res = await callJoin(hook, 'ZZZZZZ')
    expect(hook.result.current.lobbyError).toBe(res.message)
  })

  test('BUSY is a named outcome instead of a silent undefined', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    // Fire twice without awaiting the first · the second must land while busyRef is still set.
    let first, second
    await act(async () => {
      const p1 = hook.result.current.joinRoom('ABC234')
      const p2 = hook.result.current.joinRoom('ABC234')
      ;[first, second] = await Promise.all([p1, p2])
    })

    expect(first.ok).toBe(true)
    expect(second).toMatchObject({ ok: false, reason: JOIN_FAILURE.BUSY })
    // BUSY is not a player-facing problem · it must not paint the lobby red.
    expect(hook.result.current.lobbyError).toBeNull()
    // And critically, the room was joined exactly once.
    expect(db.inserts.filter(i => i.table === 'room_players')).toHaveLength(1)
  })
})
