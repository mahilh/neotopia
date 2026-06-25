// NeoTopia · lobby page (username claim → create/join → waiting room → start).
// T3 owns this file. Mobile-first · every interactive target is >= 44px.
// Auth: useAuth (T2). Room: useGameRoom (T3). No window.confirm anywhere.

import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGameRoom } from '../hooks/useGameRoom'

const SEAT_COLORS = ['#378ADD', '#E24B4A', '#1D9E75', '#7F77DD'] // blue · red · green · purple (by seat)

export default function Lobby({ onGameStart }) {
  const { user, username, isLoading: authLoading, isClaimed, claimUsername } = useAuth()
  const {
    roomCode, isHost, isReady, lobbyPlayers, lobbyError, roomPhase,
    createRoom, joinRoom, setReady, startGame, leaveRoom,
  } = useGameRoom(user, username)

  const [nameInput, setNameInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [claimError, setClaimError] = useState(null)
  const [view, setView] = useState('home') // home | join

  // Game start is a side effect · never call onGameStart during render (it would update a parent
  // mid-render). Fire it from an effect once the room transitions to playing.
  useEffect(() => {
    if (roomPhase === 'playing') onGameStart?.()
  }, [roomPhase, onGameStart])

  async function handleClaim() {
    setClaimError(null)
    const { error } = await claimUsername(nameInput.trim())
    if (error) setClaimError(error)
  }

  // ── Auth loading ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={centeredScreen}>
        <div style={spinner} />
        <p style={muted}>Connecting…</p>
      </div>
    )
  }

  // ── Username claim ──────────────────────────────────────────────
  if (!isClaimed || !username) {
    return (
      <div style={centeredScreen}>
        <h1 style={title}>NEOTOPIA</h1>
        <p style={muted}>A consciousness civilization · 2055</p>
        <div style={card}>
          <p style={label}>Choose your name</p>
          <input
            style={input}
            placeholder="Builder name (max 20)"
            value={nameInput}
            maxLength={20}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nameInput.trim().length >= 2 && handleClaim()}
            autoFocus
          />
          {claimError && <p style={errorText}>{claimError}</p>}
          <button style={primaryBtn} disabled={nameInput.trim().length < 2} onClick={handleClaim}>
            Enter NeoTopia
          </button>
        </div>
      </div>
    )
  }

  // ── Waiting room ────────────────────────────────────────────────
  if (roomPhase === 'lobby') {
    const others = lobbyPlayers.filter(p => !p.isHost)
    const readyCount = others.filter(p => p.isReady).length
    const canStart = lobbyPlayers.length >= 2 && others.every(p => p.isReady)

    return (
      <div style={centeredScreen}>
        <button onClick={leaveRoom} style={backBtn}>← Leave</button>
        <h1 style={title}>NEOTOPIA</h1>

        <div style={codeBox}>
          <p style={label}>Room Code</p>
          <div style={codeDisplay}>{roomCode}</div>
          <p style={muted}>Share this with friends</p>
        </div>

        <div style={playerList}>
          {lobbyPlayers.map((p, i) => (
            <div key={p.userId ?? i} style={playerRow}>
              <div style={{ ...avatar, background: SEAT_COLORS[p.seat ?? i % 4] }}>
                {(p.username ?? '?').slice(0, 2).toUpperCase()}
              </div>
              <span style={playerName}>{p.username ?? 'Joining…'}</span>
              {p.isHost && <span style={hostBadge}>HOST</span>}
              <div style={{ marginLeft: 'auto' }}>
                {p.isHost
                  ? <span style={mutedSmall}>·</span>
                  : p.isReady
                    ? <span style={readyBadge}>Ready</span>
                    : <span style={waitingBadge}>Waiting</span>}
              </div>
            </div>
          ))}
          {lobbyPlayers.length < 4 && (
            <div style={{ ...playerRow, opacity: 0.3 }}>
              <div style={{ ...avatar, background: 'rgba(255,255,255,0.1)' }}>+</div>
              <span style={playerName}>Waiting for player…</span>
            </div>
          )}
        </div>

        {lobbyError && <p style={errorText}>{lobbyError}</p>}

        {isHost ? (
          <button
            style={{ ...primaryBtn, opacity: canStart ? 1 : 0.4, cursor: canStart ? 'pointer' : 'default' }}
            disabled={!canStart}
            onClick={startGame}
          >
            {canStart ? 'Start Game' : `Waiting for players (${readyCount}/${others.length} ready)`}
          </button>
        ) : (
          <button
            style={{ ...primaryBtn, background: isReady ? 'rgba(30,200,100,0.2)' : 'rgba(255,255,255,0.08)' }}
            onClick={() => setReady(!isReady)}
          >
            {isReady ? '✓ Ready' : 'Click when ready'}
          </button>
        )}
      </div>
    )
  }

  // ── Transitioning into the game ─────────────────────────────────
  if (roomPhase === 'playing') {
    return (
      <div style={centeredScreen}>
        <div style={spinner} />
        <p style={muted}>Entering the board…</p>
      </div>
    )
  }

  // ── Home (create / join) ────────────────────────────────────────
  return (
    <div style={centeredScreen}>
      <h1 style={title}>NEOTOPIA</h1>
      <p style={muted}>Welcome, {username}</p>

      {view === 'home' && (
        <div style={card}>
          <button style={primaryBtn} onClick={createRoom}>Create Room</button>
          <button style={secondaryBtn} onClick={() => { setView('join'); setCodeInput('') }}>Join Room</button>
          {lobbyError && <p style={errorText}>{lobbyError}</p>}
        </div>
      )}

      {view === 'join' && (
        <div style={card}>
          <p style={label}>Enter room code</p>
          <input
            style={{ ...input, textTransform: 'uppercase', letterSpacing: 6, textAlign: 'center', fontSize: 24, fontVariantNumeric: 'tabular-nums' }}
            placeholder="ABC234"
            value={codeInput}
            maxLength={6}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && codeInput.length === 6 && joinRoom(codeInput)}
            autoFocus
          />
          {lobbyError && <p style={errorText}>{lobbyError}</p>}
          <button style={primaryBtn} disabled={codeInput.length < 6} onClick={() => joinRoom(codeInput)}>
            Join
          </button>
          <button style={secondaryBtn} onClick={() => setView('home')}>Back</button>
        </div>
      )}
    </div>
  )
}

