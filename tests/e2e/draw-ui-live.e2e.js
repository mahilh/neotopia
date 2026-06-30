// NeoTopia · UI draw-path proof · the atomic RPC wired into the real GameRoom (T3 S23 · forge SECOND priority).
// The live-UI analogue of draw-rpc-concurrency.mjs: that harness proved the RPC SERIALIZES at the data layer;
// THIS proves T1's GameRoom wiring (91b8727) actually ROUTES a real-room offer-draw through that RPC and lands
// the card in hand. Together they cover the draw path end to end (DB atomicity + UI wiring).
//
// WHY two-human-live (not a solo gray-box like card-art.e2e.js): T1 wired the RPC path behind
//   isRealRoom = roomId && sync.sessionId && mySeat != null  (GameRoom.jsx · onDrawOffer). Solo/bot dev has no
// auth session (sessionId null) so it deliberately keeps the LOCAL deterministic draw (handleDrawCard) · the
// RPC never fires. The ONLY way to exercise the wired RPC path from the UI is a genuine authenticated
// multiplayer room · the same two-context lobby handshake flow-mode-live.e2e.js / two-human.e2e.js own.
//
// THE DECISIVE SIGNAL (why a DB-effect check alone is NOT enough · Rule 63): both the RPC path AND the local
// fallback move the offer card into hand and end up in game_sessions.state (the local path via pushState). So
// the DB effect cannot by itself prove the RPC fired. We therefore assert the NETWORK: the host's offer click
// must fire a POST to /rest/v1/rpc/draw_card_for_seat that returns 200. That request is emitted ONLY by the
// RPC branch · it is the proof the wiring routes through the atomic RPC and not the snapshot-clobber path the
// migration replaced (17f5931). The DB read then confirms the EFFECT (offer -> hand · exactly one card).
//
// HONEST SCOPE (Rule 63): proves one real-room offer-draw routes through draw_card_for_seat and lands exactly
// one card in the drawer's hand (no double-fire, no loss · offer shrinks by 1 · deck untouched because the
// offer refill is deferred to endTurn in BOTH paths · gameStore line "Offer is replenished in endTurn()").
// It does NOT re-prove concurrency (draw-rpc-concurrency.mjs owns that) and does NOT drive a full game.
//
// CI: live two-context · DELIBERATELY off the merge-blocking path (anon sign-in per-IP rate limits flake the
// fast suite · see flow-mode-live.e2e.js). Belongs in e2e-live-nightly.yml. Run locally:
//   npx playwright test tests/e2e/draw-ui-live.e2e.js   (needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, deleteRoomAsHost } from './seedHelpers'

const NAME_INPUT = 'Builder name (max 20)'
const BOARD = 'svg[aria-label*="NeoTopia"]'

let ENV = null
try { ENV = loadEnv() } catch { /* no creds · the test skips (nightly-class · needs live Supabase) */ }

// player_profiles.username is UNIQUE · E2E%-prefixed so globalTeardown's purge_e2e_test_data backstop can sweep.
function uniqueName(prefix) {
  const t = Date.now().toString(36).slice(-5)
  const r = Math.random().toString(36).slice(2, 5)
  return (prefix + t + r).toUpperCase().slice(0, 20)
}

// Reach the lobby whether '/' is Lobby (older) or Landing (current · hero CTA navigates to /lobby). From
// flow-mode-live.e2e.js · resilient to both.
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

// Read game_sessions by room_id (anon key · sessions_read = true). Returns the parsed state + a few derived
// fields used by the assertions. Polls to absorb read-replica lag (never a missing write · the row exists by
// the time the board is visible).
async function readState(roomId) {
  const client = createClient(ENV.url, ENV.key, { auth: { persistSession: false } })
  let state = null
  await expect.poll(async () => {
    const { data } = await client.from('game_sessions').select('state').eq('room_id', roomId).maybeSingle()
    state = data ? (typeof data.state === 'string' ? JSON.parse(data.state) : data.state) : null
    return !!state
  }, { timeout: 15_000, message: 'game_sessions row never appeared for the started room' }).toBe(true)
  return state
}

// Sum of every player hand · the simplest "did exactly one card move" probe across all seats.
function totalHandCards(state) {
  return (state.players ?? []).reduce((n, p) => n + (p.hand?.length ?? 0), 0)
}

// Best-effort dismiss of the first-turn onboarding overlay (Tutorial.jsx · data-testid=tutorial-skip) so it
// never sits over the Offer and eats the click. Fresh browser context => no localStorage => it shows.
async function dismissTutorial(page) {
  const skip = page.locator('[data-testid="tutorial-skip"]')
  try {
    if (await skip.isVisible({ timeout: 3_000 })) await skip.click()
  } catch { /* not shown · fine */ }
}

