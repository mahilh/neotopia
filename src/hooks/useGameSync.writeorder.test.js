// NeoTopia · ONE CLIENT'S OWN WRITES RACE EACH OTHER, AND AN END TURN CAN BE LOST (T3 S42).
//
// MEASURED LIVE FIRST, then reproduced here. Three live two-human runs died at the same place, and the
// diagnostic named it exactly (endgame-live.e2e.js · T3 S41):
//     the joiner · localSeat 0, localTurn 19, channel realtime:game-sync:...:joined
//     the SERVER · column_seat 0, column_turn 19, state_seat 0, phase 'playing'
//     the host   · believes currentSeat is 1
// The joiner agreed with the server and was subscribed, so delivery was never involved. The HOST had
// advanced its own store past an End Turn that never reached game_sessions, and both players then
// deadlocked in opposite directions: the host waiting for a joiner who was correctly waiting for the host.
//
// ── WHY IT CAN HAPPEN, from the code rather than from the symptom ────────────────────────────────────────
// useGameActions.persist is FIRE AND FORGET · `const persist = (eventType) => { sync?.pushState?.(eventType) }`
// (useGameActions.js:56) · nothing awaits it. pushState reads serializableState() SYNCHRONOUSLY at call time
// (useGameSync.js:309) and then does a bare `.update()` on game_sessions keyed by room_id, with no sequence
// number, no version predicate and no queue (useGameSync.js:311-321).
// So a turn of place · place · place · End Turn issues FOUR overlapping UPDATEs, each carrying a full
// snapshot of a DIFFERENT instant, and the row ends up holding whichever the server processed LAST. When
// that is a placement issued before the End Turn, current_seat reverts and the turn advance is gone.
//
// THIS IS A DIFFERENT CLAIM FROM simultaneousdraw.test.js, which models TWO clients colliding. Here there is
// ONE client, one player, one turn, and no opponent acting at all · a client loses its own write to itself.
// That is the version nothing in this repo had ever asserted, and it needs no concurrency between humans,
// which is why it reproduces on a quiet board.
//
// CHARACTERIZATION, NOT APPROVAL. The fix is a server-side ordering guarantee (a sequence/version predicate
// on the UPDATE), which is T2's lane · routed in comms rather than papered over with a client-side await,
// because awaiting persist only narrows the window and would still lose a write to any retry or slow socket.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Stateful Supabase mock, and the ONE thing it adds over the simultaneousdraw mock is the thing under test:
// a matched UPDATE is APPLIED TO THE ROW AFTER A CONTROLLABLE DELAY, so the order the server processes
// writes can differ from the order the client issued them. That is what a network does, and the existing
// mock cannot express it because it writes the row inside then() (issue order == apply order, always).
const db = { rows: {}, applied: [] }
let nextDelay = () => 0
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
            db.rows[rid] = payload           // FULL-ROW REPLACE · faithful UPDATE semantics
            db.applied.push(payload.current_seat)
          }
          res({ data: null, error: null })
        }, delay)).then(onF, onR)
      },
    }
    return b
  }
  const stub = { channel: vi.fn(() => channel), removeChannel: vi.fn(), from: vi.fn((t) => makeBuilder(t)) }
  return { supabase: stub, default: stub }
})

import { useGameSync } from './useGameSync'
import { useGameStore } from '../store/gameStore'

const ROOM = 'room-writeorder'
const seats = () => [{ seat: 0, hand: [] }, { seat: 1, hand: [] }]

