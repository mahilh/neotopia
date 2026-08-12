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

// ── THE DESTINATION, RECORDED AND DELIBERATELY NOT BUILT (Council · Mahil, S52) ──────────────────
// THIS WHOLE MODULE IS A NAMING CONVENTION DOING A SCHEMA'S JOB. purge_e2e_test_data identifies the
// rows it may delete by how their username STARTS · a string a stranger can type and a harness must
// remember to produce. Everything here · the player-facing refusal, the E2E bypass at the call site,
// the SQL drift guard, the produced-identity leak guard · exists to hold that convention together.
//
// THE REAL FIX IS A COLUMN: `player_profiles.is_test boolean not null default false`, set by the
// harness, checked by the purge, invisible to and unclaimable by a player. It removes the collision
// class outright rather than guarding its edges.
//
// NOT BUILT, on purpose. It is a schema change plus a migration plus a harness change across two
// lanes, to fix a class that has collided exactly once. The guards below are cheap and they hold.
//
//   COUNCIL TRIPWIRE: IF THE PREFIX SCHEME COLLIDES A SECOND TIME, THE FLAG COLUMN STOPS BEING A
//   DESTINATION AND BECOMES THE FIX. One collision is a bug; two is the design telling you.
//
//   ⚠ SECOND STRIKE RECORDED S55 · 50 of 71 profiles carry no reserved prefix and can never be swept.
//   AND THE DESTINATION ITSELF IS NOW IN QUESTION · docs/TEST_IDENTITY_DESIGN.md (S56) measures that a
//   flag column SET BY THE HARNESS reproduces the exact failure it was chosen to end: a producer has
//   to remember to set it instead of remembering to name itself. The version that cannot be forgotten
//   stamps the row from the CREDENTIAL (a trigger reading auth.jwt()'s app_metadata, which a client
//   has zero grants to forge). Verified buildable; costed; not built. Mahil's call.
//
// SOPHIA'S DISSENT, RECORDED BECAUSE IT MAY WELL BE RIGHT: every new live spec is a new producer in
// this namespace, so a second collision is closer to certain than to unlikely. The counter-argument
// is that the S52 leak guard now makes a new producer fail LOUDLY at commit time rather than silently
// in production · which is precisely the thing that was missing when it collided the first time. If
// that guard ever has to be weakened or skipped, treat it as the second collision.

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
 * Would purge_e2e_test_data ACTUALLY delete a row with this username?
 *
 * ⚠ THIS IS NOT `isReservedUsername` WITH THE ARGUMENT THE OTHER WAY UP, AND USING THAT ONE HERE
 * WOULD BE A SILENT LEAK. The two functions answer opposite questions and therefore need opposite
 * strictness, which is the whole reason both exist (T2 S52):
 *
 *   isReservedUsername  · "may a PLAYER claim this?"      · answer NO generously  · case-INsensitive
 *   isSweptByPurge      · "can the CLEANUP reach this?"   · answer YES only truly · case-SENSITIVE
 *
 * Postgres `like 'E2E%'` is case sensitive. So a harness that produced `e2ehost` would be waved
 * through by isReservedUsername (which says "reserved, close enough, refuse a player") while the
 * purge could never match it · a test identity that lives in production forever. Erring strict is
 * correct for the player-facing question and is EXACTLY WRONG for this one: here an over-generous
 * answer means a row nobody can delete.
 *
 * Mirrors the SQL character for character. If the migration ever moves to `ilike`, this relaxes with
 * it and reservedNames.test.js's drift guard is what will notice.
 */
export function isSweptByPurge(name) {
  const n = String(name ?? '')
  return RESERVED_USERNAME_PREFIXES.some(p => n.startsWith(p))
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
