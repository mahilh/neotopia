import { useEffect, useRef, useState } from 'react'
import { isMuted, getVolume, setMuted, setVolume, subscribeMuted, playSound } from '../utils/sound'

// SOUND · A LEVEL, NOT A SWITCH (T1 S69 · Council).
//
// ── THE RULING ───────────────────────────────────────────────────────────────────────────────────
// "A player who finds the sound too loud can only turn it off entirely · that is a binary where a
// range belongs, and it is the difference between a player muting permanently and turning it down."
// ONE SFX slider, in a popover from the existing mute button, persisted.
//
// ⚠ ONE CHANNEL, NOT TWO. The product ships ten samples and no music, so a second slider would
// control nothing · a control for an empty channel is worse than no control, because it teaches a
// player the mix has two halves and one of them is broken.
//
// ── WHAT THE POPOVER COSTS, STATED BECAUSE IT IS A REAL LOSS ─────────────────────────────────────
// Before this, one tap muted. Now one tap opens the panel and the mute is inside it, so the most
// urgent action ("this is too loud RIGHT NOW") is one tap deeper. Council ruled the popover knowing
// that; the compensations are that the icon still carries the state at a glance, and that the mute
// button is the FIRST thing in the panel and is 44px.
// TRIPWIRE (Council): if a playtester mutes rather than adjusting, the slider is not discoverable
// and belongs visible. That is a playtest question, not one I can answer from here.
//
// ── DISMISSAL · THE ScoreFlash LESSON (S35), APPLIED WITHOUT BEING TOLD AGAIN ────────────────────
// A panel whose only exit is the control that opened it is the shape that shipped a full-screen
// overlay nobody could close. Escape closes it, a pointerdown anywhere outside closes it, and the
// trigger is excluded from the outside handler so its own onClick keeps toggling rather than being
// closed here and reopened by the same click (which makes the button look dead).
// The open flag is read through a REF so the listeners attach exactly once · and, more usefully, so
// that empty deps are SAFE. Empty deps with a direct read of `open` captures false forever and
// Escape silently stops working, with nothing in the console (Rule 76's family · T1 S39).
export default function SoundControl() {
  const [muted, setMutedState] = useState(isMuted)
  const [volume, setVolumeState] = useState(getVolume)
  const [open, setOpen] = useState(false)

  // ONE SUBSCRIPTION FOR BOTH VALUES. Two would be two things to keep in step, and the failure the
  // brief names is exactly a half-applied setting.
  useEffect(() => subscribeMuted((m, v) => { setMutedState(m); if (typeof v === 'number') setVolumeState(v) }), [])

  const panelRef = useRef(null)
  const triggerRef = useRef(null)
  // Where the panel's top edge goes, measured from the trigger when it opens · see the anchoring
  // note on the panel itself for why this is `fixed` rather than `absolute`.
  const [top, setTop] = useState(0)
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && openRef.current) setOpen(false) }
    const onDown = (e) => {
      if (!openRef.current) return
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [])

  // THE SLIDER SHOWS THE EFFECTIVE LEVEL, so a muted game reads 0 rather than showing a level the
  // player cannot hear. Writing to it is an intent to hear: setVolume(v > 0) unmutes, and dragging
  // to 0 mutes without destroying the level, so the button comes back to where they were.
  const shown = muted ? 0 : volume
  const pct = Math.round(shown * 100)

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={triggerRef}
        data-testid="mute-toggle"
        data-sound-open={open ? 'true' : 'false'}
        onClick={() => {
          const r = triggerRef.current?.getBoundingClientRect()
          if (r) setTop(r.bottom + 8)
          setOpen(o => !o)
        }}
        aria-expanded={open}
        aria-label={muted ? 'Sound off · adjust volume' : `Sound at ${pct} percent · adjust volume`}
        title={muted ? 'Sound off' : `Sound ${pct}%`}
        style={{
          width: 44, height: 44, minHeight: 44, flexShrink: 0, borderRadius: 8,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${open ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.14)'}`,
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          color: muted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
          fontSize: 15, lineHeight: 1, cursor: 'pointer',
          transition: 'color 0.2s, border-color 0.2s',
        }}
      >
        <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          data-testid="sound-panel"
          role="group"
          aria-label="Sound"
          style={{
            // ⚠ ANCHORED TO THE VIEWPORT, NOT TO THE TRIGGER · AND I SHIPPED THE OTHER ONE FIRST.
            // `position: absolute; right: 0` puts the panel's right edge on the TRIGGER's right
            // edge, and this trigger is not at the right of the screen: measured at 320 it sits at
            // x 81.9..125.9, so a 244px panel ran from x=-118 to x=126 and the MUTE BUTTON · the one
            // urgent control · was entirely off screen and unreachable (elementFromPoint said so).
            // Every jsdom test passed, because jsdom has no layout and cannot hold this claim.
            // I had quoted the ActionBar's identical bug in the comment two lines above while
            // writing it (Rule 116 · a source read cannot answer a composed question, and knowing
            // the answer is not the same as reading the value).
            // `fixed` + a measured top is what makes the horizontal anchor independent of wherever
            // the header grid happens to put the trigger. 244px into 296px of gutter-free width
            // fits at 320 with room to spare.
            // LIMIT, stated: the top is measured when the panel OPENS, so a scroll or a resize with
            // it open would detach it. The header does not scroll and the panel closes on any
            // outside pointerdown, so neither is reachable today · but it is a real bound, not an
            // argument that it cannot happen.
            position: 'fixed', top, right: 12, zIndex: 40,
            width: 'max-content', maxWidth: 'calc(100vw - 24px)',
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(13,13,24,0.98)', border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          {/* MUTE FIRST · it is the urgent action and the one this panel cost a tap. 44px (Rule 4). */}
          <button
            data-testid="mute-btn"
            onClick={() => { if (muted) playSound('ui-click'); setMuted(!muted) }}
            aria-label={muted ? 'Unmute game sounds' : 'Mute game sounds'}
            aria-pressed={muted}
            style={{
              height: 44, minHeight: 44, minWidth: 44, padding: '0 10px', borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.14)', background: 'transparent',
              color: muted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
              fontSize: 15, lineHeight: 1, cursor: 'pointer',
            }}
          >
            <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
          </button>

          <input
            data-testid="volume-slider"
            data-volume={shown}
            type="range"
            min="0" max="1" step="0.05"
            value={shown}
            onChange={(e) => {
              setVolume(Number(e.target.value))
              // The level is only knowable by HEARING it, so the drag has to make a sound. ui-click
              // is the quietest sample in the mix and is already the one every control fires.
              playSound('ui-click')
            }}
            aria-label="Sound effects volume"
            // A raw 0..1 is not a level to a screen reader. The percentage is what the tooltip and
            // the trigger's own label say, so all three agree.
            aria-valuetext={muted ? 'muted' : `${pct} percent`}
            style={{ width: 120, height: 44, cursor: 'pointer', accentColor: '#C89440' }}
          />
          <span style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 12, fontVariantNumeric: 'tabular-nums',
            minWidth: 34, textAlign: 'right',
          }}>
            {pct}%
          </span>
        </div>
      )}
    </div>
  )
}
