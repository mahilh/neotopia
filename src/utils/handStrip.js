// HOW MANY HAND CARDS FIT · a function of the container, never a constant (T1 S67).
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// In S65 I built the hand strip and measured it at 320, where it works. In S66 the same strip
// measured ONE fully-visible card at 768, 1280 and 1440 · worse than the phone · because I had given
// it 4px of horizontal padding sized from that single measurement. The desktop sidebar is a 256px
// content box, two cards need 120 + 8 + 120 = 248, and 4px each side left 248 against 248.
//
// A constant tuned at one point of a curve is a model with a hidden parameter (Rule 111), and I have
// now shipped that twice · the per-character title budget in S64 and this padding in S66. The repair
// is not a better constant. It is to write down the CURVE, so that any change to the card, the gap or
// the padding is evaluated at every width at once instead of at the width I happen to be looking at.
//
// ⚠ THIS IS A MODEL OF FLEXBOX, WHICH IS A SECOND CONTRACT (Rule 45), AND IT IS DECLARED AS ONE.
// Nothing in the product calls it; the browser does the layout. Its whole job is to be CHECKED
// against real layout, and when the two disagree the browser is right and this reds. Measured
// against Chromium at six widths, model === measured at every one (T1 S67 · see the header of
// GameRoom.hand.test.jsx for the table). That agreement is the only reason it is worth having.

/**
 * The number of cards fully visible inside a horizontal, non-wrapping, gapped strip.
 *
 * A card is FULLY VISIBLE when its whole box lies inside the container's content box. N cards
 * occupy `N*cardW + (N-1)*gap`, so the largest N that fits `usable` is
 * `floor((usable + gap) / (cardW + gap))` · the +gap is because the last card is not followed by one.
 *
 * @param {object}  o
 * @param {number}  o.containerW  the strip's border-box width in px (its clientWidth)
 * @param {number}  o.cardW       one card's width in px  (CardFrame CARD_SIZES.hand.width)
 * @param {number}  o.gap         the flex column-gap in px
 * @param {number} [o.padX=0]     horizontal padding on the strip, per side
 * @param {number} [o.cards=Infinity]  how many cards are actually in the hand
 * @returns {number} cards fully visible · 0 when not even one fits
 * @throws when an input cannot produce a meaningful answer · a probe that cannot measure must say
 *         so rather than resolve to a plausible zero (Rule 80). A zero returned for `cardW: 0` would
 *         read as "the strip is too narrow" when it means "nobody told me how wide a card is".
 */
export function handCardBudget({ containerW, cardW, gap, padX = 0, cards = Infinity }) {
  if (!Number.isFinite(containerW) || containerW < 0) throw new Error(`handCardBudget: containerW ${containerW}`)
  if (!Number.isFinite(cardW) || cardW <= 0) throw new Error(`handCardBudget: cardW ${cardW} · a card has no width`)
  if (!Number.isFinite(gap) || gap < 0) throw new Error(`handCardBudget: gap ${gap}`)
  if (!Number.isFinite(padX) || padX < 0) throw new Error(`handCardBudget: padX ${padX}`)
  const usable = containerW - 2 * padX
  if (usable < cardW) return 0
  return Math.min(cards, Math.floor((usable + gap) / (cardW + gap)))
}

/**
 * The narrowest container that fits N cards · the inverse, and the number worth writing in a review.
 * "Two cards need 248" is this at N=2, and it is the sentence that would have caught S66 before it
 * shipped rather than a session later.
 */
export function handStripWidthFor(n, { cardW, gap, padX = 0 }) {
  if (!Number.isFinite(n) || n < 1) throw new Error(`handStripWidthFor: n ${n}`)
  if (!Number.isFinite(cardW) || cardW <= 0) throw new Error(`handStripWidthFor: cardW ${cardW}`)
  if (!Number.isFinite(gap) || gap < 0) throw new Error(`handStripWidthFor: gap ${gap}`)
  return n * cardW + (n - 1) * gap + 2 * padX
}
