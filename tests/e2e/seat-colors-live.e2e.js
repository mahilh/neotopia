// NeoTopia · THE 4th PLAYER, ASKED OF THE REAL DATABASE (T3 S28).
//
// THE BUG THIS GUARDS. useGameRoom's SEAT_COLORS sent player_color='purple' for seat 3, while the live
// CHECK allows only (blue, gold, green, red). Seats 0/1/2 passed; seat 3 failed with 23514 every single
// time, so the 4th player could never join any room · on a product whose own copy says "two to four
// players". The live table is the proof it was total rather than intermittent: across the entire production
// history of room_players, seat 0 has 32 rows, seat 1 has 24, seat 2 has 2, and seat 3 has NONE.
//
// WHY A LIVE TEST WHEN A UNIT TEST ALREADY COVERS IT. useGameRoom.join.test.js now enforces the constraint
// set inside its in-memory stand-in, which is what makes a 4-player scenario meaningful there · but that set
// is a TRANSCRIPTION (Rule 45 · a second copy of a contract). It cannot notice a migration that widens,
// narrows, or renames the real CHECK. Only the database knows the database. This file is the binding between
// the two: if the transcription and production ever disagree, this goes red and the unit test's premise is
// re-verified rather than assumed. That is precisely the failure mode Rule 68 names · a constraint in a
// migration file is intent, and only the live catalog is state.
//
// THE NEGATIVE CONTROL IS THE LOAD-BEARING HALF. A test that only ever asserts "the insert succeeded" would
// pass identically against a database with NO constraint at all · it would prove nothing about the rule it
// claims to be checking. So this also asserts that 'purple' is still REJECTED, and with code 23514
// specifically. Success plus a proven-live refusal is a real measurement; success alone is a rubber stamp.
//
// COST · ONE anonymous sign-in, the same as any other live spec. No browser page is opened (the claim is
// about the database contract, not about anything rendered), so nothing here depends on the dev server.
//
// SAFETY · everything is created under the E2E_ username prefix, hard-deleted by this file at the end, and
// swept a second time by global-teardown.js → purge_e2e_test_data() (migrations 006/007/008), which is
// scoped to those prefixes and can never touch a real player. Note it sweeps rooms of ANY STATUS, not only
// finished ones (migration 008 dropped that filter) · see global-teardown.js's header for what that costs
// a concurrent live run.
//
// CI: live · nightly (e2e-live-nightly.yml). Run locally:
//   npx playwright test tests/e2e/seat-colors-live.e2e.js

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, signInAnonRetry, makeRoomCode } from './seedHelpers'

let ENV = null
try { ENV = loadEnv() } catch { /* no creds · skip · this is a live-class spec */ }

// A colour the CHECK must NOT accept · the exact value that broke seat 3. Kept as the negative control so a
// silently dropped constraint fails this test instead of quietly re-opening the hole.
const REJECTED_COLOR = 'purple'

/**
 * Read SEAT_COLORS out of the hook's SOURCE rather than importing it.
 *
 * Importing would be cleaner and does not work: useGameRoom pulls in src/lib/supabase.js, which reads
 * `import.meta.env` · a Vite-only global that is undefined under Playwright's Node loader, so the import
 * chain throws before the constant is reachable. Parsing the declaration keeps this test bound to the value
 * the client ACTUALLY ships without booting the app.
 *
 * It fails loudly rather than silently: if the declaration changes shape the pattern stops matching and this
 * throws, which surfaces as a red test. The wrong repair is to delete the check · it is to fix the pattern.
 */
function readClientSeatColors() {
  const path = new URL('../../src/hooks/useGameRoom.js', import.meta.url)
  const src = readFileSync(path, 'utf8')
  const m = src.match(/SEAT_COLORS\s*=\s*\[([^\]]*)\]/)
  if (!m) {
    throw new Error(
      'could not read SEAT_COLORS from src/hooks/useGameRoom.js · the declaration changed shape, so this ' +
      'test can no longer see what the client sends. Fix the pattern; do not remove the assertion.',
    )
  }
  const colours = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  if (colours.length !== 4) {
    throw new Error(`expected 4 seat colours, parsed ${colours.length} (${colours.join(', ')})`)
  }
  return colours
}

