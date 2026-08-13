import { useState, useRef } from 'react'
import { hexesInRadius, hexToPixel, REGIONS, TERRAIN, FACTORIES, HEX_SIZE, ELEMENT_COLORS,
         nextTargetInDirection, targetsInReadingOrder } from '../../utils/hexUtils'
import { useCountUp } from '../../utils/useCountUp'
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
// ── "MAKE THE BOARD FILL THE SCREEN" · WHAT IS AND IS NOT POSSIBLE (T1 S63) ──────────────────────
// Written here rather than only in a handoff, because this is where the next attempt starts and it
// has now been attempted three times from a spec that could not work (Rule 108c).
//
// THE POSSIBLE HALF, PROVEN LIVE rather than reasoned: content outside the viewBox is NOT clipped to
// the viewBox. It is clipped to the SVG VIEWPORT, i.e. the whole element. Widening this image on the
// deployed board painted terrain straight through both 202px letterbox margins at 1440x900. So the
// porthole is not a limit of SVG and it is not a limit of the file · the file already covers the
// viewBox by 4-5 units on all four sides, at every viewport size, because the box is in USER UNITS
// and does not vary with the screen. THE PORTHOLE IS THE `neo-island` ELLIPSE BELOW, which is
// inscribed in the viewBox and therefore leaves its four corners black by construction.
//
// WHY THE MASK CANNOT SIMPLY GO, TODAY: two independent reasons, both measured.
//   1. board_terrain.jpg carries its OWN painted vignette · corner mean luminance 20.6 / 25.3 / 71.4
//      / 79.4 against 176 at the centre. Dropping the ellipse swaps a round porthole for a square
//      one. The mask and the artwork agree; that is why it was built this way.
//   2. The mask has been HIDING A REGISTRATION ERROR. The painted pale hexagons in every terrain
//      file to date are FLAT-TOP (measured: top-edge run 0.50 of width, left vertex a point, W/H
//      1.17-1.21). The slab they must sit under is POINTY-TOP · `bigHex` uses PLATTER_ROT = pi/6, so
//      its vertices are at 90 and 270 degrees, W/H 0.8660. They are 30 degrees apart and always have
//      been. Nobody could see it because the hole covers them. Remove the mask and it is the first
//      thing you see.
//
// THE SPEC NO ART BRIEF HAS EVER CARRIED, and the reason 16:9 was the wrong ask. The image scale is
// PINNED by registration (the three painted zones must land on the three region centres, which are
// 432 units apart), so the file's pixel dimensions decide how far the painting reaches. Measured
// across eight real viewports, the element spans up to 2098 units wide (3440 ultrawide) and up to
// 1612 units tall (768x1024 portrait, where the board column is width-bound). One file has to serve
// both, so it must span 2098 x 1612 board units · ASPECT 1.301, and 2.53x wider than the 828-unit
// play area. A 16:9 canvas cannot do it: at 2098 wide it is 1180 tall and leaves the portrait cases
// unpainted top and bottom.
//   canvas          aspect 1.301 or wider-and-taller · zones occupy the MIDDLE, not the width
//   zone shape      POINTY-TOP hexagon · a point at top and bottom, flat edges left and right
//                   W/H 0.8660 · 288 x 332 board units = 0.1371 of canvas width x 0.2060 of height
//   zone centres    water  0.3970, 0.3646   grass 0.6030, 0.3646   desert 0.5000, 0.6354
//   the triangle    base 0.2060 of width, apex 0.2708 of height BELOW it · height/base 1.0104
//   no vignette     the four corners must be painted ground at full value
// Both candidates were measured against this and both fail, by the triangle rather than by the
// hexagons: the board's region triangle has height/base 1.0104 and v4 is 0.5169, v5 0.5640 · roughly
// half. Best-fit similarity worst residual, v3 (shipped) 12.0 units, v4 104.9, v5 90.3. v5 is the
// better of the two and is still 7.5x worse than what is on the board now.
// Derived, never typed: move a region and the anchor follows the board (rule 32).
const BACKDROP_BOX = {
  x: BOARD_CX - BACKDROP.scale * BACKDROP.anchorX,
  y: BOARD_CY - BACKDROP.scale * BACKDROP.anchorY,
  w: BACKDROP.fileW * BACKDROP.scale,
  h: BACKDROP.fileH * BACKDROP.scale,
}

