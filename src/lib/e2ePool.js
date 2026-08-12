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
