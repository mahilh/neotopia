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
const VOL_KEY = 'neotopia_volume_v1'
const MIN_INTERVAL_MS = 40

// ── VOLUME · A LEVEL AND A MUTE ARE TWO SETTINGS, AND THE FAILURE IS PERSISTING ONE (T1 S69) ──────
// Council: "a player who finds the sound too loud can only turn it off entirely · that is a binary
// where a range belongs, and it is the difference between a player muting permanently and turning
// it down."
//
// ONE SFX CHANNEL, not music + SFX. There are ten samples and no music, so a second slider would
// control nothing · a control for an empty channel is worse than no control, because it teaches a
// player the mix has two halves and one of them is broken.
//
// THE COMPOSITION IS THE WHOLE DESIGN, and it is the failure worth naming: `muted` and `volume` are
// stored SEPARATELY so that unmuting returns you to the level you chose rather than to full. That is
// two pieces of state and therefore two ways to be half-wrong, so both are persisted, both are read
// back on boot, and the round trip is gated together rather than one at a time.
//   effective = muted ? 0 : volume        · mute always wins over the level
//   setVolume(v > 0)                      · UNMUTES · dragging a slider is an intent to hear, and a
//                                           player who drags while muted and hears nothing has been
//                                           told the control is broken
//   setVolume(0)                          · MUTES, and LEAVES `volume` alone, so the mute button
//                                           restores the level they had rather than silence
// The last line is the one that would be got wrong: writing 0 into `volume` makes unmute a no-op,
// and it is invisible until somebody drags to zero and then presses the button (Rule 80's shape in a
// setting · a value resting at something that looks correct).
const clampVolume = (v) => {
  // ⚠ THE NULL CHECK IS THE WHOLE FUNCTION, AND WITHOUT IT THE DEFAULT WAS SILENCE.
  // `Number(null)` is 0 and `Number('')` is 0, both finite · so a MISSING stored level read back as
  // a deliberate zero, and every player who had never touched the slider would have booted muted at
  // level 0 with a control that said the sound was on. My own test caught it on its first run; no
  // amount of rereading would have, because 0 is exactly the value a broken read produces AND a
  // legitimate value the setting can hold (Rule 80 · a value resting at something that looks
  // correct, in the one place where the resting value is the product being silent).
  // It bites setVolume too: `setVolume(null)` would have MUTED the game rather than refusing.
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null      // NOT a plausible default · the caller passed nonsense
  return Math.min(1, Math.max(0, n))
}

const nodes = new Map()
const lastPlayed = new Map()
const listeners = new Set()
let unlocked = false
let muted = (() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })()
// A stored level that is missing, empty or garbage falls back to FULL · the pre-S69 behaviour, so a
// player who has never touched the slider hears exactly what they heard before it existed.
let volume = (() => {
  try { return clampVolume(localStorage.getItem(VOL_KEY)) ?? 1 } catch { return 1 }
})()

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
/** Re-read both settings from storage · for tests that write localStorage directly. */
export const __reloadSettings = () => {
  try { muted = localStorage.getItem(KEY) === '1' } catch { muted = false }
  try { volume = clampVolume(localStorage.getItem(VOL_KEY)) ?? 1 } catch { volume = 1 }
}

// Subscribers were called with the boolean before S69 and still are · every existing caller reads
// exactly one argument. The level rides alongside it so a component can take both from one
// subscription rather than opening a second one that can drift out of step.
const notify = () => { for (const fn of listeners) { try { fn(muted, volume) } catch {} } }

export const isMuted = () => muted
export const getVolume = () => volume
/** What a sound is actually multiplied by right now. Mute always wins over the level. */
export const effectiveVolume = () => (muted ? 0 : volume)
export const subscribeMuted = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export function setMuted(next) {
  muted = !!next
  try { localStorage.setItem(KEY, muted ? '1' : '0') } catch {}
  if (muted) for (const el of nodes.values()) { try { el.pause() } catch {} }
  applyVolume()
  notify()
}
export const toggleMuted = () => setMuted(!muted)

/**
 * Set the SFX level, 0..1.
 *
 * v > 0 unmutes and v === 0 mutes · see the header. `volume` itself is never written to 0, so the
 * mute button always has a level to come back to.
 */
export function setVolume(next) {
  const v = clampVolume(next)
  if (v === null) return false              // refuse rather than resolve to a plausible level
  if (v === 0) { setMuted(true); return true }
  volume = v
  try { localStorage.setItem(VOL_KEY, String(v)) } catch {}
  if (muted) { setMuted(false); return true }   // setMuted applies + notifies
  applyVolume()
  notify()
  return true
}

/** Push the current effective level onto every element that has already been created. */
function applyVolume() {
  const e = effectiveVolume()
  for (const [name, el] of nodes) {
    try { el.volume = (GAIN[name] ?? 0.5) * e } catch {}
  }
}

const node = (name) => {
  if (typeof Audio === 'undefined') return null
  let el = nodes.get(name)
  if (!el) {
    try {
      el = new Audio(`/audio/${FILES[name]}`)
      el.preload = 'auto'
      // The per-sound mix TIMES the player's level · GAIN keeps the shape of the mix (district-score
      // stays the loudest thing in the game) and the slider scales all of it together.
      el.volume = (GAIN[name] ?? 0.5) * effectiveVolume()
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

/**
 * The volume actually set on a created Audio element, or null if it has not been created yet.
 *
 * EXISTS BECAUSE A MUTATION FOUND MY ASSERTION VACUOUS. My "the level reaches the mix" test read
 * `effectiveVolume()` · which is the value the multiplication is computed FROM, not the value it
 * lands on · so deleting the multiplication in `node()` left the suite green (Rule 92 · two sides
 * of a check from one source agree by construction). This is the SINK.
 */
export const __elementVolume = (name) => {
  const el = nodes.get(name)
  return el ? el.volume : null
}

export const __isUnlocked = () => unlocked
export const __forceUnlock = () => { unlocked = true }

export default playSound
