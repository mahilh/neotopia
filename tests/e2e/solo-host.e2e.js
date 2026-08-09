// NeoTopia · THE LONE VISITOR · what actually happens to the person who arrives by themselves (T3 S31).
//
// WHY THIS FILE EXISTS · the population nobody tested
// 33 people have claimed a username in production and 3 game sessions have ever started (T1 S30 ·
// docs, 058a34d · and 97% of the session denominator was our own fixtures, T1's S30 finding). Every
// E2E in this repo drives the room that WORKS: two-human / game-ux / flow-mode-live each open a
// second browser context and join by code, and four-player-live drives all four seats. Not one of
// them models the arrival that actually dominates the funnel — ONE person, alone, with nobody to
// invite. So the single most common path through this product had zero automated coverage, while
// the rarest path (four simultaneous humans) had a nightly.
//
// WHAT THIS PROVES, and it is deliberately unflattering
//   Test 1 · a lone host reaches the waiting room and CANNOT START. That is the current product
//     rule (Lobby.jsx · canStart requires >= 2 players), not a defect, and this test pins it so the
//     rule is a decision rather than an accident. If solo-vs-bot mode ever ships, this test goes red
//     and somebody changes it ON PURPOSE. That is the point of gating a rule you might want to break.
//   Test 2 · THE ROSTER SEAM, settled. The waiting-room roster is built from realtime PRESENCE
//     (usePresence · channel 'lobby:<roomId>'), while game_rooms.player_count is maintained by a
//     SECURITY DEFINER trigger on room_players. Those are two different contracts (Rule 45) and they
//     answer two different questions. This test puts BOTH kinds of participant in ONE room and shows
//     the roster distinguishing them correctly.
//
// THE SUSPICION THIS WAS BUILT TO TEST, and the answer
//   The S31 brief carried a report that a second player was seated, player_count went to 2, and the
//   host still read "0/0 ready" with Start disabled · the suspicion being that the roster reads
//   presence while the database says otherwise, so the count lies to the host and nobody can start.
//   Test 2 reproduces that exact setup and the answer is the other way round: the seat was claimed
//   over the API with no browser behind it, so NOBODY was connected, and presence reported that
//   honestly. The number that does not mean "a player is here" is player_count. Presence is the
//   roster's correct source · a row in room_players proves somebody once claimed a seat, not that
//   they are in the room now.
//   Test 2 keeps the counterweight in the same room, in the same test: a REAL second browser then
//   joins the same code and the roster does move to 2. Without that contrast "roster shows 1" would
//   be indistinguishable from "presence is broken", and the verdict above would be unearned.
//
// COST · 4 anonymous sign-ins per full run (1 + 3), plus one on globalTeardown, against a measured
// budget of 30/hour/IP (docs/ANON_SIGNIN_BUDGET.md). Local + merge-gate-able: it drives localhost
// like every other spec here (playwright.config.js baseURL), and its only live dependency is
// Supabase, which every spec in this directory already needs.
//
// Run:  node scripts/with-project-env.cjs npx playwright test tests/e2e/solo-host.e2e.js
//   The wrapper is NOT optional on the author's machine: ~/.zshrc exports a different project's
//   VITE_SUPABASE_URL, seedHelpers.loadEnv reads process.env FIRST, and a bare `npx playwright test`
//   therefore points every Node-side helper at a dead host and fails as "anon sign-in: fetch failed".
//   The browser half is unaffected (npm run dev already wraps itself), which is what makes the
//   symptom so confusing · half the test talks to the right database.

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, signInAnonRetry, deleteRoomAsHost, uniqueName } from './seedHelpers'
import { assertSessionEstablished } from './preconditions'

const NAME_INPUT = 'Builder name (max 20)'

test.beforeEach(() => { test.setTimeout(120_000) })


// Entry is resilient to which screen '/' is (Landing CTA or the lobby itself) · same shape as
// two-human.e2e.js, which is the proven path (Rule 36 · mirror the real setup path, do not invent one).
async function claimName(page, name) {
  await page.goto('/')
  const input = page.getByPlaceholder(NAME_INPUT)
  const enterCiv = page.getByRole('button', { name: /enter the civilization/i })
  await expect(input.or(enterCiv).first()).toBeVisible({ timeout: 15_000 })
  if (await enterCiv.isVisible()) {
    await enterCiv.click()
    await expect(input).toBeVisible({ timeout: 15_000 })
  }
  // The gate BEFORE the first feature locator (T3 S27). Without it a rate-limited or unreachable
  // backend reports itself here as "Create Room not found" and sends the reader after a component.
  await assertSessionEstablished(page, input, { context: 'solo-host · claim screen' })
  await input.fill(name)
  await page.getByRole('button', { name: /enter neotopia/i }).click()
}

