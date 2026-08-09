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

// ── DEPLOYMENT PROTECTION · the fourth layer (T3 S31) ────────────────────────────────────────────
// The three layers above answer "the app did not boot", "the backend is unreachable" and "there is no
// session". A fourth can produce all the same downstream symptoms and none of those sentences: the
// deployment itself refusing to serve an automated client.
//
// neotopia's Vercel project has ssoProtection = all_except_custom_domains, and *.vercel.app is not a
// custom domain, so every preview and the production alias sit behind it. An automated browser cannot
// clear the challenge (it answers 708 and never resolves), so a spec pointed at a protected
// deployment gets a challenge page where the app should be, NeoTopia's JS never runs, and the first
// feature locator times out · which reads as a deleted component. That is exactly the 07-27 shape
// this file exists for, one layer further out, and it deserves its own sentence.
//
// SCOPE, STATED HONESTLY: no spec in this repo points at production today (playwright.config.js
// baseURL is http://localhost:5173, and the nightly starts its own dev server), so this has never
// fired in CI and is not fixing a live red. It is the gate for the moment somebody points a spec at
// a deployment · a prod smoke test, a preview-URL run, a PLAYWRIGHT_BASE_URL override.
//
// The real fix is a custom domain, which is not a code change. The message says so, because a
// diagnosis that names an unfixable-in-code cause without naming the fix just relocates the confusion.

const MITIGATION_HEADER = 'x-vercel-mitigated'

// Body markers, in the two shapes Vercel serves. Kept as literals rather than one loose regex so a
// future false positive can be traced to the exact string that produced it.
const CHALLENGE_MARKERS = ['_vercel/challenge', 'request-challenge', 'vercel-challenge', 'verifying your browser']
const SSO_MARKERS = ['vercel.com/sso-api', '_vercel_sso_nonce', 'authentication required']

/**
 * Is this response a deployment-protection wall rather than the app?
 *
 * PURE · takes a plain {status, headers, body} so it can be exercised with no browser and no network,
 * which is what makes its WORDING testable. Returns null when nothing indicates protection · saying
 * "protected" about an ordinary 403 from our own API would be a worse failure than saying nothing.
 *
 * @param {{status?: number, headers?: Record<string,string>, body?: string}} res
 * @returns {?{kind: string, evidence: string}}
 */
export function diagnoseDeploymentProtection({ status, headers = {}, body = '' } = {}) {
  const h = {}
  for (const [k, v] of Object.entries(headers ?? {})) h[String(k).toLowerCase()] = String(v ?? '')
  const text = String(body ?? '').toLowerCase()

  // 1 · the explicit witness. Vercel stamps this header when it mitigates a request, and it is the
  //     only signal here that cannot be produced by our own application code (Rule 39).
  if (h[MITIGATION_HEADER]) {
    return { kind: 'challenge', evidence: `${MITIGATION_HEADER}: ${h[MITIGATION_HEADER]}` }
  }

  // 2 · the challenge endpoint answers with its own non-standard status.
  if (status === 708) return { kind: 'challenge', evidence: 'HTTP 708 · the Vercel challenge endpoint' }

  // 3 · SSO / password protection: a 401 the app never issues. NeoTopia ships no serverless functions
  //     and no server-side auth, so a 401 on a document request cannot have come from us.
  const marker = (list) => list.find(m => text.includes(m))
  if (status === 401) {
    const m = marker(SSO_MARKERS)
    return { kind: 'sso', evidence: m ? `HTTP 401 · body contains "${m}"` : 'HTTP 401 on a document request' }
  }

  // 4 · a challenge page served with an ordinary status. Body evidence is REQUIRED here · a bare 403
  //     is far more likely to be one of our own RLS denials than a WAF.
  if (status === 403 || status === 429) {
    const m = marker(CHALLENGE_MARKERS)
    if (m) return { kind: 'challenge', evidence: `HTTP ${status} · body contains "${m}"` }
  }

  return null
}

/** The sentence a human reads at 3am. Exported so the self-test can assert on it directly. */
export function deploymentProtectionMessage({ kind, evidence }, { context = '', url = '' } = {}) {
  const where = context ? ` (${context})` : ''
  return (
    `PRECONDITION${where}: BLOCKED BY VERCEL DEPLOYMENT PROTECTION · not a feature regression, and ` +
    `not a backend outage.\n` +
    `  target   = ${url || '(the page under test)'}\n` +
    `  kind     = ${kind === 'sso' ? 'SSO / password protection' : 'bot challenge'}\n` +
    `  evidence = ${evidence}\n` +
    `The deployment answered the automated client with a wall instead of the app, so NeoTopia's JS ` +
    `never ran and every locator this spec would have asserted next is downstream of a page that was ` +
    `never served. An automated browser cannot clear this · the challenge never resolves for one.\n` +
    `FIX: this is configuration, not code. Serve the spec a custom domain (ssoProtection is ` +
    `all_except_custom_domains, and *.vercel.app is not one), or supply a protection-bypass secret ` +
    `for automation. Do NOT go looking for a deleted component.`
  )
}

/**
 * Assert a navigation Response is the app and not a protection wall.
 *
 * This is the PREFERRED entry point, because a Response carries the status and headers that make the
 * diagnosis certain. Use it wherever a spec keeps its goto() result:
 *     const res = await page.goto('/lobby')
 *     assertDeploymentReachable(res, { context: 'flow-mode' })
 *
 * @param {?import('@playwright/test').Response} response
 * @param {{context?: string}} [opts]
 */
export function assertDeploymentReachable(response, { context = '' } = {}) {
  if (!response) return
  const diagnosis = diagnoseDeploymentProtection({
    status: response.status(),
    headers: response.headers(),
    // Body is only consulted for the marker cases; a header/status hit short-circuits before this.
    body: '',
  })
  if (diagnosis) throw new Error(deploymentProtectionMessage(diagnosis, { context, url: response.url() }))
}

/**
 * Best-effort probe for specs that did NOT keep their navigation Response · which is all of them.
 *
 * Re-requests the page's own URL from inside the browser (same-origin, so every response header is
 * readable) and diagnoses that. Deliberately total: any failure here returns null so the caller falls
 * back to its existing diagnosis. A probe that can throw would replace a correct message with its own
 * crash, which is the exact failure mode this whole file exists to prevent.
 *
 * @returns {Promise<?string>} the message, or null if this is not a protection wall
 */
export async function probeDeploymentProtection(page, { context = '' } = {}) {
  try {
    const url = page.url()
    if (!/^https?:/i.test(url)) return null // about:blank et al · nothing to ask
    const res = await page.evaluate(async () => {
      const r = await fetch(location.href, { cache: 'no-store', redirect: 'manual' })
      const headers = {}
      r.headers.forEach((v, k) => { headers[k] = v })
      return { status: r.status, headers, body: (await r.text()).slice(0, 4000) }
    })
    const diagnosis = diagnoseDeploymentProtection(res)
    return diagnosis ? deploymentProtectionMessage(diagnosis, { context, url }) : null
  } catch {
    return null
  }
}

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
    // BEFORE blaming the bundle · a deployment-protection wall produces this exact symptom (our JS
    // never runs, so the attribute is never published) and "check the dev server" would be a wrong
    // instruction delivered with confidence. Ask the deployment what it actually served (T3 S31).
    const blocked = await probeDeploymentProtection(page, { context })
    if (blocked) throw new Error(blocked)

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
