// REGION FOCUS · THE WIRING (T1 S50).
//
// The geometry · that one region clears 44px and three cannot · is in GameBoard.focus.test.jsx and
// is computed from hexUtils. What lives HERE is the decision: WHEN the board scopes to a region,
// and whether the player can get back out.
//
// THE DESIGN, and it is Mahil's call rather than mine: the camera FOLLOWS THE EXISTING SELECTION.
// Step 3 of the placement flow already asks which region, so by the time the target is a hex the
// player has named one. The alternative · a map view they pick from and zoom into · adds a fifth
// click to a four-click flow, and the four are the ones two sessions went into making honest.
//
// ── THE COUNTERWEIGHTS, AND THE SECOND IS THE ONE I WOULD NOT HAVE THOUGHT TO WRITE ──────────────
// 1 · DESKTOP MUST NOT FOCUS. At 1280 the whole board renders 53.9px hexes and seeing all three
//     regions is strictly better for deciding where to place. Focus is an accommodation for a
//     screen that cannot fit the board, not an improvement · shipping it everywhere would be a
//     regression wearing a feature's clothes. Both directions of the media query are asserted,
//     which is also what stops the stub being vacuous: a stub stuck at true reds the desktop test
//     and a stub stuck at false reds the phone one, so neither can pass by accident.
// 2 · THERE IS NO ESCAPE KEY ON A PHONE. Focus locks the view to one region, and every existing way
//     out of `regionSelected` that I had in mind was the keyboard · which on the device this
//     feature exists for does not exist. If the only exit is a key that is not there, this is a
//     soft-lock of the VIEW: the player is looking at one region with no way to see the others.
//     The route is the sheet handle (44px, always mounted, phone-only) -> the sheet -> the region
//     buttons, which render in `regionSelected` as well as `elementSelected`. That round trip is
//     asserted end to end rather than assumed from reading the JSX.
//
// ── WHAT THIS GATE DOES NOT HOLD, SAID PLAINLY BECAUSE A MUTATION SURVIVED IT ────────────────────
// Six mutations were run against this pair and FOUR went red. One that did not:
//     focusRegion = isPhone && selectedRegion != null ? selectedRegion : null   // instead of the phase
// It survives because the two forms differ in exactly one reachable state · `scorePending` · and
// useGameActions.js:148 keeps selectedRegion there ON PURPOSE ("scoreCard is awarded against it").
// Reaching it needs a board seeded so one placement completes a card, which this fixture cannot do.
// I am NOT claiming that as covered. I am also not claiming it is a bug: during scorePending the
// sheet is open over the board and the target is a card inside it, so whether the board behind is
// zoomed is close to unobservable, and the zoomed reading (you see the pattern you just completed)
// may be the better one. It is an open behavioural question, not a defect I have hidden.
// The sixth, `focusRegion` computed during `elementSelected` too, is a VOID mutation rather than an
// uncaught one: selectedRegion is null in that phase, so the two forms are behaviourally identical
// and no test could separate them (Rule 100's corollary · a mutation must change behaviour).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'

vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}),
  recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const GameRoom = (await import('./GameRoom')).default

// jsdom ships NO matchMedia at all · verified, not assumed · so this is a stub and not an override.
// It answers the real query string rather than a boolean, so a component asking a DIFFERENT query
// cannot accidentally be told it is on a phone.
const setViewport = (kind) => {
  window.matchMedia = (q) => ({
    matches: kind === 'phone' && /max-width:\s*600px/.test(q),
    media: q,
    onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  })
}

const root = () => document.querySelector('[data-ui-phase]')
const uiPhase = () => root().getAttribute('data-ui-phase')
const focusAttr = () => document.querySelector('svg[role="img"]').getAttribute('data-focus-region')
const sheet = () => document.querySelector('[data-sheet]').getAttribute('data-sheet')

const until = async (fn, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  }
  return fn()
}

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); delete window.matchMedia })

async function mount(kind) {
  setViewport(kind)
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
}

// Drive the real four-step flow to `regionSelected` and report which region was chosen.
async function driveToRegion(index = 0) {
  await act(async () => { fireEvent.click(screen.getAllByTestId('factory')[0]) })
  await until(() => uiPhase() === 'factorySelected')
  await act(async () => { fireEvent.click(screen.getAllByTestId('element-btn')[0]) })
  await until(() => uiPhase() === 'elementSelected')
  const btns = screen.queryAllByTestId('region-btn').filter(b => !b.disabled)
  expect(btns.length, 'no SELECTABLE region offered · a fixture where every region is full cannot ' +
    'reach the step under test, and a disabled button would silently select nothing')
    .toBeGreaterThan(index)
  const chosen = btns[index].getAttribute('data-region')
  await act(async () => { fireEvent.click(btns[index]) })
  await until(() => uiPhase() === 'regionSelected')
  return chosen
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · desktop must keep all three regions', () => {
  it('never focuses at 1280, in any phase of the placement flow', async () => {
    await mount('desktop')
    expect(focusAttr()).toBe('none')
    await driveToRegion(0)
    expect(focusAttr(), 'a desktop board that zooms to one region LOSES the overview that makes ' +
      'placement a decision · 53.9px hexes there already clear Rule 4 twice over').toBe('none')
  })
})

