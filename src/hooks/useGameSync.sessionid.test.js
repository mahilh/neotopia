// NeoTopia · proves useGameSync EXPOSES a reactive, non-null sessionId (T3 S16 · Rule 61).
// The point is not "does the return object have a sessionId key" (a signature check) — it is "does the
// value become the real game_sessions.id once the session loads, reactively." So this drives the actual
// load path: a mocked Supabase channel whose .subscribe() reports SUBSCRIBED → fetchAndSeed() runs →
// from('game_sessions').select('id,state').eq().maybeSingle() resolves a known id → the hook re-renders
// with sessionId set. Starts null (Rule 61: null until the first fetchAndSeed), then equals the UUID.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const SESSION_ID = '11111111-2222-4333-8444-555555555555'

// Controllable Supabase mock. The channel records the subscribe callback so the test can let it fire
// SUBSCRIBED (the mock invokes it synchronously on subscribe, mirroring a fast connect). from() returns a
// thenable query builder resolving the seeded session row.
let subscribeStatus = 'SUBSCRIBED'
vi.mock('../lib/supabase', () => {
  const channel = {
    on() { return this },
    subscribe(cb) { Promise.resolve().then(() => cb(subscribeStatus)); return this },
  }
  const sessionRow = { id: '11111111-2222-4333-8444-555555555555', state: { turnNumber: 1 } }
  const builder = {
    select() { return this },
    eq() { return this },
    update() { return this },
    insert() { return this },
    maybeSingle() { return Promise.resolve({ data: sessionRow, error: null }) },
  }
  const stub = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    from: vi.fn(() => builder),
  }
  return { supabase: stub, default: stub }
})

import { useGameSync } from './useGameSync'

describe('useGameSync · sessionId exposure (T3 S16 · Rule 61)', () => {
  beforeEach(() => { subscribeStatus = 'SUBSCRIBED' })

  test('the return object includes a sessionId field (the contract T1 wires against)', () => {
    const { result } = renderHook(() => useGameSync(null, 'user-abc')) // null roomId · no connect
    expect(result.current).toHaveProperty('sessionId')
    expect(result.current.sessionId).toBeNull() // Rule 61: null until a session actually loads
  })

  test('sessionId becomes the real game_sessions.id once the session loads (reactive · non-null)', async () => {
    const { result } = renderHook(() => useGameSync('room-xyz', 'user-abc'))
    // It starts null, then the SUBSCRIBED → fetchAndSeed path resolves the row and re-renders with the id.
    await waitFor(() => expect(result.current.sessionId).toBe(SESSION_ID))
    expect(result.current.sessionId).not.toBeNull()
    expect(typeof result.current.sessionId).toBe('string')
  })

  test('still exposes the existing API alongside sessionId (no contract regression)', () => {
    const { result } = renderHook(() => useGameSync(null, 'user-abc'))
    for (const k of ['sendMove', 'pushState', 'broadcast', 'sessionId']) {
      expect(result.current).toHaveProperty(k)
    }
  })
})
