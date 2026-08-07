// NeoTopia · THE SEED-FAILURE HEALTH GAP · closed (T3 S27 · carried honestly from S26).
//
// THE GAP, AS I WROTE IT DOWN IN S26 AND DELIBERATELY DID NOT WIDEN INTO THEN:
//   "fetchAndSeed failure does not report health · if subscribe SUCCEEDS but the REST seed fails, the app
//    still reads 'online'."
// The realtime socket and the REST seed are two different pipes to the same backend, and only the socket
// was wired to the health aggregator. A client could hold a live channel while owning NO authoritative game
// state · a blank or stale board under a UI insisting everything was fine. That is the same class of lie
// the whole S26 backend-health work existed to kill, just one layer in.
//
// WHAT MADE IT SUBTLE, AND WHY THE OBVIOUS FIX IS WRONG:
// fetchAndSeed used to return a bare `false` for BOTH "the REST call failed" and "there is no session row
// yet". The second is not a failure at all · it is every player sitting in a lobby before the host presses
// Start. Reporting that as unhealthy would drive every waiting lobby into a reconnect storm: a far worse
// bug than the one being fixed. So the first two tests here are the guard on the FIX ITSELF.
//
// THE TERMINATION CLAIM IS THE ONE I CARE ABOUT MOST. The naive repair · report the failure, keep resetting
// the retry budget on SUBSCRIBED · produces an infinite loop, because the socket keeps succeeding: subscribe
// ok → budget reset → seed fails → reconnect → subscribe ok → budget reset → … forever. That is a brand-new
// storm of exactly the class the S26 backoff was built to kill. Tying the budget reset to "subscribed AND
// seeded" is what makes the ladder monotonic and the failure terminal.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const h = vi.hoisted(() => ({
  subscribeStatus: 'SUBSCRIBED',       // the socket is healthy in this file · the SEED is what varies
  seedResult: { data: { id: 'session-1', state: null }, error: null },
  seedCalls: 0,
}))

vi.mock('../lib/supabase', () => {
  const makeChannel = () => ({
    on() { return this },
    subscribe(cb) { Promise.resolve().then(() => cb(h.subscribeStatus)); return this },
  })
  const builder = {
    select() { return this },
    eq() { return this },
    update() { return this },
    insert() { return this },
    maybeSingle() { h.seedCalls += 1; return Promise.resolve(h.seedResult) },
  }
  const stub = { channel: vi.fn(() => makeChannel()), removeChannel: vi.fn(), from: vi.fn(() => builder) }
  return { supabase: stub, default: stub }
})

import { useGameSync, reconnectDelayMs, RECONNECT_MAX_ATTEMPTS } from './useGameSync'
import { supabase } from '../lib/supabase'
import { BACKEND_STATUS, getBackendHealth, __resetBackendHealth } from './useConnectionHealth'

const connects = () => supabase.channel.mock.calls.length
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })

// The two shapes maybeSingle() can produce that used to be indistinguishable downstream.
const SEED_OK      = { data: { id: 'session-1', state: null }, error: null }
const SEED_NO_ROW  = { data: null, error: null }                                  // lobby · healthy
const SEED_FAILED  = { data: null, error: { message: 'TypeError: Failed to fetch' } } // REST is down

beforeEach(() => {
  vi.useFakeTimers()
  h.subscribeStatus = 'SUBSCRIBED'
  h.seedResult = SEED_OK
  h.seedCalls = 0
  supabase.channel.mockClear()
  __resetBackendHealth()
})
afterEach(() => { vi.useRealTimers() })

