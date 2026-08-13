// NeoTopia · the test process and the browser must be pointed at the SAME Supabase project (T3 S67).
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PAID FOR IN TWO IDENTITIES, AND IT REPORTED ITSELF AS A MULTIPLAYER SYNC DEFECT
//
// A live run of endgame-live in a detached worktree failed with
//
//     seat 0 never received the armed state over postgres_changes · the row holds
//     productionTilesRemaining 1, so this is the subscription or syncFromServer
//
// which is an accusation about the product. It was the environment, and BOTH HALVES WERE INDIVIDUALLY
// CORRECT · they simply disagreed:
//
//     browser   wynccumuisjxbptjlfwq    playwright's webServer runs `npm run dev`, which goes through
//                                       with-project-env; the worktree has a .env.local, so the guard
//                                       stripped the inherited VITE_* exactly as designed
//     node      gsogycwtllthrenqaxlh    I ran `npx playwright test` directly, which does NOT go through
//                                       the guard, so the TEST process inherited the shell's credentials
//                                       for a dead project · ENOTFOUND
//
// So the spec's seeding UPDATE landed in a different project from the one the app was reading. Nothing was
// lost, nothing was clobbered, and the gate that said "the seed never arrived" was telling the truth about
// a question nobody had asked.
//
// THIS IS TWO KNOWN RULES COMPOSING, WHICH IS WHY NEITHER ONE CAUGHT IT:
//   Rule 131  worktree + env guard · a linked worktree has no .env.local unless you put one there
//   Rule 93   the test env and the browser env are two different contracts, and only one of them was gated
// `assertBackendReachable` takes a `page`. It proves the BROWSER can reach a backend. It has never had an
// opinion about where the NODE side is pointed, and it passed happily on the run above.
//
// ── WHY IT READS TRAFFIC AND NOT CONFIG ──────────────────────────────────────────────────────────────────
// The browser's side is measured from `performance.getEntriesByType('resource')` · what the page ACTUALLY
// talked to · rather than from `import.meta.env` or the client's `supabaseUrl`. Two reasons, and the
// second is the one that matters:
//   1 · `/src/lib/supabase.js` does not exist in a production bundle, so a config read works in dev only.
//   2 · a config read and the node env are the same KIND of reading. Rule 116's corollary: when a probe
//       confirms a source read, check that it reads a DIFFERENT LAYER, not merely that it runs somewhere
//       else. Traffic is the composed value; config is the text.
//
// ── IT THROWS ONLY ON TWO PRESENT, DISAGREEING HOSTS ─────────────────────────────────────────────────────
// A missing node env and a page that has issued no request are UNMEASURED, never a pass and never a red.
// This runs inside a precondition every live spec calls, so a false positive would red a shared gate for
// another lane (§5), and neither absence can produce the defect: the failure needs the node side to be
// pointed at a WRONG host, not at no host.

/**
 * @param {?string} nodeUrl        process.env.VITE_SUPABASE_URL as the TEST process sees it
 * @param {string[]} browserHosts  supabase hosts the PAGE actually issued requests to
 * @returns {{ verdict: 'AGREE'|'MISMATCH'|'UNMEASURED', nodeHost: ?string, browserHosts: string[], why: string }}
 */
export function compareProjects(nodeUrl, browserHosts) {
  const hosts = (browserHosts ?? []).filter(Boolean)
  let nodeHost = null
  try { nodeHost = nodeUrl ? new URL(nodeUrl).host : null } catch { nodeHost = null }

  // UNMEASURED, NEVER A PASS (Rule 80). Two distinct absences, and neither is evidence of agreement.
  if (!nodeHost) {
    return { verdict: 'UNMEASURED', nodeHost, browserHosts: hosts,
      why: 'the test process has no readable VITE_SUPABASE_URL · it cannot disagree with the browser ' +
        'about a project it never contacts. Not a pass.' }
  }
  if (!hosts.length) {
    return { verdict: 'UNMEASURED', nodeHost, browserHosts: hosts,
      why: `the page has issued no *.supabase.co request yet, so what the browser talks to is unknown. ` +
        `The node side is ${nodeHost}. Not a pass.` }
  }
  return hosts.includes(nodeHost)
    ? { verdict: 'AGREE', nodeHost, browserHosts: hosts, why: `both sides are on ${nodeHost}` }
    : { verdict: 'MISMATCH', nodeHost, browserHosts: hosts,
        why: `the TEST PROCESS is on ${nodeHost} and the BROWSER is talking to ${hosts.join(', ')}. ` +
          'Anything this spec writes server-side lands in a different project from the one the app is ' +
          'reading, so a seeded state will never arrive and the symptom looks like a sync defect. Run ' +
          'through the env guard (`npm run test:e2e --`, never a bare `npx playwright test`), which ' +
          'strips inherited VITE_* when a .env.local is present.' }
}

