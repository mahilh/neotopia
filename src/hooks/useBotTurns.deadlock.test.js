// The bot deadlock · found by playing a practice game, not by reading (T1 S33).
//
// T2 owns useBotTurns.js. This file is T1's, added alongside it rather than into T2's own suite,
// because the bug it pins was invisible from inside either lane and belongs with the code it guards.
//
// WHAT HAPPENED. The driver latched on `${currentSeat}:${actionsRemaining}:${phase}` to survive
// StrictMode's double-invoked effects. Scoring a card changes NONE of those three · tryScoreCard
// removes the card from hand, adds the points, pushes scoredCardIds and stamps the region, and
// deliberately spends no action, because a district is the consequence of a placement rather than an
// action of its own. What it does change is the identity of `players`, which is in the effect's deps.
// So the effect re-ran, computed the same key, returned early · and the cleanup on that re-run had
// already cleared the pending timer. Nothing ever rescheduled it.
//
// Every bot froze permanently the first time it built a district. Both lanes were green throughout,
// because no test had ever put a bot in front of a scorable board.
//
// NAMING THE FALSE CASE FIRST. The failure is not an exception and not a wrong move · it is silence.
// A frozen seat looks exactly like a bot that is still thinking, so every assertion below is about the
// game CONTINUING, and each one is written so that "nothing happened" is the red.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../store/gameStore'
import { DECK } from '../lib/projectCards'
import { seatSignature, useBotTurns } from './useBotTurns'

const chooseBotAction = vi.hoisted(() => vi.fn())
vi.mock('../lib/botPolicy', async (importOriginal) => ({
  ...(await importOriginal()),
  chooseBotAction,
}))

const BOT_SEAT = 1
const seatOf = (n) => useGameStore.getState().players.find(p => p.seat === n)

beforeEach(() => {
  vi.useFakeTimers()
  chooseBotAction.mockReset()
  useGameStore.getState().initGame(
    [{ userId: 'local-human', username: 'You' }, { userId: 'local-bot-1', username: 'Bot 1', isBot: true }],
    shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
  )
  useGameStore.setState({ currentSeat: BOT_SEAT }, false)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

// ONE bot action per tick. The first draft advanced 800ms against a 10ms delay, which let the bot spend
// all three actions and correctly end its own turn · actionsRemaining was back to 3 and the test read
// that as "it never moved". The window has to be narrower than the thing being measured.
const tick = async (ms = 25) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

describe('seatSignature · the latch has to notice a district being built', () => {
  it('changes when a card is scored, though seat, actions and phase do not', () => {
    const before = seatSignature(seatOf(BOT_SEAT), BOT_SEAT, 3, 'playing')
    act(() => {
      // Exactly what tryScoreCard leaves behind: one card out of hand, one district recorded, and
      // not a single action spent.
      useGameStore.setState(s => ({
        players: s.players.map(p => p.seat === BOT_SEAT
          ? { ...p, hand: p.hand.slice(1), scoredCardIds: [...p.scoredCardIds, 'card_01'] }
          : p),
      }), false)
    })
    const after = seatSignature(seatOf(BOT_SEAT), BOT_SEAT, 3, 'playing')
    // FALSE CASE · this is the assertion that was false in production: the two were equal, so the
    // driver believed it had already handled this state and stopped.
    expect(after, 'a built district must be visible to the latch').not.toBe(before)
  })

  it('is stable for identical state, so StrictMode is still protected', () => {
    // The widening must not cost the property the latch exists for · a double-invoked effect with an
    // unchanged store must still be recognised as the same tick, or every bot moves twice in dev.
    const a = seatSignature(seatOf(BOT_SEAT), BOT_SEAT, 3, 'playing')
    const b = seatSignature(seatOf(BOT_SEAT), BOT_SEAT, 3, 'playing')
    expect(a).toBe(b)
  })
})

describe('useBotTurns · the seat keeps moving', () => {
  it('acts again after a change that costs no action · the exact deadlock', async () => {
    chooseBotAction.mockReturnValue({ type: 'drawCard', seat: BOT_SEAT, source: 'deck', cardIndex: 0 })
    renderHook(() => useBotTurns({ delayMs: 10 }))

    // DECISIONS, not actionsRemaining. The obvious assertion · "it spent another action" · is unusable
    // here, because a bot that runs out of actions ends its turn and endTurn RESETS the counter to 3.
    // The measurement has to be monotonic; how many times the seat was asked what to do is.
    await tick(12)
    const decisionsBefore = chooseBotAction.mock.calls.length
    expect(decisionsBefore, 'the bot never took its first action').toBeGreaterThan(0)

    // A free, players-only mutation · a scored district in everything but name. Under the old key this
    // re-ran the effect, matched, and silently cancelled the pending timer.
    act(() => {
      useGameStore.setState(s => ({
        players: s.players.map(p => p.seat === BOT_SEAT
          ? { ...p, scoredCardIds: [...p.scoredCardIds, 'card_01'] } : p),
      }), false)
    })

    await tick(12)
    expect(chooseBotAction.mock.calls.length,
      'the bot was never asked again after a move that cost no action · this is the deadlock')
      .toBeGreaterThan(decisionsBefore)
  })

  it('passes the turn rather than freezing when its chosen move is refused', async () => {
    // The safety net, and the reason it is worth having: every store action validates and can refuse
    // silently. A refusal leaves the signature untouched, so without this the latch never re-arms and
    // the game stops with no error anywhere. placeElement into an occupied centre is a real refusal,
    // not a fabricated one.
    const region = useGameStore.getState().regions[0]
    chooseBotAction.mockReturnValue({
      type: 'placeElement', seat: BOT_SEAT, factoryId: 0, elementType: 'energy',
      q: region.center.q, r: region.center.r, regionId: 2, // factory 0 does not border region 2
    })
    renderHook(() => useBotTurns({ delayMs: 10 }))

    const before = useGameStore.getState()
    await tick()
    const after = useGameStore.getState()
    expect(after.actionsRemaining, 'a refused move must not be charged').toBe(before.actionsRemaining)
    // FALSE CASE: the seat is still 1 and nothing is scheduled · a board that never moves again.
    expect(after.currentSeat, 'a bot that cannot move must hand the turn on, not stop the game')
      .not.toBe(BOT_SEAT)
  })

  it('stays inert when no seat is a bot', async () => {
    // Without this, the two tests above would pass on a driver that simply ran for everyone · which
    // would take over a real player's turn in a real room.
    useGameStore.getState().initGame(
      [{ userId: 'a', username: 'A' }, { userId: 'b', username: 'B' }],
      shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
    )
    useGameStore.setState({ currentSeat: 1 }, false)
    chooseBotAction.mockReturnValue({ type: 'drawCard', seat: 1, source: 'deck', cardIndex: 0 })
    renderHook(() => useBotTurns({ delayMs: 10 }))
    await tick()
    expect(chooseBotAction).not.toHaveBeenCalled()
    expect(useGameStore.getState().actionsRemaining).toBe(3)
    expect(useGameStore.getState().currentSeat).toBe(1)
  })
})
