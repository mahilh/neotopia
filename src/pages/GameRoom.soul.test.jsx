// THE FOUR ELEMENTS WERE EXPLAINED TO NOBODY ON A PHONE (T1 S52).
//
// Each element button carries a soul-metal line · "Silver · Courage · Free Energy" · which is the
// only place the product ever says what an element IS. It was revealed by `:hover` and
// `:focus-visible`. Neither fires on a tap: touch has no hover, and browsers deliberately withhold
// :focus-visible from pointer focus. The only other channel was a `title=` attribute, which is also
// a hover tooltip. So the content was written, shipped, and completely unreachable on the device
// most first-timers hold.
//
// ⚠ AND A GREP SAID THE OPPOSITE, WHICH IS WHY THIS FILE EXISTS AT ALL (Rule 116). I searched
// index.css for `.neo-soul-tip`, got nothing, and reported the subtitle was permanently visible. The
// rule lives in a JSX <style> block inside GameRoom.jsx. The computed value on a real touch viewport
// was `opacity: 0`. A source read cannot answer a question whose answer is composed · here, which
// stylesheet the value comes from.
//
// MEASURED, live, on real touch viewports (hasTouch + isMobile, so `(hover: none)` really matches):
//     BEFORE   opacity 0 · 10px · tipVisible FALSE · all four elements, every width
//     AFTER    opacity 1 · 12px · tipVisible TRUE  · all four, at 320x568 and 375x667
//     DESKTOP  opacity 0 · unchanged · still a hover reveal at 1280
//
// ── THE FAILURE THE FIX ITSELF CAUSED, AND IT IS THE ONE I NAMED BEFORE MEASURING ────────────────
// Revealing a line under every element makes every row taller, and these rows live in the bottom
// sheet, which is capped at 68% of `main`. First attempt: rows went 44px -> 52px and the FOURTH
// element button fell outside the sheet at 320x568 (`inSheet: false`) · reachable by scrolling,
// invisible on arrival. That is precisely the distinction S51 had to learn about the tutorial
// buttons, reintroduced by my own hand in a different component one session later.
// Fixed by making the row pay for the line instead of growing: the reveal is 15px (the real line box
// of 12px text) rather than a guessed 22, and the button's vertical padding drops 6->4. Rows measure
// 45px · still over Rule 4's 44 · and all four sit inside the sheet at 320x568 and 375x667.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'

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

const until = async (fn, tries = 60) => {
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

// Drive to the step where the element buttons exist and return the <style> block that governs them.
async function elementStep() {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  await act(async () => { fireEvent.click(screen.getAllByTestId('factory')[0]) })
  await until(() => screen.queryAllByTestId('element-btn').length > 0)
  const styleText = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n')
  return { btns: screen.getAllByTestId('element-btn'), styleText }
}

describe('counterweight · the content exists and is attached to every element', () => {
  // Written first: every assertion below is about REVEALING a line. They are all satisfied by a
  // build where the line is absent, because an element that is not rendered is not hidden either.
  it('every element button actually carries a soul line to reveal', async () => {
    const { btns } = await elementStep()
    expect(btns.length, 'no element buttons · every assertion here would be vacuous')
      .toBeGreaterThan(0)
    for (const b of btns) {
      const tip = b.querySelector('.neo-soul-tip')
      expect(tip, `${b.getAttribute('data-element')} has no soul line at all`).toBeTruthy()
      expect(tip.textContent.trim().length, 'the soul line is empty').toBeGreaterThan(3)
    }
  })
})

describe('the explanation is reachable without a hover', () => {
  it('declares a (hover: none) reveal · the only trigger a tap can satisfy', async () => {
    const { styleText } = await elementStep()
    expect(styleText, 'the style block that governs the tip is missing entirely')
      .toMatch(/\.neo-soul-tip/)
    expect(styleText, 'no (hover: none) rule · on touch the line stays at opacity 0 and the game ' +
      'never says what an element is').toMatch(
      /@media\s*\(\s*hover:\s*none\s*\)\s*\{\s*\.neo-soul-tip\s*\{[^}]*opacity:\s*1/)
  })

  it('counterweight · desktop KEEPS the hover reveal · this is not "always show"', async () => {
    // The lazy fix is to delete the hiding rule. That satisfies the assertion above and changes the
    // desktop panel from four one-line rows to four two-line rows for no reason · the reveal there
    // works, because a mouse can hover.
    const { styleText } = await elementStep()
    expect(styleText, 'the resting hidden state is gone · this is now always-on everywhere')
      .toMatch(/\.neo-soul-tip\s*\{[^}]*opacity:\s*0/)
    expect(styleText, 'the hover trigger was removed · desktop loses a working reveal')
      .toMatch(/\.neo-soul-btn:hover\s+\.neo-soul-tip/)
  })

  it('the line is 12px · the floor the rest of the product honours', async () => {
    const { btns } = await elementStep()
    // Inline style, so jsdom reads the real declaration rather than a stylesheet guess.
    for (const b of btns) {
      const tip = b.querySelector('.neo-soul-tip')
      expect(parseInt(tip.style.fontSize, 10), `${b.getAttribute('data-element')} tip under 12px`)
        .toBeGreaterThanOrEqual(12)
    }
  })

  it('and the row still clears Rule 4 after paying for the extra line', async () => {
    const { btns } = await elementStep()
    // jsdom has no layout, so the 45px is a browser measurement (recorded in the header). What is
    // decidable here is the DECLARED floor, which is the thing a future edit would drop.
    for (const b of btns) {
      expect(parseInt(b.style.minHeight, 10), `${b.getAttribute('data-element')} lost its 44px floor`)
        .toBeGreaterThanOrEqual(44)
    }
  })
})
