// NeoTopia · A LOST WRITE SAYS SO (T3 S43).
//
// useGameSync.writeorder.test.js (S42) proved the defect: one client's own four overlapping UPDATEs, and
// the row keeps whichever the server applied last, so an End Turn issued after a placement can be
// overwritten BY that placement. This file tests the instrument built on top of it · not a fix.
//
// WHY A DETECTOR AND NOT A FIX, stated here because the next reader will want to "just await persist":
// awaiting only narrows the window and still loses a write to any retry or slow socket. The real fix is a
// server-side ordering guarantee, which is T2's lane, and its shape was posted to comms BEFORE this was
// built so their predicate and this counter are ONE value (Rule 94 applied before the duplication rather
// than after it). A client-side repair here would also HIDE what this measures.
//
// __seq IS A LAMPORT CLOCK: max(last OBSERVED, last SENT) + 1. BOTH TERMS ARE LOAD-BEARING and the test
// below proved it on the first run. A per-client counter cannot order two clients · A's 5 and B's 3 are
// incomparable · so a detector built on one cries overtake every time the opponent moves, which is worse
// than none (Rule 88c: a gate that flakes trains people to ignore it). But OBSERVED-ONLY is equally wrong,
// and that is the version I wrote first: two pushes in one turn both read the same stale value from the
// store (the server has echoed neither back yet), both minted 1, and `serverSeq < sentSeq` was 1 < 1 ·
// false. The detector was blind to the exact self-clobber it exists for, and the run said [1, 1].
// Both failure modes are asserted here, because either one alone looks like a working instrument.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const db = { rows: {}, applied: [] }
let nextDelay = () => 0
let onRowWrite = null
vi.mock('../lib/supabase', () => {
  // Capture the postgres_changes callback so a test can deliver a row the way the APP receives one.
  // The first version of this file simulated the server push by calling the STORE's syncFromServer
  // directly · which bypasses the hook's wrapper, where the detector lives, so it measured nothing and
  // reported 0 overtakes on the run that had just clobbered a write. Rule 36: the harness has to mirror
  // the real setup path, and the real path is channel.on('postgres_changes', …) → the hook's own handler.
  const channel = {
    on(evt, _filter, cb) { if (evt === 'postgres_changes') channel._pg = cb; return this },
    subscribe(cb) { Promise.resolve().then(() => cb('SUBSCRIBED')); return this },
    _pg: null,
  }
  function makeBuilder(table) {
    const b = {
      _payload: null, _filter: null,
      select() { return b },
      insert() { return b },
      update(payload) { b._payload = payload; return b },
      eq(col, val) { b._filter = { col, val }; return b },
      order() { return b },
      maybeSingle() { return Promise.resolve({ data: null, error: null }) },
      then(onF, onR) {
        const isRowWrite = table === 'game_sessions' && b._payload && b._filter?.col === 'room_id'
        const delay = isRowWrite ? nextDelay() : 0
        const rid = b._filter?.val
        const payload = b._payload
        return new Promise((res) => setTimeout(() => {
          if (isRowWrite) {
            db.rows[rid] = payload
            db.applied.push(payload.state?.__seq ?? null)
            if (onRowWrite) onRowWrite(payload)
          }
          res({ data: null, error: null })
        }, delay)).then(onF, onR)
      },
    }
    return b
  }
  const stub = {
    channel: vi.fn(() => channel), removeChannel: vi.fn(), from: vi.fn((t) => makeBuilder(t)),
    __deliver: (state) => channel._pg && channel._pg({ new: { state } }), // the wire, not the store
  }
  return { supabase: stub, default: stub }
})

import { supabase } from '../lib/supabase'
import { useGameSync } from './useGameSync'
import { useGameStore } from '../store/gameStore'

const ROOM = 'room-overtake'
const seats = () => [{ seat: 0, hand: [] }, { seat: 1, hand: [] }]

describe('overtake detection · a client that loses its own write reports it (T3 S43)', () => {
  beforeEach(() => {
    db.rows = {}; db.applied = []; nextDelay = () => 0; onRowWrite = null
    useGameStore.setState({ phase: 'playing', currentSeat: 0, turnNumber: 1, players: seats(), __seq: 0 })
  })

  // ── COUNTERWEIGHT, WRITTEN FIRST (Rule 90) ────────────────────────────────────────────────────────────
  // The cheap wrong detector is one that fires on ANY state whose __seq is not its own · that reports an
  // overtake every time the opponent legitimately moves, which is worse than no detector because it trains
  // people to ignore it (Rule 88c's failure mode). So the first thing asserted is the NEGATIVE: a peer's
  // newer write, and a peer's write in a room where this client has sent nothing, must both stay silent.
  test('CONTROL · a peer\'s LATER write is not an overtake, and neither is one before we have written',
    async () => {
      const { result } = renderHook(() => useGameSync(ROOM, 'userA'))

      // Nothing sent yet · the opponent's state arrives. sentSeqRef is 0, so there is nothing to be behind.
      act(() => { supabase.__deliver({ currentSeat: 1, turnNumber: 2, __seq: 7 }) })
      expect(result.current.overtakes, 'a client that has written nothing cannot have been overtaken')
        .toEqual([])

      // Now we write (that mints __seq 8 · one past the 7 we observed), and the peer answers with 9.
      await act(async () => { await result.current.pushState('endTurn') })
      expect(db.rows[ROOM].state.__seq, 'the clock is (last observed) + 1, not a private counter').toBe(8)
      act(() => { supabase.__deliver({ currentSeat: 1, turnNumber: 3, __seq: 9 }) })
      expect(result.current.overtakes, 'a peer moving the game FORWARD is normal play, not a lost write')
        .toEqual([])
    })

  test('the placement that lands after the End Turn is NAMED · sentSeq, serverSeq, and how far behind',
    async () => {
      const { result } = renderHook(() => useGameSync(ROOM, 'userA'))

      // The exact live sequence: a placement issued first but SLOW, an End Turn issued second and fast.
      let call = 0
      nextDelay = () => (call++ === 0 ? 40 : 5)
      // The server pushes every applied row back to this client, which is what postgres_changes does.
      onRowWrite = (payload) => { supabase.__deliver(payload.state) }

      await act(async () => {
        const placement = result.current.pushState('place')         // __seq 1 · slow
        useGameStore.setState({ currentSeat: 1, turnNumber: 2 })    // endTurn() ran locally
        const endTurn = result.current.pushState('endTurn')         // __seq 2 · fast
        await Promise.all([placement, endTurn])
      })

      expect(db.applied, 'the server applied 2 first and 1 second').toEqual([2, 1])
      await waitFor(() => expect(result.current.overtakes.length).toBeGreaterThan(0))

      const last = result.current.overtakes.at(-1)
      expect(last.sentSeq, 'the highest write this client issued').toBe(2)
      expect(last.serverSeq, 'what the server is actually serving afterwards').toBe(1)
      expect(last.behindBy, 'one write was overwritten').toBe(1)
      // The payload the deadlock is made of: the server hands back the PRE-End-Turn seat.
      expect(last.currentSeat, 'the server reverted to the seat the placement snapshot carried').toBe(0)
    })

  test('the clock survives the round trip · a client adopts the seq it was served and counts on from there',
    async () => {
      const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
      act(() => { supabase.__deliver({ currentSeat: 0, turnNumber: 5, __seq: 41 }) })
      await act(async () => { await result.current.pushState('place') })
      expect(db.rows[ROOM].state.__seq, 'observed 41 → writes 42 · session-global without coordination')
        .toBe(42)
      expect(result.current.overtakes, 'counting on from a served value is not an overtake').toEqual([])
    })
})
