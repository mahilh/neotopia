// NeoTopia · fixed bottom action bar for the game screen.
// T1 owns this file. Mobile-first · 44px touch targets · tabular-nums on all counts.
// Left: whose turn it is · Center: 3 action dots (filled = used) · Right: bonus tokens + End Turn.

// Bonus token presentation · type → short label + effect hint + accent (element palette).
const BONUS_META = {
  automatization: { label: 'Auto',       hint: 'Automatization · +1 action this turn',        color: '#E24B4A' },
  subsidy:        { label: 'Subsidy',    hint: 'Subsidy · draw 2 cards (Offer first)',        color: '#1D9E75' },
  initiative:     { label: 'Initiative', hint: 'Initiative · place an element from reserve',  color: '#7F77DD' },
  permits:        { label: 'Permits',    hint: 'Permits · place in the outer ring',           color: '#378ADD' },
}

const TOTAL_ACTIONS = 3

export default function ActionBar({
  playerName = 'Builder',
  mySeat = null,          // null = solo (no turn ownership concept)
  isMyTurn = true,        // solo is always your turn
  actionsRemaining = 3,
  bonusTokens = [],       // [type, ...] held by the current player
  onEndTurn = () => {},
}) {
  const used = Math.max(0, TOTAL_ACTIONS - actionsRemaining)
  const canEndTurn = actionsRemaining === 0 && isMyTurn

  // Turn-status label · multiplayer shows whose turn, solo just shows the player.
  const status = mySeat === null
    ? playerName
    : isMyTurn ? 'Your turn' : `Waiting for ${playerName}`

  return (
    <footer style={{
      flexShrink: 0, minHeight: 64,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.015)',
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 20px',
    }}>
      {/* Turn-dot pulse when it IS your turn · the clearest human "act now" signal (reduced-motion safe). */}
      <style>{`
        .turn-dot-active { animation: turn-pulse 1.5s ease-in-out infinite; }
        @keyframes turn-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(30,200,100,0.5); } 50% { box-shadow: 0 0 0 6px rgba(30,200,100,0); } }
        @media (prefers-reduced-motion: reduce) { .turn-dot-active { animation: none; } }
      `}</style>
      {/* LEFT · turn status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          className={isMyTurn ? 'turn-dot-active' : undefined}
          style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: isMyTurn ? '#1DC864' : 'rgba(255,255,255,0.25)',
            boxShadow: isMyTurn ? '0 0 8px rgba(30,200,100,0.6)' : 'none',
          }}
        />
        <span
          className={isMyTurn ? 'my-turn-badge' : undefined}
          data-testid="my-turn-badge"
          style={{
            color: isMyTurn ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)',
            fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {status}
        </span>
      </div>

      {/* CENTER · action dots (filled = used) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
          Actions
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: TOTAL_ACTIONS }, (_, i) => {
            const isUsed = i < used
            return (
              <span key={i} style={{
                width: 14, height: 14, borderRadius: '50%',
                background: isUsed ? 'rgba(255,255,255,0.85)' : 'transparent',
                border: isUsed ? '1px solid rgba(255,255,255,0.85)' : '1px solid rgba(255,255,255,0.3)',
                transition: 'background 0.2s, border-color 0.2s',
              }} />
            )
          })}
        </div>
        <span style={{
          color: actionsRemaining > 0 ? 'rgba(255,255,255,0.55)' : '#E24B4A',
          fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 16, textAlign: 'center',
        }}>
          {actionsRemaining}
        </span>
      </div>

      {/* RIGHT · bonus tokens + End Turn */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {bonusTokens.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {bonusTokens.map((type, i) => {
              const meta = BONUS_META[type] ?? { label: type, hint: type, color: '#888' }
              return (
                <span key={`${type}-${i}`} title={meta.hint} style={{
                  height: 24, padding: '0 8px', borderRadius: 12,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: `${meta.color}1A`, border: `1px solid ${meta.color}55`,
                  color: meta.color, fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
                  {meta.label}
                </span>
              )
            })}
          </div>
        )}
        <button
          data-testid="end-turn-btn"
          onClick={onEndTurn}
          disabled={!canEndTurn}
          style={{
            height: 44, padding: '0 22px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: canEndTurn ? 'pointer' : 'default',
            border: '1px solid rgba(255,255,255,0.2)',
            background: canEndTurn ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: canEndTurn ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          End Turn
        </button>
      </div>
    </footer>
  )
}
