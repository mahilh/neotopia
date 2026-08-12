// NEOTOPIA · SOUND (T1 S55).
//
// The game made no sound at all. Ten curated Kenney OGGs (CC0, no attribution required, licence
// beside them in public/audio/) total 104 KB · about 11% of the shipped art. The 230-file source
// pack lives in public/audio/src/ and is gitignored; nothing here may reference it.
//
// ── THE FAILURE I CANNOT HEAR, NAMED BEFORE TRUSTING ANY OF THIS ─────────────────────────────────
// A silent product and a working one are indistinguishable from every test I can run. There is no
// assertion in CI that hears anything. So the module is built around a COUNTABLE seam: every attempt
// increments `__soundLog`, and the gates assert what was attempted, with what name, how many times.
// Without that, "sound shipped" would rest on me having clicked around once (Rule 80 · a system that
// cannot report a failure reports health).
//
// ── AUTOPLAY · THE FIRST SOUND MUST NOT BE THE ONE THAT FAILS ────────────────────────────────────
// Browsers refuse audio until a user gesture. If the first attempt is `turn-start` (a timer) or
// `district-score` (an engine event), it is rejected, and on some engines the rejection also poisons
// the element. So unlocking is bound to the first POINTER OR KEY event, which in this product is
// always a real press · and `ui-click` is what fires there anyway, so the unlock and the first sound
// are the same event rather than a silent warm-up nobody asked for.
// Anything attempted before that is DROPPED, not queued: a queued sound arrives detached from what
// caused it, which is worse than silence.
//
// ── RAPID FIRE · THE DECISION, STATED ────────────────────────────────────────────────────────────
// Three placements in one turn means three `hex-place` calls in ~2 seconds. Three options and I am
// taking the middle one:
//   overlap   · clone a node per call. Identical samples stacking comb-filter into something much
//               louder than one, and three soft impacts become a clatter.
//   DEBOUNCE  · swallows a placement the player actually made. The whole point is that the action
//               has a voice; silently dropping one is a lie about what happened.
//   RESTART   · CHOSEN. The same sound restarts from 0; DIFFERENT sounds overlap freely because they
//               are separate elements. So three placements give three distinct impacts, a placement
//               that scores gives you the impact AND the bell together, and no sample ever stacks on
//               itself. A 40ms floor per name swallows a genuine double-fire from one interaction
//               (React StrictMode, a double-bound handler) without touching anything a human can do
//               twice.

const FILES = {
  'ui-click': 'ui-click.ogg',
  'element-select': 'element-select.ogg',
  'hex-place': 'hex-place.ogg',
  'card-complete': 'card-complete.ogg',
  'district-score': 'district-score.ogg',
  'bonus-earned': 'bonus-earned.ogg',
  'turn-start': 'turn-start.ogg',
  'refused': 'refused.ogg',
  'sheet-toggle': 'sheet-toggle.ogg',
  'game-end': 'game-end.ogg',
}
export const SOUND_NAMES = Object.keys(FILES)

// Per-sound level. district-score is the payoff moment · a player who scores a district currently
// gets an 11px line in error red, and this is meant to be the sound they want to hear again. ui
// chatter sits well under it so the mix has a shape rather than ten things at once.
const GAIN = {
  'ui-click': 0.35, 'element-select': 0.4, 'sheet-toggle': 0.3, 'refused': 0.45,
  'hex-place': 0.6, 'turn-start': 0.5, 'card-complete': 0.7,
  'district-score': 0.85, 'bonus-earned': 0.75, 'game-end': 0.8,
}

const KEY = 'neotopia_muted_v1'
const MIN_INTERVAL_MS = 40

const nodes = new Map()
const lastPlayed = new Map()
const listeners = new Set()
let unlocked = false
let muted = (() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })()

// The countable seam. Every ATTEMPT lands here whether or not the browser lets it through, so a
// test can tell "the app asked for this sound" from "the app never asked".
const log = []
export const __soundLog = log
export const __resetSound = () => {
  log.length = 0
  nodes.clear()
  lastPlayed.clear()
  unlocked = false
}

const notify = () => { for (const fn of listeners) { try { fn(muted) } catch {} } }

export const isMuted = () => muted
export const subscribeMuted = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export function setMuted(next) {
  muted = !!next
  try { localStorage.setItem(KEY, muted ? '1' : '0') } catch {}
  if (muted) for (const el of nodes.values()) { try { el.pause() } catch {} }
  notify()
}
export const toggleMuted = () => setMuted(!muted)

const node = (name) => {
  if (typeof Audio === 'undefined') return null
  let el = nodes.get(name)
  if (!el) {
    try {
      el = new Audio(`/audio/${FILES[name]}`)
      el.preload = 'auto'
      el.volume = GAIN[name] ?? 0.5
      nodes.set(name, el)
    } catch { return null }
  }
  return el
}

/**
 * Attempt a sound. Never throws, never rejects into the console, never blocks a game action ·
 * audio is decoration and a decoration that can break a turn is a defect.
 */
export function playSound(name) {
  const known = Object.hasOwn(FILES, name)
  const now = Date.now()
  const since = now - (lastPlayed.get(name) ?? -Infinity)
  const entry = { name, known, muted, unlocked, at: now, played: false, reason: null }
  log.push(entry)
  if (log.length > 200) log.shift()

  if (!known) { entry.reason = 'unknown'; return false }
  if (muted) { entry.reason = 'muted'; return false }
  if (!unlocked) { entry.reason = 'locked'; return false }
  if (since < MIN_INTERVAL_MS) { entry.reason = 'debounced'; return false }

  const el = node(name)
  if (!el) { entry.reason = 'no-audio'; return false }
  lastPlayed.set(name, now)
  try {
    el.currentTime = 0                       // RESTART · see the header
    const p = el.play()
    // A rejected promise here is normal (autoplay policy, a tab going background) and must never
    // surface. Swallowed DELIBERATELY and recorded, not swallowed silently (Rule 93).
    if (p && typeof p.catch === 'function') p.catch(err => { entry.reason = 'rejected:' + (err?.name ?? 'err') })
    entry.played = true
    return true
  } catch (err) { entry.reason = 'threw:' + (err?.name ?? 'err'); return false }
}

/**
 * Bind the unlock to the first real user gesture. Idempotent; safe to call from an effect.
 * Returns a teardown.
 */
export function installSoundUnlock(target = typeof document !== 'undefined' ? document : null) {
  if (!target) return () => {}
  const onGesture = () => {
    if (unlocked) return
    unlocked = true
    // Do NOT play anything here. The gesture that unlocks is already going to fire its own sound
    // (a button press plays ui-click), and a warm-up tone on first touch is a noise the player did
    // not ask for and cannot explain.
  }
  target.addEventListener('pointerdown', onGesture, { capture: true })
  target.addEventListener('keydown', onGesture, { capture: true })
  return () => {
    target.removeEventListener('pointerdown', onGesture, { capture: true })
    target.removeEventListener('keydown', onGesture, { capture: true })
  }
}

export const __isUnlocked = () => unlocked
export const __forceUnlock = () => { unlocked = true }

export default playSound
