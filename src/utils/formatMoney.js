// THE WALLET READOUT'S TEXT, AND ITS WIDTH BOUND (T1 S67).
//
// ── WHY A WIDTH BOUND IS THE POINT, NOT THE FORMATTING ───────────────────────────────────────────
// The ActionBar is the one row in this product with no room. Measured at HEAD, 320px, no tokens:
// 298.1px of demand into a 296px content box · so it is ALREADY 2.1px over and already wrapping onto
// a second line, today, for every player. The readout has ~46px to live in, bought by deleting the
// three action dots (see ActionBar.jsx).
//
// A READOUT WHOSE WIDTH DEPENDS ON ITS VALUE IS A CONSTANT TUNED AT ONE POINT OF A CURVE · which is
// the defect I shipped in S64 (a per-character title budget from one sample) and again in S66 (4px
// of strip padding measured only at 320). Sizing this from the STARTING balance would be the third:
// `$1.00B` and `$70M` differ by 9.5px, the bar has 6px of slack, and the overflow would appear
// mid-game at a balance no fixture ever visits. So the width is bounded over the WHOLE REACHABLE
// DOMAIN, which is finite and enumerable, and the bound is asserted rather than assumed.
//
// THE DOMAIN IS SMALL BECAUSE THE PRICE IS FLAT. A wallet only ever decreases, by exactly CARD_PRICE
// (gameConfig · priceOf is a function whose body is a constant), so the reachable balances are
// STARTING_WALLET - k*CARD_PRICE for k = 0..14. Fifteen values, every one measurable.
import { STARTING_WALLET, CARD_PRICE } from '../store/gameConfig'

/**
 * Every balance a player can ever hold, largest first.
 *
 * DERIVED, never typed · if T2 retunes either constant this set changes and the width gate below
 * reds with a string it has no measurement for, which is the alarm we want (Rule 98a · write the
 * alarm precisely and the remedy provisionally · the remedy here is "re-measure", and it names the
 * probe rather than prescribing a number).
 */
export function reachableBalances(start = STARTING_WALLET, price = CARD_PRICE) {
  if (!(price > 0)) throw new Error(`reachableBalances: price ${price} · every balance is reachable`)
  const out = []
  for (let b = start; b >= 0; b -= price) out.push(b)
  return out
}

/**
 * A balance as a player reads it. `$1.00B` above a billion, `$930M` below it.
 *
 * THE `$` IS THE ACCESSIBLE LABEL AND IT COSTS 8.3px. A bare `930` in the action bar is a number
 * beside two other numbers (actions left, seconds left) and says nothing about which; `$930M` is
 * self-describing in eight pixels, which is cheaper than any word. The sr-only prefix in ActionBar
 * carries the same information for a screen reader at zero width.
 */
export function formatMoney(n) {
  if (!Number.isFinite(n)) return '$0'
  const v = Math.max(0, n)
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`
  return `$${Math.round(v / 1_000_000)}M`
}

// ── MEASURED, NOT REASONED (Rule 81) ─────────────────────────────────────────────────────────────
// Every string the formatter emits over the reachable domain, measured in Chromium in the action
// bar's own font · ui-sans-serif 13px/500 with tabular-nums, copied off my-turn-badge rather than
// guessed (Rule 125 · a discriminator you did not author is not your fingerprint).
// tabular-nums is what makes the three-digit forms identical: $930M through $160M all measure 44.6.
export const MONEY_STRING_PX = {
  '$1.00B': 45.8,
  '$930M': 44.6, '$860M': 44.6, '$790M': 44.6, '$720M': 44.6, '$650M': 44.6,
  '$580M': 44.6, '$510M': 44.6, '$440M': 44.6, '$370M': 44.6, '$300M': 44.6,
  '$230M': 44.6, '$160M': 44.6,
  '$90M': 36.3, '$20M': 36.3,
}

/**
 * The slot the readout occupies, in px · the widest reachable string, rounded up.
 *
 * A FIXED SLOT, not `width: auto`. Auto would make the bar's total demand a function of the balance,
 * so the layout could be correct at $1.00B and wrap at $930M · a width regression that appears on
 * the first purchase of a game and never in a test that starts fresh. Fixed + right-aligned means
 * the arithmetic in ActionBar's header is true for the whole game.
 */
export const MONEY_SLOT_PX = Math.ceil(Math.max(...Object.values(MONEY_STRING_PX)))
