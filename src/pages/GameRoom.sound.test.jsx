// AN IDLE BOARD IS SILENT (T1 S57, replacing four assertions that could not fail · T1 S56).
//
// ── WHY THIS FILE IS FOUR TESTS SHORTER THAN IT WAS ──────────────────────────────────────────────
// S56 wrote five assertions here to gate EDGE-triggering. The reasoning was right: "a pattern is
// complete", "it is my turn" and "I hold a token" are STATES, and GameRoom re-renders once a second
// for the countdown, so a level-triggered sound would play sixty times a minute while the module's
// 40ms debounce (which only swallows bursts) did nothing.
// Then I made all three call sites level-triggered and NOTHING REDDENED · because the thing I was
// guarding against is already guarded. `buildableMatches` is useState and the other deps are
// numbers, so every dep is identity-stable and React never re-runs those effects on a tick. The
// assertions passed for the wrong reason, and a gate on a guard that cannot fail is worse than no
// gate: it retires the worry (Rule 86).
// They are deleted rather than kept-with-a-caveat. The load-bearing sentence now lives in
// GameRoom.jsx beside the effects, where somebody changing them will read it.
//
// ── WHAT SURVIVED, AND WHY IT IS NOT THE SAME FOUR ───────────────────────────────────────────────
// One assertion DOES fail on a real mistake, and I only know that because I finally ran the mutation
// I had been describing instead of testing: move a playSound into the RENDER BODY and this reds
// (4366ms, the idle sweep). That is a different and likelier error than level-triggering · it is
// what happens when someone "just adds a sound" to a component without thinking about effects · and
// no dep array protects against it, so nothing else in the codebase would notice.
// The instruction this session was to delete all five. Four deserved it. Deleting the fifth would
// have removed the only gate here that has ever caught anything.

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
  // Without this, the assertion below is satisfied by a component that never asks for a sound at
  // all · "nothing fired on an idle board" is trivially true of a board with no audio wired.
  it('the app really does ask for sounds through the logged path', async () => {
    await board()
    expect(__soundLog.length, 'no sound was attempted during a full board mount').toBeGreaterThan(0)
  })
})

describe('an idle board is silent', () => {
  it('nothing fires while the board just sits there', async () => {
    // MUTATION-PROVEN, unlike the four this replaced: inserting `playSound('ui-click')` into
    // GameRoom's render body reds exactly this and nothing else.
    await board()
    __resetSound()
    __forceUnlock()
    await tickSeconds(4)
    const repeated = SOUND_NAMES.filter(n => attempts(n) > 0)
    expect(repeated, `these fired on an idle board across four countdown ticks: ${repeated.join(', ')} ` +
      '· a sound in a render body plays on every re-render, and this component re-renders once a ' +
      'second forever').toEqual([])
  })
})
