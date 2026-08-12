// THE BOARD SAYS NO, AND SHOWS IT (T1 S58).
//
// ── WHAT THIS FILE CAN AND CANNOT SEE, SAID FIRST ────────────────────────────────────────────────
// jsdom has no layout and no paint, so nothing here can hold "the cue is VISIBLE". That half was
// measured in a real browser by rasterising the live board and sampling all 57 play cells by region
// (the numbers are in index.css beside the keyframe, where the colour decision lives):
//     empty hex means · water 37,85,98 · earth 59,88,44 · sand 113,96,68 · backdrop 10,10,15
//     black ring 2.55 / 2.62 / 3.46   dark scrim 1.91 / 1.92 / 2.30   white fill 2.15 / 2.15 / 1.94
// What jsdom CAN hold is the part that is pure decision · WHEN the cue fires, WHERE it lands, that it
// leaves, and that it cannot be confused with a confirmation. That is what is asserted here.
//
// ── AND THE PREMISE THE BRIEF CARRIED WAS THE SMALLER HALF ───────────────────────────────────────
// "playSound(placed ? 'hex-place' : 'refused') fires on every rejected tap" · true, and measured
// through this same composed path it was firing where nothing had been refused and silent where
// something had:
//     idle             tap any of 60 hexes    ->  'refused' FIRED  · no factory picked, nothing tried
//     factorySelected  tap a non-preview hex  ->  silent
//     elementSelected  tap a non-preview hex  ->  silent
//     regionSelected   tap a non-target hex   ->  'refused' fired  · the real one · 59 of 60 hexes
// So a visual partner wired to the OLD condition would have flashed a rejection on every exploratory
// tap of the biggest target on the screen. The cue and the sound are now both scoped to
// 'regionSelected' · the one phase where the UI promised something and then said no.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { __soundLog, __resetSound, __forceUnlock } from '../utils/sound'

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

const CUE = 'hex-refused'
const rings = () => screen.queryAllByTestId(CUE)
const phase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase') ?? null
const cells = () => [...document.querySelectorAll('g.hex-cell[data-hex]')]
const refusedSound = () => __soundLog.filter(e => e.name === 'refused').length
const placeSound = () => __soundLog.filter(e => e.name === 'hex-place').length

const until = async (fn, tries = 90) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const wait = async (ms) => { await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }
const click = async (el) => { await act(async () => { fireEvent.click(el) }) }

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
  __resetSound(); __forceUnlock()
})
afterEach(cleanup)

/** Mount and drive the REAL four-step flow to 'regionSelected' · the only phase that can refuse. */
async function armed() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  await click(screen.getAllByTestId('factory')[0])
  await until(() => phase() === 'factorySelected')
  await click(screen.getAllByTestId('element-btn')[0])
  await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
  await click(screen.getAllByTestId('region-btn')[0])
  await until(() => phase() === 'regionSelected')
  const valid = cells().filter(c => c.getAttribute('data-valid') === 'true')
  const invalid = cells().filter(c => c.getAttribute('data-valid') !== 'true')
  return { valid, invalid }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST, AND THE DEFINING PROPERTY BEFORE ANYTHING ELSE (Rules 90 · 110)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the property that is true by construction until it is not', () => {
  it('a SECOND refusal on the SAME hex fires again', async () => {
    // THIS IS THE ONE ASSERTION I WOULD NOT HAVE THOUGHT TO WRITE, and it is the only one that can
    // fail on the obvious implementation. Key the cue on the hex's IDENTITY · `${q},${r}` · and it
    // fires once and is then dead for that hex forever, because tapping the same wrong hex again does
    // not change the key. Tapping the same wrong hex again is precisely what a confused player does.
    // Every de-duplication key in this codebase that has hung did so exactly here (Rules 104 · 107),
    // and every other test in this file passes on the broken version.
    const { invalid } = await armed()
    const target = invalid[0]

    await click(target)
    expect(rings(), 'the first refusal did not render · the rest of this assertion means nothing').toHaveLength(1)

    await wait(420)
    expect(rings(), 'the cue never leaves · a permanent mark on a hex is a state, not a refusal').toHaveLength(0)

    await click(target)
    expect(rings(), 'the SAME hex refused twice showed the cue once · the key is an identity, not a ' +
      'monotone counter, so this hex can never say no again').toHaveLength(1)
  })
})

