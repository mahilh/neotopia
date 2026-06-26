// Guards the game_events.event_type vocabulary FOREVER (T3 S6).
// The DB has a CHECK constraint: event_type ∈ the set below (verified live against pg_constraint).
// Every move the app persists goes through EVENT_TYPE_DB · if a new move type is added without a
// mapping, or a mapping points outside the CHECK set, this fails FAST in unit tests · never again as
// a silent HTTP 400 on the audit insert (the bug T1 S5 found · root-caused to this exact mismatch).

import { describe, it, expect } from 'vitest'
import { EVENT_TYPE_DB } from './useGameSync'

// The game_events_event_type_check allowed set (migration-defined · do not edit without the DB).
const DB_ALLOWED = ['draw_card', 'place_element', 'build_project', 'use_bonus', 'factory_refill', 'turn_end', 'game_end']

// Every event the move loop emits via useGameActions.persist(...) · keep in sync with that file.
const APP_EVENTS_EMITTED = ['place', 'draw', 'score', 'endTurn']

describe('game_events event_type mapping', () => {
  it('maps every event the move loop actually emits', () => {
    for (const e of APP_EVENTS_EMITTED) {
      expect(EVENT_TYPE_DB[e], `useGameActions emits "${e}" but EVENT_TYPE_DB has no mapping`).toBeDefined()
    }
  })

  it('only ever maps to values the DB CHECK accepts', () => {
    for (const [app, db] of Object.entries(EVENT_TYPE_DB)) {
      expect(DB_ALLOWED, `"${app}" → "${db}" is not in game_events_event_type_check`).toContain(db)
    }
  })

  it('never passes a raw app value straight through (the original 400)', () => {
    // The four raw app names must NOT themselves be CHECK-valid · proves we genuinely translate.
    for (const e of APP_EVENTS_EMITTED) {
      expect(DB_ALLOWED).not.toContain(e)
    }
  })
})
