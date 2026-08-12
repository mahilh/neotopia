#!/usr/bin/env node
/**
 * NeoTopia · A CANCELLED RUN IS NOT A PASS  (T2 S58 · Council Decision 1)
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * THE DEFECT, IN T3'S WORDS: "right now both read as not red."
 *
 * `cancel-in-progress: true` is correct and the Council explicitly refused to remove it · N pushes
 * in flight would otherwise mean N full E2E runs, each spending identities against the metered MAU
 * cap. The defect is not the cancellation, it is THE RECEIPT:
 *
 *     a cancelled run on a SUPERSEDED commit   correct behaviour, needs no verdict
 *     a cancelled run on the CURRENT TIP       the tip has NO VERDICT AT ALL
 *
 * and the two are byte-identical in every view anybody reads. GitHub's own UI shows a grey circle
 * for both, `gh run list` prints `cancelled` for both, and a human scanning for red sees neither.
 *
 * MEASURED, and it is why this exists rather than being a tidy-up: reading the orphan producer this
 * session I wrote "five E2E runs since T3's fix, zero orphans" · a real claim, used to decide
 * whether a producer was closed. THREE OF THE FIVE WERE CANCELLED. The exposure was two runs, not
 * five, and the sentence was wrong in the direction of confidence. That is Rule 79d costing a
 * finding, not a formality.
 *
 * ── WHAT THIS PRINTS THAT NOTHING ELSE DOES ─────────────────────────────────────────────────────
 * A per-COMMIT receipt (never per-window · three lanes push inside minutes) in which CANCELLED is
 * rendered as UNMEASURED and is separated into the two cases above by asking one question the
 * status alone cannot answer: IS THIS SHA STILL THE TIP?
 *
 * ── THE EXPECTED SET IS ENUMERATED FROM THE CODE ────────────────────────────────────────────────
 * A hand-maintained list of "workflows that should have run" is the same defect one level up · it
 * rots the day someone adds a workflow, silently, while reading green (Rule 98b · enumerate from
 * the code where you can). So the expected set is derived by parsing .github/workflows/*.yml for a
 * push trigger on main. Add a push-triggered workflow and this notices it with no edit here.
 *
 * ── COUNTERWEIGHT, WRITTEN FIRST (Rule 90) ──────────────────────────────────────────────────────
 * The vacuous version reports a clean bill for a commit that has NO RUNS AT ALL · zero failures out
 * of zero runs, green forever, the exact "zero blocked out of zero checked" shape that greens every
 * lane (preamble section 3). So: an expected workflow with no run for this SHA is MISSING, which is
 * an UNMEASURED outcome and never a pass. A commit nobody built reports UNMEASURED, loudly.
 *
 * USAGE
 *   node scripts/ci-receipt.cjs              # the current HEAD
 *   node scripts/ci-receipt.cjs <sha>        # any commit
 *   node scripts/ci-receipt.cjs --json
 *
 * EXIT  0 every expected workflow has a PASS verdict
 *       1 a measured FAILURE
 *       2 UNMEASURED · cancelled, missing, skipped or still running (NOT a pass, NOT a failure)
 */

const { execFileSync } = require('node:child_process')
const { readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const JSON_OUT = process.argv.includes('--json')
const shaArg = process.argv.slice(2).find(a => !a.startsWith('--'))

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()

// ── the expected set · derived from the workflow files, never typed here ────────────────────────
// A workflow counts as EXPECTED for a push to main if its `on:` block carries a push trigger whose
// branch list includes main (or omits branches, which means all). Parsed textually rather than with
// a YAML dependency: this script has to run with zero install so it can be the first thing a
// session reaches for.
function expectedWorkflows() {
  const dir = join(__dirname, '..', '.github', 'workflows')
  const out = []
  for (const f of readdirSync(dir).filter(n => /\.ya?ml$/.test(n))) {
    const text = readFileSync(join(dir, f), 'utf8')
    const nameMatch = text.match(/^name:\s*(.+)$/m)
    if (!nameMatch) continue
    // the `on:` block is everything from a top-level `on:` to the next top-level key
    const onBlock = (text.match(/^on:\s*\n([\s\S]*?)^\w/m) || [])[1] || ''
    const push = onBlock.match(/^\s{2}push:\s*\n([\s\S]*?)(?=^\s{2}\w|$)/m)
    if (!push) continue
    const branches = push[1].match(/branches:\s*\[([^\]]*)\]/)
    const onMain = !branches || /\bmain\b/.test(branches[1])
    if (onMain) out.push({ file: f, name: nameMatch[1].trim() })
  }
  return out
}

