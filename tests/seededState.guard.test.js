// Keeps the E2E reconnect fixture honest (T3 S6).
// tests/e2e/fixtures/seededState.json is REAL engine output (initGame · rule 32 · never hand-made).
// If the store shape drifts (a field added/removed), this fails FAST here in unit tests · NOT later
// as a flaky cross-region E2E. To regenerate: run initGame as below and write the JSON back.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../src/store/gameStore'
import { DECK } from '../src/lib/projectCards'

// vitest serves modules over a non-file: URL · resolve from cwd (always the repo root under vitest).
const FIXTURE = resolve(process.cwd(), 'tests/e2e/fixtures/seededState.json')

describe('e2e reconnect fixture (seededState.json)', () => {
  it('still matches the engine state shape produced by initGame', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))

    useGameStore.getState().initGame(
      [{ userId: 'a', username: 'Alice' }, { userId: 'b', username: 'Bob' }],
      shuffleArray([...DECK]),
      shuffleArray([...PRODUCTION_TILES]),
    )
    const fresh = JSON.parse(JSON.stringify(useGameStore.getState()))

    // Top-level keys must match · a mismatch means the fixture is stale and the E2E would seed a
    // store the live UI no longer understands.
    expect(Object.keys(fixture).sort()).toEqual(Object.keys(fresh).sort())
  })

  // ── ADDED T2 S64 · ADDITIVE ONLY, nothing above or below this block is edited ──────────────────
  // THE GUARD ABOVE COMPARES TOP-LEVEL KEYS AND NOTHING ELSE, so a field added to every PLAYER or
  // every REGION sails straight through it. gameStore.js says twice that a per-player key "would
  // break the guard"; measured, it would not, and that is the problem rather than the relief.
  //
  // WHY IT MATTERS NOW AND NOT IN THE ABSTRACT: the wallet design (docs/WALLET_AND_DEMOLITION_
  // CONTRACT.md §1) puts `wallet` on every player. The day it lands, this fixture still has eight
  // keys per player, THIS FILE IS STILL GREEN, and the reconnect E2E seeds a live game in which
  // every player's wallet is `undefined` · cards free, or every price comparison NaN, silently, in
  // the one spec whose entire subject is a client rejoining a real game.
  //
  // It is green today: the fixture's player and region shapes are both undrifted, checked before
  // this was written, because adding an assertion that reddens a shared gate for another lane is
  // the thing preamble §5 forbids and the thing I did in S62.
  //
  // VALUES ARE DELIBERATELY NOT COMPARED, only key SETS. The fixture legitimately holds different
  // numbers, and its region NAMES are legitimately stale (T1 renamed the regions in S63 and this is
  // a frozen snapshot). A shape guard that failed on a name would be a guard nobody could keep green.
  const keysOf = (o) => Object.keys(o).sort()

  it('the PLAYER shape has not drifted either · the top-level check cannot see this', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    useGameStore.getState().initGame(
      [{ userId: 'a', username: 'Alice' }, { userId: 'b', username: 'Bob' }],
      shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
    )
    const fresh = JSON.parse(JSON.stringify(useGameStore.getState()))
    expect(keysOf(fixture.players[0]), 'a per-player field was added to or removed from the engine ' +
      'and this fixture was not regenerated · the reconnect E2E will seed players missing it, and ' +
      'nothing else in the repository would say so. Regenerate tests/e2e/fixtures/seededState.json.')
      .toEqual(keysOf(fresh.players[0]))
  })

  it('and the REGION and FACTORY shapes, for the same reason', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    useGameStore.getState().initGame(
      [{ userId: 'a', username: 'Alice' }, { userId: 'b', username: 'Bob' }],
      shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
    )
    const fresh = JSON.parse(JSON.stringify(useGameStore.getState()))
    expect(keysOf(fixture.regions[0]), 'the region shape drifted · bonusPile arrived this way in S38 ' +
      'and a seeded game without it grants no tokens at all').toEqual(keysOf(fresh.regions[0]))
    expect(keysOf(fixture.factories[0]), 'the factory shape drifted').toEqual(keysOf(fresh.factories[0]))
  })

  it('COUNTERWEIGHT · the comparison is a real one, not two references to one object', () => {
    // The failure that would make both assertions above vacuous: comparing `fresh` to `fresh`, or
    // comparing empty arrays. Both would be permanently green and would read as protection.
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    expect(fixture.players.length, 'the fixture has no players, so the player-shape check compares ' +
      'nothing and passes forever').toBeGreaterThan(0)
    expect(keysOf(fixture.players[0]).length, 'a player in the fixture has no keys at all')
      .toBeGreaterThan(4)
    // And the check must be capable of noticing a difference · proven against a synthetic drift
    // rather than trusted, because a key-set comparison that silently normalises would not.
    //
    // ⚠ THIS USED `wallet: 1` AND WENT VACUOUS THE DAY THE WALLET LANDED (T2 S66). I picked the name
    // of a field that did not exist, and eleven days later it did · at which point spreading it over
    // a player that already has one changed no key and the counterweight asserted nothing. It failed
    // loudly rather than silently only because `toEqual` then matched, which is luck: had I written
    // it the other way round it would have passed forever. The token for a synthetic drift must be
    // one that CANNOT become a real field, and its absence is asserted so that "cannot" stays true
    // (Rule 125 · a discriminator has to be one you own, and a name you invented for a future field
    // is precisely one you do not).
    const SYNTHETIC = '__drift_probe_never_a_real_field__'
    expect(keysOf(fixture.players[0]), `${SYNTHETIC} is now a real player field · pick another, or ` +
      'this control is comparing a key set to itself').not.toContain(SYNTHETIC)
    expect(keysOf({ ...fixture.players[0], [SYNTHETIC]: 1 }))
      .not.toEqual(keysOf(fixture.players[0]))
  })

  it('is a playable two-player game (so GameRoom renders the board, not the Connecting gate)', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    expect(fixture.phase).toBe('playing')
    expect(fixture.players).toHaveLength(2)
    expect(Array.isArray(fixture.regions) && fixture.regions.length).toBe(3)
    expect(Array.isArray(fixture.factories) && fixture.factories.length).toBe(3)
  })
})
