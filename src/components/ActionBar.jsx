import { useState } from 'react'

// NeoTopia · fixed bottom action bar for the game screen.
// T1 owns this file. Mobile-first · 44px touch targets · tabular-nums on all counts.
// Left: whose turn it is · Center: 3 action dots (filled = used) · Right: bonus tokens + End Turn.

// Bonus token presentation · type → short label + effect hint + accent (element palette).
// The KEYS are the engine's contract (gameStore.js useBonus · T2's lane) and never change. Only the
// label/hint are player-facing: 'Automatization' was a translation artefact from the original board
// game, and 'Automation' is the ordinary English word for the same thing.
const BONUS_META = {
  automatization: { label: 'Auto',       hint: 'Automation · +1 action this turn',            color: '#E24B4A' },
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
  turnTimeRemaining = null, // seconds left this turn · null hides the timer (legacy callers / tests)
  turnTimeLimit = 90,     // full turn budget · drives the progress-bar width
  onEndTurn = () => {},
}) {
  const used = Math.max(0, TOTAL_ACTIONS - actionsRemaining)
  const canEndTurn = actionsRemaining === 0 && isMyTurn

  // Turn-status label · multiplayer shows whose turn, solo just shows the player.
  const status = mySeat === null
    ? playerName
    : isMyTurn ? 'Your turn' : `Waiting for ${playerName}`

  // ── THIS BAR IS OVER-SUBSCRIBED, AND EVERY FIX HERE IS ABOUT WHO PAYS FOR THAT ──────────────────
  // Its three groups want ~448px inside a 292px content box at 320. That is not "full", it is 156px
  // short, and flex has always closed the gap by shrinking whatever can shrink.
  //
  // S37 · End Turn was the casualty once bonus tokens existed: four labelled pills put its right
  //       edge 267px off the side of a phone. A player who cannot reach End Turn cannot play, and
  //       auto-end-turn only rescues them once they have no actions left. Fixed by wrapping.
  // S38 · but wrapping is paid for in HEIGHT: 64 -> 119 -> 183px as tokens arrive, so the full set
  //       cost 119px of a 335px board on the smallest screen the game supports.
  //       AND the deeper one, found by measuring instead of asking whether it fit: at 320 AND at
  //       375, holding NO tokens, the status span rendered at 0.0px. "Waiting for Alice" · the
  //       turn-ownership signal in a real room · has been absorbing the entire deficit and
  //       disappearing, in shipped code, while I reported three sessions running that the bar fits.
  //
  // So: give the row its space back (index.css drops the "Actions" word and the timer's progress bar
  // below 480px · ~133px, both decoration whose information survives elsewhere), and stop spending
  // 266px on four pills. ONE CHIP says how many and which, by colour, in ~63px, and the detail moves
  // into a panel that opens ON TAP · where it can say what each token actually does, instead of
  // hiding it in a `title` attribute no touch device has ever shown anyone.
  const [tokensOpen, setTokensOpen] = useState(false)

  return (
    <footer className="action-bar" style={{
      flexShrink: 0, minHeight: 64, position: 'relative',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.015)',
      display: 'flex', alignItems: 'center',
      // Wrap is UNCONDITIONAL again, and that is the point. S37 had to gate it on holding a token,
      // because turning it on for everyone replaced flex's shrink with a wrap and cost 25px of board
      // on every phone. With the chip and the 133px returned to the row it never triggers at any
      // supported width, so the safety net can be on permanently without ever being paid for · it is
      // now what would happen INSTEAD of losing End Turn, rather than what happens.
      // columnGap/rowGap rather than `gap` + `rowGap`: React warns that mixing a shorthand with a
      // longhand for the same value during a rerender can silently drop one of them.
      columnGap: 16, rowGap: 8,
      flexWrap: 'wrap',
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

        {/* Turn timer · live per-second readout + shrinking bar (driven by GameRoom's local countdown).
            Warm amber, turning red under 10s. tabular-nums (rule 5). null hides it for solo/legacy/tests. */}
        {turnTimeRemaining != null && (
          <div
            data-testid="turn-timer"
            role="progressbar"
            aria-label="Turn time remaining"
            aria-valuemin={0}
            aria-valuemax={turnTimeLimit}
            aria-valuenow={Math.ceil(turnTimeRemaining)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 2 }}
          >
            <span style={{
              color: turnTimeRemaining <= 10 ? '#E24B4A' : '#E2A23B',
              fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              minWidth: 26, textAlign: 'right',
            }}>
              {Math.ceil(turnTimeRemaining)}s
            </span>
            {/* The bar, not the number · hidden below 480px, where its 52px was being paid for out
                of the player's name. The seconds beside it carry the same reading. */}
            <div className="ab-timer-bar" style={{ width: 52, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, (turnTimeRemaining / turnTimeLimit) * 100))}%`,
                background: turnTimeRemaining <= 10 ? '#E24B4A' : '#E2A23B',
                transition: 'width 1s linear',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* CENTER · action dots (filled = used) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto' }}>
        {/* Hidden below 480px · the three dots and the number beside them say "actions" without
            spending 67px of a 292px row on the word. */}
        <span className="ab-actions-label" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
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

      {/* RIGHT · bonus tokens + End Turn
          NOT the home for a rules button, and that was measured rather than reasoned (T1 S36). At a
          320px viewport with no bonus tokens · the state every player is in today · this bar is
          exactly 320 of 320 wide, with End Turn's right edge at 300. It has no room at all. Adding a
          44px control here put End Turn's right edge at 337, i.e. 17px OFF THE SCREEN, which is the
          same defect as the practice exit fixed in this very session: a control present in the DOM
          that a player cannot reach. The route back to the rules lives in the header instead. */}
      {/* The right group wraps INTERNALLY too, and that is not belt-and-braces. Four tokens plus End
          Turn is about 380 units on its own, so wrapping this group as a single unit onto a second
          row would still overflow a 320px phone · the fix has to go all the way down to the strip. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {bonusTokens.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <button
              data-testid="bonus-chip"
              data-bonus-count={bonusTokens.length}
              aria-expanded={tokensOpen}
              aria-label={`${bonusTokens.length} bonus ${bonusTokens.length === 1 ? 'token' : 'tokens'} · show what they do`}
              onClick={() => setTokensOpen(o => !o)}
              style={{
                height: 44, minHeight: 44, padding: '0 10px', borderRadius: 10, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                border: `1px solid ${tokensOpen ? 'rgba(200,148,64,0.55)' : 'rgba(200,148,64,0.3)'}`,
                background: tokensOpen ? 'rgba(200,148,64,0.12)' : 'rgba(200,148,64,0.06)',
                color: 'rgba(200,148,64,0.95)', fontSize: 13, fontWeight: 600,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}
            >
              {/* One dot per token, in its own colour · WHICH tokens you hold, at a glance, in the
                  width a single label used to take. Capped at four because four is the whole set. */}
              <span style={{ display: 'inline-flex', gap: 3 }}>
                {bonusTokens.slice(0, 4).map((type, i) => (
                  <span key={`${type}-${i}`} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: (BONUS_META[type] ?? { color: '#888' }).color,
                  }} />
                ))}
              </span>
              {bonusTokens.length}
            </button>

            {tokensOpen && (
              <div
                data-testid="bonus-detail"
                role="group"
                aria-label="Bonus tokens"
                style={{
                  // ANCHORED TO THE BAR, NOT TO THE CHIP, and that is a measured correction. Pinned
                  // to the chip with right:0 it was fine while the chip sat on the right · but once
                  // the row wraps at 320 the chip starts at the LEFT of its own row, and the panel
                  // ran from x=-159 to x=90: two thirds of it off the side of the phone. The footer
                  // is always exactly as wide as the viewport, so anchoring here cannot escape it.
                  position: 'absolute', bottom: 'calc(100% + 8px)', right: 12, zIndex: 40,
                  width: 'max-content', maxWidth: 'calc(100vw - 24px)',
                  padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(13,13,24,0.98)', border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
              >
                {bonusTokens.map((type, i) => {
                  const meta = BONUS_META[type] ?? { label: type, hint: type, color: '#888' }
                  return (
                    <div key={`${type}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                      <span style={{ color: meta.color, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, flexShrink: 0 }}>
                        {meta.label}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 1.45 }}>
                        {meta.hint}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        <button
          className="ab-end-turn"
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
