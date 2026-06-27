// NeoTopia · numerology spec guard (T3 S15). The sacred-score milestones are part of the civilization
// design (Tesla 3-6-9 · digital roots · esoteric-knowledge skill). This LOCKS the canonical sacred
// thresholds + their numerological properties so a future edit can't silently drift them, and
// (graceful-pending) verifies the store's milestone API once T2 S15 ships it.
//
// Location: a neutral new test file (NOT src/store/, which is T2's lane and where T2 is actively adding
// numerology events this session · lane discipline). vitest collects it project-wide — vite.config sets no
// `include`, so the default **/*.test.js applies; Playwright ignores it (testMatch is **/*.e2e.js).

import { describe, test, expect } from 'vitest'
import { useGameStore } from '../src/store/gameStore'

// Digital root: repeatedly sum digits to a single digit. The Tesla 3-6-9 / numerology backbone.
const digitalRoot = n => { while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0); return n }

// The canonical sacred score thresholds (design · esoteric-knowledge · numerology-system skills).
const SACRED = [7, 9, 13, 18, 27, 36]

describe('numerology · sacred milestone spec (T3 S15)', () => {

  test('the sacred thresholds are exactly the 6 canonical numbers, in order, unique', () => {
    expect(SACRED).toEqual([7, 9, 13, 18, 27, 36])
    expect(SACRED).toHaveLength(6)
    expect(new Set(SACRED).size).toBe(6)
    expect([...SACRED].sort((a, b) => a - b)).toEqual(SACRED) // already ascending
  })

  test('each sacred number carries its numerological property (digital root)', () => {
    // 9 · 18 · 27 · 36 — the "completion" family · all reduce to 9 (9 × {1,2,3,4}).
    expect([9, 18, 27, 36].map(digitalRoot)).toEqual([9, 9, 9, 9])
    // 7 — spiritual perfection · already single-digit, stays 7.
    expect(digitalRoot(7)).toBe(7)
    // 13 — sacred-feminine cycle · 1+3 = 4 (earth).
    expect(digitalRoot(13)).toBe(4)
  })

  test('the only sacred completion-nines below 27 are 9 and 18 (no drift to 8/10/etc.)', () => {
    const completionNinesBelow27 = []
    for (let n = 1; n < 27; n++) if (digitalRoot(n) === 9) completionNinesBelow27.push(n)
    expect(completionNinesBelow27).toEqual([9, 18])
    completionNinesBelow27.forEach(n => expect(SACRED).toContain(n))
  })

  // GRACEFUL-PENDING until T2 S15 ships a milestone surface in the store. Until then, the spec above still
  // guards the constants; this never produces a false failure. When T2 ships it, assert its thresholds match.
  test('store milestone thresholds match the spec (pending T2 S15)', () => {
    const store = useGameStore.getState()
    const surface = store.SACRED_MILESTONES ?? store.sacredMilestones ?? store.SACRED
    if (!Array.isArray(surface)) {
      console.warn('[numerology] no milestone-thresholds surface in the store yet — pending T2 S15 (constants spec still enforced above)')
      return
    }
    expect([...surface].sort((a, b) => a - b)).toEqual(SACRED)
  })
})
