// NeoTopia · THE EVIDENCE TEST for the bounded reconnect (T3 S26 · forge TASK 1).
//
// The forge asked for proof that retries "back off and terminate, not just that it builds" · so this file
// asserts the SCHEDULE and the TERMINATION, never merely that a reconnect happens. What it pins down:
//   1. the exact delay sequence (1s · 2s · 4s · 8s · 16s · 30s) · a regression to the old fixed 1000ms fails;
//   2. the loop STOPS · attempts are bounded at RECONNECT_MAX_ATTEMPTS and the terminal state is 'offline';
//   3. ONE timer per failure even when both failure signals fire together · the double-scheduling that made
//      the console go 6 → 18 in seconds rather than 6 → 7;
//   4. a queued reconnect cannot survive unmount (the timer that resurrected a removed channel);
//   5. a successful SUBSCRIBED hands the whole budget back, so a long session cannot slowly exhaust it.
//
// METHOD · fake timers + a controllable channel mock. subscribeStatus decides what the mocked
// .subscribe(cb) reports, and the mock records every supabase.channel() call, so "how many reconnects
// happened and when" is read straight off the mock instead of being inferred from a wall clock. Advancing
// time by exactly delay-1ms then 1ms is what makes the assertion about the SCHEDULE and not just the order.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const h = vi.hoisted(() => ({
  subscribeStatus: 'CHANNEL_ERROR',   // default: the backend is unreachable
  systemHandler: null,                 // captured .on('system') callback · lets a test fire BOTH signals
}))

vi.mock('../lib/supabase', () => {
  const makeChannel = () => {
    const channel = {
      on(kind, _cfg, cb) {
        // .on('system', {}, cb) · .on('postgres_changes', cfg, cb). Capture the system handler so a test can
        // reproduce the real-world case where the transport error and the channel error arrive together.
        if (kind === 'system') h.systemHandler = typeof _cfg === 'function' ? _cfg : cb
        return this
      },
      subscribe(cb) { Promise.resolve().then(() => cb(h.subscribeStatus)); return this },
    }
    return channel
  }
  const builder = {
    select() { return this },
    eq() { return this },
    update() { return this },
    insert() { return this },
    maybeSingle() { return Promise.resolve({ data: { id: 'session-1', state: null }, error: null }) },
  }
  const stub = {
    channel: vi.fn(() => makeChannel()),
    removeChannel: vi.fn(),
    from: vi.fn(() => builder),
  }
  return { supabase: stub, default: stub }
})

import {
  useGameSync, reconnectDelayMs,
  RECONNECT_BASE_MS, RECONNECT_MAX_MS, RECONNECT_MAX_ATTEMPTS,
} from './useGameSync'
import { supabase } from '../lib/supabase'
import { BACKEND_STATUS, getBackendHealth, __resetBackendHealth } from './useConnectionHealth'

// The connect count is the honest measure of retry pressure: every reconnect creates a fresh channel.
const connects = () => supabase.channel.mock.calls.length

// Let the mocked subscribe callback (a resolved microtask) run without advancing fake timers.
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

beforeEach(() => {
  vi.useFakeTimers()
  h.subscribeStatus = 'CHANNEL_ERROR'
  h.systemHandler = null
  supabase.channel.mockClear()
  supabase.removeChannel.mockClear()
  __resetBackendHealth()
})

afterEach(() => { vi.useRealTimers() })

describe('reconnectDelayMs · the backoff curve (pure)', () => {
  test('doubles from the base and clamps at the ceiling', () => {
    expect([1, 2, 3, 4, 5, 6].map(reconnectDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000])
  })

  test('never returns the old fixed 1000ms for a later attempt · and never exceeds the cap', () => {
    expect(reconnectDelayMs(2)).not.toBe(RECONNECT_BASE_MS) // the regression guard on the original bug
    for (const n of [7, 12, 99]) expect(reconnectDelayMs(n)).toBe(RECONNECT_MAX_MS)
  })

  test('is defensive about junk attempt numbers (never a 0ms hot loop)', () => {
    for (const n of [0, -5, 0.4, NaN]) expect(reconnectDelayMs(n)).toBe(RECONNECT_BASE_MS)
  })
})

