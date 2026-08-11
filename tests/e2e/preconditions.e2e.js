// NeoTopia · THE GATE'S OWN EVIDENCE · proving the precondition gates fire, and name the right layer (T3 S27).
//
// WHY THIS FILE EXISTS AT ALL. Rule 72, learned the hard way in S22: running a verifier once proves it
// EXECUTES, not that its verdict is SOUND. The gates in preconditions.js are themselves diagnostic code, and
// diagnostic code that is wrong is worse than none · it misdirects with authority. A gate wired into two
// nightly specs and never exercised would sit there for months looking like coverage.
//
// So this file does to the gate what the gate does to a spec: it manufactures the exact failure the gate
// claims to catch (the 07-27 outage) and asserts the gate produces the RIGHT SENTENCE. The assertions are on
// the MESSAGE, deliberately · the entire value of this work is diagnostic wording. A gate that throws the
// right error at the wrong time, or the wrong error at the right time, is a gate that has failed.
//
// The outage is simulated at the browser-context layer (same technique as backend-down.e2e.js) so this file
// is deterministic, needs no live backend, and can never be confused with a real incident. It still needs
// VITE_SUPABASE_* present for the DEV SERVER to boot · the values are never successfully used.
//
// CI: deterministic + offline-by-construction → merge-gating path, alongside backend-down.e2e.js.
// Run locally:  npx playwright test tests/e2e/preconditions.e2e.js

import { test, expect } from '@playwright/test'
import {
  assertBackendReachable, assertSessionEstablished, readHealth,
  diagnoseDeploymentProtection, assertDeploymentReachable,
} from './preconditions'

test.beforeEach(() => { test.setTimeout(90_000) })

const NAME_INPUT = 'Builder name (max 20)'

// Same interception shape as backend-down.e2e.js · matched on the parsed URL so it stays correct whatever
// the project ref is, and covers the websocket too (HTTP routing does not touch WebSockets).
function isBackendUrl(url) {
  const u = typeof url === 'string' ? new URL(url) : url
  return /(^|\.)supabase\.(co|in|net)$/.test(u.hostname) ||
         /\/(rest|auth|realtime|functions|storage)\/v1\//.test(u.pathname)
}

async function killBackend(context) {
  await context.route((url) => isBackendUrl(url), (route) => route.abort('connectionrefused'))
  await context.routeWebSocket((url) => isBackendUrl(url), (ws) => ws.close({ code: 1006 }))
}

// Capture the rejection without letting a PASS masquerade as one · if the gate resolves, that IS the bug.
async function captureThrow(fn, whatShouldHaveHappened) {
  let err = null
  try { await fn() } catch (e) { err = e }
  expect(err, whatShouldHaveHappened).not.toBeNull()
  return String(err.message ?? err)
}

test.describe('the precondition gate · fires on an outage, and blames the right layer', () => {
  test('assertBackendReachable reports the OUTAGE, not a missing element', async ({ page, context }) => {
    await killBackend(context)
    await page.goto('/lobby')

    const msg = await captureThrow(
      () => assertBackendReachable(page, { context: 'self-test' }),
      'the gate RESOLVED during a total outage · it would have let the spec run on and mis-report',
    )

    // The sentence a human reads at 3am. Each of these is load-bearing.
    expect(msg).toContain('BACKEND UNREACHABLE')
    expect(msg).toContain('not a feature regression') // the exact misreading this whole gate exists to stop
    expect(msg).toContain('offline')
    expect(msg).toContain('self-test')               // which spec, when several run in a nightly
    expect(msg).toMatch(/failing transport\s+= auth/) // WHICH pipe died · a UI can be specific, so can we

    // THE REGRESSION GUARD ON THE DIAGNOSIS ITSELF. On 07-27 the reported error named a component. If this
    // gate's message ever starts naming one, the misdirection has simply moved one layer up.
    expect(msg).not.toContain('mode-flow')
    expect(msg).not.toContain('data-testid')
  })

  test('the reported cause is the REAL one, carried from the transport that failed', async ({ page, context }) => {
    await killBackend(context)
    await page.goto('/lobby')

    const msg = await captureThrow(() => assertBackendReachable(page), 'gate did not fire')

    // Not a generic "something went wrong" · the aggregator's own reason string is threaded through, which is
    // what let the S26 triage tell a DNS failure apart from a rate limit. Both end in a failed sign-in and an
    // absent element; only the error's own words distinguish them.
    const health = await readHealth(page)
    expect(health.reason).toBeTruthy()
    expect(msg).toContain(health.reason)
  })

  test('assertSessionEstablished names the MISSING SESSION · the precondition 07-27 actually violated', async ({ page, context }) => {
    await killBackend(context)
    await page.goto('/lobby')

    const msg = await captureThrow(
      () => assertSessionEstablished(page, page.getByPlaceholder(NAME_INPUT), { context: 'self-test' }),
      'the session gate RESOLVED with no session · every downstream locator would then fail misleadingly',
    )

    // It may exit through either door · the fast backend check or the disabled name field. Both are correct
    // and both must name a LAYER rather than a widget, so the assertion accepts either sentence.
    expect(msg).toMatch(/NO SESSION|BACKEND UNREACHABLE/)
    expect(msg).not.toContain('mode-flow')
  })

  test('a dead app boot is its OWN diagnosis · not reported as a backend outage', async ({ page }) => {
    // Three different layers can break here and they must not be conflated: the app not booting at all, the
    // backend being unreachable, and a genuine feature regression. A page that never runs NeoTopia's JS
    // never publishes html[data-backend-status], and the gate must say exactly that.
    await page.goto('about:blank')

    const msg = await captureThrow(
      () => assertBackendReachable(page, { bootTimeoutMs: 2_000, context: 'self-test' }),
      'the gate resolved on a page where the app never ran',
    )

    expect(msg).toContain('never booted')
    expect(msg).toContain('NOT a feature regression')
    expect(msg).not.toContain('BACKEND UNREACHABLE') // a different layer · a different sentence
  })

  test('the gate is not a rubber stamp · it does NOT fire merely because a spec called it', async ({ page, context }) => {
    // The counterweight to every test above. A gate that always throws would pass all of them and be
    // worthless · worse than worthless, since it would red the nightly for no reason. Here the backend is
    // dead but the health module has NOT yet reported it (the failure needs a rejected sign-in to arrive),
    // so a gate that watches over time must still be quiet in the very first instant.
    await killBackend(context)
    await page.goto('/lobby')

    // settleMs of 0 · the loop body never runs, so this can only pass if the gate genuinely samples over a
    // window rather than throwing on principle.
    await assertBackendReachable(page, { settleMs: 0, context: 'self-test' })

    // And with a real window, the same page DOES fire · same page, same outage, different observation time.
    // That contrast is the proof the gate's verdict tracks evidence rather than its own existence.
    const msg = await captureThrow(
      () => assertBackendReachable(page, { settleMs: 8_000 }),
      'gate never fired even with a full settle window',
    )
    expect(msg).toContain('BACKEND UNREACHABLE')
  })
})