// The host's start control. T1's S31 work adds data-testid="start-btn"; before it, the button is
// identifiable only by its own label, which CHANGES with state ('Start Game' when enabled, a
// "Waiting for…" sentence when not). Accepting either keeps this spec valid on both sides of that
// commit boundary rather than going red on a copy change in another lane (Rule 67 · gate on what is
// true WHERE the gate runs · CI checks out origin, not this working tree).
function startButton(page) {
  return page.getByTestId('start-btn')
    .or(page.getByRole('button', { name: /^(Start Game|Waiting for|Connecting to the room)/i }))
    .first()
}

// Count the PLAYERS in the waiting-room roster.
//
// Counting rows by their container div overcounts wildly (every ancestor also contains the text), and
// counting avatars catches the "+ Waiting for player…" placeholder, which is not a player. Each real
// row carries exactly ONE badge span whose entire text is 'HOST' (the host) or 'Ready'/'Waiting' (a
// joiner) · Lobby.jsx renders them as a strict either/or. Exact-text spans are therefore a 1:1 count
// of rendered players, and the placeholder row ("Waiting for player…") is excluded by the exactness.
async function rosterCount(page) {
  return page.evaluate(() => {
    const BADGES = new Set(['HOST', 'Ready', 'Waiting'])
    return Array.from(document.querySelectorAll('span'))
      .filter(s => BADGES.has((s.textContent ?? '').trim())).length
  })
}

