// NeoTopia · A COMPLETE 4-PLAYER GAME, PLAYED FOR THE FIRST TIME (T3 S29).
//
// WHY THIS EXISTS. Until S28, seat 3 sent a player_color the database refused, so the 4th player could never
// join any room. The live table proved it was total rather than intermittent: seat 0 had 32 rows, seat 1 had
// 24, seat 2 had 2, and seat 3 had ZERO. S28 fixed the join and proved the seat can be CLAIMED · and that is
// all it proved. Everything downstream of joining has therefore never executed with four players in the
// history of this product: turn order wrapping through seat 3, the endgame round counter over a 4-seat
// round, final scoring across four score arrays, cluster points attributed among four players.
//
// "Nobody has ever run this" is the strongest prior there is that something in it is broken.
//
// ── WHAT MAKES THIS A REAL PROOF AND NOT A SIMULATION ────────────────────────────────────────────────────
// 1. FOUR REAL ANONYMOUS PLAYERS against production. Four separate Supabase clients, four separate anon
//    sign-ins, four room_players rows written through the real RLS path (room_players_join, migration 016).
//    Nothing is service-role, nothing bypasses a policy.
// 2. THE REAL ENGINE. src/store/gameStore is imported and driven directly · not reimplemented, not mocked.
//    A harness that re-derives turn order would be asserting against itself; this asserts against the code
//    that actually ships. The engine is importable outside a browser because it is pure (zustand + immer, no
//    supabase, no import.meta.env) · which is exactly why this level of proof is affordable here.
// 3. THE REAL PERSISTENCE PATH. Each turn is pushed to game_sessions with the same column mapping
//    useGameSync.pushState uses, including the 'scoring' → 'finished' translation the CHECK requires.
//
// WHAT THIS DELIBERATELY DOES NOT DO: drive four browser tabs. Turn order, endgame and scoring are ENGINE
// behaviour; four live browsers would test the same logic through four sockets and a lot of flake, and would
// be a worse instrument for the question being asked. The rendering half is T1's and was photographed
// separately in S28 (four players in a lobby, plus the room-full screen).
//
// COST · four anonymous sign-ins. Live-class → nightly, never the merge gate.
// Run locally:  npx playwright test tests/e2e/four-player-live.e2e.js

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, signInPooledOrAnon, poolCredential, makeRoomCode } from './seedHelpers'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../../src/store/gameStore'
import { DECK } from '../../src/lib/projectCards'

let ENV = null
try { ENV = loadEnv() } catch { /* no creds · skip · live-class spec */ }

const SEATS = [0, 1, 2, 3]

/**
 * The client's seat→colour list, READ FROM useGameRoom's SOURCE rather than restated here.
 *
 * Hardcoding the four names would have made this file a FOURTH copy of a contract that already caused a
 * total 4-player outage by existing in three (useGameRoom, gameStore, Lobby · all three said 'purple' at
 * seat 3 while the database CHECK accepted only blue/gold/green/red). A test that duplicates the value it
 * is checking cannot detect the drift it exists to catch.
 *
 * Parsed rather than imported for the same reason seat-colors-live.e2e.js parses it: useGameRoom pulls in
 * src/lib/supabase.js, which reads `import.meta.env` · undefined under Playwright's Node loader, so the
 * import chain throws before the constant is reachable. Fails loudly if the declaration changes shape.
 */
function readClientSeatColors() {
  const src = readFileSync(new URL('../../src/hooks/useGameRoom.js', import.meta.url), 'utf8')
  const m = src.match(/SEAT_COLORS\s*=\s*\[([^\]]*)\]/)
  if (!m) throw new Error('could not read SEAT_COLORS from src/hooks/useGameRoom.js · fix the pattern, do not delete the check')
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
}
const SEAT_COLORS = readClientSeatColors()
// useGameSync.sessionPhaseColumn · the store's 'scoring' is 'finished' in the column's CHECK.
const phaseColumn = (p) => (p === 'scoring' ? 'finished' : p)
// Mirrors useGameRoom.serializableState() · drops action functions, collapses Sets.
const serializable = () => JSON.parse(JSON.stringify(useGameStore.getState()))

test.beforeEach(() => { test.setTimeout(240_000) })

