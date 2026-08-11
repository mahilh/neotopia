// NeoTopia E2E · THE ACTION DRIVER · split out of seedHelpers (T3 S47).
// Moved OUT of endgame-live.e2e.js in S46 so it could be exercised on the free practice board rather than
// costing two anon sign-ins per data point; moved out of seedHelpers now because it is a distinct concern
// and the shared file had become a junk drawer (see lobby.js).

export const SNAPSHOT = () => {
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
export const read = (page) => page.evaluate(SNAPSHOT)

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
 *     hexes-covered   hex-valid nodes exist and none committed at its own centre
 *     offer-inert     the offer is on screen and a real click spent nothing · read ui.drawStatus
 *     no-draw-after-placement-failed   the placement path failed and there is nothing to fall back on
 *
 * force:true on the hex is REQUIRED and load-bearing · hexPulse animates the <g> bbox forever, so
 * Playwright's click-stability wait times out before onClick→placeElement ever fires. Documented in
 * CLAUDE.md ("Bot: ALL steps force:true") and proven against the DB in S12. Every other click here is a
 * normal one, so reachability is still being tested everywhere it can be.
 */
export async function spendOneAction(page, { expect }) {
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
  //
  // ⚠ EVERY COUNT BELOW DEGRADES TO 0 IF ITS SELECTOR IS WRONG, which is indistinguishable from an honest
  // "none right now" · Rule 80, inside the instrument I diagnose with. That is guarded, and NOT here:
  // seedHelpers.assertDiagnoseCanSee walks the same selectors on the free practice board and requires each
  // one to MOVE off zero, on the MERGE GATE (practice.e2e.js · "the endgame diagnostic can still see").
  // It lives there rather than in this file on purpose · this spec is nightly-class and currently fixme, so
  // a self-check here would protect nothing today and would rot exactly as Rule 79 describes. It is also
  // deliberately NOT called mid-run: it is proven free (it selects and deselects, committing nothing), but
  // this run is evidence handed to another lane, and an instrument should not add clicks to the thing it
  // is measuring. Mutation-proven: renaming element-btn, region-btn or hex-valid reds it, each of the three.
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
  // ── WAIT FOR THE INTERFACE TO REACH THE STEP YOU JUST ASKED FOR (T3 S46) ────────────────────────────────
  // THE FLAKINESS WAS RULE 82, IN MY OWN DRIVER, THREE TIMES. Each step did
  //     await thing.click(...).catch(() => {})
  //     if (!(await next.isVisible({ timeout: 1_500 }))) return stopped('...-inert')
  // and `locator.isVisible()` IS A POINT-IN-TIME CHECK THAT IGNORES ITS TIMEOUT OPTION ENTIRELY. So the
  // driver clicked a factory and asked microseconds later whether the element buttons had appeared ·
  // before React had re-rendered · and reported the control as INERT. That is the exact defect I wrote
  // Rule 82 about in S37 ("a probe that answers instantly has not answered a question about waiting"),
  // sitting in the file that quotes it. It is why runs failed at `factory-inert` and `element-inert` on
  // some deals and not others: whether the render beat the assertion was a race.
  //
  // expect(locator).toBeVisible({ timeout }) RETRIES · that is the whole difference. This wrapper keeps
  // the NAMED failure (the diagnostic is the thing that made these runs readable at all) while making the
  // wait real, so a stage name now means "the interface never got there in N seconds" rather than "it had
  // not got there yet when I looked".
  const stepReached = async (locator, ms = 6_000) => {
    try { await expect(locator).toBeVisible({ timeout: ms }); return true } catch { return false }
  }

  // AND THE CLICK ITSELF MUST NOT BE SWALLOWED (T3 S46 · Rule 93, in the file that documents Rule 93).
  // Every step did `.click({ timeout: 2_000 }).catch(() => {})`, so a click that never landed produced the
  // SAME symptom as a control that never appeared · and the driver then reported `factory-inert`, blaming
  // the interface for a click it had discarded the failure of. MEASURED under 20x CPU throttling: 33%
  // success with 11 factory-inert, which is not an inert factory at all, it is a 2s click timeout losing
  // to a slow render. A misleading stage name is worse than none, because it routes the next session at
  // the wrong lane.
  const clickOrReport = async (locator, opts = {}) => {
    try { await locator.click({ timeout: 8_000, ...opts }); return null }
    catch (e) { return e.message.split('\n')[0] }
  }

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
    const facErr = await clickOrReport(
      page.locator(`[data-testid="factory"][data-factory="${plan.factoryId}"]`), { force: true })
    if (facErr) return stopped('factory-click-failed', `the factory could not be clicked: ${facErr}`, plan)
    const el = page.locator(`[data-testid="element-btn"][data-element="${plan.element}"]`).first()
    if (!(await stepReached(el))) {
      return stopped('factory-inert', `the engine offers ${plan.element} from ${plan.factoryId} into ` +
        `${plan.regionId}, the factory was clicked, and no element-btn for ${plan.element} ever appeared`, plan)
    }
    const elErr = await clickOrReport(el)
    if (elErr) return stopped('element-click-failed', `${plan.element} could not be clicked: ${elErr}`, plan)
    const region = page.locator(`[data-testid="region-btn"][data-region="${plan.regionId}"]`).first()
    if (!(await stepReached(region))) {
      return stopped('element-inert', `${plan.element} was clicked and no region-btn for ${plan.regionId} ` +
        'ever appeared · the element step did not advance the interface', plan)
    }
    const regErr = await clickOrReport(region)
    if (regErr) return stopped('region-click-failed', `${plan.regionId} could not be clicked: ${regErr}`, plan)
    // TRY EVERY OFFERED HEX, not just the first in DOM order. The engine can report several valid spots
    // while a particular one is momentarily unclickable, and only reporting failure if NONE lands keeps
    // this from blaming the product for one bad target.
    // force:true is required on THESE clicks only · hexPulse animates the <g> bbox forever so the
    // stability wait never settles (CLAUDE.md "Bot: ALL steps force:true", DB-proven in S12).
    //
    // ── THE OFF-CENTRE WORKAROUND IS GONE (T3 S41), AND REMOVING IT IS THE POINT ────────────────────────
    // This used to click each hex at its centre and then at 18% and 82% of its height, because in S39 I
    // measured 13 of 97 legal offers with an SVG <text> sitting at their own centre. T1 fixed that in
    // 4fcb539 · `pointer-events: none` on every board <text>, structural rather than a nudge · and I now
    // gate it in a real browser (practice.e2e.js · 60 of 60 cells reachable at six widths, mutation-proven
    // to red at "3 of 60 · hit: text" the moment the fix is reverted).
    // A WORKAROUND THAT SILENTLY RESCUES A REGRESSION IS A GATE THAT CANNOT SEE IT. Left in, these offsets
    // would let the driver keep placing on a board where the centre click is dead again, and the only
    // symptom a future session would get is the same one that cost S39: everything looks fine until it
    // inexplicably does not. The centre click is the player's click, so it is the only one this asks for.
    const hexes = await page.getByTestId('hex-valid').all()
    if (hexes.length === 0) {
      return stopped('region-inert', `${plan.regionId} was clicked and the board rendered ZERO hex-valid ` +
        'nodes while the engine says the placement is legal · the UI and the engine disagree', plan)
    }
    const tried = []
    for (const hex of hexes.slice(0, 8)) {
      if (await spent(() => hex.click({ force: true, timeout: 3_000 }).catch(() => {}))) {
        return { action: 'place', stage: 'ok', plan }
      }
      const box = await hex.boundingBox().catch(() => null)
      tried.push(box ? `${Math.round(box.x)},${Math.round(box.y)}` : 'no-box')
    }
    return stopped('hexes-covered', `the engine offers the move, the board rendered ${hexes.length} ` +
      `hex-valid nodes, and NONE of the ${tried.length} tried committed at its own centre. The board ` +
      `reachability gate in practice.e2e.js covers the covered-label defect (T1 4fcb539), so if THAT is ` +
      `green this is the action layer ` +
      `refusing the click (tried ${tried.join(' ')})`, plan)
  }

  // Fallback · drawing spends an action without touching the production clock, which is what the turns
  // AFTER the trigger need. It is second because only a placement can advance the clock.
  const offer = page.getByTestId('card-offer').first()
  if (!(await stepReached(offer, 2_000))) {
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
