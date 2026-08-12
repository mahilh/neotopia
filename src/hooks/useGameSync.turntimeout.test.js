// NeoTopia · THE TURN CLOCK ENFORCES ITSELF (T3 S52).
//
// WHAT THIS REPLACES, and it is a measurement rather than a suspicion. S51 closed the host's tab mid-game
// in a real browser, twice, and watched the peer for 45 seconds:
//
//     peer store   seat 0 / turn 1 / actions 2   IDENTICAL at nine 5s samples
//     room status  playing -> playing            nothing runs on tab close
//     peer view    myTurn "false"                bodyChars identical
//
// on a client that had just been PROVEN to be listening (a real action was observed crossing the wire
// first · without that counterweight a peer whose socket never connected produces the same green).
// The departed player owned the turn and kept it, because `turnSecondsLeft` in GameRoom had exactly two
// consumers · its own useState and a display prop · while the Tutorial and the Lobby both told the player
// "90 seconds per turn". So this is a CORRECTION: the promise shipped long ago and nothing kept it.
//
// ── WHY THIS FILE ASSERTS THE MECHANISM AND NOT THE OUTCOME ──────────────────────────────────────────
// My own closing critique of the S51 spec: it observes for a fixed 45s, asserts nothing changed, and then
// argues PERMANENCE from the absence of a timeout IN A COMMENT. Add a 120s timeout tomorrow and that spec
// still passes at 45s while its own comment silently becomes false. The S48 soft-lock gate got this right
// by requiring the MECHANISM (the bot must have held turns and given them up) rather than the outcome
// (phase === 'scoring'), which a build that skipped the bot entirely would also satisfy.
// So the claims here are: a timer EXISTS, it ADVANCES THE TURN, and it survives the one thing that has
// silently killed this feature before. None of those can become false without something going red.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const writes = []
const events = []
vi.mock('../lib/supabase', () => {
  const channel = {
    on() { return this },
    subscribe(cb) { Promise.resolve().then(() => cb('SUBSCRIBED')); return this },
  }
  const builder = (table) => {
    const b = {
      _payload: null, _select: false,
      select() { b._select = true; return b },
      insert(payload) { if (table === 'game_events') events.push(payload); return b },
      update(payload) { b._payload = payload; return b },
      eq() { return b },
      lt() { return b },
      order() { return b },
      // A session row with a real id and NO state: fetchAndSeed sets sessionId from `data.id` (which is
      // what gates the game_events audit insert) and only calls syncFromServer when `data.state` is
      // truthy · so the store this test seeded is left exactly as it was. Without the id the audit
      // assertion below would be measuring the harness, not the product.
      maybeSingle() {
        return Promise.resolve(
          table === 'game_sessions'
            ? { data: { id: 'session-1', state: null, state_version: 0 }, error: null }
            : { data: null, error: null },
        )
      },
      then(onF) {
        if (table === 'game_sessions' && b._payload) writes.push(b._payload)
        // `.select()` on the write path must return ROWS · wasOvertaken(null) is false, so returning null
        // here would make every write read as accepted and hide a refusal (T2's note in pushState).
        return Promise.resolve({ data: b._select ? [{ state_version: b._payload?.state_version ?? 1 }] : null, error: null }).then(onF)
      },
    }
    return b
  }
  return {
    supabase: {
      channel: () => channel,
      removeChannel: () => {},
      from: (t) => builder(t),
    },
  }
})

import { useGameSync, TURN_TIMEOUT_GRACE_MS } from './useGameSync'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../store/gameStore'
import { DECK } from '../lib/projectCards'
import { TURN_TIME_LIMIT } from '../store/gameConfig'

const HOST = 'user-host'   // seat 0
const PEER = 'user-peer'   // seat 1
const ROOM = 'room-1'
const LIMIT_MS = TURN_TIME_LIMIT * 1000

const mounted = []
const drive = (roomId, userId) => {
  const h = renderHook(() => useGameSync(roomId, userId))
  mounted.push(h)
  return h
}
const tick = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const turn = () => useGameStore.getState().turnNumber
const seat = () => useGameStore.getState().currentSeat