// ── REGION FOCUS · THE ONLY ROUTE TO A 44px HEX (T1 S50) ─────────────────────────────────────────
// The three-region viewBox is 828 x 866 user units. `meet` scales by min(w/vbW, h/vbH), so on a
// 320px phone the board is WIDTH-bound at 320/828 and every hex renders at 27.8px MAXIMUM · with no
// header, no action bar, no padding and nothing else on the screen. 63% of Rule 4's minimum, and no
// layout change can reach it, because the board is simply wider than the phone. The bottom sheet
// (S49) took the measured figure from 14.4 to 25.8px and that is the ceiling of that approach.
//
// ⚠ I HAVE NOW GOT THIS NUMBER WRONG TWICE, and both wrong versions are in the repo's history: S47
// said the sheet would REACH 44px (it cannot · height was never the binding constraint), and S49
// then said the board was "720 x 749, so 32px at 320". Computed from hexUtils at the moment of
// writing this, it is 828 x 865.9 and 27.8px. Both errors were arithmetic I did in my head about a
// geometry that is three lines of code to evaluate (Rule 81). Hence: this file no longer states the
// figure, it EXPORTS THE FUNCTION, and the test computes the constraint rather than quoting it.
//
// Scoping the viewBox to ONE region is the only thing that changes the ratio: a region's hexes are
// 288 x 311.8 units, so the same 320px screen has ~2.6x the scale to give.
//
// THE LABEL STACK IS WHY THIS IS NOT JUST THE HEX BBOX. Each region draws terrain name / region
// name / score at 4.45, 3.55 and 2.62 hex-radii ABOVE its centre · the score is the number that
// says whether you are winning · and the topmost of those sits 173 units up while the hexes stop at
// 155.9. A focus box built from the hexes alone clips all three, and it clips them silently,
// because an SVG outside its viewBox does not error, it just is not there (the same invisibility
// that let card art read 0/56 for fifteen sessions).
// Offset of the TOPMOST label row + half its font + slack. Was 4.45/26 when a terrain caption sat
// above the district name; S63 collapsed the stack to one line, so the top row IS the name row and
// the focus box gains 35 units of headroom it used to spend on a duplicated word.
const LABEL_STACK_TOP = HEX_SIZE * 3.55 + 20 / 2 + 4
const HEX_HALF_H = Math.sqrt(3) / 2 * HEX_SIZE
const FOCUS_PAD = HEX_SIZE * 0.3

// Exported so the gate can compute the consequence instead of quoting a number, and so the two
// branches are one function rather than two drifting copies.
export function computeViewBox(focusRegionId = null) {
  const focus = focusRegionId == null ? null : REGIONS.find(r => r.id === focusRegionId)
  if (focus) {
    const pts = hexesInRadius(focus.cq, focus.cr, focus.radius).map(h => hexToPixel(h.q, h.r))
    const c = hexToPixel(focus.cq, focus.cr)
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const x0 = Math.min(...xs) - HEX_SIZE - FOCUS_PAD
    const x1 = Math.max(...xs) + HEX_SIZE + FOCUS_PAD
    const y0 = Math.min(c.y - LABEL_STACK_TOP, Math.min(...ys) - HEX_HALF_H) - FOCUS_PAD
    const y1 = Math.max(...ys) + HEX_HALF_H + FOCUS_PAD
    return { minX: x0, minY: y0, width: x1 - x0, height: y1 - y0 }
  }
  const all = []
  REGIONS.forEach(reg => hexesInRadius(reg.cq, reg.cr, reg.radius).forEach(h => all.push(hexToPixel(h.q, h.r))))
  FACTORIES.forEach(f => all.push(hexToPixel(f.q, f.r)))
  const xs = all.map(p => p.x), ys = all.map(p => p.y)
  const pad = HEX_SIZE * 2.5
  return {
    minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad,
    width: Math.max(...xs) - Math.min(...xs) + pad * 2,
    height: Math.max(...ys) - Math.min(...ys) + pad * 2,
  }
}

// Rendered hex WIDTH (2 x radius x scale) for a viewBox inside a box, under preserveAspectRatio
// 'meet'. This is the quantity Rule 4 is about and the one every claim in this area should be made
// in · not the viewBox, not the container, not the scale.
export const hexPxIn = (vb, boxW, boxH) => 2 * HEX_SIZE * Math.min(boxW / vb.width, boxH / vb.height)

// The score gets its own component because a hook cannot live inside a .map · and per-region is the
// right granularity anyway: two regions scoring in one turn animate independently instead of one
// number restarting the other (T1 S55).
function RegionScore({ value, x, y }) {
  const shown = useCountUp(value)
  return (
    <text
      data-region-score
      x={x} y={y}
      textAnchor="middle" dominantBaseline="central"
      fill="white" fontSize={30} fontWeight={700}
      style={{ opacity: 0.92, fontVariantNumeric: 'tabular-nums' }}
    >
      {shown}
    </text>
  )
}