describe('one client · its own writes race, and an End Turn can be lost (T3 S42 · characterization)', () => {
  beforeEach(() => { db.rows = {}; db.applied = []; nextDelay = () => 0 })

  // ── COUNTERWEIGHT, WRITTEN FIRST (Rule 90) ────────────────────────────────────────────────────────────
  // The cheap wrong conclusion here is not a bad fix · it is believing MY MOCK. A harness that applies row
  // writes in a silly order would "prove" a clobber that pushState never commits, and the finding would be
  // an artefact of the instrument. So the control comes first: the SAME two pushes, issued in the SAME
  // order, with the server applying them IN ORDER, must leave the row correct. If this one ever goes red,
  // the mock is the defect and nothing below it means anything.
  test('CONTROL · applied in issue order, the End Turn survives and the row holds seat 1', async () => {
    const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
    act(() => useGameStore.setState({ phase: 'playing', currentSeat: 0, turnNumber: 19, players: seats() }))

    nextDelay = () => 0 // every write applies immediately · issue order == apply order
    await act(async () => {
      const placement = result.current.pushState('place')          // snapshot taken NOW · seat 0
      useGameStore.setState({ currentSeat: 1, turnNumber: 20 })    // endTurn() advances the local store
      const endTurn = result.current.pushState('endTurn')          // snapshot taken NOW · seat 1
      await Promise.all([placement, endTurn])
    })

    expect(db.applied, 'both writes must reach the row').toHaveLength(2)
    expect(db.rows[ROOM].current_seat, 'in-order, the last write is the End Turn and the row holds seat 1')
      .toBe(1)
    expect(db.rows[ROOM].state.currentSeat).toBe(1)
  })

  // ── THE DEFECT ────────────────────────────────────────────────────────────────────────────────────────
  test('the placement issued BEFORE the End Turn lands AFTER it · current_seat reverts and the turn is lost',
    async () => {
      const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
      act(() => useGameStore.setState({ phase: 'playing', currentSeat: 0, turnNumber: 19, players: seats() }))

      // The placement's UPDATE takes longer than the End Turn's · one slow request is all it takes, and
      // nothing in pushState prevents it. No opponent is acting; this client is racing only itself.
      let call = 0
      nextDelay = () => (call++ === 0 ? 40 : 5)

      await act(async () => {
        const placement = result.current.pushState('place')        // snapshot: seat 0, turn 19
        useGameStore.setState({ currentSeat: 1, turnNumber: 20 })  // endTurn() ran locally
        const endTurn = result.current.pushState('endTurn')        // snapshot: seat 1, turn 20
        await Promise.all([placement, endTurn])
      })

      expect(db.applied, 'the server applied the End Turn first and the placement second')
        .toEqual([1, 0])

      // THE ROW NOW DISAGREES WITH THE CLIENT THAT WROTE IT, and this is the live signature exactly:
      // server seat 0 / turn 19 while the acting client believes seat 1 / turn 20.
      expect(db.rows[ROOM].current_seat,
        'the placement snapshot overwrote the End Turn · the server still says it is seat 0\'s turn while ' +
        'the host has already moved on. Both players deadlock: the host waits for a joiner who is ' +
        'correctly waiting for the host (measured live · T3 S41 · endgame-live.e2e.js)').toBe(0)
      expect(db.rows[ROOM].state.currentSeat).toBe(0)
      expect(db.rows[ROOM].turn_number, 'the turn number reverts with it').toBe(19)
      expect(useGameStore.getState().currentSeat, 'the local store is NOT rolled back · nothing tells it')
        .toBe(1)
    })

  // A whole turn is four writes, not two · this is the shape a real turn actually has, and it shows the
  // window is not exotic. Any ONE of the three placements landing late is enough.
  test('a realistic turn · three placements then End Turn, with the FIRST placement slowest', async () => {
    const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
    act(() => useGameStore.setState({ phase: 'playing', currentSeat: 0, turnNumber: 19, players: seats() }))

    let call = 0
    nextDelay = () => (call++ === 0 ? 60 : 5) // only the first request is slow

    await act(async () => {
      const writes = [result.current.pushState('place')]
      for (let i = 0; i < 2; i++) writes.push(result.current.pushState('place'))
      useGameStore.setState({ currentSeat: 1, turnNumber: 20 })
      writes.push(result.current.pushState('endTurn'))
      await Promise.all(writes)
    })

    expect(db.applied.at(-1), 'the slow FIRST placement is applied last, after the End Turn').toBe(0)
    expect(db.rows[ROOM].current_seat, 'one slow request out of four loses the turn advance').toBe(0)
  })
})
