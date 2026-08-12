// THE PAYOFF MOMENT, REACHED THROUGH THE REAL UI (T1 S58).
//
// ── WHY THIS FILE EXISTS · MY OWN S57 CRITIQUE ───────────────────────────────────────────────────
// I measured ScoreFlash's coverage last session in a HARNESS · GameBoard and ScoreFlash rendered side
// by side · because I could not produce a completed pattern through the UI. A harness is a model, and
// Rule 36 is the rule this project has paid for most: a model that diverges is how three sessions of
// product bugs turned out to be environment. So the fixture below seeds a board that is ONE LEGAL
// PLACEMENT away from completing a real card, and everything after that is the shipped flow ·
// factory, element, region, hex · with no store pokes and no dispatching into the component.
//
// It closes two blind spots with one fixture, which is why it was worth more than re-verifying the
// scrim numbers:
//   · ScoreFlash now renders in the REAL GameRoom, from a real score, in a test.
//   · uiPhase 'scorePending' becomes reachable · the branch my S50 focus gate has never once entered.
//
// ── THE FIXTURE'S ONE RULE: THE ENGINE CERTIFIES IT, NOT ME ──────────────────────────────────────
// A seeded board is a claim about geometry, and I am exactly the wrong party to adjudicate it (Rule
// 45 · a second rules engine inside a test is a second contract that drifts). So the seed is verified
// by asking `getBuildableCards` · the same selector the product asks · that the board is NOT buildable
// before the placement and IS after it. If my geometry were wrong the counterweight reds, rather than
// the test quietly proving something about a board that cannot exist (Rule 102's corollary).
//
// It follows deadlockFixture.js's shape deliberately: a pure function that takes the current regions
// and RETURNS A PATCH rather than touching the store, so a browser page could seed the same board.
// ⚠ IT NO LONGER LIVES IN THIS FILE. S59 needed the same board to measure keyboard reach at
// scorePending, and a second copy of a geometry rule is a second contract (Rule 45) · so it is
// ./scorePendingFixture.js now, imported by both. Still in src/pages/ rather than src/store/, which
// is T2's lane: if another lane wants it there, moving it is a rename and their ask.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { completableStatePatch } from './scorePendingFixture'

