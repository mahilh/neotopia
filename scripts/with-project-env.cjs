#!/usr/bin/env node
/**
 * NeoTopia · project-env guard (T2 S26)
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs a command with THIS repo's Supabase config, never a neighbouring project's.
 *
 * THE BUG THIS EXISTS FOR
 *   ~/.zshrc on the author's machine exports VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY for a
 *   DIFFERENT Supabase project (AetherMind). Vite gives process.env precedence over .env.local, so
 *   a plain `npm run build` in NeoTopia inlines the WRONG project's URL + anon key into the bundle.
 *   Verified by controlled builds: with the shell env as-is the bundle carries ref=gsogycwtllthrenqaxlh;
 *   with those vars unset it carries ref=wynccumuisjxbptjlfwq, the correct project. Vercel's
 *   production builds use Vercel's own env and were never affected · this is a LOCAL hazard, but a
 *   nasty one: the app silently talks to a paused database and every symptom looks like an outage.
 *
 * WHAT IT DOES
 *   If this repo has a .env.local, any INHERITED VITE_* var that .env.local also defines is deleted
 *   from the child's environment, so Vite falls back to the file · the project's own truth wins.
 *
 * WHY IT IS SAFE IN CI (the trap a naive `env -u` walks into)
 *   CI ships NO .env.local and legitimately passes these as repo secrets. With no .env.local this
 *   guard strips NOTHING and execs the command unchanged. It only ever removes a var that the repo
 *   itself defines, so it can never blank out a value that has no local replacement.
 *
 * USAGE  ·  node scripts/with-project-env.cjs <command> [...args]
 *   wired into package.json: "dev" and "build".
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const argv = process.argv.slice(2)
if (argv.length === 0) {
  console.error('with-project-env: expected a command to run, e.g. `node scripts/with-project-env.cjs vite build`')
  process.exit(2)
}

const envPath = path.join(__dirname, '..', '.env.local')
const env = { ...process.env }
const stripped = []

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, name, rawValue] = m
    const fileValue = rawValue.replace(/^["']|["']$/g, '')
    // Only strip when the shell is actually SHADOWING with a different value. An inherited var that
    // already agrees with .env.local is not a bug, and removing it would be noise.
    if (env[name] !== undefined && env[name] !== fileValue) {
      delete env[name]
      stripped.push(name)
    }
  }
}

if (stripped.length) {
  console.warn(
    `⚠️  with-project-env · ignoring inherited ${stripped.join(', ')} · your shell exports a value ` +
    `that disagrees with this repo's .env.local. Using .env.local (NeoTopia's own project).`)
}

// shell:true so this works with npm-installed binaries (vite) on macOS and Linux alike.
const child = spawn(argv[0], argv.slice(1), { stdio: 'inherit', env, shell: true })
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0))
child.on('error', (err) => {
  console.error(`with-project-env: failed to launch "${argv.join(' ')}" · ${err.message}`)
  process.exit(1)
})