// ── ASK THE EXACT QUESTION · THE LOOKBACK WINDOW IS GONE, NOT WIDENED  (T2 S59) ─────────────────
// MY OWN S58 CLOSING CRITIQUE, MEASURED AND FIXED. This read `gh run list --limit 200` and filtered
// client-side. The repo has 1943 runs, so any commit outside the most recent 200 reported
// "UNMEASURED · NO RUN for this commit" · and the diagnosis was simply false. Verified on 238a88d,
// which the tool called run-less and which has SIX runs.
//
// It failed SAFE, which is the only reason this was a critique rather than a defect I shipped: the
// verdict stayed UNMEASURED and never became a false PASS. But the distinction this whole file
// exists to draw is UNMEASURED versus MEASURED-ZERO, stated in the output string, and inside the
// instrument I had the two collapsed into one sentence. Closing one vacuity hole by mutation is not
// evidence an instrument has no others · a single mutation proves a single path (Rule 112a: an
// instrument earns trust from being MADE TO FAIL, and only along the axis you made it fail).
//
// `--commit` filters SERVER-SIDE · confirmed by asking for a 200-runs-ago sha with `--limit 5` and
// getting its rows back. So there is no window to be outside of, and "no run" now means no run.
function runsFor(sha) {
  const LIMIT = 100
  let raw
  try {
    raw = sh('gh', ['run', 'list', '--commit', sha, '--limit', String(LIMIT), '--json',
      'workflowName,headSha,conclusion,status,event,createdAt,url,databaseId'])
  } catch (e) {
    // An instrument that cannot reach its source must SAY SO, never report an empty result · an
    // auth failure, a network blip or a wrong repo would otherwise render as "nothing ran", which
    // is a confident and completely wrong answer (Rule 80).
    console.error('UNMEASURED · `gh run list` failed, so this tool has no data at all rather than ' +
                  'a clean result:\n  ' + String(e.message || e).split('\n')[0])
    console.error('  Check `gh auth status`. An empty answer here would be indistinguishable from ' +
                  'a commit nothing built, which is the exact confusion this file exists to end.')
    process.exit(2)
  }
  let rows
  try { rows = JSON.parse(raw) } catch {
    console.error('UNMEASURED · `gh run list` returned something that is not JSON.')
    process.exit(2)
  }
  // Absence inside a truncated page is not absence. One commit having 100 runs would mean re-runs
  // beyond anything seen here, but a silent truncation is how a receipt starts lying quietly.
  if (rows.length >= LIMIT) {
    console.error(`UNMEASURED · ${rows.length} runs for one commit hit the --limit ${LIMIT} page. ` +
                  'Rows may have been dropped, so any "no run" below could be truncation.')
    process.exit(2)
  }
  // The server filter is trusted but not assumed · a row for a different sha would mean --commit
  // silently stopped filtering, and every verdict after that would be about somebody else's commit.
  const foreign = rows.filter(r => r.headSha && r.headSha !== sha)
  if (foreign.length) {
    console.error(`UNMEASURED · ${foreign.length} of ${rows.length} rows carry a DIFFERENT headSha ` +
                  'than the one requested · `gh run list --commit` is no longer filtering, so these ' +
                  'verdicts would belong to other commits.')
    process.exit(2)
  }
  return rows
}

