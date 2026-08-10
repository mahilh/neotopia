import { memo, useLayoutEffect, useRef, useState } from 'react'

// Left-of-board action log · the game's shared memory (colonist UX · T1 S15). Both players see what
// just happened. Entries fade with age (older turns dim toward 0.12) and it never blocks board
// interaction (pointerEvents: none).
//
// ── IT MAY HAVE THE GUTTER. IT MAY NOT HAVE THE BOARD. (T1 S39) ─────────────────────────────────
// Rule 83, applied before the fix: what was paying for this overlay? The board · which is the game.
// This is `position: absolute` over the board area rather than in the flow, so it never pushed
// anything; it COVERED it. Enumerated in a real browser at an 800px height, counting how many of the
// 57 play cells have their centre underneath it:
//
//     480  12 cells + the WATER label        900  12 cells
//     520  12 cells                         1000   7 cells
//     620  31 CELLS · the worst case        1100   3 cells
//     700  22 cells                         1280   0 · clear from here up
//     768  16 cells                         1440   0
//
// So the damage was never 480-600 (where it was reported from a screenshot): it runs 480 to ~1200,
// it is worst at 620 with 54% OF THE BOARD COVERED, and it is clean only at 1280 and above. 620 is
// the peak because that is just past the 600px breakpoint where the sidebar becomes a 288px column
// again, so the board collapses to 300px wide while this overlay goes on claiming its fixed 176.
//
// And `pointerEvents: none` made it worse rather than better: the cells underneath stayed CLICKABLE
// while being invisible. A player could place into, and score, hexes they could not see · which is
// Rule 78 inverted. Reachable but not perceivable.
//
// THE RULE, and it is a measurement rather than a breakpoint: this overlay may use the LETTERBOX to
// the left of the drawn board, and only that. The board's aspect is fixed, so the gutter is
// (container - drawn)/2 and it is knowable exactly. Below 1280 there is no such gutter, so the log
// does not render there. That is a real loss and it is stated in the handoff rather than hidden ·
// the follow-up is to move it into the bottom letterbox, which the same measurement shows DOES
// exist at exactly the widths where the left one does not (173px at 620, against 6px at 1440).
const MAX_ENTRIES = 10
const LEFT = 8
const WIDTH = 168
const GUTTER_NEEDED = LEFT + WIDTH + LEFT // the log, its offset, and the same margin again on its right

function ActionLog({ entries = [] }) {
  const ref = useRef(null)
  // Defaults to TRUE, deliberately: when nothing can be measured (jsdom has no layout, and the
  // observer is absent there) the component must behave exactly as it did before rather than
  // disappear on a null reading. Only a real measurement is allowed to hide it.
  const [hasGutter, setHasGutter] = useState(true)

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
      if (!pr.width || !sr.width || vb.length !== 4 || !vb[2]) return
      // preserveAspectRatio="xMidYMid meet" · the DRAWN board is the viewBox scaled to fit, centred,
      // so the letterbox is split evenly and the left gutter is half the difference.
      const scale = Math.min(sr.width / vb[2], sr.height / vb[3])
      const gutter = (pr.width - vb[2] * scale) / 2
      setHasGutter(gutter >= GUTTER_NEEDED)
    }

    compute()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(compute)
    ro.observe(parent)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [])

  const currentTurn = entries[entries.length - 1]?.turn ?? 0
  const visible = entries.slice(-MAX_ENTRIES) // oldest → newest of the last 10

  return (
    <div
      ref={ref}
      className="action-log-wrap"
      data-has-gutter={hasGutter ? 'true' : 'false'}
      style={{
        position: 'absolute', left: LEFT, top: 8, bottom: 8,
        width: WIDTH, pointerEvents: 'none', zIndex: 5,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        gap: 4, overflow: 'hidden',
        // Hidden rather than unmounted: the element has to stay in the tree for its own
        // ResizeObserver to keep watching, or it could never come back when the window widens.
        visibility: hasGutter ? 'visible' : 'hidden',
      }}
    >
      {visible.map((entry) => {
        const age = currentTurn - entry.turn
        const opacity = Math.max(0.12, 1 - age * 0.12) // newest full · fades ~12% per turn of age
        return (
          <div key={entry.id} style={{
            fontSize: 11, fontFamily: 'serif', letterSpacing: 0.4, lineHeight: 1.3,
            color: entry.color ?? 'rgba(255,255,255,0.6)',
            opacity, transition: 'opacity 0.4s ease',
          }}>
            {entry.text}
          </div>
        )
      })}
    </div>
  )
}

export default memo(ActionLog)
