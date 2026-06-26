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
