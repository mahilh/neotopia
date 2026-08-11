// HowItWorksDemo · the landing page's four-beat animation of the real game (T1 S48).
//
// WHAT THIS FILE IS DEFENDING. The section makes five claims to a stranger who has never seen the
// game: this placement completes that pattern, that pattern is this named district, it is worth this
// many points, the region score moves by that much, and the final score triples the weakest region.
// Every one of those is computed by the shipping engine rather than written down, so what needs
// guarding is the WIRING · that the page is still asking, and still believing the answer.
//
// THE COUNTERWEIGHTS ARE FIRST, deliberately and per Rule 90. The wrong fix for a demo whose engine
// stops agreeing with it is to keep animating anyway (nobody would notice for months · a landing page
// has no error state), so the assertion that it goes DARK is the one that matters most and is the one
// that would otherwise never be exercised. It is written before the assertions it defends, with
// nothing else in the file for it to hide behind.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { findBuildableCards, calculateFinalScore } from '../lib/patternMatcher'
import { HEX_SIZE } from '../utils/hexUtils'
import HowItWorksDemo, {
  evaluateDemo, buildDemoMatch, demoFinalScore,
  BEATS, BEAT_STARTS, LOOP_MS, TEACH_BY_MS, VIEW, STAGE_MAX_W,
  DEMO_CARD, DEMO_CARD_ID, DEMO_SEED, DEMO_PLACE, DEMO_PLACE_KEY, FACTORY_STOCK,
  DEMO_SCORES, DEMO_REGION_BEFORE, DEMO_REGION_AFTER,
} from './HowItWorksDemo'

