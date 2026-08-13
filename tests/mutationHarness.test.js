// NeoTopia · the mutation harness's own teeth (T3 S65). Design in tests/mutationHarness.js.
//
// THE COUNTERWEIGHT IS FIRST AND IT IS THE WHOLE FILE: a run that produced NO TALLY must never be
// rendered as a result, and a real red or green must never be rendered as NO_RESULT. Those two
// mistakes have opposite costs · the first reads "your guard has no teeth" (and gets acted on), the
// second reads "your toolchain is broken" (and gets ignored).
//
// TEETH · mutation-proven, each redding a DIFFERENT assertion (Rule 118):
//   H1  parseTally returns '0 tests' instead of null   -> the refusal case reds
//   H2  classifyRun drops the !landed branch           -> the did-not-land case reds
//   H3  the baseline red branch is removed             -> the baseline-red case reds
//   H4  reds are detected by /×/ anywhere in the line  -> the "× in prose" case reds

import { describe, test, expect } from 'vitest'
import { parseTally, classifyRun, withMutation } from './mutationHarness.js'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const VITEST_GREEN = ' Test Files  1 passed (1)\n      Tests  4 passed (4)\n'
const VITEST_RED = '     × the thing 3ms\n      Tests  1 failed | 3 passed (4)\n'
const COMPILE_FAIL = 'Error: Transform failed with 1 error:\n/x.js:3:9: ERROR: Expected ")" but found "("\n'

describe('the refusal · a run with no tally is not a result', () => {

  test('NO_RESULT on a compilation failure, and it names the cause', () => {
    const r = classifyRun({ name: 'H', output: COMPILE_FAIL })
    expect(r.outcome, 'a run that never produced a tally was classified as an outcome · this is the ' +
      'exact row I printed beside four real ones in S64 and read as a fifth result').toBe('NO_RESULT')
    expect(r.report).toMatch(/NO RESULT/)
    expect(r.report, 'the refusal must say what to think, not merely refuse').toMatch(/not a red and it is not a green/)
    expect(r.report, 'the cause is what turns a refusal into a diagnosis').toMatch(/Transform failed/)
  })

  test('and NOT on a real red or a real green · the opposite error', () => {
    expect(classifyRun({ name: 'H', output: VITEST_RED }).outcome).toBe('RED')
    expect(classifyRun({ name: 'H', output: VITEST_GREEN }).outcome).toBe('GREEN')
  })

  test('an empty output is a refusal, not a green · the runner died before saying anything', () => {
    expect(classifyRun({ name: 'H', output: '' }).outcome).toBe('NO_RESULT')
    expect(parseTally('')).toBeNull()
  })

  test('a mutation that did not land is refused BEFORE the output is even read', () => {
    const r = classifyRun({ name: 'H', landed: false, output: VITEST_GREEN })
    expect(r.outcome, 'an unapplied mutation and a toothless guard produce byte-identical output ' +
      '(Rule 124 corollary), so the green must never be reported').toBe('DID_NOT_LAND')
  })
})

describe('the baseline · every red after a red baseline is free', () => {
  test('BASELINE_RED says stop', () => {
    const r = classifyRun({ name: 'B', isBaseline: true, output: VITEST_RED })
    expect(r.outcome).toBe('BASELINE_RED')
    expect(r.report, 'a red baseline must say that the mutations below mean nothing (Rule 110b), or ' +
      'four free reds get logged as four teeth').toMatch(/STOP/)
  })
  test('BASELINE_GREEN reports itself as interpretable', () => {
    expect(classifyRun({ name: 'B', isBaseline: true, output: VITEST_GREEN }).outcome).toBe('BASELINE_GREEN')
  })
})

describe('a GREEN mutation names all three of its readings (Rule 132)', () => {
  test('no teeth, blind fixture, or nothing loaded your file', () => {
    const r = classifyRun({ name: 'G', output: VITEST_GREEN })
    expect(r.report, 'a green mutation reported as "no teeth" alone invites the wrong fix · widening ' +
      'the gate · and that is the one the green invites (132b)').toMatch(/fixture already sat|nothing loaded/)
  })
})

describe('parseTally', () => {
  test('reads vitest and playwright, and refuses prose', () => {
    expect(parseTally(VITEST_GREEN)).toMatch(/4 passed/)
    expect(parseTally('  6 passed (4.7s)\n')).toMatch(/6 passed/)
    expect(parseTally('the tests are fine, honestly\n')).toBeNull()
  })
  test('a × inside PROSE is not a failing test line', () => {
    const r = classifyRun({ name: 'P', output: 'note: 3 × 4 is twelve\n      Tests  4 passed (4)\n' })
    expect(r.outcome, 'a multiplication sign in a log line was counted as a failure').toBe('GREEN')
  })
})

describe('withMutation always restores the byte copy', () => {
  test('restores after a THROWING exec · the case that actually loses work', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neo-mut-'))
    const f = join(dir, 'subject.js')
    const original = 'export const x = 1\n'
    writeFileSync(f, original)
    try {
      expect(() => withMutation(f, s => s.replace('1', '2'), () => { throw new Error('runner died') }))
        .toThrow('runner died')
      expect(readFileSync(f, 'utf8'), 'the harness left the subject MUTATED after the runner threw · ' +
        'this is how a mutation run silently corrupts uncommitted work').toBe(original)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  // ⚠ ADDED BECAUSE MUTATION H5 CAME BACK GREEN (T3 S65). H5 replaced the `finally` with a
  // `catch { restore; throw }`, which STILL restores on a throw · so the test above could not tell the
  // two apart. What it stops doing is restoring after a SUCCESSFUL run, leaving the subject mutated on
  // disk for every later mutation in the same sweep · which silently poisons every result after the
  // first. The mutation landed in the file and not in the measurement (Rule 132), and the green was
  // the finding rather than the formality.
  test('restores after a SUCCESSFUL exec too · the case a catch-only restore silently loses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neo-mut-'))
    const f = join(dir, 'subject.js')
    const original = 'export const x = 1\n'
    writeFileSync(f, original)
    try {
      const r = withMutation(f, s => s.replace('1', '2'), () => VITEST_GREEN)
      expect(r.landed).toBe(true)
      expect(readFileSync(f, 'utf8'), 'the subject is still MUTATED after a successful run · every ' +
        'mutation after this one in the same sweep would be measured against a corrupted baseline, and ' +
        'the sweep would look entirely normal').toBe(original)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  test('reports landed:false and does not run exec when the substitution misses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neo-mut-'))
    const f = join(dir, 'subject.js')
    writeFileSync(f, 'export const x = 1\n')
    let ran = false
    try {
      const r = withMutation(f, s => s.replace('NOPE', 'z'), () => { ran = true; return VITEST_GREEN })
      expect(r.landed).toBe(false)
      expect(ran, 'the runner was invoked for a mutation that never landed · the green it returns is ' +
        'indistinguishable from a guard with no teeth').toBe(false)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
