// THE PHONE SHEET · WHEN IT IS UP, AND THE TWO WAYS THAT CAN BE WRONG (T1 S49).
//
// Below 600px the sidebar becomes a bottom sheet so the board can have all of `main`. The geometry
// is index.css's and is measured in a browser (jsdom has no layout · Rule 78's corollary). What
// lives HERE is the DECISION: in which uiPhase is the sheet up, and is the way back to it real.
//
// THE FAILURE MODE HAS TWO OPPOSITE FACES AND ONE TEST CANNOT COVER BOTH, which is why both
// counterweights are written first:
//   OCCLUSION · the sheet is up while the player must tap a HEX. Measured in a browser at 320:
//               with the sheet open, 27 of 60 controls are covered. In `regionSelected` · the one
//               state where the board IS the control · it must be down, and it measures 0 blocked.
//   DESYNC    · the sheet fails to come up while the controls are INSIDE it. That is a new
//               soft-lock, and it is the wrong fix for occlusion: "never open the sheet" satisfies
//               every occlusion assertion and makes the game unplayable.
// The second is the dangerous one, so it is first.
//
// MEASURED, live, at 320x568 (practice board, isolated dev server):
//     idle              sheet closed ·  0 of 60 blocked
//     factorySelected   sheet OPEN   · 27 of 60 blocked · element buttons 4 of 4 REACHABLE
//     elementSelected   sheet OPEN   · 27 of 60 blocked
//     regionSelected    sheet closed ·  0 of 60 blocked
//     handle tap -> open · Escape -> closed
// Hex 14.4px -> 25.8px at 320 (58.6% of Rule 4's 44px · it does NOT clear it, and nothing that
// shows three regions at once can · see index.css for the arithmetic).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'node:fs'
import path from 'node:path'
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
const CSS = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')

const root = () => document.querySelector('[data-sheet]')
const sheet = () => root().getAttribute('data-sheet')
const uiPhase = () => root().getAttribute('data-ui-phase')

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
afterEach(cleanup)

async function mount() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · WRITTEN FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the sheet must COME UP when the controls are inside it', () => {
  // The wrong fix for "the sheet covers the board" is to stop opening it. That passes every
  // occlusion assertion in this file and makes the element buttons unreachable on a phone · a
  // soft-lock of exactly the shape S44 spent a session removing.
  it('opens on factorySelected, where the element buttons live', async () => {
    await mount()
    expect(sheet()).toBe('closed')
    await act(async () => { fireEvent.click(screen.getAllByTestId('factory')[0]) })
    await until(() => uiPhase() === 'factorySelected')
    expect(sheet(), 'the element buttons are IN the sheet · a closed sheet is a soft-lock').toBe('open')
    expect(screen.getAllByTestId('element-btn').length).toBeGreaterThan(0)
  })

  it('the handle exists and is the way back · the Offer is in the sheet, so idle needs one', async () => {
    await mount()
    const handle = screen.getByTestId('sheet-handle')
    expect(handle).toBeInTheDocument()
    // Without this control, drawing a card · a legal action on any turn · has no affordance at all
    // once the sheet is down.
    expect(handle.getAttribute('aria-expanded')).toBe('false')
    await act(async () => { fireEvent.click(handle) })
    expect(sheet()).toBe('open')
    expect(screen.getByTestId('sheet-handle').getAttribute('aria-expanded')).toBe('true')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE DECISION · WHICH PHASE OWNS THE SCREEN
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the sheet is down whenever the board is the control', () => {
  it('idle keeps the board clear', async () => {
    await mount()
    expect(uiPhase()).toBe('idle')
    expect(sheet()).toBe('closed')
  })

  it('regionSelected · the step that requires a HEX tap · puts the sheet away', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getAllByTestId('factory')[0]) })
    await until(() => uiPhase() === 'factorySelected')
    await act(async () => { fireEvent.click(screen.getAllByTestId('element-btn')[0]) })
    await until(() => uiPhase() === 'elementSelected')
    expect(sheet(), 'the region buttons are in the sheet too').toBe('open')

    const regionBtns = screen.queryAllByTestId('region-btn')
    expect(regionBtns.length, 'no region is offered · the fixture cannot reach the step under test')
      .toBeGreaterThan(0)
    await act(async () => { fireEvent.click(regionBtns[0]) })
    await until(() => uiPhase() === 'regionSelected')
    expect(sheet(), 'the next tap must land on a HEX · 27 of 60 controls are covered when it is up')
      .toBe('closed')
  })

  it('a manual open survives until the flow moves, and then the flow wins', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getByTestId('sheet-handle')) })
    expect(sheet()).toBe('open')
    // Starting a placement re-derives it · here that also means open, so drive to the state where
    // the two disagree: regionSelected must close a sheet the player opened by hand.
    await act(async () => { fireEvent.click(screen.getAllByTestId('factory')[0]) })
    await until(() => uiPhase() === 'factorySelected')
    await act(async () => { fireEvent.click(screen.getAllByTestId('element-btn')[0]) })
    await until(() => uiPhase() === 'elementSelected')
    const rb = screen.queryAllByTestId('region-btn')
    expect(rb.length).toBeGreaterThan(0)
    await act(async () => { fireEvent.click(rb[0]) })
    await until(() => uiPhase() === 'regionSelected')
    expect(sheet()).toBe('closed')
  })

  it('Escape closes a hand-opened sheet in idle · without it the only exit is a control you may not see', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getByTestId('sheet-handle')) })
    expect(sheet()).toBe('open')
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })
    expect(sheet()).toBe('closed')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE STYLESHEET · WHAT IS WRITTEN, NOT WHAT WINS (see GameRoom.phone.test.jsx's header)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the phone block declares the sheet', () => {
  const phoneBlock = (() => {
    const at = CSS.indexOf('@media (max-width: 600px)')
    if (at === -1) return ''
    let depth = 0, i = CSS.indexOf('{', at)
    const start = i
    for (; i < CSS.length; i++) {
      if (CSS[i] === '{') depth++
      else if (CSS[i] === '}') { depth--; if (depth === 0) break }
    }
    return CSS.slice(start, i + 1)
  })()

  it('takes the sidebar out of the column and off the floor when closed', () => {
    expect(phoneBlock).toMatch(/\.game-sidebar\s*\{[^}]*position:\s*absolute/)
    // Translated by its own height PLUS the handle · anything less leaves a strip on screen that can
    // take a tap meant for the board.
    expect(phoneBlock).toMatch(/\.game-sidebar\s*\{[^}]*transform:\s*translateY\(calc\(100% \+ 44px\)\)/)
    expect(phoneBlock).toMatch(/\[data-sheet='open'\]\s*\.game-sidebar\s*\{[^}]*transform:\s*translateY\(0\)/)
  })

  it('reserves the handle\'s 44px so no hex sits under it · this is what buys 0 blocked', () => {
    expect(phoneBlock).toMatch(/\.game-board-area\s*\{[^}]*padding-bottom:\s*44px/)
    expect(phoneBlock).toMatch(/\.game-sheet-handle\s*\{[^}]*height:\s*44px/)
  })

  it('the handle is phone-only furniture', () => {
    expect(CSS).toMatch(/@media \(min-width: 601px\)[^}]*\{[^}]*\.game-sheet-handle\s*\{\s*display:\s*none/)
  })
})
