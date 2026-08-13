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

import { useState, useRef } from 'react'
import ElementIcon from './Board/ElementIcon'
import { toRomanNumeral } from '../utils/romanNumeral'
import { formatMoney } from '../utils/formatMoney'

// `label` is what the element-type bar prints under the art. It must be the SAME word the rest of the
// game uses \u00B7 'Sustainable Energy' was the odd one out (every other surface says 'Energy') and at hand
// size it measured 121.5u inside a 120u frame, so it ran off both edges of every Energy card.
const ELEMENT_COLORS = {
  energy: { primary: '#E24B4A', secondary: '#c73b3a', glow: 'rgba(226,75,74,0.4)', symbol: '\u26A1', label: 'Energy' },
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

// ── THE ART SLOT IS A CONTRACT WITH THE FILESYSTEM, SO IT IS EXPORTED (T1 S42) ──────────────────
// The masters are square and the slot is not, so objectFit:cover crops. MEASURED rather than
// argued: a 320x320 master into the 104x80 hand slot draws at 104x104 and shows 104x80, discarding
// 23.1% OF THE AREA · 12px off the top and 12px off the bottom.
//
// AND THAT SOUNDS MUCH WORSE THAN IT IS, which is why it was worth measuring the right quantity
// (Rule 81c · an eyeball reading of an image is a hypothesis). Sampling all 20 PNGs in a browser
// canvas, taking each file's own corner as its background and counting pixels that differ from it,
// the two discarded bands hold a MEDIAN OF 2.1% OF THE CARD'S INK · min 0.0, max 10.9 (card_15),
// against a kept-centre ink density of 25-64%. The art is centre-composed, so cover is discarding
// background. 23.1% of the area is 2.1% of the picture, and those are very different numbers to
// make a decision on: this does not justify regenerating 56 masters or growing the card.
//
// WHAT IT DOES JUSTIFY IS A GATE, because that conclusion rests entirely on the masters being
// SQUARE and centre-composed, and 36 of the 56 cards have no art yet. A 16:9 master dropped into
// this slot would lose 42% of its area with nothing going red. CardFrame.assets.test.js reads these
// numbers rather than retyping them, so the two sides of that check are genuinely two (Rule 92).
export const CARD_SIZES = {
  hand: { width: 120, height: 168, fontSize: 9, titleSize: 10, artSize: 80, borderW: 2 },
  offer: { width: 152, height: 213, fontSize: 10, titleSize: 11, artSize: 105, borderW: 2.5 },
  full: { width: 220, height: 308, fontSize: 12, titleSize: 13, artSize: 155, borderW: 3 },
}

// The art box for a given size, in css px · exactly what the <img> and the placeholder are given.
export const artSlot = (size = 'hand') => {
  const s = CARD_SIZES[size] || CARD_SIZES.hand
  return { width: s.width - (s.borderW + 6) * 2, height: s.artSize }
}

// ── A CARD THAT CAN BE ACTED ON IS A CONTROL, AND IT DERIVES THAT FROM ONE PLACE (T1 S59) ────────
// `cursor: pointer` was already derived from the presence of `onClick`, and it was the ONLY thing
// that was. So a card the player can act on advertised itself on a channel a touch device does not
// have, and carried no role, no name and no tab stop · measured on the real GameRoom at scorePending,
// the scoreable card's entire attribute list was class / data-testid / style.
//
// Role, tab stop, keyboard activation and accessible name now come from the SAME prop the cursor
// does. That is deliberate: two derivations of "is this interactive" is a second contract (Rule 45),
// and this is the exact seam where it would drift · a caller who passes a handler and forgets a flag
// would get a control that looks clickable and is unreachable, which is Rule 78 with extra steps.
//
// Enter fires on keydown and Space on keyUP, which is what a native <button> does. Space is the one
// that matters: held down it auto-repeats, and on the Offer that is a second draw. preventDefault on
// its keydown also stops the page scrolling under the player.
export default function CardFrame({ card, size = 'hand', onClick, isSelected = false, testid,
  innerRef = null, actionLabel = null,
  // {placed, total} when this card is ONE legal placement from completing somewhere on the
  // board, else null. Computed by GameRoom from usePatternHighlight · NEVER derived here, and
  // the reason is Rule 45: a second near-miss engine would drift from the board's rings, and the
  // whole point of this badge is that it says the same thing the rings do.
  nearMiss = null,
  // What this card COSTS, in whole dollars, or null when nothing is for sale (T1 S67). Supplied by
  // GameRoom from the engine's own priceOf() · never computed here, for the same Rule 45 reason as
  // nearMiss above: a second pricing rule would diverge from what tryDrawCard actually charges, and
  // a price that lies is worse than no price at all.
  price = null }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const el = card.element || 'community'
  const colors = ELEMENT_COLORS[el] || ELEMENT_COLORS.community
  const corners = CORNER_SYMBOLS[el] || CORNER_SYMBOLS.community

  const s = CARD_SIZES[size] || CARD_SIZES.hand

  const artUrl = `/art/cards/${card.id}.png`

  const interactive = typeof onClick === 'function'
  const spaceHeld = useRef(false)
  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onClick(e) }
    // Swallow Space's page-scroll here and remember it, so a keyup that began somewhere else cannot
    // activate a card the player never pressed.
    else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); spaceHeld.current = true }
  }
  const onKeyUp = (e) => {
    if ((e.key === ' ' || e.key === 'Spacebar') && spaceHeld.current) { spaceHeld.current = false; onClick(e) }
  }

  return (
    <div
      ref={innerRef}
      className="project-card"
      data-testid={testid}
      onClick={onClick}
      {...(interactive ? {
        role: 'button',
        tabIndex: 0,
        // The accessible name is the ACTION, not the card face. Without it the name is whatever the
        // frame SVG concatenates to · measured live: "Copper Arc Substation☉△☉△⚡ ENERGYII◆ NEO…",
        // corner runes and a Roman numeral included.
        'aria-label': actionLabel || card.name || card.id,
        onKeyDown, onKeyUp,
      } : {})}
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

        {/* Corner symbols - ancient rune feel.
            The two BOTTOM glyphs sit ABOVE the horizontal rule, not level with the footer. They used to
            share the footer band with the point numeral and overlapped it on every card measured (7/7,
            all four elements) · a decorative glyph was sitting on top of the one number a player has to
            read to choose a card. The rule now separates frame decoration from card information. */}
        {[
          [s.borderW + 7, s.borderW + s.fontSize + 18],
          [s.width - s.borderW - 13, s.borderW + s.fontSize + 18],
          [s.borderW + 7, s.height - s.borderW - 26],
          [s.width - s.borderW - 13, s.height - s.borderW - 26],
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

        {/* ── HOW CLOSE IS THIS CARD (T1 S66 · Council, on Sophia's reframe) ────────────────────
            T2 measured 5-point cards building at 9.2% of acquired and found the lever is element
            SUPPLY; Council declined that lever because tile count is the denominator under every
            measurement in the project. The ruling instead: "the defect is not the rate, it is that
            a player cannot see the distance." A 5-pointer that says 4 OF 5 is an achievement in
            progress; the same card silent is a tease.
            THE INFORMATION WAS ALREADY ON THE BOARD AND NOT ON THE CARD · the amber near-miss ring
            is exactly this distance, rendered where a player deciding what to CHASE is not looking.
            So this is a relocation, not a new claim, and it reuses the board's own amber so the two
            surfaces teach one colour rather than two.
            IT SITS IN THE `category` SLOT, which is free: 0 of 56 cards carry a category, so that
            branch has never rendered. Measured rather than assumed · the footer band below is
            occupied (the Roman numeral ends at x110 and NEOTOPIA 2055 runs x28.1-91.9 of 120),
            which is why the badge is here and not down there. */}
        {nearMiss && (
          <text
            data-near-miss={`${nearMiss.placed}/${nearMiss.total}`}
            x={s.width / 2}
            y={s.borderW + s.fontSize + 14 + s.artSize + s.fontSize + 16}
            textAnchor="middle"
            fill="rgba(255,180,50,0.95)"
            fontSize={s.fontSize - 1}
            fontFamily="serif"
            fontWeight="bold"
            letterSpacing="0.8"
          >
            {`${nearMiss.placed} OF ${nearMiss.total} PLACED`}
          </text>
        )}

        {/* ── WHAT IT COSTS (T1 S67) · THE SAME SLOT, AND THAT IS SAFE BY CONSTRUCTION ───────────
            A price and a near-miss distance cannot both be true of one card: near-miss is a fact
            about a card you HOLD and a price is a fact about a card you have NOT bought. GameRoom
            passes nearMiss only to the hand and price only to the Offer, and that disjointness is
            GATED (GameRoom.wallet.test.jsx) rather than left as "safe because nobody passes it" ·
            which is exactly the shape I named as the improvement owed on S66's badge.
            The `nearMiss &&` guard here is the belt: if both ever arrive, one renders instead of
            two texts painting over each other, and the gate is what tells you it happened.
            Measured in situ, not counted from characters: '$70M' is 20.7px at this size in a 120px
            card, against a 69.4px title and a 76.5px element band. The card is not the constraint;
            the action bar is. */}
        {!nearMiss && price != null && (
          <text
            data-card-price={price}
            x={s.width / 2}
            y={s.borderW + s.fontSize + 14 + s.artSize + s.fontSize + 16}
            textAnchor="middle"
            fill="rgba(200,148,64,0.95)"
            fontSize={s.fontSize - 1}
            fontFamily="serif"
            fontWeight="bold"
            letterSpacing="0.8"
          >
            {formatMoney(price)}
          </text>
        )}

        {/* Point value - Roman numeral bottom right (src/utils/romanNumeral.js · total, so a future
            point value cannot fall back to an Arabic digit sitting next to Roman ones) */}
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
          {toRomanNumeral(card.points)}
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

      {/* Art image inside the frame · fades in over the shimmering placeholder when the PNG loads (art-reveal).
          The opacity flip is stateful (stays inline); the 0.4s transition + its prefers-reduced-motion guard live
          in index.css so the reveal honors reduced-motion like every other animation (T1 S18 Task D). */}
      {!imgError && (
        <img
          src={artUrl}
          alt={card.name}
          className="art-reveal"
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
          }}
        />
      )}

      {/* Placeholder when no art yet · element-specific procedural sacred geometry. The art-skeleton class
          adds a slow opacity breath (signals "art loading", not "art broken" · T1 S17 D).
          The card's own id used to be captioned here so Mahil could see which PNG to generate next. It is
          a database key, and 36 of the 56 cards still have no art, so in production it was a developer
          breadcrumb printed across a third of the deck. It is now DEV-only (same gate as the
          window.__neotopia_store hook in GameRoom): the affordance survives where it is used, and a player
          sees the card's NAME · which the frame already prints along its top edge · and nothing else. */}
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
          {import.meta.env.DEV && (
            <div data-testid="card-id-dev" style={{
              position: 'absolute', bottom: 3, left: 0, right: 0,
              fontSize: 8, color: colors.secondary, opacity: 0.45, fontFamily: 'serif',
              textAlign: 'center', letterSpacing: 0.3, padding: '0 4px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {card.id}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
