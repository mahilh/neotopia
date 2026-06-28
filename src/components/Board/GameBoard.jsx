import { hexesInRadius, hexToPixel, REGIONS, FACTORIES, HEX_SIZE, ELEMENT_COLORS } from '../../utils/hexUtils'
import { getBiomeForRegion } from '../../lib/terrainBiomes'
import HexCell from './HexCell'

// Invisible factory tap-target radius (SVG user-units · Rule 4). The visible hex is HEX_SIZE (36);
// 70 nearly doubles the TAP radius to clear 44px at the mobile scale while staying < the 72-unit gap
// to the nearest region hex (108 centre-distance − 36 hex radius), so it never overlaps a real hex.
// Factory-to-factory is also safe: the three centres are 216u/272u/272u apart (min 216u) > 2·70=140u,
// so two hit circles never overlap either. Both bounds cap a future radius bump (region steal at r>72,
// factory overlap at r>108) · keep r < 72.
const FACTORY_HIT_R = 70

// T1 S21 · vivid per-region biome fill for empty hexes — the product-owner palette that makes the 3 regions
// read as distinct living biomes ("feel like a real world"). RECONCILES with T2's terrainBiomes (src/lib · its
// lane · Rule 62): that data ships intentionally DARK atmospheric bases (#1a1528 / #0d1f14 / #1f0d0d) that on
// the near-black canvas read as muted-grey; this overrides ONLY the empty-hex FILL at the presentation layer
// (my lane) with the chosen saturated colors, and falls back to T2's biome.colors.hex for any unexpected id
// (Rule 65). Keyed by region id (hexUtils REGIONS: 0 Sacred City · 1 Living Earth · 2 Free Energy). Alpha is
// tuned so the biome reads clearly while element tokens + the white region-score text keep contrast (Rule 55).
const BIOME_HEX_FILL = {
  0: 'rgba(34,68,170,0.35)',   // Sacred City  · deep indigo   #2244AA
  1: 'rgba(29,122,58,0.35)',   // Living Earth · forest green  #1D7A3A
  2: 'rgba(204,85,34,0.35)',   // Free Energy  · warm amber-red #CC5522
}