// jsdom has neither matchMedia nor IntersectionObserver (verified, not assumed · both are `undefined`
// on a fresh JSDOM window). The component guards both, so the DEFAULT here is "no reduced-motion
// preference, no observer" · which is the always-running path.
function setReducedMotion(matches) {
  window.matchMedia = vi.fn().mockImplementation(q => ({
    matches, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  delete window.matchMedia
  delete global.IntersectionObserver
  vi.useRealTimers()
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · WRITTEN FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the demo refuses to perform a claim the engine will not confirm', () => {
  it('renders NOTHING when the matcher finds no match · not a plausible frame', async () => {
    // Through the REAL dependency, not an injected prop: this is the wiring that would actually break.
    vi.resetModules()
    vi.doMock('../lib/patternMatcher', () => ({
      findBuildableCards: () => [],          // the matcher stops agreeing
      calculateFinalScore: () => 0,
    }))
    const { default: Broken } = await import('./HowItWorksDemo')
    const { container } = render(<Broken />)
    expect(container).toBeEmptyDOMElement()
    vi.doUnmock('../lib/patternMatcher')
    vi.resetModules()
  })

  it('refuses when the SEED BOARD already completes the card · beat 1 would be theatre', () => {
    // The third element pre-placed: the pattern is finished before the demo "places" anything.
    const seed = { ...DEMO_SEED, [DEMO_PLACE_KEY]: { element: DEMO_PLACE.type, placedBy: 0 } }
    const r = evaluateDemo({ card: DEMO_CARD, seed, place: DEMO_PLACE })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/already/i)
  })

  it('refuses when the placement does NOT complete the card · beat 2 would be a lie', () => {
    // Drop one element the pattern needs. Which one is derived from the card, not chosen by hand.
    const needed = DEMO_CARD.pattern.map(c => `${c.q},${c.r}`).filter(k => k !== DEMO_PLACE_KEY)
    const seed = { ...DEMO_SEED }
    delete seed[needed[0]]
    const r = evaluateDemo({ card: DEMO_CARD, seed, place: DEMO_PLACE })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/does not complete/i)
  })

  it('refuses when the card has vanished from the deck', () => {
    expect(evaluateDemo({ card: undefined, seed: DEMO_SEED, place: DEMO_PLACE }).ok).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE ENGINE IS THE SOURCE
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('every claim on screen is the engine\'s, not the page\'s', () => {
  it('the placement really does complete the card, through the placed hex', () => {
    const d = buildDemoMatch()
    expect(d.ok, d.reason).toBe(true)
    expect(d.card.id).toBe(DEMO_CARD_ID)
    // Exactly the card's own cells · same count, and the just-placed hex among them.
    expect(d.matchedKeys).toHaveLength(DEMO_CARD.pattern.length)
    expect(d.matchedKeys).toContain(DEMO_PLACE_KEY)
  })

  it('the seed board is genuinely INCOMPLETE beforehand · asked of the real matcher', () => {
    expect(findBuildableCards({ ...DEMO_SEED }, [DEMO_CARD], null)).toEqual([])
  })

  it('the region score ticks by the card\'s OWN points, and beat 4 inherits that number', () => {
    expect(DEMO_REGION_AFTER).toBe(DEMO_REGION_BEFORE + DEMO_CARD.points)
    expect(DEMO_SCORES[0]).toBe(DEMO_REGION_AFTER) // the four beats are one game, not four pictures
  })

  it('the written operation IS calculateFinalScore · not a second copy of the formula', () => {
    const s = demoFinalScore()
    expect(s.total).toBe(calculateFinalScore(DEMO_SCORES))
    // If the engine ever gains a default term, `written` stops equalling `total` and this reds ·
    // which is the day the front door would otherwise start showing two-thirds of a formula.
    expect(s.written).toBe(s.total)
  })

  it('the worst region is UNAMBIGUOUS · a tie would make the highlighted chip arbitrary', () => {
    const worst = Math.min(...DEMO_SCORES)
    expect(DEMO_SCORES.filter(v => v === worst)).toHaveLength(1)
  })

  it('the factory is holding the element the demo takes out of it', () => {
    // "Move an element FROM A FACTORY" has to be true of something on screen.
    expect(FACTORY_STOCK).toContain(DEMO_PLACE.type)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE TEXT CANNOT LAND ON THE BOARD · THE DEFECT ONLY THE RENDER COULD SEE
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the labels are DOM siblings of the board, not layers inside it', () => {
  // The first build drew both inside the <svg> and printed "Solarpunk Atrium" straight across the
  // three cells it was naming. Clipping, reachability and viewport checks were all green · none of
  // them asks whether two things occupy the same coordinates. Moving them OUT makes the separation
  // structural: a sibling cannot overlap by arithmetic error (Rule 81's better half · prove it by
  // identity rather than defend a tolerance).
  it('neither label is inside the svg', () => {
    vi.useFakeTimers() // BEFORE render · the timeline is scheduled during the mount effect
    render(<HowItWorksDemo />)
    act(() => { vi.advanceTimersByTime(BEAT_STARTS[2] + 10) })
    const svg = screen.getByTestId('hiw-demo').querySelector('svg')
    expect(svg.querySelector('[data-testid="hiw-district"]')).toBeNull()
    expect(svg.querySelector('[data-testid="hiw-region-score"]')).toBeNull()
    expect(screen.getByTestId('hiw-district')).toBeInTheDocument()
    expect(screen.getByTestId('hiw-region-score')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('both bands exist and hold their height when empty · so nothing jumps between beats', () => {
    render(<HowItWorksDemo />) // beat 1: neither label is showing
    const bands = screen.getByTestId('hiw-demo').querySelectorAll('.hiw-band')
    expect(bands).toHaveLength(2)
    for (const b of bands) expect(parseInt(b.style.minHeight, 10)).toBeGreaterThan(0)
  })

  it('the frame is landscape · a near-square viewBox letterboxes inside a wide box', () => {
    // 406.8 x 423.4 (the version with bands inside) rendered the board ~404 wide in an 870 box.
    expect(VIEW.w / VIEW.h).toBeGreaterThan(1.15)
    expect(STAGE_MAX_W).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// "IT MUST TEACH IN THE FIRST FIVE SECONDS" · AS ARITHMETIC, NOT AS AN INTENTION
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the five-second constraint is computed from the timeline', () => {
  it('place and score are both FINISHED inside five seconds', () => {
    // BEAT_STARTS[2] is when the third beat begins, i.e. when the first two have completed.
    expect(BEATS[0].id).toBe('place')
    expect(BEATS[1].id).toBe('score')
    expect(BEAT_STARTS[2]).toBeLessThanOrEqual(TEACH_BY_MS)
  })

  it('BEAT_STARTS is a real prefix sum · not a hand-typed table that can drift', () => {
    let acc = 0
    BEATS.forEach((b, i) => { expect(BEAT_STARTS[i]).toBe(acc); acc += b.ms })
    expect(LOOP_MS).toBe(acc)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE BEATS ON SCREEN
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the four beats', () => {
  beforeEach(() => { vi.useFakeTimers() })

  const advanceTo = (index) => act(() => { vi.advanceTimersByTime(BEAT_STARTS[index] + 10) })

  it('beat 1 shows the dashed target and no district yet', () => {
    render(<HowItWorksDemo />)
    expect(screen.getByTestId('hiw-demo')).toHaveAttribute('data-beat', 'place')
    expect(screen.getByTestId('hiw-target')).toBeInTheDocument()
    expect(screen.queryByTestId('hiw-district')).not.toBeInTheDocument()
  })

  it('beat 2 names the district and its points, from the card', () => {
    render(<HowItWorksDemo />)
    advanceTo(1)
    expect(screen.getByTestId('hiw-demo')).toHaveAttribute('data-beat', 'score')
    const district = screen.getByTestId('hiw-district')
    expect(district).toHaveTextContent(DEMO_CARD.name)
    expect(district).toHaveTextContent(`+${DEMO_CARD.points} points`)
    expect(screen.queryByTestId('hiw-target')).not.toBeInTheDocument() // it has landed
  })

  it('beat 3 advances the region score from the before value to the after value', () => {
    render(<HowItWorksDemo />)
    advanceTo(2)
    expect(screen.getByTestId('hiw-demo')).toHaveAttribute('data-beat', 'advance')
    const chip = screen.getByTestId('hiw-region-score')
    expect(chip).toHaveTextContent(String(DEMO_REGION_BEFORE))
    expect(chip).toHaveTextContent(String(DEMO_REGION_AFTER))
  })

  it('beat 4 states the operation and marks the worst region', () => {
    render(<HowItWorksDemo />)
    advanceTo(3)
    const s = demoFinalScore()
    expect(screen.getByTestId('hiw-demo')).toHaveAttribute('data-beat', 'balance')
    expect(screen.getByTestId('hiw-total')).toHaveTextContent(String(s.total))
    // The score pill stands down when the panel comes up · they carry the same number and, drawn
    // together, they landed on top of each other (measured in a browser · jsdom cannot see it).
    expect(screen.queryByTestId('hiw-region-score')).not.toBeInTheDocument()
    expect(screen.getByTestId('hiw-formula')).toHaveTextContent(`${s.worst} × 3`)
    // Exactly one chip is flagged worst, and it is the one holding the lowest score.
    const worstChips = DEMO_SCORES
      .map((_, id) => screen.getByTestId(`hiw-region-${id}`))
      .filter(el => el.getAttribute('data-worst') === 'true')
    expect(worstChips).toHaveLength(1)
    expect(worstChips[0]).toHaveTextContent(String(s.worst))
  })

  it('loops back to beat 1 · so the next visitor to arrive still sees place first', () => {
    render(<HowItWorksDemo />)
    act(() => { vi.advanceTimersByTime(LOOP_MS + 10) })
    expect(screen.getByTestId('hiw-demo')).toHaveAttribute('data-beat', 'place')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// REDUCED MOTION · THE FINAL COMPOSITE, NOT A BLANK
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('prefers-reduced-motion', () => {
  it('renders the composed board with no timeline running · and hands the formula to the prose', () => {
    setReducedMotion(true)
    vi.useFakeTimers()
    render(<HowItWorksDemo />)

    const root = screen.getByTestId('hiw-demo')
    expect(root).toHaveAttribute('data-reduced', 'true')
    // The completed district and the score it produced, in one still frame:
    expect(screen.getByTestId('hiw-district')).toHaveTextContent(DEMO_CARD.name)
    expect(screen.getByTestId('hiw-region-score')).toHaveTextContent(String(DEMO_REGION_AFTER))
    expect(screen.queryByTestId('hiw-target')).not.toBeInTheDocument()
    // The balance OVERLAY does not run · Landing's BALANCE panel carries the same demoFinalScore()
    // numbers as text, which is the brief's "prose stays beneath as the fallback". Stacking a
    // centred panel on top of the score pill is what the animated path does, and under reduced
    // motion both would be on screen at once with nothing to separate them in time.
    expect(screen.queryByTestId('hiw-balance')).not.toBeInTheDocument()

    // And it does not move: no timer changes anything, and no motion class is applied.
    act(() => { vi.advanceTimersByTime(LOOP_MS * 2) })
    expect(root).toHaveAttribute('data-beat', 'balance')
    expect(root.querySelectorAll('.hiw-travel, .hiw-rise, .hiw-fade, .hiw-dashed, .hiw-matched'))
      .toHaveLength(0)
  })

  it('does animate when the preference is NOT set · the counterweight to the test above', () => {
    setReducedMotion(false)
    render(<HowItWorksDemo />)
    const root = screen.getByTestId('hiw-demo')
    expect(root).toHaveAttribute('data-reduced', 'false')
    expect(root.querySelector('.hiw-travel')).toBeTruthy()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE MECHANISM BEHIND THE FIVE-SECOND CLAIM
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the loop is tied to visibility, which is what makes "beat 1 first" true', () => {
  let observers
  beforeEach(() => {
    vi.useFakeTimers()
    observers = []
    global.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; observers.push(this) }
      observe() {}
      disconnect() {}
      fire(isIntersecting) { act(() => { this.cb([{ isIntersecting }]) }) }
    }
  })

  it('does not advance while off screen, and restarts at beat 1 on every entry', () => {
    render(<HowItWorksDemo />)
    const root = screen.getByTestId('hiw-demo')
    const io = observers[0]

    // Off screen: time passes and nothing moves.
    act(() => { vi.advanceTimersByTime(LOOP_MS * 2) })
    expect(root).toHaveAttribute('data-beat', 'place')

    // Scrolled into view: the timeline runs.
    io.fire(true)
    act(() => { vi.advanceTimersByTime(BEAT_STARTS[2] + 10) })
    expect(root).toHaveAttribute('data-beat', 'advance')

    // Scrolled away mid-loop and back: the visitor gets beat 1 again, not beat 3.
    io.fire(false)
    io.fire(true)
    expect(root).toHaveAttribute('data-beat', 'place')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('accessibility', () => {
  it('the stage is one labelled image describing the WHOLE sequence', () => {
    render(<HowItWorksDemo />)
    const img = screen.getByRole('img')
    const label = img.getAttribute('aria-label')
    expect(label).toContain(DEMO_CARD.name)
    expect(label).toContain(String(demoFinalScore().total))
    expect(label).toContain(String(DEMO_REGION_AFTER))
  })

  it('NOTHING in the section is a live region · a caption that rewrites itself every 2.5s would interrupt a screen reader four times a loop, forever', () => {
    render(<HowItWorksDemo />)
    const root = screen.getByTestId('hiw-demo')
    expect(root.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).toHaveLength(0)
  })

  it('every beat has a caption · an empty one would leave the dots meaningless', () => {
    for (const b of BEATS) expect(b.caption.trim().length).toBeGreaterThan(0)
  })
})
