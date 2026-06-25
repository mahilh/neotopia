import { describe, it, expect } from 'vitest'
import {
  hexToPixel,
  pixelToHex,
  hexCorners,
  hexNeighbors,
  hexDistance,
  hexesInRadius,
  hexRotate60CCW,
  patternRotations,
  normalizePattern,
  REGIONS,
  FACTORIES,
  HEX_SIZE,
} from './hexUtils'

describe('hexesInRadius', () => {
  it('returns 1/7/19 for radius 0/1/2 (centered hex counts)', () => {
    expect(hexesInRadius(0, 0, 0)).toHaveLength(1)
    expect(hexesInRadius(0, 0, 1)).toHaveLength(7)
    expect(hexesInRadius(0, 0, 2)).toHaveLength(19)
  })
  it('offsets every hex by the center', () => {
    const hexes = hexesInRadius(8, -4, 2)
    expect(hexes).toContainEqual({ q: 8, r: -4 })
    expect(hexes.every(h => hexDistance({ q: 8, r: -4 }, h) <= 2)).toBe(true)
  })
})

describe('hexDistance', () => {
  it('is zero to self', () => {
    expect(hexDistance({ q: 3, r: -1 }, { q: 3, r: -1 })).toBe(0)
  })
  it('matches cube distance', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2)
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 3 })).toBe(3)
  })
})

describe('hexToPixel / pixelToHex round-trip', () => {
  it('recovers the exact hex from its pixel center', () => {
    for (const h of hexesInRadius(0, 0, 4)) {
      const { x, y } = hexToPixel(h.q, h.r)
      expect(pixelToHex(x, y)).toEqual({ q: h.q, r: h.r })
    }
  })
  it('places origin at pixel (0,0)', () => {
    expect(hexToPixel(0, 0)).toEqual({ x: 0, y: 0 })
  })
})

describe('hexCorners', () => {
  it('returns 6 corners, each at HEX_SIZE from the center', () => {
    const corners = hexCorners(0, 0)
    expect(corners).toHaveLength(6)
    for (const c of corners) {
      expect(Math.hypot(c.x, c.y)).toBeCloseTo(HEX_SIZE, 6)
    }
  })
})

describe('hexNeighbors', () => {
  it('returns 6 distinct neighbors, all at distance 1', () => {
    const n = hexNeighbors(2, -1)
    expect(n).toHaveLength(6)
    for (const h of n) expect(hexDistance({ q: 2, r: -1 }, h)).toBe(1)
  })
})

describe('rotation symmetry', () => {
  it('hexRotate60CCW applied 6 times is the identity', () => {
    let cur = { q: 2, r: -1 }
    for (let i = 0; i < 6; i++) cur = hexRotate60CCW(cur.q, cur.r)
    expect(cur).toEqual({ q: 2, r: -1 })
  })
  it('patternRotations yields 6 rotations preserving cell types', () => {
    const pattern = [
      { q: 1, r: 0, type: 'energy' },
      { q: 0, r: 1, type: 'biofarming' },
    ]
    const rots = patternRotations(pattern)
    expect(rots).toHaveLength(6)
    expect(rots[0]).toEqual(pattern)
    for (const rot of rots) {
      expect(rot.map(c => c.type)).toEqual(['energy', 'biofarming'])
    }
  })
})

describe('normalizePattern', () => {
  it('shifts the first cell to the origin', () => {
    const out = normalizePattern([
      { q: 3, r: -2, type: 'community' },
      { q: 4, r: -2, type: 'technology' },
    ])
    expect(out[0]).toEqual({ q: 0, r: 0, type: 'community' })
    expect(out[1]).toEqual({ q: 1, r: 0, type: 'technology' })
  })
})

describe('board layout invariants', () => {
  it('has 3 radius-2 regions that never overlap', () => {
    expect(REGIONS).toHaveLength(3)
    for (const reg of REGIONS) expect(reg.radius).toBe(2)
    for (let i = 0; i < REGIONS.length; i++) {
      for (let j = i + 1; j < REGIONS.length; j++) {
        const a = { q: REGIONS[i].cq, r: REGIONS[i].cr }
        const b = { q: REGIONS[j].cq, r: REGIONS[j].cr }
        // > radius_a + radius_b guarantees no shared hexes
        expect(hexDistance(a, b)).toBeGreaterThan(4)
      }
    }
  })
  it('has 3 factories, none sitting inside any region', () => {
    expect(FACTORIES).toHaveLength(3)
    for (const f of FACTORIES) {
      for (const reg of REGIONS) {
        expect(hexDistance({ q: f.q, r: f.r }, { q: reg.cq, r: reg.cr }))
          .toBeGreaterThan(reg.radius)
      }
    }
  })
})
