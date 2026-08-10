import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import Tutorial from './Tutorial'
import { useGameStore } from '../store/gameStore'
import { GAME_MODES } from '../store/gameConfig'

afterEach(cleanup)

// ── Drawing and placing are not equal, and the first step used to say they were ──────────────────
// Gap 1 of docs/TUTORIAL_GAP_AUDIT.md, and the audit called it the highest-value fix on the list.
// The evidence is a real game: Mahil reached turn 3 with HAND 7 and every region on zero. He drew
// seven cards and built nothing. That is not a player misreading the tutorial · it is a player doing
// exactly what step 1 invited, three times a turn, for three turns.
//
// The asymmetry is mechanical, not stylistic. Only a placement can score: a hand card is inert until
// the board matches it, and the board only changes by placing. And the two cost wildly different
// effort · one click on a big illustrated card versus four clicks across two panels. Told they are
// interchangeable, a new player takes the cheap one every time.
//
// NAMING THE FALSE CASE: this does not fail loudly. It fails as a player who follows the
// instructions carefully and scores nothing, and concludes the game is the thing that is broken.

const step1 = () => {
  render(<Tutorial onDismiss={() => {}} />)
  return screen.getByRole('dialog', { name: /how to play/i }).textContent
}

describe('the first thing a player is told about their turn', () => {
  it('says that only placing can score', () => {
    const text = step1()
    expect(text, 'the one mechanical fact that decides whether a first game scores at all')
      .toMatch(/only a placement can score/i)
  })

  it('says what a drawn card is actually for', () => {
    // FALSE CASE: the player believes a drawn card IS progress. Seven of them are not.
    expect(step1(), 'a card in hand has to be named as a plan, not as a result')
      .toMatch(/scores nothing on its own|build later/i)
  })

  it('no longer offers the two as an either/or', () => {
    // The exact shape of the old copy: "draw a project card from the Offer, or move an element from
    // a factory onto the board" · two moves joined by `or`, with nothing to choose between them.
    const text = step1()
    expect(text, 'the two actions are presented as interchangeable again').not.toMatch(/card from the Offer, or move an element/i)
  })

  it('still tells the player the turn budget, in both modes', () => {
    // The step's original job. Fixing the framing must not quietly drop the clock or the action count
    // (rule 32 · the numbers come from getModeConfig, never hardcoded in copy).
    for (const mode of [GAME_MODES.classic, GAME_MODES.flow]) {
      cleanup()
      useGameStore.setState({ mode: mode.id }, false)
      const text = step1()
      expect(text, `${mode.id}: the turn budget vanished`).toMatch(/three actions/i)
      expect(text, `${mode.id}: the clock vanished`).toContain(`${mode.TURN_TIME_LIMIT} seconds`)
    }
  })

  it('keeps Flow mode saying that everyone draws at once', () => {
    cleanup()
    useGameStore.setState({ mode: GAME_MODES.flow.id }, false)
    expect(step1()).toMatch(/at the same time/i)
  })
})
