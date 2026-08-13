// WHOSE PERSONAL STATE DOES THE ACTION BAR SHOW? (T1 S67)
//
// ── WHY THIS IS A FUNCTION AND NOT AN INLINE EXPRESSION ──────────────────────────────────────────
// It was inline, and the difference between the right answer and the wrong one was UNTESTABLE where
// it lived. GameRoom holds two players: `currentPlayer` (whose turn it is) and `myPlayer` (this
// client). In PRACTICE mySeat is null, so myPlayer falls back to currentPlayer and the two are the
// same object · which means a fixture built on practice cannot tell the two branches apart at all.
//
// I found that by mutation rather than by reading: swapping `myPlayer` for `currentPlayer` in the
// wallet wiring left the whole suite GREEN, including the control I had written specifically to
// catch it (Rule 130 · a control that fires through a path where the two candidates coincide, and
// Rule 132 · the mutation landed in the file and not in the measurement). Extracting the choice is
// what makes it drivable: here mySeat and currentSeat can differ, and one assertion settles it.
//
// ── WHAT IT COSTS TO GET WRONG ───────────────────────────────────────────────────────────────────
// A wallet is money and a bonus token is a held resource. Reading either off `currentPlayer` renders
// AN OPPONENT'S private state to whoever is waiting for their turn · and it looks completely correct
// in solo, in practice, and in every screenshot anybody takes, because there the two coincide.
// The bonus chip has been doing exactly that since S38: it reads currentPlayer.bonusTokens while its
// own Use button spends `mySeat ?? currentSeat`'s token, so on an opponent's turn the panel lists
// THEIR tokens with "Only on your turn" beside each. Found while building the wallet's control.

/**
 * The player whose PERSONAL state (wallet, held tokens) the local screen should show.
 *
 * @param {object}   o
 * @param {object[]} o.players      every seat
 * @param {number|null} o.mySeat    this client's seat · null in solo/practice, where there is one human
 * @param {number|null} o.currentSeat  whose turn it is
 * @returns {object|null} the player, or null when neither seat resolves
 *
 * The fallback is deliberate and is the reason practice works: with mySeat null there is exactly one
 * human at the table, so the current seat IS this client. It is a fallback and not the rule, and
 * that ordering is the whole content of this function.
 */
export function viewingPlayer({ players, mySeat, currentSeat }) {
  // NOT `|| players.length === 0`, and that is a mutation finding rather than a preference: with an
  // empty array both branches below already reach `find(...) -> undefined -> null`, so the length
  // test was a redundant guard and no mutation could red either of the pair (Rule 130a). Removing it
  // gives the survivor teeth. `!Array.isArray` is NOT redundant · undefined.find throws.
  if (!Array.isArray(players)) return null
  if (mySeat != null) {
    const mine = players.find(p => p.seat === mySeat)
    // A seat this client claims but the table does not hold is a divergence, not a licence to show
    // somebody else's money. Fall through to null rather than to the current seat.
    if (mine) return mine
    return null
  }
  if (currentSeat == null) return null
  return players.find(p => p.seat === currentSeat) ?? null
}
