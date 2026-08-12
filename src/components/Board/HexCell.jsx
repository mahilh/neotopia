import { useState, useEffect, useRef } from 'react'
import { hexToPixel, hexCorners, ELEMENT_COLORS, HEX_SIZE } from '../../utils/hexUtils'
import { elementIconShapes, hasElementIcon, elementSoulMetalLabel } from './ElementIcon'

// Visual state priority (highest wins):
//   factory > element > completionCandidate > patternMatch(complete) > partialMatch(near-miss)
//   > validTarget > base · the 3 pattern states map to the near-miss psychology loop.
export default function HexCell({
  q, r,
  element = null,            // null | 'energy'|'biofarming'|'technology'|'community'
  isValidTarget = false,    // pulsing ring · player can place here
  isPatternMatch = false,   // green · this occupied hex is part of a COMPLETE buildable pattern
  isPartialMatch = false,   // amber · near-miss · 2+ hexes match but the pattern is not complete
  isCompletionCandidate = false, // white pulse · the SINGLE empty hex that would complete a near-miss
  isReachablePreview = false, // dashed · "the factory you picked could reach here" · not yet placeable
  isFactory = false,        // factory hex · distinct look
  isSelected = false,       // factory the player has picked up from · brightened ring
  // MONOTONE, and that is the whole design (Rule 107). A refusal cue keyed on the hex's IDENTITY
  // ("3,-1") fires once and then never again, because tapping the same wrong hex twice does not change
  // the key · which is exactly what a frustrated player does. Every de-duplication key in this
  // codebase that has hung did so this way. 0 means "not refused"; any increment re-fires.
  refusedSeq = 0,
  bonusCovered = false,     // this hex has/had a bonus token
  regionColor = '#888888',
  biomeFill = null,         // T2 terrain biome empty-hex fill (per region) · overrides the flat region tint
  // ── KEYBOARD (T1 S60) ────────────────────────────────────────────────────────────────────────
  // Set ONLY on a legal target. A hex that cannot be placed on carries no role and no tab stop, so
  // "the targets are reachable" stays a statement about the targets and not about all 60 cells.
  // `roving` is the one target holding tabIndex 0; the rest are -1 and are reached with arrows.
  optionLabel = null,       // accessible name · presence is what makes this hex a listbox option
  roving = false,
  optionIndex = 0, optionCount = 0,
  onKeyNav = null,          // (dir|'activate'|'first'|'last') => void
  // Factories track focus in GameBoard (the focusable node is the wrapper that owns the hit circle,
  // not this <g>), so they PASS the flag in. Region hexes own their own focus below. Two detectors,
  // but one place that DRAWS the ring · the thing that could visibly diverge is single-source.
  forceFocusRing = false,
  innerRef = null,          // the owner needs the node to move focus with the roving index
  onClick = () => {},
}) {
  const {x, y} = hexToPixel(q, r)
  const corners = hexCorners(x, y)
  const points = corners.map(p => `${p.x},${p.y}`).join(' ')

  // Determine fill and stroke based on state
  const fill = isFactory
    ? 'rgba(255,255,255,0.04)'
    : element
    ? `${ELEMENT_COLORS[element]}22`  // 13% opacity tint when occupied
    : isCompletionCandidate
    ? 'rgba(255,255,255,0.25)'        // bright · "place here to score"
    : isPatternMatch
    ? 'rgba(30,200,100,0.22)'         // green · pattern complete
    : isPartialMatch
    ? 'rgba(255,180,50,0.14)'         // amber · near-miss · "you're close"
    : isValidTarget
    ? `${regionColor}1A`              // subtle highlight for valid placement
    : isReachablePreview
    ? 'rgba(255,255,255,0.09)'        // preview · a neutral spotlight, so it reads on all three biomes
    : (biomeFill ?? `${regionColor}0F`) // base: terrain biome fill per region (T2) · else 6% region tint

  const stroke = isFactory
    ? (isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.25)')
    : element
    ? ELEMENT_COLORS[element]
    : isValidTarget
    ? regionColor
    : `${regionColor}44`

  const strokeWidth = isFactory ? (isSelected ? 2.5 : 1.5) : element ? 1 : 0.5

  // Placement burst · when this hex goes empty → occupied, fire 6 particles outward for ~400ms (T1 S15).
  // prevElement starts at the current value so an already-occupied hex on mount does NOT burst.
  const prevElement = useRef(element)
  const [bursting, setBursting] = useState(false)
  useEffect(() => {
    const wasEmpty = !prevElement.current
    prevElement.current = element
    if (wasEmpty && element) {
      setBursting(true)
      const id = setTimeout(() => setBursting(false), 450)
      return () => clearTimeout(id)
    }
  }, [element])

  // Refusal flash · same shape as the burst above, and the dep is a VALUE not an identity, so the
  // once-a-second countdown re-render cannot cancel this timer before it fires (Rule 76 · that
  // mechanism has already killed a 2200ms overlay in shipped code).
  const [refusing, setRefusing] = useState(false)
  useEffect(() => {
    if (!refusedSeq) return
    setRefusing(true)
    const id = setTimeout(() => setRefusing(false), 340)
    return () => clearTimeout(id)
  }, [refusedSeq])

  const isOption = typeof optionLabel === 'string' && optionLabel.length > 0
  const [selfFocused, setSelfFocused] = useState(false)
  const showFocusRing = forceFocusRing || (isOption && selfFocused)
  const KEY_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
  const handleKeyDown = (e) => {
    if (!isOption || !onKeyNav) return
    const dir = KEY_DIR[e.key]
    if (dir) { e.preventDefault(); onKeyNav(dir); return }
    if (e.key === 'Home') { e.preventDefault(); onKeyNav('first'); return }
    if (e.key === 'End') { e.preventDefault(); onKeyNav('last'); return }
    // Enter and Space both place. Space is preventDefaulted so the page cannot scroll under the
    // player mid-placement; unlike CardFrame there is no auto-repeat hazard, because placing leaves
    // this phase and unmounts every option in the group.
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); onKeyNav('activate') }
  }

  return (
    <g
      ref={innerRef}
      className="hex-cell"
      // Addressable by coordinate (T1 S51). hexesInRadius returns ABSOLUTE (q,r), so this is unique
      // across all three regions and the factories · a test that addresses a cell by its index into
      // querySelectorAll is silently re-pointed by any change to render order, and the question this
      // enables (which stroke does each STATE get) is one this project has already answered wrongly.
      data-hex={`${q},${r}`}
      data-valid={isValidTarget ? 'true' : undefined}
      // A preview hex is clickable (it takes aim at its region · GameRoom), so it advertises itself as
      // clickable. The testid stays separate from hex-valid: E2E asserting "placeable now" must never
      // match a hex that only means "reachable later" (Rule 50 · the attribute has to flip on state).
      data-testid={isValidTarget ? 'hex-valid' : isReachablePreview ? 'hex-reachable' : undefined}
      onClick={() => onClick(q, r)}
      {...(isOption ? {
        role: 'option',
        // LISTBOX, NOT GRID, and the choice is forced by the data rather than by taste. A grid role
        // demands rows and columns; a hex board has neither, and inventing them would be a lie told
        // to a screen reader. What the player is doing here is choosing ONE item from a highlighted
        // set · single-select, arrow-navigated, Enter to take it · which is a listbox exactly.
        'aria-selected': roving,
        'aria-setsize': optionCount, 'aria-posinset': optionIndex,
        'aria-label': optionLabel,
        tabIndex: roving ? 0 : -1,
        onKeyDown: handleKeyDown,
        onFocus: () => setSelfFocused(true),
        onBlur: () => setSelfFocused(false),
      } : {})}
      style={{cursor: (isValidTarget || isReachablePreview || isFactory) ? 'pointer' : 'default'}}
    >
      {/* Soul-metal hover tooltip on a placed token · native SVG <title> on the hoverable group
          (the inner token <g> is pointer-events:none) · PLATO_BOOKS · Pillar 1 */}
      {element && <title>{elementSoulMetalLabel(element)}</title>}

      {/* Base hex polygon */}
      <polygon
        points={points}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        style={{
          transition: 'fill 0.2s ease, stroke 0.2s ease',
        }}
      />

      {/* BEVEL (T1 S34) · the single cheapest thing that turns a fill into an object. One shared
          gradient defined once in GameBoard, in objectBoundingBox units so every hex lights from its
          own top edge. Painted immediately after the base fill and before every state ring, so it
          shades the CELL and never the signal drawn on it · a bevel over the pulsing valid-target
          ring would dim the one thing that has to stay loud. pointer-events none so it cannot
          intercept the placement click (the bot clicks this same node · force:true-safe). */}
      {/* NOT on an occupied cell. The bevel's highlight lands exactly where the token is drawn, and an
          occupied hex has no need of it · it already reads as an object because it has a coloured
          stroke and an icon on it. Skipping it there is free contrast on the only cells whose
          legibility is load-bearing. Measured: it is worth about a point of contrast ratio. */}
      {!element && <polygon points={points} fill="url(#neo-bevel)" style={{ pointerEvents: 'none' }} />}

      {/* Reachable preview · dashed, breathing, deliberately NOT the solid pulsing ring below. The
          player has picked a factory but not yet an element, so this hex cannot take a token this
          instant · drawing it identically to a live target would repeat the exact promise the old
          tutorial broke ("then click any empty hex"). Suppressed once the hex becomes a real target. */}
      {isReachablePreview && !isValidTarget && !isCompletionCandidate && !element && (
        <polygon
          className="hex-reachable"
          points={points}
          fill="none"
          // White, not the region colour: Living Earth's ring on Living Earth's biome fill is green on
          // green and all but vanished at 375px. A neutral reads on all three biomes at one strength.
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={2}
          strokeDasharray="7 5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Valid target pulsing ring · suppressed when this hex is the completion candidate
          (the white completion pulse below is the stronger, more specific signal) */}
      {isValidTarget && !isCompletionCandidate && (
        <polygon
          points={points}
          fill="none"
          stroke={regionColor}
          strokeWidth={2}
          opacity={0.7}
          style={{animation: 'hexPulse 1.4s ease-in-out infinite'}}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Completion candidate · the ONE hex that completes a near-miss · "place here to score" */}
      {isCompletionCandidate && (
        <>
          <polygon points={points} fill="none" stroke="white" strokeWidth={2.5}
            opacity={0.9} style={{animation: 'hexPulse 0.9s ease-in-out infinite'}} vectorEffect="non-scaling-stroke" />
          <polygon points={points} fill="none" stroke={regionColor} strokeWidth={1} opacity={0.6} vectorEffect="non-scaling-stroke" />
        </>
      )}

      {/* Complete pattern · green ring · "pattern is complete · score the card" */}
      {isPatternMatch && !isCompletionCandidate && (
        <polygon points={points} fill="none" stroke="rgba(30,200,100,0.8)"
          strokeWidth={1.5} style={{animation: 'hexPulse 1.2s ease-in-out infinite'}} vectorEffect="non-scaling-stroke" />
      )}

      {/* Near-miss · amber ring · "you're close" */}
      {isPartialMatch && !isPatternMatch && !isCompletionCandidate && (
        <polygon points={points} fill="none" stroke="rgba(255,180,50,0.5)"
          strokeWidth={1} opacity={0.7} vectorEffect="non-scaling-stroke" />
      )}

      {/* Selected factory pulsing ring · feedback that this factory is picked up from */}
      {isFactory && isSelected && (
        <polygon
          points={points}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={2.5}
          style={{animation: 'hexPulse 1.4s ease-in-out infinite'}}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Element token · bespoke civilization icon · scales in on placement (reduced-motion safe). */}
      {element && hasElementIcon(element) && (
        <g transform={`translate(${x},${y})`} style={{ pointerEvents: 'none' }}>
          <g className="hex-element-in">
            {elementIconShapes(element, ELEMENT_COLORS[element], HEX_SIZE)}
          </g>
        </g>
      )}

      {/* Placement burst · 6 particles fly out + shrink as the token lands · pointer-events safe so the
          force:true valid-hex click is never intercepted · disabled under prefers-reduced-motion (CSS). */}
      {bursting && element && [0, 1, 2, 3, 4, 5].map(i => (
        <circle key={`burst-${i}`} className="hex-burst"
          cx={x} cy={y} r={3}
          fill={ELEMENT_COLORS[element] ?? '#ffffff'}
          style={{
            transformBox: 'fill-box', transformOrigin: 'center', pointerEvents: 'none',
            animationName: `burst${i}`, animationDuration: '400ms',
            animationTimingFunction: 'ease-out', animationFillMode: 'forwards',
          }}
        />
      ))}

      {/* Bonus token indicator (small dot) */}
      {bonusCovered && !element && (
        <circle cx={x} cy={y} r={4} fill="rgba(255,215,0,0.6)" />
      )}

      {/* REFUSED · the tap the board would not take. Painted LAST so it reads over the token and every
          state ring · a refusal that renders under the thing it is about is the S57 failure again.
          pointerEvents none is load-bearing, not hygiene: this polygon covers the whole cell for 340ms
          and the bot clicks these same nodes (Rule 78 · a correct control at an unreachable position is
          still a control the player does not have). fill="none" keeps it a RING · a filled flash would
          be the completion candidate's own vocabulary, which is the one cue that means the opposite. */}
      {/* KEYBOARD FOCUS · painted above every state ring, including the refusal, because it answers
          "where am I" and that question outranks every other cue on the cell.
          A DRAWN POLYGON RATHER THAN A CSS outline, and that is measured rather than stylistic: the
          factory's focusable node is a <g> whose FIRST child is a transparent r=70 hit circle, so an
          outline would hug a box about four times the visible hex and float in empty space. A <g> has
          no CSS box to hug in the first place.
          TWO-TONE, black outside and white inside. A hex is 42%/13% tint over a full-bleed terrain
          PHOTOGRAPH (T1 S59), so no single colour is safe on it · whichever tone the ground matches,
          the other one carries. Measured on occupied hexes: black 4.75-5.66, white 3.07-3.65. */}
      {refusing && (
        <polygon
          className="hex-refuse"
          data-testid="hex-refused"
          points={points}
          fill="none"
          stroke="rgba(0,0,0,0.9)"
          strokeWidth={4}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* KEYBOARD FOCUS · painted LAST, above every state ring including the refusal, because it
          answers "where am I" and that outranks every other cue on the cell.
          A DRAWN POLYGON RATHER THAN A CSS outline, and that is measured rather than stylistic: the
          factory's focusable node is a <g> whose FIRST child is a transparent r=70 hit circle, so an
          outline would hug a box about four times the visible hex and float in empty space · and a
          <g> has no CSS box for an outline to hug in the first place.
          TWO-TONE, black outside and white inside. A hex is a 42%/13% tint over a full-bleed terrain
          PHOTOGRAPH (T1 S59), so no single colour is safe on it · whichever tone the ground matches,
          the other one carries. Measured on occupied hexes: black 4.75-5.66, white 3.07-3.65. */}
      {showFocusRing && (
        <>
          <polygon data-testid="hex-focus-ring" points={points} fill="none"
            stroke="rgba(0,0,0,0.95)" strokeWidth={6} strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
          <polygon points={points} fill="none"
            stroke="#ffffff" strokeWidth={2.5} strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
        </>
      )}
    </g>
  )
}
