// NeoTopia · THE GATE'S OWN EVIDENCE · proving the precondition gates fire, and name the right layer (T3 S27).
//
// WHY THIS FILE EXISTS AT ALL. Rule 72, learned the hard way in S22: running a verifier once proves it
// EXECUTES, not that its verdict is SOUND. The gates in preconditions.js are themselves diagnostic code, and
// diagnostic code that is wrong is worse than none · it misdirects with authority. A gate wired into two
// nightly specs and never exercised would sit there for months looking like coverage.
//
// So this file does to the gate what the gate does to a spec: it manufactures the exact failure the gate
// claims to catch (the 07-27 outage) and asserts the gate produces the RIGHT SENTENCE. The assertions are on
// the MESSAGE, deliberately · the entire value of this work is diagnostic wording. A gate that throws the
// right error at the wrong time, or the wrong error at the right time, is a gate that has failed.
//
// The outage is simulated at the browser-context layer (same technique as backend-down.e2e.js) so this file
// is deterministic, needs no live backend, and can never be confused with a real incident. It still needs
// VITE_SUPABASE_* present for the DEV SERVER to boot · the values are never successfully used.
//
// CI: deterministic + offline-by-construction → merge-gating path, alongside backend-down.e2e.js.
// Run locally:  npx playwright test tests/e2e/preconditions.e2e.js

import { test, expect } from '@playwright/test'
import {
  assertBackendReachable, assertSessionEstablished, readHealth,
  diagnoseDeploymentProtection, assertDeploymentReachable,
} from './preconditions'

test.beforeEach(() => { test.setTimeout(90_000) })

const NAME_INPUT = 'Builder name (max 20)'

// Same interception shape as backend-down.e2e.js · matched on the parsed URL so it stays correct whatever
// the project ref is, and covers the websocket too (HTTP routing does not touch WebSockets).
function isBackendUrl(url) {
  const u = typeof url === 'string' ? new URL(url) : url
  return /(^|\.)supabase\.(co|in|net)$/.test(u.hostname) ||
         /\/(rest|auth|realtime|functions|storage)\/v1\//.test(u.pathname)
}

async function killBackend(context) {
  await context.route((url) => isBackendUrl(url), (route) => route.abort('connectionrefused'))
  await context.routeWebSocket((url) => isBackendUrl(url), (ws) => ws.close({ code: 1006 }))
}

// Capture the rejection without letting a PASS masquerade as one · if the gate resolves, that IS the bug.
async function captureThrow(fn, whatShouldHaveHappened) {
  let err = null
  try { await fn() } catch (e) { err = e }
  expect(err, whatShouldHaveHappened).not.toBeNull()
  return String(err.message ?? err)
}

