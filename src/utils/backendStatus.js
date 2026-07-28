// NeoTopia · the lobby's backend-down view model.
//
// WHY THIS EXISTS (launch blocker · seen live): Supabase was paused for hours and the lobby rendered
// as if nothing was wrong. Create Room / Join Room looked live and clickable, auth errors piled up in
// the console, and a stranger clicking either button hit nothing at all.
//
// WHAT THIS IS NOT: it is NOT a second health system. T3 owns the actual detection in
// src/hooks/useConnectionHealth.js · a module-level aggregator that every transport ('auth',
// 'game-sync') reports into, exposed as useBackendHealth() and reflected onto
// html[data-backend-status]. That is the single source of truth for reachability and this file does
// not duplicate, re-derive, or compete with it (Rule 62 · reconcile, never rebuild).
//
// WHAT THIS IS: the pure mapping from "what the app knows" to "what the lobby renders". It folds T3's
// health snapshot together with the two auth facts health cannot express (auth has not settled yet ·
// auth settled but produced no session at all) and returns one verdict with one gate, `canUseRooms`,
// so the banner and every room control are physically incapable of disagreeing.
//
// DELIBERATELY PURE · no imports, no React, no Supabase, and NO import of useConnectionHealth. The
// caller passes the snapshot in. That keeps this unit-testable without mocking a network client, and
// keeps a cross-lane module out of src/utils entirely.

// Tone drives presentation only · the behavioural gate is always canUseRooms.
export const TONE_OK           = 'ok'
export const TONE_CONNECTING   = 'connecting'   // auth still settling · the existing spinner covers it
export const TONE_RECONNECTING = 'reconnecting' // a transport is retrying inside its budget · recoverable
export const TONE_OFFLINE      = 'offline'      // gave up · nothing works until a retry succeeds

// Blame-free on purpose. The player did nothing wrong and cannot fix this, so the copy says what is
// true, whose fault it is, and what happens next. A stranger reads this, not us · no jargon.
const OFFLINE_HEADLINE = "Can't reach NeoTopia's servers"
const OFFLINE_DETAIL   = 'Your session could not be started, so rooms are unavailable right now. This is on our side, not yours.'
const RETRY_HEADLINE   = 'Reconnecting…'
const RETRY_DETAIL     = 'The connection dropped. Trying to restore it.'

/**
 * @param {object}  input
 * @param {boolean} input.authLoading  useAuth().isLoading · auth has not settled yet
 * @param {?string} input.authError    useAuth().authError · sign-in actually failed
 * @param {?object} input.user         useAuth().user · null once settled means no session
 * @param {?object} [input.health]     the useBackendHealth() snapshot from T3's useConnectionHealth:
 *        { status, source, attempt, reason, isDegraded, isOffline }. Optional · absent is treated as
 *        "nothing has reported a failure", which is exactly that module's own cold-start meaning, so
 *        an unwired caller degrades to the auth-only signals rather than to a scary state.
 *
 * @returns {{tone: string, canUseRooms: boolean, showBanner: boolean, isOffline: boolean,
 *            headline: string, detail: string, reason: ?string}}
 */
export function deriveBackendStatus({ authLoading, authError, user, health } = {}) {
  const h = health ?? {}

  // OFFLINE · three independent witnesses, any one of which means no room action can succeed:
  //   1. health.isOffline  · a transport burned its retry budget and gave up (T3's terminal state ·
  //      useAuth reports this immediately on a failed signInAnonymously, which is terminal by
  //      construction because it never self-retries).
  //   2. authError         · the raw failure, read straight from useAuth. Redundant with (1) today
  //      and kept deliberately: it is the signal that ALREADY existed and was already being thrown
  //      away by this page, so the fix does not depend on the reporting wiring staying in place.
  //   3. settled with no user and no error · the genuinely silent case neither of the above sees.
  const isOffline = Boolean(h.isOffline) || Boolean(authError) || (!authLoading && !user)

  if (isOffline) {
    return {
      tone: TONE_OFFLINE,
      canUseRooms: false,
      showBanner: true,
      isOffline: true,
      headline: OFFLINE_HEADLINE,
      detail: OFFLINE_DETAIL,
      // Raw cause, rendered small · useful to us in a screenshot, ignorable to a player. Prefer the
      // aggregator's reason (it names which transport died) over the bare auth message.
      reason: h.reason ?? (authError ? String(authError) : null) ?? 'No session was established.',
    }
  }

  // Auth has not settled. Rooms stay shut · a live-looking Create Room during an unsettled session is
  // the same broken promise as during a dead one, just briefer. No banner: the spinner already says it.
  if (authLoading) {
    return { tone: TONE_CONNECTING, canUseRooms: false, showBanner: false, isOffline: false, headline: '', detail: '', reason: null }
  }

  // A transport is retrying inside its budget. In the lobby this can only ever be 'game-sync' (auth
  // never reports RECONNECTING · it has no budget to burn), and game-sync is not even mounted here ·
  // so rooms stay USABLE and this is a quiet notice, not a red wall. Disabling here would punish the
  // player for a channel that has nothing to do with creating a room.
  if (h.isDegraded) {
    return { tone: TONE_RECONNECTING, canUseRooms: true, showBanner: true, isOffline: false, headline: RETRY_HEADLINE, detail: RETRY_DETAIL, reason: h.reason ?? null }
  }

  return { tone: TONE_OK, canUseRooms: true, showBanner: false, isOffline: false, headline: '', detail: '', reason: null }
}
