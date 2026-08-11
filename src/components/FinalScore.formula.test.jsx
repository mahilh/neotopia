import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── I REPORTED THIS FEATURE MISSING AND IT HAD SHIPPED IN S27 ────────────────────────────────────
// S44, from a bundle grep: "the scoring formula does not exist in the shipped product · ×3 → 0
// occurrences". It renders `× 3`, WITH A SPACE. My search matched nothing, I called a built feature
// missing, and the next brief repeated the finding using the same string · which is not a second
// check, it is the same check run twice (Rule 92: two sides of one source).
//
// WHAT IS ACTUALLY WRONG IS THAT NOBODY CAN READ IT. White at alpha 0.20 on this dialog's rgb(4,4,10)
// is 1.70:1, against the 4.5:1 that 11px text needs. So the line carrying the game's entire
// strategic argument was drawn at the threshold of visibility, and "it isn't there" is what that
// looks like from the outside. Rule 70.
//
// This file therefore pins TWO things, and the first is the one that would have wasted a session:
// the formula exists and is legible. A test that only checked the text would have passed in S27 and
// every session since, including the one where I declared it absent.

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

afterEach(cleanup)

// WCAG relative luminance · the same arithmetic the board probe uses, so a colour claim here is
// computed rather than eyeballed (Rule 81).
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
const L = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])
const contrast = (a, b) => { const [x, y] = [L(a) + 0.05, L(b) + 0.05]; return x > y ? x / y : y / x }
const DIALOG_BG = [4, 4, 10]
const overBg = (alpha) => [0, 1, 2].map(i => Math.round(255 * alpha + DIALOG_BG[i] * (1 - alpha)))
const alphaOf = (css) => Number(/rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/.exec(css)?.[1] ?? 1)

// Two players whose cluster points DIFFER · the whole reason the panel had to be split.
const REGION_WITH_SPLIT_CLUSTER = {
  id: 0,
  name: 'Sacred City',
  hexes: {
    '0,0': { element: 'energy', placedBy: 0 },
    '1,0': { element: 'energy', placedBy: 0 },
    '1,-1': { element: 'energy', placedBy: 1 },
  },
}
const players = [
  { seat: 0, userId: 'u0', username: 'Mahil', scores: [9, 4, 1], bonusTokens: [], scoredCardIds: [] },
  { seat: 1, userId: 'u1', username: 'Rival', scores: [6, 5, 2], bonusTokens: [], scoredCardIds: [] },
]
const mount = (props = {}) => render(
  <MemoryRouter>
    <FinalScore players={players} mySeat={0} regions={[REGION_WITH_SPLIT_CLUSTER]} {...props} />
  </MemoryRouter>,
)

describe('the formula is on the screen that applies it', () => {
  // WRITTEN FIRST (Rule 90) · and it is a counterweight against ME, not against a future editor.
  // The failure this file exists to prevent already happened: a whole priority was scoped to build
  // something that was already built. So the first assertion is that the thing EXISTS, phrased so a
  // future "it's missing" report has to disagree with a green test rather than with a memory.
  it('already existed · states best + second + (worst × 3) with real numbers', () => {
    mount()
    const rows = screen.getAllByTestId('score-formula')
    expect(rows.length, 'one formula per player record').toBe(2)
    // Mahil: scores 9/4/1 → best 9, second 4, worst 1.
    expect(rows[0].textContent.replace(/\s+/g, ' ')).toContain('9 + 4 + (1 × 3)')
    expect(rows[0].textContent, 'the total has to be the engine total, not a re-add').toContain('= ')
    // AND THE SPACE IS THE POINT: `×3` is what I searched the bundle for and it is not what ships.
    expect(rows[0].textContent).toContain('× 3')
    expect(rows[0].textContent).not.toContain('×3')
  })

  it('is legible · 1.70:1 is what "the feature is missing" looked like from outside', () => {
    mount()
    const css = screen.getAllByTestId('score-formula')[0].style.color
    const ratio = contrast(overBg(alphaOf(css)), DIALOG_BG)
    // FALSE CASE, and the shipped one: alpha 0.20 → 1.70:1, off AA by a factor of 2.6.
    expect(ratio, `formula renders at ${ratio.toFixed(2)}:1 · AA needs 4.5 for 12px body text`)
      .toBeGreaterThanOrEqual(4.5)
    expect(Number.parseInt(screen.getAllByTestId('score-formula')[0].style.fontSize, 10),
      'the line carrying the whole scoring argument must not be the smallest text on screen')
      .toBeGreaterThanOrEqual(12)
  })

  it('keeps the rule stated in words, not only in arithmetic', () => {
    mount()
    expect(document.body.textContent).toMatch(/lowest-scoring region counts three times/i)
  })
})

