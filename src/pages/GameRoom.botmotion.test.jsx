// P3 · DOES THE BOT'S ACTION HAVE MOTION ON THE BOARD? (T1 S69)
//
// Council: "the bot's turn is not silent in the log · what is missing is on the BOARD. A player
// watching the hexes sees nothing happen for three seconds and then a token appears. The gap is not
// no spinner, it is that the bot's action has no motion while the player's does."
//
// The brief flagged the premise UNVERIFIED and asked for the check before any build. It is HALF
// FALSE, and the half that survives is a different animation from the one Council named.
//
// ── MEASURED IN CHROMIUM FIRST, then pinned here ────────────────────────────────────────────────
// A MutationObserver over the real board, human placement as the control, bot playing for 115s:
//     human placement   6 hex-burst particles
//     bot placement    24 hex-burst particles across 4 placements, at seat 1
//     hex-built rings   0 · AND THE PROBE REFUSED TO CALL THAT A FINDING, because the store said
//                       scoredCardIds [0, 0]: the bot never scored, so zero rings is "nobody
//                       scored" and not "the bot's score is silent" (Rule 120 · an absence needs a
//                       positive control, and the control here is that somebody scored at all).
//
// THE PLACEMENT BURST CANNOT BE ASYMMETRIC, and that is structural rather than lucky: it lives in
// HexCell and fires on `element` going empty -> occupied, so it has no way to know who placed. There
// is no author-conditional anywhere on that path. P3 as briefed is a NON-FINDING.
//
// THE DISTRICT SETTLE WAS ASYMMETRIC, and it was the bigger animation · 620ms of the whole completed
// pattern lighting up, against 400ms of six particles. It fired from INSIDE the hand card's onClick,
// and a bot does not click a card. That is Council's observation landing on the animation next door
// to the one they named.
//
// ✅ CLOSED T1 S70. T2 shipped `region.lastBuiltKeys` from inside tryScoreCard (c4fc244 · the SAME
// `matches[0]` the engine validated, not a recomputation), and the settle now fires from a STORE
// effect keyed on a monotone district count rather than from the click. ONE mechanism for both
// actors · firing in both places would be two guards, neither mutation-testable because either is
// sufficient (Rule 118), plus a double-fire on every human score.
// The assertion below was `it.fails` for one session and is a real assertion now.
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
const until = async (fn, tries = 120) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const settleRings = () => document.querySelectorAll('[data-testid="hex-built"]').length
const state = () => useGameStore.getState()

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

/** Mount practice and drive a HUMAN score through the real four-step flow + card click. */
async function humanScores() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  const st = state()
  const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
  const seed = completableStatePatch(st.regions, hand, 0)
  if (!seed) return null
  const factory = st.factories.find(f => f.betweenRegions.includes(seed.regionId))
  await act(async () => {
    useGameStore.setState({
      ...seed.patch, actionsRemaining: 3,
      factories: st.factories.map(f => (f.id === factory.id
        ? { ...f, elements: [{ type: seed.requiredType, count: 3 }] } : f)),
    }, false)
  })
  const click = async (el) => { await act(async () => { fireEvent.click(el) }) }
  const phase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase')
  await click(screen.getAllByTestId('factory')[st.factories.indexOf(factory)])
  await until(() => phase() === 'factorySelected')
  await click(screen.getAllByTestId('element-btn')[0])
  await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
  const rb = screen.queryAllByTestId('region-btn')
  if (rb.length) await click(rb[factory.betweenRegions.indexOf(seed.regionId)] ?? rb[0])
  await until(() => phase() === 'regionSelected')
  const target = [...document.querySelectorAll('g.hex-cell[data-hex]')]
    .find(c => c.getAttribute('data-hex') === seed.missingKey)
  if (!target) return null
  await click(target)
  await until(() => phase() === 'scorePending')
  const card = screen.queryAllByTestId('card-hand').find(c => (c.textContent || '').includes(seed.card.name))
  if (!card) return null
  await click(card)
  return seed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHT · FIRST (Rule 90). The settle must be OBSERVABLE at all, or every absence below is
