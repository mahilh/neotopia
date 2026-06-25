import React, { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { ELEMENT_COLORS } from '../utils/hexUtils'
import { useGameActions } from '../hooks/useGameActions'
import GameBoard from '../components/Board/GameBoard'
import { DECK } from '../lib/projectCards'
import { PRODUCTION_TILES, shuffleArray } from '../store/gameStore'

export default function GameRoom() {
  const [initialized, setInitialized] = useState(false)

  // Subscribe to individual slices · avoids a full re-render on every state change.
  const actionsLeft   = useGameStore(s => s.actionsRemaining)
  const currentSeat   = useGameStore(s => s.currentSeat)
  const turnNumber    = useGameStore(s => s.turnNumber)
  const theOffer      = useGameStore(s => s.theOffer)
  const factories     = useGameStore(s => s.factories)
  const regions       = useGameStore(s => s.regions)
  const players       = useGameStore(s => s.players)
  const currentPlayer = players.find(p => p.seat === currentSeat)

  // DEV: auto-init a solo game (lobby is owned by T3 in S2).
  // Dependency: [initialized] ONLY · adding the store object causes an infinite re-render.
  useEffect(() => {
    if (!initialized && useGameStore.getState().phase === 'lobby') {
      useGameStore.getState().initGame(
        [{ userId: 'dev-1', username: 'Builder' }],
        shuffleArray([...DECK]),
        shuffleArray([...PRODUCTION_TILES]),
      )
      setInitialized(true)
    }
  }, [initialized])

  const {
    selectedFactory, selectedElement, selectedRegion,
    validTargets, patternHighlight, buildableMatches, uiPhase,
    handleFactoryClick, handleElementSelect, handleRegionSelect,
    handleHexClick, handleCardScore, handleEndTurn,
  } = useGameActions()

  const factory = factories.find(f => f.id === selectedFactory)

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#0a0a0f', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <header style={{
        height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500, letterSpacing: 3, fontSize: 13 }}>
          NEOTOPIA
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          Turn {turnNumber}
        </span>
        {uiPhase === 'scorePending' && (
          <span style={{
            marginLeft: 8, padding: '4px 12px', borderRadius: 20,
            background: 'rgba(30,200,100,0.15)', border: '1px solid rgba(30,200,100,0.3)',
            color: '#1DC864', fontSize: 11, fontWeight: 500,
          }}>
            Pattern complete · select card to score
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Actions</span>
          <span style={{
            color: actionsLeft > 0 ? 'white' : '#E24B4A',
            fontWeight: 700, fontSize: 24,
            fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'center',
          }}>
            {actionsLeft}
          </span>
          <button
            onClick={handleEndTurn}
            disabled={actionsLeft !== 0}
            style={{
              height: 44, padding: '0 20px', borderRadius: 8, fontSize: 12,
              cursor: actionsLeft === 0 ? 'pointer' : 'default',
              border: '1px solid rgba(255,255,255,0.2)',
              background: actionsLeft === 0 ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: actionsLeft === 0 ? 'white' : 'rgba(255,255,255,0.3)',
            }}
          >
            End Turn
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* BOARD */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 0, minWidth: 0 }}>
          <GameBoard
            regions={regions}
            factories={factories}
            validTargets={validTargets}
            patternHighlight={patternHighlight}
            selectedFactory={selectedFactory}
            onHexClick={handleHexClick}
            onFactoryClick={handleFactoryClick}
          />
        </div>

        {/* SIDEBAR */}
        <aside style={{
          width: 288, borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', padding: 16, gap: 14, overflowY: 'auto', flexShrink: 0,
        }}>

          {/* STEP 2: element type buttons (factory selected) */}
          {uiPhase === 'factorySelected' && factory && (
            <div>
              <div style={sectionLabel}>Select element</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {factory.elements.filter(el => el.count > 0).map(el => (
                  <button key={el.type}
                    onClick={() => handleElementSelect(el.type)}
                    style={{
                      height: 44, padding: '0 14px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: selectedElement === el.type ? 'rgba(255,255,255,0.1)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: ELEMENT_COLORS[el.type], flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textTransform: 'capitalize' }}>
                      {el.type}
                    </span>
                    <span style={{
                      marginLeft: 'auto', color: 'rgba(255,255,255,0.5)',
                      fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                    }}>
                      ×{el.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: region buttons (element selected) */}
          {(uiPhase === 'elementSelected' || uiPhase === 'regionSelected') && factory && (
            <div>
              <div style={sectionLabel}>Place into region</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {factory.betweenRegions.map(rid => {
                  const regionNames = ['Sacred City', 'Living Earth', 'Free Energy']
                  const regionColors = ['#7F77DD', '#1D9E75', '#E24B4A']
                  return (
                    <button key={rid}
                      onClick={() => handleRegionSelect(rid)}
                      style={{
                        height: 44, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                        border: selectedRegion === rid
                          ? `1px solid ${regionColors[rid]}`
                          : '1px solid rgba(255,255,255,0.12)',
                        background: selectedRegion === rid ? `${regionColors[rid]}22` : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: regionColors[rid] }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{regionNames[rid]}</span>
                    </button>
                  )
                })}
              </div>
              {uiPhase === 'regionSelected' && (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 8 }}>
                  Click a highlighted hex on the board
                </p>
              )}
            </div>
          )}

          {/* THE OFFER */}
          <div>
            <div style={sectionLabel}>The Offer</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {theOffer.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '8px 0' }}>Deck empty</div>
              )}
              {theOffer.map((card, i) => (
                <button key={card.id}
                  onClick={() => actionsLeft > 0 && useGameStore.getState().drawCard(currentSeat, 'offer', i)}
                  disabled={actionsLeft === 0}
                  style={{
                    padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                    cursor: actionsLeft > 0 ? 'pointer' : 'default',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.025)',
                    opacity: actionsLeft === 0 ? 0.5 : 1,
                  }}
                >
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>{card.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    {card.points}pt · District {card.district}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* HAND */}
          <div>
            <div style={sectionLabel}>Hand · {currentPlayer?.hand?.length ?? 0}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {currentPlayer?.hand?.map(card => {
                const isScoreable = uiPhase === 'scorePending' && buildableMatches.some(m => m.cardId === card.id)
                return (
                  <div key={card.id}
                    onClick={() => isScoreable && handleCardScore(card.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 8,
                      border: isScoreable ? '1px solid rgba(30,200,100,0.5)' : '1px solid rgba(255,255,255,0.07)',
                      background: isScoreable ? 'rgba(30,200,100,0.08)' : 'rgba(255,255,255,0.02)',
                      cursor: isScoreable ? 'pointer' : 'default',
                      animation: isScoreable ? 'hexPulse 1.4s ease-in-out infinite' : 'none',
                    }}
                  >
                    <div style={{ color: isScoreable ? '#1DC864' : 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 500 }}>
                      {card.name}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                      {card.points}pt · {card.description?.slice(0, 48)}…
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* SCORE */}
          {currentPlayer && (
            <div>
              <div style={sectionLabel}>Score</div>
              {['Sacred City', 'Living Earth', 'Free Energy'].map((name, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{name}</span>
                  <span style={{
                    color: 'white', fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums', fontSize: 16,
                  }}>
                    {currentPlayer.scores[i] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

const sectionLabel = {
  color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: 2.5,
  textTransform: 'uppercase', marginBottom: 8, fontWeight: 500,
}
