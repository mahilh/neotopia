import { describe, test, expect } from 'vitest'
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
function playTurn(rng) {
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
  store().endTurn()
}

function playGame(seed) {
  const rng = mulberry32(seed)
  store().initGame(
    [{ userId: 'A', username: 'BotA' }, { userId: 'B', username: 'BotB' }],
    seededShuffle(rng, PROJECT_CARDS),
    seededShuffle(rng, PRODUCTION_TILES),
  )
  const nPlayers = 2
  const TURN_CAP = 600
  const violations = []
  let turns = 0, prevPhase = 'playing', prevTiles = store().productionTilesRemaining, endTriggeredAt = null

  while (store().phase === 'playing' && turns < TURN_CAP) {
    playTurn(rng)
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
    tilesLeft: s.productionTilesRemaining,
    roundsAfterTrigger: endTriggeredAt === null ? null : turns - endTriggeredAt,
    violations,
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
