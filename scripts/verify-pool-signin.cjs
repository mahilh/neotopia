#!/usr/bin/env node
/**
 * NeoTopia · does the fixed CI identity pool ACTUALLY AUTHENTICATE?  (T2 S58)
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS, IN THE WORDS THAT EARNED IT
 *
 * S57 shipped the pool's app half and closed with the honest gap: "I proved the pool branch CANNOT
 * LEAK and never proved it WORKS · a rigorous safety proof and zero evidence of function, which is
 * the more flattering half to have done." No `signInWithPassword` had ever completed against this
 * project, because no non-anonymous user existed. One now does, created by hand (no service-role
 * key · see docs/TEST_IDENTITY_DESIGN.md for the exact steps).
 *
 * So this script answers exactly one question and refuses to imply any other: CAN THE SEEDED
 * CREDENTIAL OBTAIN A SESSION. It does NOT prove the app's useAuth branch picks it up (that needs a
 * browser and the harness allocator, which is T3's half) and it says so rather than letting a green
 * run be read as end-to-end.
 *
 * ── THE ASSERTION THAT CARRIES THE FILE ─────────────────────────────────────────────────────────
 * "We obtained a session" IS SATISFIABLE BY THE FAILURE MODE. useAuth.js falls through to
 * signInAnonymously() when the pool grant fails · deliberately, so a developer's `npm run dev` is
 * unaffected · so a token in hand proves nothing on its own. The load-bearing checks are therefore
 * the ones that separate a POOL session from an ANONYMOUS one:
 *
 *     user.email present + is_anonymous not true   ->  this is not the anonymous fallback
 *     user.created_at strictly BEFORE this process ->  the identity was REUSED, not minted
 *
 * The second is the one the whole feature is for. The defect being fixed is 449 new identities a day
 * against a metered MAU cap; a run that silently created a fresh user would satisfy every other
 * assertion here and fix nothing (Rule 110 · assert the thing's DEFINING property, which is the one
 * you never think to name because it is true by construction · until it isn't).
 *
 * ── COUNTERWEIGHT, WRITTEN FIRST (Rule 90) ──────────────────────────────────────────────────────
 * The vacuous version of this script skips when the secrets are absent and exits 0. That is green
 * forever, on every machine, and would be indistinguishable from a passing proof · the precise
 * shape of Rule 79d (a skip is not a pass) and Rule 80 (never resolve an unmeasured thing to a
 * plausible value). So a missing credential exits 2 and prints UNMEASURED in terms.
 *
 * ── SECRET DISCIPLINE ───────────────────────────────────────────────────────────────────────────
 * Never prints the password, the access token, or the refresh token. The email is printed MASKED
 * even though it is a .test address, because the habit is what protects the next credential.
 *
 * ── T2 S59 · --all, AND THE DEFECT IT FOUND ON ITS FIRST RUN ────────────────────────────────────
 * Checking ONE member was correct when the pool was one user. The Council made it four, and a
 * one-member check cannot see the failure that then becomes possible: a member that EXISTS in
 * Supabase and is UNREACHABLE from the harness. That is not hypothetical · it is the live state.
 * Measured with `gh secret list` (names only) against tests/e2e/seedHelpers.js:80:
 *
 *     member   the harness asks for       the repo actually has        resolves?
 *     0        E2E_POOL_EMAIL             E2E_POOL_EMAIL               yes
 *     1        E2E_POOL_EMAIL_1           E2E_POOL_JOINER_EMAIL        NO
 *     2        E2E_POOL_EMAIL_2           E2E_POOL_P3_EMAIL            NO
 *     3        E2E_POOL_EMAIL_3           E2E_POOL_P4_EMAIL            NO
 *
 * Four users were created and paid for; three of them are invisible to the code that would use
 * them. `poolCredential(1)` returns null, `signInPooledOrAnon` falls back, and the ONLY symptom is
 * one line of console in a Playwright log. Every spec still passes. The identity churn continues at
 * 3/4 of full rate on exactly the specs that cost the most (10 drive two contexts, four-player-live
 * drives four). This is the silent-fallback class the whole session is about, and it was sitting
 * between two correct halves in two different lanes · the shape Rule 115 names: a contract that
 * spans two lanes has no owner, and each lane's tests guard the contract that lane was thinking of.
 *
 * The workflow now maps the alias secrets onto the names the harness reads, so nothing has to be
 * renamed and no lane has to be crossed · and this script asserts the result instead of trusting it.
 *
 * USAGE
 *   node scripts/verify-pool-signin.cjs           # member 0 · asserts the grant succeeds
 *   node scripts/verify-pool-signin.cjs --negative  # asserts a WRONG password is REJECTED
 *   node scripts/verify-pool-signin.cjs --all       # EVERY member the harness can ask for
 *
 * The --negative mode is the two-sided half and it needs no secret to be meaningful: it proves the
 * script can actually fail, against the real endpoint, rather than being a function that returns OK.
 * Run both, or the positive result is a claim with no control (Rule 120).
 *
 * ENV   E2E_POOL_EMAIL · E2E_POOL_PASSWORD (+ _1.._3 under --all) · VITE_SUPABASE_URL / ANON_KEY
 * EXIT  0 proven · 1 the pool did NOT authenticate · 2 UNMEASURED (missing configuration)
 */

