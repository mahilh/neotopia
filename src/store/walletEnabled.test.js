// THE WALLET WITH THE FLAG ON · the half wallet.test.js structurally cannot reach  (T2 S66)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Every assertion in wallet.test.js runs with WALLET_ENABLED false, and all seventeen pass. Ask the
// Rule 130 question of that green: how many ways could it have been produced?
//
//   1 · the flag gates correctly and the enabled engine works
//   2 · tryDrawCard can NEVER refuse for money, under any circumstances, and the flag is decorative
//
// Those are indistinguishable from a flag-off suite, and the second ships a wallet that is inert on
// the day somebody flips the constant · the exact "writer with no caller" class this project has
// found six times, arriving one level up as a FEATURE with no reachable branch.
//
// So the module is mocked and the enabled engine is driven for real. This is not a model of the
// wallet · it is the actual store, with one constant replaced (preamble §3 · when the harness
// simulates the subject the harness is suspect; here it simulates only the FLAG).

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./gameConfig', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, WALLET_ENABLED: true }
})

const { useGameStore, PRODUCTION_TILES, shuffleArray } = await import('./gameStore')
const { DECK } = await import('../lib/projectCards')
const { STARTING_WALLET, CARD_PRICE, WALLET_ENABLED } = await import('./gameConfig')

const api = () => useGameStore.getState()
const fresh = (n = 2) => {
  useGameStore.setState(useGameStore.getInitialState(), true)
  api().initGame(
    Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, username: `P${i}` })),
    shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]))
}

beforeEach(() => fresh())

describe('wallet ENABLED · the branch a flag-off suite cannot reach', () => {
  // ── COUNTERWEIGHT, FIRST · the mock must actually be in effect ────────────────────────────────
  // If the mock silently failed, every assertion below would run against the SHIPPED (disabled)
  // engine and pass for the wrong reason · a whole file describing a branch it never entered, which
  // is worse than not having it (Rule 130b · a control that fires through the wrong path).
  it('the flag really is ON in this file', () => {
    expect(WALLET_ENABLED, 'the module mock did not take effect · every assertion below is running ' +
      'against the disabled engine and proves nothing about the enabled one').toBe(true)
  })

  it('a purchase DEBITS exactly the price', () => {
    const r = api().tryDrawCard(0, 'offer', 0)
    expect(r.ok).toBe(true)
    expect(r.cost).toBe(CARD_PRICE)
    expect(api().players[0].wallet, 'the wallet did not move on a successful purchase · the debit ' +
      'is not wired and the feature is inert when the flag flips').toBe(STARTING_WALLET - CARD_PRICE)
    expect(r.balance).toBe(STARTING_WALLET - CARD_PRICE)
  })

  it('a broke player is REFUSED, and nothing is spent', () => {
    useGameStore.setState(s => { s.players[0].wallet = CARD_PRICE - 1 })
    const hand = api().players[0].hand.length
    const actions = api().actionsRemaining
    const r = api().tryDrawCard(0, 'offer', 0)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('insufficient_funds')
    expect(r.cost).toBe(CARD_PRICE)
    expect(r.balance, 'the refusal must report what they HAVE as well as what it costs, or the UI ' +
      'cannot say how short they are').toBe(CARD_PRICE - 1)
    expect(api().players[0].hand.length, 'a refused purchase still delivered a card').toBe(hand)
    expect(api().actionsRemaining, 'a refused purchase still spent an action · Rule 29, and the ' +
      'exact defect this path was rewritten to close').toBe(actions)
    expect(api().players[0].wallet, 'a refused purchase still debited').toBe(CARD_PRICE - 1)
  })

  it('EXACTLY enough money buys · the boundary, not both sides of it', () => {
    // A predicate test needs a case AT the boundary, not merely on either side of it (Rule 98b).
    // `<` and `<=` differ only here, and getting it wrong makes the last affordable card unbuyable.
    useGameStore.setState(s => { s.players[0].wallet = CARD_PRICE })
    const r = api().tryDrawCard(0, 'offer', 0)
    expect(r.ok, 'a player holding exactly the price was refused · off-by-one on the comparison, ' +
      'and the last card a wallet can afford is the one it can never buy').toBe(true)
    expect(api().players[0].wallet).toBe(0)
  })

  it('the wallet runs out after a whole number of cards and then refuses forever', () => {
    // The steady state the price sweep modelled: $1B / $70M = 14 cards, and the 15th is refused.
    // DECK ONLY, and the first draft alternated with the offer and died at 8 buys · the OFFER holds
    // four cards and is replenished in endTurn, so it runs dry long before a $1B wallet does. The
    // deck holds 46 against the 14 this can afford, so money is the binding constraint by
    // construction. Caught by the `no_card` branch below, which is why it is a throw and not a skip.
    useGameStore.setState(s => { s.actionsRemaining = 9999 })
    let bought = 0
    for (let i = 0; i < 40; i++) {
      const r = api().tryDrawCard(0, 'deck', 0)
      if (r.ok) { bought++; continue }
      if (r.reason === 'insufficient_funds') break
      // any other refusal (no_card) would mean the deck ran out first and this measured nothing
      throw new Error(`ran out of cards before money · reason ${r.reason} after ${bought} buys`)
    }
    expect(bought, 'a $1B wallet at $70M must buy exactly 14 cards').toBe(Math.floor(STARTING_WALLET / CARD_PRICE))
    expect(api().players[0].wallet).toBeLessThan(CARD_PRICE)
    expect(api().tryDrawCard(0, 'offer', 0).reason, 'it started selling again after running dry')
      .toBe('insufficient_funds')
  })

  it('one player going broke does not spend the other player\'s money', () => {
    useGameStore.setState(s => { s.players[0].wallet = 0 })
    expect(api().tryDrawCard(0, 'offer', 0).reason).toBe('insufficient_funds')
    expect(api().players[1].wallet, 'the wallets are not per player · Council ruled per-player ' +
      'precisely because a shared pool lets the faster builder deny the slower one the means to ' +
      'catch up').toBe(STARTING_WALLET)
  })

  // ── THE TERMINAL SEAM · the reason T3's biconditional exists ───────────────────────────────────
  it('a board full of cards nobody can afford is a DEAD position', () => {
    // docs/WALLET_AND_DEMOLITION_CONTRACT.md §5. This is the case that does not exist today and is
    // the whole wallet-side terminal change: 46 cards in the deck, and every player broke, with no
    // placement possible. Before the money term the early return would have declined to notice.
    useGameStore.setState(s => {
      s.players.forEach(p => { p.wallet = 0 })
      s.factories.forEach(f => { f.elements = [] })
    })
    expect(api().deck.length, 'the fixture has no cards left, so this is the OLD dead position and ' +
      'proves nothing about money').toBeGreaterThan(0)
    api().endTurn()
    expect(api().endGameTriggered, 'a game where cards exist, nobody can buy one, and nothing can ' +
      'be placed was not recognised as dead · the player is stuck forever and the endgame never ' +
      'fires. This is the soft-lock class that took four fixes across three lanes to close')
      .toBe(true)
  })

  it('but ONE solvent player keeps the game alive', () => {
    // `.some`, not the current seat. A game in which one player is broke and another can still buy
    // is not dead, and a terminal condition that ended it would end healthy games.
    useGameStore.setState(s => {
      s.players[0].wallet = 0
      s.players[1].wallet = STARTING_WALLET
      s.factories.forEach(f => { f.elements = [] })
    })
    api().endTurn()
    expect(api().endGameTriggered, 'the game ended while a solvent player could still buy a card').toBe(false)
  })
})
