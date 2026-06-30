// NeoTopia anonymous auth + username claim.
// Every visitor gets a Supabase anonymous session on first load (no signup wall);
// claiming a username upserts their player_profiles row. The session persists, so a
// returning player keeps the same user_id (and ELO / stats) across visits.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const USERNAME_KEY = 'neotopia_username'
const CLAIMED_KEY  = 'neotopia_username_claimed'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(() => {
    try { return localStorage.getItem(USERNAME_KEY) || '' }
    catch { return '' } // localStorage blocked in some private browsing contexts
  })
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let mounted = true
    let signingIn = false

    // Drive auth ENTIRELY off onAuthStateChange. INITIAL_SESSION fires once, AFTER the client
    // has hydrated the persisted session from storage · so we never race getSession() against
    // hydration. (The old bug: getSession() resolved null on reload before hydration finished,
    // we fell through to signInAnonymously(), and that MINTED A NEW USER + overwrote the stored
    // token · the user_id changed on every reload, breaking RLS membership and rejoin.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (session?.user) {
        // Persisted / refreshed / freshly-signed-in session · adopt it.
        setUser(session.user)
        setIsLoading(false)
        return
      }

      // No session. Mint an anonymous user ONLY when INITIAL_SESSION confirms none is persisted
      // (and only once · a later SIGNED_OUT must not silently re-create one).
      if (event === 'INITIAL_SESSION' && !signingIn) {
        signingIn = true
        supabase.auth.signInAnonymously().then(({ data, error }) => {
          if (!mounted) return
          if (error) { setAuthError(error.message); setIsLoading(false); return }
          setUser(data.user) // the subsequent SIGNED_IN event will reaffirm this idempotently
          setIsLoading(false)
        })
      } else {
        setUser(null)
        setIsLoading(false)
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, []) // empty dep array: runs once on mount

  const claimUsername = useCallback(async (name) => {
    if (!user || !name?.trim()) return { error: 'No user or empty name' }
    const cleaned = name.trim().slice(0, 20)

    // player_profiles.username is globally UNIQUE and each player keeps ONE row (keyed by user_id), so a
    // claim is an INSERT on first run and a RENAME on later runs (Lobby reuses this to edit the name · BUG-05).
    // Two correctness traps this path must avoid:
    //  (1) RENAME MUST PRESERVE STATS. A blanket upsert that re-sends elo/games/index would reset them to 0
    //      on every rename. So we UPDATE only the username when a row exists, and lean on the column DEFAULTS
    //      (elo 1000 · games 0 · index 0 · verified live) for a fresh insert.
    //  (2) A TAKEN NAME MUST NOT BRICK THE LOBBY. Writing a name another player (or this user's orphaned old
    //      anon id) already holds raises 23505 → that raw 409 string used to surface to the user and stall the
    //      claim screen, leaving the real-room flow unreachable (T1 S23). We translate it to one clear,
    //      actionable line so the user simply picks another name and the flow continues.
    const { data: existing } = await supabase
      .from('player_profiles').select('id').eq('user_id', user.id).maybeSingle()

    const { error } = existing
      ? await supabase.from('player_profiles').update({ username: cleaned }).eq('user_id', user.id)
      : await supabase.from('player_profiles').insert({ user_id: user.id, username: cleaned, avatar_color: 'blue' })

    if (error) {
      // A UNIQUE(username) violation (23505 on player_profiles_username_key) means the name is taken · give a
      // friendly, actionable message. A 23505 on any OTHER constraint (e.g. a user_id race) falls through to
      // its real message rather than mislabel it "taken".
      const detail = `${error.message ?? ''} ${error.details ?? ''}`
      const nameTaken = (error.code === '23505' || /duplicate key/i.test(detail)) && /username/i.test(detail)
      return { error: nameTaken ? 'That name is taken. Please choose another.' : (error.message ?? 'Could not save name') }
    }

    try {
      localStorage.setItem(USERNAME_KEY, cleaned)
      localStorage.setItem(CLAIMED_KEY, '1')
    } catch { /* localStorage blocked · session-only, fine */ }
    setUsername(cleaned)
    return { error: null }
  }, [user])

  const isClaimed = (() => {
    try { return !!localStorage.getItem(CLAIMED_KEY) }
    catch { return false }
  })()

  return { user, username, isLoading, authError, isClaimed, claimUsername }
}
