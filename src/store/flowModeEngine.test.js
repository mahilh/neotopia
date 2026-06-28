import { describe, it, expect } from 'vitest'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from './gameStore'
import { DECK } from '../lib/projectCards'
import { GAME_MODES, getModeConfig } from './gameConfig'

// Flow mode engine integration (T2 S16): initGame reads getModeConfig(mode) to size the production-tile clock
// (END_GAME_TILE) and seed the turn budget (TURN_TIME_LIMIT) · endTurn resets the budget from the same config.
// mode is a LAZY synced field (set only for non-default modes) so a Classic game's shape is unchanged.
const players = [{ userId: 'a', username: 'A' }, { userId: 'b', username: 'B' }]
const start = (mode) => useGameStore.getState().initGame(
  players, shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]), mode,
)

describe('Flow mode engine integration', () => {
  it('getModeConfig: classic = 12 tiles / 90s · flow = 9 tiles / 15s (config is the single source)', () => {
    expect(getModeConfig('classic').END_GAME_TILE).toBe(12)
    expect(getModeConfig('classic').TURN_TIME_LIMIT).toBe(90)
    expect(getModeConfig('flow').END_GAME_TILE).toBe(9)
    expect(getModeConfig('flow').TURN_TIME_LIMIT).toBe(15)
  })

  it('Flow mode: initGame seeds a 9-tile clock + 15s budget + persists mode (the endgame-on-tile-9 wiring)', () => {
    start('flow')
    const s = useGameStore.getState()
    expect(s.productionTilesRemaining).toBe(GAME_MODES.flow.END_GAME_TILE) // 9 · the existing remaining===0 trigger now ends the game at tile 9
    expect(s.turnTimeRemaining).toBe(15)
    expect(s.mode).toBe('flow') // synced to both clients via syncFromServer
  })

  it('Classic mode: initGame keeps the 12-tile clock + 90s budget AND leaves no mode field (guard-safe shape)', () => {
    start('classic')
    const s = useGameStore.getState()
    expect(s.productionTilesRemaining).toBe(12)
    expect(s.turnTimeRemaining).toBe(90)
    // Lazy field: classic never sets `mode`, so the serialized shape the seededState guard pins is unchanged.
    const serialized = JSON.parse(JSON.stringify(s))
    expect('mode' in serialized).toBe(false)
  })

  it('default (no mode arg) is Classic · backward-compatible with every existing caller', () => {
    useGameStore.getState().initGame(players, shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]))
    const s = useGameStore.getState()
    expect(s.productionTilesRemaining).toBe(12)
    expect(s.turnTimeRemaining).toBe(90)
  })

  it('endTurn resets the budget from mode: Flow → 15s, Classic → 90s (rule-32-safe constant, not a clock)', () => {
    start('flow')
    useGameStore.setState(s => { s.turnTimeRemaining = 3 }) // simulate a countdown mid-turn
    useGameStore.getState().endTurn()
    expect(useGameStore.getState().turnTimeRemaining).toBe(15)

    start('classic')
    useGameStore.setState(s => { s.turnTimeRemaining = 3 })
    useGameStore.getState().endTurn()
    expect(useGameStore.getState().turnTimeRemaining).toBe(90)
  })

  // NOTE: the end-game-on-stack-exhaustion LOGIC itself (remaining===0 → endGameTriggered → 'scoring') is
  // pre-existing and covered by engineFuzz.test.js (which plays full random games to termination). This file
  // verifies the NEW wiring: the stack length (clock) and the turn budget are mode-derived, not hardcoded.
})

