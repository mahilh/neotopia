// A DISTRICT ARRIVING WITH WEIGHT (T1 S62) · and the two overlays that were semantically absent.
//
// ── WHY (a) AND NOT (b) ──────────────────────────────────────────────────────────────────────────
// The brief offered two Feel additions and asked for one with a reason.
//   1 · THE ASYMMETRY IS MINE. In S58 I gave the board a picture for NO · a black ring on a refused
//       tap. The board still had no picture for YES: a completed district produced a sound, a
//       counting number and a 2.2s overlay, all of them OFF the board, while the hexes the player
//       actually built did nothing. Closing that is repair, not decoration.
//   2 · DENOMINATOR BY CONSEQUENCE, NOT FREQUENCY. A bot-thinking cue fires more often but decorates
//       a WAIT; this fires at the one moment the whole loop exists to produce.
//   3 · (b) RESTS ON A PREMISE I HAVE NOT CHECKED. T2 measured bots at 2.5-3.2s per turn, but that
//       is elapsed time, not deliberation. A "thinking" indicator on a bot that decided instantly
//       and is sitting on a timer is theatre · a cue asserting something the system is not doing.
//       (a) needs no such premise.
//
// ── THE FAILURE THIS FILE CANNOT SEE, NAMED FIRST ────────────────────────────────────────────────
// Whether two animations on one cell READ as noise. jsdom has no paint and no compositor, so it can
// prove both nodes exist with the right animation names and delays and cannot tell me whether the
// result looks busy. The collision is real and MY OWN WORK MADE IT REACHABLE: a fast keyboard player
// can score inside the placement burst's 450ms (Enter to place, Enter to score), so one cell can
// carry burst particles and the settle at once. They are separate nodes with separate animations, so
// neither cancels the other · that much is testable, and it is asserted below. The aesthetic question
// is not, and is not claimed.
//
// ── COUNTERWEIGHTS FIRST (Rule 90) ───────────────────────────────────────────────────────────────
//   1 · celebrating patternHighlight instead of the scored card's own matchedHexKeys · 8.5% of
//       completions offer two cards (S59), so the wrong version lights hexes for a card nobody scored
//   2 · keyed on the hex set rather than a monotone seq · scoring the same shape twice goes silent
//   3 · a settle on every cell rather than the pattern's · then "the district" means the board

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'node:fs'
import path from 'node:path'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { completableStatePatch } from './scorePendingFixture'
import { PROJECT_CARDS } from '../lib/projectCards'

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
const GameBoard = (await import('../components/Board/GameBoard')).default

const phase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase') ?? null
const cells = () => [...document.querySelectorAll('g.hex-cell[data-hex]')]
const built = () => [...document.querySelectorAll('[data-testid="hex-built"]')]
const builtKeys = () => built().map(p => p.closest('g.hex-cell').getAttribute('data-hex')).sort()
const until = async (fn, tries = 90) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const click = async (el) => { await act(async () => { fireEvent.click(el) }) }

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

/** Seed a board one placement from completing a real card, then play the four steps into scorePending. */
async function toScorePending() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  const st = useGameStore.getState()
  const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
  const seed = completableStatePatch(st.regions, hand, 0)
  if (!seed) return null
  const fIdx = st.factories.findIndex(f => f.betweenRegions.includes(seed.regionId))
  const factory = st.factories[fIdx]
  await act(async () => {
    useGameStore.setState({
      ...seed.patch, actionsRemaining: 3,
      factories: st.factories.map(f => f.id === factory.id
        ? { ...f, elements: [{ type: seed.requiredType, count: 3 }] } : f),
    }, false)
  })
  await click(screen.getAllByTestId('factory')[fIdx])
  await until(() => phase() === 'factorySelected')
  await click(screen.getAllByTestId('element-btn')[0])
  await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
  const rb = screen.queryAllByTestId('region-btn')
  if (rb.length) await click(rb[factory.betweenRegions.indexOf(seed.regionId)] ?? rb[0])
  await until(() => phase() === 'regionSelected')
  const target = cells().find(c => c.getAttribute('data-hex') === seed.missingKey)
  if (!target || target.getAttribute('data-valid') !== 'true') return { ...seed, failed: 'no legal target' }
  await click(target)
  await until(() => phase() === 'scorePending')
  return seed
}

