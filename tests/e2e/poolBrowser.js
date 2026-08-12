// NeoTopia · THE POOL'S BROWSER HALF (T3 S60) · Playwright-only, and SPLIT FOR A MEASURED REASON.
//
// ⚠ THIS LIVED IN seedHelpers.js FOR ABOUT TWENTY MINUTES AND BROKE A GATE, WHICH IS THE WHOLE REASON
// THE FILE EXISTS. seedHelpers is imported by STANDALONE `node` .mjs harnesses; this code imports
// src/lib/e2ePool, and e2ePool imports './reservedNames' with NO EXTENSION · which Playwright's bundler
// resolves and raw node ESM does not. So one import here would have killed every standalone harness at
// load time, before its first assertion. That is exactly the S23 rot: migration 011 cited an empirical
// proof that could not execute for nineteen sessions because seedHelpers had picked up one extensionless
// specifier. harnessIntegrity.test.js was built after that and it caught me inside a single suite run.
//
// AND I HAD WRITTEN THE CAVEAT INTO THE COMMENT ON THE IMPORT ITSELF · "raw node ESM does not, because
// e2ePool imports ./reservedNames extensionless · Rule 97" · while adding the import. Knowing the
// mechanism and naming it in the same edit did not stop me committing it; the gate did (Rule 119's
// corollary · a rule you have read does not protect the code you write while thinking about something
// else). The durable fix is one character in T2's lane and is routed; this split is correct anyway.
//
// THE SPLIT IS A REAL BOUNDARY, NOT A WORKAROUND: everything here takes a Playwright BrowserContext or
// Page and imports `expect` from @playwright/test, so it could never serve a node harness. Same shape as
// fixtureNames.js, which was split out so vitest could reach the pure half without Playwright's loader.
// The pure, node-safe half · loadEnv, poolCredential, signInPooledOrAnon · stays in seedHelpers.

import { expect } from '@playwright/test'
import { poolCredential } from './seedHelpers'
// Imported, never retyped · a hand-copied '__neotopia_e2e_pool' would be a second contract that agrees
// today and drifts silently (Rule 45), and T2's bundle guard already turns on that exact string.
import { E2E_POOL_KEY, E2E_POOL_OUTCOME_KEY, POOL_OUTCOME } from '../../src/lib/e2ePool'
// Re-exported so a SPEC never has to import e2ePool itself. That is not tidiness: e2ePool reaches
// './reservedNames' with no extension, and any file that imports it becomes unloadable under raw node
// ESM · which is how I reddened harnessIntegrity in S60. Keeping the blast radius to this one module
// means a future spec cannot repeat it by copying an import line.
export { E2E_POOL_KEY }

// seedHelpers signs in NODE clients. A browser mints through the app's own useAuth, and browser
// bursts were 78% of the measured churn · so the node conversions were the cheap half and this is the
// expensive one. T2 built the app side in S57-S59 and named this contract in e2ePool.js:36: "the
// localStorage key the harness writes before the app boots (Playwright context.addInitScript)".
// NOTHING CALLED IT. The app has read the credential since S57 and no harness has ever written one.
//
// THE CONSTANTS ARE IMPORTED, NOT RETYPED, and that is checked rather than assumed: Playwright's
// loader resolves src/lib/e2ePool.js (verified · it imports ./reservedNames extensionless, which is
// fatal under raw `node` ESM and fine here · the Rule 97 defect that killed two draw harnesses for 19
// sessions). A retyped '__neotopia_e2e_pool' would be a second contract that agrees today and drifts
// silently (Rule 45), and T2's own bundle guard already turns on that exact string.
//
// ⚠ MY S58 SIZE NOTE ABOVE IS WRONG ABOUT THE MECHANISM AND IS KEPT WITH THIS CORRECTION BESIDE IT
// (Rule 101b · the old claim is the argument for the new one). It says the two-context specs need two
// members because "seat resolution is BY userId". The COUNT is right and the reason is not: those
// contexts never call anything in this file, they sign in through the app, and readPoolCredential
// reads localStorage · which is PER CONTEXT. So one member serving two contexts was never forced by
// the design, it is simply a mistake this helper now refuses to let a spec make.
const liveClaims = new Map()

