import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'node:fs'
import path from 'node:path'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'

// ── THE BOARD WAS GETTING THE LEAST SPACE ON THE SMALLEST SCREEN (T1 S47) ────────────────────────
// MEASURED at 320x568 before this: header 142 + board container 114 + sidebar 240 + action bar 73.
// The board · which IS the game · rendered 288x82 with 6.8x5.9px hex cells, 15.5% of the 44px
// minimum, while a single card in the sidebar beneath it was 168px tall. Twice the whole board.
//
// THE 240px CAP LOOKED LIKE A KINDNESS TO THE SIDEBAR AND WAS NOT: its content is 871px in a 239px
// box, so it has ALWAYS been a scroll surface showing 27% of itself. The cap reserved space the
// player scrolls through anyway and charged the board for it (Rule 83 · find who pays).
//
// AFTER, measured live across seven widths, 0 of 57 cells blocked at every one and no page scroll:
//     320  288x173  cell 14.4  32.8% of 44px      600  568x329  cell 27.4  62.2%
//     375  343x238  cell 19.8  45.0%              768  448x872  cell 39.0  88.5%
//     414  382x375  cell 31.2  70.9%             1280  960x648  cell 53.9  UNCHANGED
//
// WHAT IT DOES NOT REACH, said plainly: 14.4px at 320 is still under Rule 4's 44px. This is the
// reversible half · one CSS rule, no component rewrite. The full-bleed board with the step panel as
// a bottom sheet is the design job that actually gets there, and it should be designed rather than
// improvised at the end of a session.
//
// WHAT THIS FILE CAN AND CANNOT HOLD: jsdom has no layout, so it cannot witness a single pixel of
// the table above (Rule 78's corollary). What it CAN hold is the mechanism · that the board area is
// addressable at all, and that the rule which gives it a share still exists and still targets it.
// The pixels are asserted in a browser, where `probe.boardMetrics` reads them, and that gate is
// T3's. A test here that faked a rect would be measuring its own fixture.

vi.mock('../lib/supabase', () => ({
  supabase: {},
  GLOBAL_INDEX_BASE: 147823,
  getGlobalIndex: async () => 147823,
  getGlobalCivilizationTotal: async () => 0,
  recordCivilizationContribution: vi.fn(async () => {}),
  recordCivilizationDetail: vi.fn(async () => {}),
  awardGameWin: vi.fn(async () => null),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
vi.mock('../hooks/useGameSync', () => ({ useGameSync: () => null }))
vi.mock('../hooks/useDrawCard', () => ({ useDrawCard: () => ({ drawCard: vi.fn(), isDrawing: false, error: null }) }))

const GameRoom = (await import('./GameRoom')).default
const CSS = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')

// The @media (max-width: 600px) block, isolated · asserting against the whole stylesheet would let a
// rule anywhere else satisfy a claim about the phone layout.
const phoneBlock = (() => {
  const at = CSS.indexOf('@media (max-width: 600px)')
  if (at === -1) return ''
  let depth = 0, i = CSS.indexOf('{', at)
  const start = i
  for (; i < CSS.length; i++) {
    if (CSS[i] === '{') depth++
    else if (CSS[i] === '}') { depth--; if (depth === 0) break }
  }
  return CSS.slice(start, i + 1)
})()

const until = async (fn, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  }
  return fn()
}

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved()
  useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(cleanup)

describe('the board area is addressable', () => {
  // WRITTEN FIRST (Rule 90). Every CSS assertion below is about a selector, and a selector that
  // matches nothing is a rule that does nothing while reading as present · the exact vacuity a
  // stylesheet test invites. So the DOM half comes first: the class has to be on a real element.
  it('carries the class the phone rule targets · a selector matching nothing is not a rule', async () => {
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    const area = document.querySelector('.game-board-area')
    expect(area, 'the board container had NO class at all before this · index.css could only ever ' +
      'address the sidebar, which is why the board was the thing that paid').toBeTruthy()
    expect(area.querySelector('svg[role="img"]'), 'the class must be on the element that holds the board')
      .toBeTruthy()
    expect(document.querySelector('aside.game-sidebar')).toBeTruthy()
  })
})

describe('the phone rule gives the board a share instead of the leftovers', () => {
  it('exists at all, and only below the 600px breakpoint', () => {
    expect(phoneBlock, 'the @media (max-width: 600px) block is gone').not.toBe('')
    expect(phoneBlock).toMatch(/\.game-main\s*\{[^}]*flex-direction:\s*column/)
  })

  it('gives the board area a flex share', () => {
    // FALSE CASE, and the shipped one: no rule for the board at all, so it took `flex: 1` against a
    // sidebar pinned at 240px and got whatever was left · 114px of a 568px screen.
    expect(phoneBlock).toMatch(/\.game-board-area\s*\{[^}]*flex:\s*3\s+1\s+0/)
    expect(phoneBlock).toMatch(/\.game-sidebar\s*\{[^}]*flex:\s*2\s+1\s+0/)
  })

  it('drops the fixed 240px cap · it was right for one viewport height and wrong for the rest', () => {
    expect(phoneBlock, 'a magic pixel cap cannot adapt to a 568px phone AND an 812px one')
      .not.toMatch(/max-height:\s*240px/)
    expect(phoneBlock, 'and the cap must be explicitly released, not merely unset by luck')
      .toMatch(/\.game-sidebar\s*\{[^}]*max-height:\s*none/)
  })

  it('lets both children actually shrink · min-height:0 is what makes a flex child scrollable', () => {
    // The failure this prevents is silent and total: without min-height:0 a flex child refuses to go
    // below its content height, so the sidebar would push the board back out and the rule above
    // would appear to do nothing.
    expect(phoneBlock).toMatch(/\.game-board-area\s*\{[^}]*min-height:\s*0/)
    expect(phoneBlock).toMatch(/\.game-sidebar\s*\{[^}]*min-height:\s*0/)
  })

  it('does not touch the desktop layout · measured unchanged at 1280', () => {
    // 1280 renders a 53.9px cell before and after. The rule lives inside the media block, so this is
    // structural rather than a hope · but it is the assertion that would catch somebody hoisting it.
    const outside = CSS.replace(phoneBlock, '')
    expect(outside, 'a board-area flex rule outside the phone block would resize every screen')
      .not.toMatch(/\.game-board-area\s*\{[^}]*flex:\s*3/)
  })
})
