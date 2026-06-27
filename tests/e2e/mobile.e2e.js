// NeoTopia · mobile portrait (375px) guard (T3 S15). Uses SOLO /game (no roomId → GameRoom self-inits a
// local game · App.jsx "solo dev entry"), so it needs NO Supabase / no anon sign-in — fast, deterministic,
// rate-limit-free, CI-cheap. Selectors verified live (S15): board svg[role="img"], factory
// data-testid="factory", end-turn data-testid="end-turn-btn", GameRoom root data-game-phase.
//
// WHAT IS GATED vs MEASURED (honest · T3 S15):
//   HARD GATE  — the game LOADS and RENDERS at 375px: the board has real layout, ≥1 factory is present,
//                the end-turn control is in the DOM. This catches a real regression (a future change that
//                white-screens or hides the board on mobile).
//   MEASURED   — mobile USABILITY: the factory touch-target size and horizontal overflow. As of S15 the
//                in-game layout is NOT mobile-usable — the 288px desktop sidebar squeezes the board to ~87px
//                so each hex/factory renders ~5px (well under the 44px touch min · rule 4). That is a T1
//                layout gap (make /game responsive: stack the sidebar below the board at narrow widths),
//                routed in comms. We MEASURE + LOG it (not hard-gate) so the suite is green today and the
//                metric is tracked; once T1 ships a responsive layout, the 44px line flips to a hard gate.

import { test, expect } from '@playwright/test'

const BOARD = 'svg[role="img"]'
const TOUCH_MIN = 44

test.describe('mobile portrait (375px · solo /game)', () => {

  test('the game loads and renders on a 375px screen (mobile-readiness measured)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true })
    const page = await ctx.newPage()
    try {
      await page.goto('/game')                          // solo dev mode · local game · no auth/room needed
      await page.waitForSelector('[data-game-phase]', { timeout: 15_000 })

      // ── HARD GATES · the game loads + renders on mobile (a real white-screen/hidden-board regression guard)
      const boardBox = await page.locator(BOARD).boundingBox()
      expect(boardBox, 'board has no layout box at 375px (hidden/zero-size on mobile)').not.toBeNull()
      expect(boardBox.width).toBeGreaterThan(0)
      expect(boardBox.height).toBeGreaterThan(0)

      const factoryCount = await page.locator('[data-testid="factory"]').count()
      expect(factoryCount, 'no factories rendered at 375px').toBeGreaterThan(0)
      expect(await page.locator('[data-testid="end-turn-btn"]').count(), 'no end-turn control at 375px').toBeGreaterThanOrEqual(1)

      // ── MEASURED · mobile usability (logged · the metric T1 makes pass with a responsive layout)
      const fBox = await page.locator('[data-testid="factory"]').first().boundingBox()
      const factoryTouch = fBox ? Math.round(Math.max(fBox.width, fBox.height)) : 0
      const overflow = await page.evaluate(() => ({
        bodyScrollW: document.body.scrollWidth,
        innerW: window.innerWidth,
        horizontalScroll: document.body.scrollWidth > window.innerWidth + 2,
      }))
      const mobileReady = factoryTouch >= TOUCH_MIN && !overflow.horizontalScroll

      // HARD GATE · no horizontal scroll at 375px — a real mobile invariant that holds today (board shrinks
      // to fit rather than overflowing); catches a future change that pushes content past the viewport.
      expect(overflow.horizontalScroll, `horizontal overflow at 375px (body ${overflow.bodyScrollW}px > viewport ${overflow.innerW}px)`).toBe(false)

      console.log('[mobile-375] board:', JSON.stringify({ w: Math.round(boardBox.width), h: Math.round(boardBox.height) }),
        '· factories:', factoryCount, '· factory-touch:', factoryTouch + 'px (need ' + TOUCH_MIN + ')',
        '· overflow:', JSON.stringify(overflow), '· MOBILE-READY:', mobileReady)
      if (!mobileReady) {
        console.log('[mobile-375] GAP (→ T1): in-game /game is not mobile-usable yet · the 288px sidebar squeezes the',
          'board so factories render', factoryTouch + 'px (<44). Fix: stack sidebar below board at <=600px. Tracked · not gated.')
      }
    } finally {
      await ctx.close()
    }
  })
})
