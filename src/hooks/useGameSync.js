// NeoTopia · authoritative game-state sync during play.
// T3 owns this file.
//
// Channel discipline (per CLAUDE.md · never mix these up):
//   DB changes (postgres_changes on game_sessions) → AUTHORITATIVE state · every client syncs here
//   Broadcast                                       → EPHEMERAL only (hover/cursor/anim · <1KB)
//   Presence                                        → lobby roster · lives in usePresence, not here
//
// The DB is the source of truth (CLAUDE.md rule 16). Optimistic moves apply locally first, then
// persist · a failed persist rolls back to the pre-move snapshot.

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store/gameStore'
import {
  reportBackendUp, reportBackendRetrying, reportBackendDown,
  registerBackendRetry, clearBackendSource,
} from './useConnectionHealth'

// ── Reconnect budget (T3 S26) ─────────────────────────────────────────────────────────────────────────────
// THE BUG THIS REPLACES (measured · not theoretical): both failure paths below used to schedule
// `setTimeout(() => connect(roomId), 1000)` · a FIXED 1s delay, no ceiling, no give-up. Against an
// unreachable backend that is a 1Hz reconnect storm that runs until the tab closes, and it compounds three
// ways: (1) every round tears down and re-creates a channel and re-fires a REST seed, so each round costs
// several failed requests, not one; (2) the 'system' error handler AND the .subscribe(CHANNEL_ERROR)
// callback BOTH fire for the same failure, so each round scheduled TWO timers → the error count grew
// superlinearly (the observed 6 → 18 in seconds), not linearly; (3) the timers were never cleared, so one
// left pending across a room change or unmount resurrected a channel cleanup() had already removed.
//
// The replacement is a single-timer exponential backoff with a hard stop:
//   attempt 1..6 → 1s · 2s · 4s · 8s · 16s · 30s (capped) ≈ 61s of patient retrying, then GIVE UP.
// Giving up is the point. A dead backend is not fixed by asking it faster; the correct end state is a
// terminal 'offline' the UI can render, plus an explicit way back in (the browser 'online' event, or a
// user-driven retry via useConnectionHealth). Deterministic delays (no jitter): NeoTopia rooms are ≤4
// players so there is no thundering herd to smear, and a fixed schedule is exactly assertable in a test
// (Rule 63 · the evidence is the schedule, not "it builds").
export const RECONNECT_BASE_MS = 1000
export const RECONNECT_MAX_MS = 30_000
export const RECONNECT_MAX_ATTEMPTS = 6
export const HEALTH_SOURCE = 'game-sync'

/**
 * Backoff delay for a 1-based attempt number · doubles from BASE, clamped at MAX. Pure · exported for the test.
 * The non-finite guard is not decoration: Math.floor(NaN) is NaN, and setTimeout(fn, NaN) fires at 0ms · a
 * junk attempt number would turn the backoff into the very hot loop this whole change exists to remove.
 */
export function reconnectDelayMs(attempt) {
  const n = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1
  return Math.min(RECONNECT_BASE_MS * 2 ** (n - 1), RECONNECT_MAX_MS)
}

// JSON-serialisable snapshot of the store: drops action functions (jsonb can't hold them ·
// structuredClone would THROW on them) and collapses the pendingMoves Set. syncFromServer
// rehydrates pendingMoves as a Set on read, so the round-trip is lossless.
function serializableState() {
  return JSON.parse(JSON.stringify(useGameStore.getState()))
}

