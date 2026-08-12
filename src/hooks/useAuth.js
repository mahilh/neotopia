// NeoTopia anonymous auth + username claim.
// Every visitor gets a Supabase anonymous session on first load (no signup wall);
// claiming a username upserts their player_profiles row. The session persists, so a
// returning player keeps the same user_id (and ELO / stats) across visits.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { reportBackendUp, reportBackendDown, registerBackendRetry, getBackendHealth } from './useConnectionHealth'
import { isReservedUsername, reservedUsernameError } from '../lib/reservedNames'
import { readPoolCredential } from '../lib/e2ePool'

const USERNAME_KEY = 'neotopia_username'
const CLAIMED_KEY  = 'neotopia_username_claimed'
const HEALTH_SOURCE = 'auth' // key in the useConnectionHealth aggregate · see useGameSync's 'game-sync'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(() => {
    try {
      const stored = localStorage.getItem(USERNAME_KEY) || ''
      // T2 S51 · A NAME CLAIMED BEFORE THE RESERVED-PREFIX CHECK EXISTED MUST NOT COME BACK.
      // The guard in claimUsername below only protects NEW claims. Anyone who already typed "E2Etest"
      // has it in localStorage and would be restored straight back into the purge's scope with no
      // claim screen to stop them · the fix would then protect everyone except the people it was
      // written for. Treated as UNCLAIMED rather than rewritten, so they are asked again and meet the
      // real error message (see the note in claimUsername on why silent substitution is the wrong fix).
      if (!import.meta.env.VITE_E2E && isReservedUsername(stored)) {
        try { localStorage.removeItem(CLAIMED_KEY); localStorage.removeItem(USERNAME_KEY) } catch { /* blocked */ }
        return ''
      }
      return stored
    }
    catch { return '' } // localStorage blocked in some private browsing contexts
  })
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let mounted = true
    let inFlight = false

    // Anonymous sign-in · now RETRYABLE and REPORTED (T3 S26).
    // The failure this closes: when Supabase was unreachable, signInAnonymously() rejected once, we set an
    // authError NO CONSUMER READ (Lobby destructures user/username/isLoading/isClaimed/claimUsername · never
    // authError), flipped isLoading false, and the lobby rendered a completely normal "Choose your name"
    // screen. The app looked healthy, the name went nowhere, and there was no path back · no retry, and no
    // recovery when the network returned. A failure now reports OFFLINE (so a degraded UI can say so) and is
    // recoverable from two triggers below. `inFlight` replaces the old one-shot `signingIn` latch: it still
    // prevents CONCURRENT sign-ins, but it releases afterwards so a retry is possible. Minting is still gated
    // on INITIAL_SESSION alone, so a later SIGNED_OUT can never silently re-create a user.
    const attemptSignIn = async () => {
      if (!mounted || inFlight) return
      inFlight = true
      try {
        // T2 S57 · THE FIXED CI POOL. Under VITE_E2E only, and only when the harness has seeded a
        // credential for THIS browser context, sign in as a pre-created pool user instead of minting
        // a new anonymous identity. Measured justification: ~449 anon users a day, 88% leaving no
        // trace, on a FREE plan where anonymous sign-ins count toward a hard MAU cap and the purge
        // cannot reach auth.users at all. Ten reused rows instead of ~13.5k a month.
        //
        // WHY IT CANNOT REACH A PLAYER, and why the check is written exactly this way: Vite
        // substitutes `import.meta.env.VITE_E2E` statically, so a production build compiles this to
        // `if (false && ...)` and drops the branch entirely · `signInWithPassword` then appears
        // NOWHERE in the bundle, which is what e2ePool.test.js asserts against dist/. That is the
        // only honest discriminator: VITE_E2E itself reads 0 in BOTH builds because the substitution
        // removes the name, so a guard keyed on the flag's presence would pass on a leaking bundle
        // (my own S52 finding, re-verified tonight).
        //
        // FALLS THROUGH, NEVER FAILS CLOSED: no credential means the ordinary anonymous path, so a
        // developer running `npm run dev` and any spec the harness has not seeded behave exactly as
        // before. A pool that is absent is not an error.
        if (import.meta.env.VITE_E2E) {
          const pool = readPoolCredential()
          if (pool) {
            const { data: pd, error: pe } = await supabase.auth.signInWithPassword({
              email: pool.email, password: pool.password,
            })
            if (!mounted) return
            if (!pe && pd?.user) {
              setAuthError(null); setUser(pd.user); setIsLoading(false)
              reportBackendUp(HEALTH_SOURCE)
              return
            }
            // A configured pool that will not authenticate is a HARNESS defect and must be loud ·
            // silently falling through would mint the anonymous user this exists to prevent and the
            // saving would quietly stop happening with every test still green (Rule 93).
            console.error('[e2e-pool] sign-in FAILED for a seeded credential · falling back to ' +
              'anonymous, so this run still mints an identity:', pe?.message ?? 'no user returned')
          }
        }
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!mounted) return
        if (error) {
          setAuthError(error.message)
          setIsLoading(false)
          // Terminal by construction · unlike the realtime channel there is no retry budget to burn down
          // here: signInAnonymously fires once per trigger and never self-retries, so one failure IS the
          // give-up state. Reporting OFFLINE (not RECONNECTING) is therefore the honest signal.
          reportBackendDown(HEALTH_SOURCE, error.message)
          return
        }
        setAuthError(null)
        setUser(data.user) // the subsequent SIGNED_IN event will reaffirm this idempotently
        setIsLoading(false)
        reportBackendUp(HEALTH_SOURCE)
      } finally {
        inFlight = false
      }
    }

    // Drive auth ENTIRELY off onAuthStateChange. INITIAL_SESSION fires once, AFTER the client
    // has hydrated the persisted session from storage · so we never race getSession() against
    // hydration. (The old bug: getSession() resolved null on reload before hydration finished,
    // we fell through to signInAnonymously(), and that MINTED A NEW USER + overwrote the stored
    // token · the user_id changed on every reload, breaking RLS membership and rejoin.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (session?.user) {
        // Persisted / refreshed / freshly-signed-in session · adopt it. Reaching this proves the backend
        // answered, so it also clears any earlier degraded report (a refresh that succeeds after an outage).
        setUser(session.user)
        setIsLoading(false)
        setAuthError(null)
        reportBackendUp(HEALTH_SOURCE)
        return
      }

      // No session. Mint an anonymous user ONLY when INITIAL_SESSION confirms none is persisted.
      if (event === 'INITIAL_SESSION') {
        attemptSignIn()
      } else {
        setUser(null)
        setIsLoading(false)
      }
    })

    // Two ways back from a failed sign-in:
    //   · the browser regains network → re-attempt, but ONLY from the failed state, so a routine flap
    //     during a healthy session never fires a redundant sign-in;
    //   · an explicit retry (a "Try again" control reads useBackendHealth().retry · it never imports this hook).
    const onOnline = () => { if (getBackendHealth().isOffline) attemptSignIn() }
    window.addEventListener('online', onOnline)
    const unregisterRetry = registerBackendRetry(HEALTH_SOURCE, attemptSignIn)

    return () => {
      mounted = false
      window.removeEventListener('online', onOnline)
      unregisterRetry()
      subscription.unsubscribe()
      // NOTE · deliberately NO clearBackendSource('auth') here. Auth is a PROCESS-WIDE fact, and useAuth is
      // mounted by both Lobby and GameRoom · dropping the source when one unmounts would erase a real outage
      // the other is still living through. (useGameSync clears its source because a game channel genuinely
      // ceases to exist when you leave the room.)
    }
  }, []) // empty dep array: runs once on mount

  const claimUsername = useCallback(async (name) => {
    if (!user || !name?.trim()) return { error: 'No user or empty name' }
    const cleaned = name.trim().slice(0, 20)

    // T2 S51 · REJECT THE PURGE'S OWN NAMESPACE, AND SAY SO (T3's S50 finding).
    // purge_e2e_test_data() deletes profiles and rooms by username prefix, and this function used to
    // accept any string at all. A friend typing "E2Etest" got a profile inside that scope and lost
    // their room, their session and their game to the next CI run · silently, with the cascade doing
    // the damage and nothing naming them anywhere. A reserved namespace with no reservation.
    //
    // TOLD, NOT REWRITTEN. Silently sanitising to "test" would be the tempting one-liner and it is
    // the wrong fix: the player typed a name, and a system that quietly substitutes a different one
    // is how you get a person who cannot find their own profile. The check is stricter than the SQL
    // on purpose (case-insensitive against a case-sensitive `like`) · see src/lib/reservedNames.js.
    // THE E2E BYPASS LIVES HERE, NOT IN reservedNames.js, and the placement is the point. Vite
    // substitutes `import.meta.env.VITE_E2E` STATICALLY, so a production build compiles this to
    // `if (false && ...)` and drops it · the literal never reaches a player's bundle, which is
    // asserted against the built assets in reservedNames.test.js rather than claimed here.
    // playwright.config.js sets the flag on its dev server (T3 S51) so the harness can keep claiming
    // the 'E2E...' names the purge needs in order to find and delete its own rows.
    if (!import.meta.env.VITE_E2E && isReservedUsername(cleaned)) {
      return { error: reservedUsernameError(cleaned) }
    }

    // player_profiles.username is NON-unique (migration 012 dropped UNIQUE(username) · confirmed against the
    // live schema this session · Rule 68) and each player keeps ONE row (keyed by user_id), so a claim is an
    // INSERT on first run and a RENAME on later runs (Lobby reuses this to edit the name · BUG-05). The one
    // correctness trap this path must still avoid:
    //   RENAME MUST PRESERVE STATS. A blanket upsert that re-sends elo/games/index would reset them to 0 on
    //   every rename. So we UPDATE only the username when a row exists, and lean on the column DEFAULTS
    //   (elo 1000 · games 0 · index 0 · verified live) for a fresh insert.
    // (The old "name taken" 23505 translation was retired in S25 · with usernames non-unique the write can no
    //  longer raise a username collision, so there is nothing to catch · confirmed by Mahil's decision + a live
    //  constraint check. Any write error below is now infra-only and returns its real message.)
    const { data: existing } = await supabase
      .from('player_profiles').select('id').eq('user_id', user.id).maybeSingle()

    const { error } = existing
      ? await supabase.from('player_profiles').update({ username: cleaned }).eq('user_id', user.id)
      : await supabase.from('player_profiles').insert({ user_id: user.id, username: cleaned, avatar_color: 'blue' })

    if (error) {
      // Non-bricking: return any write error as one clean line so the claim screen never stalls on a raw error
      // object (the old bug · T1 S23). No username-collision special-casing · collisions are impossible post-012.
      return { error: error.message ?? 'Could not save name' }
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
