// NeoTopia · PRACTICE MODE, end to end (T3 S34).
//
// Practice shipped to production across three lanes in S32/S33 and had NO end-to-end coverage at all. T1
// proved it by hand on localhost and once live, and the forge confirmed the page loads and makes no network
// calls. Neither of those is a test: a thing verified by hand is verified on the day somebody looked.
//
// ── WHY THIS SPEC IS ON THE MERGE GATE AND NOT THE NIGHTLY ───────────────────────────────────────────────
// Every other live spec here is nightly because of ONE cost: an anonymous sign-in, against a per-IP hourly
// ceiling (docs/ANON_SIGNIN_BUDGET.md). Practice has no session, no room and no realtime · GameRoom mounts a
// LocalBoard whose tree contains no useAuth at all (T1 S33), so THIS SPEC mints zero identities. It is also
// the only live spec in the repo that passes with the backend completely unreachable, which is what test 2
// asserts rather than assumes.
//
// PRECISELY: the spec is free, the RUN is not. global-teardown.js signs in anonymously once per playwright
// invocation to call purge_e2e_test_data, so a run costs exactly one identity whatever it contains. The
// merge gate already pays that one for its existing specs, which is what makes adding this file ZERO
// INCREMENTAL cost · a different and more useful claim than "this spec is free", and the one to check
// before repeating it.
// >>> T2 · this belongs in e2e.yml (merge gate), NOT e2e-live-nightly.yml. It needs no repo secrets. <<<
//
// ── WHAT IT COVERS, AND WHY THE THIRD TEST IS THE ONE THAT MATTERS ───────────────────────────────────────
// 1 · entry from the Landing page, and the zero-cost claim measured rather than asserted
// 2 · a bot takes a real turn WITH THE BACKEND HARD-BLOCKED · the guarantee, made visible
// 3 · a bot that builds a district KEEPS PLAYING
//
// Test 3 exists because of a bug T1 found by playing rather than reading, and it is the sharpest lesson in
// this feature's short history. useBotTurns latched on (currentSeat, actionsRemaining, phase). Scoring a
// card changes NONE OF THE THREE · a district is the consequence of a placement and deliberately spends no
// action · but it does give `players` a new identity, so the effect re-ran, matched the old key, returned
// early, and the cleanup on that re-run had already cancelled the pending timer. Nothing rescheduled it.
// EVERY BOT FROZE PERMANENTLY THE FIRST TIME IT BUILT A DISTRICT, deterministically and silently, and both
// unit suites stayed green throughout, because no test had ever let a bot reach a scorable board.
//
// So a spec that watched a bot place an element would have passed on the broken build. The assertion has to
// be that the game is still moving AFTER a district is scored, which means the spec has to play long enough
// to reach one. That is the difference between covering the feature and covering the bug.
//
// ── PROVEN TO HAVE TEETH, AND THE FIRST ATTEMPT DID NOT ──────────────────────────────────────────────────
// This spec passing on the fixed build is worth nothing on its own: the deadlock survived two green unit
// suites and a live playtest, so "green" is precisely the signal that failed last time. It was checked by
// reintroducing the bug and requiring a red, and the first check reported the spec VACUOUS · it passed with
// the old latch key restored. The spec was fine; the check was wrong, and the reason is worth writing down.
//
// T1 S33 shipped TWO independent defences. seatSignature feeds the latch key AND the safety net that ends
// the turn when an action moved nothing. With the OLD narrow key, scoring leaves the signature unchanged, so
// `signature() === before` is true and the safety net calls endTurn · the game keeps moving anyway.
// Measured, all three ways:
//   A · narrow key only        → GREEN (the safety net rescues it)
//   B · safety net removed only→ GREEN (the wide key rescues it)
//   C · BOTH removed           → RED, 1 failed, and it is this test, reporting
//                                "seat 1 is a bot and the board has not moved for 8227ms"
// >>> T2 · that redundancy is a real property of your file and neither half is dead code: each one alone
//     closes this instance. Removing either would look harmless and would leave the class half-open. <<<
//
// ── THE TIMEOUTS ARE MEASURED, NOT GUESSED ───────────────────────────────────────────────────────────────
// Six instrumented practice games on this machine reached their first bot district at 4.5s, 5.2s, 7.9s,
// 9.4s, 12.2s and 12.8s (turns 3-7), and every one continued afterwards. DISTRICT_BUDGET_MS is 60s · five
// times the observed worst case, on the reasoning that a CI runner is slower than a laptop but not five
// times slower. The longest gap between two board changes during a bot's turn was 916ms across all six runs
// (the driver's own 650ms pause plus render), so BOT_STALL_MS at 8s is roughly nine times the observed
// worst case and still tight enough to catch a freeze.
//
// ── HOW THE HUMAN PLAYS, AND WHY IT IS NOT A SHORTCUT ────────────────────────────────────────────────────
// A practice game with bots still needs its human to take turns, or the board stops at seat 0 and no bot
// ever moves. End Turn is enabled only at zero actions (ActionBar: `actionsRemaining === 0 && isMyTurn`), so
// there is no "pass" · the player must spend all three. The cheapest legal action is drawing from The Offer,
// one click each, which is what takeHumanTurn does. This was worth getting right: the first version of my
// harness clicked End Turn on a full action budget 486 times, watched nothing happen, and looked exactly
// like a broken product (Rule 53 · model your own harness against the real UI flow before routing a bug).

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { forEachViewport, selfTestReachability, assertDiagnoseCanSee } from './seedHelpers'
import probe from '../board-probe.mjs'

// Read the storage key from its declaration rather than restating it. Importing useLocalSession here would
// drag React into Playwright's Node loader; a second copy of the string would be a second contract, which is
// the shape (Rule 45) that broke practice persistence once already · a spec asserting 'the snapshot is gone'
// against a key the app stopped using would pass forever while proving nothing. Same technique
// four-player-live.e2e.js uses for SEAT_COLORS, and it fails loudly if the declaration changes shape.
const PRACTICE_STORAGE_KEY = (() => {
  const src = readFileSync(new URL('../../src/hooks/useLocalSession.js', import.meta.url), 'utf8')
  const m = src.match(/PRACTICE_STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/)
  if (!m) throw new Error('could not read PRACTICE_STORAGE_KEY from src/hooks/useLocalSession.js · fix the pattern, do not hardcode the key')
  return m[1]
})()

const DISTRICT_BUDGET_MS = 60_000
const BOT_STALL_MS = 8_000
const POLL_MS = 250

// One read of everything this spec judges. Kept as a single evaluate so every field describes the SAME
// instant · polling four values separately would let the board move between them and produce a state that
// never existed.
const SNAPSHOT = () => {
  const s = window.__neotopia_store?.getState?.()
  if (!s) return null
  return {
    phase: s.phase,
    currentSeat: s.currentSeat,
    turnNumber: s.turnNumber,
    actionsRemaining: s.actionsRemaining,
    players: (s.players ?? []).map(p => ({
      seat: p.seat,
      isBot: !!p.isBot,
      hand: p.hand?.length ?? 0,
      districts: p.scoredCardIds?.length ?? 0,
    })),
    placed: (s.regions ?? []).reduce(
      (n, r) => n + Object.values(r.hexes ?? {}).filter(h => h?.element).length, 0),
  }
}

