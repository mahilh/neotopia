// NeoTopia · backend reachability health · the single flag the whole app reads when Supabase is unreachable.
// T3 owns this file (S26).
//
// WHY THIS EXISTS (the failure class it closes · measured, not theoretical):
// With Supabase unreachable, NeoTopia used to fail INVISIBLY-BUT-LOUDLY: the console filled with network
// errors (useGameSync retried a dead channel every 1000ms forever · see the backoff note there) while the UI
// rendered a perfectly healthy lobby. useAuth already computed an `authError`, but no consumer read it, so a
// player saw "Choose your name", typed one, and nothing happened. Nothing on screen ever said the civilization
// could not be reached. This module is the missing signal.
//
// SHAPE · a passive module-level AGGREGATOR, deliberately not a React context and not the Zustand store:
//   · not the store (src/store · another lane, and this is transport health, never replayable game state ·
//     it must NOT be serialised into game_sessions.state · Rule 22/32),
//   · not a context (the reporters are hooks that mount at different depths · useAuth at the app root,
//     useGameSync only inside a game · a provider would have to wrap both and re-render the tree).
// A module singleton + useSyncExternalStore gives every consumer a tear-free read with ZERO wiring.
//
// MULTI-SOURCE · each transport reports independently under its own key ('auth', 'game-sync') and the overall
// status is the WORST live report. Auth can be fine while realtime is dead; the player is still degraded, and
// a UI must be able to say so without knowing which pipe broke.
//
// This module NEVER retries anything itself and registers NO listeners of its own. Each hook owns its own
// recovery triggers (its backoff timer, its 'online' handler) and simply reports what it observes here. That
// keeps recovery in exactly one place per transport · two owners racing to reconnect the same channel was the
// original double-scheduling bug this session fixed, and it must not be re-introduced at the aggregate layer.

import { useSyncExternalStore } from 'react'

export const BACKEND_STATUS = Object.freeze({
  ONLINE: 'online',              // every reporting source reached the backend
  RECONNECTING: 'reconnecting',  // at least one source is retrying, still inside its budget · recoverable
  OFFLINE: 'offline',            // at least one source EXHAUSTED its budget and gave up · needs a retry
})

// Worst-wins ordering. A single exhausted source outranks any number of healthy ones.
const SEVERITY = { [BACKEND_STATUS.ONLINE]: 0, [BACKEND_STATUS.RECONNECTING]: 1, [BACKEND_STATUS.OFFLINE]: 2 }

const sources = new Map()          // sourceKey → { status, attempt, reason }
const listeners = new Set()        // useSyncExternalStore subscribers
const retryHandlers = new Map()    // sourceKey → () => void · registered by the owning hook

// useSyncExternalStore requires a CACHED snapshot: getSnapshot must return the identical reference until
// something actually changes, or React re-renders forever (the classic "getSnapshot should be cached" loop).
// So we rebuild this object only inside publish().
let snapshot = freezeSnapshot(BACKEND_STATUS.ONLINE, null, 0, null)

function freezeSnapshot(status, source, attempt, reason) {
  return Object.freeze({
    status,
    source,   // which transport is driving the current (worst) status · null when online
    attempt,  // that source's retry count · 0 when online
    reason,   // its last error message · null when online
    isDegraded: status !== BACKEND_STATUS.ONLINE, // true for BOTH reconnecting and offline · the UI flag
    isOffline: status === BACKEND_STATUS.OFFLINE, // terminal · only a retry (or a reload) can clear it
  })
}

// Reduce every source down to the worst one. Nothing reporting at all === online (the app has not yet
// observed a failure · we never render a scary state on a cold start we know nothing about).
function worst() {
  let out = { status: BACKEND_STATUS.ONLINE, source: null, attempt: 0, reason: null }
  for (const [key, s] of sources) {
    if (SEVERITY[s.status] > SEVERITY[out.status]) {
      out = { status: s.status, source: key, attempt: s.attempt ?? 0, reason: s.reason ?? null }
    }
  }
  return out
}

function publish() {
  const next = worst()
  // Bail when nothing observable changed · keeps the snapshot reference stable for useSyncExternalStore and
  // avoids re-rendering every consumer on each individual retry tick that does not move the aggregate.
  if (
    next.status === snapshot.status && next.source === snapshot.source &&
    next.attempt === snapshot.attempt && next.reason === snapshot.reason
  ) return

  snapshot = freezeSnapshot(next.status, next.source, next.attempt, next.reason)
  reflectToDom(snapshot)
  for (const fn of listeners) fn()
}

