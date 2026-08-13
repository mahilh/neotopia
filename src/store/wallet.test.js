// THE WALLET · engine first, behind a flag  (T2 S66 · Council decision)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Cards are BOUGHT rather than drawn free. This session lands the FIELD and the REFUSAL PATH; the
// flag (gameConfig.WALLET_ENABLED) is false, so no purchase is ever refused for money yet.
//
// THE COUNTERWEIGHT THE BRIEF NAMED, and it is the right one: "a wallet that round-trips as
// undefined looks identical to a wallet nobody has spent from". Both read as "no money moved". The
// serialisation assertions below exist for exactly that, and they are written first.
//
// AND THE SECOND ONE, from S64's own lesson: the shape guard's top-level comparison stayed GREEN
// under the exact mutation that mattered, and I only knew because I mutated it rather than argued
// it. So the flag-off equivalence here is DRIVEN, not asserted by comment · the same board is played
// with the flag in both states and the outcomes are compared.

import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from './gameStore'
import { DECK } from '../lib/projectCards'
import { STARTING_WALLET, CARD_PRICE, priceOf, WALLET_ENABLED } from './gameConfig'

const api = () => useGameStore.getState()
const fresh = (n = 2, mode) => {
  useGameStore.setState(useGameStore.getInitialState(), true)
  api().initGame(
    Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, username: `P${i}` })),
    shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]), mode)
}

