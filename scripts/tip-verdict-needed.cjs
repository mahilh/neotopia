#!/usr/bin/env node
/**
 * NeoTopia · does the TIP still need a verdict?  (T2 S65)
 * ═════════════════════════════════════════════════════════════════════════════════════════════════
 * THE PROBLEM, MEASURED RATHER THAN INHERITED. The brief called this "the merge gate at 25%". The
 * merge gate is canary.yml, it has NO concurrency block at all, and it measures 56 of 56 commits
 * with a verdict · 100%. The workflow that actually loses runs is e2e.yml:
 *
 *     canary.yml   (NeoTopia CI)          no cancel-in-progress    56/56 commits  100%
 *     e2e.yml      (NeoTopia E2E)         cancel-in-progress:true  21/60 commits   35%
 *     e2e-placement-guard.yml             cancel-in-progress:true  45/60 commits   75%
 *
 * 39 of e2e.yml's last 60 runs were CANCELLED. Three lanes push inside the ~5 minutes a run takes,
 * each push supersedes the one in flight, and a verdict needs a quiet window longer than the run.
 * T3's tripwire fired twice on exactly this: a correctly-red test went unread for three nights
 * because every run between was cancelled.
 *
 * WHY NOT JUST STOP CANCELLING. N pushes would mean N full browser runs, each minting identities
 * against a metered MAU cap. Council rejected it and the arithmetic agrees.
 *
 * WHY NOT A DEBOUNCE, which was the first shape proposed. A debounce makes this WORSE, and the
 * reasoning is worth keeping because it is counter-intuitive: sleeping before the real work extends
 * the quiet window a run needs in order to survive, from `runtime` to `sleep + runtime`. It collapses
 * a burst into one run (a cost saving) and it lowers the verdict rate (the thing being fixed).
 *
 * WHAT THIS DOES INSTEAD. e2e.yml gains a `schedule` trigger. On a scheduled run this script decides
 * whether the work is needed at all, and the answer is no in the overwhelming majority of cases · so
 * the steady-state cost is ONE extra run per quiet window that follows a burst, not one per tick.
 *
 * ⚠ THE TWO WAYS THIS COULD MAKE THINGS WORSE, both closed in `decide` below and both tested:
 *   1 · A SCHEDULED RUN MUST NEVER CANCEL A PUSH RUN. `github.ref` is refs/heads/main for both, so
 *       one concurrency group would mean the tick supersedes somebody's fresh push · strictly worse
 *       than the defect. e2e.yml therefore keys the group on the event name, and this script
 *       additionally refuses to run while any run of the workflow is IN PROGRESS.
 *   2 · IT MUST NEVER GATE A PUSH OR PULL_REQUEST RUN. Those are the merge gate; they always run.
 *       The caller passes the event name and `decide` returns NEEDED for anything but `schedule`.
 *
 * FAIL OPEN, DELIBERATELY. If the API cannot be read, the answer is NEEDED. A guard that fails
 * closed disables itself silently and reports nothing, which is the exact shape of the defect it
 * exists to fix (Rule 80 · never let "I could not check" resolve to a comfortable value). An extra
 * browser run is cheap and visible; a permanently silent scheduler is neither.
 *
 * USAGE   node scripts/tip-verdict-needed.cjs [--sha <sha>] [--event <name>] [--workflow <file>]
 *         writes `needed=true|false` to $GITHUB_OUTPUT and a line to $GITHUB_STEP_SUMMARY
 */

const { execFileSync } = require('child_process')
const fs = require('fs')

const TERMINAL = new Set(['success', 'failure'])
const LIVE = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending'])

/**
 * The whole decision, as a pure function of the run list. Separated from the fetch so it can be
 * tested against constructed histories · the fetch is one line and the judgement is the risk.
 *
 * @param {{head_sha:string, status:string, conclusion:string|null, id?:number}[]|null} runs
 *        null means "could not be read", which is NOT the same as "there are none" (Rule 80).
 * @param {{sha:string, event:string, selfId?:number}} ctx
 * @returns {{needed:boolean, reason:string, detail:string}}
 */
