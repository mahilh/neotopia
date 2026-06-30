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
  return { session: null, insertFn, updateFn, updateEqFn, maybeSingleFn }
})

vi.mock('../lib/supabase', () => {
  const auth = {
    signInAnonymously: vi.fn(async () => ({ data: { user: null }, error: { message: 'anon disabled' } })),
    onAuthStateChange: vi.fn((cb) => {
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

beforeEach(() => {
  try { localStorage.clear() } catch { /* jsdom */ }
  h.session = null
  supabase.auth.signInAnonymously.mockClear()
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

  test('a taken username returns a friendly message, never the raw 409, and does not store the claim', async () => {
    h.session = { user: { id: 'uid-2' } }
    h.maybeSingleFn.mockResolvedValue({ data: null, error: null }) // new user → insert path
    h.insertFn.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint "player_profiles_username_key"' },
    })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let res
    await act(async () => { res = await result.current.claimUsername('Taken') })
    expect(res.error).toBe('That name is taken. Please choose another.')
    expect(result.current.username).not.toBe('Taken') // a failed claim must not persist
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
