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
 *   If this repo has a .env.local, every VITE_* var it defines is SET in the child's environment to
 *   the file's value · the project's own truth wins, whether the shell disagreed or said nothing.
 *
 * ⚠ IT USED TO ONLY DELETE, AND THAT WAS HALF A FIX (T3 S63 found it; T2 S63 fixed it)
 *   The S26 version deleted a shadowing var and relied on Vite falling back to .env.local. That
 *   works in the main clone, where Vite's root HAS the file. It cannot work in a worktree, where
 *   Vite's root has none · so the S62 worktree fix found the right file, stripped the wrong values,
 *   and handed the child NOTHING:
 *       worktree $ npm run dev
 *       Error: NeoTopia: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required in .env.local
 *   Loud beats silent, so S62 was an improvement · but I closed it as "the worktree env trap is
 *   fixed" and it was fixed in one direction only. Nobody saw it because playwright's
 *   reuseExistingServer handed every worktree run the MAIN clone's already-credentialed dev server,
 *   so a second defect was compensating for this one (T3's finding, and the better half of it).
 *   Injecting what the file already parsed fixes dev, build and test at once, and removes the
 *   dependency on WHERE Vite happens to look.
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

/** Every VITE_* assignment in an env file, as a Map. One parser, so no call site re-implements it. */
function readViteVars(file) {
  const vars = new Map()
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) vars.set(m[1], m[2].replace(/^["']|["']$/g, ''))
  }
  return vars
}

/**
 * POSIX single-quoting for one argv element.
 *
 * WHY THIS EXISTS (T3 S63, measured with its control):
 *     node scripts/with-project-env.cjs echo "a|b"   ->   /bin/sh: b: command not found
 *     node scripts/with-project-env.cjs echo "ab"    ->   ab
 * `spawn(cmd, args, { shell: true })` joins argv WITH SPACES AND NO QUOTING and hands the result to
 * /bin/sh, so every shell metacharacter in an argument is re-interpreted. It cost T3 twenty minutes
 * because the symptom does not look like quoting: `--grep "keyboard audit|endgame diagnostic"` fails
 * as `/bin/sh: endgame: command not found` followed by a Playwright EPIPE stack, which reads as a
 * runner crash. shell:true is kept · it is what makes npm-installed binaries (vite, playwright)
 * resolve on macOS and Linux alike · and the quoting makes each argv element literal, which is what
 * the caller already believed it was.
 *
 * Single quotes make everything literal in sh; the only character needing care is a single quote
 * itself, which is closed, escaped and reopened. POSIX shells only · this repo runs macOS and
 * ubuntu-latest, and cmd.exe would need different quoting entirely.
 */
const shQuote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`

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
  const overridden = []   // the shell had a DIFFERENT value · the original hazard
  const provided = []     // the shell had NOTHING · the worktree case, silently broken until S63

  if (found) {
    for (const [name, fileValue] of readViteVars(found.file)) {
      // An inherited var that already agrees with .env.local is not a bug and needs no message.
      if (env[name] === fileValue) continue
      ;(env[name] === undefined ? provided : overridden).push(name)
      env[name] = fileValue
    }
  }

  if (overridden.length) {
    console.warn(
      `⚠️  with-project-env · ignoring inherited ${overridden.join(', ')} · your shell exports a value ` +
      `that disagrees with this repo's .env.local (${found.via}). Using .env.local (NeoTopia's own project).`)
  }
  // Quiet by default in the main clone, where this list is empty because Vite would have found the
  // file anyway. It is non-empty exactly in a worktree, which is the case worth naming out loud ·
  // it is the one that used to fail with "required in .env.local" and look like a broken checkout.
  if (provided.length) {
    console.warn(
      `ℹ️  with-project-env · supplying ${provided.join(', ')} from ${found.via} · this checkout has ` +
      'no .env.local of its own, and Vite only loads env files from ITS OWN root.')
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

  // shell:true so this works with npm-installed binaries (vite) on macOS and Linux alike · and every
  // argv element quoted, so the shell cannot re-parse what the caller passed (see shQuote).
  const child = spawn(argv.map(shQuote).join(' '), { stdio: 'inherit', env, shell: true })
  child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0))
  child.on('error', (err) => {
    console.error(`with-project-env: failed to launch "${argv.join(' ')}" · ${err.message}`)
    process.exit(1)
  })
}

if (require.main === module) main()

module.exports = { findEnvLocal, readViteVars, shQuote }
