import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mutable session the mock hands back via the INITIAL_SESSION event · set per test.
const h = vi.hoisted(() => ({ session: null }))

// Mock the Supabase client: no network, no real env vars. onAuthStateChange fires
// INITIAL_SESSION on the next microtask (mirroring supabase-js, which emits it AFTER it has
// hydrated the persisted session from storage) carrying h.session.
vi.mock('../lib/supabase', () => {
  const auth = {
    signInAnonymously: vi.fn(async () => ({ data: { user: null }, error: { message: 'anon disabled' } })),
    onAuthStateChange: vi.fn((cb) => {
      Promise.resolve().then(() => cb('INITIAL_SESSION', h.session))
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  }
  const from = vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) }))
  return { supabase: { auth, from }, default: { auth, from } }
})

import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

beforeEach(() => {
  h.session = null
  supabase.auth.signInAnonymously.mockClear()
})

describe('useAuth', () => {
  test('claimUsername returns error when no user is set', async () => {
    h.session = null // INITIAL_SESSION with no persisted session → anon sign-in (mock fails) → user stays null
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const res = await result.current.claimUsername('Mahil')
    expect(res.error).toBe('No user or empty name')
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
})
