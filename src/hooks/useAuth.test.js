import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Mutable session + DB-mock controls. onAuthStateChange fires INITIAL_SESSION on the next microtask
// (mirroring supabase-js, which emits it AFTER hydrating the persisted session) carrying h.session.
// claimUsername now: select-by-user_id → INSERT (first claim) or UPDATE username only (rename · stats
// preserved). h.maybeSingleFn decides which branch; h.insertFn/h.updateEqFn return the mutation result.
const h = vi.hoisted(() => {
  const insertFn = vi.fn(async () => ({ error: null }))
  const updateEqFn = vi.fn(async () => ({ error: null }))
  const updateFn = vi.fn(() => ({ eq: updateEqFn }))
  const maybeSingleFn = vi.fn(async () => ({ data: null, error: null }))
  // T2 S59 · the pool branch. Default: refuse, so a test that forgets to arm it cannot accidentally
  // pass through the success path.
  const signInWithPasswordFn = vi.fn(async () => ({ data: null, error: { message: 'not armed' } }))
  return { session: null, emit: null, insertFn, updateFn, updateEqFn, maybeSingleFn, signInWithPasswordFn }
})

vi.mock('../lib/supabase', () => {
  const auth = {
    signInAnonymously: vi.fn(async () => ({ data: { user: null }, error: { message: 'anon disabled' } })),
    signInWithPassword: h.signInWithPasswordFn,
    onAuthStateChange: vi.fn((cb) => {
      // Captured so a test can deliver a SECOND auth event through the real callback rather than
      // calling the hook's internals · the clobber guard below is about the ORDER two events arrive
      // in, and a harness that fakes the delivery cannot measure that (Rule 99c).
      h.emit = cb
      Promise.resolve().then(() => cb('INITIAL_SESSION', h.session))
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  }
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: h.maybeSingleFn })) })),
    insert: h.insertFn,
    update: h.updateFn,
  }))
  return { supabase: { auth, from }, default: { auth, from } }
})

import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { E2E_POOL_KEY, E2E_POOL_OUTCOME_KEY, POOL_OUTCOME } from '../lib/e2ePool'

const seedCredential = (email = 'e2ehost@neotopia.test', password = 'pw') =>
  localStorage.setItem(E2E_POOL_KEY, JSON.stringify({ email, password, index: 0 }))
const outcome = () => window[E2E_POOL_OUTCOME_KEY]?.outcome ?? null

beforeEach(() => {
  try { localStorage.clear() } catch { /* jsdom */ }
  h.session = null
  h.emit = null
  vi.unstubAllEnvs()                       // VITE_E2E is undefined by default · measured, not assumed
  delete window[E2E_POOL_OUTCOME_KEY]
  supabase.auth.signInAnonymously.mockClear()
  h.signInWithPasswordFn.mockClear()
  h.signInWithPasswordFn.mockResolvedValue({ data: null, error: { message: 'not armed' } })
  h.insertFn.mockClear(); h.insertFn.mockResolvedValue({ error: null })
  h.updateFn.mockClear()
  h.updateEqFn.mockClear(); h.updateEqFn.mockResolvedValue({ error: null })
  h.maybeSingleFn.mockClear(); h.maybeSingleFn.mockResolvedValue({ data: null, error: null })
})

