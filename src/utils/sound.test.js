// SOUND · THE PART CI CAN ACTUALLY HOLD (T1 S55).
//
// ⚠ NOTHING IN THIS SUITE CAN HEAR ANYTHING, and a silent product is indistinguishable from a working
// one to every assertion available. That is the same invisibility that let card art read 0/56 for
// fifteen sessions: a missing file renders nothing and raises nothing. So this file asserts two
// things a test CAN hold · that the app ASKED for the right sound at the right moment (the countable
// seam), and that the files it asks for EXIST and are the size that was budgeted.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  playSound, setMuted, isMuted, toggleMuted, SOUND_NAMES,
  __soundLog, __resetSound, __forceUnlock, __isUnlocked, installSoundUnlock,
} from './sound'

const AUDIO_DIR = path.resolve(__dirname, '../../public/audio')
const last = () => __soundLog[__soundLog.length - 1]

beforeEach(() => {
  __resetSound()
  try { localStorage.removeItem('neotopia_muted_v1') } catch {}
  setMuted(false)
})
afterEach(() => { vi.useRealTimers() })

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the instrument records, so a zero means something', () => {
  it('every attempt is logged whether or not it is allowed through', () => {
    __resetSound()
    playSound('ui-click')            // locked · dropped
    __forceUnlock()
    playSound('ui-click')            // allowed
    setMuted(true)
    playSound('ui-click')            // muted · dropped
    expect(__soundLog.map(e => e.reason), 'the log is not recording refusals · then "no sound played" ' +
      'and "the module was never asked" are the same reading (Rule 80)')
      .toEqual(['locked', null, 'muted'])
  })

  it('an unknown name is recorded as unknown, never silently ignored', () => {
    __forceUnlock()
    expect(playSound('no-such-sound')).toBe(false)
    expect(last().reason).toBe('unknown')
  })
})

describe('counterweight · every named sound has a real file behind it', () => {
  // A name with no file plays silence and raises nothing · exactly how the deck read 0/56 for
  // fifteen sessions while every test passed.
  it.each(SOUND_NAMES)('%s exists and is non-trivial', (name) => {
    const f = path.join(AUDIO_DIR, `${name}.ogg`)
    expect(fs.existsSync(f), `${name}.ogg is missing · this sound is silent and nothing errors`).toBe(true)
    expect(fs.statSync(f).size, `${name}.ogg is suspiciously small`).toBeGreaterThan(1000)
  })

  it('and the shipped audio stays inside its budget', () => {
    const oggs = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.ogg'))
    expect(oggs.length, 'the curated set changed size · re-state the budget if that is intended')
      .toBe(SOUND_NAMES.length)
    const total = oggs.reduce((n, f) => n + fs.statSync(path.join(AUDIO_DIR, f)).size, 0)
    // 104 KB measured. The wire is at 200 KB · far enough not to flake on a re-encode, close enough
    // that adding a music loop or a second pack reds instead of doubling the payload quietly.
    expect(total).toBeLessThan(200 * 1024)
  })

  it('the 2.4MB source pack is NOT in public/ · gitignore does not stop Vite', () => {
    // ⚠ THE FIRST VERSION OF THIS ASSERTION CHECKED .gitignore AND WAS WRONG · Rule 116, in the test
    // file I wrote for a feature whose whole risk is the artifact. Vite copies public/ WHOLESALE at
    // build time; git has no say in it. MEASURED before the fix: dist/audio/src held 238 files and
    // 2.4MB · 23x the curated audio · and would have deployed.
    // The pack now lives OUTSIDE public/ (audio-src/, gitignored), which is the only thing that
    // actually stops it, and this asserts the property that decides the outcome rather than the one
    // that felt like it should.
    expect(fs.existsSync(path.join(AUDIO_DIR, 'src')),
      'a directory under public/audio/ SHIPS, whatever .gitignore says · move it out of public/')
      .toBe(false)
    const shipped = fs.readdirSync(AUDIO_DIR)
    expect(shipped.filter(f => !f.endsWith('.ogg') && !f.startsWith('LICENSE')),
      'something that is not audio or a licence is sitting in the shipped folder').toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE DECISIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('autoplay · the first sound must not be the one that fails', () => {
  it('drops everything before the first gesture · it does NOT queue', () => {
    __resetSound()
    expect(__isUnlocked()).toBe(false)
    playSound('district-score')
    expect(last().reason, 'a pre-gesture sound must be dropped').toBe('locked')
    expect(last().played).toBe(false)
  })

  it('a pointer gesture unlocks, and a key gesture does too', () => {
    __resetSound()
    const teardown = installSoundUnlock(document)
    expect(__isUnlocked()).toBe(false)
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(__isUnlocked(), 'the unlock is not bound to a real gesture · every sound stays locked').toBe(true)
    teardown()

    __resetSound()
    const t2 = installSoundUnlock(document)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(__isUnlocked(), 'a keyboard player never unlocks sound').toBe(true)
    t2()
  })

  it('the unlock plays nothing by itself', () => {
    // A warm-up tone on first touch is a noise the player did not ask for and cannot explain. The
    // gesture that unlocks already fires its own sound.
    __resetSound()
    const teardown = installSoundUnlock(document)
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(__soundLog, 'the unlock played something of its own').toHaveLength(0)
    teardown()
  })
})

describe('rapid fire · RESTART, stated and asserted', () => {
  it('three placements in one turn are three sounds, not one', () => {
    __forceUnlock()
    vi.useFakeTimers()
    const t0 = Date.now()
    vi.setSystemTime(t0)
    playSound('hex-place')
    vi.setSystemTime(t0 + 700)
    playSound('hex-place')
    vi.setSystemTime(t0 + 1400)
    playSound('hex-place')
    const attempts = __soundLog.filter(e => e.name === 'hex-place')
    expect(attempts, 'a placement was swallowed · debouncing hides an action the player took')
      .toHaveLength(3)
    expect(attempts.every(e => e.reason !== 'debounced')).toBe(true)
  })

  it('but a genuine double-fire inside 40ms is swallowed', () => {
    // StrictMode double-invoke, or a handler bound twice · not something a human can do.
    __forceUnlock()
    vi.useFakeTimers()
    const t0 = Date.now()
    vi.setSystemTime(t0)
    playSound('hex-place')
    vi.setSystemTime(t0 + 5)
    playSound('hex-place')
    expect(last().reason).toBe('debounced')
  })

  it('DIFFERENT sounds never block each other · a scoring placement is impact AND bell', () => {
    __forceUnlock()
    vi.useFakeTimers()
    const t0 = Date.now()
    vi.setSystemTime(t0)
    playSound('hex-place')
    vi.setSystemTime(t0 + 5)
    playSound('district-score')
    expect(last().reason, 'the debounce is global rather than per-sound · the payoff sound is lost ' +
      'exactly when a placement scores, which is the one moment it exists for').not.toBe('debounced')
  })
})

describe('mute', () => {
  it('drops sound and persists across a reload', () => {
    __forceUnlock()
    setMuted(true)
    expect(isMuted()).toBe(true)
    playSound('ui-click')
    expect(last().reason).toBe('muted')
    expect(localStorage.getItem('neotopia_muted_v1'), 'mute must survive a refresh · a setting that ' +
      'resets is a setting the player has to make every session').toBe('1')
  })

  it('toggles back, and unmuting is not itself silent', () => {
    __forceUnlock()
    setMuted(true)
    toggleMuted()
    expect(isMuted()).toBe(false)
    expect(playSound('ui-click')).toBe(true)
  })
})
