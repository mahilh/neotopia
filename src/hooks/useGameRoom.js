// NeoTopia · room lifecycle (create / join / leave / start).
// T3 owns this file.
//
// Separation of concerns:
//   useGameRoom (this file) → DB writes against game_rooms / room_players / game_sessions
//   usePresence             → realtime lobby roster + game-start broadcast (one channel)
//   useGameSync             → authoritative game_sessions sync during play
//
// Auth is a PRECONDITION · `user`/`username` come from useAuth, never created here.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../store/gameStore'
import { DECK } from '../lib/projectCards'
import { usePresence } from './usePresence'

// Seat → colour. room_players has UNIQUE(room_id, player_color) AND UNIQUE(room_id, seat_number),
// so deriving colour from the (unique) seat keeps colour unique too · no extra coordination.
const SEAT_COLORS = ['blue', 'red', 'green', 'purple']

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

// Insert a room_players row at `seat`. On a seat/colour unique collision (23505 · concurrent
// joiner grabbed it first) re-read the taken seats and try the next free one, up to maxRetries.
// Returns { seat } on success or { error }. Server-side UNIQUE is the real arbiter · the client
// read is only a hint, so we trust the insert, not the pre-read.
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
    if (error.code !== '23505') return { error }

    // Seat (or its colour) was taken between our read and write · find the next free seat.
    const { data: rows } = await supabase
      .from('room_players').select('seat_number').eq('room_id', roomId)
    const taken = new Set((rows ?? []).map(r => r.seat_number))
    const next = [0, 1, 2, 3].find(s => !taken.has(s))
    if (next === undefined) return { error: { message: 'Room is full' } }
    seat = next
  }
  return { error: { message: 'Could not claim a seat' } }
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
  const busyRef = useRef(false) // single-flight guard for create/join/start

  const {
    players: lobbyPlayers,
    updatePresence,
    sendGameStart,
    gameStarted,
    resetPresence,
  } = usePresence(roomId, user, username, seat, isHost)

  // Joiner transition: a 'game_start' broadcast flips us to playing · the host sets it locally
  // in startGame (broadcast does not echo to the sender by default).
  useEffect(() => {
    if (gameStarted && roomPhase === 'lobby') setRoomPhase('playing')
  }, [gameStarted, roomPhase])

  // CREATE ROOM (becomes host · seat 0)
  const createRoom = useCallback(async () => {
    if (busyRef.current) return
    if (!user?.id || !username) { setLobbyError('Username required'); return }
    busyRef.current = true
    setLobbyError(null)

    try {
      const { data: room, error, code } = await insertRoomWithRetry(user.id, generateRoomCode())
      if (error || !room) { setLobbyError(error?.message ?? 'Could not create room'); return }

      // Ensure a profile row exists (FK-safe · idempotent with useAuth's claim).
      await supabase.from('player_profiles').upsert(
        { user_id: user.id, username }, { onConflict: 'user_id' }
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

  // JOIN ROOM (by code)
  const joinRoom = useCallback(async (rawCode) => {
    if (busyRef.current) return
    if (!user?.id || !username) { setLobbyError('Username required'); return }
    const code = rawCode.toUpperCase().trim()
    if (code.length !== 6) { setLobbyError('Enter a 6-character code'); return }
    busyRef.current = true
    setLobbyError(null)

    try {
      const { data: room, error } = await supabase
        .from('game_rooms')
        .select('id, status, max_players')
        .eq('room_code', code)
        .maybeSingle()

      if (error) { setLobbyError(error.message); return }
      if (!room) { setLobbyError('Room not found'); return }
      if (room.status !== 'waiting') { setLobbyError('Game already started'); return }

      // Occupancy + seat from room_players (authoritative · game_rooms.player_count is not
      // maintained: a non-host cannot UPDATE game_rooms under RLS, so the column goes stale).
      const { data: rows } = await supabase
        .from('room_players').select('seat_number, user_id').eq('room_id', room.id)
      const existing = (rows ?? []).find(r => r.user_id === user.id)

      let mySeat
      if (existing) {
        mySeat = existing.seat_number // rejoin · reuse our own seat
      } else {
        if ((rows ?? []).length >= room.max_players) { setLobbyError('Room is full'); return }
        const taken = new Set((rows ?? []).map(r => r.seat_number))
        const next = [0, 1, 2, 3].find(s => !taken.has(s))
        if (next === undefined) { setLobbyError('Room is full'); return }
        await supabase.from('player_profiles').upsert(
          { user_id: user.id, username }, { onConflict: 'user_id' }
        )
        const { seat: claimed, error: seatErr } = await claimSeat(room.id, user.id, username, next)
        if (seatErr) { setLobbyError(seatErr.message); return }
        mySeat = claimed
      }

      setIsHost(false)
      setSeat(mySeat)
      setRoomCode(code)
      setRoomId(room.id)
      setRoomPhase('lobby')
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

      // Initialise the client store, then persist the authoritative snapshot to the DB.
      useGameStore.getState().initGame(
        roster.map(p => ({ userId: p.user_id, username: p.username })),
        shuffleArray([...DECK]),
        shuffleArray([...PRODUCTION_TILES]),
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
  }, [isHost, roomId, user?.id, sendGameStart])

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
  }, [roomId, isHost, user?.id, resetPresence])

  return {
    roomId, roomCode, seat, isHost, isReady, lobbyPlayers, lobbyError, roomPhase,
    createRoom, joinRoom, setReady, startGame, leaveRoom,
  }
}