export default function GameBoard({
  focusRegion = null,       // region id · scope the viewBox to one region (phone, step 3). null = whole board
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
  // {q, r, regionId, seq} | null · the hex the board just refused. `seq` is a monotone counter, NOT a
  // boolean or an identity: refusing the same hex twice must re-fire, and that is the property an
  // identity key silently cannot express (Rule 107).
  refusedHex = null,
  // {keys:['q,r'], regionId, seq} | null · the district just completed. seq is monotone so scoring
  // the same shape twice re-fires; the ARRAY ORDER is the pattern's own order and drives a stagger,
  // so the district reads as assembling rather than as everything blinking at once.
  builtDistrict = null,
  onHexClick = () => {},   // (q, r, regionId) => void
  onFactoryClick = () => {}, // (factoryId) => void
}) {
  // viewBox · whole board, or scoped to one region when the player has already chosen one (see the
  // block above computeViewBox for why this is the only thing that reaches 44px on a phone).
  const { minX, minY, width, height } = computeViewBox(focusRegion)

  const isValidTarget = (q, r) => validTargets.some(t => t.q === q && t.r === r)
  const isPatternMatch = (q, r) => patternHighlight.some(t => t.q === q && t.r === r)
  const isPartialMatch = (q, r) => partialHighlight.some(t => t.q === q && t.r === r)
  const isCompletionCandidate = (q, r) => completionCandidates.some(t => t.q === q && t.r === r)
  const isReachable = (q, r) => reachableTargets.some(t => t.q === q && t.r === r)

  // ── STEP 4 BY KEYBOARD · A ROVING TABINDEX OVER THE LEGAL TARGETS (T1 S60) ─────────────────────
  // Steps 2 and 3 of the placement flow are already real <button>s and already reachable. Steps 1 and
  // 4 were SVG <g> with no role, no tab stop and no name, so the flow was HALF wired · a keyboard
  // player could start aiming and could not finish.
  //
  // ONE TAB STOP, NOT 57. The group behaves as a listbox: Tab reaches whichever target is current,
  // arrows move within the set, Enter places. Measured, the legal set runs 1 to 11 of a region's 19
  // hexes (58% at its peak) and splits into TWO disconnected components at high occupancy, which is
  // the case a neighbour-walk cannot cross and a direction can.
  //
  // ⚠ KEYED ON "q,r", NEVER ON AN INDEX INTO THIS ARRAY. validTargets is recomputed on every render;
  // an index would survive a change of aimed region and quietly point at a different cell, which is
  // Rule 107 exactly (a latch keyed on something that is not the thing that moved). The remembered
  // key is re-validated against the live set below, so a stale one cannot be activated · it is
  // replaced by the first target in reading order.
  const targetKeys = validTargets.map(t => `${t.q},${t.r}`)
  const orderedKeys = targetsInReadingOrder(targetKeys)
  const [rovingKey, setRovingKey] = useState(null)
  const liveRoving = targetKeys.includes(rovingKey) ? rovingKey : (orderedKeys[0] ?? null)
  const cellRefs = useRef({})
  const moveTo = (key) => {
    if (!key) return
    setRovingKey(key)
    // Focus follows the roving index · that is what makes it one tab stop rather than a selection
    // model the player has to operate blind.
    cellRefs.current[key]?.focus?.()
  }
  const onKeyNav = (fromKey, regionId) => (cmd) => {
    if (cmd === 'activate') { onHexClick(...fromKey.split(',').map(Number), regionId); return }
    if (cmd === 'first') { moveTo(orderedKeys[0]); return }
    if (cmd === 'last') { moveTo(orderedKeys[orderedKeys.length - 1]); return }
    // No target that way leaves focus exactly where it is · an arrow at the edge of the set must not
    // blank the cursor, which is the one thing worse than not moving.
    const next = nextTargetInDirection(fromKey, targetKeys, cmd)
    if (next) moveTo(next)
  }

  // ── STEP 1 BY KEYBOARD · the three factories ──────────────────────────────────────────────────
  // Three of them, always the same three, so they are three ordinary tab stops rather than a roving
  // group · the same shape The Offer's four cards already ship with. Focus is tracked here because
  // the focusable node is the wrapper <g> that owns the 44px hit circle, not the HexCell inside it.
  const [focusedFactory, setFocusedFactory] = useState(null)
  // Only fade the other regions while a factory is actually picked · never on the resting board.
  const dimRegion = (id) => reachableRegions.length > 0 && !reachableRegions.includes(id)

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      // OVERFLOW MUST CLIP WHEN FOCUSED. `visible` is deliberate on the whole board (glows and the
      // hex pulse reach past their own bbox), but with a one-region viewBox the OTHER two regions
      // and all three factories sit outside it · and `visible` would paint them across the rest of
      // the page and, worse, leave them hit-testable. The reachability probe in the gate is what
      // actually holds that second half; this attribute is only how it is achieved.
      style={{width: '100%', height: '100%', maxHeight: '100%', overflow: focusRegion == null ? 'visible' : 'hidden'}}
      role="img"
      // Rule 50 · the attribute FLIPS on a permanently-mounted element, so a gate can read state
      // from it. A testid that is always present would say nothing.
      data-focus-region={focusRegion == null ? 'none' : String(focusRegion)}
      aria-label={focusRegion == null
        ? 'NeoTopia civilization game board with 3 regions'
        : `NeoTopia game board, zoomed to ${REGIONS.find(r => r.id === focusRegion)?.name ?? 'a region'}`}
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
        <g key={`region-${reg.id}`} className={dimRegion(reg.id) ? 'region-dimmed' : undefined} data-region-group={reg.id}
           {...(hexesInRadius(reg.cq, reg.cr, reg.radius).some(h => isValidTarget(h.q, h.r)) ? {
             role: 'listbox',
             // "1 choices" · caught reading the label off PRODUCTION, and an empty region is the
             // most common way to meet it (the centre is the only legal cell, so the very first
             // placement of every game says it).
             'aria-label': `Where to place in ${reg.name} · ${orderedKeys.length} ${orderedKeys.length === 1 ? 'choice' : 'choices'}`,
           } : {})}>
        {hexesInRadius(reg.cq, reg.cr, reg.radius).map(hex => {
          const key = `${hex.q},${hex.r}`
          const element = regionData.hexes[key]?.element ?? null
          const bonusCovered = regionData.hexes[key]?.bonusCovered ?? false
          const optIdx = orderedKeys.indexOf(key)
          const isTarget = optIdx >= 0
          return (
            <HexCell key={`hex-${key}`}
              innerRef={isTarget ? (el => { if (el) cellRefs.current[key] = el; else delete cellRefs.current[key] }) : undefined}
              // The name carries POSITION, because the ring is the only other thing that says which
              // hex this is and a screen reader cannot see it. Reading order, not axial order · a
              // hex row is not a constant r.
              optionLabel={isTarget ? `Place in ${reg.name} · choice ${optIdx + 1} of ${orderedKeys.length}` : null}
              roving={isTarget && key === liveRoving}
              optionIndex={optIdx + 1}
              optionCount={orderedKeys.length}
              onKeyNav={isTarget ? onKeyNav(key, reg.id) : null}
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
              refusedSeq={refusedHex && refusedHex.regionId === reg.id
                && refusedHex.q === hex.q && refusedHex.r === hex.r ? refusedHex.seq : 0}
              builtSeq={builtDistrict && builtDistrict.regionId === reg.id
                && builtDistrict.keys.includes(key) ? builtDistrict.seq : 0}
              builtIndex={builtDistrict && builtDistrict.regionId === reg.id
                ? builtDistrict.keys.indexOf(key) : -1}
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
            role="button"
            tabIndex={0}
            // The name says what it HOLDS, because that is the whole basis for choosing one · a
            // factory with no stock is a dead end and the label must say so before it is activated.
            aria-label={`Factory ${factory.id + 1} · ${
              (factoryData?.elements ?? []).filter(e => e.count > 0).map(e => `${e.count} ${e.type}`).join(', ') || 'empty'
            }`}
            aria-pressed={factory.id === selectedFactory}
            onFocus={() => setFocusedFactory(factory.id)}
            onBlur={() => setFocusedFactory(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault(); onFactoryClick(factory.id)
              }
            }}
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
              forceFocusRing={focusedFactory === factory.id}
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
                  {/* The count sits ON the factory's own hex, so this text IS the topmost node at
                      all three factory centres · measured. It happens to be harmless today because
                      it is inside the <g> that carries onFactoryClick, so the click bubbles to the
                      right handler anyway. That is luck rather than design: it depends on a wrapper
                      three levels up, and the same text one refactor outside that group becomes the
                      region-label bug. Same rule as the district names · no <text> on this board is
                      a hit target. */}
                  <text x={ox} y={oy} textAnchor="middle"
                    dominantBaseline="central" fontSize={10} fill="white"
                    style={{userSelect:'none', pointerEvents:'none'}}>
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
      {/* ── A LABEL IS NOT A CONTROL, AND THIS ONE WAS EATING PLACEMENTS (T1 S40) ─────────────────
          T3 measured 13 of 97 legal hexes across a solo game as unreachable AT THEIR OWN CENTRE,
          with document.elementFromPoint returning an SVG <text> all 13 times, and twice the only
          legal placement in the game was one of those · the turn could not progress at all.
          force:true does not rescue it: force skips the actionability WAIT, not hit-testing, so a
          bot and a player are in exactly the same position.
          WHICH text, measured rather than guessed (Rule 81) · every label box against every hex
          centre, in user units:
            terrain  "Water"        y -175.4..-145.0   covers 0 · nearest centre 20.3 below it
            name     "Sacred City"  y -139.6..-116.0   COVERS 1 · the hex row at y -124.7 is dead
                                                       centre, 8.7 units inside each edge
            score    "0"            y -111.9.. -76.8   covers 0 · nearest centre 44.1 across, and
                                                       it would take a SIX-digit region score to
                                                       grow far enough to reach it
          So it is the district name, one hex per region · three positions on the whole board. And
          because the blocked set is a property of the LAYOUT rather than of legality, T3's 13
          blocked offers are these same three positions coming up again on different turns.
          THE FIX IS STRUCTURAL RATHER THAN GEOMETRIC. Nudging the name up 20 units would clear it
          today and re-break silently the moment a font, a size or a longer district name changes ·
          that is a tolerance, and Rule 81 says prefer an identity. None of these three lines has a
          handler; they are decoration. So none of them is hit-testable at all, and then no label
          can ever take a click from a cell again, at any size. */}
      {REGIONS.map(reg => {
        const {x, y} = hexToPixel(reg.cq, reg.cr)
        const score = regionScores[reg.id] ?? 0
        return (
          <g key={`label-${reg.id}`} className={dimRegion(reg.id) ? 'region-dimmed' : undefined} style={{userSelect:'none', pointerEvents:'none'}}>
            {/* SIZED FROM THE PHONE, NOT FROM THE FILE. These are SVG user units and the board is
                HEIGHT-constrained at 375px: measured, the whole board renders at 0.3263 of user
                units there, so the old 13/9.5/18 came out at 5.0px, 3.5px and 6.5px. A 3.5px
                district name is not a subtitle, it is a deleted one · and 6.5px was the region
                SCORE, the number that says whether you are winning. 26/21/30 render at 8.5px,
                7.7px and 11.5px, and the three lines clear each other by 1.3-1.7px · the first
                spacing I tried overlapped them by 0.8px and 1.6px, which the render showed and the
                arithmetic had not. Re-measure after any change to the board's height budget. */}
            {/* ONE LINE (T1 S63). The terrain caption above this used to read WATER / GRASS / DESERT
                and the row below it the district name. With the districts renamed to carry their own
                terrain, the stack read "WATER" over "WATER DISTRICT" · the same word twice, in two
                sizes, in two colours.
                THE SURVIVOR IS THE DISTRICT ROW, unchanged in size, spacing and colour, and that is a
                measurement rather than a preference. In the real font, at the one-region viewBox the
                phone uses (309.6 units at 320px):
                    fs 20, the shipped size   FOREST DISTRICT  198.6 units   64% of the box
                    fs 26, the caption's size FOREST DISTRICT  277.3 units   90% of the box
                Today's widest label is LIVING EARTH at 51%, so promoting to 26 would be a change in
                kind · 8 units of clearance each side, on the viewport where Rule 83 says a layout
                charges the most compressible thing. It keeps `reg.color` for the reason S35 gave and
                that reason still holds: it ties the name to the colour its score and its target rings
                are drawn in. `data-terrain-label` moves here so the terrain is still nameable from a
                test, and it is now on the element that actually says the terrain word. */}
            <text
              data-terrain-label={reg.terrain}
              x={x} y={y - HEX_SIZE * 3.55}
              textAnchor="middle" dominantBaseline="central"
              fill={reg.color} fontSize={20} fontWeight={500}
              style={{opacity: 0.72, textTransform:'uppercase', letterSpacing:2.2}}
            >
              {reg.name}
            </text>
            <RegionScore value={score} x={x} y={y - HEX_SIZE * 2.62} />
          </g>
        )
      })}
    </svg>
  )
}
