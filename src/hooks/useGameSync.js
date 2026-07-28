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
  const syncFromServer = useGameStore(s => s.syncFromServer)

  // Pull the current authoritative row: caches the session id AND seeds local state. Run on first
  // connect and on every reconnect, because Realtime may have dropped UPDATEs while disconnected
  // (and a client that subscribes after the host's INSERT never receives that INSERT event).
  const fetchAndSeed = useCallback(async (targetRoomId) => {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, state')
      .eq('room_id', targetRoomId)
      .maybeSingle()
    if (error || !data) return false
    setSession(data.id)
    if (data.state) syncFromServer(data.state)
    return true
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
          // Connected. Cancel any queued retry, hand back the full budget for the NEXT outage, and clear the
          // degraded flag · a recovery must reset the counter or a long session would slowly exhaust it
          // across unrelated flaps and give up on a backend that is actually fine.
          clearRetry()
          attemptRef.current = 0
          reportBackendUp(HEALTH_SOURCE)
          await fetchAndSeed(targetRoomId) // seed AFTER subscribe so no UPDATE is missed in the gap
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
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAndSeed(roomId) }
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
  }, [roomId, connect, fetchAndSeed, setSession, clearRetry])

  // Low-level persist: write current store state to game_sessions (→ every client syncs) plus a
  // best-effort append to the game_events audit log. Returns { error } from the state write only ·
  // the event write never blocks the move (audit log is non-critical to sync).
  const pushState = useCallback(async (eventType, eventData = {}) => {
    if (!roomId) return { error: { message: 'No room' } }
    const s = serializableState()

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
  return { sendMove, pushState, broadcast, sessionId }
}
