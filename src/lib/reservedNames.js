// RESERVED USERNAME PREFIXES · a namespace the cleanup routine owns  (T2 S51)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE DEFECT THIS CLOSES, found by T3 in S50 and it is a nasty one because it is silent and it costs
// a real person a real game.
//
// `purge_e2e_test_data()` selects rows to DELETE by username prefix:
//     username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%'
//
// and `claimUsername` did `name.trim().slice(0, 20)` with no validation at all. So a friend typing
// "E2Etest" into the claim screen got a profile inside the purge's scope, and the next CI run deleted
// their profile, their room, and (via ON DELETE CASCADE game_rooms -> game_sessions -> game_events)
// the game they were playing. No error, no warning, nothing in a log that names them.
//
// A RESERVED NAMESPACE WITH NO RESERVATION. The prefixes were treated as if they were ours because we
// only ever generated them ourselves; nothing stopped a player claiming one, and the failure lands on
// the one person who cannot possibly know the rule.
//
// ── WHY THIS LIST LIVES IN ITS OWN MODULE ────────────────────────────────────────────────────────
// It is one half of a two-sided contract whose other half is SQL and therefore cannot import it
// (Rule 45 · a second contract that drifts). The drift is guarded instead: reservedNames.test.js
// parses the prefixes back out of the migration file and requires the two to agree, so adding a
// pattern to the purge without adding it here goes red. That guard is the only thing making this a
// single source rather than a copy.
//
// ── STRICTER THAN THE PURGE, DELIBERATELY ────────────────────────────────────────────────────────
// Postgres `like` is case SENSITIVE, so 'e2etest' is not in the purge's scope today while 'E2Etest'
// is. This check is case-INSENSITIVE, which rejects a few names the purge would not have taken. That
// asymmetry is the right way round and is the whole point: the guard must be at least as strict as
// the thing it protects against, so that a later change from `like` to `ilike` cannot silently open
// a hole. Over-rejecting three prefixes nobody wants costs nothing; under-rejecting costs a game.

/**
 * Prefixes owned by the E2E harness and swept by purge_e2e_test_data().
 * MUST stay in sync with scripts/migrations/*.sql · enforced by reservedNames.test.js.
 */
export const RESERVED_USERNAME_PREFIXES = ['E2E', 'BotAlpha', 'BotBeta']

// ── WHY THE E2E BYPASS IS NOT IN THIS FILE, AND THAT IS THE SECOND DESIGN I TRIED ────────────────
// I SHIPPED THIS GUARD AND BROKE THE ENTIRE LIVE SUITE. The harness IS this namespace: every live spec
// claims its identity through the real UI as `uniqueName('E2E...')`, precisely so the purge can find
// and delete it afterwards. The guard refused the harness's own sign-in, and game-ux and reconnect died
// on the merge gate with a bare "Create Room" timeout naming nothing (T3 diagnosed and measured it ·
// run 31545142925, three retries identical, and staged VITE_E2E on the dev server for me). I wrote a
// rule this same session about auditing reasons for inaction, and did not run the one grep that would
// have found the biggest consumer of the exact prefixes I was reserving. Rule 101.
//
// The harness cannot rename off the prefix: the prefix is HOW purge_e2e_test_data finds its rows, so
// renaming trades a loud breakage for a permanent silent leak. So there has to be a bypass.
//
// MY FIRST FIX PUT IT HERE, and measuring the built bundle killed it. Reading the flag inside this
// module needs TWO reads · `import.meta.env?.VITE_E2E` for the browser and `process.env` for Node,
// because Playwright's audit imports this file directly with no Vite transform and the bare form
// throws TypeError. Only the first is substituted at build time, so the second left the literal
// VITE_E2E in the production bundle as a RUNTIME-readable switch · one `window.process = {env:{...}}`
// from being live in a real browser, in a module whose own comment claimed that was impossible.
//
// SO THIS FILE STAYS PURE and the bypass lives at the CALL SITE in useAuth.js, where a single
// `import.meta.env.VITE_E2E` is statically replaced and the whole branch is removed from a production
// build. The predicate is then honestly testable in any loader, which is also what lets the drift
// guard and T3's harness audit both call it without an environment.
// (Rule 110c · fix the design, do not widen the assertion that caught it.)

/**
 * Is this name inside a prefix the cleanup routine owns?  PURE · no environment, no bypass.
 * Compared case-insensitively and after trimming, because that is how the value reaches the DB.
 */
export function isReservedUsername(name) {
  const n = String(name ?? '').trim().toLowerCase()
  if (!n) return false
  return RESERVED_USERNAME_PREFIXES.some(p => n.startsWith(p.toLowerCase()))
}

/**
 * The message a PERSON sees. Named rather than inlined because the whole point of the fix is that the
 * player is TOLD, instead of having their name silently accepted and their game silently destroyed ·
 * so this string is the deliverable, not a detail.
 */
export function reservedUsernameError(name) {
  const hit = RESERVED_USERNAME_PREFIXES.find(p =>
    String(name ?? '').trim().toLowerCase().startsWith(p.toLowerCase()))
  return `Names starting with "${hit}" are reserved for automated testing · please choose another. ` +
    'A name in this range would be deleted along with your game.'
}
