// NeoTopia · room lifecycle (create / join / leave / start).
// T3 owns this file.
//
// Separation of concerns:
//   useGameRoom (this file) → DB writes against game_rooms / room_players / game_sessions
//   usePresence             → realtime lobby roster + game-start broadcast (one channel)
//   useGameSync             → authoritative game_sessions sync during play
//
// Auth is a PRECONDITION · `user`/`username` come from useAuth, never created here.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../store/gameStore'
import { DECK } from '../lib/projectCards'
import { usePresence } from './usePresence'
import { getModeConfig, DEFAULT_GAME_MODE } from '../store/gameConfig'
import { getClusterTotal } from '../lib/patternMatcher'
import { getBackendHealth } from './useConnectionHealth'

// Seat → colour. room_players has UNIQUE(room_id, player_color) AND UNIQUE(room_id, seat_number),
// so deriving colour from the (unique) seat keeps colour unique too · no extra coordination.
//
// ── SEAT 3 WAS 'purple' AND IT BROKE EVERY 4-PLAYER GAME (fixed T3 S28) ───────────────────────────────────
// The server does not accept 'purple'. Read from pg_constraint on the live database this session, verbatim:
//   room_players_player_color_check · CHECK (player_color = ANY (ARRAY['blue','gold','green','red']))
//   room_players_seat_number_check  · CHECK (seat_number >= 0 AND seat_number <= 3)
//   room_players_room_id_player_color_key · UNIQUE (room_id, player_color)
// Seats 0/1/2 send blue/red/green and pass. Seat 3 sent 'purple' and ALWAYS failed with 23514, so the 4th
// player could never join any room · on a product whose own copy says "two to four players".
//
// The live table agrees, and this is the part no amount of code reading would have shown: across the entire
// production history of room_players the seat/colour distribution is seat 0 blue (32 rows), seat 1 red (24),
// seat 2 green (2), and seat 3 NOTHING. Zero rows, ever. Not one 4-player game has begun.
//
// 'gold' is not a preference, it is FORCED: the allowed set has exactly four members, UNIQUE(room_id,
// player_color) means a room cannot reuse one, and seats 0-2 hold blue/red/green. 'gold' is the only value
// left. Every other permutation of the same four names would also work but would change what seats 0-2
// store, which rooms already occupied by older clients would then collide with · so the minimal edit is the
// safe one. Widening the CHECK to admit 'purple' was the alternative and was rejected: migrating a live
// constraint on a table with 355 rooms is strictly more risk than changing one array element.
//
// ⚠ WHAT THIS DOES NOT FIX · the STORED name now disagrees with the PAINTED colour for seat 3. Nothing reads
// player_color today (it is written here and read nowhere in src/), and Lobby.jsx paints from its own hex
// array indexed by SEAT NUMBER, so no pixel changes and no player sees the word. But Lobby's seat-3 swatch is
// #7F77DD, which is purple, so the database now labels that player 'gold'. That is a trap for whoever first
// wires player_color into rendering. Reconciling it means editing Lobby.jsx (T1's lane) · written to comms
// rather than reached across for. Until then the seat number, not this string, is the colour's real source.
export const SEAT_COLORS = ['blue', 'red', 'green', 'gold']

