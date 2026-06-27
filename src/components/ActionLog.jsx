import { memo } from 'react'

// Left-of-board action log · the game's shared memory (colonist UX · T1 S15). Both players see what
// just happened. Entries fade with age (older turns dim toward 0.12). Never blocks board interaction
// (pointerEvents: none) and is hidden on narrow mobile via the .action-log-wrap media rule in index.css.
const MAX_ENTRIES = 10

function ActionLog({ entries = [] }) {
  const currentTurn = entries[entries.length - 1]?.turn ?? 0
  const visible = entries.slice(-MAX_ENTRIES) // oldest → newest of the last 10

  return (
    <div
      className="action-log-wrap"
      style={{
        position: 'absolute', left: 8, top: 8, bottom: 8,
        width: 168, pointerEvents: 'none', zIndex: 5,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        gap: 4, overflow: 'hidden',
      }}
    >
      {visible.map((entry) => {
        const age = currentTurn - entry.turn
        const opacity = Math.max(0.12, 1 - age * 0.12) // newest full · fades ~12% per turn of age
        return (
          <div key={entry.id} style={{
            fontSize: 11, fontFamily: 'serif', letterSpacing: 0.4, lineHeight: 1.3,
            color: entry.color ?? 'rgba(255,255,255,0.6)',
            opacity, transition: 'opacity 0.4s ease',
          }}>
            {entry.text}
          </div>
        )
      })}
    </div>
  )
}

export default memo(ActionLog)
