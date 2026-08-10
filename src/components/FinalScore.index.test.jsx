import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Refreshing your own score screen used to inflate the civilization ────────────────────────────
// T3 measured it live three times in S37: `neotopia_index` 3 → 6, 3 → 6, 2 → 4. The delta is always
// exactly the player's district count, and refreshing twice triples it.
//
// `increment_neotopia_index` (migration 004) is a BARE increment · it clamps one call to [0,56] and
// carries no idempotency key at all. Its only guard was `didRecordRef`, a useRef, and a page reload
// destroys those. Reloading a final score screen is an ordinary thing for a person to do, and this
// is the number the Landing page leads with.
//
// It is the ONLY unprotected write on that screen, which is what makes it an oversight rather than a
// choice: record_civilization_score is UNIQUE(session_id, player_id) ON CONFLICT DO NOTHING,
// award_game_win is keyed on game_wins.session_id, and the game_end audit row was given an explicit
// per-room localStorage guard for precisely this case.
//
// A REMOUNT IS THE HONEST SIMULATION OF A RELOAD: fresh component, fresh refs, same localStorage.
// That is exactly what a browser does, and it is what defeats a useRef.

const recordCivilizationContribution = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution,
  recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))

const FinalScore = (await import('./FinalScore')).default

const players = [
  { seat: 0, userId: 'u0', username: 'Zero', scores: [3, 0, 0], bonusTokens: [], scoredCardIds: ['card_01', 'card_02', 'card_03'] },
  { seat: 1, userId: 'u1', username: 'One', scores: [1, 0, 0], bonusTokens: [], scoredCardIds: ['card_04'] },
]
const sync = { sessionId: 'sess-abc', pushState: vi.fn(async () => {}) }

const mount = (props = {}) => render(
  <MemoryRouter>
    <FinalScore players={players} mySeat={0} sync={sync} roomId="room-1" regions={[]} {...props} />
  </MemoryRouter>,
)
const settle = async () => { await act(async () => { await new Promise(r => setTimeout(r, 30)) }) }

beforeEach(() => { localStorage.clear(); recordCivilizationContribution.mockClear() })
afterEach(() => { cleanup(); localStorage.clear() })

describe('the district contribution survives a reload without doubling', () => {
  it('records once on the first view', async () => {
    mount()
    await settle()
    expect(recordCivilizationContribution).toHaveBeenCalledTimes(1)
    expect(recordCivilizationContribution).toHaveBeenCalledWith(3)
  })

  it('does NOT record again when the same player reloads that screen', async () => {
    mount(); await settle()
    cleanup()                       // the reload · the ref goes with it
    mount(); await settle()

    // FALSE CASE, measured live by T3: two calls, and the index reads 6 for a player who built 3.
    expect(recordCivilizationContribution,
      'a refresh contributed a second time · the civilization index inflates by the district count')
      .toHaveBeenCalledTimes(1)
  })

  it('does not record a third time on a second reload · this used to TRIPLE', async () => {
    mount(); await settle(); cleanup()
    mount(); await settle(); cleanup()
    mount(); await settle()
    expect(recordCivilizationContribution).toHaveBeenCalledTimes(1)
  })

  it('keys the guard on the SESSION and the seat, not on the browser', async () => {
    mount(); await settle()
    const keys = Object.keys(localStorage).filter(k => k.startsWith('neotopia_index_'))
    expect(keys, 'no guard was written · the next reload doubles').toHaveLength(1)
    expect(keys[0]).toBe('neotopia_index_sess-abc_0')
    // What it stored is the contribution itself, so the record is readable rather than a bare flag.
    expect(localStorage.getItem(keys[0])).toBe('3')
  })

  it('lets a DIFFERENT game contribute · the guard must not be a permanent mute', async () => {
    mount(); await settle()
    cleanup()
    // A second game, i.e. a new session. FALSE CASE: keying on the browser or the room would silence
    // every future contribution this player ever makes, which is worse than double-counting.
    mount({ sync: { ...sync, sessionId: 'sess-xyz' } }); await settle()
    expect(recordCivilizationContribution).toHaveBeenCalledTimes(2)
  })

  it('lets a different SEAT contribute · two people on one browser are two contributors', async () => {
    mount(); await settle()
    cleanup()
    mount({ mySeat: 1 }); await settle()
    expect(recordCivilizationContribution).toHaveBeenCalledTimes(2)
    expect(recordCivilizationContribution).toHaveBeenLastCalledWith(1)
  })

  it('still never records for a practice game', async () => {
    // The S33 guarantee, re-asserted because this effect just grew a branch: bots must never build
    // the real NeoTopia, and a new early-return is exactly where that could be lost.
    mount({ practice: true }); await settle()
    expect(recordCivilizationContribution).not.toHaveBeenCalled()
    expect(Object.keys(localStorage).filter(k => k.startsWith('neotopia_index_'))).toHaveLength(0)
  })

  it('still records when storage is unavailable · a blocked browser must not lose the write', async () => {
    // Private modes throw on localStorage. The guard is an improvement, not a precondition · falling
    // back to the ref is exactly the behaviour that shipped before, which is the right floor.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    mount(); await settle()
    expect(recordCivilizationContribution).toHaveBeenCalledTimes(1)
    spy.mockRestore(); setSpy.mockRestore()
  })
})
