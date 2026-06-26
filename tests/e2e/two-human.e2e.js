// NeoTopia · the two-human full-loop browser proof (T3 S7).
// "Two humans. Two browsers. One civilization record."
// Run:  npx playwright test two-human            (headless · CI)
//       npx playwright test two-human --headed    (watch both tabs)
//
// WHAT THIS PROVES
//   Test 1 · two SEPARATE browser contexts (two real humans) run the genuine lobby loop entirely
//     through the UI: host create → joiner join-by-code → joiner ready → host start → BOTH land on
//     the live board. That handshake is real realtime: presence convergence (the host's roster must
//     show the joiner + their ready flag before "Start Game" enables) AND the game_start broadcast
//     (the joiner transitions only on receiving it). Then both reveal the civilization record and
//     read the SAME shared state (each seeded from the one authoritative game_sessions row).
//   Test 2 · a hard reload of an in-game tab keeps the SAME anon user_id (auth persistence · Bug 13,
//     d420342) AND restores the board (rejoin seed · T3 S4) · proven together in the browser.
//
// HONEST SCOPE (rule 35 · never overclaim)
//   The terminal phase in Test 1 is triggered per-tab via the real DEV end-game shortcut
//   (Cmd+Shift+E · GameRoom.jsx · setPhase('scoring')), NOT propagated through the DB — playing all
//   56 cards to the natural end is infeasible in an E2E. What IS propagated and proven live is the
//   full lobby→start→board handshake and the shared game state both tabs render the record from. The
//   terminal-phase-over-the-wire case is left to the natural game end.
//
// ENTRY FLOW IS IN TRANSITION (resilient on purpose · T3 S7)
//   The lobby's URL is moving: committed code routes '/' → Lobby; T1's in-flight refactor routes
//   '/' → Landing and '/lobby' → Lobby. gotoLobby() handles BOTH — it uses the Landing's real
//   "Enter the Civilization" CTA when present, else '/' is already the lobby. So this test is valid
//   against the committed contract (what CI runs today) and against T1's new entry once it lands.
//
// CLEANUP
//   migration 005 (rooms_delete_host · T2) lets a host DELETE its own FINISHED room → one statement
//   cascades away its room_players + game_sessions + game_events. Test 2's room is admin-owned, so we
//   hard-delete it. Test 1's rooms are owned by the BROWSERS' anon users (not reachable from this Node
//   client), so they remain as inert 'finished'/'playing' rows tagged 'E2E…' until a service-role
//   purge · documented, not silently dropped.

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
const BOARD = 'svg[aria-label*="NeoTopia"]'
const NAME_INPUT = 'Builder name (max 20)'

// player_profiles.username is UNIQUE · a fixed name collides on the SECOND run (the new anon user
// can't claim a name a previous run's user already holds → claimUsername errors → the lobby never
// advances). So every run gets a fresh name, still tagged 'E2E' so the rows are identifiable for a
// service-role purge. <=20 chars (claimUsername slices to 20).
function uniqueName(prefix) {
  const t = Date.now().toString(36).slice(-5)
  const r = Math.random().toString(36).slice(2, 5)
  return (prefix + t + r).toUpperCase().slice(0, 20)
}

// ── Lobby UI helpers · selectors verified against the real Lobby.jsx / Landing.jsx (rule 36) ──────
// Reach the lobby regardless of whether '/' is the lobby (committed) or the Landing (T1 in-flight).
async function gotoLobby(page) {
  await page.goto('/')
  const input = page.getByPlaceholder(NAME_INPUT)
  const enterCiv = page.getByRole('button', { name: /enter the civilization/i })
  await expect(input.or(enterCiv).first()).toBeVisible({ timeout: 15_000 })
  if (await enterCiv.isVisible()) {
    await enterCiv.click()                 // Landing → '/lobby' (T1's real entry CTA · navigate('/lobby'))
    await expect(input).toBeVisible({ timeout: 15_000 })
  }
}

async function claimName(page, name) {
  await gotoLobby(page)
  await page.getByPlaceholder(NAME_INPUT).fill(name)
  await page.getByRole('button', { name: /enter neotopia/i }).click()
}

// The room code is the only monospace element on the waiting-room screen (codeDisplay · Lobby.jsx).
async function readRoomCode(page) {
  const el = page.locator('[style*="monospace"]').first()
  await expect(el).toBeVisible({ timeout: 15_000 })
  const code = (await el.textContent())?.trim() ?? ''
  expect(code, `room code "${code}" is not 6 chars A-Z0-9`).toMatch(/^[A-Z0-9]{6}$/)
  return code
}

// Read the persisted anon user_id (supabase session under storageKey 'neotopia-auth' · supabase.js).
async function authUid(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('neotopia-auth')
    if (!raw) return null
    try {
      const s = JSON.parse(raw)
      const id = s?.user?.id ?? s?.currentSession?.user?.id
      if (id) return id
    } catch { /* fall through to regex */ }
    const m = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    return m ? m[0] : null
  })
}

// The real DEV end-game shortcut · matches GameRoom.jsx exactly (metaKey && shiftKey && code 'KeyE').
// Dispatched on window (where the listener lives) so it needs no focus and never clicks a game hex.
async function forceEndGame(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', code: 'KeyE', metaKey: true, shiftKey: true, bubbles: true }))
  })
}

async function expectCivilizationRecord(page) {
  await expect(page.getByText('2055', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/the civilization is complete/i)).toBeVisible()
  await expect(page.getByText(/global neotopia index/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /start new civilization/i })).toBeVisible()
}

