// NeoTopia · Roman numerals for card point values (T1 S28).
//
// WHY THIS EXISTS: CardFrame carried a hand-written lookup · { 2:'II', 3:'III', 4:'IIII', 5:'IIIII' }.
// IIII is at least a real convention (clock faces still use it); IIIII is not a numeral in any system,
// so a player who reads Roman numerals was being actively misinformed about a card's score.
//
// WHY A CONVERTER AND NOT A CORRECTED MAP: the bug WAS a hand-written map. Replacing it with a second
// hand-written map leaves the same failure mode alive one point value further out. Worse, the old call
// site fell back to `card.points` when the map missed, so a value outside 2..5 would have rendered as
// an Arabic digit sitting next to Roman ones · two numeral systems on the same board. This function is
// total over 1..3999, so the deck can grow a 6-point card without anyone remembering this file exists.
//
// The drift guard lives in romanNumeral.test.js: it runs the REAL deck through here and round-trips
// every result back to a number (Rule 45 · a lookup that mirrors game data is a second contract, so it
// gets pinned to the first one).

// Descending value → symbol, including the four subtractive pairs. Order is load-bearing: the greedy
// loop below depends on it.
const NUMERALS = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

// Returns '' for anything the system cannot express (0, negatives, fractions, non-numbers, >3999)
// rather than guessing. An empty numeral on a card face means the card data is wrong, and the deck
// test above will have gone red long before a player sees it.
export function toRomanNumeral(value) {
  if (!Number.isInteger(value) || value < 1 || value > 3999) return ''
  let remaining = value
  let out = ''
  for (const [amount, symbol] of NUMERALS) {
    while (remaining >= amount) {
      out += symbol
      remaining -= amount
    }
  }
  return out
}
