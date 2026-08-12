// THE FIXED CI POOL · contract and bundle guard  (T2 S57)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Two things must hold and only one of them is about correctness:
//   1 · the pool's names are inside the swept namespace BY CONSTRUCTION · it must be impossible to
//       configure a member the cleanup cannot reach (the namespace has taken two strikes already)
//   2 · the branch that signs in with a PASSWORD cannot reach a player's browser
//
// ⚠ THE DISCRIMINATOR FOR (2) IS NOT THE OBVIOUS ONE, AND THE OBVIOUS ONE IS WORSE THAN USELESS.
// My first choice was `signInWithPassword` absent from the production bundle. MEASURED IN A DETACHED
// WORKTREE AT HEAD, BEFORE MY CHANGE EXISTED: it was already there, 1 file · it is the Supabase SDK's
// own method name, bundled whether or not any app code calls it. A guard keyed on it would report a
// leak on a permanently clean bundle, get read as noise, and be switched off (Rule 94a · a false
// positive is not the safe error).
// `VITE_E2E` is no good either: Vite SUBSTITUTES it, so the name reads 0 in BOTH builds and a guard
// keyed on its absence passes on a leaking bundle (my own S52 finding).
// THE ONE THAT WORKS IS MY OWN STRING CONSTANT, because a string literal survives minification and
// is only emitted if the branch that references it survives. Measured both ways:
//     VITE_E2E=true npm run build   ->  __neotopia_e2e_pool : 1     the branch is retained
//     npm run build                 ->  __neotopia_e2e_pool : 0     the branch is dropped
// Two-sided, on real artifacts, before this test was written.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  E2E_POOL_KEY, E2E_POOL_OUTCOME_KEY, POOL_OUTCOME,
  poolUsername, readPoolCredential, recordPoolOutcome, readPoolOutcome,
} from './e2ePool'
import { isSweptByPurge, RESERVED_USERNAME_PREFIXES } from './reservedNames'

