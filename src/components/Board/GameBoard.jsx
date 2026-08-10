import { hexesInRadius, hexToPixel, REGIONS, TERRAIN, FACTORIES, HEX_SIZE, ELEMENT_COLORS } from '../../utils/hexUtils'
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

// ── TERRAIN DRAWN ON THE GROUND (T1 S35) ────────────────────────────────────────────────────────
// Colour carries most of "this is water / grass / desert", but a flat colour is still only a label in
// a different alphabet. What makes the physical board a place is that each area is made of something.
//
// The S34 constraint is unchanged and is the reason the earlier art attempt was rejected: nothing here
// may compete with an element token. So the DRAWN terrain is put where a token can never be · outside
// the slab entirely, on the arc of each region that faces AWAY from the board centre.
//
// THAT ARC IS MEASURED, NOT PICKED. All three factories sit on the inward side of their regions, and
// the factories are the busiest controls on the board (each carries a 70-unit invisible tap circle).
// Computed from the real coordinates, the nearest factory is 146° off Sacred City's outward heading,
// 146° off Living Earth's and 150° off Free Energy's · so a ±62° outward window has ~84° of clearance
// on either side of the nearest one. The motifs cannot crowd a factory, and being pointer-events none
// they could not steal its click even if they did.
//
// ── AND THEY ARE GONE AGAIN (T1 S37) ────────────────────────────────────────────────────────────
// The drawn motifs · water ripples, dune crests, grass tufts · lived on exactly the arc the painted
// backdrop below now occupies, so they were literally drawing coastline on top of coastline. Three
// concentric ink arcs over a painted sea is a way of saying the same thing twice, more faintly, in
// a worse hand. Removed rather than kept at lower opacity: they were a stand-in for terrain and the
// terrain arrived.
// The WASH stays. It is the only thing colouring the floor INSIDE each region, where the backdrop is
// deliberately masked out, and without it the play area falls back to the pre-S35 neutral grey.

