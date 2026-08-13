// A PRICE MUST NOT SOFT-LOCK THE GAME · driven against the REAL End Turn button (T1 S69).
//
// ── WHY THIS FILE EXISTS AND WHY IT IS HERE ──────────────────────────────────────────────────────
// T2 measured the defect at the shipping budget ($1B against a $70M card · a 14-card wallet) and it
// is severe: three of four adversarial-but-legal policies soft-lock 12 games out of 12, against
// 0 of 12 on an infinite budget under every policy. A broke player facing 46 face-up cards has no
// legal move, GameRoom's gate said they had one, so End Turn stayed disabled and they could neither
// act nor pass · and endGameTriggered does not rescue them, because the two-round burn is driven by
// seats ENDING TURNS. That is the S44 lock returning through a door the wallet opened (Rule 103).
//
// ⚠ AND T2's HARNESS CANNOT SEE THE FIX, WHICH IS THE REASON THIS IS NOT REDUNDANT WITH IT.
// `fuzzDriver.js:56` says so in terms: "THIS MODELS T1's GATE, IT DOES NOT EXERCISE IT."
// `uiAllowsEndTurn` is a copy of the S44 condition living in src/store/, and `__s68_locks` · the
// value their `it.fails` asserts on · is computed from that copy. So fixing GameRoom.jsx changes
// their number by exactly zero, and their expected-failure does NOT flip when this lands.
// MEASURED WITH THE FIX IN PLACE, not predicted · and my first draft of this paragraph said "the
// identical 3 locked rows", a number I had not run and which is wrong by seven times:
//     locked rows in the sweep      21     (across 4 policies x 6 budgets)
//     at the SHIPPING 14-card budget       drawHeavy 12/12 · oneRegion 12/12 ·
//                                          neverEmptyFactory 12/12 · greedy 0/12
//     walletSoftLock.test.js               4 passed | 1 expected fail   · unchanged
// Their model needs the same one-line change in their own file, and it is routed. Rule 103a: the
// composition test belongs to whoever can drive the real control.
//
// ── THE NAMED FAILURE THIS MEASUREMENT CANNOT SEE ────────────────────────────────────────────────
// A human who can now pass, and a BOT that still cannot · the exact shape of S45, where three
// correct halves left the bug open because no bot presses a button. Driven below rather than
// reasoned: `useBotTurns` ends the turn when a refused action leaves the seat signature unchanged,
// so a broke bot passes. That safety net predates the wallet and nothing had ever pointed a price
// at it.
// ⚠ THIS IS A SEPARATE FILE FROM GameRoom.softlock.test.jsx AND THAT IS NOT A STYLE CHOICE.
// I wrote this session's work straight over that file with the Write tool, on the assumption that a
// name I had just invented was free. It was not: it is my own S44 suite · 13 tests covering the
// original soft-lock escape, the Escape cancel path and the instruction layer · and the tool told me
// "updated" rather than "created" while I read it as success. 207 lines, gone, and the full suite
// stayed GREEN because the replacement passed on its own terms. The only thing that caught it was
// reading my own staged diff before pushing (preamble §5), where a deleted `fireEvent.keyDown` had
// no business being. Rule 58 in its cheapest form: check whether X exists before you build X.
// They also cannot share a file: that one imports the store at module scope, this one needs
// `vi.resetModules()` + `vi.doMock` per arm to flip WALLET_ENABLED, and the two are incompatible.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabase', () => ({
  supabase: {}, GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823, getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}), recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const until = async (fn, tries = 120) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const endTurn = () => document.querySelector('[data-testid="end-turn-btn"]')
const instruction = () => document.querySelector('[data-testid="instruction"]')?.textContent?.trim() ?? null
const drawStatus = () => document.querySelector('[data-testid="draw-status"]')
const offerCards = () => [...document.querySelectorAll('[data-testid="card-offer"]')]

async function mountWith(on, bots = 0) {
  vi.resetModules()
  vi.doMock('../store/gameConfig', async (importActual) => {
    const actual = await importActual()
    return { ...actual, WALLET_ENABLED: on }
  })
  const cfg = await import('../store/gameConfig')
  const { useGameStore } = await import('../store/gameStore')
  const { clearSaved } = await import('../hooks/useLocalSession')
  const GameRoom = (await import('./GameRoom')).default
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
  render(<MemoryRouter><GameRoom practice practiceBots={bots} /></MemoryRouter>)
  await until(() => document.querySelectorAll('[data-testid="factory"]').length > 0)
  return { cfg, useGameStore }
}

