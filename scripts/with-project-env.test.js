// THE ENV GUARD AND THE WORKTREE TRAP  (T2 S62)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// `.env.local` is gitignored, so `git worktree add` does not carry it. The guard resolved the file
// from its own directory, found nothing, and took the CI branch · which strips nothing · so a
// detached worktree ran with whatever the shell exported. On this machine the shell exports another
// project's Supabase credentials, so every sign-in went to a dead database. T3 spent a run on it.
//
// CI AND A WORKTREE ARE BYTE-IDENTICAL TO THIS SCRIPT: both are a checkout with no .env.local, and
// they need OPPOSITE behaviour. That is Rule 130 · two situations, one observable, so the path you
// care about cannot be distinguished from inside. The discriminator has to come from elsewhere, and
// git already knows it: a linked worktree's --git-common-dir points at the clone that owns the file.
//
// THE WORKTREE CASE IS TESTED WITH A REAL GIT WORKTREE, not a stubbed directory layout. The subject
// under test IS git's worktree resolution, so a fixture that fakes it would be a model of exactly
// the thing being changed (preamble §3 · when the harness simulates the subject, the harness is
// maximally suspect).

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { findEnvLocal, readViteVars, shQuote } = require('./with-project-env.cjs')

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** A real repo with a real .env.local and a real linked worktree. Returns absolute, realpath'd dirs. */
function withRepo(fn) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'envguard-')))
  try {
    const main = join(root, 'main')
    mkdirSync(join(main, 'scripts'), { recursive: true })
    git(root, 'init', '-q', '-b', 'main', main)
    git(main, 'config', 'user.email', 'e2e@neotopia.test')
    git(main, 'config', 'user.name', 'E2E')
    writeFileSync(join(main, '.gitignore'), '.env.local\n')
    writeFileSync(join(main, 'scripts', 'keep.txt'), 'x')
    git(main, 'add', '-A')
    git(main, 'commit', '-qm', 'init')
    // The file itself is gitignored · exactly as in the real repo, which is why a worktree lacks it.
    writeFileSync(join(main, '.env.local'), 'VITE_SUPABASE_URL=https://correct.supabase.co\n')
    const wt = join(root, 'wt')
    git(main, 'worktree', 'add', '--detach', '-q', wt, 'HEAD')
    return fn({ main, wt, root })
  } finally { rmSync(root, { recursive: true, force: true }) }
}