describe('counterweight · the way back out must exist on a device with no Escape key', () => {
  it('the handle is mounted and reachable while focused, and leads to the region buttons', async () => {
    await mount('phone')
    const chosen = await driveToRegion(0)
    expect(focusAttr()).toBe(chosen)
    expect(sheet(), 'the sheet is down so the hex can be tapped').toBe('closed')

    // THE ROUND TRIP. Without this the player is locked to one region until they place.
    const handle = screen.getByTestId('sheet-handle')
    expect(handle).toBeInTheDocument()
    await act(async () => { fireEvent.click(handle) })
    expect(sheet()).toBe('open')
    const btns = screen.queryAllByTestId('region-btn')
    expect(btns.length, 'the region buttons must render in regionSelected too, not only in ' +
      'elementSelected · otherwise the handle opens a sheet with no way back').toBeGreaterThan(1)
  })

  it('choosing a different region moves the camera · the exit is not just theoretical', async () => {
    await mount('phone')
    const first = await driveToRegion(0)
    await act(async () => { fireEvent.click(screen.getByTestId('sheet-handle')) })
    const btns = screen.queryAllByTestId('region-btn').filter(b => !b.disabled)
    const other = btns.find(b => b.getAttribute('data-region') !== first)
    expect(other, 'only one region is reachable from this factory · pick a fixture with two').toBeTruthy()
    await act(async () => { fireEvent.click(other) })
    await until(() => focusAttr() === other.getAttribute('data-region'))
    expect(focusAttr()).toBe(other.getAttribute('data-region'))
    expect(focusAttr()).not.toBe(first)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE DECISION
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the camera follows step 3, and only step 3', () => {
  it('stays on the whole board through the phases where the target is not a hex', async () => {
    await mount('phone')
    expect(focusAttr(), 'idle · the player is reading the board').toBe('none')
    await act(async () => { fireEvent.click(screen.getAllByTestId('factory')[0]) })
    await until(() => uiPhase() === 'factorySelected')
    expect(focusAttr(), 'factorySelected · the target is an element button, and the board is still ' +
      'the thing that tells them which factory borders which region').toBe('none')
    await act(async () => { fireEvent.click(screen.getAllByTestId('element-btn')[0]) })
    await until(() => uiPhase() === 'elementSelected')
    expect(focusAttr(), 'elementSelected · they are about to CHOOSE a region, so they need to see ' +
      'all of them').toBe('none')
  })

  it('scopes to the chosen region the moment the target becomes a hex', async () => {
    await mount('phone')
    const chosen = await driveToRegion(0)
    expect(chosen).toMatch(/^[0-9]+$/)
    expect(focusAttr()).toBe(chosen)
  })

  it('releases the camera when the flow leaves regionSelected', async () => {
    await mount('phone')
    await driveToRegion(0)
    expect(focusAttr()).not.toBe('none')
    // Escape is not the phone route, but it IS the fastest way to prove the release is keyed on the
    // phase rather than latched · a latch that never released would leave the player zoomed in for
    // the rest of the game (Rule 107 · ask whether the key can fail to notice progress).
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })
    await until(() => uiPhase() === 'idle')
    expect(focusAttr(), 'the camera must come back out · a latched focus is a permanent zoom').toBe('none')
  })

  it('a REAL PLACEMENT releases the camera · the path every turn actually takes', async () => {
    // Rule 75a · the Escape test above proves the release happens, but Escape is not the phone
    // route and it was the branch I could reach rather than the one that matters. Every turn ends
    // by tapping a hex, and if the camera did not release there the player would spend the rest of
    // the game zoomed into one region.
    await mount('phone')
    const chosen = await driveToRegion(0)
    expect(focusAttr()).toBe(chosen)
    const targets = screen.queryAllByTestId('hex-valid')
    expect(targets.length, 'regionSelected offered no valid hex · the fixture cannot place, so ' +
      'this test would be asserting about a state it never entered').toBeGreaterThan(0)
    await act(async () => { fireEvent.click(targets[0]) })
    await until(() => focusAttr() === 'none')
    expect(focusAttr(), 'the camera stayed zoomed after a placement').toBe('none')
  })

  it('the board keeps its label and its accessible name says where you are', async () => {
    await mount('phone')
    await driveToRegion(0)
    const svg = document.querySelector('svg[role="img"]')
    expect(svg.getAttribute('aria-label')).toMatch(/zoomed to \w/i)
    // A screen-reader user who cannot see the zoom still gets told the view changed.
    expect(svg.getAttribute('aria-label')).not.toMatch(/with 3 regions/)
  })
})
