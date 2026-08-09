// NeoTopia · game_end audit-event payload builder (T2 S8).
//
// PURPOSE: when a game reaches phase === 'scoring', exactly ONE client appends a `game_end` row to
// the game_events audit log — the permanent civilization record (final score per player + districts
// built) that powers replay and the NeoTopia legacy ("a civilization that leaves no record leaves no
// legacy"). This module owns the PURE derivation of that payload from store state.
//
// It deliberately does NOT:
//   · perform any network write — rule 32: never put a side-effect in the synced/replayable reducer.
//     The owning lane fires it ONCE at the 'scoring' transition (FinalScore reveal effect, the same
//     localStorage-guarded one-shot that fires recordCivilizationContribution · see comms T2→T1/T3 S8).
//   · decide WHEN to fire — that is the consumer's job.
//
// The final `total` is computed with the SAME engine fn the store (getFinalScore) and FinalScore.jsx
// use · calculateFinalScore = best + 2nd + worst*3 + unusedBonus*3 + clusterBonus · so the audit record
// can never disagree with the number the player saw on screen. (The forge's payload referenced a
// non-existent `p.total`; the real total only exists via this engine call.)
//
// CLUSTER BONUS (board game rule p9): PER PLAYER since T2 S35. It was board-global from S18 until then ·
// one number added identically to everybody, which inflated every total equally and could not change a
// ranking. Hexes now carry `placedBy`, so each seat scores 1 point per token OF THEIR OWN on the biggest
// cluster of each element per region, and this is the first term in the audit that differs between players.
// Still regions-GUARDED below: a payload built from { players } alone has no board to walk, so every
// cluster bonus is 0 and the audit still matches a screen computed the same way. A snapshot that DOES carry
// regions (getState(), tests, the live FinalScore caller) gets each player's own bonus folded in.
//
// PAYLOAD VERSION 2. `final_scores[]` gains `cluster_bonus` and `total` is no longer a shared-bonus total.
// The 3 historical rows are all version 1, all 0-0 with a 0 bonus, so nothing needs migrating · a reader
// must branch on `version` rather than assume the field exists.

import { calculateFinalScore, getClusterTotal } from './patternMatcher'

// The event key the persistence layer expects. useGameSync.EVENT_TYPE_DB maps 'gameEnd' → the
// DB-allowed 'game_end' (game_events_event_type_check). We export the SHORTHAND, never the raw
// 'game_end': 'game_end' is NOT a key in EVENT_TYPE_DB, so passing it would fall through the map and
// the audit insert would be silently skipped (the same class of seam bug that left the move-event
// audit log empty — see comms T2 S8). gameEndEvent.test.js guards this mapping against the live map.
export const GAME_END_EVENT_TYPE = 'gameEnd'

// Build the { eventType, eventData } pair to hand to sync.pushState(eventType, eventData).
// `state` is a game-store snapshot (e.g. useGameStore.getState() or a serializableState()).
export function buildGameEndEvent(state) {
  const players = Array.isArray(state?.players) ? state.players : []

  // The board, walked once per player below. regions-guarded: absent (a { players }-only payload) → every
  // bonus is 0 → totals still match a screen computed the same way (see header note).
  const regions = Array.isArray(state?.regions) ? state.regions : []

  const finalScores = players.map(p => {
    const scores = Array.isArray(p?.scores) ? p.scores : []
    const unusedBonus = Array.isArray(p?.bonusTokens) ? p.bonusTokens.length : 0
    const scoredCardIds = Array.isArray(p?.scoredCardIds) ? p.scoredCardIds : []
    // THIS seat's own cluster points (board game rule p9 · T2 S35). A seat that is null cannot own a token,
    // so it gets the honest 0 rather than the board total · never fall back to the global reading here, that
    // is precisely the no-op this change exists to remove.
    const clusterBonus = typeof p?.seat === 'number' ? getClusterTotal(regions, p.seat) : 0
    return {
      seat: p?.seat ?? null,
      user_id: p?.userId ?? null,
      username: p?.username ?? null,
      scores,                                                          // per-region totals [r0, r1, r2]
      unused_bonus: unusedBonus,                                       // each unused token = 3 pts at game end
      cluster_bonus: clusterBonus,                                     // own tokens on each biggest cluster (v2)
      districts: scoredCardIds.length,                                 // cards this player scored (districts built)
      total: calculateFinalScore(scores, unusedBonus, clusterBonus),   // engine = single source of truth
    }
  })

  // Rank by final total (desc) so the record reads as a leaderboard. Array.sort is stable, so a tie
  // keeps seat order — winner_seat is the lowest seat among the top scorers (documented tiebreak).
  const ranked = [...finalScores].sort((a, b) => b.total - a.total)

  return {
    eventType: GAME_END_EVENT_TYPE,
    eventData: {
      version: 2, // v2 (T2 S35): final_scores[].cluster_bonus, and totals are per-player rather than shared
      final_scores: ranked,
      districts_built: finalScores.reduce((sum, p) => sum + p.districts, 0), // = global-index contribution
      winner_seat: ranked.length ? ranked[0].seat : null,
      // No client timestamp: game_events.created_at defaults now() server-side (verified live S8).
    },
  }
}
