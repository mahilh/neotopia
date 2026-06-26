import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { ELEMENT_COLORS } from '../utils/hexUtils'
import { useAuth } from '../hooks/useAuth'
import { useGameSync } from '../hooks/useGameSync'
import { useGameActions } from '../hooks/useGameActions'
import { usePatternHighlight } from '../hooks/usePatternHighlight'
import GameBoard from '../components/Board/GameBoard'
import ActionBar from '../components/ActionBar'
import FinalScore from '../components/FinalScore'
import Tutorial, { tutorialSeen } from '../components/Tutorial'
import { ScoreFlash } from '../components/ProjectCard'
import CardFrame from '../components/CardFrame'
import { DECK } from '../lib/projectCards'
import { PRODUCTION_TILES, shuffleArray } from '../store/gameStore'
import { TURN_TIME_LIMIT } from '../store/gameConfig'

const REGION_NAMES = ['Sacred City', 'Living Earth', 'Free Energy']

// A card's primary element = the most common element type across its pattern · drives the CardFrame
// theme colour. Cards store element types per pattern cell, not a single top-level element.
function cardPrimaryElement(card) {
  const counts = {}
  for (const cell of card?.pattern ?? []) counts[cell.type] = (counts[cell.type] ?? 0) + 1
  let best = 'community', max = 0
  for (const [type, n] of Object.entries(counts)) if (n > max) { max = n; best = type }
  return best
}

