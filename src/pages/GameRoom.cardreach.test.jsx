// WHICH CARD CAN I SCORE · THE SECOND CHANNEL (T1 S59).
//
// ── THE MEASUREMENT THAT SET THE SCOPE ───────────────────────────────────────────────────────────
// My S58 closing recommendation was "give the scoreable card a second channel", premise-checked at
// CardFrame.jsx. Driving the real GameRoom to scorePending, the scoreable card's ENTIRE attribute
// list was:
//     class=project-card · data-testid=card-hand · style=…cursor: pointer…
// and its distinguishing signal was `boxShadow: 0 0 0 2px #e24b4a, 0 0 16px rgba(226,75,74,0.4)`.
// No role, no tabindex, no aria-anything. The instruction line said "select a GLOWING card to
// score", which is the tell · the copy named the glow because the glow was the whole affordance.
//
// ── AND THE KEYBOARD HALF IS NOT THE DOUBLE-COUNT IT LOOKS LIKE ──────────────────────────────────
// The obvious claim is that a focusable, named, role-bearing card moves Feel AND Accessibility at
// once. Measured through the real four-step flow, the second half is PARTLY GATED (Rule 119 · a null
// on axis A can be manufactured entirely by axis B being unfixed). Every legal action, and whether
// its control could be operated by keyboard BEFORE this change:
//
//     draw from the Offer      div[data-testid=card-offer]     NO
//     place 1 · pick factory   g[data-testid=factory]          NO
//     place 2 · pick element   button[data-testid=element-btn] yes
//     place 3 · pick region    button[data-testid=region-btn]  yes
//     place 4 · pick hex       g.hex-cell                      NO
//     score a card             div[data-testid=card-hand]      NO
//     end turn                 button[data-testid=end-turn-btn] yes, when enabled
//
// Four focusable nodes at idle and all four are chrome (mute · rules · leave · sheet handle); at
// scorePending it is the same four, because End Turn is DISABLED there. So placement is reachable at
// steps 2 and 3 and unreachable at 1 and 4 · which means scorePending itself is downstream of two
// pointer-only steps, and a keyboard player cannot get there by playing.
// THEREFORE, stated exactly: this change makes DRAWING keyboard-operable, which is a complete legal
// action with no board in it and no keyboard route at all before today. It does NOT make SCORING
// reachable by keyboard in a real game. The remaining gap is two node types, both in this lane:
// the factory <g> and the hex <g>, and it wants arrow-key grid navigation rather than a tab stop
// per cell (57 play hexes), so it is a design and not a bolt-on.
//
// ── COUNTERWEIGHTS FIRST (Rule 90) ───────────────────────────────────────────────────────────────
// Written before the assertions they defend, with nothing else in the file to hide behind. Each one
// kills a cheap wrong fix that would satisfy every claim below:
//   1 · tabIndex on EVERY card. Then "the scoreable card is focusable" is true and meaningless.
//   2 · an instruction template that always names a card. Then the text channel carries no state.
//   3 · a tab stop with no key handler. Reachable, named, and it does nothing when you press Enter.
//   4 · focus() replacing the S44 scrollIntoView. Passing the focus test while undoing the fix that
//       put the card on screen in the first place.
//   5 · role=button with no name, so the accessible name falls back to the frame's own text soup.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { completableStatePatch } from './scorePendingFixture'
import { PROJECT_CARDS } from '../lib/projectCards'

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

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
const phase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase') ?? null
const cells = () => [...document.querySelectorAll('g.hex-cell[data-hex]')]
const instruction = () => screen.getByTestId('instruction').textContent
const until = async (fn, tries = 90) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const click = async (el) => { await act(async () => { fireEvent.click(el) }) }

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

