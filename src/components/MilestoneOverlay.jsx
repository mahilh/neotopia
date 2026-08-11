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
// ── WHOSE MILESTONE IS IT (T1 S44) ──────────────────────────────────────────────────────────────
// The store has always stamped the seat · `sacredMilestone = { player: seat, ... }` · and this
// component threw it away. So the full-screen gold celebration, "a quarter of the city, finished",
// FIRST BLOCKS DONE, fired identically when a BOT crossed nine. A browser audit caught the result
// and named it exactly right: the celebration fires for the opponent while the player's own reward
// is a line in the action log. The party was being thrown for whoever happened to cross, and the
// player had no way to tell which.
// It is not enough to hide it on an opponent's crossing · a rival reaching nine is real information
// and deleting it makes the game quieter, not fairer. So it is ATTRIBUTED: mine is a celebration,
// theirs is a notice, and the two do not look alike.
export default function MilestoneOverlay({ mySeat = null }) {
  const sacredMilestone = useGameStore(s => s.sacredMilestone)
  const clearMilestone = useGameStore(s => s.clearMilestone)
  const players = useGameStore(s => s.players)

  useEffect(() => {
    if (!sacredMilestone) return
    const id = setTimeout(() => clearMilestone(), 2500)
    return () => clearTimeout(id)
  }, [sacredMilestone, clearMilestone])

  if (!sacredMilestone) return null

  const { milestone, symbol, message } = sacredMilestone
  // mySeat null is SOLO · there is no opponent, so every milestone is the player's own. A game with
  // no seat concept must not have its celebration downgraded by a null check (the S32 lesson: null
  // stops meaning "solo" the moment a second seat exists, and it means it again when one does not).
  const isMine = mySeat === null || sacredMilestone.player === mySeat
  const who = isMine
    ? null
    : (players.find(p => p.seat === sacredMilestone.player)?.username ?? 'Your rival')

  return (
    <div
      data-testid="milestone-overlay"
      data-milestone-owner={isMine ? 'me' : 'opponent'}
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        // AN OPPONENT'S MILESTONE DOES NOT TAKE THE SCREEN. It sits at the top, over 15% of the
        // board instead of a full-bleed dim, so it reads as news rather than as the player's moment.
        justifyContent: isMine ? 'center' : 'flex-start',
        background: isMine ? 'rgba(10,10,46,0.85)' : 'rgba(10,10,46,0.55)',
        ...(isMine ? null : { inset: 'auto 0 auto 0', top: 0, paddingTop: 14 }),
        animation: 'milestoneIn 2.5s ease forwards',
        pointerEvents: 'none', textAlign: 'center', padding: 24,
      }}
    >
      {!isMine && (
        <div data-testid="milestone-owner" style={{
          fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)', marginBottom: 6,
        }}>
          {who} reached {milestone}
        </div>
      )}
      {isMine && (
        <>
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
        </>
      )}
    </div>
  )
}
