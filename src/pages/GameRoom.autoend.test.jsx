import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { DECK } from '../lib/projectCards'
import { clearSaved } from '../hooks/useLocalSession'
import { REGIONS } from '../utils/hexUtils'

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
    // BY THE REGION'S OWN NAME, read from hexUtils rather than typed (T1 S63). This matched
    // /sacred city/i and simply found nothing after the rename · fireEvent then reports "provide
    // a DOM element", which reads like a harness bug rather than a stale string.
    const wanted = REGIONS.find(r => r.id === 0).name.toLowerCase()
    const region = screen.getAllByTestId('region-btn').find(b => b.textContent.toLowerCase().includes(wanted))
    expect(region, `no region button named "${wanted}"`).toBeTruthy()
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

describe('a held bonus token holds the turn open · T1 S43', () => {
  // THE NOTE MY PAST SELF LEFT HERE, in GameRoom.jsx, for the moment this became true:
  //   "no control anywhere calls useBonus, so a bonus token cannot buy an action today · IF a bonus
  //    is ever wired to a button, this gate needs a `bonusTokens.length === 0` term or it will end
  //    the turn out from under the player using it."
  // The Use button shipped this session. Without the term the sequence is: third action spent, panel
  // opened to spend Automation for a fourth action, and 1100ms later the turn ends underneath the
  // open panel · the exact case the whole feature exists for. This is that assertion, written as the
  // damage rather than as the mechanism.

  it('does not end the turn at zero actions while a token is still held', async () => {
    await mount()
    const turn = state().turnNumber
    const seat = state().currentSeat
    await act(async () => {
      useGameStore.setState(s => ({
        actionsRemaining: 0,
        players: s.players.map(p => (p.seat === seat ? { ...p, bonusTokens: ['automatization'] } : p)),
      }), false)
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_END_MS * 4) })
    expect(state().turnNumber, 'the turn ended while the player still had a token to spend').toBe(turn)
    expect(state().currentSeat, 'the seat changed underneath an open bonus panel').toBe(seat)
  })

  it('ends it as soon as the last token is gone · the pause is a token, not a mode', async () => {
    // The counterweight to the assertion above, and the reason it is not just "never auto-end":
    // holding the turn open forever would be a worse bug than ending it early, and it would look
    // identical to a broken auto-end for anyone not reading this file.
    await mount()
    const turn = state().turnNumber
    const seat = state().currentSeat
    await act(async () => {
      useGameStore.setState(s => ({
        actionsRemaining: 0,
        players: s.players.map(p => (p.seat === seat ? { ...p, bonusTokens: ['subsidy'] } : p)),
      }), false)
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_END_MS * 2) })
    expect(state().turnNumber, 'precondition · the token should be holding it open').toBe(turn)

    await act(async () => {
      useGameStore.setState(s => ({
        players: s.players.map(p => (p.seat === seat ? { ...p, bonusTokens: [] } : p)),
      }), false)
    })
    expect(await until(() => state().turnNumber > turn, 60),
      'the last token was spent and the turn still would not end').toBe(true)
  })
})
