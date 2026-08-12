// NeoTopia · THE POOL HARNESS PROVES ITSELF (T3 S60) · zero identities, no sign-in, merge-gate cheap.
//
// WHY THIS FILE EXISTS RATHER THAN TRUSTING THE SPECS THAT USE IT. The browser conversion cannot be
// verified where it is written: the credentials are REPO SECRETS, so on a developer's machine every
// converted spec takes the anonymous fallback and passes, and the first execution of the real path is
// a CI run on the merge gate. That is exactly the shape that shipped inert in S59 · real in the code,
// dead in effect, green either way (T2 found it an hour after I pushed it).
//
// So the parts that CAN be proven without a credential are proven here, at full strength:
//   · the tripwire · two live contexts may never hold one member         (Council's rule, in code)
//   · the release  · a closed context frees its member                    (or the guard becomes noise)
//   · the write    · addInitScript really lands in the page's localStorage BEFORE any app script
//   · the honesty  · with nothing seeded, the reading is UNMEASURED and never a plausible pass
//
// ⚠ THE ONE THING THIS CANNOT PROVE, said before the results rather than after (preamble §3): that the
// APP then reuses the identity. That needs a real credential and a route that runs useAuth. It is
// asserted per-page by reportPoolOutcome inside the converted specs, and its first real execution is
// in CI. Nothing here should ever be read as "the browser conversion works".
//
// RUNS-NOWHERE: new this session · the workflows list specs explicitly and .github/ is T2's lane ·
// routed in comms/t3-s60-for-t2-the-browser-half-is-wired.md. It is ~2.2s, needs no backend and mints
// nothing, so it belongs on the merge gate rather than the nightly. DELETE THIS DECLARATION IN THE SAME
// COMMIT THAT WIRES THE FILE · a stale RUNS-NOWHERE: is a false claim that no run can contradict.
//
// COST · zero sign-ins. Every navigation is /practice, which mints no identity BY CONSTRUCTION (the
// practice route mounts a shell with no useAuth in its tree · asserted in practice.e2e.js, which fails
// on any auth request) and reaches no backend. The credential seeded below is SYNTHETIC and is never
// sent anywhere · a real one is never read, printed, or written by this file.

import { test, expect } from '@playwright/test'
import { seedPoolCredential, reportPoolOutcome } from './poolBrowser'
import { E2E_POOL_KEY } from '../../src/lib/e2ePool'

// A member index no real secret uses, with values that are obviously not credentials. Set on
// process.env so poolCredential() resolves it exactly as it resolves a real one · the seeding path
// under test is then byte-identical to the production one, which a hand-rolled fake would not be.
const FAKE = 9
const FAKE_EMAIL = 'e2e-harness-probe@example.invalid'
const FAKE_PASSWORD = 'not-a-real-password'

