// NeoTopia · bespoke element icons · the single source of truth for the four element marks.
// Shared by the board (HexCell · placed-element token) and card placeholders (CardFrame · pre-art).
// Each icon is pure SVG, centered at local 0,0: energy=bolt · biofarming=sprout · technology=gear/atom ·
// community=figure. The colored disc + a white mark. Extracted from HexCell's inline set (T1 S11).

// Raw shapes centered at 0,0 · for an SVG context where the caller positions/scales a wrapping <g>.
const ICON_SHAPES = {
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

// Plato's Myth of Metals · each element token IS a soul-metal made playable (PLATO_BOOKS · Pillar 1).
// Co-located with the marks themselves so the board, card frames and element picker all read ONE table
// (Rule 62 · never re-hardcode lore that can drift across surfaces). Keys match ICON_SHAPES (lowercase).
export const ELEMENT_SOUL_METAL = {
  technology: { metal: 'Gold',   virtue: 'Wisdom',      district: 'AetherNet' },
  energy:     { metal: 'Silver', virtue: 'Courage',     district: 'Free Energy' },
  biofarming: { metal: 'Bronze', virtue: 'Nourishment', district: 'Living Earth' },
  community:  { metal: 'Iron',   virtue: 'Community',    district: 'Source Temple' },
}

// "Technology · Gold · Wisdom · AetherNet" · the one hover label every element surface shares.
export function elementSoulMetalLabel(element) {
  const s = ELEMENT_SOUL_METAL[element]
  if (!s) return null
  const name = element.charAt(0).toUpperCase() + element.slice(1)
  return `${name} · ${s.metal} · ${s.virtue} · ${s.district}`
}

export const hasElementIcon = (element) => !!ICON_SHAPES[element]

// For an existing SVG context (HexCell): returns the raw shapes to drop inside a positioned <g>.
export function elementIconShapes(element, color, size) {
  return ICON_SHAPES[element] ? ICON_SHAPES[element](color, size) : null
}

// Standalone <svg> for non-SVG contexts (CardFrame placeholder, legends). viewBox is centered on 0,0.
export default function ElementIcon({ element, color, size = 40 }) {
  if (!ICON_SHAPES[element]) return null
  const soulLabel = elementSoulMetalLabel(element)
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden="true">
      {/* Soul-metal hover tooltip · native SVG <title> (PLATO_BOOKS · Pillar 1) */}
      {soulLabel && <title>{soulLabel}</title>}
      {ICON_SHAPES[element](color, size)}
    </svg>
  )
}
