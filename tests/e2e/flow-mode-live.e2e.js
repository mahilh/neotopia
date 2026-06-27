// NeoTopia · Live-DB Flow-mode UI proof (T3 S18 · Task A).
// "Pick Flow in the real lobby. The civilization's clock is 9 — written to Postgres."
//
// WHY this exists (vs the gray-box flow-mode.e2e.js):
//   flow-mode.e2e.js drives the engine reducers directly (window.__neotopia_store.initGame) · it proves the
//   ENGINE seeds a 9-tile/15s clock for flow vs 12/90 for classic, with NO Supabase write. It cannot prove the
//   real LOBBY TOGGLE (T1 5d759aa · data-testid="mode-flow") actually reaches game_sessions. This file closes
//   that gap end-to-end: it clicks the real toggle, runs the genuine two-human lobby handshake to START — the
//   only path that INSERTs game_sessions (useGameRoom.startGame); solo-start is impossible (Lobby.jsx canStart
//   needs >=2 players, all non-hosts ready) — then reads the PERSISTED row from live Supabase and asserts the
//   Flow clock is exactly what the toggle promised. This is the live-DB analogue of two-human.e2e.js, scoped to
//   the Flow-mode write seam (Rule 40 · trace the COMPOSED value: lobby toggle → createRoom(mode) → setGameMode
//   → startGame's game_sessions insert → the DB row).
//
// CAUSALITY (why ONE Flow test is sufficient · Rule 35): DEFAULT_GAME_MODE is 'classic' (store/gameConfig). If
//   the toggle were a no-op, the started game would persist classic (12/90) and every Flow assertion below would
//   FAIL. So a single passing Flow proof also rules out the no-op — it is the proof the toggle is CAUSAL. The
//   classic 12/90 ↔ flow 9/15 ENGINE contrast is already owned (gray-box) by flow-mode.e2e.js.
//
// HONEST SCOPE (Rule 63 · never overclaim):
//   ✓ the real lobby Flow toggle → game_sessions.mode = 'flow' (the migration-010 column · live Postgres)
//   ✓ the started game's PERSISTED state carries the Flow clock: production_tiles_remaining = 9 (column) AND
//     state.productionTilesRemaining = 9 AND state.turnTimeRemaining = 15 (vs classic's 12 / 90)
//   · the END-GAME firing at 9 placements (the clock DRAINING through real play) is owned by flow-mode.e2e.js —
//     draining 9 real UI placements across two browsers is the flaky/slow path game-ux.e2e.js owns (Rule 33/57).
//     The persisted clock = 9 IS the live witness that the end-gate is ARMED to 9, not 12.
//
// CI: a heavy two-context flow → DELIBERATELY off the merge-blocking path (same class as two-human · the full
//   suite's many anonymous sign-ins flake on Supabase's per-IP hourly rate limit · see e2e.yml's note). Wired
//   into e2e-live-nightly.yml (schedule + workflow_dispatch), NOT e2e-placement-guard.yml (the fast merge gate).
//   Run locally: npx playwright test tests/e2e/flow-mode-live.e2e.js
//   Needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (.env.local locally · CI secrets · seedHelpers.loadEnv).

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, deleteRoomAsHost } from './seedHelpers'

const NAME_INPUT = 'Builder name (max 20)'
const BOARD = 'svg[aria-label*="NeoTopia"]'

// Unique, E2E%-prefixed names: player_profiles.username is UNIQUE (a fixed name collides on the second run), and
// the 'E2E' prefix lets globalTeardown's purge_e2e_test_data() backstop sweep any residual profile row left by a
// crash (migrations 006/007 · scoped to E2E%/BotAlpha%/BotBeta%). <=20 chars (claimUsername slices to 20).
function uniqueName(prefix) {
  const t = Date.now().toString(36).slice(-5)
  const r = Math.random().toString(36).slice(2, 5)
  return (prefix + t + r).toUpperCase().slice(0, 20)
}

// Reach the lobby whether '/' is the Lobby (older committed) or the Landing (current · App.jsx routes '/' →
// Landing, '/lobby' → Lobby · the hero CTA "Enter the Civilization" navigates to /lobby). Resilient to both.
async function gotoLobby(page) {
  await page.goto('/')
  const input = page.getByPlaceholder(NAME_INPUT)
  const enterCiv = page.getByRole('button', { name: /enter the civilization/i }) // only the hero CTA carries this name
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

// Read game_sessions by room_id with the public anon key (RLS sessions_read = true · any client may SELECT). The
// row is INSERTed inside startGame just before the host routes to /game/:roomId, so it exists by the time we read
// — the poll only absorbs read-replica lag, never a missing write. Returns the row (or fails the poll loudly).
async function readSession(roomId) {
  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false } })
  let session = null
  await expect
    .poll(async () => {
      const { data } = await client
        .from('game_sessions')
        .select('mode, production_tiles_remaining, state')
        .eq('room_id', roomId)
        .maybeSingle()
      session = data
      return !!data
    }, { timeout: 15_000, message: 'game_sessions row never appeared for the started Flow room' })
    .toBe(true)
  return session
}

