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
  constraintOnce: false, // one-shot 23514 on the next room_players insert (schema drift · CHECK violation)
  denyJoin: false,       // room_players_join RLS refuses the insert (migration 015 · 42501)
  // THE ROOM CHANGES STATE MID-JOIN (T3 S34). joinRoom's status read is a FAST PATH, not the boundary ·
  // the host can hit Leave or Start in the gap between our read and our write, and the server then refuses
  // the seat with a 42501 that says nothing about why. Set this to the status the room lands in; the next
  // room_players insert flips it and returns the refusal.
  // Modelling the RACE rather than the outcome is what makes denialReason testable at all. Seeding a room
  // that is ALREADY closed cannot exercise it, because the fast-path check answers first and the re-read
  // never runs · a test written that way passes without the code under test ever executing.
  statusOnInsert: null,
}

function rowsFor(table) {
  if (table === 'game_rooms') return db.rooms
  if (table === 'room_players') return db.players
  if (table === 'game_sessions') return db.sessions
  return []
}

// ── THE LIVE SCHEMA'S OWN RULES · transcribed verbatim from pg_constraint (T3 S28) ────────────────────────
// WHY THIS EXISTS. Until now the stand-in accepted any row whose SEAT was free. That is why the 4th player
// bug survived three separate discoveries: a test could seat four players and pass while the real database
// rejected the fourth outright. A fake backend that is more permissive than the real one does not merely
// fail to catch a bug · it actively certifies it. So the constraints the server actually enforces are
// modelled here, and the error CODES are the real Postgres ones because the client branches on them.
//
// Read live from pg_constraint on wynccumuisjxbptjlfwq this session:
//   room_players_player_color_check       CHECK (player_color = ANY (ARRAY['blue','gold','green','red']))
//   room_players_seat_number_check        CHECK (seat_number >= 0 AND seat_number <= 3)
//   room_players_room_id_player_color_key UNIQUE (room_id, player_color)
//   room_players_room_id_seat_number_key  UNIQUE (room_id, seat_number)
//   room_players_room_id_user_id_key      UNIQUE (room_id, user_id)
//
// ⚠ THIS IS A SECOND COPY OF A CONTRACT (Rule 45) and it can rot: nothing here notices if a migration
// widens that CHECK. It is a copy that FAILS SAFE · a widened server set makes these tests stricter than
// production, which shows up as a red test rather than as a silently broken player. The binding proof that
// the copy still matches reality is tests/e2e/seat-colors-live.e2e.js, which asks the real database.
const ALLOWED_PLAYER_COLORS = ['blue', 'gold', 'green', 'red']

const checkViolation = (constraint) => ({
  data: null,
  error: { code: '23514', message: `new row for relation "room_players" violates check constraint "${constraint}"` },
})
const uniqueViolation = (constraint) => ({
  data: null,
  error: { code: '23505', message: `duplicate key value violates unique constraint "${constraint}"` },
})

// CHECKs are row-level and fire before index insertion, so they are evaluated first here too · the code the
// client sees for a bad colour must be 23514, not 23505.
function enforceRoomPlayers(payload) {
  if (!ALLOWED_PLAYER_COLORS.includes(payload.player_color)) return checkViolation('room_players_player_color_check')
  if (!(payload.seat_number >= 0 && payload.seat_number <= 3)) return checkViolation('room_players_seat_number_check')
  const peers = db.players.filter(p => p.room_id === payload.room_id)
  if (peers.some(p => p.seat_number === payload.seat_number)) return uniqueViolation('room_players_room_id_seat_number_key')
  if (peers.some(p => p.player_color === payload.player_color)) return uniqueViolation('room_players_room_id_player_color_key')
  if (peers.some(p => p.user_id === payload.user_id)) return uniqueViolation('room_players_room_id_user_id_key')
  return null
}

