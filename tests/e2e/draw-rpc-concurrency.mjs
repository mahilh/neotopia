// NeoTopia · ATOMIC DRAW RPC concurrency proof (T3 S23). Standalone live-DB harness · NOT collected by
// Playwright (testMatch '**/*.e2e.js') nor vitest (*.test/*.spec) · run it directly:
//     node tests/e2e/draw-rpc-concurrency.mjs            (default · 16 concurrent draws, deck of 24)
//     N_CONCURRENT=24 DECK_SIZE=40 node tests/e2e/draw-rpc-concurrency.mjs
//
// WHY THIS EXISTS (closes T2's honest S22 gap · migration 011 VERIFY checklist line "[~] FOR UPDATE
// serialization ... Not separately demonstrated with two live connections (single MCP channel); semantics
// are standard."). Reasoning that a row lock serializes is correct but unproven · this is the missing
// REGRESSION that fires the RPC from TWO real Supabase client connections at the same instant and proves
// empirically that no draw is duplicated and no draw is lost. It is the live analogue of the 17f5931
// characterization test that PROVED the clobber bug existed in the old client-snapshot path · here we prove
// the DB-atomic RPC that replaced it does NOT clobber.
//
// THE BUG THIS GUARDS AGAINST (migration 011 header · T3 S17 finding): game state syncs as a WHOLE-STATE
// snapshot. Two clients drawing "simultaneously" each do read-state -> pop deck[0] -> write-state-back. With
// NO row lock both read the SAME deck[0] (DUPLICATE) and the second write CLOBBERS the first (a draw is LOST:
// deck shrinks by 1, hand grows by 1, for TWO draws). draw_card_for_seat moves that read-modify-write inside
// one txn holding SELECT...FOR UPDATE on the game_sessions row, so concurrent draws SERIALIZE: call 1 pops
// deck[0], call 2 blocks then pops the NEW deck[0]. The decisive, falsifiable signature of a working lock:
// fire N concurrent draws on ONE session and get N DISTINCT cards out, deck shrinks by exactly N, hand grows
// by exactly N. A racing (unlocked) impl at N-way contention on one row produces duplicates and losses.
//
// WHY "SAME session/seat" with TWO clients (the forge's framing · faithful to the worst case): the RPC
// authorizes per auth.uid() against room_players seat ownership. To put two genuinely-concurrent connections
// onto the IDENTICAL seat (so the ONLY thing separating their draws is the lock, not authorization or seat),
// we sign in ONCE and have clientB adopt clientA's JWT via setSession · both carry the same uid · both own
// seat 0. This is the maximal-contention case: identical caller, identical seat, identical deck top · if the
// lock did not serialize, BOTH would return deck[0]. (Signing in once also keeps us to a single anon
// sign-in · no per-IP rate-limit burst · seedHelpers note.)
//
// SETUP mirrors the REAL app write path (Rule 36 · seedHelpers.createSeededGame): anon host inserts
// game_rooms -> room_players(seat 0) -> game_sessions, all under the live RLS write policies (migration 002),
// no service role. Test data uses the E2E%/ DRAWTEST marker + is hard-deleted in finally (migration 005
// rooms_delete_host cascade) · globalTeardown's purge_e2e_test_data is the backstop.
//
// HONEST SCOPE (Rule 63): proves the RPC SERIALIZES concurrent same-seat deck draws with zero duplication
// and zero loss, under real network concurrency against the live Postgres lock. It does NOT exercise the UI
// draw path (that is gated on T1 wiring useDrawCard into GameRoom · the forge's SECOND priority, skipped this
// session) and does NOT re-prove the engine-level scoring · it is the data-layer concurrency guarantee only.

import { createClient } from '@supabase/supabase-js'
import { loadEnv, makeRoomCode, signInAnonRetry } from './seedHelpers.js'

const N_CONCURRENT = Number(process.env.N_CONCURRENT ?? 16) // concurrent draws fired in one burst
const DECK_SIZE = Number(process.env.DECK_SIZE ?? 24)       // sentinel deck size (> N so it never empties)
const SEAT = 0                                              // the single seat both clients draw for
const STORE = []                                            // assertion log (label, ok, detail)

