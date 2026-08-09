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
// a different label, not a place. So each region now declares what it IS MADE OF, and the district
// name becomes the subtitle · the physical game carries both, the district in the rulebook and the
// terrain in the paint.
//
// THE MAPPING IS THE OWNER'S, TAKEN FROM THE BOARD IN FRONT OF HIM, and it is worth writing down
// because it CONTRADICTS the mapping in src/lib/terrainBiomes.js (T2 S10), which reads Sacred City as
// 'desert dawn' and Free Energy as 'volcanic coastal' · i.e. reversed on two regions out of three.
// That module is no longer consumed by the board; flagged to T2 rather than edited (its lane).
//
// `color` is UNTOUCHED on purpose. It is the region's ELEMENT identity (byte-identical to
// ELEMENT_COLORS above · Sacred City is the technology purple, Living Earth the biofarming green,
// Free Energy the energy red) and it drives gameplay SIGNALS: the valid-target ring, the near-miss
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
    name: 'Grass',
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
export const REGIONS = [
  {id:0, name:'Sacred City',  label:'SC', cq:0,  cr:0,  radius:2, color:'#7F77DD', theme:'purple', terrain:'water'},
  {id:1, name:'Living Earth', label:'LE', cq:8,  cr:-4, radius:2, color:'#1D9E75', theme:'green',  terrain:'grass'},
  {id:2, name:'Free Energy',  label:'FE', cq:4,  cr:5,  radius:2, color:'#E24B4A', theme:'red',    terrain:'desert'},
]

export const FACTORIES = [
  {id:0, betweenRegions:[0,1], q:4,  r:-2},
  {id:1, betweenRegions:[1,2], q:6,  r:1 },
  {id:2, betweenRegions:[0,2], q:2,  r:3 },
]
