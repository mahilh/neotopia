// THE BADGE COUNT · found by PLAYING the game, not by testing it (T1 S70).
//
// ── THE MEASUREMENT ──────────────────────────────────────────────────────────────────────────────
// A real priced game at 1280, played to turn 9 by buying a card every action · the simplest strategy
// there is · with the wallet spent from $1B down to $20M:
//     hand 17 · fullyVisible 2 · near-miss cards 6 · OF THOSE VISIBLE: 0
//     badge indices [2, 5, 6, 9, 11, 14] · the strip shows indices 0 and 1
// Six cards were one placement from completing and not one was on screen.
//
// NOTHING WAS WRONG WITH EITHER PIECE. The badge (S66) is correct, the strip (S65/S66) is correct,
// and 2 fully visible is the number Council accepted as the comparison requirement. What nobody
// measured is the COMPOSITION, and 17 is not an outlier: it is 3 starting cards plus the 14
// purchases the wallet permits, i.e. the CEILING, reached by the least imaginative play available.
//
// ⚠ THIS FILE GATES A MITIGATION, AND SAYS SO. A count tells the player the badges exist; it does
// not put them on screen. The real tension · a 17-card ceiling against a 2-card window · is a
// question about the wallet's size and belongs to Council, not to a label.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { completableStatePatch } from './scorePendingFixture'

vi.mock('../lib/supabase', () => ({
  supabase: {}, GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823, getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}), recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const GameRoom = (await import('./GameRoom')).default
const until = async (fn, tries = 120) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const count = () => document.querySelector('[data-testid="hand-nearmiss-count"]')
const badges = () => document.querySelectorAll('[data-testid="card-hand"] [data-near-miss]').length

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

async function mount() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the count is absent when there is nothing to count', () => {
  it('a fresh board shows no count at all', async () => {
    // If it rendered unconditionally, every assertion below would pass for the wrong reason and the
    // label would carry a permanent "· 0 close" that teaches a player to ignore it.
    await mount()
    expect(screen.queryAllByTestId('card-hand').length, 'no hand · the absence proves nothing')
      .toBeGreaterThan(0)
    expect(badges(), 'a fresh board already shows badges · the fixture is not the state I think').toBe(0)
    expect(count(), 'the label counts near-misses on a board where nothing is placed').toBeNull()
  })
})

describe('the count equals the badges, because it reads the same map', () => {
  it('appears with the badges and matches them exactly', async () => {
    // Rule 45/92: the count and the cards come from ONE memo, so they cannot disagree. Asserting
    // EQUALITY rather than presence is what makes that structural claim checkable · a count that
    // merely appeared would satisfy "there is a count" and could still say 3 when 6 are badged.
    await mount()
    const st = useGameStore.getState()
    const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
    const seed = completableStatePatch(st.regions, hand, 0)
    expect(seed, 'the fixture could not make any hand card one-away · UNMEASURED, not a pass').not.toBeNull()
    await act(async () => { useGameStore.setState({ ...seed.patch, actionsRemaining: 3 }, false) })
    await until(() => badges() > 0)

    expect(count(), 'cards are badged and the label says nothing · the player has no way to know ' +
      'they exist, which is the entire defect this was built for').not.toBeNull()
    const n = badges()
    expect(count().textContent, `${n} cards are badged and the label reads "${count().textContent}"`)
      .toContain(String(n))
  })

  it('and it uses the badge\'s own word · one vocabulary, not two', async () => {
    // "close" is what the badge means (N OF M PLACED). A label saying "ready" or "buildable" would
    // be a second name for one idea, and the player has to connect them across two surfaces.
    await mount()
    const st = useGameStore.getState()
    const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
    const seed = completableStatePatch(st.regions, hand, 0)
    expect(seed).not.toBeNull()
    await act(async () => { useGameStore.setState({ ...seed.patch, actionsRemaining: 3 }, false) })
    await until(() => count() !== null)
    expect(count().textContent.toLowerCase()).toMatch(/close/)
  })

  it('and it is the BADGE colour, so the two read as one thing', async () => {
    await mount()
    const st = useGameStore.getState()
    const hand = st.players.find(p => p.seat === st.currentSeat)?.hand ?? []
    const seed = completableStatePatch(st.regions, hand, 0)
    expect(seed).not.toBeNull()
    await act(async () => { useGameStore.setState({ ...seed.patch, actionsRemaining: 3 }, false) })
    await until(() => count() !== null)
    // rgba(255,180,50,0.95) · the same amber CardFrame paints the badge in and the board paints the
    // near-miss ring in. Read off the style rather than retyped in two places would be better still;
    // this at least fails loudly if somebody makes it neutral grey.
    expect(count().style.color.replace(/\s/g, '')).toContain('255,180,50')
  })
})