test.describe('the lone visitor · the arrival nothing else models', () => {
  test('a host alone in a room they just made cannot start, and the room is real', async ({ page }) => {
    let roomId = null
    let sessionJson = null
    try {
      await claimName(page, uniqueName('E2ESOLO'))
      await page.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })

      // [1] THE ROOM IS REAL. A disabled Start button could equally mean "the room was never
      //     created", which is a completely different failure, so prove the room exists first.
      const codeEl = page.locator('[data-testid="room-code"]')
      await expect(codeEl, 'the waiting room must render a room code').toBeVisible({ timeout: 20_000 })
      const code = (await codeEl.textContent())?.trim() ?? ''
      expect(code, `room code "${code}" is not 6 chars A-Z0-9`).toMatch(/^[A-Z0-9]{6}$/)

      // [2] THE HOST CAN SEE THEMSELVES. lobbyPlayers comes from presence, and the host is always in
      //     their own presence state once the channel subscribes · an EMPTY roster here would mean
      //     the channel never synced, which is a transport fault and NOT the product rule under test.
      //     Asserting it separately keeps test [3] from passing for the wrong reason.
      await expect(page.getByText('HOST', { exact: true }), 'the host must appear in their own roster · an empty roster is a presence failure, not an empty room')
        .toBeVisible({ timeout: 20_000 })
      expect(await rosterCount(page), 'exactly one player · the host, and nobody else').toBe(1)

      // [3] AND THEY CANNOT START. This is the wall the funnel hits.
      const start = startButton(page)
      await expect(start).toBeVisible({ timeout: 10_000 })
      await expect(start, 'a lone host must not be able to start · canStart requires >= 2 players (Lobby.jsx)')
        .toBeDisabled()

      // [4] IT STAYS DISABLED. A button that enables a moment later would make this a race, not a
      //     rule · and a lone host staring at the screen is exactly the person who would wait.
      await page.waitForTimeout(5_000)
      await expect(start, 'Start must remain disabled while the host is alone · not merely be slow to enable')
        .toBeDisabled()

      // [5] THE ONE ACTION THEY DO HAVE. If a lone host cannot start, the invite affordance is the
      //     only forward path on this screen, so its absence would make the room a dead end.
      await expect(page.getByTestId('copy-invite-link'), 'a host who cannot start must at least be able to invite')
        .toBeEnabled()

      sessionJson = await page.evaluate(() => localStorage.getItem('neotopia-auth'))
      roomId = await lookupRoomId(code)
    } finally {
      // The room is BROWSER-owned, so it is deleted by adopting the host page's own session (005 ·
      // rooms_delete_host) rather than a service role · the same discipline two-human.e2e.js uses.
      await deleteRoomAsHost(sessionJson, roomId)
    }
  })

  test('a seat claimed without a browser is not a player in the room · and a real one is', async ({ browser }) => {
    const { url, key } = loadEnv()
    const ctxHost = await browser.newContext()
    const ctxJoiner = await browser.newContext()
    const host = await ctxHost.newPage()
    const joiner = await ctxJoiner.newPage()
    let ghost = null
    let roomId = null
    let sessionJson = null

    try {
      // ── the host, in a browser ────────────────────────────────────────────────────────────────
      // NOT 'E2EHOST' · a display name containing the substring HOST collides with the roster's own
      // HOST badge and makes getByText ambiguous. The fixture must not be able to impersonate the
      // thing under test.
      await claimName(host, uniqueName('E2EOWNER'))
      await host.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })
      const codeEl = host.locator('[data-testid="room-code"]')
      await expect(codeEl).toBeVisible({ timeout: 20_000 })
      const code = (await codeEl.textContent())?.trim() ?? ''
      await expect(host.getByText('HOST', { exact: true })).toBeVisible({ timeout: 20_000 })
      const before = await rosterCount(host)
      expect(before, 'the host should see exactly themselves before anyone else arrives').toBe(1)

      roomId = await lookupRoomId(code)
      expect(roomId, 'the room must exist in the database').toBeTruthy()
      sessionJson = await host.evaluate(() => localStorage.getItem('neotopia-auth'))

      // ── the ghost · a seat claimed over the API, exactly as a script or another terminal does ──
      // This is the participant the S31 report described. It is a legitimate room_players row: it
      // passes migration 016's room_players_join policy (room is 'waiting', under capacity) and it
      // fires trg_player_count. What it does NOT have is a browser, a channel, or a presence entry.
      ghost = createClient(url, key, { auth: { storageKey: 'neotopia-e2e-ghost', persistSession: false } })
      const auth = await signInAnonRetry(ghost, 4)
      const { error: insErr } = await ghost.from('room_players').insert({
        room_id: roomId, user_id: auth.user.id, username: 'GHOST_SEAT',
        player_color: 'red', seat_number: 1, is_ready: true,
      })
      expect(insErr, `the ghost seat must actually be written, or this test proves nothing: ${insErr?.message}`).toBeNull()

      // THE DATABASE SAYS TWO. Both contracts, read from the system of record rather than inferred.
      await expect.poll(async () => {
        const { data } = await ghost.from('game_rooms').select('player_count').eq('id', roomId).maybeSingle()
        return data?.player_count ?? null
      }, { timeout: 15_000, message: 'trg_player_count must recount room_players after the insert' }).toBe(2)
      const { count: seatRows } = await ghost
        .from('room_players').select('*', { count: 'exact', head: true }).eq('room_id', roomId)
      expect(seatRows, 'two seats are claimed in the database').toBe(2)

      // THE ROSTER SAYS ONE, AND IT IS RIGHT. Given a generous window: this asserts a NEGATIVE, so it
      // has to be slow enough that "presence had not synced yet" cannot explain the result.
      await host.waitForTimeout(8_000)
      const withGhost = await rosterCount(host)
      expect(withGhost,
        'a seat with no browser behind it must NOT appear as a player in the room · presence answers ' +
        '"who is connected", player_count answers "who ever sat down", and only the first can start a game')
        .toBe(1)
      await expect(startButton(host), 'a ghost seat must not enable Start · nobody is there to play')
        .toBeDisabled()

      // ── the counterweight · a REAL browser joins the SAME room by the SAME code ───────────────
      // Without this the assertion above would be worthless: "roster shows 1" is also what a broken
      // presence channel looks like. Same room, same host page, different kind of participant.
      await claimName(joiner, uniqueName('E2EGUEST'))
      await joiner.getByRole('button', { name: 'Join Room' }).click({ timeout: 15_000 })
      await joiner.getByPlaceholder('ABC234').fill(code)
      await joiner.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 15_000 })
      await expect(joiner.getByRole('button', { name: /click when ready/i }),
        'the joiner must reach the waiting room · seat 2 is free (the ghost holds seat 1)')
        .toBeVisible({ timeout: 20_000 })

      await expect.poll(() => rosterCount(host), {
        timeout: 25_000,
        message: 'a real browser MUST converge into the host roster · if this fails the negative above ' +
                 'proved nothing, because it would mean presence is simply broken',
      }).toBe(2)

      // AND THE BUTTON MOVES. Every Start assertion in this file so far is a NEGATIVE, and a locator
      // that silently matched the wrong element (or nothing) would satisfy all of them. Here the same
      // startButton(host) locator, on the same page, must reach the opposite verdict once a real
      // player readies · so no disabled-assertion above can be a rubber stamp (Rule 72 · a green run
      // proves execution, not soundness · the contrast is what proves the verdict tracks evidence).
      await joiner.getByRole('button', { name: /click when ready/i }).click({ timeout: 15_000 })
      await expect(startButton(host), 'Start MUST enable once a real second player is ready · otherwise ' +
        'the disabled assertions above prove nothing about the button')
        .toBeEnabled({ timeout: 30_000 })
    } finally {
      // room_players_delete_own scopes this to the ghost's OWN row · the host's and joiner's rows go
      // with the room below (005 cascade). Stated rather than implied: this line looks broader than it is.
      if (ghost) { try { await ghost.from('room_players').delete().eq('room_id', roomId) } catch { /* best-effort */ } }
      await deleteRoomAsHost(sessionJson, roomId)
      await ctxHost.close()
      await ctxJoiner.close()
    }
  })
})

// room_code → id with the PUBLIC anon key and no session · rooms_read_all makes this a free read
// (no sign-in spent). Declared after use on purpose: it is plumbing, and the tests read better first.
async function lookupRoomId(code) {
  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await client.from('game_rooms').select('id').eq('room_code', code).maybeSingle()
  return data?.id ?? null
}
