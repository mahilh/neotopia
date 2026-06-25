import { describe, test, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock the Supabase client so the hook never hits the network and never requires real
// env vars at import time (supabase.js throws without VITE_SUPABASE_* set). The mocked
// anonymous sign-in returns no user, so the hook stays in the "no user" state under test.
vi.mock('../lib/supabase', () => {
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    signInAnonymously: vi.fn(async () => ({ data: { user: null }, error: { message: 'anon disabled' } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
  const from = vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) }))
  return { supabase: { auth, from }, default: { auth, from } }
})

import { useAuth } from './useAuth'

describe('useAuth', () => {
  test('claimUsername returns error when no user is set', async () => {
    const { result } = renderHook(() => useAuth())
    // Anonymous sign-in failed in the mock → user stays null after init settles.
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const res = await result.current.claimUsername('Mahil')
    expect(res.error).toBe('No user or empty name')
  })
})
