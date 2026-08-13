// NeoTopia hex grid utilities · flat-top orientation
// Cube coordinates: q+r+s=0 (s=-q-r, always derived)
// Reference: redblobgames.com/grids/hexagons

export const HEX_SIZE = 36 // px · base unit for all calculations

// Flat-top hex to pixel (x,y center coordinates)
export function hexToPixel(q, r, size = HEX_SIZE) {
  return {
    x: size * (3/2 * q),
    y: size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)
  }
}

// ── KEYBOARD NAVIGATION OVER A SET OF TARGETS (T1 S60) ───────────────────────────────────────────
// THE 6-VS-4 PROBLEM DOES NOT ARISE HERE, and that is the design rather than a dodge. A flat-top hex
// has six neighbours and, from hexToPixel above, they land at N · S · NE · SE · NW · SW · there is no
// due EAST or WEST at all. So any mapping of four arrow keys onto six axial neighbours has to either
// drop two directions or lie about which hex is adjacent, and a wrong adjacency model is worse than
// no keyboard support because the player learns it and it is false.
//
// So arrows are NOT mapped to neighbours. An arrow means "the nearest target in that direction ON
// SCREEN", scored over the set of LEGAL targets. That claim is true of what it does, it needs no
// adjacency model, and it survives the case a neighbour walk cannot: at high occupancy the legal set
// splits into TWO disconnected components (measured: 2 components at 10 and 14 tokens placed), and a
// neighbour walk simply cannot cross the gap while a direction can.
//
// STRAIGHT AHEAD FIRST, THEN NEAREST. Candidates are bucketed by how far OFF-AXIS they sit (half a
// hex per bucket), then by distance along the axis, then by r. So pressing Down takes the cell
// directly below when there is one, and only drifts when there is not.
//
// ⚠ THE FIRST VERSION SCORED `distance / cos(angle)` AND A LIVE RUN KILLED IT. Pressing Down from
// 0,-1 with the straight-down cell 0,1 available, it chose 1,-1 · down AND 54px to the right. The
// scores were 124.708 for straight down against 124.706 for down-right: a margin of 0.002, i.e. the
// hex lattice makes several cells almost exactly equally "down-ish" under that metric and the winner
// is floating-point noise. It satisfies every assertion I had written (it does move down) and a
// player pressing Down repeatedly would ZIG-ZAG across the board · which is the false model of the
// grid that this whole design exists to avoid, arriving by a back door.
//
// TIE-BREAK: the NE/SE pair is exactly symmetric about the horizontal axis (both 1.5s across and
// 0.866s up or down), so a horizontal press can find a genuine tie no bucketing can separate. It
// resolves UPWARD, toward the smaller r, matching the reading order the options are announced in.
// Deterministic beats clever · the player learns it in one press.
const AXES = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
export function nextTargetInDirection(fromKey, keys, dir, size = HEX_SIZE) {
  const axis = AXES[dir]
  if (!axis || !fromKey) return null
  const [fq, fr] = fromKey.split(',').map(Number)
  const from = hexToPixel(fq, fr, size)
  let best = null, bestBucket = Infinity, bestAlong = Infinity, bestR = Infinity
  for (const key of keys) {
    if (key === fromKey) continue
    const [q, r] = key.split(',').map(Number)
    const p = hexToPixel(q, r, size)
    const dx = p.x - from.x, dy = p.y - from.y
    const along = dx * axis[0] + dy * axis[1]
    if (along <= 1e-6) continue            // behind, or exactly perpendicular · not this direction
    const across = Math.abs(dx * axis[1] - dy * axis[0])
    const bucket = Math.round(across / (size * 0.5))
    const better =
      bucket < bestBucket ||
      (bucket === bestBucket && along < bestAlong - 1e-6) ||
      (bucket === bestBucket && Math.abs(along - bestAlong) <= 1e-6 && r < bestR)
    if (better) { bestBucket = bucket; bestAlong = along; bestR = r; best = key }
  }
  return best
}

// Reading order for announcing a set of targets · top to bottom, then left to right, in SCREEN space
// rather than axial space (a hex row is not a constant r). Used for Home/End and for the "N of M"
// position in each option's accessible name.
export function targetsInReadingOrder(keys, size = HEX_SIZE) {
  return [...keys].sort((a, b) => {
    const [aq, ar] = a.split(',').map(Number), [bq, br] = b.split(',').map(Number)
    const pa = hexToPixel(aq, ar, size), pb = hexToPixel(bq, br, size)
    return (pa.y - pb.y) || (pa.x - pb.x)
  })
}

