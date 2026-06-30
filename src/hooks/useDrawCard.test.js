import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the Supabase client · no network, no env vars. Only .rpc is exercised by useDrawCard.
vi.mock('../lib/supabase', () => {
  const rpc = vi.fn()
  return { supabase: { rpc }, default: { rpc } }
})

import { useDrawCard } from './useDrawCard'
import { supabase } from '../lib/supabase'

beforeEach(() => {
  supabase.rpc.mockReset()
})

describe('useDrawCard', () => {
  test('a successful deck draw returns the drawn card and forwards the exact RPC params', async () => {
    const card = { id: 'card_01', name: 'Fibonacci Solar Terrace' }
    supabase.rpc.mockResolvedValue({ data: card, error: null })

    const { result } = renderHook(() => useDrawCard())
    let res
    await act(async () => { res = await result.current.drawCard({ sessionId: 'sess-1', seat: 1 }) })

    expect(res).toEqual({ card, error: null })
    expect(supabase.rpc).toHaveBeenCalledWith('draw_card_for_seat', {
      p_session_id: 'sess-1', p_seat: 1, p_source: 'deck', p_card_index: 0,
    })
    expect(result.current.isDrawing).toBe(false)
    expect(result.current.error).toBeNull()
  })

  test('seat 0 is a valid seat · the guard must NOT short-circuit it (the falsy-0 trap)', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: 'card_04' }, error: null })

    const { result } = renderHook(() => useDrawCard())
    let res
    await act(async () => { res = await result.current.drawCard({ sessionId: 'sess-1', seat: 0 }) })

    // The host holds seat 0 · the common case. A `!seat` guard would wrongly reject it.
    expect(supabase.rpc).toHaveBeenCalledWith('draw_card_for_seat', expect.objectContaining({ p_seat: 0 }))
    expect(res.card).toEqual({ id: 'card_04' })
    expect(res.error).toBeNull()
  })

  test('an offer draw forwards source=offer and the card index', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: 'card_07' }, error: null })

    const { result } = renderHook(() => useDrawCard())
    await act(async () => { await result.current.drawCard({ sessionId: 'sess-1', seat: 2, source: 'offer', cardIndex: 3 }) })

    expect(supabase.rpc).toHaveBeenCalledWith('draw_card_for_seat', {
      p_session_id: 'sess-1', p_seat: 2, p_source: 'offer', p_card_index: 3,
    })
  })

  test('a server RPC error (e.g. deck is empty) is surfaced, not thrown', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'deck is empty' } })

    const { result } = renderHook(() => useDrawCard())
    let res
    await act(async () => { res = await result.current.drawCard({ sessionId: 'sess-1', seat: 0 }) })

    expect(res).toEqual({ card: null, error: 'deck is empty' })
    expect(result.current.error).toBe('deck is empty')
    expect(result.current.isDrawing).toBe(false)
  })

  test('a transport throw is caught and returned as data, never crashing the caller', async () => {
    supabase.rpc.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDrawCard())
    let res
    await act(async () => { res = await result.current.drawCard({ sessionId: 'sess-1', seat: 1 }) })

    expect(res).toEqual({ card: null, error: 'network down' })
    expect(result.current.error).toBe('network down')
    expect(result.current.isDrawing).toBe(false)
  })

  test('missing sessionId or seat returns a validation error WITHOUT a round-trip', async () => {
    const { result } = renderHook(() => useDrawCard())

    let a, b
    await act(async () => { a = await result.current.drawCard({ seat: 0 }) })            // no sessionId
    await act(async () => { b = await result.current.drawCard({ sessionId: 'sess-1' }) }) // no seat

    expect(a.error).toMatch(/requires sessionId and seat/)
    expect(b.error).toMatch(/requires sessionId and seat/)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  test('isDrawing is true while the RPC is in flight and false after it settles', async () => {
    let resolveRpc
    supabase.rpc.mockImplementation(() => new Promise(r => { resolveRpc = r }))

    const { result } = renderHook(() => useDrawCard())
    let p
    act(() => { p = result.current.drawCard({ sessionId: 'sess-1', seat: 0 }) })

    expect(result.current.isDrawing).toBe(true) // synchronous setIsDrawing(true) before the await

    await act(async () => { resolveRpc({ data: { id: 'card_02' }, error: null }); await p })
    expect(result.current.isDrawing).toBe(false)
  })
})
