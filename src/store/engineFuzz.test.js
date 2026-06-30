import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'

// ── Engine fuzz · the headless "bot" for the ENGINE lane ──────────────────────────────────────
// The Playwright bot (scripts/bot-simulate.js) drives the UI and finds UI bugs (tutorial, selectors).
// This finds ENGINE bugs: it plays hundreds of random LEGAL games directly against the store and
// asserts the invariants a real game must hold — most importantly TERMINATION (every game reaches
// phase 'scoring'). A "game that never ends" (the forge's worry) shows up here as a stalled game.
//
// Determinism: a seeded PRNG (mulberry32) lives ONLY in this harness · the engine never uses it
// (rule 32). Any failure prints its seed, so it reproduces exactly.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const seededShuffle = (rng, arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

const store = () => useGameStore.getState()

// Hermetic store per test (T2 S24 · the forge's engineFuzz half b). Every test below calls initGame (a full
// reset), but resetting the singleton to its pristine initial state BEFORE each test makes the file
// independent of any state a prior test left behind · robust to ordering / cross-test pollution regardless
// of timeout headroom. zustand v5 getInitialState() returns the create() initializer's object (state +
// actions) and replace=true restores it wholesale · immer never mutates that base, so it stays pristine.
beforeEach(() => { useGameStore.setState(useGameStore.getInitialState(), true) })

// Every LEGAL placement available to the current seat right now (factory element × bordering region × valid hex).
function legalPlacements() {
  const s = store()
  const opts = []
  for (const f of s.factories) {
    const types = [...new Set(f.elements.filter(e => e.count > 0).map(e => e.type))]
    if (!types.length) continue
    for (const regionId of f.betweenRegions) {
      const targets = s.getValidPlacements(f.id, regionId)
      for (const t of targets) for (const type of types) opts.push({ factoryId: f.id, type, regionId, q: t.q, r: t.r })
    }
  }
  return opts
}

// One legal turn: prefer placements (this is what consumes production tiles → drives end-game),
// draw as a fallback, opportunistically score a real completion. Bounded so a harness bug can't spin.
// drainIdle (Flow · simultaneous draw): after the active seat plays, every OTHER seat draws into its OWN
// hand within its own 15s window — the real Flow mechanic (SIMULTANEOUS_DRAW) that empties the deck BEFORE
// the 9-tile clock runs out (the soft-lock precondition · T2 S20). A non-current draw is legal in Flow and
// never touches the active seat's action budget (drawCard · rule 65), so this stays faithful legal play.
function playTurn(rng, { drainIdle = false } = {}) {
  let guard = 0
  while (store().actionsRemaining > 0 && guard++ < 40) {
    const before = store().actionsRemaining
    const places = legalPlacements()
    if (places.length) {
      const m = pick(rng, places)
      store().placeElement(store().currentSeat, m.factoryId, m.type, m.q, m.r, m.regionId)
      const lastKey = `${m.q},${m.r}`
      const matches = store().getBuildableCards(m.regionId, lastKey)
      if (matches.length) store().tryScoreCard(store().currentSeat, matches[0].cardId, m.regionId, lastKey)
    } else {
      const s = store()
      if (s.theOffer.length) s.drawCard(s.currentSeat, 'offer', 0)
      else if (s.deck.length) s.drawCard(s.currentSeat, 'deck')
      else break // no placement and no card to draw · only End Turn remains
    }
    if (store().actionsRemaining === before) break // nothing consumed an action · don't spin
  }
  // Flow's simultaneous draw: idle seats burn their own draw windows each turn. This is precisely what makes
  // the deck run out before the 9-tile clock — the exact state maybeForceFlowEndgame exists to rescue (T2 S20).
  if (drainIdle) {
    // Draw aggressively (5 per idle window) so the 46-card supply empties BEFORE the 9-tile clock in a large
    // share of games — reproducing the S18 bot's "all cards in hands, tiles still on the board" soft-lock and
    // forcing the guard (not just the natural tile clock) to be what ends those games. Bounded · deterministic.
    const cur = store().currentSeat
    for (const p of store().players) {
      if (p.seat === cur) continue
      for (let k = 0; k < 5; k++) {
        if (store().theOffer.length) store().drawCard(p.seat, 'offer', 0)
        else if (store().deck.length) store().drawCard(p.seat, 'deck')
      }
    }
  }
  store().endTurn()
}

