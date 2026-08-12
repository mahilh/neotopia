// NeoTopia · THE TURN DEADLINE, MEASURED WITH REAL TIMERS (T3 S60) · zero identities.
//
// WHY THIS EXISTS, and it is Rule 79 pointed at my own work. In S59 I shipped 78210b3: a turn clock
// that measured excess 0 under fake timers and went GREEN ON ALL FOUR CI JOBS, including the merge
// gate. In a real browser it was reliably ~1000ms late · WORSE than the code it replaced. The only
// witness that c3e6120 fixed it was a probe I wrote by hand and deleted the same evening, so the
// strongest evidence in that commit was reproducible by nobody.
//
// THE UNIT SUITE CANNOT DO THIS, AND THAT IS NOT AN OVERSIGHT. vi.useFakeTimers advances Date.now()
// and performance.now() in LOCKSTEP, so no fake-timer test in this repo can tell them apart · mutation
// M7 last session put both reads back on the wall clock and 17 of 18 tests stayed green. The one that
// reddened was a source-read guard, which can see WHICH API is called and never what it delivers.
// The defect lives in the gap between a monotonically-scheduled setInterval and a wall clock, so only
// a real clock can measure it (preamble §3 · when the subject under test is the thing your harness
// simulates, the harness is maximally suspect).
//
// MEASURED SEPARATION, which is where the bound comes from · elapsed against a promised 90000ms:
//     pre-S59 (in-tick anchor)          uniform 0-1000 late, wherever the turn fell between ticks
//     78210b3 (re-phase + Date.now)     91037 · 91027 · 91001      reliably ~1000 late
//     c3e6120 (re-phase + performance)  90079                      residual is scheduler lateness
// So the wire is sized from a 79-versus-1001 separation, not from observed jitter · a bound derived
// from the run that produced it is a flake with a delay on it (preamble §2).
//
// COST · zero sign-ins. /practice mounts a shell with no useAuth in its tree (practice.e2e.js asserts
// it and fails on any auth request) and reaches no backend at all. ~100s of wall clock, one turn of a
// Classic game, which is irreducible: PracticeRoute reads only `bots`, so a 15s Flow practice game is
// NOT reachable and the cheap version of this spec does not exist today. Verified by reading the route
// rather than assumed · useLocalSession accepts a mode, App.jsx never passes one.
//
// RUNS-NOWHERE: e2e-live-nightly · .github/ is T2's lane, routed in comms/t3-s60 and t3-s61.
// DELETE THIS DECLARATION IN THE SAME COMMIT THAT WIRES THE FILE.
//
// ⚠ WHY IT DOES NOT FOLD INTO practice.e2e.js, and the question was asked directly (T3 S61). That spec
// is the natural host · same route, zero identities, already wired · and it runs ONLY on the merge
// gate (e2e.yml:218), where its step already costs 2m46s. Adding ~100s is +60% ON EVERY PUSH for a
// single assertion. Measured, not estimated, from a successful run's step timestamps.
// The SECOND reason was a limit I nearly stated without checking (preamble §4). Under a 6x CPU
// throttle, modelling a contended runner:
//     idle          excess   48ms   worst sampling gap 112ms   PASS
//     6x throttle      -              worst gap 501ms          UNMEASURED, correctly refused
//     S59 regression excess 1054ms                             RED
// So it does not flake under contention · it REPORTS the contention and declines to judge · but a
// spec that may decline on a busy runner gates nothing on a per-push job, while costing 100s there.
// The nightly is where a decline costs nobody a push.
// THE CHEAP VERSION HAS ONE BLOCKER WITH A NAMED OWNER: PracticeRoute (src/App.jsx, T1's lane) reads
// only `bots`, though useLocalSession already accepts a `mode`. A `?mode=flow` practice game is 15s
// per turn, which would make this ~20s AND shrink its exposure to contention by 5x. That is an ask of
// T1, not an assumption about them.

import { test, expect } from '@playwright/test'

