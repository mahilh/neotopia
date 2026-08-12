// NeoTopia · WRITE ORDERING · the defect, the predicate that closes it, and the refusal being reported.
//
// THIS FILE USED TO CHARACTERISE A LIVE DEFECT. It no longer does, and that change is the point rather
// than an inconvenience: T3 S42 reproduced the clobber here with zero live runs, T3 S43 measured the
// semantic against real Postgres (tests/e2e/postgres-writeorder.e2e.js · write B then A and the row holds
// A · no version check, no merge), T2 S43 shipped migration 022's state_version column plus the shared
// contract in src/lib/writeOrder.js, and T3 S44 wired pushState to use it. A test that still asserted
// "the later snapshot clobbers the earlier" would now be documenting a defect that has been fixed · a
// citation outliving the thing it cites (Rule 97), in the file best placed to notice.
//
// THE DEFECT, for the record: useGameActions.persist is fire-and-forget and pushState reads
// serializableState() SYNCHRONOUSLY at call time, so place·place·place·EndTurn issues four overlapping
// UPDATEs carrying four different instants. Before 022 the row kept whichever landed LAST, so a slow
// placement issued BEFORE the End Turn overwrote it, current_seat reverted, and both players deadlocked
// in opposite directions · ONE client losing a write to ITSELF, no opponent required.
//
// THE FIX IS THE DATABASE'S, NOT THE CLIENT'S: `.lt('state_version', n)` means the row accepts a write
// only if it is strictly newer than what it already holds, so APPLY order is forced to equal ISSUE order.
// The client-side alternative (awaiting persist) only narrows the window and still loses a write to any
// retry or slow socket.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// The mock now models the PREDICATE, because that is what production does. A matched UPDATE applies only
// when its state_version is strictly greater than the row's · and it still applies after a controllable
// delay, so apply order can differ from issue order. Both halves are needed: without the delay the race
// cannot be expressed, without the predicate the fix cannot be observed.
const db = { rows: {}, applied: [], refused: [] }
let nextDelay = () => 0
let onSettled = null
vi.mock('../lib/supabase', () => {
  const channel = {
    on(evt, _f, cb) { if (evt === 'postgres_changes') channel._pg = cb; return this },
    subscribe(cb) { Promise.resolve().then(() => cb('SUBSCRIBED')); return this },
    _pg: null,
  }
  function makeBuilder(table) {
    const b = {
      _payload: null, _filter: null, _lt: null, _select: false,
      select() { b._select = true; return b },
      insert() { return b },
      update(payload) { b._payload = payload; return b },
      eq(col, val) { b._filter = { col, val }; return b },
      lt(col, val) { b._lt = { col, val }; return b },
      order() { return b },
      maybeSingle() { return Promise.resolve({ data: null, error: null }) },
      then(onF, onR) {
        const isRowWrite = table === 'game_sessions' && b._payload && b._filter?.col === 'room_id'
        const delay = isRowWrite ? nextDelay() : 0
        const rid = b._filter?.val
        const payload = b._payload
        const lt = b._lt
        const wantsRows = b._select
        return new Promise((res) => setTimeout(() => {
          let data = wantsRows ? [] : null
          if (isRowWrite) {
            const held = Number(db.rows[rid]?.state_version ?? 0)
            const incoming = Number(payload.state_version ?? 0)
            // `.lt('state_version', n)` · the row matches only when what it HOLDS is < n.
            const passes = !lt || held < Number(lt.val)
            if (passes) {
              db.rows[rid] = payload
              db.applied.push(incoming)
              if (wantsRows) data = [{ state_version: incoming }]
            } else {
              db.refused.push(incoming)   // zero rows affected · exactly what wasOvertaken reads
            }
            if (onSettled) onSettled(payload, passes)
          }
          res({ data, error: null })
        }, delay)).then(onF, onR)
      },
    }
    return b
  }
  const stub = {
    channel: vi.fn(() => channel), removeChannel: vi.fn(), from: vi.fn((t) => makeBuilder(t)),
    __deliver: (state, version) => channel._pg && channel._pg({ new: { state, state_version: version } }),
  }
  return { supabase: stub, default: stub }
})

import { supabase } from '../lib/supabase'
import { useGameSync } from './useGameSync'
import { useGameStore } from '../store/gameStore'

const ROOM = 'room-writeorder'
const seats = () => [{ seat: 0, hand: [] }, { seat: 1, hand: [] }]

