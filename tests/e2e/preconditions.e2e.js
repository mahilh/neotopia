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
// demands is that the file SAY SO: either a workflow runs it, or its header declares the RUNS-NOWHERE
// marker (name + colon) with a reason. The honest state is always available; the silent one is not.
// ⚠ THE COLON IS OMITTED FROM THIS PROSE ON PURPOSE (T3 S49). The escape hatch is a plain substring, so a
// sentence ABOUT the marker satisfies it · this file and postgres-writeorder both did, and a spec could
// therefore be un-wired and still read as declared, purely because its header discusses the mechanism.
// Same class as the self-scan defect below: an instrument matching text that describes the instrument.
import { readdirSync, readFileSync } from 'node:fs'

test.describe('every E2E spec names the workflow that runs it, or says it runs nowhere (T3 S43)', () => {
  test('no spec is silently orphaned', async () => {
    const specDir = new URL('.', import.meta.url)
    const wfDir = new URL('../../.github/workflows/', import.meta.url)

    const specs = readdirSync(specDir).filter(f => f.endsWith('.e2e.js'))
    const workflows = readdirSync(wfDir).filter(f => /\.ya?ml$/.test(f))
    // COUNTERWEIGHT FIRST (Rule 90): if either list came back empty, every spec below would read as
    // "wired" or the loop would not run at all, and this gate would pass while auditing nothing. That is
    // the exact shape of the thing it was built to catch, one level up.
    expect(specs.length, 'no E2E specs were found · this gate is auditing an empty set').toBeGreaterThan(10)
    expect(workflows.length, 'no workflow files were found · every spec would look orphaned, or none would')
      .toBeGreaterThan(0)

    const wfText = workflows.map(w => readFileSync(new URL(w, wfDir), 'utf8')).join('\n')
    const orphans = []
    for (const spec of specs) {
      if (wfText.includes(spec)) continue
      const header = readFileSync(new URL(spec, specDir), 'utf8').slice(0, 4000)
      if (/RUNS-NOWHERE:/.test(header)) continue
      orphans.push(spec)
    }

    expect(orphans, `${orphans.length} E2E spec(s) are in no workflow and do not say so: ` +
      `${orphans.join(', ')}. A spec that runs nowhere cannot report its own rot · it decays silently and ` +
      'in the direction of a lie (Rule 79), and any comment citing it as proof is a claim rather than ' +
      'evidence (Rule 97). Either wire it, or put a line in its header starting RUNS-NOWHERE: saying why ' +
      'and who owns wiring it.').toEqual([])

    console.log(`[preconditions] spec-runner audit · ${specs.length} specs across ${workflows.length} ` +
      'workflows · 0 silent orphans')
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

    // A TOOL THAT SCANS THE REPO MUST EXCLUDE ITSELF (Rule 89's corollary), and this one proved it on its
    // FIRST RUN by condemning its own header · which names purge_e2e_test_data next to a citation of
    // migration 005 as an EXAMPLE of a false pairing. T2's dead-surface script did exactly this too, and
    // the failure is not cosmetic: the auditor's header is by nature full of the pattern it hunts, so it
    // would be permanently red and the gate would be switched off within a day. Cost of the exclusion,
    // stated rather than hidden: a genuinely stale citation written INTO this file is not caught by it.
    const SELF = 'preconditions.e2e.js'
    const files = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!['node_modules', 'fixtures'].includes(e.name)) walk(new URL(e.name + '/', dir)) }
        else if (/\.(js|jsx|mjs|cjs|md)$/.test(e.name) && e.name !== SELF) files.push(new URL(e.name, dir))
      }
    }
    walk(new URL('../../tests/', import.meta.url))
    files.push(new URL('../../.claude/CLAUDE.md', import.meta.url))

    let citationLines = 0
    const stale = []
    const nearMiss = []
    for (const url of files) {
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
          bucket.push(`${rel}:${i + 1} · ${fn} cites ${[...cited].sort().join('/')} · the chain ends at ` +
            `${endOfChain[fn]} (${definedIn[fn].join('>')})`)
        }
        if (sameLine.length) { for (const fn of sameLine) record(fn, stale); return }
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
    expect(stale, `${stale.length} comment(s) cite a migration that a later one replaced:\n  ` +
      `${stale.join('\n  ')}\n\nDO NOT simply swap the number. The newest migration is not necessarily the ` +
      'DEPLOYED one (014 and 023 are committed and unapplied right now), and only the live database can ' +
      'say which body is running · pg_get_functiondef, not a file (Rule 109a). Name the CHAIN, or mark ' +
      'the line MIGRATION-HISTORY if it means an older migration deliberately.').toEqual([])

    console.log(`[preconditions] migration citations · ${citationLines} cited lines across ${files.length} ` +
      `files · ${moved.length} functions have moved · 0 stale`)
  })
})