describe('the fixed CI identity pool', () => {
  // ── COUNTERWEIGHT FIRST · the namespace strike this could become ────────────────────────────────
  // A fixed pool is a NEW PRODUCER in the identity namespace. S51 was a player able to CLAIM a
  // reserved name; S55 was 49 profiles produced OUTSIDE it. A third producer that has to REMEMBER
  // the convention is the third strike, built by hand. So the derivation is asserted before anything
  // else in the file: every member, at any index, must be reachable by the purge.
  it('every pool name is swept BY CONSTRUCTION, at any index', () => {
    for (const n of [0, 1, 7, 10, 42, 99]) {
      const u = poolUsername(n)
      expect(isSweptByPurge(u), `pool member ${n} is named "${u}", which purge_e2e_test_data can ` +
        'NEVER delete. A pool identity outside the namespace is a permanent row per member, and it ' +
        'is the third strike against the prefix scheme rather than a one-off').toBe(true)
    }
    // And it is DERIVED, not typed · retyping the prefix here would be the second contract that
    // makes the guard agree with itself (Rule 92a).
    expect(poolUsername(3).startsWith(RESERVED_USERNAME_PREFIXES[0])).toBe(true)
  })

  it('a missing or malformed credential reads as ABSENT, never as a broken one', () => {
    // The app must fall through to the shipped anonymous path when no harness has seeded anything ·
    // a developer's `npm run dev` is that case, every day. And a HALF-written credential must not be
    // handed to the auth call, because "the pool failed to authenticate" and "there is no pool" are
    // different outcomes with different owners (Rule 80).
    const store = {}
    globalThis.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v },
      removeItem: (k) => { delete store[k] },
    }
    expect(readPoolCredential(), 'no key set').toBe(null)
    store[E2E_POOL_KEY] = 'not json'
    expect(readPoolCredential(), 'malformed JSON').toBe(null)
    store[E2E_POOL_KEY] = JSON.stringify({ email: 'a@b.c' })
    expect(readPoolCredential(), 'password missing').toBe(null)
    store[E2E_POOL_KEY] = JSON.stringify({ email: '   ', password: 'x' })
    expect(readPoolCredential(), 'blank email').toBe(null)
    store[E2E_POOL_KEY] = JSON.stringify({ email: ' a@b.c ', password: 'x', index: 2 })
    expect(readPoolCredential(), 'a well-formed credential must be returned, trimmed')
      .toEqual({ email: 'a@b.c', password: 'x', index: 2 })
    delete globalThis.localStorage
  })

  // ── THE OBSERVABLE · COUNTERWEIGHT FIRST, AND IT IS ABOUT SAFETY NOT CORRECTNESS ────────────────
  // The pool outcome is published to a PAGE GLOBAL that any script on the page can read. Every other
  // assertion in this file is about whether the feature WORKS; this one is about whether adding it
  // makes anything worse, and it is written first because it is the one whose failure is not merely
  // a dead instrument (Rule 90 · the guard against the wrong fix has nothing else to hide behind).
  //
  // THE WRONG FIX IT FORBIDS is the obvious debugging convenience: recording the credential, or the
  // whole `pool` object, so a failing run says which member it tried. That would publish a working
  // password into a global on every E2E page · and the same branch is one build flag away from a
  // player's browser. An observable that leaks the thing it observes is worse than no observable.
  it('the published outcome can never carry the credential', () => {
    const PASSWORD = 'correct-horse-battery-staple'
    recordPoolOutcome(POOL_OUTCOME.GRANT_FAILED, `invalid login credentials for ${PASSWORD}`)
    // Deliberately hands it a detail string that DOES contain the password: the point is not that
    // callers are careful, it is that a reader can tell. This asserts the shape of the record so a
    // future caller passing an object cannot smuggle one in unnoticed.
    const rec = readPoolOutcome()
    expect(typeof rec.detail === 'string' || rec.detail === null,
      'detail must be a plain string or null · an object could carry a whole credential and would ' +
      'still serialise "fine" in a console').toBe(true)
    expect(Object.keys(rec).sort(), 'the record has exactly three fields · a new one is a new place ' +
      'for a secret to hide and must be reviewed here, not just added')
      .toEqual(['at', 'detail', 'outcome'])
    expect(Object.isFrozen(rec), 'a consumer must not be able to fake a pool outcome').toBe(true)

    // And the real assertion, on the real call sites: no caller may pass a credential VALUE.
    // Enumerated from the source rather than remembered, so a sixth call site added tomorrow is
    // covered by construction (Rule 98b).
    //
    // ⚠ THE FIRST VERSION OF THIS WENT RED ON CORRECT CODE, on its first run, and the fix is the
    // interesting part. It grepped the call site for /password/ and matched the ENGLISH WORD in the
    // message "the password grant returned an ANONYMOUS user". A guard that condemns a correct call
    // site is not conservative · it gets read as noise and switched off, and the day it is right
    // nobody is listening (Rule 94a). The token has to distinguish a VALUE from a WORD, so the
    // literal TEXT is stripped before matching and only code survives: quoted strings cannot
    // interpolate, and a template literal keeps only its ${...} expressions · which is exactly where
    // a leak would have to appear.
    const stripLiteralText = (s) => s
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, tpl => (tpl.match(/\$\{[\s\S]*?\}/g) || []).join(' '))

    const src = readFileSync(join(process.cwd(), 'src', 'hooks', 'useAuth.js'), 'utf8')
    const calls = src.match(/recordPoolOutcome\([\s\S]*?\)\n/g) || []
    const mentions = (src.match(/recordPoolOutcome\(/g) || []).length
    expect(mentions, 'no recordPoolOutcome call sites in useAuth.js · this test would be asserting ' +
      'nothing at all (zero leaks out of zero calls checked)').toBeGreaterThanOrEqual(4)
    expect(calls.length, 'the extractor captured fewer call sites than exist · the ones it missed ' +
      'are unchecked and this test reads green anyway, which is the vacuity it is guarding')
      .toBe(mentions)

    for (const c of calls) {
      const code = stripLiteralText(c)
        .replace(/recordPoolOutcome/g, '')      // the function's own name contains "Pool"
        .replace(/POOL_OUTCOME\.\w+/g, '')      // and NO_CREDENTIAL contains "cred"
      expect(/pool|cred|password|secret|token/i.test(code),
        `a recordPoolOutcome call site passes a credential VALUE, not just a word:\n${c}`).toBe(false)
    }
    delete globalThis.window[E2E_POOL_OUTCOME_KEY]
  })

  it('ABSENT and no-credential are different readings', () => {
    // Rule 95b, and it is the whole reason the enum does not have a "none" member. An absent record
    // means the app never reached the decision · overwhelmingly because a persisted session was
    // adopted first · and that is a different failure with a different owner from "the harness
    // seeded nothing". A single value covering both is the plausible zero this project keeps paying
    // for (Rule 80).
    delete globalThis.window[E2E_POOL_OUTCOME_KEY]
    expect(readPoolOutcome(), 'nothing decided yet must read as null, never as an outcome').toBe(null)
    recordPoolOutcome(POOL_OUTCOME.NO_CREDENTIAL, 'x')
    expect(readPoolOutcome().outcome).toBe(POOL_OUTCOME.NO_CREDENTIAL)
    expect(Object.values(POOL_OUTCOME), 'no enum member may mean "absent" · absence is the missing ' +
      'record itself').not.toContain(null)
    delete globalThis.window[E2E_POOL_OUTCOME_KEY]
  })

  it('the two bundle tokens are disjoint · neither can satisfy a substring guard for the other', () => {
    // RULE 112, ASSERTED RATHER THAN CHECKED ONCE BY EYE. The bundle guards below use `.includes`,
    // which is an identity check with no boundary. If a future key were named
    // `__neotopia_e2e_pool_outcome` it would CONTAIN the older token, so the older guard would pass
    // on a bundle where its own subject had been deleted · which is exactly how a 653-line spec sat
    // in no workflow for eleven sessions while its detector reported it wired.
    expect(E2E_POOL_OUTCOME_KEY.includes(E2E_POOL_KEY)).toBe(false)
    expect(E2E_POOL_KEY.includes(E2E_POOL_OUTCOME_KEY)).toBe(false)
  })

  // ⚠ ctx.skip(), NOT console.warn() AND A BARE RETURN · MEASURED, NOT PREFERRED (T2 S59).
  // Both un-measurable cases below used to warn and return, and I checked what that actually looks
  // like: `npx vitest run src/lib/e2ePool.test.js` on an E2E build printed NOTHING and reported
  // `Tests 6 passed (6)`. vitest does not surface console output for a passing test, so the honest
  // sentence explaining that nothing had been verified was invisible, and the security assertion in
  // this file read as GREEN in the one state where it had not run. That is the preamble's own
  // warning about a probe whose summary the runner eats, committed inside the file whose subject is
  // refusing to call an absence a pass. ctx.skip() routes the verdict through the RUNNER, which
  // counts it separately and cannot swallow it: the summary changes to `5 passed | 1 skipped`.
  it('the production bundle contains no password-sign-in branch', (ctx) => {
    const dist = join(process.cwd(), 'dist', 'assets')
    let files = []
    try { files = readdirSync(dist).filter(f => f.endsWith('.js')) } catch { /* no build */ }
    if (!files.length) {
      ctx.skip('UNMEASURED · no dist/assets. Run `npm run build` first. This is the assertion that ' +
        'keeps a credential path out of a player\'s browser, and it did not run.')
      return
    }
    const bundled = files.map(f => readFileSync(join(dist, f), 'utf8')).join('\n')

    // ── WHICH ARTIFACT IS THIS? THREE ANSWERS, NOT TWO  (T2 S59) ──────────────────────────────────
    // The S57 version of this test asked one question · "is BotAlpha here" · and read a NO as "this
    // is not our app". Measured tonight, that is wrong for a case that happens every time anybody
    // builds the harness locally:
    //     token                       prod   VITE_E2E=true
    //     neotopia_username_claimed     1          1        unconditional app code · ours
    //     BotAlpha                      1          0        reservedNames' own E2E bypass shakes it
    //     __neotopia_e2e_pool           0          1
    //     __neotopia_pool_outcome       0          1
    // So on an E2E build the old guard reddened with the message "a real browser carries a password
    // sign-in path" · a FALSE DIAGNOSIS of the most alarming kind available, produced by an artifact
    // that is behaving exactly as designed. Run `VITE_E2E=true npm run build` then vitest and you got
    // a security alarm about a correct build (Rule 94a, in my own guard, one session after I wrote
    // the header warning about picking discriminators badly).
    //
    // The two anchors are INDEPENDENT on purpose: the app anchor is a localStorage key in useAuth,
    // the build-mode anchor is a name list in reservedNames, and they are shaken by different gates.
    // A single token cannot tell "not our app" from "our app, other mode" (Rule 92 · two sides from
    // one source agree by construction), and collapsing those two is the whole defect above.
    const isOurApp = bundled.includes('neotopia_username_claimed')
    const isProdBuild = bundled.includes('BotAlpha')

    expect(isOurApp, 'the built bundle contains none of our own data · this is not the app, so the ' +
      'absence check below would pass for the wrong reason (zero leaks out of zero app code)').toBe(true)

    if (!isProdBuild) {
      ctx.skip('UNMEASURED · dist/ is a VITE_E2E build (our app, but BotAlpha is shaken out by ' +
        'reservedNames\' own E2E bypass). The pool tokens are SUPPOSED to be present here, so ' +
        'asserting their absence would report a leak on a correct artifact. Run `npm run build` ' +
        'and re-run · the production question is open, not answered.')
      return
    }

    expect(bundled.includes(E2E_POOL_KEY), `the pool's localStorage key "${E2E_POOL_KEY}" survives ` +
      'into the production bundle, which means the VITE_E2E branch was NOT eliminated and a real ' +
      'browser carries a password sign-in path. Verified reachable both ways when this was written: ' +
      'VITE_E2E=true build emits it, plain build does not · so a 1 here is a genuine regression, not ' +
      'a quirk of the minifier.').toBe(false)

    // T2 S59 · THE SECOND TOKEN, AND IT IS AN INDEPENDENT WITNESS RATHER THAN A REPEAT. The outcome
    // record is published from THREE call sites in useAuth, one of which lives in the persisted-
    // session adopt path rather than in attemptSignIn · a different region of the file, eliminated by
    // its own `if (import.meta.env.VITE_E2E)`. So a substitution or minifier change that stripped one
    // gate and not the other shows up here and nowhere else. Measured both ways on real artifacts
    // before this line was written, exactly as the first token was.
    expect(bundled.includes(E2E_POOL_OUTCOME_KEY), `the pool outcome key "${E2E_POOL_OUTCOME_KEY}" ` +
      'survives into the production bundle · a VITE_E2E gate was not eliminated. This token is ' +
      'emitted from the adopt path as well as the sign-in path, so it can red when the other passes.')
      .toBe(false)

    // THE THIRD TOKEN IS HERE BECAUSE IT WAS ALREADY WRONG ONCE, which is the only reason a token
    // earns an assertion. The outcome VALUES live in an exported object rather than inside a gated
    // branch, and the first draft froze that object · `Object.freeze` is a call, rollup will not
    // shake what it cannot prove pure, and every one of these strings shipped to production while
    // both key assertions above stayed green. Two guards agreeing did not cover a third surface
    // (Rule 118 · redundancy is not coverage). Enumerated from the enum so a new member is covered
    // without an edit here.
    for (const value of Object.values(POOL_OUTCOME)) {
      expect(bundled.includes(value), `the pool outcome value "${value}" is in the production ` +
        'bundle · the enum was pinned by something rollup could not tree-shake (a freeze, a call, ' +
        'a side effect). Measured 1 -> 0 when Object.freeze was dropped from POOL_OUTCOME.')
        .toBe(false)
    }
  })
})
