// WHAT DOES THE SHIPPED BUNDLE SAY ABOUT THE WALLET?  (T2 S69)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// The flag flips in a commit that does nothing else, and the verification has to happen in the
// ARTIFACT rather than in src/ · a module constant is exactly the kind of thing a build can fold
// away, and "shipped" means the deployed origin (preamble §6).
//
// ⚠ THE OBVIOUS DISCRIMINATORS DO NOT WORK, MEASURED ON TWO REAL BUILDS TONIGHT. The plan was to
// check that `insufficient_funds` and `CARD_PRICE` are absent with the flag off and present after
// the flip. Neither discriminates:
//
//     token                 flag OFF   flag ON    verdict
//     insufficient_funds        2         2       USELESS · present either way
//     canAcquireCard            2         2       USELESS
//     no_actions                2         2       USELESS
//     not_your_turn             3         3       USELESS
//     CARD_PRICE (the NAME)     0         0       USELESS · substituted away
//     7e7  (the minified value) 0         1       ← the only one that moves
//
// The reason strings survive because they are returned data, not a branch the minifier can prove
// unreachable; `CARD_PRICE` as a NAME vanishes under substitution in BOTH builds, which is my own
// S52 finding arriving in a new costume (a guard keyed on a name that is substituted away reads 0
// whatever the truth is · Rule 125). The two bundles differ by 51 bytes in total.
//
// WHAT SURVIVES IS THE VALUE. With the flag off, `costOf` is `false ? priceOf(card) : 0`, which
// folds to `0`, which makes `priceOf` and the constant unreachable and drops the literal. With the
// flag on it is emitted. That is a token I OWN, two-sided-verified on real artifacts before this
// file was written · which is the standard Rule 125 sets and the reason it is `7e7` and not a name.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WALLET_ENABLED, CARD_PRICE } from './gameConfig'

/** Every minified form a JS bundler may choose for an integer. 70000000 and 7e7 are the two esbuild
 *  and rolldown actually emit; the rest are here so a bundler change shows up as a RED rather than
 *  as a silent "the wallet is not in the bundle". */
const priceForms = (n) => [String(n), n.toExponential().replace('+', ''), `${n / 1e6}e6`, `${n / 1e7}e7`]

describe('the wallet in the shipped artifact', () => {
  it('the bundle agrees with the flag · verified on the VALUE, not on a name', (ctx) => {
    const dist = join(process.cwd(), 'dist', 'assets')
    let files = []
    try { files = readdirSync(dist).filter(f => f.endsWith('.js')) } catch { /* no build */ }
    // A SKIP THROUGH THE RUNNER, never a silent return · vitest does not surface console output for
    // a passing test, so a bare `return` is indistinguishable from an assertion that ran (Rule 128a).
    if (!files.length) {
      ctx.skip('UNMEASURED · no dist/assets. Run `npm run build` first. This is the check that says ' +
        'whether the wallet actually reached a player\'s browser, and it did not run.')
      return
    }
    const bundled = files.map(f => readFileSync(join(dist, f), 'utf8')).join('\n')

    // ── KNOWN-PRESENT CONTROL FIRST · an absence proves nothing in an artifact you failed to read ──
    // A truncated read, a wrong path or an empty file makes every count 0, and 0 is the answer the
    // flag-off case expects. So ask the artifact something whose answer is already known
    // (preamble §3 · the uniform-zero shape, and the reason it is caught).
    expect(bundled.length, 'the bundle read as empty').toBeGreaterThan(100_000)
    expect((bundled.match(/neotopia/g) ?? []).length, 'the artifact does not contain our own app ' +
      'name · this is not the bundle you think it is, and every count below is meaningless')
      .toBeGreaterThan(0)

    const hits = priceForms(CARD_PRICE).reduce((n, f) => n + (bundled.split(f).length - 1), 0)

    if (WALLET_ENABLED) {
      expect(hits, `WALLET_ENABLED is TRUE in source and the price ${CARD_PRICE} appears in NO form ` +
        `in the bundle (looked for ${priceForms(CARD_PRICE).join(', ')}). Either the build folded ` +
        'the wallet away · in which case the flip shipped nothing and players still draw free · or ' +
        'the bundler chose a numeric form this test does not know. Both need a human.')
        .toBeGreaterThan(0)
    } else {
      expect(hits, `WALLET_ENABLED is FALSE in source but the price ${CARD_PRICE} IS in the shipped ` +
        'bundle. The dead-code elimination that makes the flag safe is not happening, so the wallet ' +
        'branch is reaching real browsers while every test here runs against the disabled engine.')
        .toBe(0)
    }
  })
})
