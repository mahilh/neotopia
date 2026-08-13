// THE HAND IS ONE ROW AT ANY SIZE (T1 S65 · Council's option 1).
//
// ── THE MEASUREMENT THAT SET THE SCOPE ───────────────────────────────────────────────────────────
// The hand was `flexWrap: wrap`, which at 320 lays out two cards per row, so the panel was a STEP
// FUNCTION of hand size. Measured on the real sheet at 320x720 by seeding hands of 3 to 12:
//
//     hand size            3     5     7     9    12
//     hand panel px      344   520   696   872  1048      +176 per two cards
//     sheet content px   619   795   971  1147  1323
//     hidden below fold  275   451   627   803   979
//
//   and after the change, on the same instrument, same page, same seeds:
//
//     hand panel px      204   204   204   204   204      CONSTANT · 168 card + 2 x 18 glow padding
//     sheet content px   479   479   479   479   479
//     hidden below fold  135   135   135   135   135
//
// The Offer collapse (S49) removed a CONSTANT from this panel; this removes the VARIABLE, which is
// the term that made the 320 layout unbounded. Council held it pending the wallet and T2 then priced
// the wallet: P90 peak hand is 12 unpriced, 9-10 at $100M, still 6-7 at $250M · so the wallet is not
// an unbounded-hand fix at any shippable price, and the five-card tripwire fires at every rung.
//
// ── WHAT jsdom CAN AND CANNOT HOLD ───────────────────────────────────────────────────────────────
// jsdom has no layout, so the CONSEQUENCE above (a constant height) cannot be asserted here and this
// file does not pretend to (Rule 78's corollary). What it holds is the STRUCTURAL CAUSE and the
// contract around it: `nowrap` is what makes N cards occupy exactly one line, so the panel height is
// O(1) in N by construction rather than by tolerance. The browser numbers are the evidence; these
// assertions are what stops the cause being removed by accident.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'node:fs'
import path from 'node:path'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { completableStatePatch } from './scorePendingFixture'
import { handCardBudget, handStripWidthFor } from '../utils/handStrip'
import { CARD_SIZES } from '../components/CardFrame'