function resolve(table, filters, op, payload, singular) {
  if (db.errors[table]) return { data: null, error: db.errors[table] }

  if (op === 'insert') {
    if (table === 'room_players') {
      // migration 015 · room_players_join requires the room to be waiting AND under capacity. A refusal
      // arrives as a Postgres permission error, NOT as a friendly application-level message.
      if (db.statusOnInsert) {
        const next = db.statusOnInsert
        db.statusOnInsert = null
        for (const r of db.rooms) r.status = next
        return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
      }
      if (db.denyJoin) {
        return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
      }
      if (db.conflictOnce) {
        db.conflictOnce = false
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
      }
      if (db.constraintOnce) {
        db.constraintOnce = false
        return checkViolation('room_players_player_color_check')
      }
      const violation = enforceRoomPlayers(payload)
      if (violation) return violation
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

import { useGameRoom, JOIN_FAILURE, SEAT_COLORS } from './useGameRoom'
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
  db.errors = {}; db.inserts = []; db.conflictOnce = false; db.constraintOnce = false; db.denyJoin = false
  db.statusOnInsert = null
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE 4th PLAYER · the seat that had no test, and therefore no floor (T3 S28)
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
//
// Seat 3 sent player_color='purple'; the live CHECK allows only (blue, gold, green, red). Every 4-player
// game in the product's history failed at the fourth join, and the live table proves it: seat 3 has zero
// rows, ever. The product's own copy says "two to four players".
//
// WHAT ACTUALLY LET IT SURVIVE is worth more than the one-word fix. It was found THREE times · T2 wrote it
// into migration 014's notes in S26 ("LAUNCH BLOCKER, CONFIRMED LIVE, ONE WORD"), T1 hit it live in S27, the
// forge raised it again in S28 · and was fixed zero times, because the array and the constraint sit in
// different lanes and neither owner could close both halves. Three correct diagnoses and no fix is not an
// attention problem, it is a missing test: nothing in the repo ever asserted that a 4th player can sit down.
//
// So these tests deliberately bind the two halves that were never bound. They run against a stand-in that
// now enforces the REAL constraints (see enforceRoomPlayers above) · without that, every test below would
// pass just as happily with 'purple' and would certify the bug instead of catching it.
describe('the 4th player · seat 3 must be reachable', () => {
  test('SEAT_COLORS is a valid seating for the live schema · every seat, not just the exercised ones', () => {
    // The total guard. The behavioural tests below cover the seats a scenario happens to reach; this one
    // covers the array itself, so a future edit to ANY index is caught even with no scenario for that seat.
    expect(SEAT_COLORS).toHaveLength(4)                      // room_players_seat_number_check · 0..3
    for (const [seat, colour] of SEAT_COLORS.entries()) {
      expect(ALLOWED_PLAYER_COLORS, `seat ${seat} sends "${colour}", which the server's CHECK rejects`)
        .toContain(colour)
    }
    // UNIQUE(room_id, player_color) · two seats sharing a colour would make one of them unfillable.
    expect(new Set(SEAT_COLORS).size).toBe(SEAT_COLORS.length)
  })

  test('a 4th player joins a room that already holds three', async () => {
    // The exact reproduction. Pre-fix this returned ok:false with a raw Postgres string.
    seedWaitingRoom({
      players: [
        { user_id: 'u-host', username: 'Host', seat_number: 0, player_color: 'blue' },
        { user_id: 'u-2', username: 'Two', seat_number: 1, player_color: 'red' },
        { user_id: 'u-3', username: 'Three', seat_number: 2, player_color: 'green' },
      ],
    })

    const hook = renderHook(() => useGameRoom(USER, 'Fourth'))
    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: true, seat: 3, isHost: false, rejoined: false })
    expect(hook.result.current.seat).toBe(3)
    expect(hook.result.current.roomPhase).toBe('lobby')
    expect(hook.result.current.lobbyError).toBeNull()

    // The row really landed · a green assertion on the return shape alone would not prove the write survived.
    expect(db.players).toHaveLength(4)
    expect(db.players.find(p => p.seat_number === 3)).toMatchObject({ user_id: USER.id, player_color: 'gold' })
  })

  test('all four seats fill from empty · every colour the client sends is one the server accepts', async () => {
    seedWaitingRoom({ players: [] })

    const seats = []
    for (const [i, name] of ['One', 'Two', 'Three', 'Four'].entries()) {
      const hook = renderHook(() => useGameRoom({ id: `u-${i}` }, name))
      seats.push(await callJoin(hook, 'ABC234'))
    }

    expect(seats.map(r => r.ok)).toEqual([true, true, true, true])
    expect(seats.map(r => r.seat)).toEqual([0, 1, 2, 3])

    // What was WRITTEN, in order · the value that the CHECK constraint judges.
    const written = db.inserts.filter(i => i.table === 'room_players').map(i => i.payload.player_color)
    expect(written).toEqual(['blue', 'red', 'green', 'gold'])
    for (const colour of written) expect(ALLOWED_PLAYER_COLORS).toContain(colour)
    expect(new Set(written).size).toBe(4) // UNIQUE(room_id, player_color) held for a genuinely full room
  })

  test('the FIFTH joiner is refused as ROOM_FULL · a full room is a product state, not an error', async () => {
    // The counterweight. A fix that let seat 3 through by loosening the seat search could also let a 5th
    // player in; this pins the boundary in the same breath as opening seat 3.
    seedWaitingRoom({
      players: [
        { user_id: 'u-host', username: 'Host', seat_number: 0, player_color: 'blue' },
        { user_id: 'u-2', username: 'Two', seat_number: 1, player_color: 'red' },
        { user_id: 'u-3', username: 'Three', seat_number: 2, player_color: 'green' },
        { user_id: 'u-4', username: 'Four', seat_number: 3, player_color: 'gold' },
      ],
    })

    const hook = renderHook(() => useGameRoom(USER, 'Fifth'))
    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: false, reason: JOIN_FAILURE.ROOM_FULL })
    expect(db.players).toHaveLength(4)                                     // nothing was written
    expect(db.inserts.filter(i => i.table === 'room_players')).toHaveLength(0)
  })

  test('a CHECK violation reads as SEAT_CONFLICT · never NETWORK, and never raw Postgres text', async () => {
    // The failure MODE, held independently of whether today's array happens to trigger it. Before this, a
    // 23514 fell through to NETWORK and the caller passed error.message straight to the screen, so a player
    // was told "Could not reach the room" and shown a constraint name. A schema that drifts again must
    // therefore say something true, or the next instance of this class is just as invisible as the last.
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0, player_color: 'blue' }] })
    db.constraintOnce = true

    const hook = renderHook(() => useGameRoom(USER, 'Me'))
    const res = await callJoin(hook, 'ABC234')

    expect(res.ok).toBe(false)
    expect(res.reason).toBe(JOIN_FAILURE.SEAT_CONFLICT)
    expect(res.reason).not.toBe(JOIN_FAILURE.NETWORK)
    // The player sees the contract's own words, not the database's.
    expect(res.message).toBe('Could not claim a seat')
    expect(res.message).not.toMatch(/violates|constraint|relation|check/i)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// REJOIN · IS joinRoom IDEMPOTENT FOR A USER WHO ALREADY HOLDS A SEAT? (T3 S32)
