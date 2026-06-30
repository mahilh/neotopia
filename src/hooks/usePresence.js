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
function buildSelf(user, username, seat, isHost, isReady, status, mode, clusterBonus) {
  return {
    userId: user?.id ?? null,
    username: username ?? 'Builder',
    seat: seat ?? null,
    isHost: !!isHost,
    isReady: !!isReady,
    // Mode-aware presence (T3 S17): WHERE this player is (in_lobby · in_game · in_flow_game · idle) and WHICH
    // mode the room runs. Lets the lobby render a live "N online · M in a flow game" roster — the civilization
    // feels populated. The room lifecycle owner (useGameRoom) derives status from roomPhase + the chosen mode.
    status: status ?? 'in_lobby',
    mode: mode ?? null,
    // Live cluster bonus (board game rule p9 · getClusterTotal · T2 S18) surfaced into presence so the roster
    // can show a game's current civilization-level cluster points. BOARD-GLOBAL · the SAME number for every
    // player (no per-hex placer to attribute it · documented divergence in patternMatcher), so every seat
    // reports the same value and a consumer reads it from any entry. 0 in the lobby (no board · the caller
    // gates it to roomPhase==='playing'). The caller computes it · this transport stays dumb (status/mode pattern).
    clusterBonus: clusterBonus ?? 0,
  }
}

// Render-time display disambiguation (S25): display names are NON-unique (migration 012), so two seats in one
// room can legitimately share a name. This appends " (2)", " (3)" … to the 2nd+ occurrence of an identical
// (trimmed, case-insensitive) name so a player is never confused by two identical labels in the roster. It is
// PURELY a view transform on the locally-assembled roster · the wire payload (selfRef / what we track()) is
// untouched, identity stays on userId/seat, and nothing persisted or synced changes. Exported so a render-time
// consumer in another lane (the in-game HUD / FinalScore, which build names from game state) can reuse the exact
// same rule WITHOUT baking the suffix into authoritative state. Pure · order-preserving · does not mutate input.
export function disambiguateRoster(roster) {
  const seen = new Map()
  return (roster ?? []).map(p => {
    const name = p?.username?.trim()
    if (!name) return p // nothing to disambiguate (placeholder · "Joining…" · missing name)
    const key = name.toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    return n > 1 ? { ...p, username: `${p.username} (${n})` } : p
  })
}

/**
 * usePresence(roomId, user, username, seat, isHost, status, mode, clusterBonus)
 * Returns { players, updatePresence, sendGameStart, gameStarted, presenceReady, resetPresence }.
 * Subscribes only when roomId is non-null. Re-subscribes on roomId change · seat/host/username/status/mode/
 * clusterBonus changes only re-track (no re-subscribe), so toggling ready or starting the game never churns
 * the channel. clusterBonus is a board-GLOBAL value the caller computes (getClusterTotal · board game rule p9)
 * · default 0 keeps every existing caller's payload identical until it passes the term.
 */
export function usePresence(roomId, user, username, seat, isHost, status = 'in_lobby', mode = null, clusterBonus = 0) {
  const [players, setPlayers] = useState([])
  const [gameStarted, setGameStarted] = useState(false)
  const [presenceReady, setPresenceReady] = useState(false)

  const channelRef = useRef(null)
  // Latest self payload · refs so the subscribe effect (keyed on roomId only) always tracks
  // current values without re-subscribing when they change.
  const selfRef = useRef(buildSelf(user, username, seat, isHost, false, status, mode, clusterBonus))
  selfRef.current = buildSelf(user, username, seat, isHost, selfRef.current?.isReady ?? false, status, mode, clusterBonus)

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
        // Display-only: distinguish duplicate names (non-unique since migration 012) before the lobby renders
        // them · the tracked payload is untouched so this never leaves this client (S25 · rendering nicety).
        setPlayers(disambiguateRoster(roster))
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

  // Re-publish presence when this player's status, mode, or live clusterBonus changes (lobby → in_game/
  // in_flow_game on start or back to in_lobby · the board's cluster total moving during play). track()
  // otherwise fires ONLY on subscribe + ready-toggle, so without this the roster would freeze at the first
  // payload. Re-track only after SUBSCRIBED (presenceReady) · idempotent · no re-subscribe (the channel is
  // untouched · the seat/host churn-avoidance pattern extended to status/mode/clusterBonus). clusterBonus is a
  // primitive, so this fires only when the NUMBER changes — not on every regions re-render in the caller.
  useEffect(() => {
    if (channelRef.current && presenceReady) channelRef.current.track(selfRef.current)
  }, [status, mode, clusterBonus, presenceReady])

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
