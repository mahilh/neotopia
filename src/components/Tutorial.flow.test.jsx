// THE TUTORIAL'S PLACEMENT STEP IS EXECUTED HERE, NOT READ (T1 S50).
//
// This overlay exists because a playtest reached turn 17 with an empty board · neither player found
// how to place an element. It has since taught the wrong sequence three times, in three different
// ways, and every one of them was checked by a human reading the paragraph:
//     S8  · "click a factory, then click any empty hex"      · 2 steps for a 4-step action
//     S29 · fixed it, and named the panel                    · correct at the time
//     S30 · rewrote it around the board's aim shortcut       · factory, hex, element, hex
// The S30 version is the one this file replaces. It is not FALSE · aiming works · but it tells a
// first-timer to tap a hex, then tap a hex again, and it never names the region step at all.
//
// SO THE COPY IS NO LONGER PROSE. Tutorial exports PLACEMENT_TAPS, the paragraph renders from it,
// and this file CLICKS those testids in that order against a real GameRoom. A step the game does
// not have, a step in the wrong position, or a missing step all make this red. That is the whole
// point: the previous three versions would each have failed it, and none of them failed a regex.
//
// ── THE COUNTERWEIGHT, WHICH IS THE ORDER ITSELF (Rule 90) ───────────────────────────────────────
// "All four controls exist and clicking them works" is satisfied by ANY permutation, and permutation
// is precisely the defect. So the first thing asserted is that at each stage the NEXT tap's control
// is not available yet · which is what makes the list an ORDER rather than a set, and it is the only
// assertion here that the S30 copy would have survived.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { PLACEMENT_TAPS } from './Tutorial'

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

const GameRoom = (await import('../pages/GameRoom')).default
const uiPhase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase')
const live = (testid) => screen.queryAllByTestId(testid).filter(el => !el.disabled)

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

async function board() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
}

describe('counterweight · the list is an ORDER, not a set of four controls', () => {
  it('each tap\'s control does not exist until its turn · a permutation cannot pass', async () => {
    await board()
    const seenPhases = []
    for (let i = 0; i < PLACEMENT_TAPS.length; i++) {
      const here = PLACEMENT_TAPS[i]
      const next = PLACEMENT_TAPS[i + 1]
      expect(live(here.testid).length, `step ${i + 1} ("${here.text}") offers no control · the ` +
        'tutorial names a tap the player cannot make').toBeGreaterThan(0)
      if (next) {
        expect(live(next.testid).length, `step ${i + 2} ("${next.text}") is ALREADY available at ` +
          `step ${i + 1} · then the tutorial's ordering is decoration and a player could take them ` +
          'in any sequence').toBe(0)
      }
      await act(async () => { fireEvent.click(live(here.testid)[0]) })
      await until(() => uiPhase() !== seenPhases[seenPhases.length - 1])
      seenPhases.push(uiPhase())
    }
    // Four taps must produce four DISTINCT states · if any tap left the game where it was, that tap
    // is not a step.
    expect(new Set(seenPhases).size, `phases visited: ${seenPhases.join(' -> ')}`).toBe(4)
  })
})

describe('the tutorial states the sequence the game actually requires', () => {
  it('naming exactly four taps, because the action takes four', () => {
    expect(PLACEMENT_TAPS).toHaveLength(4)
    // The S8 copy described two. That is the specific historical failure.
    expect(PLACEMENT_TAPS.map(t => t.testid))
      .toEqual(['factory', 'element-btn', 'region-btn', 'hex-valid'])
  })

  it('clicking the taps in the order the overlay prints them completes a placement', async () => {
    await board()
    const before = useGameStore.getState().regions
      .reduce((n, r) => n + Object.keys(r.hexes ?? {}).length, 0)
    for (const tap of PLACEMENT_TAPS) {
      await until(() => live(tap.testid).length > 0)
      const el = live(tap.testid)[0]
      expect(el, `no control for "${tap.text}"`).toBeTruthy()
      await act(async () => { fireEvent.click(el) })
    }
    await until(() => useGameStore.getState().regions
      .reduce((n, r) => n + Object.keys(r.hexes ?? {}).length, 0) > before)
    const after = useGameStore.getState().regions
      .reduce((n, r) => n + Object.keys(r.hexes ?? {}).length, 0)
    expect(after, 'following the overlay literally did NOT place an element · which is the exact ' +
      'failure this overlay exists to prevent').toBe(before + 1)
  })

  it('names the region step · the one the S30 copy left out entirely', () => {
    const region = PLACEMENT_TAPS.find(t => t.testid === 'region-btn')
    expect(region, 'no region step').toBeTruthy()
    expect(region.text).toMatch(/region/i)
    // And it is third. A player told about it in the wrong place looks for it at the wrong time.
    expect(PLACEMENT_TAPS.indexOf(region)).toBe(2)
  })

  it('renders every tap into the overlay · the list and the copy cannot diverge', async () => {
    const Tutorial = (await import('./Tutorial')).default
    render(<Tutorial onDismiss={() => {}} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })) })
    const list = screen.getByTestId('tutorial-taps')
    const items = [...list.querySelectorAll('li')]
    expect(items).toHaveLength(PLACEMENT_TAPS.length)
    items.forEach((li, i) => {
      expect(li.getAttribute('data-tap')).toBe(PLACEMENT_TAPS[i].testid)
      // `toContain`, not `toBe`: each row also renders its ordinal and its glyph, so textContent is
      // "2●Pick which element…". The claim is that the tap's own words are there and in this row.
      expect(li.textContent).toContain(PLACEMENT_TAPS[i].text)
      expect(li.textContent.startsWith(String(i + 1)), 'the row must carry its own number · the ' +
        'order has to be visible, not only implied by stacking').toBe(true)
      expect(li.textContent).toContain(PLACEMENT_TAPS[i].glyph)
    })
    // ONE LIST. Step 2 previously rendered the taps TWICE · this paragraph and a separate glyph
    // diagram · and the two disagreed about the order, which is the drift this whole change exists
    // to remove. A second list would make the fix cosmetic.
    expect(screen.queryAllByTestId('tutorial-taps')).toHaveLength(1)
    expect([...document.querySelectorAll('[data-tap]')]).toHaveLength(PLACEMENT_TAPS.length)
  })

  it('the dialog card is capped and scrollable · Rule 78b, and it was live on the iPhone SE', async () => {
    // jsdom has no layout so it cannot see a pixel of this (Rule 78's corollary) · the measurement
    // lives in a browser and is recorded in Tutorial.jsx. What IS decidable here is that the card
    // carries the cap at all, which is the mechanism, and it is an INLINE style so this reads the
    // real declaration rather than a stylesheet string (the defect GameRoom.phone.test.jsx documents).
    // MEASURED at 320x568 / 320x800 / 375x667 / 414x896, all three steps: card fits, Skip and Next
    // both in viewport and hit-testable. Before it, step 2 was an 894px card at top -47 in an 800px
    // window with no way to scroll to either button, and step 1 already overflowed a 320x568 phone.
    const Tutorial = (await import('./Tutorial')).default
    render(<Tutorial onDismiss={() => {}} />)
    const card = screen.getByTestId('tutorial-card')
    expect(card.style.maxHeight, 'without a cap a tall step pushes both buttons off a fixed, ' +
      'unscrollable overlay · the player cannot dismiss the tutorial at all').toBe('100%')
    expect(card.style.overflowY, 'a cap without a scroll just clips it instead').toBe('auto')
  })
})
