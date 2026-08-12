// THE POOL STEP'S SCOPE NOTE · the line that stops a false victory  (T2 S60)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The pool converts NODE-SIDE sign-ins: one per playwright invocation for the teardown, plus the
// seats four-player-live asks for. Browser contexts are a different producer and they are the BULK.
// So when the auth.users count finally falls, the honest reading is "the teardowns converted", and
// the tempting one is "the feature landed". The Council named that risk in terms; this note is the
// answer, and it is written into $GITHUB_STEP_SUMMARY because the step's own conclusion cannot
// carry it (the step exits 0 on UNMEASURED by design, so a fork PR is not reddened for secrets it
// cannot read · which is exactly why a green step there means nothing).
//
// TESTED ON SYNTHETIC INPUT, DELIBERATELY. The obvious test is `browserWiring(repo).seeds` against
// the real tree, and it would be wrong twice over: it asserts a fact about ANOTHER LANE's progress,
// so it reds the shared gate the day T3 commits their wiring (preamble §5 · never red a shared gate
// for another lane), and it pins a number that is SUPPOSED to change. The function's behaviour is
// the contract; the repo's current state is not.

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { scopeNote, browserWiring, harnessEnv, mask } = require('./verify-pool-signin.cjs')

const render = (w) => scopeNote(w).join('\n')

describe('the pool step summary · scope', () => {
  // ── COUNTERWEIGHT, WRITTEN FIRST ───────────────────────────────────────────────────────────────
  // Every wiring state must produce a non-empty note. An empty scope block is the failure that
  // matters, because the summary would then show a bare "4/4 members REUSED" table · a number with
  // no population attached, which is precisely how someone declares victory on a metered
  // denominator that has not moved (Rule 121 · a finding needs a denominator before a priority).
  it('never renders an empty scope, in any wiring state', () => {
    const STATES = [
      ['nothing wired', { seeds: [], asserts: [] }],
      ['seeded and asserted', { seeds: ['a.js'], asserts: ['b.js'] }],
      ['seeded but NOT asserted', { seeds: ['a.js'], asserts: [] }],
      ['asserted but not seeded', { seeds: [], asserts: ['b.js'] }],
    ]
    for (const [label, w] of STATES) {
      const out = render(w)
      expect(out.length, `${label} produced an empty scope note · the summary would then show a ` +
        'member count with no population attached').toBeGreaterThan(80)
      expect(out, label).toMatch(/SCOPE/)
    }
  })

  it('with no browser wiring it says the fall is the TEARDOWNS, not the browsers', () => {
    // The single sentence this whole file exists for.
    const out = render({ seeds: [], asserts: [] })
    expect(out).toMatch(/TEARDOWNS/)
    expect(out).toMatch(/every browser context still mints/)
    expect(out, 'a no-wiring note must not claim anything about browser conversion having happened')
      .not.toMatch(/browser wiring is PRESENT/)
  })

  it('seeded WITHOUT an assertion is called out · that is the silent state, not progress', () => {
    // The dangerous middle, and the one a naive check would render as good news: credentials reach
    // the page and nothing verifies which branch the app took, so a silent fallback to anonymous
    // passes every spec. Seeding is not converting.
    const out = render({ seeds: ['tests/e2e/seedHelpers.js'], asserts: [] })
    expect(out).toMatch(/Nothing reads `__neotopia_pool_outcome`/)
    expect(out).toMatch(/silent/)
  })

  it('seeded AND asserted points at the specs that hold the verdict, and claims nothing itself', () => {
    const out = render({ seeds: ['s.js'], asserts: ['a.js'] })
    expect(out).toMatch(/not measured here/)
    expect(out, 'this step must never imply it verified a browser context').not.toMatch(/REUSED/)
  })
})

describe('browserWiring · detection', () => {
  const withTree = (files, fn) => {
    const root = mkdtempSync(join(tmpdir(), 'pooltree-'))
    mkdirSync(join(root, 'tests', 'e2e'), { recursive: true })
    for (const [name, body] of Object.entries(files)) writeFileSync(join(root, 'tests', 'e2e', name), body)
    try { return fn(root) } finally { rmSync(root, { recursive: true, force: true }) }
  }

  it('requires BOTH the hook and the key · addInitScript alone is not a pool seed', () => {
    // The false positive this avoids: addInitScript is a general Playwright hook and specs use it
    // for all sorts of things. Counting any call as "the browser half is wired" would flip the
    // scope note to PRESENT on a tree where no credential reaches any page · and the note would
    // then stop warning about the exact thing it exists to warn about (Rule 94a).
    const hits = withTree({
      'other.e2e.js': 'await context.addInitScript(() => { window.foo = 1 })',
    }, (root) => browserWiring(root))
    expect(hits.seeds).toEqual([])
  })

  it('detects a real seed, and reports the path relative to the repo root', () => {
    const hits = withTree({
      'seed.e2e.js': "import { E2E_POOL_KEY } from '../../src/lib/e2ePool'\nawait context.addInitScript(() => {}, E2E_POOL_KEY)",
    }, (root) => browserWiring(root))
    expect(hits.seeds).toEqual(['tests/e2e/seed.e2e.js'])
  })

  it('detects an outcome assertion independently of the seed', () => {
    const hits = withTree({
      'assert.e2e.js': 'page.evaluate(() => window.__neotopia_pool_outcome)',
    }, (root) => browserWiring(root))
    expect(hits.seeds).toEqual([])
    expect(hits.asserts).toEqual(['tests/e2e/assert.e2e.js'])
  })

  it('a missing tests/ directory yields empty, not a throw', () => {
    const root = mkdtempSync(join(tmpdir(), 'pooltree-empty-'))
    try { expect(browserWiring(root)).toEqual({ seeds: [], asserts: [] }) }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('the env-name convention this script mirrors', () => {
  it('member 0 is unsuffixed and the rest are _N · the shape T3s poolCredential builds', () => {
    // A second contract by necessity (this is .cjs and must run before `npm ci`; the authoritative
    // version is ESM in another lane). The live drift guard is conventionAgrees(), which reads
    // their file; this just pins the arithmetic so a typo here cannot pass silently.
    expect(harnessEnv('EMAIL', 0)).toBe('E2E_POOL_EMAIL')
    expect(harnessEnv('PASSWORD', 0)).toBe('E2E_POOL_PASSWORD')
    expect(harnessEnv('EMAIL', 3)).toBe('E2E_POOL_EMAIL_3')
  })

  it('mask never returns the local part in full', () => {
    expect(mask('e2ehost@neotopia.test')).toBe('e2e****@neotopia.test')
    expect(mask('')).toBe('(none)')
  })
})
