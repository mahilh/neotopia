// Guards the game_events.event_type boundary FOREVER (T3 S6 · hardened T3 S7).
// The DB has a CHECK constraint: event_type ∈ DB_ALLOWED (verified live against pg_constraint).
// Every move the app persists is run through resolveDbEventType() before the audit insert. This test
// pins that resolver so a move can never again silently 400 (an unmapped value) OR silently skip (an
// already-valid value the old translate-only map missed · the exact T3 S7 regression: two lanes both
// "fixed" the 400 and the combination wrote ZERO rows).

import { describe, it, expect } from 'vitest'
import { resolveDbEventType, EVENT_TYPE_DB, DB_ALLOWED } from './useGameSync'

// What useGameActions.persist(...) ACTUALLY emits today (grep-verified · T3 S7) · all already DB-valid.
const EMITTED_NOW = ['place_element', 'draw_card', 'build_project', 'turn_end']
// Legacy shorthand an earlier build emitted · still tolerated so an old/other emitter never 400s.
const LEGACY = ['place', 'draw', 'score', 'endTurn']

describe('game_events event_type resolution (persistence boundary)', () => {
  it('resolves every name the move loop emits TODAY to a CHECK-valid value', () => {
    for (const e of EMITTED_NOW) {
      const db = resolveDbEventType(e)
      expect(db, `useGameActions emits "${e}" · resolver returned ${db}`).toBeDefined()
      expect(DB_ALLOWED, `"${e}" → "${db}" is not in game_events_event_type_check`).toContain(db)
    }
  })

  it('passes an already-valid DB value straight through (THE T3 S7 regression guard)', () => {
    // The exact bug: EVENT_TYPE_DB['place_element'] is undefined · a translate-only map would skip it
    // and the audit log would go silently empty. The resolver MUST return the value unchanged.
    for (const v of DB_ALLOWED) expect(resolveDbEventType(v)).toBe(v)
  })

  it('still translates legacy shorthand (no silent 400 if an old emitter returns)', () => {
    for (const e of LEGACY) {
      const db = resolveDbEventType(e)
      expect(db, `legacy "${e}" lost its mapping`).toBeDefined()
      expect(DB_ALLOWED).toContain(db)
    }
  })

  it('returns undefined for an unknown type (caller skips · never sends a CHECK-invalid row)', () => {
    expect(resolveDbEventType('teleport')).toBeUndefined()
    expect(resolveDbEventType(undefined)).toBeUndefined()
    expect(resolveDbEventType('')).toBeUndefined()
  })

  it('every legacy mapping still targets a CHECK-allowed value', () => {
    for (const [app, db] of Object.entries(EVENT_TYPE_DB)) {
      expect(DB_ALLOWED, `"${app}" → "${db}" is not CHECK-allowed`).toContain(db)
    }
  })

  it('raw legacy names are NOT themselves CHECK-valid (proves the map genuinely translates)', () => {
    for (const e of LEGACY) expect(DB_ALLOWED).not.toContain(e)
  })
})
