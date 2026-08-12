// SAYING WHAT HAPPENED (T1 S61).
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// S59 and S60 gave a keyboard player every control in the game: draw, factory, element, region, hex,
// score. Every cue they added answers WHERE YOU ARE · a focus ring, a roving cursor, an option name.
// None answers WHAT HAPPENED. A placement lands, the listbox unmounts, focus falls to <body>, and
// the app says nothing at all.
//
// ── PREMISE CORRECTION ───────────────────────────────────────────────────────────────────────────
// The brief said "aria-live is 0 across the whole app". The attribute count is genuinely 0, but the
// app is NOT at zero live regions: Lobby's BackendBanner carries role="alert", which IS one by role.
// It is also mounted conditionally (`if (!backend.showBanner) return null`), which is fine for a
// one-shot banner whose presence is the signal, and is exactly the pattern that must NOT be copied
// for repeated announcements. There is also a documented decision NOT to make the HowItWorksDemo
// caption live (it would interrupt four times per loop, forever) · that decision is upheld here, and
// is the reason the game's own stream is polite rather than assertive.
//
// ── THE FAILURE NO DOM SNAPSHOT CAN SEE, WHICH IS WHY IT IS THE FIRST TEST ───────────────────────
// A live region announces a TEXT MUTATION INSIDE A NODE THAT WAS ALREADY THERE. Write it the obvious
// way · `{msg && <div aria-live="polite">{msg}</div>}` · and React inserts a NEW node already
// carrying its text, which most screen readers do not announce. The resulting DOM is byte-identical
// to the working version. Nothing can distinguish them except holding the node across two
// announcements and asserting it is the same object, which is what the first counterweight does.
// Same family as the ScoreFlash timer that died to its own cleanup: correct-looking, silent.
//
// ── COUNTERWEIGHTS FIRST (Rule 90) · each kills a cheap wrong version ────────────────────────────
//   1 · conditional rendering · announces once, then silence, DOM identical
//   2 · no repeat handling · a message identical to the last one is a no-op mutation and is silent
//   3 · display:none / hidden · removes the node from the a11y tree, equally silent, equally invisible
//   4 · everything routed to one politeness · then the assertive/polite argument is decoration
//   5 · a region that starts with text · then "it announced" cannot be told from "it always said that"

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'node:fs'
import path from 'node:path'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'

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

const phase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase') ?? null
const cells = () => [...document.querySelectorAll('g.hex-cell[data-hex]')]
const polite = () => document.querySelector('[data-testid="sr-announcer"]')
const alert = () => document.querySelector('[data-testid="sr-alert"]')
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

/** Mount practice and aim at region 0, which has one token so it offers a real legal set. */
async function aimed(regionId = 0) {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  const st = useGameStore.getState()
  const region = st.regions.find(r => r.id === regionId)
  const centre = `${region.center.q},${region.center.r}`
  const fIdx = st.factories.findIndex(f => f.betweenRegions.includes(regionId))
  const factory = st.factories[fIdx]
  await act(async () => {
    useGameStore.setState({
      regions: st.regions.map(r => r.id === regionId
        ? { ...r, hexes: { [centre]: { element: 'energy', placedBy: 0 } } } : r),
      actionsRemaining: 3,
      factories: st.factories.map(f => f.id === factory.id
        ? { ...f, elements: [{ type: 'energy', count: 3 }] } : f),
    }, false)
  })
  await click(screen.getAllByTestId('factory')[fIdx])
  await until(() => phase() === 'factorySelected')
  await click(screen.getAllByTestId('element-btn')[0])
  await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
  const rb = screen.queryAllByTestId('region-btn')
  if (rb.length) await click(rb[factory.betweenRegions.indexOf(regionId)] ?? rb[0])
  await until(() => phase() === 'regionSelected')
  return { regionId, factory, otherRegion: factory.betweenRegions.find(x => x !== regionId) }
}

