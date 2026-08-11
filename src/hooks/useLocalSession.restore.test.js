// NeoTopia · A DEAD PRACTICE BOARD MUST NOT BE SILENTLY REINSTATED (T3 S44).
//
// MEASURED IN A BROWSER AT HEAD, not inferred: a practice game with no legal action (every factory empty,
// offer and deck empty, three actions remaining · the state a real audit reached naturally at Turn 33)
// restores exactly as it was, and End Turn is disabled BEFORE and AFTER the reload. The only escape is
// clearing sessionStorage['neotopia-practice-v1'] by hand, which is not an escape a player has.
//
// THE STORAGE LAYER DOES NOT DECIDE RESOLVABILITY, and that is the design. "Can this game still be
// played" depends on placement legality, the completing-element rule, the offer, the deck and every bot
// seat · a second implementation here would be a second rules engine (Rule 45/94) that throws away live
// games whenever it drifts from the real one. That is a worse failure than the soft-lock it fixes.
// So restore ASKS the engine and accepts UNKNOWN for an answer. T2 owns the check; it does not exist yet.
// These tests pin all three branches, so the day `isPracticeResolvable` lands the behaviour changes with
// no edit to this file · and if somebody wires it wrongly, the false-verdict test reds.

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { useGameStore } from '../store/gameStore'
import { engineSaysPlayable, PRACTICE_STORAGE_KEY } from './useLocalSession'

const savedGame = () => ({
  phase: 'playing', currentSeat: 0, turnNumber: 33, actionsRemaining: 3,
  players: [{ seat: 0, userId: 'practice-human', hand: [] }, { seat: 1, isBot: true, hand: [] }],
  theOffer: [], deck: [],
})

describe('restore consults the engine, and takes UNKNOWN for an answer (T3 S44)', () => {
  beforeEach(() => {
    const s = useGameStore.getState()
    if ('isPracticeResolvable' in s) useGameStore.setState({ isPracticeResolvable: undefined })
    try { sessionStorage.removeItem(PRACTICE_STORAGE_KEY) } catch { /* jsdom */ }
  })

  // ── COUNTERWEIGHT, WRITTEN FIRST (Rule 90) ────────────────────────────────────────────────────────────
  // The dangerous wrong version of this feature is not a missing check · it is a check that returns a
  // PLAUSIBLE BOOLEAN when it has no idea. `!!undefined` is false, and false here DELETES A PLAYER'S GAME.
  // So the first thing asserted is that with no engine check present the answer is null · not false, not
  // true · because the caller has to be able to tell "the engine says this is dead" from "nobody asked"
  // (Rule 80 · a counter that cannot measure must say so, never resolve to a number).
  test('UNKNOWN · with no engine check installed the verdict is null, never false', () => {
    expect(engineSaysPlayable(savedGame()), 'a missing check must not read as "unplayable" · that would ' +
      'discard live games on every restore').toBeNull()
  })

  test('UNKNOWN · a check that THROWS is also null · a crash must not delete a game either', () => {
    useGameStore.setState({ isPracticeResolvable: () => { throw new Error('engine blew up') } })
    expect(engineSaysPlayable(savedGame())).toBeNull()
  })

  test('the engine says PLAYABLE · the snapshot is restorable', () => {
    useGameStore.setState({ isPracticeResolvable: () => true })
    expect(engineSaysPlayable(savedGame())).toBe(true)
  })

  test('the engine says DEAD · and it is handed the snapshot, not the live store', () => {
    const seen = []
    useGameStore.setState({ isPracticeResolvable: (state) => { seen.push(state); return false } })
    const snap = savedGame()
    expect(engineSaysPlayable(snap)).toBe(false)
    // The check must judge the SAVED game, not whatever the store happens to hold · at restore time the
    // store is empty, so a check reading global state would answer about the wrong board entirely.
    expect(seen).toHaveLength(1)
    expect(seen[0], 'the engine was handed the live store instead of the snapshot').toBe(snap)
    expect(seen[0].turnNumber).toBe(33)
  })
})
