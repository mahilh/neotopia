// HOW LONG DOES A BOT ACTUALLY THINK?  (T2 S68 · Council's tripwire for T1's thinking indicator)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// T1 declined a "thinking..." indicator in S62 on a premise they could not check from their lane:
// *"a thinking indicator on a bot that decided instantly and is sitting on a timer is theatre."*
// They were right to refuse rather than guess. `chooseBotAction` is pure and lives in src/lib, so
// the measurement is mine, and it decides whether anything gets built.
//
// COUNCIL'S TRIPWIRE, stated before the run:
//     deliberation UNDER 10ms   ->  no indicator. The pause is a DESIGNED DELAY and the honest
//                                   surface is a countdown, or nothing at all.
//     hundreds of ms            ->  a thinking state is truthful and should ship.
//
// WHAT THE 2.5-3.2s IS MADE OF, read from the source before timing anything: `useBotTurns.js:17`
// sets `BOT_MOVE_DELAY_MS = 650` and `:97` applies it via setTimeout to EVERY ACTION, not every
// turn. A bot turn is roughly four actions (draw / place / score / endTurn), so 4 x 650 = 2600ms
// falls squarely inside the observed range with no computation in it at all. That is a hypothesis
// about where the time goes; the number below is the measurement that settles it.

import { describe, it, expect, vi } from 'vitest'

// The timing wrapper delegates to the REAL function · this measures chooseBotAction, it does not
// model it (preamble §3 · when the harness simulates the subject, the harness is the suspect).
// `vi.hoisted` because a vi.mock factory is hoisted above module-scope `let` and would hit the TDZ.
// `game` is bumped by the test before each playOnce and is part of the per-turn key.
// ⚠ IT IS THERE BECAUSE ITS ABSENCE PRODUCED A FALSE ALARM ON THE FIRST RUN. Keyed on `seat|turn`
// alone, twelve games' turn-5s merged into one bucket · 1,653 decisions in 32 "turns", 51 decisions
// per turn, and a p99 of 19.5ms that reddened Council's 10ms gate on entirely correct code.
// turnNumber restarts at 1 in every game, so it does not identify a turn across games (Rule 107's
// family · a key that does not distinguish the thing it names). The tell was in the output and not
// in the failure: n=32 was impossible before the number attached to it was worth reading.
const rec = vi.hoisted(() => ({ calls: [], enabled: false, game: 0 }))

vi.mock('../lib/botPolicy', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    chooseBotAction: (args) => {
      if (!rec.enabled) return actual.chooseBotAction(args)
      const t0 = performance.now()
      const r = actual.chooseBotAction(args)
      rec.calls.push({ ms: performance.now() - t0, difficulty: args.difficulty,
        game: rec.game, turn: args.state?.turnNumber ?? -1, seat: args.seat })
      return r
    },
  }
})

const { playOnce, bots } = await import('./ladderHarness')

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
const mean = a => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : 0)
const r3 = x => +x.toFixed(3)

