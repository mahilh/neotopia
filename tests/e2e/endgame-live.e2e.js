// NeoTopia · A REAL MULTIPLAYER ROOM REACHES ITS OWN ENDING (T3 S39).
//
// THE LAST UNPROVEN SEAM IN THE MULTIPLAYER PATH, and it is a textbook Rule 65: two halves each proven,
// the composition never run.
//   · the engine's trigger chain · refillFactoryDraft → productionTilesRemaining 0 → endGameTriggered →
//     endTurn burns 2 round-wraps → phase 'scoring' · proven offline (four-player-live) and in a real
//     browser against bots (practice.e2e.js, ~90-115s to a natural end).
//   · the terminal phase crossing the wire · proven in multiplayer-endgame-live.e2e.js, but from a state
//     THE HARNESS WROTE. That spec's own CLAUDE.md entry says so in as many words.
// Nobody has ever watched a live room reach 'scoring' because two people PLAYED it there · which means
// nobody has watched sessionPhaseColumn map a terminal phase that arose on its own, or watched the peer
// who did not act receive it.
//
// ── THE COUNTERWEIGHT, AND IT IS WRITTEN FIRST ON PURPOSE (Rule 86 + T3 S39 ordering) ────────────────────
// The cheap fake here is obvious and I have already shipped it once: seed a finished state, watch 'scoring'
// appear, call it proven. Every assertion below would pass. So the guard against that is authored BEFORE
// the assertions it defends, and it is not a comment · it is a state that MY HARNESS CANNOT PRODUCE:
//
//     endGameTriggered === true  WHILE  phase === 'playing'  AND  productionTilesRemaining === 0
//
// That intermediate is reachable by exactly one code path in the whole codebase · refillFactoryDraft, on a
// placement that empties a factory · and it exists only in the window between the trigger and the second
// round-wrap. The harness seeds `endGameTriggered: false` and never writes to the store again, so if the
// terminal phase were ever injected rather than played, that observation would simply be missing and this
// spec goes red at `witnessedTrigger`. It is asserted, not logged.
//
// I wrote the counterweight first because the last one I wrote LAST could not fail (Rule 86): it was
// exercised least, it had a whole file to hide behind, and only a mutation run found it. There is nothing
// for this one to hide behind · it is the first thing in the test body.
//
// ── WHAT IS REAL, EXACTLY (Rule 35 · never overclaim) ────────────────────────────────────────────────────
// REAL · two browser contexts, two anonymous sign-ins, the genuine lobby loop through the UI, a real room +
//   room_players + game_sessions row, and the app's OWN authenticated client for every write.
// REAL · THE ENDING IS PLAYED. Every action from the seed onward is a real click in a real browser through
//   the real 4-step placement path (factory → element-btn → region-btn → valid hex) and the real End Turn.
//   The trigger fires because a human-driven placement emptied a factory. Nothing is dispatched into a tab.
// SEEDED · the FIRST part of the game. A 56-card game is hundreds of turns at four clicks per placement and
//   is infeasible in an E2E · two-human.e2e.js has said so since S7. So the engine plays the opening to a
//   state ONE PLACEMENT from the trigger (productionTilesRemaining 1, endGameTriggered false, one factory
//   holding exactly one element · all naturally reached, nothing hand-edited), and that state is delivered
//   through the real wire as ONE game_sessions.state UPDATE with phase 'playing'.
//   The compromise is therefore the OPPOSITE of the one in multiplayer-endgame-live: there the ending was
//   given and the play was skipped; here the opening is given and THE ENDING IS THE PART THAT IS PLAYED.
//
// COST · 2 anonymous sign-ins. Nightly-class, never the merge gate. The ENGINE test costs nothing.
// Run locally:  npm run test:e2e -- endgame-live
// ⚠ Run it against a dev server nobody else is editing · see multiplayer-endgame-live's header (Rule 82).

import { test, expect } from '@playwright/test'
import { loadEnv, uniqueName, deleteRoomAsHost, runTwoHumanLobby, spendOneAction, read } from './seedHelpers'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../../src/store/gameStore'
import { DECK } from '../../src/lib/projectCards'

let ENV = null
try { ENV = loadEnv() } catch { /* no creds · the live half skips · the engine half still runs */ }

const serializable = () => JSON.parse(JSON.stringify(useGameStore.getState()))

// The persisted anon user_id (supabase session under storageKey 'neotopia-auth' · supabase.js). The seed
// below must carry these REAL ids, because GameRoom resolves mySeat by matching auth.uid() against the
// roster · a seed with placeholder ids leaves mySeat null in both tabs and every gate in the game silently
// stops applying.
const authUid = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('neotopia-auth')
  if (!raw) return null
  try {
    const j = JSON.parse(raw)
    const id = j?.user?.id ?? j?.currentSession?.user?.id
    if (id) return id
  } catch { /* fall through to the regex */ }
  const m = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return m ? m[0] : null
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE ENGINE · one action at a time, so the search can stop at an exact state.
//
// takeTurn-style drivers (four-player-live, multiplayer-endgame-live) spend a whole turn per call, which
// cannot stop between the placement that leaves a factory holding one element and the placement that
// empties it · and that gap is precisely the seed this spec needs.
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
const s = () => useGameStore.getState()