test.describe('Live-DB Flow mode (T3 S18 · real lobby toggle → persisted Flow clock)', () => {

  test('host picks Flow in the lobby → game_sessions persists mode=flow + the 9-tile/15s clock', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage() // host
    const p2 = await ctx2.newPage() // joiner
    let roomId = null
    let hostSession = null
    try {
      // [1] HOST claims a name, SELECTS FLOW (the seam under test · T1 5d759aa), then creates the room. The mode
      //     must be live BEFORE Create Room: its onClick passes the CURRENT gameMode as the createRoom argument
      //     (Rule 61 · createRoom's default would otherwise reset setGameMode back to classic).
      await claimName(p1, uniqueName('E2EFLH'))
      const flowToggle = p1.locator('[data-testid="mode-flow"]')
      await expect(flowToggle, 'the Flow lobby toggle must exist (T1 5d759aa · data-testid=mode-flow)').toBeVisible({ timeout: 15_000 })
      await flowToggle.click()
      await expect(flowToggle, 'clicking Flow must select it (aria-pressed) before Create Room reads gameMode (Rule 61)').toHaveAttribute('aria-pressed', 'true')
      await p1.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })

      // Room code · data-testid="room-code" (Pattern 23 strategy 2 · the most robust extractor · no monospace heuristics).
      const codeEl = p1.locator('[data-testid="room-code"]')
      await expect(codeEl).toBeVisible({ timeout: 15_000 })
      const code = (await codeEl.textContent())?.trim() ?? ''
      expect(code, `room code "${code}" must be 6 chars A-Z0-9`).toMatch(/^[A-Z0-9]{6}$/)

      // [2] JOINER claims a name, joins by code, readies (canStart needs >=2 players AND every non-host ready).
      await claimName(p2, uniqueName('E2EFLG'))
      await p2.getByRole('button', { name: 'Join Room' }).click({ timeout: 15_000 })
      await p2.getByPlaceholder('ABC234').fill(code)
      await p2.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 15_000 })
      const readyBtn = p2.locator('[data-testid="ready-btn"]')
      await expect(readyBtn).toBeVisible({ timeout: 15_000 })
      await readyBtn.click()
      await expect(p2.getByRole('button', { name: /✓ ready/i })).toBeVisible()

      // [3] HOST starts once presence converges — "Start Game" (exact name) appears ONLY at canStart (the button
      //     reads "Waiting for players (n/m ready)" until then). This is the documented flaky path · generous wait.
      const startBtn = p1.getByRole('button', { name: /^start game$/i })
      await expect(startBtn, 'Start Game must enable after the joiner readies (presence convergence)').toBeVisible({ timeout: 30_000 })
      await startBtn.click()

      // [4] Both reach the live board · capture roomId from the host URL (a witness that startGame INSERTed the
      //     session and the host transitioned · /game/:roomId carries the id across the lobby→game boundary).
      await p1.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 20_000 })
      await p2.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 20_000 })
      await expect(p1.locator(BOARD)).toBeVisible({ timeout: 20_000 })
      await expect(p2.locator(BOARD)).toBeVisible({ timeout: 20_000 })
      roomId = p1.url().match(/\/game\/([0-9a-f-]+)/i)?.[1] ?? null
      expect(roomId, 'could not extract roomId from the host /game/:roomId URL').toBeTruthy()
      hostSession = await p1.evaluate(() => localStorage.getItem('neotopia-auth'))

      // [5] THE DB IS THE WITNESS (Rule 53): read the PERSISTED game_sessions row and assert the Flow clock. A
      //     no-op toggle would have written classic here (12/90) → these expectations would fail (Rule 35 causality).
      const session = await readSession(roomId)
      expect(session, 'no game_sessions row for the started Flow room').toBeTruthy()
      const state = typeof session.state === 'string' ? JSON.parse(session.state) : session.state

      expect(session.mode, "game_sessions.mode must be 'flow' (migration 010 · the lobby toggle's persisted write)").toBe('flow')
      expect(session.production_tiles_remaining, 'the persisted Flow production clock must be 9 (12 = classic regression · the live witness the end-gate is armed to 9)').toBe(9)
      expect(state?.productionTilesRemaining, "the persisted state's tile clock must be 9").toBe(9)
      expect(state?.turnTimeRemaining, 'the persisted Flow turn budget must be 15s (90 = classic regression)').toBe(15)
      expect(state?.mode, "the persisted state.mode must be 'flow'").toBe('flow')

      console.log('[flow-live] OK · room', roomId, '· session:', JSON.stringify({ mode: session.mode, tiles: session.production_tiles_remaining, timer: state?.turnTimeRemaining }))
    } finally {
      // Host-owned room → delete it AS the host (migration 005 rooms_delete_host · adopt the host's own
      // localStorage session · no service role). globalTeardown's E2E% purge is the backstop for residual rows.
      await deleteRoomAsHost(hostSession, roomId)
      await ctx1.close()
      await ctx2.close()
    }
  })
})