const fs = require('fs')
const path = require('path')

const NEGATIVE = process.argv.includes('--negative')
const ALL = process.argv.includes('--all')
const PROCESS_START = new Date()

// How many members the harness may ask for. Not a guess: tests/e2e/seedHelpers.js:71-79 states it in
// terms · "10 specs drive TWO browser contexts at once, four-player-live needs FOUR" · and Council
// Decision 2 created exactly four users on the strength of that count.
const POOL_SIZE = 4

// ── THE NAME THE HARNESS READS · MIRRORED HERE, AND GUARDED AGAINST DRIFT ────────────────────────
// This is a second contract (Rule 45): the authoritative version is poolCredential() in T3's lane and
// this script cannot import it (that file is ESM and reads a JSON fixture at module level; this is a
// .cjs that must run before `npm ci`). So the rule is restated and then CHECKED against the real
// source, exactly as reservedNames.test.js parses the SQL rather than trusting a copy of it. If T3
// changes the convention this reports UNMEASURED and names the file, instead of confidently checking
// names nothing reads · which is the failure it was written to find, one level up.
const harnessEnv = (kind, index) => `E2E_POOL_${kind}${index === 0 ? '' : `_${index}`}`

function conventionAgrees() {
  const p = path.join(__dirname, '..', 'tests', 'e2e', 'seedHelpers.js')
  let src
  try { src = fs.readFileSync(p, 'utf8') } catch { return { ok: false, why: `cannot read ${p}` } }
  const hasTemplate = src.includes('E2E_POOL_EMAIL${suffix}') && src.includes('E2E_POOL_PASSWORD${suffix}')
  const hasSuffixRule = /index\s*===\s*0\s*\?\s*''\s*:\s*`_\$\{index\}`/.test(src)
  if (!hasTemplate || !hasSuffixRule) {
    return { ok: false, why: 'tests/e2e/seedHelpers.js no longer builds its env names as ' +
      '`E2E_POOL_EMAIL${suffix}` with suffix `_${index}` · the convention this script checks is ' +
      'stale, so a green run here would say nothing about what the harness can actually read' }
  }
  return { ok: true }
}

// Diagnostic only · improves the message, never decides the verdict. Measured with `gh secret list`
// on 2026-08-12; if Mahil renames one, the worst case is a less helpful sentence.
const KNOWN_ALIASES = { 1: 'JOINER', 2: 'P3', 3: 'P4' }

// ── env · repo .env.local WINS over the ambient shell, which exports another project's Supabase
//    creds on this machine and has silently pointed local runs at a dead host before.
function loadEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(p)) return {}
  const out = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}
const fileEnv = loadEnvLocal()
const envOf = (k) => fileEnv[k] || process.env[k] || ''