// mode (4th initGame arg · default undefined → Classic) selects the clock/draw rules. The existing Classic
// callers pass no opts → byte-identical play (undefined mode, no drain). drainAtStart (Flow soft-lock probe):
// empty the ENTIRE deck+offer into a hand BEFORE any tile is consumed (tiles still at max) — the most extreme
// "deck runs out before the clock" state. If engaged play still reaches scoring from there, the guard closes
// the soft-lock at EVERY tile count, not just the last (generalizes the 5 last-tile unit tests · T2 S20).
function playGame(seed, { mode, drainAtStart = false } = {}) {
  const rng = mulberry32(seed)
  store().initGame(
    [{ userId: 'A', username: 'BotA' }, { userId: 'B', username: 'BotB' }],
    seededShuffle(rng, PROJECT_CARDS),
    seededShuffle(rng, PRODUCTION_TILES),
    mode,
  )
  if (drainAtStart) {
    // Drain every card into the non-active seat's hand (legal Flow simultaneous draws · never touches the
    // active action budget). Tiles stay at max → the worst soft-lock precondition with NO clock progress yet.
    const drainSeat = 1
    while (store().deck.length) store().drawCard(drainSeat, 'deck')
    while (store().theOffer.length) store().drawCard(drainSeat, 'offer', 0)
  }
  const drainIdle = mode === 'flow' && !drainAtStart // already empty when drainAtStart · don't re-drain
  const nPlayers = 2
  const TURN_CAP = 600
  const violations = []
  let turns = 0, prevPhase = 'playing', prevTiles = store().productionTilesRemaining, endTriggeredAt = null

  while (store().phase === 'playing' && turns < TURN_CAP) {
    playTurn(rng, { drainIdle })
    turns++
    const s = store()
    if (!(Number.isInteger(s.currentSeat) && s.currentSeat >= 0 && s.currentSeat < nPlayers)) violations.push(`bad seat ${s.currentSeat} @${turns}`)
    if (s.actionsRemaining < 0 || s.actionsRemaining > 3) violations.push(`bad actions ${s.actionsRemaining} @${turns}`)
    if (!['playing', 'scoring'].includes(s.phase)) violations.push(`bad phase ${s.phase} @${turns}`)
    if (prevPhase === 'scoring' && s.phase !== 'scoring') violations.push(`phase regressed @${turns}`)
    if (s.productionTilesRemaining > prevTiles) violations.push(`tiles grew @${turns}`)
    for (const p of s.players) for (const sc of p.scores) if (sc < 0) violations.push(`negative score @${turns}`)
    prevPhase = s.phase; prevTiles = s.productionTilesRemaining
    if (s.endGameTriggered && endTriggeredAt === null) endTriggeredAt = turns
  }
  const s = store()
  return {
    seed, turns, terminated: s.phase === 'scoring', endGameTriggered: s.endGameTriggered,
    tilesLeft: s.productionTilesRemaining, deckLeft: s.deck.length, offerLeft: s.theOffer.length,
    roundsAfterTrigger: endTriggeredAt === null ? null : turns - endTriggeredAt,
    violations,
  }
}