const scoreableCard = () => screen.queryAllByTestId('card-hand').find(el => el.getAttribute('role') === 'button')

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · exactly the scored pattern lights, not the union of both cards', () => {
  it('lights the SCORED card keys while a second card completes on the same hex', async () => {
    // ⚠ THE FIRST VERSION OF THIS TEST WAS VACUOUS AND A MUTATION SAID SO. It asserted the settle
    // equals the engine's matchedHexKeys · true · but the mutation that swaps in patternHighlight
    // came back GREEN, because in a single-card completion those two sets are IDENTICAL. The guard
    // could only distinguish them in the two-card case, which my own S59 measurement puts at 8.5% of
    // deals, and the random fixture never produced one. Third session running that I have written a
    // guard exercising only the working branch (S60 plural, S61 refusal repeat, this).
    //
    // So the two-card case is CONSTRUCTED rather than waited for. Searched offline over all 1540
    // card pairs: card_01 is energy at 0,0 + 1,0 and card_08 is energy at 0,0 + community at 0,1.
    // They share hex 0,0, so ONE placement there completes BOTH · patternHighlight is the 3-hex
    // union and card_01's own matchedHexKeys is 2. Now the two answers differ and the assertion has
    // something to be wrong about.
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    const st = useGameStore.getState()
    const A = st.players[0].hand[0] && PROJECT_CARDS.find(c => c.id === 'card_01')
    const B = PROJECT_CARDS.find(c => c.id === 'card_08')
    expect(A && B, 'card_01 or card_08 is missing from the deck · UNMEASURED').toBeTruthy()

    const fIdx = st.factories.findIndex(f => f.betweenRegions.includes(0))
    await act(async () => {
      useGameStore.setState({
        players: st.players.map((p, i) => i === 0 ? { ...p, hand: [A, B] } : p),
        regions: st.regions.map(r => r.id === 0 ? { ...r, hexes: {
          '1,0': { element: 'energy', placedBy: 0 },      // card_01's other hex
          '0,1': { element: 'community', placedBy: 0 },   // card_08's other hex
        } } : r),
        actionsRemaining: 3,
        factories: st.factories.map((f, i) => i === fIdx
          ? { ...f, elements: [{ type: 'energy', count: 3 }] } : f),
      }, false)
    })
    await click(screen.getAllByTestId('factory')[fIdx])
    await until(() => phase() === 'factorySelected')
    await click(screen.getAllByTestId('element-btn')[0])
    await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
    const rb = screen.queryAllByTestId('region-btn')
    if (rb.length) await click(rb[st.factories[fIdx].betweenRegions.indexOf(0)] ?? rb[0])
    await until(() => phase() === 'regionSelected')
    const target = cells().find(c => c.getAttribute('data-hex') === '0,0')
    expect(target?.getAttribute('data-valid'), 'the shared hex 0,0 is not a legal target · UNMEASURED').toBe('true')
    await click(target)
    await until(() => phase() === 'scorePending')

    // THE PREMISE OF THIS TEST, ASSERTED: two cards really are buildable, and their key sets differ.
    const matches = useGameStore.getState().getBuildableCards(0, '0,0')
    expect(matches.length, 'only one card completed · the fixture did not build the two-card case, ' +
      'so this assertion is back to being unable to fail').toBeGreaterThan(1)
    const mine = matches.find(m => m.cardId === 'card_01')?.matchedHexKeys ?? []
    const union = [...new Set(matches.flatMap(m => m.matchedHexKeys))]
    expect(union.length, 'the union is the same size as one card keys · nothing to discriminate')
      .toBeGreaterThan(mine.length)

    expect(built().length, 'a settle was drawn before anything was scored').toBe(0)
    const card01El = screen.queryAllByTestId('card-hand')
      .find(el => el.getAttribute('role') === 'button' && el.textContent.includes(A.name))
    expect(card01El, 'card_01 is not offered as scoreable').toBeTruthy()
    await click(card01El)
    await until(() => built().length > 0)

    expect(builtKeys(), `the celebration lit ${built().length} hexes · it must be card_01's own ` +
      'pattern and not the union with a card the player did not score').toEqual([...mine].sort())
    expect(built().length, 'the settle lit the UNION · patternHighlight, not matchedHexKeys')
      .toBeLessThan(union.length)
    expect(built().length, 'every hex on the board settled').toBeLessThan(cells().length)
  })
})

