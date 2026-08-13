// THE TICK THAT MUST NOT BECOME THE DEFECT  (T2 S65)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// e2e.yml loses 39 of every 60 runs to cancellation and reaches a verdict on 35% of commits. The fix
// is a scheduled tick that runs only when the tip is unmeasured. A tick has two ways to make things
// strictly worse, and both are cheap to build by accident:
//
//   1 · it cancels somebody's fresh push run (same ref, same concurrency group)
//   2 · it gates a push run, turning the merge gate into a thing that sometimes does not run
//
// Both are asserted first and alone, because they are failures where the WORKFLOW STILL GOES GREEN ·
// a cancelled push run and a skipped push run both look like a quiet, healthy CI.

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { decide } = require('./tip-verdict-needed.cjs')

const SHA = 'abc1234def5678'
const run = (o = {}) => ({ head_sha: SHA, status: 'completed', conclusion: 'success', id: 1, ...o })

describe('tip-verdict-needed · counterweights first', () => {
  // ── 1 · THE MERGE GATE IS NEVER GATED ──────────────────────────────────────────────────────────
  // The single most dangerous outcome in this file. If a push run can ever be skipped, the fix for
  // "commits go unmeasured" is a mechanism that makes commits go unmeasured, and it reports success
  // while doing it. Every non-schedule event, against a history that would skip a tick.
  it.each(['push', 'pull_request', 'workflow_dispatch', 'merge_group', ''])(
    'event %s ALWAYS runs, whatever the history says', (event) => {
      const history = [run(), run({ status: 'in_progress', conclusion: null, id: 2 })]
      const d = decide(history, { sha: SHA, event })
      expect(d.needed, `a ${event || '(empty)'} run was skipped · this is the merge gate and it must ` +
        'always execute. A skipped gate and a passing gate are the same colour in the UI')
        .toBe(true)
      expect(d.reason).toBe('NOT-A-TICK')
    })

  // ── 2 · A TICK NEVER RACES A RUN THAT IS ALREADY GOING ─────────────────────────────────────────
  // Two Playwright runs at once both call purge_e2e_test_data() in globalTeardown, which deletes
  // rooms project-wide with no status and no age predicate · they destroy each other's fixtures.
  it('skips while any run of the workflow is in flight', () => {
    for (const status of ['queued', 'in_progress', 'waiting', 'requested', 'pending']) {
      const d = decide([run({ head_sha: 'other', status, conclusion: null, id: 9 })],
        { sha: SHA, event: 'schedule' })
      expect(d.needed, `a tick proceeded while a run was ${status} · both teardowns purge rooms ` +
        'project-wide, so the two runs delete each other').toBe(false)
      expect(d.reason).toBe('ALREADY-RUNNING')
    }
  })

  it('does not count ITSELF as an in-flight run', () => {
    // The tick's own run is in_progress by definition while this executes. Without the selfId
    // exclusion the guard would skip every single time and the whole feature would be inert ·
    // green forever, doing nothing, which is indistinguishable from working.
    const d = decide([run({ head_sha: SHA, status: 'in_progress', conclusion: null, id: 77 })],
      { sha: SHA, event: 'schedule', selfId: 77 })
    expect(d.needed, 'the tick saw its own run and stood down · this guard can then never fire, and ' +
      'nothing about the output would say so').toBe(true)
  })

  // ── 3 · UNREADABLE HISTORY FAILS OPEN ──────────────────────────────────────────────────────────
  it('a history that cannot be read means RUN, not skip', () => {
    const d = decide(null, { sha: SHA, event: 'schedule' })
    expect(d.needed, 'the guard failed CLOSED · it would then disable itself permanently and ' +
      'silently the first time the API hiccuped, which is the defect it exists to fix').toBe(true)
    expect(d.reason).toBe('UNMEASURED')
  })

  // ── 4 · AND IT MUST ACTUALLY SKIP · the cost argument depends on it ────────────────────────────
  // If it never skipped, this would be "run the full E2E every 20 minutes", which is a large
  // identity bill wearing a fix's clothing. The steady state IS the skip.
  it('skips when the tip already has a verdict', () => {
    for (const conclusion of ['success', 'failure']) {
      const d = decide([run({ conclusion })], { sha: SHA, event: 'schedule' })
      expect(d.needed).toBe(false)
      expect(d.reason).toBe('ALREADY-MEASURED')
    }
  })
})