test.describe('the pool harness · what can be proven without a credential', () => {

  // ── COUNTERWEIGHT FIRST (Rule 90) ───────────────────────────────────────────────────────────────
  // Everything else in this file passes trivially if seedPoolCredential claims nothing at all. The
  // tripwire is the only assertion that requires the bookkeeping to exist, so it is written first with
  // nothing else to hide behind · and it is deliberately the case with NO credential present, because
  // the claim is about what the SPEC INTENDS and must red on a laptop with no secrets.
  test('TRIPWIRE · two live contexts may never hold the same pool member', async ({ browser }) => {
    const a = await browser.newContext()
    const b = await browser.newContext()
    try {
      await seedPoolCredential(a, { index: 0, label: 'holder' })
      await expect(
        seedPoolCredential(b, { index: 0, label: 'thief' }),
        'a second live context claimed member 0 and nothing stopped it · seat resolution is by userId, ' +
        'so both browsers would resolve to the SAME seat and each would believe it holds the other\'s ' +
        'turn. That is a broken spec wearing the costume of a saving, and it is the one failure mode ' +
        'the Council named as mine to prevent.',
      ).rejects.toThrow(/TRIPWIRE/)
    } finally { await a.close(); await b.close() }
  })

  test('COUNTERWEIGHT · a closed context RELEASES its member · sequential reuse must stay silent', async ({ browser }) => {
    // The tempting implementation is a claim that is never released, which passes the test above and
    // then reddens every file whose second test reuses member 0. A guard that condemns correct code
    // gets read as noise and switched off, and the day it is right nobody is listening (Rule 94a).
    const first = await browser.newContext()
    await seedPoolCredential(first, { index: 0, label: 'first' })
    await first.close()
    const second = await browser.newContext()
    await seedPoolCredential(second, { index: 0, label: 'second' })   // must NOT throw
    await second.close()
  })

  test('two live contexts with DIFFERENT members are exactly what the pool is for', async ({ browser }) => {
    const a = await browser.newContext()
    const b = await browser.newContext()
    try {
      await seedPoolCredential(a, { index: 0, label: 'host' })
      await seedPoolCredential(b, { index: 1, label: 'joiner' })
    } finally { await a.close(); await b.close() }
  })

  // ── THE WRITE ACTUALLY REACHES THE PAGE ─────────────────────────────────────────────────────────
  test('the seed lands in localStorage under the key the APP reads, before any app script runs', async ({ browser }) => {
    process.env[`E2E_POOL_EMAIL_${FAKE}`] = FAKE_EMAIL
    process.env[`E2E_POOL_PASSWORD_${FAKE}`] = FAKE_PASSWORD
    const ctx = await browser.newContext()
    try {
      const seed = await seedPoolCredential(ctx, { index: FAKE, label: 'write-probe' })
      expect(seed.seeded, 'poolCredential did not resolve a credential this test had just put in the ' +
        'env · the resolution path, not the seeding path, is broken').toBe(true)

      const page = await ctx.newPage()
      // /practice mints no identity by construction · this needs a real ORIGIN for localStorage, not
      // an app that authenticates. about:blank would have an opaque origin and no storage at all.
      await page.goto('/practice?bots=0')
      const raw = await page.evaluate((k) => localStorage.getItem(k), E2E_POOL_KEY)
      expect(raw, `nothing was written to "${E2E_POOL_KEY}". addInitScript is the only hook that runs ` +
        'BEFORE the app reads it, so a credential written any later is a credential the app never ' +
        'sees · which is indistinguishable from no pool at all, and green either way.').not.toBeNull()
      const parsed = JSON.parse(raw)
      expect(parsed.email, 'the seeded email is not the one asked for').toBe(FAKE_EMAIL)
      expect(parsed.index, 'the seeded record does not carry its member index · the app publishes this ' +
        'back in the outcome record and it is how a two-context spec is audited').toBe(FAKE)
    } finally {
      await ctx.close()
      delete process.env[`E2E_POOL_EMAIL_${FAKE}`]
      delete process.env[`E2E_POOL_PASSWORD_${FAKE}`]
    }
  })

  // ── THE READING IS HONEST WHEN THERE IS NOTHING TO READ ─────────────────────────────────────────
  test('with nothing seeded, the outcome is UNMEASURED · never a plausible pass', async ({ browser }) => {
    // Rule 80, in the place it costs most: if this reported success on a page that never ran the pool
    // branch, every converted spec would certify a conversion that had not happened, and the identity
    // counter (the only other witness) cannot tell a browser from a teardown.
    const ctx = await browser.newContext()
    try {
      const page = await ctx.newPage()
      await page.goto('/practice?bots=0')
      const v = await reportPoolOutcome(page, { seeded: false, index: 0, label: 'unseeded-probe' })
      expect(v.asserted, 'reportPoolOutcome ASSERTED on a page where nothing was seeded · it must ' +
        'report UNMEASURED, because "the app did not reuse" and "we never asked it to" are different ' +
        'facts and only one of them is a defect').toBe(false)
      expect(v.outcome, 'the practice route published a pool outcome · it runs no useAuth at all, so ' +
        'either the route now authenticates (a real regression, and an identity per practice game) or ' +
        'this probe is reading something that is not the app\'s record').toBeNull()
    } finally { await ctx.close() }
  })
})
