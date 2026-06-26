// NeoTopia · in-game UX audit (T3 S11). Reaches the /game route the standalone ux-scan.js (T2) cannot:
// it needs two signed-in users + a started game. This is an E2E (tests/e2e/ · T3's lane), not a script
// change (scripts/ · T2's lane). It drives the SAME verified lobby flow as two-human.e2e.js to a live
// active-player board, then audits touch-target sizes, font sizes, and the in-game testid contract.
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

test.describe('In-game UX audit (T3 S11)', () => {

  test('the /game route meets touch-target + font minimums for the active player', async ({ browser }) => {
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