describe('tip-verdict-needed · the case it exists for', () => {
  it('runs when every run for the tip was cancelled', () => {
    // The exact history that produced the defect: pushes arrive faster than a run completes, so the
    // tip carries three superseded runs and no verdict.
    const d = decide([
      run({ conclusion: 'cancelled', id: 1 }),
      run({ conclusion: 'cancelled', id: 2 }),
      run({ conclusion: 'cancelled', id: 3 }),
      run({ head_sha: 'older', conclusion: 'success', id: 4 }),
    ], { sha: SHA, event: 'schedule' })
    expect(d.needed, 'three cancelled runs and no verdict is precisely the state this feature is ' +
      'for · if it skips here it does nothing at all').toBe(true)
    expect(d.reason).toBe('TIP-UNMEASURED')
    expect(d.detail).toMatch(/cancelled/)
  })

  it('runs when no run was ever created for the tip', () => {
    const d = decide([run({ head_sha: 'older' })], { sha: SHA, event: 'schedule' })
    expect(d.needed).toBe(true)
    expect(d.reason).toBe('TIP-UNMEASURED')
    // The two TIP-UNMEASURED cases must be distinguishable in the summary a human reads: "runs
    // exist and none finished" sends you to look at cancellations, "no run was ever created" sends
    // you to look at the trigger. Same verdict, different investigation.
    expect(d.detail, 'the never-created case reads identically to the all-cancelled case')
      .toMatch(/has ever been created/)
  })

  it('a verdict on a DIFFERENT commit does not count as this tip being measured', () => {
    // The failure that would make the whole thing silently inert: matching on "is there any recent
    // success" rather than on this sha. It would skip forever, because there is always a recent
    // success somewhere in the history.
    const d = decide([run({ head_sha: 'someone-elses-commit', conclusion: 'success' })],
      { sha: SHA, event: 'schedule' })
    expect(d.needed, 'a success on another commit satisfied the check · the tip can then never be ' +
      'measured, and the busier the repo the more certain that becomes').toBe(true)
  })

  it('cancelled and skipped are not verdicts', () => {
    // Rule 79d, in the one place it decides behaviour rather than prose.
    for (const conclusion of ['cancelled', 'skipped', 'timed_out', 'action_required', null]) {
      const d = decide([run({ conclusion })], { sha: SHA, event: 'schedule' })
      expect(d.needed, `"${conclusion}" was treated as a verdict · "not red" and "green" are ` +
        'different claims').toBe(true)
    }
  })

  it('IN-FLIGHT beats ALREADY-MEASURED · the order of the two skips is itself a decision', () => {
    // Both branches return needed:false, so the ORDER cannot be caught by the boolean · only by the
    // reason string. It matters because the two skips mean different things to a human reading the
    // summary: "nothing to do" against "something else is doing it". A tick that reports the wrong
    // one sends whoever is debugging a stalled gate to the wrong place.
    const d = decide([
      run({ conclusion: 'success', id: 1 }),
      run({ head_sha: 'other', status: 'in_progress', conclusion: null, id: 2 }),
    ], { sha: SHA, event: 'schedule' })
    expect(d.needed).toBe(false)
    expect(d.reason).toBe('ALREADY-RUNNING')
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE FETCH · targeted queries, not a page that can be outrun  (T2 S66 · my own S65 critique)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// The old fetch asked for 60 runs and filtered client-side. Three lanes push in bursts, so the tip's
// runs fall off that page and the filter reports "no run has ever been created for <sha>" · which is
// false, fails OPEN (so nothing breaks), and therefore prints a wrong REASON on a working mechanism.
// That is the least-audited line in any tool (preamble §4).
//
// `api` is injected here. The queries themselves are one line each and were verified live against
// the real API with a control; what is worth testing is the UNION, which is where a mistake lives.
describe('fetchRuns · the queries and how they combine', () => {
  const { fetchRuns } = require('./tip-verdict-needed.cjs')

  it('asks for THIS sha server-side, and for live runs separately', () => {
    const asked = []
    const api = (p) => { asked.push(p); return [] }
    fetchRuns('e2e.yml', 'o/r', 'deadbeef', api)
    expect(asked.some(p => p.includes('head_sha=deadbeef')), 'the sha is not in the query · the ' +
      'filter is still client-side and can still be outrun by other commits').toBe(true)
    expect(asked.some(p => p.includes('status=in_progress')), 'nothing asks for in-flight runs · the ' +
      'collision check is about the WORKFLOW, not about this sha, so it cannot come from the sha query')
      .toBe(true)
    expect(asked.every(p => p.includes('per_page=100'))).toBe(true)
  })

  it('unions the two queries and de-duplicates by id', () => {
    // A run for THIS sha that is ALSO in flight appears in both answers. Counting it twice is
    // harmless today and is exactly the kind of thing that stops being harmless.
    const mine = [{ id: 1, head_sha: 'abc', status: 'in_progress', conclusion: null }]
    const live = [{ id: 1, head_sha: 'abc', status: 'in_progress', conclusion: null },
                  { id: 2, head_sha: 'other', status: 'queued', conclusion: null }]
    const api = (p) => (p.includes('head_sha') ? mine : p.includes('in_progress') ? live : [])
    const out = fetchRuns('e2e.yml', 'o/r', 'abc', api)
    expect(out.map(r => r.id).sort()).toEqual([1, 2])
  })

  it('a failing query means UNMEASURED, not an empty history', () => {
    // The distinction the whole fail-open design rests on: [] would be read as "no runs exist" and
    // could produce a confident TIP-UNMEASURED or a confident skip. null cannot be mistaken for data.
    const api = () => { throw new Error('gh exploded') }
    expect(fetchRuns('e2e.yml', 'o/r', 'abc', api), 'a thrown query resolved to a value · an API ' +
      'outage would then be reported as a fact about the run history').toBe(null)
  })
})
