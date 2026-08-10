import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import ActionBar from './ActionBar'

afterEach(cleanup)

// ── This bar is over-subscribed, and every rule here is about who pays for that ──────────────────
// MEASURED in a real browser: its three groups want ~448px inside a 292px content box at 320. Flex
// closes the gap by shrinking whatever can shrink, and the casualty has changed twice:
//
//   S37 · four labelled token pills put End Turn's right edge 267px off the side of a phone. A
//         player who cannot reach End Turn cannot play. Fixed by wrapping · which cost height:
//         64 -> 119 -> 183px, i.e. a third of a 335px board on the smallest supported screen.
//   S38 · and the one nobody had asked about, because End Turn was on screen and that looked like
//         "it fits": at 320 AND 375, holding NO tokens, the status span rendered at 0.0px.
//         "Waiting for Alice" · how you know it is not your turn · was absorbing the whole deficit.
//
// jsdom has no layout, so none of those pixel facts can be re-measured here and this file does not
// pretend to (Rule 78's corollary). What it holds is the DECISIONS that produced them: one chip
// rather than N pills, the two classes the stylesheet needs in order to give the row its space
// back, and a wrap that is now a permanent safety net rather than a mechanism.

const bar = () => document.querySelector('footer')
const ALL_FOUR = ['automatization', 'subsidy', 'initiative', 'permits']

describe('the bonus tokens cost one chip, not four', () => {
  it('renders nothing at all when the player holds none', () => {
    render(<ActionBar bonusTokens={[]} />)
    expect(screen.queryByTestId('bonus-chip')).toBeNull()
    expect(screen.getByTestId('end-turn-btn')).toBeTruthy()
  })

  it('renders ONE control for four tokens · this is the whole point', () => {
    render(<ActionBar bonusTokens={ALL_FOUR} />)
    const chips = screen.getAllByTestId('bonus-chip')
    // FALSE CASE, and the shipped one: four labelled pills, ~266px of a 292px row, which is what
    // forced the bar to grow to 183px tall.
    expect(chips, 'four separate pills is what this replaced').toHaveLength(1)
    expect(chips[0].getAttribute('data-bonus-count')).toBe('4')
    expect(chips[0].textContent).toContain('4')
  })

  it('keeps the chip at a real touch size and gives it a name', () => {
    render(<ActionBar bonusTokens={['subsidy']} />)
    const chip = screen.getByTestId('bonus-chip')
    expect(chip.style.height).toBe('44px')       // Rule 4
    expect(chip.style.minHeight).toBe('44px')
    // A row of coloured dots and a numeral is not a label to anyone not looking at it.
    expect(chip.getAttribute('aria-label')).toMatch(/1 bonus token/i)
  })

  it('caps the dots at four so the chip has a MAXIMUM width · nine is reachable', () => {
    // T2 S38 made bonus tokens earnable: three thresholds per region, three regions, first-come. So
    // one player can hold NINE, not four. The count is exact and the dots are capped, which is what
    // keeps the chip's width bounded · measured at 70.5px for both 4 and 9 on a 320px phone. Without
    // the cap the chip would grow with the count and this whole change would leak back into the row.
    const NINE = ['subsidy', 'initiative', 'permits', 'subsidy', 'initiative', 'permits', 'subsidy', 'initiative', 'permits']
    render(<ActionBar bonusTokens={NINE} />)
    const chip = screen.getByTestId('bonus-chip')
    expect(chip.querySelectorAll('span > span')).toHaveLength(4)
    expect(chip.textContent, 'the COUNT must stay exact even though the dots are capped').toContain('9')
    expect(chip.getAttribute('data-bonus-count')).toBe('9')

    fireEvent.click(chip)
    // Every one of them still has to be listed · the cap is a display bound, not a data bound.
    expect(screen.getByTestId('bonus-detail').children).toHaveLength(9)
  })

  it('shows one dot per token so WHICH you hold survives the compression', () => {
    render(<ActionBar bonusTokens={['automatization', 'subsidy']} />)
    const dots = [...screen.getByTestId('bonus-chip').querySelectorAll('span > span')]
    expect(dots).toHaveLength(2)
    // The dots carry the element palette · the same colours the pills used.
    expect(dots.map(d => d.style.background)).toEqual(['rgb(226, 75, 74)', 'rgb(29, 158, 117)'])
  })
})

