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

import fs from 'node:fs'
import path from 'node:path'
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
import { PRACTICE_HUMAN_ID } from './useLocalSession'

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

  // ⚠ THIS TEST USED TO ASSERT THE OPPOSITE, and the old text is kept because it is the argument for the
  // new one (Rule 101b). It read "practice has no room, so nothing can ever fire · a practice board ending
  // its own turn is pure harm", and it was true of the code and wrong about the product. T1 measured the
  // per-option copy: three of the four practice options are sold as GAMES ("A single opponent",
  // "Three-player game", "A full four-player table"), so a first-timer who learns without a clock meets
  // one for the first time in a real room, unprepared. Their framing argument beat mine and I withdrew it.
  // What survives from my side is the CARVE-OUT, and it is measured rather than argued · see below.
  test('practice WITH bots is a game, so the clock runs there · and never pushes', async () => {
    drive(null, HOST)                                  // no room · two seats from the shared fixture
    const before = turn()
    await tick(LIMIT_MS + TURN_TIMEOUT_GRACE_MS * 2 + 1_000)
    expect(turn(), 'the clock did not run in practice · the Tutorial promises "90 seconds per turn" there ' +
      'and a player who learns without it meets one for the first time in a real room').toBe(before + 1)
    expect(writes, 'practice pushed to a server it does not have · every timeout would return ' +
      '{error:"No room"} and teach a future reader that the path is broken').toEqual([])
  })

  // THE SEAT-RESOLUTION HALF, and it is the one that would have shipped invisibly. Practice seats carry
  // PRACTICE_HUMAN_ID, never the auth uuid, so matching on currentUserId alone finds NOTHING there ·
  // mySeat falls back to 0, the human is classified as a REMOTE client, and the grace is added on top.
  // In Classic that ends their turn at 95s against a Tutorial that prints 90. This test is the only
  // thing that can tell the two resolutions apart: at exactly LIMIT the fixed version has fired and the
  // broken one has not.
  test('the practice human is the ACTIVE seat, not a remote one · fires at the limit, no grace', async () => {
    useGameStore.getState().initGame(
      [{ userId: PRACTICE_HUMAN_ID, username: 'You' }, { userId: 'local-bot-1', username: 'Bot 1', isBot: true }],
      shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
    )
    expect(useGameStore.getState().currentSeat,
      'the fixture does not start on the human seat · this test would measure the bot').toBe(0)

    drive(null, undefined)   // practice mounts with no auth id to match on
    const before = turn()
    await tick(LIMIT_MS)
    expect(turn(), 'the practice human was treated as a REMOTE client · their turn did not end at the ' +
      'limit the Tutorial prints, it ends one grace later. Off by the grace the fix itself added.')
      .toBe(before + 1)
  })
  test('COUNTERWEIGHT · SOLO exploration is not a game · one seat, no clock', async () => {
    // THE CARVE-OUT, and the reason is measured not asserted: driving the store with ONE seat, endTurn
    // keeps seat 0 (nextSeat = (0+1)%1), consumes no production tile, and RESETS ACTIONS TO 3. A timeout
    // there passes the turn to nobody and hands the player their actions back · it cannot teach the
    // mechanic and cannot penalise, so it is pure noise with a visible counter attached. "Just me" is sold
    // as "Free exploration · learn the board", not as a game.
    useGameStore.getState().initGame(
      [{ userId: HOST, username: 'Solo' }], shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
    )
    drive(null, HOST)
    const before = turn()
    await tick(LIMIT_MS * 4)
    expect(turn(), 'a solo explorer had their turn taken · nobody is waiting, nothing advances, and the ' +
      'only visible effect is a turn counter changing under someone still reading the board').toBe(before)
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

// ── THE TURN I DID NOT TEST, WHICH IS EVERY TURN BUT THE FIRST (T3 S59) ─────────────────────────────────
// Every test above mounts, waits once, and asserts one advance · so all of them measure TURN 1, and turn 1
// is the only turn the old clock got right. The effect mounts AT the turn, so the anchor, the turn and the
// sampling grid were the same instant; from turn 2 on, the anchor was stamped by the tick that NOTICED the
// change, up to a full interval late, and the deadline was late by the same amount. Nothing here could see
// it. That is the hidden-parameter shape of Rule 111 in a new place: the turn ORDINAL never varied, so it
// never looked like a choice.
//
// ⚠ AND THE FIX I RECOMMENDED FOR IT DOES NOTHING · that is the finding, and it is measured rather than
// argued. Anchoring exactly at the turn change, with the grid left alone, moves the fire time by ZERO at
// every off-grid offset (1000/750/500/250 before, 0/750/500/250 after · identical except at offset 0, an
// alignment only a fake-timer harness produces). The old anchor always landed ON the grid, so the deadline
// did too; making the anchor exact just moves the same rounding to the other end. The excess was never the
// anchor, it was the SAMPLING PERIOD. Re-phasing the grid ON the turn is what removes it, and then the
// deadline lands on a tick by construction.
//
// SCOPE, stated so the claim is not read wider than it is: this is the ACTIVE seat's OWN limit, which is a
// whole number of seconds and therefore lands exactly on a re-phased grid. The REMOTE grace is a fraction
// (min(5000, limit*0.15) is 2250ms in Flow), so a remote fire is still rounded up to the next tick. That is
// the safety net, not the number the UI prints at the player whose turn it is.
describe('the deadline is the same on turn 2 as on turn 1 (T3 S59)', () => {
  // A turn change lands on the grid only by coincidence, and offset 0 is exactly the case where the OLD
  // code was already exact · so if the fixture happens to hand over on a tick, this whole block passes
  // against the defect it exists to catch. Written first, with nothing else in the file to hide behind.
  const handOverAt = async (offset) => {
    const t0Mount = Date.now()
    drive(ROOM, PEER)                       // seat 1 · becomes the ACTIVE seat once seat 0 ends its turn
    await tick(2_000 + offset)
    let t0
    await act(async () => { useGameStore.getState().endTurn(); t0 = Date.now() })
    return { t0, offGrid: (t0 - t0Mount) % 1_000 }
  }

  test('COUNTERWEIGHT · turn 2 begins OFF the tick grid, or this block tests nothing', async () => {
    const { offGrid } = await handOverAt(250)
    expect(offGrid, 'turn 2 began exactly on a tick · that is the one alignment where the pre-S59 clock ' +
      'was already exact, so every assertion below would pass against the defect they exist to catch')
      .not.toBe(0)
    expect(useGameStore.getState().currentSeat, 'the seat did not move to the client under test · the ' +
      'deadline measured below would be a REMOTE one, which carries a grace and is not the promised limit')
      .toBe(1)
  })

  // ⚠ A SOURCE GUARD, IN A FILE OTHERWISE MADE OF BEHAVIOUR, AND IT IS HERE BECAUSE THE BEHAVIOUR TESTS
  // STRUCTURALLY CANNOT HOLD THIS CLAIM. vi.useFakeTimers advances Date.now() and performance.now() in
  // lockstep, so everything below passes with either clock · all 17 passed against the version that was
  // ~1000ms late in a real browser. Measured there instead: setInterval is scheduled on the MONOTONIC
  // clock and Date.now() is the WALL clock, and they drift · a bare 1s interval run beside the game read
  // SHORT of k*1000 on 56 of 94 ticks in one run, 5 of 95 in another, 0 of 94 in a third. Under
  // performance.now(): 0 of 94, every run, minimum +0.5ms, because a timer cannot fire before its
  // scheduled monotonic time. Re-phasing the grid puts the deadline exactly ON a tick, so a 3ms shortfall
  // there costs a WHOLE SECOND · which made the re-phase alone measurably worse than what it replaced
  // (91037/91027/91001 against a promised 90000, versus 90079 once the clock changed too).
  test('the deadline is compared on the MONOTONIC clock · the only claim here a fake timer cannot make', () => {
    // `import.meta.url` is an http:// URL under vitest+jsdom, not file://, so `new URL` throws here
    // and would throw in CI too · the same vantage-point trap as Rule 123a. __dirname is what this repo's
    // other source-reading gates use, and a wrong path raises ENOENT NAMING the path rather than passing.
    const src = fs.readFileSync(path.resolve(__dirname, 'useGameSync.js'), 'utf8')
    // Presence anchors first (Rule 125b) · every assertion below is an ABSENCE, and an absence passes on
    // an empty string, a renamed ref or a bad path. These two must exist for the rest to mean anything.
    expect(src, 'the turn clock is not anchored on performance.now() · if the anchor moved, this whole ' +
      'guard is asserting the absence of something that no longer has a home').toContain('at: performance.now()')
    expect(src, 'the deadline comparison is not reading performance.now() against the anchor')
      .toContain('performance.now() - turnStartRef.current.at')
    expect(src, 'the deadline is compared on the WALL clock again. setInterval is scheduled on the ' +
      'monotonic clock; the two drift, the re-phased grid lands the deadline exactly ON a tick, and a ' +
      'few milliseconds short there costs a full second. Measured in a browser at ~1000ms late · the ' +
      'fake timers in this file advance both clocks together and cannot tell you.')
      .not.toContain('Date.now() - turnStartRef.current.at')
    expect(src, 'the turn anchor is stamped from the wall clock again · same defect, other end')
      .not.toContain('{ turn, at: Date.now() }')
  })

  for (const offset of [250, 750]) {
    test(`turn 2 handed over ${offset}ms into a tick · ends at the limit exactly, not up to a tick later`, async () => {
      const { t0 } = await handOverAt(offset)
      const before = turn()
      await tick(LIMIT_MS - 1)
      expect(turn(), 'the turn ended BEFORE its limit · firing early is the dangerous direction here, ' +
        'because a player mid-move simply loses the turn and the countdown still showed time left')
        .toBe(before)
      await tick(1)
      expect(Date.now() - t0, 'the harness drifted · this assertion is only an identity if the elapsed ' +
        'time is exactly the limit').toBe(LIMIT_MS)
      expect(turn(), 'turn 2 ran past its own deadline · the clock is sampling on a grid anchored at ' +
        'MOUNT while the turn is anchored at the hand-over, so the deadline is delivered late by however ' +
        'far the turn change fell from the next tick. Turn 1 hides this: it begins at mount, so its ' +
        'anchor and the grid are the same instant.').toBe(before + 1)
    })
  }
})

// ── THE MODE I DID NOT TEST, WHICH IS WHERE THE CONSTANT WAS WRONG (T3 S52) ─────────────────────────────
// Every test above runs in the default mode. That is a hidden parameter (Rule 111): the limit never varied,
// so it never looked like a choice, and a flat 5s-per-seat grace reads as obviously fine at 90s. Flow is
// 15s, where the SAME constant is 33-133% of a turn · a seat-3 client would have waited 35 seconds to end
// a 15-second turn. Found by computing the table rather than by re-reading the code.
describe('the same clock in Flow, where the turn is 6x shorter (T3 S52)', () => {
  const FLOW_LIMIT_MS = 15_000

  const seedFlow = () => {
    useGameStore.getState().initGame(
      [{ userId: HOST, username: 'Host' }, { userId: PEER, username: 'Peer' }],
      shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
      'flow',
    )
  }

  test('COUNTERWEIGHT · the fixture really is Flow · otherwise this whole block re-tests Classic', () => {
    seedFlow()
    expect(useGameStore.getState().turnTimeRemaining,
      'initGame did not seed the Flow clock · every assertion below would silently be a second copy of ' +
      'the Classic tests, which is exactly the blindness this block exists to remove').toBe(15)
  })

  test('the active player own client honours the SHORT limit, not the Classic one', async () => {
    seedFlow()
    drive(ROOM, HOST)
    const before = turn()
    await tick(FLOW_LIMIT_MS)
    expect(turn(), 'a Flow turn did not end at 15s · the clock is reading a constant instead of the mode')
      .toBe(before + 1)
  })

  test('the remote grace stays PROPORTIONAL · it cannot exceed the turn it is waiting on', async () => {
    seedFlow()
    drive(ROOM, PEER)                                   // seat 1 · grace = min(5000, 15000*0.15) * 2
    const before = turn()
    await tick(FLOW_LIMIT_MS)
    expect(turn(), 'the remote client ended a turn at the bare limit · the active player own client must ' +
      'get first refusal').toBe(before)
    // 2 x 2.25s = 4.5s. With the pre-fix flat constant this needed 10s and would still be frozen here.
    await tick(5_000)
    expect(turn(), 'the remote grace is still the flat 5s-per-seat constant · in Flow that is 33-133% of ' +
      'a turn, so an absent player costs more than double the turn budget every round').toBe(before + 1)
  })
})
