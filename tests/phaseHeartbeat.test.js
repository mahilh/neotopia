// NeoTopia · the phase heartbeat's stage set is pinned from a second file (T3 S67).
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE DEFECT THIS EXISTS FOR, AND IT IS MINE
//
// Two live specs carry a "phase heartbeat": a `phase` variable set at each stage, and a catch that prints
// `✗ DIED IN PHASE "<name>" at +Xs`. It is the only reason a 300-second live failure says anything at all.
//
// In S64 I ported the mechanism into endgame-live.e2e.js. FOUR markers were written and THREE survived, so
// a failure inside the play loop reported `DIED IN PHASE "armed · the seeded state is on the wire"` · the
// stage BEFORE it. I read that as a seeding failure and went looking in the wrong half of the file.
//
//     A WRONG PHASE LABEL IS STRICTLY WORSE THAN A MISSING ONE: absent makes you look, wrong makes you
//     look somewhere else.
//
// And nothing could have noticed, because A HEARTBEAT CARRIES NO ASSERTION. It is pure console output; it
// is never read by a runner, never compared to anything, and its only consumer is a human reading a log
// weeks later. I found the missing marker in S66 only because a failure happened to land in the one gap.
// That is Rule 112a exactly · age is not evidence, it is the absence of evidence accumulating · in my own
// instrument, and Rule 100's shape (a guard applied to one member of a class) one level down: the class
// here is the STAGES of one file, and it silently lost a member.
//
// ── AND THE PORT LOST MORE THAN THE ONE MARKER, MEASURED ─────────────────────────────────────────────────
// Restoring it made the count right and left the GRANULARITY wrong, which no count could show:
//
//                              stages   code lines   awaits   worst region
//     host-departure-live         7         101         24        7 awaits
//     endgame-live (S66)          4         234         37       18 awaits   <- the play loop
//
// The mechanism was ported and the coverage was not. Both S66 failures landed in that 18-await region ·
// the agreement poll at +40.0s and spendOneAction at +28.3s · and BOTH reported the same word `play`. A
// label that cannot separate the failures it names is one better than no label and one short of a
// diagnosis. S67 marks the loop's six steps, which is why `play/...` keys exist below.
//
// ⚠ THE COARSENESS IS RECORDED HERE AND DELIBERATELY NOT GATED. A bound on awaits-per-stage would be a
// number sized from the file it guards (preamble §2 · a wire sized from its own run is a flake with a
// delay), and 18 of 37 is a hair under half, so any threshold near it flakes on the next edit. What IS
// gated is the stage SET, which is a fact rather than a tolerance.
//
// ── WHY A REGISTRY IN A SEPARATE FILE, AND NOT A COUNT ───────────────────────────────────────────────────
// A deleted marker leaves no structural trace except a bigger gap, and a bigger gap is also exactly what a
// legitimately-added region looks like · so nothing derived FROM the spec can tell the two apart. Rule 92:
// a check whose two sides come from one source cannot fail. The registry is the second source. It lives in
// a different file, so deleting a marker from a spec does not delete it from here; the comparison then has
// a real opponent, and it NAMES what went missing instead of reporting a number that got smaller.
//
// Adding a stage reds too. That is correct and not friction: a stage is a claim about where a failure can
// be, and recording it costs one line at the moment somebody is already thinking about it.
//
// PROSE IS NOT PINNED · only the KEY before the ` · `. Rewording a stage's explanation must not red a gate
// (Rule 94a · a gate that reports working code gets switched off before the day it is right), and the
// separator is asserted so a key can never silently become the whole string.