// THE PROMISE IS READ OFF THE SCREEN, and the first draft got this wrong in a way worth keeping.
// It parsed src/store/gameConfig.js with /TURN_TIME_LIMIT:\s*(\d+)/ and matched the FIRST occurrence,
// which is Flow's 15 · so the run reported "90025ms against a promised 15000ms · excess 75025ms" and
// reddened a working clock. A loose regex over a file holding one constant PER MODE reads whichever
// mode is declared first (Rule 81 · compute the constraint, do not eyeball it; Rule 111 · a per-mode
// constant is a hidden parameter).
// Tightening the regex would have been the smaller fix and the worse one: the test's claim is that the
// clock delivers what the PLAYER IS PROMISED, and the player is promised whatever ActionBar renders.
// aria-valuemax IS that promise, in seconds, in the DOM. Reading it there makes the two sides of this
// comparison genuinely two (Rule 92a): a rendered attribute against the enforcement path in
// useGameSync, rather than one constant compared with itself.
const readPromisedLimitMs = async (page) => {
  const max = await page.getByTestId('turn-timer').getAttribute('aria-valuemax')
  const n = Number(max)
  expect(Number.isFinite(n) && n > 0, `the turn timer renders no usable aria-valuemax (got "${max}") · ` +
    'without it there is no promise to compare the clock against and this spec measures nothing')
    .toBe(true)
  return n * 1000
}

const SAMPLE_MS = 25          // the recorder's REQUESTED period · not necessarily the one it achieves
const LATE_BUDGET_MS = 500    // 6x the measured 79ms residual, half the 1001ms defect · separates them

const read = (page) => page.evaluate(() => {
  const s = window.__neotopia_store.getState()
  return { turn: s.turnNumber, seat: s.currentSeat, phase: s.phase, actions: s.actionsRemaining,
           human: (s.players.find(p => !p.isBot) ?? {}).seat }
})

