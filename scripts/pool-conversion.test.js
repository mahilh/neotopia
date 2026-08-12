// POOL CONVERSION · counting what actually stopped minting  (T2 S61)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The Council's tripwire is "if the identity count does not measurably drop within 24h of
// activation, the branch is falling back silently" · and until this reader existed the tripwire had
// no reader, because auth.users is unreachable and 029 is held. Brutus's dissent was that a manual
// step at a decision point is a step that will not happen; this is the answer, so its arithmetic has
// to be worth quoting.
//
// The fixtures are REAL LINES, copied from run 31644385670 and 31637560095 rather than invented,
// because the thing most likely to be wrong here is my model of what the harness prints.

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { classifyPoolLine, tally, report, contractHolds } = require('./pool-conversion.cjs')

const SEED = '[pool] game-ux host · browser · seeded member 0 · the APP decides from here, and __neotopia_pool_outcome will say which branch it took'
const REUSED = '[pool] game-ux host · browser · REUSED member 0 · 0 identities minted by this context'
const NOCRED = '[pool] game-ux joiner · browser · NO CREDENTIAL for member 1 · the app will mint anonymously (unconverted, not converted-and-free)'
const UNMEAS = '[pool] game-ux joiner · browser · UNMEASURED · nothing was seeded for member 1, so "no-credential" says nothing about reuse either way'
const TEARDOWN = '[pool] teardown · member 0 REUSED 462b5106 (created 2026-08-12T16:55:04.630313Z) · 0 minted'

describe('pool conversion · the arithmetic', () => {
  // ── COUNTERWEIGHT, WRITTEN FIRST ───────────────────────────────────────────────────────────────
  // A CONVERTED context emits TWO lines: `seeded member 0` when the harness writes the credential,
  // and `REUSED member 0` when the app reports which branch it took. The first is an INTENT and the
  // second is the OUTCOME. Counting both makes every success weigh twice, so the rate climbs toward
  // 100% exactly as conversion improves · a bias that is invisible because it moves the number in
  // the direction everyone wants it to move. This is the one error here that would be believed.
  it('an intent line is not an outcome · a converted context is counted ONCE', () => {
    expect(classifyPoolLine(SEED).outcome, 'the seed line must be classified as intent, not as a ' +
      'success · it is emitted before the app has decided anything').toBe('intent')
    const t = tally([SEED, REUSED])
    expect(t.browser.reused, 'one converted context produced two lines and was counted twice · the ' +
      'rate now rises as conversion improves, for the wrong reason').toBe(1)
    expect(t.browser.intent, 'the intent line leaked into the totals').toBeUndefined()
  })

  it('zero gradeable sign-ins is UNMEASURED, never a rate', () => {
    // 0 of 0 is 0% or 100% depending on which way the division is written, both are plausible, and
    // neither means anything (Rule 80). A rate printed here would arrive as a finding.
    const out = report('browser', {}).join(' ')
    expect(out).toMatch(/UNMEASURED/)
    expect(out, 'a percentage was rendered from an empty sample').not.toMatch(/%/)
  })

  it('UNMEASURED contexts are reported but never graded', () => {
    // "nothing was seeded" is not a failure to convert · it is the record saying nothing was
    // OFFERED, which is what makes the fix env rather than code. Folding it into the denominator
    // would blame the app for a workflow omission.
    const t = tally([NOCRED, UNMEAS, REUSED, SEED])
    const out = report('browser', t.browser).join(' ')
    expect(out).toMatch(/1\/2 REUSED \(50\.0%\)/)
    expect(out).toMatch(/1 UNMEASURED/)
  })

  it('browser and teardown are separate producers and never blend', () => {
    // The standing warning this encodes: do not read a fall in auth.users as browsers converting ·
    // it will be the teardowns. In S59 teardowns went to 100% while browsers stayed at 0, so a
    // single blended figure would have read as progress nobody had made.
    const t = tally([REUSED, NOCRED, TEARDOWN, TEARDOWN])
    expect(t.browser.reused).toBe(1)
    expect(t.browser.unconverted).toBe(1)
    expect(t.teardown.reused).toBe(2)
    expect(t.teardown.unconverted, 'a browser miss was attributed to the teardown').toBeUndefined()
  })

  it('a teardown line is attributed to the teardown even though it also says REUSED', () => {
    // Both producers use the word REUSED, so producer detection cannot key on the outcome token.
    expect(classifyPoolLine(TEARDOWN).producer).toBe('teardown')
    expect(classifyPoolLine(REUSED).producer).toBe('browser')
  })

  it('labels survive classification · the shortfall must be attributable to a context', () => {
    // The whole value of the by-label breakdown: "browser 50%" is a number, "game-ux joiner is 0/3
    // and the host is 3/3" is a diagnosis pointing at two env lines.
    const t = tally([REUSED, NOCRED, UNMEAS])
    expect(t.labels['game-ux host']).toEqual({ reused: 1 })
    expect(t.labels['game-ux joiner']).toEqual({ unconverted: 1, unmeasured: 1 })
  })

  it('an unrecognised pool line is surfaced, not silently dropped', () => {
    // The contract belongs to another lane. A reworded line must degrade to a visible warning, not
    // to a smaller denominator that still prints a confident percentage.
    const t = tally(['[pool] something · browser · entirely new wording here'])
    expect(t.browser.unrecognised).toBe(1)
  })
})

describe('pool conversion · the log-line contract it depends on', () => {
  it('holds against the real harness source', () => {
    expect(contractHolds(process.cwd()), 'the tokens this script counts are no longer emitted by ' +
      'tests/e2e · every number it prints would be a silent zero').toEqual([])
  })

  it('detects a REWORDED token, not merely a missing file', () => {
    // ⚠ MY FIRST CONTROL HERE WAS GREEN ON A BROKEN DETECTOR. It pointed contractHolds at a
    // nonexistent root and asserted it complained · which it did, from the `unreadable` catch. So
    // the assertion passed while the token comparison itself was disabled by mutation: I had
    // proved the file-missing path and called it proof of the drift path. A control has to exercise
    // the SPECIFIC mechanism, not merely provoke the same output (Rule 120 · a positive control
    // must show the capability you are about to assert the absence of).
    const root = mkdtempSync(join(tmpdir(), 'poolcontract-'))
    try {
      mkdirSync(join(root, 'tests', 'e2e'), { recursive: true })
      // Present and readable · one token deliberately reworded, the rest intact.
      writeFileSync(join(root, 'tests', 'e2e', 'poolBrowser.js'),
        'console.log("REUSED member 0"); console.log("UNMEASURED")')
      writeFileSync(join(root, 'tests', 'e2e', 'seedHelpers.js'),
        'console.log("REUSED"); console.log("NO CREDENTIAL for member 1")')
      const missing = contractHolds(root)
      expect(missing.length, 'a reworded token went undetected in a file that reads perfectly well ' +
        '· every count this script prints would silently become zero').toBe(1)
      expect(missing[0]).toMatch(/poolBrowser\.js/)
      expect(missing[0]).toMatch(/NO CREDENTIAL for member/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