/**
 * The stuck board: every factory empty (so no placement is legal), the Offer stocked (so cards
 * EXIST), and a wallet the caller chooses. This is the state the whole file is about, and it is
 * built from the store rather than from a hand-written fixture, so it cannot describe a board the
 * engine could not produce (Rule 102's corollary · I shipped an impossible fixture once).
 */
async function stuckBoard(useGameStore, wallet, seat = 0) {
  const st = useGameStore.getState()
  await act(async () => {
    useGameStore.setState({
      actionsRemaining: 3,
      factories: st.factories.map(f => ({ ...f, elements: [] })),
      players: st.players.map(p => ({ ...p, wallet })),
    }, false)
  })
  return useGameStore.getState()
}

beforeEach(() => { localStorage.setItem('neotopia_tutorial_v1', '1') })
afterEach(() => { cleanup(); localStorage.clear(); vi.doUnmock('../store/gameConfig'); vi.resetModules() })

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90). Every one is a way "End Turn is enabled" could be produced by
// something other than the fix.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the gate still REFUSES when the player can act', () => {
  it('a RICH player on the same stuck board cannot end their turn early', async () => {
    // THE DISCRIMINATOR FOR THE WHOLE FILE. The board below has no legal placement, so if End Turn
    // unlocked here it would be unlocking on emptiness rather than on affordability, and every
    // assertion in this file would pass on a gate that had simply stopped gating.
    // It is also T2's control, reproduced at the UI layer: an INFINITE budget hangs 0 of 12 under
    // every policy, and the reason is exactly this · a rich player always has a legal move.
    const { cfg, useGameStore } = await mountWith(true)
    expect(cfg.WALLET_ENABLED, '135a · the mock did not take effect · every arm below is the free game').toBe(true)
    const st = await stuckBoard(useGameStore, Number.MAX_SAFE_INTEGER)
    expect(st.theOffer.length, 'no cards on the table · "cards exist but cannot be bought" is not ' +
      'the state under test and nothing here means anything').toBeGreaterThan(0)

    await until(() => endTurn() !== null)
    expect(endTurn().disabled, 'a player who can still buy a card was allowed to pass early · the ' +
      'gate is unlocking on the empty board rather than on affordability, and the whole file is ' +
      'measuring nothing').toBe(true)
  })

  it('and a player with actions AND placements cannot either · the ordinary case', async () => {
    // The second way the gate could be vacuously open: unlocking whenever anything is unusual.
    const { useGameStore } = await mountWith(true)
    const st = useGameStore.getState()
    await act(async () => { useGameStore.setState({ actionsRemaining: 3, players: st.players.map(p => ({ ...p, wallet: 0 })) }, false) })
    await until(() => endTurn() !== null)
    expect(endTurn().disabled, 'a broke player with a full board of legal placements was let off ' +
      'their turn · money is not the only question the gate asks').toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE FIX
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('a broke player facing a full Offer can PASS', () => {
  it('End Turn unlocks, and says which escape unlocked it', async () => {
    const { useGameStore } = await mountWith(true)
    const st = await stuckBoard(useGameStore, 0)
    expect(st.theOffer.length, 'no Offer · this is the empty-supply case, not the broke case').toBeGreaterThan(0)

    await until(() => endTurn() && !endTurn().disabled)
    expect(endTurn().disabled, 'a player with no placement, no money and 46 cards on the table ' +
      'cannot act and cannot pass · this is the S44 soft-lock returning through the wallet, and ' +
      'the engine\'s own endgame does not rescue them because the two-round burn needs seats to END ' +
      'TURNS').toBe(false)
    expect(endTurn().getAttribute('data-unlocked-by'),
      'End Turn is enabled but not by the no-legal-move escape · it unlocked for some other reason ' +
      'and this test is not watching the mechanism it names (Rule 108\'s shape in a gate)')
      .toBe('no-legal-move')
  })

  it('and the instruction says WHICH kind of stuck · not "no legal move" in front of four cards', async () => {
    // A player who CAN pass but is not told why is the state this line has lied about three times.
    // "No legal move left" printed under four face-up cards reads as a bug; the cause is money and
    // the player made it eight draws ago.
    const { useGameStore } = await mountWith(true)
    await stuckBoard(useGameStore, 0)
    await until(() => endTurn() && !endTurn().disabled)
    const line = instruction()
    expect(line, 'no instruction line rendered').toBeTruthy()
    expect(line, `the instruction reads "${line}" · it names the board when the cause is the wallet`)
      .toMatch(/afford/i)
    expect(line, 'and it must still say what to DO · a diagnosis with no action is worse than the ' +
      'generic line it replaced').toMatch(/end your turn/i)
  })

  it('the deck alone is enough to lock it · the Offer is not the only supply', async () => {
    // The gate reads BOTH reachable cards. An Offer-only fix would leave a player with an empty
    // Offer and 40 cards in the deck in exactly the same trap, and every assertion above would
    // still pass (Rule 100 · a guard applied to one member of a class rots as the class grows).
    const { useGameStore } = await mountWith(true)
    await stuckBoard(useGameStore, 0)
    await act(async () => { useGameStore.setState({ theOffer: [] }, false) })
    await until(() => endTurn() && !endTurn().disabled)
    expect(useGameStore.getState().deck.length, 'the deck is empty too · this is the supply-exhausted ' +
      'case and proves nothing about the deck term').toBeGreaterThan(0)
    expect(endTurn().disabled, 'with an empty Offer and a full deck the player is still trapped').toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE REFUSAL REACHES THE PLAYER · T2 carried the reason to the caller in S68 and left the surface
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('a refused draw says why, with the two numbers', () => {
  it('clicking a card you cannot afford names your balance and its price', async () => {
    const { useGameStore } = await mountWith(true)
    await stuckBoard(useGameStore, 50_000_000)   // enough to look plausible, not enough to buy
    await until(() => offerCards().length > 0)
    expect(drawStatus(), 'a refusal is already on screen before anything was clicked · the assertion ' +
      'below would pass without a click').toBeNull()

    await act(async () => { fireEvent.click(offerCards()[0]) })
    await until(() => drawStatus() !== null)
    const el = drawStatus()
    expect(el, 'the draw was refused and nothing on screen says so · this is the silent refusal the ' +
      'enum was built to make impossible').not.toBeNull()
    expect(el.getAttribute('data-refusal'), 'the row rendered for some other reason').toBe('local')
    expect(el.textContent, 'the refusal does not name the balance').toContain('$50M')
    expect(el.textContent, 'the refusal does not name the price').toContain('$70M')
    expect(el.textContent, 'a raw enum token reached the player').not.toContain('_')
  })

  it('and it is announced assertively, not only painted', async () => {
    // A refusal that exists only under the Offer is invisible to the player most likely to have
    // clicked without seeing the card · it goes through the same live region the refused hex-tap
    // uses, which is mounted unconditionally for the reason its own comment gives.
    const { useGameStore } = await mountWith(true)
    await stuckBoard(useGameStore, 50_000_000)
    await until(() => offerCards().length > 0)
    const alert = document.querySelector('[data-testid="sr-alert"]')
    expect(alert, 'no assertive live region').not.toBeNull()
    expect(alert.textContent.trim(), 'the region already has text · a change below would not be a ' +
      'mutation the reader announces').toBe('')

    await act(async () => { fireEvent.click(offerCards()[0]) })
    await until(() => alert.textContent.trim().length > 0)
    expect(alert.textContent, 'the refusal was painted but never announced').toContain('$70M')
    // THE SAME NODE, not a replacement · a fresh node carrying text is silent in most readers.
    expect(document.querySelector('[data-testid="sr-alert"]'),
      'the live region was remounted rather than mutated · most screen readers say nothing').toBe(alert)
  })

  it('a SUCCESSFUL draw leaves no refusal behind', async () => {
    // The lifetime question. A message that survives the condition is the same lie as no message.
    const { useGameStore } = await mountWith(true)
    await stuckBoard(useGameStore, 50_000_000)
    await until(() => offerCards().length > 0)
    await act(async () => { fireEvent.click(offerCards()[0]) })
    await until(() => drawStatus() !== null)
    expect(drawStatus(), 'no refusal to clear · the assertion below is vacuous').not.toBeNull()

    const st = useGameStore.getState()
    await act(async () => { useGameStore.setState({ players: st.players.map(p => ({ ...p, wallet: 1e12 })) }, false) })
    await act(async () => { fireEvent.click(offerCards()[0]) })
    await until(() => drawStatus() === null, 40)
    expect(drawStatus(), 'the refusal is still on screen after a draw that succeeded').toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE NAMED FAILURE · a human who can pass and a BOT that cannot (S45's shape)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the composition · a broke BOT does not freeze the table', () => {
  it('a bot with no placement and no money gives up its turn', async () => {
    // chooseBotAction returns `drawCard` whenever a card EXISTS · it has no affordability term · so
    // a broke bot asks for a card it cannot buy, forever. It does not hang, and the reason is a
    // safety net that predates the wallet: useBotTurns compares the seat signature before and after
    // and ends the turn when a refused action left it unchanged.
    // ⚠ THIS IS THE HALF MY OWN FIX DOES NOT COVER. T1's escape is a BUTTON and no bot presses a
    // button; S45 cost four fixes across three lanes to learn that. Driven rather than reasoned.
    const { useGameStore } = await mountWith(true, 1)
    const st0 = useGameStore.getState()
    expect(st0.players.length, 'no bot at the table · there is no composition to test').toBeGreaterThan(1)

    const st = await stuckBoard(useGameStore, 0)
    expect(st.theOffer.length, 'no cards · the bot would end its turn for the ordinary reason').toBeGreaterThan(0)

    // hand the turn to the bot and watch the seat move on its own
    await act(async () => { useGameStore.setState({ currentSeat: 1, actionsRemaining: 3 }, false) })
    const advanced = await until(() => useGameStore.getState().currentSeat !== 1, 200)
    expect(advanced, `the bot seat is still holding the turn after 2s with no money and no legal ` +
      `placement (turn ${useGameStore.getState().turnNumber}, actions ` +
      `${useGameStore.getState().actionsRemaining}) · a human can now pass and the table still ` +
      'cannot advance, which is exactly S45: three correct halves and the bug still open').toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// FLAG OFF · the equivalence, DRIVEN rather than argued (Rule 135b)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('with the flag off this change is byte-identical for players', () => {
  it('a wallet of ZERO changes nothing · cards are free, so the gate is the old question', async () => {
    // The arithmetic: costOf returns 0 for every card, so cheapestAvailableCost is 0 whenever a
    // reachable card exists and null when none does, and `wallet >= 0` holds for every wallet. So
    // canAcquireCard IS `a reachable card exists`, which is what this line asked from S44 to S69.
    // Asserted by DRIVING the most extreme input rather than by repeating the derivation.
    const { cfg, useGameStore } = await mountWith(false)
    expect(cfg.WALLET_ENABLED, '135a · the mock did not take effect').toBe(false)
    const st = await stuckBoard(useGameStore, 0)
    expect(st.theOffer.length).toBeGreaterThan(0)

    await until(() => endTurn() !== null)
    expect(endTurn().disabled, 'a zero wallet unlocked End Turn with the flag OFF · the price gate ' +
      'is reachable in production, where nothing charges anything, and every player with an empty ' +
      'wallet field can pass at will').toBe(true)
    expect(instruction(), 'the affordability copy is reachable with the flag off · it would tell a ' +
      'player they cannot afford a card that is free').not.toMatch(/afford/i)
  })

  it('and the supply-exhausted escape still works · the case that is NOT about money', async () => {
    // The pre-existing S44 behaviour, which this must not have broken: no placement AND no cards at
    // all unlocks End Turn, with or without a wallet.
    const { useGameStore } = await mountWith(false)
    await stuckBoard(useGameStore, 0)
    await act(async () => { useGameStore.setState({ theOffer: [], deck: [] }, false) })
    await until(() => endTurn() && !endTurn().disabled)
    expect(endTurn().disabled, 'no placement and no cards anywhere and the player still cannot ' +
      'pass · the S44 escape itself is broken').toBe(false)
    expect(instruction()).toMatch(/no legal move/i)
  })
})