/** Mount practice and seed a board one legal placement from completing a real hand card. */
async function oneAway() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)

  const st = useGameStore.getState()
  const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
  const seed = completableStatePatch(st.regions, hand, 0)
  if (!seed) return null

  const factoryIdx = st.factories.findIndex(f => f.betweenRegions.includes(seed.regionId))
  const factory = st.factories[factoryIdx]
  await act(async () => {
    useGameStore.setState({
      ...seed.patch,
      actionsRemaining: 3,
      factories: st.factories.map(f => f.id === factory.id
        ? { ...f, elements: [{ type: seed.requiredType, count: 3 }] } : f),
    }, false)
  })
  return { ...seed, factoryIdx, regionBtnIdx: factory.betweenRegions.indexOf(seed.regionId) }
}

/** Drive the shipped four-step flow to the scoring step. */
async function playToScorePending() {
  const s = await oneAway()
  if (!s) return null
  await click(screen.getAllByTestId('factory')[s.factoryIdx])
  await until(() => phase() === 'factorySelected')
  await click(screen.getAllByTestId('element-btn')[0])
  await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
  const rb = screen.queryAllByTestId('region-btn')
  if (rb.length) await click(rb[s.regionBtnIdx] ?? rb[0])
  await until(() => phase() === 'regionSelected')
  const target = cells().find(c => c.getAttribute('data-hex') === s.missingKey)
  if (!target || target.getAttribute('data-valid') !== 'true') return { ...s, failed: 'no legal target' }
  await click(target)
  await until(() => phase() === 'scorePending')
  return s
}

const handCards = () => screen.queryAllByTestId('card-hand')
const scoreableCard = (name) => handCards().find(el => el.getAttribute('aria-label')?.includes(name))

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · interactivity is not handed out to every card', () => {
  it('the cards that cannot be acted on are NOT focusable and carry no role', async () => {
    // The cheap way to pass every keyboard claim below is `tabIndex={0}` on the card, unconditionally.
    // Then the tab order holds every card in hand and in the Offer at all times, "the scoreable card
    // is focusable" is true of everything, and the signal is gone again in a new costume.
    const s = await playToScorePending()
    expect(s, 'fixture unavailable · UNMEASURED, not a pass').not.toBeNull()
    expect(s.failed, `could not reach the placement: ${s.failed}`).toBeUndefined()
    expect(phase()).toBe('scorePending')

    const all = handCards()
    const actionable = all.filter(el => el.matches(FOCUSABLE))
    // POSITIVE CONTROL IN THE SAME RUN · without it, "1 of 3 focusable" is indistinguishable from a
    // build where nothing is focusable and the count happens to be small (Rule 120).
    expect(actionable.length, 'no hand card is focusable at scorePending · nothing to compare against')
      .toBeGreaterThan(0)
    expect(actionable.length, 'EVERY hand card is focusable · a tab stop that is always there ' +
      'distinguishes nothing, which is the state this change exists to leave').toBeLessThan(all.length)

    for (const el of all) {
      const isScoreable = el.matches(FOCUSABLE)
      expect(el.getAttribute('role'), `role=button on a card that is ${isScoreable ? '' : 'NOT '}actionable`)
        .toBe(isScoreable ? 'button' : null)
    }
  })
})

describe('counterweight · the copy names a card only when there IS one', () => {
  it('no hand card is named in the instruction at any phase before scoring', async () => {
    // If the line names a card whatever the phase, the text channel is a template and carries no
    // information · it would read as a second channel and be decoration.
    const s = await oneAway()
    expect(s, 'fixture unavailable · UNMEASURED').not.toBeNull()
    const handNames = useGameStore.getState().players
      .find(p => p.seat === useGameStore.getState().currentSeat).hand.map(c => c.name)
    expect(handNames.length, 'an empty hand makes this assertion vacuous').toBeGreaterThan(0)

    const seen = []
    const record = () => seen.push({ phase: phase(), text: instruction() })
    record()
    await click(screen.getAllByTestId('factory')[s.factoryIdx])
    await until(() => phase() === 'factorySelected'); record()
    await click(screen.getAllByTestId('element-btn')[0])
    await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
    const rb = screen.queryAllByTestId('region-btn')
    if (rb.length) await click(rb[s.regionBtnIdx] ?? rb[0])
    await until(() => phase() === 'regionSelected'); record()

    expect(seen.length, 'fewer phases observed than intended · the sweep did not run').toBe(3)
    for (const { phase: p, text } of seen) {
      for (const n of handNames) {
        expect(text, `the instruction named the card "${n}" at phase ${p}, where no card can be ` +
          'scored · a name printed in every state is not a signal').not.toContain(n)
      }
    }
  })
})