describe('useAuth', () => {
  test('claimUsername returns error when no user is set', async () => {
    h.session = null // INITIAL_SESSION with no persisted session → anon sign-in (mock fails) → user stays null
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    let res
    await act(async () => { res = await result.current.claimUsername('Mahil') })
    expect(res.error).toBe('No user or empty name')
    expect(h.insertFn).not.toHaveBeenCalled()
  })

  test('adopts a persisted session WITHOUT minting a new anon user (the reload-churn fix)', async () => {
    // The exact bug guard: when a session is already persisted, INITIAL_SESSION carries it and
    // we must adopt that user_id · we must NOT call signInAnonymously (which used to overwrite
    // the stored token and change the user_id on every reload).
    h.session = { user: { id: 'persisted-uid-123' } }
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user?.id).toBe('persisted-uid-123')
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  test('first claim INSERTs a fresh profile and stores the name', async () => {
    h.session = { user: { id: 'uid-1' } }
    h.maybeSingleFn.mockResolvedValue({ data: null, error: null }) // no row yet
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let res
    await act(async () => { res = await result.current.claimUsername('Mahil') })
    expect(res.error).toBeNull()
    // Inserts only username + avatar (stat columns lean on their live DB defaults · not re-sent).
    expect(h.insertFn).toHaveBeenCalledWith({ user_id: 'uid-1', username: 'Mahil', avatar_color: 'blue' })
    expect(h.updateFn).not.toHaveBeenCalled()
    expect(result.current.username).toBe('Mahil')
  })

  test('rename UPDATEs only the username · never resets stats (no blanket upsert)', async () => {
    h.session = { user: { id: 'uid-1' } }
    h.maybeSingleFn.mockResolvedValue({ data: { id: 'prof-1' }, error: null }) // row already exists
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let res
    await act(async () => { res = await result.current.claimUsername('NewName') })
    expect(res.error).toBeNull()
    expect(h.updateFn).toHaveBeenCalledWith({ username: 'NewName' })
    expect(h.updateEqFn).toHaveBeenCalledWith('user_id', 'uid-1')
    expect(h.insertFn).not.toHaveBeenCalled()
    // The whole point: the rename payload must carry NO stat columns (elo/games would otherwise zero out).
    const payload = h.updateFn.mock.calls[0][0]
    expect(payload).not.toHaveProperty('elo_rating')
    expect(payload).not.toHaveProperty('games_played')
    expect(payload).not.toHaveProperty('games_won')
    expect(payload).not.toHaveProperty('neotopia_index')
  })

  test('a username 23505 is no longer special-cased as "taken" · usernames are non-unique since migration 012', async () => {
    h.session = { user: { id: 'uid-2' } }
    h.maybeSingleFn.mockResolvedValue({ data: null, error: null }) // new user → insert path
    // This error can no longer occur in prod (UNIQUE(username) was dropped · verified live S25), but the guard
    // locks the removal in: if the retired "name taken" translation ever comes back, this fails. The raw DB
    // message now passes straight through (infra-only error handling · no username special-casing).
    h.insertFn.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint "player_profiles_username_key"' },
    })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let res
    await act(async () => { res = await result.current.claimUsername('Taken') })
    expect(res.error).not.toBe('That name is taken. Please choose another.')
    expect(res.error).toContain('duplicate key')
    expect(result.current.username).not.toBe('Taken') // a failed claim still must not persist
  })

  test('a non-username DB error passes its real message through (not mislabeled "taken")', async () => {
    h.session = { user: { id: 'uid-3' } }
    h.maybeSingleFn.mockResolvedValue({ data: null, error: null })
    h.insertFn.mockResolvedValue({ error: { code: '500', message: 'network unreachable' } })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let res
    await act(async () => { res = await result.current.claimUsername('Whatever') })
    expect(res.error).toBe('network unreachable')
  })
})