beforeEach(() => {
  writes.length = 0
  events.length = 0
  vi.useFakeTimers()
  useGameStore.getState().initGame(
    [{ userId: HOST, username: 'Host' }, { userId: PEER, username: 'Peer' }],
    shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
  )
})
afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('the turn clock enforces itself · mechanism, not outcome (T3 S52)', () => {

  // ── COUNTERWEIGHTS FIRST (Rule 90) ──────────────────────────────────────────────────────────────────
  // Written before the assertions they defend, because the wrong fix here is LOUD and plausible: a timer
  // that fires early, or fires in practice, ends a real player's turn while they are still thinking. A
  // timeout is dangerous in the opposite direction to the bug it closes (Rule 100a) · the freeze is
  // visible and a turn ending four seconds early just looks like the game.

  test('COUNTERWEIGHT · nothing fires one second before the deadline', async () => {
    drive(ROOM, HOST)                                  // seat 0 · the active player · no grace
    const before = turn()
    await tick(LIMIT_MS - 1_000)
    expect(turn(), 'the turn ended BEFORE the limit the UI promises · a player mid-move just lost it')
      .toBe(before)
    expect(writes, 'a write was issued before any deadline').toEqual([])
  })

  test('COUNTERWEIGHT · practice has no room, so nothing can ever fire', async () => {
    drive(null, HOST)
    const before = turn()
    await tick(LIMIT_MS * 10)
    expect(turn(), 'a practice board ended its own turn · practice has no peer to unfreeze and no ' +
      'server to push to, so this is pure harm').toBe(before)
  })

  test('COUNTERWEIGHT · a finished game does not keep ending turns', async () => {
    drive(ROOM, HOST)
    act(() => { useGameStore.setState({ phase: 'scoring' }, false) })
    const before = turn()
    await tick(LIMIT_MS * 3)
    expect(turn(), 'turns advanced during scoring · the game would never settle').toBe(before)
  })

  // MEASURED TEETH, stated because I predicted them wrongly. Removing the re-anchor does NOT red this
  // test · it reds "a REMOTE client unfreezes a board", and the reason is worth knowing: after the host's
  // own client fires, the seat moves AWAY from it, so its next deadline picks up the remote grace and
  // lands beyond the window this test looks at. The remote client has the opposite luck · the seat moves
  // TO it, its grace drops to zero, and the stale anchor fires again immediately. So the re-anchor is
  // load-bearing and a mutation does red; just not here. Written down rather than tidied away, because a
  // teeth-check whose result you assumed is the same class of claim as the guard it is checking.
  test('COUNTERWEIGHT · it fires ONCE per turn, not every tick after the deadline', async () => {
    drive(ROOM, HOST)
    const before = turn()
    await tick(LIMIT_MS)
    expect(turn()).toBe(before + 1)
    await tick(3_000)   // three more ticks, still inside the NEW turn's budget
    expect(turn(), 'the latch failed · every tick past a deadline burned another turn').toBe(before + 1)
  })

  // ── THE MECHANISM · a timer EXISTS ──────────────────────────────────────────────────────────────────

  test('MECHANISM · mounting in a room schedules a repeating 1s timer, and practice schedules none', () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    drive(null, HOST)
    const practiceIntervals = spy.mock.calls.filter(([, ms]) => ms === 1_000).length
    drive(ROOM, HOST)
    const roomIntervals = spy.mock.calls.filter(([, ms]) => ms === 1_000).length
    expect(roomIntervals, 'no 1s interval was scheduled for a real room · there is no clock at all, ' +
      'which is precisely the state S51 measured: a countdown that displays and enforces nothing')
      .toBeGreaterThan(practiceIntervals)
    spy.mockRestore()
  })

  // ── THE MECHANISM · it ADVANCES THE TURN ────────────────────────────────────────────────────────────

  test('MECHANISM · the active player own client ends its turn at the limit, with no grace', async () => {
    drive(ROOM, HOST)                                  // seat 0 IS the current seat
    const before = turn()
    await tick(LIMIT_MS)
    expect(turn(), 'the active client did not honour the limit its own UI prints').toBe(before + 1)
    expect(seat(), 'the seat did not move · the board is still frozen on the same player').toBe(1)
  })

  test('MECHANISM · a REMOTE client unfreezes a board whose active player is gone', async () => {
    // This is the S51 scenario exactly: seat 0 has vanished, and the only client left is seat 1, whose
    // own controls are correctly disabled because it is not their turn. Nothing they can press helps.
    drive(ROOM, PEER)                                  // seat 1 · NOT the current seat
    const before = turn()
    await tick(LIMIT_MS)
    expect(turn(), 'a remote client ended someone else turn at the bare limit · it must yield first, ' +
      'so a present-but-slow player is ended by their OWN client rather than by their opponent')
      .toBe(before)
    await tick(TURN_TIMEOUT_GRACE_MS * 2 + 1_000)      // seat 1 → grace is GRACE*(1+1)
    expect(turn(), 'the peer never unfroze the board · this is the whole defect, still open').toBe(before + 1)
  })

  test('MECHANISM · the advance is PERSISTED, and marked as a timeout rather than a played turn', async () => {
    drive(ROOM, HOST)
    await tick(LIMIT_MS)
    expect(writes.length, 'the turn advanced locally and was never pushed · every other client stays ' +
      'frozen and this client silently diverges').toBeGreaterThan(0)
    expect(writes.at(-1).current_seat, 'the pushed snapshot does not carry the advanced seat').toBe(1)
    const timeoutEvents = events.filter(e => e.event_data?.reason === 'turn_timeout')
    expect(timeoutEvents.length, 'the audit row does not distinguish a timed-out turn from a played ' +
      'one · in game_events it would look like the absent player pressed End Turn').toBeGreaterThan(0)
    expect(timeoutEvents.at(-1).event_data.seat, 'the audit does not record WHOSE turn expired').toBe(0)
  })

  // ── THE MECHANISM · IT SURVIVES THE THING THAT HAS KILLED IT BEFORE (Rule 76) ───────────────────────
  // A setTimeout inside a useEffect is cancelled by its own cleanup whenever a dep identity churns, and
  // this app re-renders once a second for the turn countdown. That is not hypothetical here: it killed
  // the first draft of GameRoom's auto-end-turn outright, silently, with nothing in the console, and it
  // killed ScoreFlash's auto-unmount in SHIPPED code. A guard that only ever mounts once and waits would
  // pass against an implementation with exactly that defect.
  test('MECHANISM · re-rendering every second does not cancel the deadline', async () => {
    const h = drive(ROOM, HOST)
    const before = turn()
    for (let i = 0; i < TURN_TIME_LIMIT; i++) {
      h.rerender()                                     // the countdown re-render, once per simulated second
      await tick(1_000)
    }
    expect(turn(), 'the deadline was lost to re-renders · this is the Rule 76 failure, and it is silent: ' +
      'no error, no console line, just a turn that never ends. A single-shot setTimeout in an effect ' +
      'whose deps churn cannot survive this · the timer must re-derive elapsed time, not hold it.')
      .toBe(before + 1)
  })
})
