// NeoTopia · lobby realtime transport (Presence + game-start Broadcast).
// T3 owns this file.
//
// One Supabase channel per room ('lobby:<roomId>') carries BOTH:
//   · Presence  → who is connected + their ready/seat/host state (ephemeral lobby roster)
//   · Broadcast → the single 'game_start' signal (no game state in the payload · clients
//                 pull authoritative state from the DB via useGameSync)
// Keeping them on ONE channel means ONE subscribe + ONE cleanup + ONE strict-mode guard ·
// realtime channel leaks are the highest-risk bug class here, so we minimise the surface.
//
// Auth is a PRECONDITION · user comes from useAuth, never created here.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Build the canonical self-presence payload. Every track() sends the FULL object · a
// partial track() would drop fields Supabase doesn't merge (it replaces the keyed entry),
// which is the bug that made ready-toggles wipe seat/host. One source of truth fixes it.
function buildSelf(user, username, seat, isHost, isReady) {
  return {
    userId: user?.id ?? null,
    username: username ?? 'Builder',
    seat: seat ?? null,
    isHost: !!isHost,
    isReady: !!isReady,
  }
}

/**
 * usePresence(roomId, user, username, seat, isHost)
 * Returns { players, updatePresence, sendGameStart, gameStarted, presenceReady, resetPresence }.
 * Subscribes only when roomId is non-null. Re-subscribes on roomId change · seat/host/username
 * changes only re-track (no re-subscribe), so toggling ready never churns the channel.
 */
export function usePresence(roomId, user, username, seat, isHost) {
  const [players, setPlayers] = useState([])
  const [gameStarted, setGameStarted] = useState(false)
  const [presenceReady, setPresenceReady] = useState(false)

  const channelRef = useRef(null)
  // Latest self payload · refs so the subscribe effect (keyed on roomId only) always tracks
  // current values without re-subscribing when they change.
  const selfRef = useRef(buildSelf(user, username, seat, isHost, false))
  selfRef.current = buildSelf(user, username, seat, isHost, selfRef.current?.isReady ?? false)

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setPresenceReady(false)
  }, [])

  useEffect(() => {
    if (!roomId || !user?.id) return

    // Guard the React 18/19 StrictMode double-mount: tear down any prior channel first so we
    // never leak two subscriptions to the same topic (the classic Presence ghost-player bug).
    cleanup()

    const channel = supabase.channel(`lobby:${roomId}`, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        // presenceState() → { [key]: [payload, ...] } · flatten, then sort by seat so the
        // roster order is stable (null seats sink to the bottom while seats are assigned).
        const roster = Object.values(state)
          .map(entries => entries[entries.length - 1]) // last write per key wins
          .sort((a, b) => (a?.seat ?? 99) - (b?.seat ?? 99))
        setPlayers(roster)
      })
      .on('broadcast', { event: 'game_start' }, ({ payload }) => {
        if (payload?.roomId === roomId) setGameStarted(true)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(selfRef.current)
          setPresenceReady(true)
        }
      })

    channelRef.current = channel
    return cleanup
  }, [roomId, user?.id, cleanup])

  // Merge a partial update into the canonical payload and re-track the WHOLE thing.
  const updatePresence = useCallback(async (partial) => {
    selfRef.current = { ...selfRef.current, ...partial }
    if (channelRef.current) {
      await channelRef.current.track(selfRef.current)
    }
  }, [])

  // Host-only: fire the start signal. No game state in the payload (32KB cap · hand privacy) ·
  // clients pull authoritative state from game_sessions via useGameSync.
  const sendGameStart = useCallback(async () => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type: 'broadcast',
      event: 'game_start',
      payload: { roomId, startedBy: user?.id },
    })
  }, [roomId, user?.id])

  const resetPresence = useCallback(() => {
    cleanup()
    setPlayers([])
    setGameStarted(false)
  }, [cleanup])

  return { players, updatePresence, sendGameStart, gameStarted, presenceReady, resetPresence }
}
