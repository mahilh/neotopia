// NeoTopia · THE WIN CREDIT DEPENDS ON THESE TWO VALUES NEVER CHURNING (T3 S38).
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────────────────
// FinalScore credits the winner from an effect shaped like this (award_game_win · migration 020):
//
//     useEffect(() => {
//       if (didAwardRef.current) return
//       if (!sessionId || mySeat == null) return
//       didAwardRef.current = true            // ← the latch is burned BEFORE the loop
//       let cancelled = false
//       ;(async () => { for (let a = 0; a < 4 && !cancelled; a++) { … retry … } })()
//       return () => { cancelled = true }     // ← the cleanup kills the loop
//     }, [practice, sync?.sessionId, mySeat])
//
// Burning the latch before the loop and cancelling the loop in cleanup means ONE re-run of this effect
// disables the retry PERMANENTLY: the cleanup cancels the in-flight loop, and the re-run returns early
// because the latch is already spent. The first attempt is then all there ever is.
//
// That is not theoretical · T3 S38 measured it happening. Under React's DEVELOPMENT double-invoke
// (mount → cleanup → mount) both seats of a real live game called award_game_win exactly once, both got
// 'no_game_end' because the lowest seat's audit row had not landed yet, neither retried, and games_won
// stayed 0. The winner of a real multiplayer game was never credited. Proved to be the double-invoke and
// not a product defect by removing <StrictMode> from main.jsx on the same commit in an isolated worktree,
// after which the same spec logged "attempt 2 · awarded" (Rule 74 · one variable, same commit).
//
// StrictMode is a no-op in a production build, so real players have the retry. THE POINT OF THIS FILE is
// that they have it BY LUCK. Two of that effect's three deps come out of this hook's blast radius, and
// nothing anywhere asserted that either of them holds still:
//   · sync?.sessionId · returned by useGameSync, and set to NULL by the connect effect's own cleanup
//   · mySeat          · derived in GameRoom from the store roster this hook writes through syncFromServer
//
// ── THE ROOT, AND IT IS ONE VALUE ────────────────────────────────────────────────────────────────────────
// The connect effect's cleanup calls setSession(null). Its deps are
// [roomId, connect, fetchAndSeed, setSession, clearRetry, scheduleReconnect]. Of those, setSession,
// clearRetry and scheduleReconnect are useCallback([]) and stable by construction; fetchAndSeed depends on
// [syncFromServer, setSession]; connect depends on [syncFromServer, fetchAndSeed, setSession, …].
// EVERYTHING REDUCES TO syncFromServer. It is read as `useGameStore(s => s.syncFromServer)`, and zustand
// actions defined in the store creator are referentially stable · which is true today and is an assumption,
// not a contract. Wrap it, memoise it, move it into a slice that is rebuilt on state change, and the connect
// effect re-runs on every store update: setSession(null) → re-seed → sessionId flaps null→id on every single
// move of the game, the award effect re-runs, and the retry loop is dead. Silently, with a plausible-looking
// games_won of 0 · indistinguishable from "nobody has won yet", which is the exact silhouette this project
// has now found four times (games_played at 0 for six weeks, award_game_win with no caller, card art 0/56).
//
// So the tests below assert the CONSEQUENCE, not a proxy for it: an effect carrying FinalScore's real dep
// array must run exactly twice over the life of a room, no matter how much the board moves.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEffect, useMemo, useRef, useState } from 'react'

const SESSION_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

// Controllable Supabase mock. The postgres_changes handler is captured so a test can deliver server
// updates the way the real transport does · every move in a real game is one of these, and the game-end
// write is another, so "does a server update disturb these values" is the question that matters.
const h = vi.hoisted(() => ({ pgHandler: null, channelCount: 0 }))

vi.mock('../lib/supabase', () => {
  const makeChannel = () => ({
    on(kind, cfg, cb) {
      if (kind === 'postgres_changes') h.pgHandler = typeof cfg === 'function' ? cfg : cb
      return this
    },
    subscribe(cb) { Promise.resolve().then(() => cb('SUBSCRIBED')); return this },
  })
  const builder = {
    select() { return this },
    eq() { return this },
    update() { return this },
    insert() { return this },
    maybeSingle() { return Promise.resolve({ data: { id: SESSION_ID, state: null }, error: null }) },
  }
  const stub = {
    channel: vi.fn(() => { h.channelCount++; return makeChannel() }),
    removeChannel: vi.fn(),
    from: vi.fn(() => builder),
  }
  return { supabase: stub, default: stub }
})