describe('bot deliberation · the number that decides whether a thinking indicator is honest', () => {
  // ── COUNTERWEIGHT 1 · THE MOCK IS IN EFFECT ────────────────────────────────────────────────────
  // If the wrapper never ran, `calls` is empty and every percentile below is 0 · which reads as
  // "instant" and is the answer Council's tripwire treats as decisive. An empty sample must be
  // UNMEASURED, never a plausible zero (Rule 80).
  it('the timing wrapper is actually installed', () => {
    rec.enabled = true
    rec.calls.length = 0
    playOnce(bots('builder', 'builder'), 7001)
    expect(rec.calls.length, 'ZERO timed calls · the botPolicy mock did not take effect, so the ' +
      'numbers below are an empty array reporting itself as 0ms. UNMEASURED, not instant')
      .toBeGreaterThan(50)
  })

  // ── COUNTERWEIGHT 2 · THE INSTRUMENT CAN SEE THE THING IT IS ABOUT TO REPORT AS ABSENT ─────────
  // A clock with 100ms granularity would report every sub-ms call as 0 and produce exactly the
  // "under 10ms" verdict Council is asking for, for entirely the wrong reason. So the same
  // expression is pointed at a known duration first (Rule 120 / preamble §3 · ask the probe
  // something whose answer you already know, in the same run).
  it('performance.now() here resolves a duration far below the 10ms decision threshold', () => {
    const known = () => { const end = performance.now() + 2; while (performance.now() < end) { /* spin */ } }
    const t0 = performance.now(); known(); const measured = performance.now() - t0
    expect(measured, 'a deliberate 2ms busy-wait measured as ' + r3(measured) + 'ms · this clock ' +
      'cannot resolve the scale the verdict is about, so a reported 0 would mean nothing')
      .toBeGreaterThan(1)
    expect(measured, 'a 2ms wait measured as ' + r3(measured) + 'ms · the clock is running fast or ' +
      'the spin loop is not spinning').toBeLessThan(50)
    // And sub-millisecond resolution specifically, because that is the regime the answer lives in.
    const t1 = performance.now(); const t2 = performance.now()
    expect(t2 - t1, 'two back-to-back reads are identical · this clock is integer-millisecond and ' +
      'cannot distinguish 0.1ms from 0.9ms').toBeLessThan(1)
  })

  // ── THE MEASUREMENT ────────────────────────────────────────────────────────────────────────────
  it('measures per-decision and per-turn deliberation across the whole ladder', () => {
    rec.enabled = true
    rec.calls.length = 0
    // Every rung, both seatings, several seeds · the architect searches differently from the
    // apprentice and a mean over one rung would be a fact about that rung (Rule 111).
    for (const [a, b] of [['apprentice', 'apprentice'], ['builder', 'builder'],
      ['architect', 'architect'], ['architect', 'apprentice']]) {
      for (let i = 0; i < 3; i++) { rec.game++; playOnce(bots(a, b), 7100 + i * 37) }
    }

    const all = rec.calls.map(c => c.ms)
    // PER TURN is what a player perceives · a turn is several decisions and the delay is per action.
    const byTurn = new Map()
    for (const c of rec.calls) {
      const k = `${c.game}|${c.seat}|${c.turn}`
      byTurn.set(k, (byTurn.get(k) ?? 0) + c.ms)
    }
    const turns = [...byTurn.values()]

    const report = (label, xs) => `${label.padEnd(12)} n=${String(xs.length).padStart(5)}  ` +
      `mean ${String(r3(mean(xs))).padStart(7)}  p50 ${String(r3(pct(xs, 0.5))).padStart(7)}  ` +
      `p90 ${String(r3(pct(xs, 0.9))).padStart(7)}  p99 ${String(r3(pct(xs, 0.99))).padStart(7)}  ` +
      `max ${String(r3(Math.max(...xs))).padStart(8)}`
    // eslint-disable-next-line no-console
    console.log('DELIBERATION (ms)')
    // eslint-disable-next-line no-console
    console.log('  ' + report('per decision', all))
    // eslint-disable-next-line no-console
    console.log('  ' + report('per turn', turns))
    for (const d of ['apprentice', 'builder', 'architect']) {
      const xs = rec.calls.filter(c => c.difficulty === d).map(c => c.ms)
      // eslint-disable-next-line no-console
      if (xs.length) console.log('  ' + report(d, xs))
    }
    // THE RATIO IS THE ANSWER, and it is computed rather than asserted (Rule 81 · compute the
    // constraint in the test, not in your head). Decisions per turn is measured, not the "~4" the
    // header guesses from reading useBotTurns.
    const perTurn = rec.calls.length / turns.length
    const timerMs = 650 * perTurn
    // eslint-disable-next-line no-console
    console.log(`  BOT_MOVE_DELAY_MS 650 per ACTION x ${r3(perTurn)} decisions/turn = ${r3(timerMs)}ms ` +
      `of pure timer against ${r3(mean(turns))}ms of thought · the timer is ${Math.round(timerMs / mean(turns))}x ` +
      'the computation')
    // TWO MARGINS, AND THEY ARE VERY DIFFERENT SIZES · reporting only the comfortable one would be
    // the whole error this file exists to avoid.
    // eslint-disable-next-line no-console
    console.log(`  MARGIN · vs Council's ABSOLUTE 10ms: only ${r3(10 / pct(turns, 0.99))}x on p99 · ` +
      `vs the DELAY a player actually waits through: ${Math.round(timerMs / pct(turns, 0.99))}x`)

    // ── THE VERDICT IS COUNCIL'S 10ms · THE GATE IS NOT, AND THE DIFFERENCE IS DELIBERATE ────────
    // ⚠ I WROTE `expect(p99).toBeLessThan(10)` FIRST AND MEASURED IT INTO A FLAKE. Council's 10ms
    // is an ABSOLUTE wall-clock bound, and preamble §3 says a bound is a claim about a noise floor
    // that stays unmeasured until you move the load. Swept:
    //     quiet      p99 3.33ms   max 3.60   ->  2.99x margin
    //     contended  p99 4.31ms   max 5.85   ->  2.32x margin      (full serial suite alongside)
    // A CI box at load 14 · which this repo hit twice tonight · would plausibly cross 10ms and red
    // the shared gate for all three lanes over nothing. A wire sized from an idle run is a flake
    // with a delay on it (Rule 111's corollary).
    //
    // So the GATE is normalised by a calibration workload timed IN THE SAME RUN. Both the bot and
    // the reference slow down together, so the ratio is mostly a property of the CODE rather than of
    // the hardware. Council's absolute number is still REPORTED above, because it is their threshold
    // and it is the one a human should read.
    //
    // ⚠ "MOSTLY", NOT "MACHINE-INDEPENDENT" · I wrote the stronger word first and the sweep does not
    // support it. Measured against 10 CPU burners on 8 cores:
    //     absolute p99   3.33ms -> 19.76ms   x5.9   · CROSSES Council's 10ms, so the naive gate flakes
    //     normalised     0.273  ->  0.433    x1.6   · same run, same load
    // Normalising absorbs most of the variance and not all of it, because p99 is a TAIL statistic and
    // contention hits tails harder than throughput, while the calibration loop measures throughput.
    // The gate at 2.0 therefore keeps 4.6x margin over the WORST contended reading rather than over
    // the comfortable one. Stating the residual is the point: a limit gets believed harder than a
    // finding (preamble §4), so the one place an overclaim is most expensive is right here.
    const calib = () => {
      const t = performance.now()
      let x = 0
      for (let i = 0; i < 3_000_000; i++) x = (x + i) % 97
      return { ms: performance.now() - t, x }
    }
    const c = calib()
    // POSITIVE CONTROL · a loop the engine optimised away would return instantly and make every
    // ratio below enormous, failing in the alarming direction for no reason. Assert it ran.
    // 39 is DETERMINISTIC arithmetic, verified independently in node and in python before being
    // written here · not copied from the failure message, which would be one source agreeing with
    // itself (Rule 92). Sizing a constant from a run is only forbidden when the quantity is a
    // measurement; this one is a fact. ⚠ I wrote 51 first, from reasoning, and this control caught
    // it on its first execution · which is exactly what a positive control is for (Rule 81).
    expect(c.x, 'the calibration loop was optimised away or short-circuited · its time is not a ' +
      'unit of work and the normalised gate below is meaningless').toBe(39)
    expect(c.ms, 'the calibration workload took ' + r3(c.ms) + 'ms · too fast to normalise against, ' +
      'so the ratio is dominated by clock noise rather than by CPU speed').toBeGreaterThan(1)

    const p99 = pct(turns, 0.99)
    const units = p99 / c.ms
    // eslint-disable-next-line no-console
    console.log(`  NORMALISED · p99 turn = ${r3(units)} calibration-units (calib ${r3(c.ms)}ms) · ` +
      'normalised (not fully machine-independent · see below), and this is what the gate reads')
    expect(units, `a bot TURN now costs ${r3(units)} calibration units of thought, up from the 0.27-0.28 ` +
      'measured in S68 · chooseBotAction has gained real work. The finding that the 2.5-3.2s pause ' +
      'is a DESIGNED DELAY (650ms x 4.8 actions) and not computation may no longer hold, and with ' +
      'it T1\'s reason for declining a thinking indicator. Re-run the sweep and re-open it with ' +
      'them rather than widening this bound (Rule 133 · a finding is scoped to the ruleset it was ' +
      'measured under)').toBeLessThan(2)
  }, 300_000)
})
