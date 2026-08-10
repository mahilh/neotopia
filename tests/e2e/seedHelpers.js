// Shared E2E setup helpers (T3 S8). NOT a test file — the name doesn't match testMatch '**/*.e2e.js'
// (Playwright) nor vitest's *.test/*.spec, so neither runner collects it. Imported by the .e2e.js suites.
//
// All writes use the public ANON key. createSeededGame()'s admin client signs in anonymously and is the
// HOST + a member of the room it creates, so it satisfies sessions_insert_member / sessions_update_member
// and rooms_*_host RLS. The browser tabs under test need only the public SELECT (sessions_read = true) to
// subscribe + seed · they need not be members.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

export function loadEnv() {
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

export const SEED = JSON.parse(readFileSync(new URL('./fixtures/seededState.json', import.meta.url), 'utf8'))
export const BOARD = 'svg[aria-label*="NeoTopia"]'

// Fixture identity lives in fixtureNames.js · pure, so vitest can unit-test the name guard without
// Playwright's loader (this file reads seededState.json at module level and is import-only there).
// Re-exported so no spec has to know about the split.
export { uniqueName, UI_RESERVED_WORDS, makeRoomCode } from './fixtureNames'
import { makeRoomCode as _makeRoomCode } from './fixtureNames'

// Supabase rate-limits anonymous sign-ins per IP · a suite that mints many in a burst (or a fast local
// re-run) can trip it. Back off and retry ONLY on that transient · fail fast on anything else.
export async function signInAnonRetry(client, tries = 4) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    const { data, error } = await client.auth.signInAnonymously()
    if (!error) return data
    lastErr = error
    if (!/rate limit/i.test(error.message)) break
    await new Promise(r => setTimeout(r, 1500 * (i + 1)))
  }
  throw new Error('anon sign-in: ' + lastErr.message)
}

// Admin-anon host + a member + a real engine-state game_sessions row (phase 'playing'). Returns the
// admin client (a MEMBER · can UPDATE the session) so a test can drive authoritative state changes.
export async function createSeededGame(storageKey = 'neotopia-e2e-seed') {
  const { url, key } = loadEnv()
  const admin = createClient(url, key, { auth: { storageKey, persistSession: false } })
  const auth = await signInAnonRetry(admin)
  const userId = auth.user.id
  const code = _makeRoomCode()
  // SEAT FIRST, THEN PROMOTE (T3 S29). migration 016's room_players_join requires the target room to be
  // status='waiting' AND under capacity, so seating into an already-'playing' room is an RLS violation.
  // This also brings the harness closer to the real path rather than further from it (Rule 36): the app
  // only ever goes create → lobby → start, and never seats anyone into a running game.
  const { data: room, error: rerr } = await admin
    .from('game_rooms').insert({ room_code: code, host_id: userId, status: 'waiting', max_players: 4, player_count: 1 })
    .select().single()
  if (rerr) throw new Error('game_rooms insert: ' + rerr.message)
  const { error: perr } = await admin.from('room_players').insert({
    room_id: room.id, user_id: userId, username: 'E2E_BOT', player_color: 'blue', seat_number: 0, is_ready: true,
  })
  if (perr) throw new Error('room_players insert: ' + perr.message)
  const { error: uerr } = await admin.from('game_rooms').update({ status: 'playing' }).eq('id', room.id)
  if (uerr) throw new Error('game_rooms promote to playing: ' + uerr.message)
  const seeded = { ...SEED, turnNumber: 1 }
  const { error: serr } = await admin.from('game_sessions').insert({
    room_id: room.id, state: seeded, current_seat: 0, turn_number: 1, actions_remaining: 3,
    phase: 'playing', production_tiles_remaining: seeded.productionTilesRemaining ?? 12,
  })
  if (serr) throw new Error('game_sessions insert: ' + serr.message)
  return { admin, userId, roomId: room.id, roomCode: code }
}

// Drive the authoritative session state · mutate the current state jsonb and write it back (mirrors what
// useGameSync.pushState does on a real move). The admin must be a MEMBER (createSeededGame's host is).
export async function updateSessionState(admin, roomId, mutate, columns = {}) {
  const { data, error: rerr } = await admin.from('game_sessions').select('state').eq('room_id', roomId).maybeSingle()
  if (rerr || !data) throw new Error('read session: ' + (rerr?.message ?? 'no row'))
  const next = mutate({ ...data.state })
  const { error } = await admin.from('game_sessions').update({ state: next, ...columns }).eq('room_id', roomId)
  if (error) throw new Error('update session: ' + error.message)
}

