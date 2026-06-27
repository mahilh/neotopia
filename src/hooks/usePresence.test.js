// NeoTopia · proves usePresence publishes a MODE-AWARE presence payload (T3 S17 · Task D).
// The lobby roster should show not just WHO is connected but WHERE they are (in_lobby · in_game ·
// in_flow_game · idle) and WHICH mode their room runs — so the civilization feels populated ("3 online ·
// 1 in a flow game"). This drives the real subscribe path (SUBSCRIBED → channel.track(self)) against a mock
// channel that CAPTURES every track() payload, and asserts the status/mode fields ride along and re-publish
// when they change (the lobby → in_flow_game transition must reach the roster, not freeze at in_lobby).

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const tracked = [] // every channel.track(payload) call, in order
vi.mock('../lib/supabase', () => {
  const channel = {
    on() { return channel },
    subscribe(cb) { Promise.resolve().then(() => cb('SUBSCRIBED')); return channel },
    track(payload) { tracked.push(payload); return Promise.resolve() },
    presenceState() { return {} },
    send() { return Promise.resolve() },
  }
  const stub = { channel: vi.fn(() => channel), removeChannel: vi.fn() }
  return { supabase: stub, default: stub }
})

import { usePresence } from './usePresence'

const USER = { id: 'u1' }

describe('usePresence · mode-aware status (T3 S17 · Task D)', () => {
  beforeEach(() => { tracked.length = 0 })

  test('the tracked payload carries status + mode (in_flow_game · flow)', async () => {
    renderHook(() => usePresence('room-1', USER, 'Architect', 0, true, 'in_flow_game', 'flow'))
    await waitFor(() => expect(tracked.length).toBeGreaterThan(0))
    const last = tracked[tracked.length - 1]
    expect(last.userId).toBe('u1')
    expect(last.status).toBe('in_flow_game')
    expect(last.mode).toBe('flow')
    // existing contract still intact (seat/host/ready) · no regression
    expect(last.seat).toBe(0)
    expect(last.isHost).toBe(true)
  })

  test('status defaults to in_lobby when not supplied (backward-compatible)', async () => {
    renderHook(() => usePresence('room-1', USER, 'Architect', 0, true))
    await waitFor(() => expect(tracked.length).toBeGreaterThan(0))
    expect(tracked[tracked.length - 1].status).toBe('in_lobby')
    expect(tracked[tracked.length - 1].mode).toBeNull()
  })

  test('a status change re-publishes presence (lobby → in_game · the roster updates live)', async () => {
    const { rerender } = renderHook(
      ({ status, mode }) => usePresence('room-1', USER, 'Architect', 0, true, status, mode),
      { initialProps: { status: 'in_lobby', mode: 'classic' } },
    )
    await waitFor(() => expect(tracked.some(t => t.status === 'in_lobby')).toBe(true))
    rerender({ status: 'in_game', mode: 'classic' })
    // The re-track effect (deps [status, mode, presenceReady]) must fire a NEW track with the changed status —
    // without it the roster would show the player stuck in the lobby forever after the game starts.
    await waitFor(() => expect(tracked.some(t => t.status === 'in_game')).toBe(true))
  })
})
