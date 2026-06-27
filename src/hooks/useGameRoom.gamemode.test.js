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

  test('createRoom("flow") persists mode=flow AND seeds the flow clock (9 tiles · composed value · rule 40)', async () => {
    const { result } = renderHook(() => useGameRoom(USER, 'Host'))
    await act(async () => { await result.current.createRoom('flow') })
    expect(result.current.gameMode).toBe('flow')          // stored at createRoom
    await act(async () => { await result.current.startGame() })
    expect(sessionInsert(), 'no game_sessions insert captured').toBeTruthy()
    expect(sessionInsert().mode).toBe('flow')             // column written at startGame
    // The SEEDED state must agree with the column: startGame passes gameMode to initGame, so flow trims the
    // production-tile clock to END_GAME_TILE=9 (classic is 12). This is the rule-40 composed-value check — the
    // mode is real (the game ends sooner), not a cosmetic column. Guards the T2 initGame(…, mode) seam.
    expect(sessionInsert().production_tiles_remaining).toBe(9)
  })

  test('createRoom() with no mode defaults to classic AND seeds the classic clock (12 tiles)', async () => {
    const { result } = renderHook(() => useGameRoom(USER, 'Host'))
    await act(async () => { await result.current.createRoom() })
    expect(result.current.gameMode).toBe('classic')
    await act(async () => { await result.current.startGame() })
    expect(sessionInsert().mode).toBe('classic')
    expect(sessionInsert().production_tiles_remaining).toBe(12)
  })

  test('an unknown mode falls back to classic (getModeConfig guard · no CHECK on the column)', async () => {
    const { result } = renderHook(() => useGameRoom(USER, 'Host'))
    await act(async () => { await result.current.createRoom('chaos-mode') })
    expect(result.current.gameMode).toBe('classic')
    await act(async () => { await result.current.startGame() })
    expect(sessionInsert().mode).toBe('classic')
  })
})