describe('one client racing itself · the predicate keeps the End Turn (T3 S42 defect · S44 fix)', () => {
  beforeEach(() => {
    db.rows = {}; db.applied = []; db.refused = []; nextDelay = () => 0; onSettled = null
    useGameStore.setState({ phase: 'playing', currentSeat: 0, turnNumber: 19, players: seats() })
  })

  // ── COUNTERWEIGHT, WRITTEN FIRST (Rule 90) ────────────────────────────────────────────────────────────
  // A predicate has one catastrophic wrong version and T2 named it in migration 022 so nobody would
  // "simplify" it back: the textbook `WHERE version = :base`. Every write in a burst reads base 0 before
  // any lands, so the FIRST applies and the other three are rejected · including the End Turn. That turns
  // "sometimes loses the last write" into "reliably loses every write after the first", which is a
  // deterministic failure wearing the costume of a fix. So the first thing asserted is that an ordinary
  // burst still LANDS: four writes issued in order must produce four applies and zero refusals.
  test('CONTROL · an ordinary in-order burst is not rejected · all four writes land', async () => {
    const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
    await act(async () => {
      for (let i = 0; i < 3; i++) await result.current.pushState('place')
      useGameStore.setState({ currentSeat: 1, turnNumber: 20 })
      await result.current.pushState('endTurn')
    })
    expect(db.applied, 'a normal turn must not be refused · this is the `WHERE version = base` failure')
      .toEqual([1, 2, 3, 4])
    expect(db.refused).toEqual([])
    expect(db.rows[ROOM].current_seat, 'the End Turn is what the row ends up holding').toBe(1)
    expect(result.current.overtakes, 'nothing was overtaken in an ordinary turn').toEqual([])
  })

  test('THE FIX · a placement issued BEFORE the End Turn but landing AFTER it is REFUSED, not applied',
    async () => {
      const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
      // The exact live shape: the placement's request is the slow one.
      let call = 0
      nextDelay = () => (call++ === 0 ? 40 : 5)

      await act(async () => {
        const placement = result.current.pushState('place')        // version 1 · slow
        useGameStore.setState({ currentSeat: 1, turnNumber: 20 })  // endTurn() ran locally
        const endTurn = result.current.pushState('endTurn')        // version 2 · fast
        await Promise.all([placement, endTurn])
      })

      expect(db.applied, 'the End Turn landed first and the stale placement was turned away').toEqual([2])
      expect(db.refused, 'the older snapshot hit `2 < 1` = false').toEqual([1])
      // THE WHOLE POINT, in one assertion: before 022 this read 0 and the game deadlocked.
      expect(db.rows[ROOM].current_seat, 'the turn advance SURVIVED · the server refused the stale write')
        .toBe(1)
      expect(db.rows[ROOM].state.turnNumber).toBe(20)
    })

  test('the refusal is REPORTED, not swallowed · overtakes names the version, seat, turn and action',
    async () => {
      const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
      let call = 0
      nextDelay = () => (call++ === 0 ? 40 : 5)

      let stale = null
      await act(async () => {
        const placement = result.current.pushState('place')
        useGameStore.setState({ currentSeat: 1, turnNumber: 20 })
        const endTurn = result.current.pushState('endTurn')
        const [p] = await Promise.all([placement, endTurn])
        stale = p
      })

      // pushState tells its own caller, AND the hook exposes it · a refusal that only console.warns is a
      // value resting somewhere plausible with no consumer (Rules 84/85), which is how a subsystem stays
      // unreachable for months. tests/e2e/endgame-live.e2e.js asserts this list is empty after a clean game.
      expect(stale.overtaken, 'pushState must tell its caller the write did not land').toBe(true)
      expect(stale.error, 'a refusal is the predicate working · it is not an error').toBeNull()
      expect(result.current.overtakes).toHaveLength(1)
      expect(result.current.overtakes[0]).toMatchObject({ version: 1, seat: 0, turn: 19, eventType: 'place' })
    })

  test('a client adopts the version it is SERVED and counts on from there · including on a re-seed',
    async () => {
      const { result } = renderHook(() => useGameSync(ROOM, 'userA'))
      act(() => { supabase.__deliver({ currentSeat: 0, turnNumber: 5 }, 41) })
      await act(async () => { await result.current.pushState('place') })
      expect(db.applied, 'observed 41 → issues 42 · a client that renumbered from 0 would be refused ' +
        'by its own predicate for the next 41 writes').toEqual([42])
      expect(result.current.overtakes).toEqual([])
    })
})