// A fresh waiting room owned by this anon user · the shape room_players_join's WITH CHECK requires
// (status 'waiting' AND player_count < max_players), so a seat insert is actually reachable.
async function createWaitingRoom(client, userId) {
  const code = makeRoomCode()
  const { data, error } = await client
    .from('game_rooms')
    .insert({ room_code: code, host_id: userId, status: 'waiting', max_players: 4, player_count: 0 })
    .select().single()
  if (error) throw new Error('game_rooms insert: ' + error.message)
  return data
}

test.describe('seat colours · what the client sends must be what the database accepts', () => {
  test('every seat the client can occupy is accepted live · and the broken colour is still refused', async () => {
    test.skip(!ENV, 'no Supabase creds (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) · nightly-class live test')

    const seatColors = readClientSeatColors()
    const client = createClient(ENV.url, ENV.key, {
      auth: { storageKey: 'neotopia-e2e-seatcolors', persistSession: false },
    })
    const auth = await signInAnonRetry(client)
    const userId = auth.user.id

    let room = null
    try {
      room = await createWaitingRoom(client, userId)

      // ── 1 · EVERY SEAT, not only the one that broke ────────────────────────────────────────────────────
      // Seat i is inserted with exactly the colour the client derives for seat i, so this reproduces the
      // real write rather than a paraphrase of it. UNIQUE(room_id, user_id) allows one row per user at a
      // time, so each seat is claimed and then released before the next.
      for (const [seat, colour] of seatColors.entries()) {
        const { error } = await client.from('room_players').insert({
          room_id: room.id, user_id: userId, username: 'E2E_SEATCOLOR',
          player_color: colour, seat_number: seat, is_ready: false,
        })

        expect(
          error?.message ?? null,
          `seat ${seat} sends player_color="${colour}" and the live database REFUSED it · ` +
          'a player taking this seat cannot join any room',
        ).toBeNull()

        const { error: delErr } = await client.from('room_players')
          .delete().eq('room_id', room.id).eq('user_id', userId)
        expect(delErr, 'could not release the seat between probes').toBeNull()
      }

      // ── 2 · THE NEGATIVE CONTROL · without this, step 1 would pass against an unconstrained table ───────
      const { error: refusal } = await client.from('room_players').insert({
        room_id: room.id, user_id: userId, username: 'E2E_SEATCOLOR',
        player_color: REJECTED_COLOR, seat_number: 3, is_ready: false,
      })

      expect(
        refusal,
        `the database ACCEPTED player_color="${REJECTED_COLOR}" · room_players_player_color_check is no ` +
        'longer enforcing what this suite assumes, so step 1 proves nothing. Re-read pg_constraint.',
      ).not.toBeNull()
      // 23514 check_violation · the specific code useGameRoom now maps to SEAT_CONFLICT. If this ever
      // arrives as something else, the client's mapping is stale even though the refusal still happens.
      expect(refusal.code, `expected 23514 check_violation, got ${refusal.code}: ${refusal.message}`)
        .toBe('23514')

      // Nothing was left behind by the refused write.
      const { data: rows } = await client.from('room_players').select('seat_number').eq('room_id', room.id)
      expect(rows ?? []).toHaveLength(0)
    } finally {
      // rooms_delete_host requires status 'finished' · then the FK cascade clears room_players.
      if (room) {
        try {
          await client.from('room_players').delete().eq('room_id', room.id).eq('user_id', userId)
          await client.from('game_rooms').update({ status: 'finished' }).eq('id', room.id)
          await client.from('game_rooms').delete().eq('id', room.id)
        } catch { /* best-effort · global-teardown sweeps the E2E_ prefix as a safety net */ }
      }
    }
  })
})