import { describe, test, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
// Reused, not re-written · a second comment stripper is a second contract that drifts (Rule 45). It is
// load-bearing here rather than cosmetic: BOTH specs discuss `DIED IN PHASE` in their own headers, so a
// scan that counted comments would classify every file that merely documents the mechanism as carrying it.
import { stripComments } from './walletTerminalSeam.js'

const ROOT = resolve(process.cwd(), 'tests')
const SELF = 'phaseHeartbeat'

// The literal the catch prints. Rule 125a: could I have deleted this token? Yes · it is my own string, in
// my own files, and it exists only because the branch that reports a phase exists. That is what makes it a
// fingerprint rather than something the framework would have emitted anyway.
const REPORTER = /DIED IN PHASE/

// A setter CALL whose argument is a string or template literal.
//
// ⚠ THE MECHANISM HERE IS NOT THE ONE I FIRST WROTE DOWN, and the difference is worth the paragraph
// because the FIX was right either way · which is precisely when a wrong explanation survives forever
// (Rule 129c · nobody re-derives the reason attached to advice that works).
//
// WHAT ACTUALLY HAPPENED: my exploratory probe was `\b(?:at|mark)\(` with NO literal requirement, and it
// matched `samples.at(-1)` in host-departure-live · Array.prototype.at, because `.` satisfies `\b`. That
// is the 8-calls-against-7-markers mismatch I measured, and it is a real Rule 112 defect in a probe of
// mine. I then wrote "the lookbehind stops it" into this comment. Measured, both ways:
//
//     samples.at(-1)       exploratory 1   shipped with \b 0   shipped with lookbehind 0
//     obj.mark('a · b')    exploratory 1   shipped with \b 1   shipped with lookbehind 0
//
// The LITERAL requirement alone already excludes `.at(-1)`. So the lookbehind does NOT earn its place
// against the line that motivated it · it earns it against a member call carrying a literal, which no
// file in this repo contains today. Its teeth are entirely in the fixture below, and that is a legitimate
// reason to keep it (Rule 112b · when the real world cannot reproduce the defect, the fixture IS the
// proof) but not the reason I nearly recorded. The two exclusions are independent: neither subsumes the
// other, so this is not a redundant guard (Rule 130a), it is two narrow ones.
const LITERAL_CALL = /(?<![.\w$])(?:at|mark)\(\s*(['"`])/g
// The same call, parsed down to its KEY: everything before the first ` · `.
const MARKER = /(?<![.\w$])(?:at|mark)\(\s*(['"`])\s*([^'"`]*?)\s·/g

/**
 * @returns {{ keys: string[], literalCalls: number, complete: boolean }}
 * `complete` is false when a setter was called with a literal this could not parse · a malformed marker
 * (no ` · `). That case must be UNMEASURED and never a quietly shorter list (Rule 80): a stage whose key
 * cannot be read is exactly as invisible to a reader of the log as a stage that was never marked.
 */
export function stageKeys(src) {
  const code = stripComments(String(src ?? ''))
  const keys = [...code.matchAll(MARKER)].map(m => m[2])
  const literalCalls = (code.match(LITERAL_CALL) ?? []).length
  return { keys, literalCalls, complete: literalCalls === keys.length }
}

export function hasReporter(src) {
  return REPORTER.test(stripComments(String(src ?? '')))
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'fixtures') walk(p, out) }
    else if (/\.(e2e|test)\.js$/.test(e) && !e.includes(SELF)) out.push(p)
  }
  return out
}

// ── THE SECOND SOURCE ────────────────────────────────────────────────────────────────────────────────────
// Every stage KEY, in source order. Not derived from the specs · that is the entire point.
const REGISTRY = {
  'tests/e2e/endgame-live.e2e.js': [
    'lobby', 'armed', 'play',
    // the six steps of one action-loop iteration (T3 S67). `play` still marks its entry; these overwrite
    // it as the iteration proceeds, so the catch reports the last step reached rather than the region.
    'play/read-host', 'play/terminal-check', 'play/agree', 'play/read-acting', 'play/act', 'play/end-turn',
    'terminal',
  ],
  'tests/e2e/host-departure-live.e2e.js': [
    'lobby', 'seat ownership', 'counterweight', 'departure', 'hold', 'unfreeze', 'DONE',
  ],
}

describe('the phase heartbeat has an assertion (Rule 112a · an instrument earns trust from being made to fail)', () => {

  // ══ COUNTERWEIGHTS FIRST (§2) ═══════════════════════════════════════════════════════════════════════
  // Everything below the counterweights is an equality against a list. If the extractor returns [] for
  // any reason, every one of those equalities is a comparison of two things it never read.

  test('COUNTERWEIGHT · the extractor finds a marker at all · nothing below means anything otherwise', () => {
    const r = stageKeys(`at('lobby · two real identities through the real lobby')`)
    expect(r.keys, 'the extractor cannot see a well-formed marker · every equality below is vacuous')
      .toEqual(['lobby'])
    expect(r.complete).toBe(true)
  })

  test('COUNTERWEIGHT · a RENAMED key is reported as the difference, through the real comparison', () => {
    // Rule 130b · a positive control has to exercise the MECHANISM it is about to assert the absence of,
    // not merely provoke the same observable. Pointing this at a nonexistent file would also "complain",
    // from a different branch entirely, and the key comparison would never execute once. So: a real
    // source, every marker present and readable, and EXACTLY ONE key reworded.
    const pinned = REGISTRY['tests/e2e/host-departure-live.e2e.js']
    const src = pinned.map((k, i) => `at('${i === 3 ? 'departed' : k} · prose that is not pinned')`).join('\n')
    const { keys } = stageKeys(src)
    expect(keys).toHaveLength(pinned.length)
    expect(keys).not.toEqual(pinned)
    expect(keys.filter((k, i) => k !== pinned[i]), 'the comparison did not isolate the one renamed stage · ' +
      'a gate that only reports "they differ" sends the reader to diff two lists by hand').toEqual(['departed'])
  })

  test('COUNTERWEIGHT · a MALFORMED marker is UNMEASURED, never a quietly shorter list (Rule 80)', () => {
    const r = stageKeys(`at('lobby two identities with no separator')`)
    expect(r.keys).toEqual([])
    expect(r.literalCalls, 'the call was not even counted · then a malformed marker vanishes silently and ' +
      'the registry check would report a missing stage, which is the wrong diagnosis').toBe(1)
    expect(r.complete, 'a marker the parser could not read must not be indistinguishable from a marker ' +
      'nobody wrote').toBe(false)
  })

  test('COUNTERWEIGHT · Array.prototype.at is not a stage marker (Rule 112, and it really happened)', () => {
    // TWO CASES, and only the SECOND is what the lookbehind is for · see the note on LITERAL_CALL. The
    // first is the line that motivated it (`samples.at(-1)`, a real line in host-departure-live, which
    // the literal requirement already excludes); the second is a member call carrying a literal, which
    // nothing in this repo does today, so this fixture is its only witness (Rule 112b).
    // The mismatch that started it · 8 calls against 7 markers in one file and 11 against 10 in the other
    // · had TWO different causes behind one number, and only the completeness pair separated them: a
    // member access here, and a legitimate no-literal delegation (`at` calls `mark`) there. Rule 130 ·
    // ask of any output how many ways it could have been produced.
    const r = stageKeys(`const peerAfter = samples.at(-1)\nconst x = obj.mark('nope · not a stage')`)
    expect(r.keys, 'a member access matched a stage marker · the extractor is a substring check with no ' +
      'boundary, in the guard written to stop a labelling defect').toEqual([])
    expect(r.literalCalls).toBe(0)
  })

  test('COUNTERWEIGHT · a comment ABOUT the mechanism is not the mechanism', () => {
    // Both specs discuss `DIED IN PHASE` in their own headers. Without stripping, every file that merely
    // documents the heartbeat would be classified as carrying one, and the class enumeration below would
    // demand registry entries for files that have no stages.
    expect(hasReporter(`// the next failure prints DIED IN PHASE "<name>"`),
      'a header sentence classified as an implementation').toBe(false)
    expect(hasReporter('console.log(`✗ DIED IN PHASE "${phase}"`)'), 'the real reporter went unseen').toBe(true)
    expect(stageKeys(`// at('ghost · a marker that was deleted and only discussed')`).keys).toEqual([])
  })

  // ══ THE GATES ════════════════════════════════════════════════════════════════════════════════════════

  test('every spec carrying the heartbeat is registered, and every registry entry still carries it', () => {
    // Rule 100 · a guard applied to one member of a class rots the moment the class grows. The class here
    // is "specs with a phase heartbeat", it grew from one to two when I ported the mechanism, and a guard
    // naming endgame-live would have said nothing about the file it was ported FROM.
    const files = walk(ROOT)
    expect(files.length, 'the walk found no spec files · this whole sweep just measured an empty list')
      .toBeGreaterThan(20)

    const carrying = files.filter(f => hasReporter(readFileSync(f, 'utf8')))
      .map(f => f.replace(`${resolve(process.cwd())}/`, '')).sort()
    expect(carrying.length, 'no spec carries a phase heartbeat · either both were deleted or the reporter ' +
      'was reworded, and in the second case every stage assertion below is being made about nothing')
      .toBeGreaterThan(0)
    expect(carrying, 'a spec carries a phase heartbeat and is not registered (or the reverse). Add it to ' +
      'REGISTRY with its stage keys · an unregistered heartbeat is exactly the state endgame-live was in ' +
      'for two sessions, quietly reporting the wrong stage.').toEqual(Object.keys(REGISTRY).sort())
  })

  test.each(Object.entries(REGISTRY))('%s · its stage set is what the registry says', (rel, pinned) => {
    const { keys, literalCalls, complete } = stageKeys(readFileSync(resolve(process.cwd(), rel), 'utf8'))

    expect(complete, `${literalCalls} stage setters were called with a literal and only ${keys.length} could ` +
      'be parsed · a marker is missing its ` · ` separator, so its key is unreadable and the report below ' +
      'is UNMEASURED rather than wrong').toBe(true)

    expect(new Set(keys).size, `duplicate stage keys in ${rel} · two places report the same name, so the ` +
      'catch cannot say which one it died in · which is the defect this file exists for, arrived by a ' +
      'different road').toBe(keys.length)

    expect(keys, `the stage set of ${rel} changed. If a stage was DELETED, a failure inside it now reports ` +
      'the stage before it, which sends the reader to the wrong half of the file (this cost me a session). ' +
      'If one was ADDED, record it here · that is one line, and the registry is a second source only for ' +
      'as long as it is maintained by hand on purpose.').toEqual(pinned)
  })
})
