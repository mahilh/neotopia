// The NeoTopia civilization card · two exports:
//   ProjectCard (default) · compact card for the Hand / The Offer sidebar lists
//   ScoreFlash  (named)    · the 2.2s full-screen "story moment" shown after a card is scored
// T1 owns this file.
import { useEffect, useState } from 'react'

const ELEMENT_COLORS = { energy: '#E24B4A', biofarming: '#1D9E75', technology: '#7F77DD', community: '#378ADD' }

// card.district is the NUMERIC id of one of the 9 NeoTopia districts (CLAUDE.md taxonomy),
// NOT a region name. Map it to a readable name for display.
const DISTRICT_NAMES = {
  1: 'Source', 2: 'Healing', 3: 'Education', 4: 'Energy', 5: 'Food',
  6: 'Architecture', 7: 'Tech', 8: 'Culture', 9: 'Diplomacy',
}
// The flash is accented by the REGION the card was built in (where the district now lives).
const REGION_COLORS = { 'Sacred City': '#7F77DD', 'Living Earth': '#1D9E75', 'Free Energy': '#E24B4A' }

// The irreplaceable reward · a 1-of-its-kind district was just built. Shows the card's
// story (its description), then auto-unmounts. This is the near-miss payoff made tangible.
export function ScoreFlash({ card, regionName, onDone }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone?.() }, 2200)
    return () => clearTimeout(t)
  }, [onDone])

  if (!card || !visible) return null

  const accent = REGION_COLORS[regionName] ?? '#7F77DD'
  const districtName = DISTRICT_NAMES[card.district] ?? regionName

  return (
    <div className="score-flash" style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,10,15,0.72)',
      animation: 'hexScoreFlash 2.2s ease forwards',
      pointerEvents: 'none',
    }}>
      <div style={{
        maxWidth: 360, padding: '36px 32px', borderRadius: 20, textAlign: 'center',
        background: 'rgba(10,10,15,0.95)',
        border: `1px solid ${accent}60`,
        boxShadow: `0 0 60px ${accent}30`,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: 3, color: accent, marginBottom: 12,
          textTransform: 'uppercase', fontWeight: 500,
        }}>
          {districtName} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>+{card.points}</span> pts
        </div>
        <div style={{
          fontSize: 22, fontWeight: 300, color: 'rgba(255,255,255,0.95)',
          marginBottom: 16, letterSpacing: 1,
        }}>
          {card.name}
        </div>
        {card.description && (
          <div style={{
            fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, fontStyle: 'italic',
          }}>
            {card.description}
          </div>
        )}
        <div style={{ marginTop: 20, fontSize: 11, color: accent, letterSpacing: 2, opacity: 0.7 }}>
          built · 2055
        </div>
      </div>
    </div>
  )
}

// Compact card for the Hand / The Offer lists. `isScoreable` glows it green + pulses ·
// `disabled` dims it and suppresses the click (used by The Offer at 0 actions remaining).
export default function ProjectCard({ card, isScoreable = false, disabled = false, onClick, testid }) {
  if (!card) return null

  const districtName = DISTRICT_NAMES[card.district] ?? `District ${card.district}`
  const clickable = !disabled && typeof onClick === 'function'

  return (
    <div
      className="project-card"
      data-testid={testid}
      onClick={clickable ? onClick : undefined}
      style={{
        padding: '10px 12px', borderRadius: 10, minHeight: 44,
        cursor: clickable ? 'pointer' : 'default',
        border: isScoreable ? '1px solid rgba(30,200,100,0.5)' : '1px solid rgba(255,255,255,0.08)',
        background: isScoreable ? 'rgba(30,200,100,0.08)' : 'rgba(255,255,255,0.025)',
        opacity: disabled ? 0.5 : 1,
        animation: isScoreable ? 'hexPulse 1.4s ease-in-out infinite' : 'none',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {/* Pattern preview dots · the card's element shape */}
        <div style={{ display: 'flex', gap: 3 }}>
          {(card.pattern ?? []).slice(0, 5).map((cell, i) => (
            <span key={i} style={{
              width: 8, height: 8, borderRadius: '50%', background: ELEMENT_COLORS[cell.type] ?? '#888',
            }} />
          ))}
        </div>
        <span style={{
          marginLeft: 'auto',
          color: isScoreable ? '#1DC864' : 'rgba(255,255,255,0.7)',
          fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums',
        }}>
          {card.points}pt
        </span>
      </div>
      <div style={{
        color: isScoreable ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.78)',
        fontSize: 12, fontWeight: 500,
      }}>
        {card.name}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 }}>
        {districtName} · {card.illustration}
      </div>
    </div>
  )
}
