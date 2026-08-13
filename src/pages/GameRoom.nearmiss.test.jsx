// HOW CLOSE IS THIS CARD · the near-miss distance, moved onto the card (T1 S66 · Council).
//
// ── THE RULING THIS IMPLEMENTS ───────────────────────────────────────────────────────────────────
// T2 measured 5-point cards building at 9.2% of acquired and found the lever is element SUPPLY
// (Classic 60 tiles at 10.6%, Flow 48 at 6.4%). Council declined that lever · tile count is the
// denominator under every measurement in the project · and ruled on Sophia's reframe instead: the
// defect is not the RATE, it is that a player cannot see the DISTANCE. A 5-pointer that says
// 4 OF 5 PLACED is an achievement in progress; the same card silent is a tease.
//
// THE DECK MAKES THAT PHRASING EXACT, and it is worth pinning because the brief said "3 of 4":
// points === pattern.length for all 56 cards (2pt/2hex x12, 3/3 x18, 4/4 x18, 5/5 x8), so a
// 5-POINTER IS A FIVE-HEX CARD and reads 4 OF 5. The eight 5-pointers are also the eight cards
// carrying the deck's best art, which is the denominator Council weighted this by.
//
// ── WHY THIS FILE IS MOSTLY COUNTERWEIGHTS ───────────────────────────────────────────────────────
// The badge is a CLAIM ABOUT REACHABILITY made to a player who will chase it, and Isabella's dissent
// is the thing to design against: "legibility without reachability is a crueller version of the same
// problem · showing someone exactly how close they got, ten times, while never letting them arrive."
// So the assertions that matter are the ones about when it must NOT appear.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { completableStatePatch } from './scorePendingFixture'
import { DECK } from '../lib/projectCards'

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
const badges = () => [...document.querySelectorAll('[data-near-miss]')]
const badgeText = () => badges().map(b => b.textContent.trim())
// THE BADGE BELONGING TO ONE NAMED CARD. Counting badges is not enough and a mutation proved it:
// my first Diverse City assertion was `badges().length < before`, which ANOTHER card's badge
// disappearing satisfies · so removing the rule from the engine left it GREEN. A claim about one
// card has to be read off that card (Rule 112's family · a count is an identity check with no name).
const badgeOf = (card) => {
  const el = screen.queryAllByTestId('card-hand').find(c => (c.textContent || '').includes(card.name))
  return el ? el.querySelector('[data-near-miss]') : null
}

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

/** Mount practice; return the fixture that puts ONE hand card exactly one placement from complete. */
async function oneAway(extraPatch = {}) {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  const st = useGameStore.getState()
  const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
  const seed = completableStatePatch(st.regions, hand, 0)
  if (!seed) return null
  await act(async () => {
    useGameStore.setState({ ...seed.patch, actionsRemaining: 3, ...extraPatch }, false)
  })
  return seed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90). Every one is a case where the badge must be SILENT.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the badge is silent when there is no distance to report', () => {
  it('a fresh board shows no badge at all', async () => {
    // If it rendered unconditionally, every assertion below would pass for the wrong reason and the
    // feature would be decoration that happens to contain a number.
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('card-hand').length > 0)
    expect(screen.queryAllByTestId('card-hand').length,
      'no hand rendered · the absence below would be about nothing').toBeGreaterThan(0)
    expect(badgeText(), 'a card claims progress on an empty board').toEqual([])
  })

  it('and the fixture can turn it ON · otherwise the silence above proves nothing', async () => {
    // Rule 120 · an absence needs a positive control that exercises the same mechanism, in the same
    // file, or "no badges" is indistinguishable from "the selector is wrong".
    const seed = await oneAway()
    expect(seed, 'the fixture could not make any hand card one-away · UNMEASURED, not a pass').not.toBeNull()
    await until(() => badges().length > 0)
    expect(badges().length, 'the board is one placement from completing a card and no card says so')
      .toBeGreaterThan(0)
  })
})

