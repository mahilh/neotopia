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
import { E2E_POOL_KEY, poolUsername, readPoolCredential } from './e2ePool'
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

  it('the production bundle contains no password-sign-in branch', () => {
    const dist = join(process.cwd(), 'dist', 'assets')
    let files = []
    try { files = readdirSync(dist).filter(f => f.endsWith('.js')) } catch { /* no build */ }
    if (!files.length) {
      console.warn('[e2ePool] SKIPPED the bundle check · no dist/assets. Run `npm run build` first. ' +
        'This is the assertion that keeps a credential path out of a player\'s browser.')
      return
    }
    const bundled = files.map(f => readFileSync(join(dist, f), 'utf8')).join('\n')

    // VACUITY FIRST · a bundle that contains none of our data would pass the absence check below for
    // the wrong reason. BotAlpha is a string literal in a shipped export, so its presence proves this
    // really is our built app (the same anchor reservedNames.test.js uses).
    expect(bundled.includes('BotAlpha'), 'the built bundle contains none of our own data · this is ' +
      'not the app, so the absence check below proves nothing').toBe(true)

    expect(bundled.includes(E2E_POOL_KEY), `the pool's localStorage key "${E2E_POOL_KEY}" survives ` +
      'into the production bundle, which means the VITE_E2E branch was NOT eliminated and a real ' +
      'browser carries a password sign-in path. Verified reachable both ways when this was written: ' +
      'VITE_E2E=true build emits it, plain build does not · so a 1 here is a genuine regression, not ' +
      'a quirk of the minifier.').toBe(false)
  })
})