export default function GameBoard({
  // All props have safe defaults so board renders without T2 store
  regions = REGIONS.map(r => ({...r, hexes: {}})),
  factories = FACTORIES.map(f => ({...f, elements: []})),
  validTargets = [],        // [{q,r}] valid placement hexes for current action
  patternHighlight = [],    // [{q,r}] occupied hexes that form a COMPLETE buildable pattern
  partialHighlight = [],     // [{q,r}] near-miss hexes (n-1 filled) · usePatternHighlight.partialKeys
  completionCandidates = [], // [{q,r}] empty hexes that would complete a near-miss · "place here to score"
  selectedFactory = null,   // factory id player selected for element pickup
  factoriesPulse = false,   // pulse unselected factories to invite the first action (your turn · BUG-02)
  regionScores = [],        // current player's per-region score · index = region id · shown under each label
  onHexClick = () => {},   // (q, r, regionId) => void
  onFactoryClick = () => {}, // (factoryId) => void
}) {
  // Collect all positions for viewBox calculation
  const allPositions = []
  REGIONS.forEach(reg => {
    hexesInRadius(reg.cq, reg.cr, reg.radius).forEach(h => {
      allPositions.push(hexToPixel(h.q, h.r))
    })
  })
  FACTORIES.forEach(f => allPositions.push(hexToPixel(f.q, f.r)))

  const xs = allPositions.map(p => p.x)
  const ys = allPositions.map(p => p.y)
  const pad = HEX_SIZE * 2.5
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const width = Math.max(...xs) - Math.min(...xs) + pad * 2
  const height = Math.max(...ys) - Math.min(...ys) + pad * 2

  const isValidTarget = (q, r) => validTargets.some(t => t.q === q && t.r === r)
  const isPatternMatch = (q, r) => patternHighlight.some(t => t.q === q && t.r === r)
  const isPartialMatch = (q, r) => partialHighlight.some(t => t.q === q && t.r === r)
  const isCompletionCandidate = (q, r) => completionCandidates.some(t => t.q === q && t.r === r)

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{width: '100%', height: '100%', maxHeight: '100%', overflow: 'visible'}}
      role="img"
      aria-label="NeoTopia civilization game board with 3 regions"
    >
      {/* Region glow backgrounds */}
      {REGIONS.map(reg => {
        const {x, y} = hexToPixel(reg.cq, reg.cr)
        return (
          <ellipse key={`glow-${reg.id}`}
            cx={x} cy={y}
            rx={HEX_SIZE * 3.8} ry={HEX_SIZE * 3.5}
            fill={reg.color} opacity={0.04}
          />
        )
      })}

      {/* Region hexes */}
      {REGIONS.map(reg => {
        const regionData = regions.find(r => r.id === reg.id) || {hexes: {}}
        const biome = getBiomeForRegion(reg.id) // T2's terrain palette · gives each region a distinct empty-hex base
        return hexesInRadius(reg.cq, reg.cr, reg.radius).map(hex => {
          const key = `${hex.q},${hex.r}`
          const element = regionData.hexes[key]?.element ?? null
          const bonusCovered = regionData.hexes[key]?.bonusCovered ?? false
          return (
            <HexCell key={`hex-${key}`}
              q={hex.q} r={hex.r}
              element={element}
              bonusCovered={bonusCovered}
              isValidTarget={isValidTarget(hex.q, hex.r)}
              isPatternMatch={isPatternMatch(hex.q, hex.r)}
              isPartialMatch={isPartialMatch(hex.q, hex.r)}
              isCompletionCandidate={isCompletionCandidate(hex.q, hex.r)}
              regionColor={reg.color}
              biomeFill={BIOME_HEX_FILL[reg.id] ?? biome.colors.hex}
              onClick={(q, r) => onHexClick(q, r, reg.id)}
            />
          )
        })
      })}

      {/* Pulse clickable factories on your turn (BUG-02 · disabled under prefers-reduced-motion). */}
      <style>{`
        .factory-pulse { animation: factory-pulse 2s ease-in-out infinite; }
        @keyframes factory-pulse {
          0%,100% { filter: brightness(1); }
          50% { filter: brightness(1.55) drop-shadow(0 0 6px rgba(255,255,255,0.35)); }
        }
        @media (prefers-reduced-motion: reduce) { .factory-pulse { animation: none; } }

        /* Element scale-in on placement · scales around the icon's own center (fill-box). */
        .hex-element-in { animation: hex-appear 0.35s ease-out; transform-box: fill-box; transform-origin: center; }
        @keyframes hex-appear { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .hex-element-in { animation: none; } }
      `}</style>

      {/* Factory hexes */}
      {FACTORIES.map(factory => {
        const factoryData = factories.find(f => f.id === factory.id)
        const pulse = factoriesPulse && factory.id !== selectedFactory
        const {x: fx, y: fy} = hexToPixel(factory.q, factory.r)
        return (
          <g key={`factory-${factory.id}`}
            className={pulse ? 'factory-pulse' : undefined}
            data-factory={factory.id}
            data-testid="factory"
            onClick={() => onFactoryClick(factory.id)}
            style={{cursor: 'pointer'}}
          >
            {/* Touch target (Rule 4 · 44px) · the visible factory hex renders ~23px at a 375px
                viewport (board height-constrains the SVG to ~0.32 scale). A transparent hit circle
                widens the TAP area without moving the factory or touching the viewBox/layout. r=70
                SVG-units → ~44px at that scale, and is overlap-safe at EVERY scale: each factory sits
                ~108 units from its nearest region hex centre (hexToPixel), so 70 + 36 (region hex
                radius) = 106 < 108 · the circle never reaches a region hex's tap area, so region
                placement clicks are never stolen. pointerEvents:'all' guarantees capture on the
                transparent fill · the click bubbles to the <g>'s onFactoryClick (force:true-safe · the
                bot clicks the same node). FIRST child → painted behind the hex · zero visual change. */}
            <circle cx={fx} cy={fy} r={FACTORY_HIT_R} fill="transparent" style={{pointerEvents: 'all'}} />
            <HexCell
              q={factory.q} r={factory.r}
              isFactory
              isSelected={factory.id === selectedFactory}
              regionColor="rgba(255,255,255,0.15)"
              onClick={() => {}}
            />
            {/* Factory element tokens · stacked small circles */}
            {factoryData?.elements?.map((el, i) => {
              const {x, y} = hexToPixel(factory.q, factory.r)
              const offsetAngle = (Math.PI * 2 / 3) * i
              const ox = i === 0 ? x : x + Math.cos(offsetAngle) * HEX_SIZE * 0.4
              const oy = i === 0 ? y : y + Math.sin(offsetAngle) * HEX_SIZE * 0.4
              return el.count > 0 && (
                <g key={`${factory.id}-${i}-${el.type}`}>
                  <circle cx={ox} cy={oy} r={HEX_SIZE*0.28}
                    fill={ELEMENT_COLORS[el.type]} opacity={0.9} />
                  <text x={ox} y={oy} textAnchor="middle"
                    dominantBaseline="central" fontSize={10} fill="white"
                    style={{userSelect:'none'}}>
                    {el.count}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}

      {/* Region name labels + current player's region score (sits above each region · never over hexes) */}
      {REGIONS.map(reg => {
        const {x, y} = hexToPixel(reg.cq, reg.cr)
        const score = regionScores[reg.id] ?? 0
        return (
          <g key={`label-${reg.id}`} style={{userSelect:'none'}}>
            <text
              x={x} y={y - HEX_SIZE * 3.55}
              textAnchor="middle" dominantBaseline="central"
              fill={reg.color} fontSize={11} fontWeight={500}
              style={{opacity: 0.7, textTransform:'uppercase', letterSpacing:2}}
            >
              {reg.name}
            </text>
            <text
              x={x} y={y - HEX_SIZE * 2.78}
              textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={18} fontWeight={700}
              style={{opacity: 0.92, fontVariantNumeric: 'tabular-nums'}}
            >
              {score}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
