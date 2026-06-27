# NEOTOPIA ANIMATION SKILL
# Read before any animation task in T1 lane
# Source: docs/ANIMATION_DESIGN.md · June 27 2026

## CURRENT ANIMATION STATE
  hexPulse: scale 1↔1.08 on valid hexes (LOAD-BEARING · force:true required)
  NEVER remove hexPulse without T2/T3 coordination to remove force:true first

## DO NOT ADD motion library yet
  Use pure CSS @keyframes for all animations in T1 S14/S15
  Motion (npm: motion) to be evaluated in T1 S15 when animation density justifies

## TIER 1 ANIMATIONS (T1 S14/S15 scope, CSS only)
  A. Element Placement Burst: 6 particles expand from hex, fade 400ms
  B. Score Flash Sacred Ring: Flower of Life SVG expands + fades 1.2s
  C. Factory Refill Flash: white opacity flash 300ms on factory polygon
  D. Turn Transition Crossfade: instruction text fade 300ms on turn change
  E. Score Counter Tick: scale 1.4→1 + gold flash 400ms on score increase

## MAGICUI COMPONENTS TO EVALUATE (magicui.design, MIT license)
  Particles: canvas particle field for landing page/FinalScore background
  Ripple: expanding ring for score milestones (7, 9, 13, 18, 27)
  Light Rays: golden rays for FinalScore reveal
  Number Ticker: count-up animation for final score display
  Meteors: diagonal streaks for landing page (consciousness signals from cosmos)

## ANIMATION RULES (permanent)
  1. @media (prefers-reduced-motion: reduce) { * { animation: none !important } }
  2. Never animate box-shadow blur (repaint). Animate opacity on static shadow pseudo-element.
  3. Compositor-thread only: transform + opacity ONLY in critical animations
  4. Duration guide: micro=150-300ms · state=300-500ms · narrative=600ms-2s · celebration=2-4s
  5. hexPulse is LOAD-BEARING (Rule from T3 S12) — never remove without T2/T3 approval
