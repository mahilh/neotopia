// NeoTopia · the test process and the browser must agree which project they are on (T3 S67).
// Design, and the two identities it cost, in tests/e2e/projectAgreement.js.
//
// THE DECISION IS HELD HERE rather than in the browser, because jsdom has no network and playwright is
// not needed to decide whether two hostnames are the same (Rule 78's corollary · put the reachability in
// the browser and keep the DECISION in the unit test). The page-bound half is four lines and does nothing
// but read `performance.getEntriesByType`.
//
// ⚠ THIS RUNS INSIDE assertBackendReachable, WHICH EVERY LIVE SPEC CALLS. A false positive here reds a
// shared gate for another lane (§5), so the tolerance question is asked in both directions rather than
// answered with "be strict" (Rule 117b): a wrong MISMATCH stops colleagues' specs on a healthy machine,
// and a wrong AGREE costs what it already cost me · a live run, two identities, and a sync accusation
// aimed at the product. The resolution is that only two PRESENT, DISAGREEING hosts throw. Neither
// absence can produce the defect, because it needs the node side pointed at a WRONG host, not no host.

import { describe, test, expect, afterEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { stripComments } from './walletTerminalSeam.js'
import { compareProjects, assertProjectAgreement } from './e2e/projectAgreement.js'

const REAL = 'https://wynccumuisjxbptjlfwq.supabase.co'   // NeoTopia
const DEAD = 'https://gsogycwtllthrenqaxlh.supabase.co'   // the shell's inherited AetherMind project

describe('the node side and the browser side must be on one project (Rule 93 · two env contracts)', () => {

  // ══ COUNTERWEIGHT FIRST (§2) ═════════════════════════════════════════════════════════════════════
  test('COUNTERWEIGHT · the exact S67 incident is a MISMATCH · nothing else here means anything otherwise', () => {
    const r = compareProjects(DEAD, ['wynccumuisjxbptjlfwq.supabase.co'])
    expect(r.verdict, 'the real, measured disagreement does not register · every other case below is a ' +
      'comparison that has never been shown to be capable of failing').toBe('MISMATCH')
    expect(r.why, 'the failure must name BOTH hosts · "the projects differ" sends the reader to guess ' +
      'which side is wrong, and the two fixes are in different places')
      .toMatch(/gsogycwtllthrenqaxlh\.supabase\.co[\s\S]*wynccumuisjxbptjlfwq\.supabase\.co/)
    expect(r.why, 'the failure must name the INVOCATION that causes it · this is a how-you-ran-it defect, ' +
      'and a diagnosis without the fix just relocates the confusion').toMatch(/npm run test:e2e/)
  })

  test('COUNTERWEIGHT · UNMEASURED is not AGREE, in both of its two shapes (Rule 80)', () => {
    // These are the cases a lazier predicate would collapse into "no disagreement found", which reads as
    // a pass and is the exact resting-at-a-plausible-value failure this project has paid for six times.
    const noNode = compareProjects(undefined, ['wynccumuisjxbptjlfwq.supabase.co'])
    const noBrowser = compareProjects(REAL, [])
    for (const [name, r] of [['no node env', noNode], ['no browser traffic', noBrowser]]) {
      expect(r.verdict, `${name} reported as a measured verdict`).toBe('UNMEASURED')
      expect(r.verdict, `${name} collapsed into AGREE`).not.toBe('AGREE')
      expect(r.why, `${name} does not say it is not a pass`).toMatch(/Not a pass/)
    }
    // And they must be distinguishable from EACH OTHER, or the message sends you to the wrong half.
    expect(noNode.why).not.toBe(noBrowser.why)
  })

  test('a malformed node URL is UNMEASURED · never a throw and never a pass', () => {
    // `new URL('not-a-url')` throws. A precondition that dies inside its own parser reports as a harness
    // crash in a spec that was about to run fine · preamble §3's fourth shape, where the HARNESS is what
    // broke and the control cannot see it.
    const r = compareProjects('not-a-url', ['wynccumuisjxbptjlfwq.supabase.co'])
    expect(r.verdict).toBe('UNMEASURED')
    expect(r.nodeHost).toBeNull()
  })

  test('AGREE when the node host is among what the browser actually talked to', () => {
    const r = compareProjects(REAL, ['wynccumuisjxbptjlfwq.supabase.co'])
    expect(r.verdict).toBe('AGREE')
    expect(r.why).toContain('wynccumuisjxbptjlfwq.supabase.co')
  })

  test('a page talks to more than one host and that is not a disagreement', () => {
    // A real page issues requests to whatever it needs. The claim is "the node host is among them",
    // NOT "the browser talked to exactly one thing" · asserting the second would red on a working run
    // the first time anything else appeared, which is a gate that gets switched off (Rule 94a).
    expect(compareProjects(REAL, ['cdn.supabase.co', 'wynccumuisjxbptjlfwq.supabase.co']).verdict).toBe('AGREE')
    expect(compareProjects(REAL, ['cdn.supabase.co', 'gsogycwtllthrenqaxlh.supabase.co']).verdict).toBe('MISMATCH')
  })

  test('a port or a scheme difference is not a project difference', () => {
    // `new URL(...).host` keeps the port, which is what we want for a local proxy and would be wrong to
    // strip; but http vs https on the same host must not read as two projects.
    expect(compareProjects('http://wynccumuisjxbptjlfwq.supabase.co', ['wynccumuisjxbptjlfwq.supabase.co'])
      .verdict).toBe('AGREE')
  })

  test('nulls in the host list are dropped, not counted as a browser host', () => {
    // readBrowserProjectHosts filters, but it is a page-bound function and a caller could hand this
    // anything. A null surviving into the list would make `[null]` look like measured traffic and turn
    // an UNMEASURED into a MISMATCH · a false positive on a shared gate.
    expect(compareProjects(REAL, [null, undefined]).verdict).toBe('UNMEASURED')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A GUARD, NOT A NOTE ABOUT A GUARD (T3 S69) · my own S67 critique, made checkable
//
// S67 shipped this printing `[project] AGREE` and asserting nothing. I added that log line SPECIFICALLY
// to expose the state where the guard is present and inert · and then routed it to a human reading a
// log rather than to an assertion, which is the same defect one level up. I had exactly ONE observation
// of AGREE, and one observation is not evidence that UNMEASURED cannot happen: it arises whenever the
// test process has no VITE_SUPABASE_URL, or the page has issued no request yet on a slow boot, and in
// BOTH of those states a wrong-project run proceeds exactly as it did before the file existed.
//
// The page is a stub because `assertProjectAgreement` uses exactly one page capability · `evaluate` ·
// and a real browser would add nothing but time to a decision that is already pure below it.
const stubPage = (hosts) => ({ evaluate: async () => hosts })
const REAL_HOST = ['wynccumuisjxbptjlfwq.supabase.co']

describe('the requirement · UNMEASURED must not pass silently (T3 S69)', () => {
  const saved = process.env.VITE_SUPABASE_URL
  afterEach(() => {
    if (saved === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = saved
  })

  test('COUNTERWEIGHT · it THROWS when it cannot measure · otherwise this whole change is decoration', async () => {
    process.env.VITE_SUPABASE_URL = REAL
    await expect(assertProjectAgreement(stubPage([]), { context: 'self-test' }),
      'a page that has talked to nothing let the run continue · which is the exact state the S67 log ' +
      'line was added to expose, and it was exposed to nobody').rejects.toThrow(/COULD NOT MEASURE/)
  })

  test('COUNTERWEIGHT · and it names WHICH half was missing, both ways round', async () => {
    // "It could not measure" with no side named sends the reader to check both, and the two fixes are
    // in different places · one is how you invoked the runner, the other is where you called it from.
    process.env.VITE_SUPABASE_URL = REAL
    await expect(assertProjectAgreement(stubPage([]), {})).rejects.toThrow(/NO \*\.supabase\.co request/)
    delete process.env.VITE_SUPABASE_URL
    await expect(assertProjectAgreement(stubPage(REAL_HOST), {})).rejects.toThrow(/npm run test:e2e/)
  })

  test('a MEASURED agreement passes and returns its verdict', async () => {
    process.env.VITE_SUPABASE_URL = REAL
    await expect(assertProjectAgreement(stubPage(REAL_HOST), {})).resolves.toBe('AGREE')
  })

  test('a MISMATCH still throws, and it outranks the requirement', async () => {
    process.env.VITE_SUPABASE_URL = DEAD
    await expect(assertProjectAgreement(stubPage(REAL_HOST), { require: false }),
      'the waiver silenced a real mismatch · `require` is about what to do when the guard is BLIND, ' +
      'never about whether a measured disagreement matters').rejects.toThrow(/WRONG PROJECT/)
  })

  test('the waiver is possible, and it ANNOUNCES itself', async () => {
    process.env.VITE_SUPABASE_URL = REAL
    const lines = []
    const real = console.log
    console.log = (...a) => lines.push(a.join(' '))
    try {
      await expect(assertProjectAgreement(stubPage([]), { require: false, why: 'offline spec' }))
        .resolves.toBe('UNMEASURED')
    } finally { console.log = real }
    expect(lines.join('\n'), 'a waived requirement that prints nothing is indistinguishable from a ' +
      'requirement that held · which is the S67 defect, re-entering through the opt-out')
      .toMatch(/REQUIREMENT WAIVED[\s\S]*offline spec/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVERY CALL SITE'S POSTURE IS PINNED (T3 S69, written after it cost a red merge gate)
//
// I made the verdict REQUIRED and reddened `NeoTopia E2E` for two other lanes inside the hour. I had
// checked ONE call site · runTwoHumanLobby, and proved preconditions.e2e.js never calls it · and
// forgotten the other, `assertBackendReachable`, which I wired MYSELF in S67. Its self-test aborts
// every backend route on purpose, so the page has no traffic and the requirement fired on the one
// spec whose premise is that there is nothing to see.
//
// That is Rule 100 · a guard applied to one member of a class rots the moment the class grows · and I
// had already written it up twice the same day, once about a delegating grep and once about phase
// markers. Reading a rule does not apply it. A test that ENUMERATES does.
//
// The map is deliberately hand-maintained in a DIFFERENT file from the calls (Rule 92 · two sides from
// one source agree by construction). Adding a call site reds this until somebody records which kind of
// place it is, which is the decision that was missing.
describe('the call sites · REQUIRED vs WAIVED is a decision somebody wrote down', () => {
  const POSTURE = {
    'tests/e2e/lobby.js': 'REQUIRED',        // a signed-in host · traffic exists by construction
    'tests/e2e/preconditions.js': 'WAIVED',  // called by OUTAGE self-tests that abort every route
  }

  const callSites = () => {
    const out = {}
    const walk = (dir) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) { if (e !== 'fixtures') walk(p) ; continue }
        if (!/\.js$/.test(e) || e.includes('projectAgreement.test')) continue   // Rule 89 · not itself
        const code = stripComments(readFileSync(p, 'utf8'))
        // The CALL, not the import and not the definition · `import {...} from` and `export async
        // function` both contain the name, and counting either would classify this module as its own
        // consumer (Rule 112 · match what you mean, with a boundary).
        for (const m of code.matchAll(/(?<![.\w$])assertProjectAgreement\(([\s\S]{0,400}?)\)\s*$/gm)) {
          // THE DEFINITION IS NOT A CALL, and my first draft counted it · `export async function
          // assertProjectAgreement(` satisfies the boundary lookbehind exactly as a call does. That is
          // the THIRD time in one session a scan of mine matched a declaration or a mention instead of
          // a use (functionBody took a call site for a declaration; a filename grep took a suffix and
          // then a comment). The counterweight found it on the first run, which is the argument for
          // running a new instrument before believing it.
          if (/function\s*$/.test(code.slice(Math.max(0, m.index - 30), m.index))) continue
          const rel = p.replace(`${resolve(process.cwd())}/`, '')
          out[rel] = /require\s*:\s*false/.test(m[1]) ? 'WAIVED' : 'REQUIRED'
        }
      }
    }
    walk(resolve(process.cwd(), 'tests'))
    return out
  }

  test('COUNTERWEIGHT · the scanner finds call sites at all', () => {
    expect(Object.keys(callSites()).length, 'no call site found · the map below is compared against ' +
      'an empty object and this whole check is vacuous').toBeGreaterThan(0)
  })

  test('every call site is classified, and every classification still matches the code', () => {
    expect(callSites(), 'a call site of assertProjectAgreement is new or changed posture. REQUIRED is ' +
      'right where traffic is guaranteed (a signed-in host). WAIVED is right where the absence of ' +
      'traffic is the scenario (an outage self-test). Requiring it in the second place reddened the ' +
      'merge gate for two other lanes in S69.').toEqual(POSTURE)
  })

  test('a WAIVED call site must give a REASON · a silent opt-out is the defect re-entering', () => {
    const src = stripComments(readFileSync(resolve(process.cwd(), 'tests/e2e/preconditions.js'), 'utf8'))
    const call = src.match(/assertProjectAgreement\(([\s\S]{0,400}?)\)\s*$/m)?.[1] ?? ''
    expect(call, 'the waiver carries no `why` · then the log line says "no reason given" and the next ' +
      'reader cannot tell a considered exemption from a copied one').toMatch(/why\s*:/)
  })
})
