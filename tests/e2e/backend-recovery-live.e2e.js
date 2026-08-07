// NeoTopia · REAL RETURN-TO-ONLINE · the honest half of the recovery claim (T3 S27).
//
// THE GAP THIS CLOSES, quoted from my own S26 close so it is not laundered into a feature:
//   "the backend-down recovery E2E proves the app RE-ATTEMPTS after regaining network, not that it returns
//    to ONLINE. The return-to-online half is proven deterministically in useGameSync.reconnect.test.js;
//    closing it in the browser needs a live-class test."
// backend-down.e2e.js asserts the app knocks again. That is true and falsifiable, and it is strictly weaker
// than the thing a player cares about, which is that the game comes back.
//
// WHY THIS COULD NOT LIVE IN THE DETERMINISTIC FILE. Coming back ONLINE requires something real to answer.
// With every request aborted there is nothing to recover TO, and faking a successful anonymous sign-in means
// forging a JWT the client will decode · a test asserting against its own mock. So the recovery half needs a
// live backend, and a live backend means the nightly path (per-IP anon rate limits are why the live specs are
// nightly at all · seedHelpers.signInAnonRetry exists for exactly that).
//
// THE DESIGN THAT KEEPS IT CHEAP · kill ONE transport, not all of them.
// Only the realtime WEBSOCKET is blocked. HTTP (auth + REST) is left alone, so this costs exactly ONE
// anonymous sign-in · the same as any other live spec, not a new burden. That also makes the assertion
// sharper rather than weaker:
//   · useConnectionHealth is worst-wins across sources. Auth stays ONLINE throughout; 'game-sync' is the
//     source that dies and the source that must recover. So the aggregate returning to 'online' can ONLY
//     mean the realtime channel genuinely re-subscribed · nothing else could have cleared it.
//   · it exercises the S27 seed change end to end: on recovery the channel SUBSCRIBEs and then seeds a room
//     that does not exist. maybeSingle returns no row, which is HEALTHY (a lobby before Start looks exactly
//     like this), so the hook must report UP. Had "no row" been treated as a seed failure, this test could
//     never go green · it is the browser-layer guard on that false positive.
//
// CI: live · nightly (e2e-live-nightly.yml), NOT the merge gate. Run locally:
//   npx playwright test tests/e2e/backend-recovery-live.e2e.js

import { test, expect } from '@playwright/test'
import { loadEnv } from './seedHelpers'

let ENV = null
try { ENV = loadEnv() } catch { /* no creds · skip · this is a live-class spec */ }

const HEALTH = 'html[data-backend-status]'
const readHealth = (page) => page.evaluate(() => window.__neotopia_health ?? null)

// A room that does not exist. Subscribing is what is under test, and a postgres_changes filter on an absent
// room_id subscribes perfectly well · so no fixture room is created and none needs cleaning up.
const ABSENT_ROOM = '/game/00000000-0000-4000-8000-000000000000'

function isRealtimeUrl(url) {
  const u = typeof url === 'string' ? new URL(url) : url
  return /(^|\.)supabase\.(co|in|net)$/.test(u.hostname) && /\/realtime\/v1/.test(u.pathname)
}

/**
 * A realtime socket with a switch on it.
 *
 * NOT built with route-then-unroute, and that is a correctness point rather than a style one:
 * context.unrouteAll() removes handlers registered with context.route(), and does NOT remove a
 * routeWebSocket handler. Written the obvious way, the "restored" backend stays blocked, the channel never
 * re-subscribes, and the test fails at the last assertion while looking exactly like a product bug · which
 * is precisely how the first draft of this file failed. (Rule 60 · a tool's contract is part of the premise;
 * Rule 57 · tell a harness fault apart from a product fault before believing either.)
 *
 * So the handler stays registered for the whole test and its BEHAVIOUR changes: while blocked it closes the
 * socket, and once restored it proxies to the real Supabase via connectToServer(). Same interception path
 * throughout, one variable, no reliance on teardown semantics.
 */
async function switchableRealtime(context) {
  let blocked = true
  let attempts = 0

  await context.routeWebSocket((url) => isRealtimeUrl(url), (ws) => {
    attempts += 1
    if (blocked) { ws.close({ code: 1006 }); return }
    ws.connectToServer() // transparent passthrough · messages are forwarded both ways
  })

  return {
    attempts: () => attempts,
    restore: () => { blocked = false },
  }
}

// The full backoff ladder is 1+2+4+8+16+30 ≈ 61s before the hook gives up, then the recovery round trip.
test.beforeEach(() => { test.setTimeout(240_000) })

test.describe('backend recovery · the app actually comes BACK, not merely tries again', () => {
  test('a dead realtime channel goes offline, then returns to ONLINE once the socket is reachable', async ({ page, context }) => {
    test.skip(!ENV, 'no Supabase creds (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) · nightly-class live test')

    // ── 1 · take ONLY realtime away. Auth and REST keep working, so a session is established normally.
    const realtime = await switchableRealtime(context)

    await page.goto(ABSENT_ROOM)

    // ── 2 · the channel burns its budget and gives up. This is the terminal state · the one the S26 work
    // deliberately introduced, and the one that would be a WORSE bug than the storm it replaced if it had
    // no way out.
    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'offline', { timeout: 120_000 })

    const down = await readHealth(page)
    expect(down.isOffline).toBe(true)
    // The failing source must be the realtime channel · if 'auth' had died too, the recovery below would be
    // proving something else entirely and the single-transport design of this test would be a fiction.
    expect(down.source).toBe('game-sync')
    expect(realtime.attempts()).toBeGreaterThan(0) // the outage was really simulated, not merely assumed

    // Genuinely dormant before we test that something restarts it (otherwise "it reconnected" could just be
    // the ladder still running).
    const settled = realtime.attempts()
    await page.waitForTimeout(5_000)
    expect(realtime.attempts()).toBe(settled)

    // ── 3 · the backend comes back · the socket now proxies through to real Supabase.
    realtime.restore()
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    // ── 4 · THE CLAIM · not "it knocked again", but "it is online". Worst-wins across sources means this
    // can only clear if the realtime channel actually re-subscribed against the live backend.
    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'online', { timeout: 60_000 })

    const back = await readHealth(page)
    expect(back.status).toBe('online')
    expect(back.isDegraded).toBe(false)
    expect(back.isOffline).toBe(false)
    expect(back.source).toBeNull()   // nothing is the worst any more · not merely a less-bad worst
    expect(back.attempt).toBe(0)     // the budget was handed back · a later outage gets the full ladder
    expect(back.reason).toBeNull()   // no stale cause left hanging off a healthy snapshot
  })

  test('recovery is stable · it does not flap straight back into a degraded state', async ({ page, context }) => {
    test.skip(!ENV, 'no Supabase creds · nightly-class live test')

    // A "recovery" that reports online for one tick and immediately degrades again is not a recovery, and
    // an assertion that fires on the first matching sample cannot tell the two apart. The reconnect unit
    // test proves the budget resets; this proves the RESULT holds against a real socket.
    const realtime = await switchableRealtime(context)
    await page.goto(ABSENT_ROOM)
    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'offline', { timeout: 120_000 })

    realtime.restore()
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.locator(HEALTH)).toHaveAttribute('data-backend-status', 'online', { timeout: 60_000 })

    // Hold it. 15 seconds is longer than the whole early ladder (1+2+4+8 = 15s), so a channel that had
    // silently failed again would have re-reported degraded well inside this window.
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(3_000)
      const h = await readHealth(page)
      expect(h.status, `flapped back to ${h.status} (${h.reason}) after recovering`).toBe('online')
    }
  })
})
