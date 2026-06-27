// src/components/CardFrame.jsx
// NeoTopia ancient-esoteric card frame
// Wraps every project card illustration with sacred geometry borders
// Frame = ancient esoteric · Art inside = painterly solarpunk 2055
// The card feels like a tarot card from the future
//
// Usage:
//   <CardFrame card={card} size="hand" />   (hand panel · ~120px wide)
//   <CardFrame card={card} size="offer" />  (offer row · ~160px wide)
//   <CardFrame card={card} size="full" />   (scored/modal · ~240px wide)

import { useState } from 'react'
import ElementIcon from './Board/ElementIcon'

const ELEMENT_COLORS = {
  energy: { primary: '#E24B4A', secondary: '#c73b3a', glow: 'rgba(226,75,74,0.4)', symbol: '\u26A1', label: 'Sustainable Energy' },
  biofarming: { primary: '#1D9E75', secondary: '#16845f', glow: 'rgba(29,158,117,0.4)', symbol: '\u25C8', label: 'BioFarming' },
  technology: { primary: '#7F77DD', secondary: '#6b63c9', glow: 'rgba(127,119,221,0.4)', symbol: '\u25CE', label: 'Technology' },
  community: { primary: '#378ADD', secondary: '#2a70c5', glow: 'rgba(55,138,221,0.4)', symbol: '\u2736', label: 'Community' },
}

const CORNER_SYMBOLS = {
  energy: ['\u2609', '\u25B3', '\u2609', '\u25B3'],      // Sun + triangle
  biofarming: ['\u2663', '\u2022', '\u2663', '\u2022'],  // Trefoil + dot
  technology: ['\u2736', '\u25C6', '\u2736', '\u25C6'], // Star + diamond
  community: ['\u25CB', '\u2234', '\u25CB', '\u2234'],  // Circle + therefore
}

const POINT_VALUES = { 2: 'II', 3: 'III', 4: 'IIII', 5: 'IIIII' }

// ── Procedural sacred geometry · the placeholder shown until a pixel-art PNG loads ──
// Per the NeoTopia esoteric repository: Energy = Torus (Fohat · Orichalcum · self-sustaining flow) ·
// BioFarming = Seed of Life (7 circles · the Lemurian first pattern) · Technology = Metatron / Fruit of
// Life (13 circles + connecting structure · the blueprint of the Platonic solids) · Community = Flower of
// Life (the rosette template of all creation · Council of Nine). The repository BANS the hexagram /
// Star of David, so Metatron is drawn with spokes + hexagon edges only · never the long diagonals that
// form the six-pointed star. All subtle (low opacity · it is a placeholder, not the art).
const PROCEDURAL = new Set(['energy', 'biofarming', 'technology', 'community'])
const hasProceduralArt = (el) => PROCEDURAL.has(el)

function ringCenters(cx, cy, r, n, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = offset + (i * 2 * Math.PI) / n
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })
}

function ProceduralArt({ element, color, w, h }) {
  const cx = w / 2, cy = h / 2
  const u = Math.min(w, h)
  // Opacities tuned for visibility on the near-black #060612 art ground · delicate line-art, not invisible.
  const C = { fill: 'none', stroke: color, strokeWidth: Math.max(0.6, u * 0.014), strokeLinecap: 'round' }
  let shapes = null

  if (element === 'biofarming') {
    // Seed of Life · 7 circles · central + 6 around at distance R (radius R · the authentic overlap)
    const R = u * 0.15
    shapes = [[cx, cy], ...ringCenters(cx, cy, R, 6)].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={R} {...C} strokeOpacity={0.62} />
    ))
  } else if (element === 'community') {
    // Flower of Life · 13-circle rosette (seed 7 + outer 6) inside a containing circle
    const R = u * 0.13
    const petals = [[cx, cy], ...ringCenters(cx, cy, R, 6), ...ringCenters(cx, cy, 2 * R, 6)]
    shapes = [
      <circle key="bound" cx={cx} cy={cy} r={3 * R} {...C} strokeOpacity={0.45} />,
      ...petals.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={R} {...C} strokeOpacity={i < 7 ? 0.6 : 0.4} />),
    ]
  } else if (element === 'technology') {
    // Metatron / Fruit of Life · 13 circles + center spokes + inner hexagon edges (NO hexagram)
    const R = u * 0.085, d = u * 0.17
    const inner = ringCenters(cx, cy, d, 6)
    const all = [[cx, cy], ...inner, ...ringCenters(cx, cy, 2 * d, 6, Math.PI / 6)]
    const spokes = inner.map(([x, y], i) => <line key={`s${i}`} x1={cx} y1={cy} x2={x} y2={y} {...C} strokeOpacity={0.4} />)
    const edges = inner.map(([x, y], i) => {
      const [nx, ny] = inner[(i + 1) % 6]
      return <line key={`e${i}`} x1={x} y1={y} x2={nx} y2={ny} {...C} strokeOpacity={0.4} />
    })
    shapes = [...spokes, ...edges, ...all.map(([x, y], i) => <circle key={`c${i}`} cx={x} cy={y} r={R} {...C} strokeOpacity={0.6} />)]
  } else {
    // Energy · Torus · concentric rings + a flow ellipse + radiating poloidal spokes
    const R = u * 0.2
    shapes = [
      <circle key="o" cx={cx} cy={cy} r={R} {...C} strokeOpacity={0.62} />,
      <circle key="m" cx={cx} cy={cy} r={R * 0.62} {...C} strokeOpacity={0.5} />,
      <circle key="i" cx={cx} cy={cy} r={R * 0.24} {...C} strokeOpacity={0.7} />,
      <ellipse key="e" cx={cx} cy={cy} rx={R} ry={R * 0.42} {...C} strokeOpacity={0.4} />,
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3
        return <line key={`r${i}`}
          x1={cx + R * 0.24 * Math.cos(a)} y1={cy + R * 0.24 * Math.sin(a)}
          x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} {...C} strokeOpacity={0.4} />
      }),
    ]
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      {shapes}
    </svg>
  )
}