describe('with-project-env · finding the project .env.local', () => {
  // ── COUNTERWEIGHT, WRITTEN FIRST · the one property this change may not break ──────────────────
  // CI ships no .env.local and passes the credentials as repo secrets. If the lookup ever returns
  // something there, the guard would DELETE a var that has no local replacement and the build would
  // run with no Supabase config at all · turning a silent wrong-project hazard into a loud broken
  // gate for every contributor. The fix must not buy the worktree case at CI's expense.
  it('returns null where there is genuinely no .env.local · CI must keep stripping nothing', () => {
    const d = realpathSync(mkdtempSync(join(tmpdir(), 'envguard-ci-')))
    try {
      mkdirSync(join(d, 'scripts'), { recursive: true })
      expect(findEnvLocal(join(d, 'scripts')), 'a plain checkout with no .env.local and no git must ' +
        'resolve to nothing · anything else strips a var CI has no replacement for').toBe(null)
    } finally { rmSync(d, { recursive: true, force: true }) }
  })

  it('a linked worktree follows --git-common-dir back to the clone that owns the file', () => {
    withRepo(({ main, wt }) => {
      const found = findEnvLocal(join(wt, 'scripts'))
      expect(found, 'a detached worktree resolved to NO env file · this is the exact state that ran ' +
        'against the wrong Supabase project, and the guard reported it as the CI case').not.toBe(null)
      expect(found.file).toBe(join(main, '.env.local'))
      expect(found.via, 'the message must name WHERE the file came from · a developer seeing vars ' +
        'stripped in a worktree needs to know which clone decided that').toMatch(/main worktree/)
    })
  })

  it('the worktree genuinely lacks the file · otherwise this suite proves nothing', () => {
    // POSITIVE CONTROL (Rule 120): if `git worktree add` DID carry .env.local, the test above would
    // pass through the `this checkout` branch and the worktree lookup would never execute. The
    // premise of the whole fix is that the file is absent there, so it is asserted rather than
    // assumed · and asserted through the same lookup, by checking which branch answered.
    withRepo(({ wt }) => {
      expect(findEnvLocal(join(wt, 'scripts')).via, 'the worktree already had its own .env.local, so ' +
        'the git-common-dir path was never exercised and the fix is untested')
        .not.toMatch(/this checkout/)
    })
  })

  it('the main clone still answers from itself · no behaviour change where it already worked', () => {
    withRepo(({ main }) => {
      const found = findEnvLocal(join(main, 'scripts'))
      expect(found.file).toBe(join(main, '.env.local'))
      expect(found.via).toBe('this checkout')
    })
  })

  it('a git checkout whose clone has no .env.local still returns null', () => {
    // The real CI shape: a genuine git repo, no env file anywhere in it. The worktree lookup must
    // not invent one, or CI regresses into the broken-gate failure the counterweight describes.
    withRepo(({ main, wt }) => {
      rmSync(join(main, '.env.local'))
      expect(findEnvLocal(join(wt, 'scripts'))).toBe(null)
      expect(findEnvLocal(join(main, 'scripts'))).toBe(null)
    })
  })

  it('resolves against the REAL repo it lives in, in EITHER environment', () => {
    // ⚠ THE FIRST VERSION OF THIS REDDENED THE MERGE GATE FOR EVERYONE. It asserted `not.toBe(null)`
    // against the real repo · true on a developer's machine, false in CI, where there is no
    // .env.local at all. I wrote a test that assumed a developer checkout, in the same commit as
    // Rule 131, whose entire subject is that CI and a local checkout differ and that assuming one
    // is how the collision happens. The preamble's §5 line I broke is explicit: never red a shared
    // gate for another lane, and this reddened it for all three.
    //
    // The anchor is still worth having · without it a broken default argument or wrong path
    // arithmetic would leave every temp-repo fixture above passing. So it now asserts the property
    // that holds in BOTH environments and is still specific: whatever comes back is either nothing,
    // or a path that really exists. A silently-invented path fails here in CI and locally alike.
    const found = findEnvLocal()
    if (found === null) {
      // The CI shape, and asserting it is not a formality: null is what makes the guard strip
      // nothing, which is the property the counterweight at the top of this file protects.
      expect(process.env.CI || !existsSync(join(process.cwd(), '.env.local')),
        'findEnvLocal returned nothing while this checkout HAS a .env.local · the lookup is broken ' +
        'and the guard would stop protecting anyone').toBeTruthy()
      return
    }
    expect(found.file).toMatch(/\.env\.local$/)
    expect(existsSync(found.file), `findEnvLocal returned ${found.file}, which does not exist · the ` +
      'path arithmetic is wrong and the fixtures above cannot see it').toBe(true)
    expect(['this checkout', undefined]).toContain(
      found.via.startsWith('the main worktree') ? undefined : found.via)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// INJECTION AND QUOTING  (T2 S63 · both defects found by T3, both in a fix I closed as complete)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EVERY TEST HERE SPAWNS THE REAL SCRIPT. A unit test of shQuote would assert my own model of what
// /bin/sh does with a string, and the model is exactly the thing that was wrong · the S26 author
// (me) believed spawn(cmd, args, {shell:true}) passed args through. The subject under test IS the
// shell, so the harness may not simulate it (preamble §3).
// Resolved from cwd, not from import.meta.url: vitest serves modules over a NON-file: URL, so
// fileURLToPath(import.meta.url) throws "The URL must be of scheme file". Same constraint
// tests/seededState.guard.test.js documents, and cwd is always the repo root under vitest.
const SCRIPT = join(process.cwd(), 'scripts', 'with-project-env.cjs')

/** Run the guard for real and capture the child's stdout. `env` REPLACES the inherited one. */
function runGuard(args, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    // A clean base: PATH so binaries resolve, and nothing else unless the caller asks. Inheriting
    // this machine's shell would import the very AetherMind vars these tests are about.
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  })
  return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), code: r.status }
}

const PRINT = 'process.stdout.write(JSON.stringify(process.argv.slice(1)))'
const PRINT_ENV = (n) => `process.stdout.write(String(process.env.${n}))`

