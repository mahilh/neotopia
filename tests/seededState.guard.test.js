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

  it('is a playable two-player game (so GameRoom renders the board, not the Connecting gate)', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    expect(fixture.phase).toBe('playing')
    expect(fixture.players).toHaveLength(2)
    expect(Array.isArray(fixture.regions) && fixture.regions.length).toBe(3)
    expect(Array.isArray(fixture.factories) && fixture.factories.length).toBe(3)
  })
})
