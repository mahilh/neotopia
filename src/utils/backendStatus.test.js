import { describe, it, expect } from 'vitest'
import {
  deriveBackendStatus,
  TONE_OK,
  TONE_CONNECTING,
  TONE_RECONNECTING,
  TONE_OFFLINE,
} from './backendStatus'

const USER = { id: 'u-1' }

// Mirrors the useBackendHealth() snapshot shape from src/hooks/useConnectionHealth.js (T3 S26).
// Built here rather than imported so this suite stays pure and never couples to that module's
// internals · if their snapshot shape ever changes, these literals are the contract that fails.
const health = (over = {}) => ({
  status: 'online', source: null, attempt: 0, reason: null,
  isDegraded: false, isOffline: false, ...over,
})
const ONLINE       = health()
const RECONNECTING = health({ status: 'reconnecting', source: 'game-sync', attempt: 3, reason: 'CHANNEL_ERROR', isDegraded: true })
const OFFLINE      = health({ status: 'offline', source: 'auth', attempt: 0, reason: 'Failed to fetch', isDegraded: true, isOffline: true })

describe('deriveBackendStatus · healthy', () => {
  it('is ok once auth settled with a user and health is online', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: null, user: USER, health: ONLINE })
    expect(s.tone).toBe(TONE_OK)
    expect(s.canUseRooms).toBe(true)
    expect(s.showBanner).toBe(false)
    expect(s.isOffline).toBe(false)
  })

  it('shows no player-facing copy when nothing is wrong', () => {
    const s = deriveBackendStatus({ authLoading: false, user: USER, health: ONLINE })
    expect(s.headline).toBe('')
    expect(s.detail).toBe('')
    expect(s.reason).toBe(null)
  })

  it('treats an absent health snapshot as "nothing has failed", not as a failure', () => {
    // Matches useConnectionHealth's own cold-start meaning · an unwired caller must not render a
    // scary state about a backend the app has not yet observed.
    const s = deriveBackendStatus({ authLoading: false, authError: null, user: USER })
    expect(s.tone).toBe(TONE_OK)
    expect(s.canUseRooms).toBe(true)
  })
})

describe('deriveBackendStatus · connecting', () => {
  it('reports connecting while auth is still settling', () => {
    const s = deriveBackendStatus({ authLoading: true, authError: null, user: null, health: ONLINE })
    expect(s.tone).toBe(TONE_CONNECTING)
  })

  it('shuts rooms while connecting but shows no banner (the spinner already says it)', () => {
    const s = deriveBackendStatus({ authLoading: true, user: null, health: ONLINE })
    expect(s.canUseRooms).toBe(false)
    expect(s.showBanner).toBe(false)
  })
})

describe('deriveBackendStatus · offline', () => {
  it('is offline when the health aggregate gave up', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: null, user: USER, health: OFFLINE })
    expect(s.tone).toBe(TONE_OFFLINE)
    expect(s.canUseRooms).toBe(false)
    expect(s.showBanner).toBe(true)
    expect(s.isOffline).toBe(true)
  })

  // The signal that already existed and was already being discarded by Lobby. Kept as an independent
  // witness so the fix does not depend on the health-reporting wiring staying in place.
  it('is offline on a raw authError even when health still says online', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: 'Failed to fetch', user: null, health: ONLINE })
    expect(s.tone).toBe(TONE_OFFLINE)
    expect(s.canUseRooms).toBe(false)
  })

  // The genuinely silent case: no error was raised and no session exists.
  it('is offline when auth settled with no user and no error and no health report', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: null, user: null })
    expect(s.tone).toBe(TONE_OFFLINE)
    expect(s.reason).toBe('No session was established.')
  })

  it('prefers the aggregate reason over the bare auth message (it names the dead transport)', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: 'some other text', user: null, health: OFFLINE })
    expect(s.reason).toBe('Failed to fetch')
  })

  it('never puts the raw cause in the headline', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: 'Failed to fetch', user: null })
    expect(s.headline).not.toContain('Failed to fetch')
    expect(s.headline.length).toBeGreaterThan(0)
    expect(s.detail.length).toBeGreaterThan(0)
  })

  it('outranks a still-true loading flag · never spin behind a hopeful spinner', () => {
    const s = deriveBackendStatus({ authLoading: true, authError: 'network down', user: null, health: ONLINE })
    expect(s.tone).toBe(TONE_OFFLINE)
  })
})

describe('deriveBackendStatus · reconnecting', () => {
  // Auth is terminal by construction in useConnectionHealth, so RECONNECTING in the lobby can only
  // come from 'game-sync', which is not even mounted there. Shutting rooms would punish the player
  // for a channel unrelated to creating a room.
  it('keeps rooms usable while a transport retries inside its budget', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: null, user: USER, health: RECONNECTING })
    expect(s.tone).toBe(TONE_RECONNECTING)
    expect(s.canUseRooms).toBe(true)
  })

  it('still says something rather than staying silent', () => {
    const s = deriveBackendStatus({ authLoading: false, user: USER, health: RECONNECTING })
    expect(s.showBanner).toBe(true)
    expect(s.headline.length).toBeGreaterThan(0)
    expect(s.isOffline).toBe(false)
  })

  it('offline outranks reconnecting when both are somehow set', () => {
    const both = health({ isDegraded: true, isOffline: true, reason: 'gone' })
    expect(deriveBackendStatus({ authLoading: false, user: USER, health: both }).tone).toBe(TONE_OFFLINE)
  })
})

describe('deriveBackendStatus · robustness', () => {
  it('treats a missing argument object as offline rather than throwing', () => {
    expect(() => deriveBackendStatus()).not.toThrow()
    expect(deriveBackendStatus().tone).toBe(TONE_OFFLINE)
  })

  it('does not treat an empty-string authError as a failure', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: '', user: USER, health: ONLINE })
    expect(s.tone).toBe(TONE_OK)
  })

  it('coerces a non-string authError into a readable reason', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: { message: 'boom' }, user: null })
    expect(s.tone).toBe(TONE_OFFLINE)
    expect(typeof s.reason).toBe('string')
  })

  // canUseRooms is the ONLY behavioural gate · the banner and the buttons must never disagree.
  it('never offers rooms while showing the offline banner', () => {
    for (const input of [
      { authLoading: false, authError: 'x', user: null },
      { authLoading: false, authError: null, user: null },
      { authLoading: false, authError: null, user: USER, health: OFFLINE },
    ]) {
      const s = deriveBackendStatus(input)
      expect(s.isOffline && s.canUseRooms).toBe(false)
    }
  })
})