// ── THE FIXED CI POOL BRANCH  (T2 S59) ────────────────────────────────────────────────────────────
// This branch shipped in S57 with a rigorous proof that it CANNOT LEAK into a player's bundle
// (e2ePool.test.js, two-sided against real artifacts) and, in S58, a live CI proof that the
// CREDENTIAL authenticates (scripts/verify-pool-signin.cjs, with a negative control). Neither of
// those executes this code. The credential proof uses a raw supabase client in Node · no React, no
// localStorage, no useAuth · so until this file existed the branch had run in no test and no browser
// anywhere, and its own failure mode is to fall through and work perfectly.
//
// MEASURED BEFORE WRITING ANY OF IT: `import.meta.env.VITE_E2E` is UNDEFINED under vitest and
// `vi.stubEnv` reaches it, so both arms are addressable here and the default arm is the shipped one.
// Without that check every test below would have been asserting about whichever arm happened to be
// live (Rule 116 · a source read cannot answer a question whose answer is composed · the composer
// here is Vite's define).
describe('useAuth · the fixed CI identity pool', () => {
  // ── COUNTERWEIGHT, WRITTEN FIRST ────────────────────────────────────────────────────────────────
  // Every assertion in this block is downstream of one claim: that a run which MINTED can never
  // report itself as REUSED. That is the failure the whole feature exists to prevent and the only
  // one with no other symptom · the app works, the spec passes, and a number rises in a dashboard.
  // If this is vacuous, the observable is decorative and the tripwire ("the identity count must drop
  // within 24h of activation, or the instrumentation failed") has nothing behind it.
  test('a run that FELL BACK to anonymous can never report itself as reused', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('VITE_E2E', 'true')
    seedCredential()
    h.signInWithPasswordFn.mockResolvedValue({ data: null, error: { message: 'invalid login credentials' } })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(h.signInWithPasswordFn).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signInAnonymously, 'the fallback must actually have run · otherwise this ' +
      'test is asserting "not reused" about a run that never minted, which is free')
      .toHaveBeenCalledTimes(1)
    expect(outcome()).not.toBe(POOL_OUTCOME.REUSED)
    expect(outcome()).toBe(POOL_OUTCOME.GRANT_FAILED)
    expect(errSpy, 'a configured pool that will not authenticate is a harness defect and must be loud')
      .toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('the branch does not exist without VITE_E2E · a seeded credential is simply not read', async () => {
    // The unit-level half of the elimination proof. The bundle assertion in e2ePool.test.js proves
    // the literal is gone from dist/; this proves the BEHAVIOUR, which is the thing a player would
    // experience, and it fails for a different reason (a gate rewritten to `||`, a flag read from
    // somewhere else). Two witnesses, two mechanisms.
    seedCredential()
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(h.signInWithPasswordFn, 'a production build must never send a password grant, even with a ' +
      'credential sitting in localStorage').not.toHaveBeenCalled()
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(outcome(), 'and it must publish NOTHING · the observable is part of the eliminated branch')
      .toBe(null)
  })

  test('a seeded credential is REUSED · the password grant runs and nothing is minted', async () => {
    vi.stubEnv('VITE_E2E', 'true')
    seedCredential('e2ehost@neotopia.test', 'pw-123')
    h.signInWithPasswordFn.mockResolvedValue({
      data: { user: { id: 'pool-uid-0000-1111', is_anonymous: false } }, error: null,
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(h.signInWithPasswordFn).toHaveBeenCalledWith({
      email: 'e2ehost@neotopia.test', password: 'pw-123',
    })
    expect(result.current.user?.id).toBe('pool-uid-0000-1111')
    expect(supabase.auth.signInAnonymously, 'THE ENTIRE POINT · a converted context mints zero ' +
      'identities. If this is ever called the saving does not happen and nothing else says so')
      .not.toHaveBeenCalled()
    expect(outcome()).toBe(POOL_OUTCOME.REUSED)
    expect(result.current.authError).toBeNull()
  })

  test('no credential seeded is a MEASURED ZERO, not silence', async () => {
    vi.stubEnv('VITE_E2E', 'true')
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(h.signInWithPasswordFn).not.toHaveBeenCalled()
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(outcome(), 'an unseeded context is unconverted, and that has to be READABLE · it is the ' +
      'commonest state today and the one that must not resolve to "fine"')
      .toBe(POOL_OUTCOME.NO_CREDENTIAL)
  })

  test('a grant that returns an ANONYMOUS user is the pool minting in disguise', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('VITE_E2E', 'true')
    seedCredential()
    h.signInWithPasswordFn.mockResolvedValue({
      data: { user: { id: 'anon-from-grant', is_anonymous: true } }, error: null,
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(outcome()).toBe(POOL_OUTCOME.MINTED_IN_DISGUISE)
    expect(outcome()).not.toBe(POOL_OUTCOME.REUSED)
    // The session is still ADOPTED · minting a second identity on top of the one just received
    // would cost double what doing nothing costs.
    expect(result.current.user?.id).toBe('anon-from-grant')
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('a PERSISTED anonymous session preempts the pool · the reachable silent skip', async () => {
    // The one path that bypasses the pool without any of its four outcomes being reached:
    // onAuthStateChange delivers a session, useAuth adopts it, attemptSignIn never runs. A context
    // that signed in anonymously once and then had a credential seeded lands exactly here, and
    // before this record existed it was invisible in every view a human or a script reads.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('VITE_E2E', 'true')
    seedCredential()
    h.session = { user: { id: 'persisted-anon', is_anonymous: true } }

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(h.signInWithPasswordFn, 'the pool genuinely never runs on this path · that is the finding')
      .not.toHaveBeenCalled()
    expect(result.current.user?.id).toBe('persisted-anon')
    expect(outcome()).toBe(POOL_OUTCOME.PERSISTED_ANON_PREEMPTED)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('a persisted NON-anonymous session is the success case and must not be reported as a skip', async () => {
    // The counterweight to the test above · without it, PERSISTED_ANON_PREEMPTED would fire on the
    // pool's own SIGNED_IN echo and the instrument would condemn a working conversion. A gate that
    // reports a failure on a healthy run gets read as noise and switched off (Rule 94a).
    vi.stubEnv('VITE_E2E', 'true')
    seedCredential()
    h.session = { user: { id: 'pool-session-echo', is_anonymous: false } }

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user?.id).toBe('pool-session-echo')
    expect(outcome(), 'a non-anonymous persisted session is a CONVERTED context, not a skipped one')
      .toBe(null)
  })

  test('a later anonymous event must not clobber the specific reason the grant failed', async () => {
    // The ordering bug this forbids is real and would have shipped: a failed grant records
    // GRANT_FAILED and then falls through to signInAnonymously, whose SIGNED_IN event arrives at the
    // adopt path carrying an ANONYMOUS user with the credential still seeded. Recording the
    // preemption unconditionally there would overwrite a diagnosis with an ambiguity · the run would
    // report "a persisted session preempted the pool" when what actually happened is "the password
    // was refused", which sends the next session to the wrong lane.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('VITE_E2E', 'true')
    seedCredential()
    h.signInWithPasswordFn.mockResolvedValue({ data: null, error: { message: 'invalid login credentials' } })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(outcome()).toBe(POOL_OUTCOME.GRANT_FAILED)

    // Delivered through the REAL callback the hook registered, not by poking the hook's internals ·
    // a harness that simulates the delivery cannot measure a bug about delivery order (Rule 99c).
    await act(async () => { h.emit('SIGNED_IN', { user: { id: 'fallback-anon', is_anonymous: true } }) })

    expect(outcome(), 'the specific failure must survive the anonymous fallback it caused')
      .toBe(POOL_OUTCOME.GRANT_FAILED)
    errSpy.mockRestore()
  })
})