// The LOAD-BEARING soft-lock reproduction (T2 S20). The fuzz above always drives tiles to 0, so the NATURAL
// tiles===0 trigger ends every game and the guard never has to fire — those tests pass with or without the fix.
// The real S18 freeze was different: the deck drained, the clock reached its LAST tile, and then placements
// STOPPED (the bot ran out of moves · 36 placed · tiles=1). Here the natural trigger is unreachable by
// construction (we never place once productionTilesRemaining hits 1), so maybeForceFlowEndgame is the ONLY thing
// that can end the game. With the guard removed this stalls on 'playing' forever — which is exactly the bug.
function playFlowStalled(seed) {
  const rng = mulberry32(seed)
  store().initGame(
    [{ userId: 'A', username: 'BotA' }, { userId: 'B', username: 'BotB' }],
    seededShuffle(rng, PROJECT_CARDS), seededShuffle(rng, PRODUCTION_TILES), 'flow',
  )
  // Empty the entire card supply into the idle seat (legal Flow simultaneous draws) · drawing can no longer move the game.
  while (store().deck.length) store().drawCard(1, 'deck')
  while (store().theOffer.length) store().drawCard(1, 'offer', 0)

  // Place greedily but NEVER once the clock is on its final tile · the precise instant the bot stalled. This
  // keeps the natural tiles===0 trigger permanently out of reach, isolating the guard as the only exit.
  let cap = 0, brokeEarly = false
  while (store().phase === 'playing' && store().productionTilesRemaining > 1 && cap++ < 600) {
    let placed = false
    while (store().actionsRemaining > 0 && store().productionTilesRemaining > 1) {
      const places = legalPlacements()
      if (!places.length) break
      const m = pick(rng, places)
      store().placeElement(store().currentSeat, m.factoryId, m.type, m.q, m.r, m.regionId)
      placed = true
    }
    store().endTurn()
    if (!placed && store().productionTilesRemaining > 1) { brokeEarly = true; break } // could not reduce the clock (board saturated?)
  }
  // Stalled at the last tile, supply gone · now go fully passive (End Turn only · no placements), like an idle
  // table. The guard must already have flipped endGameTriggered; endTurn's 2 endgame rounds then reach scoring.
  let passive = 0
  while (store().phase === 'playing' && passive++ < 12) store().endTurn()
  const s = store()
  return {
    seed, tilesLeft: s.productionTilesRemaining, deckLeft: s.deck.length, offerLeft: s.theOffer.length,
    endGameTriggered: s.endGameTriggered, terminated: s.phase === 'scoring', brokeEarly,
  }
}

describe('engine fuzz · random legal play', () => {
  test('N random full games · all reach scoring · zero invariant violations', () => {
    const N = 150
    const results = Array.from({ length: N }, (_, i) => playGame(i + 1))
    const stalled = results.filter(r => !r.terminated)
    const violated = results.filter(r => r.violations.length)
    const avg = Math.round(results.reduce((s, r) => s + r.turns, 0) / N)

    // eslint-disable-next-line no-console
    console.log(`[engine-fuzz] ${N} games · avg ${avg} turns · terminated ${N - stalled.length}/${N} · violated ${violated.length}`)
    if (stalled.length) console.log('  stalled:', stalled.slice(0, 6).map(r => `#${r.seed}(t=${r.turns},tilesLeft=${r.tilesLeft},endFlag=${r.endGameTriggered})`).join(' '))
    if (violated.length) console.log('  violations:', violated[0].violations.slice(0, 4))

    expect(violated).toEqual([])
    expect(stalled).toEqual([])
  })

  test('end-game, once triggered, always reaches scoring within 2 full rounds (4 endTurns)', () => {
    // Any game whose end-flag fired must have scored within <= 2*nPlayers endTurns of the trigger.
    const offenders = []
    for (let i = 1; i <= 60; i++) {
      const r = playGame(i * 7)
      if (r.endGameTriggered && r.terminated && r.roundsAfterTrigger != null && r.roundsAfterTrigger > 4) {
        offenders.push(`#${r.seed}(${r.roundsAfterTrigger})`)
      }
    }
    expect(offenders).toEqual([])
  })
})

