#!/usr/bin/env node
/**
 * NeoTopia · is the tip-verdict tick working?  (T2 S66)
 * ═════════════════════════════════════════════════════════════════════════════════════════════════
 * TWO NUMBERS, NEVER ONE, AND THAT IS THE WHOLE DESIGN. "The verdict rate did not move" has two
 * causes with OPPOSITE fixes (Rule 130 · ask of any result how many ways it could have been
 * produced):
 *
 *     the tick never FIRED          -> GitHub's scheduler. Nothing in this repo can fix it.
 *     the tick fired and DID NOT HELP -> the guard's logic. Ours to fix.
 *
 * A single "verdict rate" cannot distinguish them, and the second is the only one worth acting on.
 *
 * ⚠ AND THE FIRST IS NOT HYPOTHETICAL · MEASURED IN THIS REPO, T2 S66:
 *       health.yml asks for `0,30 * * * *`   = 2 fires/hour
 *       GitHub delivered                      = 0.78 fires/hour  ·  39% of requested
 *       gap between consecutive fires: min 48min · MEDIAN 77min · max 145min
 * e2e-live-nightly's `0 5 * * *` lands at 05:54-06:18 every day, i.e. 54-78 minutes late. So a tick
 * asking for 19/49 past the hour will be delivered roughly every 77 minutes, sometimes at 145, and
 * about three in five requested fires never happen at all. THAT IS NORMAL AND IT IS NOT A DEFECT ·
 * but a reader who does not know it will conclude the tick is broken the first time they look.
 * The design still works (77 minutes against the three NIGHTS this replaced); the stated latency in
 * e2e.yml's header, "every half hour", is optimistic and this is the number to believe.
 *
 * ANCHORED TO A COMMIT, NEVER TO A WINDOW. `--since <sha>` measures the verdict rate over commits
 * that came AFTER the tick was wired. A rolling window silently includes the before-period and the
 * more recent the change the more of the window is the wrong side of it (Rule 126 · a mistake made
 * in S57 and nearly repeated twice in S65).
 *
 * USAGE
 *   node scripts/tick-health.cjs --since 881e5e7          report
 *   node scripts/tick-health.cjs --since 881e5e7 --gate   exit 1 if the tripwire genuinely fires
 */

const { execFileSync } = require('child_process')
const fs = require('fs')

const WORKFLOW = 'e2e.yml'
const REPO = process.env.GITHUB_REPOSITORY || 'mahilh/neotopia'
// The cron e2e.yml asks for. Read from the file rather than typed, so changing the schedule cannot
// leave this reporting against a cadence nobody requested any more.
function requestedFiresPerHour(file = '.github/workflows/e2e.yml') {
  try {
    const m = fs.readFileSync(file, 'utf8').match(/^\s*-\s*cron:\s*'([^']+)'/m)
    if (!m) return null
    const minutes = m[1].split(' ')[0]
    if (minutes === '*') return 60
    if (minutes.startsWith('*/')) return 60 / Number(minutes.slice(2))
    return minutes.split(',').filter(Boolean).length
  } catch { return null }
}

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

/**
 * Did a scheduled run actually DO the work, or did its guard correctly skip the expensive job?
 *
 * ⚠ THIS EXISTS BECAUSE THE FIELD IT REPLACES WAS THE SIBLING OF A DEFECT I ALREADY FIXED (T2 S67).
 * At S66 close I fixed `rescuedByTick`, which had counted a correctly-skipped tick as a rescue, and
 * wrote the reason into the comment below it: a run whose only job is skipped still reports
 * `success` at the RUN level. Four lines above it sat `tickVerdicts`, counting exactly that
 * `success` and printed as "N of those M ticks reached a verdict of their own". Same file, same
 * sitting, same wrong idea, one branch fixed. The preamble's own §4 says to grep the file for a
 * wording defect's siblings before committing, and this is the SECOND time I have broken that rule
 * within four lines of the fix (the first was `NO RUN` -> `no run YET`).
 *
 * MEASURED, and it is not hypothetical: all EIGHT ticks delivered since the feature landed reported
 * `success` and every one of them skipped its expensive job. The old line would have printed
 * "8 of those 8 ticks reached a verdict of their own" · which is true at the run level and reads as
 * eight measurements that never happened.
 *
 * THE DISCRIMINATOR IS THE JOB CONCLUSION, NOT THE DURATION. A skipped tick takes 11-15s against a
 * real run's ~325s, so a duration threshold would separate them today · that is a PROXY with a
 * hand-picked cutoff (Rule 96a / Rule 88c), and `conclusion: 'skipped'` is the fact itself.
 *
 * @returns true (ran real work) · false (every expensive job skipped) · null (UNMEASURED)
 */
