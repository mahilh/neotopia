// THE REFUSAL COPY, BOUND TO THE ENGINE'S OWN ENUM.
//
// The value of this file is not the strings. It is the binding: `tryDrawCard` owns the set of
// reasons, this owns the words, and the two live in different lanes · which is precisely the shape
// that has no owner and therefore no test (Rule 115). A reason T2 adds later must red HERE rather
// than fall through to "That draw was refused" in front of a player, silently, forever.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { drawRefusalCopy, DRAW_REFUSAL_COPY } from './drawRefusal'

const STORE = path.resolve(__dirname, '../store/gameStore.js')

/** Every `reason: '...'` literal tryDrawCard can return, read out of the engine rather than typed. */
function enginesReasons() {
  const src = fs.readFileSync(STORE, 'utf8')
  const body = src.slice(src.indexOf('tryDrawCard:'), src.indexOf('drawCard: (seat, source'))
  return [...new Set([...body.matchAll(/reason:\s*'([a-z_]+)'/g)].map(m => m[1]))].filter(r => r !== 'ok')
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the extraction can actually see the engine', () => {
  it('finds a plausible set of reasons in tryDrawCard, not zero and not everything', async () => {
    // A regex that matches NOTHING makes the binding below vacuous · every reason would be "covered"
    // because there are none, and the file would read as rigour while asserting nothing (Rule 130).
    // A regex that matches the WHOLE FILE would drag in tryScoreCard's and useBonus's vocabulary and
    // red for reasons that have nothing to do with drawing.
    const found = enginesReasons()
    expect(found.length, 'no `reason:` literals found inside tryDrawCard · the slice missed the ' +
      'function, so the coverage assertion below is about an empty set').toBeGreaterThan(2)
    expect(found.length, 'more reasons than tryDrawCard has · the slice ran past the end of the ' +
      'function and is reading some other action\'s vocabulary').toBeLessThan(10)
    // a known member, so the extraction is anchored to something recognisable rather than to a count
    expect(found, 'insufficient_funds is not among the reasons the engine returns · either the slice ' +
      'is wrong or the wallet refusal was removed').toContain('insufficient_funds')
  })
})

describe('every reason the engine can produce has words', () => {
  it('the map covers the engine exactly · no gaps, no strings for reasons that cannot happen', async () => {
    const engine = enginesReasons().sort()
    const covered = Object.keys(DRAW_REFUSAL_COPY).sort()
    expect(covered, `the engine can refuse with ${JSON.stringify(engine)} and this map answers ` +
      `${JSON.stringify(covered)}. A reason with no copy reaches a player as "That draw was ` +
      'refused", which is the generic line the enum existed to replace · write the words.').toEqual(engine)
  })

  it('and none of them renders a raw enum token', async () => {
    // The failure this is really about: `insufficient_funds` appearing on screen. Every branch is
    // exercised, so a copy function that returned its own key would red here.
    for (const reason of Object.keys(DRAW_REFUSAL_COPY)) {
      const line = drawRefusalCopy({ ok: false, reason, cost: 70_000_000, balance: 50_000_000 })
      expect(line, `${reason} produced no copy`).toBeTruthy()
      expect(line, `${reason} leaks its own enum token to the player`).not.toContain('_')
      expect(line.length, `${reason} is ${line.length} chars · the draw-status line sits in a 255px ` +
        'sidebar at 11px and the longest string this product already renders is 66').toBeLessThan(66)
    }
  })
})

describe('insufficient_funds carries the two numbers, because they are the actionable part', () => {
  it('names the balance AND the price, from the outcome that refused', async () => {
    // "You cannot afford this" invites a second click. The numbers end the question, and they come
    // off the same object the engine refused with, so they cannot disagree with what was charged.
    const line = drawRefusalCopy({ ok: false, reason: 'insufficient_funds', cost: 70_000_000, balance: 50_000_000 })
    expect(line).toContain('$50M')
    expect(line).toContain('$70M')
  })

  it('reads them from the OUTCOME, not from a constant · the two must move independently', async () => {
    // The mutation this defends against is a copy function that hardcodes the shipping price. Two
    // different outcomes must produce two different lines (Rule 92 · a check whose two sides come
    // from one source cannot fail).
    const a = drawRefusalCopy({ ok: false, reason: 'insufficient_funds', cost: 70_000_000, balance: 50_000_000 })
    const b = drawRefusalCopy({ ok: false, reason: 'insufficient_funds', cost: 20_000_000, balance: 10_000_000 })
    expect(a).not.toBe(b)
    expect(b).toContain('$20M')
    expect(b).toContain('$10M')
  })
})

describe('a success is not a refusal with empty words', () => {
  it('returns null for ok, and for nothing at all', async () => {
    // Rule 80's shape in the UI: the render is `{drawRefusal && ...}`, so an empty string and null
    // both hide the row · but only one of them means "the engine said yes". Collapsing them makes a
    // successful draw indistinguishable from a refusal whose copy went missing.
    expect(drawRefusalCopy({ ok: true, reason: 'ok', cost: 0, balance: 1 })).toBeNull()
    expect(drawRefusalCopy(null)).toBeNull()
    expect(drawRefusalCopy(undefined)).toBeNull()
  })

  it('an unknown reason still says something to the player', async () => {
    // The fallback is not the safety net · the binding above is. This only guarantees that if the
    // binding is ever wrong, a player sees a sentence rather than `weird_new_reason`.
    const line = drawRefusalCopy({ ok: false, reason: 'weird_new_reason', cost: 0, balance: 0 })
    expect(line).toBeTruthy()
    expect(line).not.toContain('weird_new_reason')
  })
})
