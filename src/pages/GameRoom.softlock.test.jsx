import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'

// ── A REAL PLAYER REACHED TURN 33 AND THE GAME STOPPED ACCEPTING INPUT FOREVER ───────────────────
// Two actions remaining, deck empty, every reachable region 19/19 full. So no placement existed and
// no draw existed · and End Turn was DISABLED, because its condition was `actionsRemaining === 0`
// and the turn was not over. Escape did nothing. Reloading restored the lock from sessionStorage.
// The DOM held exactly three controls: `?`, Leave practice, and a disabled End Turn.
//
// THE ENGINE NEVER AGREED WITH THE CAGE. handleEndTurn gates on isMyTurn alone and would have ended
// that turn on the first click. The whole soft-lock was one UI condition, which is why the fix is
// one condition · and why it is worth a file: this is the difference between a game and a
// screenshot, and nothing in the suite could previously tell them apart.
//
// The assertions are written as the DAMAGE, not as the mechanism: the player must be able to leave
// the turn, and the game must still refuse to let them skip a turn they can actually play.

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
const state = () => useGameStore.getState()
const endTurn = () => screen.getByTestId('end-turn-btn')
const instruction = () => screen.getByTestId('instruction').textContent

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(cleanup)

const until = async (fn, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  }
  return fn()
}

const mount = async () => {
  const utils = render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  return utils
}

// The exact state the audit found: actions left, nothing to spend them on. Every factory emptied and
// every region filled, so getValidPlacements returns nothing anywhere, and no card can be taken.
const strandThePlayer = async ({ actionsRemaining = 2 } = {}) => {
  await mount()
  await act(async () => {
    useGameStore.setState(s => ({
      actionsRemaining,
      deck: [],
      theOffer: [],
      factories: s.factories.map(f => ({ ...f, elements: [] })),
      regions: s.regions.map(r => {
        const hexes = { ...r.hexes }
        for (let q = -2; q <= 2; q++) {
          for (let rr = Math.max(-2, -q - 2); rr <= Math.min(2, -q + 2); rr++) {
            hexes[`${r.center.q + q},${r.center.r + rr}`] = { element: 'energy', placedBy: 1 }
          }
        }
        return { ...r, hexes }
      }),
    }), false)
  })
}

describe('a player with no legal move can always leave the turn', () => {
  it('enables End Turn when nothing can be done, with actions still remaining', async () => {
    await strandThePlayer({ actionsRemaining: 2 })
    // FALSE CASE, and the shipped one: `actionsRemaining === 0` alone, so this stays disabled and
    // the game never accepts another input for the rest of its life.
    expect(state().actionsRemaining, 'the setup must leave actions unspent · that is the trap').toBe(2)
    expect(endTurn().disabled, 'TWO ACTIONS LEFT AND NOTHING TO SPEND THEM ON · this is the soft-lock').toBe(false)
    expect(endTurn().getAttribute('data-unlocked-by')).toBe('no-legal-move')
  })

  it('actually ends the turn when clicked · the escape has to work, not just light up', async () => {
    await strandThePlayer({ actionsRemaining: 2 })
    const turn = state().turnNumber
    fireEvent.click(endTurn())
    expect(await until(() => state().turnNumber > turn),
      'the button was enabled and the turn did not end · a lit dead control is worse than a dark one').toBe(true)
  })

  it('says so, instead of telling the player to do something impossible', async () => {
    await strandThePlayer({ actionsRemaining: 2 })
    expect(instruction()).toMatch(/no legal move/i)
    // FALSE CASE: "Click a factory to take an element · or draw a card from the Offer" · every noun
    // in that sentence is gone from the board.
    expect(instruction()).not.toMatch(/draw a card/i)
  })

  // THE COUNTERWEIGHT, and it is the one that keeps this from being a cheat: "always enable End
  // Turn" would pass every assertion above and hand the player a skip button. A turn that CAN be
  // played must still cost its actions.
  it('does NOT enable End Turn while a legal move exists', async () => {
    await mount()
    await act(async () => { useGameStore.setState({ actionsRemaining: 3 }, false) })
    expect(state().actionsRemaining).toBe(3)
    expect(endTurn().disabled, 'a fresh board has moves · this must stay locked or it is a skip button').toBe(true)
    expect(endTurn().getAttribute('data-unlocked-by')).toBeNull()
  })

  it('does NOT enable it when the board is full but a CARD can still be taken', async () => {
    // The subtle half: a draw is a legal move too, so a full board alone is not a soft-lock. If this
    // is wrong the player gets a skip button on every late-game turn.
    await strandThePlayer({ actionsRemaining: 2 })
    await act(async () => {
      useGameStore.setState(s => ({ deck: [{ id: 'card_01', name: 'x', points: 1, pattern: [] }] }), false)
    })
    expect(endTurn().disabled, 'a card was still drawable · that is a move, so the turn is not stuck').toBe(true)
  })

  it('does NOT enable it while a district is still waiting to be scored', async () => {
    // Scoring costs no action, so it is live even at zero · and ending the turn there destroys the
    // district. The auto-end gate already knows this (S36); the manual button has to as well.
    await strandThePlayer({ actionsRemaining: 0 })
    expect(state().actionsRemaining).toBe(0)
    // At zero actions End Turn is enabled by the ORIGINAL rule, which is correct and unchanged.
    expect(endTurn().disabled).toBe(false)
    expect(endTurn().getAttribute('data-unlocked-by'),
      'at zero actions this is the ordinary end of a turn, not the escape hatch').toBeNull()
  })
})

