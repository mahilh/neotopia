// THE TWO POINTER-ONLY NODES (T1 S60).
//
// ── WHAT WAS MISSING, MEASURED IN S59 ────────────────────────────────────────────────────────────
// Of five legal actions only End Turn was keyboard-operable end to end. The four-step placement was
// HALF wired · steps 2 and 3 are real <button>s and were already reachable, steps 1 and 4 are SVG
// <g> with no role, no tab stop and no name. A keyboard player could start aiming and could not
// finish, and scorePending sits downstream of both, so last session's scoreable-card work was
// reachable by pointer only. This closes the gap: factory <g> and target hex <g>.
//
// ── THE TWO DESIGN DECISIONS, STATED ─────────────────────────────────────────────────────────────
// ARROWS · not mapped to axial neighbours at all. Six neighbours, four arrows, and no due east or
// west on a flat-top grid, so any 4-of-6 mapping lies about adjacency. An arrow means "nearest legal
// target in that direction on screen". Proven in hexNav.test.js, including the case that justifies
// it: the legal set splits into two disconnected components at high occupancy and a direction can
// cross the gap a neighbour walk cannot.
// LISTBOX, NOT GRID · a grid role demands rows and columns and a hex board has neither; inventing
// them would be a lie told to a screen reader. The player is choosing ONE item from a highlighted
// set, single-select, arrow-navigated · that is a listbox. Measured, the set is 1 to 11 of 19 hexes
// (58% at peak), so it is a real set and not a sparse scatter.
//
// ── THE FAILURE THIS FILE CANNOT SEE, NAMED FIRST (BOOT_PREAMBLE §3) ─────────────────────────────
// That the focus ring is PAINTED. jsdom has no layout and no paint, so everything here is about the
// DOM and the model. The ring is a drawn SVG polygon rather than a CSS outline precisely because the
// factory's focusable <g> starts with a transparent r=70 hit circle and an outline would hug a box
// four times the visible hex · but "the polygon is in the tree" is not "the pixels are white".
// That claim is measured by rasterisation, with the terrain inlined, in this session's P2.
//
// ── COUNTERWEIGHTS FIRST (Rule 90) ───────────────────────────────────────────────────────────────
//   1 · tabIndex on all 57 hexes · then "the targets are reachable" is true of everything and the
//       roving group is 57 tab stops, which is the thing the design exists to avoid.
//   2 · a roving index keyed on POSITION · then changing the aimed region leaves it pointing at a
//       cell that is no longer legal (Rule 107, and one of the three failures the brief named).
//   3 · a tab stop with no key handler · reachable, named, and inert when you press Enter.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { clearSaved } from '../hooks/useLocalSession'
import { hexToPixel } from '../utils/hexUtils'

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

const phase = () => document.querySelector('[data-ui-phase]')?.getAttribute('data-ui-phase') ?? null
const cells = () => [...document.querySelectorAll('g.hex-cell[data-hex]')]
const options = () => cells().filter(c => c.getAttribute('role') === 'option')
const roving = () => options().find(c => c.getAttribute('tabindex') === '0')
const keyOf = (el) => el.getAttribute('data-hex')
const pxOf = (el) => { const [q, r] = keyOf(el).split(',').map(Number); return hexToPixel(q, r) }
const until = async (fn, tries = 90) => {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  return fn()
}
const click = async (el) => { await act(async () => { fireEvent.click(el) }) }
const press = async (el, key) => { await act(async () => { fireEvent.keyDown(el, { key }) }) }

beforeEach(() => {
  localStorage.setItem('neotopia_tutorial_v1', '1')
  clearSaved(); useGameStore.setState({ phase: 'lobby' }, false)
})
afterEach(() => { cleanup(); localStorage.clear() })

