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

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store/gameStore'

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
    sessionIdRef.current = data.id
    if (data.state) syncFromServer(data.state)
    return true
  }, [syncFromServer])

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
          if (next?.id) sessionIdRef.current = next.id
          if (next?.state) syncFromServer(next.state)
        }
      )
      .on('system', {}, (payload) => {
        // Re-seed from the DB after a transport drop · brief debounce avoids thrashing on flaps.
        if (payload?.status === 'error' || payload?.extension === 'postgres_changes' && payload?.status === 'closed') {
          setTimeout(() => connectRef.current?.(targetRoomId), 1000)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await fetchAndSeed(targetRoomId) // seed AFTER subscribe so no UPDATE is missed in the gap
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(() => connectRef.current?.(targetRoomId), 1000)
        }
      })

    channelRef.current = channel
  }, [syncFromServer, fetchAndSeed])

  connectRef.current = connect

  useEffect(() => {
    if (!roomId) return
    connect(roomId)

    // Real-world recovery beyond Supabase's own WS retry · the 'system'/CHANNEL_ERROR paths above
    // do not fire reliably on every drop (laptop sleep, Chrome network-throttle, mobile tab-suspend):
    //   · 'online'         → the browser regained network · do a FULL reconnect (fresh channel + reseed).
    //   · visibilitychange → a backgrounded tab often has its WS suspended (esp. mobile · 65% of play) ·
    //                        on return, reseed from the DB so the board is current even if the socket
    //                        silently missed UPDATEs. Cheap (one row) · Supabase auto-reconnects the WS.
    const onOnline = () => connect(roomId)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAndSeed(roomId) }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      sessionIdRef.current = null
    }
  }, [roomId, connect, fetchAndSeed])

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

  return { sendMove, pushState, broadcast }
}