/**
 * A greedy but LEGAL player. Every move goes through the engine's own validators, and the engine is the
 * judge of whether it landed: a move is counted only if actionsRemaining actually decreased. That matters
 * more than it looks · placeElement returns void and silently no-ops on an illegal move, so a harness that
 * assumed success would drift out of sync with the board and blame the engine for its own bad moves.
 */
function takeTurn(seat, defects) {
  const s = () => useGameStore.getState()
  let placements = 0
  let guard = 0

  while (s().actionsRemaining > 0 && guard++ < 40) {
    const before = s().actionsRemaining
    let moved = false

    for (const factory of s().factories) {
      for (const regionId of factory.betweenRegions) {
        const spots = s().getValidPlacements(factory.id, regionId)
        if (!spots?.length) continue
        const live = s().factories.find(f => f.id === factory.id)
        const el = live?.elements.find(e => e.count > 0)
        if (!el) continue
        s().placeElement(seat, factory.id, el.type, spots[0].q, spots[0].r, regionId)
        if (s().actionsRemaining < before) { moved = true; placements++; break }
      }
      if (moved) break
    }
    if (!moved) break // nothing legal anywhere · do not spin
  }

  // Try to build a district with anything now completable. tryScoreCard is the single owner of the rule,
  // so this can only succeed on a genuinely completed pattern.
  //
  // NOTE ON THE FIELD NAME · findBuildableCards returns {cardId, rotation, anchorQ, anchorR, matchedHexKeys},
  // NOT {id}. Reading `.id` here silently passed undefined into tryScoreCard, which then failed its
  // hand lookup and returned false every single time · producing "zero districts built in a whole game",
  // which reads exactly like a product defect and was entirely this harness's fault. Kept as a comment
  // because the two field names are one keystroke apart and the failure is silent (Rule 57).
  let built = 0
  for (const regionId of [0, 1, 2]) {
    // Re-query after every success: scoring changes the region's lastBuiltIllustration (Diverse City),
    // so a list fetched once goes stale the moment one card lands.
    let guardScore = 0
    for (;;) {
      if (guardScore++ > 10) break
      const buildable = s().getBuildableCards(regionId) ?? []
      if (!buildable.length) break
      const match = buildable[0]
      const scoredBefore = s().players.find(p => p.seat === seat)?.scoredCardIds?.length ?? 0
      const ok = s().tryScoreCard(seat, match.cardId, regionId)
      const scoredAfter = s().players.find(p => p.seat === seat)?.scoredCardIds?.length ?? 0
      if (!ok) break
      if (scoredAfter !== scoredBefore + 1) {
        defects.push(`tryScoreCard returned true for card ${match.cardId} (seat ${seat}, region ${regionId}) but scoredCardIds did not grow`)
      }
      built++
    }
  }

  // Keep a hand available · a player with no cards can never build one.
  const me = s().players.find(p => p.seat === seat)
  if (me && me.hand.length < 3 && s().theOffer.length > 0) {
    s().drawCard(seat, 'offer', 0)
  }

  return { placements, built }
}

/**
 * Play a whole game with the real engine and hand back what happened. Shared by both tests below so the
 * offline guard and the live proof exercise byte-identical game logic · if they diverged, the cheap one
 * would stop being evidence about the expensive one.
 */
async function playCompleteGame({ onTurn } = {}) {
  const defects = []
  const seatSequence = []
  let totalPlacements = 0
  let totalBuilt = 0
  let turns = 0
  const MAX_TURNS = 400 // a bound, not an expectation · a game needing more has stalled

  while (useGameStore.getState().phase === 'playing' && turns < MAX_TURNS) {
    const seat = useGameStore.getState().currentSeat
    seatSequence.push(seat)

    const { placements, built } = takeTurn(seat, defects)
    totalPlacements += placements
    totalBuilt += built

    const beforeSeat = useGameStore.getState().currentSeat
    useGameStore.getState().endTurn()
    const afterSeat = useGameStore.getState().currentSeat

    // TURN ORDER · the property that had never run past seat 2 in production.
    if (useGameStore.getState().phase === 'playing') {
      const expected = (beforeSeat + 1) % 4
      if (afterSeat !== expected) {
        defects.push(`turn order broke: seat ${beforeSeat} handed to ${afterSeat}, expected ${expected}`)
      }
    }

    // AWAITED, one turn at a time. These writes are last-write-wins on a single row, so firing them
    // concurrently lets an earlier turn's 'playing' land AFTER the final turn's 'finished' and leave the
    // session looking mid-game forever. The first live run failed exactly that way · it read as "the
    // terminal phase does not persist", a product-shaped bug, and was entirely this harness overlapping
    // writes the real client never overlaps (useGameSync awaits each pushState). Rule 57, twice in one file.
    if (onTurn) {
      const stop = await onTurn({ seat, turns, defects })
      if (stop === false) break
    }
    turns++
  }

  return { defects, seatSequence, totalPlacements, totalBuilt, turns, MAX_TURNS }
}

