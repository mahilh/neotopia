// SOUND · A LEVEL, NOT A SWITCH (T1 S69 · Council).
//
// ── THE FAILURE THE BRIEF NAMED, AND IT IS WHAT MOST OF THIS FILE IS ABOUT ───────────────────────
// "Two settings, one control, is the failure worth naming: a slider that persists a level but not
// the mute state, or vice versa."
// So `muted` and `volume` are two pieces of state and therefore two ways to be half-wrong, and the
// round trip is asserted TOGETHER rather than one at a time. The dangerous half is the quiet one:
// a level that survives a reload while the mute does not is silent on the next boot for a player who
// muted, and nothing anywhere errors.
//
// ── AND THE ONE THAT WOULD HAVE SHIPPED ─────────────────────────────────────────────────────────
// Dragging to 0 must NOT write 0 into `volume`. If it does, unmuting restores 0 · the button
// reports sound-on and the game stays silent · and it is invisible until somebody drags to zero and
// then presses the button. That is Rule 80's shape in a setting: a value resting at something that
// looks correct.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import SoundControl from './SoundControl'
import {
  isMuted, getVolume, effectiveVolume, setMuted, setVolume, playSound,
  __reloadSettings, __resetSound, __forceUnlock, __elementVolume,
} from '../utils/sound'

const MUTE_KEY = 'neotopia_muted_v1'
const VOL_KEY = 'neotopia_volume_v1'

const trigger = () => screen.getByTestId('mute-toggle')
const panel = () => screen.queryByTestId('sound-panel')
const slider = () => screen.queryByTestId('volume-slider')
const openPanel = async () => { await act(async () => { fireEvent.click(trigger()) }) }

