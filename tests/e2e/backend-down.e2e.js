// NeoTopia · BACKEND-DOWN degradation proof (T3 S26 · forge TASK 2).
//
// THE FAILURE CLASS THIS CLOSES · it had literally zero coverage, which is why it shipped:
// with Supabase unreachable the app failed INVISIBLY-BUT-LOUDLY. The console filled with network errors
// (useGameSync retried a dead channel every fixed 1000ms, forever) while the UI rendered a perfectly normal
// lobby: useAuth computed an `authError` that NO consumer read (Lobby.jsx destructures user/username/
// isLoading/isClaimed/claimUsername and never authError), flipped isLoading to false, and showed
// "Choose your name". A player typed a name into a screen that could never work, and nothing on the page ·
// or in any test · ever said the civilization was unreachable.
//
// Every prior E2E in this directory assumes a REACHABLE backend. This one asserts the opposite: that the app
// tells the truth when the backend is gone, and that it stops shouting at a server that is not answering.
//
// SIMULATED, NOT EXPERIENCED (the forge was explicit that Supabase is healthy): the outage is manufactured by
// aborting every Supabase request at the browser-context layer, so this test is fully deterministic, needs no
// live backend, and can never be confused with a real incident. It still needs VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY present for the DEV SERVER to boot (src/lib/supabase.js throws without them) · the
// values are never successfully used, because every request to them is blocked.
//
// DIVISION OF EVIDENCE (Rule 33/63 · prove each claim where the proof is strongest):
//   · "retries back off and TERMINATE" → src/hooks/useGameSync.reconnect.test.js, with fake timers, asserts
//     the exact schedule (1s·2s·4s·8s·16s·30s), the exact attempt count, and vi.getTimerCount() === 0 after
//     give-up. A wall-clock browser assertion would be strictly weaker AND flakier, so it is not duplicated
//     here. What this file adds at the browser layer is the ANTI-STORM regression guard: once the app has
//     given up, its request count to the dead host must stop growing.
//   · "degrades visibly instead of looking healthy" → this file.
//
// THE WITNESS · html[data-backend-status], written by src/hooks/useConnectionHealth.js. It is deliberately a
// root-element attribute rather than a component: it exists whether or not a banner has been built, it doubles
// as the CSS hook a degraded style hangs off, and it satisfies Rule 50 (a testid on a permanently-mounted
// element proves nothing about state · assert the attribute that FLIPS). The pixel-level banner is a render-lane
// deliverable; the last test here activates automatically the moment that lane ships a [data-testid=
// "backend-degraded"] element, and reports honestly (rather than passing silently) until then.
//
// CI: deterministic + offline-by-construction · belongs on the merge-gating path, not the live-nightly one.
// Run locally:  npx playwright test tests/e2e/backend-down.e2e.js

import { test, expect } from '@playwright/test'

// The whole point is waiting out a give-up; the default 60s is not enough headroom.
test.beforeEach(() => { test.setTimeout(120_000) })

const HEALTH = 'html[data-backend-status]'

// Every host the app talks to for data. Matching on the parsed URL (not a glob) keeps this correct whatever
// the project ref is, and covers self-hosted / custom-domain Supabase too. Accepts either a URL or a string
// because the HTTP and WebSocket route predicates are not guaranteed to hand over the same shape.
function isBackendUrl(url) {
  const u = typeof url === 'string' ? new URL(url) : url
  return /(^|\.)supabase\.(co|in|net)$/.test(u.hostname) ||
         /\/(rest|auth|realtime|functions|storage)\/v1\//.test(u.pathname)
}

/**
 * Take the backend away. Aborts matching HTTP and closes matching WebSockets, and counts every attempt so a
 * test can prove the app stopped knocking. Returns { count(), restore() }.
 */
async function killBackend(context) {
  let attempts = 0

  await context.route(
    (url) => isBackendUrl(url),
    (route) => { attempts += 1; return route.abort('connectionrefused') },
  )

  // HTTP routing does not touch WebSockets · realtime needs its own interception or the socket would still
  // reach a healthy Supabase and the "outage" would be only half simulated.
  await context.routeWebSocket(
    (url) => isBackendUrl(url),
    (ws) => { attempts += 1; ws.close({ code: 1006 }) },
  )

  return {
    count: () => attempts,
    restore: async () => { await context.unrouteAll({ behavior: 'ignoreErrors' }) },
  }
}

const readHealth = (page) => page.evaluate(() => window.__neotopia_health ?? null)

