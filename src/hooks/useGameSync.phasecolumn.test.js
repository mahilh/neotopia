// Guards the game_sessions.phase column mapping FOREVER (T3 S8).
// The column CHECK (verified live · pg_constraint) is: phase ∈ {playing, endgame, finished}.
// The store phase vocabulary DIFFERS: {lobby, playing, scoring}. pushState writes the column on every
// move · if the store's terminal 'scoring' reaches the column un-mapped it 400s the ENTIRE state UPDATE,
// so the game-over state never persists and no client receives FinalScore via postgres_changes. This pins
// the boundary mapper so the natural game-end can never silently fail to sync again.

import { describe, it, expect } from 'vitest'
import { sessionPhaseColumn } from './useGameSync'

const COLUMN_ALLOWED = ['playing', 'endgame', 'finished'] // the live game_sessions_phase_check set

describe('game_sessions.phase column mapping (pushState boundary)', () => {
  it('maps the store terminal phase "scoring" → a CHECK-valid "finished" (THE natural-end 400 bug)', () => {
    expect(sessionPhaseColumn('scoring')).toBe('finished')
    expect(COLUMN_ALLOWED).toContain(sessionPhaseColumn('scoring'))
  })

  it('passes an already-valid column value straight through', () => {
    for (const v of COLUMN_ALLOWED) expect(sessionPhaseColumn(v)).toBe(v)
  })

  it('never returns a value the column CHECK would reject (any store phase or junk)', () => {
    for (const p of ['lobby', 'playing', 'scoring', 'endgame', 'finished', '', undefined, 'whatever']) {
      expect(COLUMN_ALLOWED, `store phase "${p}" mapped to a value outside the column CHECK`).toContain(sessionPhaseColumn(p))
    }
  })

  it('the store terminal name is NOT itself a valid column value (proves we must translate)', () => {
    expect(COLUMN_ALLOWED).not.toContain('scoring')
  })
})