const SUPA_URL = envOf('VITE_SUPABASE_URL').replace(/\/$/, '')
const ANON_KEY = envOf('VITE_SUPABASE_ANON_KEY')
const POOL_EMAIL = (process.env.E2E_POOL_EMAIL || '').trim()
const POOL_PASSWORD = process.env.E2E_POOL_PASSWORD || ''

const mask = (email) => {
  if (!email) return '(none)'
  const [local, domain] = email.split('@')
  return `${local.slice(0, 3)}${'*'.repeat(Math.max(0, local.length - 3))}@${domain || '?'}`
}

const fail = (msg) => { console.error(`FAIL · ${msg}`); process.exit(1) }
const unmeasured = (msg) => {
  console.error(`UNMEASURED · ${msg}`)
  console.error('  This is NOT a pass. The pool question stays open and exits 2 so no reader, and')
  console.error('  no workflow step, can mistake a missing credential for a working one.')
  process.exit(2)
}

// Grant a session and judge it. Returns a verdict rather than exiting, so --all can report EVERY
// member instead of dying on the first one · a run that stops at member 1 cannot tell you whether 2
// and 3 are configured, which is precisely the question.
async function grant(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

function judge(res, json, email) {
  if (!res.ok) {
    const why = json.msg || json.error_description || json.error || `HTTP ${res.status}`
    return { ok: false, why: `did NOT authenticate · ${why} (HTTP ${res.status}) · ${mask(email)}\n` +
      '    400/invalid_credentials  the secret and the dashboard user disagree.\n' +
      '    400/email_not_confirmed  the user exists but cannot sign in · tick Auto Confirm.' }
  }
  const user = json.user || {}
  if (!json.access_token) return { ok: false, why: `HTTP 200 with no access_token · ${JSON.stringify(json).slice(0, 160)}` }
  if (!user.id) return { ok: false, why: 'a session was returned with no user id' }

  // ── NOT THE ANONYMOUS FALLBACK ────────────────────────────────────────────────────────────────
  // An anonymous GoTrue user carries is_anonymous:true and NO email. Both are asserted because
  // either alone could be absent from a future GoTrue payload without the other changing.
  if (user.is_anonymous === true) {
    return { ok: false, why: 'the session is ANONYMOUS · this is the fallback path, not the pool. A ' +
      'token was obtained and it proves the opposite of what this script exists to prove' }
  }
  if (!user.email) {
    return { ok: false, why: 'the session carries no email · an anonymous identity looks exactly ' +
      'like this, so the grant cannot be credited to the pool' }
  }

  // ── REUSED, NOT MINTED · the property the whole feature is for ─────────────────────────────────
  const createdAt = user.created_at ? new Date(user.created_at) : null
  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    return { ok: false, why: 'user.created_at absent or unparseable · cannot distinguish a REUSED ' +
      'identity from one this run just minted, which is the entire point of a fixed pool' }
  }
  if (createdAt >= PROCESS_START) {
    return { ok: false, why: `the identity was created DURING this run (${createdAt.toISOString()}) ` +
      '· that is a new user, not a reused one. Every assertion above would pass while the churn continues' }
  }
  return { ok: true, user, ageHours: ((PROCESS_START - createdAt) / 3_600_000).toFixed(1) }
}