// Hard cleanup of an ADMIN-OWNED room via migration 005 (rooms_delete_host): mark finished → delete →
// FK cascade clears room_players + game_sessions + game_events. Best-effort (no-op if 005 absent).
export async function cleanupSeeded(game) {
  if (!game) return
  try {
    await game.admin.from('game_rooms').update({ status: 'finished' }).eq('id', game.roomId)
    await game.admin.from('game_rooms').delete().eq('id', game.roomId)
  } catch { /* best-effort */ }
  try { await game.admin.from('room_players').delete().eq('room_id', game.roomId).eq('user_id', game.userId) } catch { /* best-effort */ }
}

// Clean a BROWSER-OWNED room by adopting the host browser's OWN session (captured from its localStorage)
// and deleting its OWN finished room via 005 — exactly what the policy is for, no service role. Best-effort.
//   sessionJson: the raw value of localStorage['neotopia-auth'] from the host page.
export async function deleteRoomAsHost(sessionJson, roomId) {
  if (!sessionJson || !roomId) return
  try {
    const s = JSON.parse(sessionJson)
    const access_token = s?.access_token ?? s?.currentSession?.access_token
    const refresh_token = s?.refresh_token ?? s?.currentSession?.refresh_token
    if (!access_token || !refresh_token) return
    const { url, key } = loadEnv()
    const host = createClient(url, key, { auth: { storageKey: 'neotopia-e2e-host-cleanup', persistSession: false } })
    const { error: serr } = await host.auth.setSession({ access_token, refresh_token })
    if (serr) return
    await host.from('game_rooms').update({ status: 'finished' }).eq('id', roomId)
    await host.from('game_rooms').delete().eq('id', roomId) // rooms_delete_host · cascade
  } catch { /* best-effort · documented limitation if it fails */ }
}

