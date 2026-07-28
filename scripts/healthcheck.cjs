#!/usr/bin/env node
/**
 * NeoTopia · synthetic production health check (T2 S26 · Task 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS · the measured blind spot
 *
 * On 2026-07-28 Vercel reported ZERO runtime errors for 7 straight days while the game was
 * unplayable in production. That number was never a health signal: api/ is EMPTY, NeoTopia ships
 * zero serverless functions, so Vercel observes nothing but static asset delivery. "0 runtime
 * errors" is structurally guaranteed here and would stay 0 if Supabase vanished entirely.
 *
 * Detection did in fact exist · .github/workflows/bot-health.yml drove production daily and
 * reported FAIL ("start-failed": 3, proxy=0) every single morning. Nobody acted, because that job
 * had been red for 32 consecutive runs since 2026-06-27. A check that is always red carries no
 * information (Rule 49 · a signal that never moves is not measuring the thing you think it is).
 *
 * So this is deliberately NOT another browser bot. It is the opposite: small, fast, dependency-free
 * and boringly reliable, so that RED ACTUALLY MEANS SOMETHING. It walks the real user critical path
 * over plain HTTP · including a genuine anonymous sign-in against Supabase Auth, the exact hop
 * Vercel can never see · and every stage reports its HTTP status as the witness (Rule 39).
 *
 * Stage 5 (profile upsert) is the precise call that returned 409 and bricked the lobby for a week.
 * This check would have caught that on the first run.
 *
 * USAGE
 *   node scripts/healthcheck.cjs              # human-readable, exits non-zero if unhealthy
 *   node scripts/healthcheck.cjs --json       # machine-readable single JSON object
 *   node scripts/healthcheck.cjs --no-write   # read-only stages only (no room/profile writes)
 *
 * ENV (falls back to .env.local for local runs · CI supplies them as secrets)
 *   VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY · optional HEALTH_URL (default prod)
 *
 * EXIT CODES · 0 healthy · 1 unhealthy (a critical stage failed) · 2 misconfigured (missing env)
 *
 * SECRET DISCIPLINE · never prints a key, a JWT, or a user id. Tokens are used, never logged.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const PROD_URL = process.env.HEALTH_URL || 'https://neotopia.vercel.app'
const JSON_OUT = process.argv.includes('--json')
const NO_WRITE = process.argv.includes('--no-write')
const STAGE_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 15000)

// The Supabase project this repo is allowed to talk to. Hard-coded on purpose: it is public
// (it ships in the client bundle) and it is the only way a project-scoped tool can NOTICE that it
// has been pointed somewhere else.
const EXPECTED_PROJECT_REF = 'wynccumuisjxbptjlfwq'

// ── env ───────────────────────────────────────────────────────────────────────
// PRECEDENCE IS DELIBERATE · the repo's own .env.local WINS over the ambient shell environment.
//
// This is not a style choice, it is a bug fix. ~/.zshrc on the author's machine exports a GLOBAL
// VITE_SUPABASE_URL pointing at a DIFFERENT (and paused) Supabase project. Any tool that read
// process.env first would silently aim at the wrong database and fail with a bare "ENOTFOUND",
// which reads like "production is down" when nothing is down at all. A project-scoped script must
// take the project's own config as truth. CI ships no .env.local, so there process.env is used ·
// which is exactly right.
function loadEnv() {
  const fromFile = {}
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!m) continue
      fromFile[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  const url = fromFile.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = fromFile.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const shadowed = Boolean(
    process.env.VITE_SUPABASE_URL &&
    fromFile.VITE_SUPABASE_URL &&
    process.env.VITE_SUPABASE_URL !== fromFile.VITE_SUPABASE_URL)
  return { url, key, shadowed, shellUrl: process.env.VITE_SUPABASE_URL }
}

// ── stage runner ──────────────────────────────────────────────────────────────
const results = []

async function stage(name, critical, fn) {
  const started = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), STAGE_TIMEOUT_MS)
  try {
    const detail = await fn(ac.signal)
    const r = { stage: name, ok: true, critical, ms: Date.now() - started, ...detail }
    results.push(r)
    return r
  } catch (err) {
    // Node's fetch collapses every transport failure into the useless string "fetch failed" and
    // hides the real reason (DNS, TLS, ECONNREFUSED, egress block) on err.cause. Unwrapping it is
    // the whole point of this tool: an alarm that cannot say WHY is the alarm we already had.
    const cause = err?.cause
    const causeText = cause ? ` · ${cause.code || cause.message || cause}` : ''
    const r = {
      stage: name,
      ok: false,
      critical,
      ms: Date.now() - started,
      status: err.status ?? null,
      error: err.name === 'AbortError'
        ? `timeout after ${STAGE_TIMEOUT_MS}ms`
        : String(err.message || err) + causeText,
    }
    results.push(r)
    return r
  } finally {
    clearTimeout(timer)
  }
}

function fail(msg, status) {
  const e = new Error(msg)
  if (status != null) e.status = status
  return e
}

// Read the body ONCE (a Response body can only be consumed a single time) and hand back both the
// parsed JSON and the raw text, so a caller can report a non-JSON error page without re-reading.
async function req(url, opts = {}, signal) {
  const res = await fetch(url, { ...opts, signal })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON body is fine */ }
  return { res, text, json, status: res.status }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { url: SUPA_URL, key: ANON_KEY, shadowed, shellUrl } = loadEnv()
  if (!SUPA_URL || !ANON_KEY) {
    const msg = 'MISCONFIGURED · VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required (env or .env.local)'
    if (JSON_OUT) console.log(JSON.stringify({ healthy: false, misconfigured: true, error: msg }, null, 2))
    else console.error(msg)
    process.exit(2)
  }

  // Aiming at the wrong project is a CONFIG fault, not an outage. Say so in those words, because
  // the failure it produces downstream (DNS ENOTFOUND on a paused project) is otherwise
  // indistinguishable from "Supabase is down" and sends you debugging the wrong system entirely.
  if (!SUPA_URL.includes(EXPECTED_PROJECT_REF)) {
    const msg = `MISCONFIGURED · this repo targets Supabase project ${EXPECTED_PROJECT_REF}, but the ` +
      `resolved URL points elsewhere. This is a configuration fault, NOT a production outage.`
    if (JSON_OUT) console.log(JSON.stringify({ healthy: false, misconfigured: true, error: msg }, null, 2))
    else console.error(msg)
    process.exit(2)
  }

  // Non-fatal, but worth saying out loud: the shell is trying to override the project's own config.
  if (shadowed && !JSON_OUT) {
    console.warn(`⚠️  NOTE · your shell exports a different VITE_SUPABASE_URL (${shellUrl}) than ` +
      `.env.local. Using .env.local. Local \`npm run build\` does NOT apply this precedence and will ` +
      `bake the shell's value into the bundle.`)
  }

  const anonHeaders = { apikey: ANON_KEY, 'Content-Type': 'application/json' }
  let accessToken = null
  let userId = null
  let roomId = null

  // 1 · the app itself is served. Static delivery is all Vercel can actually observe, so this is
  //     the ONLY stage a Vercel-side signal overlaps with. It passing means very little on its own.
  await stage('app_reachable', true, async (signal) => {
    const { res, text, status } = await req(PROD_URL, { redirect: 'follow' }, signal)
    if (!res.ok) throw fail(`GET ${PROD_URL} returned ${status}`, status)
    if (!/<div id="root"|<script/i.test(text)) throw fail('response was 200 but carried no app shell', status)
    return { status, bytes: text.length }
  })

  // 2 · the built JS bundle resolves. Catches a broken/partial deploy that still serves index.html.
  await stage('bundle_loads', true, async (signal) => {
    const { text } = await req(PROD_URL, { redirect: 'follow' }, signal)
    const m = text.match(/<script[^>]+src="([^"]+\.js)"/i)
    if (!m) throw fail('no <script src="*.js"> found in the served HTML')
    const assetUrl = new URL(m[1], PROD_URL).toString()
    const { res, text: js, status } = await req(assetUrl, {}, signal)
    if (!res.ok) throw fail(`bundle ${m[1]} returned ${status}`, status)
    if (js.length < 1000) throw fail(`bundle ${m[1]} was suspiciously small (${js.length} bytes)`, status)
    return { status, asset: m[1], bytes: js.length }
  })

  // 3 · Supabase PostgREST answers. Distinguishes "Supabase is down / project paused" from
  //     "our schema or policies are wrong", which stages 5-6 cover.
  await stage('supabase_rest', true, async (signal) => {
    const { res, status } = await req(
      `${SUPA_URL}/rest/v1/game_rooms?select=id&limit=1`, { headers: anonHeaders }, signal)
    if (!res.ok) throw fail(`PostgREST returned ${status}`, status)
    return { status }
  })

  // 4 · THE HOP VERCEL CANNOT SEE · a real anonymous sign-in. Every NeoTopia player starts here
  //     (src/hooks/useAuth.js:44 signInAnonymously). If anon sign-ups get disabled, hit their
  //     per-IP cap, or GoTrue degrades, the entire game is unplayable and Vercel still reports 0.
  await stage('supabase_auth_anon_signin', true, async (signal) => {
    const { res, json, status } = await req(`${SUPA_URL}/auth/v1/signup`, {
      method: 'POST', headers: anonHeaders, body: JSON.stringify({}),
    }, signal)
    if (!res.ok) {
      const why = json?.msg || json?.error_description || json?.error || `HTTP ${status}`
      throw fail(`anonymous sign-in failed · ${why}`, status)
    }
    accessToken = json?.access_token
    userId = json?.user?.id
    if (!accessToken) throw fail('sign-in returned 200 but no access_token', status)
    return { status, gotSession: true }
  })

  const authed = () => ({ ...anonHeaders, Authorization: `Bearer ${accessToken}` })

  // 5 · THE REGRESSION THIS WAS BUILT FOR · claiming a username. This exact upsert returned 409
  //     against UNIQUE(username) and bricked the lobby for a week with Vercel reporting 0 errors.
  //     Migration 012 dropped that constraint; this stage is the standing guard that it stays gone.
  if (!NO_WRITE && accessToken) {
    await stage('profile_upsert', true, async (signal) => {
      const username = `hc_${crypto.randomBytes(4).toString('hex')}`
      const { res, json, status } = await req(
        `${SUPA_URL}/rest/v1/player_profiles?on_conflict=user_id`,
        {
          method: 'POST',
          headers: { ...authed(), Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({ user_id: userId, username }),
        }, signal)
      if (!res.ok) {
        const why = json?.message || `HTTP ${status}`
        throw fail(`username claim failed · ${why}${status === 409 ? ' · THE S24 LOBBY-BRICKING 409 IS BACK' : ''}`, status)
      }
      return { status }
    })

    // 6 · room creation · the actual entry point to every multiplayer game, and the write path
    //     T2 S26 Task 1 rate-limits. One room per run is well inside any sane limit.
    await stage('room_create', true, async (signal) => {
      const roomCode = `HC${crypto.randomBytes(2).toString('hex').toUpperCase()}`
      const { res, json, status } = await req(
        `${SUPA_URL}/rest/v1/game_rooms`,
        {
          method: 'POST',
          headers: { ...authed(), Prefer: 'return=representation' },
          body: JSON.stringify({ room_code: roomCode, host_id: userId, status: 'waiting' }),
        }, signal)
      if (!res.ok) {
        const why = json?.message || `HTTP ${status}`
        throw fail(`room creation failed · ${why}`, status)
      }
      roomId = Array.isArray(json) ? json[0]?.id : json?.id
      return { status, roomCode }
    })

    // 7 · leave production as we found it. Non-critical: a leaked health room is untidy, not an
    //     outage, and failing the whole check on cleanup would manufacture exactly the kind of
    //     chronic false red that made bot-health.yml unreadable.
    await stage('cleanup', false, async (signal) => {
      if (!roomId) return { skipped: 'no room created' }
      // rooms_delete_host RLS requires status='finished', so flip it first (rooms_update_host).
      await req(`${SUPA_URL}/rest/v1/game_rooms?id=eq.${roomId}`, {
        method: 'PATCH', headers: authed(), body: JSON.stringify({ status: 'finished' }),
      }, signal)
      const { status } = await req(`${SUPA_URL}/rest/v1/game_rooms?id=eq.${roomId}`, {
        method: 'DELETE', headers: authed(),
      }, signal)
      await req(`${SUPA_URL}/rest/v1/player_profiles?user_id=eq.${userId}`, {
        method: 'DELETE', headers: authed(),
      }, signal)
      return { status }
    })
  }

  // ── verdict ─────────────────────────────────────────────────────────────────
  const criticalFailures = results.filter(r => r.critical && !r.ok)
  const healthy = criticalFailures.length === 0
  const payload = {
    healthy,
    checkedAt: new Date().toISOString(),
    target: PROD_URL,
    totalMs: results.reduce((s, r) => s + r.ms, 0),
    stages: results,
    failedStages: criticalFailures.map(r => r.stage),
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log(`\nNeoTopia health check · ${PROD_URL}`)
    console.log('─'.repeat(72))
    for (const r of results) {
      const mark = r.ok ? '✅' : (r.critical ? '❌' : '⚠️ ')
      const status = r.status != null ? ` [${r.status}]` : ''
      console.log(`${mark} ${r.stage.padEnd(28)} ${String(r.ms + 'ms').padStart(7)}${status}${r.error ? ' · ' + r.error : ''}`)
    }
    console.log('─'.repeat(72))
    console.log(healthy
      ? `✅ HEALTHY · every critical stage passed (${payload.totalMs}ms total)`
      : `❌ UNHEALTHY · failed: ${payload.failedStages.join(', ')}`)
  }

  process.exit(healthy ? 0 : 1)
}

main().catch(err => {
  const msg = `health check crashed · ${err?.stack || err}`
  if (JSON_OUT) console.log(JSON.stringify({ healthy: false, crashed: true, error: String(err?.message || err) }, null, 2))
  else console.error(msg)
  process.exit(1)
})