// ── Join contract (T3 S27 · consumed by the /join/:code screen · contract posted to comms first) ──────────
//
// WHY A CODE AND NOT A MESSAGE. Before this, joinRoom returned `undefined` and published its outcome only as
// an English string in `lobbyError`. That is sufficient for the lobby's single inline <p>, and insufficient
// for a deep-link screen, which has to render four genuinely different UIs from the same call: "type your
// name" (not an error at all), "that link is dead", "that room is full", and "the servers are unreachable".
// Branching those apart on message text would break silently the first time a word changed · so the reason
// is a stable machine code and the message is disposable human copy. Rule 63: expose the value the consumer
// actually has to decide on.
//
// The return value is purely ADDITIVE · every path still sets `lobbyError` exactly as before, so Lobby.jsx
// (which ignores the return) is unchanged and unbroken.
export const JOIN_FAILURE = Object.freeze({
  BACKEND_OFFLINE:   'BACKEND_OFFLINE',   // health already reads offline · no request was attempted
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED', // no anon session yet · still booting, or sign-in failed
  NAME_REQUIRED:     'NAME_REQUIRED',     // session but no display name · the normal first-visit path
  INVALID_CODE:      'INVALID_CODE',      // not 6 chars after normalising · malformed URL
  NOT_FOUND:         'NOT_FOUND',         // no room carries that code
  ALREADY_STARTED:   'ALREADY_STARTED',   // room is mid-game and this user is NOT a member of it
  ROOM_FULL:         'ROOM_FULL',         // every seat taken
  SEAT_CONFLICT:     'SEAT_CONFLICT',     // lost every seat race · rare, retryable
  BUSY:              'BUSY',              // another create/join/start is in flight in this hook
  NETWORK:           'NETWORK',           // the request errored · transport / RLS / unknown
})

// Human copy for each code. Deliberately separate from the codes themselves so rewording can never change
// what a consumer branches on.
const FAILURE_MESSAGE = {
  [JOIN_FAILURE.BACKEND_OFFLINE]:   'Servers unreachable',
  [JOIN_FAILURE.NOT_AUTHENTICATED]: 'Still connecting',
  [JOIN_FAILURE.NAME_REQUIRED]:     'Username required',
  [JOIN_FAILURE.INVALID_CODE]:      'Enter a 6-character code',
  [JOIN_FAILURE.NOT_FOUND]:         'Room not found',
  [JOIN_FAILURE.ALREADY_STARTED]:   'Game already started',
  [JOIN_FAILURE.ROOM_FULL]:         'Room is full',
  [JOIN_FAILURE.SEAT_CONFLICT]:     'Could not claim a seat',
  [JOIN_FAILURE.BUSY]:              'Already joining',
  [JOIN_FAILURE.NETWORK]:           'Could not reach the room',
}

// Codes are typed by humans off a screenshot or pasted out of a URL · normalise before anything else so the
// 6-char DB CHECK is measured against what will actually be sent, not the raw input.
//
// THE SEPARATORS ARE NOT DECORATION (T3 S27 · found by reading T1's half of the seam, not by guessing).
// T1's src/utils/roomLink.js normalizeRoomCode strips whitespace AND dashes, because that is what a code
// picks up in transit: someone reads "ABC234" off a screen and retypes it as "abc-234" or "ABC 234". Their
// invite path normalises before calling us, but the manual code field does not · so with a laxer normaliser
// upstream and a stricter one here, the SAME string would be accepted through one door and rejected as
// INVALID_CODE through the other. Two normalisers for one value is two contracts (Rule 45), and the
// composed behaviour is where that hides (Rule 65). Matching their rule here makes joinRoom tolerant no
// matter which caller reaches it, and leaves the DB CHECK as the single arbiter of what is actually valid.
function normalizeCode(raw) {
  return String(raw ?? '').trim().toUpperCase().replace(/[\s-]/g, '')
}

// A single failure constructor so every exit from joinRoom/peekRoom has the identical shape. `message`
// overrides the canned copy for NETWORK, where the real cause is more useful than a generic line.
function joinFailure(reason, message) {
  return { ok: false, reason, message: message ?? FAILURE_MESSAGE[reason] ?? 'Could not join' }
}

// Pre-flight. The health aggregator is only consulted for its TERMINAL verdict: `isOffline` means some
// transport already exhausted its retry budget, so a request now is a request we know will fail, and the
// honest answer is BACKEND_OFFLINE rather than a network error dressed up as "Room not found" (the exact
// misattribution the 07-27 nightly triage burned two days on). `reconnecting` is deliberately NOT blocked ·
// a request may well still succeed while a *different* transport is mid-backoff, and refusing it would
// invent an outage. Reuses T3's existing aggregator · this hook registers no health source of its own.
function offlineGuard() {
  return getBackendHealth().isOffline ? joinFailure(JOIN_FAILURE.BACKEND_OFFLINE) : null
}