// game_events.event_type is constrained by a DB CHECK (the set below · verified live against
// pg_constraint). The persistence boundary must send ONLY these values.
//
// HISTORY · the boundary now tolerates BOTH conventions, because two lanes converged on the same fix:
//   · T3 S6 added EVENT_TYPE_DB to translate the move loop's old shorthand (place/draw/score/endTurn).
//   · T1 S6 independently renamed useGameActions.persist(...) to emit the DB-valid names directly.
//   Run together, a translate-ONLY map MISSES every already-valid name (EVENT_TYPE_DB['place_element']
//   is undefined) → every audit insert is skipped → the game_events log goes SILENTLY empty (no 400,
//   just nothing written). So resolveDbEventType() passes an already-valid value straight through and
//   still translates any legacy shorthand · either emitter convention yields a correct CHECK-valid
//   row, and an unknown type is skipped (never sent). (T3 S7 · regression found during gates.)
export const DB_ALLOWED = Object.freeze([
  'draw_card', 'place_element', 'build_project', 'use_bonus', 'factory_refill', 'turn_end', 'game_end',
])
const DB_ALLOWED_SET = new Set(DB_ALLOWED)

// Legacy shorthand → DB vocabulary · retained so an older/other emitter can never silently 400.
export const EVENT_TYPE_DB = {
  place:   'place_element',
  draw:    'draw_card',
  score:   'build_project',
  endTurn: 'turn_end',
  bonus:   'use_bonus',
  refill:  'factory_refill',
  gameEnd: 'game_end',
}

// Resolve any emitter's event name to a CHECK-valid game_events.event_type, or undefined if unknown
// (the caller then skips the audit row rather than send a value the CHECK rejects).
export function resolveDbEventType(eventType) {
  if (DB_ALLOWED_SET.has(eventType)) return eventType   // already valid · current useGameActions
  return EVENT_TYPE_DB[eventType]                        // legacy shorthand · else undefined
}

// game_sessions.phase has its OWN CHECK (verified live · pg_constraint): 'playing' | 'endgame' | 'finished'.
// That vocabulary DIFFERS from the store phase ('lobby' | 'playing' | 'scoring'). The store's terminal
// 'scoring' is NOT a valid column value · writing it un-mapped 400s the ENTIRE game_sessions UPDATE, so the
// game-over state never persists and NO client ever receives the terminal phase via postgres_changes (the
// natural game-end was silently un-syncable · latent because no game had reached it · T3 S8 · found by the
// phase-over-wire E2E). Map at the write boundary: the jsonb `state` still carries the true store phase
// (what syncFromServer reads), the denormalised column just has to be CHECK-valid.
const SESSION_PHASE_COL = new Set(['playing', 'endgame', 'finished'])
export function sessionPhaseColumn(storePhase) {
  if (SESSION_PHASE_COL.has(storePhase)) return storePhase  // already a valid column value
  if (storePhase === 'scoring') return 'finished'           // store terminal → column terminal
  return 'playing'                                          // 'lobby'/unknown · never block the state write
}

