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
import { loadEnv, uniqueName, deleteRoomAsHost, runTwoHumanLobby } from './seedHelpers'
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

// One read of everything this spec judges, from the DEV store seam, as one snapshot · polling four values
// separately would let the board move between them and produce a state that never existed.
const SNAPSHOT = () => {
  const g = window.__neotopia_store?.getState?.()
  if (!g) return null
  return {
    phase: g.phase,
    currentSeat: g.currentSeat,
    turnNumber: g.turnNumber,
    actionsRemaining: g.actionsRemaining,
    tiles: g.productionTilesRemaining,
    triggered: !!g.endGameTriggered,
    rounds: g.endGameRoundsRemaining,
    offer: g.theOffer?.length ?? 0,
    factories: (g.factories ?? []).map(f => f.elements.reduce((n, e) => n + e.count, 0)),
    placed: (g.regions ?? []).reduce((n, r) => n + Object.values(r.hexes ?? {}).filter(h => h?.element).length, 0),
  }
}
const read = (page) => page.evaluate(SNAPSHOT)

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

/**
 * Spend ONE action in the browser whose turn it is, through the real interface.
 * Placement first (that is the only action that can advance the production clock), drawing as the fallback.
 *
 * ALWAYS returns an object, and on failure it NAMES THE STEP IT DIED ON instead of collapsing every
 * failure into one indistinguishable null (T3 S40):
 *     { action: 'place' | 'draw', stage: 'ok', plan? }
 *     { action: null, stage, why, plan, ...snapshot, ui: { uiPhase, myTurn, drawStatus, counts } }
 * stage is one of:
 *     no-legal-move   the engine offers no placement anywhere AND there is no offer to draw from ·
 *                     a legitimate end of turn, not necessarily a defect
 *     factory-inert   engine offers the move, factory clicked, element-btn never appeared
 *     element-inert   element clicked, region-btn never appeared
 *     region-inert    region clicked, board rendered ZERO hex-valid nodes · UI and engine disagree
 *     hexes-covered   hex-valid nodes exist and none committed at centre or off-centre
 *     offer-inert     the offer is on screen and a real click spent nothing · read ui.drawStatus
 *     no-draw-after-placement-failed   the placement path failed and there is nothing to fall back on
 *
 * force:true on the hex is REQUIRED and load-bearing · hexPulse animates the <g> bbox forever, so
 * Playwright's click-stability wait times out before onClick→placeElement ever fires. Documented in
 * CLAUDE.md ("Bot: ALL steps force:true") and proven against the DB in S12. Every other click here is a
 * normal one, so reachability is still being tested everywhere it can be.
 */