/**
 * Write pool member `index` into a browser context, before the app boots.
 *
 * THE INDEX IS CLAIMED EVEN WHEN NO CREDENTIAL EXISTS, and that is the design decision that makes the
 * tripwire testable at all. The claim is about what the SPEC INTENDS, not about whether the env
 * happens to be wired · so the "two contexts, one member" bug reddens on a developer's laptop with no
 * secrets, rather than only on the one CI run where it would silently seat two browsers as one player.
 * Claims are released when the CONTEXT CLOSES, not at the end of the file: sequential tests reusing
 * member 0 are correct and must stay quiet, or the guard becomes noise and gets switched off (94a).
 */
export async function seedPoolCredential(context, { index = 0, label = 'context' } = {}) {
  const held = liveClaims.get(index)
  if (held !== undefined) {
    throw new Error(
      `[pool] TRIPWIRE · member ${index} is already held by "${held}" and "${label}" asked for it too. ` +
      'Two live contexts on one identity is not a saving, it is a broken spec: seat resolution is by ' +
      'userId, so both browsers resolve to the SAME seat and each believes it holds the other\'s turn. ' +
      'Give the second context its own index (the pool has 4 members: 0..3).')
  }
  liveClaims.set(index, label)
  context.on('close', () => { if (liveClaims.get(index) === label) liveClaims.delete(index) })

  const cred = poolCredential(index)
  if (!cred) {
    console.log(`[pool] ${label} · browser · NO CREDENTIAL for member ${index} · the app will mint anonymously (unconverted, not converted-and-free)`)
    return { seeded: false, index }
  }
  await context.addInitScript(({ key, email, password, index }) => {
    try { localStorage.setItem(key, JSON.stringify({ email, password, index })) } catch { /* blocked storage · the app falls back, and says so */ }
  }, { key: E2E_POOL_KEY, email: cred.email, password: cred.password, index })
  console.log(`[pool] ${label} · browser · seeded member ${index} · the APP decides from here, and __neotopia_pool_outcome will say which branch it took`)
  return { seeded: true, index }
}

/**
 * Assert that THIS PAGE reused a pool identity, and report honestly when it cannot be known.
 *
 * ⚠ THIS EXISTS BECAUSE THE IDENTITY COUNTER CANNOT ANSWER THE QUESTION. T2's warning, and it is the
 * one that makes or breaks the claim: a fall in auth.users after this lands will be the TEARDOWNS,
 * which converted in S59 and are already proven reusing member 0. "Browsers converted" and "teardowns
 * converted" move the same number in the same direction, so the aggregate is unfalsifiable evidence.
 * `window.__neotopia_pool_outcome` is written by the app IN THE PAGE, so a node teardown cannot
 * produce it and cannot be mistaken for it. Per-context, per-page, and it names the branch.
 *
 * ABSENT IS NOT A STATE (Rule 95b · T2's own note on this record). A missing record means the app
 * never reached the decision · in a fresh context the live cause is a persisted anonymous session
 * pre-empting the pool · which is a different fact from "there was no credential", and collapsing
 * them turns a diagnosed failure into a shrug.
 */
export async function reportPoolOutcome(page, { seeded, index, label = 'context' }) {
  const rec = await page.evaluate((k) => (typeof window === 'undefined' ? null : window[k] ?? null), E2E_POOL_OUTCOME_KEY)
  if (!seeded) {
    console.log(`[pool] ${label} · browser · UNMEASURED · nothing was seeded for member ${index}, so ` +
      `"${rec?.outcome ?? 'absent'}" says nothing about reuse either way`)
    return { asserted: false, outcome: rec?.outcome ?? null }
  }
  expect(rec, `[pool] ${label} · a credential WAS seeded for member ${index} and the page carries no ` +
    'pool outcome at all. Absent means the app never reached the decision · the reachable cause is a ' +
    'persisted anonymous session adopted before attemptSignIn ran, which bypasses the pool entirely. ' +
    'That is a different defect from a refused grant and must not be read as one.').not.toBeNull()
  expect(rec.outcome, `[pool] ${label} · seeded member ${index} and the app took the "${rec?.outcome}" ` +
    'branch instead of reusing. grant-failed is a credential or alias defect (check the workflow env ' +
    'map, not this file); minted-in-disguise means the grant returned an ANONYMOUS user, which passes ' +
    'every other check while still costing an identity; no-credential means the seed never reached the ' +
    'page. Any of the three means this context minted and the conversion is not real.')
    .toBe(POOL_OUTCOME.REUSED)
  console.log(`[pool] ${label} · browser · REUSED member ${index} · 0 identities minted by this context`)
  return { asserted: true, outcome: rec.outcome }
}

