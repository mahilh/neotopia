import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { ScoreFlash } from './ProjectCard'
import { DECK } from '../lib/projectCards'

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
    const view = render(<ScoreFlash card={CARD} regionName="Sacred City" onDone={() => done()} />)
    expect(document.querySelector('.score-flash'), 'it should be on screen to begin with').not.toBeNull()

    // Re-render faster than the 2.2s timer · this is the turn countdown ticking once a second.
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        view.rerender(<ScoreFlash card={CARD} regionName="Sacred City" onDone={() => done()} />)
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
    render(<ScoreFlash card={CARD} regionName="Sacred City" onDone={done} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
    expect(document.querySelector('.score-flash'), 'gone before it could be read').not.toBeNull()
    expect(done).not.toHaveBeenCalled()
  })
})
