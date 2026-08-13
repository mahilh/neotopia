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
 * @returns {Promise<'AGREE'|'MISMATCH'|'UNMEASURED'>} · MISMATCH never returns, it throws
 */
export async function assertProjectAgreement(page, { context = '' } = {}) {
  const r = compareProjects(process.env.VITE_SUPABASE_URL, await readBrowserProjectHosts(page))
  if (r.verdict === 'MISMATCH') {
    throw new Error(
      `PRECONDITION${context ? ` (${context})` : ''}: WRONG PROJECT · not a feature regression, not an ` +
      `outage, and not a sync defect.\n  ${r.why}\n` +
      'This cost a live run and two identities in S67, and it reported itself as "the seeded state ' +
      'never arrived over postgres_changes".'
    )
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
