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
 * USAGE
 *   node scripts/verify-pool-signin.cjs           # asserts the grant succeeds
 *   node scripts/verify-pool-signin.cjs --negative  # asserts a WRONG password is REJECTED
 *
 * The --negative mode is the two-sided half and it needs no secret to be meaningful: it proves the
 * script can actually fail, against the real endpoint, rather than being a function that returns OK.
 * Run both, or the positive result is a claim with no control (Rule 120).
 *
 * ENV   E2E_POOL_EMAIL · E2E_POOL_PASSWORD (GitHub repo secrets) + VITE_SUPABASE_URL / ANON_KEY
 * EXIT  0 proven · 1 the pool did NOT authenticate · 2 UNMEASURED (missing configuration)
 */

const fs = require('fs')
const path = require('path')

const NEGATIVE = process.argv.includes('--negative')
const PROCESS_START = new Date()

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

async function main() {
  // ── COUNTERWEIGHT · configuration absent must never look like success ──────────────────────────
  if (!SUPA_URL || !ANON_KEY) unmeasured('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set')
  if (!POOL_EMAIL) unmeasured('E2E_POOL_EMAIL not set · the pool credential is a GitHub repo secret')
  if (!NEGATIVE && !POOL_PASSWORD) unmeasured('E2E_POOL_PASSWORD not set')

  // The password grant. This is the exact call src/hooks/useAuth.js makes through the SDK
  // (supabase.auth.signInWithPassword) · the SDK's transport is this endpoint.
  const password = NEGATIVE ? `wrong-on-purpose-${Date.now()}` : POOL_PASSWORD
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: POOL_EMAIL, password }),
  })
  const json = await res.json().catch(() => ({}))

  // ── NEGATIVE MODE · prove this script is capable of failing, against the real endpoint ─────────
  if (NEGATIVE) {
    if (res.ok) {
      fail('a deliberately WRONG password was ACCEPTED · either the endpoint is not enforcing ' +
           'credentials or this script is not asserting what it claims to assert')
    }
    console.log(`OK · negative control · wrong password rejected with HTTP ${res.status} ` +
                `(${json.error_code || json.error || 'no code'})`)
    console.log('  So a green POSITIVE run below is a measurement and not a function that returns OK.')
    return
  }

  if (!res.ok) {
    const why = json.msg || json.error_description || json.error || `HTTP ${res.status}`
    fail(`the pool credential did NOT authenticate · ${why} (HTTP ${res.status})\n` +
         `  identity: ${mask(POOL_EMAIL)}\n` +
         '  If this is 400/invalid_credentials the secret and the dashboard user disagree.\n' +
         '  If it is 400/email_not_confirmed the user exists but cannot sign in · confirm it.\n' +
         '  Until this passes, every CI browser falls back to signInAnonymously() and the identity\n' +
         '  churn this pool exists to stop is still running at full rate.')
  }

  const user = json.user || {}
  if (!json.access_token) fail(`HTTP 200 with no access_token · ${JSON.stringify(json).slice(0, 200)}`)
  if (!user.id) fail('a session was returned with no user id')

  // ── NOT THE ANONYMOUS FALLBACK ────────────────────────────────────────────────────────────────
  // An anonymous GoTrue user carries is_anonymous:true and NO email. Both are asserted because
  // either alone could be absent from a future GoTrue payload without the other changing.
  if (user.is_anonymous === true) {
    fail('the session is ANONYMOUS · this is the fallback path, not the pool. A token was obtained ' +
         'and it proves the opposite of what this script exists to prove')
  }
  if (!user.email) {
    fail('the session carries no email · an anonymous identity looks exactly like this, so the ' +
         'grant cannot be credited to the pool')
  }

  // ── REUSED, NOT MINTED · the property the whole feature is for ─────────────────────────────────
  const createdAt = user.created_at ? new Date(user.created_at) : null
  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    fail('user.created_at absent or unparseable · cannot distinguish a REUSED identity from one ' +
         'this run just minted, which is the entire point of a fixed pool')
  }
  if (createdAt >= PROCESS_START) {
    fail(`the identity was created DURING this run (${createdAt.toISOString()}) · that is a new ` +
         'user, not a reused one. Every assertion above would pass while the MAU churn continues')
  }

  const ageHours = ((PROCESS_START - createdAt) / 3_600_000).toFixed(1)
  console.log('OK · THE POOL AUTHENTICATES. signInWithPassword has now completed against this project.')
  console.log(`  identity     ${mask(user.email)}`)
  console.log(`  anonymous    ${user.is_anonymous === true ? 'YES (BUG)' : 'no'}`)
  console.log(`  pre-existing yes · created ${ageHours}h before this run, so it was REUSED not minted`)
  console.log(`  last sign-in ${user.last_sign_in_at || '(first ever · this run)'}`)
  console.log('')
  console.log('  SCOPE, stated so a green run is not over-read: this proves the CREDENTIAL grants a')
  console.log('  session. It does NOT prove src/hooks/useAuth.js picks it up in a browser · that')
  console.log('  needs the per-context allocator (comms/t2-s57-pool-contract.md, T3\'s half) and is')
  console.log('  a separate claim with a separate proof.')
}

main().catch((e) => fail(`${e.message}`))