describe('with-project-env · the child gets what the caller meant', () => {
  // ── COUNTERWEIGHT, FIRST · the shell must not touch the caller's arguments ────────────────────
  // Written before the injection tests because it is the one that was silently wrong for 37
  // sessions, and because an argv that survives is the precondition for trusting anything else
  // this script reports about a run.
  it('a shell metacharacter in an argument arrives as text, not as a pipeline', () => {
    const { out, code } = runGuard([process.execPath, '-e', PRINT, 'keyboard audit|endgame diagnostic'])
    expect(code, 'the child did not exit 0 · before quoting, sh read the | as a pipeline and ' +
      'reported "endgame: command not found", which looks like a runner crash and not a quoting bug')
      .toBe(0)
    expect(JSON.parse(out)).toEqual(['keyboard audit|endgame diagnostic'])
  })

  it('and so do the other metacharacters, including a quote inside a quote', () => {
    // POSITIVE CONTROL FOR THE ESCAPE ITSELF: a single quote is the ONE character single-quoting
    // cannot pass through, so it is the only part of shQuote that can be wrong. If the
    // close-escape-reopen is broken this hangs or errors rather than returning the string.
    const nasty = ['a b', '$HOME', '`id`', 'x;y', "it's", '*', '']
    const { out, code } = runGuard([process.execPath, '-e', PRINT, ...nasty])
    expect(code).toBe(0)
    expect(JSON.parse(out), 'an argument was expanded, split or swallowed by the shell').toEqual(nasty)
  })

  it('INJECTS the project value where the shell has none · the worktree case', () => {
    // The defect T3 measured: S62 found the main clone's file and stripped the shadowing var, then
    // handed the child nothing, because Vite loads env files from ITS OWN root and a worktree has
    // none. `npm run dev` in a worktree died on "VITE_SUPABASE_URL ... required in .env.local".
    const { out } = runGuard([process.execPath, '-e', PRINT_ENV('VITE_SUPABASE_URL')])
    expect(out, 'the child received no VITE_SUPABASE_URL · the guard is still delete-only, so any ' +
      'checkout without its own .env.local runs with nothing at all').not.toBe('undefined')
    expect(out).toMatch(/^https:\/\//)
  })

  it('OVERRIDES a shell value that disagrees · the original S26 hazard, still closed', () => {
    const { out, err } = runGuard(
      [process.execPath, '-e', PRINT_ENV('VITE_SUPABASE_URL')],
      { VITE_SUPABASE_URL: 'https://gsogycwtllthrenqaxlh.supabase.co' })   // the dead AetherMind project
    expect(out, 'the shell\'s value for another Supabase project reached the child · this is the bug ' +
      'the whole file exists for').not.toContain('gsogycwtllthrenqaxlh')
    expect(err, 'the override happened silently · a value being replaced must say so').toMatch(/ignoring inherited/)
  })

  it('leaves a VITE_ var the project does not define completely alone', () => {
    // Scope: this guard replaces what .env.local has an opinion about and nothing else. Without
    // this, "the project's truth wins" could quietly become "the project's truth is all there is".
    const { out } = runGuard(
      [process.execPath, '-e', PRINT_ENV('VITE_SOMETHING_ELSE')], { VITE_SOMETHING_ELSE: 'kept' })
    expect(out).toBe('kept')
  })

  it('CI keeps its silence · no .env.local anywhere means nothing is injected and nothing is said', () => {
    // THE COUNTERWEIGHT THIS WHOLE FILE PROTECTS, now aimed at injection rather than stripping: CI
    // supplies these as repo secrets, so a guard that injected an empty string or warned on every
    // job would be worse than the hazard. Run from a temp dir that is not a git repo at all, which
    // is what makes findEnvLocal return null.
    const d = realpathSync(mkdtempSync(join(tmpdir(), 'envguard-ci2-')))
    try {
      mkdirSync(join(d, 'scripts'), { recursive: true })
      copyFileSync(SCRIPT, join(d, 'scripts', 'with-project-env.cjs'))
      const r = spawnSync(process.execPath,
        [join(d, 'scripts', 'with-project-env.cjs'), process.execPath, '-e', PRINT_ENV('VITE_SUPABASE_URL')],
        { encoding: 'utf8', cwd: d, env: { PATH: process.env.PATH, CI: 'true', VITE_SUPABASE_URL: 'from-ci-secrets' } })
      expect(r.stdout.trim(), 'CI\'s env-supplied secret was replaced or blanked · the guard has ' +
        'started removing a value that has no local replacement').toBe('from-ci-secrets')
      expect(r.stderr.trim(), 'the guard printed something in CI · every job now carries noise it ' +
        'cannot act on').toBe('')
    } finally { rmSync(d, { recursive: true, force: true }) }
  })

  it('the parser reads assignments, not prose', () => {
    const d = realpathSync(mkdtempSync(join(tmpdir(), 'envguard-parse-')))
    try {
      writeFileSync(join(d, '.env.local'),
        '# VITE_COMMENTED=no\nVITE_A=plain\nVITE_B="quoted"\n  VITE_C = spaced \nNOT_VITE=skip\nVITE_D=\n')
      const v = readViteVars(join(d, '.env.local'))
      expect([...v.keys()].sort()).toEqual(['VITE_A', 'VITE_B', 'VITE_C', 'VITE_D'])
      expect(v.get('VITE_B'), 'the surrounding quotes are part of the value · every consumer would ' +
        'then compare against a string nobody wrote').toBe('quoted')
      expect(v.get('VITE_C')).toBe('spaced')
      expect(v.get('VITE_D')).toBe('')
    } finally { rmSync(d, { recursive: true, force: true }) }
  })

  it('shQuote is exported and is not a no-op · the tell if someone "simplifies" it away', () => {
    expect(shQuote('a b')).not.toBe('a b')
    expect(shQuote("it's")).toContain("'\\''")
  })
})