/** Place exactly ONE element through the real engine validators. Returns true only if an action was spent. */
function placeOne(seat) {
  for (const factory of s().factories) {
    for (const regionId of factory.betweenRegions) {
      const spots = s().getValidPlacements(factory.id, regionId)
      if (!spots?.length) continue
      const live = s().factories.find(f => f.id === factory.id)
      const el = live?.elements.find(e => e.count > 0)
      if (!el) continue
      const before = s().actionsRemaining
      s().placeElement(seat, factory.id, el.type, spots[0].q, spots[0].r, regionId)
      if (s().actionsRemaining < before) return true // the engine is the judge, not this harness
    }
  }
  return false
}

const factoryTotals = () => s().factories.map(f => f.elements.reduce((n, e) => n + e.count, 0))

/**
 * Play the opening until the board is ONE PLACEMENT from the endgame trigger:
 *   productionTilesRemaining === 1 · endGameTriggered false · some factory holding exactly ONE element.
 * Every one of those is a state the engine reaches on its own · nothing here edits the state directly,
 * which is what keeps the seed honest (and what makes the counterweight above meaningful).
 */
function playToOnePlacementFromTheEnd(identities) {
  useGameStore.getState().initGame(
    identities.map(({ userId, username }) => ({ userId, username })),
    shuffleArray([...DECK]),
    shuffleArray([...PRODUCTION_TILES]),
    'classic',
  )

  for (let guard = 0; guard < 4000; guard++) {
    if (s().phase !== 'playing') return null // overshot · the caller retries with a fresh deal

    const nearEmpty = s().factories.findIndex(f => f.elements.reduce((n, e) => n + e.count, 0) === 1)
    if (s().productionTilesRemaining === 1 && !s().endGameTriggered && nearEmpty >= 0) {
      return {
        state: serializable(),
        armedFactory: nearEmpty,
        factories: factoryTotals(),
        currentSeat: s().currentSeat,
        actionsRemaining: s().actionsRemaining,
        offer: s().theOffer.length,
        deck: s().deck.length,
      }
    }

    if (s().actionsRemaining === 0) { s().endTurn(); continue }
    if (placeOne(s().currentSeat)) continue
    if (s().theOffer.length > 0) { s().drawCard(s().currentSeat, 'offer', 0); continue }
    s().endTurn()
  }
  return null
}

// `read` and SNAPSHOT now come from seedHelpers with the driver · one snapshot shape, one definition
// (Rule 45 · a second copy of a contract is a second contract, and it is the copy that drifts).

