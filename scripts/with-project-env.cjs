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
 * ⚠ AND THAT SAFETY ARGUMENT IS EXACTLY INVERTED IN A DETACHED WORKTREE (T2 S62 · T3 lost a run)
 *   `.env.local` is gitignored, so `git worktree add` does not carry it. The guard resolved the file
 *   from `__dirname/..`, found nothing, concluded "this must be CI" and stripped nothing · so the
 *   shell's AetherMind values survived into the child and every sign-in went to a dead project.
 *   MEASURED end to end before this fix, in a real detached worktree:
 *       worktree/.env.local           does not exist
 *       guard                          strips NOTHING
 *       child sees VITE_SUPABASE_URL   https://gsogycwtllthrenqaxlh.supabase.co   (the wrong project)
 *   CI and a worktree are BYTE-IDENTICAL to this script · both are a checkout with no .env.local ·
 *   and they need opposite behaviour. That is Rule 130: two situations producing one observable, so
 *   the path you care about cannot be distinguished. The discriminator has to come from somewhere
 *   else, and git already knows: a linked worktree's --git-common-dir points at the MAIN clone.
 *   The isolation discipline every lane now uses (Rule 82 · isolate in a worktree before believing a
 *   live failure) was in direct opposition to the env discipline, and the collision was silent.
 *
 * USAGE  ·  node scripts/with-project-env.cjs <command> [...args]
 *   wired into package.json: "dev" and "build".
 */

const fs = require('fs')
const path = require('path')
const { spawn, execFileSync } = require('child_process')

/**
 * Find this project's .env.local, following a linked worktree back to the clone that owns it.
 *
 * Returns null when there genuinely is none · which is CI, and which must remain a silent no-op:
 * that is the original safety property and it is the one thing this change may not break.
 */
function findEnvLocal(baseDir = __dirname) {
  const here = path.join(baseDir, '..', '.env.local')
  if (fs.existsSync(here)) return { file: here, via: 'this checkout' }

  // No file HERE is ambiguous · CI, or a worktree. Ask git which one, from the SCRIPT's directory
  // rather than the cwd, because the caller can be anywhere.
  for (const args of [['rev-parse', '--path-format=absolute', '--git-common-dir'],
                      ['rev-parse', '--git-common-dir']]) {
    try {
      const out = execFileSync('git', args, { cwd: baseDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (!out) continue
      // --path-format=absolute needs git 2.31+; the bare form can return a relative path, so it is
      // resolved against the script's directory rather than assumed absolute.
      const commonDir = path.isAbsolute(out) ? out : path.resolve(baseDir, '..', out)
      const file = path.join(path.dirname(commonDir), '.env.local')
      if (file !== here && fs.existsSync(file)) {
        return { file, via: `the main worktree at ${path.dirname(commonDir)}` }
      }
      break                                   // git answered · a second phrasing will not help
    } catch { /* no git, or not a checkout · fall through to the CI behaviour, which is correct */ }
  }
  return null
}

// Run only when run · requiring this file used to SPAWN A CHILD and could process.exit(2) out
// of a test runner before a single assertion. The lookup below is the part worth testing.
function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0) {
    console.error('with-project-env: expected a command to run, e.g. `node scripts/with-project-env.cjs vite build`')
    process.exit(2)
  }

  const found = findEnvLocal()
  const env = { ...process.env }
  const stripped = []

  if (found) {
    for (const line of fs.readFileSync(found.file, 'utf8').split('\n')) {
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
      `that disagrees with this repo's .env.local (${found.via}). Using .env.local (NeoTopia's own project).`)
  }

  // ── THE STATE THAT USED TO BE SILENT  (T2 S62) ─────────────────────────────────────────────────
  // No .env.local anywhere AND the shell is exporting VITE_* is the exact configuration that cost a
  // run: nothing to compare against, so nothing is stripped, so whatever the shell says wins. In CI
  // that is CORRECT and must stay quiet · the secrets are supposed to come from the environment. Off
  // CI it is the wrong-project hazard this whole file exists for, and it was indistinguishable from
  // success. It still does not FAIL · a hard error here would break any legitimate env-only local run
  // · but it can no longer happen without saying so (Rule 80 · never let "I could not check" resolve
  // to a plausible value).
  if (!found && !process.env.CI) {
    const inherited = Object.keys(process.env).filter(k => /^VITE_/.test(k)).sort()
    if (inherited.length) {
      console.warn(
        `⚠️  with-project-env · NO .env.local found (not in this checkout, and git reports no other ` +
        `worktree that has one), so ${inherited.join(', ')} are being used EXACTLY as your shell ` +
        'exports them and nothing has been checked against this project.\n' +
        '    If you are in a detached worktree this is the wrong-project trap · the main clone\'s ' +
        '.env.local is normally found automatically, so its absence means git could not be reached.\n' +
        '    Silent in CI (CI=true), where env-supplied secrets are the intended path.')
    }
  }

  // shell:true so this works with npm-installed binaries (vite) on macOS and Linux alike.
  const child = spawn(argv[0], argv.slice(1), { stdio: 'inherit', env, shell: true })
  child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0))
  child.on('error', (err) => {
    console.error(`with-project-env: failed to launch "${argv.join(' ')}" · ${err.message}`)
    process.exit(1)
  })
}

if (require.main === module) main()

module.exports = { findEnvLocal }