describe('counterweight · a refusal is not a confirmation', () => {
  it('a SUCCESSFUL placement renders no refusal cue at all', async () => {
    // The hazard named in the brief: a cue that reads as "done" is worse than no cue. The strongest
    // form of that guard is not "it looks different", it is "it is not there".
    const { valid } = await armed()
    expect(valid.length, 'no valid target exists · a green run here would prove nothing about ' +
      'placement, because no placement happened').toBeGreaterThan(0)

    __resetSound(); __forceUnlock()
    await click(valid[0])
    await wait(60)
    expect(rings(), 'a legal placement drew the refusal cue').toHaveLength(0)
    expect(placeSound(), 'the placement sound did not fire · this was not a placement and the ' +
      'assertion above is vacuous').toBe(1)
    expect(refusedSound(), 'a successful placement also said no').toBe(0)
  })
})

describe('counterweight · the harness can reach the state it makes claims about', () => {
  it('an armed board really does have a refusable hex and a live cue path', async () => {
    // Without this, every "no cue appeared" assertion in this file is satisfied by a board that never
    // rendered, a flow that never reached regionSelected, or a testid that does not exist · zero cues
    // out of zero possible is the vacuity that greens a whole file forever (Rule 94a).
    const { valid, invalid } = await armed()
    expect(phase()).toBe('regionSelected')
    expect(invalid.length, 'nothing on this board could be refused').toBeGreaterThan(0)
    expect(valid.length + invalid.length, 'the board did not render its cells').toBe(60)
    await click(invalid[0])
    expect(rings().length, 'the cue path is dead · every negative assertion here is trivially true')
      .toBe(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CLAIMS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the cue fires only where the UI promised something and then said no', () => {
  it('an IDLE tap is silent and shows nothing · nothing was attempted', async () => {
    // THE PREMISE CORRECTION, and the reason this is a gate rather than a comment: before this
    // session an idle tap on any of 60 hexes played 'refused'. No factory is picked in idle, so the
    // board is not a placement surface and the tap refused nothing. Re-widen the condition and this
    // reds with the count.
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    expect(phase()).toBe('idle')

    __resetSound(); __forceUnlock()
    const plain = cells().filter(c => !c.getAttribute('data-testid'))
    expect(plain.length, 'no ordinary hexes to tap · the assertion below cannot fail').toBeGreaterThan(10)
    for (const h of plain.slice(0, 3)) { await click(h); await wait(60) }

    expect(refusedSound(), 'an exploratory tap on an idle board was answered with a rejection').toBe(0)
    expect(rings(), 'an idle tap drew a refusal cue').toHaveLength(0)
  })

  it('a PREVIEW tap is silent · a dashed hex never claimed to be live', async () => {
    // factorySelected draws a dashed preview and deliberately promises nothing, so a tap outside it
    // is not a refusal. Stated as a test because it is a DECISION, not an oversight · without it the
    // next session reads the silence as a missing case and wires a cue to it.
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    await click(screen.getAllByTestId('factory')[0])
    await until(() => phase() === 'factorySelected')

    __resetSound(); __forceUnlock()
    const plain = cells().filter(c => !c.getAttribute('data-testid'))
    for (const h of plain.slice(0, 2)) { await click(h); await wait(60) }
    expect(refusedSound()).toBe(0)
    expect(rings()).toHaveLength(0)
  })

  it('a refused tap marks THE HEX THE PLAYER TOUCHED, and only that one', async () => {
    const { invalid } = await armed()
    const target = invalid[3]
    const coord = target.getAttribute('data-hex')

    __resetSound(); __forceUnlock()
    await click(target)

    expect(refusedSound(), 'the refusal was silent').toBe(1)
    const shown = rings()
    expect(shown, 'a refusal lit more than one hex · the cue is not addressed to the tap').toHaveLength(1)
    expect(shown[0].closest('g.hex-cell').getAttribute('data-hex'),
      'the cue landed on a different hex than the one that was tapped').toBe(coord)
  })

  it('the cue cannot swallow the next tap', async () => {
    // It covers the whole cell for 340ms and the bot clicks these same nodes. A cue that eats the
    // retry is worse than the silence it replaced (Rule 78).
    const { invalid } = await armed()
    await click(invalid[0])
    const ring = rings()[0]
    expect(ring.style.pointerEvents, 'the refusal ring is hit-testable · for 340ms after every ' +
      'refusal the player cannot re-tap that hex').toBe('none')
    expect(ring.getAttribute('fill'), 'a FILLED flash is the completion candidate\'s own vocabulary, ' +
      'which means the exact opposite of a refusal').toBe('none')
  })
})
