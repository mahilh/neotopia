// NeoTopia · THE DRAW RPC WRITES ITS OWN AUDIT ROW · live proof (T2 S42 · migration 021).
// Standalone live-DB harness · NOT collected by Playwright ('**/*.e2e.js') nor vitest (*.test/*.spec).
//     node scripts/with-project-env.cjs node tests/e2e/draw-rpc-audit.mjs
//
// RUN IT THROUGH with-project-env. The shell on this machine exports another project's
// VITE_SUPABASE_URL (AetherMind) and it BEATS .env.local, so a bare `node` here talks to the wrong
// database and every assertion below becomes a measurement of nothing. Verified before the first run,
// not after it.
//
// WHY THIS EXISTS · S40 spent an evening on "the draw RPC returns 200 and the client shows no change"
// and needed FOUR read-only queries to get a partial answer, because after a draw the only surviving
// evidence is the final VALUE of game_sessions.state · and a value cannot distinguish
//     never attempted  ·  attempted and refused  ·  attempted, written, and overwritten.
// Migration 021 writes one game_events row inside the RPC's existing FOR UPDATE transaction. This
// harness proves the two properties that make that row trustworthy as evidence.
//
// COST: ONE anon sign-in (of 150/hour/IP · docs/ANON_SIGNIN_BUDGET.md). Test data carries the E2E%
// marker and is hard-deleted in finally.

import { createClient } from '@supabase/supabase-js'
import { loadEnv, makeRoomCode, signInAnonRetry } from './seedHelpers.js'