test.describe('the precondition gate · fires on an outage, and blames the right layer', () => {
  test('assertBackendReachable reports the OUTAGE, not a missing element', async ({ page, context }) => {
    await killBackend(context)
    await page.goto('/lobby')

    const msg = await captureThrow(
      () => assertBackendReachable(page, { context: 'self-test' }),
      'the gate RESOLVED during a total outage · it would have let the spec run on and mis-report',
    )

    // The sentence a human reads at 3am. Each of these is load-bearing.
    expect(msg).toContain('BACKEND UNREACHABLE')
    expect(msg).toContain('not a feature regression') // the exact misreading this whole gate exists to stop
    expect(msg).toContain('offline')
    expect(msg).toContain('self-test')               // which spec, when several run in a nightly
    expect(msg).toMatch(/failing transport\s+= auth/) // WHICH pipe died · a UI can be specific, so can we

    // THE REGRESSION GUARD ON THE DIAGNOSIS ITSELF. On 07-27 the reported error named a component. If this
    // gate's message ever starts naming one, the misdirection has simply moved one layer up.
    expect(msg).not.toContain('mode-flow')
    expect(msg).not.toContain('data-testid')
  })

  test('the reported cause is the REAL one, carried from the transport that failed', async ({ page, context }) => {
    await killBackend(context)
    await page.goto('/lobby')

    const msg = await captureThrow(() => assertBackendReachable(page), 'gate did not fire')

    // Not a generic "something went wrong" · the aggregator's own reason string is threaded through, which is
    // what let the S26 triage tell a DNS failure apart from a rate limit. Both end in a failed sign-in and an
    // absent element; only the error's own words distinguish them.
    const health = await readHealth(page)
    expect(health.reason).toBeTruthy()
    expect(msg).toContain(health.reason)
  })

  test('assertSessionEstablished names the MISSING SESSION · the precondition 07-27 actually violated', async ({ page, context }) => {
    await killBackend(context)
    await page.goto('/lobby')

    const msg = await captureThrow(
      () => assertSessionEstablished(page, page.getByPlaceholder(NAME_INPUT), { context: 'self-test' }),
      'the session gate RESOLVED with no session · every downstream locator would then fail misleadingly',
    )

    // It may exit through either door · the fast backend check or the disabled name field. Both are correct
    // and both must name a LAYER rather than a widget, so the assertion accepts either sentence.
    expect(msg).toMatch(/NO SESSION|BACKEND UNREACHABLE/)
    expect(msg).not.toContain('mode-flow')
  })

  test('a dead app boot is its OWN diagnosis · not reported as a backend outage', async ({ page }) => {
    // Three different layers can break here and they must not be conflated: the app not booting at all, the
    // backend being unreachable, and a genuine feature regression. A page that never runs NeoTopia's JS
    // never publishes html[data-backend-status], and the gate must say exactly that.
    await page.goto('about:blank')

    const msg = await captureThrow(
      () => assertBackendReachable(page, { bootTimeoutMs: 2_000, context: 'self-test' }),
      'the gate resolved on a page where the app never ran',
    )

    expect(msg).toContain('never booted')
    expect(msg).toContain('NOT a feature regression')
    expect(msg).not.toContain('BACKEND UNREACHABLE') // a different layer · a different sentence
  })

  test('the gate is not a rubber stamp · it does NOT fire merely because a spec called it', async ({ page, context }) => {
    // The counterweight to every test above. A gate that always throws would pass all of them and be
    // worthless · worse than worthless, since it would red the nightly for no reason. Here the backend is
    // dead but the health module has NOT yet reported it (the failure needs a rejected sign-in to arrive),
    // so a gate that watches over time must still be quiet in the very first instant.
    await killBackend(context)
    await page.goto('/lobby')

    // settleMs of 0 · the loop body never runs, so this can only pass if the gate genuinely samples over a
    // window rather than throwing on principle.
    await assertBackendReachable(page, { settleMs: 0, context: 'self-test' })

    // And with a real window, the same page DOES fire · same page, same outage, different observation time.
    // That contrast is the proof the gate's verdict tracks evidence rather than its own existence.
    const msg = await captureThrow(
      () => assertBackendReachable(page, { settleMs: 8_000 }),
      'gate never fired even with a full settle window',
    )
    expect(msg).toContain('BACKEND UNREACHABLE')
  })
})

// ── THE FOURTH LAYER · deployment protection (T3 S31) ────────────────────────────────────────────
// A WAF or SSO wall in front of the deployment produces the SAME downstream symptom as a broken
// bundle — NeoTopia's JS never runs, so html[data-backend-status] is never published — and the
// existing gate would confidently answer "check the dev server, the bundle and the console", sending
// a reader after three things that are all fine. Same misdirection as 07-27, one layer further out.
//
// The wall is simulated by fulfilling EVERY request from the context, which is what a WAF actually
// does: it blocks the origin, not one document. So these tests need no deployment, no network and no
// anonymous sign-in, and can never be confused with a real incident.

async function serveWall(context, { status, headers, body }) {
  await context.route('**/*', route => route.fulfill({
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body,
  }))
}

const CHALLENGE_HTML = '<html><head><title>Just a moment…</title></head><body>Verifying your browser…</body></html>'
const SSO_HTML = '<html><body>Authentication Required · <a href="https://vercel.com/sso-api?url=x">continue</a></body></html>'

