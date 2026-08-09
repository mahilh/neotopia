import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from '../store/gameStore'
import { PROJECT_CARDS } from './projectCards'
import { chooseBotAction, enumeratePlacements, makeRng, DIFFICULTIES } from './botPolicy'

// Deterministic shuffle so a win-rate measurement measures the POLICY, not one lucky deck.
function shuffled(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const api = () => useGameStore.getState()

function startGame(configs, seed) {
  const rng = makeRng(seed)
  api().initGame(configs, shuffled(PROJECT_CARDS, rng), shuffled(PRODUCTION_TILES, rng))
  return rng
}

/** Play one whole game with every seat driven by its own policy. Returns final scores by seat. */
function playOut(configs, seed, maxActions = 4000) {
  const rng = startGame(configs, seed)
  let lastPlacedKey = null
  for (let i = 0; i < maxActions && api().phase === 'playing'; i++) {
    const s = api()
    const seat = s.currentSeat
    const cfg = configs[seat]
    const action = chooseBotAction({
      state: s, seat, difficulty: cfg.difficulty,
      getValidPlacements: s.getValidPlacements, getBuildableCards: s.getBuildableCards,
      lastPlacedKey, rng,
    })
    switch (action.type) {
      case 'placeElement':
        api().placeElement(seat, action.factoryId, action.elementType, action.q, action.r, action.regionId)
        lastPlacedKey = `${action.q},${action.r}`
        break
      case 'scoreCard':
        api().scoreCard(seat, action.cardId, action.regionId, action.lastPlacedKey)
        lastPlacedKey = null
        break
      case 'drawCard':
        api().drawCard(seat, action.source, action.cardIndex)
        break
      default:
        api().endTurn()
        lastPlacedKey = null
    }
  }
  return { phase: api().phase, scores: configs.map((_, seat) => api().getFinalScore(seat)) }
}

const bots = (...levels) => levels.map((difficulty, i) => ({
  userId: null, username: `Bot${i}`, isBot: true, difficulty,
}))

describe('bot policy · practice mode', () => {
  beforeEach(() => { useGameStore.setState(useGameStore.getInitialState(), true) })

  test('initGame marks a bot seat and leaves a human seat shape untouched', () => {
    api().initGame(
      [{ userId: 'u0', username: 'Human' }, { userId: null, username: 'Sol', isBot: true, difficulty: 'architect' }],
      PROJECT_CARDS, PRODUCTION_TILES)
    const [human, bot] = api().players
    // The human seat must NOT gain the keys · tests/seededState.guard.test.js pins that shape.
    expect(Object.prototype.hasOwnProperty.call(human, 'isBot')).toBe(false)
    expect(bot.isBot).toBe(true)
    expect(bot.difficulty).toBe('architect')
    expect(bot.color).toBe('red') // an ordinary seat · same SEAT_COLORS list
  })

  test('a bot never proposes an illegal placement', () => {
    startGame(bots('builder', 'builder'), 7)
    const s = api()
    for (const p of enumeratePlacements(s, s.getValidPlacements)) {
      const legal = s.getValidPlacements(p.factoryId, p.regionId)
      expect(legal.some(h => h.q === p.q && h.r === p.r)).toBe(true)
    }
  })

  test('every difficulty drives a complete game to scoring · no soft-lock', () => {
    for (const level of DIFFICULTIES) {
      useGameStore.setState(useGameStore.getInitialState(), true)
      const r = playOut(bots(level, level), 42)
      expect(r.phase, `${level} stalled on '${r.phase}'`).toBe('scoring')
    }
  })

  test('the policy reads no hidden information', () => {
    // A real guard, not a comment: the source must never touch another seat's hand or the deck order.
    // (deck.length is fine · that is the visible clock. deck[0] / .hand of a foreign seat is not.)
    const src = chooseBotAction.toString() + enumeratePlacements.toString()
    expect(src).not.toMatch(/deck\s*\[/)
    expect(src).not.toMatch(/players\s*\.\s*(map|filter|forEach)[^)]*hand/)
  })

  test('difficulty is ORDERED · seat-controlled, measured, and the control sits at 50%', () => {
    // THE GATE THAT MATTERS, and my first version of it was VACUOUS. It played each matchup with the
    // strong policy always in seat 1, so it was measuring TURN-ORDER ADVANTAGE: it passed unchanged
    // when every level was collapsed into one. Only the teeth check caught that.
    // Fixed by mirroring · every matchup is played both ways with the same seed, so seat advantage
    // cancels exactly. The identical-vs-identical control below is the proof the harness is fair:
    // builder vs builder must land at 50%, and with the levels collapsed EVERY row becomes that row.
    const run = (weak, strong, seeds) => {
      let strongWins = 0, decisive = 0
      for (let seed = 1; seed <= seeds; seed++) {
        for (const flip of [false, true]) {
          useGameStore.setState(useGameStore.getInitialState(), true)
          const r = playOut(flip ? bots(strong, weak) : bots(weak, strong), seed)
          if (r.phase !== 'scoring') continue
          const s = flip ? r.scores[0] : r.scores[1]
          const w = flip ? r.scores[1] : r.scores[0]
          if (s === w) continue
          decisive++
          if (s > w) strongWins++
        }
      }
      return { rate: decisive ? strongWins / decisive : 0, decisive }
    }

    // Measured over 20 seeds x both seatings this session:
    //   apprentice vs builder   92%   ·  apprentice vs architect  100%
    //   builder    vs architect 98%   ·  builder    vs builder     50%  (control)
    for (const [weak, strong] of [['apprentice', 'builder'], ['apprentice', 'architect'], ['builder', 'architect']]) {
      const { rate, decisive } = run(weak, strong, 8)
      expect(decisive, `${weak} vs ${strong} · too few decisive games to measure`).toBeGreaterThan(8)
      expect(rate, `${strong} did not out-play ${weak} · ${Math.round(rate * 100)}%`).toBeGreaterThan(0.65)
    }

    // The control. Same policy both sides must be a coin flip · if this drifts, the harness is biased
    // and every number above is worthless.
    const control = run('builder', 'builder', 8)
    expect(control.rate).toBeGreaterThan(0.3)
    expect(control.rate).toBeLessThan(0.7)
  }, 30000) // 64 full games. 3.3s in isolation, 7.1s under full-suite contention · it FAILED the first
            // full run on the 5s default, which is the same trap I fixed for engineFuzz one session ago
            // and then walked straight into. Sized on the measured contended number with headroom.
})
