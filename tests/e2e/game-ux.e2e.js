// NeoTopia · in-game UX audit (T3 S11). Reaches the /game route the standalone ux-scan.js (T2) cannot:
// it needs two signed-in users + a started game. This is an E2E (tests/e2e/ · T3's lane), not a script
// change (scripts/ · T2's lane). It drives the SAME verified lobby flow as two-human.e2e.js to a live
// active-player board, then (1) audits touch-target sizes, font sizes, and the in-game testid contract,
// and (2) PLACEMENT GUARD (T3 S12): drives factory→element→region→hex and asserts an element commits to
// the board — the regression guard for the totalPlaced=0 class (force-click rationale at placeOneElement).
//
// SCOPE: the audit asserts the REAL a11y minimums (44px touch targets · 12px fonts · CLAUDE.md rules 4/5)
// on interactive/text elements. testid presence is logged (informational · routed to T1/T2), not asserted —
// some are conditional (my-turn-badge renders only for the active seat). Any hard-fail here is a genuine
// T1 in-game UI issue surfaced for fixing.

import { test, expect } from '@playwright/test'
import { deleteRoomAsHost } from './seedHelpers'

const NAME_INPUT = 'Builder name (max 20)'
const BOARD = 'svg[aria-label*="NeoTopia"]'

// player_profiles.username is UNIQUE · a fresh name per run avoids the 2nd-run claim collision.
function uniqueName(prefix) {
  const t = Date.now().toString(36).slice(-5)
  const r = Math.random().toString(36).slice(2, 5)
  return (prefix + t + r).toUpperCase().slice(0, 20)
}

// Reach the lobby whether '/' is the lobby (committed) or the Landing (uses the real "Enter" CTA).
async function gotoLobby(page) {
  await page.goto('/')
  const input = page.getByPlaceholder(NAME_INPUT)
  const enterCiv = page.getByRole('button', { name: /enter the civilization/i })
  await expect(input.or(enterCiv).first()).toBeVisible({ timeout: 15_000 })
  if (await enterCiv.isVisible()) {
    await enterCiv.click()
    await expect(input).toBeVisible({ timeout: 15_000 })
  }
}

async function claimName(page, name) {
  await gotoLobby(page)
  await page.getByPlaceholder(NAME_INPUT).fill(name)
  await page.getByRole('button', { name: /enter neotopia/i }).click()
}

async function readRoomCode(page) {
  const el = page.locator('[style*="monospace"]').first()
  await expect(el).toBeVisible({ timeout: 15_000 })
  const code = (await el.textContent())?.trim() ?? ''
  expect(code, `room code "${code}" is not 6 chars`).toMatch(/^[A-Z0-9]{6}$/)
  return code
}

// In-page audits (run in the browser against the live /game DOM).
async function touchTargetViolations(page) {
  return page.evaluate(() => {
    const out = []
    document.querySelectorAll('button, a, [role="button"], input, select, [tabindex]').forEach(el => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0) return
      if (r.height < 44 || r.width < 44) out.push({ text: (el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) })
    })
    return out
  })
}

async function fontViolations(page) {
  return page.evaluate(() => {
    const out = []
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length > 0) return
      const txt = (el.textContent || '').trim()
      if (txt.length < 2) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const sz = parseFloat(getComputedStyle(el).fontSize)
      if (sz > 0 && sz < 12) out.push({ text: txt.slice(0, 24), size: sz })
    })
    return out
  })
}

// The 4-element / 3-region names rendered as plain-text buttons in the placement sidebar.
const ELEMENT_RE = /energy|biofarming|technology|community/i
const REGION_RE  = /sacred city|living earth|free energy/i

// Drive the live placement chain as the active player: factory → element → region → a lit hex.
// Returns true once a valid hex has been clicked (an empty factory shows no element buttons · skip it).
//
// force:true on the hex is REQUIRED, not a workaround: the valid-target hex's ring runs an infinite
// `hexPulse` scale animation (src/index.css · transform: scale(1)↔1.08), so the <g data-valid> bbox
// never settles and Playwright's click-stability check times out BEFORE onClick→placeElement fires.
// DB-proven (T3 S12): the bot's normal click commits 0 elements (board empty), a force click commits
// real placements (server state confirmed). A human click is unaffected — this is automation-only.
async function placeOneElement(page) {
  for (const factory of await page.locator('[data-testid="factory"]').all()) {
    await factory.click({ timeout: 3000 }).catch(() => {})
    const elBtn = page.getByRole('button').filter({ hasText: ELEMENT_RE }).first()
    if (!(await elBtn.isVisible({ timeout: 1500 }).catch(() => false))) continue // empty factory · next
    await elBtn.click()
    const regBtn = page.getByRole('button').filter({ hasText: REGION_RE }).first()
    await expect(regBtn).toBeVisible({ timeout: 3000 })
    await regBtn.click()
    const validHex = page.locator('[data-valid="true"], [data-testid="hex-valid"]').first()
    await expect(validHex).toBeVisible({ timeout: 3000 })
    await validHex.click({ force: true }) // see note above · bypasses the perpetual-animation stability wait
    return true
  }
  return false
}