function check(label, ok, detail) {
  STORE.push({ label, ok: !!ok, detail })
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' · ' + detail : ''}`)
  return !!ok
}

// A distinct, identifiable sentinel deck · drawtest_000 .. drawtest_NNN · so every drawn card is traceable
// to its original deck slot and any duplicate/loss is unambiguous.
function sentinelDeck(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `drawtest_${String(i).padStart(3, '0')}`, name: `DrawTest ${i}` }))
}

async function main() {
  let url, key
  try { ({ url, key } = loadEnv()) } catch (e) {
    console.log(`\n⏭️  SKIP · ${e.message} · live-DB concurrency proof needs Supabase creds (.env.local or CI secrets)`)
    process.exit(0) // not a failure · the gray-box suite owns the offline path
  }

  const clientA = createClient(url, key, { auth: { storageKey: 'drawtest-a', persistSession: false } })
  let roomId = null
  let userId = null

  try {
    // ── 1. ONE anon sign-in · clientA becomes host + seat-0 owner ─────────────────────────────────────
    const auth = await signInAnonRetry(clientA)
    userId = auth.user.id
    const { data: sess } = await clientA.auth.getSession()
    const access_token = sess?.session?.access_token
    const refresh_token = sess?.session?.refresh_token
    if (!access_token || !refresh_token) throw new Error('no session tokens after anon sign-in')

    // ── 2. Seed room -> room_players(seat 0) -> game_sessions with a known sentinel deck (real RLS path) ─
    const code = makeRoomCode()
    const { data: room, error: rerr } = await clientA
      .from('game_rooms')
      .insert({ room_code: code, host_id: userId, status: 'playing', max_players: 4, player_count: 1 })
      .select().single()
    if (rerr) throw new Error('game_rooms insert: ' + rerr.message)
    roomId = room.id

    const { error: perr } = await clientA.from('room_players').insert({
      room_id: roomId, user_id: userId, username: 'E2E_DRAWTEST_' + code, player_color: 'blue', seat_number: SEAT, is_ready: true,
    })
    if (perr) throw new Error('room_players insert: ' + perr.message)

    const deck = sentinelDeck(DECK_SIZE)
    const seedState = {
      deck,                                    // the RPC pops deck[0]
      theOffer: [],
      players: [{ seat: SEAT, hand: [], color: 'blue', userId, username: 'E2E_DRAWTEST' }],
      actionsRemaining: 3,
      currentSeat: SEAT,
      mode: 'flow',                            // flow · no turn gate, no action-spend confound (any seat draws)
      productionTilesRemaining: 9,
    }
    const { data: session, error: serr } = await clientA.from('game_sessions').insert({
      room_id: roomId, state: seedState, current_seat: SEAT, turn_number: 1, actions_remaining: 3,
      phase: 'playing', production_tiles_remaining: 9, mode: 'flow',
    }).select('id').single()
    if (serr) throw new Error('game_sessions insert: ' + serr.message)
    const sessionId = session.id // NOTE: the RPC takes game_sessions.id, NOT room_id

    // ── 3. clientB adopts clientA's JWT · same uid · also owns seat 0 (the second concurrent connection) ─
    const clientB = createClient(url, key, { auth: { storageKey: 'drawtest-b', persistSession: false } })
    const { error: berr } = await clientB.auth.setSession({ access_token, refresh_token })
    if (berr) throw new Error('clientB setSession: ' + berr.message)

    console.log(`\n🧪 ATOMIC DRAW concurrency · session ${sessionId.slice(0, 8)} · seat ${SEAT} · deck ${DECK_SIZE} · firing ${N_CONCURRENT} concurrent draws across 2 clients\n`)

    // ── 4. FIRE: build all N rpc invocations in a tight synchronous loop, then await them together. Each
    //        supabase rpc builder begins its POST when Promise.all attaches .then · all N are in flight at
    //        once · alternating clientA/clientB so two distinct connections genuinely contend on the row. ──
    const inflight = []
    for (let i = 0; i < N_CONCURRENT; i++) {
      const c = i % 2 === 0 ? clientA : clientB
      inflight.push(c.rpc('draw_card_for_seat', { p_session_id: sessionId, p_seat: SEAT, p_source: 'deck', p_card_index: 0 }))
    }
    const results = await Promise.all(inflight)

    const errors = results.filter(r => r.error).map(r => r.error.message)
    const drawn = results.filter(r => !r.error).map(r => r.data)
    const drawnIds = drawn.map(c => (c && c.id) ? c.id : JSON.stringify(c))

    // ── 5. Read the final persisted state back (clientA · primary, post-commit) ───────────────────────
    const { data: finalRow, error: ferr } = await clientA.from('game_sessions').select('state').eq('id', sessionId).single()
    if (ferr) throw new Error('read-back game_sessions: ' + ferr.message)
    const finalState = typeof finalRow.state === 'string' ? JSON.parse(finalRow.state) : finalRow.state
    const finalDeckIds = (finalState.deck ?? []).map(c => c.id)
    const finalHandIds = (finalState.players?.[0]?.hand ?? []).map(c => c.id)

    const expectedTopN = deck.slice(0, N_CONCURRENT).map(c => c.id) // the real deck-top N · the only correct outputs
    const uniqDrawn = new Set(drawnIds)
    const drawnVsExpected = expectedTopN.every(id => uniqDrawn.has(id)) && uniqDrawn.size === expectedTopN.length
    const handDeckOverlap = finalHandIds.filter(id => finalDeckIds.includes(id))

    // ── 6. ASSERT the four claims of the concurrency guarantee ────────────────────────────────────────
    console.log('ASSERTIONS:')
    let ok = true
    ok &= check('all N draws succeeded (deck had enough · no spurious error)', errors.length === 0, `errors=${errors.length}${errors.length ? ' [' + errors.slice(0, 3).join('; ') + ']' : ''}`)
    ok &= check('N cards returned', drawnIds.length === N_CONCURRENT, `${drawnIds.length}/${N_CONCURRENT}`)
    ok &= check('ZERO duplicates · every concurrent call got a DIFFERENT card', uniqDrawn.size === drawnIds.length, `${uniqDrawn.size} distinct of ${drawnIds.length}`)
    ok &= check('ZERO loss at deck · deck shrank by exactly N', finalDeckIds.length === DECK_SIZE - N_CONCURRENT, `deck ${DECK_SIZE} -> ${finalDeckIds.length} (expected ${DECK_SIZE - N_CONCURRENT})`)
    ok &= check('ZERO loss at hand · hand grew by exactly N', finalHandIds.length === N_CONCURRENT, `hand 0 -> ${finalHandIds.length} (expected ${N_CONCURRENT})`)
    ok &= check('exactly one call got each real deck-top card', drawnVsExpected, `drawn set == deck-top ${N_CONCURRENT}`)
    ok &= check('hand == returned cards (internal consistency)', finalHandIds.length === uniqDrawn.size && finalHandIds.every(id => uniqDrawn.has(id)), `hand∩drawn`)
    ok &= check('no card both drawn AND still in deck (no cross-seam dup)', handDeckOverlap.length === 0, `overlap=${handDeckOverlap.length}`)

    console.log('\n────────────────────────────────────────────────────────────')
    console.log('EVIDENCE (forge gate · T3 S23):')
    console.log(`  concurrent calls in : ${N_CONCURRENT}`)
    console.log(`  distinct results out: ${uniqDrawn.size}`)
    console.log(`  duplicates          : ${drawnIds.length - uniqDrawn.size}`)
    console.log(`  cards lost          : ${(DECK_SIZE - finalDeckIds.length) - finalHandIds.length}  (deck-removed minus hand-added · 0 == none lost)`)
    console.log(`  FOR UPDATE serialized: ${ok ? 'YES · proven empirically' : 'NO · RACE DETECTED'}`)
    console.log('────────────────────────────────────────────────────────────')

    if (ok) {
      console.log('\n✅ PASS · draw_card_for_seat serializes concurrent same-seat draws · no duplicate, no loss.')
    } else {
      console.log('\n❌ FAIL · concurrency violation detected · the row lock did NOT serialize (or wiring is wrong).')
    }
    process.exitCode = ok ? 0 : 1
  } finally {
    // Hard cleanup of the test room (migration 005 rooms_delete_host · FK cascade clears room_players +
    // game_sessions). Best-effort · purge_e2e_test_data backstops any residue (E2E% marker).
    if (roomId) {
      try {
        await clientA.from('game_rooms').update({ status: 'finished' }).eq('id', roomId)
        await clientA.from('game_rooms').delete().eq('id', roomId)
        await clientA.from('room_players').delete().eq('room_id', roomId).eq('user_id', userId)
        console.log(`\n🧹 cleaned up test room ${roomId.slice(0, 8)}`)
      } catch { /* best-effort */ }
    }
  }
}

main().catch(e => { console.error('\n💥 harness error:', e.message); process.exit(1) })