/** Every claim that is pure ENGINE behaviour · asserted identically offline and live. */
function assertCompleteFourPlayerGame({ seatSequence, totalPlacements, totalBuilt, turns, MAX_TURNS }) {
  const end = useGameStore.getState()

  expect(turns, 'the game never reached an endgame · it stalled').toBeLessThan(MAX_TURNS)
  expect(end.endGameTriggered, 'the endgame flag never fired').toBe(true)
  expect(end.phase, 'the game never reached scoring').toBe('scoring')
  expect(end.endGameRoundsRemaining).toBe(0)

  for (const seat of SEATS) {
    const visits = seatSequence.filter(s => s === seat).length
    expect(visits, `seat ${seat} never took a turn`).toBeGreaterThan(0)
  }
  // Seat 3 is the one that never existed · it must have played a real share, not one token turn.
  expect(
    seatSequence.filter(s => s === 3).length,
    'seat 3 barely played · the 4th player is not a real participant',
  ).toBeGreaterThan(2)

  // Strict cycling across the whole game, as a sequence rather than a count.
  for (let i = 1; i < seatSequence.length; i++) {
    expect(seatSequence[i], `turn ${i} followed seat ${seatSequence[i - 1]}`)
      .toBe((seatSequence[i - 1] + 1) % 4)
  }
  // The endgame burns TWO FULL ROUNDS after the trigger. With four players a round is four turns, so the
  // game must end on a round boundary · otherwise a seat was cut short, and with 4 players that seat is 3.
  expect(seatSequence.length % 4, 'the game did not end on a round boundary · a seat was cut short').toBe(0)

  expect(totalPlacements, 'no element was ever placed · the game was empty').toBeGreaterThan(0)
  expect(totalBuilt, 'no district was ever built across a whole 4-player game').toBeGreaterThan(0)

  // Every seat must have a computable final score · including the one that has never had one.
  const finals = SEATS.map(seat => ({ seat, score: useGameStore.getState().getFinalScore(seat) }))
  for (const f of finals) {
    expect(Number.isFinite(f.score), `seat ${f.seat} has no computable final score`).toBe(true)
  }
  const clusterTotal = useGameStore.getState().getClusterTotal()
  expect(Number.isFinite(clusterTotal), 'cluster total is not computable in a 4-player game').toBe(true)

  return { finals, clusterTotal }
}

