import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { useGameStore } from '../store/gameStore'
import MilestoneOverlay from './MilestoneOverlay'

// ── THE CELEBRATION WAS FIRING FOR THE OPPONENT (T1 S44) ─────────────────────────────────────────
// A browser audit watched a bot score and got the full treatment: a full-screen gold starburst,
// "Nine points · a quarter of the city, finished", FIRST BLOCKS DONE. It then watched the PLAYER
// score and got a line in the action log.
//
// The cause was not a missing feature. The store has ALWAYS stamped the seat ·
// `sacredMilestone = { player: seat, ... }` · and this component destructured `{ milestone, symbol,
// message }` and dropped `player` on the floor. So the party was thrown for whoever crossed, with no
// way for the player to tell whose it was. Rule 61 in a costume: the value was there and nobody read
// it.
//
// DELETING IT ON AN OPPONENT'S CROSSING WOULD ALSO BE WRONG · a rival reaching nine is real
// information. So it is attributed instead, and the two do not look alike.

const setMilestone = (player) => useGameStore.setState({
  sacredMilestone: { player, milestone: 9, symbol: '✷', message: 'a quarter of the city, finished' },
}, false)

afterEach(() => {
  cleanup()
  useGameStore.setState({ sacredMilestone: null }, false)
})

describe('a milestone says whose it is', () => {
  it('celebrates MY crossing · full screen, the symbol, the phrase', () => {
    setMilestone(0)
    render(<MilestoneOverlay mySeat={0} />)
    const el = screen.getByTestId('milestone-overlay')
    expect(el.getAttribute('data-milestone-owner')).toBe('me')
    expect(el.textContent).toContain('a quarter of the city')
    expect(screen.getByTestId('milestone-phrase')).toBeTruthy()
    expect(el.style.justifyContent, 'my moment takes the middle of the screen').toBe('center')
  })

  it('reports THEIR crossing as news · not as my triumph', () => {
    // FALSE CASE, and the shipped one: identical to the above. The player watches a full-screen gold
    // celebration of somebody else's points and has no way to know it was not theirs.
    useGameStore.setState({ players: [{ seat: 0, username: 'You' }, { seat: 1, username: 'Rival' }] }, false)
    setMilestone(1)
    render(<MilestoneOverlay mySeat={0} />)
    const el = screen.getByTestId('milestone-overlay')
    expect(el.getAttribute('data-milestone-owner')).toBe('opponent')
    expect(screen.getByTestId('milestone-owner').textContent).toMatch(/rival reached 9/i)
    expect(screen.queryByTestId('milestone-phrase'),
      'FIRST BLOCKS DONE is the players own progress · it must not fire for a rival').toBeNull()
    expect(el.textContent, "the opponent's notice must not carry my celebration copy")
      .not.toContain('a quarter of the city')
  })

  it('names the rival by their real username', () => {
    useGameStore.setState({ players: [{ seat: 0, username: 'You' }, { seat: 2, username: 'Bot Builder' }] }, false)
    setMilestone(2)
    render(<MilestoneOverlay mySeat={0} />)
    expect(screen.getByTestId('milestone-owner').textContent).toContain('Bot Builder')
  })

  // THE COUNTERWEIGHT, written against the cheap fix: "only show it when player === mySeat" passes
  // both tests above and silently deletes the celebration for every solo and practice game, where
  // mySeat is null. That is the S32 lesson · null stops meaning "solo" the moment a second seat
  // exists, and it means it again when one does not.
  it('still celebrates in a game with no seat concept · mySeat null is SOLO, not "not mine"', () => {
    setMilestone(0)
    render(<MilestoneOverlay />)
    const el = screen.getByTestId('milestone-overlay')
    expect(el.getAttribute('data-milestone-owner'),
      'a solo player lost their own celebration to a null check').toBe('me')
    expect(screen.getByTestId('milestone-phrase')).toBeTruthy()
  })

  it('renders nothing at all when there is no milestone', () => {
    useGameStore.setState({ sacredMilestone: null }, false)
    render(<MilestoneOverlay mySeat={0} />)
    expect(screen.queryByTestId('milestone-overlay')).toBeNull()
  })
})