// The authoritative row, read through the app's own authenticated client. The COLUMN and the jsonb say
// different things by design (sessionPhaseColumn) and this spec exists partly to watch that happen.
const readSessionRow = (page, roomId) => page.evaluate(async (rid) => {
  const m = await import('/src/lib/supabase.js')
  const { data, error } = await m.supabase
    .from('game_sessions').select('id, phase, state').eq('room_id', rid).maybeSingle()
  if (error) return { error: error.message }
  return data ? {
    id: data.id,
    column: data.phase,
    statePhase: data.state?.phase ?? null,
    tiles: data.state?.productionTilesRemaining ?? null,
    triggered: !!data.state?.endGameTriggered,
  } : null
}, roomId)


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
test.describe('a real room reaches its own ending · the composition nobody had run', () => {

  // ── FREE, OFFLINE · proves the seed this spec depends on is a state the engine actually reaches ────────
  test('ENGINE · the opening can be played to exactly one placement from the trigger', async () => {
    test.setTimeout(120_000)
    const ATTEMPTS = 10
    let found = 0
    let sample = null
    for (let i = 0; i < ATTEMPTS; i++) {
      const seed = playToOnePlacementFromTheEnd([
        { userId: `engine-a-${i}`, username: 'A' }, { userId: `engine-b-${i}`, username: 'B' },
      ])
      if (seed) { found++; sample = sample ?? seed }
    }
    console.log(`[endgame] ENGINE · ${found}/${ATTEMPTS} deals reached the armed state · sample ` +
      JSON.stringify({ factories: sample?.factories, seat: sample?.currentSeat, actions: sample?.actionsRemaining,
        offer: sample?.offer, deck: sample?.deck }))

    expect(found, `only ${found}/${ATTEMPTS} deals reached productionTilesRemaining=1 with a factory holding ` +
      'exactly one element · the live test below cannot be seeded').toBe(ATTEMPTS)
    expect(sample.state.phase, 'the armed state must still be mid-game').toBe('playing')
    expect(sample.state.endGameTriggered, 'the armed state must NOT already be in the endgame').toBe(false)
    expect(sample.state.productionTilesRemaining, 'the armed state must be on the last tile').toBe(1)
    expect(sample.factories[sample.armedFactory], 'the armed factory must hold exactly one element').toBe(1)
    // A player must be able to ACT from here, or the browser half has nothing to do.
    expect(sample.offer + sample.factories.reduce((a, b) => a + b, 0),
      'the armed state leaves no legal action at all').toBeGreaterThan(0)
  })

  // ── THE EXPENSIVE ONE ──────────────────────────────────────────────────────────────────────────────────
  test('two humans play a live room to its own ending · the trigger, the column, and the peer',
    async ({ browser }) => {
      // ── NOT GREEN YET, AND SAID SO IN THE ONE PLACE THAT CANNOT BE MISSED (T3 S39) ─────────────────
      // test.fixme() rather than a skip, a deleted test, or a committed red. It reports as FIXME, it does
      // not pretend to pass, and the harness below is preserved so the next session starts from eight live
      // runs of diagnosis rather than rebuilding it. The annotation is INSIDE the test body, per the S35
      // mistake where a bare test.fail() in a describe silently inverted three tests.
      //
      // WHAT IS ALREADY FIXED AND PROVEN (each cost a live run, each is a harness defect, not a product one):
      //   1. the lobby waited for the Start control to be VISIBLE · it is disabled={!canStart}, so the click
      //      did nothing · now runTwoHumanLobby waits for ENABLED (fixed in seedHelpers, shared)
      //   2. a draw was counted from a click that never committed · now the engine is the judge (actionsRemaining)
      //   3. the driver took the FIRST element and FIRST region only, while the offline driver searches all ·
      //      it stalled after ~8 placements
      //   4. clicks carried no timeout · Playwright has no default action timeout, so the loop HUNG and six
      //      runs reported only "5.0m exceeded" with no step
      //   5. the seat→page map was assumed rather than derived · now each page answers for itself (it turned
      //      out correct, which is exactly why it needed measuring rather than arguing)
      //
      //   6. THE TUTORIAL WAS UP THE WHOLE TIME (T3 S40 · this is what the stall actually was).
      //      GameRoom holds useState(() => !tutorialSeen()) and tutorialSeen reads localStorage, which is
      //      EMPTY in every fresh Playwright context · so the overlay renders the moment phase is 'playing',
      //      which is the instant this driver starts clicking. Measured on the free practice board: with the
      //      tutorial up, elementFromPoint at the centre of all three factories returns a plain HTML
      //      <div>/<p>, containsHit false, and a real mouse click leaves uiPhase at 'idle'; dismissed, the
      //      same click yields 'factorySelected'. Fixed in runTwoHumanLobby so no live spec can inherit it.
      //
      // MY S39 HYPOTHESIS WAS WRONG, IN BOTH HALVES, AND IT IS WORTH SAYING SO HERE RATHER THAN DELETING IT.
      // I wrote: "the driver leaves uiPhase at 'regionSelected' and the Offer is not interactive
      // mid-placement". Falsified by reading the code it names, in minutes, for free:
      //   · handleDrawCard (useGameActions.js:157-166) does not read uiPhase AT ALL · it gates on isMyTurn
      //     and actionsRemaining only
      //   · the dim-the-rest rule for [data-offer] at uiPhase 'regionSelected' (index.css:41-44) is OPACITY
      //     ONLY, deliberately so ("never display/visibility"), and opacity cannot swallow a click
      // The symptom I built that hypothesis from was real and precisely described. The explanation was
      // invented to fit it, and it survived a whole session because nothing cheap was asked to contradict
      // it. Eight live runs could not answer what one reading of two files did.
      //
      // ── WHERE IT STANDS NOW (T3 S40 · five live runs, each one ending with a NAMED stage) ─────────────
      // The played endgame now runs, and most of it works. Measured, in one run:
      //     placements commit through the real 4-step path in BOTH browsers
      //     TRIGGER WITNESSED LIVE · "tiles 0 · rounds 2 · turn 17" · endGameTriggered true while phase is
      //       still 'playing' · THE COUNTERWEIGHT STATE, observed in a real synced room for the first time
      //     the round-wrap burns down · rounds 2 -> 1 · the board fills to placed 54 of 54
      // Two harness defects fixed on the way, both measured rather than guessed: the tutorial overlay
      // (above), and the acting-browser reads (the loop took whose-turn AND how-many-actions from the
      // HOST's copy while clicking in the joiner · both are now read from the browser being driven).
      //
      // ── A LIVE ROOM REACHED ITS OWN ENDING · MEASURED T3 S45 ────────────────────────────────────────
      // THE THING NOBODY HAD SEEN, and it is in the server's own columns rather than a client's belief:
      //     column_phase 'finished' · state_turn 21 · state_seat 0 · both clients agreeing
      //     TRIGGER witnessed live earlier in the same run · tiles 0 · rounds 2 · turn 17
      //     writeorder on the peer · { overtakes: [], version: 0 } · the predicate refused NOTHING
      // sessionPhaseColumn maps store 'scoring' → column 'finished', so that row IS the ending, arrived at
      // by two real browsers playing. The S41-S44 blocker (an End Turn lost to its own placement) is gone:
      // T2's state_version predicate plus the wiring in useGameSync closed it, and zero overtakes in a
      // turn-serialised game is what "closed" looks like from the client side.
      //
      // TWO HARNESS DEFECTS FIXED GETTING HERE, both of which had passed on timing for four sessions:
      //   · the spec wrote the armed state before the host had INSERTed game_sessions. An UPDATE matching
      //     ZERO ROWS returns no error, so the write reported success and only the read-back caught it.
      //     It now waits for the row to exist · absence of an error is not evidence of an effect.
      //   · the turn loop demanded another turn from a game that had ALREADY ENDED, and threw "seat 1
      //     never agreed the turn was its own" · a harness bug reporting as a product one. The ending is
      //     the success condition and is now checked first.
      //
      // STILL FIXME, and honestly: the run is not reliably green. Each deal is random, and the driver
      // still loses steps in the UI (a later run stopped at `element-inert` · the element buttons had not
      // appeared for a move the engine offered). That is my driver, not the product · the product reached
      // its ending. Wiring this to a workflow while it is flaky would train people to ignore a red.
      // ⚠ CORRECTED T3 S46. This said "purge_e2e_test_data sweeps E2E rooms of ANY status, so a CI run
      // triggered by your own push DELETES this room mid-game". THE MECHANISM IS WRONG: migration 006
      // deletes rooms `where status = 'finished'` only, nothing has a foreign key to player_profiles, and
      // the app marks a room finished only when the HOST LEAVES · so a 'playing' room is not reachable by
      // it. The MEASUREMENT stands and is still unexplained: `server: NO ROW for room_id ... UNMEASURED`
      // while two browsers were mid-game. Cause unknown, and recorded as unknown.
      // Still worth doing before a live run, for a cheaper reason than the one I invented: live runs and
      // CI share one Supabase project, so `gh run list` costs nothing and rules out the whole class.
      test.fixme(true, 'the live room DOES reach its own ending (column_phase finished, turn 21) · the driver is not yet reliably green · T3 S45')
      test.skip(!ENV, 'no Supabase creds (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) · nightly-class live test')
      test.setTimeout(300_000)

      const ctx1 = await browser.newContext()
      const ctx2 = await browser.newContext()
      const p1 = await ctx1.newPage() // host · seat 0
      const p2 = await ctx2.newPage() // joiner · seat 1
      const bySeat = [] // filled from each page's OWN resolved seat · never assumed
      const httpErrors = []
      // Every draw RPC, not only the failing ones. "The offer is visible, it is my turn, I have actions,
      // drawStatus is empty, and the click spends nothing" exhausted all three causes I had written down,
      // and the decisive question is not answerable from the DOM: does clicking the card SEND a
      // draw_card_for_seat request at all? No request means the click never reached onDrawOffer; a request
      // with a status means the server answered and the answer is the finding. Measure the wire rather than
      // invent a fourth hypothesis · that habit is what cost last session.
      const drawCalls = []
      for (const page of [p1, p2]) {
        page.on('response', async (r) => {
          if (r.status() >= 400 && /supabase\.co/.test(r.url())) {
            // THE BODY, NOT ONLY THE STATUS. A bare "403 POST /rest/v1/game_events" is a fact with no
            // cause, and I shipped exactly that last session · PostgREST puts the reason in the body (the
            // failing policy, a raise message, a rate-limit verdict), so discarding it is Rule 93 in the
            // listener instead of in a click. Six of these appeared in a live run and said nothing.
            const why = await r.text().then(t => t.replace(/\s+/g, ' ').slice(0, 200)).catch(() => 'unreadable')
            httpErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname} :: ${why}`)
          }
          if (/draw_card_for_seat/.test(r.url())) {
            drawCalls.push(`${r.status()} ${new URL(r.url()).pathname}`)
          }
        })
      }

      let roomId = null
      let hostSession = null
      try {
        // ── THE REAL LOBBY LOOP · the shared helper, not a fourth copy ─────────────────────────────────
        // The copy this replaced waited for the Start control to be VISIBLE and clicked it. It is
        // `disabled={!canStart}` (Lobby.jsx:629), so the click did nothing and the spec died 20s later at
        // waitForURL with a bare timeout · a live run, two identities, and no information. runTwoHumanLobby
        // waits for ENABLED and reports the offending screen. See its note in seedHelpers.
        ;({ roomId } = await runTwoHumanLobby(p1, p2, {
          expect, hostName: uniqueName('E2EEH'), joinerName: uniqueName('E2EEG'),
        }))
        hostSession = await p1.evaluate(() => localStorage.getItem('neotopia-auth'))

        const uids = { host: await authUid(p1), joiner: await authUid(p2) }
        expect(uids.host).toBeTruthy()
        expect(uids.joiner).toBeTruthy()

        // ── ARM THE BOARD · the OPENING is seeded, the ENDING is played ────────────────────────────────
        let seed = null
        for (let attempt = 0; attempt < 8 && !seed; attempt++) {
          seed = playToOnePlacementFromTheEnd([
            { userId: uids.host, username: 'Host' }, { userId: uids.joiner, username: 'Joiner' },
          ])
        }
        expect(seed, 'could not reach an armed opening in 8 deals · see the ENGINE test above').toBeTruthy()
        console.log(`[endgame] armed · factories ${JSON.stringify(seed.factories)} · seat ${seed.currentSeat} ` +
          `· actions ${seed.actionsRemaining} · offer ${seed.offer} · deck ${seed.deck}`)

        // ── WAIT FOR THE ROW TO EXIST BEFORE WRITING TO IT (T3 S45) ─────────────────────────────────
        // The host INSERTs game_sessions from useGameRoom (line 579) AFTER both clients have navigated to
        // /game/:roomId, so arriving on the board does not mean the row is there yet. This spec assumed it
        // was, and a run failed with "the armed state did not land · row reads null" · an UPDATE matching
        // ZERO ROWS returns no error, so the write reported success and only the read-back caught it. That
        // is the same shape as `.select()` on the predicate: absence of an error is not evidence of an
        // effect. It passed for four sessions on timing alone.
        await expect.poll(async () => (await readSessionRow(p1, roomId)) !== null, {
          timeout: 30_000,
          message: 'the host never INSERTed a game_sessions row for this room · nothing below can be ' +
            'written, and an UPDATE against a missing row would report success',
        }).toBe(true)

        const writeErr = await p1.evaluate(async ({ rid, state }) => {
          const m = await import('/src/lib/supabase.js')
          const { error } = await m.supabase.from('game_sessions').update({
            state,
            current_seat: state.currentSeat,
            turn_number: state.turnNumber,
            actions_remaining: state.actionsRemaining,
            production_tiles_remaining: state.productionTilesRemaining,
            phase: 'playing', // NOT terminal · see the counterweight
          }).eq('room_id', rid)
          return error ? `${error.code ?? ''} ${error.message}` : null
        }, { rid: roomId, state: seed.state })
        expect(writeErr, 'the armed state could not be written to game_sessions').toBeNull()

        // READ IT BACK BEFORE BLAMING THE SUBSCRIPTION. "The UPDATE returned no error" and "the row now holds
        // the armed state" are different claims, and a poll on the client that fails describes both
        // identically. The first run of this spec timed out here and the message could not say which half
        // was wrong · which is the same shape as Rule 82: an instrument that cannot distinguish its own
        // failure modes has not measured anything.
        const rowAfterWrite = await readSessionRow(p1, roomId)
        expect(rowAfterWrite?.state?.productionTilesRemaining ?? rowAfterWrite?.tiles,
          `the armed state did not land in game_sessions · row reads ${JSON.stringify(rowAfterWrite)}`).toBe(1)

        // Both clients must adopt it over the real subscription before anybody clicks anything.
        for (const [i, page] of [p1, p2].entries()) {
          await expect.poll(async () => JSON.stringify(await read(page)), {
            timeout: 30_000,
            message: `seat ${i} never received the armed state (productionTilesRemaining 1) over ` +
              'postgres_changes · the row holds it, so this is the subscription or syncFromServer',
          }).toContain('"tiles":1')
        }

        // ── THE PREMISE, ASSERTED · this is what makes the witness below non-fakeable ──────────────────
        for (const [i, page] of [p1, p2].entries()) {
          const g = await read(page)
          expect(g.phase, `seat ${i} did not start from a mid-game state`).toBe('playing')
          expect(g.triggered, `seat ${i} started already in the endgame · the seed was terminal`).toBe(false)
          expect(g.rounds, `seat ${i} started with the endgame counter already burned`).toBe(2)
        }
        // WHICH BROWSER HOLDS WHICH SEAT · derived, never assumed.
        // The driver sends each turn's actions to bySeat[currentSeat], and the first version simply took
        // [host, joiner] as [seat 0, seat 1] because that is the order the seed's initGame receives. When
        // that assumption is wrong every click lands on a page where isMyTurn is false, and the app does
        // exactly what it should · nothing · so the harness sees "2 actions and no legal move" and blames
        // the game. GameRoom resolves mySeat by matching auth.uid() against the synced roster, so the only
        // honest source for this mapping is each page answering for itself.
        const seatOfPage = (page) => page.evaluate(() => {
          const g = window.__neotopia_store?.getState?.()
          const raw = localStorage.getItem('neotopia-auth')
          let uid = null
          try {
            const j = JSON.parse(raw)
            uid = j?.user?.id ?? j?.currentSession?.user?.id ?? null
          } catch { /* fall through */ }
          if (!uid && raw) uid = (raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) ?? [])[0] ?? null
          const me = g?.players?.find(p => p.userId && p.userId === uid)
          return { uid, seat: me?.seat ?? null, roster: (g?.players ?? []).map(p => ({ seat: p.seat, userId: p.userId })) }
        })
        const seats = { host: await seatOfPage(p1), joiner: await seatOfPage(p2) }
        console.log('[endgame] seats', JSON.stringify(seats))
        for (const who of ['host', 'joiner']) {
          expect(seats[who].seat, `${who} could not resolve its own seat from the synced roster · mySeat ` +
            'would be null in the app too, and every turn gate silently stops applying').not.toBeNull()
        }
        expect(seats.host.seat).not.toBe(seats.joiner.seat)
        bySeat[seats.host.seat] = p1
        bySeat[seats.joiner.seat] = p2

        const sessionAtSeed = await readSessionRow(p1, roomId)
        expect(sessionAtSeed.column, 'the harness wrote a terminal phase column · the whole test would be circular')
          .toBe('playing')
        expect(sessionAtSeed.statePhase, 'the harness seeded a terminal store phase').toBe('playing')

        // ── PLAY IT OUT · every action from here is a real click ───────────────────────────────────────
        // THE WITNESS the counterweight is built on: endGameTriggered true WHILE phase is still 'playing'.
        // Only refillFactoryDraft can produce it, and only on a placement that empties a factory.
        let witnessedTrigger = null
        let witnessedRounds = []
        const actions = { place: 0, draw: 0, endTurn: 0 }
        const BUDGET_MS = 210_000
        const started = Date.now()
        let final = null
        let lastProgress = ''
        let lastProgressAt = Date.now()

        while (Date.now() - started < BUDGET_MS) {
          const g = await read(p1)
          if (!g) throw new Error('the store seam vanished mid-game')

          // A STALL DETECTOR, because the run this replaced had none and simply consumed its whole budget
          // in silence. Progress is every field a legal action can move · if none of them changes for long
          // enough, say so with the state rather than letting the test time out with no explanation.
          // A HEARTBEAT EVERY ITERATION. Six live runs died at the test timeout with no line between
          // "armed" and the teardown, which made every one of them uninformative in the same way · the
          // diagnostic gap was the real bug, not whatever it was hiding. One line per iteration costs
          // nothing and means a timeout always says where it was standing.
          console.log(`[endgame] .. t${g.turnNumber} seat${g.currentSeat} act${g.actionsRemaining} ` +
            `tiles${g.tiles} placed${g.placed} rounds${g.rounds} trig${g.triggered ? 1 : 0} ` +
            `f${JSON.stringify(g.factories)} @${Math.round((Date.now() - started) / 1000)}s`)
          const progress = `${g.turnNumber}:${g.currentSeat}:${g.actionsRemaining}:${g.placed}:${g.tiles}:${g.rounds}`
          if (progress !== lastProgress) { lastProgress = progress; lastProgressAt = Date.now() }
          else if (Date.now() - lastProgressAt > 30_000) {
            throw new Error(`the live board has not moved for 30s · ${JSON.stringify(g)} · actions so far ` +
              JSON.stringify(actions))
          }
          if (g.triggered && g.phase === 'playing' && !witnessedTrigger) {
            witnessedTrigger = g
            console.log(`[endgame] TRIGGER witnessed · tiles ${g.tiles} · rounds ${g.rounds} · turn ${g.turnNumber}`)
          }
          if (g.triggered && g.phase === 'playing') witnessedRounds.push(g.rounds)
          if (g.phase === 'scoring') { final = g; break }

          const page = bySeat[g.currentSeat]
          if (!page) throw new Error(`currentSeat ${g.currentSeat} has no browser · seats are 0 and 1`)

          // ── THE ACTING BROWSER HAS TO AGREE IT IS ITS TURN (T3 S40 · measured, not guessed) ─────────────
          // `g` is read from p1. The turn advances when the OTHER browser clicks End Turn, and that change
          // reaches this one only via postgres_changes → syncFromServer · a Mumbai round trip. The loop was
          // reading seat ownership from ONE browser and immediately acting in ANOTHER, with a 150ms pause
          // after the End Turn click standing in for that trip. First live run past the tutorial fix died
          // exactly there and SAID SO: stage factory-inert with ui.myTurn "false" on the acting page while
          // the shared state already said currentSeat 1. Nothing was wrong with the click · the browser
          // receiving it correctly believed it was not its turn, and GameRoom gates every handler on
          // isMyTurn (useGameActions.js:117,158,171,192).
          // This is the Rule 65 shape: two halves each correct, the COMPOSED value wrong. Waiting on the
          // acting page's OWN view is the only reading that can authorise a click in it.
          // THE GAME MAY HAVE ALREADY ENDED, and waiting for a seat to take its turn in a finished game
          // is a harness bug that reports as a product one (T3 S45). Measured: a live run reached
          // column_phase 'finished' / state_turn 21 with both clients agreeing, and this loop went on
          // waiting for seat 1 and threw "never agreed the turn was its own". The ending is the SUCCESS
          // condition · check it before demanding another turn.
          const term = await readSessionRow(page, roomId)
          if (term?.statePhase === 'scoring' || term?.column === 'finished') {
            console.log(`[endgame] the room ENDED on its own · column ${term.column} · state ` +
              `${term.statePhase} · turn ${term.tiles !== undefined ? g.turnNumber : g.turnNumber}`)
            final = await read(page)
            if (final?.phase !== 'scoring') {
              await expect.poll(async () => (await read(page))?.phase, { timeout: 30_000 }).toBe('scoring')
              final = await read(page)
            }
            break
          }

          const agreed = async () => await page.evaluate(() => {
            const s = window.__neotopia_store?.getState?.()
            const root = document.querySelector('[data-ui-phase]')
            return `${s?.currentSeat}:${root?.getAttribute('data-my-turn')}`
          }).catch(() => 'unreadable')
          try {
            await expect.poll(agreed, { timeout: 20_000 }).toBe(`${g.currentSeat}:true`)
          } catch {
            // ── AND IF IT NEVER AGREES, SAY WHY IT COULD NOT (T3 S41 · Rule 90's corollary) ─────────────
            // "seat 1 never agreed the turn was its own" is a symptom with at least three causes that need
            // opposite responses: the realtime channel is not subscribed (a connection defect), it is
            // subscribed and the row itself has not moved (the writer never wrote), or the row moved and
            // this client did not apply it (a syncFromServer defect). Timing out with only the symptom is
            // the same failure as the bare null this file already fixed once · so read all three.
            // EVERY FIELD HERE READS FROM A SOURCE THAT EXISTS, and the first draft of this block did not:
            // it read `window.supabase.getChannels()` (the app never puts the client on window, so it
            // reported `channels: []` for every run · a false zero in the very instrument written to stop
            // false zeroes) and looked the row up by a roomId it guessed from location.pathname, which
            // returned "no row". Both are Rule 80 inside a Rule 90 fix. The client comes from the app's own
            // module and the roomId is PASSED IN from the test, which already knows it.
            const why = await page.evaluate(async (rid) => {
              const st = window.__neotopia_store?.getState?.()
              const out = { localSeat: st?.currentSeat, localTurn: st?.turnNumber }
              try {
                const m = await import('/src/lib/supabase.js')
                out.channels = m.supabase.getChannels().map(c => `${c.topic}:${c.state}`)
                if (!out.channels.length) out.channels = 'NONE SUBSCRIBED · this client is not listening'
                const { data, error } = await m.supabase.from('game_sessions')
                  .select('current_seat, turn_number, phase, state').eq('room_id', rid).maybeSingle()
                out.server = error ? `READ REFUSED: ${error.message}`
                  : data ? {
                    column_seat: data.current_seat, column_turn: data.turn_number, column_phase: data.phase,
                    state_seat: data.state?.currentSeat, state_turn: data.state?.turnNumber,
                  } : `NO ROW for room_id ${rid} · UNMEASURED, not "the game is missing"`
              } catch (e) { out.server = `UNMEASURED · ${e.message}` }
              // AND WHAT THIS CLIENT'S OWN WRITES DID · the fourth possibility the three above do not
              // cover: the write was neither lost nor undelivered, it was REFUSED by the state_version
              // predicate and nothing retried it. Two clients count versions independently, so a client
              // whose counter is behind the row has every write turned away · writeOrder.js anticipates
              // exactly this ("B can re-sync and retry") and no retry exists yet.
              out.writeorder = window.__neotopia_writeorder ?? 'NO SEAM (production build?)'
              return out
            }, roomId).catch((e) => ({ error: `the diagnostic itself failed: ${e.message}` }))
            const otherWO = await (bySeat[1 - g.currentSeat]?.evaluate(
              () => window.__neotopia_writeorder ?? null).catch(() => null))
            throw new Error(`seat ${g.currentSeat}'s own browser never agreed the turn was its own · read ` +
              `"${await agreed()}" (want "${g.currentSeat}:true"). The host's state says it IS their turn.\n` +
              `  WHICH OF THE THREE: if server.state_currentSeat is ${g.currentSeat} and local is not, this ` +
              'client received nothing (channel/apply); if the server ALSO reads stale, the previous End ' +
              `Turn never persisted and the writer is the defect.\n  ${JSON.stringify(why)}`)
          }

          // AND READ THE ACTION COUNT FROM THE ACTING BROWSER, NOT FROM THE HOST'S COPY OF IT.
          // Second half of the same measured defect. `g` comes from p1, and p1 learns about p2's placements
          // only when they stream back · so after seat 1 spent all three of its actions, p1 still read
          // actionsRemaining 3 and the loop went on driving a browser whose turn had already ended. The run
          // that found this reported place:5 for a 3-action turn and then stopped at offer-inert with
          // myTurn false · both numbers are the lag, not the game. Whose turn it is comes from the shared
          // state; what that seat may still DO is only answerable by the browser doing it.
          const acting = await read(page)
          if (!acting) throw new Error(`the store seam vanished in seat ${g.currentSeat}'s browser`)

          if (acting.actionsRemaining > 0) {
            const did = await spendOneAction(page, { expect })
            if (did.action) {
              actions[did.action]++
              if ((actions.place + actions.draw) % 3 === 0) {
                console.log(`[endgame] +${did.action} · turn ${g.turnNumber} seat ${g.currentSeat} · tiles ` +
                  `${g.tiles} · factories ${JSON.stringify(g.factories)} · ` +
                  `${Math.round((Date.now() - started) / 1000)}s`)
              }
              continue
            }
            // NAMED, not collapsed into "no legal move". The failures behind this throw need OPPOSITE
            // responses · end the turn / file a board defect / file a UI defect · and the previous version
            // reported all of them as the first one, which is how a harness fault gets filed as a product
            // bug. `stage` says which, `ui` says what the interface thought it was doing, and `why` is
            // written for whoever reads this in a CI log weeks from now with no memory of this session.
            throw new Error(`seat ${g.currentSeat} could not spend an action · STOPPED AT: ${did.stage}\n` +
              `  why:    ${did.why}\n` +
              `  ui:     ${JSON.stringify(did.ui)}\n` +
              `  plan:   ${JSON.stringify(did.plan)}\n` +
              `  state:  actions ${acting.actionsRemaining} (host copy said ${g.actionsRemaining}) · factories ${JSON.stringify(g.factories)} · ` +
              `offer ${g.offer} · placed ${g.placed} · tiles ${g.tiles}\n` +
              `  so far: ${JSON.stringify(actions)}`)
          }
          const endTurn = page.getByTestId('end-turn-btn')
          await expect(endTurn, `End Turn never enabled for seat ${g.currentSeat} at zero actions`)
            .toBeEnabled({ timeout: 10_000 })
          await endTurn.click()
          actions.endTurn++
          await page.waitForTimeout(150) // let the pushState land before the next read
        }

        console.log(`[endgame] played · ${JSON.stringify(actions)} · ${Date.now() - started}ms`)

        // ── THE WRITE-ORDER DETECTOR HAS A CONSUMER NOW (T3 S44 · P3) ────────────────────────────────
        // I shipped overtake detection in S43 into a React state array that nothing read · the same shape
        // as award_game_win and useBonus, a value resting somewhere plausible with no consumer, which is
        // how a subsystem stays unreachable for months (Rules 84/85). This is the thing that watches it.
        // A clean two-player game is turn-serialised, so NOTHING should ever be refused: every write is
        // strictly newer than the row it lands on. A non-empty list here means either a genuine race
        // (which is the bug this whole chain exists for) or a client renumbering backwards after a
        // re-seed · both are worth a red, and both were invisible before.
        for (const [i, page] of bySeat.entries()) {
          const wo = await page.evaluate(() => window.__neotopia_writeorder ?? null)
          expect(wo, `seat ${i} has no window.__neotopia_writeorder · the DEV seam this assertion reads ` +
            'through is gone, so it would silently assert nothing (a skip is not a pass)').toBeTruthy()
          expect(wo.overtakes, `seat ${i} had ${wo.overtakes?.length} write(s) REFUSED by the ` +
            'state_version predicate during a turn-serialised game · ' + JSON.stringify(wo.overtakes))
            .toEqual([])
          console.log(`[endgame] seat ${i} write-order · version ${wo.version} · 0 overtaken`)
        }
        expect(final, `the live room never reached 'scoring' within ${BUDGET_MS}ms`).toBeTruthy()

        // ── THE COUNTERWEIGHT'S ASSERTION ──────────────────────────────────────────────────────────────
        expect(witnessedTrigger, 'never observed endGameTriggered while the game was still playing · the ' +
          'terminal phase did not arise from the production clock, so this test proved nothing it claims')
          .toBeTruthy()
        expect(witnessedTrigger.tiles, 'the trigger fired without the production clock reaching zero').toBe(0)
        expect(actions.place, 'the endgame was reached without a single placement · the clock only advances ' +
          'when a placement empties a factory').toBeGreaterThan(0)
        // The counter must have been observed COUNTING DOWN, not jumping.
        expect(witnessedRounds.some(r => r === 2), 'never saw the endgame counter at 2').toBe(true)
        expect(witnessedRounds.some(r => r === 1), 'never saw the endgame counter at 1 · the two round-wraps ' +
          'the rulebook requires did not both happen').toBe(true)

        // ── THE COLUMN · sessionPhaseColumn, on a phase that arose on its own ──────────────────────────
        // game_sessions.phase CHECK is (playing|endgame|finished) · the store's terminal 'scoring' is NOT a
        // valid column value, and an un-mapped write 400s the ENTIRE row. That mapping has never before run
        // on a phase the client reached by itself.
        await expect.poll(async () => (await readSessionRow(p1, roomId))?.column, {
          timeout: 30_000,
          message: "the terminal state never persisted to game_sessions · the store reached 'scoring' but " +
            'nothing wrote it, so no peer could ever learn the game had ended',
        }).toBe('finished')
        const sessionAtEnd = await readSessionRow(p1, roomId)
        expect(sessionAtEnd.column, 'the column must carry the CHECK-valid terminal value').toBe('finished')
        expect(sessionAtEnd.statePhase, "the jsonb must carry the store's real terminal phase").toBe('scoring')
        console.log(`[endgame] persisted · column='${sessionAtEnd.column}' state.phase='${sessionAtEnd.statePhase}'`)

        // ── THE PEER · the client that did NOT end the game has to be told ─────────────────────────────
        // 'scoring' is set locally by whoever's endTurn burned the last round. Everybody else learns it the
        // only way there is: the pushState → postgres_changes → syncFromServer path.
        for (const [i, page] of [p1, p2].entries()) {
          await expect.poll(() => read(page).then(x => x?.phase), {
            timeout: 30_000,
            message: `seat ${i} never reached 'scoring' · the terminal phase did not cross the wire`,
          }).toBe('scoring')
          await expect(page.getByRole('dialog', { name: /final civilization record/i }),
            `seat ${i} reached 'scoring' but rendered no civilization record`).toBeVisible({ timeout: 30_000 })
        }
        expect(httpErrors, 'the backend refused something during a played endgame').toEqual([])
      } finally {
        console.log('[endgame] http errors', JSON.stringify(httpErrors))
        console.log('[endgame] draw RPC calls', JSON.stringify(drawCalls))
        await ctx1.close()
        await ctx2.close()
        await deleteRoomAsHost(hostSession, roomId)
      }
    })
})
