import { hexesInRadius, hexToPixel, REGIONS, FACTORIES, HEX_SIZE, ELEMENT_COLORS } from '../../utils/hexUtils'
import { getBiomeForRegion } from '../../lib/terrainBiomes'
import HexCell from './HexCell'

// ── THE BOARD AS AN OBJECT, NOT THREE FILLS (T1 S34) ────────────────────────────────────────────
// What a new visitor saw was three flat colour blobs floating on pure black. The gap against the
// Catan reference is structural rather than stylistic: Catan has water around land, per-tile terrain
// and visible depth, so its board is somewhere. Ours was nowhere. Everything added here is code-only
// (no new asset weighs anything) and every piece of it is painted BEHIND the play.
//
// THE RULE THAT GOVERNS ALL OF IT, and the reason the last art attempt was rejected: nothing added
// here may compete with an element token. So the additions are low-frequency and low-contrast ·
// a soft ground, one slab per region, a one-stop bevel, and a ghosted emblem. No texture, no
// pattern fill, no second thing for the eye to resolve at token scale.

// Region slab · a hexagon containing the whole region.
//
// THE 30° IS THE WHOLE POINT, and I got it wrong first time. A cluster of flat-top hexes does NOT
// form a larger hexagon in the same orientation as its members · it forms one rotated 30°. Measured
// rather than reasoned: the region's outermost corners sit at 30°, 90°, 150°, 210°, 270° and 330°
// (156.9 units out), and its narrowest points are at 0°, 60°, … (130 units). Drawn at 0° the slab
// therefore did both wrong things at once · it stuck out 32 units past the flanks and simultaneously
// sliced 17 units INTO the region's own tips, which is exactly what the first screenshot showed.
// 166 = 156.9 + 9 of margin. At the angle facing the board centre the edge lands at ~160, leaving
// ~100 units of clear floor for the mark's 90-unit rays.
const PLATTER_R = 166
const PLATTER_ROT = Math.PI / 6
const bigHex = (cx, cy, rad) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = PLATTER_ROT + (Math.PI / 3) * i
    return `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`
  }).join(' ')

