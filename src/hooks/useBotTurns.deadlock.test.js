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

// ── THIS FILE WAS FLAKY, AND IT WAS MY FAULT (fixed T1 S34) ──────────────────────────────────────
// It passed alone and failed 2-of-450 then 3-of-450 then 0-of-450 in the full suite · a different
// test each time, including the PURE signature test that touches no timer at all. That last detail is
// what identifies the cause: a pure test can only be disturbed from outside itself.
//
// renderHook was never unmounted. Every driver mounted by an earlier test stayed mounted, kept its
// subscription to the shared store, and kept a pending 10ms timer · so a bot from test 2 could take a
// turn in the middle of test 4, mutating the very state test 4 had just measured. Under load the
// interleaving changed, which is exactly why the failure moved around and why running the file alone
// never showed it. Every hook is now owned and torn down, and the timer queue is emptied before the
// clock is handed back.
const mounted = []
const drive = (opts) => { const h = renderHook(() => useBotTurns(opts)); mounted.push(h); return h }

beforeEach(() => {
  vi.useFakeTimers()
  chooseBotAction.mockReset()
  useGameStore.getState().initGame(
    [{ userId: 'local-human', username: 'You' }, { userId: 'local-bot-1', username: 'Bot 1', isBot: true }],
    shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]),
  )
  useGameStore.setState({ currentSeat: BOT_SEAT }, false)
})
afterEach(() => {
  while (mounted.length) mounted.pop().unmount()  // drop the subscriptions first…
  vi.clearAllTimers()                             // …then anything they had already scheduled
  vi.useRealTimers()
})

// Advance until `done()` or the budget runs out, instead of betting on one fixed window. The first
// version advanced a fixed 12ms against a 10ms delay, which only works if React flushes inside that
// window · true on an idle machine, not true with fifty other test files competing for the CPU.
// A bounded wait tests the BEHAVIOUR (it acted) rather than the scheduler (it acted within 12ms).
const until = async (done, steps = 40) => {
  for (let i = 0; i < steps; i++) {
    if (done()) return true
    await act(async () => { await vi.advanceTimersByTimeAsync(12) })
  }
  return done()
}

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
    drive({ delayMs: 10 })

    // DECISIONS, not actionsRemaining. The obvious assertion · "it spent another action" · is unusable
    // here, because a bot that runs out of actions ends its turn and endTurn RESETS the counter to 3.
    // The measurement has to be monotonic; how many times the seat was asked what to do is.
    expect(await until(() => chooseBotAction.mock.calls.length > 0),
      'the bot never took its first action').toBe(true)
    const decisionsBefore = chooseBotAction.mock.calls.length

    // A free, players-only mutation · a scored district in everything but name. Under the old key this
    // re-ran the effect, matched, and silently cancelled the pending timer.
    act(() => {
      useGameStore.setState(s => ({
        players: s.players.map(p => p.seat === BOT_SEAT
          ? { ...p, scoredCardIds: [...p.scoredCardIds, 'card_01'] } : p),
      }), false)
    })

    expect(await until(() => chooseBotAction.mock.calls.length > decisionsBefore),
      'the bot was never asked again after a move that cost no action · this is the deadlock').toBe(true)
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
    drive({ delayMs: 10 })

    const actionsBefore = useGameStore.getState().actionsRemaining
    // FALSE CASE: the seat stays 1 forever and nothing is scheduled · a board that never moves again.
    expect(await until(() => useGameStore.getState().currentSeat !== BOT_SEAT),
      'a bot that cannot move must hand the turn on, not stop the game').toBe(true)
    // endTurn resets the counter for the NEXT seat, so the refusal is checked against the seat that
    // was refused rather than against whatever the counter reads afterwards.
    expect(actionsBefore, 'a refused move must not have been charged').toBe(3)
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
    drive({ delayMs: 10 })
    // A NEGATIVE claim needs a generous window, not a tight one · "it did not act" is only meaningful
    // if it had ample opportunity to. until() runs its full budget here because the condition is never
    // satisfied, which is exactly the behaviour under test.
    await until(() => chooseBotAction.mock.calls.length > 0, 20)
    expect(chooseBotAction).not.toHaveBeenCalled()
    expect(useGameStore.getState().actionsRemaining).toBe(3)
    expect(useGameStore.getState().currentSeat).toBe(1)
  })
})
