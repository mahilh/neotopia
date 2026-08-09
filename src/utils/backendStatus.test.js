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

// ── The 429 is a queue, not an outage (T1 S30) ───────────────────────────────────────────────────
// Anonymous sign-ins are capped at 30/hour per IP. On any shared IP · a classroom, a cafe, an office,
// a mobile carrier NAT · the 31st new visitor that hour is refused, and until this the app told them
// "Can't reach NeoTopia's servers". The servers are up. Waiting a few minutes actually works. The
// difference between those two sentences is a player who waits and a player who leaves.
describe('deriveBackendStatus · a rate-limited visitor is not told the game is broken', () => {
  // The literal string Supabase returns for a 429 on signInAnonymously, seen live in S29 as
  // window.__neotopia_health = { status: 'offline', source: 'auth', reason: 'Request rate limit reached' }.
  const LIMITED = health({ status: 'offline', source: 'auth', reason: 'Request rate limit reached', isOffline: true })

  it('blames the network allowance, not the servers', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: null, user: null, health: LIMITED })
    expect(s.isRateLimited).toBe(true)
    expect(s.headline).not.toMatch(/can't reach|cannot reach|servers/i)
    expect(`${s.headline} ${s.detail}`, 'it must say who is affected and that waiting works')
      .toMatch(/network/i)
    expect(s.detail).toMatch(/few minutes|try again/i)
  })

  it('still shuts the rooms and keeps the tone every selector is keyed on', () => {
    // A refused visitor has no session, so nothing they click can work · the copy is the only change.
    const s = deriveBackendStatus({ authLoading: false, authError: null, user: null, health: LIMITED })
    expect(s.canUseRooms).toBe(false)
    expect(s.tone).toBe(TONE_OFFLINE)
    expect(s.isOffline).toBe(true)
    expect(s.reason).toBe('Request rate limit reached') // the raw cause survives for a screenshot
  })

  it('reads the same cause off the bare auth error, with no health snapshot wired', () => {
    const s = deriveBackendStatus({ authLoading: false, authError: 'AuthApiError: Request rate limit reached', user: null })
    expect(s.isRateLimited).toBe(true)
  })

  it('falls back to the outage copy for any other failure, and when nothing matches', () => {
    // The match is on vendor text, so it WILL eventually go stale. Staleness must cost the improvement,
    // never the correctness · an unrecognised reason has to land on exactly today's behaviour.
    for (const reason of ['CHANNEL_ERROR', 'Failed to fetch', 'Database is paused', 'quota exhausted']) {
      const s = deriveBackendStatus({ authLoading: false, authError: null, user: null, health: health({ status: 'offline', reason, isOffline: true }) })
      expect(s.isRateLimited, `"${reason}" is not a rate limit`).toBe(false)
      expect(s.headline).toMatch(/can't reach/i)
    }
  })
})
