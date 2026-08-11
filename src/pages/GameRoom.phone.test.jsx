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
//
// ── AND THE STYLESHEET HALF PINS A STRING, NOT A BEHAVIOUR (T1 S48, correcting T1 S47) ───────────
// Said plainly because I wrote the opposite impression into the S47 handoff and then had to correct
// it in the roadmap: every `phoneBlock` assertion below proves the rule IS WRITTEN. None of them
// proves it WINS. All of them pass if a later rule overrides it, if a more specific selector beats
// it, or if an !important lands somewhere that outranks it · because a regex over a stylesheet has
// no cascade, no viewport and no specificity.
// That is still worth having · it catches a deletion, a typo'd selector and a hoist out of the media
// block, which are the three ways this has actually broken. But the question "does the board really
// end up with the share" is answered by `probe.cascadeFacts()` in a browser at 320 and at 1280,
// posted to T3 for tests/e2e/measure.js. The alarm here is precise; the proof lives where the
// cascade does.
//
// AND THAT PROBE FOUND ONE ON ITS FIRST RUN, WHICH IS WHY THIS IS NOT A THEORETICAL WORRY. Measured
// at 320, 375 and 600 on the practice board:
//     .game-sidebar  authored `flex: 2 1 0`   ->  RESOLVED flex-shrink: 0
// because GameRoom.jsx:820 carries an inline `flexShrink: 0` on the <aside>, and an inline style
// beats a stylesheet rule that has no !important. So one of the terms the test below asserts is not
// the term the browser runs. It is HARMLESS here · flex-basis is 0 and grow is 2, both of which the
// stylesheet does win, and the measured share is 0.588 against the 0.6 the rule intends · and the
// inline 0 is CORRECT at 1280, where the sidebar is a fixed 288px column that must not shrink. So it
// is left alone deliberately. The point is that a regex over index.css reported a green on a
// declaration the page never applied, and only getComputedStyle could say so.
// Resolved values as measured in S48, i.e. of the 3:2 layout this file used to describe:
//     320/375/600  column · board 3/1/0px · sidebar 2/0/0px · both min-height 0 · sidebar max-height none
//     1280         row    · board 1/1/0%  · sidebar 0/0/auto/288px wide · desktop untouched
//
// ── AND S49 SUPERSEDED THE LAYOUT ITSELF · THE SIDEBAR IS A BOTTOM SHEET NOW ─────────────────────
// The board no longer has a SHARE of the phone column, it has all of it, and the panel comes up over
// it only when the flow needs it. The two assertions below that described the 3:2 split went RED the
// moment that landed, which is Rule 101 working: a fix's blast radius includes the tests that
// documented what it replaced, and they become false claims rather than failing ones. Both are
// rewritten to the new truth with the old one kept above them as the argument for it.
// Measured after, live, seven widths, 0 of 60 controls blocked at every one:
//     320  25.8px (58.6% of 44)      600   28.1px
//     375  26.5px                    768   39.0px
//     414  26.5px                   1280   53.9px  UNCHANGED
// The 6.8 -> 14.4 -> 25.8 progression is three sessions on one number. It still does NOT clear 44px
// and cannot: the board is 828 x 865.9 user units, so at 320 it is width-bound to 27.8px even with
// no chrome at all.  ⚠ THIS LINE SAID "720x749 ... 32px" UNTIL T1 S50 AND THAT WAS WRONG · the
// correction to S47's wrong 44px claim carried a wrong number of its own for a session. The figure
// is now computed by GameBoard's exported computeViewBox() and asserted in GameBoard.focus.test.jsx
// rather than quoted anywhere.
//
// ── AND S50 SUPERSEDED THIS AGAIN · ONE REGION AT A TIME DOES CLEAR 44px ─────────────────────────
// `focusRegion` scopes the viewBox to the region the player chose at step 3. Measured live on the
// built bundle: 74.4px at 320, 87.2 at 375, 96.3 at 414, 115.7 at 600 · 0 blocked, 0 clipped in the
// focused region, desktop unchanged at 39.0/53.9. So the sheet's 25.8px is what the board renders
// while you are LOOKING at it, and 74.4px is what it renders when you have to TAP it.
// The SHEET's own behaviour · which phase it is up in · lives in GameRoom.sheet.test.jsx.
// The FOCUS behaviour lives in GameRoom.focus.test.jsx and GameBoard.focus.test.jsx.

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

