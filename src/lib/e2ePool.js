// THE FIXED CI IDENTITY POOL · the app half  (T2 S57)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS, WITH THE NUMBER THAT JUSTIFIES IT. Measured S56/S57 against production:
//
//     auth.users        5724 total · 1237 in 24h · ~449/day · 5025 (88%) leaving NO TRACE
//     organization      FREE plan · anonymous sign-ins count toward the MAU cap
//
// Every `signInAnonymously()` mints a permanent identity. The purge cannot touch `auth.users` (not in
// `public`), so ~13.5k identities a month accumulate against a hard metered cap, on a project with
// essentially no real players. This is the first defect in this project with a FINANCIAL denominator.
//
// THE FIX IS TO STOP MINTING, NOT TO CLEAN UP: a small pool of pre-created users, reused. Ten rows
// forever instead of four hundred and fifty a day.
//
// ── WHAT THIS MODULE IS AND IS NOT ───────────────────────────────────────────────────────────────
// IS: the contract. Where the credential lives, what shape it has, and how the pool's own names are
//     kept inside the swept namespace. Consumed by useAuth.js.
// IS NOT: the allocator. WHICH pool member a given browser context uses is chosen by the harness,
//     because nothing inside the app can distinguish two Playwright contexts from each other · they
//     are separate browsers with separate storage and identical code. Measured, not assumed:
//     playwright.config.js runs `workers: 1, fullyParallel: false`, so there is no cross-worker race,
//     but a SINGLE spec routinely drives two contexts at once (host + joiner) and they must not be
//     the same user or they share a profile row and a room host_id. See comms/t2-s57-pool-contract.md.
//
// ── NON-NEGOTIABLE: THE POOL'S NAMES ARE SWEPT BY CONSTRUCTION ───────────────────────────────────
// A fixed pool is a NEW PRODUCER in the identity namespace, and that namespace has already taken two
// strikes (S51: a player could CLAIM a reserved name · S55: 49 profiles produced OUTSIDE it). Adding
// a producer that has to REMEMBER the convention would be building the third strike by hand.
// So the pool's display name is DERIVED from RESERVED_USERNAME_PREFIXES rather than typed, and
// e2ePool.test.js asserts the derivation lands inside `isSweptByPurge`. It is not possible to
// configure a pool member whose name the cleanup cannot reach.

import { RESERVED_USERNAME_PREFIXES } from './reservedNames'

/**
 * localStorage key the harness writes before the app boots (Playwright `context.addInitScript`).
 * Chosen over a query param so it survives in-app navigation, and over a build-time constant so two
 * contexts served by ONE dev server can still differ · which is the whole allocation problem.
 */
export const E2E_POOL_KEY = '__neotopia_e2e_pool'

/**
 * Display name for pool member `n`. DERIVED, never typed · see the non-negotiable above.
 * RESERVED_USERNAME_PREFIXES[0] is 'E2E', so member 3 is 'E2EPool03' and the purge's
 * `username like 'E2E%'` reaches it by construction.
 */
export function poolUsername(n) {
  const prefix = RESERVED_USERNAME_PREFIXES[0]
  return `${prefix}Pool${String(n).padStart(2, '0')}`
}

/**
 * Read the credential the harness seeded for THIS browser context.
 * Returns null when absent or malformed · a missing pool must fall through to the shipped
 * anonymous path rather than break the app, because this code also exists in a developer's
 * ordinary `npm run dev` where no harness has written anything.
 *
 * Returns UNVALIDATED-but-shaped data only: an object with a non-empty email and password. A
 * partially-written credential is treated as absent rather than passed to the auth call, because a
 * failed password grant and a missing pool are different outcomes and only one of them is a bug
 * (Rule 80 · do not let "I could not read it" resolve to something plausible).
 */
export function readPoolCredential() {
  try {
    const raw = localStorage.getItem(E2E_POOL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.email !== 'string' || typeof parsed.password !== 'string') return null
    if (!parsed.email.trim() || !parsed.password) return null
    return { email: parsed.email.trim(), password: parsed.password, index: parsed.index ?? null }
  } catch {
    return null   // blocked storage, or malformed JSON · both are "no pool", not an error state
  }
}

