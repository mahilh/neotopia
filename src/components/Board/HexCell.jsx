import { hexToPixel, hexCorners, ELEMENT_COLORS, HEX_SIZE } from '../../utils/hexUtils'

// Bespoke element icons · pure SVG, centered at local 0,0 (the caller's <g> translates to the hex
// center). Replaces the plain colored circle + unicode glyph so a placed element reads as a real
// piece of civilization infrastructure: energy=bolt · biofarming=sprout · technology=gear/atom ·
// community=figure. Each returns the colored disc + a white icon mark.
const ELEMENT_ICONS = {
  energy: (color, size) => (
    <>
      <circle cx="0" cy="0" r={size * 0.42} fill={color} fillOpacity="0.9" />
      <path
        d={`M0 ${-size * 0.24} L${size * 0.14} ${size * 0.04} L${size * 0.04} ${size * 0.04} L${size * 0.04} ${size * 0.24} L${-size * 0.14} ${-size * 0.04} L${-size * 0.04} ${-size * 0.04} Z`}
        fill="rgba(255,255,255,0.92)"
      />
    </>
  ),
  biofarming: (color, size) => (
    <>
      <circle cx="0" cy="0" r={size * 0.42} fill={color} fillOpacity="0.9" />
      <line x1="0" y1={size * 0.22} x2="0" y2={-size * 0.06} stroke="rgba(255,255,255,0.92)" strokeWidth={size * 0.05} />
      <circle cx="0" cy={-size * 0.16} r={size * 0.1} fill="rgba(255,255,255,0.92)" />
      <circle cx={-size * 0.14} cy={size * 0.06} r={size * 0.1} fill="rgba(255,255,255,0.92)" />
      <circle cx={size * 0.14} cy={size * 0.06} r={size * 0.1} fill="rgba(255,255,255,0.92)" />
    </>
  ),
  technology: (color, size) => (
    <>
      <circle cx="0" cy="0" r={size * 0.42} fill={color} fillOpacity="0.9" />
      <line x1={-size * 0.3} y1="0" x2={size * 0.3} y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth={size * 0.035} />
      <line x1="0" y1={-size * 0.3} x2="0" y2={size * 0.3} stroke="rgba(255,255,255,0.5)" strokeWidth={size * 0.035} />
      <circle cx="0" cy="0" r={size * 0.22} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={size * 0.05} />
      <circle cx="0" cy="0" r={size * 0.07} fill="rgba(255,255,255,0.92)" />
    </>
  ),
  community: (color, size) => (
    <>
      <circle cx="0" cy="0" r={size * 0.42} fill={color} fillOpacity="0.9" />
      <circle cx="0" cy={-size * 0.12} r={size * 0.09} fill="rgba(255,255,255,0.92)" />
      <path
        d={`M${-size * 0.2} ${size * 0.2} Q${-size * 0.16} ${size * 0.04} 0 ${size * 0.01} Q${size * 0.16} ${size * 0.04} ${size * 0.2} ${size * 0.2}`}
        fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={size * 0.05}
      />
    </>
  ),
}

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
    : `${regionColor}0F`             // base: 6% region color

  const stroke = isFactory
    ? (isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.25)')
    : element
    ? ELEMENT_COLORS[element]
    : isValidTarget
    ? regionColor
    : `${regionColor}44`

  const strokeWidth = isFactory ? (isSelected ? 2.5 : 1.5) : element ? 1 : 0.5

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
      {element && ELEMENT_ICONS[element] && (
        <g transform={`translate(${x},${y})`} style={{ pointerEvents: 'none' }}>
          <g className="hex-element-in">
            {ELEMENT_ICONS[element](ELEMENT_COLORS[element], HEX_SIZE)}
          </g>
        </g>
      )}

      {/* Bonus token indicator (small dot) */}
      {bonusCovered && !element && (
        <circle cx={x} cy={y} r={4} fill="rgba(255,215,0,0.6)" />
      )}
    </g>
  )
}
