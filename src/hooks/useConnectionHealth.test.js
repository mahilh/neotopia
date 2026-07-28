// NeoTopia · the backend-health aggregate (T3 S26).
// This is the flag a degraded UI reads, so the tests are about the CONTRACT that UI depends on: worst-source
// wins, a recovery actually clears, an unmounted transport stops voting, the DOM witness the E2E gates on is
// really written, and a snapshot stable enough for useSyncExternalStore not to re-render forever.

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  BACKEND_STATUS, useBackendHealth, getBackendHealth,
  reportBackendUp, reportBackendRetrying, reportBackendDown,
  clearBackendSource, registerBackendRetry, retryBackend, __resetBackendHealth,
} from './useConnectionHealth'

beforeEach(() => { __resetBackendHealth() })

describe('aggregate status · worst source wins', () => {
  test('starts online · a cold start with nothing observed is not an outage', () => {
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
    expect(getBackendHealth().isDegraded).toBe(false)
  })

  test('one broken transport degrades the whole app even while the other is healthy', () => {
    reportBackendUp('auth')
    reportBackendRetrying('game-sync', { attempt: 2, reason: 'channel timed out' })
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.RECONNECTING)
    expect(getBackendHealth().source).toBe('game-sync') // the UI can name which pipe broke
    expect(getBackendHealth().attempt).toBe(2)
  })

  test('offline outranks reconnecting regardless of report order', () => {
    reportBackendDown('auth', 'anon sign-in failed')
    reportBackendRetrying('game-sync', { attempt: 1 })
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.OFFLINE)

    __resetBackendHealth()
    reportBackendRetrying('game-sync', { attempt: 1 })
    reportBackendDown('auth', 'anon sign-in failed')
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.OFFLINE)
  })

  test('recovery of the failing source restores online', () => {
    reportBackendDown('auth', 'network down')
    expect(getBackendHealth().isOffline).toBe(true)
    reportBackendUp('auth')
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
    expect(getBackendHealth().reason).toBeNull()
  })

  test('recovering only ONE of two broken sources still leaves the app degraded', () => {
    reportBackendDown('auth', 'a')
    reportBackendDown('game-sync', 'b')
    reportBackendUp('auth')
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.OFFLINE)
    expect(getBackendHealth().source).toBe('game-sync')
  })

  test('clearBackendSource removes a vanished transport without claiming it recovered', () => {
    reportBackendDown('game-sync', 'left the room mid-outage')
    clearBackendSource('game-sync')
    expect(getBackendHealth().status).toBe(BACKEND_STATUS.ONLINE)
    expect(getBackendHealth().source).toBeNull()
  })

  test('isDegraded covers BOTH failure states · isOffline only the terminal one', () => {
    reportBackendRetrying('game-sync', { attempt: 1 })
    expect(getBackendHealth().isDegraded).toBe(true)
    expect(getBackendHealth().isOffline).toBe(false) // still retrying · a UI can say "reconnecting…"
    reportBackendDown('game-sync', 'gave up')
    expect(getBackendHealth().isOffline).toBe(true)  // nothing is retrying any more · offer a retry
  })
})

describe('DOM + gray-box witness (what the backend-down E2E asserts)', () => {
  test('reflects the status onto html[data-backend-status]', () => {
    expect(document.documentElement.dataset.backendStatus).toBe(BACKEND_STATUS.ONLINE)
    reportBackendRetrying('game-sync', { attempt: 1 })
    expect(document.documentElement.dataset.backendStatus).toBe(BACKEND_STATUS.RECONNECTING)
    reportBackendDown('game-sync', 'gave up')
    expect(document.documentElement.dataset.backendStatus).toBe(BACKEND_STATUS.OFFLINE)
    reportBackendUp('game-sync')
    expect(document.documentElement.dataset.backendStatus).toBe(BACKEND_STATUS.ONLINE)
  })

  test('publishes a read-only window.__neotopia_health snapshot', () => {
    reportBackendDown('auth', 'anon sign-in failed')
    expect(window.__neotopia_health.status).toBe(BACKEND_STATUS.OFFLINE)
    expect(window.__neotopia_health.reason).toBe('anon sign-in failed')
    expect(Object.isFrozen(window.__neotopia_health)).toBe(true) // a consumer cannot fake health
  })
})

describe('useBackendHealth · the React binding', () => {
  test('re-renders subscribers when the aggregate changes', () => {
    const { result } = renderHook(() => useBackendHealth())
    expect(result.current.status).toBe(BACKEND_STATUS.ONLINE)
    act(() => { reportBackendDown('auth', 'unreachable') })
    expect(result.current.status).toBe(BACKEND_STATUS.OFFLINE)
    expect(result.current.isDegraded).toBe(true)
    expect(result.current.reason).toBe('unreachable')
  })

  test('the snapshot reference is stable when nothing observable changed', () => {
    // useSyncExternalStore requires a cached snapshot · returning a fresh object per read is the classic
    // "getSnapshot should be cached" infinite re-render. A redundant report must not mint a new reference.
    reportBackendRetrying('game-sync', { attempt: 1, reason: 'x' })
    const first = getBackendHealth()
    reportBackendRetrying('game-sync', { attempt: 1, reason: 'x' })
    expect(getBackendHealth()).toBe(first)
  })

  test('exposes retry() so a UI can recover without knowing which transport broke', () => {
    const authRetry = vi.fn()
    registerBackendRetry('auth', authRetry)
    const { result } = renderHook(() => useBackendHealth())
    act(() => { result.current.retry() })
    expect(authRetry).toHaveBeenCalledTimes(1)
  })
})

describe('retry registry', () => {
  test('fires every registered handler', () => {
    const a = vi.fn(); const b = vi.fn()
    registerBackendRetry('auth', a)
    registerBackendRetry('game-sync', b)
    expect(retryBackend()).toBe(2)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  test('one throwing handler never blocks its peers', () => {
    const good = vi.fn()
    registerBackendRetry('auth', () => { throw new Error('boom') })
    registerBackendRetry('game-sync', good)
    expect(() => retryBackend()).not.toThrow()
    expect(good).toHaveBeenCalledTimes(1)
  })

  test('unregister only removes its OWN handler · a later registration under the same key survives', () => {
    // Two useAuth instances (Lobby + GameRoom) register under 'auth'. When the first unmounts it must not
    // delete the second's handler, or the retry button silently stops working.
    const first = vi.fn()
    const unregisterFirst = registerBackendRetry('auth', first)
    const second = vi.fn()
    registerBackendRetry('auth', second)

    unregisterFirst()
    retryBackend()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
