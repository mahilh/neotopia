// RESERVED USERNAMES · and the drift guard that makes the list a source rather than a copy (T2 S51)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The reserved-prefix list exists in TWO places that cannot import each other: this JS module, and
// the `username like 'X%'` patterns inside purge_e2e_test_data(). That is a second contract (Rule 45)
// and it will drift · someone adds a fourth harness prefix to the SQL, forgets the JS, and the hole
// reopens for exactly that prefix with every other one still guarded, which is the worst possible
// version because the guard LOOKS present.
//
// So the SQL is parsed and compared. This is the assertion that makes RESERVED_USERNAME_PREFIXES a
// single source; without it the module is documentation.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RESERVED_USERNAME_PREFIXES, isReservedUsername, reservedUsernameError } from './reservedNames'

// The purge's definition is a CHAIN, not a file (Rule 109) · `create or replace` means the last
// migration that touched the function wins. So take the highest-numbered migration that defines
// purge_e2e_test_data and read the prefixes out of THAT, rather than out of the one that happens to
// have the memorable name.
//
// THIS IS A REPO FACT, NOT A DEPLOYED ONE, and the distinction is deliberate: the end of the chain may
// be an unapplied file (025 is, today). That is the right subject for this guard · it must go red when
// someone WRITES a new prefix, not thirty minutes later when they apply it. Applied-state belongs to
// pg_get_functiondef and never to a test (Rule 109a).
function prefixesFromLatestPurgeMigration() {
  // RESOLVED FROM cwd, NOT FROM import.meta.url, and the reason is worth recording because the
  // obvious form fails in a non-obvious way: under vitest's JSDOM environment `import.meta.url` is an
  // http://localhost/... URL, so fileURLToPath throws "The URL must be of scheme file". The identical
  // `new URL('../../scripts/migrations/', import.meta.url)` in tests/e2e/preconditions.e2e.js works
  // fine because Playwright runs it in a NODE environment. Same line, two harnesses, opposite results
  // · a harness difference masquerading as a path bug (Rule 36). The counterweight below is what
  // turned this into a named error rather than a silent empty list, which is the argument for writing
  // it first (Rule 90).
  const dir = join(process.cwd(), 'scripts', 'migrations')
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const defining = files.filter(f =>
    /create\s+or\s+replace\s+function\s+public\.purge_e2e_test_data/i.test(readFileSync(join(dir, f), 'utf8')))
  if (!defining.length) return { file: null, prefixes: [] }
  const file = defining[defining.length - 1]
  const body = readFileSync(join(dir, file), 'utf8')
  // username like 'E2E%'   ->   E2E
  const found = [...body.matchAll(/username\s+like\s+'([^%']+)%'/gi)].map(m => m[1])
  return { file, prefixes: [...new Set(found)] }
}

describe('reserved usernames · the namespace the purge owns', () => {
  // ── COUNTERWEIGHT, FIRST (Rule 90) ──────────────────────────────────────────────────────────────
  // The way this file certifies a broken guard is that the PARSER finds nothing. An empty prefix list
  // from the SQL would make the comparison below `[] vs []`-ish, or trivially satisfiable, and the
  // whole drift guard would pass forever while watching nothing · the vacuity shape that has bitten
  // this project in three separate harnesses. So the parse is asserted to have actually parsed.
  it('the migration parser finds a real purge definition and real prefixes', () => {
    const { file, prefixes } = prefixesFromLatestPurgeMigration()
    expect(file, 'no migration defines purge_e2e_test_data · the parser is looking in the wrong place ' +
      'or the function has been renamed, and this drift guard is watching nothing').toBeTruthy()
    expect(prefixes.length, `parsed ZERO username prefixes out of ${file} · the regex no longer ` +
      'matches the SQL, so the comparison below is vacuous and would pass on any list at all')
      .toBeGreaterThan(0)
  })

  it('the JS list and the SQL patterns at the end of the purge CHAIN agree exactly', () => {
    const { file, prefixes } = prefixesFromLatestPurgeMigration()
    expect([...prefixes].sort(), `the reserved-prefix list in reservedNames.js and the DELETE ` +
      `patterns in ${file} have diverged. Whichever side gained a prefix, the other side is now a ` +
      'hole: a player can claim a name the purge will delete, or a harness identity will survive ' +
      'the sweep. Fix BOTH, and prefer adding to the SQL first so this test names the gap.')
      .toEqual([...RESERVED_USERNAME_PREFIXES].sort())
  })

  it('rejects the harness prefixes, case-insensitively, and stricter than the SQL', () => {
    for (const p of RESERVED_USERNAME_PREFIXES) {
      expect(isReservedUsername(p), `${p} itself must be reserved`).toBe(true)
      expect(isReservedUsername(`${p}test`), `${p}test must be reserved`).toBe(true)
      // Postgres `like` is case SENSITIVE, so this lowercase form is NOT in the purge's scope today.
      // Rejecting it anyway is deliberate: the guard must be at least as strict as the thing it
      // protects, so a later switch from `like` to `ilike` cannot silently open a hole.
      expect(isReservedUsername(p.toLowerCase()), `${p.toLowerCase()} must be reserved too · this ` +
        'guard is deliberately stricter than the case-sensitive SQL').toBe(true)
      expect(isReservedUsername(`  ${p}x  `), 'trimmed before comparison, because that is how the ' +
        'value reaches the database').toBe(true)
    }
  })

  it('does NOT reject ordinary names · a guard that eats real names is worse than none', () => {
    // The false-positive direction matters as much as the true-positive one (Rule 94a). A check that
    // rejects reasonable names gets reported as a bug, gets loosened, and then protects nobody.
    for (const ok of ['Mahil', 'Bot', 'Bota', 'Botanist', 'E2', 'e2', 'Alpha', 'BetaTester',
      'Architect', 'e', '', '   ', 'Ellie', 'Bobby']) {
      expect(isReservedUsername(ok), `"${ok}" is an ordinary name and must be allowed`).toBe(false)
    }
    // 'Bot' alone is fine but 'BotAlpha...' is not · the boundary is the full prefix, not a substring
    // (T3's Rule 112, the same night: a substring match is an identity check with no boundary).
    expect(isReservedUsername('BotAlphaOne')).toBe(true)
    expect(isReservedUsername('AlphaBot')).toBe(false)
  })

  it('the error message names the offending prefix and the consequence', () => {
    const msg = reservedUsernameError('E2Etest')
    expect(msg).toContain('E2E')
    // The player must learn WHY, not just that they were refused · the entire defect was that the
    // consequence (their game is deleted) was invisible.
    expect(msg.toLowerCase()).toContain('deleted')
  })
})