describe('counterweight · scoring the same shape twice must re-fire', () => {
  it('is keyed on a monotone seq, so an IDENTICAL hex set is not swallowed', async () => {
    // Rule 107, third time in this feature family: the refusal ring, the live regions, now this.
    // ⚠ AND THE END-TO-END VERSION OF THIS TEST COULD NOT PROVE IT. Driving two real completions
    // deals a fresh hand each mount, so the two shapes DIFFER · and a key made of the hex set
    // re-fires happily on a different shape. The assertion would have passed on the broken version.
    // The contract is "same keys, higher seq, fires again", so it is tested with exactly that.
    const keys = ['0,0', '0,1']
    const { rerender } = render(
      <GameBoard regions={useGameStore.getState().regions} builtDistrict={{ keys, regionId: 0, seq: 1 }} />)
    await until(() => built().length > 0)
    expect(builtKeys(), 'the first render did not light the given keys').toEqual([...keys].sort())

    await until(() => built().length === 0, 200)
    expect(built().length, 'the settle never left the screen · the rest of this test would be ' +
      'looking at the FIRST one and would pass on a cue that never re-fires').toBe(0)

    rerender(<GameBoard regions={useGameStore.getState().regions}
      builtDistrict={{ keys, regionId: 0, seq: 2 }} />)
    const refired = await until(() => built().length > 0)
    expect(refired, 'the SAME hex set with a higher seq did not light · the cue is keyed on the hex ' +
      'set rather than on a monotone counter, so a player who builds the same shape twice sees it once')
      .toBe(true)
    expect(builtKeys()).toEqual([...keys].sort())
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CLAIMS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the district assembles', () => {
  it('staggers in the pattern own order · the stagger IS the weight', async () => {
    const s = await toScorePending()
    expect(s?.failed).toBeUndefined()
    await click(scoreableCard())
    await until(() => built().length > 0)

    const delays = built().map(p => parseInt(p.style.animationDelay, 10) || 0).sort((a, b) => a - b)
    expect(delays.length).toBeGreaterThan(1)
    expect(delays[0], 'the first hex is delayed · the district should start immediately').toBe(0)
    expect(new Set(delays).size, 'every hex carries the SAME delay · then they blink at once and ' +
      'there is no assembly, which is the whole idea').toBe(delays.length)
    expect(Math.max(...delays), 'the stagger runs longer than the 330ms of clear board before the ' +
      'ScoreFlash scrim reaches full opacity').toBeLessThanOrEqual(330)
  })

  it('cannot intercept a click · these are the nodes the bot drives', async () => {
    const s = await toScorePending()
    expect(s?.failed).toBeUndefined()
    await click(scoreableCard())
    await until(() => built().length > 0)
    for (const p of built()) expect(p.style.pointerEvents).toBe('none')
  })

  it('composes with the placement burst rather than cancelling it', async () => {
    // The collision my own S59 keyboard work made reachable: score inside the burst's 450ms and one
    // cell carries both. They are separate nodes, so this asserts BOTH survive · a design that put
    // the settle on an existing animated node would silently drop one.
    const s = await toScorePending()
    expect(s?.failed).toBeUndefined()
    // scorePending is entered immediately after the placement, so the burst is still mounted.
    const bursting = document.querySelectorAll('.hex-burst').length
    expect(bursting, 'no burst is running · this test would be asserting about a collision it never ' +
      'created, so it is UNMEASURED rather than passing').toBeGreaterThan(0)

    await click(scoreableCard())
    await until(() => built().length > 0)
    expect(document.querySelectorAll('.hex-burst').length,
      'the settle cancelled the placement burst').toBeGreaterThan(0)
    expect(built().length, 'the burst cancelled the settle').toBeGreaterThan(0)
  })

  it('reduced motion keeps the INFORMATION and drops the motion', () => {
    // jsdom applies no stylesheet, so this reads the source · a genuinely different layer (Rule 92).
    // The blanket `.hex-cell polygon { animation: none !important }` at the top of the file is more
    // specific than .hex-built, so without an explicit opacity the ring would sit at the keyframeless
    // default and say nothing at all. Same contract .hex-refuse already carries.
    const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')
    const rule = css.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.hex-built[^}]*\}/)
    expect(rule, 'no reduced-motion rule for .hex-built').toBeTruthy()
    expect(rule[0], 'reduced motion does not disable the animation').toMatch(/animation:\s*none\s*!important/)
    expect(rule[0], 'reduced motion leaves the ring invisible rather than static').toMatch(/opacity:\s*1\s*!important/)
    // And no asset was added for any of this.
    expect(css).toMatch(/@keyframes districtBuilt/)
  })
})

describe('the two overlays that were semantically absent', () => {
  it('ScoreFlash and MilestoneOverlay are aria-hidden, NOT dialogs with focus traps', () => {
    // ⚠ MY OWN S61 RECOMMENDATION, KILLED BY MEASURING IT. Both have ZERO focusable children,
    // pointerEvents none, and unmount themselves (2200ms / 2500ms). A focus trap on a container with
    // nothing to focus is the failure BOOT_PREAMBLE §3 names, and it would freeze a keyboard player
    // who can currently Tab freely. The alarm was right; the remedy was a guess (Rule 98).
    const flash = fs.readFileSync(path.resolve(__dirname, '../components/ProjectCard.jsx'), 'utf8')
    const milestone = fs.readFileSync(path.resolve(__dirname, '../components/MilestoneOverlay.jsx'), 'utf8')
    for (const [name, src] of [['ScoreFlash', flash], ['MilestoneOverlay', milestone]]) {
      expect(src, `${name} is not aria-hidden`).toMatch(/aria-hidden="true"/)
      expect(src, `${name} declares role="dialog" · it has nothing focusable, so a trap would strand ` +
        'a keyboard player for the whole auto-dismiss').not.toMatch(/role="dialog"/)
    }
  })
})