import { useGameSync } from './useGameSync'
import { useGameStore } from '../store/gameStore'

const ME = 'user-me'
const THEM = 'user-them'

// A server state shaped like the ones syncFromServer actually receives. `n` varies the parts of the board
// that move every turn, so successive deliveries are genuinely different rows rather than the same object
// handed over twice (which would prove nothing about stability).
const serverState = (n) => ({
  phase: 'playing',
  turnNumber: n,
  currentSeat: n % 2,
  actionsRemaining: 3 - (n % 3),
  players: [
    { userId: ME, username: 'Me', seat: 0, scores: {}, hand: [], scoredCardIds: [] },
    { userId: THEM, username: 'Them', seat: 1, scores: {}, hand: [], scoredCardIds: [] },
  ],
})

const deliver = (n) => act(() => { h.pgHandler?.({ new: { id: SESSION_ID, state: serverState(n) } }) })

/**
 * A consumer shaped like the real one. It subscribes to `players` exactly as GameRoom does (so it
 * re-renders on every server update, which is the whole hazard), derives mySeat with GameRoom's own memo,
 * and carries an effect with FinalScore's real award dep array.
 *
 * Returns the count of award-effect RUNS and of its CLEANUPS. Both matter: a cleanup is what cancels the
 * in-flight retry loop, so a cleanup that fires mid-game is the bug even if the effect body then returns
 * early on its latch.
 */
function useAwardHarness(roomId) {
  const sync = useGameSync(roomId, ME)
  const players = useGameStore(s => s.players)
  const mySeat = useMemo(
    () => players.find(p => p.userId && p.userId === ME)?.seat ?? null,
    [players],
  )
  const runs = useRef(0)
  const cleanups = useRef(0)
  const seen = useRef([])
  useEffect(() => {
    runs.current++
    seen.current.push(sync?.sessionId ?? null)
    return () => { cleanups.current++ }
  }, [sync?.sessionId, mySeat])
  return { sync, mySeat, runs, cleanups, seen, players }
}