test.describe('the 4-player game · every seat, a full game, against production', () => {
  test('ENGINE · a complete 4-player game runs to scoring with every seat playing', async () => {
    // NO NETWORK, NO SIGN-INS. Turn order, the endgame counter and final scoring are pure engine
    // behaviour, and proving them does not need four anonymous sessions · so this half is free, fast and
    // repeatable, and stays honest even when the per-IP anon budget is exhausted (which it will be: the
    // live test below costs four sign-ins and shares that budget with every other live spec).
    //
    // It is also the REGRESSION GUARD. The live test is nightly-class by necessity; this one can run
    // anywhere, so a future change that breaks 4-player turn order fails in seconds rather than overnight.
    // The deck and tiles are shuffled, so every run is a different game · the assertions are properties
    // that must hold for ANY legal 4-player game, not a replay of one recorded outcome.
    useGameStore.getState().initGame(
      SEATS.map(i => ({ userId: `engine-u${i}`, username: `EngineP${i}` })),
      shuffleArray([...DECK]),
      shuffleArray([...PRODUCTION_TILES]),
    )

    const start = useGameStore.getState()
    expect(start.players).toHaveLength(4)
    expect(start.players.map(p => p.seat)).toEqual([0, 1, 2, 3])
    for (const p of start.players) {
      expect(p.hand, `seat ${p.seat} must be dealt a hand`).toHaveLength(3)
      expect(p.scores, `seat ${p.seat} must have a score slot per region`).toHaveLength(3)
    }

    // SEAT COLOUR DRIFT · caught here because it is free here. The engine keeps its own seat→colour array,
    // separate from useGameRoom's and from Lobby's swatches. All three said 'purple' at seat 3 while the
    // database CHECK accepted only blue/gold/green/red, which is exactly why no 4th player could ever join;
    // they were reconciled across three lanes and two sessions (useGameRoom T3 S28, store T2 S29, swatch
    // T1 S29). Nothing structural stops them drifting again, and this costs no network and no sign-in, so
    // a re-divergence fails in seconds rather than waiting for the nightly.
    expect(
      start.players.map(p => p.color),
      'the engine and useGameRoom disagree about seat colours · the 4-player join bug class is reopening',
    ).toEqual(SEAT_COLORS)

    const run = await playCompleteGame()
    const { finals, clusterTotal } = assertCompleteFourPlayerGame(run)

    console.log(`\n[engine] ${run.seatSequence.length} turns · ${run.seatSequence.length / 4} rounds · ` +
      `${run.totalPlacements} placements · ${run.totalBuilt} districts · cluster ${clusterTotal}`)
    console.log('[engine] finals: ' + finals.map(f => `seat ${f.seat}=${f.score}`).join(' · '))
    if (run.defects.length) console.log('[engine] defects: ' + run.defects.join(' | '))
  })

  test('four real players complete a whole game · turn order, endgame and scoring all hold at seat 3', async () => {
    test.skip(!ENV, 'no Supabase creds (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) · nightly-class live test')

    const defects = []          // everything wrong that does not stop the game · reported at the end
    const clients = []
    let roomId = null
    let host = null

    try {
      // ── 1 · FOUR REAL PLAYERS, FOUR REAL SIGN-INS ─────────────────────────────────────────────────────
      // SPACED DELIBERATELY. This is the most sign-in-expensive spec in the repo · four sessions where every
      // other live spec needs one · and Supabase rate-limits anonymous sign-ins per IP with a BURST
      // component, not just an hourly quota. Measured while building this: a lone sign-in (the global
      // teardown's) succeeded at the same moment four back-to-back ones were being refused. signInAnonRetry
      // backs off up to ~15s across 4 tries, which is not enough on its own for a rapid four.
      // The gap is also more faithful, not less: four humans do not join a room in the same millisecond.
      // POOL (T3 S59) · this is the most sign-in-expensive spec in the repo, four permanent auth.users
      // rows per run, so it is where the fixed pool is worth the most. One member PER SEAT: seat
      // resolution downstream is by userId, so two seats sharing an identity is not a saving, it is a
      // game that cannot exist (this spec's own tripwire, and the reason the pool was grown to four).
      // The 6s gap exists for the ANONYMOUS burst limit measured above · a password grant is a different
      // endpoint and does not need it, so it is skipped only when a credential actually exists. With no
      // credential every line below behaves exactly as it did before.
      const SIGNIN_GAP_MS = 6_000
      for (const seat of SEATS) {
        const pooled = poolCredential(seat) !== null
        if (seat > 0 && !pooled) await new Promise(r => setTimeout(r, SIGNIN_GAP_MS))
        const c = createClient(ENV.url, ENV.key, {
          auth: { storageKey: `neotopia-e2e-4p-${seat}`, persistSession: false },
        })
        const auth = await signInPooledOrAnon(c, { index: seat, label: `seat ${seat}` })
        clients.push({ seat, client: c, userId: auth.user.id, username: `E2E_P${seat}` })
      }
      // COUNTERWEIGHT · FOUR SEATS MUST BE FOUR PEOPLE. Under anonymous sign-in this was true BY
      // CONSTRUCTION and therefore asserted nowhere · which is exactly the property that stops being
      // free the moment identities come from a configured list (Rule 110). Two secrets pointing at one
      // user, or one member reachable and the rest misnamed, collapses seats silently: the room seats
      // "four" players, two of them are the same person, and the failure surfaces later as a turn the
      // wrong client believes it owns. Cheap here, unreadable there.
      const ids = clients.map(c => c.userId)
      expect(new Set(ids).size,
        `four seats resolved to ${new Set(ids).size} distinct identities · ${JSON.stringify(
          clients.map(c => ({ seat: c.seat, id: c.userId.slice(0, 8) })))}. Seat resolution is by userId, ` +
        'so duplicated identities make a board where two seats are one player. Check that every ' +
        'E2E_POOL_* pair names a DIFFERENT user (scripts/verify-pool-signin.cjs --all).').toBe(SEATS.length)
      host = clients[0]

      // ── 2 · A REAL ROOM, SEATED THROUGH THE REAL POLICY ───────────────────────────────────────────────
      const code = makeRoomCode()
      const { data: room, error: rerr } = await host.client
        .from('game_rooms')
        .insert({ room_code: code, host_id: host.userId, status: 'waiting', max_players: 4, player_count: 0 })
        .select().single()
      expect(rerr?.message ?? null, 'could not create the room').toBeNull()
      roomId = room.id

      for (const p of clients) {
        const { error } = await p.client.from('room_players').insert({
          room_id: roomId, user_id: p.userId, username: p.username,
          player_color: SEAT_COLORS[p.seat], seat_number: p.seat, is_ready: true,
        })
        expect(
          error?.message ?? null,
          `seat ${p.seat} (${SEAT_COLORS[p.seat]}) could not join · this is the S28 bug class returning`,
        ).toBeNull()
      }

      // The roster the host would read at Start · ordered by seat, exactly as useGameRoom.startGame does.
      const { data: roster } = await host.client
        .from('room_players').select('*').eq('room_id', roomId).order('seat_number')
      expect(roster, 'the room must hold four players').toHaveLength(4)
      expect(roster.map(r => r.seat_number)).toEqual([0, 1, 2, 3])

      // The denormalised counter must agree with reality · it is what migration 016's capacity check reads.
      const { data: roomAfter } = await host.client
        .from('game_rooms').select('player_count, max_players').eq('id', roomId).maybeSingle()
      if (roomAfter?.player_count !== 4) {
        defects.push(`game_rooms.player_count is ${roomAfter?.player_count} with 4 players seated · the trigger disagrees with room_players`)
      }

      // ── 3 · START · the real engine, four players ─────────────────────────────────────────────────────
      useGameStore.getState().initGame(
        roster.map(p => ({ userId: p.user_id, username: p.username })),
        shuffleArray([...DECK]),
        shuffleArray([...PRODUCTION_TILES]),
      )

      const start = useGameStore.getState()
      expect(start.players, 'the engine must seat four players').toHaveLength(4)
      expect(start.players.map(p => p.seat)).toEqual([0, 1, 2, 3])
      expect(start.phase).toBe('playing')
      expect(start.currentSeat).toBe(0)
      for (const p of start.players) {
        expect(p.hand, `seat ${p.seat} must be dealt a hand`).toHaveLength(3)
        expect(p.scores, `seat ${p.seat} must have a score slot per region`).toHaveLength(3)
      }

      // SEAT COLOUR · three copies of one contract, now agreeing, and this is what keeps them that way.
      // The engine keeps its own seat→colour array (gameStore.js) separate from useGameRoom's SEAT_COLORS
      // and from Lobby's hex swatches. All three said 'purple' at seat 3 while the database CHECK accepted
      // only (blue, gold, green, red) · which is why no 4th player could ever join. They were closed in
      // three different lanes across two sessions: useGameRoom in T3 S28, then the store (T2) and the
      // swatch (T1) in S29. Nothing structurally prevents them drifting apart again, so the agreement is
      // asserted here where a real 4-player game can see all of them at once.
      const engineSeat3 = start.players[3].color
      if (engineSeat3 !== SEAT_COLORS[3]) {
        defects.push(`engine colour for seat 3 is "${engineSeat3}" but room_players stores "${SEAT_COLORS[3]}" · the seat-colour copies have drifted apart again`)
      }
      expect(
        start.players.map(p => p.color),
        'the engine and the database disagree about seat colours · the 4-player join bug class is reopening',
      ).toEqual(SEAT_COLORS)

      const { error: serr } = await host.client.from('game_sessions').insert({
        room_id: roomId, state: serializable(), current_seat: 0, turn_number: 1,
        actions_remaining: 3, phase: 'playing',
        production_tiles_remaining: start.productionTilesRemaining,
      })
      expect(serr?.message ?? null, 'could not open the game session').toBeNull()
      await host.client.from('game_rooms').update({ status: 'playing' }).eq('id', roomId)

      // ── 4 · PLAY THE WHOLE GAME · every turn pushed by the player who owns that seat ─────────────────
      let pushes = 0
      const run = await playCompleteGame({
        onTurn: async ({ seat, turns }) => {
          const actor = clients.find(c => c.seat === seat)
          expect(actor, `no client owns seat ${seat}`).toBeTruthy()

          // Persist exactly as the real client does · same columns, same 'scoring' → 'finished' mapping,
          // and AWAITED so turns land in order (see the note in playCompleteGame).
          const snap = serializable()
          const { error } = await actor.client.from('game_sessions').update({
            state: snap,
            current_seat: snap.currentSeat,
            turn_number: snap.turnNumber,
            actions_remaining: snap.actionsRemaining,
            production_tiles_remaining: snap.productionTilesRemaining,
            phase: phaseColumn(snap.phase),
          }).eq('room_id', roomId)

          if (error) {
            defects.push(`seat ${seat} could not push state on turn ${turns}: ${error.message}`)
            return false // stop the game · an unpersisted turn makes everything after it fiction
          }
          pushes++
          return true
        },
      })
      defects.push(...run.defects)

      // ── 5-8 · EVERY ENGINE CLAIM · the same assertions the offline guard makes ───────────────────────
      const { finals, clusterTotal } = assertCompleteFourPlayerGame(run)
      const seatSequence = run.seatSequence
      const totalPlacements = run.totalPlacements
      const totalBuilt = run.totalBuilt
      expect(pushes, 'no turn was ever persisted to the database').toBeGreaterThan(0)

      // ── 9 · THE DATABASE AGREES WITH THE ENGINE ──────────────────────────────────────────────────────
      const { data: finalRow } = await host.client
        .from('game_sessions').select('phase, current_seat, turn_number, state').eq('room_id', roomId).maybeSingle()
      expect(finalRow, 'the session row vanished').toBeTruthy()
      expect(finalRow.phase, "the terminal phase must persist as 'finished'").toBe('finished')
      expect(finalRow.state.players, 'the persisted game must still hold four players').toHaveLength(4)
      expect(finalRow.state.players.map(p => p.seat)).toEqual([0, 1, 2, 3])

      // ── REPORT ───────────────────────────────────────────────────────────────────────────────────────
      console.log('\n──────── 4-PLAYER GAME · COMPLETED ────────')
      console.log(`room ${code} · turns ${seatSequence.length} · rounds ${seatSequence.length / 4}`)
      console.log(`placements ${totalPlacements} · districts built ${totalBuilt}`)
      console.log('turns per seat: ' + SEATS.map(s => `${s}=${seatSequence.filter(x => x === s).length}`).join(' '))
      console.log('final scores  : ' + finals.map(f => `seat ${f.seat}=${f.score}`).join(' · '))
      console.log(`cluster total : ${clusterTotal}`)
      if (defects.length) {
        console.log('\n──────── DEFECTS OBSERVED (non-fatal) ────────')
        defects.forEach((d, i) => console.log(`${i + 1}. ${d}`))
      } else {
        console.log('\nno non-fatal defects observed')
      }
      console.log('───────────────────────────────────────────\n')
    } finally {
      // Hard cleanup · each player deletes their own row (room_players_delete_own), host retires the room.
      for (const p of clients) {
        try { await p.client.from('room_players').delete().eq('room_id', roomId).eq('user_id', p.userId) } catch { /* best-effort */ }
      }
      if (host && roomId) {
        try {
          await host.client.from('game_rooms').update({ status: 'finished' }).eq('id', roomId)
          await host.client.from('game_rooms').delete().eq('id', roomId)
        } catch { /* best-effort · global-teardown sweeps the E2E_ prefix */ }
      }
    }
  })
})