describe('useGameSync · reconnect backs off and TERMINATES (forge TASK 1 evidence)', () => {
  test('each retry waits its full backoff · nothing fires early', async () => {
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    expect(connects()).toBe(1) // the initial connect · it failed, so a retry is now queued

    for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
      const delay = reconnectDelayMs(attempt)
      const before = connects()

      // One millisecond short of the scheduled delay: still nothing. This is what proves the delay is the
      // backoff value and not merely "some timer eventually fired".
      await act(async () => { await vi.advanceTimersByTimeAsync(delay - 1) })
      expect(connects()).toBe(before)

      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(connects()).toBe(before + 1)
    }
  })

  test('gives up after RECONNECT_MAX_ATTEMPTS and reports a terminal offline state', async () => {
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()

    // Burn the whole budget. Ten minutes is far past the ~61s the schedule spans.
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })

    const settled = connects()
    expect(settled).toBe(1 + RECONNECT_MAX_ATTEMPTS) // initial + exactly the budget · nothing more
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.OFFLINE)
    expect(getBackendHealth().isOffline).toBe(true)

    // THE ANTI-STORM ASSERTION · another ten minutes must add nothing. The old code would have added ~600.
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })
    expect(connects()).toBe(settled)
    expect(vi.getTimerCount()).toBe(0) // no timer is left running · the loop is genuinely dead, not slowed
  })

  test('passes through RECONNECTING before OFFLINE · the UI can distinguish "retrying" from "gave up"', async () => {
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()

    expect(getBackendHealth().status).toBe(BACKEND_STATUS.RECONNECTING)
    expect(getBackendHealth().source).toBe('game-sync')
    expect(getBackendHealth().isDegraded).toBe(true)
    expect(getBackendHealth().isOffline).toBe(false) // still recoverable · not terminal yet

    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.OFFLINE)
  })

  test('both failure signals arriving together schedule ONE retry, not two (the 6 → 18 bug)', async () => {
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    const before = connects()

    // The real-world shape of a dead backend: the transport reports an error AND the channel reports
    // CHANNEL_ERROR for the same underlying failure. Pre-fix, each scheduled its own 1000ms timer.
    act(() => { h.systemHandler?.({ status: 'error' }) })
    act(() => { h.systemHandler?.({ status: 'error' }) })

    await act(async () => { await vi.advanceTimersByTimeAsync(reconnectDelayMs(1)) })
    expect(connects()).toBe(before + 1) // ONE reconnect · not two, not three
  })

  test('a successful subscribe clears the degraded flag AND restores the full budget', async () => {
    h.subscribeStatus = 'CHANNEL_ERROR'
    renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.RECONNECTING)

    // The backend comes back · the next scheduled attempt succeeds.
    h.subscribeStatus = 'SUBSCRIBED'
    await act(async () => { await vi.advanceTimersByTimeAsync(reconnectDelayMs(1)) })
    await flush()
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
    expect(vi.getTimerCount()).toBe(0)

    // A LATER outage must start again at 1s, not continue from attempt 2 · otherwise a long session slowly
    // spends its budget on unrelated flaps and eventually gives up on a backend that is fine.
    h.subscribeStatus = 'CHANNEL_ERROR'
    const before = connects()
    act(() => { h.systemHandler?.({ status: 'error' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS) })
    expect(connects()).toBe(before + 1) // fired at 1000ms → the counter really did reset
  })

  test('unmount kills the queued reconnect · no channel is resurrected after cleanup', async () => {
    const { unmount } = renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    const before = connects()

    unmount()
    expect(vi.getTimerCount()).toBe(0) // the pending backoff timer was cleared by the effect cleanup

    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })
    expect(connects()).toBe(before) // nothing reconnected behind the unmounted hook
  })

  test('unmount drops the game-sync source so a dead room stops dragging the global flag down', async () => {
    const { unmount } = renderHook(() => useGameSync('room-1', 'user-1'))
    await flush()
    expect(getBackendHealth().isDegraded).toBe(true)

    unmount()
    // The player left the room · that transport no longer exists, so the aggregate must not keep reporting
    // it as broken (the lobby would otherwise stay permanently degraded after quitting a game mid-outage).
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
  })

  test('a null roomId never connects and never reports health (no false alarm on the lobby)', async () => {
    renderHook(() => useGameSync(null, 'user-1'))
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(connects()).toBe(0)
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
  })
})
