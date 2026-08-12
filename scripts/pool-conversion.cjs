#!/usr/bin/env node
/**
 * NeoTopia · HOW MUCH OF THE IDENTITY CHURN HAS ACTUALLY STOPPED?  (T2 S61)
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * THE DISSENT THIS ANSWERS, recorded by Brutus and correct: a manual step at a decision point is a
 * step that will not happen. The Council's tripwire for the pool is "if the identity count does not
 * measurably drop within 24h of activation, the branch is falling back silently" · and the count
 * lives in a dashboard nobody reads on a schedule, because `auth.users` is unreachable from here and
 * migration 029 is held on purpose. So the tripwire had no reader. This is the reader.
 *
 * ── WHAT I SET OUT TO BUILD, AND WHY IT CANNOT WORK ──────────────────────────────────────────────
 * My own S60 recommendation was to count `game_rooms.host_id` against the four pool identities:
 * world-readable with the anon key, no migration, no privilege, and host_id really is the
 * discriminator because a room's host is whichever identity actually authenticated. The probe that
 * sold it returned 200 rows, 1 pool-hosted.
 * MEASURED PROPERLY, ANCHORED TO THE WIRING COMMIT INSTEAD OF A ROLLING WINDOW (Rule 126, applied to
 * my own instrument before it produced a number anyone quotes):
 *     game_rooms, all time                     689 rows · 673 distinct hosts
 *     game_rooms created after 2dfda4a           1 row
 *     newest row in the entire table         21:46 UTC, and nothing since
 * The 200 rows were almost entirely OLD. `purge_e2e_test_data` runs in globalTeardown, once per
 * playwright invocation, so every room a run creates is deleted by the end of that run · the
 * success case destroys its own evidence (Rule 126's second half), and a post-hoc query can never
 * see the population it needs. The recommendation was right about the discriminator and wrong about
 * whether the rows survive long enough to be counted.
 *
 * ── WHAT WORKS INSTEAD, AND WHY IT ONLY WORKS NOW ────────────────────────────────────────────────
 * The CI log. In S60 I ruled this out and the reasoning was sound at the time: useAuth's decision is
 * published to a BROWSER console, which does not reach a runner log, and only one spec forwarded
 * page console. T3 then landed reportPoolOutcome, which reads window.__neotopia_pool_outcome through
 * page.evaluate and prints it from NODE. So the per-context outcome now appears in the run log:
 *     [pool] game-ux host   · browser · REUSED member 0 · 0 identities minted by this context
 *     [pool] game-ux joiner · browser · NO CREDENTIAL for member 1 · the app will mint anonymously
 *     [pool] teardown · member 0 REUSED 462b5106 · 0 minted
 * A premise I had checked and correctly ruled on became false because someone else shipped. Carrying
 * an old conclusion forward is how a closed question stays closed after it reopens.
 * Logs are not touched by the purge, they are attached to a RUN, and a run has a headSha · so this
 * can be anchored to a commit rather than to my clock.
 *
 * ── BROWSER AND TEARDOWN ARE COUNTED SEPARATELY, ALWAYS ──────────────────────────────────────────
 * My own standing warning: do not read a fall in the counter as browsers converting · it will be the
 * teardowns. Teardowns converted in S59 and browser contexts did not, so a single blended rate would
 * have read as progress that had not happened. The two producers are reported as two numbers and
 * there is no combined figure anywhere in the output.
 *
 * USAGE
 *   node scripts/pool-conversion.cjs                 # the last 20 runs · window NOT anchored
 *   node scripts/pool-conversion.cjs --since 2dfda4a # only runs whose commit is at/after this one
 *   node scripts/pool-conversion.cjs --limit 40
 *
 * EXIT  0 measured · 2 UNMEASURED (no runs, no log lines, or the log contract has drifted)
 */

const { execFileSync } = require('node:child_process')
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt
}

// ── THE LOG LINES ARE A SECOND CONTRACT · GUARD THEM  (Rule 45) ─────────────────────────────────
// These strings are produced by T3's tests/e2e/poolBrowser.js and seedHelpers.js. Nothing makes them
// stable, and if they are reworded this script silently counts ZERO of everything and reports a
// clean 0/0 · which would be indistinguishable from "no runs converted" and would arrive as a
// finding. So the tokens are checked against the source that emits them, and a mismatch is
// UNMEASURED rather than a number (Rule 80 · never let "I could not read it" resolve to a value).
const CONTRACT = [
  ['tests/e2e/poolBrowser.js', ['REUSED member', 'NO CREDENTIAL for member', 'UNMEASURED']],
  ['tests/e2e/seedHelpers.js', ['REUSED', 'NO CREDENTIAL for member']],
]

