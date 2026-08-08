import { describe, it, expect } from 'vitest'
import { toRomanNumeral } from './romanNumeral'
import { PROJECT_CARDS } from '../lib/projectCards'

// Independent inverse. Deliberately NOT exported from romanNumeral.js · nothing in the app needs to
// read numerals back, and a round-trip proved with the encoder's own tables would only prove the
// tables agree with themselves. This parses by the actual rule (a smaller symbol before a larger one
// subtracts), so it can catch an encoder that emits a well-formed-looking but wrong string.
const VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
function fromRomanNumeral(s) {
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const here = VALUES[s[i]]
    const next = VALUES[s[i + 1]] ?? 0
    total += next > here ? -here : here
  }
  return total
}

describe('toRomanNumeral', () => {
  it('renders the two values the old hand-written map got wrong', () => {
    // The whole reason this module exists. 4 was 'IIII' and 5 was 'IIIII' on every card face.
    expect(toRomanNumeral(4)).toBe('IV')
    expect(toRomanNumeral(5)).toBe('V')
  })

  it('renders the two the old map got right', () => {
    expect(toRomanNumeral(2)).toBe('II')
    expect(toRomanNumeral(3)).toBe('III')
  })

  it('handles every subtractive pair', () => {
    expect(toRomanNumeral(4)).toBe('IV')
    expect(toRomanNumeral(9)).toBe('IX')
    expect(toRomanNumeral(40)).toBe('XL')
    expect(toRomanNumeral(90)).toBe('XC')
    expect(toRomanNumeral(400)).toBe('CD')
    expect(toRomanNumeral(900)).toBe('CM')
  })

  it('handles the boundaries of the expressible range', () => {
    expect(toRomanNumeral(1)).toBe('I')
    expect(toRomanNumeral(3999)).toBe('MMMCMXCIX')
  })

  it('never emits four of the same symbol in a row', () => {
    // 'IIII' and 'IIIII' were exactly this failure. Assert it for the whole range, not just 4 and 5.
    for (let n = 1; n <= 3999; n++) {
      expect(toRomanNumeral(n), `${n} repeated a symbol four times`).not.toMatch(/(.)\1\1\1/)
    }
  })

  it('round-trips every value in the expressible range', () => {
    for (let n = 1; n <= 3999; n++) {
      expect(fromRomanNumeral(toRomanNumeral(n)), `round-trip failed at ${n}`).toBe(n)
    }
  })

  it('returns empty for anything Roman numerals cannot express, rather than guessing', () => {
    // The old call site fell back to the raw number here, which would have put an Arabic digit on a
    // card face next to Roman ones. Empty is the honest answer; the deck test below is the real guard.
    for (const bad of [0, -1, -5, 1.5, 4000, NaN, Infinity, null, undefined, '4', '', {}, []]) {
      expect(toRomanNumeral(bad), `expected '' for ${JSON.stringify(bad)}`).toBe('')
    }
  })
})

// ── Drift guard (Rule 45) ────────────────────────────────────────────────────────────────────────
// CardFrame renders toRomanNumeral(card.points) for real cards out of the real deck. If someone adds
// a 6-point card, or fat-fingers points to 0, this goes red here instead of shipping a blank corner.
describe('the real deck renders a legible point value on every card', () => {
  it('gives all 56 cards a non-empty numeral that decodes back to its point value', () => {
    expect(PROJECT_CARDS.length).toBe(56)
    for (const card of PROJECT_CARDS) {
      const numeral = toRomanNumeral(card.points)
      expect(numeral, `${card.id} (${card.points}pt) rendered no numeral`).not.toBe('')
      expect(numeral, `${card.id} rendered non-numeral characters`).toMatch(/^[IVXLCDM]+$/)
      expect(fromRomanNumeral(numeral), `${card.id} renders ${numeral}, which is not ${card.points}`).toBe(card.points)
    }
  })

  it('covers the deck point values the game actually ships', () => {
    // Pins the assumption the card face is designed around: 2/3/4/5, nothing wider than two glyphs.
    const points = [...new Set(PROJECT_CARDS.map(c => c.points))].sort((a, b) => a - b)
    expect(points).toEqual([2, 3, 4, 5])
    expect(points.map(toRomanNumeral)).toEqual(['II', 'III', 'IV', 'V'])
  })
})