function decide(runs, { sha, event, selfId = null }) {
  // 1 · A PUSH OR PR RUN IS THE MERGE GATE AND IS NEVER GATED. First, so that no later branch can
  //     reach a `false` for one · this is the assertion that keeps the fix from becoming the defect.
  if (event !== 'schedule') {
    return { needed: true, reason: 'NOT-A-TICK', detail: `event is ${event} · push and pull_request always run` }
  }
  if (runs === null) {
    return { needed: true, reason: 'UNMEASURED', detail: 'the run history could not be read · failing OPEN, because a guard that fails closed disables itself in silence' }
  }
  // 2 · SOMETHING IS ALREADY RUNNING. Skip rather than race it: two concurrent Playwright runs each
  //     invoke purge_e2e_test_data() in globalTeardown, which deletes rooms project-wide with no
  //     status and no age predicate, so they destroy each other's fixtures (the open cross-workflow
  //     collision documented in e2e.yml's own header).
  const live = runs.filter(r => LIVE.has(r.status) && r.id !== selfId)
  if (live.length) {
    return { needed: false, reason: 'ALREADY-RUNNING', detail: `${live.length} run(s) of this workflow are in flight · a second one would purge their rooms` }
  }
  // 3 · THE TIP ALREADY HAS A VERDICT. The steady state, and the reason this costs one run per quiet
  //     window rather than one per tick.
  const mine = runs.filter(r => r.head_sha === sha)
  const verdict = mine.find(r => TERMINAL.has(r.conclusion))
  if (verdict) {
    return { needed: false, reason: 'ALREADY-MEASURED', detail: `${sha.slice(0, 7)} already has a ${verdict.conclusion} verdict` }
  }
  const why = mine.length
    ? `${mine.length} run(s) exist for ${sha.slice(0, 7)} and none reached a verdict (${[...new Set(mine.map(r => r.conclusion || r.status))].join(', ')})`
    : `no run of this workflow has ever been created for ${sha.slice(0, 7)}`
  return { needed: true, reason: 'TIP-UNMEASURED', detail: why }
}

const ghApi = (path) => JSON.parse(execFileSync('gh', [
  'api', path, '--jq', '[.workflow_runs[] | {head_sha, status, conclusion, id}]',
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))

/**
 * The runs `decide` needs, fetched as TARGETED queries rather than one page that can be outrun.
 *
 * ⚠ THIS WAS `?per_page=60` AND FILTERED CLIENT-SIDE UNTIL T2 S66 · my own S65 closing critique.
 * Three lanes push in bursts; sixty runs is a few hours of that. Once the tip's runs fall off the
 * page the client-side filter finds none and reports `no run of this workflow has ever been created
 * for <sha>`, which is FALSE. It fails OPEN so the tick still runs and nothing breaks · and that is
 * precisely what makes it dangerous, because a wrong REASON attached to a working mechanism is the
 * least-audited line there will ever be (preamble §4). Verified before rewriting, with its control:
 *     ?head_sha=4524230...  -> {total: 1, returned: 1}
 *     ?head_sha=0000000...  -> {total: 0, returned: 0}     (the filter is real, not ignored)
 * Same truncated-page class T3 hit with `--limit 6` and T1 hit with a NUL-truncated grep · three
 * lanes, three instruments, one shape (preamble §3 · absence inside a truncated page is not absence).
 *
 * `api` is injectable so the UNION logic below can be tested without a network (the queries are
 * trivial; combining them is where a mistake would live).
 */
function fetchRuns(workflow, repo, sha, api = ghApi) {
  const base = `repos/${repo}/actions/workflows/${workflow}/runs`
  try {
    // 1 · every run for THIS commit · exact, server-side, cannot be outrun by other commits.
    const mine = sha ? api(`${base}?head_sha=${sha}&per_page=100`) : []
    // 2 · anything currently live, for ANY commit · the collision check is about the workflow, not
    //     about this sha, so it needs its own query and cannot come from the one above.
    const live = [...api(`${base}?status=in_progress&per_page=100`), ...api(`${base}?status=queued&per_page=100`)]
    if (!Array.isArray(mine) || !Array.isArray(live)) return null
    // Deduplicated by id: a run for THIS sha that is also in flight appears in both, and counting it
    // twice would be harmless today and is exactly the kind of thing that stops being harmless.
    const byId = new Map()
    for (const r of [...mine, ...live]) byId.set(r.id, r)
    return [...byId.values()]
  } catch {
    return null
  }
}

function main() {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`)
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
  }
  const sha = arg('sha', process.env.GITHUB_SHA || '')
  const event = arg('event', process.env.GITHUB_EVENT_NAME || 'schedule')
  const workflow = arg('workflow', 'e2e.yml')
  const repo = arg('repo', process.env.GITHUB_REPOSITORY || 'mahilh/neotopia')
  const selfId = process.env.GITHUB_RUN_ID ? Number(process.env.GITHUB_RUN_ID) : null

  const runs = event === 'schedule' ? fetchRuns(workflow, repo, sha) : []
  const d = decide(runs, { sha, event, selfId })

  const line = `${d.needed ? 'RUN' : 'SKIP'} · ${d.reason} · ${d.detail}`
  console.log(`tip-verdict-needed (${workflow}) :: ${line}`)
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `needed=${d.needed}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### Tip verdict check\n\n\`${line}\`\n\n` +
      (d.needed
        ? '_This tick found the tip without a verdict and nothing in flight, so the E2E run below is doing real work._\n'
        : '_No work done. The tick exists so a commit cannot sit unmeasured after a burst of pushes cancels every run._\n'))
  }
}

if (require.main === module) main()

module.exports = { decide, fetchRuns, TERMINAL, LIVE }