// 6-char room code from unambiguous characters only (no I, O, 0, 1 · they misread aloud/typed).
// Length is 6 to satisfy the DB CHECK (length(room_code) = 6) · a shorter code fails 23514.
export function generateRoomCode() {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

// Insert a game_rooms row · retry once with a fresh code on a room_code unique collision (23505).
// status uses the DB-allowed set CHECK (status IN ('waiting','playing','finished')) · 'waiting'
// is the lobby state (NOT 'lobby', which would violate the check).
async function insertRoomWithRetry(hostId, code, attempt = 0) {
  const { data, error } = await supabase.from('game_rooms').insert({
    room_code: code,
    host_id: hostId,
    status: 'waiting',
    max_players: 4,
    player_count: 1,
  }).select().single()

  if (error?.code === '23505' && attempt === 0) {
    return insertRoomWithRetry(hostId, generateRoomCode(), 1)
  }
  return { data, error, code }
}

// Why did the server refuse the seat? Called only after a 42501, to turn "permission denied" into the
// reason a player can act on. Re-reads the room because the refusal proves our earlier read is now stale:
// the room started, or filled, in the gap between our check and our write. Falls back to SEAT_CONFLICT
// (retryable, honest) when the re-read itself cannot answer · never to NETWORK, which would blame the
// transport for a server that replied.
async function denialReason(roomId) {
  const { data: room } = await supabase
    .from('game_rooms').select('status, max_players, player_count').eq('id', roomId).maybeSingle()
  if (!room) return JOIN_FAILURE.NOT_FOUND
  if (room.status !== 'waiting') return JOIN_FAILURE.ALREADY_STARTED
  if ((room.player_count ?? 0) >= (room.max_players ?? 4)) return JOIN_FAILURE.ROOM_FULL
  return JOIN_FAILURE.SEAT_CONFLICT
}

// Insert a room_players row at `seat`. On a seat/colour unique collision (23505 · concurrent
// joiner grabbed it first) re-read the taken seats and try the next free one, up to maxRetries.
// Returns { seat } on success, or { error, reason } where `reason` is a JOIN_FAILURE code · the
// caller must not have to re-derive the failure class from an English message (T3 S27).
// Server-side UNIQUE is the real arbiter · the client read is only a hint, so we trust the
// insert, not the pre-read.
async function claimSeat(roomId, userId, username, preferredSeat, maxRetries = 4) {
  let seat = preferredSeat
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { error } = await supabase.from('room_players').insert({
      room_id: roomId,
      user_id: userId,
      username,
      player_color: SEAT_COLORS[seat] ?? 'blue',
      seat_number: seat,
      is_ready: false,
    })
    if (!error) return { seat }

    // RLS DENIAL · 42501 insufficient_privilege (T3 S27 · added after T2 landed migration 015 mid-session).
    // room_players_join now requires the target room to be `waiting` AND under capacity, enforced
    // server-side (verified live in pg_policies, not read off the migration file · Rule 68). So the
    // authoritative "you cannot join this room" answer now arrives as a permission error, and the client's
    // own pre-checks are only a fast path around it.
    // Mapping this to NETWORK would tell a player "could not reach the room" about a room that answered
    // perfectly and refused them for a specific, explainable reason · the precise misattribution class this
    // session exists to close. One extra read on a rare path buys the accurate reason.
    if (error.code === '42501') return { error, reason: await denialReason(roomId) }

    // CONSTRAINT VIOLATION · 23514 check_violation (T3 S28 · the second half of the seat-3 bug).
    // This is a CLIENT bug by construction: the row we built is not one the schema permits. The server was
    // reached and answered precisely, so calling it NETWORK told the player "Could not reach the room" about
    // a database that was up · and because the caller passes seatErr.message through, what actually reached
    // the screen was the raw Postgres string ("new row for relation \"room_players\" violates check
    // constraint \"room_players_player_color_check\""). That blur is why a total 4-player outage read as
    // flakiness for two sessions instead of as one wrong word.
    // SEAT_CONFLICT, not a new code: "Could not claim a seat" is true here, and the join contract is already
    // published and branched on by the /join/:code screen · inventing a tenth code would hand T1 an
    // unhandled branch to discover in production. The raw signature stays for developers, off the screen.
    if (error.code === '23514') {
      console.error('[useGameRoom] seat row rejected by a CHECK constraint · this is a client/schema drift bug, not an outage:', error.message)
      return {
        error: { message: FAILURE_MESSAGE[JOIN_FAILURE.SEAT_CONFLICT] },
        reason: JOIN_FAILURE.SEAT_CONFLICT,
      }
    }

    if (error.code !== '23505') return { error, reason: JOIN_FAILURE.NETWORK }

    // Seat (or its colour) was taken between our read and write · find the next free seat.
    const { data: rows } = await supabase
      .from('room_players').select('seat_number').eq('room_id', roomId)
    const taken = new Set((rows ?? []).map(r => r.seat_number))
    const next = [0, 1, 2, 3].find(s => !taken.has(s))
    if (next === undefined) {
      return { error: { message: FAILURE_MESSAGE[JOIN_FAILURE.ROOM_FULL] }, reason: JOIN_FAILURE.ROOM_FULL }
    }
    seat = next
  }
  return {
    error: { message: FAILURE_MESSAGE[JOIN_FAILURE.SEAT_CONFLICT] },
    reason: JOIN_FAILURE.SEAT_CONFLICT,
  }
}

