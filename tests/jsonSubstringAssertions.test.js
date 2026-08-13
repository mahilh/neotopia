// NeoTopia · a numeric JSON field may not be asserted by substring (T3 S65).
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE DEFECT THIS EXISTS FOR, MEASURED
//
// endgame-live.e2e.js's adoption gate · the one assertion standing between "the armed seed arrived" and
// "the ending we are about to witness is real" · was:
//
//     await expect.poll(async () => JSON.stringify(await read(page))).toContain('"tiles":1')
//
// A FRESH game has TWELVE production tiles, and `{"tiles":12,...}` contains the substring `"tiles":1`.
//
//     JSON.stringify({ ...tiles: 12... }).includes('"tiles":1')   ->   true
//     JSON.stringify({ ...tiles:  1... }).includes('"tiles":1')   ->   true
//
// It passed on precisely the state it existed to exclude, and it had done so since S39. Rule 112 · a
// substring match is an identity check with no boundary · in a load-bearing gate, quoted by me twice in
// the same month it sat there.
//
// IT COST A WRONG HEADLINE. In S64 I reported that a live run showed two clients ADOPTING the seed and
// then LOSING it, and reasoned toward a possible syncFromServer defect · which would be a multiplayer
// correctness bug in every live room. The poll never proved adoption. Nothing was clobbered. An
// 'absence after presence' claim is only as good as the presence half, and that half was vacuous
// (Rule 120, in the direction nobody checks: not a missing control, a control that cannot fail).
//
// ── WHY A GUARD AND NOT A NOTE ───────────────────────────────────────────────────────────────────────────
// Preamble §4 says grep for the siblings when you fix a wording defect. I did · exactly one instance in
// the whole repo. A note saying "do not do this again" goes red never (Rule 105a); Rule 90's corollary
// says when a mistake is worth remembering, express it as a function rather than as a fact. This is
// fifteen lines and it cannot be forgotten.
//
// ⚠ SCOPE, STATED SO IT IS NOT READ AS MORE THAN IT IS: this catches the NUMERIC case, where a prefix of
// a longer number silently matches. It deliberately does NOT ban `toContain` on strings and ids · 26 of
// the 27 uses in tests/e2e are exactly that and are correct. A guard that reported those would be read
// as noise and switched off long before the day it was right (Rule 94a).

import { describe, test, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
// Reused, not re-written · a second copy of a comment stripper is a second contract that drifts
// (Rule 45). It already exists for the wallet seam and is mutation-proven there.
import { stripComments } from './walletTerminalSeam.js'

const ROOT = resolve(process.cwd(), 'tests')
const SELF = 'jsonSubstringAssertions'

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'fixtures') walk(p, out) }
    else if (/\.(e2e|test)\.js$/.test(e)) out.push(p)
  }
  return out
}

/** `toContain('"key":123')` / `toMatch("\"key\":123")` / `` toMatch(`"key":123`) ``.
 *  The quote before the key may be a literal `"` (single/backtick-quoted string) or an ESCAPED `\"`
 *  (double-quoted string) · the escaped spelling was missed by the first draft and only the run said so. */
const NUMERIC_JSON_SUBSTRING =
  /\.(?:toContain|toMatch)\(\s*(['"`])((?:[^'"`\\]|\\.)*?(?:\\?")[A-Za-z_$][\w$]*(?:\\?")\s*:\s*-?\d+(?:[^'"`\\]|\\.)*?)\1\s*\)/g

export function findNumericJsonSubstrings(src, file = '') {
  // COMMENTS ARE NOT CODE, and the first run proved why it matters here specifically: the fix for the
  // real defect QUOTES the defective line in its own explanation, so the detector reported the
  // documentation of the bug as the bug. Rule 89 · a tool that scans the repo must exclude itself ·
  // and the version of that I keep meeting is the tool scanning the RECORD of what it fixed.
  const code = stripComments(String(src))
  const hits = []
  for (const m of code.matchAll(NUMERIC_JSON_SUBSTRING)) hits.push({ file, match: m[0].trim() })
  return hits
}

describe('a numeric JSON field may not be asserted by substring (Rule 112)', () => {

  // COUNTERWEIGHT FIRST (§2). The detector has to FIND the thing before its absence in the repo means
  // anything · an absence measured by a regex that matches nothing is the cheapest false green there is.
  test('the detector finds the real defect · the exact line that shipped for twenty-six sessions', () => {
    const hits = findNumericJsonSubstrings(
      `await expect.poll(async () => JSON.stringify(await read(page)), {}).toContain('"tiles":1')`)
    expect(hits, 'the detector cannot see the line it was built for · everything below is vacuous')
      .toHaveLength(1)
  })

  test('and it catches the shape in its other spellings', () => {
    for (const src of [
      `expect(s).toContain("\\"turnNumber\\":17")`,
      'expect(s).toMatch(`"rounds":2`)',
      `expect(s).toContain('"actionsRemaining": 3')`,
      `expect(s).toContain('{"seat":-1}')`,
    ]) {
      expect(findNumericJsonSubstrings(src), `missed: ${src}`).toHaveLength(1)
    }
  })

  test('and it does NOT fire on the 26 correct uses · ids, prose, and non-numeric fields', () => {
    for (const src of [
      `expect(hostHandIds).toContain(clickedId)`,
      `expect(msg).toContain('BACKEND UNREACHABLE')`,
      `expect(msg).not.toContain('mode-flow')`,
      `expect(s).toContain('"phase":"playing"')`,   // a STRING value · a prefix cannot straddle it
      `expect(page.url()).toContain('/game/')`,
      `expect(css).toContain('grid-template-columns')`,
    ]) {
      expect(findNumericJsonSubstrings(src), `false positive on: ${src} · a guard that reports working ` +
        'code gets read as noise and switched off before the day it is right (Rule 94a)').toHaveLength(0)
    }
  })

  test('THE REPO IS CLEAN · no test asserts a numeric JSON field by substring', () => {
    // This file carries the offending pattern as FIXTURES · scanning itself would report its own test
    // data as a defect, which is the same self-scan Rule 89 is about and which its first run did.
    const files = walk(ROOT).filter(f => !f.includes(SELF))
    // POSITIVE CONTROL, in the same run: an empty file list would make the sweep below trivially true,
    // and "no offenders" and "I read nothing" are the same green (Rule 120).
    expect(files.length, 'the walk found no spec files · this whole sweep just measured an empty list')
      .toBeGreaterThan(20)

    const hits = files.flatMap(f => findNumericJsonSubstrings(readFileSync(f, 'utf8'), f))
    expect(hits.map(h => `${h.file.replace(ROOT, 'tests')} · ${h.match}`),
      'a numeric JSON field is being asserted by substring. `{"tiles":12}` contains `"tiles":1`, so this ' +
      'passes on values it was written to exclude. Compare the VALUE: read the field and assert on it ' +
      '(`expect((await read(page)).tiles).toBe(1)`), never the stringified snapshot.').toEqual([])
  })
})