describe('cluster points say WHO earned them', () => {
  it('splits each cluster between the players who placed on it', () => {
    // The handover T2 left in FinalScore.jsx: since S35 each player scores only their OWN tokens, so
    // the panel summed the board (3 here) while the formula lines showed 2 and 1, with nothing
    // connecting them. A player whose cluster number differs from their opponent's could not learn
    // that PLACEMENT earned it · which is the entire mechanic.
    mount()
    const split = screen.getAllByTestId('cluster-split')
    expect(split.length, 'the one cluster on this board must carry a split').toBe(1)
    const text = split[0].textContent
    expect(text, 'my own share is named as mine').toMatch(/you\s*·\s*2/)
    expect(text, "the opponent's share is named and attributed").toMatch(/Rival\s*·\s*1/)
  })

  it('stays readable when a username ENDS IN A DIGIT · found in a browser, not here', () => {
    // The default opponent is called "Bot 1", so `name + space + score` rendered "Bot 1 1" · name
    // and number indistinguishable. My original fixture used "Rival" and could never have shown it,
    // which is the whole argument for witnessing this on a real screen (Rule 63).
    render(
      <MemoryRouter>
        <FinalScore
          players={[players[0], { ...players[1], username: 'Bot 1' }]}
          mySeat={0}
          regions={[REGION_WITH_SPLIT_CLUSTER]}
        />
      </MemoryRouter>,
    )
    const text = screen.getAllByTestId('cluster-split')[0].textContent
    expect(text, 'the score must be separated from a name that ends in a number').toMatch(/Bot 1\s*·\s*1/)
    expect(text).not.toMatch(/Bot 1 1(?!\s*·)/)
  })

  it('the split adds up to the row total · the screen must not invent points', () => {
    mount()
    const nums = [...screen.getAllByTestId('cluster-split')[0].textContent.matchAll(/(\d+)/g)].map(m => Number(m[1]))
    expect(nums.reduce((a, b) => a + b, 0), 'per-seat shares must sum to the cluster size').toBe(3)
    expect(document.body.textContent).toContain('3 connected')
  })

  // THE COUNTERWEIGHT: listing every player on every row, including zeros, would satisfy both
  // assertions above and turn a three-seat game's panel into a wall of "Rival 0". Only earners.
  it('names only the players who actually earned on that cluster', () => {
    render(
      <MemoryRouter>
        <FinalScore
          players={[...players, { seat: 2, userId: 'u2', username: 'Ghost', scores: [1, 1, 1], bonusTokens: [] }]}
          mySeat={0}
          regions={[REGION_WITH_SPLIT_CLUSTER]}
        />
      </MemoryRouter>,
    )
    const text = screen.getAllByTestId('cluster-split')[0].textContent
    expect(text, 'a player who placed nothing on this cluster must not be listed').not.toContain('Ghost')
  })

  it('names points that went to NOBODY · the pre-S35 board (witnessed live, not here)', () => {
    // THE FAILURE I PREDICTED WHEN I SHIPPED THIS IN JSDOM AND COULD NOT HAVE CAUGHT HERE, because
    // my fixture stamped every hex · I wrote it. Driven in a browser with placedBy stripped, the way
    // a board synced from before S35 arrives: engine gave board 3 / seat0 0 / seat1 0, the split
    // rendered NOTHING, and both formula lines lost their cluster term · while the row still read
    // "+3 pts". Three points on screen that no player received, unexplained and indistinguishable
    // from "one player earned them all".
    render(
      <MemoryRouter>
        <FinalScore
          players={players}
          mySeat={0}
          regions={[{ id: 0, name: 'Sacred City', hexes: {
            '0,0': { element: 'energy' }, '1,0': { element: 'energy' }, '1,-1': { element: 'energy' },
          } }]}
        />
      </MemoryRouter>,
    )
    expect(screen.queryAllByTestId('cluster-split'), 'nobody owns any of it, so there is no split').toHaveLength(0)
    const un = screen.getByTestId('cluster-unclaimed')
    expect(un.textContent, 'the row must say the points went nowhere').toMatch(/unclaimed\s*·\s*3/)
  })

  it('accounts for a PARTIALLY stamped cluster · claimed + unclaimed = the row', () => {
    render(
      <MemoryRouter>
        <FinalScore
          players={players}
          mySeat={0}
          regions={[{ id: 0, name: 'Sacred City', hexes: {
            '0,0': { element: 'energy', placedBy: 0 }, '1,0': { element: 'energy' }, '1,-1': { element: 'energy', placedBy: 1 },
          } }]}
        />
      </MemoryRouter>,
    )
    const split = screen.getByTestId('cluster-split').textContent
    const unclaimed = screen.getByTestId('cluster-unclaimed').textContent
    const nums = [...split.matchAll(/·\s*(\d+)/g)].map(m => Number(m[1]))
    const un = Number(/·\s*(\d+)/.exec(unclaimed)[1])
    expect(nums.reduce((a, b) => a + b, 0) + un, 'claimed + unclaimed must equal the cluster size').toBe(3)
  })

  it('says nothing about ownership when only one player earned on a cluster', () => {
    // A solo game, or a cluster one player built alone · "you 3" beside "+3 pts" is a second copy of
    // the same number and adds noise rather than meaning.
    render(
      <MemoryRouter>
        <FinalScore
          players={[players[0]]}
          mySeat={0}
          regions={[{ id: 0, name: 'Sacred City', hexes: {
            '0,0': { element: 'energy', placedBy: 0 }, '1,0': { element: 'energy', placedBy: 0 },
          } }]}
        />
      </MemoryRouter>,
    )
    expect(screen.queryAllByTestId('cluster-split'), 'a single earner needs no split').toHaveLength(0)
    expect(document.body.textContent).toContain('2 connected')
  })
})