// ── "NO RUN" HAS TWO MEANINGS AND ONLY ONE IS A DEFECT  (T2 S61) ────────────────────────────────
// My own S60 closing critique, from watching this tool report `NO RUN for this commit` about 35dc238
// seconds after another lane pushed it. The VERDICT was right · unmeasured is unmeasured · and the
// DIAGNOSIS was incomplete, in the one branch of the one tool whose entire subject is separating
// "nothing happened" from "I looked too early".
//
// THE MARGIN IS MEASURED, NOT CHOSEN. Across the last 8 commits, a run appears 3 to 9 seconds after
// its commit timestamp. 60s is roughly seven times the observed maximum · a structural cushion
// rather than a bound fitted to the sample that produced it (preamble §2 · a wire sized from the run
// it guards is a flake with a delay).
// AND IT DECIDES NOTHING. The verdict is UNMEASURED on both sides of this threshold; it selects a
// SENTENCE. That is the only reason a magic number is acceptable here at all: a threshold that
// cannot change an outcome cannot be wrong in a way that costs anything.
//
// ⚠ COMMIT TIME IS NOT PUSH TIME, and the confound runs in the direction that matters. A commit
// rebased, cherry-picked or held for an hour is OLD and freshly pushed, so it reads "committed 3.2h
// ago · NO RUN" when the runs are simply still queuing. GitHub exposes no push timestamp for a bare
// sha, so this is a genuine limit of the instrument and is printed rather than hidden · naming a
// property I cannot measure beside the one I can is the whole lesson of Rule 129 (two properties
// were true of that run and I put one in my sentence).
// Both sides of the subtraction are Unix epoch seconds · `git log --format=%ct` and Date.now() ·
// so no timezone can enter it (Rule 127c · prefer a comparison the tool cannot get wrong).
const QUEUE_MARGIN_SEC = 60

function commitAgeSeconds(sha) {
  try { return Math.floor(Date.now() / 1000) - Number(sh('git', ['log', '-1', '--format=%ct', sha])) }
  catch { return null }
}

function missingLine(file, ageSec, margin = QUEUE_MARGIN_SEC) {
  if (ageSec === null || Number.isNaN(ageSec)) {
    return `NO RUN for this commit · expected from ${file} (commit age UNREADABLE)`
  }
  const age = ageSec < 90 ? `${ageSec}s`
    : ageSec < 5400 ? `${Math.round(ageSec / 60)}m`
    : `${(ageSec / 3600).toFixed(1)}h`
  // "not a defect" would be the natural phrasing and it closes the question · a reader who scans it
  // has learned that nothing is wrong, which is not what has been established. What HAS been
  // established is that the absence is not yet EVIDENCE of anything, and the answer is one minute
  // away. The verdict column already says UNMEASURED; this must not quietly argue with it.
  return ageSec < margin
    ? `no run YET · committed ${age} ago, inside the ~${margin}s queue window · re-run this receipt`
    : `NO RUN for this commit · committed ${age} ago · expected from ${file}`
}

function classify(run) {
  if (!run) return { verdict: 'MISSING', measured: false }
  if (run.status !== 'completed') return { verdict: 'RUNNING', measured: false }
  switch (run.conclusion) {
    case 'success':   return { verdict: 'PASS', measured: true }
    case 'failure':
    case 'timed_out': return { verdict: 'FAIL', measured: true }
    case 'cancelled': return { verdict: 'CANCELLED', measured: false }
    case 'skipped':   return { verdict: 'SKIPPED', measured: false }
    default:          return { verdict: String(run.conclusion || '?').toUpperCase(), measured: false }
  }
}

