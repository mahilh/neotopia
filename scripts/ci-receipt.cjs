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

  const failures  = rows.filter(r => r.verdict === 'FAIL')
  const unmeasured = rows.filter(r => !r.measured)

  if (JSON_OUT) {
    console.log(JSON.stringify({ sha, isTip, rows: rows.map(r =>
      ({ workflow: r.name, verdict: r.verdict, measured: r.measured, url: r.run?.url || null })) }, null, 2))
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
        console.log(`  UNMEASURED  ${pad}NO RUN for this commit · expected from ${r.file}`)
      } else {
        console.log(`  UNMEASURED  ${pad}${r.verdict.toLowerCase()}`)
      }
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

main()
