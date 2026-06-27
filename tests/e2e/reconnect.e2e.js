// NeoTopia · the definitive browser proof of T3 S4's reconnect hardening (useGameSync).
// Run:  npx playwright test               (headless · CI default)
//       npx playwright test --headed      (watch it happen)
//
// WHAT THIS PROVES
//   1. window 'online'   → after a real network drop, the tab recovers a game_sessions update it
//      missed while offline (CDP Network.emulateNetworkConditions).
//   2. visibilitychange  → a backgrounded tab reseeds from the DB on return, even when the live
//      realtime websocket can't deliver (we block ONLY the WS · REST stays up · so fetchAndSeed,
//      called directly by the visibilitychange handler, is provably the sole recovery path).
//
// DESIGN (why one browser context, not two)
//   The reconnect path is READ-ONLY: on 'online'/'visibilitychange', useGameSync re-reads
//   game_sessions (public SELECT) and applies it via syncFromServer. It does not care whether the
//   missed change came from a second human or a direct DB write · the postgres_changes → fetchAndSeed
//   path is identical. So a single context + an admin-seeded REAL engine state (tests/e2e/fixtures/
//   seededState.json · produced by the actual initGame · not hand-fabricated) tests the exact
//   mechanism with none of the two-context presence-convergence flakiness. The observable is the
//   header's "Turn N" (GameRoom reads turnNumber from the store · syncFromServer sets it).
//
// CLEANUP
//   RLS has no DELETE policy on game_rooms/game_sessions (a host can only soft-close) · so afterEach
//   marks the room 'finished' and deletes our own room_players row (anon-allowed). Test rooms are
//   tagged username 'E2E_BOT'. A periodic service-role purge keeps the table tidy.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { deleteRoomAsHost } from './seedHelpers'

// ---- env (process.env in CI · .env.local locally) -------------------------------------------------
function loadEnv() {
  let url = process.env.VITE_SUPABASE_URL
  let key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    try {
      const txt = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
      for (const line of txt.split('\n')) {
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i < 0) continue
        const k = line.slice(0, i).trim()
        const v = line.slice(i + 1).trim()
        if (k === 'VITE_SUPABASE_URL') url = url || v
        if (k === 'VITE_SUPABASE_ANON_KEY') key = key || v
      }
    } catch { /* in CI the env vars must be set as secrets */ }
  }
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (set CI secrets or .env.local)')
  return { url, key }
}

const SEED = JSON.parse(readFileSync(new URL('./fixtures/seededState.json', import.meta.url), 'utf8'))

// 6-char code from the same unambiguous charset the app uses (DB CHECK: length = 6).
function roomCode() {
  const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += CH[Math.floor(Math.random() * CH.length)]
  return c
}

// Create a room + a single member + a seeded game_sessions row · all RLS-compliant under the anon key
// (room: host = self · member: self · session: requires membership, which we just satisfied).
async function createSeededGame() {
  const { url, key } = loadEnv()
  const admin = createClient(url, key, { auth: { storageKey: 'neotopia-e2e-setup', persistSession: false } })
  const { data: auth, error: aerr } = await admin.auth.signInAnonymously()
  if (aerr) throw new Error('anon sign-in: ' + aerr.message)
  const userId = auth.user.id

  const code = roomCode()
  const { data: room, error: rerr } = await admin
    .from('game_rooms')
    .insert({ room_code: code, host_id: userId, status: 'playing', max_players: 4, player_count: 1 })
    .select()
    .single()
  if (rerr) throw new Error('game_rooms insert: ' + rerr.message)

  const { error: perr } = await admin.from('room_players').insert({
    room_id: room.id, user_id: userId, username: 'E2E_BOT', player_color: 'blue', seat_number: 0, is_ready: true,
  })
  if (perr) throw new Error('room_players insert: ' + perr.message)

  const seeded = { ...SEED, turnNumber: 1 }
  const { error: serr } = await admin.from('game_sessions').insert({
    room_id: room.id,
    state: seeded,
    current_seat: 0,
    turn_number: 1,
    actions_remaining: 3,
    phase: 'playing',
    production_tiles_remaining: seeded.productionTilesRemaining ?? 12,
  })
  if (serr) throw new Error('game_sessions insert: ' + serr.message)

  return { admin, userId, roomId: room.id, roomCode: code }
}

