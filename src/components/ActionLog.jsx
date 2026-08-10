import { Fragment, memo, useLayoutEffect, useRef, useState } from 'react'

// The action log · the game's shared memory (colonist UX · T1 S15). Both players see what just
// happened. Entries fade with age (older turns dim toward 0.12) and it never blocks board
// interaction (pointerEvents: none).
//
// ── IT MAY HAVE A LETTERBOX. IT MAY NOT HAVE THE BOARD. (T1 S39, extended S40) ──────────────────
// Rule 83, applied before the S39 fix: what was paying for this overlay? The board · which is the
// game. It is `position: absolute` over the board area rather than in the flow, so it never pushed
// anything; it COVERED it. Enumerated in a real browser, counting how many of the 57 play cells had
// their centre underneath it: 12 at 480, 16 at 768, 12 at 900, and 31 · 54% OF THE BOARD · at 620,
// which is twenty pixels outside the 480-600 band it had been reported in for three sessions
// (Rule 87). `pointerEvents: none` made that worse rather than safer: the covered cells stayed
// CLICKABLE while invisible, so a player could place into and score hexes they could not see.
//
// S39 confined it to the LEFT letterbox and hid it everywhere else, which cost the log on every
// screen below 1280. This is the other half, and it comes from the same sweep: THE TWO LETTERBOXES
// ARE COMPLEMENTARY. Measured across fifteen widths at an 800px height:
//
//     width  side  bottom          width  side  bottom          width  side  bottom
//       320  16.0    22.4            600 136.5    16.0           1100  96.2    16.0
//       375  33.3    16.0            620  16.0   150.1           1200 146.2    16.0
//       480  80.5    16.0            768  16.0   105.7           1280 186.2    16.0
//       540 106.5    16.0            900  16.0    36.7           1440 266.2    16.0
//
// 16 is the container's own padding, i.e. NO slack. The bottom band exists at 620-900 and the side
// band at 600 and 1200+, and they never both collapse except below 600 and at 1000-1100. That is
// not luck: a fixed-aspect board in a variable-aspect container spends its spare space in exactly
// one direction, and which one flips at the 600px breakpoint where the sidebar stops stacking and
// becomes a 288px column again. Discontinuities are where the maxima live, in both directions.
//
// SO THE RULE IS A MEASUREMENT, NOT A BREAKPOINT: take the side letterbox when it can hold a
// legible column, else the bottom letterbox when it can hold one line, else render nothing. Both
// are derived from the live rects every time they change, so the log can never sit over a cell.
const MAX_ENTRIES = 10       // the column shows this many
const MAX_BOTTOM_ENTRIES = 3 // the strip shows this many, newest last, older ones clipped left
const MARGIN = 8

// WIDTH_MIN IS MEASURED, NOT CHOSEN (Rule 81 · compute the constraint). Rendering every string the
// log can actually produce at 11px serif / 0.4 letter-spacing: the longest is "scored Consciousness
// Broadcast Tower: +12" at 212.9px natural, then "drew Consciousness Broadcast Tower" at 180.4 and
// "placed Technology in Living Earth" at 166.2. Wrapped, the line counts go
//     168px → 1-2 lines    130px → 1-2    120px → 1-2    104px → 1-4    88px → 2-4
// so 120 is the narrowest column at which NOTHING exceeds two lines · one pixel under it and the
// longest entry becomes a four-line paragraph. That is the floor, and it comes from the strings
// rather than from taste.
const WIDTH_MAX = 168
const WIDTH_MIN = 120
// One 11px line at line-height 1.3 is 14.3px; 24 gives it ~5px above and below. BOTTOM_CLEAR keeps
// the strip off the board's bottom edge so the two never touch even when the band is exactly full.
const ROW_H = 24
const BOTTOM_CLEAR = 4

