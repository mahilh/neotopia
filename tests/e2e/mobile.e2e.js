// NeoTopia · mobile portrait (375px) guard. Uses SOLO /game (no roomId → GameRoom self-inits a local game ·
// App.jsx "solo dev entry"), so it needs NO Supabase / no anon sign-in — fast, deterministic, rate-limit-free,
// CI-cheap. Selectors verified live: board svg[role="img"], factory data-testid="factory", end-turn
// data-testid="end-turn-btn", GameRoom root data-game-phase.
//
// HISTORY · S15 measured the gap (288px desktop sidebar squeezed the board to 55px → 5px factories · routed
// to T1). S16: T1 b810a6a stacked the sidebar UNDER the board at <=600px → board 343px wide at 375px → board-width
// became a HARD GATE; the factory tap target was still 32px so it stayed MEASURED (routed to T1). S17: T1 2086628
// added a transparent SVG hit-circle (FACTORY_HIT_R=70 · overlap-safe) → the factory tap target now measures 58px
// at 375px → the MEASURE promised since S15 is FLIPPED to a HARD GATE (the fix is committed + clean-tree verified +
// screenshot-confirmed · Rule 34/55/63: a skip is a pause · gate it the moment the fix lands IN THE LOG).
//
// WHAT IS GATED (honest · Rule 63 · re-evaluated S17 · all hold today, each guards a real regression):
//   game loads + renders at 375px · BOARD WIDTH >= 200px (T1 b810a6a) · NO horizontal scroll · FACTORY touch
//   target >= 44px (T1 2086628 · was 32px). The factory gate flipped this session once T1's fix was committed —
//   gating it while T1's fix was still an UNCOMMITTED working-tree change would have wedged CI red (CI runs against
//   origin · the committed tree), which is exactly why S16 correctly kept it MEASURED until the commit landed.

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

      // ── HARD GATE · factory touch target >= 44px (Rule 4). T1 2086628 (S17) added a transparent SVG hit-circle
      // (FACTORY_HIT_R=70 · overlap-safe · 108-unit gap to the nearest region hex) → the factory tap target measures
      // 58px at 375px (was 32px · committed + clean-tree + screenshot-verified Rule 55). The S15 promise is now a
      // GATE: a regression that shrinks the tap target back under 44px (a removed hit-circle / viewBox change) trips
      // here. data-testid="factory" sits on the enlarged hit area (the boundingBox IS the tap-target witness · the
      // circle is fill:transparent so a pixel screenshot can't show it · the measured box is the honest witness).
      const fBox = await page.locator('[data-testid="factory"]').first().boundingBox()
      const factoryTouch = fBox ? Math.round(Math.max(fBox.width, fBox.height)) : 0
      console.log('[mobile-375] board:', JSON.stringify({ w: Math.round(boardBox.width), h: Math.round(boardBox.height) }),
        '· factories:', factoryCount, '· factory-touch:', factoryTouch + 'px (gate >=' + TOUCH_MIN + ')',
        '· overflow:', JSON.stringify(overflow))
      expect(factoryTouch, `factory touch target ${factoryTouch}px < ${TOUCH_MIN}px at 375px (Rule 4 · T1's hit-circle regressed?)`).toBeGreaterThanOrEqual(TOUCH_MIN)
    } finally {
      await ctx.close()
    }
  })
})