// ── THE FOURTH LAYER · deployment protection (T3 S31) ────────────────────────────────────────────
// A WAF or SSO wall in front of the deployment produces the SAME downstream symptom as a broken
// bundle — NeoTopia's JS never runs, so html[data-backend-status] is never published — and the
// existing gate would confidently answer "check the dev server, the bundle and the console", sending
// a reader after three things that are all fine. Same misdirection as 07-27, one layer further out.
//
// The wall is simulated by fulfilling EVERY request from the context, which is what a WAF actually
// does: it blocks the origin, not one document. So these tests need no deployment, no network and no
// anonymous sign-in, and can never be confused with a real incident.

async function serveWall(context, { status, headers, body }) {
  await context.route('**/*', route => route.fulfill({
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body,
  }))
}

const CHALLENGE_HTML = '<html><head><title>Just a moment…</title></head><body>Verifying your browser…</body></html>'
const SSO_HTML = '<html><body>Authentication Required · <a href="https://vercel.com/sso-api?url=x">continue</a></body></html>'

test.describe('the precondition gate · a protected deployment is not a broken bundle', () => {
  test('a bot challenge reports itself as DEPLOYMENT PROTECTION, not as a dead app boot', async ({ page, context }) => {
    await serveWall(context, {
      status: 403, headers: { 'x-vercel-mitigated': 'challenge' }, body: CHALLENGE_HTML,
    })
    await page.goto('/lobby')

    const msg = await captureThrow(
      () => assertBackendReachable(page, { bootTimeoutMs: 4_000, context: 'self-test' }),
      'the gate RESOLVED behind a WAF challenge · the spec would have run on and blamed a locator',
    )

    // The sentence. Every clause below is load-bearing and was chosen because a reader acts on it.
    expect(msg).toContain('BLOCKED BY VERCEL DEPLOYMENT PROTECTION')
    expect(msg).toContain('not a feature regression')
    expect(msg).toContain('not a backend outage')   // it excludes the OTHER wrong answer too
    expect(msg).toContain('x-vercel-mitigated: challenge') // the witness, quoted verbatim (Rule 39)
    expect(msg).toContain('custom domain')          // the actual fix · configuration, not code
    expect(msg).toContain('self-test')

    // THE REGRESSION GUARD. These are the two confident-but-wrong instructions this test exists to
    // stop being printed: go debug your bundle, or go find the missing component.
    expect(msg).not.toContain('never booted')
    expect(msg).not.toContain('check the dev server')
    expect(msg).not.toContain('data-testid')
  })

  test('SSO protection is named as SSO · a different wall gets a different sentence', async ({ page, context }) => {
    await serveWall(context, { status: 401, headers: {}, body: SSO_HTML })
    await page.goto('/lobby')

    const msg = await captureThrow(
      () => assertBackendReachable(page, { bootTimeoutMs: 4_000 }),
      'the gate resolved behind an SSO wall',
    )
    expect(msg).toContain('BLOCKED BY VERCEL DEPLOYMENT PROTECTION')
    expect(msg).toContain('SSO / password protection')
    expect(msg).not.toContain('bot challenge')  // the two are told apart, not lumped together
  })

  test('a HEALTHY page is not accused · the response check is silent when the app is served', async ({ page }) => {
    // The counterweight to both tests above, and the one that makes them mean anything: a gate that
    // cried "protected" on every navigation would satisfy every assertion here and red the suite.
    const res = await page.goto('/lobby')
    expect(() => assertDeploymentReachable(res, { context: 'self-test' })).not.toThrow()
    // …and the ordinary gate still reaches its ordinary verdict on the same page.
    await assertBackendReachable(page, { settleMs: 0, context: 'self-test' })
  })

  test('the detector does not mistake OUR OWN 403 for a WAF', async () => {
    // The likeliest false positive in this codebase by a wide margin. Postgres denials arrive as 403
    // constantly (RLS, column grants · migration 017 revoked INSERT/UPDATE on player_profiles), and
    // reporting one of those as "deployment protection" would send a reader to the Vercel dashboard
    // to debug a database permission. A bare status is NOT evidence · body markers are required.
    expect(diagnoseDeploymentProtection({
      status: 403, headers: { 'content-type': 'application/json' },
      body: '{"message":"permission denied for table player_profiles","code":"42501"}',
    })).toBeNull()

    expect(diagnoseDeploymentProtection({ status: 429, headers: {}, body: '{"msg":"Request rate limit reached"}' }))
      .toBeNull() // the anon sign-in rate limit · a real and frequent 429 that is not a mitigation
    expect(diagnoseDeploymentProtection({ status: 200, headers: {}, body: '<div id="root"></div>' })).toBeNull()
    expect(diagnoseDeploymentProtection({})).toBeNull()

    // And it DOES fire on the real shapes · otherwise the four nulls above are just a broken detector.
    expect(diagnoseDeploymentProtection({ status: 403, headers: { 'X-Vercel-Mitigated': 'challenge' }, body: '' }))
      .toMatchObject({ kind: 'challenge' })          // header match is case-insensitive
    expect(diagnoseDeploymentProtection({ status: 708, headers: {}, body: '' }))
      .toMatchObject({ kind: 'challenge' })          // the challenge endpoint's own status (T1, live)
    expect(diagnoseDeploymentProtection({ status: 401, headers: {}, body: SSO_HTML }))
      .toMatchObject({ kind: 'sso' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A CITATION WITH NO RUNNER IS A CLAIM, NOT EVIDENCE · EVERY SPEC DECLARES ITS WORKFLOW (T3 S43)
//
// T2 found that draw-rpc-concurrency.mjs had been DEAD ON IMPORT for nineteen sessions while migration 011
// cited it as "PROVEN EMPIRICALLY T3 S23". Nothing that citation said was wrong when it was written · and
// that is the whole problem, because nothing was watching, so it could not report its own rot (Rule 79) and
// it outlived the thing it cited (T2's Rule 97).
//
// Doing that audit BY HAND is the wrong instrument for the same reason Rule 89 gives: orphans are invisible
// by construction, and a hand pass finds the ones you already suspect. So it is a gate, and it runs on the
// merge gate alongside the rest of this file.
//
// IT DOES NOT DEMAND THAT EVERY SPEC BE WIRED, and that restraint is deliberate · a new spec is legitimately
// unwired for a session or two while the lane that owns the workflow picks it up, and a gate that reds on
// that would be a tripwire aimed at a colleague (the mistake I made in S39 and removed in S42). What it
// demands is that the file SAY SO: either a workflow RUNS it, or its header DECLARES the RUNS-NOWHERE:
// marker with a reason. The honest state is always available; the silent one is not.
//
// ⚠ BOTH HALVES OF THIS GATE WERE PLAIN SUBSTRING MATCHES UNTIL T3 S50, AND BOTH WERE SATISFIED BY PROSE
// ABOUT THE THING RATHER THAN THE THING. That is one defect wearing two costumes, and it survived six
// sessions because the gate was green every single run · it had never once been made to fail on purpose.
//   THE ESCAPE HATCH · `/RUNS-NOWHERE:/` matched anywhere in 4000 characters, so a sentence DISCUSSING the
//     marker excused the file. This header and postgres-writeorder's both did. S49 worked around it by
//     omitting the colon from the prose, which is a note that a future editor could not know to obey.
//     Now the declaration must START a line (after its comment prefix) and carry a reason, so the only way
//     left to fool it is to write an actual declaration · at which point the false accept IS the true form.
//   THE WIRING CHECK · `wfText.includes(spec)` was a substring over all eight workflows CONCATENATED, so a
//     spec named only in a `#` comment read as wired. Not hypothetical: multiplayer-endgame-live.e2e.js is
//     named in two comments (e2e.yml:83, e2e-live-nightly.yml:94) as well as two run lines, so deleting
//     both invocations would have left this gate green on prose explaining why the spec matters. Now a
//     mention that survives only in comments is reported as its own failure kind, which names the mechanism
//     rather than saying "orphan" and leaving the reader to find the comment.
//   AND A THIRD COSTUME, WHICH THE MUTATION RUN FOUND AND NO AMOUNT OF REREADING WOULD HAVE · `includes()`
//     has no word boundary, and "endgame-live.e2e.js" IS A SUBSTRING OF "multiplayer-endgame-live.e2e.js".
//     So endgame-live.e2e.js · 653 lines, the spec that plays a real multiplayer room to its own ending,
//     the composition CLAUDE.md names as the honest remaining gap · has been in NO WORKFLOW since S39 and
//     read as wired for every one of the seven sessions this gate has existed. The gate built to find specs
//     that run nowhere was hiding one, and it was hiding it from ITSELF. A filename is now matched only
//     where it is not preceded by another filename character, so `/` still wires and `-` no longer does.
//
// The classifier is a PURE FUNCTION so the two directions can both be proven (Rule 99a): the real repo goes
// through it (the funnel · Rule 99b), and the teeth block below drives the SAME function over synthetic
// corpora with known answers · including the two holes above, which is what stops them being reintroduced by
// someone who reads `includes()` as obviously correct. It is obviously correct. It was also wrong twice.
// RESIDUAL, stated rather than implied: a spec named on a run line inside a job that never fires (`if:
// false`, a workflow nobody dispatches) still reads as wired. This gate answers "does a workflow invoke
// it", not "did it execute" · Rule 79d owns the second question and reads the log for the test lines.
import { readdirSync, readFileSync } from 'node:fs'

// A YAML `#` comment, or a shell `#` comment inside a `run: |` block · both are text that does not invoke.
const IS_COMMENT_LINE = /^\s*#/
// The declaration must OPEN a line and carry a reason after the colon. `// RUNS-NOWHERE: nobody owns this`
// declares; "...its header declares the RUNS-NOWHERE: marker" does not.
const DECLARATION = /^[ \t]*(?:\/\/|#|\*)[ \t]*RUNS-NOWHERE:[ \t]*\S/m

// A filename matches only where it is not preceded by another filename character · `/` and whitespace wire
// it, `-` and letters do not. Without this, any spec whose name is a suffix of a longer spec's name is
// wired by its neighbour (endgame-live.e2e.js was, for seven sessions · see the header).
const mentions = (text, name) =>
  new RegExp(`(?<![A-Za-z0-9_.\\-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text)

/**
 * Classify every spec as wired / declared / comment-only / orphaned.
 *
 * @param {{name: string, header: string}[]} specs
 * @param {{name: string, text: string}[]} workflows
 * @returns {{wired: string[], declared: string[], commentOnly: string[], orphans: string[],
 *            runLines: number, commentLines: number}}
 */
export function auditSpecWiring(specs, workflows) {
  const run = []
  const comments = []
  for (const wf of workflows) {
    for (const line of wf.text.split('\n')) (IS_COMMENT_LINE.test(line) ? comments : run).push(line)
  }
  const runText = run.join('\n')
  const commentText = comments.join('\n')

  const out = { wired: [], declared: [], commentOnly: [], orphans: [], runLines: run.length, commentLines: comments.length }
  for (const spec of specs) {
    if (mentions(runText, spec.name)) { out.wired.push(spec.name); continue }
    // A declaration outranks a comment mention: a file that says it runs nowhere is being honest even if a
    // workflow still discusses it.
    if (DECLARATION.test(spec.header)) { out.declared.push(spec.name); continue }
    ;(mentions(commentText, spec.name) ? out.commentOnly : out.orphans).push(spec.name)
  }
  return out
}

test.describe('every E2E spec names the workflow that runs it, or says it runs nowhere (T3 S43)', () => {
  test('no spec is silently orphaned', async () => {
    const specDir = new URL('.', import.meta.url)
    const wfDir = new URL('../../.github/workflows/', import.meta.url)

    const specFiles = readdirSync(specDir).filter(f => f.endsWith('.e2e.js'))
    const wfFiles = readdirSync(wfDir).filter(f => /\.ya?ml$/.test(f))
    // COUNTERWEIGHT FIRST (Rule 90): if either list came back empty, every spec below would read as
    // "wired" or the loop would not run at all, and this gate would pass while auditing nothing. That is
    // the exact shape of the thing it was built to catch, one level up.
    expect(specFiles.length, 'no E2E specs were found · this gate is auditing an empty set').toBeGreaterThan(10)
    expect(wfFiles.length, 'no workflow files were found · every spec would look orphaned, or none would')
      .toBeGreaterThan(0)

    const specs = specFiles.map(name => ({
      name, header: readFileSync(new URL(name, specDir), 'utf8').slice(0, 4000),
    }))
    const workflows = wfFiles.map(name => ({ name, text: readFileSync(new URL(name, wfDir), 'utf8') }))
    const audit = auditSpecWiring(specs, workflows)

    // SECOND COUNTERWEIGHT, and it is the one that guards the S50 fix rather than the S43 gate: the
    // comment/run split must be NON-DEGENERATE. Mutate IS_COMMENT_LINE to match nothing and commentLines
    // is 0 · the old substring behaviour, silently restored. Mutate it to match everything and runLines is
    // 0 · every spec becomes comment-only. Both directions red here, and neither is measured by the same
    // predicate twice over (Rule 92a): these are counts of the real corpus, checked against the fact that
    // eight workflow files necessarily contain both kinds of line.
    expect(audit.runLines, 'no non-comment lines in any workflow · the comment filter is eating everything')
      .toBeGreaterThan(50)
    expect(audit.commentLines, 'no comment lines found in eight workflow files · the comment filter is ' +
      'matching nothing, so this gate has silently reverted to the pre-S50 substring behaviour that let a ' +
      'spec named only in prose read as wired').toBeGreaterThan(10)

    expect(audit.commentOnly, `${audit.commentOnly.length} E2E spec(s) are named ONLY in workflow ` +
      `COMMENTS and are invoked by nothing: ${audit.commentOnly.join(', ')}. A comment explaining why a ` +
      'spec matters is not a runner · this is the exact failure the gate was blind to until S50.')
      .toEqual([])

    expect(audit.orphans, `${audit.orphans.length} E2E spec(s) are in no workflow and do not say so: ` +
      `${audit.orphans.join(', ')}. A spec that runs nowhere cannot report its own rot · it decays silently ` +
      'and in the direction of a lie (Rule 79), and any comment citing it as proof is a claim rather than ' +
      'evidence (Rule 97). Either wire it, or open a line in its header with RUNS-NOWHERE: followed by why ' +
      'and who owns wiring it.').toEqual([])

    // ── THE COLLISION PROPERTY, ASSERTED ON THE REAL NAMES (T3 S51) ─────────────────────────────────────
    // In S50 I closed the identity hole with a fixture holding the exact historical pair, and said in the
    // same breath that a fixture is a MODEL: it pins the collision that existed, and it cannot notice the
    // NEXT one. My proposal then was to ban substring collisions outright. That is the wrong gate, and
    // measuring it is what shows why · among `*.e2e.js` files a name can only ever be contained as a
    // SUFFIX (both end in the same 7 characters, so a prefix relationship means the names are identical),
    // and a suffix collision is exactly what the left boundary handles. Banning it would forbid a perfectly
    // good name to guard against a defect that no longer exists · Rule 94a, which I wrote and then nearly
    // walked into.
    // SO ASSERT THE PROPERTY INSTEAD OF PROHIBITING THE SHAPE: for every colliding pair that actually
    // exists, drive the REAL classifier with a corpus naming only the longer one, and require the shorter
    // one not to be wired by it. It re-derives itself the moment anybody renames a spec, and unlike the
    // fixture it is measuring the names the repo really has.
    // ⚠ AND IT IS VACUOUS WHEN THERE ARE NO COLLISIONS · a loop over an empty list asserts nothing, which
    // is the failure mode this whole file exists to refuse (Rule 86). That is why the fixture STAYS rather
    // than being replaced by this: the fixture always runs and always holds the historical pair, so the
    // zero-collision case is covered by construction. Asserting `collisions.length > 0` instead would make
    // a legitimate rename red · a tripwire to protect a guard, which is the wrong trade every time.
    // The count is printed below so "0 collisions" is a reading rather than a silence.
    const collisions = []
    for (const a of specFiles) for (const b of specFiles) if (a !== b && b.includes(a)) collisions.push([a, b])
    for (const [shorter, longer] of collisions) {
      const probe = auditSpecWiring(
        [{ name: shorter, header: '' }, { name: longer, header: '' }],
        [{ name: 'probe.yml', text: `    run: npx playwright test tests/e2e/${longer}\n` }],
      )
      expect(probe.wired, `"${shorter}" is a substring of "${longer}", and a corpus wiring only the ` +
        'longer one reports the shorter one as wired. That is the S50 defect · it hid endgame-live.e2e.js ' +
        'for seven sessions · reintroduced by a weakened name boundary in auditSpecWiring.')
        .toEqual([longer])
    }
    console.log(`[preconditions] spec-runner audit · ${specs.length} specs across ${workflows.length} ` +
      `workflows · ${audit.wired.length} wired · ${audit.declared.length} declared · 0 silent orphans ` +
      `· ${audit.runLines} run lines / ${audit.commentLines} comment lines · ${collisions.length} name ` +
      'collision(s), each proven distinguishable')
  })

  // ── TEETH · THE GATE MADE TO FAIL ON PURPOSE, IN BOTH DIRECTIONS (T3 S50) ─────────────────────────────
  // My own closing critique in S49: "my instruments have been earning trust from age rather than from being
  // exercised." This gate was six sessions old, green every run, and had two substring holes in it. A
  // mutation run proves a gate once, on the day someone runs it; these fixtures prove it on every run, and
  // they are the reason the holes cannot come back silently. Each case is a corpus with a known answer.
  const spec = (name, header = '// nothing to declare') => ({ name, header })
  const wf = (name, text) => ({ name, text })

  test('teeth · a run line wires, a comment does not, and prose does not declare', async () => {
    const workflows = [wf('ci.yml', [
      'jobs:',
      '  # a.e2e.js is deliberately excluded from the fast gate · it costs four sign-ins',
      '    run: npx playwright test tests/e2e/b.e2e.js',
      '      # tests/e2e/c.e2e.js used to run here',
    ].join('\n'))]

    const audit = auditSpecWiring([
      spec('b.e2e.js'),                                                   // named on a run line
      spec('a.e2e.js'),                                                   // named ONLY in a YAML comment
      spec('c.e2e.js'),                                                   // named ONLY in a shell comment
      spec('d.e2e.js'),                                                   // named nowhere at all
      spec('e.e2e.js', '// RUNS-NOWHERE: T2 owns wiring this · S51'),     // a real declaration
      spec('f.e2e.js', '// its header declares the RUNS-NOWHERE: marker'), // PROSE about the marker
      spec('g.e2e.js', '// RUNS-NOWHERE:'),                               // marker with no reason
    ], workflows)

    expect(audit.wired, 'a spec named on a non-comment line is wired').toEqual(['b.e2e.js'])
    // THE S50 HOLE, both costumes. Before the fix a.e2e.js and c.e2e.js read as WIRED (substring over the
    // concatenated text) and f.e2e.js read as DECLARED (substring over the header).
    expect(audit.commentOnly, 'a spec named only inside # comments is NOT wired · YAML or shell')
      .toEqual(['a.e2e.js', 'c.e2e.js'])
    expect(audit.declared, 'only a line that OPENS with the marker and carries a reason declares')
      .toEqual(['e.e2e.js'])
    expect(audit.orphans, 'prose about the marker, and a marker with no reason, are not declarations')
      .toEqual(['d.e2e.js', 'f.e2e.js', 'g.e2e.js'])
  })

  test('teeth · a spec is not wired by a longer spec that contains its name', async () => {
    // THE THIRD COSTUME, and the one that was live. This exact pair sat in the repo for seven sessions:
    // "endgame-live.e2e.js" is a suffix of "multiplayer-endgame-live.e2e.js", so the shorter name matched
    // the longer one's run line and read as wired while nothing invoked it. Pinned as a fixture rather than
    // trusted to the real corpus, because the real corpus stops containing the collision the day either
    // file is renamed · and then the boundary check is unproven again with nothing going red.
    const audit = auditSpecWiring(
      [spec('endgame-live.e2e.js'), spec('multiplayer-endgame-live.e2e.js')],
      [wf('nightly.yml', '          tests/e2e/multiplayer-endgame-live.e2e.js\n')],
    )
    expect(audit.wired, 'only the file actually named is wired').toEqual(['multiplayer-endgame-live.e2e.js'])
    expect(audit.orphans, 'the shorter name must NOT ride on its neighbour').toEqual(['endgame-live.e2e.js'])

    // And the boundary must not over-tighten: a path separator, a line start and whitespace all still wire.
    const paths = auditSpecWiring(
      [spec('a.e2e.js'), spec('b.e2e.js'), spec('c.e2e.js')],
      [wf('w.yml', 'run: playwright test tests/e2e/a.e2e.js b.e2e.js\nc.e2e.js\n')],
    )
    expect(paths.orphans, 'slash, space and line-start are all legitimate boundaries (Rule 94a · a gate ' +
      'that condemns working wiring gets switched off)').toEqual([])
  })

  test('teeth · the negative direction · a normal corpus reports nothing (Rule 99a)', async () => {
    // The half that is easy to skip and is exactly half the proof: a detector that cries wolf on working
    // input is worse than no detector (Rule 94a · a gate read as noise gets switched off).
    const audit = auditSpecWiring(
      [spec('x.e2e.js'), spec('y.e2e.js'), spec('z.e2e.js', '  //   RUNS-NOWHERE: nightly-only, T2 S51')],
      [wf('a.yml', '    run: npx playwright test tests/e2e/x.e2e.js\n'),
       wf('b.yml', '      run: >\n        npx playwright test\n        tests/e2e/y.e2e.js\n')],
    )
    expect(audit.orphans).toEqual([])
    expect(audit.commentOnly).toEqual([])
    expect(audit.wired).toEqual(['x.e2e.js', 'y.e2e.js'])   // incl. the nightly's folded `run: >` block
    expect(audit.declared).toEqual(['z.e2e.js'])            // leading whitespace and spacing are tolerated
  })

  test('teeth · a declaration outranks a comment mention, and an empty corpus is degenerate', async () => {
    const both = auditSpecWiring(
      [spec('h.e2e.js', '// RUNS-NOWHERE: engine-only · nothing invokes it yet')],
      [wf('a.yml', '  # h.e2e.js is coming to the nightly next session')],
    )
    expect(both.declared, 'an honest file stays honest even while a workflow discusses it').toEqual(['h.e2e.js'])
    expect(both.commentOnly).toEqual([])

    // Degenerate corpora: the real gate's two counterweights above are what catch these, and this is the
    // evidence they are reachable rather than decorative.
    const noComments = auditSpecWiring([spec('i.e2e.js')], [wf('a.yml', 'run: playwright test i.e2e.js')])
    expect(noComments.commentLines, 'a corpus with no comment lines · the real gate reds on this').toBe(0)
    const allComments = auditSpecWiring([spec('i.e2e.js')], [wf('a.yml', '# run: playwright test i.e2e.js')])
    expect(allComments.runLines, 'a corpus with no run lines · the real gate reds on this').toBe(0)
    expect(allComments.commentOnly, 'and every spec falls through to comment-only').toEqual(['i.e2e.js'])
  })
})

// ── STALE MIGRATION CITATIONS (T3 S49) ───────────────────────────────────────────────────────────────
// A comment naming the migration it was written against is stale BY DEFAULT, not by accident. `create or
// replace` means MIGRATIONS ARE A LOG, NOT A STATE: 5 of the 16 functions in scripts/migrations/ are
// redefined by a later migration and 3 of them twice (record_civilization_score 009>014>019,
// draw_card_for_seat 011>014>021, purge_e2e_test_data 006>008>014>023). So a citation is a claim with an
// expiry date, and NOTHING makes it expire loudly · a wrong test goes red, a wrong comment goes red never.
//
// THIS EXISTS BECAUSE IT COST A REAL DEFECT. In S46 I retracted a TRUE warning about purge_e2e_test_data
// after reading migration 006 and stopping · 008 had already dropped the status filter that 006 contained.
// I then hand-swept the citations in S48, fixed three files, and MISSED a fourth (flow-mode-live.e2e.js),
// which a five-second grep found while I was drafting a recommendation about hand sweeps missing things.
// That is Rule 89 twice over, so the sweep is an instrument now and not an act of attention.
//
// WHAT IT ASSERTS, precisely, because the remedy is NOT "swap the number" (Rule 98a · the alarm is a fact,
// the remedy is a guess made before the situation existed): a citation must NAME THE END OF THE CHAIN. It
// deliberately does NOT claim the newest migration is the DEPLOYED one · migration 014 and 023 are both
// committed and unapplied today, so for some functions the OLD number is what is actually running. Nothing
// in this repo can tell you which (the applied-markers in the headers are inconsistent, and 021's header
// says "unapplied" about a DIFFERENT migration · Rule 91). Only the live database can (Rule 109a). So the
// fix is to name the chain, not to swap one number for another, and the message says so.
//
// PAIRING IS SAME-LINE ONLY, and that is a deliberate precision/recall trade measured rather than guessed.
// A +/-1 line window catches one more real case and manufactures THREE false ones · it paired a citation of
// migration 005 (rooms_delete_host) with purge_e2e_test_data from a neighbouring line. A gate that condemns
// three working comments gets read as noise and switched off, and then it is not there on the day it is
// right (Rule 94a · a false positive is not the safe error). The near-miss bucket is REPORTED, not gated.
//
// ESCAPE HATCH, the same restraint as the orphan audit above: a line that means an OLD migration on purpose
// (quoting its title, dating a fix) says MIGRATION-HISTORY and is skipped. Either be current, or say you
// are not · the honest state is always available, the silent one is not.
test.describe('no comment cites a migration that a later one has replaced (T3 S49)', () => {
  test('every migration citation names the end of its chain', async () => {
    const migDir = new URL('../../scripts/migrations/', import.meta.url)
    const definedIn = {}
    for (const f of readdirSync(migDir).filter(n => n.endsWith('.sql')).sort()) {
      const num = f.slice(0, 3)
      const txt = readFileSync(new URL(f, migDir), 'utf8')
      const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(/gi
      let m
      while ((m = re.exec(txt))) {
        const fn = m[1].toLowerCase()
        definedIn[fn] ??= []
        if (!definedIn[fn].includes(num)) definedIn[fn].push(num)
      }
    }
    const moved = Object.keys(definedIn).filter(fn => definedIn[fn].length > 1)
    const endOfChain = Object.fromEntries(moved.map(fn => [fn, definedIn[fn].at(-1)]))

    // ── COUNTERWEIGHTS FIRST (Rule 90), because every one of them fails toward GREEN ────────────────
    // This gate's whole output is a list that should be empty, so anything that stops it looking reports
    // perfect health. Three ways that happens, each asserted before the finding: the SQL parser matching
    // nothing, the corpus being empty, and the citation regex matching nothing. The third is the one that
    // bit T2's dead-surface script and my own S48 measurement · a gate auditing zero lines is not a gate.
    expect(Object.keys(definedIn).length, 'no functions parsed out of scripts/migrations · the CREATE ' +
      'FUNCTION regex has drifted and this gate is auditing nothing').toBeGreaterThan(10)
    expect(moved.length, 'no function is defined by more than one migration · either the chain-builder ' +
      'broke or the premise of this gate has genuinely expired · check before deleting it')
      .toBeGreaterThan(0)

    // A cited number counts only if it actually DEFINES this function and is not the end of its chain.
    // definedIn holds zero-padded STRINGS ('011'), so membership is compared as strings and ORDER is
    // compared as numbers · mixing those is not a style question. My first draft wrote `.map(Number)`
    // before `.includes(c)`, which is false for every input, so every finding would have vanished and
    // `expect(stale).toEqual([])` would have gone green on a detector that had stopped detecting. The
    // gated bucket is EMPTY BY DESIGN, so an empty list is indistinguishable from a broken predicate ·
    // which is precisely the shape this whole file exists to refuse (Rule 86).
    const chainCitation = (fn, cited) => [...cited]
      .filter(c => definedIn[fn].includes(c) && Number(c) < Number(endOfChain[fn]))
      .sort()

    // COUNTERWEIGHT for exactly that, and it cannot be satisfied by the corpus being clean: drive the
    // predicate with a synthetic citation of a function's OWN first definition, which is stale by
    // construction, and one of its last, which is correct by construction.
    const probeFn = moved[0]
    expect(chainCitation(probeFn, new Set([definedIn[probeFn][0]])),
      `the chain predicate no longer flags ${probeFn} citing its own superseded definition · every ` +
      'finding below would silently be an empty list, and the gate would report perfect health')
      .toEqual([definedIn[probeFn][0]])
    expect(chainCitation(probeFn, new Set([endOfChain[probeFn]])),
      'the chain predicate flags a citation of the CURRENT end of the chain · it would condemn every ' +
      'correct comment in the repo (Rule 94a · a gate that reds on working input gets switched off)')
      .toEqual([])

    // A TOOL THAT SCANS THE REPO MUST EXCLUDE ITSELF (Rule 89's corollary), and this one proved it on its
    // FIRST RUN by condemning its own header · which names purge_e2e_test_data next to a citation of
    // migration 005 as an EXAMPLE of a false pairing. T2's dead-surface script did exactly this too, and
    // the failure is not cosmetic: the auditor's header is by nature full of the pattern it hunts, so it
    // would be permanently red and the gate would be switched off within a day. Cost of the exclusion,
    // stated rather than hidden: a genuinely stale citation written INTO this file is not caught by it.
    const SELF = 'preconditions.e2e.js'
    const files = []
    const walk = (dir, gated) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!['node_modules', 'fixtures'].includes(e.name)) walk(new URL(e.name + '/', dir), gated) }
        else if (/\.(js|jsx|mjs|cjs|md)$/.test(e.name) && e.name !== SELF) files.push({ url: new URL(e.name, dir), gated })
      }
    }
    // GATED · files I can fix today. Reddening a merge gate on someone else's file is a tripwire aimed at
    // a colleague (Rule 103b · the mistake I made in S39 and removed in S42).
    walk(new URL('../../tests/', import.meta.url), true)
    files.push({ url: new URL('../../.claude/CLAUDE.md', import.meta.url), gated: true })
    // REPORTED, NEVER GATED (T3 S50) · T1's and T2's lanes plus the shared docs. In S49 I found these,
    // listed them in a comms note, and offered to widen the scope once the lanes were clean. A comms note
    // is consumed once and then expires in silence · which is exactly how the purge hazard went quiet for
    // two sessions (Rule 108a). So the finding gets a home that runs instead: it prints on every merge
    // gate, it cannot rot, and it still cannot redden anybody else's build. Measured at the time of
    // writing: 5 here against 0 gated · and one of the 5 (src/pages/GameRoom.jsx) was in no comms note at
    // all, because a hand-written list is a hand pass wearing a different hat (Rule 89).
    walk(new URL('../../src/', import.meta.url), false)
    walk(new URL('../../docs/', import.meta.url), false)

    let citationLines = 0
    const stale = []
    const otherLanes = []
    const nearMiss = []
    for (const { url, gated } of files) {
      const rel = url.pathname.split('/NeoTopia/')[1] ?? url.pathname
      const lines = readFileSync(url, 'utf8').split('\n')
      lines.forEach((line, i) => {
        // TWO CITATION FORMS, and the second was added because THIS GATE MISSED MY OWN FIXES (T3 S49).
        // The first pass recognised only the word "migration". I then rewrote six comments into the form
        // this gate asked for · `chain 006 > 008 > 014 > 023` · and every one of them became INVISIBLE to
        // it, because none says "migration" any more. The gate went green on the exact lines it had just
        // reddened, and a green that arrives right after your fix is the one nobody re-examines. Found by
        // USING the instrument rather than by rereading it (Rule 96's corollary · range, not review).
        const isChain = /(?<!\d)\d{3}(?!\d)\s*[>\/]\s*(?<!\d)\d{3}(?!\d)/.test(line)
        if (!/\bmigrations?\b/i.test(line) && !isChain) return
        const cited = new Set(line.match(/(?<!\d)\d{3}(?!\d)/g) ?? [])
        if (!cited.size) return
        citationLines++
        const context = lines.slice(Math.max(0, i - 2), i + 3).join('\n')
        if (/MIGRATION-HISTORY/.test(context)) return
        const sameLine = moved.filter(fn => line.toLowerCase().includes(fn))
        const record = (fn, bucket) => {
          if (cited.has(endOfChain[fn])) return
          // ONLY A NUMBER THAT ACTUALLY DEFINES THIS FUNCTION IS A CHAIN CITATION (tightened T3 S50).
          // Until the scope widened to src/ + docs/ this could not be seen, because tests/ happened to
          // contain no counter-example: SECURITY_SURFACE.md:335 says draw_card_for_seat was "Fixed in
          // migration 015", and 015 never defines it · 011>014>021 does. That line is CORRECT and was
          // being reported as stale. Reported noise is not free even when nothing is gated on it · a
          // report people learn to scroll past is a report nobody reads on the day it is right (Rule 94a).
          // Third time this session that pointing an instrument somewhere new found a defect in the
          // instrument rather than in the target (Rule 96's corollary · range, not review).
          const inChain = chainCitation(fn, cited)
          if (!inChain.length) return
          bucket.push(`${rel}:${i + 1} · ${fn} cites ${inChain.join('/')} · the chain ends at ` +
            `${endOfChain[fn]} (${definedIn[fn].join('>')})`)
        }
        if (sameLine.length) { for (const fn of sameLine) record(fn, gated ? stale : otherLanes); return }
        // near-miss: the subject is on a neighbouring line. Reported, never gated · see the header.
        const near = moved.filter(fn => lines.slice(Math.max(0, i - 1), i + 2).join('\n').toLowerCase().includes(fn))
        if (near.length === 1) record(near[0], nearMiss)
      })
    }

    expect(files.length, 'the corpus is empty · this gate would pass by having nothing to read')
      .toBeGreaterThan(20)
    expect(citationLines, 'not one line in the corpus cites a migration at all · the citation regex has ' +
      'drifted, and a gate auditing zero lines reports perfect health (Rule 86)').toBeGreaterThan(5)

    if (nearMiss.length) {
      console.log(`[preconditions] migration citations · ${nearMiss.length} NEAR-MISS (subject on an ` +
        `adjacent line · reported, not gated):\n  ${nearMiss.join('\n  ')}`)
    }
    if (otherLanes.length) {
      console.log(`[preconditions] migration citations · ${otherLanes.length} STALE IN src/ + docs/ ` +
        '(T1 and T2 own these · REPORTED, deliberately not gated · T3 will widen the gate to cover them ' +
        `in one line the day they are clean):\n  ${otherLanes.join('\n  ')}`)
    }
    expect(stale, `${stale.length} comment(s) cite a migration that a later one replaced:\n  ` +
      `${stale.join('\n  ')}\n\nDO NOT simply swap the number. The newest migration file is not necessarily ` +
      'the DEPLOYED body · some committed migrations are not applied · and only the live database can say ' +
      'which one is running: pg_get_functiondef, not a file (Rule 109a). Name the CHAIN, or mark the line ' +
      'MIGRATION-HISTORY if it means an older migration deliberately.\n\n(This message used to name WHICH ' +
      'migrations were unapplied. That is applied-state in a comment · a world fact that changes with no ' +
      'commit here · and it went stale inside a single session in S49, in the very file whose subject is ' +
      'that mistake. Removed T3 S50.)').toEqual([])

    console.log(`[preconditions] migration citations · ${citationLines} cited lines across ${files.length} ` +
      `files · ${moved.length} functions have moved · ${stale.length} stale in the gated scope`)
  })
})

// ── THE HARNESS MUST BE ABLE TO SIGN IN (T3 S51) ─────────────────────────────────────────────────────
// A CONTRACT THAT SPANS TWO LANES HAS NO OWNER, AND THAT IS WHERE THE COMPOSED BUG LIVES (Rule 65/103).
//
// purge_e2e_test_data identifies harness rows BY USERNAME PREFIX ('E2E%', 'BotAlpha%', 'BotBeta%') · every
// statement in migrations 023/025/026 selects on it. T2 is adding src/lib/reservedNames.js, which REFUSES
// a claim on those same prefixes · correctly, because a real player typing "E2Etest" was landing inside
// the purge's scope and losing their game (I reported that in S50; their header states the case better
// than mine did). Both halves are right. Composed, the property that makes a row SWEEPABLE is the property
// that makes it UNCLAIMABLE, and the live suite claims its names through the real UI.
//
// Measured with a control on the same commit and the same server: "E2EPROBE12345" is refused and stays on
// the claim screen; "Probe32039" reaches /lobby with Create Room visible. 9 specs claim a reserved name
// through the UI and two of them · game-ux and reconnect · are on the MERGE GATE, not the nightly.
//
// NEITHER LANE'S OWN TESTS CAN SEE THIS. reservedNames.test.js guards the migration↔module drift, which is
// the contract its author was thinking about. Mine guarded the workflow↔spec contract. The one that breaks
// is harness↔product, and nothing was watching it because it belongs to neither of us.
//
// ⚠ THIS GUARD IS ARMED, NOT ASSERTING, WHILE THE MODULE IS ABSENT. It was written while reservedNames.js
// was still UNCOMMITTED in the shared tree (Rule 66 · a cross-lane dependency may already be half-built in
// your working copy), so in CI it does not exist and there is nothing to check. It reds the moment the
// module lands with the conflict unresolved. A skip is not a pass (Rule 79d), so it PRINTS which of the two
// states it is in · a silent green here would be the exact vacuity this file exists to refuse.
test.describe('the E2E harness can still claim a name (T3 S51)', () => {
  test('no fixture prefix is refused by the product own reserved-name guard', async () => {
    let reserved = null
    try { reserved = await import('../../src/lib/reservedNames.js') } catch { /* not landed yet */ }
    if (!reserved?.isReservedUsername) {
      console.log('[preconditions] harness sign-in guard · ARMED, NOT ASSERTING · src/lib/reservedNames.js ' +
        'is absent (uncommitted at the time of writing · T3 S51). This is not a pass · see ' +
        'comms/t3-s51-URGENT-reserved-names-blocks-live-suite.md')
      return
    }

    const specDir = new URL('.', import.meta.url)
    const prefixes = new Set()
    for (const f of readdirSync(specDir).filter(n => n.endsWith('.e2e.js'))) {
      const src = readFileSync(new URL(f, specDir), 'utf8')
      // Only specs that claim through the real interface are affected · a spec talking to Supabase
      // directly never meets this guard.
      if (!/runTwoHumanLobby|getByPlaceholder\(NAME_INPUT\)|enter neotopia/i.test(src)) continue
      for (const m of src.matchAll(/uniqueName\(\s*['"]([^'"]+)/g)) prefixes.add(m[1])
    }
    // COUNTERWEIGHT FIRST (Rule 90): enumerate from the CODE, and prove the enumeration found something.
    // A regex that stops matching turns this into a loop over nothing, which passes while checking nobody.
    expect(prefixes.size, 'no uniqueName() prefixes were parsed out of any UI-claiming spec · the pattern ' +
      'has drifted and this guard is auditing an empty set').toBeGreaterThan(3)

    const refused = [...prefixes].filter(p => reserved.isReservedUsername(p)).sort()
    expect(refused, `${refused.length} fixture prefix(es) are refused by isReservedUsername: ` +
      `${refused.join(', ')}. Every live spec claims its name through the real UI, so those specs cannot ` +
      'sign in at all · game-ux and reconnect are on the MERGE GATE. The purge identifies harness rows by ' +
      'exactly these prefixes, so the harness cannot simply rename off them without leaking rows into ' +
      'production forever. Resolve the contract, do not weaken the product guard: a build-time bypass ' +
      '(VITE_E2E) keeps the guard strict everywhere real and lets the harness keep the prefix the purge ' +
      'needs. See comms/t3-s51-URGENT-reserved-names-blocks-live-suite.md.').toEqual([])

    console.log(`[preconditions] harness sign-in guard · ${prefixes.size} fixture prefixes, 0 refused`)
  })
})