// ── Flow-mode termination · the Flow analog of the Classic fuzz above (T2 S20) ─────────────────
// Flow's simultaneous draw (SIMULTANEOUS_DRAW) can empty the WHOLE deck+offer into players' hands BEFORE the
// 9-tile clock runs out. The tile clock — the only thing that natively sets endGameTriggered — advances only
// when a factory empties on a placement; once the deck is gone, drawing can no longer move the game, so if the
// final tile is never consumed the game would freeze on phase 'playing' forever (S18 bot: 56 in hands · 36
// placed · tilesRemaining=1 · endGameTriggered=false). The S19 guard (maybeForceFlowEndgame · gameStore.js)
// forces the SAME endGameTriggered flag once drawing is impossible (deck+offer empty) and only the last tile
// remains. flowModeEngine.test.js proves the guard FIRES in 5 hand-built states; the Classic fuzz above never
// exercises Flow (it calls initGame with no mode → Classic). These two tests close that gap: they prove the
// PROPERTY — engaged Flow play ALWAYS reaches scoring — across hundreds of random games and the worst-case
// fully-drained board, so a soft-lock at ANY tile count (not just the hand-built ones) would surface here.
describe('engine fuzz · Flow mode termination (T2 S20)', () => {
  test('N random Flow games · all reach scoring · zero invariant violations (idle seats drain the deck)', () => {
    const N = 150
    const results = Array.from({ length: N }, (_, i) => playGame(i + 1, { mode: 'flow' }))
    const stalled = results.filter(r => !r.terminated)
    const violated = results.filter(r => r.violations.length)
    const drainedEmpty = results.filter(r => r.deckLeft === 0 && r.offerLeft === 0).length // soft-lock state reached
    const avg = Math.round(results.reduce((s, r) => s + r.turns, 0) / N)

    // eslint-disable-next-line no-console
    console.log(`[flow-fuzz] ${N} games · avg ${avg} turns · terminated ${N - stalled.length}/${N} · deck-drained ${drainedEmpty}/${N} · violated ${violated.length}`)
    if (stalled.length) console.log('  stalled:', stalled.slice(0, 6).map(r => `#${r.seed}(t=${r.turns},tilesLeft=${r.tilesLeft},deckLeft=${r.deckLeft},endFlag=${r.endGameTriggered})`).join(' '))
    if (violated.length) console.log('  violations:', violated[0].violations.slice(0, 4))

    expect(violated).toEqual([])
    expect(stalled).toEqual([]) // the soft-lock is closed: no Flow game freezes on 'playing'
  }, 20000) // 150 Flow games · ~2s idle but ~6.2-6.9s under full-suite CPU contention · explicit budget so the
            // default 5s testTimeout cannot flake it (T2 S24 · forge half a · this ONE test only · not global)

  test('worst case · deck+offer fully drained BEFORE the clock still reaches scoring (every tile count)', () => {
    // The exact shape the S18 bot hit, generalized: every card in hands while tiles are still on the board.
    // Drain it all up front (tiles at 9), then play engaged. Reaching scoring from here proves the guard holds
    // at every tile count — not just the last — and that draining the deck early never strands the game.
    const offenders = []
    for (let i = 1; i <= 60; i++) {
      const r = playGame(i * 13, { mode: 'flow', drainAtStart: true })
      if (r.deckLeft !== 0 || r.offerLeft !== 0) offenders.push(`#${r.seed}:not-drained`) // precondition sanity
      if (!r.terminated) offenders.push(`#${r.seed}(stalled t=${r.turns},tilesLeft=${r.tilesLeft},endFlag=${r.endGameTriggered})`)
      if (r.violations.length) offenders.push(`#${r.seed}:${r.violations[0]}`)
    }
    expect(offenders).toEqual([])
  })

  // The load-bearing test: the two above prove broad termination but the natural tiles===0 trigger ends them,
  // so they pass with OR without the guard. This one reproduces the actual S18 freeze — clock on its last tile,
  // supply gone, placements stopped — where the natural trigger is unreachable and ONLY maybeForceFlowEndgame
  // can end the game. Verified to go RED when the guard is disabled (T2 S20 teeth check · rule 27).
  test('STALL at the last tile · supply gone, nobody makes the final placement → the guard still ends the game', () => {
    const offenders = []
    let reachedSoftlock = 0
    for (let i = 1; i <= 40; i++) {
      const r = playFlowStalled(i * 17)
      if (r.brokeEarly) { offenders.push(`#${r.seed}:board-saturated@tiles=${r.tilesLeft}`); continue } // the unreachable case · surface it loudly if it ever happens
      if (r.tilesLeft <= 1 && r.deckLeft === 0 && r.offerLeft === 0) reachedSoftlock++ // confirm we truly hit the freeze state
      if (!r.endGameTriggered) offenders.push(`#${r.seed}:endgame-NOT-forced(tiles=${r.tilesLeft})`)
      if (!r.terminated) offenders.push(`#${r.seed}:STALLED-on-playing(tiles=${r.tilesLeft},endFlag=${r.endGameTriggered})`)
    }
    expect(offenders).toEqual([])
    expect(reachedSoftlock).toBe(40) // every game genuinely reached the soft-lock state the guard must rescue
  })
})
