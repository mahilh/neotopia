import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

// One plain build-progress phrase per milestone · the same ascent shape (Plato's Cave, PLATO_BOOKS ·
// Pillar 3) told in city-builder words a first-time player reads without explanation. NEW copy layered
// over the store's symbol/message · never a re-hardcode of either (Rule 62) · keyed off the live
// milestone number the store already hands us. T1 S27: the WORDS were rewritten, the KEYS were not ·
// 7/9/13/18/27/36 are balance-tested and 3-6-9 aligned, and they never change.
// Read these COMPOSED with the store's message above them, not alone (Rule 65 · T2 rewrote
// SACRED_MILESTONES in the same session). 9 is 'First blocks done' rather than 'First lights on'
// because the line above it at 9 reads "a quarter of the city, finished" · and "first lights" under
// "finished" is a small contradiction the player would feel without being able to name it.
const BUILD_STAGES = { 7: 'Foundations set', 9: 'First blocks done', 13: 'District online', 18: 'Skyline rising', 27: 'Landmark built', 36: 'Master builder' }

// A brief centered overlay when a player's total crosses a milestone number (7/9/13/18/27/36 · fired
// by the store's tryScoreCard · T2 S15). Auto-dismisses after 2500ms. The symbol + message come
// STRAIGHT from the live signal (the store
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
      {/* Plain build-progress phrase · what this milestone means for the city, in words that need no gloss */}
      {BUILD_STAGES[milestone] && (
        <div data-testid="milestone-phrase" style={{ fontSize: 11, color: 'rgba(200,148,64,0.7)', marginTop: 14, letterSpacing: 4, textTransform: 'uppercase' }}>
          {BUILD_STAGES[milestone]}
        </div>
      )}
    </div>
  )
}