/** Mount practice, seed ONE token in region 0 so the region has a real legal set, and aim at it. */
async function aimed(regionId = 0) {
  render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
  await until(() => screen.queryAllByTestId('factory').length > 0)
  const st = useGameStore.getState()
  const region = st.regions.find(r => r.id === regionId)
  const centre = `${region.center.q},${region.center.r}`
  const factoryIdx = st.factories.findIndex(f => f.betweenRegions.includes(regionId))
  const factory = st.factories[factoryIdx]
  await act(async () => {
    useGameStore.setState({
      regions: st.regions.map(r => r.id === regionId
        ? { ...r, hexes: { [centre]: { element: 'energy', placedBy: 0 } } } : r),
      actionsRemaining: 3,
      factories: st.factories.map(f => f.id === factory.id
        ? { ...f, elements: [{ type: 'energy', count: 3 }] } : f),
    }, false)
  })
  await click(screen.getAllByTestId('factory')[factoryIdx])
  await until(() => phase() === 'factorySelected')
  await click(screen.getAllByTestId('element-btn')[0])
  await until(() => phase() === 'elementSelected' || phase() === 'regionSelected')
  const rb = screen.queryAllByTestId('region-btn')
  const idx = factory.betweenRegions.indexOf(regionId)
  if (rb.length) await click(rb[idx] ?? rb[0])
  await until(() => phase() === 'regionSelected')
  return { regionId, factoryIdx, factory, otherRegion: factory.betweenRegions.find(x => x !== regionId) }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · only the legal targets are in the tab order, and only one of them', () => {
  it('non-targets carry no role and no tabindex · and exactly ONE target is tabbable', async () => {
    const s = await aimed()
    expect(phase(), 'never reached regionSelected · UNMEASURED').toBe('regionSelected')

    const all = cells()
    const opts = options()
    // POSITIVE CONTROL · "0 of 60 are options" would pass every assertion below by vacuity.
    expect(opts.length, 'no hex became an option · nothing to navigate and nothing measured').toBeGreaterThan(1)
    expect(opts.length, 'EVERY cell is an option · the legal set is meant to be a subset').toBeLessThan(all.length)

    for (const c of all) {
      const isOpt = c.getAttribute('role') === 'option'
      const isValid = c.getAttribute('data-valid') === 'true'
      expect(isOpt, `data-valid=${isValid} but role=${c.getAttribute('role')} on ${keyOf(c)} · the ` +
        'option set and the legal set must be the same set').toBe(isValid)
      if (!isOpt) expect(c.getAttribute('tabindex'), `${keyOf(c)} is not a target and is tabbable`).toBeNull()
    }
    const tabbable = opts.filter(o => o.getAttribute('tabindex') === '0')
    expect(tabbable.length, `${tabbable.length} targets carry tabIndex 0 · a roving group has exactly ` +
      'one, otherwise Tab walks the whole legal set and this is not a roving index at all').toBe(1)
    expect(opts.filter(o => o.getAttribute('tabindex') === '-1').length).toBe(opts.length - 1)
  })
})

describe('counterweight · the roving key is not an index into a recomputed array', () => {
  it('changing the aimed region moves the cursor INTO the new region', async () => {
    // Rule 107. validTargets is rebuilt on every render; an index would survive this change and
    // point at whatever now sits at that position · a cell that is no longer legal.
    const s = await aimed()
    const before = keyOf(roving())
    const beforeSet = options().map(keyOf)
    expect(s.otherRegion, 'this factory borders only one region · cannot change aim, UNMEASURED').not.toBeUndefined()

    const rb = screen.queryAllByTestId('region-btn')
    const otherIdx = s.factory.betweenRegions.indexOf(s.otherRegion)
    await click(rb[otherIdx])
    await until(() => options().length > 0 && !options().map(keyOf).includes(before))

    const afterSet = options().map(keyOf)
    expect(afterSet.length, 'the new region offered no targets · UNMEASURED').toBeGreaterThan(0)
    expect(afterSet, 'the target set did not change · the fixture did not actually re-aim').not.toEqual(beforeSet)
    const now = roving()
    expect(now, 'no target is tabbable after the region changed · the cursor was lost').toBeTruthy()
    expect(afterSet, `the roving cursor is on ${keyOf(now)}, which is not in the new legal set · ` +
      'it survived the change and points at a stale cell').toContain(keyOf(now))
  })
})

