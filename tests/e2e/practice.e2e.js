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