export default function GameRoom() {
  // Route-param multiplayer: /game/:roomId → real game · /game (no param) → solo dev.
  // roomId from the URL survives a refresh (free rejoin · T3) · it is the clean signal for
  // "this is a real session" · NOT useGameStore.getState().roomId (T3 never populates that).
  const { roomId } = useParams()
  const { user } = useAuth()

  // useGameSync subscribes to game_sessions + seeds the store when roomId is set (no-op when null).
  // Lives here so moves persist (pushState) and remote moves stream in for the whole /game lifetime.
  const sync = useGameSync(roomId ?? null, user?.id)

  const [initialized, setInitialized] = useState(false)
  const [scoreFlash, setScoreFlash] = useState(null) // { card, regionName } · the score story moment
  // First-turn onboarding (T1 S8). Shown once ever per browser (localStorage) · the first playtest
  // never discovered "place an element". We gate on isMyTurn + phase below, NOT on turnNumber: turns
  // may count per-player-turn, so a turnNumber<=1 gate would skip the 2nd player's first turn entirely.
  const [showTutorial, setShowTutorial] = useState(() => !tutorialSeen())

  // Subscribe to individual slices · avoids a full re-render on every state change.
  const phase         = useGameStore(s => s.phase)
  const actionsLeft   = useGameStore(s => s.actionsRemaining)
  const currentSeat   = useGameStore(s => s.currentSeat)
  const turnNumber    = useGameStore(s => s.turnNumber)
  const turnTimeRemaining = useGameStore(s => s.turnTimeRemaining)
  const theOffer      = useGameStore(s => s.theOffer)
  const factories     = useGameStore(s => s.factories)
  const regions       = useGameStore(s => s.regions)
  const players       = useGameStore(s => s.players)
  const currentPlayer = players.find(p => p.seat === currentSeat)

  // This client's seat · derived from the synced roster by matching our auth id (no need to thread
  // seat through navigation · it also restores correctly on rejoin-after-refresh). null in solo.
  const mySeat = useMemo(
    () => players.find(p => p.userId && p.userId === user?.id)?.seat ?? null,
    [players, user?.id],
  )

  // Local per-second turn countdown · DISPLAY ONLY. The store holds no clock (rule 32 · the reducer only
  // RESETS turnTimeRemaining to TURN_TIME_LIMIT each turn), so we tick a local copy down for a live
  // readout and re-anchor it whenever the turn changes (currentSeat/turnNumber) or the synced value
  // updates. Never writes the store · forward-compatible if T2 later drives the decrement via sync (T1 S12).
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(turnTimeRemaining)
  useEffect(() => {
    setTurnSecondsLeft(turnTimeRemaining)
    if (phase !== 'playing') return
    const id = setInterval(() => setTurnSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [turnTimeRemaining, currentSeat, turnNumber, phase])

  // DEV solo-init: ONLY when there is no route roomId (a real game is seeded by useGameSync).
  // Gated on the route roomId per T3 · never inits a solo game over a real session.
  useEffect(() => {
    if (roomId) return
    if (!initialized && useGameStore.getState().phase === 'lobby') {
      useGameStore.getState().initGame(
        [{ userId: 'dev-1', username: 'Builder' }],
        shuffleArray([...DECK]),
        shuffleArray([...PRODUCTION_TILES]),
      )
      setInitialized(true)
    }
  }, [initialized, roomId])

  // DEV-only · force the end-game civilization record without playing all 56 cards.
  // Cmd+Shift+E sets the real terminal phase ('scoring') · stripped from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onKey = (e) => {
      if (e.metaKey && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault()
        useGameStore.getState().setPhase('scoring')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const {
    selectedFactory, selectedElement, selectedRegion,
    validTargets, patternHighlight, buildableMatches, uiPhase, isMyTurn,
    handleFactoryClick, handleElementSelect, handleRegionSelect,
    handleHexClick, handleCardScore, handleDrawCard, handleEndTurn,
  } = useGameActions({ sync, mySeat })

  const factory = factories.find(f => f.id === selectedFactory)

  // Near-miss psychology · usePatternHighlight (T2) computes per region · merge all 3.
  // Only nudge "place here" while the player can still act (no actions = no placement).
  const ph0 = usePatternHighlight(0)
  const ph1 = usePatternHighlight(1)
  const ph2 = usePatternHighlight(2)
  const keyToQR = (k) => { const [q, r] = k.split(',').map(Number); return { q, r } }
  const partialHighlight = useMemo(
    () => (actionsLeft > 0 ? [ph0, ph1, ph2].flatMap(ph => [...ph.partialKeys].map(keyToQR)) : []),
    [ph0, ph1, ph2, actionsLeft],
  )
  const completionCandidates = useMemo(
    () => (actionsLeft > 0 ? [ph0, ph1, ph2].flatMap(ph => ph.completionCandidates.map(c => keyToQR(c.missingKey))) : []),
    [ph0, ph1, ph2, actionsLeft],
  )

  // Persistent "what to do next" line (colonist.io pattern). The first playtest reached turn 17 with an
  // empty board because nothing ever told the players what their options were · this never lets that happen.
  const instruction = (() => {
    if (!isMyTurn) return `Waiting for ${currentPlayer?.username ?? 'the other player'}`
    if (actionsLeft <= 0) return 'No actions left · end your turn'
    switch (uiPhase) {
      case 'factorySelected': return 'Pick an element from the factory'
      case 'elementSelected':  return 'Choose a region to place into'
      case 'regionSelected':   return 'Click a highlighted hex to place the element'
      case 'scorePending':     return 'Pattern complete · select a glowing card to score'
      default:                 return 'Click a factory to take an element · or draw a card from the Offer'
    }
  })()
  // Pulse the factories to invite the first action · only on your turn, with actions left, before a pick.
  const factoriesPulse = isMyTurn && actionsLeft > 0 && selectedFactory === null

  // Multiplayer loading gate (AFTER all hooks · Rules of Hooks): in a real room, wait for
  // useGameSync to seed the store before rendering the board. Solo (no roomId) skips this.
  // 'scoring' is the end-game phase · let it through so the FinalScore overlay can render.
  if (roomId && phase !== 'playing' && phase !== 'scoring') {
    return (
      <div style={{ height: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, letterSpacing: 1 }}>Connecting to the board…</p>
      </div>
    )
  }

  return (
    <div
      // Persistent, turn-sensitive attributes the bot/E2E can waitForSelector on (no isVisible timeout
      // race against the DB-sync render · T1 S11). data-my-turn flips as soon as currentSeat syncs.
      data-game-phase={phase}
      data-my-turn={isMyTurn ? 'true' : 'false'}
      style={{ height: '100vh', overflow: 'hidden', background: '#0a0a0f', display: 'flex', flexDirection: 'column' }}
    >

      {/* FINAL SCORE · the civilization record · overlays everything once the game ends (phase 'scoring') */}
      {/* mySeat lets FinalScore record THIS client's own districts to the real Global Index (no cross-client over-count). */}
      {phase === 'scoring' && <FinalScore players={players} mySeat={mySeat} sync={sync} roomId={roomId} />}

      {/* FIRST-GAME TUTORIAL · once ever per browser · shows for BOTH players the moment the game starts
          (NOT gated on isMyTurn · S8's isMyTurn gate meant the joining player never saw it until their
          first turn · the waiting player should learn the rules while the host moves · T1 S10). */}
      {showTutorial && phase === 'playing' && (
        <Tutorial onDismiss={() => setShowTutorial(false)} />
      )}

      {/* SCORE FLASH · the civilization "story moment" after a card is scored */}
      {scoreFlash && (
        <ScoreFlash
          card={scoreFlash.card}
          regionName={scoreFlash.regionName}
          onDone={() => setScoreFlash(null)}
        />
      )}

      {/* HEADER */}
      <header style={{
        position: 'relative',
        height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500, letterSpacing: 3, fontSize: 13 }}>
          NEOTOPIA
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          Turn {turnNumber}
        </span>
        {/* Persistent instruction · centered · always tells the player what to do next (colonist.io). */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontSize: 13, letterSpacing: 0.3, textAlign: 'center', pointerEvents: 'none',
          maxWidth: '58%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: uiPhase === 'scorePending' ? '#1DC864' : 'rgba(255,255,255,0.5)',
          fontWeight: uiPhase === 'scorePending' ? 600 : 400,
        }}>
          {instruction}
        </div>
        {/* Actions counter, turn status, and End Turn now live in the bottom ActionBar. */}
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
            partialHighlight={partialHighlight}
            completionCandidates={completionCandidates}
            selectedFactory={selectedFactory}
            factoriesPulse={factoriesPulse}
            regionScores={currentPlayer?.scores ?? []}
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
            <div data-offer style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {theOffer.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '8px 0' }}>Deck empty</div>
              )}
              {theOffer.map((card, i) => {
                const disabled = actionsLeft === 0 || !isMyTurn
                return (
                  <CardFrame key={card.id} size="hand" testid="card-offer"
                    card={{ ...card, element: cardPrimaryElement(card) }}
                    onClick={disabled ? undefined : () => handleDrawCard('offer', i)}
                  />
                )
              })}
            </div>
          </div>

          {/* HAND */}
          <div>
            <div style={sectionLabel}>Hand · {currentPlayer?.hand?.length ?? 0}</div>
            <div data-hand style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {currentPlayer?.hand?.map(card => {
                const isScoreable = uiPhase === 'scorePending' && buildableMatches.some(m => m.cardId === card.id)
                return (
                  <CardFrame key={card.id} size="hand" testid="card-hand" isSelected={isScoreable}
                    card={{ ...card, element: cardPrimaryElement(card) }}
                    onClick={isScoreable ? () => {
                      const scored = handleCardScore(card.id)
                      if (scored?.card) setScoreFlash({ card: scored.card, regionName: REGION_NAMES[scored.regionId] })
                    } : undefined}
                  />
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

      {/* ACTION BAR · turn status · action dots · bonus tokens · End Turn */}
      <ActionBar
        playerName={currentPlayer?.username ?? 'Builder'}
        mySeat={mySeat}
        isMyTurn={isMyTurn}
        actionsRemaining={actionsLeft}
        bonusTokens={currentPlayer?.bonusTokens ?? []}
        turnTimeRemaining={turnSecondsLeft}
        turnTimeLimit={TURN_TIME_LIMIT}
        onEndTurn={handleEndTurn}
      />
    </div>
  )
}

const sectionLabel = {
  // 12px floor on the sidebar wayfinding labels (Select element · Place into region · Offer · Hand ·
  // Score). game-ux.e2e's font check is soft/informational, but these are functional labels with room
  // to grow · the smallest standalone text gets the bump (CardFrame card-face stays per T3 · T1 S12).
  color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: 2.5,
  textTransform: 'uppercase', marginBottom: 8, fontWeight: 500,
}