export function useGameSync(roomId, currentUserId) {
  const channelRef = useRef(null)
  const sessionIdRef = useRef(null)   // game_sessions.id · required for game_events FK (NOT room_id)
  const connectRef = useRef(null)     // latest connect fn · lets the reconnect handler avoid a stale closure
  const retryTimerRef = useRef(null)  // the SINGLE in-flight reconnect timer · never two (see the budget note)
  const attemptRef = useRef(0)        // consecutive failed connects · reset to 0 by a successful SUBSCRIBED
  // sessionId is ALSO held as reactive state so it can be RETURNED to consumers (T1's FinalScore wires the
  // Global Index off it · T3 S16). The ref alone is not enough: a ref read in the return value is frozen at
  // render time and a ref mutation does not re-render, so `sessionId: sessionIdRef.current` could stay null
  // until some unrelated re-render (Rule 61 · expose the live value, not a stale snapshot). The ref stays for
  // the synchronous read inside pushState's async callback; setSession() keeps both in lockstep.
  const [sessionId, setSessionId] = useState(null)
  const setSession = useCallback((id) => { sessionIdRef.current = id; setSessionId(id) }, [])
  const syncFromServerRaw = useGameStore(s => s.syncFromServer)

  // ── OVERTAKE DETECTION · a lost write says so instead of deadlocking in silence (T3 S43) ──────────────
  // MEASURED FIRST (S41 live, reproduced S42 in useGameSync.writeorder.test.js): persist is fire-and-forget
  // (useGameActions.js:56) and pushState reads serializableState() SYNCHRONOUSLY at call time, so one turn
  // of place·place·place·EndTurn issues FOUR overlapping UPDATEs carrying four different instants, and the
  // row keeps whichever the server applied LAST. When that is a placement issued BEFORE the End Turn,
  // current_seat reverts, the host has already moved on, and both players deadlock in opposite directions ·
  // the host waiting for a joiner who is correctly waiting for the host.
  //
  // THIS DOES NOT FIX IT, AND THAT IS DELIBERATE. The fix is a server-side ordering guarantee (T2 · an OCC
  // predicate on the UPDATE · shape posted to comms BEFORE this was built so their version and this counter
  // are one value, not two). A client-side repair here would also HIDE the thing this measures, and a
  // detector that silently heals is how a defect survives another nineteen sessions. It reports, only.
  //
  // __seq IS A LAMPORT CLOCK: max(last OBSERVED, last SENT) + 1. Both terms are load-bearing. A purely
  // per-client counter cannot order two clients · A's 5 and B's 3 are incomparable · so a detector built on
  // one would cry overtake every time the opponent moved. But observed-only is equally wrong, and that is
  // the version I wrote first: two pushes in one turn both read the same stale value and mint the SAME
  // number, so the detector goes blind to exactly the self-clobber it exists for. Taking the max of both
  // keeps this client's writes strictly increasing AND advances past anything the session has seen, with no
  // coordination and no migration · serializableState() is the whole store and syncFromServer Object.assigns
  // the server state back (gameStore.js:553-561), so the field rides out and back on its own.
  const sentSeqRef = useRef(0)          // highest __seq this client has written
  const [overtakes, setOvertakes] = useState([])

  // EVERY inbound state funnels through here · the realtime handler, the REST seed AND the rollback path
  // all called syncFromServer directly, and a detector wired into only one of them would report a clean
  // room while a write vanished through another (Rule 84 · a well-tested symbol is not a tested path).
  const syncFromServer = useCallback((serverState) => {
    const incoming = Number(serverState?.__seq ?? 0)
    if (sentSeqRef.current > 0 && incoming < sentSeqRef.current) {
      const event = {
        sentSeq: sentSeqRef.current,
        serverSeq: incoming,
        behindBy: sentSeqRef.current - incoming,
        currentSeat: serverState?.currentSeat ?? null,
        turnNumber: serverState?.turnNumber ?? null,
      }
      setOvertakes(prev => [...prev.slice(-9), event])
      if (import.meta.env.DEV) {
        console.warn(`[T3] WRITE OVERTAKEN · this client wrote __seq ${event.sentSeq} and the server is ` +
          `serving __seq ${event.serverSeq} (behind by ${event.behindBy}). A later write was overwritten ` +
          `by an earlier one · seat ${event.currentSeat}, turn ${event.turnNumber}.`)
      }
    }
    // The server still wins · this is a witness, not a gate (CLAUDE.md rule 16).
    syncFromServerRaw(serverState)
  }, [syncFromServerRaw])

  // Pull the current authoritative row: caches the session id AND seeds local state. Run on first
  // connect and on every reconnect, because Realtime may have dropped UPDATEs while disconnected
  // (and a client that subscribes after the host's INSERT never receives that INSERT event).
  //
  // RETURN SHAPE · { ok, seeded, error } (T3 S27 · this used to return a bare boolean).
  // The boolean conflated two states that must NOT be treated alike, which is precisely why the seed
  // failure went unreported (the S26 gap · subscribe succeeds, REST seed fails, health still reads online):
  //   · error truthy      → the REST call genuinely FAILED. We are subscribed but hold no authoritative
  //                         state · the board is blank or stale while the socket claims everything is fine.
  //                         That is a degraded client and it must say so. → { ok: false }
  //   · no row (data null)→ PERFECTLY HEALTHY and extremely common: every player sitting in a lobby has a
  //                         roomId but no game_sessions row until the host presses Start. maybeSingle()
  //                         returns { data: null, error: null } for zero rows. Reporting this as a failure
  //                         would put every waiting lobby into a reconnect storm — a far worse bug than the
  //                         one being fixed. → { ok: true, seeded: false }
  // The distinction is the whole fix. `ok` means "the backend answered"; `seeded` means "there was state".
  const fetchAndSeed = useCallback(async (targetRoomId) => {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, state')
      .eq('room_id', targetRoomId)
      .maybeSingle()
    if (error) return { ok: false, seeded: false, error }
    if (!data) return { ok: true, seeded: false, error: null } // reachable · nothing to seed yet
    setSession(data.id)
    if (data.state) syncFromServer(data.state)
    return { ok: true, seeded: true, error: null }
  }, [syncFromServer, setSession])

  // Cancel any pending reconnect. Called before scheduling a new one, on a successful subscribe, and on
  // unmount/room change · that last one is what stops a queued timer from resurrecting a channel the effect
  // cleanup already removed.
  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  // Schedule the next reconnect, or give up. THE DEDUPE IS LOAD-BEARING: the 'system' error event and the
  // subscribe(CHANNEL_ERROR) callback both fire for a single failure, so without this guard every failure
  // scheduled two timers and the retry rate doubled each round. One pending timer at a time, always.
  const scheduleReconnect = useCallback((targetRoomId, reason) => {
    if (retryTimerRef.current) return // a reconnect is already queued for this failure · do not stack another

    const attempt = attemptRef.current + 1
    if (attempt > RECONNECT_MAX_ATTEMPTS) {
      // Budget exhausted. Stop scheduling entirely · no timer, no further requests · and hand the UI a
      // terminal state it can render. Recovery is now explicit: the browser 'online' event below, or a
      // user-driven retryBackend() (both reset the budget via resetAndConnect).
      reportBackendDown(HEALTH_SOURCE, reason ?? 'realtime unreachable', attemptRef.current)
      return
    }

    attemptRef.current = attempt
    const delay = reconnectDelayMs(attempt)
    reportBackendRetrying(HEALTH_SOURCE, { attempt, reason: reason ?? 'realtime unreachable' })
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null // clear BEFORE reconnecting so the next failure can schedule again
      connectRef.current?.(targetRoomId)
    }, delay)
  }, [])

  const connect = useCallback((targetRoomId) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`game-sync:${targetRoomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `room_id=eq.${targetRoomId}` },
        (payload) => {
          const next = payload.new
          if (next?.id) setSession(next.id)
          if (next?.state) syncFromServer(next.state)
        }
      )
      .on('system', {}, (payload) => {
        // Re-seed from the DB after a transport drop · backed off, deduped against the CHANNEL_ERROR path.
        if (payload?.status === 'error' || payload?.extension === 'postgres_changes' && payload?.status === 'closed') {
          scheduleReconnect(targetRoomId, 'transport dropped')
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // The socket is up · cancel the queued retry that led us here.
          clearRetry()

          // Seed AFTER subscribe so no UPDATE is missed in the gap.
          const seed = await fetchAndSeed(targetRoomId)

          // ── THE SUCCESS CONDITION IS "SUBSCRIBED **AND** SEEDED" (T3 S27) ────────────────────────────
          // Neither the budget reset nor the healthy report may happen until BOTH hold. Two reasons, and
          // the second is the load-bearing one:
          //   · honesty · a client with a live socket but no authoritative state is degraded, and used to
          //     report ONLINE. That was the carried S26 gap.
          //   · TERMINATION · if `attemptRef` were reset on the socket alone, a persistently failing seed
          //     would loop forever: subscribe ok → attempts=0 → seed fails → schedule → reconnect →
          //     subscribe ok → attempts=0 → … a brand-new storm of exactly the class the backoff exists to
          //     kill. Keeping the budget tied to the full success makes the ladder monotonic, so a seed
          //     that never recovers walks the 6 attempts and lands in a terminal 'offline' like any other
          //     dead transport.
          // Recovery deliberately reuses scheduleReconnect rather than adding a seed-only retry timer:
          // ONE owner per transport, one pending timer, one budget (the double-scheduling note above).
          if (seed.ok) {
            attemptRef.current = 0
            reportBackendUp(HEALTH_SOURCE)
          } else {
            scheduleReconnect(targetRoomId, `state seed failed · ${seed.error?.message ?? 'unknown'}`)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          scheduleReconnect(targetRoomId, `channel ${status.toLowerCase()}`)
        }
      })

    channelRef.current = channel
  }, [syncFromServer, fetchAndSeed, setSession, scheduleReconnect, clearRetry])

  connectRef.current = connect

  useEffect(() => {
    if (!roomId) return

    // A fresh room gets a fresh budget · a previous room's exhausted attempts must never make this one
    // give up early.
    clearRetry()
    attemptRef.current = 0
    connect(roomId)

    // Full recovery: cancel any queued backoff, hand back the WHOLE budget, reconnect NOW. This is the only
    // way out of the terminal 'offline' state, so it is deliberately shared by both escape hatches below.
    const resetAndConnect = () => {
      clearRetry()
      attemptRef.current = 0
      connect(roomId)
    }

    // Real-world recovery beyond Supabase's own WS retry · the 'system'/CHANNEL_ERROR paths above
    // do not fire reliably on every drop (laptop sleep, Chrome network-throttle, mobile tab-suspend):
    //   · 'online'         → the browser regained network · do a FULL reconnect (fresh channel + reseed).
    //                        Kept as this hook's OWN listener rather than folded into useConnectionHealth:
    //                        a silent WS drop never reports a failure, so health can still read 'online'
    //                        while this channel is dead · a health-gated handler would miss exactly that
    //                        case, which is the one this listener was added for.
    //   · visibilitychange → a backgrounded tab often has its WS suspended (esp. mobile · 65% of play) ·
    //                        on return, reseed from the DB so the board is current even if the socket
    //                        silently missed UPDATEs. Cheap (one row) · Supabase auto-reconnects the WS.
    const onOnline = () => resetAndConnect()
    // A returning tab reseeds · and if THAT reseed fails, it is reported like any other seed failure rather
    // than swallowed. Pre-fix this was a bare fire-and-forget call: the tab came back, the seed failed, and
    // the player looked at a stale board with a perfectly healthy-looking UI (T3 S27 · same gap, second
    // call site · a fix applied to only one of the two entry points would have left the hole half open).
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      fetchAndSeed(roomId).then((seed) => {
        if (!seed.ok) scheduleReconnect(roomId, `state seed failed · ${seed.error?.message ?? 'unknown'}`)
      })
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    // Make that same recovery reachable from a UI that cannot know which transport broke (a "Try again"
    // control reads useBackendHealth and calls retry() · it never imports this hook).
    const unregisterRetry = registerBackendRetry(HEALTH_SOURCE, resetAndConnect)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      unregisterRetry()
      clearRetry() // a queued reconnect would otherwise resurrect a channel this cleanup just removed
      clearBackendSource(HEALTH_SOURCE) // this transport no longer exists · it must stop dragging the flag down
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setSession(null) // clear ref + reactive state on room change/unmount
    }
  }, [roomId, connect, fetchAndSeed, setSession, clearRetry, scheduleReconnect])

  // Low-level persist: write current store state to game_sessions (→ every client syncs) plus a
  // best-effort append to the game_events audit log. Returns { error } from the state write only ·
  // the event write never blocks the move (audit log is non-critical to sync).
  const pushState = useCallback(async (eventType, eventData = {}) => {
    if (!roomId) return { error: { message: 'No room' } }
    const base = serializableState()
    // max(last OBSERVED, last SENT) + 1 · and the second half of that max is not decoration. My first
    // version was (observed + 1) alone, which is the classic half-a-Lamport-clock mistake and it made the
    // detector BLIND TO ITS OWN CASE: two pushes in the same turn both read __seq 0 from the store (the
    // server has not echoed either back yet), both minted 1, and `serverSeq < sentSeq` was 1 < 1 · false.
    // The test caught it on the first run. Carrying the local high-water mark makes this client's own
    // successive writes strictly increasing, which is the ordering the whole detector rests on, while the
    // observed term keeps it session-global across clients.
    const seq = Math.max(Number(base.__seq ?? 0), sentSeqRef.current) + 1
    const s = { ...base, __seq: seq }
    if (seq > sentSeqRef.current) sentSeqRef.current = seq

    const { error: stateErr } = await supabase
      .from('game_sessions')
      .update({
        state: s,
        current_seat: s.currentSeat,
        turn_number: s.turnNumber,
        actions_remaining: s.actionsRemaining,
        production_tiles_remaining: s.productionTilesRemaining,
        phase: sessionPhaseColumn(s.phase), // store 'scoring' → 'finished' · else the terminal UPDATE 400s
      })
      .eq('room_id', roomId)

    if (stateErr) return { error: stateErr }

    // Resolve the event name to a CHECK-valid event_type · accepts the DB-valid names useGameActions
    // emits today AND any legacy shorthand (see resolveDbEventType). The CHECK rejects unknown values
    // outright (HTTP 400 · T1 S5), so we never send one · we skip the audit row instead. A 400 here
    // would prove the row reached the DB (session_id present) · this path avoids it entirely.
    const dbEventType = resolveDbEventType(eventType)
    if (dbEventType && sessionIdRef.current) {
      // session_id MUST be game_sessions.id (uuid FK) · room_id here would FK-fail every event.
      // sequence_num is GENERATED ALWAYS AS IDENTITY · do NOT provide it · the DB owns the
      // monotonic order (an explicit value errors "cannot insert a non-DEFAULT value"). Letting
      // the DB assign it also gives a globally correct cross-client ordering for replay.
      await supabase.from('game_events').insert({
        session_id: sessionIdRef.current,
        seat_number: s.currentSeat,
        event_type: dbEventType,
        event_data: eventData,
      }) // best-effort · ignore errors so a flaky audit insert never reverts a valid move
    } else if (eventType && !dbEventType && import.meta.env.DEV) {
      console.warn(`[T3] no game_events mapping for "${eventType}" · audit row skipped (add it to EVENT_TYPE_DB)`)
    }
    return { error: null }
  }, [roomId])

  // Optimistic move · the correct order (CLAUDE.md OPTIMISTIC UPDATES):
  //   1. snapshot BEFORE mutating   2. apply locally   3. persist   4. rollback on persist error
  // `mutate` is a function that applies the change to the store (e.g. () => store.placeElement(...)).
  const sendMove = useCallback(async (mutate, eventType, eventData = {}) => {
    if (!roomId || !currentUserId) return false
    const snapshot = serializableState() // pre-move · functions/Set already stripped

    if (typeof mutate === 'function') mutate()

    const { error } = await pushState(eventType, eventData)
    if (error) {
      syncFromServer(snapshot) // rollback · rehydrates pendingMoves Set
      console.error('[T3] move rejected, rolled back:', error.message)
      return false
    }
    return true
  }, [roomId, currentUserId, pushState, syncFromServer])

  // Ephemeral broadcast (hover/cursor/anim) · hard <1KB guard so game state never leaks here.
  const broadcast = useCallback(async (event, payload = {}) => {
    if (!channelRef.current) return
    const body = { ...payload, fromUserId: currentUserId }
    if (JSON.stringify(body).length > 1024) {
      console.warn('[T3] broadcast payload too large for an ephemeral event · dropped')
      return
    }
    await channelRef.current.send({ type: 'broadcast', event, payload: body })
  }, [currentUserId])

  // sessionId (game_sessions.id · string UUID) is exposed reactively for consumers that persist against the
  // session — T1's FinalScore passes it to recordCivilizationDetail for the Global Index (T3 S16 · unblocks the
  // wire T1 S15 refused to ship as a silent no-op · Rule 61). null until the first fetchAndSeed resolves.
  return { sendMove, pushState, broadcast, sessionId, overtakes }
}