const validTargets = () => cells().filter(c => c.getAttribute('data-valid') === 'true')
const illegalIn = (regionId) => {
  const group = document.querySelector(`[data-region-group="${regionId}"]`)
  return [...group.querySelectorAll('g.hex-cell[data-hex]')].filter(c => c.getAttribute('data-valid') !== 'true')
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the live regions are the SAME NODE across announcements', () => {
  it('survives two placements as one persistent element', async () => {
    // THE test. A conditionally-rendered region announces its first message and is silent forever
    // after, and the DOM it leaves behind is identical to the working version · so this is the only
    // assertion in the file that can tell them apart, and it must hold the object, not re-query it.
    const s = await aimed()
    const node = polite()
    expect(node, 'no polite region in the DOM at all').toBeTruthy()

    await click(validTargets()[0])
    await until(() => polite().textContent.trim().length > 0)
    const afterFirst = polite()
    expect(Object.is(afterFirst, node), 'the polite region was REPLACED by the first announcement · ' +
      'React inserted a new node carrying the text, which a screen reader does not announce, and the ' +
      'DOM looks exactly like the working version').toBe(true)

    // second placement · re-aim and place again
    const s2 = await aimed.call(null)
    expect(s2).toBeTruthy()
  })

  it('the SAME node carries a second, different announcement', async () => {
    const s = await aimed()
    const node = polite()
    await click(validTargets()[0])
    await until(() => polite().textContent.trim().length > 0)
    const first = polite().textContent

    // Take a second action in the same mounted game · draw a card, which also logs.
    const offer = screen.queryAllByTestId('card-offer')
    expect(offer.length, 'no offer card to take a second action with · UNMEASURED').toBeGreaterThan(0)
    await click(offer[0])
    await until(() => polite().textContent !== first)

    expect(Object.is(polite(), node), 'the region was replaced between the first and second ' +
      'announcement · everything after the first is silent').toBe(true)
    expect(polite().textContent, 'the second event did not change the text').not.toBe(first)
  })
})

describe('counterweight · a repeated message still announces', () => {
  it('two identical events produce two DIFFERENT text values', async () => {
    // A live region fires on a text MUTATION. Placing the same element in the same region twice
    // writes an identical string and the second one is silent · the exact defect the S58 refusal cue
    // had when it was keyed on hex identity instead of a monotone counter (Rule 107).
    const s = await aimed()
    const targets = validTargets()
    expect(targets.length, 'need at least two legal targets · UNMEASURED').toBeGreaterThan(1)

    await click(targets[0])
    await until(() => polite().textContent.trim().length > 0)
    const first = polite().textContent
    expect(first, 'the announcement does not name the element and region').toMatch(/placed Energy in/i)

    // Re-aim and place the SAME element in the SAME region · the raw log text is identical.
    const s2 = await aimed()
    const t2 = validTargets()
    await click(t2[0])
    await until(() => polite().textContent.trim().length > 0)
    const second = polite().textContent

    expect(second.trim(), 'the fixture did not actually repeat the message · this test is then ' +
      'asserting about two different strings and proves nothing').toBe(first.trim())
    expect(second, 'the two announcements are byte-identical, so the second is a no-op mutation and ' +
      'a screen reader says NOTHING for it').not.toBe(first)
  })
})

describe('counterweight · a repeated REFUSAL still announces', () => {
  it('tapping the SAME illegal hex twice produces two different text values', async () => {
    // ⚠ THE POLITE REGION HAD THIS RIGHT AND THE REFUSAL DID NOT, and only reading the bytes found
    // it: the polite suffix was a NON-BREAKING space and the refusal's was a plain ASCII one, which
    // accessible-name computation collapses · so the second identical refusal was a no-op mutation.
    // And this is the frequent case, not the rare one: tapping the same wrong hex again is exactly
    // what a player who was not told why does. Same defect as the S58 refusal RING keyed on hex
    // identity, in the same feature, one layer up (Rule 107).
    const s = await aimed()
    const illegal = illegalIn(s.regionId)
    expect(illegal.length, 'no illegal hex · UNMEASURED').toBeGreaterThan(0)

    await click(illegal[0])
    await until(() => alert().textContent.trim().length > 0)
    const first = alert().textContent
    await click(illegal[0])
    await until(() => alert().textContent !== first, 60)
    const second = alert().textContent

    expect(second.trim(), 'the fixture did not repeat the same refusal · this proves nothing')
      .toBe(first.trim())
    expect(second, 'the same hex refused twice wrote a byte-identical string · a live region fires on ' +
      'a MUTATION, so the second refusal says nothing at all').not.toBe(first)
  })
})

describe('counterweight · the regions are not removed from the accessibility tree', () => {
  it('carry no hidden attribute and no inline display:none', async () => {
    await aimed()
    for (const [name, el] of [['polite', polite()], ['assertive', alert()]]) {
      expect(el.hasAttribute('hidden'), `${name} region carries the hidden attribute`).toBe(false)
      expect(el.style.display, `${name} region is display:none inline`).not.toBe('none')
      expect(el.getAttribute('aria-live'), `${name} region has no aria-live`).toBeTruthy()
    }
  })

  it('and the sr-only rule hides them WITHOUT display:none', () => {
    // jsdom does not apply the stylesheet, so this reads the source · a different layer from the
    // assertion above and genuinely a second source (Rule 92). display:none, visibility:hidden and
    // the hidden attribute all silence a live region while leaving the DOM looking perfect.
    const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')
    const rule = css.match(/\.sr-only\s*\{[^}]*\}/)
    expect(rule, 'no .sr-only rule in index.css · the regions are visible on screen').toBeTruthy()
    expect(rule[0], '.sr-only uses display:none, which removes it from the a11y tree').not.toMatch(/display:\s*none/)
    expect(rule[0], '.sr-only uses visibility:hidden, which also removes it').not.toMatch(/visibility:\s*hidden/)
    expect(rule[0], '.sr-only does not actually hide anything').toMatch(/clip|clip-path/)
  })
})

