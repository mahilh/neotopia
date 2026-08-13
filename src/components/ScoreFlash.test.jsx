import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { ScoreFlash } from './ProjectCard'
import { DECK } from '../lib/projectCards'
import { REGIONS } from '../utils/hexUtils'

// ── The reward has to be able to leave ───────────────────────────────────────────────────────────
// ScoreFlash is a position:fixed, inset:0, z-index 100 overlay with NO dismiss control. Everything
// about it therefore rests on one 2.2s timer, and that timer was being cancelled every second.
//
// The effect listed `onDone` as a dependency. GameRoom passes it as an inline arrow · a new function
// on every render · and GameRoom re-renders once a second for the turn countdown, which is shorter
// than 2200ms. So the effect re-ran, its cleanup cleared the pending timeout, and the overlay never
// unmounted: the first district a player built covered the whole board and stayed there.
//
// It survived this long because production has never recorded a human placing an element, and the
// only players that score are bots, which never render this.
//
// NAMING THE FALSE CASE FIRST: the failure is not an error, it is an overlay that stays. So the
// assertion is that the flash GOES AWAY under a caller that re-renders · which is every real caller.

const CARD = DECK[0]

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers() })

describe('ScoreFlash dismisses itself', () => {
  it('leaves, even though its caller hands it a new onDone every render', async () => {
    const done = vi.fn()
    // Exactly what GameRoom does: an inline arrow, so the prop identity changes on every render.
    const view = render(<ScoreFlash card={CARD} regionName={REGIONS[0].name} onDone={() => done()} />)
    expect(document.querySelector('.score-flash'), 'it should be on screen to begin with').not.toBeNull()

    // Re-render faster than the 2.2s timer · this is the turn countdown ticking once a second.
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        view.rerender(<ScoreFlash card={CARD} regionName={REGIONS[0].name} onDone={() => done()} />)
        await vi.advanceTimersByTimeAsync(1000)
      })
    }

    // FALSE CASE, and this was the live behaviour: still on screen, still covering the board, with
    // no control anywhere to close it.
    expect(document.querySelector('.score-flash'), 'the overlay never left · the board is unreachable').toBeNull()
    expect(done, 'the parent is never told the story finished, so nothing downstream resumes').toHaveBeenCalled()
  })

  it('stays long enough to actually be read', async () => {
    // The other half. A flash that dismisses instantly is the same failure in the other direction ·
    // this is the one moment that tells the player what they just built.
    const done = vi.fn()
    render(<ScoreFlash card={CARD} regionName={REGIONS[0].name} onDone={done} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
    expect(document.querySelector('.score-flash'), 'gone before it could be read').not.toBeNull()
    expect(done).not.toHaveBeenCalled()
  })
})

// ── THE CELEBRATION MUST NOT HIDE ITS OWN SUBJECT (T1 S57) ───────────────────────────────────────
// MEASURED over a real board at 375x667, sampled at the animation's PEAK: 114 of 114 hex cells under
// the scrim, 69 of them fully behind the panel · including the district that had just been built.
// Same family as Rule 78a (this component covering the practice exit) and Rule 87 (the action log
// covering 31 of 57 cells while passing clicks through).
//
// ⚠ AND THE FIRST MEASUREMENT WAS COMPROMISED IN BOTH DIRECTIONS. I screenshotted with Playwright's
// `animations: 'disabled'`, which JUMPS an animation to its END state · and hexScoreFlash ends at
// opacity 0. So the image showed no flash at all, while getBoundingClientRect happily measured the
// rect of an invisible element. Two readings, opposite errors, one cause: the probe chose a moment
// without saying so. Sampling at 800ms (the 15%-85% plateau) fixed both.
//
// WHAT THE MEASUREMENT REFRAMED: on a phone the board FILLS the screen, so no 222px panel position
// avoids it · relocating only changes WHICH region is hidden. The fix is legibility THROUGH the
// flash, not relocation.
describe('the board is still visible through the celebration', () => {
  const flash = () => {
    render(<ScoreFlash card={DECK[20]} regionName={REGIONS[0].name} onDone={() => {}} />)
    return document.querySelector('.score-flash')
  }

  it('counterweight · the panel is still opaque enough to read', () => {
    // The lazy version of this fix is to keep lightening until the board is perfect and the card is
    // unreadable · which trades one invisible thing for another. The panel carries the card name,
    // the points and the description, and it sits over a lit board.
    const el = flash()
    const panel = el.querySelector('div')
    const a = panel.style.background.match(/[\d.]+\)$/)
    expect(a, 'the panel lost its background entirely').toBeTruthy()
    expect(parseFloat(a[0]), 'the card panel is too transparent to read over a lit board')
      .toBeGreaterThanOrEqual(0.85)
  })

  it('the scrim lets the board through', () => {
    const el = flash()
    const m = el.style.background.match(/[\d.]+\)$/)
    expect(m, 'the scrim is gone or not an rgba').toBeTruthy()
    expect(parseFloat(m[0]), 'the scrim is back above 0.5 · at 0.72 the district a player just ' +
      'built was invisible behind the card describing it').toBeLessThanOrEqual(0.5)
  })

  it('and it still cannot take a tap · it covers the whole board', () => {
    // pointerEvents:none is what keeps a 2.2s overlay from eating a placement. Rule 87 is the
    // warning attached to it: that property makes an overlay LOOK harmless, so its coverage never
    // gets questioned. Here the coverage is now measured and the transparency is the fix.
    expect(flash().style.pointerEvents).toBe('none')
  })
})