function tickDidWork(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) return null
  // The guard job is cheap and always runs; anything else is the work the tick exists to do.
  const expensive = jobs.filter(j => !/still need a verdict/i.test(j.name ?? ''))
  if (expensive.length === 0) return null
  return expensive.some(j => j.conclusion !== 'skipped')
}

/**
 * Verdict accounting over a set of runs, per COMMIT rather than per run · a commit with three
 * cancelled runs and one success is measured, and a commit with five cancellations is not.
 *
 * A run may carry `didWork` (see tickDidWork). Absent means UNMEASURED and is never counted as
 * either outcome · a tick whose jobs could not be read has not been shown to have done nothing.
 */
function tally(runs, sinceTime) {
  const inWindow = runs.filter(r => new Date(r.createdAt) >= sinceTime)
  const byCommit = new Map()
  for (const r of inWindow) {
    const e = byCommit.get(r.headSha) || { verdict: false, pushVerdict: false, events: new Set() }
    const terminal = r.conclusion === 'success' || r.conclusion === 'failure'
    if (terminal) {
      e.verdict = true
      // Tracked SEPARATELY · see rescuedByTick. A commit that a push run already measured was not
      // rescued by anything, whatever else ran on it afterwards.
      if (r.event !== 'schedule') e.pushVerdict = true
    }
    e.events.add(r.event)
    byCommit.set(r.headSha, e)
  }
  const commits = [...byCommit.values()]
  return {
    runs: inWindow.length,
    commits: commits.length,
    measured: commits.filter(c => c.verdict).length,
    ticks: inWindow.filter(r => r.event === 'schedule').length,
    // RENAMED FROM `tickVerdicts` (T2 S67) · the name was the defect. "Completed" is what this
    // counts and all it has ever counted: the run reached a terminal conclusion rather than being
    // cancelled or still running. It says nothing about whether the tick MEASURED anything, and the
    // three fields below are what answer that.
    ticksCompleted: inWindow.filter(r => r.event === 'schedule' && (r.conclusion === 'success' || r.conclusion === 'failure')).length,
    ticksWorked: inWindow.filter(r => r.event === 'schedule' && r.didWork === true).length,
    ticksSkipped: inWindow.filter(r => r.event === 'schedule' && r.didWork === false).length,
    ticksUnmeasured: inWindow.filter(r => r.event === 'schedule' && (r.didWork === undefined || r.didWork === null)).length,
    // ── THE ONLY SKIP THAT IS A BUG (T2 S67) ───────────────────────────────────────────────────
    // A tick that skips because the tip already has a verdict is the feature working. A tick that
    // skips a tip with NO verdict is the guard answering ALREADY-MEASURED when it should not, and
    // those are opposite findings behind one observable (`didWork === false`) · Rule 130 again, one
    // layer above the one this file was rewritten for.
    //
    // ⚠ THIS DISTINCTION IS LOAD-BEARING AND I NEARLY SHIPPED WITHOUT IT. My first version fired
    // the tripwire on `ticksWorked === 0`, and the live reading is 8 ticks, 0 worked, rate 36% ·
    // so at the 48h mark it would have reddened and sent the next reader to debug a guard that is
    // behaving perfectly. A gate that cries wolf on a working system gets switched off long before
    // the day it is right (Rule 94a), and I would have introduced it inside the fix for a tool
    // whose entire subject is instruments that misreport.
    ticksSkippedOnUnmeasuredTip: inWindow.filter(r =>
      r.event === 'schedule' && r.didWork === false && !byCommit.get(r.headSha)?.pushVerdict).length,
    // A commit whose ONLY verdict came from a tick · the feature working, and the only direct
    // evidence of value in this whole report.
    //
    // ⚠ THIS COUNTED ANY COMMIT A TICK TOUCHED UNTIL T2 S66 CLOSE, AND IT LIED ON ITS FIRST REAL
    // READING. The first tick ever delivered fired on 17dd498, which ALREADY had a successful push
    // run, so the guard correctly SKIPPED the expensive job · and a run whose only job is skipped
    // still reports `success` at the run level. So a tick that did nothing, exactly as designed,
    // was reported as "1 commit measured by a TICK that would otherwise be unmeasured". False.
    // Two paths (did real work / correctly skipped) producing one observable (conclusion: success)
    // is Rule 130, in the instrument built tonight to avoid exactly that. `pushVerdict` is the
    // discriminator and it costs one field.
    rescuedByTick: [...byCommit.values()].filter(c => c.verdict && !c.pushVerdict && c.events.has('schedule')).length,
  }
}

