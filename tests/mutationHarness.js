// NeoTopia · the mutation harness, expressed as a function (T3 S65).
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS IS A MODULE AND NOT A HABIT
//
// I have hand-written this harness FOUR TIMES · S62 (keyboard flow), S63 (dev-server target), S64 (wallet
// seam), S65 (json substrings) · and each copy re-learned a different part of the discipline, always
// after it had already cost something. Rule 94b: when you have re-derived something four times, the
// COUNT is the finding. Rule 90's corollary: a rule stated as a fact gets rediscovered, a rule expressed
// as a function cannot be.
//
// THE FOUR THINGS EVERY COPY EVENTUALLY GREW, in the order they bit:
//   1 · restore from a BYTE COPY, never `git checkout --` · the file under test is often uncommitted, and
//       version control's idea of restore is "discard everything you have not committed" (Rule 112's
//       corollary · one run would have deleted the work it existed to prove).
//   2 · read the BASELINE first · four mutations all went "red" in a run whose unmutated baseline was
//       already failing, so the reds were free and meant nothing (Rule 110b).
//   3 · prove the mutation LANDED · a `perl -pi` regex that never matched returned green, and an
//       unapplied mutation and a toothless guard produce byte-identical output (Rule 124's corollary).
//   4 · REFUSE TO REPORT A RUN THAT PRODUCED NO TALLY. This is the one this module exists for.
//
// ── 4, IN FULL, BECAUSE IT IS THE ONE A COMMENT COULD NOT FIX ────────────────────────────────────────────
// In S64 a mutation of mine broke compilation. The harness printed `NO TALLY` as a row among five real
// rows, and I read a table of five results in which one was not a result. I caught it by eye. The next
// reader would not, and a compilation failure reads as "this mutation found no teeth" · which is the
// conclusion that gets acted on, and it is the opposite of the truth (the guard was never exercised).
//
// It is a VERDICT-SHAPED ABSENCE SITTING IN A VERDICT COLUMN, and this project has now produced that
// shape twice in three sessions from two lanes: T2 read a measured FAIL as a cancellation because their
// grep did not include the FAIL token (Rule 130's second corollary), and I read a compilation failure as
// a row. Both times the output was well-formed and the missing thing was the verdict itself.
//
// AND THE PREAMBLE ALREADY SAID IT · §2 carries "a mutation that breaks compilation tests nothing" and
// has since S44. I had read it, I have quoted it, and I still printed the row. That is Rule 128b exactly:
// a RIGHT comment fixes nothing on its own. So the refusal is structural · `runMutations` cannot emit a
// row for a run with no tally, because the only way out of that branch is `outcome: 'NO_RESULT'`.

import { readFileSync, writeFileSync } from 'node:fs'

/** Pull a vitest / playwright tally out of runner output. Null means NO RESULT · never zero. */
export function parseTally(output) {
  const s = String(output ?? '')
  const vitest = s.split('\n').filter(l => /Tests\s+\d/.test(l)).pop()
  if (vitest) return vitest.trim()
  const pw = s.split('\n').filter(l => /\d+ (passed|failed|skipped)/.test(l)).pop()
  return pw ? pw.trim() : null
}

/**
 * Classify ONE mutation run. Pure · the caller does the I/O, so both branches are testable with no
 * filesystem, no runner and no subprocess.
 *
 * @returns {{ outcome: 'BASELINE_GREEN'|'BASELINE_RED'|'RED'|'GREEN'|'NO_RESULT'|'DID_NOT_LAND',
 *             tally: string|null, reds: string[], report: string }}
 */
export function classifyRun({ name, isBaseline = false, landed = true, output = '' }) {
  // ── DID NOT LAND · before anything else. A text substitution that matched nothing produces a run
  //    indistinguishable from a guard with no teeth (Rule 124's corollary), so it is never a result.
  if (!landed) {
    return { outcome: 'DID_NOT_LAND', tally: null, reds: [],
      report: `${name}\n      ⚠ MUTATION DID NOT LAND · the file is unchanged, so this measured NOTHING.` }
  }

  const tally = parseTally(output)

  // ── NO RESULT · the refusal. Not a red, not a green, and it may not be rendered like one.
  if (tally === null) {
    const cause = String(output).split('\n')
      .find(l => /Error|SyntaxError|Cannot find|Transform failed|No test files/.test(l))?.trim().slice(0, 120)
      ?? 'no diagnostic captured'
    return { outcome: 'NO_RESULT', tally: null, reds: [],
      report: `${name}\n      ⛔ NO RESULT · the mutated tree produced no test tally, so this mutation\n` +
              '         measured NOTHING. It is not a red and it is not a green · most often the\n' +
              '         mutation broke compilation, in which case the guard was never exercised.\n' +
              `         cause · ${cause}` }
  }

  const reds = String(output).split('\n').filter(l => /^\s*[×✘]/.test(l)).map(l => l.trim().slice(0, 100))
  const isRed = reds.length > 0 || /\d+ failed/.test(tally)

  if (isBaseline) {
    return { outcome: isRed ? 'BASELINE_RED' : 'BASELINE_GREEN', tally, reds,
      report: isRed
        // Rule 110b · every red after this one is free and means nothing. Say so where it is read.
        ? `${name}\n      ⛔ BASELINE IS RED · ${tally}\n         STOP. Every mutation below would "red" for` +
          ' free and none of it would mean anything.'
        : `${name}\n      ${tally}\n      (baseline green · mutations below are interpretable)` }
  }

  return { outcome: isRed ? 'RED' : 'GREEN', tally, reds,
    report: `${name}\n      ${tally}\n` +
      (reds.length ? reds.map(r => `      RED · ${r}`).join('\n')
                   // A green mutation is a finding, not a formality · name both readings (Rule 132).
                   : '      (nothing red · either the guard has no teeth, OR the fixture already sat on\n' +
                     '       the mutated value, OR nothing loaded your file · all three are green)') }
}

/** Read a file, hand its contents to `fn`, write the result, run `exec`, and ALWAYS restore the byte copy. */
export function withMutation(file, fn, exec) {
  const original = readFileSync(file, 'utf8')
  const mutated = fn(original)
  const landed = mutated !== original
  if (!landed) return { landed: false, output: '' }
  try {
    writeFileSync(file, mutated)
    return { landed: true, output: exec() }
  } finally {
    writeFileSync(file, original)   // byte copy · never `git checkout --` (Rule 112's corollary)
  }
}