describe('the false-positive guard · a lobby with no session row is HEALTHY', () => {
  test('no game_sessions row yet reports ONLINE and schedules nothing', async () => {
    // Every player in a waiting room is in exactly this state until the host presses Start. If this
    // reported unhealthy, every lobby in the game would enter a reconnect storm.
    h.seedResult = SEED_NO_ROW
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()

    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
    expect(vi.getTimerCount()).toBe(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })
    expect(connects()).toBe(1) // one connect, ever · no retry was ever queued
  })

  test('a normal seeded connect still reports ONLINE (the unchanged happy path)', async () => {
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('a failed REST seed is REPORTED · the S26 gap', () => {
  test('subscribe succeeds but the seed errors → the app does NOT read online', async () => {
    h.seedResult = SEED_FAILED
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()

    // THE REGRESSION GUARD. Pre-fix this asserted ONLINE · a live socket over no state at all.
    expect(getBackendHealth().status).not.toBe(BACKEND_STATUS.ONLINE)
    expect(getBackendHealth().isDegraded).toBe(true)
    expect(getBackendHealth().source).toBe('game-sync')
  })

  test('the reported reason names the SEED, not a generic channel error · the layer that broke is legible', async () => {
    h.seedResult = SEED_FAILED
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()

    // Rule 63 / the S26 evolution lesson: a failure must name the layer that broke, not the symptom that
    // tripped. "channel error" here would send the next reader hunting a websocket that is perfectly fine.
    expect(getBackendHealth().reason).toContain('seed')
    expect(getBackendHealth().reason).toContain('Failed to fetch')
  })

  test('it starts as RECONNECTING, not OFFLINE · one failed REST call is not terminal', async () => {
    h.seedResult = SEED_FAILED
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.RECONNECTING)
    expect(getBackendHealth().isOffline).toBe(false)
  })
})

describe('recovery and TERMINATION · the naive fix loops forever, this one does not', () => {
  test('a persistently failing seed walks the budget and lands OFFLINE · it does NOT loop', async () => {
    // This is the assertion the whole design turns on. The socket SUBSCRIBES SUCCESSFULLY every single
    // round here (h.subscribeStatus never changes), so any implementation that resets the retry budget on
    // the socket alone reconnects forever and never reaches a terminal state.
    h.seedResult = SEED_FAILED
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()

    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })

    expect(connects()).toBe(1 + RECONNECT_MAX_ATTEMPTS) // initial + exactly the budget · bounded
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.OFFLINE)
    expect(vi.getTimerCount()).toBe(0)                  // genuinely stopped, not merely slowed

    // And it stays stopped · the anti-storm guard, applied to the seed path.
    const settled = connects()
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })
    expect(connects()).toBe(settled)
  })

  test('the retry ladder honours the same backoff curve · it is one owner, not a second timer', async () => {
    h.seedResult = SEED_FAILED
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()

    // A seed-only retry timer would have fired on its own schedule. Reusing scheduleReconnect means the
    // seed failure walks the SAME 1s·2s·4s ladder · one pending timer at a time, always.
    for (const attempt of [1, 2, 3]) {
      const before = connects()
      await act(async () => { await vi.advanceTimersByTimeAsync(reconnectDelayMs(attempt) - 1) })
      expect(connects()).toBe(before)
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(connects()).toBe(before + 1)
    }
  })

  test('when the seed starts working again the flag clears AND the full budget comes back', async () => {
    h.seedResult = SEED_FAILED
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    expect(getBackendHealth().isDegraded).toBe(true)

    h.seedResult = SEED_OK // REST recovers
    await act(async () => { await vi.advanceTimersByTimeAsync(reconnectDelayMs(1)) })
    await flush()

    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
    expect(vi.getTimerCount()).toBe(0)

    // A LATER seed outage must start again at 1s · otherwise a long game slowly spends its budget on
    // unrelated flaps and gives up on a backend that is fine.
    h.seedResult = SEED_FAILED
    const before = connects()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    // force a fresh cycle through the visibility path (below) rather than waiting for a channel event
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(connects()).toBe(before + 1) // fired at 1000ms → the counter really did reset
  })
})

describe('the SECOND call site · a returning tab', () => {
  test('a visibility reseed that fails is reported too · not swallowed', async () => {
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)

    // The tab was backgrounded (mobile is 65% of play · its WS gets suspended) and comes back to a dead REST.
    h.seedResult = SEED_FAILED
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve(); await Promise.resolve()
    })

    // Pre-fix this was a bare fire-and-forget `fetchAndSeed(roomId)` · the player got a stale board and a
    // healthy-looking UI. Fixing only the subscribe call site would have left this half of the hole open.
    expect(getBackendHealth().isDegraded).toBe(true)
    expect(getBackendHealth().reason).toContain('seed')
  })

  test('a visibility reseed that finds no row does NOT report a failure', async () => {
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()

    h.seedResult = SEED_NO_ROW
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve(); await Promise.resolve()
    })

    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
    expect(vi.getTimerCount()).toBe(0)
  })
})