function contractHolds(root) {
  const missing = []
  for (const [file, tokens] of CONTRACT) {
    let src = ''
    try { src = readFileSync(join(root, file), 'utf8') } catch { missing.push(`${file} unreadable`); continue }
    for (const t of tokens) if (!src.includes(t)) missing.push(`${file} no longer emits "${t}"`)
  }
  return missing
}

/**
 * Classify one `[pool] ...` line.
 *
 * ⚠ THE `seeded` LINE IS AN INTENT, NOT AN OUTCOME, and conflating them is the arithmetic trap here:
 * a converted browser context emits BOTH `seeded member 0` and later `REUSED member 0`, so counting
 * every line as an outcome double-counts the successes and inflates the rate. It is classified
 * explicitly and excluded from the totals rather than falling through a default.
 */
function classifyPoolLine(line) {
  const label = (line.match(/\[pool\] ([^·]+)·/) || [, ''])[1].trim()
  const producer = /· browser ·/.test(line) ? 'browser'
    : /^\[pool\] teardown/.test(line) ? 'teardown' : 'other'
  if (/· seeded member/.test(line)) return { producer, outcome: 'intent', label }
  if (/\bREUSED\b/.test(line)) return { producer, outcome: 'reused', label }
  if (/NO CREDENTIAL/.test(line)) return { producer, outcome: 'unconverted', label }
  if (/\bUNMEASURED\b/.test(line)) return { producer, outcome: 'unmeasured', label }
  if (/ANONYMOUS user/.test(line)) return { producer, outcome: 'unconverted', label }
  return { producer, outcome: 'unrecognised', label }
}

function tally(lines) {
  const t = { browser: {}, teardown: {}, other: {}, labels: {} }
  for (const l of lines) {
    const { producer, outcome, label } = classifyPoolLine(l)
    if (outcome === 'intent') continue                 // see the note above · not an outcome
    t[producer][outcome] = (t[producer][outcome] || 0) + 1
    if (producer !== 'other') {
      t.labels[label] = t.labels[label] || {}
      t.labels[label][outcome] = (t.labels[label][outcome] || 0) + 1
    }
  }
  return t
}

const pct = (n, d) => (d === 0 ? null : ((100 * n) / d).toFixed(1))

function report(name, counts) {
  const reused = counts.reused || 0
  const unconverted = counts.unconverted || 0
  const unmeasured = counts.unmeasured || 0
  const graded = reused + unconverted
  const out = []
  // ── ONE GUARD, NOT TWO · A MUTATION PROVED THE PAIR UNTESTABLE ─────────────────────────────────
  // COUNTERWEIGHT: zero graded sign-ins must never render as a rate. 0 of 0 is 0% or 100% depending
  // on which way the division is written, both are plausible, and neither means anything (Rule 80).
  // This was TWO branches · an early return for "nothing at all" and a second `graded === 0` case
  // below it · and deleting the first changed no test, because the second still produced UNMEASURED.
  // Either was sufficient, so no mutation could red either, and my counterweight was reporting
  // itself as present while being unfalsifiable (preamble §2 · redundant guards make each other
  // untestable; delete one). Collapsed, the survivor has teeth.
  if (graded === 0) {
    out.push(`  ${name.padEnd(9)} UNMEASURED · ` + (unmeasured
      ? `${unmeasured} context(s) reported, none of them gradeable`
      : 'no sign-in of this kind appeared in these logs'))
  } else {
    out.push(`  ${name.padEnd(9)} ${reused}/${graded} REUSED (${pct(reused, graded)}%) · ${unconverted} still minting`)
  }
  if (unmeasured) {
    out.push(`            + ${unmeasured} UNMEASURED · nothing was seeded, so these say nothing either way`)
  }
  return out
}