// The "move that happens elsewhere" · bump turnNumber INSIDE the state jsonb (fetchAndSeed reads
// state, not the denormalised columns) so the client's header visibly changes on recovery.
async function bumpTurn(admin, roomId, turn) {
  const next = { ...SEED, turnNumber: turn }
  const { error } = await admin.from('game_sessions').update({ state: next, turn_number: turn }).eq('room_id', roomId)
  if (error) throw new Error('turn bump: ' + error.message)
}

async function softCleanup(game) {
  if (!game) return
  try { await game.admin.from('game_rooms').update({ status: 'finished' }).eq('id', game.roomId) } catch { /* best-effort */ }
  try { await game.admin.from('room_players').delete().eq('room_id', game.roomId).eq('user_id', game.userId) } catch { /* best-effort */ }
}

const BOARD = 'svg[aria-label*="NeoTopia"]'

// ── Two-human lobby + placement helpers (rejoin test · T3 S13) ──────────────────────────────────────
// The existing tests are single-context + admin-seeded (read-only reconnect path). The rejoin test below
// needs a GENUINELY seated browser user (seat re-association is derived from the synced roster by auth id),
// so it drives the real lobby. Same inline-helper style as game-ux.e2e.js / two-human.e2e.js.
const NAME_INPUT = 'Builder name (max 20)'
const ELEMENT_RE = /energy|biofarming|technology|community/i
const REGION_RE  = /sacred city|living earth|free energy/i

function uniqueName(prefix) {
  const t = Date.now().toString(36).slice(-5)
  const r = Math.random().toString(36).slice(2, 5)
  return (prefix + t + r).toUpperCase().slice(0, 20)
}

async function claimName(page, name) {
  await page.goto('/')
  const input = page.getByPlaceholder(NAME_INPUT)
  const enterCiv = page.getByRole('button', { name: /enter the civilization/i })
  await expect(input.or(enterCiv).first()).toBeVisible({ timeout: 15_000 })
  if (await enterCiv.isVisible()) {
    await enterCiv.click()
    await expect(input).toBeVisible({ timeout: 15_000 })
  }
  await input.fill(name)
  await page.getByRole('button', { name: /enter neotopia/i }).click()
}

async function readRoomCode(page) {
  const el = page.locator('[style*="monospace"]').first()
  await expect(el).toBeVisible({ timeout: 15_000 })
  const code = (await el.textContent())?.trim() ?? ''
  expect(code, `room code "${code}" is not 6 chars`).toMatch(/^[A-Z0-9]{6}$/)
  return code
}

async function dismissTutorial(page) {
  const t = page.getByTestId('tutorial-skip').or(page.getByTestId('tutorial-dismiss')).first()
  if (await t.isVisible({ timeout: 2000 }).catch(() => false)) {
    await t.click()
    await expect(page.getByTestId('tutorial-skip')).toBeHidden({ timeout: 4000 }).catch(() => {})
  }
}

// Drive factory→element→region→hex as the active player. force:true on the hex is load-bearing: the
// valid-hex ring's infinite hexPulse scale animation keeps the <g> bbox moving so a normal click times
// out before placeElement commits (DB-proven · T3 S12). Returns true once a valid hex is force-clicked.
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
    await validHex.click({ force: true })
    return true
  }
  return false
}

