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
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { findEnvLocal } = require('./with-project-env.cjs')

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