describe('counterweight · politeness is routed, not decorative', () => {
  it('a refusal goes ASSERTIVE and never into the polite stream or the visible log', async () => {
    const s = await aimed()
    const politeBefore = polite().textContent

    const illegal = illegalIn(s.regionId)
    expect(illegal.length, 'no illegal hex in the chosen region · UNMEASURED').toBeGreaterThan(0)
    await click(illegal[0])
    await until(() => alert().textContent.trim().length > 0)

    expect(alert().getAttribute('aria-live'), 'the refusal region is not assertive').toBe('assertive')
    expect(alert().textContent.trim().length, 'the refusal said nothing').toBeGreaterThan(0)
    expect(polite().textContent, 'the refusal leaked into the polite stream, where it queues behind ' +
      'whatever is being read and arrives after the next mistake').toBe(politeBefore)

    // And it is not game history · a visible log of refusals is noise for the sighted player who
    // already got a ring and a sound in S58.
    const logText = document.querySelector('[data-testid="action-log"]')?.textContent ?? ''
    expect(logText.toLowerCase(), 'the refusal was written into the visible action log').not.toMatch(/wrong region|already taken|not next to/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CLAIMS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the four moments have a voice', () => {
  it('starts SILENT, so an announcement is distinguishable from a standing string', async () => {
    await aimed()
    expect(polite().textContent.trim(), 'the polite region has text before anything happened').toBe('')
    expect(alert().textContent.trim(), 'the alert region has text before anything happened').toBe('')
  })

  it('AN ELEMENT LANDS · names what and where', async () => {
    const s = await aimed()
    await click(validTargets()[0])
    await until(() => polite().textContent.trim().length > 0)
    expect(polite().textContent).toMatch(/placed Energy in Sacred City/i)
  })

  it('A TAP IS REFUSED · names the reason, and the commonest reason is the wrong region', async () => {
    // 59 of 60 cells refuse at regionSelected and 40 of them are in the OTHER TWO REGIONS (measured
    // S58), so an adjacency message would be wrong for most taps. This asserts the majority case.
    const s = await aimed()
    const other = document.querySelector(`[data-region-group="${s.otherRegion}"]`)
    expect(other, 'no second region to tap into · UNMEASURED').toBeTruthy()
    const foreign = [...other.querySelectorAll('g.hex-cell[data-hex]')]
      .filter(c => c.getAttribute('data-valid') !== 'true')
    expect(foreign.length).toBeGreaterThan(0)

    await click(foreign[0])
    await until(() => alert().textContent.trim().length > 0)
    expect(alert().textContent, 'a tap in the wrong region was explained as an adjacency problem')
      .toMatch(/wrong region/i)
    expect(alert().textContent, 'the message does not say which region was chosen').toMatch(/Sacred City/)
  })

  it('THE TURN PASSES · including the direction the log structurally cannot carry', async () => {
    // ⚠ MY FIRST VERSION OF THIS TEST ASSUMED THE LOG COVERED IT AND WENT RED, which is how the gap
    // was found. The only turn entry is written by onEndTurn, so the log records the turn LEAVING
    // and says nothing when it comes BACK · and that is the half that matters, because a player who
    // does not know it is their turn simply does nothing. It needed its own source.
    render(<MemoryRouter><GameRoom practice practiceBots={1} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    // POSITIVE CONTROL · the region must be silent first, or "it announced" is unfalsifiable.
    expect(polite().textContent.trim(), 'the turn was announced at mount · then an empty region no ' +
      'longer means "nothing has happened"').toBe('')

    const seatBefore = useGameStore.getState().currentSeat
    await act(async () => { useGameStore.setState({ currentSeat: seatBefore === 0 ? 1 : 0 }, false) })
    const said = await until(() => polite().textContent.trim().length > 0, 200)
    expect(said, `a turn change announced nothing · region read "${polite().textContent}"`).toBe(true)
    expect(polite().textContent, 'the announcement does not say whose turn it now is')
      .toMatch(/your turn|is playing/i)
  })
})