test.describe('Reconnect hardening (useGameSync · T3 S4)', () => {

  test("window 'online': recovers a state update missed while the tab was offline", async ({ page, context }) => {
    let game
    try {
      game = await createSeededGame()

      await page.goto(`/game/${game.roomId}`)
      // Seeded + rendered: the live channel subscribed and fetchAndSeed delivered Turn 1.
      await expect(page.getByText('Turn 1', { exact: true })).toBeVisible()
      await expect(page.locator(BOARD)).toBeVisible()

      // Real network drop for THIS page only (the Node test process stays online).
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', {
        offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
      })

      // A move lands in the DB while we're offline.
      await bumpTurn(game.admin, game.roomId, 7)

      // It must NOT have arrived live · the socket is down. Still Turn 1.
      await page.waitForTimeout(2500)
      await expect(page.getByText('Turn 1', { exact: true })).toBeVisible()
      await expect(page.getByText('Turn 7', { exact: true })).toHaveCount(0)

      // Back online → window 'online' → useGameSync connect() → fetchAndSeed → syncFromServer → DOM.
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
      })

      // Recovery: the missed Turn 7 now shows.
      await expect(page.getByText('Turn 7', { exact: true })).toBeVisible({ timeout: 20_000 })
    } finally {
      await softCleanup(game)
    }
  })

  test('visibilitychange: a backgrounded tab reseeds from the DB on return (realtime WS blocked)', async ({ page, context }) => {
    let game
    try {
      game = await createSeededGame()

      // Block ONLY the realtime websocket. REST (PostgREST) and auth stay reachable, so fetchAndSeed
      // still works · but live postgres_changes can never deliver. This isolates visibilitychange as
      // the SOLE recovery path: with the WS down, the channel never reaches SUBSCRIBED, so the
      // subscribe-time fetchAndSeed never fires · only the visibilitychange handler's DIRECT
      // fetchAndSeed can seed the board.
      await context.route('**/realtime/**', route => route.abort())

      await page.goto(`/game/${game.roomId}`)
      // With the WS blocked there is no initial seed · GameRoom holds on its Connecting gate.
      await expect(page.getByText(/Connecting to the board/i)).toBeVisible()

      // A move lands · it cannot arrive live (WS blocked).
      await bumpTurn(game.admin, game.roomId, 4)

      // Background → foreground. onVisible() calls fetchAndSeed directly (NOT gated on subscribe).
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // fetchAndSeed (HTTP · not blocked) seeds the latest state → the board renders at Turn 4.
      await expect(page.getByText('Turn 4', { exact: true })).toBeVisible({ timeout: 20_000 })
      await expect(page.locator(BOARD)).toBeVisible()
    } finally {
      await softCleanup(game)
    }
  })

  // Free rejoin (T3 S9 design · stress-tested T3 S13). GameRoom reads roomId from useParams (survives a
  // refresh) and derives mySeat from the synced roster by auth id — so closing the tab and reopening in
  // the SAME browser must restore the board state AND the seat. The HOST rejoins: as seat 0 they are
  // active first, so data-my-turn='true' after rejoin is an UNAMBIGUOUS proof the seat re-associated (a
  // lost seat → mySeat=null → isMyTurn=false → data-my-turn would read 'false'). Two real users go
  // through the lobby so the rejoiner is genuinely seated. Reopening in the same context preserves the
  // anon session (localStorage 'neotopia-auth'); a fresh context would be a different, correctly-unseated user.
  test('free rejoin: closing the tab and reopening restores the board state AND the active seat', async ({ browser }) => {
    const ctxHost = await browser.newContext()
    const ctxJoiner = await browser.newContext()
    let p1 = await ctxHost.newPage()      // host · seat 0 · active first · the rejoiner
    const p2 = await ctxJoiner.newPage()  // joiner · only needed so the game can start
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
      await p1.waitForTimeout(800)

      // The host places ONE element so there is real board STATE (not an empty board) to re-hydrate.
      await dismissTutorial(p1)
      const placed = await placeOneElement(p1)
      expect(placed, 'host could not place an element to seed board state').toBe(true)
      await expect.poll(() => p1.locator('.hex-element-in').count(), { timeout: 8000 }).toBeGreaterThan(0)

      // PERSISTENCE WITNESS · the placement is optimistic locally; persist()→pushState is async. The
      // joiner only renders the element if it reached game_sessions (postgres_changes fires on a DB
      // write, never on local state). Waiting for p2 to show it proves the element is in the DB BEFORE
      // we close p1 — so the rejoin truly tests re-hydration, not a race against the un-flushed write.
      await expect.poll(() => p2.locator('.hex-element-in').count(), { timeout: 15_000 }).toBeGreaterThan(0)

      // Capture the host's anon session (for cleanup) BEFORE closing the tab.
      hostSession = await p1.evaluate(() => localStorage.getItem('neotopia-auth'))

      // ── CLOSE THE TAB · REOPEN IN THE SAME BROWSER (anon session persists in localStorage) ──────────
      await p1.close()
      p1 = await ctxHost.newPage()
      await p1.goto(`/game/${roomId}`)
      await dismissTutorial(p1) // the first-turn tutorial may re-show on the fresh page

      // ── REJOIN PROOF · all three resilience guarantees in one rejoin ────────────────────────────────
      await expect(p1.locator(BOARD)).toBeVisible({ timeout: 20_000 })                                  // subscription re-attached + seeded
      await expect.poll(() => p1.locator('.hex-element-in').count(), { timeout: 20_000 }).toBeGreaterThan(0) // board STATE re-hydrated
      await expect(p1.locator('[data-my-turn="true"]')).toBeVisible({ timeout: 20_000 })               // SEAT re-associated (host=seat0=active)
    } finally {
      try { await deleteRoomAsHost(hostSession, roomId) } catch { /* best-effort */ }
      await ctxHost.close()
      await ctxJoiner.close()
    }
  })
})
