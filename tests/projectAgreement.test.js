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

import { describe, test, expect } from 'vitest'
import { compareProjects } from './e2e/projectAgreement.js'

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
