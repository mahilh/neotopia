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
// Flow's SIMULTANEOUS_DRAW means BOTH players write their full snapshot to the SAME row at the same time.
//
// ⚠ THIS HEADER USED TO END "so it is LAST-WRITE-WINS: the later write clobbers the earlier one and the earlier
// player's draw is LOST", and that has been FALSE since migration 022 (T2 S43). I updated this file's test body
// in S44 and left the header standing · which is Rule 101 happening to the person who wrote Rule 101, in the
// paragraph a reader sees FIRST. Found by sweeping my own lane for claims that a hazard is open or closed
// (T3 S45 P3), not by anything failing: a stale comment cannot go red.
//
// WHAT IS TRUE NOW: a Postgres UPDATE is still a full-row replace with no field merge, and that is still why
// two snapshots collide. But `game_sessions.state_version` plus the `.lt('state_version', n)` predicate means
// the row accepts a write only if it is strictly newer, so the second writer is REFUSED rather than applied ·
// zero rows affected, which useGameSync surfaces through wasOvertaken. The earlier player's draw SURVIVES.
// Still honest about the limit, because a refusal is not a merge: the refused player's draw did not happen and
// they must re-sync and retry, and NOTHING RETRIES YET (src/lib/writeOrder.js says so in its own header). Turn
// order makes genuinely simultaneous movers rare; it does not make them absent.
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
      _lt: null,
      _select: false,
      select() { b._select = true; return b },
      insert() { return b },                    // game_events audit · skipped anyway (no sessionId in this test)
      update(payload) { b._payload = payload; return b },
      eq(col, val) { b._filter = { col, val }; return b },
      lt(col, val) { b._lt = { col, val }; return b },   // migration 022's predicate (T2 S43)
      order() { return b },
      maybeSingle() { return Promise.resolve({ data: null, error: null }) }, // fetchAndSeed → no row → no-op
      then(onF, onR) {
        // A matched game_sessions UPDATE replaces the WHOLE row (no merge) · but since migration 022 it
        // matches ONLY when the row holds a strictly older state_version. Both halves are modelled: the
        // whole-row replace is what made the collision possible, the predicate is what now refuses it.
        let data = b._select ? [] : null
        if (table === 'game_sessions' && b._payload && b._filter?.col === 'room_id') {
          const held = Number(db.rows[b._filter.val]?.state_version ?? 0)
          const passes = !b._lt || held < Number(b._lt.val)
          if (passes) {
            db.rows[b._filter.val] = b._payload
            if (b._select) data = [{ state_version: b._payload.state_version }]
          }
        }
        return Promise.resolve({ data, error: null }).then(onF, onR)
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

  // ── THIS CLAIM CHANGED, AND THE CHANGE IS THE POINT (T3 S44) ──────────────────────────────────────────
  // Until migration 022 this test asserted that B's whole-row write CLOBBERED A's draw and that A2 was
  // simply GONE · the simultaneous-draw hazard, and it was true when written (T3 S17). It is not true any
  // more: T2 shipped the state_version predicate, T3 wired pushState to send it, and a second writer
  // holding a stale version is now REFUSED instead of overwriting. Leaving the old assertion would be a
  // citation outliving the thing it cites (Rule 97) · in the file most likely to be read as the authority
  // on this hazard.
  //
  // AND THE HARNESS HAD TO CHANGE WITH IT, which is the subtler half: the old version drove BOTH players
  // through ONE hook instance. The write counter is per-client, so one instance mints 1 then 2 and the
  // second write passes its own predicate · the stand-in would have kept "proving" a clobber that two real
  // clients can no longer produce. Two instances, two counters, two clients (Rule 36).
  test('two concurrent draws → the second writer is REFUSED, not silently lost · A\'s draw survives',
    async () => {
      const a = renderHook(() => useGameSync(ROOM, 'userA'))
      const b = renderHook(() => useGameSync(ROOM, 'userB'))

      // A draws A2 and persists its whole snapshot. A has [A1,A2]; B still has [B1].
      act(() => useGameStore.setState({
        phase: 'playing', currentSeat: 0,
        players: [{ seat: 0, hand: hand(['A1', 'A2']) }, { seat: 1, hand: hand(['B1']) }],
      }))
      const aRes = await act(async () => await a.result.current.pushState('draw_card', { seat: 0 }))
      expect(db.rows[ROOM].state.players[0].hand.map(c => c.id)).toEqual(['A1', 'A2'])

      // B drew B2 CONCURRENTLY, from a snapshot read BEFORE A's write · so B's view never saw A2, and B's
      // client has observed no version either. It issues version 1 against a row already holding 1.
      act(() => useGameStore.setState({
        phase: 'playing', currentSeat: 1,
        players: [{ seat: 0, hand: hand(['A1']) }, { seat: 1, hand: hand(['B1', 'B2']) }],
      }))
      const bRes = await act(async () => await b.result.current.pushState('draw_card', { seat: 1 }))

      const roster = db.rows[ROOM].state.players
      expect(roster[0].hand.map(c => c.id), "A's draw SURVIVES · it is no longer overwritten by a stale " +
        'concurrent snapshot').toEqual(['A1', 'A2'])
      expect(bRes.overtaken, "B's write was refused, and B is TOLD · zero rows affected is a signal, and " +
        'the old behaviour gave B no way to know its move had evaporated').toBe(true)
      expect(aRes.overtaken).toBe(false)

      // HONEST ABOUT WHAT THIS DOES NOT SOLVE, because a refusal is not a merge: B's draw did not happen,
      // and B must re-sync and retry. writeOrder.js says so in its own header · turn order makes genuinely
      // simultaneous movers rare, it does not make them absent. The improvement is that a lost move is now
      // REPORTED rather than silent, which is the difference between a bug and a retry.
      expect(roster[1].hand.map(c => c.id), "B's draw is not in the row · it was refused, not merged")
        .toEqual(['B1'])
    })
})