// ── TWO CLIENTS RACING EACH OTHER · THE TURN TIMEOUT'S UNTESTED HALF (T3 S53) ────────────────────────────
//
// I shipped the turn clock in S52 and wrote "concurrent fires are SAFE BY CONSTRUCTION" into both the code
// comment and the commit message. Neither of my two harnesses could test it:
//   · useGameSync.turntimeout.test.js mocks supabase with `lt() { return b }` · it IGNORES the predicate
//     and accepts every write, so a double-apply would look identical to a single one.
//   · host-departure-live.e2e.js has exactly ONE client left after the host departs · nobody to race with.
// So the claim rested entirely on migration 022's own tests, which prove THE PREDICATE WORKS · a different
// claim from MY TWO WRITERS COMPOSE WITH IT SAFELY. That is Rule 115 (a contract spanning two lanes has no
// owner) and I walked into it while adding a second writer to a seam someone else had made safe for one.
// It lives HERE rather than in a new file because this mock already models `.lt` faithfully; a second copy
// would be the second contract this suite keeps warning about (Rule 45).
//
// ⚠ THE HONEST LIMIT OF A UNIT HARNESS, stated because the last person to get this wrong was me (Rule 101a:
// "that file drove BOTH players through ONE hook instance, which was faithful while the row kept the last
// write"). Two renderHook instances share ONE Zustand store, so this file CANNOT express two clients whose
// local state has diverged. What it can express is the thing the claim actually needs: two independent
// version counters issuing writes at the same instant, and the row accepting exactly one. The divergent-
// store case is the live spec's job and it needs a second surviving client to have it.
describe('two clients time out at the same instant · exactly one write is accepted (T3 S53)', () => {
  beforeEach(() => {
    db.rows = {}; db.applied = []; db.refused = []; nextDelay = () => 0; onSettled = null
    useGameStore.setState({ phase: 'playing', currentSeat: 0, turnNumber: 19, players: seats() })
  })

  // COUNTERWEIGHT FIRST (Rule 90): "exactly one applied" is also what a totally broken write path produces
  // if the first write lands and everything else errors · and it is what a harness that silently drops
  // writes produces too. So prove a LONE timeout write lands before asserting that a second one does not.
  test('CONTROL · one client timing out alone lands its write', async () => {
    const a = renderHook(() => useGameSync(ROOM, 'userA'))
    await act(async () => { await a.result.current.pushState('endTurn', { reason: 'turn_timeout' }) })
    expect(db.applied, 'a single timeout write did not reach the row · every count below is meaningless')
      .toEqual([1])
    expect(db.refused).toEqual([])
  })

  test('two independent clients firing together · one applies, one is REFUSED', async () => {
    const a = renderHook(() => useGameSync(ROOM, 'userA'))
    const b = renderHook(() => useGameSync(ROOM, 'userB'))

    // Both hooks hold their OWN versionRef starting at 0, so both mint state_version 1 · exactly what two
    // real clients do when neither has seen the other's write yet (Rule 99's two-term clock: the observed
    // term has nothing in it). Issued inside one act() so they are genuinely in flight together.
    await act(async () => {
      await Promise.all([
        a.result.current.pushState('endTurn', { reason: 'turn_timeout' }),
        b.result.current.pushState('endTurn', { reason: 'turn_timeout' }),
      ])
    })

    expect(db.applied.length, 'both timeout writes were accepted · the row took two writes for one expired ' +
      'turn. With divergent client state that is a clobber, which is the whole reason migration 022 exists')
      .toBe(1)
    expect(db.refused.length, 'the losing write was not refused · it either errored (a different failure) ' +
      'or silently applied').toBe(1)
    expect(db.rows[ROOM].state_version, 'the row does not hold the winning version').toBe(1)

    a.unmount(); b.unmount()
  })

  // THE NEGATIVE DIRECTION (Rule 99a), and it is the half that would make this feature worse than useless:
  // a predicate that wedges the room after a race turns a recoverable stall into a permanent one. The
  // refused client must be able to write again once it has adopted what it was served.
  test('the room is not wedged · the refused client writes again after adopting the served version', async () => {
    const a = renderHook(() => useGameSync(ROOM, 'userA'))
    const b = renderHook(() => useGameSync(ROOM, 'userB'))
    await act(async () => {
      await Promise.all([
        a.result.current.pushState('endTurn', { reason: 'turn_timeout' }),
        b.result.current.pushState('endTurn', { reason: 'turn_timeout' }),
      ])
    })
    expect(db.applied.length).toBe(1)

    // The winner's row reaches every client through postgres_changes · that is how the loser learns.
    await act(async () => { supabase.__deliver({ phase: 'playing', currentSeat: 1, turnNumber: 20 }, 1) })
    await act(async () => { await b.result.current.pushState('place') })

    expect(db.applied.length, 'the refused client can no longer write · it adopted the served version and ' +
      'its next write STILL lost, so that seat is now mute for the rest of the game. A wedged client is a ' +
      'worse outcome than the stall this feature was built to end').toBe(2)
    a.unmount(); b.unmount()
  })
})

