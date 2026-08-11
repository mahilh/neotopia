// NeoTopia · DOES POSTGRES ACTUALLY DO THE THING MY MOCK SAYS IT DOES? (T3 S43)
//
// RUNS-NOWHERE: not in any workflow as of T3 S43. It costs one anon sign-in, so it belongs on
// e2e-live-nightly.yml, and workflow wiring is T2's. Declared rather than left silent because a spec no
// workflow runs cannot report its own rot (Rule 79) and any comment citing it as proof is a claim rather
// than evidence (T2's Rule 97) · the preconditions spec now gates exactly this, and it caught this file.
//
// useGameSync.writeorder.test.js reproduces the lost End Turn against a MOCK, and a mock is a model of
// Postgres, not Postgres. I inherited that mock from simultaneousdraw.test.js and REASONED that it matched
// full-row-replace semantics · which is the same "reasoned mechanism" that was wrong twice in S42 (the
// blank-card cause, and the SPA-fallback art probe). The entire End Turn fix, and T2's version predicate,
// rest on one semantic. So it gets measured against the real database once, here.
//
// THE CLAIM, stated so it can fail: an UPDATE carrying an OLDER snapshot silently overwrites a NEWER one.
// There is no implicit version check, no merge, no protection · the last statement to reach the row wins
// regardless of how old the value it carries is. If that is false, the write race is not a real defect and
// T2 should not build a predicate for it.
//
// NO TIMING TRICKERY IS NEEDED, which is what makes this deterministic rather than flaky: writing B (new)
// and then A (old) sequentially is exactly what the race produces when A's request is the slow one. The
// race decides WHICH order the server sees; this proves what the server DOES with that order.
//
// COST · one anonymous sign-in (createSeededGame). The brief estimated none, and that was optimistic:
// game_sessions is behind sessions_update_member RLS, so writing to it at all requires being a member of
// the room. One identity against a 150/hour ceiling is the right price for removing a reasoned premise
// from under a defect two lanes are now building on. Nightly-class · never the merge gate.

import { test, expect } from '@playwright/test'
import { loadEnv, createSeededGame, cleanupSeeded } from './seedHelpers'

let ENV = null
try { ENV = loadEnv() } catch { /* no creds · skip, the way every live spec here does */ }

test.describe('game_sessions write semantics · measured against the real database', () => {
  test('an UPDATE carrying an OLDER snapshot overwrites a NEWER one · no version check exists',
    async () => {
      test.skip(!ENV, 'no Supabase creds (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) · nightly-class')
      test.setTimeout(120_000)

      let game = null
      try {
        game = await createSeededGame('t3-writeorder')
        const { admin, roomId } = game

        // ── COUNTERWEIGHT FIRST (Rule 90) · prove the WRITE PATH WORKS before proving it loses data ────
        // "the old value survived" has a cheap wrong cause that looks identical: the second write never
        // landed at all (RLS refusal, wrong filter, a typo in the column). Then the row still reads A and
        // the test "passes" while proving nothing about ordering. So the first thing asserted is that a
        // plain write DOES take effect and IS visible on read-back.
        const newer = { marker: 'B', __seq: 2, currentSeat: 1, turnNumber: 20 }
        const { error: bErr } = await admin.from('game_sessions')
          .update({ state: newer, current_seat: 1, turn_number: 20 }).eq('room_id', roomId)
        expect(bErr, `the newer write was refused · ${bErr?.message} · nothing below would mean anything`)
          .toBeNull()

        const afterB = await admin.from('game_sessions')
          .select('state, current_seat, turn_number').eq('room_id', roomId).maybeSingle()
        expect(afterB.data?.state?.marker, 'the write path itself does not work · this is not an ordering ' +
          'finding, it is a broken harness').toBe('B')
        expect(afterB.data?.current_seat, 'the denormalised column moved with it').toBe(1)

        // ── NOW THE CLAIM · the OLDER snapshot, issued second, exactly as the slow request would ────────
        const older = { marker: 'A', __seq: 1, currentSeat: 0, turnNumber: 19 }
        const { error: aErr } = await admin.from('game_sessions')
          .update({ state: older, current_seat: 0, turn_number: 19 }).eq('room_id', roomId)
        expect(aErr, 'the stale write was refused · if the DB already rejects these, the race is not a ' +
          'defect and T2 should not build a predicate').toBeNull()

        const final = await admin.from('game_sessions')
          .select('state, current_seat, turn_number').eq('room_id', roomId).maybeSingle()

        expect(final.data?.state?.marker,
          'POSTGRES ACCEPTED THE STALE SNAPSHOT. The row now holds the OLDER state, so an UPDATE carrying ' +
          'a snapshot read before another one silently overwrites it · exactly what the mock in ' +
          'useGameSync.writeorder.test.js models, now measured rather than assumed.').toBe('A')
        expect(final.data?.state?.__seq, 'the counter went BACKWARDS on the server · which is precisely ' +
          'what the client-side detector watches for').toBe(1)
        expect(final.data?.current_seat, 'and the turn reverted with it · this is the deadlock, in one row')
          .toBe(0)

        // AND NO MERGE. jsonb is REPLACED wholesale · the newer write's fields are gone rather than
        // merged under the older one's, which is the other half of what the mock claims.
        expect(final.data?.state, 'jsonb was merged rather than replaced · the mock models a full-row ' +
          'replace and that would be the wrong model').toEqual(older)
        expect(final.data?.turn_number).toBe(19)

        console.log('[pg-writeorder] MEASURED · wrote B(seq 2, seat 1) then A(seq 1, seat 0) · row holds ' +
          `${JSON.stringify(final.data?.state)} · current_seat ${final.data?.current_seat} · ` +
          'no version check, no merge, last statement wins')
      } finally {
        await cleanupSeeded(game)
      }
    })
})
