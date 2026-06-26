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
})