const read = (page) => page.evaluate(SNAPSHOT)
const districts = (s) => s.players.reduce((n, p) => n + p.districts, 0)
const humanSeat = (s) => s.players.find(p => !p.isBot)?.seat ?? 0
// Everything a move can change. Board progress is judged on this rather than on turnNumber alone, because a
// bot spends three actions INSIDE one turn and a turn-only measure would read two of them as a stall.
const progress = (s) => `${s.turnNumber}:${s.currentSeat}:${s.actionsRemaining}:${s.placed}:${districts(s)}`

// The first-run tutorial is a modal with aria-modal="true" and it INTERCEPTS POINTER EVENTS · a fresh
// browser context has never seen it, so every practice game in this spec opens behind it. Dismissing it is
// not a workaround, it is the flow: a first-time visitor meets the tutorial before the board, and a spec
// that reached the board another way would be testing a screen no new player ever sees first.
async function dismissTutorial(page) {
  const skip = page.getByTestId('tutorial-skip')
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await expect(page.getByRole('dialog', { name: /how to play/i })).toBeHidden({ timeout: 5_000 })
}

async function boardReady(page, { tutorial = 'dismiss' } = {}) {
  await expect(page.getByTestId('practice-badge')).toBeVisible({ timeout: 20_000 })
  await page.waitForFunction(() => typeof window.__neotopia_store !== 'undefined', { timeout: 20_000 })
  await expect.poll(() => read(page).then(s => s?.players?.length ?? 0), { timeout: 20_000 })
    .toBeGreaterThan(0)
  if (tutorial === 'dismiss') await dismissTutorial(page)
}

// Spend the human's three actions and pass the turn, through the real interface. Returns false if it is not
// our turn · the caller polls, so arriving early is normal rather than an error.
async function takeHumanTurn(page) {
  let s = await read(page)
  if (!s || s.phase !== 'playing' || s.currentSeat !== humanSeat(s)) return false

  for (let guard = 0; guard < 6 && s.actionsRemaining > 0; guard++) {
    const before = s.actionsRemaining
    await page.getByTestId('card-offer').first().click({ timeout: 5_000 })
    await expect
      .poll(() => read(page).then(x => x.actionsRemaining), {
        timeout: 5_000,
        // A disabled offer card silently does nothing, and a harness that kept clicking it would spin until
        // the suite timed out and then blame the product. Fail here, naming the real cause.
        message: 'drawing from The Offer did not spend an action · the human cannot take a turn',
      })
      .toBeLessThan(before)
    s = await read(page)
  }

  const endTurn = page.getByTestId('end-turn-btn')
  await expect(endTurn, 'End Turn must enable once all three actions are spent').toBeEnabled({ timeout: 5_000 })
  await endTurn.click()
  return true
}

