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
export { uniqueName, UI_RESERVED_WORDS, makeRoomCode } from './fixtureNames.js'
import { makeRoomCode as _makeRoomCode } from './fixtureNames.js'

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

  // ── AND DISMISS THE TUTORIAL, IN BOTH BROWSERS, OR NOTHING BELOW THIS CAN BE CLICKED ──────────────────
  // MEASURED (T3 S40), after a whole session last time spent guessing at this exact stall. GameRoom holds
  // `useState(() => !tutorialSeen())` (GameRoom.jsx:196) and tutorialSeen reads localStorage
  // (Tutorial.jsx:15). EVERY Playwright context starts with empty localStorage, so the tutorial is up for
  // every live spec, always · and it renders on `phase === 'playing'`, which is the instant a driver starts
  // clicking. On the practice board, with the tutorial up, document.elementFromPoint at the centre of all
  // three factories returned a plain HTML <div>/<p> with `containsHit: false`, and a real mouse click left
  // uiPhase at 'idle'. With it dismissed the same click gives 'factorySelected' and the hit is a <text>
  // INSIDE the factory <g> (containsHit true · Rule 83's `el.contains(top)` correction, exactly).
  // THAT is what stalled S39: seat 0 held 2 actions and 4 offer cards and neither a placement nor a draw
  // committed, because every click was landing on the tutorial. Not uiPhase, which was my hypothesis and is
  // falsified twice over (handleDrawCard never reads it, and the dim-the-rest CSS is opacity-only).
  // It belongs HERE rather than in one spec: every live spec that reaches a board needs it, and the two
  // that already exist were both missing it, silently, because an overlay does not announce itself.
  for (const p of [p1, p2]) {
    const skip = p.getByTestId('tutorial-skip')
    if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 10_000 })
    await expect(p.getByRole('dialog', { name: /how to play/i }),
      'the tutorial is still up · every click below it lands on the overlay, not on the board')
      .toBeHidden({ timeout: 10_000 })
  }

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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE REACHABILITY PROBE IS T1's · THIS ONLY PROVES IT CAN STILL SEE (T3 S41)
//
// I wrote my own version of this earlier in the same session and DELETED IT, which is the right outcome and
// worth recording rather than hiding. Mahil ruled one implementation, T1's, because they found the defect
// that a fresh writing gets wrong · three factory cells report an SVG <text> on top and are NOT broken,
// since it sits inside the <g> carrying onFactoryClick. Mine credited the handler ancestor too (I built it
// from T1's published correction), but theirs also carries `measured` and `requireInViewport`, which are
// the two halves mine was weaker on. Two implementations would have been a second contract AND a second
// witness, which is T1's own Rule 94.
//
// SO THE ONLY THING HERE IS THE PART THEIRS DOES NOT DO: proving the probe can still detect a covered board
// before its all-clear is believed. `measured` already catches "the selector matched nothing"; it cannot
// catch "the check credits so much that nothing can ever fail it", which is the live risk precisely BECAUSE
// the probe is deliberately generous about handler-bearing ancestors. One `contains` on the wrong node and
// every cell passes forever, on a gate whose whole job is to be believed.
// So: drop a real full-viewport overlay, require the SAME probe to call every cell blocked, remove it, and
// require the all-clear back. A positive and a negative control in one call. I checked exactly this by hand
// last session in a scratch file I then deleted · a rule stated as a fact gets rediscovered, a rule
// expressed as a function cannot be (Rule 90).
export async function selfTestReachability(page, reachability, opts = {}) {
  const run = () => page.evaluate(reachability, opts)
  const before = await run()
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.id = '__t3_reach_selftest'
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.01)'
    document.body.appendChild(d)
  })
  const covered = await run()
  await page.evaluate(() => document.getElementById('__t3_reach_selftest')?.remove())
  const after = await run()
  return {
    probed: before.total,
    measured: before.measured,
    blockedNormally: before.blocked,
    blockedWhenCovered: covered.blocked,
    blockedAfterRemoval: after.blocked,
    sees: before.measured && before.total > 0 && covered.blocked === covered.total && after.blocked === before.blocked,
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE DIAGNOSTIC HAS TO PROVE IT CAN SEE, BEFORE IT IS TRUSTED TO EXPLAIN A FAILURE (T3 S41 · Rule 80 + 90)
//
// endgame-live's diagnose() reports counts of element-btn / region-btn / hex-valid and the value of
// data-ui-phase. EVERY ONE OF THOSE DEGRADES TO A PLAUSIBLE VALUE when its selector is wrong: a renamed
// testid reports 0, which is indistinguishable from an honest "none right now", and a missing root reports
// a string. That is Rule 80 exactly · a counter that cannot measure must say so, never resolve to a number
// · and last session I validated these by hand, in a scratch probe I then deleted. A rule stated as a fact
// gets rediscovered; a rule expressed as a function cannot be (Rule 90).
//
// IT COSTS NOTHING TO RUN, and that is why it can be unconditional. Selecting a factory, an element and a
// region spends NO game action · only the hex click commits (useGameActions.js:116-130) · and clicking the
// same factory again toggles the whole selection off (useGameActions.js:73). So this walks the real 4-step
// interface, requires each selector to MOVE from 0, and puts the board back exactly where it found it.
// A counter that never changes is not measuring; this is the difference between reading a zero and
// believing one.
export async function assertDiagnoseCanSee(page, { expect, factoryId = 0 } = {}) {
  const look = () => page.evaluate(() => {
    const root = document.querySelector('[data-ui-phase]')
    const n = (sel) => document.querySelectorAll(sel).length
    return {
      uiPhase: root?.getAttribute('data-ui-phase') ?? 'NO-ROOT',
      myTurn: root?.getAttribute('data-my-turn') ?? 'unset',
      factory: n('[data-testid="factory"]'),
      elementBtn: n('[data-testid="element-btn"]'),
      regionBtn: n('[data-testid="region-btn"]'),
      hexValid: n('[data-testid="hex-valid"]'),
      cardOffer: n('[data-testid="card-offer"]'),
    }
  })

  // 1 · the selectors that must NEVER legitimately be zero on a dealt board.
  const idle = await look()
  expect(idle.uiPhase, 'data-ui-phase is not on the GameRoom root · diagnose() would report NO-ROOT for the ' +
    'rest of the run and every stall would look like the same one').not.toBe('NO-ROOT')
  expect(idle.myTurn, 'data-my-turn is missing · diagnose() cannot tell "not my turn" from "dead control"')
    .not.toBe('unset')
  expect(idle.factory, 'the factory testid matched nothing on a dealt board · the selector is wrong, and ' +
    'every later reading of 0 would be a broken selector wearing the costume of a measurement').toBe(3)
  expect(idle.cardOffer, 'the card-offer testid matched nothing on a dealt board').toBeGreaterThan(0)

  // 2 · the CONDITIONAL selectors, which are legitimately 0 at idle · so make them move, for free.
  const plan = await page.evaluate((fid) => {
    const g = window.__neotopia_store?.getState?.()
    const f = g?.factories?.find(x => x.id === fid) ?? g?.factories?.[0]
    if (!f) return null
    const el = f.elements.find(e => e.count > 0)
    if (!el) return null
    for (const rid of f.betweenRegions) {
      if (g.getValidPlacements?.(f.id, rid)?.length) return { factoryId: f.id, element: el.type, regionId: rid }
    }
    return null
  }, factoryId)
  if (!plan) return { walked: false, reason: 'no legal opening move to walk · invariants still checked' }

  // force:true throughout · the factory <g> carries an infinite pulse animation, so a plain click never
  // settles and times out (Rule 93 · that swallowed timeout is what hid the tutorial overlay for a session).
  await page.locator(`[data-testid="factory"][data-factory="${plan.factoryId}"]`).click({ force: true, timeout: 5_000 })
  const afterFactory = await look()
  expect(afterFactory.elementBtn, 'a factory was selected and the element-btn selector still matched ' +
    'nothing · diagnose() cannot see the element step, so "factory-inert" would be unfalsifiable')
    .toBeGreaterThan(0)

  await page.locator(`[data-testid="element-btn"][data-element="${plan.element}"]`).first().click({ timeout: 5_000 })
  const afterElement = await look()
  expect(afterElement.regionBtn, 'an element was selected and the region-btn selector still matched nothing')
    .toBeGreaterThan(0)

  await page.locator(`[data-testid="region-btn"][data-region="${plan.regionId}"]`).first().click({ timeout: 5_000 })
  const afterRegion = await look()
  expect(afterRegion.hexValid, 'a region was selected and the hex-valid selector still matched nothing · ' +
    'diagnose() cannot see the board, so "region-inert" would fire on a working game').toBeGreaterThan(0)

  // 3 · put it back. Clicking the SAME factory toggles the selection off (useGameActions.js:73). Nothing
  // was committed, so the game under test is exactly where it was · this must never cost the caller a turn.
  await page.locator(`[data-testid="factory"][data-factory="${plan.factoryId}"]`).click({ force: true, timeout: 5_000 })
  const back = await look()
  expect(back.uiPhase, 'the self-check left the interface mid-selection · it has to hand the board back ' +
    'untouched or it is not free').toBe('idle')

  return {
    walked: true,
    saw: { elementBtn: afterFactory.elementBtn, regionBtn: afterElement.regionBtn, hexValid: afterRegion.hexValid },
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE ACTION DRIVER · MOVED OUT OF endgame-live.e2e.js SO IT CAN BE TESTED WITHOUT PAYING FOR A ROOM (T3 S46)
//
// It lived inside the live spec, which meant the ONLY way to find out whether it worked was a two-anon-sign-in
// run against the real backend · so every driver defect cost a live run to observe, and five of them did.
// Nothing in here is multiplayer: it drives the four-step placement path and the offer, both of which exist
// on the free practice board. Importing a spec to reuse a function would register that spec's tests, so the
// right home is here, where nothing runs on import.
// The caller passes `expect` rather than this module importing @playwright/test · seedHelpers is loaded by
// vitest-adjacent code paths too, and a Playwright import at module scope would drag the runner in.
export const SNAPSHOT = () => {
  const g = window.__neotopia_store?.getState?.()
  if (!g) return null
  return {
    phase: g.phase,
    currentSeat: g.currentSeat,
    turnNumber: g.turnNumber,
    actionsRemaining: g.actionsRemaining,
    tiles: g.productionTilesRemaining,
    triggered: !!g.endGameTriggered,
    rounds: g.endGameRoundsRemaining,
    offer: g.theOffer?.length ?? 0,
    factories: (g.factories ?? []).map(f => f.elements.reduce((n, e) => n + e.count, 0)),
    placed: (g.regions ?? []).reduce((n, r) => n + Object.values(r.hexes ?? {}).filter(h => h?.element).length, 0),
  }
}
export const read = (page) => page.evaluate(SNAPSHOT)

/**
 * Spend ONE action in the browser whose turn it is, through the real interface.
 * Placement first (that is the only action that can advance the production clock), drawing as the fallback.
 *
 * ALWAYS returns an object, and on failure it NAMES THE STEP IT DIED ON instead of collapsing every
 * failure into one indistinguishable null (T3 S40):
 *     { action: 'place' | 'draw', stage: 'ok', plan? }
 *     { action: null, stage, why, plan, ...snapshot, ui: { uiPhase, myTurn, drawStatus, counts } }
 * stage is one of:
 *     no-legal-move   the engine offers no placement anywhere AND there is no offer to draw from ·
 *                     a legitimate end of turn, not necessarily a defect
 *     factory-inert   engine offers the move, factory clicked, element-btn never appeared
 *     element-inert   element clicked, region-btn never appeared
 *     region-inert    region clicked, board rendered ZERO hex-valid nodes · UI and engine disagree
 *     hexes-covered   hex-valid nodes exist and none committed at its own centre
 *     offer-inert     the offer is on screen and a real click spent nothing · read ui.drawStatus
 *     no-draw-after-placement-failed   the placement path failed and there is nothing to fall back on
 *
 * force:true on the hex is REQUIRED and load-bearing · hexPulse animates the <g> bbox forever, so
 * Playwright's click-stability wait times out before onClick→placeElement ever fires. Documented in
 * CLAUDE.md ("Bot: ALL steps force:true") and proven against the DB in S12. Every other click here is a
 * normal one, so reachability is still being tested everywhere it can be.
 */
export async function spendOneAction(page, { expect }) {
  // THE ENGINE IS THE JUDGE, NOT THIS HARNESS · and the first version of this function forgot that, which
  // cost a five-minute live run. It returned 'draw' as soon as a card-offer was VISIBLE, and card-offer is
  // visible whether or not it is your turn. So on any turn the harness got wrong, every click did nothing,
  // the loop counted a draw that never happened, and it spun to the test timeout without ever throwing ·
  // a harness reporting progress it had not made. Exactly the shape of Rule 53, and of the S35 note that a
  // disabled control silently does nothing. The offline driver above already checks actionsRemaining after
  // every placement; this is that same discipline applied to the browser.
  // The store mutates LOCALLY on click, well before the pushState round trip · measured at 114-202ms per
  // committed placement on a warm board. `tries` is short by default because this runs inside a loop over
  // candidate hexes: a generous poll there would turn "try eight" into ten seconds an action.
  // EVERY click below carries an explicit timeout. Playwright has NO default action timeout, so a click
  // that cannot resolve waits FOREVER · which is exactly how six live runs died: the play loop logged one
  // heartbeat and never produced a second, because spendOneAction never returned. A test timeout then
  // reports "5.0m exceeded" with no step, and the harness looks like the product.
  // `tries` is short by default because a PLACEMENT commits LOCALLY · placeElement mutates the store and
  // only then persists (useGameActions.js:126-130), measured at 114-202ms on a warm board · and this runs
  // inside a loop over candidate hexes, where a generous poll would turn "try eight" into ten seconds.
  //
  // A DRAW IN A REAL ROOM IS NOT THAT, and assuming it was is what actually killed S39 (see the offer
  // branch below). Callers that go through the network pass their own budget.
  const spent = async (fn, tries = 4, waitMs = 80) => {
    const before = (await read(page))?.actionsRemaining
    await fn()
    for (let i = 0; i < tries; i++) {
      const now = (await read(page))?.actionsRemaining
      if (typeof now === 'number' && typeof before === 'number' && now < before) return true
      // A refusal is authoritative and instant · stop waiting for a round trip that already failed.
      const refusal = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="draw-status"]')
        const t = s ? (s.textContent || '').trim() : ''
        return t && t !== 'Drawing…' ? t : null
      }).catch(() => null)
      if (refusal) return false
      await page.waitForTimeout(waitMs)
    }
    return false
  }

  // ── IT HAS TO SAY WHERE IT STOPPED (T3 S40 · acting on my own S39 closing recommendation) ───────────────
  // This function used to return a bare `null` for THREE different failures: no legal move exists, a legal
  // move exists but no hex is clickable, and a legal move exists but the UI ignores clicks entirely. Those
  // need OPPOSITE responses · end the turn, file a board defect, file a UI defect · and it reported them
  // identically, so six live runs last session produced a hypothesis instead of a diagnosis, and the
  // hypothesis I did form (uiPhase) turned out to be wrong in both of its halves. Rule 90's corollary says
  // an instrument that cannot say WHERE it stopped has not measured anything; that was written about the
  // missing per-iteration heartbeat, and this is the same defect one level down, inside the step.
  //
  // IT READS THE DOM AND NOT ONLY THE STORE, and that is the point rather than an implementation detail:
  // uiPhase is React state inside useGameActions, mirrored out only as `data-ui-phase` on the GameRoom root
  // (GameRoom.jsx:510), so a store snapshot CANNOT see which step the interface believes it is on. Same for
  // draw-status, the only external trace of isDrawingCard. The two facts most likely to explain a stall are
  // both invisible to the seam this spec otherwise reads through.
  //
  // ⚠ EVERY COUNT BELOW DEGRADES TO 0 IF ITS SELECTOR IS WRONG, which is indistinguishable from an honest
  // "none right now" · Rule 80, inside the instrument I diagnose with. That is guarded, and NOT here:
  // seedHelpers.assertDiagnoseCanSee walks the same selectors on the free practice board and requires each
  // one to MOVE off zero, on the MERGE GATE (practice.e2e.js · "the endgame diagnostic can still see").
  // It lives there rather than in this file on purpose · this spec is nightly-class and currently fixme, so
  // a self-check here would protect nothing today and would rot exactly as Rule 79 describes. It is also
  // deliberately NOT called mid-run: it is proven free (it selects and deselects, committing nothing), but
  // this run is evidence handed to another lane, and an instrument should not add clicks to the thing it
  // is measuring. Mutation-proven: renaming element-btn, region-btn or hex-valid reds it, each of the three.
  const diagnose = async () => ({
    ...(await read(page)),
    ui: await page.evaluate(() => {
      const root = document.querySelector('[data-ui-phase]')
      const status = document.querySelector('[data-testid="draw-status"]')
      const n = (sel) => document.querySelectorAll(sel).length
      return {
        uiPhase: root?.getAttribute('data-ui-phase') ?? 'NO-ROOT',
        myTurn: root?.getAttribute('data-my-turn') ?? 'unset',
        drawStatus: status ? ((status.textContent || '').trim() || 'EMPTY') : null,
        counts: {
          factory: n('[data-testid="factory"]'),
          elementBtn: n('[data-testid="element-btn"]'),
          regionBtn: n('[data-testid="region-btn"]'),
          hexValid: n('[data-testid="hex-valid"]'),
          cardOffer: n('[data-testid="card-offer"]'),
        },
      }
      // A failed evaluate must not masquerade as a diagnosis (Rule 80 · never resolve to a plausible value).
    }).catch((e) => ({ uiPhase: `UNMEASURED · evaluate failed: ${e.message}` })),
  })
  const stopped = async (stage, why, plan = null) => ({ action: null, stage, why, plan, ...(await diagnose()) })

  // ASK THE ENGINE WHICH MOVE IS LEGAL, THEN MAKE THAT EXACT MOVE THROUGH THE REAL UI.
  //
  // The first version took `.first()` of the element buttons and `.first()` of the region buttons and gave
  // up on the whole factory if that one combination had no valid hex · while the OFFLINE driver twenty
  // lines above searches every element against every region of every factory. That asymmetry is the bug:
  // a free probe on the solo /game board showed the click path committing placements in 114-202ms and then
  // returning NOTHING COMMITTED the moment the first element/first region pair ran out of legal hexes,
  // with all three factories full. Four live runs (eight anon identities) died at the test timeout before
  // that was measured, because I kept asking the expensive question instead of the cheap one.
  //
  // This is a READ of the store used as an oracle for WHICH legal move exists · the move itself is still
  // four real clicks on the real controls, and `spent` still makes the engine the judge of whether it
  // landed. Same shape the offline driver uses, and the same shape as reading getValidPlacements there.
  // ── WAIT FOR THE INTERFACE TO REACH THE STEP YOU JUST ASKED FOR (T3 S46) ────────────────────────────────
  // THE FLAKINESS WAS RULE 82, IN MY OWN DRIVER, THREE TIMES. Each step did
  //     await thing.click(...).catch(() => {})
  //     if (!(await next.isVisible({ timeout: 1_500 }))) return stopped('...-inert')
  // and `locator.isVisible()` IS A POINT-IN-TIME CHECK THAT IGNORES ITS TIMEOUT OPTION ENTIRELY. So the
  // driver clicked a factory and asked microseconds later whether the element buttons had appeared ·
  // before React had re-rendered · and reported the control as INERT. That is the exact defect I wrote
  // Rule 82 about in S37 ("a probe that answers instantly has not answered a question about waiting"),
  // sitting in the file that quotes it. It is why runs failed at `factory-inert` and `element-inert` on
  // some deals and not others: whether the render beat the assertion was a race.
  //
  // expect(locator).toBeVisible({ timeout }) RETRIES · that is the whole difference. This wrapper keeps
  // the NAMED failure (the diagnostic is the thing that made these runs readable at all) while making the
  // wait real, so a stage name now means "the interface never got there in N seconds" rather than "it had
  // not got there yet when I looked".
  const stepReached = async (locator, ms = 6_000) => {
    try { await expect(locator).toBeVisible({ timeout: ms }); return true } catch { return false }
  }

  // AND THE CLICK ITSELF MUST NOT BE SWALLOWED (T3 S46 · Rule 93, in the file that documents Rule 93).
  // Every step did `.click({ timeout: 2_000 }).catch(() => {})`, so a click that never landed produced the
  // SAME symptom as a control that never appeared · and the driver then reported `factory-inert`, blaming
  // the interface for a click it had discarded the failure of. MEASURED under 20x CPU throttling: 33%
  // success with 11 factory-inert, which is not an inert factory at all, it is a 2s click timeout losing
  // to a slow render. A misleading stage name is worse than none, because it routes the next session at
  // the wrong lane.
  const clickOrReport = async (locator, opts = {}) => {
    try { await locator.click({ timeout: 8_000, ...opts }); return null }
    catch (e) { return e.message.split('\n')[0] }
  }

  const plan = await page.evaluate(() => {
    const g = window.__neotopia_store?.getState?.()
    if (!g) return null
    for (const f of g.factories) {
      for (const el of f.elements) {
        if (el.count <= 0) continue
        for (const rid of f.betweenRegions) {
          const spots = g.getValidPlacements?.(f.id, rid)
          if (spots?.length) return { factoryId: f.id, element: el.type, regionId: rid }
        }
      }
    }
    return null
  })

  if (plan) {
    const facErr = await clickOrReport(
      page.locator(`[data-testid="factory"][data-factory="${plan.factoryId}"]`), { force: true })
    if (facErr) return stopped('factory-click-failed', `the factory could not be clicked: ${facErr}`, plan)
    const el = page.locator(`[data-testid="element-btn"][data-element="${plan.element}"]`).first()
    if (!(await stepReached(el))) {
      return stopped('factory-inert', `the engine offers ${plan.element} from ${plan.factoryId} into ` +
        `${plan.regionId}, the factory was clicked, and no element-btn for ${plan.element} ever appeared`, plan)
    }
    const elErr = await clickOrReport(el)
    if (elErr) return stopped('element-click-failed', `${plan.element} could not be clicked: ${elErr}`, plan)
    const region = page.locator(`[data-testid="region-btn"][data-region="${plan.regionId}"]`).first()
    if (!(await stepReached(region))) {
      return stopped('element-inert', `${plan.element} was clicked and no region-btn for ${plan.regionId} ` +
        'ever appeared · the element step did not advance the interface', plan)
    }
    const regErr = await clickOrReport(region)
    if (regErr) return stopped('region-click-failed', `${plan.regionId} could not be clicked: ${regErr}`, plan)
    // TRY EVERY OFFERED HEX, not just the first in DOM order. The engine can report several valid spots
    // while a particular one is momentarily unclickable, and only reporting failure if NONE lands keeps
    // this from blaming the product for one bad target.
    // force:true is required on THESE clicks only · hexPulse animates the <g> bbox forever so the
    // stability wait never settles (CLAUDE.md "Bot: ALL steps force:true", DB-proven in S12).
    //
    // ── THE OFF-CENTRE WORKAROUND IS GONE (T3 S41), AND REMOVING IT IS THE POINT ────────────────────────
    // This used to click each hex at its centre and then at 18% and 82% of its height, because in S39 I
    // measured 13 of 97 legal offers with an SVG <text> sitting at their own centre. T1 fixed that in
    // 4fcb539 · `pointer-events: none` on every board <text>, structural rather than a nudge · and I now
    // gate it in a real browser (practice.e2e.js · 60 of 60 cells reachable at six widths, mutation-proven
    // to red at "3 of 60 · hit: text" the moment the fix is reverted).
    // A WORKAROUND THAT SILENTLY RESCUES A REGRESSION IS A GATE THAT CANNOT SEE IT. Left in, these offsets
    // would let the driver keep placing on a board where the centre click is dead again, and the only
    // symptom a future session would get is the same one that cost S39: everything looks fine until it
    // inexplicably does not. The centre click is the player's click, so it is the only one this asks for.
    const hexes = await page.getByTestId('hex-valid').all()
    if (hexes.length === 0) {
      return stopped('region-inert', `${plan.regionId} was clicked and the board rendered ZERO hex-valid ` +
        'nodes while the engine says the placement is legal · the UI and the engine disagree', plan)
    }
    const tried = []
    for (const hex of hexes.slice(0, 8)) {
      if (await spent(() => hex.click({ force: true, timeout: 3_000 }).catch(() => {}))) {
        return { action: 'place', stage: 'ok', plan }
      }
      const box = await hex.boundingBox().catch(() => null)
      tried.push(box ? `${Math.round(box.x)},${Math.round(box.y)}` : 'no-box')
    }
    return stopped('hexes-covered', `the engine offers the move, the board rendered ${hexes.length} ` +
      `hex-valid nodes, and NONE of the ${tried.length} tried committed at its own centre. The board ` +
      `reachability gate in practice.e2e.js covers the covered-label defect (T1 4fcb539), so if THAT is ` +
      `green this is the action layer ` +
      `refusing the click (tried ${tried.join(' ')})`, plan)
  }

  // Fallback · drawing spends an action without touching the production clock, which is what the turns
  // AFTER the trigger need. It is second because only a placement can advance the clock.
  const offer = page.getByTestId('card-offer').first()
  if (!(await stepReached(offer, 2_000))) {
    return stopped(plan ? 'no-draw-after-placement-failed' : 'no-legal-move',
      plan ? 'the placement path failed above and there is no card-offer to fall back on'
        : 'the engine reports no legal placement in any factory/region pair, and no card-offer is visible ' +
          '· this is a legitimate end-of-turn, not necessarily a defect')
  }
  // ── THE DRAW IS REMOTE IN A REAL ROOM, AND THE OLD BUDGET ASSUMED IT WAS LOCAL ─────────────────────────
  // A SEPARATE, LATENT DEFECT · NOT the cause of the S39 stall. Saying so explicitly because writing down
  // the plausible cause instead of the measured one is the mistake this whole session is about: the stall
  // was the TUTORIAL OVERLAY (see seedHelpers.runTwoHumanLobby), measured, and this is a second thing that
  // was also wrong and would have bitten on the very next run.
  // READ FROM THE CODE, not yet exercised live, and labelled as that. In a real room GameRoom.onDrawOffer
  // takes the `isRealRoom` branch (roomId && sessionId && mySeat != null · GameRoom.jsx:361-368) and calls
  // draw_card_for_seat. That RPC does the whole draw SERVER-side · pops the card, appends it to the hand,
  // and decrements actionsRemaining inside the row lock (011_atomic_draw_rpc.sql:147-161) · then RETURNS.
  // It never touches this client's store. The local actionsRemaining moves only once the UPDATE streams
  // back through postgres_changes and syncFromServer applies it: a Mumbai round trip plus realtime
  // propagation. The old code polled 12 x 80ms = 960ms for a LOCAL decrement, and the caller threw on the
  // first null with no retry, so a draw that SUCCEEDED server-side would be reported as a dead interface.
  // Same family as judging any remote commit by a local reading.
  // Practice cannot reproduce this one · isRealRoom is unsatisfiable there by design (GameRoom.jsx:359), so
  // the local deterministic path runs and commits in a tick. Which is the honest boundary of "ask the cheap
  // question first": the free probe answered the stall completely, and could not have answered this.
  // force:true for the SAME reason the hexes need it, and it took a measurement to see it: CardFrame
  // carries the art shimmer, an infinite animation, so Playwright's click-stability wait never settles and
  // a plain click TIMES OUT. The old line swallowed that timeout in `.catch(() => {})` and then waited
  // politely for a state change that no click had ever asked for · which is why the wire showed
  // `draw RPC calls []`: not a refused draw, not a disabled card, NO CLICK AT ALL. A swallowed error is an
  // unmeasured failure, which is this session's lesson in its third costume.
  let clickError = null
  const clicked = await spent(
    () => offer.click({ force: true, timeout: 5_000 }).catch((e) => { clickError = e.message.split('\n')[0] }),
    40, 250)
  if (clicked) return { action: 'draw', stage: 'ok' }
  if (clickError) {
    return stopped('offer-unclickable', `the offer card could not be clicked at all: ${clickError}`)
  }
  // THE OFFER IS ON SCREEN AND THE CLICK DID NOTHING · this is the branch S39 died in, blind, six times.
  // GameRoom.jsx:783 computes `disabled = actionsLeft === 0 || !isMyTurn || isDrawingCard` and then passes
  // `onClick={disabled ? undefined : ...}`, so a disabled offer card has NO HANDLER AT ALL · it is not a
  // greyed control that refuses, it is a node that never hears the click and cannot say so. Two of those
  // three inputs are already in the store snapshot; the third, isDrawingCard, is React state with no store
  // mirror, and its ONLY external trace is the `draw-status` node · which is precisely why diagnose() reads
  // it. My S39 hypothesis for this stall was uiPhase, and it was wrong: handleDrawCard
  // (useGameActions.js:157) does not read uiPhase at all, and the dim-the-rest CSS on [data-offer] is
  // opacity-only by deliberate design (index.css:22-27 · "never display/visibility"), so it cannot swallow
  // a click either. Both halves of that guess are falsified in the file that made it.
  return stopped('offer-inert', 'the card-offer is visible and a real click spent no action within 10s · ' +
    'READ drawStatus FIRST, it distinguishes the three causes: a message names the RPC refusal verbatim ' +
    '(auth, seat ownership, deck empty) · "Drawing…" still showing means the round trip has not returned ' +
    'and 10s was not enough · null, while myTurn is true with actions left, means isDrawingCard is stuck ' +
    'true, and a disabled offer card is rendered with onClick=undefined so it never hears a click at all')
}
