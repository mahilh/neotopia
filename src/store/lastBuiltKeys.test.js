// THE HEXES THAT COMPLETED A DISTRICT  (T2 S70 · routed by T1, GameRoom.botmotion.test.jsx)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// T1 measured that Council's "the bot has no motion while the player does" was HALF FALSE: the
// placement itself already animates for both (24 particles across 4 bot placements against 6 for the
// human). The surviving half is the DISTRICT SETTLE, which lights the hexes that satisfied a pattern
// and fires from the hand card's onClick · and a bot does not click.
//
// A human path has the keys for free (`buildableMatches.find(...).matchedHexKeys`, read at click
// time). After a bot's scoreCard they were gone: the store recorded THAT a card was scored and into
// WHICH region, never the coordinates. T1 refused to re-derive them in the UI, which was right · a
// second pattern matcher beside findBuildableCards would be wrong in exactly the 8.5% of completions
// where two cards are buildable at once.
//
// So the engine records them. This file is the half that is mine: the field is WRITTEN, it is
// CORRECT, and it survives the wire. T1 owns the render, and their `it.fails` is their signal.
//
// ⚠ AND THIS IS THE PROJECT'S OLDEST FAILURE MODE IF NOBODY CHECKS IT · award_game_win (S35),
// useBonus (S37), card art (S42), two dead sounds (S55). A field that is added for a consumer who
// has not wired it yet is a writer with no caller, and the ones that rest at a plausible value
// survive for months. `[]` is exactly such a value.

import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from './gameStore'
import { DECK } from '../lib/projectCards'
// REUSED FROM T1'S FIXTURE, deliberately across the lane boundary. Building a second "make a card
// completable" helper is the exact duplication that produced two different wrong deadlock boards in
// one session (Rule 45), and a fixture that disagrees with the one T1's own settle test uses would
// make the two halves of this feature untestable against each other.
import { completableStatePatch } from '../pages/scorePendingFixture'

const api = () => useGameStore.getState()

const fresh = (n = 2) => {
  useGameStore.setState(useGameStore.getInitialState(), true)
  api().initGame(
    Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, username: `P${i}` })),
    shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]))
}

beforeEach(() => fresh())

describe('region.lastBuiltKeys · the datum the bot settle needs', () => {
  // ── COUNTERWEIGHT FIRST · a REFUSED score must not write it ────────────────────────────────────
  // The dangerous direction is a field that is populated whether or not a district was built: the
  // settle would then light hexes for a scoring attempt the engine rejected, and it would look
  // exactly like the feature working.
  it('a refused score writes nothing', () => {
    const before = api().regions[0].lastBuiltKeys
    // Wrong seat, and nothing on the board · tryScoreCard must refuse.
    expect(api().tryScoreCard(1, api().players[0].hand[0].id, 0, null)).toBe(false)
    expect(api().regions[0].lastBuiltKeys, 'a rejected scoring attempt recorded completing hexes · ' +
      'the settle would fire on a district that was never built').toEqual(before)
    expect(api().regions[0].lastBuiltKeys).toEqual([])
  })

  it('starts empty on every region, and is present from the first render', () => {
    // PRESENT, not absent · a field that materialises on first score is a second serialized shape
    // that nothing declared, and the reconnect fixture pins that shape.
    for (const r of api().regions) {
      expect(Array.isArray(r.lastBuiltKeys), `region ${r.id} has no lastBuiltKeys array`).toBe(true)
      expect(r.lastBuiltKeys).toEqual([])
    }
  })

  it('a real score records the hexes that ACTUALLY satisfied the pattern', () => {
    const st = api()
    const seat = st.currentSeat
    const hand = st.players.find(p => p.seat === seat).hand
    const seed = completableStatePatch(st.regions, hand, seat)
    // UNMEASURED, never a pass · if the fixture cannot build a completable district, every
    // assertion below is about a game that did not happen (Rule 120).
    expect(seed, 'the fixture could not make any hand card completable · UNMEASURED').not.toBeNull()

    const [q, r] = seed.missingKey.split(',').map(Number)
    useGameStore.setState({ ...seed.patch }, false)
    useGameStore.setState(s => {
      s.regions.find(x => x.id === seed.regionId).hexes[`${q},${r}`] = { element: seed.requiredType }
    })
    expect(api().tryScoreCard(seat, seed.card.id, seed.regionId, seed.missingKey),
      'the engine refused a district the fixture built · nothing below is measuring a real score')
      .toBe(true)

    const keys = api().regions.find(x => x.id === seed.regionId).lastBuiltKeys
    expect(keys.length, 'a district was built and no completing hexes were recorded · the bot ' +
      'settle has no datum and T1\'s routed test stays red').toBe(seed.card.pattern.length)
    // THE COMPLETING HEX MUST BE AMONG THEM · that is the rule the match was validated against, so
    // a set of keys that omits it is not the pattern that scored.
    expect(keys, 'the just-placed hex is not in the recorded pattern · these are not the keys that ' +
      'completed it').toContain(seed.missingKey)
    // AND EVERY RECORDED HEX IS OCCUPIED. A key pointing at an empty hex would light an empty cell.
    const hexes = api().regions.find(x => x.id === seed.regionId).hexes
    for (const k of keys) {
      expect(hexes[k]?.element, `recorded hex ${k} is EMPTY · the settle would light a blank cell`)
        .toBeTruthy()
    }
  })

  it('is JSON-serialisable · it has to survive game_sessions.state', () => {
    // Rule 22 · anything the store puts in state must round-trip, and this is read by a client that
    // did not compute it (the whole point: the peer watching a bot score).
    const st = api()
    const seat = st.currentSeat
    const seed = completableStatePatch(st.regions, st.players.find(p => p.seat === seat).hand, seat)
    expect(seed, 'UNMEASURED · no completable district').not.toBeNull()
    const [q, r] = seed.missingKey.split(',').map(Number)
    useGameStore.setState({ ...seed.patch }, false)
    useGameStore.setState(s => {
      s.regions.find(x => x.id === seed.regionId).hexes[`${q},${r}`] = { element: seed.requiredType }
    })
    api().tryScoreCard(seat, seed.card.id, seed.regionId, seed.missingKey)

    const round = JSON.parse(JSON.stringify(api().regions))
    const keys = round.find(x => x.id === seed.regionId).lastBuiltKeys
    expect(keys, 'lastBuiltKeys did not survive a JSON round trip · a syncing peer sees nothing and ' +
      'the bot settle works only on the machine that ran the engine')
      .toEqual(api().regions.find(x => x.id === seed.regionId).lastBuiltKeys)
    expect(keys.every(k => typeof k === 'string'), 'the keys are not plain strings').toBe(true)
  })
})