test.describe('Live-DB draw path (T3 S23 · real-room offer-draw routes through atomic draw_card_for_seat)', () => {

  test('host draws from The Offer in a real room · fires the RPC · exactly one card moves offer -> hand', async ({ browser }) => {
    test.skip(!ENV, 'no Supabase creds (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) · nightly-class live test')

    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const host = await ctx1.newPage()
    const joiner = await ctx2.newPage()
    let roomId = null
    let hostSession = null
    try {
      // [1] HOST claims a name and creates a CLASSIC room (default · no Flow toggle). Classic keeps the draw
      //     strictly turn-locked to the active seat · the host is seat 0 and current, so it may draw at once.
      await claimName(host, uniqueName('E2EDRWH'))
      await host.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })
      const codeEl = host.locator('[data-testid="room-code"]')
      await expect(codeEl).toBeVisible({ timeout: 15_000 })
      const code = (await codeEl.textContent())?.trim() ?? ''
      expect(code, `room code "${code}" must be 6 chars`).toMatch(/^[A-Z0-9]{6}$/)

      // [2] JOINER joins by code and readies (canStart needs >= 2 players AND every non-host ready).
      await claimName(joiner, uniqueName('E2EDRWG'))
      await joiner.getByRole('button', { name: 'Join Room' }).click({ timeout: 15_000 })
      await joiner.getByPlaceholder('ABC234').fill(code)
      await joiner.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 15_000 })
      const readyBtn = joiner.locator('[data-testid="ready-btn"]')
      await expect(readyBtn).toBeVisible({ timeout: 15_000 })
      await readyBtn.click()
      await expect(joiner.getByRole('button', { name: /✓ ready/i })).toBeVisible()

      // [3] HOST starts once presence converges, both reach the live board, capture roomId from the host URL.
      const startBtn = host.getByRole('button', { name: /^start game$/i })
      await expect(startBtn, 'Start Game must enable after the joiner readies').toBeVisible({ timeout: 30_000 })
      await startBtn.click()
      await host.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 20_000 })
      await expect(host.locator(BOARD)).toBeVisible({ timeout: 20_000 })
      roomId = host.url().match(/\/game\/([0-9a-f-]+)/i)?.[1] ?? null
      expect(roomId, 'could not extract roomId from the host /game/:roomId URL').toBeTruthy()
      hostSession = await host.evaluate(() => localStorage.getItem('neotopia-auth'))

      await dismissTutorial(host)

      // [4] Snapshot the authoritative state BEFORE the draw (Rule 53 · the DB is the witness).
      const before = await readState(roomId)
      const offerBefore = (before.theOffer ?? []).map(c => c.id)
      const deckBefore = (before.deck ?? []).length
      const handsBefore = totalHandCards(before)
      expect(offerBefore.length, 'a started game must offer cards to draw').toBeGreaterThan(0)
      const clickedId = offerBefore[0] // the FIRST offer card · the one .first() + onDrawOffer(0) will take
      console.log('[draw-ui] before · offer:', offerBefore, '· deck', deckBefore, '· totalHand', handsBefore)

      // [5] Arm the network witness, THEN click the first Offer card. A POST to /rpc/draw_card_for_seat is
      //     emitted ONLY by the wired RPC branch (isRealRoom) · its arrival is the proof the click did not fall
      //     back to the local path. If isRealRoom were false the click would draw locally and this would time
      //     out · an honest RED that says the wiring did not route through the RPC.
      const rpcResponse = host.waitForResponse(
        r => r.url().includes('/rpc/draw_card_for_seat') && r.request().method() === 'POST',
        { timeout: 15_000 },
      )
      const offerCard = host.locator('[data-testid="card-offer"]').first()
      await expect(offerCard, 'an enabled Offer card must be clickable on the host turn').toBeVisible({ timeout: 10_000 })
      await offerCard.click()

      const resp = await rpcResponse
      expect(resp.ok(), `draw_card_for_seat RPC must return 2xx (got ${resp.status()})`).toBe(true)
      console.log('[draw-ui] RPC fired ·', resp.request().method(), resp.status(), '·', resp.url().split('/rest/')[1])

      // [6] The drawn card streams back via useGameSync postgres_changes · poll the DB until exactly one card
      //     has moved into a hand, then assert the full effect.
      let after = null
      await expect.poll(async () => {
        after = await readState(roomId)
        return totalHandCards(after)
      }, { timeout: 15_000, message: 'the RPC draw never landed a card in any hand' }).toBe(handsBefore + 1)

      const offerAfter = (after.theOffer ?? []).map(c => c.id)
      const deckAfter = (after.deck ?? []).length
      // Which seat grew? Diff per-seat hand lengths · exactly one seat, by exactly one, and it must be the host.
      const grewSeats = (after.players ?? [])
        .map(p => ({ seat: p.seat, delta: (p.hand?.length ?? 0) - ((before.players.find(b => b.seat === p.seat)?.hand?.length) ?? 0) }))
        .filter(s => s.delta !== 0)
      const hostHandIds = (after.players.find(p => p.seat === 0)?.hand ?? []).map(c => c.id)
      console.log('[draw-ui] after · offer:', offerAfter, '· deck', deckAfter, '· grew', JSON.stringify(grewSeats))

      expect(grewSeats.length, 'exactly one seat hand should change (no double-fire)').toBe(1)
      expect(grewSeats[0], 'the host (seat 0 · the active turn-holder) is the one who drew, by exactly one card').toEqual({ seat: 0, delta: 1 })
      expect(hostHandIds, 'the clicked Offer card must now be in the host hand').toContain(clickedId)
      expect(offerAfter, 'the drawn card must be gone from The Offer').not.toContain(clickedId)
      expect(offerAfter.length, 'The Offer must shrink by exactly one (refill is deferred to endTurn in both paths)').toBe(offerBefore.length - 1)
      expect(deckAfter, 'an Offer-draw must not pop the deck (only endTurn refills from it)').toBe(deckBefore)

      console.log('[draw-ui] OK · room', roomId, '· clicked', clickedId, 'routed through draw_card_for_seat into the host hand')
    } finally {
      await deleteRoomAsHost(hostSession, roomId)
      await ctx1.close()
      await ctx2.close()
    }
  })
})