// Strip the Zustand store down to a JSON-serialisable snapshot: drops action FUNCTIONS (jsonb
// can't hold them · structuredClone would even throw on them) and collapses the pendingMoves
// Set. syncFromServer rehydrates pendingMoves as a Set on read, so the round-trip is lossless.
function serializableState() {
  return JSON.parse(JSON.stringify(useGameStore.getState()))
}

export function useGameRoom(user, username) {
  const [roomId, setRoomId] = useState(null)
  const [roomCode, setRoomCode] = useState(null)
  const [seat, setSeat] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [lobbyError, setLobbyError] = useState(null)
  const [roomPhase, setRoomPhase] = useState('idle') // idle | lobby | playing
  const [gameMode, setGameMode] = useState(DEFAULT_GAME_MODE) // 'classic' | 'flow' · host picks at createRoom · persisted on the session at startGame (game_sessions.mode · migration 010)
  const busyRef = useRef(false) // single-flight guard for create/join/start

  // Mode-aware presence status (T3 S17): WHERE this player is, derived from the room lifecycle + chosen mode.
  // Passed into usePresence so the lobby roster shows "in a flow game" vs "in a game" vs "in lobby" live. The
  // room owner derives it (usePresence stays a dumb transport · it does not know roomPhase/gameMode otherwise).
  const presenceStatus =
    roomPhase === 'playing' ? (gameMode === 'flow' ? 'in_flow_game' : 'in_game')
    : roomPhase === 'lobby' ? 'in_lobby'
    : 'idle'

  // Live cluster bonus (board game rule p9 · getClusterTotal · T2 S18) threaded into presence so the roster can
  // surface a game's current civilization-level cluster points. Reactive: subscribe to the store's regions so the
  // value tracks the live board · memoised so unrelated re-renders (lobbyError, ready-toggle) don't re-run the BFS.
  // ONLY during play · in lobby/idle there is no board of ours (a prior game's regions could linger in the store),
  // so report 0. getClusterTotal is board-GLOBAL (the SAME number for every player · no per-hex placer to attribute
  // it · patternMatcher) and reuses the one cluster BFS (rule 10). usePresence re-tracks only when this NUMBER moves.
  const liveRegions = useGameStore(s => s.regions)
  const clusterBonus = useMemo(
    () => (roomPhase === 'playing' ? getClusterTotal(liveRegions) : 0),
    [roomPhase, liveRegions],
  )

  const {
    players: lobbyPlayers,
    updatePresence,
    sendGameStart,
    gameStarted,
    resetPresence,
  } = usePresence(roomId, user, username, seat, isHost, presenceStatus, gameMode, clusterBonus)

  // Joiner transition: a 'game_start' broadcast flips us to playing · the host sets it locally
  // in startGame (broadcast does not echo to the sender by default).
  useEffect(() => {
    if (gameStarted && roomPhase === 'lobby') setRoomPhase('playing')
  }, [gameStarted, roomPhase])

  // CREATE ROOM (becomes host · seat 0)
  const createRoom = useCallback(async (mode = DEFAULT_GAME_MODE) => {
    if (busyRef.current) return
    if (!user?.id || !username) { setLobbyError('Username required'); return }
    busyRef.current = true
    setLobbyError(null)

    // Normalise the lobby's mode selection through the engine's accessor (unknown/missing → classic · no CHECK
    // on the column · kept extensible · T2 gameConfig). Stored now, written to game_sessions.mode at startGame.
    const resolvedMode = getModeConfig(mode).id ?? DEFAULT_GAME_MODE
    setGameMode(resolvedMode)

    try {
      const { data: room, error, code } = await insertRoomWithRetry(user.id, generateRoomCode())
      if (error || !room) { setLobbyError(error?.message ?? 'Could not create room'); return }

      // Best-effort backstop: ensure this user has a profile row (its username feeds the global leaderboard).
      // Normally created at claim time (useAuth) · NOTHING FKs player_profiles, so a miss never blocks the room.
      // ignoreDuplicates → ON CONFLICT (user_id) DO NOTHING: never overwrite/rename an existing row and never
      // 409-block creation. A brand-new user_id whose chosen name is already taken is tolerated here (the claim
      // screen owns the rename · T3 S24) · room creation proceeds regardless.
      await supabase.from('player_profiles').upsert(
        { user_id: user.id, username }, { onConflict: 'user_id', ignoreDuplicates: true }
      )

      const { error: seatErr } = await claimSeat(room.id, user.id, username, 0)
      if (seatErr) { setLobbyError(seatErr.message); return }

      setIsHost(true)
      setSeat(0)
      setRoomCode(code)
      setRoomId(room.id)        // last · triggers presence subscribe with seat/host known
      setRoomPhase('lobby')
    } finally {
      busyRef.current = false
    }
  }, [user?.id, username])

  // PEEK ROOM · read-only preview of a room by code. Added for the /join/:code deep link (T3 S27).
  //
  // WHY IT EXISTS SEPARATELY FROM joinRoom: a stranger arriving on a share link has no display name yet,
  // and joinRoom cannot work without one (room_players.username is NOT NULL and is written at seat-claim
  // time · verified live). Without a read-only peek, the join screen would have to demand a name BEFORE it
  // could tell the player whether the room even exists · so a dead link would cost a name entry to discover.
  // This makes the preview possible: both SELECT policies are `USING (true)` for public (verified live in
  // pg_policies · rooms_read_all, room_players_read), so an unauthenticated visitor can read a room and its
  // roster with the anon key alone.
  //
  // NO WRITES, NO STATE. It touches neither the DB nor this hook's state, so it is safe to call on mount,
  // on every keystroke, or twice concurrently · and it is deliberately NOT behind busyRef, which exists to
  // serialise MUTATIONS. It also never sets lobbyError: a preview of a dead link is not a lobby error, and
  // showing one would put a red line under an unrelated screen.
  const peekRoom = useCallback(async (rawCode) => {
    const offline = offlineGuard()
    if (offline) return offline

    const code = normalizeCode(rawCode)
    if (code.length !== 6) return joinFailure(JOIN_FAILURE.INVALID_CODE)

    const { data: room, error } = await supabase
      .from('game_rooms')
      .select('id, room_code, status, max_players')
      .eq('room_code', code)
      .maybeSingle()

    if (error) return joinFailure(JOIN_FAILURE.NETWORK, error.message)
    if (!room) return joinFailure(JOIN_FAILURE.NOT_FOUND)

    // Roster from room_players rather than game_rooms.player_count · but NOT because that column is dead.
    // CORRECTED (T3 S27 · verified live in pg_trigger, after an in-repo comment asserted the opposite):
    // `trg_player_count` on room_players is a SECURITY DEFINER trigger that recounts and writes
    // game_rooms.player_count on every insert/delete, so the column IS maintained · the RLS-in-front-of-it
    // reasoning ("no joiner can UPDATE game_rooms") was true and irrelevant, because the trigger runs as
    // definer, not as the joiner. It is load-bearing too: migration 015's capacity check reads it.
    // We still count rows here because this query is already being made for the roster, and one source for
    // both playerCount and players cannot disagree with itself.
    const { data: rows, error: rosterErr } = await supabase
      .from('room_players').select('seat_number, user_id, username').eq('room_id', room.id)
    if (rosterErr) return joinFailure(JOIN_FAILURE.NETWORK, rosterErr.message)

    const roster = rows ?? []
    const maxPlayers = room.max_players ?? 4
    // isHost is derived from seat 0 rather than game_rooms.host_id · the host always takes seat 0 at
    // createRoom, and this keeps the preview to two SELECTs without exposing a user id to the client.
    const players = [...roster]
      .sort((a, b) => a.seat_number - b.seat_number)
      .map(r => ({ username: r.username, seat: r.seat_number, isHost: r.seat_number === 0 }))

    return {
      ok: true,
      roomId: room.id,
      roomCode: room.room_code ?? code,
      status: room.status,
      playerCount: roster.length,
      maxPlayers,
      players,
      canJoin: room.status === 'waiting' && roster.length < maxPlayers,
      // Needs a session to be answerable at all · an anonymous peek reports false rather than guessing.
      rejoinable: !!user?.id && roster.some(r => r.user_id === user.id),
    }
  }, [user?.id])

  // JOIN ROOM (by code) · returns a structured result (see JOIN_FAILURE) AND sets lobbyError as before.
  const joinRoom = useCallback(async (rawCode) => {
    // BUSY was previously `return` with no value, which a caller could not distinguish from success · a
    // deep-link screen that awaited joinRoom twice (React 18 StrictMode double-invoke, or an impatient
    // double tap) would have seen the second call resolve to undefined and had no way to know it did
    // nothing. It is a named outcome now. It deliberately does NOT set lobbyError: nothing is wrong.
    if (busyRef.current) return joinFailure(JOIN_FAILURE.BUSY)

    const offline = offlineGuard()
    if (offline) { setLobbyError(offline.message); return offline }

    // Auth and name are separated because they need different UI. "No session yet" is a transport/timing
    // problem the player cannot fix by typing; "no name" is a form they can fill in. Collapsing both into
    // 'Username required' (the old behaviour) told a player to do something that could not help them.
    if (!user?.id) { const f = joinFailure(JOIN_FAILURE.NOT_AUTHENTICATED); setLobbyError(f.message); return f }
    if (!username) { const f = joinFailure(JOIN_FAILURE.NAME_REQUIRED); setLobbyError(f.message); return f }

    const code = normalizeCode(rawCode)
    if (code.length !== 6) { const f = joinFailure(JOIN_FAILURE.INVALID_CODE); setLobbyError(f.message); return f }

    busyRef.current = true
    setLobbyError(null)

    const fail = (reason, message) => {
      const f = joinFailure(reason, message)
      setLobbyError(f.message)
      return f
    }

    try {
      const { data: room, error } = await supabase
        .from('game_rooms')
        .select('id, status, max_players')
        .eq('room_code', code)
        .maybeSingle()

      if (error) return fail(JOIN_FAILURE.NETWORK, error.message)
      if (!room) return fail(JOIN_FAILURE.NOT_FOUND)

      // Occupancy + seat from room_players. These client-side checks are a FAST PATH, not the boundary ·
      // migration 015 enforces waiting-and-under-capacity server-side, and claimSeat maps its 42501 back
      // to the right reason. Checking here just avoids a doomed write in the common case.
      const { data: rows, error: rosterErr } = await supabase
        .from('room_players').select('seat_number, user_id').eq('room_id', room.id)
      if (rosterErr) return fail(JOIN_FAILURE.NETWORK, rosterErr.message)
      const existing = (rows ?? []).find(r => r.user_id === user.id)

      // ── MEMBERSHIP IS CHECKED BEFORE STATUS · this ORDER is the bug fix (T3 S27) ────────────────────
      // The old code rejected any room whose status was not 'waiting' BEFORE looking for an existing
      // membership row. So a player who refreshed mid-game and hit their OWN room's code was told "Game
      // already started" · about a game they were sitting in, holding a seat, with a valid session. That
      // made /join/:code useless as a rejoin link, which is exactly what a share link gets used for once
      // a game is running. A member re-entering writes NOTHING (no seat claim, no profile upsert) · it is
      // a pure local-state restore, so admitting them is strictly safer than the alternative.
      if (existing) {
        const inProgress = room.status === 'playing'

        // A rejoiner into a live game must arrive with the RIGHT mode, or presence reports them as a
        // classic player in a Flow game and the roster lies. Mode lives on game_sessions.mode (migration
        // 010), which only exists once the host has started · so this read is scoped to the in-progress
        // path and its failure is non-fatal (worst case the presence label is wrong · never a blocked
        // rejoin). Rule 40 · the composed mode seam, traced rather than assumed.
        if (inProgress) {
          const { data: session } = await supabase
            .from('game_sessions').select('mode').eq('room_id', room.id).maybeSingle()
          if (session?.mode) setGameMode(getModeConfig(session.mode).id ?? DEFAULT_GAME_MODE)
        }

        setIsHost(existing.seat_number === 0)
        setSeat(existing.seat_number)
        setRoomCode(code)
        setRoomId(room.id)
        // 'playing' routes straight into /game/:roomId via Lobby's existing onGameStart effect · dropping
        // a mid-game rejoiner into the waiting room instead would strand them behind a Start button only
        // the host has (Rule 65 · trace the composed value, do not stop at "the hook set some state").
        setRoomPhase(inProgress ? 'playing' : 'lobby')
        return {
          ok: true,
          roomId: room.id,
          roomCode: code,
          seat: existing.seat_number,
          isHost: existing.seat_number === 0,
          rejoined: true,
          inProgress,
        }
      }

      // Not a member · now status matters. A stranger cannot walk into a running game.
      if (room.status !== 'waiting') return fail(JOIN_FAILURE.ALREADY_STARTED)

      const maxPlayers = room.max_players ?? 4
      if ((rows ?? []).length >= maxPlayers) return fail(JOIN_FAILURE.ROOM_FULL)
      const taken = new Set((rows ?? []).map(r => r.seat_number))
      const next = [0, 1, 2, 3].find(s => !taken.has(s))
      if (next === undefined) return fail(JOIN_FAILURE.ROOM_FULL)

      // Best-effort profile backstop (see createRoom) · DO NOTHING on conflict · never blocks the join.
      await supabase.from('player_profiles').upsert(
        { user_id: user.id, username }, { onConflict: 'user_id', ignoreDuplicates: true }
      )
      const { seat: claimed, error: seatErr, reason } = await claimSeat(room.id, user.id, username, next)
      if (seatErr) return fail(reason ?? JOIN_FAILURE.NETWORK, seatErr.message)

      setIsHost(false)
      setSeat(claimed)
      setRoomCode(code)
      setRoomId(room.id)
      setRoomPhase('lobby')
      return {
        ok: true, roomId: room.id, roomCode: code, seat: claimed,
        isHost: false, rejoined: false, inProgress: false,
      }
    } finally {
      busyRef.current = false
    }
  }, [user?.id, username])

  // TOGGLE READY (presence-only during lobby · no DB write needed until start)
  const setReady = useCallback(async (ready) => {
    setIsReady(ready)
    await updatePresence({ isReady: ready })
  }, [updatePresence])

  // START GAME (host only)
  const startGame = useCallback(async () => {
    if (busyRef.current) return
    if (!isHost || !roomId || !user?.id) return
    busyRef.current = true
    setLobbyError(null)

    try {
      // Snapshot room_players ONCE · guards against a late joiner changing the seating mid-init.
      const { data: roster, error: rosterErr } = await supabase
        .from('room_players').select('*').eq('room_id', roomId).order('seat_number')
      if (rosterErr || !roster?.length) { setLobbyError('Could not load players'); return }

      // Initialise the client store, then persist the authoritative snapshot to the DB. Pass gameMode as the
      // 4th arg (T2 86d0220) so the SEEDED state matches the persisted mode: a flow game seeds the 9-tile clock
      // + 15s turns + state.mode='flow', not classic's 12. Without it the column would say 'flow' while the
      // snapshot carries classic's tile clock — the mode would be cosmetic (rule 40 · the composed mode seam).
      useGameStore.getState().initGame(
        roster.map(p => ({ userId: p.user_id, username: p.username })),
        shuffleArray([...DECK]),
        shuffleArray([...PRODUCTION_TILES]),
        gameMode,
      )
      const snapshot = serializableState()

      const { error: sessErr } = await supabase.from('game_sessions').insert({
        room_id: roomId,
        state: snapshot,
        current_seat: snapshot.currentSeat,
        turn_number: snapshot.turnNumber,
        actions_remaining: snapshot.actionsRemaining,
        phase: snapshot.phase,
        production_tiles_remaining: snapshot.productionTilesRemaining,
        mode: gameMode, // 'classic' | 'flow' (migration 010 · NOT NULL DEFAULT 'classic' · resolved at createRoom)
      })
      if (sessErr) { setLobbyError('Failed to start: ' + sessErr.message); return }

      // Host owns game_rooms → this UPDATE passes rooms_update_host RLS.
      await supabase.from('game_rooms').update({ status: 'playing' }).eq('id', roomId)

      // Signal joiners (no state in the payload) · then transition ourselves.
      await sendGameStart()
      setRoomPhase('playing')
    } finally {
      busyRef.current = false
    }
  }, [isHost, roomId, user?.id, sendGameStart, gameMode])

  // LEAVE ROOM
  const leaveRoom = useCallback(async () => {
    const leavingRoomId = roomId
    const wasHost = isHost
    resetPresence()
    if (leavingRoomId && user?.id) {
      // RLS: room_players_delete_own (user_id = auth.uid()) · only our own row.
      await supabase.from('room_players').delete()
        .eq('room_id', leavingRoomId).eq('user_id', user.id)
      // RLS: rooms_update_host · only the host may close the room. 'finished' is the DB-allowed
      // terminal status (CHECK status IN ('waiting','playing','finished')) · 'closed' would 23514.
      if (wasHost) {
        await supabase.from('game_rooms').update({ status: 'finished' }).eq('id', leavingRoomId)
      }
    }
    setRoomId(null)
    setRoomCode(null)
    setSeat(null)
    setIsHost(false)
    setIsReady(false)
    setRoomPhase('idle')
    setLobbyError(null)
    setGameMode(DEFAULT_GAME_MODE)
  }, [roomId, isHost, user?.id, resetPresence])

  return {
    roomId, roomCode, seat, isHost, isReady, lobbyPlayers, lobbyError, roomPhase, gameMode,
    createRoom, joinRoom, peekRoom, setReady, startGame, leaveRoom, setGameMode,
  }
}
