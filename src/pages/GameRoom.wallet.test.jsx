// THE FLAG, DRIVEN IN BOTH POSITIONS · Rule 135, in the lane that owns the surface.
//
// T2 shipped the wallet behind `WALLET_ENABLED = false` and wrote seventeen tests that all passed
// with it off, then wrote the rule about it: "the flag gates correctly" and "the feature is inert"
// produce identical greens, and a flag-off suite cannot separate them. The UI half has exactly the
// same hazard and one extra one on top · the readout could render a balance that nothing can spend,
// or a PRICE on a card that tryDrawCard charges nothing for, which is a lie printed on the object
// the player is deciding about.
//
// So both arms run here, in one file, each importing a fresh module graph. The mock reaches
// gameStore too (it imports the same constant), so the ON arm is the real engine charging real
// money · not a model of it.
//
// ⚠ 135a · THE FIRST ASSERTION IN EACH ARM IS THAT THE MOCK TOOK EFFECT. If it silently fails, every
// line below runs against the other configuration and passes for the wrong reason · a whole file
// describing a branch it never entered, which reads as coverage and is worse than no file.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
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

const until = async (fn, tries = 90) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const readout = () => document.querySelector('[data-testid="wallet-readout"]')
const offerCards = () => [...document.querySelectorAll('[data-testid="card-offer"]')]
const handCards = () => [...document.querySelectorAll('[data-testid="card-hand"]')]
const pricesIn = (els) => els.flatMap(c => [...c.querySelectorAll('[data-card-price]')])
const badgesIn = (els) => els.flatMap(c => [...c.querySelectorAll('[data-near-miss]')])

/**
 * Mount practice against a module graph where WALLET_ENABLED is `on`.
 * Returns the fresh gameConfig + store so the caller can assert against the SAME graph the component
 * is using · reading the top-level import here would be reading the other one (Rule 92).
 */
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