async function main() {
  // ── COUNTERWEIGHT · configuration absent must never look like success ──────────────────────────
  if (!SUPA_URL || !ANON_KEY) unmeasured('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set')

  // ── NEGATIVE MODE · prove this script is capable of failing, against the real endpoint ─────────
  if (NEGATIVE) {
    if (!POOL_EMAIL) unmeasured('E2E_POOL_EMAIL not set · the pool credential is a GitHub repo secret')
    const { res, json } = await grant(POOL_EMAIL, `wrong-on-purpose-${Date.now()}`)
    if (res.ok) {
      fail('a deliberately WRONG password was ACCEPTED · either the endpoint is not enforcing ' +
           'credentials or this script is not asserting what it claims to assert')
    }
    console.log(`OK · negative control · wrong password rejected with HTTP ${res.status} ` +
                `(${json.error_code || json.error || 'no code'})`)
    console.log('  So a green POSITIVE run below is a measurement and not a function that returns OK.')
    return
  }

  // ── --all · EVERY MEMBER THE HARNESS CAN ASK FOR ──────────────────────────────────────────────
  if (ALL) {
    const drift = conventionAgrees()
    if (!drift.ok) unmeasured(drift.why)

    const rows = []
    for (let i = 0; i < POOL_SIZE; i++) {
      const eName = harnessEnv('EMAIL', i), pName = harnessEnv('PASSWORD', i)
      const email = (process.env[eName] || '').trim(), password = process.env[pName] || ''
      if (!email || !password) {
        const alias = KNOWN_ALIASES[i]
        const aliasSet = alias && (process.env[`E2E_POOL_${alias}_EMAIL`] || '').trim()
        rows.push({ i, ok: false, unreachable: true, eName,
          why: aliasSet
            ? `UNREACHABLE · a credential IS configured as E2E_POOL_${alias}_EMAIL but the harness ` +
              `reads ${eName}. The user exists and the code cannot see it · map it in the workflow.`
            : `no credential under ${eName}` })
        continue
      }
      const { res, json } = await grant(email, password)
      const v = judge(res, json, email)
      rows.push({ i, eName, ...v })
    }

    console.log(`POOL · ${POOL_SIZE} members, checked under the names the HARNESS reads (not the`)
    console.log('       names the secrets happen to have · that difference is the whole check)')
    for (const r of rows) {
      if (r.ok) {
        console.log(`  member ${r.i}  OK          ${mask(r.user.email)} · reused, created ${r.ageHours}h ago`)
      } else {
        console.log(`  member ${r.i}  ${r.unreachable ? 'UNREACHABLE' : 'FAILED     '} ${r.why}`)
      }
    }
    const good = rows.filter(r => r.ok).length
    console.log('')
    console.log(`  ${good}/${POOL_SIZE} members reachable and reused.`)
    if (good < POOL_SIZE) {
      console.log('  A member that cannot be resolved is NOT a smaller pool · it is a SILENT one.')
      console.log('  signInPooledOrAnon falls back to signInAnonymously and every spec still passes,')
      console.log('  so the only symptom is a number nobody reads on a schedule. 10 specs drive two')
      console.log('  contexts and four-player-live drives four, so members 1-3 carry most of the cost.')
      // Unreachable-because-misnamed is a MEASURED defect and reds. Simply-absent is UNMEASURED.
      const misnamed = rows.some(r => /UNREACHABLE · a credential IS configured/.test(r.why || ''))
      process.exit(misnamed ? 1 : 2)
    }
    return
  }

  // ── DEFAULT · member 0 only, unchanged ────────────────────────────────────────────────────────
  if (!POOL_EMAIL) unmeasured('E2E_POOL_EMAIL not set · the pool credential is a GitHub repo secret')
  if (!POOL_PASSWORD) unmeasured('E2E_POOL_PASSWORD not set')
  const { res, json } = await grant(POOL_EMAIL, POOL_PASSWORD)
  const v = judge(res, json, POOL_EMAIL)
  if (!v.ok) {
    fail(`${v.why}\n  Until this passes, every CI browser falls back to signInAnonymously() and the\n` +
         '  identity churn this pool exists to stop is still running at full rate.')
  }
  console.log('OK · THE POOL AUTHENTICATES. signInWithPassword has now completed against this project.')
  console.log(`  identity     ${mask(v.user.email)}`)
  console.log(`  anonymous    ${v.user.is_anonymous === true ? 'YES (BUG)' : 'no'}`)
  console.log(`  pre-existing yes · created ${v.ageHours}h before this run, so it was REUSED not minted`)
  console.log(`  last sign-in ${v.user.last_sign_in_at || '(first ever · this run)'}`)
  console.log('')
  console.log('  SCOPE, stated so a green run is not over-read: this proves the CREDENTIAL grants a')
  console.log('  session. It does NOT prove src/hooks/useAuth.js picks it up in a browser · that')
  console.log('  needs the per-context allocator (comms/t2-s57-pool-contract.md, T3\'s half) and is')
  console.log('  a separate claim with a separate proof.')
}

main().catch((e) => fail(`${e.message}`))