// ── WHAT A CANCELLED RUN STILL KNOWS  (T2 S60) ──────────────────────────────────────────────────
// A cancelled run is UNMEASURED and stays UNMEASURED · that is Council Decision 1 and nothing here
// touches it. But "UNMEASURED" was doing two jobs: a run cancelled while queued verified NOTHING,
// and a run cancelled at its last step verified almost everything, and the receipt printed the same
// sentence for both. On 31637130091 nine work steps had completed green, including the pool
// credential check, and only the practice-mode specs were cut · that is a materially different
// state from "no verdict at all" and this tool was discarding it.
//
// ⚠ AND IT CORRECTS SOMETHING I PUBLISHED IN S59. I wrote, into CLAUDE.md and a commit message,
// "a CANCELLED run has ZERO log lines". Measured across six cancelled runs tonight: five have logs
// (119-623 lines) and one has none. The one that has none was cancelled BEFORE ITS JOB STARTED and
// has no steps either. THE SAME RUN, 31637130091, read 0 lines in S59 and reads 623 now · nothing
// about it changed except that it finished. The log was missing because the run was IN PROGRESS
// when I asked, and I attributed it to the cancellation sitting next to it. A confound between two
// properties that co-occurred in my single sample, generalised into a rule (Rule 122's corollary ·
// three blocks before a shape is reported, and I reported one).
// The ADVICE survives and the MECHANISM was wrong, which is the more dangerous half to get wrong:
// filter on --status=success when you want a log, not because cancellation destroys it, but because
// an unfinished run has not written one yet.
// Names of steps the workflow itself declares CONDITIONAL. Without this the reader cries "NEVER RAN"
// about `Upload report on failure`, which carries `if: failure()` and is SUPPOSED to skip on every
// healthy run · a false positive on correct behaviour, in a tool whose credibility is the only thing
// it has. A gate that reports a problem on a working run gets read as noise and switched off, and
// the day it is right nobody is listening (Rule 94a · and it appeared on the very first execution
// of this feature, which is the argument for running a new instrument before believing it).
// Parsed textually from the same file the expected set came from · steps are `      - ` at six
// spaces and their keys sit at eight, so a step block is everything up to the next six-space dash.
function conditionalStepNames(file) {
  const out = new Set()
  let text
  try { text = readFileSync(join(__dirname, '..', '.github', 'workflows', file), 'utf8') } catch { return out }
  for (const block of text.split(/\n {6}- /).slice(1)) {
    const body = block.split(/\n {6}- /)[0]
    if (!/\n {8}if:/.test('\n' + body)) continue
    const m = body.match(/^\s*name:\s*(.+)$/m)
    if (m) out.add(m[1].trim())
  }
  return out
}

function stepDetail(databaseId, conditional = new Set()) {
  if (!databaseId) return null
  let raw
  try { raw = sh('gh', ['run', 'view', String(databaseId), '--json', 'jobs']) }
  catch { return { unavailable: 'gh run view --json jobs failed' } }
  let jobs
  try { jobs = JSON.parse(raw).jobs || [] } catch { return { unavailable: 'unparseable jobs JSON' } }

  const steps = jobs.flatMap(j => j.steps || [])
  // steps=0 is the genuine nothing-happened case: the run was cancelled before its job started.
  // Distinguished rather than folded in, because "no steps" and "steps I could not read" are
  // different failures and only one of them is about this repo (Rule 95b).
  if (!steps.length) return { neverStarted: true }

  // GitHub's own bookkeeping is not the workflow's work · a green "Complete job" verifies nothing,
  // and counting it would pad every ratio printed below toward looking finished.
  const own = steps.filter(s => !/^(Set up job|Complete job|Post |Post Run )/.test(s.name || ''))
  // A conditional step that skipped is not a step that was PREVENTED from running · it declined.
  // Excluded from both the numerator and the denominator so the ratio stays honest in both
  // directions: counting it as never-run inflates the alarm, counting it as green inflates the
  // reassurance, and only dropping it does neither.
  const graded = own.filter(s => !conditional.has(s.name))
  return {
    total:   graded.length,
    green:   graded.filter(s => s.conclusion === 'success'),
    notRun:  graded.filter(s => s.conclusion === 'skipped'),
    stopped: graded.filter(s => s.conclusion === 'cancelled'),
    failed:  graded.filter(s => s.conclusion === 'failure'),
    conditionalSkipped: own.length - graded.length,
  }
}