/**
 * Throw on a MISMATCH, naming both sides. ONE copy of this sentence · preconditions.js and lobby.js both
 * call it, and a second wording would drift (Rule 45).
 *
 * CALL IT AS EARLY AS THE BROWSER HAS TRAFFIC TO SHOW, which means right after the FIRST context signs
 * in and before a second one exists. That ordering is the entire saving: a mismatch caught there costs
 * one identity instead of two plus a five-minute run plus a wrong diagnosis (Rule 93's corollary · prove
 * the isolated thing works BEFORE you pay for a measurement inside it).
 *
 * ⚠ AND IT REQUIRES A **MEASURED** VERDICT, NOT MERELY THE ABSENCE OF A MISMATCH (T3 S69).
 * S67 shipped this printing `[project] AGREE` and asserting nothing. I wrote the log line specifically
 * to expose the state where the guard is present and inert · and then exposed it to a human reading a
 * log rather than to an assertion, which is the same defect one level up. One observation of AGREE is
 * not evidence that UNMEASURED cannot happen: it arises whenever the test process has no
 * VITE_SUPABASE_URL, or the page has issued no request yet on a slow boot, and in BOTH of those states
 * a wrong-project run proceeds exactly as it did before this file existed.
 *
 * `require` defaults TRUE and the opt-out takes a REASON, so switching it off is a decision somebody
 * wrote down rather than a default nobody chose.
 *
 * DENOMINATOR, because a finding needs one (Rule 121) and because I overstated this in S67: the only
 * runtime callers of runTwoHumanLobby are endgame-live (in NO workflow) and host-departure-live (the
 * nightly). I published "imported by 15 specs" · that number is in lobby.js's header, it belongs to
 * `seedHelpers` before the S47 split, and I attached a true number to the wrong subject (Rule 97b).
 * lobby.js is imported by TWO. So this guard protects one nightly spec and every local live run I
 * make, which is where it actually fired.
 *
 * @returns {Promise<'AGREE'|'MISMATCH'|'UNMEASURED'>} · MISMATCH and (by default) UNMEASURED throw
 */
export async function assertProjectAgreement(page, { context = '', require = true, why = '' } = {}) {
  const where = context ? ` (${context})` : ''
  const r = compareProjects(process.env.VITE_SUPABASE_URL, await readBrowserProjectHosts(page))
  if (r.verdict === 'MISMATCH') {
    throw new Error(
      `PRECONDITION${where}: WRONG PROJECT · not a feature regression, not an ` +
      `outage, and not a sync defect.\n  ${r.why}\n` +
      'This cost a live run and two identities in S67, and it reported itself as "the seeded state ' +
      'never arrived over postgres_changes".'
    )
  }
  if (r.verdict === 'UNMEASURED' && require) {
    throw new Error(
      `PRECONDITION${where}: THE PROJECT GUARD COULD NOT MEASURE · so it is present and inert, and a ` +
      'wrong-project run from here on is indistinguishable from a correct one.\n' +
      `  ${r.why}\n` +
      '  node side    ' + (r.nodeHost ?? 'ABSENT · run through the env guard (`npm run test:e2e --`)') + '\n' +
      '  browser side ' + (r.browserHosts.length ? r.browserHosts.join(', ')
        : 'NO *.supabase.co request observed yet · call this after the first sign-in, not before') + '\n' +
      'If a caller genuinely cannot measure, pass { require: false, why: "<reason>" } · which is a ' +
      'decision somebody wrote down rather than a silent default.'
    )
  }
  if (r.verdict === 'UNMEASURED' && !require) {
    console.log(`[project] UNMEASURED · REQUIREMENT WAIVED${where} · ${why || 'no reason given'}`)
  }
  return r.verdict
}

/** The page-bound half, deliberately thin · the DECISION lives in compareProjects, where a unit test can
 *  hold it and jsdom is not asked to have a network (Rule 78's corollary). Never throws. */
export async function readBrowserProjectHosts(page) {
  return await page.evaluate(() => [...new Set(
    performance.getEntriesByType('resource')
      .map((e) => { try { return new URL(e.name).host } catch { return null } })
      .filter((h) => h && /\.supabase\.co$/.test(h)),
  )]).catch(() => [])
}