// DOM + gray-box reflection. Two consumers, neither of them React:
//   · html[data-backend-status="offline"] · a CSS/selector hook so a degraded style (and a Playwright
//     assertion) works without any component subscribing. This is the witness the backend-down E2E gates on:
//     it exists whether or not a banner component has been built yet.
//   · window.__neotopia_health · a frozen read-only status snapshot for gray-box E2E reads, mirroring the
//     existing window.__neotopia_store convention. Unlike the store hook this is NOT dev-gated: it carries no
//     game state and no PII (a status string, a counter, an error message), and being able to read the real
//     health of a production tab is precisely the point.
function reflectToDom(snap) {
  if (typeof document === 'undefined') return // SSR / node test env · never touch a DOM that is not there
  try {
    document.documentElement.dataset.backendStatus = snap.status
    if (typeof window !== 'undefined') window.__neotopia_health = snap
  } catch { /* exotic/locked-down document · health reporting must never throw into a caller */ }
}

// Publish the initial ONLINE state at import time so html[data-backend-status] and window.__neotopia_health
// ALWAYS exist, from the first paint. A witness that only appears once something breaks is a witness a test
// cannot distinguish from a missing implementation.
reflectToDom(snapshot)

// ── Reporting API · called by the owning transport hooks ────────────────────────────────────────────────

/** The source reached the backend. Clears its degraded state and, if it was the worst, restores ONLINE. */
export function reportBackendUp(source) {
  const prev = sources.get(source)
  if (prev && prev.status === BACKEND_STATUS.ONLINE && prev.attempt === 0) return
  sources.set(source, { status: BACKEND_STATUS.ONLINE, attempt: 0, reason: null })
  publish()
}

/** The source failed but is still inside its retry budget · recoverable. `attempt` is 1-based. */
export function reportBackendRetrying(source, { attempt = 1, reason = null } = {}) {
  sources.set(source, { status: BACKEND_STATUS.RECONNECTING, attempt, reason })
  publish()
}

/** The source EXHAUSTED its retry budget and stopped. Terminal until retryBackend() or a fresh trigger. */
export function reportBackendDown(source, reason = null, attempt = 0) {
  sources.set(source, { status: BACKEND_STATUS.OFFLINE, attempt, reason })
  publish()
}

/**
 * The source no longer exists (its hook unmounted · the player left the game). Drop it entirely rather than
 * marking it healthy: a transport that is GONE must stop dragging the aggregate down, but claiming it came
 * back up would be a lie. Leaving a dead game channel reported as OFFLINE would keep the lobby permanently
 * degraded after a player quits a game during an outage.
 */
export function clearBackendSource(source) {
  if (sources.delete(source)) publish()
}

/**
 * Register the owning hook's "try again now" action. The hook keeps ownership of HOW it recovers (reset the
 * backoff budget, re-subscribe, re-sign-in); this only makes that action reachable from a UI that has no idea
 * which hook is broken. Returns an unregister fn for the effect cleanup.
 */
export function registerBackendRetry(source, handler) {
  retryHandlers.set(source, handler)
  return () => { if (retryHandlers.get(source) === handler) retryHandlers.delete(source) }
}

/**
 * Fire every registered retry. This is what a "Try again" control calls. Handlers are invoked defensively:
 * one throwing hook must never prevent the others from retrying. Returns how many ran.
 */
export function retryBackend() {
  let ran = 0
  for (const handler of retryHandlers.values()) {
    try { handler(); ran += 1 } catch { /* a broken handler must not block its peers */ }
  }
  return ran
}

/** Non-reactive read · for imperative call sites (event handlers, tests) that must not subscribe. */
export function getBackendHealth() { return snapshot }

// ── React binding ──────────────────────────────────────────────────────────────────────────────────────

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function getSnapshot() { return snapshot }

/**
 * useBackendHealth() → { status, source, attempt, reason, isDegraded, isOffline, retry }
 *
 * The flag any component reads to render a degraded state:
 *   const { isDegraded, isOffline, retry } = useBackendHealth()
 * `isDegraded` covers reconnecting AND offline (show something); `isOffline` is the terminal case where
 * nothing is retrying any more and only `retry()` (or a reload) can recover.
 * getServerSnapshot is the same frozen object · correct for a static build with no backend observed yet.
 */
export function useBackendHealth() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { ...snap, retry: retryBackend }
}

// Test-only reset · clears every reported source and retry handler so suites never leak state across files.
// Deliberately NOT part of the app API (nothing in src/ calls it). Listeners are intentionally NOT cleared:
// they are owned by mounted components and removed by their own effect cleanup · dropping them here would
// silently deafen a hook that is still rendering.
export function __resetBackendHealth() {
  sources.clear()
  retryHandlers.clear()
  snapshot = freezeSnapshot(BACKEND_STATUS.ONLINE, null, 0, null)
  reflectToDom(snapshot)
  for (const fn of listeners) fn()
}