beforeEach(() => { localStorage.setItem('neotopia_tutorial_v1', '1') })
afterEach(() => { cleanup(); localStorage.clear(); vi.doUnmock('../store/gameConfig'); vi.resetModules() })

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ARM OFF · what every player sees today. Written FIRST because it is the counterweight: if the
// readout or a price appears here, the flag is decorative and the engine charges nothing (Rule 63).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('WALLET_ENABLED false · the shipped state', () => {
  it('renders no readout and no price anywhere · the flag gates the SURFACE, not just the charge', async () => {
    const { cfg } = await mountWith(false)
    expect(cfg.WALLET_ENABLED, '135a · the mock did not take effect · every line below describes the ' +
      'wrong configuration').toBe(false)

    expect(offerCards().length, 'no offer rendered · the price absence below is about nothing').toBeGreaterThan(0)
    expect(readout(), 'a wallet readout while nothing can be bought · the player is shown a balance ' +
      'that no action in the game can spend').toBeNull()
    expect(pricesIn(offerCards()).length,
      'an Offer card quotes a price while tryDrawCard charges 0 · a price printed on the object the ' +
      'player is deciding about, which is false').toBe(0)
    // and the dots it would have replaced are still there
    expect(document.querySelector('[data-testid="action-dots"]'),
      'the action dots are gone with no readout to replace them').not.toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE BYCATCH · a defect the wallet's control found in code that predates it by thirty sessions and
// which is flag-independent. Gated here because this file owns the only fixture that can see it:
// a bot at the table, so mySeat and currentSeat diverge.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the bonus chip belongs to the player LOOKING, not the player playing', () => {
  it('shows my held tokens while the other seat plays', async () => {
    // SHIPPED WRONG SINCE S38: `bonusTokens={currentPlayer?.bonusTokens}`, while the panel it feeds
    // gates every Use button on isMyTurn and spends `mySeat ?? currentSeat`'s token. So on an
    // opponent's turn the chip counted THEIR tokens and listed each as "Only on your turn" · one
    // player's resources shown, another player's spent. Invisible everywhere anyone looked, because
    // solo and practice-without-bots make the two the same object.
    const { useGameStore } = await mountWith(false, 1)
    const st = useGameStore.getState()
    expect(st.players.length, 'no second seat · the two candidates coincide and this proves nothing')
      .toBeGreaterThan(1)

    await act(async () => {
      useGameStore.setState({
        currentSeat: 1,
        players: st.players.map(p => ({
          ...p, bonusTokens: p.seat === 0 ? ['subsidy'] : ['subsidy', 'permits', 'initiative'],
        })),
      }, false)
    })
    await until(() => document.querySelector('[data-testid="bonus-chip"]') !== null, 40)
    const chip = document.querySelector('[data-testid="bonus-chip"]')
    expect(chip, 'no chip rendered · the count below would be about nothing').not.toBeNull()
    expect(chip.getAttribute('data-bonus-count'),
      'the chip is counting the CURRENT seat\'s tokens · it shows an opponent\'s held resources to ' +
      'the player waiting, and its own Use button spends a different player\'s').toBe('1')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ARM ON · the branch nothing in this repo had entered before this file
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('WALLET_ENABLED true · the branch the flag hides', () => {
  it('shows the store\'s own balance, and follows it when it moves', async () => {
    // ⚠ WHAT THIS CANNOT SAY, STATED RATHER THAN IMPLIED. My first version of this test claimed the
    // readout shows MY seat rather than the CURRENT seat, and set the two seats to different
    // balances to "prove" it. A mutation swapping the wiring to `currentPlayer` left it GREEN:
    // practice runs with mySeat null, so myPlayer falls back to currentPlayer and the two branches
    // denote one object. The control fired through a path where the candidates coincide (Rule 130b)
    // and the mutation landed in the file but not in the measurement (Rule 132).
    // That claim now lives in utils/viewingPlayer.test.js, where mySeat and currentSeat are
    // arguments and can differ. What THIS arm can witness is that the readout is wired to the real
    // store and tracks it · which the vacuous version never checked either.
    const { cfg, useGameStore } = await mountWith(true)
    expect(cfg.WALLET_ENABLED, '135a · the mock did not take effect').toBe(true)

    await until(() => readout() !== null)
    expect(readout(), 'the flag is on and no balance is on screen · the feature has no surface').not.toBeNull()

    const st = useGameStore.getState()
    const seat = st.currentSeat
    const mine = st.players.find(p => p.seat === seat)
    expect(mine.wallet, 'the store gives this player no wallet · the readout below would be about ' +
      'nothing').toBe(cfg.STARTING_WALLET)
    expect(readout().getAttribute('data-wallet'), 'the readout does not carry the store\'s own number')
      .toBe(String(mine.wallet))

    // IT TRACKS. A readout that renders the opening balance and then never moves is the shape this
    // project has shipped six times (award_game_win, useBonus, card art, two dead sounds, the
    // wallet's own flag) · correct on arrival and inert for the rest of the game.
    await act(async () => {
      useGameStore.setState({
        players: st.players.map(p => (p.seat === seat ? { ...p, wallet: 300_000_000 } : p)),
      }, false)
    })
    await until(() => readout()?.getAttribute('data-wallet') === '300000000', 40)
    expect(readout().getAttribute('data-wallet'),
      'the balance changed in the store and the bar still shows the opening figure').toBe('300000000')
    expect(readout().textContent, 'the rendered string did not follow the data attribute').toContain('$300M')
  })

  it('MY money while the OTHER seat plays · reachable with a bot at the table, not without one', async () => {
    // THE ASSERTION MY FIRST FIXTURE COULD NOT MAKE, and the reason is worth keeping: at
    // practiceBots=0 there is one player, so mySeat === currentSeat and `myPlayer` and
    // `currentPlayer` denote one object. Swapping the wiring between them left 34 tests green.
    // At practiceBots=1 the human is seat 0 and the bot is seat 1, so mySeat STAYS 0 while
    // currentSeat moves · and the two candidates finally differ (Rule 120 · the control has to
    // create the state the assertion is about, not a state that resembles it).
    const { cfg, useGameStore } = await mountWith(true, 1)
    expect(cfg.WALLET_ENABLED, '135a · the mock did not take effect').toBe(true)
    await until(() => readout() !== null)

    const st = useGameStore.getState()
    expect(st.players.length, 'no bot at the table · mySeat and currentSeat cannot diverge and this ' +
      'test is the vacuous one it replaced').toBeGreaterThan(1)

    // Different money per seat AND the turn handed to the bot · both are required. Equal balances
    // satisfy either wiring; an unchanged seat satisfies either wiring.
    await act(async () => {
      useGameStore.setState({
        currentSeat: 1,
        players: st.players.map(p => ({ ...p, wallet: p.seat === 0 ? 300_000_000 : 930_000_000 })),
      }, false)
    })
    await until(() => readout()?.getAttribute('data-wallet') != null, 40)
    expect(readout().getAttribute('data-wallet'),
      'the bar is showing the seat that is PLAYING rather than the seat that is LOOKING · in a real ' +
      'room that renders an opponent\'s balance to the player waiting for their turn').toBe('300000000')
  })

  it('prices every Offer card, from the engine\'s own priceOf', async () => {
    const { cfg } = await mountWith(true)
    expect(cfg.WALLET_ENABLED).toBe(true)
    await until(() => offerCards().length > 0)

    const offers = offerCards()
    const prices = pricesIn(offers)
    expect(prices.length, 'the flag is on and the Offer quotes no price · the player is asked to buy ' +
      'something with no cost on it').toBe(offers.length)
    // The VALUE, not just the presence (Rule 61) · and taken from the engine rather than retyped.
    const expected = String(cfg.priceOf(null))
    for (const p of prices) {
      expect(p.getAttribute('data-card-price'), 'a card quotes a price the engine would not charge').toBe(expected)
    }
    expect(prices[0].textContent.trim(), 'the price renders as raw digits').toMatch(/^\$\d/)
  })

  it('DISJOINT · a price is never on a card you hold, and a distance never on one you do not', async () => {
    // THE GUARD I OWED FROM S66. The near-miss badge and the price share the `category` slot in
    // CardFrame, so if one card ever received both they would paint over each other. They cannot,
    // because near-miss is a fact about a card you HOLD and a price is a fact about one you have
    // NOT bought · but "cannot" was resting on nobody passing the prop, which is exactly the
    // "safe because nobody does it" shape the S65 scope guard existed to pin.
    const { cfg, useGameStore } = await mountWith(true)
    expect(cfg.WALLET_ENABLED).toBe(true)
    const { completableStatePatch } = await import('./scorePendingFixture')
    await until(() => handCards().length > 0 && offerCards().length > 0)

    // POSITIVE CONTROL (Rule 120) · make a HAND card genuinely near-miss in this same run. Without
    // it, "no badge on the Offer" is indistinguishable from "no badge anywhere, ever".
    const st = useGameStore.getState()
    const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
    const seed = completableStatePatch(st.regions, hand, 0)
    expect(seed, 'the fixture could not make any hand card one-away · UNMEASURED, not a pass').not.toBeNull()
    await act(async () => { useGameStore.setState({ ...seed.patch, actionsRemaining: 3 }, false) })
    await until(() => badgesIn(handCards()).length > 0)
    expect(badgesIn(handCards()).length,
      'no hand card shows a near-miss badge · the disjointness assertions below are vacuous')
      .toBeGreaterThan(0)

    expect(badgesIn(offerCards()).length,
      'an Offer card advertises how close it is · it claims progress on a card the player has not ' +
      'bought, and it paints over the price in the same slot').toBe(0)
    expect(pricesIn(handCards()).length,
      'a card already in the hand still carries a price · it is not for sale, and the price would ' +
      'overwrite its near-miss distance').toBe(0)
    // and nothing anywhere carries both
    for (const c of [...handCards(), ...offerCards()]) {
      const both = c.querySelectorAll('[data-near-miss]').length && c.querySelectorAll('[data-card-price]').length
      expect(both, 'one card carries a distance AND a price · they share the category slot and are ' +
        'painting over each other').toBeFalsy()
    }
  })
})