// The centre of the three regions, derived rather than typed · a hard-coded 216,145.5 would silently
// stop being the centre the moment anybody moved a region (Rule 32 · never bake a derived value).
const REGION_CENTRES = REGIONS.map(r => hexToPixel(r.cq, r.cr))
const BOARD_CX = REGION_CENTRES.reduce((s, p) => s + p.x, 0) / REGION_CENTRES.length
const BOARD_CY = REGION_CENTRES.reduce((s, p) => s + p.y, 0) / REGION_CENTRES.length

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
  reachableTargets = [],    // [{q,r,regionId}] PREVIEW · where the picked factory could reach (T1 S30)
  reachableRegions = [],    // region ids the picked factory borders · the others fade back
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
  const isReachable = (q, r) => reachableTargets.some(t => t.q === q && t.r === r)
  // Only fade the other regions while a factory is actually picked · never on the resting board.
  const dimRegion = (id) => reachableRegions.length > 0 && !reachableRegions.includes(id)

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{width: '100%', height: '100%', maxHeight: '100%', overflow: 'visible'}}
      role="img"
      aria-label="NeoTopia civilization game board with 3 regions"
    >
      <defs>
        {/* One vertical bevel, reused by every hex. objectBoundingBox units mean each hex gets its own
            span of it, so a 36-unit hex and a whole slab both light from the top for free. Light at the
            top, nothing in the middle, shade at the bottom · the minimum that turns a flat fill into a
            face. Kept to three stops on purpose: more stops is more detail frequency. */}
        {/* TUNED AGAINST A MEASUREMENT, not against taste. The first values lifted every cell
            background enough to cost the tokens ~23% of their contrast (15.1-16.0 : 1 down to
            11.8-12.3 : 1, measured by sampling composited pixels). An occupied hex is only 13% opaque,
            far more transparent than the 35% biome fill, so anything added underneath shows through a
            TOKEN's cell hardest · exactly the cell that must stay readable. So the top light came down
            and the bottom shade went up: the bevel still turns a fill into a face, and the half of it
            that touches the token now pushes contrast up rather than down. */}
        <linearGradient id="neo-bevel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.055)" />
          <stop offset="46%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.26)" />
        </linearGradient>

        {/* The floor the board sits on. A radial field rather than a rectangle: a rect would draw its
            own edges into the letterbox and put a visible box around the game. This just stops the
            board being cut out of nothing. */}
        <radialGradient id="neo-field" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(200,148,64,0.038)" />
          <stop offset="55%"  stopColor="rgba(120,110,150,0.020)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        {/* Lift. Applied to the slab ONLY, never to the 57 play hexes: one shadow per region is three
            filter passes instead of fifty-seven, and shadowing each hex separately would put a dark
            edge around every token's cell · exactly the busy-ness this is meant to avoid.
            The explicit filter region matters · the default (-10%/120%) clips a dy=11 blur=16 shadow
            against a 324-unit slab, and the shadow would end in a straight cut. */}
        <filter id="neo-lift" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="11" stdDeviation="16" floodColor="#000000" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* GROUND · painted first, under everything. */}
      <ellipse
        data-board-ground=""
        cx={BOARD_CX} cy={BOARD_CY}
        rx={520} ry={470}
        fill="url(#neo-field)"
        style={{ pointerEvents: 'none' }}
      />

      {/* REGION SLABS · each region becomes one object resting on that ground, rather than a loose
          scatter of hexes. The soft ellipse glow that used to be here is kept on top of the slab: the
          slab gives the edge and the shadow, the glow keeps the centre from looking like a flat card. */}
      {REGIONS.map(reg => {
        const {x, y} = hexToPixel(reg.cq, reg.cr)
        return (
          <g key={`slab-${reg.id}`} style={{ pointerEvents: 'none' }} data-region-slab={reg.id}>
            <polygon
              points={bigHex(x, y, PLATTER_R)}
              // 4% fill, not 7%. The depth read comes from the EDGE and the SHADOW · the fill was
              // buying almost no dimensionality and paying for it in token contrast.
              fill={`${reg.color}0A`}
              stroke={`${reg.color}33`}
              strokeWidth={1.5}
              strokeLinejoin="round"
              filter="url(#neo-lift)"
            />
            {/* Top-lit face of the slab · same one-stop bevel the hexes use, so the whole board is lit
                from one direction and reads as a single physical thing. */}
            <polygon points={bigHex(x, y, PLATTER_R)} fill="url(#neo-bevel)" />
            <ellipse
              cx={x} cy={y}
              rx={HEX_SIZE * 3.8} ry={HEX_SIZE * 3.5}
              fill={reg.color} opacity={0.04}
            />
          </g>
        )
      })}

      {/* THE CENTRE IS DELIBERATELY EMPTY (T1 S35 · reversal of S34, Mahil's call).
          An emblem sat here for one session. It went because it was the only thing on the board a
          player might mistake for interactive, and it answered no question they had. The ground and
          the slabs already do the whole job the emblem was added for · "the board sits somewhere" ·
          and they do it without putting a decoration where three factories converge. Anything that
          wants this space again has to earn it by answering something. */}

      {/* Region hexes */}
      {REGIONS.map(reg => {
        const regionData = regions.find(r => r.id === reg.id) || {hexes: {}}
        const biome = getBiomeForRegion(reg.id) // T2's terrain palette · gives each region a distinct empty-hex base
        return (
        <g key={`region-${reg.id}`} className={dimRegion(reg.id) ? 'region-dimmed' : undefined} data-region-group={reg.id}>
        {hexesInRadius(reg.cq, reg.cr, reg.radius).map(hex => {
          const key = `${hex.q},${hex.r}`
          const element = regionData.hexes[key]?.element ?? null
          const bonusCovered = regionData.hexes[key]?.bonusCovered ?? false
          return (
            <HexCell key={`hex-${key}`}
              q={hex.q} r={hex.r}
              element={element}
              bonusCovered={bonusCovered}
              isReachablePreview={isReachable(hex.q, hex.r)}
              isValidTarget={isValidTarget(hex.q, hex.r)}
              isPatternMatch={isPatternMatch(hex.q, hex.r)}
              isPartialMatch={isPartialMatch(hex.q, hex.r)}
              isCompletionCandidate={isCompletionCandidate(hex.q, hex.r)}
              regionColor={reg.color}
              biomeFill={BIOME_HEX_FILL[reg.id] ?? biome.colors.hex}
              onClick={(q, r) => onHexClick(q, r, reg.id)}
            />
          )
        })}
        </g>
        )
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

        /* Reachable-preview breath (T1 S30) · opacity only, no scale: this ring says "this is where it
           could go", not "click me now", and the solid pulsing validTarget ring keeps that stronger
           signal to itself. Under reduced motion it holds at a legible steady opacity, never hidden. */
        .hex-reachable { animation: reach-breathe 2.4s ease-in-out infinite; }
        @keyframes reach-breathe { 0%,100% { opacity: 0.42; } 50% { opacity: 0.85; } }
        @media (prefers-reduced-motion: reduce) { .hex-reachable { animation: none; opacity: 0.7; } }

        /* Regions the picked factory cannot serve step back rather than disappear (T1 S30). */
        .region-dimmed { opacity: 0.35; transition: opacity 0.25s ease; }
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
          <g key={`label-${reg.id}`} className={dimRegion(reg.id) ? 'region-dimmed' : undefined} style={{userSelect:'none'}}>
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