test.describe('the precondition gate · a protected deployment is not a broken bundle', () => {
  test('a bot challenge reports itself as DEPLOYMENT PROTECTION, not as a dead app boot', async ({ page, context }) => {
    await serveWall(context, {
      status: 403, headers: { 'x-vercel-mitigated': 'challenge' }, body: CHALLENGE_HTML,
    })
    await page.goto('/lobby')

    const msg = await captureThrow(
      () => assertBackendReachable(page, { bootTimeoutMs: 4_000, context: 'self-test' }),
      'the gate RESOLVED behind a WAF challenge · the spec would have run on and blamed a locator',
    )

    // The sentence. Every clause below is load-bearing and was chosen because a reader acts on it.
    expect(msg).toContain('BLOCKED BY VERCEL DEPLOYMENT PROTECTION')
    expect(msg).toContain('not a feature regression')
    expect(msg).toContain('not a backend outage')   // it excludes the OTHER wrong answer too
    expect(msg).toContain('x-vercel-mitigated: challenge') // the witness, quoted verbatim (Rule 39)
    expect(msg).toContain('custom domain')          // the actual fix · configuration, not code
    expect(msg).toContain('self-test')

    // THE REGRESSION GUARD. These are the two confident-but-wrong instructions this test exists to
    // stop being printed: go debug your bundle, or go find the missing component.
    expect(msg).not.toContain('never booted')
    expect(msg).not.toContain('check the dev server')
    expect(msg).not.toContain('data-testid')
  })

  test('SSO protection is named as SSO · a different wall gets a different sentence', async ({ page, context }) => {
    await serveWall(context, { status: 401, headers: {}, body: SSO_HTML })
    await page.goto('/lobby')

    const msg = await captureThrow(
      () => assertBackendReachable(page, { bootTimeoutMs: 4_000 }),
      'the gate resolved behind an SSO wall',
    )
    expect(msg).toContain('BLOCKED BY VERCEL DEPLOYMENT PROTECTION')
    expect(msg).toContain('SSO / password protection')
    expect(msg).not.toContain('bot challenge')  // the two are told apart, not lumped together
  })

  test('a HEALTHY page is not accused · the response check is silent when the app is served', async ({ page }) => {
    // The counterweight to both tests above, and the one that makes them mean anything: a gate that
    // cried "protected" on every navigation would satisfy every assertion here and red the suite.
    const res = await page.goto('/lobby')
    expect(() => assertDeploymentReachable(res, { context: 'self-test' })).not.toThrow()
    // …and the ordinary gate still reaches its ordinary verdict on the same page.
    await assertBackendReachable(page, { settleMs: 0, context: 'self-test' })
  })

  test('the detector does not mistake OUR OWN 403 for a WAF', async () => {
    // The likeliest false positive in this codebase by a wide margin. Postgres denials arrive as 403
    // constantly (RLS, column grants · migration 017 revoked INSERT/UPDATE on player_profiles), and
    // reporting one of those as "deployment protection" would send a reader to the Vercel dashboard
    // to debug a database permission. A bare status is NOT evidence · body markers are required.
    expect(diagnoseDeploymentProtection({
      status: 403, headers: { 'content-type': 'application/json' },
      body: '{"message":"permission denied for table player_profiles","code":"42501"}',
    })).toBeNull()

    expect(diagnoseDeploymentProtection({ status: 429, headers: {}, body: '{"msg":"Request rate limit reached"}' }))
      .toBeNull() // the anon sign-in rate limit · a real and frequent 429 that is not a mitigation
    expect(diagnoseDeploymentProtection({ status: 200, headers: {}, body: '<div id="root"></div>' })).toBeNull()
    expect(diagnoseDeploymentProtection({})).toBeNull()

    // And it DOES fire on the real shapes · otherwise the four nulls above are just a broken detector.
    expect(diagnoseDeploymentProtection({ status: 403, headers: { 'X-Vercel-Mitigated': 'challenge' }, body: '' }))
      .toMatchObject({ kind: 'challenge' })          // header match is case-insensitive
    expect(diagnoseDeploymentProtection({ status: 708, headers: {}, body: '' }))
      .toMatchObject({ kind: 'challenge' })          // the challenge endpoint's own status (T1, live)
    expect(diagnoseDeploymentProtection({ status: 401, headers: {}, body: SSO_HTML }))
      .toMatchObject({ kind: 'sso' })
  })
})
