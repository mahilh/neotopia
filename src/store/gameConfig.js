// NeoTopia · static game configuration · plain constants shared by the engine and the UI.
//
// These are deliberately NOT store state. A value identical for every game has no business being
// serialized into game_sessions.state (bloat on every realtime payload) or changing the engine state
// SHAPE — which the E2E seededState guard (tests/e2e) pins, and which a syncing client round-trips.
// Keeping them in their own module also keeps the hot, multi-lane gameStore.js untouched.

// Per-turn time budget (seconds) for the colonist.io-style UI turn countdown. The live per-second
// countdown + auto-end-turn is T1's LOCAL UI concern (see comms T2 S9 → T1): a turnTimeRemaining
// pushed to the DB every tick would be a write-storm, and seeding it from a timestamp inside endTurn
// would put a clock read in the replayed reducer (rule 32 · no Date in synced/replayable actions).
// T1 imports this constant to seed its local countdown and to auto-call handleEndTurn at 0.
export const TURN_TIME_LIMIT = 90

// NeoTopia game modes (T2 S15) · the FOUNDATION for real-time "Flow" play (Colonist-Rush-inspired). Each mode
// describes the parameters the game-START flow uses to seed a session; the engine itself stays mode-agnostic
// (it plays whatever tile deck + turn budget it is handed · so Flow = fewer tiles + a shorter clock, not a new
// reducer). The chosen mode is persisted on game_sessions.mode (migration 010) so a rejoining/spectating client
// knows which rules are live. The Lobby toggle (T1 lane) + createRoom wiring (useGameRoom · T3 lane) are handed
// off in comms · this module is the single source for the per-mode numbers.
export const GAME_MODES = {
  classic: {
    id: 'classic',
    label: 'Classic',
    tagline: 'Build the full civilization',
    description: 'Classic NeoTopia · 90s turns · 12 production tiles',
    TURN_TIME_LIMIT: TURN_TIME_LIMIT,
    END_GAME_TILE: 12,
    SIMULTANEOUS_DRAW: false,
  },
  flow: {
    id: 'flow',
    label: 'Flow',
    tagline: 'Pure creation · no waiting',
    description: 'NeoTopia Flow · 15s turns · 9 tiles · simultaneous draws',
    TURN_TIME_LIMIT: 15,
    END_GAME_TILE: 9, // numerology: 9 = completion · the civilization built in pure flow state
    SIMULTANEOUS_DRAW: true,
  },
}

export const DEFAULT_GAME_MODE = 'classic'

// Safe accessor · always returns a valid mode config (falls back to Classic for an unknown/missing id).
export const getModeConfig = (mode) => GAME_MODES[mode] ?? GAME_MODES[DEFAULT_GAME_MODE]

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE WALLET  (T2 S66 · Council decision, engine first, behind a flag)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Cards are BOUGHT rather than drawn free. The numbers are settled and are not re-derived here:
//   $1B per player, NOT a shared pool · symmetric wallets have zero runaway by construction
//   FLAT $70M for every card · not points-proportional
//
// WHY FLAT, in one line, because the reasoning is the thing that will be re-litigated and not the
// number: a card's chance of ever being built collapses with its value (2pt 93.0% · 3pt 73.1% ·
// 4pt 29.7% · 5pt 9.2%, docs/CARD_ECONOMY.md §3), so points-proportional pricing charges 2.5x more
// for the card that delivers a quarter as much and pushes wasted spend past half the wallet.
// Expected-delivery pricing fixes the arithmetic and encodes a BUILD-RATE DEFECT into the economy as
// though it were intended · it would make the eight landmark cards the cheapest things in the deck.
// Flat's ~46% wasted spend is a build-rate finding, not a pricing one (docs/WALLET_PRICE_SWEEP.md §3).
//
// MEASURED AT THIS PRICE, ~950 decided games per cell with Wilson intervals: the ladder SURVIVES ·
// architect vs apprentice 79.4% [76.7, 81.8], architect vs builder 60.0% [56.8, 63.1], builder vs
// apprentice 68.8% [65.7, 71.6]. The compression is mechanistic rather than statistical: apprentice
// and builder share drawBias 0.30, and that is exactly the pair the price does not move.
export const STARTING_WALLET = 1_000_000_000
export const CARD_PRICE = 70_000_000

/**
 * The price of one card.
 *
 * A FUNCTION whose body is a constant, deliberately, and taking the card it ignores. If per-card
 * pricing is ever chosen it becomes a change to this body; if the call sites took a bare constant it
 * would be a change to every call site, in three lanes, later. Costs nothing now.
 *
 * ⚠ AND IT CANNOT BECOME A FUNCTION OF THE CARD WITHOUT A DECISION ABOUT BLIND PURCHASES. The Offer
 * is four face-up cards (a shop) and the deck is a blind shift() (a lottery ticket), so a per-card
 * price cannot be quoted for a deck draw at all. Flat pricing makes that question disappear, which
 * is the fourth argument for starting here (docs/WALLET_AND_DEMOLITION_CONTRACT.md §2).
 */
export const priceOf = (_card) => CARD_PRICE

// THE FLAG. False means the field exists, serialises and round-trips, and NOTHING is ever refused ·
// every price is treated as 0 and the engine behaves exactly as it did before.
//
// THE FIELD LANDS BEFORE THE BEHAVIOUR ON PURPOSE. Adding `wallet` to every player changes the
// serialized state SHAPE, which the reconnect fixture pins; doing that in the same commit as a
// behaviour change would put two different kinds of risk in one diff. Shape first, flag second.
//
// ⚠ WHEN THIS FLIPS TO TRUE IT SHOULD BECOME PER-GAME STATE, NOT A MODULE CONSTANT · the same shape
// `mode` already has. A module constant is identical for every client of one BUILD, and a client on
// an older bundle would then disagree with its peer about whether cards cost money, which is a
// divergence in a replayed reducer (Rule 32). Safe today only because the flag is off everywhere.
export const WALLET_ENABLED = false
