// NeoTopia · proves the Flow-mode wiring: the mode chosen at createRoom(mode) is persisted on the
// game_sessions row at startGame (game_sessions.mode · migration 010 · T3 S16 Task B).
//
// NOTE on the real chain (corrected from the forge premise · Rule 62): createRoom inserts only the
// game_rooms row; the game_sessions row — where `mode` lives — is inserted in startGame. So mode is stored
// in hook state at createRoom and written by startGame's session INSERT. This test drives the real
// create→start flow against a chainable/thenable Supabase mock and asserts the captured insert payload.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Supabase mock · a chainable builder that is also thenable (so `await` resolves at any chain depth),
// records every insert as { table, payload }, and gives insertRoomWithRetry a room id via .single().
const inserts = []
const ROOM = { id: 'room-1', room_code: 'ABC234' }
const ROSTER = [{ seat_number: 0, user_id: 'u1', username: 'Host', is_ready: true }]

function makeBuilder(table) {
  const b = {
    insert(payload) { inserts.push({ table, payload }); return b },
    upsert() { return b },
    update() { return b },
    delete() { return b },
    select() { return b },
    eq() { return b },
    order() { return b },
    single() { return Promise.resolve({ data: ROOM, error: null }) },           // insertRoomWithRetry
    maybeSingle() { return Promise.resolve({ data: null, error: null }) },
    // thenable · awaiting the builder directly (insert / select.eq.order) resolves to per-table rows
    then(onF, onR) {
      const data = table === 'room_players' ? ROSTER : []
      return Promise.resolve({ data, error: null }).then(onF, onR)
    },
  }
  return b
}

vi.mock('../lib/supabase', () => {
  const stub = { channel: vi.fn(), removeChannel: vi.fn(), from: vi.fn((t) => makeBuilder(t)) }
  return { supabase: stub, default: stub }
})

// usePresence is its own realtime concern · stub it so the room hook is testable in isolation.
vi.mock('./usePresence', () => ({
  usePresence: () => ({
    players: [], updatePresence: vi.fn(), sendGameStart: vi.fn(() => Promise.resolve()),
    gameStarted: false, resetPresence: vi.fn(),
  }),
}))

import { useGameRoom } from './useGameRoom'

const USER = { id: 'u1' }
function sessionInsert() { return inserts.find(i => i.table === 'game_sessions')?.payload }

describe('createRoom(mode) → game_sessions.mode (T3 S16 · Flow wiring)', () => {
  beforeEach(() => { inserts.length = 0 })

  test('createRoom("flow") persists mode=flow on the session at startGame', async () => {
    const { result } = renderHook(() => useGameRoom(USER, 'Host'))
    await act(async () => { await result.current.createRoom('flow') })
    expect(result.current.gameMode).toBe('flow')          // stored at createRoom
    await act(async () => { await result.current.startGame() })
    expect(sessionInsert(), 'no game_sessions insert captured').toBeTruthy()
    expect(sessionInsert().mode).toBe('flow')             // written at startGame
  })

  test('createRoom() with no mode defaults to classic on the session', async () => {
    const { result } = renderHook(() => useGameRoom(USER, 'Host'))
    await act(async () => { await result.current.createRoom() })
    expect(result.current.gameMode).toBe('classic')
    await act(async () => { await result.current.startGame() })
    expect(sessionInsert().mode).toBe('classic')
  })

  test('an unknown mode falls back to classic (getModeConfig guard · no CHECK on the column)', async () => {
    const { result } = renderHook(() => useGameRoom(USER, 'Host'))
    await act(async () => { await result.current.createRoom('chaos-mode') })
    expect(result.current.gameMode).toBe('classic')
    await act(async () => { await result.current.startGame() })
    expect(sessionInsert().mode).toBe('classic')
  })
})