// Pixel to hex (click detection · ALWAYS pair with hexToPixel)
export function pixelToHex(x, y, size = HEX_SIZE) {
  const q = (2/3 * x) / size
  const r = (-1/3 * x + Math.sqrt(3)/3 * y) / size
  return hexRound(q, r)
}

// Round fractional cube coordinates to nearest hex
export function hexRound(fq, fr) {
  const fs = -fq - fr
  let q = Math.round(fq)
  let r = Math.round(fr)
  let s = Math.round(fs)
  const dq = Math.abs(q - fq)
  const dr = Math.abs(r - fr)
  const ds = Math.abs(s - fs)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  // + 0 normalizes -0 to +0 so coords are stable as map keys and in equality
  return { q: q + 0, r: r + 0 }
}

// 6 corners of a flat-top hex (for SVG polygon)
export function hexCorners(cx, cy, size = HEX_SIZE) {
  return Array.from({length: 6}, (_, i) => {
    const angle = (Math.PI / 3) * i // flat-top: 0 deg is the right vertex
    return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) }
  })
}

// 6 axial neighbor offsets (flat-top)
const NEIGHBOR_DIRS = [{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}]
export function hexNeighbors(q, r) {
  return NEIGHBOR_DIRS.map(d => ({q: q+d.q, r: r+d.r}))
}

// Hex distance (cube distance formula)
export function hexDistance(a, b) {
  return Math.max(Math.abs(a.q-b.q), Math.abs(a.r-b.r), Math.abs((-a.q-a.r)-(-b.q-b.r)))
}

// All hexes within radius of center
export function hexesInRadius(cq, cr, radius) {
  const result = []
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q-radius)
    const r2 = Math.min(radius, -q+radius)
    for (let r = r1; r <= r2; r++) result.push({q: cq+q, r: cr+r})
  }
  return result
}

// KEY: Rotate a pattern 60 deg in cube coordinates (one of 6 symmetry steps)
// cube rotate: (q,r,s) -> (-r,-s,-q) where s=-q-r
export function hexRotate60CCW(q, r) {
  const s = -q - r
  return { q: -r, r: -s } // new_q=-r, new_r=-s=q+r, new_s=-q
}

// Get all 6 rotations of an offset pattern [{q,r,type}]
export function patternRotations(pattern) {
  const rotations = []
  let current = pattern
  for (let i = 0; i < 6; i++) {
    rotations.push(current)
    current = current.map(cell => ({
      ...hexRotate60CCW(cell.q, cell.r),
      type: cell.type
    }))
  }
  return rotations
}

// Normalize pattern to start at (0,0) · subtract first cell's coords
export function normalizePattern(pattern) {
  const {q: oq, r: or} = pattern[0]
  return pattern.map(cell => ({q: cell.q - oq, r: cell.r - or, type: cell.type}))
}

export const ELEMENT_COLORS = {
  energy:     '#E24B4A',
  biofarming: '#1D9E75',
  technology: '#7F77DD',
  community:  '#378ADD',
}

export const ELEMENT_SYMBOLS = {
  energy: '⚡', biofarming: '◈', technology: '◉', community: '✦'
}