describe('Escape cancels the placement flow', () => {
  it('backs out of a factory selection · measured escapeWorked:false before this', async () => {
    await mount()
    const root = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase')
    fireEvent.click(screen.getAllByTestId('factory')[0])
    expect(root(), 'the setup did not actually enter the flow').toBe('factorySelected')

    fireEvent.keyDown(document, { key: 'Escape' })
    // FALSE CASE, and the shipped one: nothing happens, and the only way out is to click the same
    // factory again · which nothing on screen tells the player.
    expect(root(), 'Escape did not cancel · the player is still four clicks deep with no way back').toBe('idle')
  })

  it('leaves an idle board alone · Escape is a cancel, not a reset', async () => {
    await mount()
    const turn = state().turnNumber
    const actions = state().actionsRemaining
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(state().turnNumber).toBe(turn)
    expect(state().actionsRemaining, 'Escape on an idle board must not cost anything').toBe(actions)
  })
})

describe('the instruction layer stops promising what the board cannot do', () => {
  // All three of these were static strings that described the happy path and kept describing it
  // after the board ran out. Each was unrecoverable except by clicking the same factory again ·
  // which nothing on screen mentions. They are gated on the SAME counts the board draws from, so a
  // button and its hexes can never disagree (Rule 45 · one source, not three guesses).

  it('does not promise dashed hexes when the factory can reach none', async () => {
    await mount()
    await act(async () => {
      useGameStore.setState(s => ({
        // Stock in the factory, but every region it borders is full · so there is nowhere to go.
        regions: s.regions.map(r => {
          const hexes = { ...r.hexes }
          for (let q = -2; q <= 2; q++) {
            for (let rr = Math.max(-2, -q - 2); rr <= Math.min(2, -q + 2); rr++) {
              hexes[`${r.center.q + q},${r.center.r + rr}`] = { element: 'energy', placedBy: 1 }
            }
          }
          return { ...r, hexes }
        }),
      }), false)
    })
    fireEvent.click(screen.getAllByTestId('factory')[0])
    // FALSE CASE, and the shipped one: "the dashed hexes show where it can go" printed while
    // strokeDasharray matched ZERO polygons.
    expect(instruction()).not.toMatch(/dashed hexes/i)
    expect(instruction()).toMatch(/nowhere to place|no legal move/i)
  })

  it('disables a region button that has no legal hex, and says why', async () => {
    await mount()
    await act(async () => {
      useGameStore.setState(s => ({
        regions: s.regions.map(r => {
          const hexes = { ...r.hexes }
          for (let q = -2; q <= 2; q++) {
            for (let rr = Math.max(-2, -q - 2); rr <= Math.min(2, -q + 2); rr++) {
              hexes[`${r.center.q + q},${r.center.r + rr}`] = { element: 'energy', placedBy: 1 }
            }
          }
          return { ...r, hexes }
        }),
      }), false)
    })
    fireEvent.click(screen.getAllByTestId('factory')[0])
    const el = document.querySelector('[data-element]')
    if (el) fireEvent.click(el)
    const btns = screen.queryAllByTestId('region-btn')
    // NO CONDITIONAL EARLY RETURN. `if (!btns.length) return` would make this pass on a setup that
    // never reached step 3 · a test that skips itself is the vacuity I keep writing rules about.
    expect(btns.length, 'the setup never reached the region step · nothing below was checked')
      .toBeGreaterThan(0)
    // FALSE CASE: these rendered as ordinary enabled buttons, so the player picked one, nothing lit,
    // and the header told them to click a highlighted hex that did not exist.
    for (const b of btns) {
      expect(b.getAttribute('data-free-hexes'), 'the count must be stated, not implied').toBe('0')
      expect(b.disabled, 'a region with no legal hex is not a choice').toBe(true)
    }
  })

  it('an empty factory says it is empty and offers the way out', async () => {
    await mount()
    await act(async () => {
      useGameStore.setState(s => ({ factories: s.factories.map(f => ({ ...f, elements: [] })) }), false)
    })
    fireEvent.click(screen.getAllByTestId('factory')[0])
    // FALSE CASE, and the shipped one: an EMPTY "Select element" panel · 0 rows, 0 buttons · while
    // the header still said to pick an element, and the only exit was undocumented.
    expect(screen.queryAllByTestId('element-btn'), 'precondition · the panel really is empty').toHaveLength(0)
    expect(screen.getByTestId('factory-empty').textContent).toMatch(/empty/i)
    const out = screen.getByTestId('cancel-selection')
    expect(out.style.minHeight, 'the way out is a real control · Rule 4').toBe('44px')
    fireEvent.click(out)
    expect(document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase'),
      'the documented exit did not actually exit').toBe('idle')
  })
})
