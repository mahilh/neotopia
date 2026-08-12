// THE BOARD'S REGION SCORE IS MINE, NOT THE CURRENT PLAYER'S (T1 S54).
//
// ── WHAT THE MEASUREMENT SAID, AND IT OVERTURNED THE TASK ────────────────────────────────────────
// I closed S53 recommending the Score panel move to the ActionBar, on the grounds that a player
// "can't see the score". Measured on the artifact before building any of it, at four viewports and
// two phases:
//     320x568 idle   all 3 region scores on screen at 12px      regionSelected  focused region @33px
//     375x667 idle   all 3 on screen at 16px                    regionSelected  @43px
//     414x896 idle   all 3 on screen at 18px                    regionSelected  @47px
//     1280    idle   all 3 at 27px
// The answer to "can a player read their own score without scrolling, in every phase, at every phone
// width" is YES, and it has been all along · the board has carried it the whole time. The sheet's
// Score panel is a second rendering of the same numbers, and in practice (no opponent) an exact
// duplicate. So the score was never below the fold. Only the COMPARISON was.
// And the ActionBar could not have taken it anyway: measured FREE space at 320 is -6px, i.e. already
// over-subscribed before adding anything. My S53 line "the ActionBar has horizontal room at every
// width I measured" was about the SHEET; I had never measured the bar. That is the same
// unmeasured-claim-in-a-recommendation shape as Rule 108, from me, again.
//
// ── SO WHAT IS ACTUALLY WRONG IS WHOSE NUMBER IT IS ──────────────────────────────────────────────
// GameRoom passed `currentPlayer?.scores` · the player whose TURN it is. In a real room that means
// the readout silently becomes the OPPONENT's for the whole of their turn: same position, same
// colour, same size, nothing saying so. A number that changes owner without announcing it is worse
// than a missing one, because it is read and believed. It is now `myPlayer?.scores`, which already
// falls back to currentPlayer, so solo and practice are byte-identical.
//
// ⚠ THE BLIND SPOT, NAMED BEFORE TRUSTING THE MEASUREMENT · AND IT IS TOTAL. Practice is the ONLY
// mode I can drive without minting anonymous identities, and in practice `myPlayer IS currentPlayer`
// because there is one human seat. So every live probe available to me shows this change doing
// exactly nothing, in both directions, whether it is right or wrong. A green browser run is not
// evidence here and I am not offering one. The state has to be CONSTRUCTED, which is what this file
// does · and the counterweight is written first, because a fixture where the two are equal makes
// every assertion below pass no matter which prop is wired.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved, PRACTICE_HUMAN_ID } from '../hooks/useLocalSession'

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

const MY_SCORES = [7, 3, 5]
const THEIR_SCORES = [1, 9, 2]

const until = async (fn, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  }
  return fn()
}

// The region score is the third line of each region's label stack · font-size 30, and the only
// numeric <text> with no [data-factory] ancestor. Filtering on /^\d+$/ alone catches the twelve
// factory element-count badges, which is how the first version of my browser probe reported "15
// scores on screen" and let me read a size off the wrong element (Rule 116).
const boardScores = () => [...document.querySelectorAll('svg[role="img"] text')]
  .filter(t => /^\d+$/.test(t.textContent.trim())
    && t.getAttribute('font-size') === '30'
    && !t.closest('[data-factory]'))
  .map(t => Number(t.textContent.trim()))

// Two seats, DIFFERENT scores, and it is the OPPONENT's turn. Every part of that is load-bearing.
const twoSeats = () => useGameStore.setState({
  phase: 'playing',
  currentSeat: 1,
  players: [
    { seat: 0, userId: PRACTICE_HUMAN_ID, username: 'You',   scores: [...MY_SCORES],    hand: [], isBot: false },
    { seat: 1, userId: 'bot-1',           username: 'Rival', scores: [...THEIR_SCORES], hand: [], isBot: true },
  ],
}, false)

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(cleanup)

async function mountTwoSeat() {
  render(<MemoryRouter><GameRoom practice practiceBots={1} /></MemoryRouter>)
  await until(() => document.querySelector('svg[role="img"]'))
  await act(async () => { twoSeats() })
  await until(() => useGameStore.getState().currentSeat === 1)
}