// ── THE PAINTED WORLD (T1 S37) ──────────────────────────────────────────────────────────────────
// MEASURED off the painting itself, not eyeballed · docs/BOARD_BACKDROP_ALIGNMENT.md carries the
// method and the numbers. The v2 art was a mirror of this board and was refused for it; v3 fixes
// all four faults, and a best-fit similarity over the three painted zone centroids lands at
//
//     scale 0.90737 board units per file px · rotation 0.191° · worst residual 9.7 units
//
// which is 13.5% of a hex diameter. The rotation is dropped on purpose: at this width it is a 2.8
// unit shear at the extremes, well under the residual that is already there, and carrying it would
// mean a transform on the image for less than a third of the error it removes.
//
// The file is CROPPED to the part the viewBox can actually show (the full square wasted 44% of its
// pixels outside the board) and shipped as JPEG. 2.7 MB PNG -> 372 KB, and none of that saving is a
// quality trade · it is pixels that were never drawn plus a format that suits a photograph.
const BACKDROP = {
  href: '/art/board/board_terrain.jpg',
  fileW: 922,
  fileH: 964,
  // The painted triangle's centroid IN FILE PIXELS · this is the anchor, because it is the one point
  // whose board counterpart is known exactly (BOARD_CX/BOARD_CY, derived from the regions themselves).
  anchorX: 460.667,
  anchorY: 401.667,
  scale: 0.90737,
  // Where the painting is hidden so that it can never touch a token. The hole is the DISTRICT'S OWN
  // SHAPE · the same pointy-top hexagon as the slab · softened by a blur, not a radial gradient.
  // FIRST ATTEMPT WAS A CIRCLE FADING OVER 78 UNITS AND THE SCREENSHOT KILLED IT: three black discs
  // punched into a painted world, with each region sitting at the bottom of a shadow pit. The shape
  // has to belong to the board, and the falloff has to read as the platform's own shadow rather than
  // as a hole in the picture.
  // THE HOLE, and both numbers were argued down by evidence rather than chosen.
  // Solid to 162, fully open by 198. The first version faded over 78 units and the screenshot showed
  // three black discs punched into a painted world, each region at the bottom of a shadow pit. The
  // second was a blurred hexagon matching the district's own shape, which looked right and cost too
  // much: `feGaussianBlur` inside a `mask` applied to a full-board `<image>` is a slow raster path,
  // and it pushed a page screenshot past a five-second timeout it had comfortably met before. A
  // gradient is nearly free and a 36-unit ramp reads as a rim rather than a halo.
  // 162 is the floor, not a preference: the furthest hex CORNER sits 156.9 from its region centre, so
  // anything under that puts painted ground beneath a token. BoardTerrain computes that figure from
  // the geometry and fails if the ramp ever starts inside it.
  holeSolid: 162,
  holeFade: 198,
}
// Derived, never typed: move a region and the anchor follows the board (rule 32).
const BACKDROP_BOX = {
  x: BOARD_CX - BACKDROP.scale * BACKDROP.anchorX,
  y: BOARD_CY - BACKDROP.scale * BACKDROP.anchorY,
  w: BACKDROP.fileW * BACKDROP.scale,
  h: BACKDROP.fileH * BACKDROP.scale,
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

        {/* THE HOLE THE PAINTING IS NOT ALLOWED INTO · one per region, and this is the entire reason
            gate 3 passes rather than needing to be tuned.
            An occupied hex is only 13% opaque and its token is drawn in the element's own mid-tone
            colour, so whatever sits underneath a cell is most of what a token is read AGAINST. The
            painted plateaus are pale · sand is 225,183,111 · and technology purple on sand computes
            to 2.0 : 1 against a 3 : 1 floor for non-text. There is no opacity at which a pale floor
            under a mid-tone token is legible; that is arithmetic, not taste, and it is the same wall
            the S24/S25 art attempt hit. So the play area keeps the dark ground it already had and
            the painting supplies the WORLD AROUND it. */}
        <radialGradient id="neo-backdrop-hole" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="1" />
          <stop offset={`${((BACKDROP.holeSolid / BACKDROP.holeFade) * 100).toFixed(1)}%`} stopColor="#000" stopOpacity="1" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {/* THE WORLD IS AN ISLAND, which is also how it is painted. The delivered crop reaches the
            viewBox with four units to spare, so the painting's own vignette is outside the drawing
            area entirely and the landscape met the SVG's bounding box as a straight line · a painted
            rectangle sitting on the page, which is exactly the "cut out of nothing" look the old
            neo-field existed to prevent.
            A DARK RECTANGLE ON TOP DOES NOT FIX A RECTANGLE. That was the first attempt and the
            screenshot showed why: to blacken the middle of each edge the gradient has to be pulled in
            so far that it also swallows the coastline, and to keep the coast it has to be let out far
            enough to leave the edge visible. There is no setting that does both, because the board is
            nearly square and its corners are 1.4x further out than its edges.
            So the shape changes instead of the darkness: the admitting shape is a feathered ELLIPSE,
            not a rect, and the world simply ends in water on every side. */}
        {/* The feather is DELIBERATELY NARROW · the outer 16%, about 66 units. The viewBox has almost
            no spare room: its padding is 90 units and the three districts reach nearly to the edge,
            so a generous fade does not read as a coastline, it reads as the top of the board being
            sliced off. Measured against the render at 74%: the water and grass districts sit at 0.72
            of the ellipse, i.e. inside the fade, and the land above them went. This puts the ramp
            entirely outside them and lets it reach zero exactly at the viewBox boundary, so there is
            no edge left to see. */}
        <radialGradient id="neo-island" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#fff" stopOpacity="1" />
          <stop offset="84%" stopColor="#fff" stopOpacity="1" />
          <stop offset="94%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="neo-backdrop-mask" maskUnits="userSpaceOnUse"
              x={BACKDROP_BOX.x} y={BACKDROP_BOX.y} width={BACKDROP_BOX.w} height={BACKDROP_BOX.h}>
          {/* white shows, black hides · the island admits the painting, the three districts take it back */}
          <ellipse
            cx={minX + width / 2} cy={minY + height / 2}
            rx={width / 2} ry={height / 2}
            fill="url(#neo-island)"
          />
          {REGIONS.map(reg => {
            const { x, y } = hexToPixel(reg.cq, reg.cr)
            return <circle key={`hole-${reg.id}`} cx={x} cy={y} r={BACKDROP.holeFade} fill="url(#neo-backdrop-hole)" />
          })}
        </mask>

        {/* TERRAIN WASH · one per terrain. This is what makes the FLOOR read as water, grass and
            desert rather than the regions being three coloured stickers on a neutral table. Each is
            centred on its region and reaches past the slab, so where two regions face each other the
            washes overlap and the ground between them blends · which is the actual structural thing
            Catan has and we did not: land that meets other land.
            THE PROFILE PEAKS OUTSIDE THE SLAB, WHICH IS THE WHOLE TRICK. The obvious gradient is
            brightest at the region's centre and fades outward · and the region's centre is precisely
            where the 19 play hexes are, so that shape spends all of its luminance in the one place it
            has to pay for it (measured: it cost desert tokens 9.6% of their contrast ratio). The slab
            ends at 166 of the wash's 240, i.e. 69% of the way out, so the peak is put at 72%: almost
            nothing under the play, full strength on the open ground where it is free and where the
            terrain actually needs to read. */}
        {Object.entries(TERRAIN).map(([key, t]) => (
          <radialGradient key={key} id={`neo-wash-${key}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={`rgba(${t.wash},0.022)`} />
            <stop offset="45%"  stopColor={`rgba(${t.wash},0.040)`} />
            <stop offset="72%"  stopColor={`rgba(${t.wash},0.095)`} />
            <stop offset="100%" stopColor={`rgba(${t.wash},0)`} />
          </radialGradient>
        ))}

        {/* Lift. Applied to the slab ONLY, never to the 57 play hexes: one shadow per region is three
            filter passes instead of fifty-seven, and shadowing each hex separately would put a dark
            edge around every token's cell · exactly the busy-ness this is meant to avoid.
            The explicit filter region matters · the default (-10%/120%) clips a dy=11 blur=16 shadow
            against a 324-unit slab, and the shadow would end in a straight cut. */}
        <filter id="neo-lift" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="11" stdDeviation="16" floodColor="#000000" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* GROUND · painted first, under everything.
          The neo-field radial that used to be here is gone: it existed to stop the board being cut
          out of nothing, and a painted world does that job properly. Keeping it would also have lifted
          every cell background slightly, which is paid for in token contrast. */}
      <image
        data-board-ground=""
        data-board-backdrop=""
        href={BACKDROP.href}
        x={BACKDROP_BOX.x} y={BACKDROP_BOX.y}
        width={BACKDROP_BOX.w} height={BACKDROP_BOX.h}
        preserveAspectRatio="none"
        mask="url(#neo-backdrop-mask)"
        style={{ pointerEvents: 'none' }}
      />
      {/* TERRAIN WASH · the floor INSIDE each region, which is the one place the backdrop is masked
          out. Painted before the slabs, so the slab edge reads as the shoreline where the terrain
          meets the built district. Its profile still peaks at 72% of 240 (=173), just outside the
          slab · which now also puts its strongest part exactly where the mask is handing back over
          to the painting, so the two meet in the same band instead of fighting for the middle. */}
      {REGIONS.map(reg => {
        const { x, y } = hexToPixel(reg.cq, reg.cr)
        return (
          <g key={`terrain-${reg.id}`} data-board-ground="" style={{ pointerEvents: 'none' }}>
            <circle data-terrain-wash={reg.terrain} cx={x} cy={y} r={240} fill={`url(#neo-wash-${reg.terrain})`} />
          </g>
        )
      })}

      {/* REGION SLABS · each region becomes one object resting on that ground, rather than a loose
          scatter of hexes. The soft ellipse glow that used to be here is kept on top of the slab: the
          slab gives the edge and the shadow, the glow keeps the centre from looking like a flat card. */}
      {REGIONS.map(reg => {
        const {x, y} = hexToPixel(reg.cq, reg.cr)
        const t = TERRAIN[reg.terrain]
        return (
          <g key={`slab-${reg.id}`} style={{ pointerEvents: 'none' }} data-region-slab={reg.id}>
            <polygon
              points={bigHex(x, y, PLATTER_R)}
              // THE SPLIT THAT KEEPS THIS READABLE (S35): everything that is FLOOR takes the terrain
              // colour, everything that is IDENTITY or SIGNAL keeps `reg.color`. So the slab's face is
              // terrain (it is ground) and its EDGE stays the region's own colour (it is the boundary
              // of a district, and the same colour the region's score and its valid-target ring use).
              // 5% fill, not 7%: the depth read comes from the edge and the shadow, and every point of
              // fill under the play is paid for in token contrast.
              fill={`rgba(${t.wash},0.05)`}
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
              fill={`rgb(${t.wash})`} opacity={0.05}
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
              // The empty-hex terrain. This is the DOMINANT read of a region · 19 cells of it against
              // a small label · and it is also the one terrain layer that is free, because HexCell
              // resolves `element` before `biomeFill`: a hex that carries a token never renders this.
              biomeFill={TERRAIN[reg.terrain].fill}
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

      {/* TERRAIN + district name + the current player's region score, above each region, never over a
          hex. THE ORDER IS THE POINT (S35): what a region is MADE OF leads, and what it is CALLED
          follows underneath. The physical board carries both · the district lives in the rulebook and
          the terrain is what is painted · and the screen had only ever shown the rulebook half, which
          is why three abstract names sat on three flat colours.
          The district name keeps `reg.color` rather than the terrain ink, so a player can still tie
          "Sacred City" to the purple its score and its target rings are drawn in. */}
      {REGIONS.map(reg => {
        const {x, y} = hexToPixel(reg.cq, reg.cr)
        const score = regionScores[reg.id] ?? 0
        const t = TERRAIN[reg.terrain]
        return (
          <g key={`label-${reg.id}`} className={dimRegion(reg.id) ? 'region-dimmed' : undefined} style={{userSelect:'none'}}>
            {/* SIZED FROM THE PHONE, NOT FROM THE FILE. These are SVG user units and the board is
                HEIGHT-constrained at 375px: measured, the whole board renders at 0.3263 of user
                units there, so the old 13/9.5/18 came out at 5.0px, 3.5px and 6.5px. A 3.5px
                district name is not a subtitle, it is a deleted one · and 6.5px was the region
                SCORE, the number that says whether you are winning. 26/21/30 render at 8.5px,
                7.7px and 11.5px, and the three lines clear each other by 1.3-1.7px · the first
                spacing I tried overlapped them by 0.8px and 1.6px, which the render showed and the
                arithmetic had not. Re-measure after any change to the board's height budget. */}
            <text
              data-terrain-label={reg.terrain}
              x={x} y={y - HEX_SIZE * 4.45}
              textAnchor="middle" dominantBaseline="central"
              fill={t.ink} fontSize={26} fontWeight={600}
              style={{textTransform:'uppercase', letterSpacing:4}}
            >
              {t.name}
            </text>
            <text
              x={x} y={y - HEX_SIZE * 3.55}
              textAnchor="middle" dominantBaseline="central"
              fill={reg.color} fontSize={20} fontWeight={500}
              style={{opacity: 0.72, textTransform:'uppercase', letterSpacing:2.2}}
            >
              {reg.name}
            </text>
            <text
              x={x} y={y - HEX_SIZE * 2.62}
              textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={30} fontWeight={700}
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