test.describe('the turn deadline, on a real clock (T3 S60)', () => {
  test('a turn that is NOT the first ends at the limit the UI promises', async ({ page }) => {
    test.setTimeout(240_000)

    await page.goto('/practice?bots=1')
    await page.waitForFunction(() => typeof window.__neotopia_store !== 'undefined', { timeout: 20_000 })
    const skip = page.getByTestId('tutorial-skip')
    if (await skip.isVisible().catch(() => false)) await skip.click({ force: true })

    // Record every CHANGE of (turn, seat) against a monotonic clock. A change log rather than a sample
    // dump, and performance.now() rather than Date.now() for the same reason the product uses it.
    await page.evaluate((ms) => {
      window.__rec = []
      // THE RECORDER MEASURES ITS OWN RESOLUTION, because its requested period is not the one it gets.
      // Every sample records the gap since the previous one, so the WORST gap over the run is the real
      // floor on how precisely any transition below can be dated (Rule 81 · derive the constraint, do
      // not assume it). Under a 6x CPU throttle a 25ms interval is nowhere near 25ms, and sizing the
      // tolerance from the nominal reported a working clock as firing 51ms EARLY.
      window.__gapMax = 0
      let prev = performance.now()
      window.__recTimer = setInterval(() => {
        const now = performance.now()
        if (now - prev > window.__gapMax) window.__gapMax = now - prev
        prev = now
        const st = window.__neotopia_store.getState()
        const last = window.__rec[window.__rec.length - 1]
        if (!last || last.turn !== st.turnNumber || last.seat !== st.currentSeat) {
          window.__rec.push({ t: Math.round(now), turn: st.turnNumber, seat: st.currentSeat })
        }
      }, ms)
    }, SAMPLE_MS)

    // ── COUNTERWEIGHT FIRST (Rule 90) · THE TURN UNDER TEST MUST NOT BE TURN 1 ────────────────────
    // Turn 1 is exact under BOTH the fixed and the broken clock, because the effect mounts AT the turn
    // so the anchor, the turn and the sampling grid are one instant. A spec that measured turn 1 would
    // pass against the ~1000ms-late build and certify it · which is precisely what every unit test in
    // useGameSync.turntimeout.test.js does, and why none of them saw the regression. So the human's
    // first turn is spent through the real controls, and the turn actually measured is a HAND-OVER.
    let s = await read(page)
    for (let i = 0; i < 6 && s.actions > 0 && s.seat === s.human; i++) {
      await page.getByTestId('card-offer').first().click({ force: true, timeout: 10_000 })
      await page.waitForTimeout(150)
      s = await read(page)
    }
    await page.getByTestId('end-turn-btn').click({ force: true, timeout: 10_000 })

    // Wait for the bot to hand the turn back, then let it expire on its own · no clicks from here.
    const deadline = Date.now() + 150_000
    let measuredTurn = null
    while (Date.now() < deadline) {
      const cur = await read(page)
      if (measuredTurn === null && cur.seat === cur.human && cur.turn > 1) measuredTurn = cur.turn
      if (measuredTurn !== null && cur.turn > measuredTurn) break
      await page.waitForTimeout(500)
    }
    expect(measuredTurn, 'the board never handed the turn back to the human · nothing was measured, ' +
      'and an unmeasured run must not read as a pass').not.toBeNull()

    const { rec, gapMax } = await page.evaluate(() => {
      clearInterval(window.__recTimer)
      return { rec: window.__rec, gapMax: Math.round(window.__gapMax) }
    })
    // A PROBE ASSERTS ITS OWN OUTPUT RANGE (preamble §3). If the recorder could not keep up, this run
    // cannot tell 36ms from 1054ms and must say UNMEASURED rather than produce a verdict · which is the
    // difference between a spec that flakes on a contended runner and one that reports the contention.
    expect(gapMax, `the recorder's worst sampling gap was ${gapMax}ms against a ${LATE_BUDGET_MS}ms ` +
      'budget · this machine was too contended for the measurement to mean anything, so the run is ' +
      'UNMEASURED rather than a pass or a fail. This is an environment finding, not a product one.')
      .toBeLessThan(LATE_BUDGET_MS / 2)
    const startIdx = rec.findIndex(r => r.turn === measuredTurn)
    const endIdx = rec.findIndex(r => r.turn === measuredTurn + 1)
    expect(startIdx, `turn ${measuredTurn} never appears in the recorder`).toBeGreaterThanOrEqual(0)
    expect(endIdx, `turn ${measuredTurn} never ENDED · the clock did not fire at all within the budget, ` +
      'which is the S51 defect (a countdown that displays and enforces nothing) rather than a late one')
      .toBeGreaterThan(startIdx)

    expect(measuredTurn, 'the turn measured is the FIRST one · turn 1 is exact under the broken clock ' +
      'too, so this run proves nothing about the deadline').toBeGreaterThan(1)

    const LIMIT_MS = await readPromisedLimitMs(page)
    const elapsed = rec[endIdx].t - rec[startIdx].t
    console.log(`[turn-clock] turn ${measuredTurn} ran ${elapsed}ms against a promised ${LIMIT_MS}ms · ` +
      `excess ${elapsed - LIMIT_MS}ms (recorder asked for ${SAMPLE_MS}ms, worst gap ${gapMax}ms)`)

    // NEVER EARLY · firing before the deadline takes a turn from a player who can still see time left,
    // and that is the dangerous direction (Rule 100a). One recorder period of slack, because the dating
    // of both transitions is quantised by it and nothing else.
    expect(elapsed, `the turn ended ${LIMIT_MS - elapsed}ms EARLY · a player mid-move loses the turn ` +
      'while their own countdown still shows time remaining').toBeGreaterThanOrEqual(LIMIT_MS - SAMPLE_MS)

    // AND NOT A WHOLE TICK LATE · this is the assertion the whole file exists for.
    expect(elapsed, `turn ${measuredTurn} overran its deadline by ${elapsed - LIMIT_MS}ms. The clock ` +
      'samples on a 1s interval; a full tick of overrun means the deadline is being compared against a ' +
      'WALL clock (Date.now) while setInterval is scheduled on the MONOTONIC one. They drift, the ' +
      're-phased grid lands the deadline exactly ON a tick, and a few milliseconds short there costs a ' +
      'whole second. Measured at 91037/91027/91001 in that state and 90079 once both reads moved to ' +
      'performance.now(). No fake-timer test can see this · they advance both clocks together.')
      .toBeLessThan(LIMIT_MS + LATE_BUDGET_MS)
  })
})
