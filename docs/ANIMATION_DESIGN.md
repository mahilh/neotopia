# NEOTOPIA ANIMATION DESIGN SYSTEM
# Version 1.0 · June 27 2026 · Overnight AUTODRIVE! research output
# Source libraries: Motion (npm: motion) · 21st.dev · magicui.design
# All animations must use CSS only (no framer-motion/motion installed yet)
# SVG animations via CSS @keyframes and animate props

## LIBRARY DECISION

Do NOT add motion/react yet (bundle size + complexity overhead).
Use pure CSS animations for now — they run on compositor thread at 60fps.
Motion (formerly Framer Motion) should be added in T1 S15 when animation density justifies it.
The import path when ready: `import { motion } from "motion/react"`

## CURRENT ANIMATIONS AUDIT

Existing (src/index.css):
  hexPulse: scale 1 ↔ 1.08 · 0.9s ease-in-out infinite
    Used on: valid placement hexes
    Status: LOAD-BEARING — force:true required because bbox keeps moving
  (any others?): check src/index.css for all @keyframes

## ANIMATIONS TO ADD (prioritized)

### TIER 1 · HIGH IMPACT · PURE CSS · T1 S14 scope

#### A. Element Placement Burst
  Trigger: when an element token lands on a hex (element count 0→1)
  Effect: 6 element-colored particles expand from hex center and fade
  Implementation: CSS @keyframes + SVG circles positioned at hex center

  @keyframes elementBurst {
    0% { transform: translate(0,0) scale(1); opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
  }

  In HexCell.jsx: when isOccupied transitions from false to true,
    briefly render 6 <circle> elements around the center with
    --dx and --dy pointing in 6 hex directions (0°, 60°, 120°...)
    Duration: 400ms · fill: element color · r=4px each

#### B. Score Flash — Sacred Geometry Ring
  Trigger: when a card is scored (ScoreFlash component already exists)
  Effect: a sacred geometry ring expands from the scored hex cluster
  Currently: ScoreFlash shows a text flash
  ADD: a translucent Flower of Life SVG expands from the board center
    of the scored pattern, then fades. Duration: 1.2s.

  @keyframes scoreRing {
    0% { transform: scale(0.2); opacity: 0.9; }
    60% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(1.4); opacity: 0; }
  }

  The ring color = the card's primary element color
  The ring shape = simplified Flower of Life (7 overlapping circles) in SVG

#### C. Factory Refill Flash
  Trigger: when a factory restocks (new production tile revealed)
  Effect: factory hexes brighten briefly (opacity 0 → 0.6 → 0) white overlay
  Duration: 300ms · White fill on factory polygon · opacity: keyframe flash

  @keyframes factoryRefill {
    0% { opacity: 0; }
    20% { opacity: 0.6; }
    100% { opacity: 0; }
  }

#### D. Turn Transition Crossfade
  Trigger: when currentSeat changes (turn flips)
  Effect: the instruction bar does a brief text crossfade (old instruction fades out,
          new instruction fades in)
  Implementation: use React key prop on the instruction span to force remount
    <span key={`${currentSeat}-${instruction}`} style={{
      animation: 'instructionFade 0.3s ease'
    }}>{instruction}</span>

  @keyframes instructionFade {
    0% { opacity: 0; transform: translateY(-4px); }
    100% { opacity: 1; transform: translateY(0); }
  }