// ── Test 2 seed · an admin-anon member + a real engine-state game_sessions row (reused pattern) ───
function roomCode() {
  const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += CH[Math.floor(Math.random() * CH.length)]
  return c
}
async function createSeededGame() {
  const { url, key } = loadEnv()
  const admin = createClient(url, key, { auth: { storageKey: 'neotopia-e2e-2h', persistSession: false } })
  const { data: auth, error: aerr } = await admin.auth.signInAnonymously()
  if (aerr) throw new Error('anon sign-in: ' + aerr.message)
  const userId = auth.user.id
  const code = roomCode()
  const { data: room, error: rerr } = await admin
    .from('game_rooms').insert({ room_code: code, host_id: userId, status: 'playing', max_players: 4, player_count: 1 })
    .select().single()
  if (rerr) throw new Error('game_rooms insert: ' + rerr.message)
  const { error: perr } = await admin.from('room_players').insert({
    room_id: room.id, user_id: userId, username: 'E2E_BOT', player_color: 'blue', seat_number: 0, is_ready: true,
  })
  if (perr) throw new Error('room_players insert: ' + perr.message)
  const seeded = { ...SEED, turnNumber: 1 }
  const { error: serr } = await admin.from('game_sessions').insert({
    room_id: room.id, state: seeded, current_seat: 0, turn_number: 1, actions_remaining: 3,
    phase: 'playing', production_tiles_remaining: seeded.productionTilesRemaining ?? 12,
  })
  if (serr) throw new Error('game_sessions insert: ' + serr.message)
  return { admin, userId, roomId: room.id }
}
// Hard cleanup via migration 005 (rooms_delete_host): mark finished → delete → cascade. Best-effort:
// if 005 is absent the delete is an RLS no-op (0 rows · no throw) and we still drop our own member row.
async function cleanup(game) {
  if (!game) return
  try {
    await game.admin.from('game_rooms').update({ status: 'finished' }).eq('id', game.roomId)
    await game.admin.from('game_rooms').delete().eq('id', game.roomId) // cascade · needs rooms_delete_host
  } catch { /* best-effort */ }
  try { await game.admin.from('room_players').delete().eq('room_id', game.roomId).eq('user_id', game.userId) } catch { /* best-effort */ }
}

test.describe('Two-human complete game (T3 S7)', () => {

  test('two humans run the lobby loop and both reach the civilization record', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage() // host
    const p2 = await ctx2.newPage() // joiner
    try {
      // [1] HOST creates a room · the code appears. Unique names avoid the player_profiles UNIQUE clash.
      await claimName(p1, uniqueName('E2EH'))
      await p1.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })
      const code = await readRoomCode(p1)

      // [2] JOINER joins by code · both are now in the lobby.
      await claimName(p2, uniqueName('E2EG'))
      await p2.getByRole('button', { name: 'Join Room' }).click({ timeout: 15_000 })
      await p2.getByPlaceholder('ABC234').fill(code)
      await p2.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 15_000 })
      await expect(p2.getByRole('button', { name: /click when ready/i })).toBeVisible({ timeout: 15_000 })

      // Joiner readies → host's "Start Game" enables only once presence has converged (roster + ready).
      await p2.getByRole('button', { name: /click when ready/i }).click({ timeout: 15_000 })
      await expect(p2.getByRole('button', { name: /✓ ready/i })).toBeVisible()

      const startBtn = p1.getByRole('button', { name: /^start game$/i })
      await expect(startBtn).toBeVisible({ timeout: 30_000 }) // presence convergence (the flaky path · generous)
      await startBtn.click()

      // [3] Both navigate to the live board (host transitions locally · joiner via the game_start broadcast).
      await p1.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 20_000 })
      await p2.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 20_000 })
      await expect(p1.locator(BOARD)).toBeVisible({ timeout: 20_000 })
      await expect(p2.locator(BOARD)).toBeVisible({ timeout: 20_000 })

      // [4][5] Reveal the civilization record on BOTH tabs (real DEV end-game shortcut) · both read the
      // same shared state · 2055 + Global NeoTopia Index visible to each human.
      await forceEndGame(p1)
      await forceEndGame(p2)
      await expectCivilizationRecord(p1)
      await expectCivilizationRecord(p2)

      // [6] CTA returns the host out of the game (to '/' committed · '/lobby' in T1's flow · either is fine).
      await p1.getByRole('button', { name: /start new civilization/i }).click()
      await p1.waitForURL(url => !url.pathname.startsWith('/game'), { timeout: 10_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('rejoin after a hard reload keeps the same user_id and restores the board', async ({ page }) => {
    let game
    try {
      game = await createSeededGame()

      // [7] Load the in-game tab · useAuth mints+persists the anon session · the board seeds (Turn 1).
      await page.goto(`/game/${game.roomId}`)
      await expect(page.getByText('Turn 1', { exact: true })).toBeVisible({ timeout: 20_000 })
      await expect(page.locator(BOARD)).toBeVisible()
      const uid1 = await authUid(page)
      expect(uid1, 'no anon session persisted under neotopia-auth').toBeTruthy()

      // Hard reload · the Bug 13 fix means useAuth re-reads the SAME session (no re-mint, no race),
      // and useGameSync reseeds the board from the DB.
      await page.reload()
      await expect(page.getByText('Turn 1', { exact: true })).toBeVisible({ timeout: 20_000 })
      await expect(page.locator(BOARD)).toBeVisible()
      const uid2 = await authUid(page)

      expect(uid2, 'user_id changed across reload · auth did not persist (Bug 13 regressed)').toBe(uid1)
    } finally {
      await cleanup(game)
    }
  })
})
