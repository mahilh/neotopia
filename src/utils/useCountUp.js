import { useEffect, useRef, useState } from 'react'

// A NUMBER THAT ARRIVES RATHER THAN APPEARS (T1 S55).
//
// The region score jumped. Scoring a district is the payoff of the whole loop and the board's
// response was a character swapping for another character · which reads as a re-render, not as an
// event. Counting up is the cheapest motion in games for a reason: it makes the size of the change
// legible (2 -> 9 feels bigger than 2 -> 3 because it takes longer) without a single new asset.
//
// CSS AND SVG ONLY · no canvas, no particle pack. Raster particles would need a layer that does not
// exist and would collide with the pixel cards on the exact axis that killed the last board art.
//
// ── THE FAILURE THE MEASUREMENT CANNOT SEE, NAMED BEFORE TRUSTING IT ─────────────────────────────
// For animation it is what happens when two fire at once. Two ways that bites here:
//   1 · A SECOND CHANGE MID-FLIGHT. Score 2->9 starts, and at 120ms the player scores again to 14.
//      A naive implementation restarts from the STORED previous value (2) and the number visibly
//      jumps BACKWARDS from ~5 to 2 before climbing. So each run starts from what is CURRENTLY
//      DISPLAYED, which is the only value the player has actually seen.
//   2 · A CHANGE DURING THE REGION-FOCUS TRANSITION. S50 measured that at 260ms, and my occlusion
//      probe read 18-20 of 20 blocked because it sampled 32ms in. A count-up running while the
//      viewBox is still moving is fine · they are independent · but it means any test of this must
//      settle on GEOMETRY, not on a timer, or it measures the transition instead.
// Neither is visible in a screenshot, and neither would fail a "does the number end up right" test,
// because both end on the correct value.
//
// prefers-reduced-motion SILENCES MOTION WITHOUT SILENCING SOUND · they are different user needs and
// conflating them is how a player who cannot tolerate movement also loses the audio feedback that
// was replacing it.

const DEFAULT_MS = 420

// ⚠ AN ENVIRONMENT THAT CANNOT ANSWER THE QUESTION MUST NOT ANIMATE. jsdom ships no matchMedia and
// runs no frames, so a hook that animated "because the user did not say not to" would leave every
// number stuck at its starting value in every test · which is exactly what happened: adding the
// count-up reddened two existing gates that read the score straight after a state change, because
// the DISPLAYED value now lags the real one and nothing was there to advance it.
// That red was correct and is the point of those gates. The fix is not to weaken them: it is that
// "no matchMedia" and "no requestAnimationFrame" both mean CANNOT ANIMATE RELIABLY, and the safe
// answer there is to land on the value immediately. In a real browser both always exist, so this
// only ever affects jsdom and SSR.
export const prefersReducedMotion = () => {
  try {
    if (typeof window === 'undefined') return true
    if (typeof window.requestAnimationFrame !== 'function') return true
    if (typeof window.matchMedia !== 'function') return true
    return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch { return true }
}

/**
 * @param {number} target        the real value · always the source of truth
 * @param {object} [opts]
 * @param {number} [opts.duration=420]
 * @param {boolean} [opts.reduced] override the media query (tests, and callers that already read it)
 * @returns {number} the value to display · always lands exactly on `target`
 */
export function useCountUp(target, { duration = DEFAULT_MS, reduced } = {}) {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  const rafRef = useRef(0)
  shownRef.current = shown

  useEffect(() => {
    const skip = reduced ?? prefersReducedMotion()
    // A first render, a reduced-motion user, or a non-numeric value: land immediately. No animation
    // on mount · every score on the board would climb from 0 on every page load, which announces
    // nothing and looks like a bug.
    if (skip || typeof target !== 'number' || !Number.isFinite(target)) {
      setShown(target); return
    }
    const from = shownRef.current
    if (from === target) return
    // Downward changes are not a payoff · land them. Nothing in this game reduces a region score
    // today, but an animation that runs backwards on a correction would read as a mistake.
    if (target < from) { setShown(target); return }

    const started = performance.now()
    const span = target - from
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration)
      // easeOutCubic · fast then settling, which is what "arriving" means. Linear reads mechanical.
      const eased = 1 - Math.pow(1 - t, 3)
      const v = Math.round(from + span * eased)
      setShown(t >= 1 ? target : v)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // `target` and two primitives · no object identity in here, so a caller re-rendering every
    // second (this app does, for the turn countdown) cannot cancel the animation mid-flight (Rule 76).
  }, [target, duration, reduced])

  return shown
}

export default useCountUp
