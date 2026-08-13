// THE ADVERSARIAL FUZZ DRIVER, AS A MODULE  (T2 S45 · extracted T2 S68)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// EXTRACTED because a SECOND consumer arrived and the alternative was a second copy. S68 needed to
// run these same policies with `WALLET_ENABLED` mocked true, and `vi.mock` is file-wide · so the
// wallet question cannot live in adversarialFuzz.test.js without flipping the flag for the existing
// gate too. Two hand-rolled drivers is exactly the defect this project has paid for repeatedly
// (Rule 45; T3 and I both hand-built the deadlock board and both produced the same 2-placement bug).
//
// NOTHING BELOW CHANGED IN THE MOVE. adversarialFuzz.test.js imports it and its numbers are
// unchanged · which is asserted by that file continuing to pass, not by this sentence.
//
// ⚠ `canDraw` DELIBERATELY ASKS ONLY WHETHER A CARD EXISTS, NOT WHETHER IT CAN BE BOUGHT. That is
// faithful to what it models · T1's End Turn escape reads the same question · and it is precisely
// why walletSoftLock.test.js exists: under a price those two stop being the same question.

import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'
import { hexesInRadius, REGIONS as REGION_DEFS } from '../utils/hexUtils'

export const store = () => useGameStore.getState()
export const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
export const shuffled = (rng, arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Deliberately a local copy of engineFuzz's enumerator rather than an import · that file exports
// nothing and advertises byte-identical Classic play, so it stays untouched. Kept to a few lines so
// the duplication is legible rather than a second contract (Rule 45).
export function legalPlacements() {
  const s = store()
  const opts = []
  for (const f of s.factories) {
    const types = [...new Set(f.elements.filter(e => e.count > 0).map(e => e.type))]
    if (!types.length) continue
    for (const regionId of f.betweenRegions)
      for (const t of s.getValidPlacements(f.id, regionId))
        for (const type of types) opts.push({ factoryId: f.id, type, regionId, q: t.q, r: t.r })
  }
  return opts
}
export const canDraw = () => store().theOffer.length > 0 || store().deck.length > 0

// ── THE UI GATE, MODELLED (this is also P2's composition test) ──────────────────────────────────────
// T1 S44 ships: End Turn is enabled when the actions are spent OR when no legal action exists (their
// soft-lock escape). 'legacy' is the gate as it was BEFORE that fix · all three actions must be spent ·
// and it is kept because it is the only way to prove this harness can still see the original hang.
//
// THIS MODELS T1's GATE, IT DOES NOT EXERCISE IT. T3 is building the browser-level version against the
// real button. Theirs is stronger evidence; this one is cheaper and runs on every commit. Neither
// covers the other and this comment exists so nobody later reads it that way.
export function uiAllowsEndTurn(gate) {
  if (store().actionsRemaining === 0) return true
  if (gate === 'legacy') return false
  return !legalPlacements().length && !canDraw()   // T1's escape
}

// ── POLICIES · each is a legal way to play, chosen to stall the placement-driven clock ──────────────
export const POLICIES = {
  // engineFuzz's behaviour, for comparison: always place when possible → tiles always reach 0.
  greedy: () => { const p = legalPlacements(); return p.length ? { place: p[0] } : (canDraw() ? { draw: true } : null) },
  // Spend every action drawing. Empties the 56-card supply while the clock never moves · this is the
  // exact shape of the S44 audit, whose player reached a 26-card hand.
  drawHeavy: () => (canDraw() ? { draw: true } : (legalPlacements()[0] ? { place: legalPlacements()[0] } : null)),
  // Fill ONE region and refuse the others. Drives a board toward "the stocked factory borders only
  // full regions", which is the audit's terminal shape.
  oneRegion: () => {
    const p = legalPlacements().filter(m => m.regionId === 0)
    return p.length ? { place: p[0] } : (canDraw() ? { draw: true } : null)
  },
  // Never make the placement that would empty a factory · the ONLY event that consumes a tile. The
  // clock is therefore frozen by construction while play continues normally (Rule 100 made literal).
  neverEmptyFactory: () => {
    const s = store()
    const safe = legalPlacements().filter(m => {
      const f = s.factories.find(x => x.id === m.factoryId)
      return f.elements.reduce((n, e) => n + e.count, 0) > 1
    })
    return safe.length ? { place: safe[0] } : (canDraw() ? { draw: true } : null)
  },
}

// A POLICY MAY NEVER REFUSE TO PLAY, and this cost me the first run. `oneRegion` declined every move
// outside region 0; once region 0 filled it returned null with THIRTEEN legal placements on the board,
// spent no action, and could not pass · because T1's gate correctly refuses to let a player leave a
// turn while moves exist. The harness reported a hang. It was a fake: the game offered moves and the
// POLICY wanted none of them, which is not a defect in anything.
// So the driver falls back to any legal action whenever the policy has no preference. The policies keep
// their adversarial shape (they still distort the board and stall the clock) but they cannot manufacture
// a hang by abstention · which means a reported hang is now always a property of the GAME.
export function anyLegalMove() {
  const p = legalPlacements()
  if (p.length) return { place: p[0] }
  return canDraw() ? { draw: true } : null
}

// Returns 'scoring' | 'hung' | 'capped'. A HANG is the finding: the turn cannot be ended and no action
// can be taken. engineFuzz cannot express this outcome at all.
// `wallet` seeds every player's budget after initGame · null leaves STARTING_WALLET untouched, so
// every existing caller is byte-identical. It exists so the SAME policies can be driven under a
// price without a second driver (T2 S68). Seeding is all this does: affordability and the debit are
// the engine's, exactly as in ladderHarness (Rule 45 · one purchase rule).
export function playWithPolicy(policyName, seed, { gate = 't1', turnCap = 400, mode, wallet = null } = {}) {
  useGameStore.setState(useGameStore.getInitialState(), true)
  const rng = mulberry32(seed)
  store().initGame(
    [{ userId: 'A', username: 'A' }, { userId: 'B', username: 'B' }],
    shuffled(rng, PROJECT_CARDS), shuffled(rng, PRODUCTION_TILES), mode,
  )
  if (wallet !== null) useGameStore.setState(st => { for (const p of st.players) p.wallet = wallet })
  const choose = POLICIES[policyName]
  let turns = 0
  // THE DISCRIMINATING QUANTITY (Rule 96). Tiles-at-END is 0 for any game that finishes, so it cannot
  // tell these policies apart · my first version measured it and reported every policy identical. What
  // separates them is WHICH RULE ENDED THE GAME: tiles>0 when the trigger fires means the clock had NOT
  // run out and the deadlock condition did the ending · a state greedy play cannot produce.
  let tilesAtTrigger = null, maxHand = 0, refusedDraws = 0
  while (store().phase === 'playing' && turns < turnCap) {
    let spin = 0
    while (store().actionsRemaining > 0 && spin++ < 40) {
      const before = store().actionsRemaining
      const move = choose() ?? anyLegalMove()   // never abstain · see anyLegalMove
      if (!move) break
      const s = store()
      if (move.place) {
        s.placeElement(s.currentSeat, move.place.factoryId, move.place.type, move.place.q, move.place.r, move.place.regionId)
        const matches = store().getBuildableCards(move.place.regionId, `${move.place.q},${move.place.r}`)
        if (matches.length) store().tryScoreCard(store().currentSeat, matches[0].cardId, move.place.regionId, `${move.place.q},${move.place.r}`)
      } else if (move.draw) {
        // tryDrawCard, not the void wrapper · a refusal is counted rather than inferred from the
        // action counter not moving, which cannot distinguish "refused" from "nothing to draw".
        const r = s.theOffer.length ? s.tryDrawCard(s.currentSeat, 'offer', 0) : s.tryDrawCard(s.currentSeat, 'deck', 0)
        if (!r.ok) {
          refusedDraws++
          // ⚠ AND THE POLICY MUST NOT ABSTAIN BECAUSE ITS CHOICE WAS REFUSED (T2 S68).
          // S45's `anyLegalMove` fallback fires only when a policy returns NULL. Under a price a
          // policy returns a perfectly well-formed draw that the ENGINE then refuses, and without
          // this branch the turn ends with the action unspent and the harness reports a hang · with
          // 24 legal placements on the board. Measured: drawHeavy "hung" 12/12 at turn 0 that way.
          // That is Rule 102a exactly (a policy may never refuse to play, or it manufactures
          // defects), arriving through a door S45 could not see because nothing could refuse then.
          const alt = anyLegalMove()
          if (alt?.place) {
            const p2 = alt.place
            store().placeElement(store().currentSeat, p2.factoryId, p2.type, p2.q, p2.r, p2.regionId)
            const m2 = store().getBuildableCards(p2.regionId, `${p2.q},${p2.r}`)
            if (m2.length) store().tryScoreCard(store().currentSeat, m2[0].cardId, p2.regionId, `${p2.q},${p2.r}`)
          }
        }
      }
      if (store().actionsRemaining === before) break
    }
    // BLIND SPOT 1 CLOSED: the turn ends only if the modelled gate permits it. If it does not, and no
    // action can be spent, the player is holding a turn they cannot finish · that is the S44 lock.
    if (!uiAllowsEndTurn(gate)) {
      return { outcome: 'hung', turns, refusedDraws, tilesAtTrigger, maxHand,
        // WHY the turn could not end · the whole point under a wallet, where "a card exists" and
        // "a card can be bought" stop being the same question.
        cardsExist: canDraw(), placements: legalPlacements().length,
        broke: store().players.every(p => (p.wallet ?? 0) < 70_000_000), state: snapshot() }
    }
    store().endTurn()
    turns++
    const st = store()
    if (st.endGameTriggered && tilesAtTrigger === null) tilesAtTrigger = st.productionTilesRemaining
    maxHand = Math.max(maxHand, ...st.players.map(p => p.hand.length))
  }
  return { outcome: store().phase === 'scoring' ? 'scoring' : 'capped', turns, tilesAtTrigger, maxHand,
    refusedDraws, state: snapshot() }
}

const snapshot = () => {
  const s = store()
  return {
    phase: s.phase, tiles: s.productionTilesRemaining, deck: s.deck.length, offer: s.theOffer.length,
    actions: s.actionsRemaining, triggered: s.endGameTriggered,
  }
}
