import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import CardFrame from './CardFrame'
import { PROJECT_CARDS } from '../lib/projectCards'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

const firstWith = (points) => PROJECT_CARDS.find(c => c.points === points)

// The point value is drawn as bare SVG <text>, so there is no role or label to query · read it out of
// the DOM the same way the render does.
const numeralOf = (container) =>
  [...container.querySelectorAll('svg text')].map(t => t.textContent.trim()).find(t => /^[IVXLCDM]+$/.test(t))

describe('CardFrame · point value', () => {
  it('prints a valid Roman numeral for every point value in the deck', () => {
    // 4 and 5 are the regression: they rendered 'IIII' and 'IIIII' from a hand-written map.
    for (const [points, expected] of [[2, 'II'], [3, 'III'], [4, 'IV'], [5, 'V']]) {
      const card = firstWith(points)
      expect(card, `deck has no ${points}-point card to test`).toBeTruthy()
      const { container } = render(<CardFrame card={card} />)
      expect(numeralOf(container), `${card.id} (${points}pt)`).toBe(expected)
      cleanup()
    }
  })

  it('never prints four identical symbols in a row on any card in the deck', () => {
    for (const card of PROJECT_CARDS) {
      const { container } = render(<CardFrame card={card} />)
      expect(numeralOf(container), `${card.id} (${card.points}pt)`).not.toMatch(/(.)\1\1\1/)
      cleanup()
    }
  })
})

describe('CardFrame · the internal card id', () => {
  // The S28 brief reported this as "card_01 prints on every card face regardless of which card it is".
  // It does not · each card prints its own id. This test pins the real behaviour so the claim cannot be
  // re-derived from a single card seen in isolation.
  it('prints each card its own id in dev, never one card id for all of them', () => {
    vi.stubEnv('DEV', true)
    const sample = ['card_21', 'card_31', 'card_49'].map(id => PROJECT_CARDS.find(c => c.id === id))
    const seen = sample.map(card => {
      const { container } = render(<CardFrame card={card} />)
      const text = container.querySelector('[data-testid=card-id-dev]')?.textContent.trim()
      cleanup()
      return text
    })
    expect(seen).toEqual(['card_21', 'card_31', 'card_49'])
    expect(new Set(seen).size, 'every card rendered the same id').toBe(3)
  })

  it('does not show players a raw database key in a production build', () => {
    vi.stubEnv('DEV', false)
    const card = PROJECT_CARDS.find(c => c.id === 'card_21') // no PNG yet · placeholder path is live
    const { container } = render(<CardFrame card={card} />)
    expect(container.querySelector('.art-skeleton'), 'the placeholder itself must still render').toBeTruthy()
    expect(container.querySelector('[data-testid=card-id-dev]')).toBeNull()
    expect(container.textContent).not.toContain('card_21')
  })

  it('still names the card, so hiding the id costs the player nothing', () => {
    vi.stubEnv('DEV', false)
    const card = PROJECT_CARDS.find(c => c.id === 'card_21')
    render(<CardFrame card={card} />)
    expect(screen.getByText(card.name)).toBeInTheDocument()
  })
})

describe('CardFrame · element label', () => {
  it('calls the energy element by the same name the rest of the game uses', () => {
    // 'SUSTAINABLE ENERGY' measured 121.5u wide inside a 120u frame at hand size · it ran off both
    // edges of every Energy card, and no other surface in the game calls the element that.
    const { container } = render(<CardFrame card={{ id: 'x', name: 'X', points: 2, element: 'energy' }} />)
    const bar = [...container.querySelectorAll('svg text')].map(t => t.textContent).join(' ')
    expect(bar).toContain('ENERGY')
    expect(bar).not.toContain('SUSTAINABLE')
  })
})