describe('counterweight · a tab stop that does nothing is not keyboard support', () => {
  it('ENTER on the focused target PLACES · the same outcome a click produces', async () => {
    const s = await aimed()
    const target = roving()
    const key = keyOf(target)
    const before = Object.keys(useGameStore.getState().regions.find(r => r.id === s.regionId).hexes).length

    await act(async () => { target.focus() })
    await press(target, 'Enter')
    await until(() => phase() !== 'regionSelected')

    const region = useGameStore.getState().regions.find(r => r.id === s.regionId)
    expect(Object.keys(region.hexes).length, 'Enter did not add an element to the board').toBe(before + 1)
    expect(region.hexes[key], `nothing was placed at ${key}, the hex that held the cursor`).toBeTruthy()
    expect(region.hexes[key].element, 'the placed element is not the one that was picked up').toBe('energy')
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CLAIMS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('step 4 · the target hexes', () => {
  it('an arrow moves the cursor, and moves it the way it points', async () => {
    // Derived from hexToPixel rather than retyped · a test carrying its own copy of the geometry is
    // two sides from one source and cannot fail (Rule 92a).
    const s = await aimed()
    const start = roving()
    await act(async () => { start.focus() })
    const p0 = pxOf(start)

    let moved = 0
    for (const [key, ax, ay] of [['ArrowDown',0,1], ['ArrowUp',0,-1], ['ArrowRight',1,0], ['ArrowLeft',-1,0]]) {
      const cur = roving()
      const from = pxOf(cur)
      await press(cur, key)
      const next = roving()
      if (keyOf(next) === keyOf(cur)) continue     // nothing that way · legitimate, see the next test
      const to = pxOf(next)
      const along = (to.x - from.x) * ax + (to.y - from.y) * ay
      moved++
      expect(along, `${key} moved from ${keyOf(cur)} to ${keyOf(next)}, which is ${along.toFixed(1)}px ` +
        'in the direction pressed · a wrong mapping teaches a false model of the board').toBeGreaterThan(0)
    }
    expect(moved, 'no arrow moved the cursor at all · the handler is not wired').toBeGreaterThan(0)
    expect(p0).toBeTruthy()
  })

  it('an arrow with nothing that way leaves the cursor exactly where it is', async () => {
    // Blanking the cursor, or wrapping to the far side, would both "work". Neither is what the
    // player asked for, and losing focus mid-placement is the worse of the two.
    // ⚠ THIS TEST WAS VACUOUS AND A MUTATION SAID SO. It walked ArrowUP to the edge · but reading
    // order is top-to-bottom, so the topmost target IS orderedKeys[0], and the wrong fix (jump to
    // the first option when a direction finds nothing) is a NO-OP at exactly the cell it landed on.
    // Green mutation, green test, zero teeth. It walks DOWN now, and asserts the edge cell is not
    // the first option · without that line the same hole reopens the day the ordering changes.
    await aimed()
    let cur = roving()
    await act(async () => { cur.focus() })
    let last = null
    for (let i = 0; i < 12 && keyOf(cur) !== last; i++) {
      last = keyOf(cur)
      await press(cur, 'ArrowDown')
      cur = roving()
    }
    expect(cur, 'the cursor vanished while walking to the edge').toBeTruthy()
    const atEdge = keyOf(cur)
    const firstOption = options()[0] && keyOf(options().reduce((a, b) =>
      (pxOf(a).y - pxOf(b).y) || (pxOf(a).x - pxOf(b).x) <= 0 ? a : b))
    expect(atEdge, 'the walk ended on the FIRST option in reading order, so "jump to first" and ' +
      '"stay put" are indistinguishable here and this assertion has no teeth').not.toBe(firstOption)

    await press(cur, 'ArrowDown')
    expect(roving(), 'pressing into the edge blanked the roving cursor').toBeTruthy()
    expect(keyOf(roving()), 'the cursor moved when there was nothing in that direction').toBe(atEdge)
    expect(document.activeElement, 'focus left the board when an arrow found nothing')
      .toBe(roving())
  })

  it('the group is a LISTBOX and each target announces its position', async () => {
    const s = await aimed()
    const box = document.querySelector(`[data-region-group="${s.regionId}"]`)
    expect(box.getAttribute('role'), 'the target group is not a listbox').toBe('listbox')
    expect(box.getAttribute('aria-label'), 'the listbox does not say which region it is for').toMatch(/place/i)

    const opts = options()
    for (const o of opts) {
      expect(o.getAttribute('aria-label'), `${keyOf(o)} has no name`).toMatch(/choice \d+ of \d+/)
      expect(o.getAttribute('aria-setsize')).toBe(String(opts.length))
    }
    // Exactly one selected, and it is the tabbable one · aria-selected and the roving index must
    // agree or a screen reader announces a different cell from the one Enter will take.
    const sel = opts.filter(o => o.getAttribute('aria-selected') === 'true')
    expect(sel.length, 'more than one option claims to be selected').toBe(1)
    expect(keyOf(sel[0])).toBe(keyOf(roving()))
  })

  it('the focused target draws a ring · in the tree here, PAINTED is measured elsewhere', async () => {
    // Two levels, because they fail differently. This one asserts the polygon exists and that it
    // follows focus · a ring that never mounts, or one stuck on the wrong cell, dies here. Whether
    // its pixels are actually white on a hex sitting on a photograph is a rasterisation claim and is
    // measured in this session's P2; jsdom has no paint and must not pretend otherwise.
    await aimed()
    expect(document.querySelectorAll('[data-testid="hex-focus-ring"]').length,
      'a ring is drawn before anything has focus').toBe(0)

    const cur = roving()
    await act(async () => { cur.focus() })
    const rings = [...document.querySelectorAll('[data-testid="hex-focus-ring"]')]
    expect(rings.length, 'the focused target drew no ring · the only thing telling a keyboard player ' +
      'where they are').toBe(1)
    expect(rings[0].closest('g.hex-cell').getAttribute('data-hex'),
      'the ring is on a different hex from the cursor').toBe(keyOf(cur))
    // It must never eat a click · the bot and the pointer player both hit these same nodes.
    expect(rings[0].style.pointerEvents).toBe('none')

    await act(async () => { cur.blur() })
    expect(document.querySelectorAll('[data-testid="hex-focus-ring"]').length,
      'the ring outlived the focus that produced it').toBe(0)
  })

  it('no hex is an option when the flow is not asking for one', async () => {
    // Options only exist at the step that wants a hex. At idle the board is not a listbox and the
    // player tabbing through the page must not walk 57 cells to reach the sidebar.
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    expect(phase()).toBe('idle')
    expect(options().length, 'hexes are options at idle · the tab order carries the board when the ' +
      'player has not asked to place anything').toBe(0)
    expect(document.querySelectorAll('[data-region-group][role="listbox"]').length).toBe(0)
  })
})

describe('step 1 · the factories', () => {
  it('are buttons, are named by what they HOLD, and activate on Enter', async () => {
    render(<MemoryRouter><GameRoom practice practiceBots={0} /></MemoryRouter>)
    await until(() => screen.queryAllByTestId('factory').length > 0)
    const facs = screen.getAllByTestId('factory')
    expect(facs.length, 'no factories rendered · UNMEASURED').toBe(3)

    for (const f of facs) {
      expect(f.getAttribute('role'), 'a factory is not a button').toBe('button')
      expect(f.getAttribute('tabindex'), 'a factory is not in the tab order').toBe('0')
      // The name is the basis for choosing one · an empty factory is a dead end and must say so
      // before it is activated, not after.
      expect(f.getAttribute('aria-label'), 'a factory does not say what it holds')
        .toMatch(/Factory \d+ · (\d+ \w+|empty)/)
    }
    await act(async () => { facs[0].focus() })
    await press(facs[0], 'Enter')
    await until(() => phase() === 'factorySelected')
    expect(phase(), 'Enter on a focused factory did not pick it up').toBe('factorySelected')
    expect(facs[0].getAttribute('aria-pressed'), 'the picked factory does not report itself pressed').toBe('true')
  })
})
