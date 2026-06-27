// NeoTopia · simultaneous-draw COLLISION characterization (T3 S17 · Task C · Rule 63 · Rule 40/65).
//
// CONTEXT · the forge asked T3 to "ship the channel side" of Flow-mode simultaneous draw with a seat-scoped
// event handler ("case 'draw_card': if (event.seat !== mySeat) return"). Reading the REAL useGameSync (Rule
// 26/62) shows that handler targets an architecture NeoTopia does not have. There is NO per-event draw reducer
// on the receive side: state syncs as a WHOLE-STORE SNAPSHOT via postgres_changes → syncFromServer(next.state)
// adopts the entire server snapshot; game_events is a best-effort AUDIT log, not the sync transport. pushState
// writes the ENTIRE store to the room's SINGLE game_sessions row keyed by room_id (no per-seat partition).
//
// WHY THAT MATTERS FOR FLOW · in Classic the turn model serialises writes (one actor at a time → no collision).
// Flow's SIMULTANEOUS_DRAW means BOTH players write their full snapshot to the SAME row at the same time. A
// Postgres UPDATE is a full-row replace (no field merge), so it is LAST-WRITE-WINS: the later write clobbers the
// earlier one and the earlier player's draw is LOST. The forge's seat-scoped-event fix cannot be "added" because
// the offending code (an event reducer) does not exist — the real fix is an engine + persistence change owned by
// T2 (the simultaneous-draw engine is still SCOPED OUT · see T2 S16 comms · no channel spec exists yet).
//
// SO THIS TEST TELLS THE TRUTH (Rule 63 · "an honest test that names the gap beats a green test that lies"):
// it is the truthful version of the forge's intended "Both players draw without collision" test — it proves they
// CURRENTLY CANNOT, by demonstrating the last-write-wins overwrite deterministically (no live race needed · the
// mock models real Postgres full-row UPDATE semantics). It is also a GUARD (Rule 40/65): the day T2 builds
// simultaneous draw, the write model MUST change to seat-isolated/merge writes — and this test, by pinning the
// current whole-row contract, is exactly what will fire and force the seam to be re-examined. The precise T2
// design hand-off (atomic seat-scoped draw RPC · Rule 16 server-authoritative) lives in .claude/comms.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Stateful Supabase mock · ONE in-memory row per room_id. The query builder is chainable (every method returns
// the builder · so .select().eq().maybeSingle() and .update().eq() both work) AND thenable (awaiting it resolves)
// — mirroring the real PostgREST builder (Rule 36). A matched game_sessions UPDATE does a FULL-ROW REPLACE
// (db.rows[rid] = payload · no field merge) — faithful Postgres UPDATE semantics, which is the whole point.
// maybeSingle() returns null so the on-mount fetchAndSeed is a no-op and never clobbers the store we drive.
const db = { rows: {} }
vi.mock('../lib/supabase', () => {
  const channel = {
    on() { return this },
    subscribe(cb) { Promise.resolve().then(() => cb('SUBSCRIBED')); return this },
  }
  function makeBuilder(table) {
    const b = {
      _payload: null,
      _filter: null,
      select() { return b },
      insert() { return b },                    // game_events audit · skipped anyway (no sessionId in this test)
      update(payload) { b._payload = payload; return b },
      eq(col, val) { b._filter = { col, val }; return b },
      order() { return b },
      maybeSingle() { return Promise.resolve({ data: null, error: null }) }, // fetchAndSeed → no row → no-op
      then(onF, onR) {
        // Awaiting a finished chain resolves the write. A matched game_sessions UPDATE keyed by room_id replaces
        // the WHOLE row — last write wins, no merge (the collision under test).
        if (table === 'game_sessions' && b._payload && b._filter?.col === 'room_id') {
          db.rows[b._filter.val] = b._payload
        }
        return Promise.resolve({ data: null, error: null }).then(onF, onR)
      },
    }
    return b
  }
  const stub = { channel: vi.fn(() => channel), removeChannel: vi.fn(), from: vi.fn((t) => makeBuilder(t)) }
  return { supabase: stub, default: stub }
})