function main() {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d }
  const gate = process.argv.includes('--gate')
  const since = arg('since', null)
  if (!since) { console.error('tick-health: --since <sha> is required · a rolling window would include the before-period (Rule 126)'); process.exit(2) }

  let sinceTime, sinceShort
  try {
    sinceShort = sh('git', ['rev-parse', '--short', since]).trim()
    sinceTime = new Date(sh('git', ['show', '-s', '--format=%cI', since]).trim())
  } catch { console.error(`tick-health: ${since} is not a commit in this repo`); process.exit(2) }

  let runs
  try {
    runs = JSON.parse(sh('gh', ['run', 'list', '--workflow', WORKFLOW, '--limit', '200',
      '--json', 'event,conclusion,status,headSha,createdAt,databaseId']))
  } catch { runs = null }

  // ── DID EACH TICK ACTUALLY WORK · one extra call per SCHEDULED run, and only inside the window ──
  // Bounded on purpose: the run list is one call, and this is one per tick. Ticks are rare (8 in the
  // first day) and only they can carry the ambiguity, so pushes are never asked. A failure here
  // leaves `didWork` undefined, which tally counts as UNMEASURED rather than as "did nothing"
  // (Rule 80 · a counter that cannot measure must say so, never resolve to a plausible value).
  if (runs) {
    for (const r of runs) {
      if (r.event !== 'schedule' || new Date(r.createdAt) < sinceTime) continue
      try {
        r.didWork = tickDidWork(JSON.parse(sh('gh', ['run', 'view', String(r.databaseId), '--json', 'jobs'])).jobs)
      } catch { /* leave undefined · UNMEASURED */ }
    }
  }

  const hoursSince = (Date.now() - sinceTime.getTime()) / 3.6e6
  const perHour = requestedFiresPerHour()
  const out = []
  out.push(`TICK HEALTH · ${WORKFLOW} · since ${sinceShort} (${sinceTime.toISOString()}, ${hoursSince.toFixed(1)}h ago)`)

  // ── UNMEASURED, never a plausible zero (Rule 80) ────────────────────────────────────────────────
  if (runs === null) {
    out.push('  UNMEASURED · the run list could not be read. This is NOT "the tick is broken".')
    console.log(out.join('\n'))
    process.exit(0)
  }
  const t = tally(runs, sinceTime)
  if (t.commits === 0) {
    out.push('  UNMEASURED · no runs at all since that commit. Nothing has been pushed, so there is')
    out.push('               nothing for a tick to rescue and no rate to report.')
    console.log(out.join('\n'))
    process.exit(0)
  }

  const rate = 100 * t.measured / t.commits
  out.push('')
  out.push(`  OUTCOME   ${t.measured}/${t.commits} commits reached a verdict · ${rate.toFixed(0)}%   (baseline before the tick: 35%)`)
  out.push(`            of those, ${t.rescuedByTick} were measured by a TICK and would otherwise be unmeasured`)
  out.push('')

  // ── THE MECHANISM · did GitHub deliver the schedule at all ──────────────────────────────────────
  if (perHour === null) {
    out.push('  MECHANISM UNMEASURED · no cron found in the workflow · has the schedule been removed?')
  } else {
    const expected = perHour * hoursSince
    const pct = expected > 0 ? 100 * t.ticks / expected : 0
    out.push(`  MECHANISM ${t.ticks} scheduled fires delivered against ${expected.toFixed(0)} requested · ${pct.toFixed(0)}%`)
    // COMPLETED and WORKED are two different claims and the old single line conflated them.
    // A tick that correctly skips its expensive job COMPLETES and MEASURES NOTHING, which is the
    // feature behaving perfectly · so printing only the first reads as work nobody did.
    out.push(`            ${t.ticksCompleted} of ${t.ticks} completed (not cancelled, not still running)`)
    out.push(`            of those · ${t.ticksWorked} RAN the E2E job · ${t.ticksSkipped} correctly skipped` +
      (t.ticksUnmeasured ? ` · ${t.ticksUnmeasured} UNMEASURED (jobs unreadable)` : ''))
    if (t.ticks === 0) {
      out.push('            ⚠ ZERO. Either GitHub has not delivered one yet · MEASURED in this repo at')
      out.push('              39% delivery, median 77min between fires, max 145min, so a couple of hours')
      out.push('              of silence is ordinary · or the schedule is not registered at all.')
      out.push('              GitHub also DISABLES scheduled workflows after 60 days of repo inactivity,')
      out.push('              silently. Not applicable while this repo is active, and it is the failure')
      out.push('              that would look exactly like this one.')
    }
  }

  // ── THE TRIPWIRE, and it requires BOTH conditions ───────────────────────────────────────────────
  // "The rate did not move" is only OUR defect if ticks were actually delivered. Firing on a low rate
  // while GitHub has delivered nothing would send the next reader to debug a guard that never ran.
  out.push('')
  const stale = hoursSince >= 48 && rate <= 40
  if (stale && t.ticks > 0 && t.ticksWorked > 0) {
    out.push(`  🔴 TRIPWIRE · ${hoursSince.toFixed(0)}h elapsed, ${t.ticks} ticks DELIVERED, ${t.ticksWorked} of them RAN`)
    out.push('     the E2E job, and the verdict rate is still at the pre-tick baseline. The ticks are')
    out.push('     firing, doing the work, and not helping · that is the JOB, and it is ours.')
    out.push('     Council\'s fallback: legibility only, accept 35%.')
  } else if (stale && t.ticksSkippedOnUnmeasuredTip > 0) {
    // ── THE BRANCH THE DATA DEMANDED (T2 S67) ────────────────────────────────────────────────────
    // A tick declined to run on a commit that has no verdict of its own. That is the GUARD's defect
    // and it lives in a different file from the branch above · sending a reader to debug the E2E
    // job when the bug is in tip-verdict-needed.cjs costs them the session.
    out.push(`  🔴 TRIPWIRE · ${hoursSince.toFixed(0)}h elapsed and ${t.ticksSkippedOnUnmeasuredTip} tick(s) SKIPPED a tip that has`)
    out.push('     no verdict of its own. The scheduler is fine and the expensive job is innocent.')
    out.push('     The subject is the GUARD: scripts/tip-verdict-needed.cjs answered ALREADY-MEASURED')
    out.push('     (or ALREADY-RUNNING for a run that was then cancelled) and nothing came back to it.')
    out.push('     Reproduce with `node scripts/tip-verdict-needed.cjs` against that commit.')
  } else if (stale && t.ticks > 0) {
    // ── NOT A DEFECT, AND THE INSTRUMENT MUST SAY SO IN THE SAME BREATH AS THE LOW RATE ───────────
    // ⚠ THE OUTCOME RATE HAS A STRUCTURAL CEILING THAT THIS FEATURE CANNOT RAISE, and the number is
    // printed above as though it could. A tick only ever examines the TIP. A commit superseded
    // before any tick reached it is unmeasurable BY CONSTRUCTION · three lanes pushing inside an
    // hour produce intermediate commits that were never the tip when a fire was delivered (and
    // delivery is every ~77 minutes, not every 30 · see the header). So an all-commit rate stuck at
    // the baseline is the expected reading, not evidence of anything.
    //
    // This is Rule 88 in the tool rather than in a balance experiment: before trusting a metric,
    // ask what its RANGE is at the operating point. `measured/commits` is the wrong denominator for
    // a tip-only tick, and it was chosen in S66 because it was the number already being reported.
    out.push(`  🟢 ${hoursSince.toFixed(0)}h elapsed, ${t.ticks} ticks delivered, and every one of them correctly`)
    out.push('     skipped a tip that already had a verdict. NOT A DEFECT · and the low OUTCOME rate')
    out.push('     above is not evidence against the tick, because a tick only ever examines the TIP.')
    out.push('     A commit superseded before a fire was delivered can never be rescued, so the')
    out.push('     all-commit rate has a ceiling this feature cannot raise (Rule 88 · a metric with')
    out.push('     no headroom cannot detect the thing it is pointed at).')
  } else if (stale) {
    out.push(`  🟡 ${hoursSince.toFixed(0)}h elapsed and the rate has not moved · but ZERO ticks were delivered, so`)
    out.push('     this says nothing about the guard. The scheduler is the subject, not the logic.')
  } else if (hoursSince < 48) {
    out.push(`  ⏳ ${(48 - hoursSince).toFixed(0)}h to go before the 48h tripwire can say anything.`)
  } else if (t.rescuedByTick > 0) {
    out.push(`  ✅ the verdict rate is above the pre-tick baseline, and ${t.rescuedByTick} commit(s) owe`)
    out.push('     their only verdict to a tick · the feature has demonstrated value, not just health.')
  } else {
    // ⚠ NOT THE SAME CLAIM AS THE BRANCH ABOVE, and until S67 they shared a line. A high rate with
    // zero rescues means every commit was already measured by its own push, so the tick has never
    // had an OPPORTUNITY · which is the feature working and is not evidence that it works. Saying
    // "✅" without that sentence is the S66 `rescuedByTick` error one level up: a healthy-looking
    // number standing in for a measurement nobody has taken.
    out.push('  ✅ the verdict rate is above the pre-tick baseline · but 0 commits were RESCUED, so')
    out.push('     the tick has not yet demonstrated value. Every fire found the tip already')
    out.push('     measured, which is correct behaviour and is not the same as proven behaviour.')
  }

  console.log(out.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Tick health\n\n```\n' + out.join('\n') + '\n```\n')
  }
  // The gate follows the RED branches only · the 🟢 case above is a correct system with a metric
  // that cannot see it, and exiting 1 on that would red CI for all three lanes over nothing.
  if (gate && stale && (t.ticksWorked > 0 || t.ticksSkippedOnUnmeasuredTip > 0)) process.exit(1)
}

if (require.main === module) main()

module.exports = { tally, requestedFiresPerHour, tickDidWork }
