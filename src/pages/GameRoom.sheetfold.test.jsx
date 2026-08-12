// THE SHEET IS A WINDOW ONTO A PANEL FOUR TIMES ITS SIZE (T1 S53).
//
// S49 made the bottom sheet flow-aware so the board is never covered when you must tap it, and I
// measured that OCCLUSION property for a week. It never asked whether the panel itself was legible.
// Measured on production, 320x568, real touch:
//     idle              931px of content in a 240px window ·  691px hidden · Hand and Score BOTH
//                       entirely below the fold
//     factorySelected  1167px of content in a 240px window ·  927px hidden · NOT ONE of 7 cards
//                       on screen · not the Offer, not the Hand, not the Score
// and no scroll affordance anywhere, so nothing told the player a panel existed below the one they
// could see.
//
// Mahil's ruling among the three options: COLLAPSE THE OFFER on phones. It is the panel a player
// consults occasionally; Hand and Score are needed every turn; tabs would add a mode to a flow that
// took two sessions to make honest.
//
// ── AFTER, MEASURED THE SAME WAY ─────────────────────────────────────────────────────────────────
//     320x568 idle          content 931 -> 619 · hidden 691 -> 379 · HAND 0 -> 2 cards visible
//     375x667 idle          hand 3 of 3 visible
//     414x896 idle          content 429 = window 429 · ZERO hidden · Score visible
//     every phone width     drawing from the Offer still works (hand 3 -> 4)
//     1280                  no toggle rendered at all · 7 of 7 cards · unchanged
//
// ── WHAT IT DOES NOT FIX, SAID PLAINLY ───────────────────────────────────────────────────────────
// In `factorySelected` at 320 and 375 the element panel fills the whole 240px window on its own, so
// 0 cards and no Score are visible there even with the Offer collapsed. That is a consequence of a
// 240px window rather than of the Offer, and the `more` affordance is showing in exactly that state.
// The Score panel is also still below the fold at 320/375 in idle. Both are reported rather than
// papered over; the Offer was the ruling, and it is what shipped.
//
// ── THE FAILURES THE MEASUREMENT CANNOT SEE · NAMED BEFORE TRUSTING IT ───────────────────────────
// "Cards visible" improves fastest if the Offer simply stops working, so the number alone is not
// evidence of anything. Three ways a green number would be a lie, and all three are asserted:
//   1 · A COLLAPSED OFFER THAT CANNOT BE OPENED · `0 of 7 visible` reads as success.
//   2 · DRAWING BECOMES IMPOSSIBLE · it is one of only two legal actions in the game.
//   3 · THE AFFORDANCE LIES · a hint that shows when nothing is below teaches the player to ignore
//       it, and by the time it is right nobody is looking (Rule 88c, where they are trying to
//       orient). MEASURED IN BOTH DIRECTIONS: honest in every state at all four viewports, and at
//       414 idle · where content exactly equals the window · it correctly does NOT appear.
// AND ONE THE MEASUREMENT DID CATCH: at 320 in factorySelected the toggle sits BELOW the sheet's
// visible window (`inSheet: false`, the sheet handle is painted at its centre). Playwright clicks it
// because Playwright scrolls it into view first; a thumb has to scroll. That is what the affordance
// is for, and it is showing in that exact state · but it is a limit, not a non-issue.

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

// jsdom has no matchMedia · verified, not assumed. Answering the real query string means a component
// asking a DIFFERENT query cannot be accidentally told it is on a phone.
const setViewport = (kind) => {
  window.matchMedia = (q) => ({
    matches: kind === 'phone' && /max-width:\s*600px/.test(q),
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })
}