import { useGameSync } from './useGameSync'
import { useGameStore } from '../store/gameStore'

const ROOM = 'room-flow-1'
const hand = (ids) => ids.map(id => ({ id }))

describe('Flow simultaneous draw · whole-state-snapshot last-write-wins (T3 S17 · Task C characterization)', () => {
  beforeEach(() => { db.rows = {} })

  test('pushState persists the WHOLE store to the room\'s single row keyed by room_id (no per-seat isolation)', async () => {
    const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
    // Drive a known snapshot: two seats, each holding a card. serializableState() writes the entire store.
    act(() => useGameStore.setState({
      phase: 'playing', currentSeat: 0,
      players: [{ seat: 0, hand: hand(['A1']) }, { seat: 1, hand: hand(['B1']) }],
    }))
    await act(async () => { await result.current.pushState('draw_card', { seat: 0 }) })

    const row = db.rows[ROOM]
    expect(row, 'pushState must write the room row').toBeTruthy()
    // The persisted row carries the FULL roster (both seats) in ONE jsonb blob — proving writes are NOT seat
    // partitioned. This is the contract that makes concurrent writers collide (next test) · pin it so a future
    // simultaneous-draw change to seat-isolated writes trips here and forces a seam review (Rule 40/65).
    expect(row.state.players).toHaveLength(2)
    expect(row.state.players[0].hand.map(c => c.id)).toEqual(['A1'])
    expect(row.state.players[1].hand.map(c => c.id)).toEqual(['B1'])
  })

  test('two concurrent draws → the later snapshot CLOBBERS the earlier · the first player\'s draw is LOST', async () => {
    const { result } = renderHook(() => useGameSync(ROOM, 'userA'))

    // Player A's client draws 'A2' and persists its full snapshot (A has [A1,A2] · B still has [B1]).
    act(() => useGameStore.setState({
      phase: 'playing', currentSeat: 0,
      players: [{ seat: 0, hand: hand(['A1', 'A2']) }, { seat: 1, hand: hand(['B1']) }],
    }))
    await act(async () => { await result.current.pushState('draw_card', { seat: 0 }) })
    expect(db.rows[ROOM].state.players[0].hand.map(c => c.id)).toEqual(['A1', 'A2']) // A's draw landed

    // Player B's client drew 'B2' CONCURRENTLY — from a snapshot read BEFORE A's write, so B's view never saw
    // A2 (A's hand is still [A1] in B's snapshot). In Flow both writes race; the whole-row UPDATE means B's
    // snapshot REPLACES the row. (Same instance here stands in for B's client · the collision is the overwrite.)
    act(() => useGameStore.setState({
      phase: 'playing', currentSeat: 1,
      players: [{ seat: 0, hand: hand(['A1']) }, { seat: 1, hand: hand(['B1', 'B2']) }],
    }))
    await act(async () => { await result.current.pushState('draw_card', { seat: 1 }) })

    const finalRoster = db.rows[ROOM].state.players
    // B's draw is present (it wrote last)…
    expect(finalRoster[1].hand.map(c => c.id)).toEqual(['B1', 'B2'])
    // …but A's draw 'A2' is GONE — clobbered by B's whole-row write. THIS is the simultaneous-draw hazard:
    // the current snapshot-sync model is safe only under turn-serialised play. Fixing it is a T2 engine +
    // persistence change (seat-isolated/atomic-merge draw · see comms), NOT a T3 receive-side event filter.
    expect(finalRoster[0].hand.map(c => c.id), 'A2 should be lost — proving the last-write-wins collision').toEqual(['A1'])
    expect(finalRoster[0].hand.map(c => c.id)).not.toContain('A2')
  })
})
