// Placement verification verdict for the bot simulator (T2 S30 · v4.7).
//
// Extracted from bot-simulate.js so it can be tested. It is the piece that decides whether a bot run
// is allowed to claim it placed anything, and it exists because the old whole-run comparison could not
// tell three different situations apart:
//
//   MATCH        the persisted board agrees with the clicks the bot counted
//   MISMATCH     the bot counted clicks the database never recorded  · the DB wins (Rule 53)
//   UNVERIFIABLE the database could not be read at all               · NOT a pass (Rule 61)
//
// The third is the one that cost six weeks. A June-28 prod report read `placedElements: 42` beside
// `dbPlacedCount: null`, the summary printed that null as a mild "N/A", the run exited 0, and the real
// production board had zero placements the whole time. "I could not check" must never render as
// "I checked and it was fine".
//
// Per GAME, not per run: a whole-run sum can cancel a +3 in one game against a -3 in another and call
// the result verified.

/** @param {Array<{game?:number, placedElements?:number, dbPlacedCount?:number|null}>} results */
export function placementVerdicts(results = []) {
  return results.map((r, i) => {
    const proxy = r.placedElements ?? 0
    const db = r.dbPlacedCount ?? null
    return {
      game: r.game ?? i + 1,
      proxy,
      db,
      verdict: db == null ? 'unverifiable' : (db === proxy ? 'match' : 'mismatch'),
    }
  })
}

/** True only when EVERY game was read from the database and agreed. Anything else is a failure. */
export function allPlacementVerified(results = []) {
  return results.length > 0 && placementVerdicts(results).every(v => v.verdict === 'match')
}
