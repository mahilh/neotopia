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
// use — calculateFinalScore = best + 2nd + worst*3 + unusedBonus*3 — so the audit record can never
// disagree with the number the player saw on screen. (The forge's payload referenced a non-existent
// `p.total`; the real total only exists via this engine call.)

import { calculateFinalScore } from './patternMatcher'

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

  const finalScores = players.map(p => {
    const scores = Array.isArray(p?.scores) ? p.scores : []
    const unusedBonus = Array.isArray(p?.bonusTokens) ? p.bonusTokens.length : 0
    const scoredCardIds = Array.isArray(p?.scoredCardIds) ? p.scoredCardIds : []
    return {
      seat: p?.seat ?? null,
      user_id: p?.userId ?? null,
      username: p?.username ?? null,
      scores,                                            // per-region totals [r0, r1, r2]
      unused_bonus: unusedBonus,                         // each unused token = 3 pts at game end
      districts: scoredCardIds.length,                   // cards this player scored (districts built)
      total: calculateFinalScore(scores, unusedBonus),   // engine = single source of truth
    }
  })

  // Rank by final total (desc) so the record reads as a leaderboard. Array.sort is stable, so a tie
  // keeps seat order — winner_seat is the lowest seat among the top scorers (documented tiebreak).
  const ranked = [...finalScores].sort((a, b) => b.total - a.total)

  return {
    eventType: GAME_END_EVENT_TYPE,
    eventData: {
      version: 1,
      final_scores: ranked,
      districts_built: finalScores.reduce((sum, p) => sum + p.districts, 0), // = global-index contribution
      winner_seat: ranked.length ? ranked[0].seat : null,
      // No client timestamp: game_events.created_at defaults now() server-side (verified live S8).
    },
  }
}
