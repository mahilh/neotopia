import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

// Plato's Cave Allegory · the ascent out of the cave, one phrase per sacred threshold (PLATO_BOOKS ·
// Pillar 3). NEW lore layered over the store's symbol/message · never a re-hardcode of either (Rule 62) ·
// keyed off the live milestone number the store already hands us.
const CAVE_ASCENT = { 7: 'First light', 9: 'Turning', 13: 'Eyes open', 18: 'Clear sight', 27: 'The Good', 36: 'Return' }

// The mystery school reveals itself · a brief centered overlay when a player's total crosses a sacred
// number (7/9/13/18/27/36 · fired by the store's tryScoreCard · T2 S15). Auto-dismisses after 2500ms
// (2+5=7 · spiritual perfection). The symbol + message come STRAIGHT from the live signal (the store
// already spreads SACRED_MILESTONES into sacredMilestone · Rule 62: read the value, never re-hardcode a
// table that can drift · the store is the single source of truth for which glyph each milestone carries).
export default function MilestoneOverlay() {
  const sacredMilestone = useGameStore(s => s.sacredMilestone)
  const clearMilestone = useGameStore(s => s.clearMilestone)

  useEffect(() => {
    if (!sacredMilestone) return
    const id = setTimeout(() => clearMilestone(), 2500)
    return () => clearTimeout(id)
  }, [sacredMilestone, clearMilestone])

  if (!sacredMilestone) return null

  const { milestone, symbol, message } = sacredMilestone

  return (
    <div
      data-testid="milestone-overlay"
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,46,0.85)',
        animation: 'milestoneIn 2.5s ease forwards',
        pointerEvents: 'none', textAlign: 'center', padding: 24,
      }}
    >
      <div style={{ fontSize: 48, color: '#C89440', lineHeight: 1 }}>{symbol ?? '✷'}</div>
      <div style={{ fontSize: 32, fontWeight: 500, color: '#C89440', fontVariantNumeric: 'tabular-nums', marginTop: 8 }}>
        {milestone}
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 12, letterSpacing: 1.5, maxWidth: 280, lineHeight: 1.5 }}>
        {message}
      </div>
      {/* Cave-ascent phrase · Plato's allegory made scoreable (PLATO_BOOKS · Pillar 3) */}
      {CAVE_ASCENT[milestone] && (
        <div data-testid="cave-ascent" style={{ fontSize: 11, color: 'rgba(200,148,64,0.7)', marginTop: 14, letterSpacing: 4, textTransform: 'uppercase' }}>
          The Cave · {CAVE_ASCENT[milestone]}
        </div>
      )}
    </div>
  )
}
