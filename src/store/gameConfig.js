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