const SEAT = 0
const RESULTS = []
const check = (label, ok, detail) => {
  RESULTS.push({ label, ok: !!ok })
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' · ' + detail : ''}`)
  return !!ok
}

const auditRows = async (client, sessionId) => {
  const { data, error } = await client
    .from('game_events')
    .select('seat_number, event_type, event_data, sequence_num')
    .eq('session_id', sessionId)
    .eq('event_type', 'draw_card')
    .order('sequence_num', { ascending: true })
  if (error) throw new Error('game_events read: ' + error.message)
  return (data ?? []).filter(r => r.event_data?.via === 'draw_card_for_seat')
}

async function main() {
  let url, key
  try { ({ url, key } = loadEnv()) } catch (e) {
    console.log(`\n⏭️  SKIP · ${e.message} · this proof needs live Supabase creds`)
    process.exit(0)
  }
  // The env check is IN the harness, not in a note beside it (Rule 90's corollary · a rule expressed
  // as a function cannot be rediscovered). A wrong project would otherwise pass by finding 0 rows.
  if (!url.includes('wynccumuisjxbptjlfwq')) {
    console.log(`\n❌ WRONG PROJECT · ${url}\n   Run via: node scripts/with-project-env.cjs node tests/e2e/draw-rpc-audit.mjs`)
    process.exit(1)
  }

  const client = createClient(url, key, { auth: { storageKey: 'audittest', persistSession: false } })
  let roomId = null

  try {
    const auth = await signInAnonRetry(client)
    const userId = auth.user.id
    const code = makeRoomCode()

    const { data: room, error: rerr } = await client.from('game_rooms')
      .insert({ room_code: code, host_id: userId, status: 'waiting', max_players: 4, player_count: 1 })
      .select().single()
    if (rerr) throw new Error('game_rooms insert: ' + rerr.message)
    roomId = room.id

    const { error: perr } = await client.from('room_players').insert({
      room_id: roomId, user_id: userId, username: 'E2E_AUDIT_' + code,
      player_color: 'blue', seat_number: SEAT, is_ready: true,
    })
    if (perr) throw new Error('room_players insert: ' + perr.message)
    const { error: uerr } = await client.from('game_rooms').update({ status: 'playing' }).eq('id', roomId)
    if (uerr) throw new Error('promote to playing: ' + uerr.message)

    const seedState = {
      deck: [{ id: 'audit_deck_0', name: 'Audit Deck Zero' }, { id: 'audit_deck_1', name: 'Audit Deck One' }],
      theOffer: [{ id: 'audit_offer_0', name: 'Audit Offer Zero' }],
      players: [{ seat: SEAT, hand: [], color: 'blue', userId, username: 'E2E_AUDIT' }],
      actionsRemaining: 3, currentSeat: SEAT, mode: 'flow', productionTilesRemaining: 9,
    }
    const { data: session, error: serr } = await client.from('game_sessions').insert({
      room_id: roomId, state: seedState, current_seat: SEAT, turn_number: 1, actions_remaining: 3,
      phase: 'playing', production_tiles_remaining: 9, mode: 'flow',
    }).select('id').single()
    if (serr) throw new Error('game_sessions insert: ' + serr.message)
    const sessionId = session.id

    console.log(`\n🧪 DRAW RPC AUDIT ROW · session ${sessionId.slice(0, 8)} · seat ${SEAT}\n`)

    // ── COUNTERWEIGHT FIRST (Rule 90) ───────────────────────────────────────────────────────────────
    // The whole value of this row is that it is ATOMIC with the draw. The cheap wrong implementation
    // writes the audit outside the transaction (a second connection, a trigger on nothing, a client
    // call) · which still produces a lovely row for a draw THAT NEVER HAPPENED, and would have made
    // S40 worse rather than better: a log saying "drew" beside a board that did not change is the
    // exact failure being diagnosed, promoted to the evidence layer.
    // So the refusal case runs BEFORE the success case, when nothing else has written anything and
    // its vacuity would be immediate. Two refusals: one SHALLOW (rejected at the ownership gate) and
    // one DEEP (rejected after the lock, the ownership check and the turn gate, inside the draw body).
    console.log('  ── refusals must leave NO trace ──')
    const shallow = await client.rpc('draw_card_for_seat',
      { p_session_id: sessionId, p_seat: 3, p_source: 'deck', p_card_index: 0 })
    check('a draw for an unowned seat is refused', !!shallow.error,
      shallow.error?.message?.slice(0, 58))

    const deep = await client.rpc('draw_card_for_seat',
      { p_session_id: sessionId, p_seat: SEAT, p_source: 'offer', p_card_index: 99 })
    check('a draw past the end of the offer is refused (deep · past the lock)', !!deep.error,
      deep.error?.message?.slice(0, 58))

    const afterRefusals = await auditRows(client, sessionId)
    check('THE COUNTERWEIGHT · two refused draws wrote ZERO audit rows',
      afterRefusals.length === 0, `rows=${afterRefusals.length}`)

    // ── AND ONLY NOW, the success case ──────────────────────────────────────────────────────────────
    console.log('\n  ── a real draw is recorded exactly once ──')
    const ok = await client.rpc('draw_card_for_seat',
      { p_session_id: sessionId, p_seat: SEAT, p_source: 'offer', p_card_index: 0 })
    check('the draw succeeded', !ok.error && ok.data?.id === 'audit_offer_0',
      ok.error ? ok.error.message : `returned ${ok.data?.id}`)

    const rows = await auditRows(client, sessionId)
    check('EXACTLY ONE audit row', rows.length === 1, `rows=${rows.length}`)
    const r = rows[0] ?? {}
    check('the row names the right seat', r.seat_number === SEAT, `seat=${r.seat_number}`)
    check('the row names the ACTUAL card drawn', r.event_data?.card_id === 'audit_offer_0',
      `card_id=${r.event_data?.card_id} name=${r.event_data?.card_name}`)
    check("the row is attributable to the RPC ('via')",
      r.event_data?.via === 'draw_card_for_seat', `via=${r.event_data?.via}`)
    check('the row records the post-draw counts', r.event_data?.offer_after === 0,
      `offer_after=${r.event_data?.offer_after} deck_after=${r.event_data?.deck_after}`)
    check('sequence_num was assigned by the DB (identity · never supplied)',
      typeof r.sequence_num === 'number' && r.sequence_num > 0, `seq=${r.sequence_num}`)

    // ── THE PROPERTY THAT CLOSES S40's OPEN HYPOTHESIS ──────────────────────────────────────────────
    // "written then overwritten" was indistinguishable from "never attempted" because both leave the
    // state pristine. Simulate the clobber exactly as it would happen · a whole-state snapshot write
    // putting the ORIGINAL state back · and show the audit row outlives it.
    console.log('\n  ── the row survives a clobber, which is the whole point ──')
    const { error: cerr } = await client.from('game_sessions')
      .update({ state: seedState, actions_remaining: 3 }).eq('id', sessionId)
    if (cerr) throw new Error('clobber write: ' + cerr.message)

    const { data: post } = await client.from('game_sessions').select('state').eq('id', sessionId).single()
    check('the state is back to pristine · the draw is invisible in game_sessions',
      post.state.theOffer.length === 1, `offer=${post.state.theOffer.length}`)
    const survived = await auditRows(client, sessionId)
    check('the audit row SURVIVED · a clobbered draw is now provable',
      survived.length === 1 && survived[0].event_data?.card_id === 'audit_offer_0',
      `rows=${survived.length}`)

  } finally {
    if (roomId) {
      await client.from('game_rooms').delete().eq('id', roomId) // cascades sessions + events
      console.log('\n  🧹 test room deleted (cascade)')
    }
    await client.auth.signOut().catch(() => {})
  }

  const failed = RESULTS.filter(r => !r.ok)
  console.log(`\n${failed.length === 0 ? '✅ ALL' : '❌ ' + failed.length + ' FAILED of'} ${RESULTS.length} checks\n`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch(e => { console.error('\n💥 ' + e.message + '\n'); process.exit(1) })