export default function CardFrame({ card, size = 'hand', onClick, isSelected = false, testid }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const el = card.element || 'community'
  const colors = ELEMENT_COLORS[el] || ELEMENT_COLORS.community
  const corners = CORNER_SYMBOLS[el] || CORNER_SYMBOLS.community

  const sizes = {
    hand: { width: 120, height: 168, fontSize: 9, titleSize: 10, artSize: 80, borderW: 2 },
    offer: { width: 152, height: 213, fontSize: 10, titleSize: 11, artSize: 105, borderW: 2.5 },
    full: { width: 220, height: 308, fontSize: 12, titleSize: 13, artSize: 155, borderW: 3 },
  }
  const s = sizes[size] || sizes.hand

  const artUrl = `/art/cards/${card.id}.png`

  return (
    <div
      className="project-card"
      data-testid={testid}
      onClick={onClick}
      style={{
        width: s.width,
        height: s.height,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        borderRadius: 6,
        // Outer glow on selected or hover
        boxShadow: isSelected ? `0 0 0 2px ${colors.primary}, 0 0 16px ${colors.glow}` : 'none',
        transition: 'box-shadow 0.2s',
      }}
    >
      <svg
        width={s.width}
        height={s.height}
        viewBox={`0 0 ${s.width} ${s.height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
      >
        {/* Card background - dark parchment / obsidian */}
        <rect x="0" y="0" width={s.width} height={s.height} rx="6" fill="#0d0d18" />

        {/* Outer border - element color, slightly worn */}
        <rect
          x={s.borderW/2} y={s.borderW/2}
          width={s.width - s.borderW} height={s.height - s.borderW}
          rx="5" fill="none"
          stroke={colors.primary} strokeWidth={s.borderW} strokeOpacity="0.7"
        />

        {/* Inner frame line */}
        <rect
          x={s.borderW + 3} y={s.borderW + 3}
          width={s.width - (s.borderW + 3) * 2} height={s.height - (s.borderW + 3) * 2}
          rx="3" fill="none"
          stroke={colors.secondary} strokeWidth="0.5" strokeOpacity="0.4"
        />

        {/* Top header area */}
        <rect x={s.borderW + 3} y={s.borderW + 3} width={s.width - (s.borderW + 3) * 2} height={s.fontSize + 10}
          rx="2" fill={colors.primary} fillOpacity="0.15"
        />

        {/* Card name */}
        <text
          x={s.width / 2}
          y={s.borderW + 3 + s.fontSize + 4}
          textAnchor="middle"
          fill={colors.primary}
          fontSize={s.titleSize}
          fontFamily="serif"
          letterSpacing="0.5"
        >
          {card.name || card.id}
        </text>

        {/* Corner symbols - ancient rune feel */}
        {[
          [s.borderW + 7, s.borderW + s.fontSize + 18],
          [s.width - s.borderW - 13, s.borderW + s.fontSize + 18],
          [s.borderW + 7, s.height - s.borderW - 12],
          [s.width - s.borderW - 13, s.height - s.borderW - 12],
        ].map((pos, i) => (
          <text
            key={i}
            x={pos[0]} y={pos[1]}
            fill={colors.secondary} fillOpacity="0.5"
            fontSize={s.fontSize - 1}
            fontFamily="serif"
          >
            {corners[i]}
          </text>
        ))}

        {/* Art frame border */}
        <rect
          x={s.borderW + 6}
          y={s.borderW + s.fontSize + 14}
          width={s.width - (s.borderW + 6) * 2}
          height={s.artSize}
          rx="2"
          fill="#060612"
          stroke={colors.secondary}
          strokeWidth="0.5"
          strokeOpacity="0.5"
        />

        {/* Sacred geometry overlay on art - subtle */}
        <circle
          cx={s.width / 2}
          cy={s.borderW + s.fontSize + 14 + s.artSize / 2}
          r={s.artSize * 0.42}
          fill="none"
          stroke={colors.primary}
          strokeWidth="0.3"
          strokeOpacity="0.2"
        />
        <circle
          cx={s.width / 2}
          cy={s.borderW + s.fontSize + 14 + s.artSize / 2}
          r={s.artSize * 0.28}
          fill="none"
          stroke={colors.primary}
          strokeWidth="0.3"
          strokeOpacity="0.15"
        />

        {/* Element type bar below art */}
        <rect
          x={s.borderW + 6}
          y={s.borderW + s.fontSize + 14 + s.artSize + 2}
          width={s.width - (s.borderW + 6) * 2}
          height={s.fontSize + 6}
          rx="1"
          fill={colors.primary}
          fillOpacity="0.12"
        />
        <text
          x={s.width / 2}
          y={s.borderW + s.fontSize + 14 + s.artSize + 2 + s.fontSize + 1}
          textAnchor="middle"
          fill={colors.secondary}
          fillOpacity="0.7"
          fontSize={s.fontSize - 1}
          fontFamily="serif"
          letterSpacing="1"
        >
          {colors.symbol} {colors.label.toUpperCase()}
        </text>

        {/* Card description / category */}
        {card.category && (
          <text
            x={s.width / 2}
            y={s.borderW + s.fontSize + 14 + s.artSize + s.fontSize + 16}
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize={s.fontSize - 2}
            fontFamily="serif"
            letterSpacing="0.5"
          >
            {card.category}
          </text>
        )}

        {/* Point value - Roman numeral bottom right */}
        <text
          x={s.width - s.borderW - 8}
          y={s.height - s.borderW - 6}
          textAnchor="end"
          fill={colors.primary}
          fillOpacity="0.8"
          fontSize={s.fontSize + 1}
          fontFamily="serif"
          fontWeight="bold"
        >
          {POINT_VALUES[card.points] || card.points || ''}
        </text>

        {/* Decorative horizontal rule above description */}
        <line
          x1={s.borderW + 10}
          x2={s.width - s.borderW - 10}
          y1={s.height - s.borderW - 22}
          y2={s.height - s.borderW - 22}
          stroke={colors.secondary}
          strokeWidth="0.4"
          strokeOpacity="0.3"
        />

        {/* Central sacred mark - top center */}
        <text
          x={s.width / 2}
          y={s.height - s.borderW - 7}
          textAnchor="middle"
          fill={colors.secondary}
          fillOpacity="0.35"
          fontSize={s.fontSize - 2}
          fontFamily="serif"
        >
          {'\u25C6 NEOTOPIA 2055 \u25C6'}
        </text>
      </svg>

      {/* Art image inside the frame */}
      {!imgError && (
        <img
          src={artUrl}
          alt={card.name}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            position: 'absolute',
            left: s.borderW + 6,
            top: s.borderW + s.fontSize + 14,
            width: s.width - (s.borderW + 6) * 2,
            height: s.artSize,
            objectFit: 'cover',
            borderRadius: 2,
            zIndex: 3, // above the frame SVG's #060612 art backdrop (zIndex 2) so the art is actually visible
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />
      )}

      {/* Placeholder when no art yet · element-specific procedural sacred geometry + a small id caption.
          The id stays so Mahil knows which card to generate next; it fades out under the real PNG. The
          art-skeleton class adds a slow opacity breath (signals "art loading", not "art broken" · T1 S17 D). */}
      {(imgError || !imgLoaded) && (
        <div className="art-skeleton" style={{
          position: 'absolute',
          left: s.borderW + 6,
          top: s.borderW + s.fontSize + 14,
          width: s.width - (s.borderW + 6) * 2,
          height: s.artSize,
          zIndex: 3, // above the frame SVG's #060612 art backdrop (zIndex 2) so the geometry is visible
          overflow: 'hidden',
        }}>
          {hasProceduralArt(el)
            ? <ProceduralArt element={el} color={colors.primary} w={s.width - (s.borderW + 6) * 2} h={s.artSize} />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, lineHeight: 0 }}>
                <ElementIcon element={el} color={colors.primary} size={s.fontSize + 24} />
              </div>}
          <div style={{
            position: 'absolute', bottom: 3, left: 0, right: 0,
            fontSize: 8, color: colors.secondary, opacity: 0.45, fontFamily: 'serif',
            textAlign: 'center', letterSpacing: 0.3, padding: '0 4px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {card.id}
          </div>
        </div>
      )}
    </div>
  )
}
