import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { DECK } from '../lib/projectCards'
import { clearSaved } from '../hooks/useLocalSession'

// ── The turn ends itself · and the one case where it must NOT ────────────────────────────────────
// "No actions left · end your turn" beside an End Turn button was a required click that communicated
// nothing. Removing it is easy. Removing it SAFELY is the whole job, and the hazard is not timing:
//
//   Scoring a card costs NO action. tryScoreCard deliberately spends none, because a district is the
//   consequence of a placement rather than an action of its own. So a player whose THIRD action
//   completes a pattern sits at actionsRemaining 0 with a district still to build.
//
// A naive "actions === 0 → end the turn" destroys that district, silently, at the exact moment the
// player earned it. That is the assertion this file exists for, and it is written so the DAMAGE is
// the red: the turn must still be theirs, and the card must still be in their hand.

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

const AUTO_END_MS = 1100
const state = () => useGameStore.getState()
const uiPhase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase')
const instruction = () => screen.getByTestId('instruction').textContent

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); clearSaved(); localStorage.clear() })

// Bounded wait · advance until the condition holds or the budget runs out, rather than betting on one
// fixed window (the lesson from the S34 flake fix: assert the BEHAVIOUR, not the scheduler).
const until = async (done, steps = 30) => {
  for (let i = 0; i < steps; i++) {
    if (done()) return true
    await act(async () => { await vi.advanceTimersByTimeAsync(120) })
  }
  return done()
}

const mount = async () => {
  const utils = render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  return utils
}

describe('the turn ends itself when there is nothing left to do', () => {
  it('ends without the player clicking anything', async () => {
    await mount()
    const before = state().turnNumber
    await act(async () => { useGameStore.setState({ actionsRemaining: 0 }, false) })
    expect(await until(() => state().turnNumber > before),
      'the last action was spent and the game still waited to be told').toBe(true)
  })

  it('says so, instead of asking for a click that communicates nothing', async () => {
    await mount()
    await act(async () => { useGameStore.setState({ actionsRemaining: 0 }, false) })
    expect(instruction()).toMatch(/ending your turn/i)
    expect(instruction(), 'the old copy told the player to do the thing the game is already doing')
      .not.toMatch(/end your turn/i)
  })

  it('waits · a turn that flips instantly loses the last placement', async () => {
    // FALSE CASE: AUTO_END_MS at 0. The placement burst runs 450ms, and a board that changes hands
    // the instant a token lands means the player never sees their own last move.
    await mount()
    const before = state().turnNumber
    await act(async () => { useGameStore.setState({ actionsRemaining: 0 }, false) })
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_END_MS - 300) })
    expect(state().turnNumber, 'ended too early to see the last action land').toBe(before)
  })

  it('ends the turn exactly once, however many times it re-renders', async () => {
    await mount()
    const before = state().turnNumber
    await act(async () => { useGameStore.setState({ actionsRemaining: 0 }, false) })
    // Churn the store while the window is open · every one of these re-runs the effect.
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        useGameStore.setState(s => ({ turnTimeRemaining: s.turnTimeRemaining - 1 }), false)
        await vi.advanceTimersByTimeAsync(90)
      })
    }
    await until(() => state().turnNumber > before)
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    // FALSE CASE: a re-render inside the window queues a second end and the player loses a whole
    // extra turn to a timer they never saw.
    expect(state().turnNumber, 'the turn was ended more than once').toBe(before + 1)
  })
})

describe('it must not end a turn that still has a district in it', () => {
  // The pattern is reached through the REAL four-step placement (factory → element → region → hex),
  // not by setting uiPhase, because uiPhase lives inside useGameActions and a test that fakes it
  // would be asserting against its own fixture rather than against the game.
  const CARD = DECK.find(c => c.pattern.length === 2 && c.pattern[1].type === c.pattern[0].type)
  const TYPE = CARD?.pattern[0].type

  const armAScorableThirdAction = async () => {
    await mount()
    await act(async () => {
      useGameStore.setState(s => ({
        players: s.players.map(p => (p.seat === 0 ? { ...p, hand: [CARD] } : p)),
        // One element already down on the region centre · the next adjacent same-type placement
        // completes a two-cell pattern in any rotation.
        regions: s.regions.map(r => (r.id === 0 ? { ...r, hexes: { '0,0': { element: TYPE } } } : r)),
        factories: s.factories.map(f => (f.id === 0 ? { ...f, elements: [{ type: TYPE, count: 3 }] } : f)),
        actionsRemaining: 1, // …and this placement is the LAST one
        currentSeat: 0,
      }), false)
    })
    fireEvent.click(screen.getAllByTestId('factory')[0])
    fireEvent.click(document.querySelector(`[data-element="${TYPE}"]`))
    const region = screen.getAllByTestId('region-btn').find(b => /sacred city/i.test(b.textContent))
    fireEvent.click(region)
    const hexes = screen.getAllByTestId('hex-valid')
    fireEvent.click(hexes[0])
  }

  it('the deck really contains the two-cell card this setup depends on', () => {
    expect(CARD, 'no single-type two-cell card · the setup below would silently test nothing').toBeTruthy()
  })

  it('holds the turn open while a completed pattern is waiting to be scored', async () => {
    await armAScorableThirdAction()
    expect(state().actionsRemaining, 'the setup did not actually spend the last action').toBe(0)
    expect(uiPhase(), 'the setup did not actually complete a pattern').toBe('scorePending')

    const seat = state().currentSeat
    const turn = state().turnNumber
    const handBefore = state().players[0].hand.length
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_END_MS * 4) })

    // THE ASSERTIONS THAT MATTER · stated as the damage, not as the mechanism.
    expect(state().currentSeat, 'the turn was taken away with a district still to build').toBe(seat)
    expect(state().turnNumber, 'the turn was taken away with a district still to build').toBe(turn)
    expect(state().players[0].hand.length, 'the scorable card was carried off the board unscored').toBe(handBefore)
    expect(state().players[0].scoredCardIds.length, 'nothing should have scored on its own').toBe(0)
  })

  it('tells the player to score, not to end · at zero actions', async () => {
    // The instruction line checked `actionsLeft <= 0` BEFORE the scorePending case, so it read
    // "No actions left · end your turn" while a district sat there waiting. That is the one moment
    // in the game where this line can cost real points.
    await armAScorableThirdAction()
    expect(instruction()).toMatch(/pattern complete/i)
    expect(instruction(), 'at zero actions a completed pattern still outranks the turn being over')
      .not.toMatch(/ending your turn|no actions left/i)
  })

  it('ends the turn once the district IS built', async () => {
    // The other half: holding the turn open must be about the district, not about scorePending being
    // a dead end. Once the card is scored the game moves on by itself, with no click.
    await armAScorableThirdAction()
    const turn = state().turnNumber
    fireEvent.click(screen.getAllByTestId('card-hand')[0])
    // Checked separately so a red says WHICH half broke · the click not scoring, or the turn not
    // resuming afterwards.
    expect(state().players[0].scoredCardIds.length, 'the click did not build the district').toBe(1)
    // Generous, because the score story (2200ms) deliberately holds the turn open before the 1100ms
    // window even starts. The point is that it resumes at all, not that it resumes on a deadline.
    expect(await until(() => state().turnNumber > turn, 60),
      'the district is built and there is nothing left to do · the turn should end itself').toBe(true)
  })
})
