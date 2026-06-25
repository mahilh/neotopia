import { describe, test, expect, vi } from 'vitest'

// Mock the Supabase client: importing useGameRoom transitively imports lib/supabase, which
// THROWS at module load without VITE_SUPABASE_* env. The mock keeps these pure-function tests
// hermetic (no env, no network). Mirrors useAuth.test.js.
vi.mock('../lib/supabase', () => {
  const stub = { channel: vi.fn(), removeChannel: vi.fn(), from: vi.fn() }
  return { supabase: stub, default: stub }
})

import { generateRoomCode } from './useGameRoom'

describe('generateRoomCode', () => {
  test('returns exactly 6 characters (DB CHECK length(room_code) = 6)', () => {
    expect(generateRoomCode()).toHaveLength(6)
  })

  test('only uses the unambiguous charset · never I, O, 0 or 1 (misread aloud/typed)', () => {
    const ALLOWED = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode()
      expect(code).toMatch(ALLOWED)
      expect(code).not.toMatch(/[IO01]/)
    }
  })

  test('is not constant (draws vary across calls)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
