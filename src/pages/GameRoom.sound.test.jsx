// SOUNDS FIRE ON EVENTS, NOT ON STATES (T1 S56).
//
// ⚠ THIS FILE PROVES LESS THAN ITS FIRST DRAFT CLAIMED, AND THE MUTATION RUN IS WHY. I wrote it to
// gate edge-triggering · "a pattern is complete", "it is my turn" and "I hold a token" are STATES,
// and GameRoom re-renders ONCE A SECOND for the countdown, so a level-triggered sound would play
// sixty times a minute while the module's 40ms debounce (which only swallows bursts) did nothing.
// Then I mutated all three call sites to be level-triggered and ALL THREE MUTATIONS SURVIVED.
//
// THE REASON IS THAT THE THING I WAS GUARDING AGAINST IS ALREADY GUARDED. `buildableMatches` is
// useState, and turnNumber and bonusTokens.length are numbers, so every dep is IDENTITY-STABLE
// between renders · React does not re-run those effects on a countdown tick at all. My refs are a
// SECOND guard on top of one that already works, and the preamble says exactly what that means:
// two guards, either sufficient, so no mutation can red either (Rule 94 / Rule 118).
//
// SO WHY ARE THE REFS STILL THERE? Because they are not fully redundant · they cover one case the
// dep array does not: a state update carrying a NEW ARRAY with the SAME CONTENTS. buildableMatches
// is recomputed after every placement, so a second placement that leaves the same card completable
// hands the effect a new identity and a level check fires a duplicate. That case is REAL and this
// fixture CANNOT construct it, because buildableMatches lives in useGameActions local state and no
// test here can set it. I am recording the gap rather than deleting the guard or pretending the
// gate covers it.
//
// WHAT THIS FILE HONESTLY HOLDS, and it is worth having on its own: an idle board is SILENT across
// four countdown ticks, and a genuine token gain announces itself exactly once and then stops.
// Those are the assertions that would have caught a sound wired into render rather than an effect,
// which is the mistake most likely to be made here next.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { __soundLog, __resetSound, __forceUnlock, SOUND_NAMES } from '../utils/sound'

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

const attempts = (name) => __soundLog.filter(e => e.name === name).length
const until = async (fn, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  }
  return fn()
}
// Let the per-second countdown tick N times · this is the render pressure the whole file is about.
const tickSeconds = async (n) => {
  for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => setTimeout(r, 1050)) })
}

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
  __resetSound()
  __forceUnlock()
})
afterEach(cleanup)

async function board() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
}

describe('counterweight · the seam is live in a real mount', () => {
  it('the app really does ask for sounds through the logged path', async () => {
    await board()
    expect(__soundLog.length, 'no sound was attempted during a full board mount · then every ' +
      '"fired exactly once" assertion below is satisfied by a component that fires nothing at all')
      .toBeGreaterThan(0)
  })
})

describe('a per-second re-render must not become a per-second sound', () => {
  // ⚠ MUTATION-CHECKED AND FOUND WEAK: removing the turnNumber latch does NOT red this, because the
  // effect deps are identity-stable and React never re-runs it. Kept because it would catch a sound
  // moved into the render body, which is a different and likelier mistake · but it is not evidence
  // that the latch works.
  it('turn-start fires ONCE, not once per countdown tick', async () => {
    await board()
    const afterMount = attempts('turn-start')
    expect(afterMount, 'turn-start never fired · the fixture is not on my turn').toBeGreaterThan(0)
    await tickSeconds(3)
    expect(attempts('turn-start'), `turn-start fired ${attempts('turn-start')} times across three ` +
      'countdown ticks · it is keyed on a STATE rather than an edge, and a real turn would play it ' +
      'ninety times').toBe(afterMount)
  })

  // ⚠ ALSO WEAK, and for a second reason worth naming: a fresh practice board never completes a
  // pattern, so buildableMatches.length is 0 throughout and a level-triggered version has nothing to
  // fire on either. The fixture cannot reach the state that distinguishes the two.
  it('card-complete does not fire while nothing completes', async () => {
    await board()
    await tickSeconds(3)
    expect(attempts('card-complete'), 'card-complete fired with no completed pattern · it is level-' +
      'triggered on buildableMatches rather than edge-triggered on its identity').toBe(0)
  })

  it('bonus-earned fires ONCE on a real gain, and not again while it is held', async () => {
    // ⚠ MY FIRST VERSION OF THIS TEST WAS WRONG AND THE GATE CAUGHT IT. It claimed to check "arrival
    // at a board that already holds tokens" while MOUNTING FIRST · so 0 -> 2 was a genuine gain and
    // firing was correct. The fixture did not construct the scenario its name described (Rule 100's
    // corollary: a fixture can describe a board that cannot exist, or a different one entirely).
    // What the ref guard actually protects, and what is constructible here: a gain announces itself
    // exactly ONCE, and holding the tokens afterwards is silent through any number of re-renders.
    await board()
    await act(async () => {
      const st = useGameStore.getState()
      useGameStore.setState({
        players: st.players.map(p => ({ ...p, bonusTokens: ['subsidy', 'initiative'] })),
      }, false)
    })
    await tickSeconds(1)
    expect(attempts('bonus-earned'), 'a real gain must be announced').toBe(1)
    await tickSeconds(3)
    expect(attempts('bonus-earned'), 'holding tokens kept re-announcing them · the effect is keyed ' +
      'on the COUNT being non-zero rather than on it having increased').toBe(1)
  })

  it('and no sound at all repeats while the board just sits there', async () => {
    await board()
    __resetSound()
    __forceUnlock()
    await tickSeconds(4)
    const repeated = SOUND_NAMES.filter(n => attempts(n) > 0)
    expect(repeated, `these fired on an idle board: ${repeated.join(', ')} · an idle board is silent, ` +
      'and anything here is a state being mistaken for an event').toEqual([])
  })
})