// Render the detail as lines under a verdict. NEVER returns a sentence a reader could take as a
// pass · every branch either names what did not run, or says in terms that a complete-looking step
// list is still not a workflow verdict.
// THE INVARIANT THIS FUNCTION EXISTS TO HOLD, and it is asserted by its test rather than promised
// here: EVERY non-empty rendering names something that did not complete. A ratio on its own ("8 of
// 9 green") is read as a pass by every habit a human has, and this file's entire subject is refusing
// to let an absence read as a pass · its counterweight has already failed once by printing
// "PASS · all 0 expected workflows". A partial-step reader is that same shape one level down.
function stepLines(d, indent) {
  const pad = ' '.repeat(indent)
  if (!d) return []
  if (d.unavailable) return [`${pad}step detail UNAVAILABLE (${d.unavailable}) · the verdict above stands`]
  if (d.neverStarted) return [`${pad}the job never started · NOTHING ran, not one step`]

  const out = []
  const halted = d.stopped[0] || d.failed[0]
  out.push(`${pad}${d.green.length} of ${d.total} steps completed green` +
    (d.conditionalSkipped ? ` (${d.conditionalSkipped} conditional step(s) not counted)` : ''))

  if (halted) {
    out.push(`${pad}DID NOT COMPLETE · "${(halted.name || '').slice(0, 52)}"`)
  }
  if (d.notRun.length) {
    out.push(`${pad}NEVER RAN · ${d.notRun.map(s => (s.name || '').slice(0, 40)).join(' | ')}`)
  }
  if (!halted && !d.notRun.length) {
    // The vacuous case, and it is the one a partial reader gets wrong: a run cancelled during its
    // post-job bookkeeping has every graded step green and nothing skipped, so the detail alone
    // looks exactly like success. GitHub's verdict belongs to the RUN, not to its steps.
    out.push(`${pad}every graded step is green · but the RUN did not complete, and a green step`)
    out.push(`${pad}list is NOT a workflow verdict. Still unmeasured.`)
  }
  return out
}