// ── THE BLIND SPOT · WHAT THE RATE ABOVE CANNOT SEE  (T2 S62) ───────────────────────────────────
// A context that is never seeded and never reports contributes to NEITHER the numerator NOR the
// denominator, so it is invisible here and the rate reads as complete. My first run of this tool
// printed `browser 2/2 REUSED (100.0%)` while ten specs were creating contexts that mint an identity
// each and say nothing. That is Rule 130's corollary in my own instrument: a number that flatters,
// produced by a reader that cannot see its own coverage.
//
// So the coverage is derived from the repo, every run, and printed beside the rate. Three caveats
// travel WITH it rather than living in a commit message, because a bare "19 unseeded" is quoted and
// the caveats are not:
//   · these are CALL SITES, not runtime contexts · a loop or a helper can create more or fewer
//   · practice.e2e.js makes zero Supabase calls BY DESIGN, so its contexts may mint nothing at all
//   · a nightly spec costs ~1 run/day and a merge-gate spec costs one per push · the counts are NOT
//     equally weighted, and routing is printed per spec so the reader can weight them
function coverage(root) {
  const dir = join(root, 'tests', 'e2e')
  const wfDir = join(root, '.github', 'workflows')
  let wfText = {}
  try {
    for (const f of readdirSync(wfDir).filter(n => /\.ya?ml$/.test(n))) {
      wfText[f] = readFileSync(join(wfDir, f), 'utf8')
    }
  } catch { /* no workflows · routing is then UNKNOWN, and says so */ }

  const specs = []
  let files = []
  try { files = readdirSync(dir).filter(n => n.endsWith('.e2e.js')) } catch { return null }
  for (const f of files) {
    let src = ''
    try { src = readFileSync(join(dir, f), 'utf8') } catch { continue }
    const contexts = (src.match(/newContext\(|browser\.newPage\(/g) || []).length
    if (!contexts) continue
    const seeds = (src.match(/seedPoolCredential/g) || []).length
    const runsIn = Object.keys(wfText).filter(w => wfText[w].includes(f)).sort()
    specs.push({ spec: f, contexts, seeds, runsIn })
  }
  // WHICH TREE DID THIS MEASURE? Coverage is read from files on disk, so a session in which another
  // lane is mid-conversion reports a number that is NOT the committed state · and that number gets
  // quoted. Measured live: T3's endgame-live and host-departure-live carried 0 seeds at HEAD and 3
  // and 5 in the working tree at the same moment, a difference of four context creations. Rule 66,
  // in a reader rather than in a build.
  let dirty = []
  try {
    dirty = sh('git', ['status', '--porcelain', '--', 'tests/e2e'])
      .split('\n').map(l => l.trim()).filter(Boolean)
  } catch { dirty = null }
  specs.dirty = dirty
  return specs
}

function coverageLines(specs) {
  if (!specs) return ['  coverage UNMEASURED · tests/e2e is unreadable from here']
  const unseeded = specs.filter(s => s.seeds === 0)
  const ctxTotal = specs.reduce((a, s) => a + s.contexts, 0)
  const ctxUnseeded = unseeded.reduce((a, s) => a + s.contexts, 0)
  const gate = (s) => s.runsIn.some(w => /e2e\.yml|placement-guard/.test(w)) ? 'per push'
    : s.runsIn.some(w => /nightly/.test(w)) ? 'nightly'
    : 'NO WORKFLOW'
  const out = [
    '  COVERAGE · what this rate cannot see',
    `    ${ctxUnseeded} of ${ctxTotal} browser-context creations are in specs that seed NOTHING, so they`,
    '    appear in neither the numerator nor the denominator above. The rate is over instrumented',
    '    contexts only and must not be read as the feature having landed.',
  ]
  if (unseeded.length) {
    out.push('    unseeded, by how often it actually runs:')
    for (const g of ['per push', 'nightly', 'NO WORKFLOW']) {
      const inGroup = unseeded.filter(s => gate(s) === g)
      if (!inGroup.length) continue
      out.push(`      ${g.padEnd(12)} ${inGroup.map(s => `${s.spec.replace('.e2e.js', '')}(${s.contexts})`).join(' ')}`)
    }
  }
  if (specs.dirty === null) {
    out.push('    ⚠ could not ask git whether tests/e2e is clean · this may not be the committed state')
  } else if (specs.dirty.length) {
    out.push(`    ⚠ MEASURED FROM A DIRTY TREE · ${specs.dirty.length} uncommitted change(s) under tests/e2e,`)
    out.push('      so this is NOT what CI will see. Another lane mid-conversion moves these counts.')
  }
  out.push('    CAVEATS, carried here rather than left in a commit message:')
  out.push('      · call sites, not runtime contexts · a loop or helper can create more or fewer')
  out.push('      · practice.e2e.js makes ZERO Supabase calls by design · its contexts may mint nothing')
  out.push('      · a NO WORKFLOW spec costs nothing today (Rule 79) and a per-push spec costs one')
  out.push('        identity per context per push · these counts are not equally weighted')
  return out
}

function main() {
  const root = join(__dirname, '..')
  const drift = contractHolds(root)
  if (drift.length) {
    console.error('UNMEASURED · the log-line contract has drifted, so every count here would be a')
    console.error('  silent zero rather than a measurement:')
    for (const d of drift) console.error(`    ${d}`)
    process.exit(2)
  }

  const limit = argOf('--limit', '20')
  const since = argOf('--since', null)
  let sinceISO = null
  if (since) {
    // Epoch seconds from git, converted to ISO in UTC · both ends of the comparison are then in one
    // zone and no tool can strip the units (Rule 127 · a timestamp has units and nothing prints them).
    const ct = Number(sh('git', ['log', '-1', '--format=%ct', since]))
    sinceISO = new Date(ct * 1000).toISOString()
  }

  let runs
  try {
    runs = JSON.parse(sh('gh', ['run', 'list', '--limit', String(limit), '--json',
      'databaseId,workflowName,headSha,status,conclusion,createdAt']))
  } catch (e) {
    console.error(`UNMEASURED · \`gh run list\` failed · ${String(e.message).split('\n')[0]}`)
    process.exit(2)
  }

  // A run that has not FINISHED has not written a log · counting it yields zero lines and would read
  // as "nothing converted". That is precisely the confound behind Rule 129, so it is excluded by
  // status and REPORTED rather than silently dropped.
  const unfinished = runs.filter(r => r.status !== 'completed')
  let usable = runs.filter(r => r.status === 'completed')
  if (sinceISO) usable = usable.filter(r => r.createdAt >= sinceISO)

  const lines = []
  const scanned = []
  for (const r of usable) {
    let log = ''
    try { log = sh('gh', ['run', 'view', String(r.databaseId), '--log']) } catch { continue }
    const found = log.split('\n').filter(l => l.includes('[pool]')).map(l => l.replace(/^.*?\[pool\]/, '[pool]'))
    if (found.length) scanned.push({ ...r, n: found.length })
    lines.push(...found)
  }

  console.log('POOL CONVERSION · from CI run logs, which the purge cannot delete')
  console.log(`  window     ${sinceISO ? `runs created at/after ${since} (${sinceISO})` : `last ${limit} runs · NOT ANCHORED to a commit`}`)
  console.log(`  runs       ${usable.length} completed, ${scanned.length} carrying pool lines` +
              (unfinished.length ? ` · ${unfinished.length} still running and EXCLUDED (no log yet)` : ''))
  console.log('')

  if (!lines.length) {
    console.error('UNMEASURED · not one `[pool]` line in any scanned run.')
    console.error('  This is NOT a conversion rate of zero. It means the specs that report pool')
    console.error('  outcomes did not run in this window, or their logs have expired.')
    process.exit(2)
  }

  const t = tally(lines)
  // TWO PRODUCERS, TWO NUMBERS, NEVER A BLEND. Teardowns converted in S59 and browser contexts did
  // not; one combined figure would have read as progress nobody had made.
  for (const line of report('browser', t.browser)) console.log(line)
  for (const line of report('teardown', t.teardown)) console.log(line)
  if (t.other.unrecognised) {
    console.log(`  ⚠ ${t.other.unrecognised} pool line(s) matched no known shape · the contract may be drifting`)
  }
  console.log('')
  for (const line of coverageLines(coverage(root))) console.log(line)
  console.log('')
  console.log('  by label:')
  for (const [label, o] of Object.entries(t.labels).sort()) {
    console.log(`    ${label.padEnd(22)} ${Object.entries(o).map(([k, v]) => `${k}=${v}`).join('  ')}`)
  }
  console.log('')
  console.log('  A browser context and a teardown are different producers · a fall in auth.users')
  console.log('  attributable to one says nothing about the other. There is deliberately no')
  console.log('  combined rate in this output.')
}

if (require.main === module) main()

module.exports = { classifyPoolLine, tally, report, contractHolds, coverage, coverageLines }
