import { describe, test, expect } from 'vitest'
import { PROJECT_CARDS, DECK } from './projectCards'

// THE DECK HAD NO TEST AT ALL, and a deep rename of all 56 names is about to land (Mahil · S33).
// A rename touches one field on every card in the file, by hand or by script, and the failure mode is
// not a crash · it is a deck that still boots and quietly plays a different game: a dropped card, a
// duplicated id, a pattern nudged while its name was edited. None of that shows up in a build.
//
// So this file pins what a RENAME MUST NOT CHANGE. It deliberately asserts nothing about the names
// themselves beyond structural sanity · the vocabulary is Mahil's call and T1's audit, not a test's.
// Everything else about a card is load-bearing and frozen here.

const POINT_DISTRIBUTION = { 2: 12, 3: 18, 4: 18, 5: 8 } // header of projectCards.js · sums to 56
const ELEMENT_TYPES = ['energy', 'biofarming', 'technology', 'community', 'water']

describe('the 56-card deck · the invariants a rename must preserve', () => {
  test('exactly 56 cards, and DECK is a copy rather than an alias', () => {
    expect(PROJECT_CARDS).toHaveLength(56)
    expect(DECK).toHaveLength(56)
    // DECK is shuffled by callers · if it were the same array reference, shuffling it would permanently
    // reorder PROJECT_CARDS for every later game in the process.
    expect(DECK).not.toBe(PROJECT_CARDS)
  })

  test('ids are card_01..card_56, unique, and in order', () => {
    // IDS ARE THE JOIN KEY AND MUST SURVIVE THE RENAME UNTOUCHED. scoredCardIds, the game_end audit
    // payload, every saved fixture and the art path (/art/cards/<id>.png · CardFrame.jsx:121) all key
    // on the id. A renamed id is a broken save and a missing illustration.
    const ids = PROJECT_CARDS.map(c => c.id)
    expect(new Set(ids).size).toBe(56)
    expect(ids).toEqual(Array.from({ length: 56 }, (_, i) => `card_${String(i + 1).padStart(2, '0')}`))
  })

  test('every name is present, trimmed and unique', () => {
    const names = PROJECT_CARDS.map(c => c.name)
    for (const [i, name] of names.entries()) {
      expect(typeof name, `card_${i + 1} name is not a string`).toBe('string')
      expect(name.trim(), `card_${i + 1} has an empty name`).not.toBe('')
      expect(name, `"${name}" has stray whitespace`).toBe(name.trim())
    }
    // Duplicates are the likeliest slip in a 56-row hand edit, and two cards sharing a name is
    // indistinguishable from a bug during play.
    const dupes = names.filter((n, i) => names.indexOf(n) !== i)
    expect(dupes, `duplicate card names: ${dupes.join(', ')}`).toEqual([])
  })

  test('no banned symbol reaches a card name or description', () => {
    // CLAUDE.md, standing rule: the sacred-milestone symbol is NEVER the ✡ hexagram. A rename that
    // reaches for "sacred" vocabulary is exactly when this would slip back in.
    for (const c of PROJECT_CARDS) {
      expect(`${c.name} ${c.description ?? ''}`, `${c.id} carries a banned symbol`).not.toMatch(/[✡✙]/)
    }
  })

  test('patterns, points and districts are untouched by any rename', () => {
    const byPoints = {}
    for (const c of PROJECT_CARDS) {
      expect(Array.isArray(c.pattern), `${c.id} has no pattern`).toBe(true)
      expect(c.pattern.length, `${c.id} has an empty pattern`).toBeGreaterThan(0)
      for (const cell of c.pattern) {
        expect(Number.isInteger(cell.q), `${c.id} pattern cell q is not an integer`).toBe(true)
        expect(Number.isInteger(cell.r), `${c.id} pattern cell r is not an integer`).toBe(true)
        expect(ELEMENT_TYPES, `${c.id} uses unknown element "${cell.type}"`).toContain(cell.type)
      }
      expect(typeof c.illustration, `${c.id} has no illustration`).toBe('string')
      byPoints[c.points] = (byPoints[c.points] ?? 0) + 1
    }
    // The point spread IS the game's difficulty curve · projectCards.js's own header states it.
    expect(byPoints).toEqual(POINT_DISTRIBUTION)
  })

  test('Diverse City still has something to enforce', () => {
    // The rule forbids building the same illustration consecutively in one region · with fewer than 3
    // distinct values it becomes unplayable rather than merely strict (projectCards.js header).
    expect(new Set(PROJECT_CARDS.map(c => c.illustration)).size).toBeGreaterThanOrEqual(3)
  })
})