function main() {
  const sha = sh('git', ['rev-parse', shaArg || 'HEAD'])
  const short = sha.slice(0, 7)
  const tip = sh('git', ['rev-parse', 'origin/main'])
  const isTip = sha === tip

  const expected = expectedWorkflows()

  // ── THE VACUITY HOLE MY FIRST COUNTERWEIGHT DID NOT COVER, FOUND BY MUTATING THIS FILE ────────
  // I wrote the counterweight first (an expected workflow with no run is MISSING, never a pass) and
  // it is correct and it is one level too low. Mutating expectedWorkflows() to return nothing
  // printed `PASS · all 0 expected workflows returned a green verdict` and EXITED 0 · a perfect
  // green receipt for a commit nothing had built, from the tool whose entire subject is refusing to
  // call an absence a pass. Zero failures out of zero rows is the oldest vacuity in this repo and I
  // reproduced it inside its own guard (Rule 86 · the counterweight is the assertion most likely to
  // be measuring the wrong quantity, because it is written while thinking about something else).
  // The parser's own yield is therefore asserted, and the count is PRINTED so a partial parse is
  // visible to a reader rather than resting on a threshold that would need retuning.
  if (expected.length === 0) {
    console.error('UNMEASURED · parsed .github/workflows/ and found NO push-triggered workflow.')
    console.error('  That is an instrument failure, not a clean repo: this tool cannot report on a')
    console.error('  set it failed to build. Check the `on:`/`push:` parse in expectedWorkflows().')
    process.exit(2)
  }

  const runs = runsFor(sha)

  const rows = expected.map(w => {
    // the LATEST run of this workflow for this sha · a re-run supersedes an earlier attempt
    const mine = runs.filter(r => r.workflowName === w.name)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    return { ...w, run: mine, ...classify(mine) }
  })

  // Step detail for every row that is not a clean PASS · a pass has nothing to add, and this costs
  // one `gh run view` per remaining row. Fetched for FAIL too: "which step failed" is the first
  // question a red provokes and it is the same call.
  for (const r of rows) {
    if (r.run && r.verdict !== 'PASS') r.detail = stepDetail(r.run.databaseId, conditionalStepNames(r.file))
  }

  const age = commitAgeSeconds(sha)
  const failures  = rows.filter(r => r.verdict === 'FAIL')
  const unmeasured = rows.filter(r => !r.measured)

  if (JSON_OUT) {
    console.log(JSON.stringify({ sha, isTip, rows: rows.map(r => ({
      workflow: r.name, verdict: r.verdict, measured: r.measured, url: r.run?.url || null,
      // Deliberately NOT a bare ratio. A consumer reading `{green: 8, total: 9}` and nothing else
      // would rebuild the exact misreading this is here to prevent, so the names of the steps that
      // did not run travel with the numbers and `measured` above is still the only verdict.
      steps: r.detail && !r.detail.unavailable && !r.detail.neverStarted ? {
        green: r.detail.green.length, total: r.detail.total,
        neverRan: r.detail.notRun.map(s => s.name),
        stoppedAt: (r.detail.stopped[0] || r.detail.failed[0] || {}).name || null,
      } : (r.detail?.neverStarted ? { jobNeverStarted: true } : null),
    })) }, null, 2))
  } else {
    console.log(`CI RECEIPT · ${short}${isTip ? '  (TIP of origin/main)' : '  (superseded · not the tip)'}`)
    console.log(`  expected set · ${expected.length} push-triggered workflows, enumerated from ` +
                '.github/workflows/ (not typed here, so a new one is noticed with no edit)')
    console.log('')
    for (const r of rows) {
      const pad = r.name.padEnd(24)
      if (r.verdict === 'PASS') console.log(`  PASS        ${pad}`)
      else if (r.verdict === 'FAIL') console.log(`  FAIL        ${pad}${r.run.url}`)
      else if (r.verdict === 'CANCELLED') {
        // THE WHOLE POINT OF THIS FILE · the same status, two completely different meanings.
        console.log(`  UNMEASURED  ${pad}cancelled · ${isTip
          ? 'ON THE TIP · this commit has NO VERDICT from this workflow'
          : 'superseded by a later push · expected, and fine'}`)
      } else if (r.verdict === 'MISSING') {
        console.log(`  UNMEASURED  ${pad}${missingLine(r.file, age)}`)
      } else {
        console.log(`  UNMEASURED  ${pad}${r.verdict.toLowerCase()}`)
      }
      // The detail is INDENTED UNDER the verdict, never beside it · the verdict is the claim and
      // the steps are evidence about how far it got. Printing "8 of 9 green" on the verdict line
      // would put a pass-shaped number where a reader scans for the verdict.
      for (const line of stepLines(r.detail, 14)) console.log(line)
    }
    console.log('')
    if (failures.length) {
      console.log(`VERDICT · ${failures.length} FAILED. Measured red.`)
    } else if (unmeasured.length) {
      console.log(`VERDICT · UNMEASURED · ${unmeasured.length} of ${rows.length} workflows have no verdict for ${short}.`)
      console.log('           This is NOT a pass. "Not red" and "green" are different claims and this')
      console.log('           commit is only the first (Rule 79d).')
      if (isTip) {
        console.log('           AND THIS IS THE TIP · so the current state of main is unverified. Push an')
        console.log('           empty commit or re-run the workflow to obtain a verdict.')
      }
    } else {
      console.log(`VERDICT · PASS · all ${rows.length} expected workflows returned a green verdict for ${short}.`)
    }
  }

  process.exit(failures.length ? 1 : (unmeasured.length ? 2 : 0))
}

// ── RUN ONLY WHEN RUN, EXPORT ALWAYS  (T2 S60) ──────────────────────────────────────────────────
// This called main() at module level, so requiring the file EXECUTED it · found by accident when a
// throwaway probe's `require()` printed a full CI receipt and exited. That makes the pure logic
// untestable, and untestable is how the "PASS · all 0 expected workflows" hole survived to be found
// by a hand-run mutation rather than by the suite. stepLines now carries an invariant (every
// non-empty rendering names something that did not complete) and an invariant nobody can run is a
// comment (Rule 105a).
if (require.main === module) main()

module.exports = { stepLines, stepDetail, conditionalStepNames, classify, expectedWorkflows, missingLine, commitAgeSeconds, QUEUE_MARGIN_SEC }