async function spendOneAction(page) {
  // THE ENGINE IS THE JUDGE, NOT THIS HARNESS · and the first version of this function forgot that, which
  // cost a five-minute live run. It returned 'draw' as soon as a card-offer was VISIBLE, and card-offer is
  // visible whether or not it is your turn. So on any turn the harness got wrong, every click did nothing,
  // the loop counted a draw that never happened, and it spun to the test timeout without ever throwing ·
  // a harness reporting progress it had not made. Exactly the shape of Rule 53, and of the S35 note that a
  // disabled control silently does nothing. The offline driver above already checks actionsRemaining after
  // every placement; this is that same discipline applied to the browser.
  // The store mutates LOCALLY on click, well before the pushState round trip · measured at 114-202ms per
  // committed placement on a warm board. `tries` is short by default because this runs inside a loop over
  // candidate hexes: a generous poll there would turn "try eight" into ten seconds an action.
  // EVERY click below carries an explicit timeout. Playwright has NO default action timeout, so a click
  // that cannot resolve waits FOREVER · which is exactly how six live runs died: the play loop logged one
  // heartbeat and never produced a second, because spendOneAction never returned. A test timeout then
  // reports "5.0m exceeded" with no step, and the harness looks like the product.
  // `tries` is short by default because a PLACEMENT commits LOCALLY · placeElement mutates the store and
  // only then persists (useGameActions.js:126-130), measured at 114-202ms on a warm board · and this runs
  // inside a loop over candidate hexes, where a generous poll would turn "try eight" into ten seconds.
  //
  // A DRAW IN A REAL ROOM IS NOT THAT, and assuming it was is what actually killed S39 (see the offer
  // branch below). Callers that go through the network pass their own budget.
  const spent = async (fn, tries = 4, waitMs = 80) => {
    const before = (await read(page))?.actionsRemaining
    await fn()
    for (let i = 0; i < tries; i++) {
      const now = (await read(page))?.actionsRemaining
      if (typeof now === 'number' && typeof before === 'number' && now < before) return true
      // A refusal is authoritative and instant · stop waiting for a round trip that already failed.
      const refusal = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="draw-status"]')
        const t = s ? (s.textContent || '').trim() : ''
        return t && t !== 'Drawing…' ? t : null
      }).catch(() => null)
      if (refusal) return false
      await page.waitForTimeout(waitMs)
    }
    return false
  }

  // ── IT HAS TO SAY WHERE IT STOPPED (T3 S40 · acting on my own S39 closing recommendation) ───────────────
  // This function used to return a bare `null` for THREE different failures: no legal move exists, a legal
  // move exists but no hex is clickable, and a legal move exists but the UI ignores clicks entirely. Those
  // need OPPOSITE responses · end the turn, file a board defect, file a UI defect · and it reported them
  // identically, so six live runs last session produced a hypothesis instead of a diagnosis, and the
  // hypothesis I did form (uiPhase) turned out to be wrong in both of its halves. Rule 90's corollary says
  // an instrument that cannot say WHERE it stopped has not measured anything; that was written about the
  // missing per-iteration heartbeat, and this is the same defect one level down, inside the step.
  //
  // IT READS THE DOM AND NOT ONLY THE STORE, and that is the point rather than an implementation detail:
  // uiPhase is React state inside useGameActions, mirrored out only as `data-ui-phase` on the GameRoom root
  // (GameRoom.jsx:510), so a store snapshot CANNOT see which step the interface believes it is on. Same for
  // draw-status, the only external trace of isDrawingCard. The two facts most likely to explain a stall are
  // both invisible to the seam this spec otherwise reads through.
  const diagnose = async () => ({
    ...(await read(page)),
    ui: await page.evaluate(() => {
      const root = document.querySelector('[data-ui-phase]')
      const status = document.querySelector('[data-testid="draw-status"]')
      const n = (sel) => document.querySelectorAll(sel).length
      return {
        uiPhase: root?.getAttribute('data-ui-phase') ?? 'NO-ROOT',
        myTurn: root?.getAttribute('data-my-turn') ?? 'unset',
        drawStatus: status ? ((status.textContent || '').trim() || 'EMPTY') : null,
        counts: {
          factory: n('[data-testid="factory"]'),
          elementBtn: n('[data-testid="element-btn"]'),
          regionBtn: n('[data-testid="region-btn"]'),
          hexValid: n('[data-testid="hex-valid"]'),
          cardOffer: n('[data-testid="card-offer"]'),
        },
      }
      // A failed evaluate must not masquerade as a diagnosis (Rule 80 · never resolve to a plausible value).
    }).catch((e) => ({ uiPhase: `UNMEASURED · evaluate failed: ${e.message}` })),
  })
  const stopped = async (stage, why, plan = null) => ({ action: null, stage, why, plan, ...(await diagnose()) })

  // ASK THE ENGINE WHICH MOVE IS LEGAL, THEN MAKE THAT EXACT MOVE THROUGH THE REAL UI.
  //
  // The first version took `.first()` of the element buttons and `.first()` of the region buttons and gave
  // up on the whole factory if that one combination had no valid hex · while the OFFLINE driver twenty
  // lines above searches every element against every region of every factory. That asymmetry is the bug:
  // a free probe on the solo /game board showed the click path committing placements in 114-202ms and then
  // returning NOTHING COMMITTED the moment the first element/first region pair ran out of legal hexes,
  // with all three factories full. Four live runs (eight anon identities) died at the test timeout before
  // that was measured, because I kept asking the expensive question instead of the cheap one.
  //
  // This is a READ of the store used as an oracle for WHICH legal move exists · the move itself is still
  // four real clicks on the real controls, and `spent` still makes the engine the judge of whether it
  // landed. Same shape the offline driver uses, and the same shape as reading getValidPlacements there.
  const plan = await page.evaluate(() => {
    const g = window.__neotopia_store?.getState?.()
    if (!g) return null
    for (const f of g.factories) {
      for (const el of f.elements) {
        if (el.count <= 0) continue
        for (const rid of f.betweenRegions) {
          const spots = g.getValidPlacements?.(f.id, rid)
          if (spots?.length) return { factoryId: f.id, element: el.type, regionId: rid }
        }
      }
    }
    return null
  })

  if (plan) {
    await page.locator(`[data-testid="factory"][data-factory="${plan.factoryId}"]`).click({ timeout: 2_000 }).catch(() => {})
    const el = page.locator(`[data-testid="element-btn"][data-element="${plan.element}"]`).first()
    if (!(await el.isVisible({ timeout: 1_500 }).catch(() => false))) {
      return stopped('factory-inert', `the engine offers ${plan.element} from ${plan.factoryId} into ` +
        `${plan.regionId}, the factory was clicked, and no element-btn for ${plan.element} ever appeared`, plan)
    }
    await el.click({ timeout: 2_000 }).catch(() => {})
    const region = page.locator(`[data-testid="region-btn"][data-region="${plan.regionId}"]`).first()
    if (!(await region.isVisible({ timeout: 1_500 }).catch(() => false))) {
      return stopped('element-inert', `${plan.element} was clicked and no region-btn for ${plan.regionId} ` +
        'ever appeared · the element step did not advance the interface', plan)
    }
    await region.click({ timeout: 2_000 }).catch(() => {})
        // TRY EVERY OFFERED HEX, not just the first in DOM order. Measured on the solo board: the engine
        // reported 6 valid spots, the UI rendered 6 hex-valid nodes, and clicking the FIRST one committed
        // nothing · the board is SVG and a <g> can sit under another at its own centre point, which
        // force:true does not fix (force skips the actionability wait, it does not redirect the event).
        // A human clicks a hex they can see; this tries the offered ones until one lands, and only reports
        // failure if none does. Without this the driver silently stalled after ~8 placements and every
        // action fell through to a draw, which is what burned four live runs.
        // force:true is required on THESE clicks only · hexPulse animates the <g> bbox forever so the
        // stability wait never settles (CLAUDE.md "Bot: ALL steps force:true", DB-proven in S12).
        //
        // AND CLICK OFF-CENTRE IF THE CENTRE IS DEAD. Measured on the solo board across a whole game:
        // the UI offered 97 legal hexes and 13 of them (13.4%) had something else at their own centre ·
        // an SVG <text> label, every time. force:true does not help, because force skips the actionability
        // WAIT and still dispatches at a point, where the topmost node receives it. A player is in the same
        // position: the natural target is dead on one hex in seven, and when the covered hex is the ONLY
        // legal placement the turn cannot progress at all (the probe stalled that way at 18 placements).
        // Routed to T1 · almost certainly `pointer-events: none` on the label. The offsets below are the
        // harness working around a real defect, and they are labelled as that rather than as tuning.
    const hexes = await page.getByTestId('hex-valid').all()
    if (hexes.length === 0) {
      return stopped('region-inert', `${plan.regionId} was clicked and the board rendered ZERO hex-valid ` +
        'nodes while the engine says the placement is legal · the UI and the engine disagree', plan)
    }
    const tried = []
    for (const hex of hexes.slice(0, 8)) {
      const box = await hex.boundingBox().catch(() => null)
      const spots = box
        ? [undefined, { x: box.width * 0.5, y: box.height * 0.82 }, { x: box.width * 0.5, y: box.height * 0.18 }]
        : [undefined]
      for (const position of spots) {
        if (await spent(() => hex.click({ force: true, position, timeout: 3_000 }).catch(() => {}))) {
          return { action: 'place', stage: 'ok', plan }
        }
      }
      tried.push(box ? `${Math.round(box.x)},${Math.round(box.y)}` : 'no-box')
    }
    return stopped('hexes-covered', `the engine offers the move, the board rendered ${hexes.length} ` +
      `hex-valid nodes, and NONE of the ${tried.length} tried committed · at centre or at 18%/82% ` +
      `off-centre. If that is every hex it is not the covered-label defect, it is the action layer ` +
      `refusing the click (tried ${tried.join(' ')})`, plan)
  }

  // Fallback · drawing spends an action without touching the production clock, which is what the turns
  // AFTER the trigger need. It is second because only a placement can advance the clock.
  const offer = page.getByTestId('card-offer').first()
  if (!(await offer.isVisible({ timeout: 700 }).catch(() => false))) {
    return stopped(plan ? 'no-draw-after-placement-failed' : 'no-legal-move',
      plan ? 'the placement path failed above and there is no card-offer to fall back on'
        : 'the engine reports no legal placement in any factory/region pair, and no card-offer is visible ' +
          '· this is a legitimate end-of-turn, not necessarily a defect')
  }
  // ── THE DRAW IS REMOTE IN A REAL ROOM, AND THE OLD BUDGET ASSUMED IT WAS LOCAL ─────────────────────────
  // A SEPARATE, LATENT DEFECT · NOT the cause of the S39 stall. Saying so explicitly because writing down
  // the plausible cause instead of the measured one is the mistake this whole session is about: the stall
  // was the TUTORIAL OVERLAY (see seedHelpers.runTwoHumanLobby), measured, and this is a second thing that
  // was also wrong and would have bitten on the very next run.
  // READ FROM THE CODE, not yet exercised live, and labelled as that. In a real room GameRoom.onDrawOffer
  // takes the `isRealRoom` branch (roomId && sessionId && mySeat != null · GameRoom.jsx:361-368) and calls
  // draw_card_for_seat. That RPC does the whole draw SERVER-side · pops the card, appends it to the hand,
  // and decrements actionsRemaining inside the row lock (011_atomic_draw_rpc.sql:147-161) · then RETURNS.
  // It never touches this client's store. The local actionsRemaining moves only once the UPDATE streams
  // back through postgres_changes and syncFromServer applies it: a Mumbai round trip plus realtime
  // propagation. The old code polled 12 x 80ms = 960ms for a LOCAL decrement, and the caller threw on the
  // first null with no retry, so a draw that SUCCEEDED server-side would be reported as a dead interface.
  // Same family as judging any remote commit by a local reading.
  // Practice cannot reproduce this one · isRealRoom is unsatisfiable there by design (GameRoom.jsx:359), so
  // the local deterministic path runs and commits in a tick. Which is the honest boundary of "ask the cheap
  // question first": the free probe answered the stall completely, and could not have answered this.
  // force:true for the SAME reason the hexes need it, and it took a measurement to see it: CardFrame
  // carries the art shimmer, an infinite animation, so Playwright's click-stability wait never settles and
  // a plain click TIMES OUT. The old line swallowed that timeout in `.catch(() => {})` and then waited
  // politely for a state change that no click had ever asked for · which is why the wire showed
  // `draw RPC calls []`: not a refused draw, not a disabled card, NO CLICK AT ALL. A swallowed error is an
  // unmeasured failure, which is this session's lesson in its third costume.
  let clickError = null
  const clicked = await spent(
    () => offer.click({ force: true, timeout: 5_000 }).catch((e) => { clickError = e.message.split('\n')[0] }),
    40, 250)
  if (clicked) return { action: 'draw', stage: 'ok' }
  if (clickError) {
    return stopped('offer-unclickable', `the offer card could not be clicked at all: ${clickError}`)
  }
  // THE OFFER IS ON SCREEN AND THE CLICK DID NOTHING · this is the branch S39 died in, blind, six times.
  // GameRoom.jsx:783 computes `disabled = actionsLeft === 0 || !isMyTurn || isDrawingCard` and then passes
  // `onClick={disabled ? undefined : ...}`, so a disabled offer card has NO HANDLER AT ALL · it is not a
  // greyed control that refuses, it is a node that never hears the click and cannot say so. Two of those
  // three inputs are already in the store snapshot; the third, isDrawingCard, is React state with no store
  // mirror, and its ONLY external trace is the `draw-status` node · which is precisely why diagnose() reads
  // it. My S39 hypothesis for this stall was uiPhase, and it was wrong: handleDrawCard
  // (useGameActions.js:157) does not read uiPhase at all, and the dim-the-rest CSS on [data-offer] is
  // opacity-only by deliberate design (index.css:22-27 · "never display/visibility"), so it cannot swallow
  // a click either. Both halves of that guess are falsified in the file that made it.
  return stopped('offer-inert', 'the card-offer is visible and a real click spent no action within 10s · ' +
    'READ drawStatus FIRST, it distinguishes the three causes: a message names the RPC refusal verbatim ' +
    '(auth, seat ownership, deck empty) · "Drawing…" still showing means the round trip has not returned ' +
    'and 10s was not enough · null, while myTurn is true with actions left, means isDrawingCard is stuck ' +
    'true, and a disabled offer card is rendered with onClick=undefined so it never hears a click at all')
}

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
      // ⚠ THE ONE REMAINING BLOCKER IS NOT MINE, AND IT LOOKS LIKE A PRODUCT DEFECT · ROUTED TO T2.
      // Once the board is full, the only legal action is a DRAW, and in a real room that is the atomic RPC.
      // With force:true on the offer card (CardFrame carries the art shimmer · an infinite animation, so a
      // plain click never settles and TIMES OUT · that alone accounted for `draw RPC calls []`):
      //     the wire says  200 /rest/v1/rpc/draw_card_for_seat
      //     the client says  offer STILL 4 cards · actionsRemaining STILL 3 · drawStatus null · 10s later
      // So the draw SUCCEEDS server-side and the drawing player's own screen never changes. No error is
      // shown, because there was no error. Note the contrast that makes this specific rather than vague:
      // multiplayer-endgame-live already PROVED that a game_sessions.state UPDATE written by a real member
      // reaches both clients through postgres_changes and syncFromServer. The difference here is that the
      // UPDATE happens INSIDE a SECURITY DEFINER function. That is the question to ask first, and it is
      // T2's lane (RPC + migrations), not mine.
      // I am NOT claiming the cause · I am claiming the two readings above, which disagree.
      test.fixme(true, 'a live draw returns 200 and the drawing client never updates · routed to T2 · T3 S40')
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
        page.on('response', (r) => {
          if (r.status() >= 400 && /supabase\.co/.test(r.url())) {
            httpErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`)
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
          await expect.poll(async () => await page.evaluate(() => {
            const s = window.__neotopia_store?.getState?.()
            const root = document.querySelector('[data-ui-phase]')
            return `${s?.currentSeat}:${root?.getAttribute('data-my-turn')}`
          }).catch(() => 'unreadable'), {
            timeout: 20_000,
            message: `seat ${g.currentSeat}'s own browser never agreed the turn was its own · the host's ` +
              'state says it is, so this is sync latency or a seat-ownership disagreement, not a dead control',
          }).toBe(`${g.currentSeat}:true`)

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
            const did = await spendOneAction(page)
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
