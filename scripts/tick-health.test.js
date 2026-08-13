// THE OBSERVABLE MUST DISTINGUISH TWO CAUSES WITH OPPOSITE FIXES  (T2 S66)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// "The verdict rate did not move" is produced by the tick never FIRING (GitHub's scheduler, nothing
// here can fix it) and by the tick firing and NOT HELPING (the guard's logic, ours). A report that
// collapses them sends the next reader to debug a guard that never ran (Rule 130).

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { tally, requestedFiresPerHour } = require('./tick-health.cjs')

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
