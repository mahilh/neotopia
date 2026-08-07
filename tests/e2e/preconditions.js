// NeoTopia · SESSION PRECONDITIONS for live E2E specs (T3 S27).
//
// THE INCIDENT THIS EXISTS FOR (07-27 / 07-28 nightly · triaged in S26, fixed here):
// Two nightly runs failed with
//     [data-testid=mode-flow] not found
// and that message sent the reader hunting for a deleted component. The component was fine. The real chain was
//     DNS/pause → anon sign-in fails → no session → the lobby never leaves the claim screen
//       → `Create Room` click times out → mode-flow never renders → the assertion blames a MISSING ELEMENT.
// The reported symptom was the THIRD domino. Two settled facts proved it: the same headSha failed twice and
// passed four times (so the cause cannot live in the code), and the run log carried a `getaddrinfo ENOTFOUND`
// cause line (so the cause was DNS, not a quota · a plausible rival explanation that predicts the same red X).
//
// WHAT THIS FIXES · not the outage, the DIAGNOSIS. A test that names the wrong layer costs more than a test
// that fails: it spends a human's morning on a component that was never broken. These gates run BEFORE a spec
// touches its first feature locator, so an outage reports itself as an outage.
//
// Rule 63 in its purest form: write the test that tells the truth about WHICH layer broke.
// Rule 39, extended: an HTTP status is a witness · and when there is no connection at all, the ABSENCE of one
// is itself the witness, and it excludes every quota-shaped explanation.
//
// THE WITNESS · html[data-backend-status], published by src/hooks/useConnectionHealth.js at import time, so it
// exists from the first paint whether or not any component subscribed. window.__neotopia_health carries the
// same snapshot with the reason string attached.

import { expect } from '@playwright/test'

const HEALTH_ATTR = 'html[data-backend-status]'

/** Read the gray-box health snapshot · null before the app's JS has run at all. */
export async function readHealth(page) {
  return page.evaluate(() => window.__neotopia_health ?? null)
}

/**
 * Fail LOUDLY and ACCURATELY if the backend is unreachable.
 *
 * Call this immediately after the first navigation, before any feature locator. It watches the health
 * attribute for `settleMs` and throws the moment it reads 'offline'.
 *
 * WHY IT WATCHES RATHER THAN SAMPLES ONCE: useConnectionHealth publishes ONLINE at import time, deliberately ·
 * "nothing has reported a failure yet" must not render as a scary state on a cold start. So an instantaneous
 * read right after goto() ALWAYS says online, and a gate built on one sample would pass during a total outage
 * and prove nothing. The failure takes a moment to arrive (signInAnonymously has to reject first), and this
 * waits for it. A dead backend reports terminal within ~1s · well inside the default window, and well before
 * the 15s feature-locator timeouts that used to absorb it and mis-report it.
 *
 * It does NOT block on 'reconnecting'. A transport retrying inside its budget may still succeed, and refusing
 * to run the spec would invent an outage · the same false-positive discipline the join path uses.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{settleMs?: number, bootTimeoutMs?: number, context?: string}} [opts]
 * @returns {Promise<{status: string, reason: ?string}>} the observed health
 */
export async function assertBackendReachable(page, { settleMs = 8_000, bootTimeoutMs = 20_000, context = '' } = {}) {
  const where = context ? ` (${context})` : ''

  // The attribute is written at module import, so its ABSENCE means the app's JS never ran · a broken bundle,
  // a dead dev server, a crashed boot. That is a different layer again, and it deserves its own sentence
  // rather than being reported as a missing game element thirty seconds later.
  try {
    await expect(page.locator(HEALTH_ATTR)).toHaveAttribute('data-backend-status', /.+/, { timeout: bootTimeoutMs })
  } catch {
    throw new Error(
      `PRECONDITION${where}: the app never booted · html[data-backend-status] was never published within ` +
      `${bootTimeoutMs}ms. This is NOT a feature regression · check the dev server, the bundle and the ` +
      `console before looking at any component.`
    )
  }

  const deadline = Date.now() + settleMs
  let last = await readHealth(page)
  while (Date.now() < deadline) {
    last = await readHealth(page)
    if (last?.status === 'offline') {
      throw new Error(
        `PRECONDITION${where}: BACKEND UNREACHABLE · not a feature regression.\n` +
        `  html[data-backend-status] = "offline"\n` +
        `  failing transport         = ${last.source ?? 'unknown'}\n` +
        `  cause                     = ${last.reason ?? '(none reported)'}\n` +
        `Every locator this spec would have asserted next is downstream of a session that was never ` +
        `established. Fix or wait out the outage · do NOT go looking for a deleted component.`
      )
    }
    await page.waitForTimeout(250)
  }

  return { status: last?.status ?? 'unknown', reason: last?.reason ?? null }
}

/**
 * The stronger gate, for specs that go through the lobby: wait for proof that a SESSION actually exists,
 * not merely that nothing has failed yet.
 *
 * The name field is disabled whenever `canUseRooms` is false, and deriveBackendStatus treats "auth settled
 * with no user" as offline · so an ENABLED name field is a positive witness that anonymous sign-in landed.
 * That is a stronger claim than "no failure has been reported", and it is the precondition the 07-27 chain
 * actually violated: there was no session, so the lobby never left the claim screen.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} nameInput  the claim-screen name field
 * @param {{timeout?: number, context?: string}} [opts]
 */
export async function assertSessionEstablished(page, nameInput, { timeout = 20_000, context = '' } = {}) {
  await assertBackendReachable(page, { settleMs: 3_000, context })

  try {
    await expect(nameInput).toBeEnabled({ timeout })
  } catch {
    const health = await readHealth(page)
    throw new Error(
      `PRECONDITION${context ? ` (${context})` : ''}: NO SESSION · the claim screen never became usable, so ` +
      `anonymous sign-in did not land.\n` +
      `  health = ${health?.status ?? 'unknown'} · source ${health?.source ?? 'n/a'} · ${health?.reason ?? 'no reason reported'}\n` +
      `Everything this spec asserts next (Create Room, mode toggles, the board) is downstream of this. ` +
      `The component under test is almost certainly fine.`
    )
  }
}