describe('the phone rule is WRITTEN and targets the board · not that it wins (see header)', () => {
  it('exists at all, and only below the 600px breakpoint', () => {
    expect(phoneBlock, 'the @media (max-width: 600px) block is gone').not.toBe('')
    expect(phoneBlock).toMatch(/\.game-main\s*\{[^}]*flex-direction:\s*column/)
  })

  // ⚠ SUPERSEDED BY S49, AND THE OLD CLAIM IS KEPT HERE BECAUSE IT IS THE ARGUMENT FOR THE NEW ONE.
  // Until S49 this asserted `flex: 3 1 0` on the board and `flex: 2 1 0` on the sidebar · the 3:2
  // share that took the hex from 6.8px to 14.4px. The sheet removes the sidebar from the column
  // entirely, so the board no longer has a SHARE, it has the whole of `main` (14.4px -> 25.8px).
  // A test that still demanded 3:2 would be asserting the layout we deliberately left (Rule 101).
  it('gives the board ALL of main, not a share of it', () => {
    // FALSE CASE, twice over: the S16 version had no rule for the board at all (it took `flex: 1`
    // against a 240px-pinned sidebar and got 114px of a 568px screen), and the S47 version capped it
    // at three fifths.
    expect(phoneBlock).toMatch(/\.game-board-area\s*\{[^}]*flex:\s*1\s+1\s+auto/)
    expect(phoneBlock, 'the sidebar is out of the flex column now · it is a sheet')
      .toMatch(/\.game-sidebar\s*\{[^}]*position:\s*absolute/)
    expect(phoneBlock, 'and it must not still be claiming a share alongside being absolute')
      .not.toMatch(/\.game-sidebar\s*\{[^}]*flex:\s*2/)
  })

  it('caps the SHEET as a fraction of the screen, never as a magic pixel count', () => {
    // S16 pinned the sidebar at 240px, which was right for one viewport height and silently wrong
    // for every other. S47 removed it. S49 gives the sheet a ceiling again · but a RELATIVE one, so
    // it adapts to a 568px phone and an 812px one alike, which is the whole lesson of the 240.
    expect(phoneBlock, 'a magic pixel cap cannot adapt to a 568px phone AND an 812px one')
      .not.toMatch(/max-height:\s*240px/)
    expect(phoneBlock).toMatch(/\.game-sidebar\s*\{[^}]*max-height:\s*\d+%/)
  })

  it('lets both children actually shrink · min-height:0 is what makes a flex child scrollable', () => {
    // The failure this prevents is silent and total: without min-height:0 a flex child refuses to go
    // below its content height, so the sidebar would push the board back out and the rule above
    // would appear to do nothing.
    expect(phoneBlock).toMatch(/\.game-board-area\s*\{[^}]*min-height:\s*0/)
    expect(phoneBlock).toMatch(/\.game-sidebar\s*\{[^}]*min-height:\s*0/)
  })

  // ⚠ AND THIS ONE CANNOT SEE WHAT ITS NAME SUGGESTS · T3 S48 found the sharper half of my own S48
  // finding and they are right. The desktop value it appears to protect · the board's `flex: 1` at
  // 1280 · IS NOT IN THE STYLESHEET AT ALL. It is an inline style on GameRoom.jsx:786, and a regex
  // over index.css structurally cannot see it, at either width. So this asserts exactly one thing,
  // and it is worth having: that nobody HOISTS a phone rule out of the media block. It says nothing
  // about what desktop resolves to. That is `probe.cascadeFacts()` in a browser, posted to T3.
  it('no phone rule escapes the media block · it does NOT pin the desktop value (see above)', () => {
    // 1280 renders a 53.9px cell before and after, measured. That measurement is the evidence; this
    // assertion is only the tripwire against a hoist.
    const outside = CSS.replace(phoneBlock, '')
    expect(outside, 'a board-area flex rule outside the phone block would resize every screen')
      .not.toMatch(/\.game-board-area\s*\{[^}]*flex:\s*3/)
  })
})
