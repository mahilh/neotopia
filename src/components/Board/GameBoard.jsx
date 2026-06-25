import { hexesInRadius, hexToPixel, REGIONS, FACTORIES, HEX_SIZE, ELEMENT_COLORS } from '../../utils/hexUtils'
import HexCell from './HexCell'

export default function GameBoard({
  // All props have safe defaults so board renders without T2 store
  regions = REGIONS.map(r => ({...r, hexes: {}})),
  factories = FACTORIES.map(f => ({...f, elements: []})),
  validTargets = [],        // [{q,r}] valid placement hexes for current action
  patternHighlight = [],    // [{q,r}] hexes that form a buildable pattern
  selectedFactory = null,   // factory id player selected for element pickup
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
              regionColor={reg.color}
              onClick={(q, r) => onHexClick(q, r, reg.id)}
            />
          )
        })
      })}

      {/* Factory hexes */}
      {FACTORIES.map(factory => {
        const factoryData = factories.find(f => f.id === factory.id)
        return (
          <g key={`factory-${factory.id}`}
            onClick={() => onFactoryClick(factory.id)}
            style={{cursor: 'pointer'}}
          >
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

      {/* Region name labels */}
      {REGIONS.map(reg => {
        const {x, y} = hexToPixel(reg.cq, reg.cr)
        return (
          <text key={`label-${reg.id}`}
            x={x} y={y - HEX_SIZE * 3.2}
            textAnchor="middle" dominantBaseline="central"
            fill={reg.color} fontSize={11} fontWeight={500}
            style={{userSelect:'none', opacity: 0.7, textTransform:'uppercase', letterSpacing:2}}
          >
            {reg.name}
          </text>
        )
      })}
    </svg>
  )
}