#### E. Score Counter Tick
  Trigger: when a player's score increases
  Effect: the score number briefly scales up and flashes gold
  Implementation: key prop on the score number forces remount
    key={`score-${regionIndex}-${score}`}
    style={{ animation: 'scoreTick 0.4s ease' }}

  @keyframes scoreTick {
    0% { transform: scale(1.4); color: #C89440; }
    100% { transform: scale(1); color: white; }
  }

### TIER 2 · MEDIUM IMPACT · T1 S15 scope (motion library justified)

#### F. Card Draw Animation
  When a card is drawn from the Offer: it slides from the offer area into the hand section
  Use motion library: layoutId prop on card in offer + hand
  The card animates with spring physics from one position to the other
  This is the most satisfying animation in any card game UI

#### G. Valid Hex Glow (replace hexPulse)
  Replace the current scale-based hexPulse with a glow animation:
  Instead of scale 1↔1.08 (which causes force:true requirement),
  animate box-shadow / filter: drop-shadow on the hex polygon
  This is compositor-thread friendly AND won't break click stability
  NOTE: This would REMOVE the force:true requirement! Coordinate with T2/T3 before shipping.

#### H. Pattern Completion Shimmer
  When all cells of a buildable pattern are filled:
  Run a shimmer across the hex cluster (a traveling white highlight)
  Duration: 0.8s · angle: 45° · element color + white
  This is a near-miss psychology feature: even when you CAN'T score yet,
  seeing the shimmer on your almost-complete patterns creates excitement

#### I. Element Token Landing Physics
  When an element token first appears on a hex:
  Use motion spring: initial={{ scale: 1.8, opacity: 0 }}, animate={{ scale: 1, opacity: 1 }}
  Duration: 0.3s with spring bounce (stiffness: 300, damping: 20)
  The token bounces into place, communicating weight and reality

### TIER 3 · CIVILIZATION MOMENTS · FinalScore + end-game

#### J. Civilization Reveal Sequence (FinalScore)
  When FinalScore screen appears:
  1. Background fade in (0.5s)
  2. Winner name scales in (scale 0.5 → 1, opacity 0→1, 0.4s)
  3. Stagger: each score row slides in from left (0.1s delay each)
  4. Formula line fades in after all rows (0.3s delay)
  5. Play Again button pulses once (scale 1→1.05→1, 0.6s)
  Total sequence: ~2.5s · non-skippable but fast enough to not annoy

#### K. Global Index Contribution Animation
  When the game ends and the Global NeoTopia Index updates:
  Show a brief full-screen overlay: "Your civilization contributed to Stage 2 of 5"
  A golden particle burst rises from the screen center
  The index number counts up to include the player's score
  Duration: 2s · auto-dismisses

## MAGICUI COMPONENTS TO EVALUATE

From magicui.design (150+ free open-source animated components):

1. **Particles** (magicui) — canvas-based particle field
   Use for: landing page background · FinalScore background
   Config: few particles, element colors, slow drift movement

2. **Ripple** (magicui) — expanding ring animation
   Use for: score milestone moments (reaching 7, 13, 18 on score track)
   Config: element-colored rings expanding from score position

3. **Ripple Button** (magicui) — ripple on click
   Use for: End Turn button · Play Again button
   Config: white ripple on navy background

4. **Light Rays** (magicui) — animated light rays from above
   Use for: FinalScore screen background
   Config: golden rays, slow animation, dramatic civilization reveal feel

5. **Number Ticker** (magicui) — animated counting number
   Use for: score counter ticking up in FinalScore
   Config: white numbers, fast count-up from 0 to final score

6. **Shimmer Button** (magicui) — traveling shimmer across button
   Use for: Play Again button in FinalScore

7. **Meteors** (magicui) — diagonal streaking lines
   Use for: landing page background (subtle, very slow)
   Symbolism: civilization signals arriving from the cosmos

## SVG ANIMATION PATTERNS (for HexCell.jsx)

The board uses SVG. All hex animations happen in SVG space.
Pure CSS @keyframes work on SVG elements via the `animationName` style prop.

Pattern for element burst in SVG:
  function ElementBurst({ cx, cy, element, onComplete }) {
    const colors = { energy: '#E24B4A', biofarming: '#1D9E75',
                    technology: '#7F77DD', community: '#378ADD' }
    const color = colors[element]
    const angles = [0, 60, 120, 180, 240, 300].map(d => d * Math.PI / 180)
    return angles.map((angle, i) => (
      <circle key={i}
        cx={cx} cy={cy} r={3}
        fill={color} opacity={1}
        style={{
          animation: `burst-${i} 0.4s ease-out forwards`,
          '--dx': Math.cos(angle) * 24 + 'px',
          '--dy': Math.sin(angle) * 24 + 'px',
        }}
      />
    ))
  }

## ANIMATION RULES (permanent)

1. Every animation must respect prefers-reduced-motion:
   @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }

2. Never animate box-shadow blur directly (repaint loop). Instead:
   Animate opacity on a pseudo-element with static box-shadow.

3. Compositor-thread animations only for anything >60fps sensitive:
   Use transform and opacity ONLY (never width, height, color in keyframes).
   Exception: score counter color flash is low frequency, acceptable.

4. Duration guide:
   Micro-interactions: 150-300ms
   State transitions: 300-500ms
   Narrative moments: 600ms-2s
   Celebration sequences: 2-4s

5. hexPulse is LOAD-BEARING (Rule, T3 S12): force:true required on valid-hex clicks.
   Any replacement animation for valid hexes must preserve this rule or coordinate
   with T2/T3 to remove force:true safely.