// Play until `done(snapshot)` is true, taking the human's turns and watching for a freeze on the bots'.
// Returns the snapshot that satisfied `done`, or throws naming what it was waiting for.
async function playUntil(page, done, { budgetMs, label }) {
  const started = Date.now()
  let last = progress(await read(page))
  let lastMovedAt = Date.now()
  let worstBotStall = 0

  while (Date.now() - started < budgetMs) {
    const s = await read(page)
    if (!s) throw new Error(`${label}: the store seam vanished mid-game`)
    if (done(s)) return { snapshot: s, worstBotStall, elapsed: Date.now() - started }

    const now = progress(s)
    if (now !== last) { last = now; lastMovedAt = Date.now() }

    const botsTurn = s.phase === 'playing' && s.currentSeat !== humanSeat(s)
    if (botsTurn) {
      const stalled = Date.now() - lastMovedAt
      if (stalled > worstBotStall) worstBotStall = stalled
      // THE FREEZE ASSERTION. A bot that stops moving is indistinguishable from one that is still thinking,
      // which is exactly why the deadlock survived two green suites and a live playtest.
      expect(stalled, `seat ${s.currentSeat} is a bot and the board has not moved for ${stalled}ms · ` +
        `it has frozen mid-turn (${JSON.stringify(s.players)})`).toBeLessThan(BOT_STALL_MS)
    } else if (s.phase === 'playing') {
      await takeHumanTurn(page)
      lastMovedAt = Date.now()
      continue
    }

    if (s.phase !== 'playing') throw new Error(`${label}: the game left 'playing' (${s.phase}) first`)
    await page.waitForTimeout(POLL_MS)
  }
  const s = await read(page)
  throw new Error(`${label}: budget ${budgetMs}ms expired · last state ${JSON.stringify(s)}`)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
test.describe('practice mode', () => {
  test('the Landing entry reaches a playable board, and the whole visit costs nothing', async ({ page }) => {
    // THE CLAIM BEING MEASURED. Practice is the door for a visitor who cannot sign in · someone arriving
    // while anonymous sign-in is throttled, which is precisely when the product must still be playable. If
    // this path spends an identity, the feature is available only to the people who did not need it.
    // TWO DIFFERENT CLAIMS, MEASURED SEPARATELY, because collapsing them makes the assertion wrong.
    //   · the ROUTE must be silent · once inside /practice, nothing leaves the machine at all
    //   · the VISIT must be identity-free · no auth request anywhere, Landing included
    // The Landing page legitimately reads the public global-index RPC for its "consciousness districts
    // built" counter. That is a read with no session behind it and it is not what practice promises to
    // avoid · counting it as a violation would be this test being wrong about the product. What practice
    // promises is that it costs no IDENTITY, and /auth/v1/ is where an identity would be minted.
    const auth = []
    let insidePractice = false
    const inRoute = []
    page.on('request', (r) => {
      const url = r.url()
      if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith('data:')) return
      if (/\/auth\/v1\//.test(url)) auth.push(url)
      if (insidePractice) inRoute.push(url)
    })

    await page.goto('/')
    await page.getByTestId('landing-practice').click()
    insidePractice = true

    // The Landing door is deliberately the ZERO-opponent one · free exploration, no waiting for anybody.
    await expect(page).toHaveURL(/\/practice\?bots=0\b/)

    // A first-time visitor meets the tutorial before the board. Pinned rather than skipped past: practice is
    // the entry point for someone who has never played, so this modal appearing here is the product working.
    await expect(page.getByRole('dialog', { name: /how to play/i })).toBeVisible({ timeout: 20_000 })
    await boardReady(page)

    const s = await read(page)
    expect(s.phase).toBe('playing')
    expect(s.players).toHaveLength(1)          // just the human · no opponents were asked for
    expect(s.players[0].isBot).toBe(false)
    // Not a room. The badge is the player-visible half of the same promise.
    await expect(page.getByTestId('practice-badge')).toBeVisible()
    await expect(page.getByTestId('leave-practice')).toBeVisible()

    // The human can actually act · a board that renders but cannot be played is not an entry point.
    await page.getByTestId('card-offer').first().click()
    await expect.poll(() => read(page).then(x => x.actionsRemaining)).toBeLessThan(3)

    // THE HEADLINE. Not one request to the auth endpoint across the entire visit · this is the promise that
    // makes practice the right door when anonymous sign-in is throttled.
    expect(auth, `practice must mint no identity · saw ${JSON.stringify(auth.slice(0, 3))}`).toHaveLength(0)
    // And once inside the route, nothing leaves the machine at all.
    expect(inRoute, `the practice route must be silent · saw ${JSON.stringify(inRoute.slice(0, 5))}`)
      .toHaveLength(0)

    // No identity was stored either. Zero REQUESTS and zero STORED SESSION are different claims: a cached
    // token would mean the visit was free only because an earlier one had already paid.
    const authKeys = await page.evaluate(() =>
      Object.keys(window.localStorage).filter(k => /supabase|auth|sb-/i.test(k)))
    expect(authKeys, 'practice must not store an auth session').toEqual([])
  })

  test('a bot takes a real turn WITH THE BACKEND UNREACHABLE · the guarantee, in a browser', async ({ page, context }) => {
    // The unit-level proof of this is a static import-graph walk (useLocalSession.test.js): the module
    // cannot reach lib/supabase from any depth. That proves what the module CAN do. This proves what the
    // PRODUCT does · everything off the dev server is dead, and the game is still playable. It is the
    // strongest form of the promise, because a rate-limited backend is not a hypothetical here (the 429 T1
    // shipped copy for in S30) and this is the path that survives it.
    await context.route('**', async (route) => {
      const url = route.request().url()
      if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) return route.continue()
      return route.abort('failed')
    })

    await page.goto('/practice?bots=3')   // the exact URL both practice entry points navigate to
    await boardReady(page)

    const start = await read(page)
    expect(start.players).toHaveLength(4)
    expect(start.players.filter(p => p.isBot)).toHaveLength(3)
    // The seat flag the DRIVER reads. useBotTurns asks `player.isBot`, not the userId convention · when
    // those two disagreed the bots were seated and never moved at all (T1 S33). One contract, asserted.
    expect(start.players.find(p => p.seat === 0).isBot).toBe(false)

    const { snapshot } = await playUntil(page, s => s.placed > start.placed && s.turnNumber > start.turnNumber, {
      budgetMs: 30_000,
      label: 'a bot placing an element',
    })

    // A bot moved the real board through the real store · not a label, not a spinner.
    expect(snapshot.placed).toBeGreaterThan(start.placed)
    await expect(page.getByTestId('practice-badge')).toBeVisible()
  })

  test('a bot that builds a district KEEPS PLAYING · the freeze that both suites missed', async ({ page }) => {
    test.setTimeout(150_000)   // DISTRICT_BUDGET_MS plus the after-the-district watch, with room for a cold runner

    await page.goto('/practice?bots=3')
    await boardReady(page)

    // Phase 1 · play until a BOT has built a district. playUntil is already asserting that no bot freezes
    // mid-turn, so a pre-district deadlock fails here with the seat named.
    const { snapshot: scored, elapsed, worstBotStall } = await playUntil(
      page,
      s => s.players.some(p => p.isBot && p.districts > 0),
      { budgetMs: DISTRICT_BUDGET_MS, label: 'a bot building its first district' },
    )
    const builder = scored.players.find(p => p.isBot && p.districts > 0)
    console.log(`[practice] first bot district after ${elapsed}ms · turn ${scored.turnNumber} · ` +
      `seat ${builder.seat} · worst bot stall so far ${worstBotStall}ms`)

    // Phase 2 · THE ASSERTION THE BUG WOULD HAVE FAILED. On the broken build the scoring seat froze
    // permanently: the board stopped, currentSeat never left that bot, and nothing errored. Requiring the
    // turn number to advance PAST the turn the district was built in is the smallest claim that cannot be
    // satisfied by a frozen game, and playUntil keeps enforcing the no-stall rule on the way there.
    const { snapshot: after } = await playUntil(
      page,
      s => s.turnNumber > scored.turnNumber,
      { budgetMs: 45_000, label: 'the game continuing after a district was built' },
    )

    expect(after.turnNumber).toBeGreaterThan(scored.turnNumber)
    // The district itself survived the turn that produced it · a "fix" that discarded the score would also
    // keep the game moving, and would be a worse bug than the freeze.
    expect(districts(after)).toBeGreaterThanOrEqual(districts(scored))
    expect(after.phase).toBe('playing')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT HAPPENS WHEN A PRACTICE GAME ENDS (T3 S35)
//
// The block above covers entry, a bot's turn, and a bot continuing after it scores. All of it stops before
// the game does. Nothing had ever driven a practice game to its own ending, and four separate things are
// only true at that moment · the endgame trigger, the score screen, the civilization ledger, and the way out.
//
// MEASURED FIRST, on a worktree pinned to one commit so no other lane's in-flight save could move it: three
// bots reach 'scoring' at +90.1s, turn 37, with the production-tile clock running 12 -> 0 on bot placements
// alone. The budget below is that observation with room for a cold runner, not a guess. (The first attempt at
// this measurement ran against the shared dev server and showed a hard freeze at turn 4 · the console was
// full of `[vite] hot updated: /src/pages/GameRoom.jsx`, which was another terminal saving a half-written
// patternMatcher into my running game. Rule 57, and the reason these numbers came from an isolated tree.)
const ENDGAME_BUDGET_MS = 210_000

// The human's own turn is taken through the store here rather than through takeHumanTurn's three offer
// clicks. Deliberate, and narrow: this block's question is whether the clock advances when BOTS hold the
// seats, the human is only required to pass, and the real interface path is already asserted by the tests
// above. Driving 37 turns of UI would also make this the slowest spec in the repo for no extra claim.
const passHumanTurn = (page) => page.evaluate(() => window.__neotopia_store.getState().endTurn())

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVERY CELL ON THE BOARD TAKES ITS OWN CENTRE CLICK · T1's FIX, GATED IN A REAL BROWSER (T3 S41)
//
// WHY THIS EXISTS. I measured 13 of 97 legal offers unreachable at their own centre in S39 · an SVG <text>
// on top every time, and twice the ONLY legal placement was one of them, so the turn could not progress at
// all. T1 fixed it in 4fcb539 (`pointer-events: none` on every board <text>, structural rather than nudging
// one label) and enumerated the fix surface exactly: 3 POSITIONS, the top-centre hex of each region, each
// covered by its district name. My 13 offers were those 3 positions recurring on different turns.
//
// AND THE FIX IS PROTECTED BY NOTHING IN A BROWSER. T1's BoardLabels.reach.test.jsx gates the MECHANISM in
// jsdom · every <text> inert, cells still live, labels still visible, geometry still overlapping so nobody
// can quietly downgrade it to a nudge · and that is the right unit test. But jsdom has no layout and no
// hit-testing, so it cannot say that elementFromPoint at a real centre returns the cell (Rule 78's own
// corollary: keep the DECISION in the unit test, put the REACHABILITY check in the browser). This is that
// half, and the two together are the whole guarantee.
//
// THE SECOND REASON, and it is the one that made this urgent: my own harness was carrying off-centre click
// workarounds (18%/82% of the hex height) written when the defect was live. Those are removed in this same
// commit · endgame-live.e2e.js · because a workaround that silently rescues a regression is a gate that
// cannot see the thing it exists to catch.
//
// EVERY CELL, NOT ONLY THE LEGAL ONES · T1's framing and it is the right one: blockage is a property of the
// LAYOUT, not of legality. Probing `g.hex-cell` gives all 60 (57 region + 3 factory) on every run,
// deterministically, instead of however many placements happen to be legal on the turn the test looked.
//
// THE PROBE ITSELF IS T1's, IMPORTED, NOT REWRITTEN (Mahil's ruling · T1's Rule 94). I wrote my own earlier
// this session, from the correction T1 published in comms, and deleted it when theirs landed · two
// implementations of one check are a second contract and a second witness, and theirs additionally carries
// `measured` and `requireInViewport`, which are exactly the two halves mine was weaker on.
test.describe('practice mode · the board takes its clicks', () => {
  test('every cell on the board is reachable at its own centre · in a real browser, at five widths',
    async ({ page }) => {
      await page.goto('/practice?bots=1')
      await boardReady(page)

      // ── COUNTERWEIGHT FIRST · THE PROBE PROVES IT CAN SEE BEFORE ITS ALL-CLEAR COUNTS (Rule 90) ────────
      // "Every cell is reachable" has two cheap wrong satisfiers that both report a healthy board: there
      // were no cells to check, or the check credits so much that nothing can ever fail it. The second is
      // live here rather than hypothetical · this probe DELIBERATELY credits the handler-bearing ancestor
      // (T1's correction, without which three factory cells read as false positives), and one `contains`
      // on the wrong node turns that generosity into a probe that always passes.
      // So before believing any all-clear, drop a real full-viewport overlay on the page and require the
      // SAME probe to call every cell blocked, then require the all-clear back when it is removed. A probe
      // that cannot go red on a board that is genuinely covered has not cleared anything.
      // I checked exactly this by hand last session, in a scratch file I then deleted · which is the
      // "a rule stated as a fact gets rediscovered" failure Rule 90 exists to remove. It is a function now.
      const REACH = { controls: 'g.hex-cell', hit: 'polygon', handlerGroups: ['[data-factory]'], requireInViewport: true }
      const self = await selfTestReachability(page, probe.reachability, REACH)
      expect(self.measured, 'the probe matched no cells at all · every assertion below would pass vacuously')
        .toBe(true)
      expect(self.probed, 'fewer cells than the 57 region hexes').toBeGreaterThanOrEqual(57)
      expect(self.blockedWhenCovered, `the probe called ${self.blockedWhenCovered} of ${self.probed} cells ` +
        'blocked while a full-viewport overlay sat on top of every one of them · it cannot detect a covered ' +
        'cell, so its all-clear means nothing').toBe(self.probed)
      expect(self.blockedAfterRemoval, 'the probe stayed red after the overlay was removed · it is measuring ' +
        'something other than what is on top of the cells').toBe(self.blockedNormally)
      console.log(`[practice] reach probe self-test · ${self.probed} cells · ${self.blockedWhenCovered} ` +
        `blocked under an overlay · ${self.blockedAfterRemoval} after removing it`)

      // ── THE CONTRACT · at the widths T1 verified the fix on, plus 320 where every margin is worst ──────
      const results = await forEachViewport(page, [
        { width: 320, height: 568 },
        { width: 375, height: 667 },
        { width: 620, height: 800 },
        { width: 900, height: 900 },
        { width: 1280, height: 720 },
        { width: 1440, height: 900 },
      ], async (pg, size) => {
        const label = `${size.width}x${size.height}`
        const r = await pg.evaluate(probe.reachability, REACH)
        // measured FIRST, always · T1's own instruction, and it is the right one: "the board never mounted"
        // and "a label is eating clicks" are different bugs and a lone `ok` gives them the same red.
        expect(r.measured, `at ${label} · ${r.reason}`).toBe(true)
        expect(r.total, `at ${label} the board rendered ${r.total} cells · fewer than the 57 region hexes, ` +
          'so this pass is not looking at a whole board').toBeGreaterThanOrEqual(57)
        expect(r.failures, `at ${label}, ${r.blocked} of ${r.total} board cells do not take a click at their ` +
          `own centre and ${r.offscreen} are off screen · a player clicking the middle of a hex they can see ` +
          'gets nothing, and when a covered hex is the only legal placement the turn cannot progress at all. ' +
          'This is T1 4fcb539 (pointer-events:none on every board <text>) regressing · ' +
          JSON.stringify(r.failures.slice(0, 5))).toEqual([])
        console.log(`[practice] reach @ ${label} · ${r.total} cells · self ${r.self} · via handler group ` +
          `${r.group} · blocked ${r.blocked} · offscreen ${r.offscreen}`)
        return { total: r.total, blocked: r.blocked, offscreen: r.offscreen, group: r.group }
      })

      console.log('[practice] board reachability · ' + results.map(m =>
        `${m.size.width}:${m.result.blocked}/${m.result.total}`).join(' · ') + ' (blocked/total)')


      // ── THE LATE-GAME CASE IS STILL NOT COVERED IN A BROWSER, AND SAYING SO IS THE POINT (T3 S42) ─────
      // Everything above probes the OPENING position: no tokens placed, every region score a single
      // digit. I flagged that as the gap in my own S41 gate, because T1's measurement of the fix showed
      // the score label clears the row below it by 0.79 units and misses only SIDEWAYS by 44.1 · so a
      // three-digit score is one render from being the same defect the fix closed.
      //
      // T1 SHIPPED THE SEEDER FOR IT THIS SESSION and unit-proved it · probe.seedPlayedBoard fills all 57
      // hexes, stamps placedBy, and sets scores [128, 256, 999], reporting `trustworthy` from a read-back
      // rather than from its own loop. I tried to use it here and it CANNOT CROSS INTO THE PAGE: it
      // references module-scope ELEMENT_COLORS / REGION_META / hexesInRadius, and page.evaluate serialises
      // a function as source. reachability() was deliberately written with no module-scope references for
      // exactly this reason (T1's own API note); the seeder was not, because it was built for the jsdom
      // side where that constraint does not exist. `ReferenceError: ELEMENT_COLORS is not defined`.
      //
      // NOT WRITING A SECOND SEEDER. That is the duplicate I deleted last session (Rule 94/95) and it
      // would drift from T1's the first time the board geometry moves. ROUTED: the change is small and
      // theirs · inline those three references, or export an evaluate-safe variant, and this gate gains a
      // played-board pass in about six lines. Until then the honest statement is that the opening position
      // is gated at six widths and the late game is NOT, rather than a green tick implying both.
    })

  // ── THE DIAGNOSTIC PROVES IT CAN SEE · MY OWN S40 CLOSING NOTE, MADE PERMANENT (T3 S41) ────────────────
  // endgame-live's diagnose() is what turns a five-minute silent timeout into a named stage, and it is the
  // instrument three separate defects were found with last session. Every count it reports degrades to 0
  // when its selector is wrong, which is indistinguishable from an honest "none right now" · Rule 80's
  // shape, in my own tooling. I checked those selectors by hand last session, in a scratch probe I then
  // deleted, and then wrote in my own closing note that this should be an assertion. This is that.
  //
  // IT RUNS HERE, ON THE FREE PRACTICE BOARD, ON THE MERGE GATE · deliberately. The live spec that owns
  // diagnose() is nightly-class and currently test.fixme, so a check living only there would protect
  // nothing today and rot exactly the way Rule 79 describes. The selectors are the same ones.
  test('the endgame diagnostic can still see · every selector it reports on moves for real', async ({ page }) => {
    await page.goto('/practice?bots=1')
    await boardReady(page)

    const before = await read(page)
    const seen = await assertDiagnoseCanSee(page, { expect })
    expect(seen.walked, 'the opening board offered no legal move to walk · the check degraded to invariants ' +
      'only, which is the weaker half').toBe(true)

    // AND IT HANDED THE BOARD BACK. The whole reason this can run unconditionally is that it commits
    // nothing · if it ever costs an action, it stops being free and starts changing the game it inspects.
    const after = await read(page)
    expect(after.actionsRemaining, 'the diagnostic self-check SPENT AN ACTION · it selects and deselects, ' +
      'and only a hex click may commit').toBe(before.actionsRemaining)
    expect(after.turnNumber, 'the diagnostic self-check advanced the turn').toBe(before.turnNumber)
    console.log(`[practice] diagnose can see · ${JSON.stringify(seen.saw)} · actions ` +
      `${before.actionsRemaining}→${after.actionsRemaining} (unchanged, as required)`)
  })
})

test.describe('practice mode · the end of the game', () => {
  test('a practice game reaches its own ending, shows the record, and writes nothing to it', async ({ page }) => {
    test.setTimeout(ENDGAME_BUDGET_MS + 90_000)

    // Watch the wire for the whole game, not just the score screen · a write could fire at any point.
    const auth = []
    const writes = []
    const reads = []
    page.on('request', (r) => {
      const url = r.url()
      if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith('data:')) return
      if (/\/auth\/v1\//.test(url)) auth.push(url)
      // The two the score screen legitimately makes: the public Global Index counter. Both are READS with
      // no session behind them. record_civilization_contribution / _detail are the WRITES, and they are the
      // ones that must never fire · a bot must not be able to build the real NeoTopia.
      else if (/record_civilization|award_game_win|game_events|game_sessions/.test(url)) writes.push(url)
      else reads.push(url)
    })

    await page.goto('/practice?bots=3')
    await boardReady(page)
    const start = await read(page)
    expect(start.players.filter(p => p.isBot)).toHaveLength(3)

    // ── Q1 · does the endgame trigger at all when bots hold the seats? ────────────────────────────────────
    // It is not obvious that it does. The clock only advances when a PLACEMENT empties a factory
    // (gameStore.refillFactoryDraft), so a bot policy that drew more than it placed would leave the game
    // running forever with nothing wrong on screen · the same silent-stall class as the S33 deadlock.
    const started = Date.now()
    let last = progress(start)
    let lastMovedAt = Date.now()
    let s = start
    while (Date.now() - started < ENDGAME_BUDGET_MS) {
      s = await read(page)
      if (!s) throw new Error('the store seam vanished mid-game')
      if (s.phase === 'scoring') break

      const now = progress(s)
      if (now !== last) { last = now; lastMovedAt = Date.now() }
      if (s.currentSeat === humanSeat(s)) { await passHumanTurn(page); lastMovedAt = Date.now(); continue }

      const stalled = Date.now() - lastMovedAt
      expect(stalled, `seat ${s.currentSeat} is a bot and the board has not moved for ${stalled}ms · the ` +
        `game has frozen short of its own ending (${JSON.stringify(s)})`).toBeLessThan(BOT_STALL_MS)
      await page.waitForTimeout(POLL_MS)
    }
    expect(s.phase, `the game never ended within ${ENDGAME_BUDGET_MS}ms · last state ${JSON.stringify(s)}`)
      .toBe('scoring')
    console.log(`[practice] endgame reached after ${Date.now() - started}ms · turn ${s.turnNumber}`)

    // ── Q2 · does the score screen render with no game_sessions row behind it? ────────────────────────────
    // FinalScore takes sync.sessionId, and in practice that is null by construction (useLocalSession returns
    // null rather than a fake id, because game_events.session_id is a real FK). A component that assumed a
    // session would throw or render empty here, and the player would finish their first game at a blank
    // screen · the one moment the mode is supposed to pay off.
    const record = page.getByRole('dialog', { name: /final civilization record/i })
    await expect(record, 'the game ended and no score screen appeared').toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('play-again-btn')).toBeVisible()

    // ── Q3 · the ledger. THE ONE WITH A PERMANENT CONSEQUENCE. ────────────────────────────────────────────
    // GameRoom.practice.test.jsx already pins this with mocks, and mutating its guard reddens it · so this is
    // not the first proof, it is the LIVE one. A mock proves the component did not call a function it was
    // handed; only the wire proves nothing left the machine. If this ever fires, bot-built districts enter
    // the real civilization's permanent record and there is no clean way to take them back out.
    expect(writes, 'a practice game wrote to the civilization record · bots must never build the real NeoTopia')
      .toEqual([])
    expect(auth, 'practice minted an identity · the mode exists for visitors who cannot sign in').toEqual([])
    // Stated rather than left implicit: practice is auth-silent, NOT network-silent. The score screen reads
    // the public Global Index for its counter. Recording the exact shape here so a future change that starts
    // sending something else has to come through this line.
    for (const url of reads) {
      expect(url, `an unexpected request left a practice game: ${url}`)
        .toMatch(/global_neotopia_index|get_global_neotopia_index/)
    }
    console.log(`[practice] wire at game end · ${auth.length} auth, ${writes.length} writes, ${reads.length} public reads`)
  })

  test('the board survives a refresh late in a practice game · bot moves included', async ({ page }) => {
    test.setTimeout(120_000)
    // THE REGRESSION GUARD for the bug this session fixed. Persisting only what the transport was asked to
    // do left the saved snapshot behind by every bot move since the human's last action: a player who left a
    // board with 13 elements came back to one with 11, at turn 8 instead of turn 10. The unit tests pin the
    // subscription; this pins the thing the player actually experiences.
    await page.goto('/practice?bots=3')
    await boardReady(page)

    const { snapshot: mid } = await playUntil(page, s => s.placed >= 6, {
      budgetMs: 60_000,
      label: 'enough bot placements to make a rewind visible',
    })
    expect(mid.placed).toBeGreaterThanOrEqual(6)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await boardReady(page, { tutorial: 'ignore' })
    const back = await read(page)

    // FALSE CASE, and the one that shipped: the game resumes perfectly and simply rewinds a round, which
    // looks like the bots undoing their own moves. >= rather than === because the bots keep playing while
    // the page comes back · the claim is that nothing was LOST, not that time stopped.
    expect(back.placed, `the board rewound across a refresh · left ${mid.placed} elements, returned to ${back.placed}`)
      .toBeGreaterThanOrEqual(mid.placed)
    expect(back.turnNumber).toBeGreaterThanOrEqual(mid.turnNumber)
  })

  // FIXED · the test.fail() annotation that used to live here is DELETED, exactly as its author instructed.
  //
  // The defect it documented (T3 S34): at phase 'scoring' the leave-practice button was still in the DOM,
  // and document.elementFromPoint at its centre returned the FinalScore dialog · position:fixed, inset:0,
  // zIndex:300, opaque. A real user click timed out. T1 fixed it in S36 (3d17d7f · the exit moved INTO the
  // overlay rather than raising a z-index) and recorded it as Rule 78a, but left the annotation behind, so
  // the spec has been reporting "expected to fail" against working code ever since.
  //
  // Found by T2 S37 running this file for the first time in order to WIRE IT TO CI · which is the whole
  // argument for wiring it. A spec that runs in no workflow cannot tell anybody it has gone stale, and this
  // one was one push away from turning the merge gate red on arrival. Removing the annotation is the smaller
  // half of the lesson; the larger half is that nothing was watching for eight commits.
  //
  // The annotation belonged INSIDE the test body, never at describe scope · `test.fail()` as a bare
  // statement in a describe applies to EVERY test in the block. Kept as a note because the next person to
  // add one here needs it.
  //
  // ── T3 S37 · AND NOW IT HAS TO PASS FOR THE RIGHT REASON ──────────────────────────────────────────────
  // (One correction to the paragraph above, since this is the file of record: the defect was measured in
  // S35, not S34. S34 was the entry/bot-turn spec this block was built on top of.)
  //
  // Deleting the annotation restores a GREEN test, and a green test here was never the goal · the assertion
  // that was under it could pass against a button that is merely clickable. Two halves, and they fail for
  // different reasons:
  //   REACHABLE · elementFromPoint at the control's centre must return the control, and its rect must lie
  //     inside the viewport (Rule 78 · both halves of it, since the same session produced a control COVERED
  //     by an overlay and a control PUSHED OFF the screen, and toBeVisible passed for both). The click
  //     carries no `force`, because force:true answers a different question than "can a player do this".
  //   AND IT ACTUALLY TEARS DOWN · `practice-badge` hidden cannot tell a teardown from a bare navigation,
  //     and a bare navigation is precisely what the OLD reachable control did: play-again went to '/lobby'
  //     and left the finished game in the store AND in sessionStorage behind it. So the teardown is judged
  //     on what endPractice() actually changes · the store dropped to 'lobby' with the bot seats gone, and
  //     the snapshot removed from storage. A button that navigated without tearing down is half a fix, and
  //     half a fix is the exact shape of the bug T1 found on the other button.
  test('a player who finishes a practice game can leave practice · reachably, and it really tears down', async ({ page }) => {
    await page.goto('/practice?bots=1')
    await boardReady(page)

    // Hold our own handle on the store BEFORE the exit runs. GameRoom deletes window.__neotopia_store in its
    // unmount cleanup (GameRoom.jsx:292) and leaving navigates to '/', so the seam this spec reads through is
    // gone at exactly the moment the teardown becomes observable. The zustand store is a module singleton
    // that outlives the component · this keeps a reference to the SAME instance, it does not make a second.
    await page.evaluate(() => { window.__t3_store = window.__neotopia_store })
    await page.evaluate(() => window.__neotopia_store.getState().setPhase('scoring'))
    await expect(page.getByRole('dialog', { name: /final civilization record/i })).toBeVisible()

    // EXACTLY ONE way out at a time. A second copy would put an unclickable one back in the document · the
    // original bug wearing a different hat · and getByTestId would report that as a strict-mode violation
    // rather than as the thing that is wrong, so the count is asserted directly and says so.
    const exit = page.getByTestId('leave-practice')
    expect(await exit.count(), 'exactly one leave-practice may exist · a second copy is an unreachable one').toBe(1)

    // ── REACHABILITY, AND A THIRD CASE RULE 78 DID NOT COVER ─────────────────────────────────────────────
    // The first version of this asserted the rect must lie inside the viewport, straight off Rule 78. It
    // RED, and the number is worth writing down: at 1280x720 the exit sits at y=1087, which is 423px BELOW
    // the fold, and elementFromPoint at its centre returns `nothing` because the point is off the screen.
    //
    // ⚠ THE TABLE BELOW IS HISTORY, NOT A CURRENT CLAIM. It is the PRE-FIX state (T3 S38, seven viewports).
    // T1 fixed it in 9659009 after I routed it. Kept because it is why the fix happened, and because the
    // size of the numbers is the argument for the assertion that replaced it:
    //
    //   viewport     dialog content   leave-practice below fold   play-again below fold   wheel gestures
    //   1440x900               1270                         243                     243                1
    //   1440x800               1270                         343                     343                1
    //   1280x720               1270                         423                     423                1
    //    768x1024              1270                         119                     119                1
    //    390x844               1679                         692                     622                2
    //    375x667               1699                         889                     819                2
    //    320x568               1749                        1038                     968                3
    //
    // NOT ONE of the seven had a CTA on screen when the record appeared. The best case was a tablet at 119px
    // below the fold; the worst a small phone at over three screens of content with the way out at the
    // bottom. AND THE VISIBLE SCROLLBAR IS 0px WIDE AT EVERY SIZE (macOS overlay scrollbars stay hidden
    // until you already scroll), so there was no passive affordance at all · what the player could read
    // without moving simply stopped, mid score-row: at 320 the last three readable things were "0",
    // "Living Earth", "0".
    //
    // ── T3 S40 · MAHIL HAS RULED, SO THIS IS A CONTRACT NOW AND IT IS ASSERTED ────────────────────────────
    // S38 measured the defect. S39 I turned the measurement into an assertion that NOT ONE viewport shows a
    // CTA on arrival · and T1 fixed the product between the commit my worktree was pinned to and the commit
    // CI ran, so my gate asserted the BUG and RED the merge gate. My first written explanation was that a
    // Linux runner lays the dialog out shorter through font metrics. Plausible, wrong, and one `git log`
    // from being caught. The narrow lesson is not "check things": it is NEVER ASSERT A FINDING YOU HAVE
    // ROUTED TO ANOTHER LANE. A finding is a measurement of today, and the whole point of routing it is that
    // somebody is about to make it false. Gate the invariant underneath it instead.
    // So S39 left this REPORTED, not gated, because I did not know what the contract was.
    // Mahil has now ruled that it IS one: a player who finishes a game must see what to do next without
    // scrolling. That makes the positive assertion the correct gate, and it protects T1's fix from a
    // silent regression, which the logged version could not do.
    //
    // RE-MEASURED AT HEAD, 87 VIEWPORT COMBINATIONS · every width just outside every breakpoint in src
    // (479/600/720/1024) crossed with heights 568/720/900, because a two-point reading is a sample and not
    // a boundary (Rule 87 · the S39 note said "measured at both 1280x720 and 320x568", which is exactly the
    // sample size that hid the 620px peak in the action-log finding):
    //
    //   on screen on arrival ............ 87 of 87        elementFromPoint hits the button . 87 of 87
    //   below the fold on arrival ....... 0 of 87         margin below the button .......... 20px, at ALL 87
    //
    // THE MARGIN IS INVARIANT, AND THAT IS THE POINT · it does not drift with width, height or content
    // length because the CTA row is `position: sticky; bottom: 0` with `padding: 18px 0 20px`
    // (FinalScore.jsx:620-627). The 20px IS the bottom padding. So this assertion cannot be broken by a
    // Linux runner's font metrics, which is the failure I actually shipped last session · the guarantee is
    // STRUCTURAL and can be proven by identity rather than defended as a tolerance (Rule 81's better half).
    // A regression that un-pins that row does not shave the margin, it drops the button 243-1038px down the
    // page, which is a range this probe measures with room to spare (Rule 88 · the metric is not saturated).
    //
    // The dialog is still `overflow-y: auto` over 1270-1749px of content, so the gesture bound below is
    // still a real and separate guard: it catches the way out drifting back DOWN the page in the state
    // where a player has begun scrolling. Left at 5 exactly as it was · T1 confirmed they did not touch it.
    //
    // A wheel, not scrollIntoViewIfNeeded: the framework's helper would scroll for the player and answer a
    // question no human asks. The number of gestures IS the measurement.
    const probe = (el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const label = (n) => !n ? 'nothing' : [
        n.tagName.toLowerCase(),
        n.getAttribute('data-testid') ? `[${n.getAttribute('data-testid')}]` : '',
        n.getAttribute('role') ? `(role=${n.getAttribute('role')})` : '',
      ].join('')
      return {
        hitsSelf: !!hit && (hit === el || el.contains(hit)),
        hitLabel: label(hit),
        inViewport: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
        belowFold: Math.round(r.bottom - window.innerHeight),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        viewport: { w: window.innerWidth, h: window.innerHeight },
      }
    }
    const WHEEL_PX = 500
    const MAX_GESTURES = 8 // 4000px · roughly three times the tallest overflow measured (1181px at 320x568)

    // Wheel until the control is genuinely reachable, and report what it cost. A wheel rather than
    // scrollIntoViewIfNeeded: the framework's helper would scroll FOR the player and answer a question no
    // human asks. The number of gestures IS the measurement.
    async function reachByScrolling() {
      const onArrival = await exit.evaluate(probe)
      let reach = onArrival
      let gestures = 0
      while (!(reach.hitsSelf && reach.inViewport) && gestures < MAX_GESTURES) {
        await page.mouse.move(onArrival.viewport.w / 2, onArrival.viewport.h / 2)
        await page.mouse.wheel(0, WHEEL_PX)
        gestures++
        await page.waitForTimeout(150)
        reach = await exit.evaluate(probe)
      }
      return { onArrival, reach, gestures }
    }

    // RUN IT AT 320 AS WELL, which is Rule 78's own instruction and is where every margin in this layout is
    // worst: the tallest content (1749px), the furthest fall (1038px below the fold), and the most gestures.
    // A gate that only ever ran at the default 1280x720 would report the easiest case in the table above and
    // call it covered.
    //
    // THROUGH forEachViewport, which resets scroll BY CONSTRUCTION (T3 S39 · seedHelpers). The first version
    // of this loop resized in place and inherited the previous pass's scrollTop, so the 320 reading came from
    // a dialog somebody had already scrolled · 489px and 2 gestures instead of the true 1038px and 3. That was
    // the third occurrence of one mistake in three sessions, which makes it a missing harness step rather than
    // a slip · so the reset now lives in the helper where no caller has to remember it.
    const measured = await forEachViewport(page, [
      { width: 1280, height: 720 },
      { width: 320, height: 568 },
    ], async (pg, size) => {
      const label = `${size.width}x${size.height}`

      // ── COUNTERWEIGHT · WRITTEN FIRST, BEFORE ANYTHING IT DEFENDS (Rule 90) ───────────────────────────
      // "The CTA is on screen on arrival" has a cheap wrong satisfier, and it is not a bad fix somebody
      // would make on purpose · it is the record simply getting SHORT enough to fit. The moment it does,
      // the sticky row is doing no work at all, every assertion below still passes, and what survives is a
      // guarantee nobody meant: the screen fits today, on this content, by luck. That is the Rule 86 shape ·
      // an assertion structurally unable to fail, reporting itself as PRESENT and thereby retiring the worry.
      // So the FIRST thing asserted here is that the screen genuinely OVERFLOWS its scrollport, which makes
      // "on arrival" an achievement of the layout rather than an accident of content length.
      // MEASURED at HEAD, and the scrollport is the DIALOG itself, not the document · documentElement's
      // scrollHeight equals its clientHeight at every size, so the page never scrolls and the dialog does:
      //     320x568  overflows by 1053px    ·    1280x720  by 421px    ·    1440x900  by 241px
      // Gated at > 0 rather than at a measured floor on purpose: the bound has to mean "the sticky row is
      // load-bearing", not "the record is this tall", or it becomes a second contract on somebody else's
      // design (Rule 45). 241px of headroom at the tightest size measured.
      const overflow = await pg.getByRole('dialog', { name: /final civilization record/i }).evaluate(
        (el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, by: el.scrollHeight - el.clientHeight }))
      expect(overflow.by, `at ${label} the final-score screen does NOT overflow its scrollport ` +
        `(${overflow.scrollHeight} of ${overflow.clientHeight}px), so "the CTA is on screen on arrival" is ` +
        'true for free and this test proves nothing about the sticky row · either the record collapsed or ' +
        'the dialog stopped being the scrollport').toBeGreaterThan(0)

      const { onArrival, reach, gestures } = await reachByScrolling()
      expect(reach.hitsSelf, `at ${label} the exit is painted over · elementFromPoint at its centre returned ` +
        `${reach.hitLabel} after ${gestures} scroll gesture(s) (rect ${JSON.stringify(reach.rect)})`).toBe(true)
      expect(reach.inViewport, `at ${label} the exit never came on screen · ${MAX_GESTURES} gestures of ` +
        `${WHEEL_PX}px left it at ${JSON.stringify(reach.rect)} · it started ${onArrival.belowFold}px below ` +
        'the fold').toBe(true)
      // The COST of reaching it, gated rather than merely logged. The bound is 5 rather than the measured 3
      // because this gate exists to catch the way out drifting SUBSTANTIALLY further from the player who
      // needs it, not to freeze the score screen's height: at 3-of-3 a single extra line of copy would red
      // the merge gate over a design judgement. 5 is the worst case plus one full 568px screen.
      expect(gestures, `at ${label} it took ${gestures} scroll gestures to reach the way out of a finished ` +
        'practice game · measured 1 at 1280x720 and 2 at 320x568 BEFORE the fix, 0 at both after it')
        .toBeLessThanOrEqual(5)

      // ── THE CONTRACT ITSELF · a player who finishes a game sees what to do next without scrolling ──────
      // onArrival, not `reach` · reach is measured AFTER the wheel loop and would be true even if the
      // player had to scroll for it, which is the whole distinction this screen is about.
      expect(onArrival.inViewport, `at ${label} NEITHER call to action is on screen when the final record ` +
        `arrives · leave-practice starts ${onArrival.belowFold}px below the fold at ${JSON.stringify(onArrival.rect)}. ` +
        'A player who has just finished a game is being shown a dead end and a 0px-wide overlay scrollbar. ' +
        'The CTA row is position:sticky bottom:0 (FinalScore.jsx:620) · if this red, that is what broke.')
        .toBe(true)
      console.log(`[practice] exit @ ${label} · on arrival ${onArrival.belowFold <= 0
        ? `ON SCREEN with ${-onArrival.belowFold}px of margin` : `${onArrival.belowFold}px BELOW the fold`} · ` +
        `dialog overflows by ${overflow.by}px · reachable after ${gestures} wheel gesture(s) · hit=${reach.hitLabel}`)
      return onArrival
    })

    // The summary line, so a CI log reads as a measurement and not just as a green tick (Rule 79d · a green
    // workflow is not proof the spec executed; a number in the log is).
    console.log('[practice] CTA on arrival · ' + measured.map(m =>
      `${m.size.width}x${m.size.height}:${m.result.inViewport ? `on-screen(+${-m.result.belowFold}px)` : `${m.result.belowFold}px below`}`)
      .join(' · '))

    // No force: the question is whether a PLAYER can reach it, and force:true would answer a different one.
    await exit.click({ timeout: 5_000 })
    await expect(page.getByTestId('practice-badge')).toBeHidden()

    // ── THE HALF A NAVIGATION CANNOT FAKE ────────────────────────────────────────────────────────────────
    const after = await page.evaluate((key) => {
      const s = window.__t3_store.getState()
      return {
        phase: s.phase,
        seats: s.players.length,
        bots: s.players.filter(p => p.isBot).length,
        saved: sessionStorage.getItem(key),
        seamCleanedUp: typeof window.__neotopia_store === 'undefined',
      }
    }, PRACTICE_STORAGE_KEY)
    expect(after.phase, 'endPractice() did not run · the store is still holding the finished game').toBe('lobby')
    expect(after.bots, 'endPractice() did not run · the bot seats are still at the table').toBe(0)
    expect(after.seats, 'a teardown leaves the lone human in the store').toBe(1)
    expect(after.saved, `the finished practice game is still in sessionStorage under '${PRACTICE_STORAGE_KEY}' · ` +
      'nothing cleared it, so it is waiting for the next visit').toBeNull()
    console.log(`[practice] teardown · phase=${after.phase} seats=${after.seats} bots=${after.bots} ` +
      `saved=${after.saved} seam-cleanup=${after.seamCleanedUp}`)
  })

  // THE OTHER HALF, and T1 was right that it was the worse one: "Start New Civilization" on a PRACTICE score
  // screen called navigate('/lobby'). The lobby needs the anonymous sign-in that practice mode exists to
  // survive without, so the player most likely to be sitting there · rate limited, or simply unwilling to
  // sign in · was being sent to the one screen they cannot use, and no teardown ran on the way either.
  //
  // Asserting the POSITIVE claim rather than the absence of a navigation: another practice game, right here,
  // same opponents. The board is played forward first so that "a new table" is distinguishable from "the same
  // one resumed" · a fresh deal is at turn 1 on an empty board, and this one will not be.
  test('"Play Again" on a practice score screen deals another practice game · not the multiplayer lobby', async ({ page }) => {
    // Budgeted for a CI runner, not for this laptop. The board reaches the target in ~15s locally; the gate
    // T2 wired this into (e2e.yml) runs on a 2-core GitHub runner where every bot turn and every one of the
    // human's three offer clicks costs more, and a budget set from a local measurement is the classic way to
    // hand somebody else a flaky gate.
    test.setTimeout(200_000)
    await page.goto('/practice?bots=1')
    await boardReady(page)

    const { snapshot: mid } = await playUntil(page, s => s.placed >= 4 && s.turnNumber >= 3, {
      budgetMs: 120_000,
      label: 'a board far enough along that a fresh deal is unmistakable',
    })

    await page.evaluate(() => window.__neotopia_store.getState().setPhase('scoring'))
    await expect(page.getByRole('dialog', { name: /final civilization record/i })).toBeVisible()
    await page.getByTestId('play-again-btn').click({ timeout: 5_000 })

    await expect.poll(() => read(page).then(s => s?.phase), {
      timeout: 15_000,
      message: 'Play Again did not deal another practice game',
    }).toBe('playing')
    // The assertion the bug would have failed · '/lobby' is the wrong side of the sign-in.
    expect(new URL(page.url()).pathname, 'a practice player was navigated away from /practice').toBe('/practice')

    const fresh = await read(page)
    expect(fresh.players.filter(p => p.isBot), 'the new table must have the opponents the player asked for')
      .toHaveLength(1)
    // A NEW table, not the old one resumed. Read immediately after the phase flip, when the bots have had at
    // most a few hundred ms · and `mid` is deliberately far enough along (>= 4 elements, >= turn 3) that this
    // cannot be a timing coincidence.
    expect(fresh.turnNumber, `Play Again resumed the finished game · turn ${fresh.turnNumber} against ${mid.turnNumber}`)
      .toBeLessThan(mid.turnNumber)
    expect(fresh.placed, `Play Again resumed the finished board · ${fresh.placed} elements against ${mid.placed}`)
      .toBeLessThan(mid.placed)
    console.log(`[practice] play again · turn ${mid.turnNumber}→${fresh.turnNumber} · placed ${mid.placed}→${fresh.placed}`)
  })
})
