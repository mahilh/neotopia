import { describe, it, expect } from 'vitest'
import { SEAT_COLORS } from './Lobby'
import { SEAT_COLORS as DB_SEAT_COLORS } from '../hooks/useGameRoom'

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// Seat 3 moved from purple to gold this session because the live CHECK on room_players.player_color
// only accepts blue/gold/green/red. The thing worth guarding is not the hex, it is the PROPERTY the
// hex was chosen for: four players have to be tellable apart at a glance.
//
// The intended evidence was a screenshot of a four-player roster. That needs four live anonymous
// sessions and the anon sign-in budget is spent, so this is the deterministic form of the same claim
// (Rule 31). It also outlives a screenshot: a future palette edit that quietly makes two seats similar
// goes red here, which no image in a scratchpad would ever do.

// CIE76. Crude next to CIEDE2000 but directionally right and dependency-free · and the threshold below
// is set well clear of the noise, so the extra precision would not change any verdict.
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
function lab(hex) {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16)))
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
const dE = (a, b) => {
  const [A, B] = [lab(a), lab(b)]
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])
}

// Below roughly this, two swatches start reading as one colour under different lighting. The purple
// that seat 3 used to be scored exactly 25 against seat 0's blue · the weakest pair on the board, and
// the reason this threshold is set where it is rather than at some rounder number.
const MIN_SEPARATION = 30

describe('Lobby seat colours', () => {
  it('has one colour per seat', () => {
    expect(SEAT_COLORS).toHaveLength(4)
    for (const c of SEAT_COLORS) expect(c, `${c} is not a 6-digit hex`).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('keeps every pair of seats distinguishable at a glance', () => {
    const failures = []
    for (let i = 0; i < SEAT_COLORS.length; i++) {
      for (let j = i + 1; j < SEAT_COLORS.length; j++) {
        const d = dE(SEAT_COLORS[i], SEAT_COLORS[j])
        if (d < MIN_SEPARATION) failures.push(`seat ${i} (${SEAT_COLORS[i]}) vs seat ${j} (${SEAT_COLORS[j]}): dE ${d.toFixed(0)}`)
      }
    }
    expect(failures, `these seat pairs are too close to tell apart:\n  ${failures.join('\n  ')}`).toEqual([])
  })

  it('paints as many colours as there are seats the database will accept', () => {
    // The palette here and the colour NAMES written to room_players are two lists describing one idea
    // (Rule 45). They cannot be compared by value · one is hex, the other is words · but their LENGTH
    // is a real shared contract, and a fifth seat added to one and not the other is exactly the kind of
    // drift that produced the 4-player outage in the first place.
    expect(SEAT_COLORS.length).toBe(DB_SEAT_COLORS.length)
  })

  it('gives seat 3 the gold the rest of the interface already uses', () => {
    // #C89440 is the room code, the invite button, the winner line and the milestone glyph. Seat 3
    // reusing it is what keeps "gold" in the database describing something a player can actually see.
    expect(SEAT_COLORS[3].toUpperCase()).toBe('#C89440')
    expect(DB_SEAT_COLORS[3]).toBe('gold')
  })
})
