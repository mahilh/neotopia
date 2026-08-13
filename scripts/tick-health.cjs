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
 * Verdict accounting over a set of runs, per COMMIT rather than per run · a commit with three
 * cancelled runs and one success is measured, and a commit with five cancellations is not.
 */
function tally(runs, sinceTime) {
  const inWindow = runs.filter(r => new Date(r.createdAt) >= sinceTime)
  const byCommit = new Map()
  for (const r of inWindow) {
    const e = byCommit.get(r.headSha) || { verdict: false, events: new Set() }
    if (r.conclusion === 'success' || r.conclusion === 'failure') e.verdict = true
    e.events.add(r.event)
    byCommit.set(r.headSha, e)
  }
  const commits = [...byCommit.values()]
  return {
    runs: inWindow.length,
    commits: commits.length,
    measured: commits.filter(c => c.verdict).length,
    ticks: inWindow.filter(r => r.event === 'schedule').length,
    tickVerdicts: inWindow.filter(r => r.event === 'schedule' && (r.conclusion === 'success' || r.conclusion === 'failure')).length,
    // A commit whose ONLY verdict came from a tick is the feature working · it would have been
    // unmeasured without one. Reported separately because it is the only direct evidence of value.
    rescuedByTick: [...byCommit.entries()].filter(([, c]) => c.verdict && c.events.has('schedule')).length,
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
      '--json', 'event,conclusion,status,headSha,createdAt']))
  } catch { runs = null }

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
    out.push(`            (${t.tickVerdicts} of those ${t.ticks} reached a verdict of their own)`)
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
  if (stale && t.ticks > 0) {
    out.push(`  🔴 TRIPWIRE · ${hoursSince.toFixed(0)}h elapsed, ${t.ticks} ticks DELIVERED, and the verdict rate is`)
    out.push('     still at the pre-tick baseline. The ticks are firing and not helping · that is the')
    out.push('     guard\'s logic, and it is ours. Council\'s fallback: legibility only, accept 35%.')
  } else if (stale) {
    out.push(`  🟡 ${hoursSince.toFixed(0)}h elapsed and the rate has not moved · but ZERO ticks were delivered, so`)
    out.push('     this says nothing about the guard. The scheduler is the subject, not the logic.')
  } else if (hoursSince < 48) {
    out.push(`  ⏳ ${(48 - hoursSince).toFixed(0)}h to go before the 48h tripwire can say anything.`)
  } else {
    out.push('  ✅ the verdict rate is above the pre-tick baseline.')
  }

  console.log(out.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Tick health\n\n```\n' + out.join('\n') + '\n```\n')
  }
  if (gate && stale && t.ticks > 0) process.exit(1)
}

if (require.main === module) main()

module.exports = { tally, requestedFiresPerHour }
