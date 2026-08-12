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
import { RESERVED_USERNAME_PREFIXES, isReservedUsername, isSweptByPurge, reservedUsernameError } from './reservedNames'

// The purge's definition is a CHAIN, not a file (Rule 109) · `create or replace` means the last
// migration that touched the function wins. So take the highest-numbered migration that defines
// purge_e2e_test_data and read the prefixes out of THAT, rather than out of the one that happens to
// have the memorable name.
//
// THIS IS A REPO FACT, NOT A DEPLOYED ONE, and the distinction is deliberate: the end of the chain may
// be an unapplied file (025 is, today). That is the right subject for this guard · it must go red when
// someone WRITES a new prefix, not thirty minutes later when they apply it. Applied-state belongs to
// pg_get_functiondef and never to a test (Rule 109a).
/** Read a producer's identity prefixes out of the source it is declared in. */
function collectProduced(producer) {
  const dir = join(process.cwd(), producer.dir)
  let files = []
  try { files = readdirSync(dir).filter(producer.match) } catch { return [] }
  const out = new Set()
  for (const f of files) for (const n of producer.extract(readFileSync(join(dir, f), 'utf8'))) out.add(n)
  return [...out]
}

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

  // ── THE BYPASS MUST NOT REACH A PLAYER ──────────────────────────────────────────────────────────
  // isReservedUsername opens with `if (import.meta.env.VITE_E2E) return false`, so the harness can
  // claim its own namespace. That is a deliberate hole and the ONLY thing keeping it out of a real
  // player's browser is Vite substituting the flag statically at build time. A claim of that kind
  // belongs in a test, not in the comment next to it (Rule 105a · a wrong comment goes red never).
  //
  // Asserted against the BUILT ASSETS rather than the source, because the source is not what ships.
  // Skipped when dist/ is absent so a bare `vitest` run is not red for the wrong reason · and the
  // skip is loud, because a guard that silently does not run is worse than no guard (Rule 79d).
  it('the production bundle contains no VITE_E2E bypass', () => {
    const dist = join(process.cwd(), 'dist', 'assets')
    let files = []
    try { files = readdirSync(dist).filter(f => f.endsWith('.js')) } catch { /* no build */ }
    if (!files.length) {
      console.warn('[reservedNames] SKIPPED the bundle check · no dist/assets. Run `npm run build` ' +
        'first. This is the assertion that keeps the E2E bypass out of a player\'s browser.')
      return
    }
    const bundled = files.map(f => readFileSync(join(dist, f), 'utf8')).join('\n')
    // The prefixes must survive (the guard is real in prod) and the flag must not (the hole is not).
    expect(bundled.includes('BotAlpha'), 'the reserved prefixes are absent from the production ' +
      'bundle · the guard has been tree-shaken out entirely and no player is protected').toBe(true)
    expect(bundled.includes('VITE_E2E'), 'VITE_E2E survives into the production bundle · the E2E ' +
      'bypass is reachable in a real browser, so any player can claim a name inside ' +
      'purge_e2e_test_data\'s delete scope and lose their game. This is the one assertion in this ' +
      'file that is about a real person rather than about drift.').toBe(false)
  })

  // ══ THE THIRD EDGE OF A THREE-PARTY CONTRACT (T2 S52) ═══════════════════════════════════════════
  // MY OWN S51 CRITIQUE, ACTED ON. This file guarded the JS predicate against the SQL patterns · two
  // parties · and read as complete. The contract has THREE: the SQL that deletes, this predicate that
  // refuses, and THE HARNESS THAT PRODUCES NAMES IN THE NAMESPACE. The unwatched edge is what broke
  // the merge gate in S51, and T3 wrote the missing check afterwards in THEIR file, guarding THEIR
  // specs. This is the half I own, and it is deliberately the OPPOSITE direction to theirs:
  //
  //   T3's (tests/e2e/preconditions.e2e.js) · "is a fixture prefix REFUSED by the claim path?"
  //        fails LOUDLY · the harness cannot sign in and the merge gate goes red within minutes.
  //   MINE (here)                            · "is every produced name REACHABLE BY THE PURGE?"
  //        fails SILENTLY and forever · the identity is created, never swept, and joins the 597
  //        orphaned rooms nobody can delete. Nothing goes red, ever.
  //
  // Keeping both is not duplication (Rule 94): they catch opposite failures and only one of them has
  // a symptom. Sophia's S52 dissent is the reason this is worth automating rather than remembering ·
  // every new spec is a new producer in this namespace, so the next collision is a matter of time.
  //
  // ⚠ AND IT USES isSweptByPurge, NOT isReservedUsername. See the note on that function: the
  // player-facing predicate is deliberately case-INsensitive and would wave through a lowercase
  // 'e2ehost' that the case-SENSITIVE SQL can never match. Using the generous predicate for the leak
  // question is precisely the bug this edge exists to catch, so the check would have contained it.
  const PRODUCERS = [
    { label: 'uniqueName() in live specs', dir: 'tests/e2e',
      match: (f) => f.endsWith('.e2e.js'),
      extract: (src) => [...src.matchAll(/uniqueName\(\s*['"]([A-Za-z0-9_]+)/g)].map(m => m[1]) },
    { label: 'bot-simulate identities', dir: 'scripts',
      match: (f) => f === 'bot-simulate.js',
      extract: (src) => [...src.matchAll(/enterLobbyWithRetry\([^,]+,\s*`([A-Za-z0-9_]+)/g)].map(m => m[1]) },
  ]

  it('every producer is enumerated from the code and actually found (vacuity guard)', () => {
    for (const p of PRODUCERS) {
      const found = collectProduced(p)
      expect(found.length, `the "${p.label}" producer matched NOTHING in ${p.dir}. Its regex has ` +
        'drifted away from the code, so the leak check below is iterating an empty list and passes ' +
        'no matter what anyone ships (Rule 100b · enumerate from the code, and prove you did)')
        .toBeGreaterThan(0)
    }
  })

  it('every identity this repo creates is REACHABLE BY THE PURGE · the silent-leak edge', () => {
    const leaks = []
    for (const p of PRODUCERS) {
      for (const name of collectProduced(p)) {
        if (!isSweptByPurge(name)) leaks.push(`${p.label}: "${name}"`)
      }
    }
    expect(leaks, `${leaks.length} produced identity prefix(es) are OUTSIDE what ` +
      `purge_e2e_test_data can match: ${leaks.join(', ')}. Every row they create · profile, room, ` +
      'session, and every game_event cascading from it · is unreachable by the cleanup and stays in ' +
      'production permanently. This failure has NO symptom: the spec passes, the game plays, and the ' +
      'rows simply accumulate (597 orphaned rooms already exist from a different version of exactly ' +
      'this mistake). Either use a prefix in RESERVED_USERNAME_PREFIXES, or add the new prefix to ' +
      'the migration chain AND to that list · never just to the producer.').toEqual([])
  })

  // ══ THE SINK · WATCH WHAT REACHES THE WRITE, NOT WHO CALLS IT (T2 S53) ══════════════════════════
  // MY OWN S52 CRITIQUE, ACTED ON. The producer guard above enumerates by CALL SHAPE ·
  // `uniqueName('X')` and `enterLobbyWithRetry(ctx, \`X…\`)`. A new spec that claims a raw string, or
  // a helper I have not met, is invisible to it, AND the vacuity counterweight cannot see that either,
  // because the shapes it does know still match. It is an enumeration that reads as complete because
  // it enumerates what I thought of · Rule 100's own failure mode, and the same shape as the
  // two-party-guard-on-a-three-party-contract one session earlier.
  //
  // THE GENERAL FORM: there is ONE sink and an unbounded number of ways to reach it. Every path that
  // matters ends at a write of `username` into `player_profiles`. So enumerate the WRITES · a closed,
  // greppable set · and require every one of them to be CLASSIFIED. A site that is neither guarded
  // nor deliberately exempted reds, which is the property no producer-shaped guard can have.
  //
  // WHY CLASSIFICATION AND NOT "MUST BE GUARDED". Two of the four live sites are in T3's
  // useGameRoom.js and are correct WITHOUT a check: the username they write has already been through
  // claimUsername, so they are safe by PROVENANCE. Demanding a redundant guard there would redden
  // working code in someone else's lane, and a gate that reports failures on a working board gets read
  // as noise and switched off (Rule 94a / 103b). So each site is named, with the reason it is safe.
  const USERNAME_SINKS = {
    // file :: how many writes it may contain, and why each is safe
    'src/hooks/useAuth.js': {
      writes: 2,
      why: 'claimUsername · both the UPDATE and the INSERT sit behind the reserved-prefix check',
      requiresGuard: true,
    },
    'src/hooks/useGameRoom.js': {
      writes: 2,
      why: 'T3 · best-effort backstop upserts. SAFE BY PROVENANCE, not by a check: the value is the ' +
        'already-claimed `username` from useAuth state, which cannot be reserved because claimUsername ' +
        'refused it and the localStorage restore path drops it. If either of those two guards is ever ' +
        'removed, THESE become unguarded writes and this entry is the note that says so.',
      requiresGuard: false,
    },
  }

  const findUsernameWrites = () => {
    const hits = {}
    const walk = (rel) => {
      const abs = join(process.cwd(), rel)
      let entries = []
      try { entries = readdirSync(abs, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const child = `${rel}/${e.name}`
        if (e.isDirectory()) { walk(child); continue }
        if (!/\.(js|jsx)$/.test(e.name) || /\.test\./.test(e.name)) continue
        const src = readFileSync(join(process.cwd(), child), 'utf8')
        // A write is an insert/upsert/update on player_profiles that carries a username field.
        const n = [...src.matchAll(/from\(\s*['"]player_profiles['"]\s*\)[\s\S]{0,200}?\.(insert|upsert|update)\([\s\S]{0,200}?username/g)].length
        // ⚠ \b AND A CALL PAREN, NOT A BARE SUBSTRING · T3's Rule 112, which I then committed myself.
        // The first version of this line was `/isReservedUsername/.test(src)` and the mutation that
        // renames the guard to `isReservedUsernameXX` LEFT IT GREEN, because the new name contains the
        // old one. A substring match is an identity check with no boundary, and the instrument built
        // on one hid the exact case it exists to find. Requiring a word boundary AND an open paren
        // means the guard must actually be CALLED, not merely mentioned in a comment.
        if (n) hits[child] = { count: n, guarded: /\bisReservedUsername\s*\(/.test(src) }
      }
    }
    walk('src')
    return hits
  }

  it('the sink scanner finds the known writes (vacuity guard)', () => {
    const found = findUsernameWrites()
    const total = Object.values(found).reduce((s, h) => s + h.count, 0)
    expect(total, 'ZERO username writes were found anywhere in src/ · the scanner regex has drifted ' +
      'away from how the code writes a profile, so the classification check below is iterating an ' +
      'empty set and passes no matter what anyone ships').toBeGreaterThanOrEqual(4)
  })

  it('every write of a username into player_profiles is CLASSIFIED', () => {
    const found = findUsernameWrites()
    const problems = []
    for (const [file, hit] of Object.entries(found)) {
      const spec = USERNAME_SINKS[file]
      if (!spec) {
        problems.push(`${file} writes a username to player_profiles (${hit.count} site(s)) and is ` +
          'NOT classified in USERNAME_SINKS')
        continue
      }
      if (hit.count > spec.writes) {
        problems.push(`${file} now has ${hit.count} username writes, classified for ${spec.writes} · ` +
          'the new one has not been reasoned about')
      }
      if (spec.requiresGuard && !hit.guarded) {
        problems.push(`${file} is classified as guarded but no longer references isReservedUsername`)
      }
    }
    // And a file that has STOPPED writing is worth knowing about too · a classification that no longer
    // describes anything is the citation rot this project keeps finding (Rule 97).
    for (const file of Object.keys(USERNAME_SINKS)) {
      if (!found[file]) problems.push(`${file} is classified in USERNAME_SINKS but no longer writes a ` +
        'username · delete the entry rather than leaving a guard pointed at nothing')
    }

    expect(problems, `${problems.length} unclassified or drifted username sink(s):\n  ` +
      `${problems.join('\n  ')}\n\nEvery path that can put a name into player_profiles ends here. ` +
      'A write that has not been classified is one a player can reach with a reserved prefix · which ' +
      'puts their room, their session and every game_event cascading from it inside ' +
      'purge_e2e_test_data\'s delete scope, silently. Either guard it with isReservedUsername, or add ' +
      'it to USERNAME_SINKS with the reason it is safe without one.').toEqual([])
  })

  // ══ THE TEST-SIDE SINK · THIRD INSTANCE OF MY OWN LESSON (T2 S56) ═══════════════════════════════
  // S52 I wrote: "there is one sink and an unbounded number of ways to reach it", moved the guard to
  // the sink INSIDE src/ where the writes are a closed set, and left the TEST side enumerated by
  // producer CALL SHAPE. S55 measured the cost: 50 of 71 profiles unreachable by the purge, with
  // prefixes (A11yEsc, Probe320, T3PRB*, test) that appear as literals NOWHERE in the repo because
  // they are constructed dynamically. My guard could not see one of them. Third instance of the same
  // lesson · the first two were the two-party guard on a three-party contract, and the producer guard
  // itself.
  //
  // THE ENUMERATION POINT IS NOT THE PRODUCER, IT IS THE HELPER BOUNDARY. Measured: every single
  // `.fill()` on the claim input takes a PARAMETER, never a literal ·
  //     getByPlaceholder(NAME_INPUT).fill(name | hostName | joinerName | username)
  // so the value always arrives from a caller, and the callers ARE a closed, greppable set. Requiring
  // every one of them to route through `uniqueName()` makes the namespace unforgettable on the test
  // side, because uniqueName's own prefixes are already checked against the SQL above. A dynamically
  // built string cannot slip past a rule about WHICH FUNCTION produced it.
  const CLAIM_CALLERS = [
    // helper, and how the name reaches it
    { re: /\bclaimName\s*\(\s*[A-Za-z0-9_.]+\s*,\s*([^)]+?)\s*\)/g, what: 'claimName(page, NAME)' },
    { re: /\benterLobbyWithRetry\s*\(\s*[A-Za-z0-9_.]+\s*,\s*([^,)]+)/g, what: 'enterLobbyWithRetry(ctx, NAME)' },
    { re: /\b(?:hostName|joinerName)\s*:\s*([^,}\n]+)/g, what: 'runTwoHumanLobby({ hostName/joinerName })' },
  ]

  // A name is SAFE if it is produced by uniqueName(), or is a literal already inside the namespace.
  // Anything else · a variable, a template, a concatenation · cannot be proven and must be reported.
  const nameIsSafe = (expr) => {
    const e = expr.trim()
    if (/^uniqueName\s*\(/.test(e)) return true
    const lit = e.match(/^['"`]([^'"`]*)['"`]$/)
    if (lit) return isSweptByPurge(lit[1])
    return null                       // unresolvable · a parameter or an expression
  }

  const scanClaimCallers = () => {
    const out = []
    const walk = (rel) => {
      const abs = join(process.cwd(), rel)
      let entries = []
      try { entries = readdirSync(abs, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const child = `${rel}/${e.name}`
        if (e.isDirectory()) { walk(child); continue }
        if (!/\.(js|mjs)$/.test(e.name)) continue
        const src = readFileSync(join(process.cwd(), child), 'utf8')
        for (const { re, what } of CLAIM_CALLERS) {
          for (const m of src.matchAll(new RegExp(re))) {
            // Skip the helper DEFINITIONS · `async function claimName(page, name)` is not a call.
            const line = src.slice(0, m.index).split('\n').length
            const text = src.split('\n')[line - 1] ?? ''
            if (/\bfunction\b|=>\s*\{?\s*$/.test(text) && /\(\s*\w+\s*,\s*\w+\s*\)/.test(text)) continue
            out.push({ file: child, line, what, expr: m[1], safe: nameIsSafe(m[1]) })
          }
        }
      }
    }
    walk('tests'); walk('scripts')
    return out
  }

  it('the claim-caller scanner finds real call sites (vacuity guard)', () => {
    const hits = scanClaimCallers()
    expect(hits.length, 'ZERO claim-helper calls found anywhere in tests/ or scripts/ · the patterns ' +
      'have drifted away from how specs claim a name, so the check below is auditing an empty set and ' +
      'passes no matter what anyone ships').toBeGreaterThan(3)
    expect(hits.some(h => h.safe === true), 'not one call site resolved to a SAFE name · the resolver ' +
      'is broken, so "everything is unresolvable" would be the finding rather than the instrument')
      .toBe(true)
  })

  it('no claim-helper call passes a name that is provably OUTSIDE the namespace', () => {
    const bad = scanClaimCallers().filter(h => h.safe === false)
      .map(h => `${h.file}:${h.line} ${h.what} <- ${h.expr}`)
    expect(bad, `${bad.length} claim call(s) pass a literal name the purge can NEVER delete:\n  ` +
      `${bad.join('\n  ')}\n\nThat identity's profile, room, session and every game_event cascading ` +
      'from it stay in production permanently, with no symptom · 50 profiles and 640 rooms are already ' +
      'in that state (docs/ORPHAN_DIAGNOSIS.md). Route the name through uniqueName(), or add its ' +
      'prefix to RESERVED_USERNAME_PREFIXES **and** to the migration chain.').toEqual([])
  })

  it('the error message names the offending prefix and the consequence', () => {
    const msg = reservedUsernameError('E2Etest')
    expect(msg).toContain('E2E')
    // The player must learn WHY, not just that they were refused · the entire defect was that the
    // consequence (their game is deleted) was invisible.
    expect(msg.toLowerCase()).toContain('deleted')
  })
})
