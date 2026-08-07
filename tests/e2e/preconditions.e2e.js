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
import { assertBackendReachable, assertSessionEstablished, readHealth } from './preconditions'

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