vi.mock('../lib/supabase', () => ({
  supabase: {}, GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823, getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}), recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const GameRoom = (await import('./GameRoom')).default

const until = async (fn, tries = 90) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const click = async (el) => { await act(async () => { fireEvent.click(el) }) }
const phase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase') ?? null
const strip = () => document.querySelector('[data-hand]')
const handCards = () => screen.queryAllByTestId('card-hand')

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

/** Mount practice and give seat 0 a hand of exactly n real cards. */
async function handOf(n) {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  const st = useGameStore.getState()
  const pool = [...(st.players[0]?.hand ?? []), ...(st.deck ?? [])]
  if (pool.length < n) return 0
  await act(async () => {
    useGameStore.setState({
      players: st.players.map((p, i) => (i === 0 ? { ...p, hand: pool.slice(0, n) } : p)),
      deck: pool.slice(n),
    }, false)
  })
  await until(() => handCards().length === n)
  return handCards().length
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · there is a hand to make claims about', () => {
  it('renders every card it is given · twelve of them', async () => {
    // Every assertion below reads ONE container's style. If the hand rendered nothing, or the strip
    // selector stopped matching, all of them would pass while describing an empty box.
    const n = await handOf(12)
    expect(n, 'the hand did not render twelve cards · every layout claim here would be vacuous').toBe(12)
    expect(strip(), 'no [data-hand] container').not.toBeNull()
    expect(strip().querySelectorAll('[data-testid="card-hand"]').length,
      'the cards are not INSIDE the strip · they could be laid out by something else entirely').toBe(12)
  })

  it('and the card count does not change the number of rows · nowrap is the whole mechanism', async () => {
    // THE DEFINING PROPERTY, which is the one you never think to assert because it is what "strip"
    // MEANS (Rule 110). Stated structurally because jsdom cannot measure the height: with nowrap a
    // flex container puts every child on one line, so height is independent of child count. The
    // browser figure is 204px flat from 3 cards to 12; see the header.
    for (const n of [3, 12]) {
      cleanup()
      const got = await handOf(n)
      expect(got).toBe(n)
      expect(strip().style.flexWrap,
        `at ${n} cards the hand is not nowrap · it wraps, and the panel is a step function of hand ` +
        'size again (+176px per two cards at 320)').toBe('nowrap')
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CONTRACT
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the hand strip', () => {
  it('scrolls horizontally, and the scroll cannot escape to the page', async () => {
    await handOf(12)
    const s = strip()
    expect(s.style.overflowX, 'the row is nowrap but cannot scroll · cards past the second are ' +
      'unreachable at 320, which is worse than wrapping').toBe('auto')
    // On touch a horizontal scroll that chains to the page IS the browser's back gesture. Losing the
    // game to a sideways swipe on the hand is a worse defect than the one being fixed.
    expect(s.style.overscrollBehaviorX, 'the horizontal scroll chains to the page').toBe('contain')
  })

  it('does NOT lock the touch axis · a vertical pan starting on a card must still scroll the sheet', async () => {
    // NAMED FAILURE (b). The tempting `touch-action: pan-x` makes the strip feel deliberate and
    // silently steals every vertical drag that begins on a card · the sheet stops scrolling wherever
    // the player's thumb happens to land, which is most of the panel. Leaving it unset lets the
    // browser pick the dominant axis, which is the behaviour a player expects and cannot be improved
    // on from here. Verified in a real browser as computed `auto`.
    await handOf(12)
    expect(strip().style.touchAction ?? '',
      'the strip declares a touch-action · anything other than the default takes a gesture away from ' +
      'the sheet it sits inside').toBe('')
  })

  it('centres only while it FITS · plain `center` would strand the first card', async () => {
    // The classic centred-scroller bug: `justify-content: center` on an overflowing flex row pushes
    // content past the START edge, where scrollLeft cannot reach it · card 1 of 12 becomes
    // permanently unreachable. `safe center` falls back to start exactly when that would happen.
    // Verified as a COMPUTED value in Chromium (`safe center`, first card reachable at scrollLeft 0,
    // 4px from the strip's left edge), because an unsupported value is silently dropped (Rule 116).
    await handOf(12)
    expect(strip().style.justifyContent,
      'the hand centres unconditionally · at 12 cards the first card is scrolled off the start edge ' +
      'with no way back to it').toBe('safe center')
  })

  it('leaves room for the selected card\'s glow · overflow:auto would otherwise clip it', async () => {
    // DERIVED FROM CardFrame, not typed here. overflow-x:auto forces the vertical axis to auto too,
    // so the scrollport clips anything painted outside the card box · and the glow IS the affordance
    // that says which card can be scored (the whole subject of S59). If someone retunes the glow,
    // this reds rather than silently cropping it.
    const src = fs.readFileSync(path.resolve(__dirname, '../components/CardFrame.jsx'), 'utf8')
    const m = src.match(/0 0 0 (\d+)px \$\{colors\.primary\},\s*0 0 (\d+)px \$\{colors\.glow\}/)
    expect(m, 'CardFrame no longer declares the selected-card glow in the shape this reads · ' +
      're-derive the padding from whatever replaced it').not.toBeNull()
    const reach = Number(m[1]) + Number(m[2])
    expect(reach).toBeGreaterThan(0)

    await handOf(12)
    const pad = parseInt(strip().style.padding, 10)
    expect(pad, `the strip pads ${pad}px vertically but the glow reaches ${reach}px · the selected ` +
      'card\'s ring is clipped by the scrollport, which removes the only cue for which card scores')
      .toBeGreaterThanOrEqual(reach)
  })

  it('is reachable by keyboard · a scroller whose children are inert is not', async () => {
    // WCAG 2.1.1. The cards carry role/tabindex only at scorePending (S59, deliberately · handing
    // interactivity to every card teaches a false affordance). The rest of the time the hand is
    // informational, so without a tab stop on the container a keyboard player cannot see past the
    // second card of twelve.
    await handOf(12)
    const s = strip()
    expect(s.getAttribute('tabindex')).toBe('0')
    expect(s.getAttribute('role')).toBe('group')
    expect(s.getAttribute('aria-label'), 'the tab stop announces nothing · a group with no name is a ' +
      'stop a screen reader cannot explain').toMatch(/12/)
  })

  it('the strip\'s own gap and padding, priced at EVERY width · not just the one I measured', async () => {
    // THE GATE S66 DID NOT HAVE. handStrip.test.js holds the curve; this binds it to the values the
    // component actually renders, so a change to the gap or a reintroduced horizontal padding is
    // priced at the desktop sidebar (255px) and the phone sheet (288px) in the same run instead of
    // at whichever width the author happened to open. My 4px cost the second card at 768, 1280 AND
    // 1440 and I measured only 320, where it is free.
    //
    // Rule 92a: cardW comes from CardFrame's own table and gap/padding are READ OFF THE DOM. A copy
    // of either in this file would make the comparison agree with itself.
    await handOf(12)
    const s = strip()
    const gap = parseFloat(s.style.gap)
    expect(Number.isFinite(gap), 'the strip declares no gap · the budget cannot be priced').toBe(true)
    // `padding: '18px 0'` · the horizontal term is the second value, and 0 is the S66 fix.
    const padX = parseFloat(s.style.padding.trim().split(/\s+/)[1] ?? '0')
    expect(Number.isFinite(padX), 'the strip\'s horizontal padding is unreadable').toBe(true)

    const p = { cardW: CARD_SIZES.hand.width, gap, padX }
    // MEASURED containers (Chromium, T1 S67): 288 phone sheet at 320, 255 desktop sidebar at
    // 768/1280/1440. Two cards is Council's requirement · comparison has to survive (S65).
    expect(handCardBudget({ containerW: 288, ...p }),
      `at the 320 phone sheet the strip shows fewer than two cards (gap ${gap}, padX ${padX}) · ` +
      'adjacent comparison is the requirement this strip is constrained by').toBeGreaterThanOrEqual(2)
    expect(handCardBudget({ containerW: 255, ...p }),
      `at the desktop sidebar the strip shows fewer than two cards (gap ${gap}, padX ${padX}) · ` +
      `two need ${handStripWidthFor(2, p)}px and the sidebar gives 255. This is exactly the S66 ` +
      'defect, and it is invisible at 320 where the window is 288.').toBeGreaterThanOrEqual(2)
  })

  it('SCOPE · the Offer is untouched · it is capped at four and was never the variable term', async () => {
    // The guard against over-applying this. The Offer holds at most four cards, so its height is
    // already constant and turning it into a scroller would cost comparison for no gain.
    await handOf(12)
    const offer = screen.queryAllByTestId('card-offer')[0]
    expect(offer, 'no offer rendered · this scope check is vacuous').toBeTruthy()
    expect(offer.closest('[data-hand]'), 'an Offer card is inside the hand strip').toBeNull()
  })
})

describe('the glowing card is brought to the MIDDLE of the strip, not to its edge', () => {
  it('scrollIntoView asks for the inline axis · named failure (a)', async () => {
    // The hand is a horizontal scroller now, so the axis that matters did not exist when S44 chose
    // `block: center`. MEASURED at 12 cards in Chromium: the default inline:'nearest' does bring the
    // card fully into view, but 84px off centre · flush against the edge with no neighbour beside
    // it. With inline:'center' the offset is 0. That matters here specifically because COMPARISON is
    // the requirement this strip is constrained by, so a card arriving alone at the edge defeats it.
    const calls = []
    const orig = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (opts) { calls.push({ el: this, opts }) }
    try {
      render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
      await until(() => screen.queryAllByTestId('factory').length > 0)
      const st = useGameStore.getState()
      const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
      const seed = completableStatePatch(st.regions, hand, 0)
      expect(seed, 'no hand card can be completed on this board · the drive below would prove nothing')
        .not.toBeNull()
      const factory = st.factories.find(f => f.betweenRegions.includes(seed.regionId))
      await act(async () => {
        useGameStore.setState({
          ...seed.patch, actionsRemaining: 3,
          factories: st.factories.map(f => f.id === factory.id
            ? { ...f, elements: [{ type: seed.requiredType, count: 3 }] } : f),
        }, false)
      })
      await click(screen.getAllByTestId('factory')[st.factories.indexOf(factory)])
      await until(() => phase() === 'factorySelected')
      await click(screen.getAllByTestId('element-btn')[0])
      await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
      const rb = screen.queryAllByTestId('region-btn')
      if (rb.length) await click(rb[factory.betweenRegions.indexOf(seed.regionId)] ?? rb[0])
      await until(() => phase() === 'regionSelected')
      const target = [...document.querySelectorAll('g.hex-cell[data-hex]')]
        .find(c => c.getAttribute('data-hex') === seed.missingKey)
      expect(target, 'the seeded hex is not on the board').toBeTruthy()
      await click(target)
      await until(() => phase() === 'scorePending')
      await until(() => calls.some(c => c.el?.dataset?.testid === 'card-hand'))

      const scroll = calls.filter(c => c.el?.dataset?.testid === 'card-hand').pop()
      expect(scroll, 'nothing scrolled a hand card into view at scorePending · the glowing card is ' +
        'left wherever the strip happened to be').toBeTruthy()
      expect(scroll.opts?.block, 'the vertical axis was dropped · the sheet no longer centres it').toBe('center')
      expect(scroll.opts?.inline, 'no inline axis · the strip scrolls by `nearest`, which lands the ' +
        'glowing card flush against the edge with no card beside it to compare against').toBe('center')
    } finally {
      Element.prototype.scrollIntoView = orig
    }
  })
})