describe('useGameSync · sessionId and mySeat hold still, because the win credit hangs on it (T3 S38)', () => {
  beforeEach(() => {
    h.pgHandler = null
    h.channelCount = 0
    vi.clearAllMocks()
  })

  test('syncFromServer keeps its identity across store updates · the root the whole chain hangs on', () => {
    // Every callback in useGameSync's connect chain reduces to this one value. If it ever starts changing
    // identity, the connect effect re-runs on every store update and sessionId flaps on every move.
    // Asserted at the root rather than only at the symptom, so the failure names its own cause.
    const { result, rerender } = renderHook(() => useGameStore(s => s.syncFromServer))
    const first = result.current
    act(() => { useGameStore.getState().syncFromServer(serverState(2)) })
    rerender()
    act(() => { useGameStore.getState().syncFromServer(serverState(3)) })
    rerender()
    expect(result.current, 'syncFromServer changed identity · useGameSync will now reconnect on every ' +
      'store update and sessionId will flap null→id on every move').toBe(first)
  })

  test('the connect effect runs ONCE per room · re-renders and server updates cannot re-run it', async () => {
    const { result, rerender } = renderHook(() => useAwardHarness('room-1'))
    await waitFor(() => expect(result.current.sync.sessionId).toBe(SESSION_ID))

    for (let i = 0; i < 5; i++) rerender()
    for (let n = 2; n <= 6; n++) deliver(n)
    for (let i = 0; i < 5; i++) rerender()

    // supabase.channel() is called exactly once by connect(). A second call means the effect re-ran, which
    // means its cleanup ran, which means setSession(null) ran.
    expect(h.channelCount, 'the connect effect re-ran · its cleanup calls setSession(null), so sessionId ' +
      'flapped and any in-flight award retry was cancelled').toBe(1)
  })

  test('sessionId makes exactly ONE transition · null then the id, and never returns to null', async () => {
    const observed = []
    const { result, rerender } = renderHook(() => {
      const s = useAwardHarness('room-2')
      observed.push(s.sync.sessionId)
      return s
    })
    await waitFor(() => expect(result.current.sync.sessionId).toBe(SESSION_ID))
    for (let n = 2; n <= 8; n++) deliver(n)
    for (let i = 0; i < 3; i++) rerender()

    // Collapse consecutive duplicates · the claim is about CHANGES, not about render count.
    const changes = observed.filter((v, i) => i === 0 || v !== observed[i - 1])
    expect(changes, `sessionId churned: ${JSON.stringify(changes)} · every extra entry re-runs FinalScore's ` +
      'award effect and cancels its retry loop').toEqual([null, SESSION_ID])
  })

  test('an effect with FinalScore\'s award deps runs exactly twice over a whole game', async () => {
    // THE DIRECT TEST OF THE FAILURE MODE, rather than a proxy for it. Twice is correct and is the floor:
    // once at mount with sessionId still null (the real effect returns early there and does NOT burn its
    // latch), then once when the id resolves. A THIRD run is the bug · by then the latch is spent, so the
    // re-run returns immediately while its cleanup has already cancelled the only retry loop that existed.
    const { result, rerender } = renderHook(() => useAwardHarness('room-3'))
    await waitFor(() => expect(result.current.sync.sessionId).toBe(SESSION_ID))

    // A whole game's worth of movement: server updates and re-renders interleaved.
    for (let n = 2; n <= 12; n++) { deliver(n); rerender() }

    expect(result.current.seen.current, 'the award effect saw more than the two sessionId values it should')
      .toEqual([null, SESSION_ID])
    expect(result.current.runs.current, `FinalScore's award effect ran ${result.current.runs.current} times ` +
      'across one game · anything past 2 cancels the retry loop and leaves the winner uncredited')
      .toBe(2)
    // One cleanup is expected and harmless: it belongs to the FIRST run, which returned early on a null
    // sessionId and started no loop. A second cleanup would be cancelling a real one.
    expect(result.current.cleanups.current, 'a cleanup fired for the run that actually starts the retry loop')
      .toBe(1)
  })

  test('sessionId DOES go back to null when the room goes away · stability is not staleness', async () => {
    // The counterweight, and it is the reason the tests above are worded as "one transition per room"
    // rather than "never changes". The connect effect's cleanup MUST null it: a sessionId surviving a room
    // change would let the next room's FinalScore write its ledger row against the previous game's session.
    // Pinning stability without pinning this would invite exactly the wrong fix · deleting the cleanup.
    //
    // THE FIRST VERSION OF THIS TEST COULD NOT FAIL, and the mutation check is the only reason I know.
    // It unmounted the hook and then asserted a FRESH renderHook returned a null sessionId · which is a new
    // hook instance with its own useState(null), so it reads null whether the cleanup ran or not. Deleting
    // `setSession(null)` left it green. The counterweight against a vacuous fix was itself vacuous, which
    // is worse than not having written it: it reported the guard as present.
    // The fix is to keep the SAME instance and change the room underneath it, so the observed value is the
    // one the cleanup actually touched.
    const { result, rerender } = renderHook(
      ({ roomId }) => useGameSync(roomId, ME),
      { initialProps: { roomId: 'room-5' } },
    )
    await waitFor(() => expect(result.current.sessionId).toBe(SESSION_ID))
    act(() => { rerender({ roomId: null }) })
    expect(result.current.sessionId, 'leaving a room left its session id behind · the next game would ' +
      "write its ledger row against the previous game's session").toBeNull()
  })

  test('a player keeps the same seat across every server update · mySeat is a stable primitive', async () => {
    const { result, rerender } = renderHook(() => useAwardHarness('room-4'))
    await waitFor(() => expect(result.current.sync.sessionId).toBe(SESSION_ID))

    const seats = []
    for (let n = 2; n <= 10; n++) {
      deliver(n)
      rerender()
      seats.push(result.current.mySeat)
    }
    // syncFromServer replaces `players` with a NEW ARRAY every time, so the memo recomputes on every update.
    // That is fine and expected · what must not change is the VALUE, because the award effect's dep is the
    // number. A server state that ever reordered or renumbered seats would flip it and kill the retry.
    expect(new Set(seats).size, `mySeat changed across a game: ${JSON.stringify(seats)}`).toBe(1)
    expect(seats[0], 'this client should hold seat 0 in the seeded roster').toBe(0)
  })
})