// Flow soft-lock guard (T2 S19): Flow's simultaneous draw can drain the ENTIRE deck+offer into players' hands
// BEFORE the production-tile clock runs out. The tile clock (the only thing that sets endGameTriggered) advances
// ONLY when a factory empties on a placement; if placements then stall, the last end-flag tile is never consumed
// → endGameTriggered never fires → the game freezes forever. S18 bot finding (run 3, DB-proven): 56 cards in
// hands · 36 placed · productionTilesRemaining=1 · endGameTriggered=false · phase stuck on 'playing'.
// The fix forces the SAME endGameTriggered flag the natural clock sets, once drawing is permanently impossible
// (deck+offer both empty) AND only the final tile remains — so endTurn's existing 2-round → 'scoring' path runs.
// Mode-gated to Flow (SIMULTANEOUS_DRAW); deterministic (no clock/random · rule 32); extends, never replaces (rule 62).
describe('Flow soft-lock: endgame forced when the deck exhausts before the last tile (T2 S19)', () => {
  const endTurn = () => useGameStore.getState().endTurn()

  it('Flow mode triggers endgame when the deck exhausts before the last tile (the draw seam)', () => {
    start('flow')
    // Brink of the soft-lock: one drawable card, offer already drained, only the end-flag tile left, and the
    // natural clock path NEVER reached (placements stalled) so endGameTriggered is still false.
    useGameStore.setState(s => {
      s.deck = s.deck.slice(0, 1)
      s.theOffer = []
      s.productionTilesRemaining = 1
      s.endGameTriggered = false
    })
    expect(useGameStore.getState().endGameTriggered).toBe(false) // precondition: still freezable

    useGameStore.getState().drawCard(0, 'deck') // the draw that empties the card supply
    expect(useGameStore.getState().deck.length).toBe(0)
    expect(useGameStore.getState().endGameTriggered).toBe(true)  // the safety net fired
  })

  it('the forced Flow endgame plays out to scoring via the existing 2-round machinery (the game can END)', () => {
    start('flow')
    useGameStore.setState(s => {
      s.deck = s.deck.slice(0, 1)
      s.theOffer = []
      s.productionTilesRemaining = 1
      s.endGameTriggered = false
      s.currentSeat = 0
      s.endGameRoundsRemaining = 2
    })
    useGameStore.getState().drawCard(0, 'deck')              // forces endGameTriggered
    expect(useGameStore.getState().endGameTriggered).toBe(true)
    endTurn(); endTurn(); endTurn(); endTurn()              // exactly 2 full rounds for 2 players
    expect(useGameStore.getState().phase).toBe('scoring')   // the freeze is gone · FinalScore can mount
  })

  it('Classic mode is unaffected: the same exhausted state does NOT force endgame (mode-gated · rule 32)', () => {
    start('classic')
    useGameStore.setState(s => {
      s.deck = s.deck.slice(0, 1)
      s.theOffer = []
      s.productionTilesRemaining = 1
      s.endGameTriggered = false
    })
    useGameStore.getState().drawCard(0, 'deck')
    expect(useGameStore.getState().endGameTriggered).toBe(false) // Classic never out-draws its clock · no guard
  })

  it('does NOT force endgame while production tiles still remain (no early end of a healthy game)', () => {
    start('flow')
    useGameStore.setState(s => {
      s.deck = s.deck.slice(0, 1)
      s.theOffer = []
      s.productionTilesRemaining = 5 // plenty of tile fuel left · the game is NOT near its end
      s.endGameTriggered = false
    })
    useGameStore.getState().drawCard(0, 'deck')
    expect(useGameStore.getState().endGameTriggered).toBe(false) // deck empty but 5 tiles remain → keep playing
  })

  it('also fires at the refill seam when the last tile is consumed AFTER the deck already emptied', () => {
    start('flow')
    // The other event ordering: deck+offer already empty; two tiles remain. A factory-empty refill brings the
    // clock 2→1 — at THAT moment the soft-lock condition completes, so the guard must fire on the refill seam too.
    useGameStore.setState(s => {
      s.deck = []
      s.theOffer = []
      s.productionTiles = s.productionTiles.slice(0, 2) // keep array length consistent with the count
      s.productionTilesRemaining = 2
      s.endGameTriggered = false
    })
    useGameStore.getState().factoryRefill(0) // consumes a (non-flag) tile · clock 2→1 · deck+offer already 0
    expect(useGameStore.getState().productionTilesRemaining).toBe(1)
    expect(useGameStore.getState().endGameTriggered).toBe(true)
  })
})