describe('the number is the card\'s own, not a constant', () => {
  it('reads (pattern length - 1) OF (pattern length) for the card that is actually close', async () => {
    const seed = await oneAway()
    expect(seed).not.toBeNull()
    await until(() => badges().length > 0)
    const n = seed.card.pattern.length
    expect(badgeText()).toContain(`${n - 1} OF ${n} PLACED`)
    // and the attribute carries the same pair, so a screen-scraper and a DOM reader agree
    expect(badges().map(b => b.getAttribute('data-near-miss'))).toContain(`${n - 1}/${n}`)
  })

  it('a completion candidate is ALWAYS exactly one away · which is why one number cannot lie', async () => {
    // THE PREMISE THE WHOLE DESIGN RESTS ON, asserted rather than trusted. findPatternHighlights
    // sets filledKeys = matchedHexKeys.filter(k => k !== emptyKey), so `placed` is always n-1. That
    // is what makes "take the best across three regions" safe: there is no smaller truth to hide,
    // because a card is either one-away somewhere or it is not. If the engine ever reports a
    // two-away candidate, this reds and the badge's honesty argument has to be rewritten.
    const seed = await oneAway()
    expect(seed).not.toBeNull()
    await until(() => badges().length > 0)
    for (const b of badges()) {
      const [placed, total] = b.getAttribute('data-near-miss').split('/').map(Number)
      expect(total - placed, `a badge reports ${placed} of ${total} · the engine promised one-away`).toBe(1)
    }
  })

  it('the deck makes the phrasing exact · points === pattern length on all 56 cards', async () => {
    // Pins the claim in the header. If a future card scores 5 on a 4-hex pattern, "a 5-pointer says
    // 4 OF 5" stops being true and the copy in the comment becomes a lie nobody would go red on.
    const off = DECK.filter(c => c.points !== c.pattern.length)
    expect(off.map(c => `${c.id} ${c.points}pt/${c.pattern.length}hex`)).toEqual([])
    expect(DECK.filter(c => c.pattern.length === 5).length, 'the eight 5-pointers are the denominator ' +
      'Council weighted this by').toBe(8)
  })
})

describe('the two failure modes Council named', () => {
  it('DIVERSE CITY · a card the rule forbids in that region shows nothing', async () => {
    // NAMED FAILURE (i): a progress figure counting a pattern completable in a region the rule
    // forbids reads "4 OF 5" when the real answer is never · which is precisely the cruelty
    // Isabella's dissent is about. It is answered by REUSING the engine rather than by a check
    // here: findPatternHighlights filters `c.illustration !== lastBuiltIllustration` per region.
    const seed = await oneAway()
    expect(seed, 'no completable card · UNMEASURED').not.toBeNull()
    await until(() => badgeOf(seed.card) !== null)
    // POSITIVE CONTROL · THIS card must be advertising before the rule is applied, or the absence
    // afterwards says nothing about the rule (Rule 120).
    expect(badgeOf(seed.card), `${seed.card.name} is not showing a badge before the rule is applied · ` +
      'the assertion below would pass on a card that never claimed anything').not.toBeNull()

    await act(async () => {
      const st = useGameStore.getState()
      useGameStore.setState({
        regions: st.regions.map(r => (r.id === seed.regionId
          ? { ...r, lastBuiltIllustration: seed.card.illustration } : r)),
      }, false)
    })
    await until(() => badgeOf(seed.card) === null, 40)
    expect(badgeOf(seed.card), `the Diverse City rule forbids ${seed.card.id} in region ${seed.regionId} ` +
      'and the card still advertises how close it is · showing a distance that cannot be closed is ' +
      'the crueller version of saying nothing').toBeNull()
  })

  it('a card that can be scored RIGHT NOW is a completion, not a near-miss', async () => {
    // Two urgencies on one card would teach that amber and the score glow mean the same thing. The
    // engine already excludes already-buildable cards from near-miss; this pins the UI half, which
    // is a separate decision (isScoreable) and could drift from it.
    const seed = await oneAway()
    expect(seed).not.toBeNull()
    await until(() => badges().length > 0)
    // complete the pattern on the board · the card becomes buildable
    await act(async () => {
      const st = useGameStore.getState()
      const [q, r] = seed.missingKey.split(',').map(Number)
      useGameStore.setState({
        regions: st.regions.map(reg => (reg.id === seed.regionId
          ? { ...reg, hexes: { ...reg.hexes, [`${q},${r}`]: { element: seed.requiredType } } } : reg)),
      }, false)
    })
    await until(() => !badgeText().includes(`${seed.card.pattern.length - 1} OF ${seed.card.pattern.length} PLACED`), 40)
    expect(badgeText(), 'a card that is complete still shows a near-miss badge · it is not near, it is there')
      .not.toContain(`${seed.card.pattern.length - 1} OF ${seed.card.pattern.length} PLACED`)
  })
})
