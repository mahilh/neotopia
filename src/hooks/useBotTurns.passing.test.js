import { describe, test, expect } from 'vitest'
import { seatSignature } from './useBotTurns'

// T2 S46 · THE BOT COULD NOT PASS · the remainder of Rule 103.
//
// T3 measured the soft-lock still open after THREE correct fixes: T1's button unlocks End Turn, my S44
// terminal condition fires, and then the two-round endgame burn hands to a BOT that never moves again.
// Stuck 162 seconds, deliberately measured past the 90s turn limit before being called permanent.
//
// IT WAS NEVER A LEGALITY PROBLEM, which is why a fourth legality predicate would have been the wrong
// fix. chooseBotAction already returns { type: 'endTurn' } when it has no options (botPolicy.js:195),
// and the driver already has a safety net that ends the turn when an action is silently refused. The
// bot was not choosing wrongly · IT WAS NEVER BEING ASKED.
//
// The latch is keyed on seatSignature, and on a deadlocked board every component of it is a CONSTANT:
//   currentSeat            · cycles away and back to the same value
//   actionsRemaining       · resets to 3 every turn
//   phase                  · still 'playing'
//   hand.length            · a player who cannot act cannot draw
//   scoredCardIds.length   · nor score
// So when the turn came back to a bot the key was byte-identical to the previous turn, the effect read
// it as a StrictMode repeat and returned early, and the seat froze. endGameTriggered is necessary and
// NOT sufficient: the two-round burn is driven by seats ending their turns (Rule 103).
//
// turnNumber is the only component that always advances, and it costs the latch nothing: within a turn
// it is constant, so the double-invocation protection the latch was written for is unchanged.

const player = (over = {}) => ({ seat: 0, isBot: true, hand: [], scoredCardIds: [], ...over })

describe('the bot can always pass · the latch re-arms on a new turn', () => {
  // COUNTERWEIGHT FIRST (Rule 90). The cheap wrong fix is to make the key unique every time · a
  // timestamp, a counter, Math.random() · which unfreezes the bot AND destroys the StrictMode
  // protection the latch exists for, letting a bot silently play two actions per tick. That failure is
  // invisible: the game still moves, it just plays a different game than the one on screen. So the
  // FIRST thing asserted is that identical state still produces an identical key.
  test('THE COUNTERWEIGHT · the latch still blocks a repeat invocation within one turn', () => {
    const p = player()
    const a = seatSignature(p, 0, 3, 'playing', 7)
    const b = seatSignature(p, 0, 3, 'playing', 7)
    expect(b, 'identical state must still produce an identical key, or StrictMode double-invokes ' +
      'and every bot silently plays two actions per tick').toBe(a)
  })

  test('THE DEFECT · a deadlocked board produced a byte-identical key on the NEXT turn', () => {
    // Exactly the state T3 measured: nothing the old signature could see has changed between the bot's
    // turn N and its turn N+1, because a player who cannot act changes nothing about itself.
    const p = player()
    const legacy = (turn) => [0, 3, 'playing', 0, 0].join(':')   // the pre-S46 key, reconstructed
    expect(legacy(7), 'this is why the bot froze · the old key could not tell two turns apart')
      .toBe(legacy(8))

    // and the new key can
    expect(seatSignature(p, 0, 3, 'playing', 8))
      .not.toBe(seatSignature(p, 0, 3, 'playing', 7))
  })

  test('every other component stays load-bearing · turnNumber is added, nothing is replaced', () => {
    const base = seatSignature(player(), 0, 3, 'playing', 5)
    expect(seatSignature(player(), 1, 3, 'playing', 5), 'seat').not.toBe(base)
    expect(seatSignature(player(), 0, 2, 'playing', 5), 'actions').not.toBe(base)
    expect(seatSignature(player(), 0, 3, 'scoring', 5), 'phase').not.toBe(base)
    expect(seatSignature(player({ hand: [1] }), 0, 3, 'playing', 5), 'hand').not.toBe(base)
    expect(seatSignature(player({ scoredCardIds: ['c'] }), 0, 3, 'playing', 5), 'scored').not.toBe(base)
  })

  test('a missing turnNumber defaults rather than producing "undefined" in the key', () => {
    // The parameter is optional so the existing S33 tests keep their call shape. A default of 0 is a
    // real value; `undefined` stringified into the key would still be CONSTANT across turns, which is
    // the original bug wearing a different costume.
    expect(seatSignature(player(), 0, 3, 'playing')).toBe(seatSignature(player(), 0, 3, 'playing', 0))
    expect(seatSignature(player(), 0, 3, 'playing')).not.toMatch(/undefined/)
  })
})
