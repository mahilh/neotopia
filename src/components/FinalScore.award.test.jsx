import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// AWARD_GAME_WIN HAS A CALLER NOW (T2 S35).
//
// Migration 020 shipped in S33, was proven five ways against the live database, and was then invoked by
// NOTHING for two sessions. `games_won` has therefore read 0 for every player in the world · a value
// indistinguishable from "nobody has won yet", which is why nobody noticed. That is this project's
// signature bug wearing a new costume: a writer resting at a plausible number.
//
// The lesson from S33 is that the failure mode is never "it threw" · it is a success path that credits
// nobody. So these tests assert WHO IS ASKED and WHEN, on the false cases first:
//   · practice must never credit anybody (bots would win the real NeoTopia)
//   · a client with no session must not ask at all
//   · EVERY seat must ask, not just the lowest · that is the recovery path when the lowest closes its tab
//   · 'no_game_end' must be retried, because no client can see when a peer's audit row lands
//
// FILE OWNERSHIP: FinalScore.jsx is T1's. This test covers T2's wiring inside it and is flagged in comms
// rather than dropped, because an untested caller is exactly the gap that produced the bug it fixes.

const awardGameWin = vi.hoisted(() => vi.fn(async () => 'awarded'))
vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}),
  recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin,
}))

const FinalScore = (await import('./FinalScore')).default

const players = [
  { seat: 0, userId: 'u0', username: 'Zero', scores: [3, 0, 0], bonusTokens: [], scoredCardIds: ['card_01'] },
  { seat: 1, userId: 'u1', username: 'One', scores: [1, 0, 0], bonusTokens: [], scoredCardIds: [] },
]

const mount = (props) => render(
  <MemoryRouter><FinalScore players={players} regions={[]} {...props} /></MemoryRouter>,
)

// The effect awaits a promise; flush the microtask queue so the call is observable.
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

beforeEach(() => { awardGameWin.mockClear(); awardGameWin.mockImplementation(async () => 'awarded'); localStorage.clear() })
afterEach(() => { cleanup(); localStorage.clear() })

describe('award_game_win · the caller', () => {
  it('a PRACTICE game credits nobody · bots must not win the real NeoTopia', async () => {
    mount({ practice: true, mySeat: 0, sync: { sessionId: 'sess-1' } })
    await flush()
    expect(awardGameWin).not.toHaveBeenCalled()
  })

  it('no live session → no ask · a solo game has no winner to credit', async () => {
    mount({ mySeat: 0, sync: null })
    await flush()
    expect(awardGameWin).not.toHaveBeenCalled()
  })

  it('a real game asks, with the session id · verify the VALUE, not that a call happened (rule 61)', async () => {
    mount({ mySeat: 0, sync: { sessionId: 'sess-42' } })
    await flush()
    expect(awardGameWin).toHaveBeenCalledWith('sess-42')
  })

  it('EVERY seat asks · not just the lowest, unlike the game_end audit row', async () => {
    // The game_end row is written by the lowest seat alone, deliberately (one row, no duplicates). This
    // is the opposite call: the RPC is idempotent on a session_id primary key, so extra askers cost one
    // no-op each and buy the recovery path for the lowest seat closing its tab before the reveal.
    mount({ mySeat: 1, sync: { sessionId: 'sess-42' } })
    await flush()
    expect(awardGameWin).toHaveBeenCalledWith('sess-42')
  })

  it('asks exactly ONCE per client on re-render · the latch holds', async () => {
    const { rerender } = mount({ mySeat: 0, sync: { sessionId: 'sess-42' } })
    await flush()
    rerender(<MemoryRouter><FinalScore players={[...players]} regions={[]} mySeat={0} sync={{ sessionId: 'sess-42' }} /></MemoryRouter>)
    await flush()
    expect(awardGameWin).toHaveBeenCalledTimes(1)
  })

  it("'no_game_end' is RETRIED · a seat that asks before the peer's audit row lands must not give up", async () => {
    // The false case that would silently lose a winner: every seat asks once, every ask is early, nobody
    // retries, and games_won stays 0 while every client logged a clean status string.
    vi.useFakeTimers()
    awardGameWin.mockImplementation(async () => 'no_game_end')
    mount({ mySeat: 0, sync: { sessionId: 'sess-42' } })
    await act(async () => { await Promise.resolve() })
    expect(awardGameWin).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    expect(awardGameWin.mock.calls.length).toBeGreaterThan(1)
    vi.useRealTimers()
  })

  it('a terminal status stops the retry loop · a tie is an answer, not a failure', async () => {
    vi.useFakeTimers()
    awardGameWin.mockImplementation(async () => 'tie')
    mount({ mySeat: 0, sync: { sessionId: 'sess-42' } })
    await act(async () => { await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(awardGameWin).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