// ── TERRAIN (T1 S35) ────────────────────────────────────────────────────────────────────────────
// Mahil compared the screen to the physical NeoTopia board and the gap was structural, not stylistic.
// The physical board shows terrain a player can SEE · desert/canyon, water/coastal city, forest and
// grassland. The screen showed three abstract labels ("Sacred City") over three tinted blobs, which is
// a different label, not a place. So each region declared what it IS MADE OF, and the district name
// became the subtitle · the physical game carries both, the district in the rulebook and the terrain
// in the paint.
// ⚠ AND THE SUBTITLE IS GONE AGAIN (T1 S63), because the district names now CARRY the terrain.
// Two rows existed only to bridge "Water" and "Sacred City"; "Water District" needs no bridge, and
// two rows saying the same word is worse copy than one. See REGIONS below.
//
// THE MAPPING IS THE OWNER'S, TAKEN FROM THE BOARD IN FRONT OF HIM, and it is worth writing down
// because it CONTRADICTS the mapping in src/lib/terrainBiomes.js (T2 S10), which reads the id-0
// region as 'desert dawn' and the id-2 region as 'volcanic coastal' · i.e. reversed on two regions
// out of three. That module is no longer consumed by the board; flagged to T2 rather than edited
// (its lane), and re-flagged in S63 now that its keys are old names that exist nowhere else.
//
// `color` is UNTOUCHED on purpose. It is the region's ELEMENT identity (byte-identical to
// ELEMENT_COLORS above · Water District is the technology purple, Forest District the biofarming
// green, Desert District the energy red · terrain and element are deliberately NOT the same axis)
// and it drives gameplay SIGNALS: the valid-target ring, the near-miss
// ring, the score labels. Repainting those in terrain colours would teach the player a new colour
// language for the thing they already learned. Terrain is scenery; `color` is instruction.
export const TERRAIN = {
  water:  {
    name: 'Water',
    // Empty-hex fill. Free to be strong: HexCell resolves `element` BEFORE `biomeFill`, so a hex that
    // carries a token never renders this at all · the terrain colour cannot cost a token any contrast.
    // Only the wash below, which sits UNDER the hexes, can.
    fill: 'rgba(46,150,170,0.42)',
    // Ground bleed around the region · an RGB TRIPLE, not a colour string, because the board builds a
    // multi-stop gradient from it and string-surgery on an rgba() is a silent way to ship a broken
    // fill. This is the one terrain layer that IS under the tokens, so its alpha is set in the board.
    //
    // DELIBERATELY DARKER THAN `fill`, and the difference is measured. The wash is the only terrain
    // layer under the play, so every point of its luminance is paid for in token contrast. The first
    // pass used the same bright colours as `fill` and cost the tokens 5-17% of their ratio, worst on
    // desert because sand is the lightest. Deepening ONLY the wash keeps the empty-hex terrain exactly
    // as pale as it should look while giving most of that contrast back · the sand a player sees is
    // the fill, not the ground bleed under a token.
    wash: '26,96,116',
    ink:  'rgba(122,208,224,0.92)',  // the terrain word
  },
  grass:  {
    // FOREST, not Grass or Grassland (Mahil, S63). The painting is terraced woodland, and FOREST is
    // shorter · FOREST DISTRICT measures 198.5 units against the 309.6-unit one-region viewBox the
    // phone uses at 320, leaving 55.5 units clear each side (measured in the focus view itself,
    // T1 S64).
    // ⚠ AND THE SENTENCE THAT WAS HERE WAS FALSE, corrected by my own calibration one session later.
    // It read "at the board's label size GRASSLAND DISTRICT renders 347 units wide ... it does not
    // fit". 347 is the figure at font-size 26 · the size of the TERRAIN CAPTION I decided not to
    // use. At the size actually shipped (20) GRASSLAND DISTRICT is 248.1 and it FITS, with 61 units
    // to spare. The number was real and I attached it to the wrong subject (Rule 97b), in the
    // comment, having labelled it correctly in the commit message an hour earlier.
    // So the length argument is weaker than I wrote: FOREST wins on the terrain being right and on
    // margin, NOT because the alternative overflowed. Recorded rather than quietly deleted, because
    // a justification that gets stronger when nobody checks it is the one worth keeping honest.
    // The key stays `grass` because it is the wash/fill id and renaming it would touch four gradient
    // ids for a caption change.
    name: 'Forest',
    fill: 'rgba(96,158,62,0.42)',
    wash: '54,100,38',
    ink:  'rgba(160,214,120,0.92)',
  },
  desert: {
    name: 'Desert',
    fill: 'rgba(212,176,112,0.42)',
    wash: '140,104,52',
    ink:  'rgba(232,206,152,0.92)',
  },
}

// 3 regions + 3 factories · source of truth for board layout
// ── THE DISTRICT NAMES SAY WHAT THE PLACE IS (T1 S63, Mahil's call) ─────────────────────────────
// Sacred City / Living Earth / Free Energy are gone from the product. They were abstract: three
// proper nouns that told a player nothing about the board in front of them, which is the same
// complaint that put terrain on the ground in S35 · and it is why the label needed TWO rows, one
// saying what the region is made of and one saying what it is called.
// A name that carries the terrain collapses that: the board now draws ONE line per region.
// THE NAME MUST START WITH ITS OWN TERRAIN and there is a gate on it, because the failure mode here
// is silent and this repo has already shipped it once · terrainBiomes.js reads Sacred City as
// 'desert dawn' and Free Energy as 'volcanic coastal', reversed on two of three, and nothing went
// red because nothing consumed it (Rule 45 · a second contract drifts where no one is watching).
export const REGIONS = [
  {id:0, name:'Water District',  label:'WD', cq:0,  cr:0,  radius:2, color:'#7F77DD', theme:'purple', terrain:'water'},
  {id:1, name:'Forest District', label:'FD', cq:8,  cr:-4, radius:2, color:'#1D9E75', theme:'green',  terrain:'grass'},
  {id:2, name:'Desert District', label:'DD', cq:4,  cr:5,  radius:2, color:'#E24B4A', theme:'red',    terrain:'desert'},
]

export const FACTORIES = [
  {id:0, betweenRegions:[0,1], q:4,  r:-2},
  {id:1, betweenRegions:[1,2], q:6,  r:1 },
  {id:2, betweenRegions:[0,2], q:2,  r:3 },
]