function ActionLog({ entries = [] }) {
  const ref = useRef(null)
  // Defaults to the full side column · the pre-S39 behaviour. When nothing can be measured (jsdom
  // has no layout) the component must reproduce what it always did rather than delete itself on a
  // null reading. Only a real measurement is allowed to move or hide it, and below 480px the
  // stylesheet is a second backstop (see index.css) rather than the mechanism.
  const [layout, setLayout] = useState({ mode: 'side', width: WIDTH_MAX })

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    const svg = parent?.querySelector('svg[role="img"]')
    if (!parent || !svg) return

    const compute = () => {
      const pr = parent.getBoundingClientRect()
      const sr = svg.getBoundingClientRect()
      const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number)
      // No layout to read · leave the current answer alone rather than invent one.
      if (!pr.width || !sr.width || vb.length !== 4 || !vb[2] || !vb[3]) return
      // preserveAspectRatio="xMidYMid meet" · the DRAWN board is the viewBox scaled to fit and
      // centred, so each letterbox is half the difference on its own axis. An absolutely positioned
      // child is placed against the PADDING box, which is the same box these rects describe, so
      // these two numbers are directly the space this overlay is allowed to occupy.
      const scale = Math.min(sr.width / vb[2], sr.height / vb[3])
      const sideGutter = (pr.width - vb[2] * scale) / 2
      const bottomGutter = (pr.height - vb[3] * scale) / 2

      const sideW = Math.min(WIDTH_MAX, Math.floor(sideGutter) - 2 * MARGIN)
      if (sideW >= WIDTH_MIN) setLayout({ mode: 'side', width: sideW })
      else if (bottomGutter - BOTTOM_CLEAR >= ROW_H) setLayout({ mode: 'bottom', width: 0 })
      else setLayout({ mode: 'none', width: 0 })
    }

    compute()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(compute)
    ro.observe(parent)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [])

  const { mode, width } = layout
  const bottom = mode === 'bottom'
  const currentTurn = entries[entries.length - 1]?.turn ?? 0
  // Oldest → newest either way. In the column the newest sits at the bottom; in the strip it sits at
  // the right, and justifyContent flex-end means the OLDEST is what gets clipped when the row runs
  // out of room. Same promise in both: whatever else goes, the latest event is on screen.
  const visible = entries.slice(bottom ? -MAX_BOTTOM_ENTRIES : -MAX_ENTRIES)

  const box = bottom
    ? {
        left: MARGIN, right: MARGIN, bottom: 0, height: ROW_H,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        // The clipped end reads as "there is more" rather than as a broken glyph.
        maskImage: 'linear-gradient(to right, transparent 0, black 28px)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 28px)',
      }
    : {
        left: MARGIN, top: MARGIN, bottom: MARGIN, width,
        flexDirection: 'column', justifyContent: 'flex-end', gap: 4,
      }

  return (
    <div
      ref={ref}
      className="action-log-wrap"
      data-log-mode={mode}
      style={{
        position: 'absolute', pointerEvents: 'none', zIndex: 5,
        display: 'flex', overflow: 'hidden', ...box,
        // Hidden rather than unmounted: the element has to stay in the tree for its own
        // ResizeObserver to keep watching, or it could never come back when the window changes.
        visibility: mode === 'none' ? 'hidden' : 'visible',
      }}
    >
      {visible.map((entry, i) => {
        const age = currentTurn - entry.turn
        const opacity = Math.max(0.12, 1 - age * 0.12) // newest full · fades ~12% per turn of age
        const line = (
          <div key={entry.id} style={{
            fontSize: 11, fontFamily: 'serif', letterSpacing: 0.4, lineHeight: 1.3,
            color: entry.color ?? 'rgba(255,255,255,0.6)',
            opacity, transition: 'opacity 0.4s ease',
            ...(bottom ? { whiteSpace: 'nowrap', flexShrink: 0 } : null),
          }}>
            {entry.text}
          </div>
        )
        if (!bottom) return line
        return (
          <Fragment key={entry.id}>
            {i > 0 && <span aria-hidden="true" style={{
              fontSize: 11, lineHeight: 1.3, flexShrink: 0, color: 'rgba(255,255,255,0.28)',
            }}>·</span>}
            {line}
          </Fragment>
        )
      })}
    </div>
  )
}

export default memo(ActionLog)
