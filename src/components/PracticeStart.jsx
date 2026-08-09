// NeoTopia · practice entry point + opponent-count selector (T1 S32).
//
// WHY THIS EXISTS. Arriving ALONE is the only broken path in the product, and it is what nearly
// everyone does. canStart requires two connected players, so a first visitor creates a room and stops
// in front of a button that can never enable (S31 · measured live, and T3's solo-host spec pins it).
// The two-player path itself works end to end · T3 ran it green in 10.9s, and Mahil played laptop →
// WhatsApp invite → phone → Turn 1 by hand. The gap was never a defect. It is that the commonest
// arrival had nowhere to go.
//
// PRACTICE IS NOT A ROOM, and the UI has to keep saying so. Mahil's constraint is that practice costs
// ZERO anonymous sign-ins, which means no room row, no seat claim, no presence channel, no invite and
// no Start gate · nothing to wait for and nobody to wait for. If a room code ever appears on a
// practice screen, the constraint has been lost upstream and this component's shape will show it.
//
// This file is the ENTRY POINT ONLY. Seating a bot is T2's (the bot already plays the real engine
// through the real store) and the auth-free session shape is T3's · both requested in comms before
// this was written rather than guessed at.

import { useState } from 'react'

// ── The honest half ──────────────────────────────────────────────────────────────────────────────
// Zero opponents runs TODAY: GameRoom with no roomId already seeds a local game with no realtime, so
// free exploration is a real, complete thing a player can do right now. Bot opponents are not wired
// yet, and a selector that looks live and then hands you an empty board is exactly the broken promise
// this session exists to stop making · so the counts that do not work say so, and cannot be picked.
// FLIP THIS when T2's bot seats land. It is a single greppable constant on purpose (Rule 32 ·
// constants, not magic), and the test below asserts the disabled options really are unclickable.
export const BOT_OPPONENTS_READY = false

export const OPPONENT_CHOICES = [
  { bots: 0, label: 'Just me', detail: 'Free exploration · learn the board' },
  { bots: 1, label: '1 bot',   detail: 'A single opponent' },
  { bots: 2, label: '2 bots',  detail: 'Three-player game' },
  { bots: 3, label: '3 bots',  detail: 'A full four-player table' },
]

/**
 * @param {(bots:number) => void} onStart  fired with the chosen opponent count
 * @param {boolean} [compact]              tighter layout for the lobby card (the landing page has room)
 */
export default function PracticeStart({ onStart, compact = false }) {
  // Defaults to the option that actually works. A default pointing at a disabled choice would make the
  // primary button dead on arrival, which is the same wall in a new coat.
  const [bots, setBots] = useState(0)
  const available = (n) => n === 0 || BOT_OPPONENTS_READY

  return (
    <div data-testid="practice-start" style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }}>
      <div>
        <p style={heading}>Practice</p>
        <p style={sub}>No room, no code, nobody to wait for. Play as long as you like.</p>
      </div>

      <div role="radiogroup" aria-label="Practice opponents" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {OPPONENT_CHOICES.map(c => {
          const enabled = available(c.bots)
          const selected = bots === c.bots
          return (
            <button
              key={c.bots}
              role="radio"
              aria-checked={selected}
              aria-disabled={!enabled}
              disabled={!enabled}
              data-testid={`practice-bots-${c.bots}`}
              data-selected={selected ? 'true' : 'false'}
              title={enabled ? c.detail : 'Bot opponents are not ready yet'}
              onClick={() => enabled && setBots(c.bots)}
              style={{
                flex: '1 1 68px', minHeight: 44, borderRadius: 8, padding: '6px 8px',
                cursor: enabled ? 'pointer' : 'not-allowed',
                opacity: enabled ? 1 : 0.35,
                border: selected ? '2px solid #C89440' : '1px solid rgba(255,255,255,0.12)',
                background: selected ? 'rgba(200,148,64,0.1)' : 'transparent',
                color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500,
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {/* The selected option explains itself · and when a count is unavailable the reason is stated
          rather than left as a grey rectangle the player has to guess about. */}
      <p data-testid="practice-detail" style={sub}>
        {BOT_OPPONENTS_READY
          ? OPPONENT_CHOICES.find(c => c.bots === bots)?.detail
          : 'Bot opponents are on the way. Free exploration is ready now · the board, the cards and the tutorial, with no clock pressure.'}
      </p>

      <button
        data-testid="practice-start-btn"
        onClick={() => onStart?.(bots)}
        style={{
          minHeight: 48, borderRadius: 9, cursor: 'pointer', width: '100%',
          border: '1px solid rgba(200,148,64,0.45)', background: 'rgba(200,148,64,0.14)',
          color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: 500, letterSpacing: 0.4,
        }}
      >
        Start practice
      </button>
    </div>
  )
}

const heading = { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600, letterSpacing: 0.4, margin: 0 }
const sub = { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5, margin: '4px 0 0' }