// about a selector rather than about a bot.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the district settle is real and this file can see it', () => {
  it('a board with nobody scoring shows no settle ring', async () => {
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    expect(settleRings(), 'settle rings are on screen before anyone built anything · the selector ' +
      'matches something permanent and every count in this file is noise').toBe(0)
  })

  it('a HUMAN score lights the pattern · the positive control', async () => {
    // Without this arm, "the bot produces no settle" is indistinguishable from "the settle never
    // renders in jsdom", which is the uniform-zero shape (preamble §3).
    const seed = await humanScores()
    expect(seed, 'the fixture could not complete a district · UNMEASURED, not a pass').not.toBeNull()
    await until(() => settleRings() > 0)
    expect(settleRings(), 'a human scored a district and no hex lit up · the settle is broken for ' +
      'everyone and the bot comparison below is meaningless').toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE FINDING · and it is carried as an EXPECTED FAILURE, not as a red gate
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('a district built by a BOT', () => {
  // ⚠ THIS WAS `it.fails` FOR ONE SESSION AND THE HANDOFF WORKED EXACTLY AS DOCUMENTED. I refused to
  // re-derive the completed hexes in the UI · a second pattern matcher beside findBuildableCards
  // (Rule 45), wrong in exactly the 8.5% of completions with two buildable cards · and routed the
  // datum instead. T2 shipped it, this went red on the next boot ("Expect test to fail"), and red
  // was the signal to promote it. Two lanes, one field, no second engine.
  //
  // ⚠ AND IT WAS PASSING FOR THE WRONG REASON THE WHOLE TIME, which is the more useful lesson.
  // See the fixture note below: my S69 setup discarded the seeded pattern, so the bot never scored,
  // so of course no ring appeared. The it.fails was green because of a broken fixture rather than
  // because of the defect it named · and the defect WAS real, so nothing about the outcome would
  // have told me. Rule 120 inside a fixture: I asserted an absence in a state I had failed to
  // create. The positive control on scoredCardIds is what makes that impossible now.
  it('lights its pattern the way a human-built one does', async () => {
    render(<MemoryRouter><GameRoom practice practiceBots={1} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    const st = state()
    const botSeat = 1
    const botHand = st.players.find(p => p.seat === botSeat)?.hand ?? []
    const seed = completableStatePatch(st.regions, botHand, botSeat)
    expect(seed, 'the fixture could not give the BOT a completable district · UNMEASURED').not.toBeNull()

    // Complete the pattern on the board and let the ENGINE score it for the bot · the exact call
    // useBotTurns makes. No click, because a bot does not click, which is the whole point.
    // ⚠ TWO SETSTATES, AND THE ORDER IS THE WHOLE THING. My S69 version did ONE, spreading
    // `seed.patch` and then overriding `regions` with a map over the PRE-PATCH regions · so the
    // seeded pattern was thrown away, only the completing hex was placed, the pattern was never
    // complete and scoreCard silently REFUSED. The it.fails then passed for the wrong reason: not
    // "the settle does not fire for a bot" but "no bot ever scored". Rule 120's shape inside a
    // fixture · I asserted an absence in a state I had failed to create.
    await act(async () => { useGameStore.setState({ ...seed.patch, currentSeat: botSeat }, false) })
    await act(async () => {
      const s = state()
      const [q, r] = seed.missingKey.split(',').map(Number)
      useGameStore.setState({
        regions: s.regions.map(reg => (reg.id === seed.regionId
          ? { ...reg, hexes: { ...reg.hexes, [`${q},${r}`]: { element: seed.requiredType, placedBy: botSeat } } } : reg)),
      }, false)
    })
    const scoredBefore = state().players.reduce((n, p) => n + (p.scoredCardIds?.length ?? 0), 0)
    await act(async () => { state().scoreCard(botSeat, seed.card.id, seed.regionId, seed.missingKey) })
    const scoredAfter = state().players.reduce((n, p) => n + (p.scoredCardIds?.length ?? 0), 0)
    // THE CONTROL THIS ASSERTION ALWAYS NEEDED. "No settle ring" is produced identically by "the
    // settle is silent for bots" and by "the bot never scored", and for a whole session it was the
    // second one. Assert the district was actually BUILT before asserting anything about its
    // animation (Rule 120 · an absence needs a positive control, and mine was in the fixture).
    expect(scoredAfter, `the bot did not score · scoredCardIds went ${scoredBefore} -> ${scoredAfter}. ` +
      'Nothing below is about animation.').toBeGreaterThan(scoredBefore)
    await until(() => settleRings() > 0, 40)

    expect(settleRings(), 'a bot completed a district and not one hex lit up. The player watching ' +
      'the board sees a token appear and the card vanish · the 620ms settle that makes a human\'s ' +
      'district feel built fires only from the hand card\'s onClick (GameRoom.jsx:1776), and a bot ' +
      'does not click. Needs the completed hex keys on the store (T2 · tryScoreCard already has ' +
      'them). IF THIS TEST IS RED, the datum has landed · delete the .fails and keep the assertion.')
      .toBeGreaterThan(0)
  })
})