describe('counterweight · the accessible name is the ACTION, not the card face', () => {
  it('never falls back to the frame SVG text soup', async () => {
    // With role=button and no aria-label the accessible name becomes the concatenation of everything
    // the frame draws · measured live: "Copper Arc Substation☉△☉△⚡ ENERGYII◆ NEO…", corner runes and
    // a Roman numeral included. A name is not automatically better than no name.
    const s = await playToScorePending()
    expect(s?.failed).toBeUndefined()
    const card = scoreableCard(s.card.name)
    expect(card, 'no card carries an aria-label naming the completed card').toBeTruthy()

    const label = card.getAttribute('aria-label')
    expect(label, 'the label must say what activating the card DOES').toMatch(/^Score /)
    expect(label, 'the label must name the card').toContain(s.card.name)
    // The runes are the tell that the name leaked out of the drawing. They appear in textContent and
    // must not appear in the label.
    expect(card.textContent, 'the fixture assumes the frame draws its decorative glyphs').toMatch(/[☉△♣•✶◆◎◈⚡]/u)
    expect(label, 'the accessible name contains frame decoration · it is the text soup, not a name')
      .not.toMatch(/[☉△♣•✶◆◎◈⚡]/u)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CLAIMS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the scoreable card is findable without perceiving a colour', () => {
  it('the instruction names it outright, and names the FOCUSED one when there is more than one', async () => {
    // ⚠ THE FIRST VERSION OF THIS TEST ASSERTED THE SINGULAR CASE and went red on its first run,
    // because the fixture dealt a board where TWO cards completed at once · which is the case my
    // first copy design answered with a bare count and no name at all. Measured across 200 seeded
    // deals: 8.5% are double, never more than 2. So the assertion is written against N, and the
    // named card is required to be the one holding focus · that agreement is the whole design and
    // it should not be able to drift.
    const s = await playToScorePending()
    expect(s?.failed).toBeUndefined()
    const scoreable = handCards().filter(el => el.matches(FOCUSABLE))
    expect(scoreable.length, 'no scoreable card · nothing to name').toBeGreaterThan(0)

    expect(instruction(), 'the line still describes the SIGNAL rather than the thing')
      .not.toMatch(/glowing/i)

    const named = scoreable[0].getAttribute('aria-label').replace(/^Score /, '').replace(/ for \d+ points$/, '')
    expect(instruction(), `the copy names no card · with ${scoreable.length} scoreable, "which one" ` +
      'is back to being answerable only by perceiving a ring').toContain(named)

    if (scoreable.length > 1) {
      expect(instruction(), 'more than one card is scoreable and the copy does not say so, so the ' +
        'player has no reason to look for the others').toMatch(new RegExp(`1 of ${scoreable.length}`))
    }
    // The card the copy names must be the card focus is on · one list feeds both.
    await until(() => document.activeElement?.getAttribute?.('data-testid') === 'card-hand')
    expect(document.activeElement.getAttribute('aria-label'),
      'the copy names one card and focus is on another').toContain(named)
  })

  it('it holds DOM focus · a neutral ring, an announcement and Enter, from one mechanism', async () => {
    const s = await playToScorePending()
    expect(s?.failed).toBeUndefined()
    // The focus is set inside a requestAnimationFrame, after paint.
    await until(() => document.activeElement?.getAttribute?.('data-testid') === 'card-hand')
    const active = document.activeElement
    expect(active.getAttribute('data-testid'),
      `focus is on <${active.tagName}> testid=${active.getAttribute('data-testid')} · the scoring step ` +
      'opened and left the player with no cursor on the one control that matters').toBe('card-hand')
    expect(active.getAttribute('aria-label')).toContain(s.card.name)
  })

  it('ENTER scores it · the same outcome as the click, not merely a handler that fired', async () => {
    // The cheap wrong fix is a tab stop with no key handler: reachable, named, inert. So this asserts
    // the OUTCOME the pointer path produces · ScoreFlash mounted by the real GameRoom.
    const s = await playToScorePending()
    expect(s?.failed).toBeUndefined()
    await until(() => document.activeElement?.getAttribute?.('data-testid') === 'card-hand')

    await act(async () => { fireEvent.keyDown(document.activeElement, { key: 'Enter' }) })
    const flashed = await until(() => !!document.querySelector('.score-flash'))
    expect(flashed, 'Enter on the focused scoreable card did not score it').toBeTruthy()
  })

  it('SPACE scores it, and only on the key UP that follows its own key down', async () => {
    // Space is the one that can double-fire: held down it auto-repeats, and on the Offer that is a
    // second draw. Native buttons act on keyup for exactly this reason, so this does too.
    const s = await playToScorePending()
    expect(s?.failed).toBeUndefined()
    await until(() => document.activeElement?.getAttribute?.('data-testid') === 'card-hand')
    const card = document.activeElement

    // A keyup with no preceding keydown on this card must do nothing · that is the case where the
    // player pressed Space somewhere else and released it here.
    await act(async () => { fireEvent.keyUp(card, { key: ' ' }) })
    expect(document.querySelector('.score-flash'),
      'a bare keyup scored a card · a key press that began elsewhere activated this control').toBeNull()

    await act(async () => { fireEvent.keyDown(card, { key: ' ' }) })
    expect(document.querySelector('.score-flash'),
      'Space acted on keydown · then holding it auto-repeats the action').toBeNull()
    await act(async () => { fireEvent.keyUp(card, { key: ' ' }) })
    const flashed = await until(() => !!document.querySelector('.score-flash'))
    expect(flashed, 'Space did not score the focused card').toBeTruthy()
  })
})

describe('counterweight · focus did not eat the S44 scroll', () => {
  it('the card is still scrolled to CENTRE, and focus declines to scroll on its own', async () => {
    // focus() scrolls the element to `nearest`. S44 rejected `nearest` in terms · one pixel of a
    // 168px card touching the scrollport is not a card anybody can see · and chose 'center'. So an
    // unguarded focus() here would satisfy every assertion above while quietly undoing the fix that
    // put the card on screen at all.
    // ⚠ WHAT THIS CANNOT SEE: jsdom has no layout and no scrolling, so this proves the CALLS, not
    // the resulting position. The pixel claim belongs in a browser.
    const scrollCalls = []
    const focusCalls = []
    const origScroll = window.HTMLElement.prototype.scrollIntoView
    const origFocus = window.HTMLElement.prototype.focus
    window.HTMLElement.prototype.scrollIntoView = function (opts) { scrollCalls.push({ el: this, opts }) }
    window.HTMLElement.prototype.focus = function (opts) { focusCalls.push({ el: this, opts }); return origFocus.call(this, opts) }
    try {
      const s = await playToScorePending()
      expect(s?.failed).toBeUndefined()
      await until(() => scrollCalls.some(c => c.el.getAttribute?.('data-testid') === 'card-hand'))

      const cardScroll = scrollCalls.find(c => c.el.getAttribute?.('data-testid') === 'card-hand')
      expect(cardScroll, 'nothing scrolled the scoreable card into view · S44 is gone').toBeTruthy()
      expect(cardScroll.opts?.block, "the card is scrolled to 'nearest' again").toBe('center')

      const cardFocus = focusCalls.find(c => c.el.getAttribute?.('data-testid') === 'card-hand')
      expect(cardFocus, 'the card never received focus').toBeTruthy()
      expect(cardFocus.opts?.preventScroll,
        'focus() was allowed to scroll · it targets `nearest` and overrides the centre S44 chose')
        .toBe(true)
    } finally {
      window.HTMLElement.prototype.scrollIntoView = origScroll
      window.HTMLElement.prototype.focus = origFocus
    }
  })
})

describe('the Offer becomes the first game action a keyboard can reach', () => {
  it('a drawable offer card is focusable, named, and draws on Enter', async () => {
    // The measured half of the accessibility claim. Drawing needs no board, so unlike scoring it is
    // reachable end to end · this is the one place where "keyboard-operable" is true of a whole
    // legal action today rather than of a control at the end of a pointer-only path.
    const s = await oneAway()
    expect(s, 'fixture unavailable · UNMEASURED').not.toBeNull()

    const offer = screen.queryAllByTestId('card-offer')
    expect(offer.length, 'no offer cards · nothing to draw and nothing to measure').toBeGreaterThan(0)
    const first = offer[0]
    expect(first.matches(FOCUSABLE), 'a drawable Offer card is not in the tab order').toBe(true)
    expect(first.getAttribute('aria-label'), 'the Offer card does not say what activating it does')
      .toMatch(/^Draw /)

    const handBefore = useGameStore.getState().players.find(p => p.seat === 0).hand.length
    await act(async () => { first.focus(); fireEvent.keyDown(first, { key: 'Enter' }) })
    await until(() => useGameStore.getState().players.find(p => p.seat === 0).hand.length !== handBefore)
    expect(useGameStore.getState().players.find(p => p.seat === 0).hand.length,
      'Enter on a focused Offer card did not draw it').toBe(handBefore + 1)
  })
})

describe('copy is a layout input · the longest name in the deck', () => {
  it('the scoring line never grows past the longest sentence the game already ships', () => {
    // ── MY FIRST BOUND HERE WAS 66 CHARACTERS AND ITS STATED REASON WAS WRONG ────────────────────
    // I took "66 chars is where the instruction wraps and costs the board 24% of its height" from
    // BOOT_PREAMBLE §8 and gated on it. Measured in a real browser at 320x720 (13px font, 288px
    // content box, 20px line-height), reading the element's own height:
    //     'Pattern complete · select a glowing card to score'   49 chars   2 LINES   <- the OLD line
    //     'Pattern complete · score Shared Battery Hall'        44 chars   2 lines
    //     'Pattern complete · score Mycelium Intelligence Dome' 51 chars   2 lines   <- worst single
    //     '…Mycelium Intelligence Dome (1 of 12)'               61 chars   2 lines   <- worst multi
    //     'Click a factory to take an element · or draw…'       66 chars   2 lines   <- already ships
    //     sweep: 2 lines from 37 chars · 3 lines from 73
    // So at 320 this line is ALREADY two lines for every string the game shows, including the one I
    // replaced. Two lines is the status quo, not a regression, and the real cliff is the THIRD line
    // at 73. The 66 I cited is not the wrap point here at all.
    //
    // The bound is therefore an ORDERING against the product's own longest sentence rather than a
    // number I would have to retune when the font or the box moves (Rule 111's corollary). It is
    // strictly tighter than the measured cliff and it cannot go stale.
    const names = PROJECT_CARDS.map(c => c.name)
    expect(names.length, 'the deck did not load · this gate would be measuring nothing').toBe(56)
    const longest = names.reduce((a, b) => (b.length > a.length ? b : a))

    // The longest sentence GameRoom already renders, at the idle phase, every game.
    const SHIPPED_LONGEST = 'Click a factory to take an element · or draw a card from the Offer'
    const single = `Pattern complete · score ${longest}`
    // Two digits, because a hand has no fixed size and ' (1 of 12)' is a character longer than ' (1 of 4)'.
    const multi = `Pattern complete · score ${longest} (1 of 12)`

    for (const line of [single, multi]) {
      expect(line.length, `"${line}" (${line.length} chars) is longer than the longest sentence the ` +
        `game already ships (${SHIPPED_LONGEST.length}) · it would be the first string to take a THIRD ` +
        'line at 320 and the board pays for it').toBeLessThanOrEqual(SHIPPED_LONGEST.length)
    }
    // And it must actually be longer than the line it replaced, or this gate is guarding nothing.
    expect(multi.length, 'the new copy is no longer than the static line it replaced · then it is not ' +
      'variable-length and this whole gate is theatre').toBeGreaterThan('Pattern complete · select a glowing card to score'.length)
  })
})
