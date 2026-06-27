import { useState, useEffect, useRef } from 'react'
import { hexToPixel, hexCorners, ELEMENT_COLORS, HEX_SIZE } from '../../utils/hexUtils'
import { elementIconShapes, hasElementIcon } from './ElementIcon'

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
  isFactory = false,        // factory hex · distinct look
  isSelected = false,       // factory the player has picked up from · brightened ring
  bonusCovered = false,     // this hex has/had a bonus token
  regionColor = '#888888',
  biomeFill = null,         // T2 terrain biome empty-hex fill (per region) · overrides the flat region tint
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

  return (
    <g
      className="hex-cell"
      data-valid={isValidTarget ? 'true' : undefined}
      data-testid={isValidTarget ? 'hex-valid' : undefined}
      onClick={() => onClick(q, r)}
      style={{cursor: (isValidTarget || isFactory) ? 'pointer' : 'default'}}
    >
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
        />
      )}

      {/* Completion candidate · the ONE hex that completes a near-miss · "place here to score" */}
      {isCompletionCandidate && (
        <>
          <polygon points={points} fill="none" stroke="white" strokeWidth={2.5}
            opacity={0.9} style={{animation: 'hexPulse 0.9s ease-in-out infinite'}} />
          <polygon points={points} fill="none" stroke={regionColor} strokeWidth={1} opacity={0.6} />
        </>
      )}

      {/* Complete pattern · green ring · "pattern is complete · score the card" */}
      {isPatternMatch && !isCompletionCandidate && (
        <polygon points={points} fill="none" stroke="rgba(30,200,100,0.8)"
          strokeWidth={1.5} style={{animation: 'hexPulse 1.2s ease-in-out infinite'}} />
      )}

      {/* Near-miss · amber ring · "you're close" */}
      {isPartialMatch && !isPatternMatch && !isCompletionCandidate && (
        <polygon points={points} fill="none" stroke="rgba(255,180,50,0.5)"
          strokeWidth={1} opacity={0.7} />
      )}

      {/* Selected factory pulsing ring · feedback that this factory is picked up from */}
      {isFactory && isSelected && (
        <polygon
          points={points}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={2.5}
          style={{animation: 'hexPulse 1.4s ease-in-out infinite'}}
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
    </g>
  )
}