test.describe('backend unreachable · the app must degrade, not pretend', () => {
  test('the lobby reports a degraded backend instead of rendering a healthy name screen', async ({ page, context }) => {
    const backend = await killBackend(context)

    await page.goto('/lobby')

    // The anonymous sign-in cannot complete, so the app must SAY SO. Pre-fix this stayed silent forever and
    // the name screen appeared as if everything were fine.
    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'offline', { timeout: 30_000 })

    const health = await readHealth(page)
    expect(health).not.toBeNull()          // the gray-box snapshot other tooling reads
    expect(health.isDegraded).toBe(true)
    expect(health.isOffline).toBe(true)
    expect(health.source).toBe('auth')     // names WHICH transport failed · a UI can be specific
    expect(health.reason).toBeTruthy()     // carries a real message, not an empty object

    // Sanity: the outage really was simulated (requests were made and blocked), so a passing assertion can
    // never be an artefact of the app simply never calling the backend.
    expect(backend.count()).toBeGreaterThan(0)
  })

  test('a game route degrades too · the realtime channel is not silently dead', async ({ page, context }) => {
    const backend = await killBackend(context)

    // A game URL mounts useGameSync with a roomId, so the realtime channel is exercised as well as auth.
    // The room need not exist · subscribing is what fails, and that is the path under test.
    await page.goto('/game/00000000-0000-4000-8000-000000000000')

    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'offline', { timeout: 45_000 })
    expect(backend.count()).toBeGreaterThan(0)

    // ANTI-STORM · this is the browser-layer regression guard on the old fixed-1000ms forever loop. Once the
    // app has given up, its knocking on a dead host must STOP. The old code would have added roughly one
    // reconnect per second (two, while both failure signals each scheduled their own timer).
    const settled = backend.count()
    await page.waitForTimeout(15_000)
    const after = backend.count()

    // A small allowance, not zero: an unrelated in-flight request may still land in the first moments after
    // the give-up. What must NOT happen is unbounded growth · 15 seconds of the old behaviour was ~15-30.
    expect(after - settled).toBeLessThanOrEqual(3)
  })

  test('giving up is not a dead end · regaining network makes the app try again', async ({ page, context }) => {
    // A terminal offline state with NO way out would be a worse bug than the storm it replaced: the storm at
    // least reconnected eventually. So the give-up must be paired with an escape hatch, and this proves the
    // hatch fires.
    //
    // It deliberately asserts the app KNOCKS AGAIN rather than that it comes back ONLINE. Asserting a real
    // recovery would require a genuinely successful anonymous sign-in against live Supabase, which drags a
    // deterministic offline test onto the live path and straight into the per-IP anon rate limit that already
    // forced this suite's live tests to nightly (seedHelpers.signInAnonRetry exists for exactly that). The
    // backend stays blocked here; "a new attempt was made" is the whole claim, and it is the falsifiable one.
    // The completing half · a successful reconnect clearing the flag AND restoring the full retry budget · is
    // proven deterministically in useGameSync.reconnect.test.js.
    const backend = await killBackend(context)
    await page.goto('/lobby')
    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'offline', { timeout: 30_000 })

    // Settle: confirm the app really has stopped on its own before testing that something restarts it.
    await page.waitForTimeout(3_000)
    const settled = backend.count()
    await page.waitForTimeout(5_000)
    expect(backend.count()).toBe(settled) // genuinely dormant · not merely slow

    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    await expect.poll(() => backend.count(), {
      timeout: 15_000,
      message: 'regaining network did not make the app re-attempt · the offline state is a dead end',
    }).toBeGreaterThan(settled)

    // Still blocked, so it must fall straight back to the terminal state rather than hang in "reconnecting"
    // or claim health it does not have.
    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'offline', { timeout: 30_000 })
  })

  test('the degraded state is RENDERED, not merely recorded (the composed cross-lane behaviour)', async ({ page, context }) => {
    // THE COMPOSED-VALUE CHECK (Rule 65 · "both lanes shipped their half" is exactly when the composed bug
    // hides). The hooks lane detects the outage and publishes it; the render lane maps that snapshot to what
    // the lobby draws (src/utils/backendStatus.js → deriveBackendStatus, rendered by Lobby's BackendBanner
    // as data-testid="backend-<tone>"). Neither half is the feature. This asserts the JOIN: an outage
    // detected by useConnectionHealth actually reaches a human's eyes.
    //
    // The testid is tone-derived, so the offline tone renders "backend-offline" · asserting a guessed name
    // here would have skipped forever while the banner was live, which is the whole trap this test exists to
    // avoid falling into.
    const backend = await killBackend(context)
    await page.goto('/lobby')
    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'offline', { timeout: 30_000 })
    expect(backend.count()).toBeGreaterThan(0)

    const banner = page.locator('[data-testid="backend-offline"]')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    // A banner that says nothing is not a degraded UI · it must actually tell the player something.
    await expect(banner).not.toBeEmpty()

    // And the terminal state must offer a way out on screen, not only on the API surface.
    await expect(page.locator('[data-testid="backend-retry"]')).toBeVisible()
  })
})
