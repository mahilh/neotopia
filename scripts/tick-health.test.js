// THE OBSERVABLE MUST DISTINGUISH TWO CAUSES WITH OPPOSITE FIXES  (T2 S66)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// "The verdict rate did not move" is produced by the tick never FIRING (GitHub's scheduler, nothing
// here can fix it) and by the tick firing and NOT HELPING (the guard's logic, ours). A report that
// collapses them sends the next reader to debug a guard that never ran (Rule 130).

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { tally, requestedFiresPerHour, tickDidWork } = require('./tick-health.cjs')

const T0 = new Date('2026-08-13T00:00:00Z')
const r = (o) => ({ event: 'push', conclusion: 'success', status: 'completed',
  headSha: 'a', createdAt: '2026-08-13T01:00:00Z', ...o })

describe('tick-health · counterweights first', () => {
  // 1 · THE WINDOW MUST EXCLUDE THE BEFORE-PERIOD. This is the whole reason the tool takes a sha.
  //     A run from before the wiring commit counted in the denominator would drag the rate toward
  //     the old baseline and make a working tick look inert (Rule 126).
  it('runs older than the anchor are not counted at all', () => {
    const t = tally([
      r({ headSha: 'old', createdAt: '2026-08-12T23:00:00Z', conclusion: 'cancelled' }),
      r({ headSha: 'new', createdAt: '2026-08-13T01:00:00Z' }),
    ], T0)
    expect(t.commits, 'a pre-anchor commit is in the denominator · the rate is measuring the ' +
      'before-period and the more recent the change the worse it gets').toBe(1)
    expect(t.measured).toBe(1)
  })

  // 2 · A COMMIT IS MEASURED, NOT A RUN. Three cancellations and one success is ONE measured commit;
  //     counting runs would report 25% for a commit that is perfectly well measured.
  it('counts commits, not runs', () => {
    const t = tally([
      r({ headSha: 'x', conclusion: 'cancelled' }),
      r({ headSha: 'x', conclusion: 'cancelled' }),
      r({ headSha: 'x', conclusion: 'success' }),
    ], T0)
    expect(t.commits).toBe(1)
    expect(t.measured).toBe(1)
  })

  // 3 · CANCELLED IS NOT A VERDICT (Rule 79d), in the one place it decides a number.
  it('a commit whose every run was cancelled is unmeasured', () => {
    const t = tally([r({ headSha: 'y', conclusion: 'cancelled' }), r({ headSha: 'y', conclusion: 'cancelled' })], T0)
    expect(t.measured).toBe(0)
    expect(t.commits).toBe(1)
  })

  // 4 · THE MECHANISM COUNT IS SEPARATE FROM THE OUTCOME COUNT · the point of the whole file.
  it('tick delivery is counted independently of whether the rate moved', () => {
    const t = tally([
      r({ headSha: 'p', event: 'push', conclusion: 'cancelled' }),
      r({ headSha: 'p', event: 'schedule', conclusion: 'success' }),
    ], T0)
    expect(t.ticks, 'scheduled fires are not counted · then "the rate did not move" cannot be told ' +
      'apart from "GitHub never delivered a tick", and those have opposite fixes').toBe(1)
    expect(t.rescuedByTick, 'a commit measured ONLY by a tick is the feature working and is the one ' +
      'direct piece of evidence of value').toBe(1)
  })

  it('a commit measured by a PUSH is not credited to the tick', () => {
    const t = tally([r({ headSha: 'q', event: 'push', conclusion: 'success' })], T0)
    expect(t.rescuedByTick, 'the tick is being credited with work the push did · the feature would ' +
      'look effective the moment it was merely present').toBe(0)
  })

  // ⚠ THE ONE THAT WAS WRONG IN THE SHIPPED VERSION, caught on the first real reading (T2 S66).
  // The first tick ever delivered fired on a commit that ALREADY had a successful push run, so the
  // guard correctly skipped the expensive job · and a run whose only job is skipped still reports
  // `success`. The report called that a rescue. Two paths (did real work / correctly skipped)
  // producing one observable is Rule 130, in the tool written that same hour to avoid it.
  it('a tick that ran on an ALREADY-MEASURED commit is not a rescue', () => {
    const t = tally([
      r({ headSha: 'z', event: 'push', conclusion: 'success' }),
      r({ headSha: 'z', event: 'schedule', conclusion: 'success' }),
    ], T0)
    expect(t.ticks, 'the delivery count is separate and must still see it').toBe(1)
    expect(t.rescuedByTick, 'a tick that correctly SKIPPED was counted as having rescued the commit ' +
      '· the report then claims value the feature did not deliver, on the one number that is its ' +
      'only direct evidence of value').toBe(0)
  })

  it('but a tick on a commit every push run CANCELLED is exactly what a rescue is', () => {
    const t = tally([
      r({ headSha: 'w', event: 'push', conclusion: 'cancelled' }),
      r({ headSha: 'w', event: 'push', conclusion: 'cancelled' }),
      r({ headSha: 'w', event: 'schedule', conclusion: 'success' }),
    ], T0)
    expect(t.rescuedByTick, 'the defect this whole feature exists for · if THIS is not a rescue, ' +
      'nothing ever is and the number is permanently zero').toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE SIBLING, FOUR LINES AWAY  (T2 S67)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// The test above fixed `rescuedByTick`. `tickVerdicts` sat four lines up in the same file, counting
// the SAME `conclusion: 'success'` that a fully-skipped run reports, and printing it as "N of those
// M ticks reached a verdict of their own". Same sitting, same hand, same wrong idea · and the
// preamble's §4 says to grep the file for a wording defect's siblings before committing.
//
// MEASURED at the time of writing: 8 ticks delivered, all `success`, all 11-15 seconds, and every
// one of them skipped its expensive job. The old line would have read "8 of those 8 ticks reached a
// verdict of their own" · eight measurements that never happened.
describe('tick-health · a completed tick and a working tick are different claims', () => {
  const job = (name, conclusion) => ({ name, conclusion, status: 'completed' })
  const GUARD = 'Does the tip still need a verdict?'
  const WORK = 'Reconnect + backend-down E2E'

  // COUNTERWEIGHT FIRST · the ambiguous shape must not resolve to either answer. A tick whose jobs
  // could not be read has NOT been shown to have done nothing (Rule 80).
  it('unreadable jobs are UNMEASURED, never "did nothing"', () => {
    expect(tickDidWork(null), 'a failed jobs lookup resolved to a boolean · the report would then ' +
      'state a fact about work nobody observed').toBe(null)
    expect(tickDidWork([]), 'an empty job list resolved to a boolean').toBe(null)
    expect(tickDidWork([job(GUARD, 'success')]), 'a run carrying ONLY the cheap guard job resolved ' +
      'to a boolean · there is no expensive job to have skipped, so there is nothing to report')
      .toBe(null)
    const t = tally([r({ headSha: 'u', event: 'schedule', conclusion: 'success' })], T0)
    expect(t.ticksUnmeasured, 'a tick with no didWork flag was silently binned as worked or skipped')
      .toBe(1)
    expect(t.ticksWorked + t.ticksSkipped, 'an UNMEASURED tick was also counted as an outcome').toBe(0)
  })

  it('a skipped expensive job is not work, however the RUN concluded', () => {
    expect(tickDidWork([job(GUARD, 'success'), job(WORK, 'skipped')]), 'a run whose only real job ' +
      'was skipped was classified as having done work · this is the exact `success`-at-the-run-level ' +
      'ambiguity that made rescuedByTick lie').toBe(false)
    const t = tally([r({ headSha: 's', event: 'schedule', conclusion: 'success', didWork: false })], T0)
    expect(t.ticksCompleted, 'the run DID complete and that is still true and still worth printing').toBe(1)
    expect(t.ticksWorked, 'a skipped tick counted as work').toBe(0)
    expect(t.ticksSkipped).toBe(1)
  })

  // ── THE FALSE POSITIVE I ALMOST SHIPPED INSIDE THE FIX ──────────────────────────────────────────
  // First version fired the tripwire on `ticksWorked === 0`. The live reading at the time was 8
  // ticks, 0 worked, rate 36% · so it would have reddened at the 48h mark and sent the reader to
  // debug a guard behaving perfectly (Rule 94a · a gate that cries wolf is switched off before the
  // day it is right). A skip is only a defect when the tip it skipped has no verdict.
  it('a tick skipping an ALREADY-MEASURED tip is not a defect signal', () => {
    const t = tally([
      r({ headSha: 'm', event: 'push', conclusion: 'success' }),
      r({ headSha: 'm', event: 'schedule', conclusion: 'success', didWork: false }),
    ], T0)
    expect(t.ticksSkipped).toBe(1)
    expect(t.ticksSkippedOnUnmeasuredTip, 'a correct skip was counted as a guard defect · the ' +
      'tripwire would red on a working system and be switched off before the day it matters').toBe(0)
  })

  it('a tick skipping a tip with NO verdict IS the guard defect', () => {
    const t = tally([
      r({ headSha: 'n', event: 'push', conclusion: 'cancelled' }),
      r({ headSha: 'n', event: 'schedule', conclusion: 'success', didWork: false }),
    ], T0)
    expect(t.ticksSkippedOnUnmeasuredTip, 'the guard declined to run on a commit whose only push ' +
      'run was cancelled · that is precisely the case the feature exists for, and if THIS is not ' +
      'counted the number is permanently zero and the tripwire can never fire').toBe(1)
  })

  it('a tick that ran its expensive job is work, pass or fail', () => {
    // A FAILING E2E run is still a tick that did its job · the tripwire asks whether the tick did
    // the work, not whether the work succeeded. Conflating them would send a reader to debug the
    // scheduler because a test was red.
    expect(tickDidWork([job(GUARD, 'success'), job(WORK, 'success')])).toBe(true)
    expect(tickDidWork([job(GUARD, 'success'), job(WORK, 'failure')]), 'a tick whose E2E job RAN ' +
      'and failed was classified as not having worked').toBe(true)
    const t = tally([r({ headSha: 'v', event: 'schedule', conclusion: 'failure', didWork: true })], T0)
    expect(t.ticksWorked).toBe(1)
    expect(t.ticksSkipped).toBe(0)
  })

  // ── THE CROSS-FILE CONTRACT, ASSERTED AGAINST THE YML ITSELF ────────────────────────────────────
  // The classifier keys on the guard job's NAME, which is a string in a workflow this script does
  // not own. Rename that job and every skipped tick reclassifies as WORK · which is the flattering
  // direction, so nobody would query it, and the tripwire above would then send a reader to debug
  // the E2E job instead of the guard.
  //
  // ⚠ MY FIRST DRAFT OF THIS TEST ASSERTED THE BUG. It fed tickDidWork a renamed guard, got `true`,
  // and asserted `.toBe(true)` with a message explaining that this was wrong · a test that pins the
  // defect, passes forever, and can never notice the rename it is named after. A contract spanning
  // two files has no owner (Rule 115), and the only assertion that owns it is one that reads BOTH.
  it('the name tickDidWork matches is the name e2e.yml actually gives the guard job', () => {
    const yml = readFileSync(join(process.cwd(), '.github/workflows/e2e.yml'), 'utf8')
    const names = [...yml.matchAll(/^\s{4}name:\s*(.+)$/gm)].map(m => m[1].trim())
    expect(names.length, 'no top-level job names were found in e2e.yml · this test is reading the ' +
      'wrong file or the wrong indentation and proves nothing either way').toBeGreaterThan(0)
    const guards = names.filter(n => /still need a verdict/i.test(n))
    expect(guards, 'no job in e2e.yml matches the /still need a verdict/i pattern tickDidWork uses ' +
      `to recognise the cheap guard job (job names found: ${names.join(' | ')}). Every skipped ` +
      'tick will now be classified as having RUN the E2E job, and the tripwire will send the next ' +
      'reader to the wrong file. Update the pattern in scripts/tick-health.cjs to match.')
      .toHaveLength(1)
    // And the classifier really does treat that exact string as the cheap one.
    expect(tickDidWork([job(guards[0], 'success'), job(WORK, 'skipped')]),
      'the live guard-job name is not being recognised by the very pattern this test just matched ' +
      '· the two halves disagree, which means one of them is not reading what it claims').toBe(false)
  })
})

describe('tick-health · the cron is read, not typed', () => {
  const withCron = (body, fn) => {
    const d = mkdtempSync(join(tmpdir(), 'tick-'))
    try { mkdirSync(join(d, 'wf')); const f = join(d, 'wf', 'e2e.yml'); writeFileSync(f, body); return fn(f) }
    finally { rmSync(d, { recursive: true, force: true }) }
  }

  it('reads the requested cadence out of the workflow', () => {
    withCron("on:\n  schedule:\n    - cron: '19,49 * * * *'\n", f =>
      expect(requestedFiresPerHour(f)).toBe(2))
    withCron("on:\n  schedule:\n    - cron: '*/15 * * * *'\n", f =>
      expect(requestedFiresPerHour(f)).toBe(4))
    withCron("on:\n  schedule:\n    - cron: '0 5 * * *'\n", f =>
      expect(requestedFiresPerHour(f)).toBe(1))
  })

  it('a workflow with NO cron reports null, not a number', () => {
    // The silent-disable case. If someone removes the schedule, a hardcoded "2 per hour" would keep
    // reporting a delivery percentage against a cadence nobody asked for · a confident wrong number
    // rather than "the schedule is gone" (Rule 80).
    withCron('on:\n  push:\n    branches: [main]\n', f =>
      expect(requestedFiresPerHour(f), 'a missing cron produced a number · the report would then ' +
        'compute a delivery rate for a schedule that does not exist').toBe(null))
  })

  it('an unreadable file reports null rather than throwing into the caller', () => {
    expect(requestedFiresPerHour('/no/such/workflow.yml')).toBe(null)
  })
})
