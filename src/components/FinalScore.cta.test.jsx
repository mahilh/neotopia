import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── The screen has to answer "what now" without being scrolled ───────────────────────────────────
// T3 measured it at seven viewports and not one showed a CTA on arrival:
//
//     1440x900   243px below the fold      390x844   692px below
//     1280x720   423px below               375x667   889px below
//      768x1024  119px below · the best    320x568  1038px BELOW
//
// It was never unreachable · the dialog scrolls and one to three gestures land a real click · so it
// is neither Rule 78a (covered) nor 78b (pushed off a row). It is a third case: below the fold in a
// scrollable container. What makes it a defect is that the macOS overlay scrollbar is 0px wide until
// you are already scrolling, so there is NO passive affordance. The content simply stops mid
// score-row · at 320 the last readable things are "0", "Living Earth", "0".
//
// STICKY RATHER THAN MOVED: the reveal order is the point of this screen. The score is the payoff
// and the CTA is what you do after it, so putting "Start New Civilization" above the civilization
// would fix the symptom by breaking the thing.
//
// jsdom has no layout and no scrollport, so "on arrival" cannot be measured here · that is in the
// browser and the numbers are in the commit. What jsdom holds is the mechanism and the ordering.

vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}),
  recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))

const FinalScore = (await import('./FinalScore')).default

const players = [
  { seat: 0, userId: 'u0', username: 'Zero', scores: [3, 1, 0], bonusTokens: [], scoredCardIds: ['card_01'] },
]
const mount = (props = {}) => render(
  <MemoryRouter><FinalScore players={players} mySeat={0} regions={[]} {...props} /></MemoryRouter>,
)

afterEach(cleanup)

describe('the CTA row is pinned to the bottom of the scrollport', () => {
  it('sticks, so it is on screen before anybody scrolls', () => {
    mount({ practice: true, onLeavePractice: vi.fn(), onPlayAgain: vi.fn() })
    const row = screen.getByTestId('play-again-btn').parentElement
    // FALSE CASE, and the shipped one: a static row at the end of 1749px of content, on a 568px
    // phone, with no scrollbar to suggest it is there.
    expect(row.style.position, 'a static CTA row is 1038px below the fold at 320').toBe('sticky')
    expect(row.style.bottom).toBe('0px')
  })

  it('carries both practice controls in the same pinned row', () => {
    mount({ practice: true, onLeavePractice: vi.fn(), onPlayAgain: vi.fn() })
    const row = screen.getByTestId('play-again-btn').parentElement
    expect(row.contains(screen.getByTestId('leave-practice')),
      'the way OUT must be pinned too · it was the furthest below the fold of the two').toBe(true)
  })

  it('keeps the closing line ABOVE it · a footer under a permanent bar is never read', () => {
    mount({ practice: true, onLeavePractice: vi.fn(), onPlayAgain: vi.fn() })
    const row = screen.getByTestId('play-again-btn').parentElement
    const closing = [...row.parentElement.children].find(n => /Building the civilization/.test(n.textContent))
    expect(closing, 'the closing line disappeared entirely').toBeTruthy()
    // DOCUMENT_POSITION_FOLLOWING · the row comes after the closing line.
    expect(closing.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not strand itself on the dialog padding', () => {
    // The dialog used to carry 80px of bottom padding. A sticky child cannot leave its containing
    // block's content box, so that padding would have parked the row 80px up from the bottom edge
    // with a dead band underneath it. The row owns its own bottom spacing now.
    mount({ practice: true, onLeavePractice: vi.fn(), onPlayAgain: vi.fn() })
    const dialog = screen.getByRole('dialog', { name: /final civilization record/i })
    expect(dialog.style.padding).toBe('60px 24px 0px')
  })

  it('keeps the reveal order · the score is still above the CTA', () => {
    mount({ practice: true, onLeavePractice: vi.fn(), onPlayAgain: vi.fn() })
    const row = screen.getByTestId('play-again-btn').parentElement
    const total = [...document.querySelectorAll('div')].find(n => n.textContent.trim() === '2055')
    expect(total, 'the civilization header must still be there').toBeTruthy()
    expect(total.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the CTA must not have been hoisted above the record it is a response to').toBeTruthy()
  })

  it('sticks in a real game too, where the row holds one button', () => {
    mount()
    const row = screen.getByTestId('play-again-btn').parentElement
    expect(row.style.position).toBe('sticky')
    expect(screen.queryByTestId('leave-practice'), 'practice-only control leaked into a real game').toBeNull()
  })
})
