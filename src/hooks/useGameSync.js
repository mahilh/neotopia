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
import { nextStateVersion, adoptServerVersion, wasOvertaken } from '../lib/writeOrder'
import { getModeConfig } from '../store/gameConfig'
import { PRACTICE_HUMAN_ID } from './useLocalSession'

// ── THE TURN CLOCK, MADE REAL (T3 S52) ────────────────────────────────────────────────────────────────────
// A remote client waits this long PAST the limit before ending someone else's turn, staggered by seat so
// the common case has exactly one writer. The active player's OWN client fires at the limit with no grace ·
// that is the promise the Tutorial and the Lobby have always printed. The stagger is not load-bearing:
// state_version (migration 022) already refuses the loser of any race, and the winner's write reaches every
// client through postgres_changes. It just means the refusal is rare rather than routine.
export const TURN_TIMEOUT_GRACE_MS = 5_000

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

  // ── WRITE ORDERING · T2's PREDICATE, WIRED (T3 S44) ───────────────────────────────────────────────────
  // THE DEFECT (T3 S42 · 0b40998, reproduced with zero live runs, then measured against real Postgres in
  // tests/e2e/postgres-writeorder.e2e.js): persist is fire-and-forget and pushState reads
  // serializableState() SYNCHRONOUSLY at call time, so place·place·place·EndTurn issues four overlapping
  // UPDATEs carrying four different instants and the row keeps whichever landed LAST. One client losing a
  // write to ITSELF · no opponent required, which is why it reproduced on a quiet board.
  //
  // MY S43 DETECTOR IS GONE AND THAT IS THE POINT. I shipped a `__seq` Lamport counter in the state jsonb
  // to NAME the loss, and posted its shape to comms before building it precisely so this moment would be a
  // deletion rather than an argument. T2 then shipped the real thing · migration 022's state_version column
  // plus src/lib/writeOrder.js · so carrying both would be a second contract and a second witness that
  // agree today and drift later (Rule 94). Theirs is also the better signal: `wasOvertaken` reads the
  // server's own REFUSAL (zero rows affected), where mine INFERRED a loss from a counter going backwards.
  // An authoritative no beats a clever deduction.
  //
  // VERIFIED LIVE BEFORE WIRING, because a predicate on a column that does not exist would 400 every write
  // in the game (Rule 68 · a migration committed is not a deployed schema):
  //     information_schema · state_version · bigint · NOT NULL · DEFAULT 0   ✅ applied
  //     column_privileges  · UPDATE granted to anon AND authenticated        ✅ writable
  const versionRef = useRef(0)
  const [overtakes, setOvertakes] = useState([])

  // EVERY inbound state funnels through here · the realtime handler, the REST re-seed AND the rollback
  // path all called syncFromServer directly, and folding the server's version in only one of them would
  // let this client renumber backwards through another (Rule 84 · a well-tested symbol is not a tested
  // path). adoptServerVersion is a MAX, never an assignment: a client that has issued 7 and then receives
  // 5 from a peer's older write must not renumber down, or its own next write fails its own predicate.
  // ── AND THE VERSION GATES WHAT WE ACCEPT, NOT ONLY WHAT WE SEND (T3 S55) ────────────────────────────
  // migration 022 orders WRITES. Nothing ordered APPLIES, and they are different problems wearing the
  // same costume: this wrapper folded the server version into versionRef (outgoing numbering) and then
  // called syncFromServerRaw UNCONDITIONALLY, so any snapshot that arrived was assigned over whatever
  // the client already held · newer or not.
  // REACHABLE IN ORDINARY PLAY, not exotic: fetchAndSeed is an awaited REST read with two triggers that
  // fire exactly when the network is unhappy (reconnect, and visibilitychange · "a backgrounded tab often
  // has its WS suspended, esp. mobile · 65% of play"). Issue the read at T0, let a newer realtime frame
  // land at T1, and the T0 snapshot resolves at T2 and overwrites it. The client silently regresses, and
  // its NEXT push persists that regression carrying a correctly incremented version · which `.lt` accepts,
  // because the write really is newer. The predicate does its job and the board still loses placements.
  // That is the mechanism behind the S54 observation (a persisted board went 3 placements to 2 as
  // state_version went 3 to 4, one client writing) · reproduced deterministically in writeorder.test.js.
  // The engine was ruled out first: 120 games under four adversarial policies, 17,004 observations, zero
  // decreases, so this was the remaining half rather than a guess.
  const appliedVersionRef = useRef(0)
  const syncFromServer = useCallback((serverState, serverVersion) => {
    // The adopt stays FIRST and unconditional. It is a MAX and it is about our outgoing numbering, which
    // must reflect the newest thing the server has told us even when we decline the payload · moving it
    // inside the guard would let a client renumber backwards through a skipped frame (Rule 84).
    versionRef.current = adoptServerVersion(versionRef.current, serverVersion)
    const v = Number(serverVersion)
    if (Number.isFinite(v) && v > 0) {
      if (v <= appliedVersionRef.current) return   // stale or replayed · applying it would regress us
      appliedVersionRef.current = v
    }
    // An UNVERSIONED call is deliberately still applied: sendMove's rollback passes a local snapshot with
    // no version, and gating that would strand a client on a state the server rejected.
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
      // state_version comes along on the SEED, not just on realtime. A client that re-seeds after a
      // transport drop and does NOT adopt the row's version keeps counting from its own stale local
      // number, and its next write is refused by its own predicate · a reconnect would silently stop
      // that client from moving. The re-seed is exactly where a version is most likely to have moved.
      .select('id, state, state_version')
      .eq('room_id', targetRoomId)
      .maybeSingle()
    if (error) return { ok: false, seeded: false, error }
    if (!data) return { ok: true, seeded: false, error: null } // reachable · nothing to seed yet
    setSession(data.id)
    if (data.state) syncFromServer(data.state, data.state_version)
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
          if (next?.state) syncFromServer(next.state, next.state_version)
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
      // AND RESET THE APPLY WATERMARK WITH IT. Versions are per-ROW, so carrying a high watermark into a
      // new room would silently refuse every frame whose version happens to be lower · a fresh room starts
      // at 1, so the guard added above would freeze the client completely. The bug the fix would have
      // introduced, closed in the same commit.
      appliedVersionRef.current = 0
    }
  }, [roomId, connect, fetchAndSeed, setSession, clearRetry, scheduleReconnect])

  // Low-level persist: write current store state to game_sessions (→ every client syncs) plus a
  // best-effort append to the game_events audit log. Returns { error } from the state write only ·
  // the event write never blocks the move (audit log is non-critical to sync).
  const pushState = useCallback(async (eventType, eventData = {}) => {
    if (!roomId) return { error: { message: 'No room' } }
    const s = serializableState()
    // Numbered by ISSUE order, taken at the SAME moment as the snapshot · writeOrder.js says so in as many
    // words, and it matters: a number minted later than its snapshot describes a different instant.
    const version = nextStateVersion(versionRef.current)
    versionRef.current = version

    const { data, error: stateErr } = await supabase
      .from('game_sessions')
      .update({
        state: s,
        state_version: version,
        current_seat: s.currentSeat,
        turn_number: s.turnNumber,
        actions_remaining: s.actionsRemaining,
        production_tiles_remaining: s.productionTilesRemaining,
        phase: sessionPhaseColumn(s.phase), // store 'scoring' → 'finished' · else the terminal UPDATE 400s
      })
      .eq('room_id', roomId)
      .lt('state_version', version) // ← the guarantee · a stale snapshot is refused, not applied
      .select('state_version')      // ← REQUIRED · wasOvertaken(null) is false, so without this a refusal
                                    //   reads as success and the whole predicate becomes invisible (T2)

    if (stateErr) return { error: stateErr }

    // A REFUSAL IS NOT AN ERROR · it is the predicate working. The row already holds something newer, so
    // this snapshot is stale and dropping it is correct. It is reported rather than retried: a client-side
    // retry here would re-send the same stale instant, and a detector that silently repairs hides the
    // thing it measures. The next legitimate action pushes a fresh snapshot anyway.
    if (wasOvertaken(data)) {
      const event = { version, seat: s.currentSeat, turn: s.turnNumber, eventType }
      setOvertakes(prev => [...prev.slice(-9), event])
      if (import.meta.env.DEV) {
        console.warn(`[T3] WRITE REFUSED (overtaken) · state_version ${version} lost to a newer row · ` +
          `"${eventType}" at seat ${event.seat}, turn ${event.turn}. Before migration 022 this write ` +
          'would have CLOBBERED the newer state instead.')
      }
      return { error: null, overtaken: true }
    }

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
    return { error: null, overtaken: false }
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
  // ── A DEV-ONLY SEAM, BECAUSE A DETECTOR WITH NO CONSUMER IS NOT WATCHED (T3 S44 · P3) ─────────────────
  // `overtakes` is React state inside this hook, so nothing outside the component tree can see it · which
  // is the exact shape of award_game_win (applied, invoked by nothing, 0 rows against 3 finished games)
  // and useBonus (earnable, spendable by nobody). A value resting somewhere plausible with no consumer is
  // how a subsystem stays unreachable for months (Rules 84/85), and I built one last session.
  // Same gate and same lifecycle as GameRoom's window.__neotopia_store seam: DEV only, stripped from the
  // production bundle, removed on unmount. It is NOT put in the store on purpose · store state is
  // serialised into game_sessions on every push, so a diagnostic there would be written to the database
  // and synced to every other player.
  // tests/e2e/endgame-live.e2e.js asserts this is empty after a clean game · that is the consumer.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__neotopia_writeorder = { overtakes, version: versionRef.current }
    return () => { delete window.__neotopia_writeorder }
  }, [overtakes])

  // ── THE 90 SECONDS THE UI HAS ALWAYS PROMISED (T3 S52 · council ruling: timeout FIRST) ─────────────────
  //
  // MEASURED IN S51, IN A BROWSER, TWICE: close the host's tab mid-game and the peer's store is BYTE
  // IDENTICAL at nine 5s samples across 45 seconds · same seat, same turn, same actionsRemaining · on a
  // client that had just been PROVEN to be listening. The departed player owned the turn and kept it,
  // because `turnSecondsLeft` in GameRoom had exactly two consumers, its own useState and a display prop.
  // It counted down to 0 and enforced nothing, while the Tutorial and the Lobby both told the player
  // "90 seconds per turn". This is therefore a CORRECTION, not a feature: the promise already shipped.
  //
  // WHY ANY CLIENT MAY END SOMEONE ELSE'S TURN. Forfeit was ruled out because it needs a detection signal
  // that does not exist (GameRoom never mounts usePresence), and a timeout deliberately needs none: it is
  // a function of the clock alone, so it unfreezes the board whether the absent player is disconnected,
  // backgrounded, or simply asleep. Two clients firing at once is SAFE by construction · pushState carries
  // `.lt('state_version', version)`, so the second write is refused rather than applied (T2, migration
  // 022), and the winner's snapshot reaches the loser through postgres_changes and reconciles it. The
  // seat stagger below makes that race rare; it is not what makes it correct.
  //
  // RULE 76 IS THE HAZARD HERE AND IT HAS ALREADY KILLED THIS EXACT FEATURE ONCE · a setTimeout inside a
  // useEffect is cancelled by its own cleanup whenever a dep identity churns, and this app re-renders once
  // a second for the countdown. The first draft of GameRoom's auto-end-turn died that way with nothing in
  // the console. So: the deps are two primitives, the handler lives in a ref, and the timer is a repeating
  // 1s INTERVAL that re-derives elapsed time from a ref rather than a single long timeout. Re-creating the
  // interval is therefore harmless · it cannot lose the deadline, only re-check it.
  const turnStartRef = useRef({ turn: null, at: 0 })

  const pushStateRef = useRef(pushState)
  pushStateRef.current = pushState

  // The interval EXISTS only while a game is actually being played. Gating it on the phase rather than
  // letting the tick early-return is not tidiness: useGameSync.seedhealth and .reconnect both assert
  // `vi.getTimerCount() === 0` to prove no reconnect is queued, and a permanently-pending 1Hz timer made
  // five of those go red. Weakening a reconnect-storm guard to accommodate a new feature would be a
  // tolerance widened to fit a defect (Rule 110c) · and a clock that ticks in the lobby, where there is no
  // turn to end, was never wanted anyway. `phase` is a string, so this dep cannot churn by identity.
  const gamePhase = useGameStore(s => s.phase)
  useEffect(() => {
    if (gamePhase !== 'playing') return    // lobby, scoring, or a game that has already ended
    let intervalId = null
    const tick = () => {
      const st = useGameStore.getState()
      if (st.phase !== 'playing') return

      // ── THE PREDICATE IS NOT PRACTICE-VS-MULTIPLAYER · IT IS "IS ANYONE ELSE WAITING" (T3 S56) ────────
      // The clock used to be scoped to real rooms (`if (!roomId) return`), so practice never expired while
      // the Tutorial promised "90 seconds per turn" in it. T1 found that and their framing argument beat
      // mine: three of the four practice options are sold as GAMES ("A single opponent", "Three-player
      // game", "A full four-player table"), so a first-timer who learns without a clock meets one for the
      // first time in a real room, unprepared.
      // AND THE CARVE-OUT IS MEASURED, not asserted · driving the store with ONE seat, endTurn keeps seat 0
      // (nextSeat = (0+1)%1), consumes no production tile, and RESETS ACTIONS TO 3. In solo exploration a
      // timeout passes the turn to nobody and hands the player their actions back: it cannot teach the
      // mechanic and cannot penalise, so it is pure noise with a visible counter attached.
      // `players.length > 1` covers multiplayer AND practice-with-bots and excludes solo, with no mode
      // branching and no copy change · which is why it is one line rather than a practice special case.
      if ((st.players?.length ?? 0) < 2) return
      const limitMs = getModeConfig(st.mode).TURN_TIME_LIMIT * 1000
      // SEAT RESOLUTION HAS TO KNOW ABOUT PRACTICE, and this is the half that would have shipped invisibly
      // inside the change above. Practice seats carry PRACTICE_HUMAN_ID, never the auth uuid, so matching
      // on currentUserId alone finds NOTHING there · mySeat falls back to 0, the human is treated as a
      // REMOTE client, and their turn ends at 95s in Classic instead of the 90 the Tutorial prints. A fix
      // whose own promise is off by the grace it added is the kind nobody re-measures (Rule 61).
      const mySeat = st.players?.find(p => p.userId === currentUserId)?.seat
        ?? st.players?.find(p => p.userId === PRACTICE_HUMAN_ID)?.seat
      const isMine = mySeat != null && mySeat === st.currentSeat
      // THE GRACE IS CAPPED AS A FRACTION OF THE TURN, NOT A FLAT 5s (T3 S52 · found by premise-checking
      // my own fix an hour after shipping it). A flat grace is a hidden parameter that silently qualifies
      // every mode it was not measured in (Rule 111): Classic is 90s so 5s per seat is 5-22% of a turn and
      // reads as obviously fine · FLOW IS 15s, where the same constant is 33-133%, and a seat-3 client
      // would wait 35s to end a 15s turn. Nothing in the first draft's tests would have said so, because
      // every one of them ran in the default mode · the constant never varied, so it never looked like a
      // choice. Capping at 15% of the turn leaves Classic byte-identical (min(5000, 13500) = 5000) and
      // brings Flow to 2.25s per seat.
      const graceUnit = Math.min(TURN_TIMEOUT_GRACE_MS, limitMs * 0.15)
      const grace = isMine ? 0 : graceUnit * (1 + (mySeat ?? 0))
      if (performance.now() - turnStartRef.current.at < limitMs + grace) return

      // The SAME endTurn the button calls (Rule 45 · a second turn-advance would be a second rules
      // engine). eventData records who fired and for whom, so a timed-out turn is distinguishable from a
      // played one in game_events rather than looking like the absent player pressed the button.
      useGameStore.getState().endTurn()
      // Practice has no server: the local endTurn above IS the whole effect there. Pushing would
      // return {error:'No room'} on every timeout and teach a future reader that the path is broken.
      if (roomId) pushStateRef.current('endTurn', { reason: 'turn_timeout', seat: st.currentSeat, by: mySeat ?? null })
    }

    // ── THE ANCHOR AND THE SAMPLING GRID ARE ONE THING, AND THAT IS THE WHOLE FIX (T3 S59) ─────────────
    // WHAT WAS HERE BEFORE, and it shipped with a comment claiming the opposite of what it did: the anchor
    // was re-stamped INSIDE the tick, `if (turnStartRef.current.turn !== turn)`, and the comment said
    // "falling through keeps the deadline exactly one limit from the turn rather than one limit plus a
    // tick". It does not. The tick that notices a turn change runs up to a full interval AFTER it, so
    // every turn but the first was anchored late, and the deadline it produced was late by the same
    // amount. Turn 1 was exact by coincidence · the effect mounts AT the turn, so the anchor, the turn and
    // the grid origin are the same instant · which is why every test in useGameSync.turntimeout.test.js
    // passed: all of them measure turn 1 and stop.
    //
    // ⚠ AND THE OBVIOUS FIX IS NOT A FIX · MEASURED, because I recommended it and it is wrong. Anchoring
    // EXACTLY (this subscription, without the re-phase below) moves the fire time by ZERO. Driving turn 2
    // to begin at five different offsets into a tick interval, excess over the promised limit:
    //     offset      0     250     500     750     999      (ms into the interval)
    //     in-tick  1000     750     500     250     250 *
    //     exact       0     750     500     250     250 *
    // Identical everywhere except offset 0, which is a turn change landing exactly ON a tick · an
    // alignment only a fake-timer harness produces. The reason is that the old anchor was ALWAYS placed on
    // the grid, so the deadline landed on the grid too; making the anchor exact just moves the same
    // rounding from the anchor to the fire. The excess was never the anchor. It is the SAMPLING PERIOD,
    // and no amount of precision at one end removes a poll at the other.
    //     (* offset 999 reads 250 because the probe samples every 250ms · that row is my instrument,
    //      not the system. Recorded rather than smoothed, per Rule 95b.)
    //
    // SO THE GRID IS RE-PHASED ON THE TURN, NOT JUST THE ANCHOR. With ticks re-based at the turn change
    // and a limit that is a whole number of seconds, the deadline lands ON a tick by construction and the
    // excess is EXACTLY ZERO · an identity rather than a tolerance, which is the form that does not need
    // re-tuning when the mode changes (Rule 111's corollary). Both facts come from one call, so there is
    // one guard and not two: a stamp without a re-phase leaves the rounding, a re-phase without a stamp
    // measures the previous turn, and each mutation reds for its own reason (Rule 118).
    //
    // WHY A SUBSCRIPTION AND NOT A DEP · this fires SYNCHRONOUSLY inside the set() that advances the turn,
    // so `at` is the turn change itself and not the render after it. It also keeps the Rule 76 shape the
    // old code was built for: the effect deps are still three primitives, the handler still lives in a
    // ref, the timer is still a repeating interval re-deriving elapsed time. Nothing here is a setTimeout.
    //
    // ⚠⚠ AND THE RE-PHASE ALONE IS A REGRESSION · THE CLOCK HAD TO CHANGE WITH IT (measured live, in a
    // real browser, after the fake-timer suite said the fix was exact). Re-phasing puts the deadline
    // EXACTLY on a tick, which is the single worst phase for a comparison against `Date.now()`:
    //     setInterval is scheduled on the MONOTONIC clock · Date.now() is the WALL clock · they drift.
    // Ticking a bare 1s interval for 90s beside the game and printing `Date.now() - at - k*1000`:
    //     run A   min -4   56 of 94 ticks read SHORT      run B   min -1    5 of 95 short
    //     run C   min +3    0 of 94 short                 performance.now()   0 of 94 short, EVERY run
    // A tick reading 3ms short at the aligned deadline does not fire, and then waits a WHOLE SECOND.
    // Measured end to end on the practice board · elapsed against a promised 90000ms:
    //     pre-S59            uniform 0-1000 late (wherever the turn fell between ticks)
    //     re-phase + Date    91037 · 91027 · 91001    reliably ~1000 late · WORSE, and worse by design
    //     re-phase + perf    90079                    the residual is scheduler lateness, never early
    // So the two halves are one fix: re-phasing without the monotonic clock converts a uniform error
    // into a consistent full-tick one. A timer cannot fire before its scheduled MONOTONIC time, which is
    // what makes the aligned tick reliable rather than a coin flip on clock drift (perf mimic min +0.5).
    // ⚠ THE UNIT SUITE CANNOT SEE ANY OF THIS. vi.useFakeTimers advances Date.now() and performance.now()
    // in lockstep, so the turn-2 exactness tests pass with EITHER clock · they passed 17/17 against the
    // regression. The browser is the only witness here, and the source guard in the test file exists
    // precisely because the behavioural test structurally cannot hold this claim (Rule 36).
    //
    // THE ONCE-PER-TURN LATCH IS STILL THIS AND ONLY THIS, unchanged in substance (Rule 107). endTurn()
    // increments turnNumber, so the act of firing re-anchors the clock and the next tick measures ~0.
    // The first draft also carried a `timedOutForTurn` latch; mutation testing removed it and nothing went
    // red, because either guard alone sufficed and neither could be made to fail (Rule 86), and both keyed
    // on the same quantity so it bought no second witness either (Rule 94). Deleted then, still deleted.
    const anchor = (turn) => {
      turnStartRef.current = { turn, at: performance.now() }
      if (intervalId !== null) clearInterval(intervalId)
      intervalId = setInterval(tick, 1_000)
    }
    anchor(useGameStore.getState().turnNumber)
    const unsubscribe = useGameStore.subscribe((st, prev) => {
      if (st.turnNumber !== prev.turnNumber) anchor(st.turnNumber)
    })
    return () => { if (intervalId !== null) clearInterval(intervalId); unsubscribe() }
  }, [roomId, currentUserId, gamePhase])

  return { sendMove, pushState, broadcast, sessionId, overtakes }
}