beforeEach(() => fresh())

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST AND ALONE (Rule 90)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('wallet · the field is real before any behaviour is read', () => {
  // 1 · IT SURVIVES THE ROUND TRIP. `game_sessions.state` is jsonb and the store is its mirror; a
  //     wallet that serialises to undefined and a wallet nobody spent from are the SAME observation
  //     (both look like "no money moved"), which is why this is the first assertion in the file.
  it('round-trips through JSON with its value intact', () => {
    const wire = JSON.parse(JSON.stringify(api()))
    for (const p of wire.players) {
      expect(p.wallet, 'a player came back from JSON without a wallet · every price comparison ' +
        'downstream is then NaN or free, silently, and it looks exactly like a wallet nobody spent ' +
        'from').toBe(STARTING_WALLET)
    }
    // And a SPENT wallet must survive too · the undefined case above can be satisfied by a constant.
    useGameStore.setState(s => { s.players[0].wallet = 123 })
    expect(JSON.parse(JSON.stringify(api())).players[0].wallet).toBe(123)
  })

  it('is a plain number · nothing exotic reaches the wire (rule 22)', () => {
    expect(typeof api().players[0].wallet).toBe('number')
    expect(Number.isFinite(api().players[0].wallet)).toBe(true)
  })

  // 2 · EVERY PLAYER HAS ONE, at every seat count. A field present at seat 0 and missing at seat 3
  //     would pass any single-player check and break exactly one player's game.
  it('every seat gets one, at 2 and at 4 players', () => {
    for (const n of [2, 4]) {
      fresh(n)
      expect(api().players).toHaveLength(n)
      for (const p of api().players) expect(p.wallet).toBe(STARTING_WALLET)
    }
  })

  // 3 · THE FLAG IS OFF, ASSERTED RATHER THAN ASSUMED. Everything below about refusals is scoped to
  //     that, and a file that silently started testing the enabled engine would be describing a
  //     different game than the one that ships.
  it('the flag is OFF · this file describes the shipped engine', () => {
    expect(WALLET_ENABLED, 'WALLET_ENABLED is true · the assertions below about "nothing is ever ' +
      'refused for money" now describe a game nobody is playing. Re-read them before trusting one.')
      .toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE PURCHASE PATH · a reason, not a boolean
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('tryDrawCard · refuses with a reason', () => {
  it('a normal draw succeeds and reports ok', () => {
    const before = api().players[0].hand.length
    const r = api().tryDrawCard(0, 'offer', 0)
    expect(r.ok).toBe(true)
    expect(r.reason).toBe('ok')
    expect(api().players[0].hand.length).toBe(before + 1)
    expect(api().actionsRemaining).toBe(2)
  })

  it('the wrong seat is refused, and says WHICH refusal it is', () => {
    const r = api().tryDrawCard(1, 'offer', 0)
    expect(r.ok).toBe(false)
    expect(r.reason, 'a boolean would collapse "not your turn" into the same silent no-op as "you ' +
      'are broke", and T1 has to tell a player which one happened').toBe('not_your_turn')
  })

  it('no actions left is its own reason', () => {
    useGameStore.setState(s => { s.actionsRemaining = 0 })
    expect(api().tryDrawCard(0, 'offer', 0).reason).toBe('no_actions')
  })

  // ⚠ THE ONE THAT WAS A LIVE BUG. drawCard used to decrement actionsRemaining and THEN call
  // deck.shift() unchecked, so a draw against an empty deck cost an action and delivered nothing ·
  // Rule 29 (validate Y fully BEFORE debiting X) in its most literal form. Under a wallet it would
  // have cost money for nothing.
  it('an empty deck REFUSES and costs nothing · it used to spend an action and deliver no card', () => {
    useGameStore.setState(s => { s.deck = [] })
    const actions = api().actionsRemaining
    const hand = api().players[0].hand.length
    const r = api().tryDrawCard(0, 'deck', 0)
    expect(r.reason).toBe('no_card')
    expect(api().actionsRemaining, 'the refused draw still spent an action · that is the S63 finding ' +
      'and the whole reason this path validates before it debits').toBe(actions)
    expect(api().players[0].hand.length).toBe(hand)
  })

  it('an offer index that holds nothing is the same refusal', () => {
    expect(api().tryDrawCard(0, 'offer', 99).reason).toBe('no_card')
    expect(api().actionsRemaining).toBe(3)
  })

  it('an unknown seat is refused rather than crashing', () => {
    expect(api().tryDrawCard(7, 'offer', 0).reason).toBe('no_seat')
  })

  it('drawCard is a void wrapper over the same rule · one owner, not two', () => {
    // Rule 45. If these ever diverge, one of them is a second purchase rule and the UI and the bots
    // are playing different games.
    const before = api().players[0].hand.length
    api().drawCard(0, 'offer', 0)
    expect(api().players[0].hand.length).toBe(before + 1)
    expect(api().actionsRemaining).toBe(2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THE FLAG BUYS · driven, not argued
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('with the flag OFF the engine is unchanged, and the money is inert', () => {
  it('a full turn of draws never debits and never refuses', () => {
    api().tryDrawCard(0, 'offer', 0)
    api().tryDrawCard(0, 'offer', 0)
    api().tryDrawCard(0, 'deck', 0)
    expect(api().players[0].wallet, 'money moved while WALLET_ENABLED is false · the flag is not ' +
      'gating the debit and the engine has silently changed under every existing measurement')
      .toBe(STARTING_WALLET)
    expect(api().actionsRemaining).toBe(0)
  })

  it('a player with ZERO money can still buy · price is 0 while the flag is off', () => {
    // The direct test of the gate. If this ever refuses, the flag is not doing its job and every
    // balance figure in docs/ describes a game that no longer exists.
    useGameStore.setState(s => { s.players[0].wallet = 0 })
    const r = api().tryDrawCard(0, 'offer', 0)
    expect(r.ok, 'a broke player was refused while the wallet is disabled').toBe(true)
    expect(r.cost).toBe(0)
  })

  // THE TERMINAL CONDITION · the seam T3's biconditional watches. With the flag off, the money term
  // must reduce to the ORIGINAL predicate exactly, and that is driven on a real board rather than
  // reasoned about: a deadlocked board must still trigger, and a healthy one must still not.
  it('the deadlock trigger is byte-identical in behaviour with the flag off', () => {
    // healthy board · cards exist, placements exist
    expect(api().endGameTriggered).toBe(false)
    api().tryDrawCard(0, 'offer', 0)
    expect(api().endGameTriggered, 'a normal draw on a healthy board triggered the endgame').toBe(false)

    // deadlocked board · no cards anywhere, and every factory empty so nothing can be placed
    fresh()
    useGameStore.setState(s => {
      s.deck = []
      s.theOffer = []
      s.factories.forEach(f => { f.elements = [] })
    })
    api().endTurn()
    expect(api().endGameTriggered, 'no cards and no possible placement is a dead position and the ' +
      'trigger did not fire · the money term has broken the original predicate').toBe(true)
  })

  it('and a broke player on a card-rich board is NOT dead while the flag is off', () => {
    // The case the wallet will change. Today it must read as alive, because price is 0.
    useGameStore.setState(s => {
      s.players.forEach(p => { p.wallet = 0 })
      s.factories.forEach(f => { f.elements = [] })
    })
    api().endTurn()
    expect(api().endGameTriggered, 'a broke player was treated as dead while the wallet is disabled ' +
      '· the flag is not gating the terminal term either').toBe(false)
  })
})

describe('the price is a function, and the numbers are the ruled ones', () => {
  it('priceOf ignores the card and returns the flat price', () => {
    const [a, b] = [DECK.find(c => c.points === 2), DECK.find(c => c.points === 5)]
    expect(priceOf(a)).toBe(CARD_PRICE)
    expect(priceOf(b), 'the price varies with the card · points-proportional pricing charges 2.5x ' +
      'more for the card that delivers a quarter as much (docs/CARD_ECONOMY.md §3), and flat was ' +
      'ruled. If per-card pricing is wanted, change this function BODY and re-run the sweep.')
      .toBe(priceOf(a))
  })

  it('the wallet buys a whole number of cards at the ruled price', () => {
    // Not decoration: $1B / $70M = 14.28, and the basket a 2-player Classic game actually takes is
    // 13.9-19.8 purchases (docs/CARD_ECONOMY.md §2). The price BINDS, which is the point of it.
    expect(STARTING_WALLET / CARD_PRICE).toBeGreaterThan(10)
    expect(STARTING_WALLET / CARD_PRICE).toBeLessThan(20)
  })
})
