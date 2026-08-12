// THE SCORE ARRIVES RATHER THAN APPEARS (T1 S55).
//
// ⚠ THE FAILURE THIS EXISTS FOR IS INVISIBLE TO THE OBVIOUS TEST. Every implementation of a count-up
// ends on the right number, so "does the value end up correct" passes for all of them · including
// the one that visibly runs BACKWARDS. The defect only appears when a second change lands mid-flight:
// a naive version restarts from the stored previous value, so 2 -> 9 interrupted at 120ms by a jump
// to 14 shows ~5, then 2, then climbs. The player sees their score go DOWN at the moment they scored.
// That is asserted here explicitly, and it is the only assertion in the file that a wrong
// implementation fails.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useCountUp, prefersReducedMotion } from './useCountUp'

let frames = []
const flush = (ms) => act(() => {
  const due = frames; frames = []
  for (const fn of due) fn(performance.now() + ms)
})

function Probe({ value, reduced }) {
  const shown = useCountUp(value, { reduced, duration: 400 })
  return <span data-testid="v">{shown}</span>
}
const read = () => Number(document.querySelector('[data-testid="v"]').textContent)

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (fn) => { frames.push(fn); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('counterweight · the animation is real, and reduced motion really skips it', () => {
  it('with motion allowed the number does NOT arrive instantly', () => {
    const { rerender } = render(<Probe value={0} reduced={false} />)
    rerender(<Probe value={9} reduced={false} />)
    expect(read(), 'the value landed immediately · then every assertion about easing below is ' +
      'vacuous and this hook is a no-op wearing an animation costume').toBeLessThan(9)
  })

  it('reduced motion lands immediately · and it is a DIFFERENT need from sound', () => {
    const { rerender } = render(<Probe value={0} reduced={true} />)
    rerender(<Probe value={9} reduced={true} />)
    expect(read()).toBe(9)
    expect(frames, 'reduced motion still scheduled frames').toHaveLength(0)
  })

  it('an environment that cannot answer the question does not animate', () => {
    // jsdom has no matchMedia and runs no frames. Animating there would freeze every number at its
    // starting value · which is exactly what happened to two existing gates when this shipped.
    const mm = window.matchMedia
    delete window.matchMedia
    expect(prefersReducedMotion(), 'unknown preference must mean "do not animate"').toBe(true)
    if (mm) window.matchMedia = mm
  })
})

describe('the number never goes backwards', () => {
  it('a second change mid-flight takes over from what is DISPLAYED', () => {
    const { rerender } = render(<Probe value={2} reduced={false} />)
    rerender(<Probe value={9} reduced={false} />)
    flush(120)
    const mid = read()
    expect(mid, 'nothing moved · the fixture is not animating').toBeGreaterThan(2)
    expect(mid).toBeLessThan(9)

    rerender(<Probe value={14} reduced={false} />)
    flush(16)
    expect(read(), `the score jumped BACKWARDS from ${mid} · a naive implementation restarts from ` +
      'the stored previous value (2) and the player watches their score fall at the exact moment ' +
      'they scored').toBeGreaterThanOrEqual(mid)
  })

  it('always lands exactly on the target', () => {
    const { rerender } = render(<Probe value={0} reduced={false} />)
    rerender(<Probe value={7} reduced={false} />)
    flush(1000)
    expect(read(), 'an eased animation that never reaches its target leaves the board showing a ' +
      'number the engine disagrees with').toBe(7)
  })

  it('a downward change lands immediately rather than animating in reverse', () => {
    const { rerender } = render(<Probe value={9} reduced={false} />)
    rerender(<Probe value={4} reduced={false} />)
    expect(read()).toBe(4)
  })

  it('does not animate on mount · every score would climb from 0 on every page load', () => {
    render(<Probe value={12} reduced={false} />)
    expect(read()).toBe(12)
    expect(frames).toHaveLength(0)
  })
})
