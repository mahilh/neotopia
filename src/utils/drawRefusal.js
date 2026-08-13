// WHY THE DRAW WAS REFUSED, IN WORDS A PLAYER CAN ACT ON (T1 S69).
//
// ── THE SEAM THIS COMPLETES ──────────────────────────────────────────────────────────────────────
// `tryDrawCard` has returned `{ ok, reason, cost, balance }` since S66. Two layers threw it away
// until T2 S68 carried it to the caller, and they stopped there on purpose: the SURFACE is T1's. So
// a refused draw has been SILENT for the whole life of the product · no message, no sound, nothing ·
// and with a price it becomes "the card did nothing and nobody said why", which is the exact failure
// the enum was built to make impossible.
//
// ⚠ THIS IS A DESCRIPTION, NEVER A SECOND PREDICATE (Rule 45/94). Every branch is chosen by a value
// the engine already produced. Nothing here decides whether a draw is legal, and nothing here reads
// a wallet, a price or a turn · which is what stops the message and the refusal disagreeing the day
// pricing stops being flat.
//
// ⚠ AND `insufficient_funds` CARRIES THE NUMBERS ON PURPOSE. "You cannot afford this" invites a
// player to click again; "$50M · this costs $70M" ends the question in one reading. Both figures
// come off the same object that refused, so they cannot drift from what was charged.
import { formatMoney } from './formatMoney'

/**
 * Every reason the engine can return, mapped to player-facing copy.
 *
 * A MAP RATHER THAN A SWITCH, so `Object.keys` is enumerable and a gate can bind it to the engine's
 * own literals · a reason T2 adds later must red a test here rather than fall through to a generic
 * line that hides it (Rule 80 · never resolve to a plausible nothing, and Rule 98a · the alarm is
 * precise, the remedy is "write the copy", not a number).
 */
export const DRAW_REFUSAL_COPY = {
  insufficient_funds: (r) => `You have ${formatMoney(r.balance)} · this card costs ${formatMoney(r.cost)}`,
  no_actions: () => 'No actions left · end your turn',
  no_card: () => 'Nothing left to draw',
  not_your_turn: () => 'Not your turn',
  no_seat: () => 'You are not seated in this game',
}

/**
 * @param {{ok:boolean, reason:string, cost:number, balance:number}} outcome  tryDrawCard's return
 * @returns {string|null} the line to show, or null when there is nothing to explain
 *
 * `ok` returns null rather than empty string · "there was no refusal" and "the refusal has no words"
 * are different states and only one of them is a bug.
 */
export function drawRefusalCopy(outcome) {
  if (!outcome || outcome.ok) return null
  const fn = DRAW_REFUSAL_COPY[outcome.reason]
  // THE FALLBACK IS DELIBERATE AND IT IS NOT THE SAFETY NET · the gate is. A player must never see a
  // raw enum token, so an unknown reason still says something; the test that binds this map to the
  // engine's literals is what stops an unknown reason from ever reaching a player in the first place.
  return fn ? fn(outcome) : 'That draw was refused'
}