vi.mock('../lib/supabase', () => ({
  supabase: {}, GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823, getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}), recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const GameRoom = (await import('./GameRoom')).default

const phase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase') ?? null
const cells = () => [...document.querySelectorAll('g.hex-cell[data-hex]')]
const until = async (fn, tries = 90) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const click = async (el) => { await act(async () => { fireEvent.click(el) }) }

// The fixture moved to ./scorePendingFixture.js in S59 so GameRoom.cardreach.test.jsx can use the
// same one. Its contract and the reason the ENGINE must certify it are documented there.

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(cleanup)

/** Mount practice, seed a one-away board, and hand back everything the flow needs. */
async function oneAway() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)

  const st = useGameStore.getState()
  const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
  const seed = completableStatePatch(st.regions, hand, 0)
  if (!seed) return null

  // A factory that borders the region, stocked with ONLY the missing type · so element-btn[0] is
  // unambiguous and the flow needs no guessing.
  const factoryIdx = st.factories.findIndex(f => f.betweenRegions.includes(seed.regionId))
  const factory = st.factories[factoryIdx]
  await act(async () => {
    useGameStore.setState({
      ...seed.patch,
      actionsRemaining: 3,
      factories: st.factories.map(f => f.id === factory.id
        ? { ...f, elements: [{ type: seed.requiredType, count: 3 }] } : f),
    }, false)
  })
  return { ...seed, factoryIdx, factory, regionBtnIdx: factory.betweenRegions.indexOf(seed.regionId) }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHT FIRST · THE ENGINE CERTIFIES THE FIXTURE (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the seeded board is genuinely ONE placement away', () => {
  it('the engine says not-yet-buildable before, and buildable after', async () => {
    const s = await oneAway()
    expect(s, 'no hand card fits the region · UNMEASURED, not a pass').not.toBeNull()

    const before = useGameStore.getState().getBuildableCards(s.regionId)
    expect(before.map(m => m.cardId),
      'the seed ALREADY completes a card · then every assertion below is about a board one step past ' +
      'the one I meant to build, and reaching scorePending would prove nothing about the placement')
      .not.toContain(s.card.id)

    // Fill the missing hex directly and ask the engine again · this is the fixture proving its own
    // premise, not the product being tested.
    const st = useGameStore.getState()
    const [mq, mr] = s.missingKey.split(',').map(Number)
    await act(async () => {
      useGameStore.setState({
        regions: st.regions.map(r => r.id === s.regionId
          ? { ...r, hexes: { ...r.hexes, [s.missingKey]: { element: s.requiredType, placedBy: 0 } } } : r),
      }, false)
    })
    const after = useGameStore.getState().getBuildableCards(s.regionId, `${mq},${mr}`)
    expect(after.map(m => m.cardId),
      'filling the one missing hex did NOT complete the card · the fixture geometry is wrong and ' +
      'every "one away" claim in this file is false').toContain(s.card.id)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CLAIMS · driven through the shipped four-step flow
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the payoff moment in the real GameRoom', () => {
  async function playToScorePending() {
    const s = await oneAway()
    if (!s) return null
    await click(screen.getAllByTestId('factory')[s.factoryIdx])
    await until(() => phase() === 'factorySelected')
    await click(screen.getAllByTestId('element-btn')[0])
    await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
    const regionBtns = screen.queryAllByTestId('region-btn')
    if (regionBtns.length) await click(regionBtns[s.regionBtnIdx] ?? regionBtns[0])
    await until(() => phase() === 'regionSelected')
    const target = cells().find(c => c.getAttribute('data-hex') === s.missingKey)
    if (!target) return { ...s, failed: 'the missing hex is not on the board' }
    if (target.getAttribute('data-valid') !== 'true') return { ...s, failed: 'the missing hex is not a legal target' }
    await click(target)
    return s
  }

  it('a completing placement reaches scorePending · the branch nothing has ever entered', async () => {
    const s = await playToScorePending()
    expect(s, 'fixture unavailable · UNMEASURED').not.toBeNull()
    expect(s.failed, `the flow could not reach the placement: ${s.failed}`).toBeUndefined()
    expect(phase(), 'a placement that completes a card did not open the scoring step').toBe('scorePending')
  })

  it('the completed card is offered, and scoring it renders ScoreFlash IN GAMEROOM', async () => {
    // The thing S57 could only do in a harness. ScoreFlash is mounted by GameRoom itself here, from a
    // real score, after a real placement · so its presence is evidence about the product rather than
    // about two components I chose to render next to each other.
    const s = await playToScorePending()
    expect(s?.failed).toBeUndefined()
    expect(phase()).toBe('scorePending')

    // ⚠ SELECTED BY NAME, because there is nothing else to select it by. Every hand card renders
    // data-testid="card-hand", and the scoreable one is distinguished ONLY by a boxShadow · no
    // attribute, no aria state (CardFrame.jsx:151,161). That is Rule 50's shape · a testid on a
    // permanently-mounted element cannot carry state · and it is worth more than this test: the
    // instruction copy says "select a glowing card", so the glow is a single-channel signal.
    const target = screen.queryAllByTestId('card-hand').find(el => el.textContent.includes(s.card.name))
    expect(target, 'the completed card is not on screen to be scored').toBeTruthy()
    await click(target)

    const flashed = await until(() => document.querySelector('.score-flash')
      || [...document.querySelectorAll('*')].some(el => el.className?.toString?.().includes('score-flash')))
    expect(flashed, 'scoring a card in the real GameRoom rendered no ScoreFlash').toBeTruthy()
  })

  it('the phone focus zoom is RELEASED the instant scoring begins', async () => {
    // ⚠ MY FIRST VERSION OF THIS TEST COULD NOT FAIL, TWICE OVER, and it is the reason this comment is
    // longer than the test. It asserted "60 cells at scorePending" · but (a) jsdom has no matchMedia,
    // so `isPhone` is false forever and focusRegion is structurally always null, and (b) focusRegion
    // changes the VIEWBOX, not how many cells render, so 60 was true in both states anyway. A
    // characterisation that pins the wrong observable in a state the harness cannot enter is exactly
    // the vacuity I spent this session's P2 arguing about (Rules 86 · 92).
    // So: stub the phone, and assert an ORDERING between two measured values rather than a constant I
    // would have to retune whenever the board geometry moves (Rule 112b).
    window.matchMedia = (qy) => ({
      matches: /max-width:\s*600px/.test(qy), media: qy,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    })
    const s = await oneAway()
    expect(s, 'fixture unavailable · UNMEASURED').not.toBeNull()

    const vb = () => {
      const box = document.querySelector('.game-board-area svg')?.getAttribute('viewBox')
      return box ? +box.split(/\s+/)[2] : null
    }
    await click(screen.getAllByTestId('factory')[s.factoryIdx])
    await until(() => phase() === 'factorySelected')
    await click(screen.getAllByTestId('element-btn')[0])
    await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
    const rb = screen.queryAllByTestId('region-btn')
    if (rb.length) await click(rb[s.regionBtnIdx] ?? rb[0])
    await until(() => phase() === 'regionSelected')

    // POSITIVE CONTROL IN THE SAME RUN · the zoom must actually happen, or "it is released" is a
    // statement about a feature that was never on (Rule 120).
    const zoomed = vb()
    expect(zoomed, 'no viewBox to read').toBeGreaterThan(0)

    const target = cells().find(c => c.getAttribute('data-hex') === s.missingKey)
    await click(target)
    expect(phase()).toBe('scorePending')
    const released = vb()

    expect(released, 'the board did not widen when scoring began · the phone zoom is HOLDING through ' +
      'scorePending. That may be the better design · the player is choosing a card, not a hex · but it ' +
      'is a change, and this line is where it gets noticed').toBeGreaterThan(zoomed)
  })
})
