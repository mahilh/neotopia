// THE MARK AT THE CENTRE OF THE BOARD (T1 S34)
//
// The space between the three regions is the richest real estate on the board and it was empty ·
// Monopoly puts its best art exactly there, Catan puts the sea. NeoTopia had pure black. This is the
// civilization's own emblem, drawn as pure SVG so it costs no PNG, scales to any viewport, and is
// legible at 375px and 1280px from the same source.
//
// WHAT IT IS, bottom to top · the Soul Blueprint's own vocabulary, read as one composed emblem:
//   leaf base   · what the civilization grows from
//   pyramid     · what it builds
//   spiral      · consciousness expanding through the built thing
//   centre point· Source · the single brightest note in the whole mark
//   nine rays   · the Council of Nine. Nine is the canonical number here (NEOTOPIA_NUMEROLOGY:
//                 "the indestructible foundation"; the enneagram is the Nine's symbol) · it is not
//                 nine because nine looked good.
//   rings       · the boundary of the civilization
//   star        · what it is heading toward
// Deliberately NOT a hexagram (CLAUDE.md · never ✡).
//
// THE CONSTRAINT THAT SHAPES EVERY NUMBER BELOW. The previous art attempt was rejected because its
// detail frequency swallowed the gameplay tokens. So this mark is drawn ONLY in gold at 11-17%
// opacity against a near-black board, it is painted BEHIND every region and every token, it carries
// no animation at all, and it holds no fill anywhere except the 3px centre point. It is a ghost on
// the floor, not a picture. If it ever competes with a placed element, it is wrong · the token
// legibility check is the gate, not taste.
//
// r=90 is not arbitrary either: the region slabs reach 166 units from centres that sit 260 units
// from here, leaving ~100 units of clear floor, so the ray tips stop at 90 and never touch a slab.
//
// STROKE WIDTHS ARE SET BY THE PHONE, not by the desktop. The board scales to ~0.45 of user units at
// a 375px viewport, so the 1.4-1.6 widths this started with rendered at 0.6-0.7 CSS px · below one
// device pixel, where a line is drawn as a smear of partial coverage and the whole emblem dissolved
// into a faint smudge. Everything here is now 1.3-2.4 units, which lands at ~1px on a phone and stays
// delicate at 1280. Opacities came down slightly in exchange, so the total ink is roughly unchanged
// and the mark did not get louder on desktop in the process of becoming visible on mobile.

const GOLD = '200,148,64'
const g = (a) => `rgba(${GOLD},${a})`

// Logarithmic spiral, generated once at module load. Deterministic by construction · no Math.random
// anywhere in a rendered path (Rule 32), and a constant means the shape cannot drift between renders.
const SPIRAL_PATH = (() => {
  const pts = []
  const turns = 2.4
  for (let i = 0; i <= 90; i++) {
    const t = (i / 90) * turns * Math.PI * 2
    const rad = 0.020 * Math.exp(0.31 * t)      // reaches ~0.24 at the outer end
    pts.push([Math.cos(t - Math.PI / 2) * rad, Math.sin(t - Math.PI / 2) * rad])
  }
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(4)},${y.toFixed(4)}`).join('')
})()

// Nine rays, one pointing straight up so the emblem has an obvious vertical axis.
const RAYS = Array.from({ length: 9 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / 9
  return { x1: Math.cos(a) * 0.68, y1: Math.sin(a) * 0.68, x2: Math.cos(a) * 1.0, y2: Math.sin(a) * 1.0 }
})

// A four-pointed star drawn as a path in unit space · long vertical, short horizontal.
const STAR = 'M0,-1 Q0.16,-0.16 1,0 Q0.16,0.16 0,1 Q-0.16,0.16 -1,0 Q-0.16,-0.16 0,-1 Z'

/**
 * @param {number} cx  board centroid x, in SVG user units
 * @param {number} cy  board centroid y
 * @param {number} r   outer radius · the ray tips land here
 */
export default function CivilizationMark({ cx = 0, cy = 0, r = 90 }) {
  return (
    // pointerEvents none on the whole mark · it sits under the factories' invisible 70-unit hit
    // circles and must never intercept a placement click (the bot clicks the same nodes).
    <g
      data-testid="civilization-mark"
      transform={`translate(${cx},${cy})`}
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {/* Boundary · two rings rather than one, so the edge reads as an inscribed seal rather than a
          circle somebody forgot to fill. */}
      <circle r={r * 0.60} fill="none" stroke={g(0.16)} strokeWidth={2.9} />
      <circle r={r * 0.655} fill="none" stroke={g(0.09)} strokeWidth={1.9} />

      {/* The Nine */}
      {RAYS.map((ray, i) => (
        <line key={`ray-${i}`}
          x1={ray.x1 * r} y1={ray.y1 * r} x2={ray.x2 * r} y2={ray.y2 * r}
          stroke={g(0.12)} strokeWidth={3.2} strokeLinecap="round" />
      ))}

      {/* Pyramid · stroke only. A filled triangle at any opacity that reads on black would also read
          through the region platters behind it. */}
      <path
        d={`M0,${-r * 0.30} L${r * 0.32},${r * 0.28} L${-r * 0.32},${r * 0.28} Z`}
        fill="none" stroke={g(0.14)} strokeWidth={2.9} strokeLinejoin="round"
      />

      {/* Leaf base · two leaves meeting at the pyramid's foot. Quadratic curves both ways so each leaf
          closes into a proper lens shape rather than a crescent. */}
      <path
        d={`M0,${r * 0.28} Q${-r * 0.20},${r * 0.20} ${-r * 0.34},${r * 0.40}
            Q${-r * 0.14},${r * 0.44} 0,${r * 0.28} Z`}
        fill="none" stroke={g(0.13)} strokeWidth={2.5} strokeLinejoin="round"
      />
      <path
        d={`M0,${r * 0.28} Q${r * 0.20},${r * 0.20} ${r * 0.34},${r * 0.40}
            Q${r * 0.14},${r * 0.44} 0,${r * 0.28} Z`}
        fill="none" stroke={g(0.13)} strokeWidth={2.5} strokeLinejoin="round"
      />

      {/* Consciousness · the spiral is drawn in unit space and scaled here, so its stroke stays even. */}
      <g transform={`scale(${r})`}>
        <path d={SPIRAL_PATH} fill="none" stroke={g(0.14)} strokeWidth={0.030} strokeLinecap="round" />
      </g>

      {/* The star it is heading toward · at the pyramid's apex, above the spiral. */}
      <g transform={`translate(0,${-r * 0.40}) scale(${r * 0.085})`}>
        <path d={STAR} fill={g(0.20)} />
      </g>

      {/* Source · the only fill in the mark, and the only note above 20%. Small enough that it reads
          as a point of light rather than a dot of paint. */}
      <circle r={r * 0.10} fill={g(0.05)} />
      <circle r={r * 0.028} fill={g(0.55)} />
    </g>
  )
}