beforeEach(() => {
  localStorage.clear()
  __resetSound()
  __reloadSettings()
})
afterEach(() => { cleanup(); localStorage.clear(); setMuted(false); setVolume(1) })

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · there is a range here, and it is not a switch in disguise', () => {
  it('the slider takes MORE THAN TWO values · a range that only reaches 0 and 1 is a mute button', async () => {
    // THE DEFINING PROPERTY, and the one nobody writes down because it is what "slider" MEANS
    // (Rule 110). Council's whole ruling is "a binary where a range belongs", so a control that
    // cannot express an intermediate level satisfies every other assertion in this file and none of
    // the requirement.
    render(<SoundControl />)
    await openPanel()
    const s = slider()
    expect(s, 'no slider in the panel').not.toBeNull()
    expect(s.getAttribute('type')).toBe('range')
    const step = Number(s.getAttribute('step'))
    const span = Number(s.getAttribute('max')) - Number(s.getAttribute('min'))
    expect(Math.round(span / step), `the control offers ${Math.round(span / step) + 1} positions · ` +
      'a range with two stops is the binary Council rejected').toBeGreaterThan(4)
  })

  it('and the level reaches the AUDIO ELEMENT · not just the accessor it is computed from', async () => {
    // ⚠ THIS ASSERTION WAS VACUOUS AND A MUTATION FOUND IT. It read `effectiveVolume()`, which is
    // the value the multiplication is computed FROM · so deleting `* effectiveVolume()` in the
    // module's element factory left it GREEN. Two sides of a check from one source agree by
    // construction (Rule 92). It reads the SINK now: the volume actually set on the element.
    setMuted(false)
    setVolume(1)
    __forceUnlock()
    playSound('hex-place')                       // creates the element
    const full = __elementVolume('hex-place')
    expect(full, 'no audio element was created · the assertion below is about null').not.toBeNull()
    expect(full, 'the element ignores the per-sound mix').toBeCloseTo(0.6, 5)   // GAIN['hex-place']

    setVolume(0.4)
    expect(__elementVolume('hex-place'), 'the player moved the slider and the element it feeds did ' +
      'not change · the level is a number nothing multiplies').toBeCloseTo(0.6 * 0.4, 5)

    setMuted(true)
    expect(__elementVolume('hex-place'), 'muting left the element at its old level').toBe(0)

    // ⚠ AND THE OTHER HALF, WHICH THE MUTATION SHOWED THE ABOVE CANNOT REACH. Everything so far
    // measures an element that ALREADY EXISTED when the level changed, and `applyVolume` repairs
    // those · so deleting the multiplication at element-CREATION stayed green. The path it breaks is
    // a sound heard for the FIRST time after a level change, which in a real session is most of
    // them: a player turns the volume down on turn one and every sample they have not triggered yet
    // is still created at full gain. Rule 132's shape · the fixture was already sitting on the value.
    setMuted(false)
    setVolume(0.4)
    __resetSound()            // drops every created element · the next play builds a fresh one
    __forceUnlock()
    playSound('district-score')
    expect(__elementVolume('district-score'), 'a sound played for the FIRST time after the level ' +
      'was lowered was created at full gain · the slider only affects samples the player happens to ' +
      'have heard already').toBeCloseTo(0.85 * 0.4, 5)   // GAIN['district-score']
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE TWO SETTINGS · asserted together
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('a level and a mute are two settings and BOTH survive a reload', () => {
  it('level 0.35 plus muted comes back as level 0.35 plus muted', async () => {
    setVolume(0.35)
    setMuted(true)
    expect(localStorage.getItem(VOL_KEY), 'the level was never written').toBeTruthy()
    expect(localStorage.getItem(MUTE_KEY), 'the mute was never written').toBe('1')

    __reloadSettings()   // the boot read, exactly as the module does it at import
    expect(getVolume(), 'the level did not survive · a player who turned it down is back at full ' +
      'on their next visit').toBeCloseTo(0.35, 5)
    expect(isMuted(), 'the mute did not survive · a player who muted hears the game again on their ' +
      'next visit, which is the louder half of the same defect').toBe(true)
    expect(effectiveVolume(), 'muted must win over the level').toBe(0)
  })

  it('unmuting returns to the LEVEL THEY CHOSE, not to full', async () => {
    // The whole point of keeping two values. If unmute restored 1.0 the slider would be a switch
    // with extra steps · exactly the binary Council was ruling against.
    setVolume(0.3)
    setMuted(true)
    setMuted(false)
    expect(getVolume()).toBeCloseTo(0.3, 5)
    expect(effectiveVolume(), 'unmuting jumped the player back to full volume').toBeCloseTo(0.3, 5)
  })

  it('dragging to ZERO mutes and LEAVES the level alone · the one that would have shipped', async () => {
    setVolume(0.6)
    setVolume(0)
    expect(isMuted(), 'dragging to zero left the game unmuted at level zero · two states for one ' +
      'silence, and the button now disagrees with the slider').toBe(true)
    expect(getVolume(), 'zero was written into the LEVEL · unmuting now restores silence, the ' +
      'button reports sound-on, and nothing errors').toBeCloseTo(0.6, 5)
    setMuted(false)
    expect(effectiveVolume(), 'unmute after a drag-to-zero produced silence').toBeCloseTo(0.6, 5)
  })

  it('dragging UP while muted unmutes · a control that does nothing is worse than no control', async () => {
    setMuted(true)
    setVolume(0.5)
    expect(isMuted(), 'the player dragged the slider and heard nothing · they have been told the ' +
      'control is broken').toBe(false)
    expect(effectiveVolume()).toBeCloseTo(0.5, 5)
  })

  it('refuses a level it cannot read rather than resolving to a plausible one', async () => {
    // Rule 80. Silently treating 'loud' as 1 or as 0 are opposite bugs and both look like a working
    // control from the outside.
    setVolume(0.42)
    for (const bad of [NaN, undefined, 'loud', null]) {
      expect(setVolume(bad), `setVolume(${String(bad)}) reported success`).toBe(false)
    }
    expect(getVolume(), 'a nonsense level overwrote a good one').toBeCloseTo(0.42, 5)
  })

  it('a corrupt stored level falls back to FULL · the pre-slider behaviour', async () => {
    // A player who has never touched this hears exactly what they heard before it existed, and a
    // garbage value cannot leave somebody silent with no way to know why.
    localStorage.setItem(VOL_KEY, 'banana')
    __reloadSettings()
    expect(getVolume()).toBe(1)
    localStorage.removeItem(VOL_KEY)
    __reloadSettings()
    expect(getVolume()).toBe(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE CONTROL
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the popover', () => {
  it('is closed until asked, and holds both the mute and the level', async () => {
    render(<SoundControl />)
    expect(panel(), 'the panel is open on arrival · it covers the header for every player').toBeNull()
    await openPanel()
    expect(panel()).not.toBeNull()
    expect(slider()).not.toBeNull()
    expect(screen.queryByTestId('mute-btn'), 'the popover cost a tap for mute and does not offer ' +
      'it · the one urgent action is now unreachable').not.toBeNull()
  })

  it('closes on Escape AND on an outside click · not only on the control that opened it', async () => {
    // The ScoreFlash shape (S35): a panel whose only exit is its own trigger. Both routes, because
    // one of them is the one a given player will try.
    render(<SoundControl />)
    await openPanel()
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })
    expect(panel(), 'Escape did not close it').toBeNull()

    await openPanel()
    await act(async () => { fireEvent.pointerDown(document.body) })
    expect(panel(), 'a click outside did not close it').toBeNull()
  })

  it('the trigger keeps toggling · it is excluded from the outside handler', async () => {
    // Without the exclusion the outside handler closes first and the click reopens · or worse, the
    // reverse · and the button reads as dead.
    // ⚠ AND IT MUST FIRE pointerdown, WHICH MY FIRST VERSION DID NOT. `fireEvent.click` alone never
    // reaches the outside-click listener, so removing the trigger exclusion left this GREEN · the
    // test exercised a path the defect does not live on (Rule 130b). A real tap is pointerdown THEN
    // click, in that order, and only that order can see it.
    render(<SoundControl />)
    const tap = async () => {
      await act(async () => {
        fireEvent.pointerDown(trigger())
        fireEvent.click(trigger())
      })
    }
    await tap()
    expect(panel(), 'the trigger did not open its own panel').not.toBeNull()
    await tap()
    expect(panel(), 'the trigger cannot close its own panel · the outside handler closes it on ' +
      'pointerdown and the click reopens it, so the button reads as dead').toBeNull()
  })

  it('the slider shows the EFFECTIVE level · a muted game reads 0, not the level underneath', async () => {
    setVolume(0.8)
    setMuted(true)
    render(<SoundControl />)
    await openPanel()
    expect(Number(slider().value), 'a muted game shows a level the player cannot hear').toBe(0)
    expect(slider().getAttribute('aria-valuetext')).toBe('muted')
  })

  it('announces a PERCENTAGE, and the trigger agrees with it', async () => {
    // A raw 0.65 is not a level to a screen reader, and three surfaces quoting different numbers for
    // one setting is the drift this file exists to prevent.
    setMuted(false)
    setVolume(0.65)
    render(<SoundControl />)
    await openPanel()
    expect(slider().getAttribute('aria-valuetext')).toBe('65 percent')
    expect(trigger().getAttribute('aria-label')).toContain('65 percent')
    expect(screen.getByText('65%'), 'the visible readout disagrees with the announced one').toBeTruthy()
  })

  it('every control in the panel is 44px · Rule 4', async () => {
    render(<SoundControl />)
    await openPanel()
    for (const el of [trigger(), screen.getByTestId('mute-btn'), slider()]) {
      const h = parseInt(el.style.height || el.style.minHeight || '0', 10)
      expect(h, `${el.getAttribute('data-testid')} is ${h}px tall`).toBeGreaterThanOrEqual(44)
    }
  })
})