// ── A STALE PAYLOAD, NOT JUST A STALE VERSION · THE CLOBBER ITSELF (T3 S54) ──────────────────────────────
//
// S53 proved two clients issuing the SAME snapshot produce one accepted write. That is necessary and it is
// not the hazard: identical payloads race harmlessly, because whichever lands leaves the row saying the
// same thing. The hazard is a peer whose store has DIVERGED · it writes an OLD board with an OLD version,
// and if that is accepted it erases work its author never saw. The turn clock makes this reachable in
// ordinary play, because it writes on behalf of a player who is not there to notice.
//
// I FIRST TRIED TO BUILD THIS IN A BROWSER AND IT DOES NOT WORK · three live runs, recorded in
// tests/e2e/host-departure-live.e2e.js. Every mechanism that blinds a client also disturbs the state it is
// supposed to be holding: routeWebSocket misses the already-open socket (the peer stayed perfectly
// synced), and cutting the socket plus blocking REST reads drops the peer all the way back to phase
// 'lobby' with version 0 · a RESET client, not a diverged one, for which the clock correctly never runs.
//
// AND THE SHARED-STORE OBJECTION DOES NOT APPLY, which is what I got wrong when I wrote the S53 limit.
// pushState reads the store SYNCHRONOUSLY AT CALL TIME, so two hooks sharing one store can still issue two
// genuinely different payloads · mutate the store between the calls and the second one carries the older
// board. What two renderHooks cannot model is two clients diverging CONCURRENTLY over time; what they
// model perfectly is the only thing this claim needs: a stale snapshot meeting a newer row.
describe('a stale payload is refused, and the newer board survives (T3 S54)', () => {
  const boardWith = (n) => [{
    id: 'r1',
    hexes: Object.fromEntries(Array.from({ length: n }, (_, i) => [`${i},0`, { element: 'energy' }])),
  }]
  const placedIn = (state) => (state?.regions ?? [])
    .reduce((n, r) => n + Object.values(r.hexes ?? {}).filter(h => h?.element).length, 0)

  beforeEach(() => {
    db.rows = {}; db.applied = []; db.refused = []; nextDelay = () => 0; onSettled = null
    useGameStore.setState({ phase: 'playing', currentSeat: 0, turnNumber: 19, players: seats() })
  })

  // COUNTERWEIGHT FIRST (Rule 90): the witness here is a COUNT OF PLACEMENTS on the persisted board, and
  // it is worthless unless the harness can actually move it. A run where the row never carried 3 in the
  // first place would "survive" the stale write trivially. So the fixture is proven to round-trip before
  // anything is refused.
  test('CONTROL · the board a client writes is what the row holds', async () => {
    const a = renderHook(() => useGameSync(ROOM, 'userA'))
    useGameStore.setState({ regions: boardWith(3) })
    await act(async () => { await a.result.current.pushState('place') })
    expect(db.applied, 'the first write did not land').toEqual([1])
    expect(placedIn(db.rows[ROOM].state), 'the row does not carry the board that was written · the ' +
      'placement count cannot witness a clobber if it cannot witness a write').toBe(3)
    a.unmount()
  })

  test('a diverged peer stale timeout write is REFUSED · the placements it never saw survive', async () => {
    const a = renderHook(() => useGameSync(ROOM, 'userA'))
    const b = renderHook(() => useGameSync(ROOM, 'userB'))

    // A plays: three placements reach the row at version 1.
    useGameStore.setState({ regions: boardWith(3), turnNumber: 20 })
    await act(async () => { await a.result.current.pushState('place') })
    expect(placedIn(db.rows[ROOM].state)).toBe(3)

    // B never saw any of it · its store still shows the older board, and its own counter is still 0, so
    // the version it mints is the one it would have minted before A wrote. Both halves are what "stale"
    // means and asserting only the version would let a same-board write masquerade as the hazard.
    useGameStore.setState({ regions: boardWith(1), turnNumber: 19 })
    await act(async () => { await b.result.current.pushState('endTurn', { reason: 'turn_timeout' }) })

    expect(db.refused, 'B stale write was ACCEPTED · this is the clobber. A timeout firing on behalf of an ' +
      'absent player has just erased two placements its author never saw, which is the worst possible ' +
      'failure of a feature built to rescue a frozen game').toEqual([1])
    expect(placedIn(db.rows[ROOM].state), 'the row lost placements to a stale writer').toBe(3)
    expect(db.rows[ROOM].turn_number, 'the row turn went backwards').toBe(20)
    a.unmount(); b.unmount()
  })
})