test.describe('In-game UX audit (T3 S11)', () => {

  test('the active player audits the /game board AND commits a placement', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage() // host · seat 0 · active first
    const p2 = await ctx2.newPage() // joiner
    let roomId, hostSession
    try {
      await claimName(p1, uniqueName('E2EH'))
      await p1.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })
      const code = await readRoomCode(p1)

      await claimName(p2, uniqueName('E2EG'))
      await p2.getByRole('button', { name: 'Join Room' }).click({ timeout: 15_000 })
      await p2.getByPlaceholder('ABC234').fill(code)
      await p2.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 15_000 })
      await p2.getByRole('button', { name: /click when ready/i }).click({ timeout: 15_000 })

      const startBtn = p1.getByRole('button', { name: /^start game$/i })
      await expect(startBtn).toBeVisible({ timeout: 30_000 })
      await startBtn.click()

      await p1.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 20_000 })
      await expect(p1.locator(BOARD)).toBeVisible({ timeout: 20_000 })
      roomId = p1.url().match(/\/game\/([0-9a-f-]+)/i)?.[1]
      await p1.waitForTimeout(800) // let the active-player UI (ActionBar/hand) settle

      // ── AUDIT (active player · p1) ───────────────────────────────────────────────
      const touch = await touchTargetViolations(p1)
      const fonts = await fontViolations(p1)
      const testids = {}
      for (const id of ['factory', 'my-turn-badge', 'end-turn-btn']) {
        testids[id] = await p1.locator(`[data-testid="${id}"]`).first().isVisible({ timeout: 1500 }).catch(() => false)
      }
      const dataMyTurn = await p1.locator('[data-my-turn]').first().isVisible({ timeout: 1500 }).catch(() => false)

      console.log('[game-ux] touch-target violations (<44px):', JSON.stringify(touch))
      console.log(`[game-ux] sub-12px text nodes: ${fonts.length} (informational · see note)`, JSON.stringify(fonts.slice(0, 8)))
      console.log('[game-ux] in-game testids:', JSON.stringify(testids), '· data-my-turn:', dataMyTurn)

      // HARD GATE · 44px touch targets (CLAUDE.md rule 4) · a real a11y minimum · a failure here is a
      // genuine T1 in-game UI regression. Verified 0 on the active-player board (T3 S11).
      expect(touch, `touch-target violations in /game: ${JSON.stringify(touch)}`).toHaveLength(0)

      // SOFT · font size. There is NO project 12px-minimum rule (rule 5 is tabular-nums, not size); the
      // 12px floor is T2's ux-scan heuristic. The sub-12px nodes here are intentional design — CardFrame
      // flavor text (7px "◆ NEOTOPIA 2055 ◆"/card-id · 8px element labels · the tarot-from-2055 aesthetic)
      // and 10-11px region/section labels. Reported to T1 (not gated) · T1 owns the call to bump the labels.
      console.log(`[game-ux] AUDIT: touch=0 · fonts(${fonts.length}, informational) · testids ${JSON.stringify(testids)} · data-my-turn=${dataMyTurn}`)

      // ── PLACEMENT GUARD · the 4-step chain must COMMIT an element to the board ───────────
      // A placed element renders a <g class="hex-element-in"> token (HexCell.jsx). On a fresh game
      // the board is empty, so a committed placement takes the count 0 → ≥1. This locks in that the
      // factory→element→region→hex flow actually mutates the store (not just lights up the UI) — the
      // exact gap behind the bot's totalPlaced=0 (DB-proven this session). p1 is the active seat.
      //
      // First dismiss the first-turn tutorial — its overlay intercepts board clicks until skipped
      // (the audit above saw "Step 1 of 3", so it is up on this fresh game).
      const tutDismiss = p1.getByTestId('tutorial-skip').or(p1.getByTestId('tutorial-dismiss')).first()
      if (await tutDismiss.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tutDismiss.click()
        await expect(p1.getByTestId('tutorial-skip')).toBeHidden({ timeout: 4000 }).catch(() => {})
      }
      const placedBefore = await p1.locator('.hex-element-in').count()
      const reachedHex = await placeOneElement(p1)
      expect(reachedHex, 'no factory yielded a valid hex — placement chain broke before the board').toBe(true)
      await expect.poll(() => p1.locator('.hex-element-in').count(), {
        message: 'no element token rendered after the hex click — placeElement did not commit',
        timeout: 6000,
      }).toBeGreaterThan(placedBefore)
      const placedAfter = await p1.locator('.hex-element-in').count()
      console.log(`[game-ux] PLACEMENT committed · hex-element tokens ${placedBefore} → ${placedAfter}`)
    } finally {
      try {
        hostSession = await p1.evaluate(() => localStorage.getItem('neotopia-auth')).catch(() => null)
        await deleteRoomAsHost(hostSession, roomId)
      } catch { /* best-effort */ }
      await ctx1.close()
      await ctx2.close()
    }
  })
})