// ── Design tokens · all interactive targets >= 44px ───────────────
const centeredScreen = { minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }
const title = { color: 'rgba(255,255,255,0.9)', fontWeight: 300, fontSize: 28, letterSpacing: 6, textAlign: 'center', margin: 0 }
const muted = { color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', margin: 0 }
const mutedSmall = { color: 'rgba(255,255,255,0.25)', fontSize: 13 }
const card = { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12, padding: 24, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }
const label = { color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }
const input = { height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 16, outline: 'none', width: '100%', boxSizing: 'border-box' }
const primaryBtn = { minHeight: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 500, padding: '0 16px' }
const secondaryBtn = { minHeight: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', padding: '0 16px' }
const backBtn = { position: 'absolute', top: 20, left: 20, minHeight: 44, padding: '0 16px', borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }
const codeBox = { textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }
const codeDisplay = { fontSize: 40, fontWeight: 700, letterSpacing: 12, color: 'white', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }
const playerList = { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }
const playerRow = { minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
const avatar = { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }
const playerName = { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500 }
const hostBadge = { fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }
const readyBadge = { fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(30,200,100,0.15)', color: '#1DC864' }
const waitingBadge = { fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }
const errorText = { color: '#E24B4A', fontSize: 12, margin: 0, textAlign: 'center' }
// Reuses the existing hexPulse keyframe (src/index.css · T1) · no new global CSS dependency.
const spinner = { width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', animation: 'hexPulse 1.4s ease-in-out infinite' }