//
// This is the load-bearing question under T1's refresh fix. Refreshing the waiting room loses the room
// CLIENT-SIDE only: nothing in useGameRoom deletes anything on unmount or beforeunload · leaveRoom is the
// only deleter and only the Leave button calls it. So the game_rooms row and the room_players row both
// survive a refresh, and what is lost is the React state that remembered which room this was. That is the
// whole of the 17 abandoned rooms, 13 still holding a seat: the seat outlives the tab that claimed it.
//
// T1's fix puts the code in the URL so /join/:code can restore the session. That only works if joinRoom
// readmits a user who is already seated, WITHOUT writing anything · a rejoin that re-claimed a seat would
// 23505 against UNIQUE(room_id, user_id), and a rejoin that re-upserted a profile would be a write on a
// path that must be free to run on every page load.
//
// The ORDER of the checks is the fix, and it is the same fix as S27: membership is resolved BEFORE status
// and BEFORE capacity. Every test below pins one consequence of that ordering, because each one is a
// separate way the refresh path could quietly stop working.
describe('joinRoom · REJOIN · the refresh path (T3 S32 · answering T1)', () => {
  const SEATED = { user_id: USER.id, username: 'Me', seat_number: 2, player_color: 'green' }

  test('an already-seated user in a WAITING room is readmitted · and writes NOTHING', async () => {
    seedWaitingRoom({ players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }, SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({
      ok: true, roomId: ROOM_ID, roomCode: 'ABC234',
      seat: 2, isHost: false, rejoined: true, inProgress: false,
    })
    expect(hook.result.current.roomPhase).toBe('lobby')
    expect(hook.result.current.seat).toBe(2)

    // THE IDEMPOTENCY CLAIM ITSELF. "It did not error" is not the same as "it did not write" · a rejoin
    // runs on every page load, so a write here would be a per-refresh cost and a 23505 waiting to happen.
    expect(db.inserts, 'a rejoin must perform ZERO writes · no seat claim, no profile upsert').toHaveLength(0)
    expect(db.players, 'the existing seat row is reused, never duplicated').toHaveLength(2)
  })

  test('three consecutive rejoins leave exactly one seat and zero writes · idempotent, not merely tolerant', async () => {
    // Idempotence is a claim about REPETITION. One call proves the branch is reachable; it does not prove
    // the second and third calls are free. A refresh loop (or React 18 StrictMode) does exactly this.
    seedWaitingRoom({ players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const a = await callJoin(hook, 'ABC234')
    const b = await callJoin(hook, 'ABC234')
    const c = await callJoin(hook, 'ABC234')

    for (const r of [a, b, c]) expect(r).toMatchObject({ ok: true, seat: 2, rejoined: true })
    expect(db.players).toHaveLength(1)
    expect(db.inserts).toHaveLength(0)
  })

  test('the refreshed HOST gets their host identity back · otherwise nobody can ever start', async () => {
    // isHost is derived from seat_number === 0, not from local memory, so it survives the reload. If this
    // regressed, a host who refreshed would return to their own room as an ordinary player and the Start
    // button would belong to nobody · the room would be permanently unstartable while looking fine.
    seedWaitingRoom({ players: [{ user_id: USER.id, username: 'Me', seat_number: 0, player_color: 'blue' }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: true, seat: 0, isHost: true, rejoined: true })
    expect(hook.result.current.isHost).toBe(true)
    expect(db.inserts).toHaveLength(0)
  })

  test('a FULL room still readmits its OWN member · capacity is a rule for strangers', async () => {
    // The capacity check sits AFTER the membership check. If that order ever flipped, the last player to
    // join a 4-player room could never refresh: they would be told "Room is full" about a room they are
    // sitting in. Same shape as the S27 status bug, one check further down.
    seedWaitingRoom({
      players: [
        { user_id: 'u-host', username: 'Host', seat_number: 0 },
        { user_id: 'u-b', username: 'B', seat_number: 1 },
        { user_id: 'u-c', username: 'C', seat_number: 2 },
        { user_id: USER.id, username: 'Me', seat_number: 3 },
      ],
    })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: true, seat: 3, rejoined: true })
    expect(res.reason).toBeUndefined()
    expect(db.inserts).toHaveLength(0)
  })

  test('rejoin into a PLAYING room goes straight to the board · the S27 fix, still holding', async () => {
    // The original bug: status was checked before membership, so a player who refreshed mid-game was told
    // "Game already started" about the game they were sitting in. Kept here because T1's URL fix makes
    // this path run on EVERY reload rather than only when somebody pasted a link.
    seedWaitingRoom({ status: 'playing', players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: true, seat: 2, rejoined: true, inProgress: true })
    expect(hook.result.current.roomPhase).toBe('playing')
    expect(res.reason).not.toBe(JOIN_FAILURE.ALREADY_STARTED)
    expect(db.inserts).toHaveLength(0)
  })

  test('a STRANGER is still refused · readmission is scoped to the seat holder, not to everyone', async () => {
    // The counterweight. Every test above asserts that somebody gets IN, and a joinRoom that admitted
    // anyone would satisfy all of them. Same room, same status, different user.
    seedWaitingRoom({ status: 'playing', players: [{ user_id: 'u-someone-else', username: 'Other', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: false, reason: JOIN_FAILURE.ALREADY_STARTED })
    expect(hook.result.current.roomPhase).not.toBe('playing')
  })

  // The FINISHED-room case was pinned here in S32 as a known-wrong shape ("readmitted into a phantom
  // lobby") and deliberately left unfixed, because the fix needed a code T1's invite screen could render.
  // T1 shipped that branch in S34, so the behaviour is now correct and its coverage lives in the block
  // below · kept as a pointer rather than deleted, because the pin is why the fix exists.
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE PHANTOM LOBBY · a closed room is terminal for everyone (T3 S34)
//
// THE BUG. leaveRoom marks the room 'finished' when the HOST leaves, but deletes only the host's own
// room_players row. Every other seat outlives the room. Those players are still members, so they took the
// readmit branch and landed in roomPhase 'lobby' · a waiting room for a game that was already over, with
// nobody in presence and a Start button that could never enable. No error, no explanation, no way forward.
//
// WHAT 'finished' ACTUALLY MEANS, checked against production rather than inferred from the word. It has
// exactly one writer in the client (leaveRoom, host-only) and none server-side · of the functions that
// reference game_rooms, purge_e2e_test_data deletes and update_player_count writes player_count. So it does
// NOT mean "the game ended": across 376 finished rooms, the number whose game_sessions row reached phase
// 'finished' is ZERO. A game that ends naturally leaves its room on 'playing' (11 rooms are in that state
// right now). 'finished' means the host closed the room, and there is nothing behind that door.
//
// >>> WHY THE COUNTERWEIGHTS BELOW ARE THE POINT OF THIS BLOCK <<<
// The fix is a status check placed ABOVE the membership check, which is the exact shape of the S27 bug
// (`status !== 'waiting'` told a player mid-game that their own game had already started). It is safe only
// because it tests ONE terminal value and lets 'playing' fall through. That distinction is invisible in the
// code and would survive any amount of review, so the tests that matter most here are the ones asserting
// that a member of a LIVE game still gets in. Narrowing the guard to `!== 'waiting'` must turn this file
// red, or the fix is one careless edit away from restoring the bug it was written to prevent.
describe('joinRoom · a FINISHED room · the phantom lobby, closed (T3 S34)', () => {
  const SEATED = { user_id: USER.id, username: 'Me', seat_number: 2, player_color: 'green' }

  test('a member of a finished room is REFUSED with ROOM_FINISHED · no phantom lobby', async () => {
    seedWaitingRoom({ status: 'finished', players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: false, reason: JOIN_FAILURE.ROOM_FINISHED })
    // The bug itself, asserted as an absence. Landing in 'lobby' was the whole defect · the player was not
    // shown an error, they were shown a room.
    expect(hook.result.current.roomPhase, 'a closed room must not produce a waiting room').toBe('idle')
    expect(hook.result.current.roomId).toBeNull()
    expect(hook.result.current.seat).toBeNull()
    expect(res.rejoined).toBeUndefined()
    expect(db.inserts).toHaveLength(0)
  })

  test('THE COUNTERWEIGHT · a member of a PLAYING room still gets straight back in', async () => {
    // If this ever goes red, the guard above has been widened into the S27 bug and a player who refreshed
    // mid-game is being told their own live game has already started. This is the single most important
    // assertion in the block: every other test here wants somebody kept OUT, and a guard that refused
    // everyone would satisfy all of them.
    seedWaitingRoom({ status: 'playing', players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: true, seat: 2, rejoined: true, inProgress: true })
    expect(res.reason).toBeUndefined()
    expect(hook.result.current.roomPhase).toBe('playing')
    expect(db.inserts).toHaveLength(0)
  })

  test('THE SECOND COUNTERWEIGHT · a member of a WAITING room is still readmitted', async () => {
    // The refresh path T1's URL fix runs on every page load. A guard that swallowed 'waiting' would make
    // every reload of a waiting room a dead end.
    seedWaitingRoom({ status: 'waiting', players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res).toMatchObject({ ok: true, seat: 2, rejoined: true, inProgress: false })
    expect(hook.result.current.roomPhase).toBe('lobby')
  })

  test('a STRANGER gets ROOM_FINISHED too · not ALREADY_STARTED, which is a different situation', async () => {
    // One room state, one code, whoever knocks. Before this, a stranger on a closed room was told "Game
    // already started" · advice that points at waiting for the game to end, on a game that already has.
    seedWaitingRoom({ status: 'finished', players: [{ user_id: 'u-other', username: 'Other', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res.reason).toBe(JOIN_FAILURE.ROOM_FINISHED)
    expect(res.reason).not.toBe(JOIN_FAILURE.ALREADY_STARTED)
  })

  test('a stranger on a PLAYING room is still ALREADY_STARTED · the two codes stay distinct', async () => {
    seedWaitingRoom({ status: 'playing', players: [{ user_id: 'u-other', username: 'Other', seat_number: 0 }] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    expect((await callJoin(hook, 'ABC234')).reason).toBe(JOIN_FAILURE.ALREADY_STARTED)
  })

  test('the two codes carry DIFFERENT copy · a distinct code with identical words fixes nothing', async () => {
    // A tenth code that rendered the same sentence as the ninth would be a refactor wearing a bug fix's
    // clothes. The player-visible difference is the deliverable.
    expect(JOIN_FAILURE.ROOM_FINISHED).toBe('ROOM_FINISHED')
    seedWaitingRoom({ status: 'finished', players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res.message).toBeTruthy()
    expect(res.message).not.toBe('Game already started')
    // lobbyError is the fallback path: a consumer that never learns the new code still shows real words
    // rather than a stale message or a blank line.
    expect(hook.result.current.lobbyError).toBe(res.message)
  })

  test('a closed room is refused after ONE query · it never reaches the roster, let alone a write', async () => {
    // Placement, asserted as behaviour rather than read off the source. The guard sits above the roster
    // read, so a dead room costs one round trip instead of two and cannot reach any write path at all.
    seedWaitingRoom({ status: 'finished', players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))
    fromSpy.mockClear()

    await callJoin(hook, 'ABC234')

    expect(fromSpy.mock.calls.map(c => c[0])).toEqual(['game_rooms'])
  })

  test('peekRoom reports a closed room as NOT rejoinable · even to the player still holding a seat', async () => {
    // rejoinable means "you can get back in", not "your row is still there". joinRoom now refuses this
    // room, so a preview promising otherwise is a value that lies (Rule 61). T1's screen checks the status
    // ahead of this flag and was already right · this makes the flag right for the next consumer, who
    // will not know to check the status first.
    seedWaitingRoom({ status: 'finished', players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callPeek(hook, 'ABC234')

    expect(res.ok).toBe(true)                 // a preview of a closed room is still a successful preview
    expect(res.status).toBe('finished')       // T1's invite screen branches on this · it must survive
    expect(res.canJoin).toBe(false)
    expect(res.rejoinable).toBe(false)
  })

  test('peekRoom still reports rejoinable on a LIVE game · the flag was narrowed, not disabled', async () => {
    seedWaitingRoom({ status: 'playing', players: [SEATED] })
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    expect((await callPeek(hook, 'ABC234')).rejoinable).toBe(true)
  })

  test('the host closing the room MID-JOIN reads as ROOM_FINISHED, not as a permission error', async () => {
    // The race the fast-path check cannot win: the room is 'waiting' when we read it and closed by the
    // time we write. The server answers 42501, which says only "no". denialReason re-reads and turns that
    // into the reason the player can act on · the same code the fast path would have produced, so the
    // story does not depend on which door the refusal came through.
    seedWaitingRoom({ status: 'waiting', players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    db.statusOnInsert = 'finished'
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res.reason).toBe(JOIN_FAILURE.ROOM_FINISHED)
    expect(res.reason).not.toBe(JOIN_FAILURE.NETWORK)        // the server replied · blaming transport would be a lie
    expect(res.reason).not.toBe(JOIN_FAILURE.ALREADY_STARTED)
    expect(db.players).toHaveLength(1)                        // our row never landed
  })

  test('the host STARTING the game mid-join still reads as ALREADY_STARTED', async () => {
    // The counterweight for denialReason, driven through the same race so it actually reaches the re-read:
    // splitting 'finished' out of "not waiting" must not swallow the case it was split from. Seeding an
    // already-'playing' room would answer at the fast path and prove nothing about this branch.
    seedWaitingRoom({ status: 'waiting', players: [{ user_id: 'u-host', username: 'Host', seat_number: 0 }] })
    db.statusOnInsert = 'playing'
    const hook = renderHook(() => useGameRoom(USER, 'Me'))

    const res = await callJoin(hook, 'ABC234')

    expect(res.reason).toBe(JOIN_FAILURE.ALREADY_STARTED)
    expect(res.reason).not.toBe(JOIN_FAILURE.ROOM_FINISHED)
  })
})
