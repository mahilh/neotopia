// THE RECEIPT'S PARTIAL-STEP READER · and the one property it must never lose  (T2 S60)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// ci-receipt.cjs exists to refuse to call an absence a pass. Its counterweight has already failed
// once, in exactly that way: mutating the workflow parser to yield nothing printed
// "PASS · all 0 expected workflows returned a green verdict" and exited 0 · a perfect green receipt
// for a commit nothing had built, from the tool whose whole subject is that mistake.
//
// The step reader added in S60 is the same shape one level down. A cancelled run keeps its step
// conclusions (measured: five of six cancelled runs also keep their logs · the sixth was cancelled
// before its job started), so the receipt can now say HOW FAR a cancelled run got. The failure mode
// is a ratio: "8 of 9 steps completed green" is read as a pass by every habit a human has, and it
// would be printed under a verdict that says UNMEASURED, which is precisely the not-red-versus-green
// confusion this tool was built to end.
//
// So the invariant is asserted here rather than promised in a comment: EVERY non-empty rendering
// names something that did not complete. Until S60 this file could not exist at all · ci-receipt.cjs
// called main() at module level, so requiring it executed a live CI query and exited.

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { stepLines, conditionalStepNames } = require('./ci-receipt.cjs')

const step = (name, conclusion) => ({ name, conclusion, status: 'completed' })
const detail = (o) => ({
  total: 0, green: [], notRun: [], stopped: [], failed: [], conditionalSkipped: 0, ...o,
})

// The four shapes a real run produces, taken from measured runs rather than imagined:
//   A  31637130091  cancelled at its LAST step · 8 of 9 green, nothing skipped
//   B  a run cancelled during post-job bookkeeping · every graded step green (the vacuous one)
//   C  31637021028  cancelled at step 6 · the four spec steps never ran
//   D  31637099680  cancelled before the job started · zero steps, zero log lines
const SHAPES = [
  ['A · halted at the last step', detail({
    total: 9, green: Array.from({ length: 8 }, (_, i) => step(`s${i}`, 'success')),
    stopped: [step('Run practice-mode E2E', 'cancelled')],
  })],
  ['B · every graded step green, run still not completed', detail({
    total: 9, green: Array.from({ length: 9 }, (_, i) => step(`s${i}`, 'success')),
  })],
  ['C · halted early, four steps never ran', detail({
    total: 9, green: Array.from({ length: 5 }, (_, i) => step(`s${i}`, 'success')),
    stopped: [step('Install Playwright chromium', 'cancelled')],
    notRun: ['reconnect', 'ENGINE', 'card-art', 'practice'].map(n => step(n, 'skipped')),
  })],
]

describe('ci-receipt · the partial-step reader', () => {
  // ── COUNTERWEIGHT, WRITTEN FIRST · and it is the invariant, not a case ─────────────────────────
  // Deliberately STRUCTURAL rather than keyed on my own wording. A token check ("does the output
  // contain the string NEVER RAN") is a second contract that drifts the moment the prose is
  // reworded, and it would agree with itself (Rule 92a). The property is simpler and cannot be
  // reworded away: the ratio is line one, so a rendering that says only the ratio is one line long.
  // Any additional line IS the statement of what did not complete · there is nothing else to say.
  it('never renders a bare ratio · every graded shape says what did not complete', () => {
    for (const [label, d] of SHAPES) {
      const lines = stepLines(d, 2)
      expect(lines.length, `${label} rendered NOTHING · the verdict then stands alone with no ` +
        'evidence, which is the state this reader was added to improve on').toBeGreaterThan(0)
      expect(lines.length, `${label} rendered ONLY the ratio:\n${lines.join('\n')}\n` +
        'A ratio with no statement of what is missing from it reads as a pass. That is the exact ' +
        'defect this file guards, one level down from "PASS · all 0 expected workflows".')
        .toBeGreaterThan(1)
      expect(lines[0], label).toMatch(/steps completed green/)
    }
  })

  it('a job that never started says NOTHING ran · not "0 of 0 green"', () => {
    // The genuine no-data case, and the one most at risk of rendering as a vacuous ratio: zero of
    // zero steps green is arithmetically true, is a pass in every reading, and describes a run that
    // verified absolutely nothing (Rule 80 · zero blocked out of zero checked).
    const lines = stepLines({ neverStarted: true }, 2)
    expect(lines.join('\n')).toMatch(/NOTHING ran/)
    expect(lines.join('\n')).not.toMatch(/completed green/)
  })

  it('an unreadable detail says so and leaves the verdict alone', () => {
    // "I could not look" must never render as "there was nothing to see" (Rule 95b). And it must
    // not overstate either · the run's own verdict is unaffected by this tool failing to enrich it.
    const lines = stepLines({ unavailable: 'gh run view --json jobs failed' }, 2)
    expect(lines.join('\n')).toMatch(/UNAVAILABLE/)
    expect(lines.join('\n')).toMatch(/verdict above stands/)
  })

  it('no detail at all renders nothing · a PASS row must stay clean', () => {
    expect(stepLines(null, 2)).toEqual([])
  })

  it('a conditional step is excluded from BOTH sides of the ratio, and the exclusion is disclosed', () => {
    // `Upload report on failure` carries `if: failure()` and is SUPPOSED to skip on a healthy run.
    // Counting it as never-run inflates the alarm; counting it as green inflates the reassurance.
    // This appeared on the reader's FIRST execution, reporting NEVER RAN about correct behaviour ·
    // a gate that cries wolf on a working run gets switched off (Rule 94a).
    const lines = stepLines(detail({
      total: 9, green: Array.from({ length: 8 }, (_, i) => step(`s${i}`, 'success')),
      stopped: [step('Run practice-mode E2E', 'cancelled')], conditionalSkipped: 1,
    }), 2)
    expect(lines[0]).toMatch(/8 of 9 steps completed green/)
    expect(lines[0]).toMatch(/conditional/)
    expect(lines.join('\n')).not.toMatch(/NEVER RAN/)
  })
})

describe('ci-receipt · the conditional-step parser, against the real workflows', () => {
  it('finds every `if:`-guarded named step, with a control on the raw count', () => {
    // A POSITIVE CONTROL IN THE SAME RUN (Rule 120): an absence here is indistinguishable between
    // "no conditional steps exist" and "the parser matched nothing", and the second is the one that
    // silently restores the false positive above. So the parser's yield is checked against a raw
    // count taken a different way, from the same file.
    // process.cwd(), not `new URL(..., import.meta.url)` · under vitest's jsdom environment
    // import.meta.url is an http:// URL and readFileSync throws "The URL must be of scheme file".
    // The same convention every other fs-reading test in this repo uses, for the same reason.
    const text = readFileSync(join(process.cwd(), '.github', 'workflows', 'e2e.yml'), 'utf8')
    const rawIfLines = text.split('\n').filter(l => /^\s+if:/.test(l)).length
    const found = conditionalStepNames('e2e.yml')
    expect(rawIfLines, 'e2e.yml has no `if:` step at all · this test is asserting nothing, and the ' +
      'exclusion it protects is unexercised').toBeGreaterThan(0)
    expect(found.size, `parsed ${found.size} conditional steps from e2e.yml against ${rawIfLines} ` +
      'raw `if:` lines · the parser is missing steps, so they will be reported as NEVER RAN on ' +
      'every cancelled run and the reader will be read as noise').toBe(rawIfLines)
    expect([...found].some(n => /failure/i.test(n))).toBe(true)
  })

  it('a workflow file that does not exist yields an empty set, not a throw', () => {
    expect(conditionalStepNames('no-such-workflow.yml').size).toBe(0)
  })
})