// Read the REAL placed-element count from game_sessions.state by ROOM ID (Rule 53 · the DB is truth, not the
// bot's proxy counter, which counts attempts). Takes roomId, NOT room_code, on purpose — and is meant to be
// called WHILE THE GAME IS STILL ALIVE. The bot-room race (T3 S14 Task B · diagnosed: no pg_cron purge
// exists) is that a bot room can be deleted by a CONCURRENT E2E globalTeardown (purge_e2e_test_data sweeps
// Bot%/E2E% rooms of ANY status · migration 008), or was never created at all (anon rate-limit at create →
// phantom code · the S12 prod mode). Either way a POST-game `room_code → room_id → session` lookup resolves
// to nothing and the verify silently returns null. Capture roomId from the URL during the game ("Both on
// game board") and read here right after the last placement → the count is banked before any teardown.
// Returns the integer count, or null if the session/state is unreadable (room gone · never created).
export async function readPlacedCount({ url, key, roomId }) {
  if (!url || !key || !roomId) return null
  try {
    const client = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await client
      .from('game_sessions').select('state').eq('room_id', roomId).maybeSingle()
    if (error || !data) return null
    const state = typeof data.state === 'string' ? JSON.parse(data.state) : data.state
    if (!state?.regions) return null
    let count = 0
    for (const region of state.regions) {
      for (const hex of Object.values(region?.hexes ?? {})) {
        if (hex && hex.element) count++
      }
    }
    return count
  } catch { return null }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE TWO-HUMAN LOBBY LOOP · ONE implementation (T3 S39)
//
// WHY IT MOVED HERE. Three specs had grown their own copy of this sequence, all descended from
// two-human.e2e.js (S7), and all of them select the start control by ROLE AND NAME and then assert only
// that it is VISIBLE. The button is `data-testid="start-btn"` with `disabled={!canStart}` (Lobby.jsx:629),
// so a copy that waits for VISIBLE clicks a DISABLED button, nothing happens, and the spec fails 20s later
// at waitForURL with "Timeout exceeded" · which describes a rate limit, an RLS refusal and a genuine
// product bug identically. That cost a live run (2 anon identities) before the cause was read off the
// markup rather than guessed at. Same class as Rule 78 (visible is not reachable) and of the harness bug
// found in the same session where a draw was counted from a click that never committed.
//
// So this waits for ENABLED, uses the real testids, and verifies the navigation actually happened · and it
// is one function, so the next spec cannot inherit the old shape by copying a neighbour.
//
// NOT retro-fitted to two-human.e2e.js or multiplayer-endgame-live.e2e.js in the same session: both are
// wired into CI and green, and rewriting a file somebody is watching land is how a green gate turns red for
// a reason nobody can find. Routed in comms with this exact note instead.
const NAME_INPUT = 'Builder name (max 20)'

async function gotoLobby(page, expect) {
  await page.goto('/')
  const input = page.getByPlaceholder(NAME_INPUT)
  const enterCiv = page.getByRole('button', { name: /enter the civilization/i })
  await expect(input.or(enterCiv).first()).toBeVisible({ timeout: 15_000 })
  if (await enterCiv.isVisible()) {
    await enterCiv.click()
    await expect(input).toBeVisible({ timeout: 15_000 })
  }
}

/**
 * Drive two real browser pages through create → join → ready → start, entirely through the UI.
 * `expect` is passed in so this module stays importable by vitest (which does not have Playwright's expect).
 * Returns { code, roomId }. Throws with the offending SCREEN, never a bare locator timeout.
 */
export async function runTwoHumanLobby(p1, p2, { expect, hostName, joinerName, boardSelector = BOARD }) {
  await gotoLobby(p1, expect)
  await p1.getByPlaceholder(NAME_INPUT).fill(hostName)
  await p1.getByRole('button', { name: /enter neotopia/i }).click()
  await p1.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })

  const codeEl = p1.locator('[style*="monospace"]').first()
  await expect(codeEl).toBeVisible({ timeout: 15_000 })
  const code = (await codeEl.textContent())?.trim() ?? ''
  expect(code, `room code "${code}" is not 6 chars A-Z0-9`).toMatch(/^[A-Z0-9]{6}$/)

  await gotoLobby(p2, expect)
  await p2.getByPlaceholder(NAME_INPUT).fill(joinerName)
  await p2.getByRole('button', { name: /enter neotopia/i }).click()
  await p2.getByRole('button', { name: 'Join Room' }).click({ timeout: 15_000 })
  await p2.getByPlaceholder('ABC234').fill(code)
  await p2.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 15_000 })

  const ready = p2.getByTestId('ready-btn')
  try {
    await expect(ready).toBeVisible({ timeout: 25_000 })
  } catch {
    throw new Error(`the joiner never reached the waiting room after joining "${code}" · screen: ` +
      await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 500)))
  }
  await ready.click({ timeout: 10_000 })

  // ENABLED, not visible. This is the line the copies were missing.
  const start = p1.getByTestId('start-btn')
  await expect(start, 'the Start control never appeared for the host').toBeVisible({ timeout: 15_000 })
  try {
    await expect(start).toBeEnabled({ timeout: 30_000 }) // presence convergence · the genuinely slow step
  } catch {
    throw new Error('Start Game never became enabled · presence did not converge. host screen: ' +
      await p1.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)))
  }
  await start.click()

  try {
    await p1.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 25_000 })
    await p2.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 25_000 })
  } catch {
    throw new Error('a player never reached the board after Start. host: ' +
      await p1.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)) + ' | joiner: ' +
      await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)))
  }
  await expect(p1.locator(boardSelector)).toBeVisible({ timeout: 20_000 })
  await expect(p2.locator(boardSelector)).toBeVisible({ timeout: 20_000 })

  return { code, roomId: new URL(p1.url()).pathname.split('/').pop() }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// MULTI-VIEWPORT MEASUREMENT · scroll reset BY CONSTRUCTION (T3 S39 · P3)
//
// Measuring the same page at several sizes contaminated itself three sessions running: resizing to 320 after
// a pass at 1280 inherited that pass's scrollTop, so "how far below the fold ON ARRIVAL" was read from a
// container somebody had already scrolled · 489px instead of the true 1038px. Plausible, wrong, and naming
// something it had not measured. Three occurrences of one mistake is a missing harness step, not a slip.
//
// So the reset is not a line a caller has to remember: this helper resets the window AND every scrollable
// element on the page between viewports, then lets layout settle, then calls the measurement. A caller
// cannot inherit scroll from the previous size because there is no code path in which it survives.
export async function forEachViewport(page, sizes, measure, { settleMs = 250 } = {}) {
  const original = page.viewportSize()
  const out = []
  try {
    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.evaluate(() => {
        window.scrollTo(0, 0)
        for (const el of document.querySelectorAll('*')) {
          if (el.scrollTop) el.scrollTop = 0
          if (el.scrollLeft) el.scrollLeft = 0
        }
      })
      await page.waitForTimeout(settleMs) // measure the settled layout, not mid-reflow
      out.push({ size, result: await measure(page, size) })
    }
  } finally {
    if (original) {
      await page.setViewportSize(original)
      await page.waitForTimeout(settleMs)
    }
  }
  return out
}