describe('counterweight · the fixture can actually tell the two apart', () => {
  it('the reader finds exactly three scores, and not the factory badges', async () => {
    await mountTwoSeat()
    const s = boardScores()
    expect(s, `expected 3 region scores, got ${s.length} · if this is 15 the reader is picking up ` +
      'the factory element-count badges and every assertion below is about the wrong elements')
      .toHaveLength(3)
  })

  it('my scores and the opponent scores are DIFFERENT, and it is their turn', async () => {
    // If the fixture gave both seats the same numbers, or left it on my turn, this whole file would
    // pass identically whether the prop is myPlayer or currentPlayer · the exact shape of a test
    // that reports itself as present while being unable to fail (Rule 86).
    await mountTwoSeat()
    const st = useGameStore.getState()
    expect(st.currentSeat, 'the fixture is on MY turn · the two players are indistinguishable').toBe(1)
    expect(st.players.find(p => p.seat === 0).scores).not.toEqual(
      st.players.find(p => p.seat === 1).scores)
    expect(st.players).toHaveLength(2)
  })
})

describe('no prose leaks into the board area · I shipped exactly this and CI caught it', () => {
  // ⚠ REAL REGRESSION, MINE, IN THIS SESSION. Moving the explanatory comment out of the <GameBoard>
  // attribute list (where `{/* */}` is invalid JSX) I re-emitted it as `//` lines in CHILDREN
  // position · where they are not comments at all, they are TEXT. React rendered fourteen lines of
  // my own reasoning onto the board area, which in a centred flex row pushed the SVG from 0..320 to
  // 73..370 and put three hex cells off a 320px screen.
  // NOTHING IN THE UNIT SUITE COULD SEE IT: jsdom has no layout, so the shove is invisible, and a
  // stray text node breaks no assertion anyone had written. T3's browser reachability gate caught it
  // (`7 are off screen`), which is the whole argument for that gate existing.
  // It is also Rule 116 in its purest form · the source LOOKS like a comment and the JSX pipeline
  // decides otherwise, so reading the file tells you nothing about what ships.
  // This is the part jsdom CAN hold: a text node where only elements belong.
  it('the board area contains elements only · no bare text children', async () => {
    await mountTwoSeat()
    const area = document.querySelector('.game-board-area')
    expect(area, 'no board area rendered').toBeTruthy()
    const stray = [...area.childNodes]
      .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0)
      .map(n => n.textContent.trim().slice(0, 60))
    expect(stray, 'bare text is being rendered into the board area · in a centred flex row this ' +
      'shoves the SVG sideways and pushes cells off a 320px screen').toEqual([])
  })

  it('and none of it is my own commentary · the specific failure mode', async () => {
    await mountTwoSeat()
    const txt = document.querySelector('.game-board-area').textContent
    expect(txt, 'a JSX comment authored as `//` in children position renders as prose')
      .not.toMatch(/MEASURED first|THE BLIND SPOT|myPlayer IS currentPlayer/)
  })
})

describe('the readout belongs to the player reading it', () => {
  it('shows MY scores while it is the opponent turn', async () => {
    await mountTwoSeat()
    expect(boardScores(), 'the board is showing the OPPONENT scores · the same number in the same ' +
      'place has silently changed owner, and nothing on screen says so').toEqual(MY_SCORES)
  })

  it('and never theirs, in either direction', async () => {
    await mountTwoSeat()
    expect(boardScores()).not.toEqual(THEIR_SCORES)
  })

  it('solo and practice are unaffected · myPlayer falls back to currentPlayer', async () => {
    // The whole reason this change is safe to make without a live multiplayer run: with one human
    // seat the two are the same object, so the mode every real player is in today cannot regress.
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => document.querySelector('svg[role="img"]'))
    await act(async () => {
      useGameStore.setState({
        phase: 'playing', currentSeat: 0,
        players: [{ seat: 0, userId: PRACTICE_HUMAN_ID, username: 'You', scores: [...MY_SCORES], hand: [], isBot: false }],
      }, false)
    })
    await until(() => boardScores().length === 3)
    expect(boardScores()).toEqual(MY_SCORES)
  })
})