const until = async (fn, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  }
  return fn()
}
// The cards stay MOUNTED behind `hidden` so expanding is instant and the card art does not
// re-flash. So the honest question is not "are they in the DOM" but "can the player see them" ·
// and conflating those two is how the first draft of this file got the wrong answer twice.
const offerCards = () => screen.queryAllByTestId('card-offer')
const offerVisible = () => {
  const box = document.getElementById('game-offer')
  return !!box && !box.hasAttribute('hidden')
}
const toggle = () => screen.queryByTestId('offer-toggle')

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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90). Every assertion about legibility is satisfied by an Offer that
// has stopped working, so these come before any of them.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · a collapsed Offer is still an Offer', () => {
  it('opens, and opening actually reveals the cards', async () => {
    await mount('phone')
    expect(toggle(), 'no toggle · then a phone player has no way to reach the Offer at all')
      .toBeTruthy()
    expect(offerVisible(), 'the Offer starts expanded · the collapse did nothing').toBe(false)
    expect(offerCards().length, 'the cards are unmounted rather than hidden · expanding will ' +
      're-fetch the art and flash').toBeGreaterThan(0)
    await act(async () => { fireEvent.click(toggle()) })
    expect(offerVisible(), 'the toggle flipped its label and revealed nothing · the panel is ' +
      'decorative and the player cannot draw').toBe(true)
  })

  it('the revealed cards are DRAWABLE · not a picture of an Offer', async () => {
    // Drawing is one of only two legal actions in the game. A collapse that hides the action while
    // improving every "cards visible" number is a strictly worse product with better metrics.
    await mount('phone')
    await act(async () => { fireEvent.click(toggle()) })
    const before = useGameStore.getState().players[0]?.hand?.length ?? 0
    const card = offerCards()[0]
    expect(card, 'no card to draw').toBeTruthy()
    await act(async () => { fireEvent.click(card) })
    await until(() => (useGameStore.getState().players[0]?.hand?.length ?? 0) > before)
    expect(useGameStore.getState().players[0]?.hand?.length ?? 0,
      'clicking an Offer card no longer draws it').toBe(before + 1)
  })

  it('the toggle is a real control · 44px and it announces its own state', async () => {
    await mount('phone')
    const t = toggle()
    expect(parseInt(t.style.minHeight, 10), 'Rule 4').toBeGreaterThanOrEqual(44)
    expect(t.getAttribute('aria-expanded')).toBe('false')
    expect(t.getAttribute('aria-controls')).toBe('game-offer')
    await act(async () => { fireEvent.click(t) })
    expect(toggle().getAttribute('aria-expanded'), 'aria-expanded does not follow the state · a ' +
      'screen reader is told the Offer is closed while it is open').toBe('true')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE DECISION
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the Offer is collapsed on a phone and untouched on desktop', () => {
  it('phone · collapsed by default', async () => {
    await mount('phone')
    expect(offerVisible()).toBe(false)
  })

  it('counterweight · DESKTOP never collapses, and cannot be collapsed by stale state', async () => {
    // The toggle is not rendered at 1280, so a `false` sitting in offerOpen must not be able to hide
    // anything there · the viewport is folded into the derived value rather than only gating the
    // control. Without that, a player who collapses on a phone and rotates to a tablet loses the
    // panel with no way to get it back.
    await mount('desktop')
    expect(toggle(), 'a toggle on desktop is a control that solves nothing · there is room for all ' +
      'three panels').toBeNull()
    expect(offerVisible(), 'the Offer is hidden at 1280 with no way to reveal it').toBe(true)
    expect(offerCards().length).toBeGreaterThan(0)
  })

  it('the Hand is never collapsed · it is needed every turn, which is the whole ruling', async () => {
    await mount('phone')
    // The reason the OFFER was chosen and not the Hand. If a later change collapses the Hand too,
    // the measurement this file rests on stops meaning what it says.
    expect(document.querySelector('[data-hand]'), 'the Hand section is gone').toBeTruthy()
    expect(document.querySelector('[data-hand]').hasAttribute('hidden'),
      'the Hand must never be collapsed').toBe(false)
  })
})

describe('the scroll affordance is state-driven, not decoration', () => {
  it('does not render when nothing is below · jsdom has no layout, so it must be FALSE here', () => {
    // jsdom reports scrollHeight === clientHeight === 0, so the real geometry says "nothing below".
    // If the hint rendered anyway it would be unconditional decoration, which is the exact failure
    // named in the header · and this is the one direction jsdom CAN hold.
    return mount('phone').then(() => {
      expect(screen.queryByTestId('sheet-more'),
        'the affordance rendered with no overflow to report · it is decoration, and a hint that is ' +
        'sometimes wrong is worse than none').toBeNull()
    })
  })

  it('is pointer-transparent by construction · it sits over the panel', async () => {
    // Rule 87: this project shipped an action log for three sessions that was judged harmless
    // BECAUSE it passed clicks through, while covering 31 of 57 board cells. An overlay's safety is
    // never a reason not to check what it covers · but it must at least not steal a tap.
    await mount('phone')
    const src = (await import('node:fs')).readFileSync(
      (await import('node:path')).resolve(__dirname, 'GameRoom.jsx'), 'utf8')
    const block = src.slice(src.indexOf("data-testid=\"sheet-more\""), src.indexOf("data-testid=\"sheet-more\"") + 600)
    expect(block, 'the affordance can take a tap meant for a card').toMatch(/pointerEvents:\s*'none'/)
    expect(block, 'it must be out of the flow · an element that adds height would create the ' +
      'overflow it is reporting').toMatch(/marginTop:\s*-24/)
  })
})
