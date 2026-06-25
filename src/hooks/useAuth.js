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

    const { error } = await supabase.from('player_profiles').upsert({
      user_id: user.id,
      username: cleaned,
      avatar_color: 'blue',
      elo_rating: 1000,
      games_played: 0,
      games_won: 0,
      neotopia_index: 0,
    }, { onConflict: 'user_id' })

    if (!error) {
      try {
        localStorage.setItem(USERNAME_KEY, cleaned)
        localStorage.setItem(CLAIMED_KEY, '1')
      } catch { /* localStorage blocked — session-only, fine */ }
      setUsername(cleaned)
    }

    return { error: error?.message ?? null }
  }, [user])

  const isClaimed = (() => {
    try { return !!localStorage.getItem(CLAIMED_KEY) }
    catch { return false }
  })()

  return { user, username, isLoading, authError, isClaimed, claimUsername }
}