// ── THE OBSERVABLE · WHY A CONSOLE LINE IS NOT ENOUGH  (T2 S59) ───────────────────────────────────
// The Council's tripwire for this feature: "if the identity count does not measurably drop within 24h
// of activation, the branch is falling back silently and the instrumentation failed. That is a red,
// not a puzzle." The failure mode is silent BY DESIGN · the fall-through to `signInAnonymously()` is
// deliberate (a developer's `npm run dev` must keep working), so a broken pool leaves the app fully
// functional, every spec green, and one number rising in a dashboard nobody reads on a schedule.
// That is a CALLER WITH NO OBSERVABLE, which is the shape that hid award_game_win for two sessions
// and card art for fifteen (Rule 110's corollary).
//
// So the app publishes WHICH branch it took, as a frozen read-only snapshot, following the
// window.__neotopia_health convention already in this codebase. It carries a READING, never a
// capability: nothing in the app consumes it and no state depends on it.
//
// ⚠ THE STATE THAT IS NOT IN THE ENUM IS THE MOST IMPORTANT ONE. `window.__neotopia_pool_outcome`
// being ABSENT means the app never reached the decision at all · the commonest real cause being an
// already-persisted session, which useAuth adopts before attemptSignIn is ever called. That is a
// genuinely reachable silent skip and it is a DIFFERENT fact from "there was no credential". Absent
// is UNMEASURED; NO_CREDENTIAL is a measured zero (Rule 95b · say which, in the output, never in
// your memory of it).
//
// ⚠ AND THE NAME HAS A BOUNDARY ON PURPOSE. `__neotopia_pool_outcome` is neither a substring nor a
// superstring of `__neotopia_e2e_pool`, so the two bundle assertions are independent · a `.includes`
// guard on one cannot be satisfied by the other. That is Rule 112, and e2ePool.test.js asserts the
// disjointness rather than trusting that I checked it once.
export const E2E_POOL_OUTCOME_KEY = '__neotopia_pool_outcome'

// ⚠ NOT Object.freeze()d, AND THE REASON IS A MEASUREMENT RATHER THAN A PREFERENCE. Freezing an enum
// is the obviously-tidier version and it is what the first draft did. Measured on the real artifacts:
//     Object.freeze({...})   ->  'persisted-anon-preempted' : 1 file in the PRODUCTION bundle
//     a plain object literal ->  0
// `Object.freeze` is a CALL, so rollup cannot prove it side-effect-free and will not tree-shake the
// object · every one of these strings then ships to a player, in a module whose whole claim is that it
// does not. Nothing here is secret and nothing is capability, so the leak is weight rather than
// danger · but it makes the elimination claim false in part while reading as true, and the elimination
// claim is the only reason this branch is allowed to exist at all. The record itself IS frozen (see
// recordPoolOutcome) because that one has a consumer who must not be able to fake it; this one has no
// consumer in production by construction. Asserted in e2ePool.test.js against dist/ so it stays gone.
export const POOL_OUTCOME = ({
  /** a password grant returned a real, non-anonymous user · 0 identities minted */
  REUSED: 'reused',
  /** VITE_E2E is on and the harness seeded nothing · the anonymous path ran, unconverted */
  NO_CREDENTIAL: 'no-credential',
  /** a credential was present and the endpoint refused it · harness or credential defect */
  GRANT_FAILED: 'grant-failed',
  /** the grant succeeded and handed back an ANONYMOUS user · the pool minting in disguise */
  MINTED_IN_DISGUISE: 'minted-in-disguise',
  /** a persisted ANONYMOUS session was adopted while a credential sat unread · the silent skip */
  PERSISTED_ANON_PREEMPTED: 'persisted-anon-preempted',
})

/**
 * Publish the pool decision for the harness to assert on.
 *
 * `detail` IS PUBLISHED TO A PAGE GLOBAL ANY SCRIPT CAN READ, so it must never carry the credential.
 * Callers pass a message and at most a truncated user id; this function does not receive the password
 * and cannot leak it. e2ePool.test.js asserts that property first, before anything about outcomes ·
 * an observable that leaks the thing it observes is worse than no observable at all.
 */
export function recordPoolOutcome(outcome, detail = null) {
  try {
    if (typeof window === 'undefined') return
    window[E2E_POOL_OUTCOME_KEY] = Object.freeze({ outcome, detail, at: Date.now() })
  } catch { /* a sealed window in some embedded context · the reading is optional, the app is not */ }
}

/**
 * The current outcome, or null if the app has not reached the pool decision on this page load.
 *
 * WHY A READER EXISTS RATHER THAN CALLERS TOUCHING THE GLOBAL: the four decision outcomes above are
 * DECISIONS and a later one legitimately replaces an earlier one (a retry that succeeds after a
 * failed grant must end up reading `reused`). The preemption record is not a decision · it is the
 * observation that no decision was ever taken · so it must only be written when this returns null,
 * or the vaguer record clobbers the specific one and turns a diagnosed failure into an ambiguous
 * one. That distinction is the whole reason this is a function and not a property access.
 */
export function readPoolOutcome() {
  try {
    if (typeof window === 'undefined') return null
    return window[E2E_POOL_OUTCOME_KEY] ?? null
  } catch { return null }
}
