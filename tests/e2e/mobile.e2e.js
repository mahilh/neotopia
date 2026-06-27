// NeoTopia · mobile portrait (375px) guard. Uses SOLO /game (no roomId → GameRoom self-inits a local game ·
// App.jsx "solo dev entry"), so it needs NO Supabase / no anon sign-in — fast, deterministic, rate-limit-free,
// CI-cheap. Selectors verified live: board svg[role="img"], factory data-testid="factory", end-turn
// data-testid="end-turn-btn", GameRoom root data-game-phase.
//
// HISTORY · S15 measured the gap (288px desktop sidebar squeezed the board to 55px → 5px factories · routed
// to T1). S16: T1 b810a6a stacked the sidebar UNDER the board at <=600px → the board is now 343px wide at
// 375px (verified · screenshot-confirmed). So this session UPGRADES the board-width line from a soft measure
// to a HARD GATE (Rule 63: gate it now that it is true · it protects the responsive layout from regression).
//
// WHAT IS GATED vs MEASURED (honest · Rule 63 · re-evaluated S16):
//   HARD GATE  — game loads + renders at 375px · BOARD WIDTH >= 200px (T1's responsive fix · was 55px) ·
//                no horizontal scroll. These all hold today; each guards a real regression.
//   MEASURED   — the FACTORY touch target. T1's fix lifted it 5px → ~32px, but it is still < the 44px touch
//                minimum (Rule 4): the sidebar no longer steals width, yet the 343px board's hex cells still
//                render ~32px. Residual is the on-board hex SIZE, not the sidebar. MEASURED + routed to T1 (not
//                gated · the suite stays honest-green). Flip to a hard gate once a hex/board scale lifts it >=44.

import { test, expect } from '@playwright/test'

const BOARD = 'svg[role="img"]'
const TOUCH_MIN = 44
const BOARD_MIN = 200 // T1 b810a6a · responsive /game · the board must keep real width on mobile (was 55px · now 343px)

test.describe('mobile portrait (375px · solo /game)', () => {

  test('the game renders a real-width board at 375px (responsive layout guard)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true })
    const page = await ctx.newPage()
    try {
      await page.goto('/game')                          // solo dev mode · local game · no auth/room needed
      await page.waitForSelector('[data-game-phase]', { timeout: 15_000 })

      // ── HARD GATES ──────────────────────────────────────────────────────────────────────────────────
      const boardBox = await page.locator(BOARD).boundingBox()
      expect(boardBox, 'board has no layout box at 375px (hidden/zero-size on mobile)').not.toBeNull()
      expect(boardBox.height).toBeGreaterThan(0)
      // Board width >= 200px · T1's responsive fix (b810a6a). A regression that re-collapses the board (the old
      // 55px sidebar-squeeze) trips this. This is the line S15 promised to flip to a hard gate once T1 shipped.
      expect(Math.round(boardBox.width), `board too narrow at 375px (${Math.round(boardBox.width)}px < ${BOARD_MIN}) — responsive layout regressed?`).toBeGreaterThanOrEqual(BOARD_MIN)

      const factoryCount = await page.locator('[data-testid="factory"]').count()
      expect(factoryCount, 'no factories rendered at 375px').toBeGreaterThan(0)
      expect(await page.locator('[data-testid="end-turn-btn"]').count(), 'no end-turn control at 375px').toBeGreaterThanOrEqual(1)

      const overflow = await page.evaluate(() => ({
        bodyScrollW: document.body.scrollWidth,
        innerW: window.innerWidth,
        horizontalScroll: document.body.scrollWidth > window.innerWidth + 2,
      }))
      // No horizontal scroll at 375px — holds today (content fits the viewport); guards a future overflow.
      expect(overflow.horizontalScroll, `horizontal overflow at 375px (body ${overflow.bodyScrollW}px > viewport ${overflow.innerW}px)`).toBe(false)

      // ── MEASURED · factory touch target (still < 44px after T1's sidebar fix · Rule 63: track, don't fake-gate)
      const fBox = await page.locator('[data-testid="factory"]').first().boundingBox()
      const factoryTouch = fBox ? Math.round(Math.max(fBox.width, fBox.height)) : 0
      console.log('[mobile-375] board:', JSON.stringify({ w: Math.round(boardBox.width), h: Math.round(boardBox.height) }),
        '· factories:', factoryCount, '· factory-touch:', factoryTouch + 'px (need ' + TOUCH_MIN + ')',
        '· overflow:', JSON.stringify(overflow))
      if (factoryTouch < TOUCH_MIN) {
        console.log('[mobile-375] RESIDUAL (→ T1): board is now', Math.round(boardBox.width) + 'px (fixed · was 55px), but the',
          'on-board hex/factory still renders', factoryTouch + 'px (<44). The sidebar is no longer the cause — a hex/board',
          'scale bump on mobile would lift the touch target. MEASURED · not gated (Rule 63 · honest-green).')
      }
    } finally {
      await ctx.close()
    }
  })
})