describe('what each token DOES is reachable, not hidden in a title attribute', () => {
  it('opens on tap and says what every held token does', () => {
    render(<ActionBar bonusTokens={ALL_FOUR} />)
    expect(screen.queryByTestId('bonus-detail'), 'the panel must start closed').toBeNull()

    fireEvent.click(screen.getByTestId('bonus-chip'))

    const panel = screen.getByTestId('bonus-detail')
    // FALSE CASE: the old pills carried their effect in `title`, which a touch device never shows.
    // Compressing them into a chip would have DELETED that information rather than moved it.
    for (const phrase of ['+1 action this turn', 'draw 2 cards', 'from reserve', 'outer ring']) {
      expect(panel.textContent, `"${phrase}" is not reachable any more`).toContain(phrase)
    }
    expect(screen.getByTestId('bonus-chip').getAttribute('aria-expanded')).toBe('true')
  })

  it('closes again on a second tap', () => {
    render(<ActionBar bonusTokens={['permits']} />)
    fireEvent.click(screen.getByTestId('bonus-chip'))
    expect(screen.getByTestId('bonus-detail')).toBeTruthy()
    fireEvent.click(screen.getByTestId('bonus-chip'))
    expect(screen.queryByTestId('bonus-detail'), 'a panel that cannot be dismissed covers the board').toBeNull()
  })

  it('closes on Escape', () => {
    // It is 296 x 281 on a 320px phone · half the screen · and when it shipped the chip was its only
    // exit. That is the ScoreFlash shape from S35: a large overlay betting the player finds the one
    // control that opened it.
    render(<ActionBar bonusTokens={['permits', 'subsidy']} />)
    fireEvent.click(screen.getByTestId('bonus-chip'))
    expect(screen.getByTestId('bonus-detail')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('bonus-detail')).toBeNull()
  })

  it('closes when the player touches anything else', () => {
    render(<ActionBar bonusTokens={['permits']} />)
    fireEvent.click(screen.getByTestId('bonus-chip'))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('bonus-detail'), 'tapping away must dismiss it').toBeNull()
  })

  it('does NOT close on a click inside itself · reading it is not dismissing it', () => {
    // FALSE CASE for the outside-click handler: written carelessly it eats its own panel, so the
    // effects a player opened it to read vanish the moment they touch one.
    render(<ActionBar bonusTokens={['permits', 'subsidy']} />)
    fireEvent.click(screen.getByTestId('bonus-chip'))
    fireEvent.pointerDown(screen.getByTestId('bonus-detail'))
    expect(screen.getByTestId('bonus-detail')).toBeTruthy()
  })

  it('keeps working across re-renders · the listeners must not read a stale `open`', () => {
    // WHAT THIS ACTUALLY CATCHES, corrected after mutation-testing it. I first wrote this claiming
    // the ref was what survived a once-a-second re-render, and that claim is FALSE: binding the
    // listeners with [tokensOpen] in the deps also works, because React re-subscribes on the change.
    // Both implementations pass, so an assertion phrased against that difference is vacuous.
    // The bug the ref does prevent is the OTHER shape, and it is the one somebody reaches for when
    // they notice the listeners re-subscribing: empty deps AND a direct read of `tokensOpen`. That
    // captures `false` forever and Escape silently stops working. Mutating to exactly that reddens
    // this test and the two above it · so the teeth are real, they are just not where I said.
    const view = render(<ActionBar bonusTokens={['permits']} actionsRemaining={3} />)
    fireEvent.click(screen.getByTestId('bonus-chip'))
    for (let i = 0; i < 3; i++) view.rerender(<ActionBar bonusTokens={['permits']} actionsRemaining={3 - i} />)
    expect(screen.getByTestId('bonus-detail'), 'the panel should still be open').toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('bonus-detail'), 'Escape stopped working · a listener read a stale open').toBeNull()
  })
})

describe('the row gets its space back', () => {
  it('marks the two things the stylesheet drops below 480px', () => {
    // The 133px that lets the status span exist at all on a phone. These class names are the
    // contract with index.css · renaming one silently returns the player's name to 0px wide, which
    // is exactly how it got there in the first place.
    render(<ActionBar bonusTokens={[]} turnTimeRemaining={45} turnTimeLimit={90} />)
    expect(bar().querySelector('.ab-actions-label'), 'the "Actions" word must be droppable').not.toBeNull()
    expect(bar().querySelector('.ab-timer-bar'), 'the timer BAR must be droppable · the seconds stay').not.toBeNull()
    // And the reading itself must survive both.
    expect(screen.getByTestId('turn-timer').textContent).toContain('45s')
    expect(screen.getByTestId('my-turn-badge')).toBeTruthy()
  })

  it('keeps wrapping on permanently · it is the net, not the mechanism', () => {
    // S37 had to gate this on holding a token, because unconditional wrap cost 25px of board on
    // every phone. With the chip and the reclaimed 133px it never triggers · so it can be on for
    // good, and it is what would happen INSTEAD of losing End Turn rather than what happens.
    for (const tokens of [[], ALL_FOUR]) {
      cleanup()
      render(<ActionBar bonusTokens={tokens} />)
      expect(bar().style.flexWrap).toBe('wrap')
      expect(bar().style.padding, 'padding must not change with token count any more').toBe('0px 20px')
      expect(bar().style.gap, 'use columnGap + rowGap, never gap + rowGap · React drops one').toBe('')
    }
  })
})
