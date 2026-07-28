// NeoTopia · lobby page (username claim → create/join → waiting room → start).
// T1 owns this file (src/pages/ · CLAUDE.md lane grant). Mobile-first · every target is >= 44px.
// Auth: useAuth (T2). Room: useGameRoom (T3). No window.confirm anywhere.

import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGameRoom } from '../hooks/useGameRoom'
import ElementIcon from '../components/Board/ElementIcon'
import { GAME_MODES } from '../store/gameConfig'
import { useBackendHealth } from '../hooks/useConnectionHealth'
import { deriveBackendStatus } from '../utils/backendStatus'

const SEAT_COLORS = ['#378ADD', '#E24B4A', '#1D9E75', '#7F77DD'] // blue · red · green · purple (by seat)

// The four elements a civilization is built from · decorative row on the entry screens · reuses the
// bespoke board ElementIcon so the lobby and the board speak one visual language (T1 S14).
const ELEMENTS = [
  { key: 'energy', color: '#E24B4A', label: 'Energy' },
  { key: 'biofarming', color: '#1D9E75', label: 'BioFarming' },
  { key: 'technology', color: '#7F77DD', label: 'Technology' },
  { key: 'community', color: '#378ADD', label: 'Community' },
]
function ElementRow() {
  return (
    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
      {ELEMENTS.map(e => (
        <div key={e.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <ElementIcon element={e.key} color={e.color} size={26} />
          <span style={{ fontSize: 11, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)' }}>{e.label}</span>
        </div>
      ))}
    </div>
  )
}

// Host-only game-mode selector (T1 S17 · the final piece of the Flow-mode chain · engine T2 86d0220 ·
// createRoom(mode) + sessionId T3 ced8133 · seed seam T3 133f0b9). Reads GAME_MODES so the labels and the
// per-mode numbers stay the single source of truth (Rule 62 · no re-hardcoded copy that can drift). The
// chosen mode is set via setGameMode (exposed by useGameRoom) and passed as the ARGUMENT to createRoom ·
// createRoom defaults its arg to 'classic' and re-runs setGameMode, so a prior setGameMode alone would be
// overwritten; the value only survives by riding createRoom(gameMode) (Rule 61 · traced through the body).
function ModeToggle({ gameMode, setGameMode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={label}>Game Mode</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {Object.keys(GAME_MODES).map(id => {
          const m = GAME_MODES[id]
          const selected = gameMode === id
          return (
            <button
              key={id}
              data-testid={`mode-${id}`}
              aria-pressed={selected}
              onClick={() => setGameMode(id)}
              style={{
                flex: 1, minHeight: 44, borderRadius: 8, cursor: 'pointer',
                padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
                border: selected ? '2px solid #C89440' : '1px solid rgba(255,255,255,0.12)',
                background: selected ? 'rgba(200,148,64,0.10)' : 'rgba(255,255,255,0.03)',
                color: selected ? '#C89440' : 'rgba(255,255,255,0.6)',
                transition: 'border-color 0.15s, background 0.15s, color 0.15s',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</span>
              <span style={{ fontSize: 10, letterSpacing: 0.3, opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
                {m.END_GAME_TILE} tiles · {m.TURN_TIME_LIMIT}s turns
              </span>
            </button>
          )
        })}
      </div>
      <p style={{ ...muted, textAlign: 'left', minHeight: 32 }}>{GAME_MODES[gameMode]?.description}</p>
    </div>
  )
}

// Backend degraded state (launch blocker · T1 S26). Mounts ONLY while something is actually wrong,
// so its presence in the DOM is itself the signal (Rule 50 · a permanently-mounted testid proves
// nothing). role="alert" so the failure is announced to a screen reader, not merely drawn.
// The testid is tone-scoped, so an E2E can distinguish "gave up" from "still retrying".
function BackendBanner({ backend, onRetry }) {
  if (!backend.showBanner) return null
  return (
    <div
      style={backend.isOffline ? downBanner : retryingBanner}
      role="alert"
      data-testid={`backend-${backend.tone}`}
    >
      <p style={backend.isOffline ? downHeadline : retryingHeadline}>{backend.headline}</p>
      <p style={downDetail}>{backend.detail}</p>
      {backend.reason && <p style={downReason}>{backend.reason}</p>}
      {/* Offered only in the terminal state · while a transport is still retrying inside its budget
          there is nothing for this to do that is not already happening. */}
      {backend.isOffline && (
        <button style={retryBtn} data-testid="backend-retry" onClick={onRetry}>Try again</button>
      )}
    </div>
  )
}

// Room affordances stay VISIBLE but plainly inert while the backend is unreachable · hiding them
// would leave a stranger with a blank screen and no idea what is missing. Greyed + disabled + a
// stated reason above them reads as "not right now", which is the truth.
const inert = (base) => ({ ...base, opacity: 0.35, cursor: 'not-allowed' })

export default function Lobby({ onGameStart }) {
  const { user, username, isLoading: authLoading, authError, isClaimed, claimUsername } = useAuth()

  // Reachability comes from T3's aggregator (useConnectionHealth · every transport reports into it and
  // it reflects onto html[data-backend-status]). This page only MAPS that to what it renders · it does
  // not detect anything itself (Rule 62 · reconcile with the owner's module, never rebuild it).
  // `authError` is folded in alongside it because it is the signal that already existed here and was
  // already being discarded: Lobby destructured user/username/isLoading/isClaimed/claimUsername and
  // never authError, which is exactly how a paused Supabase project rendered a perfectly normal lobby
  // for hours while auth errors piled up in the console and every button led nowhere.
  const health = useBackendHealth()
  const backend = deriveBackendStatus({ authLoading, authError, user, health })

  // "Try again" delegates to whichever hook is actually broken · useConnectionHealth fans this out to
  // every registered retry handler (useAuth re-runs signInAnonymously, useGameSync resets its backoff
  // and re-subscribes). If nothing is registered there is genuinely nothing to re-run in place, so a
  // reload is the honest fallback rather than a button that silently does nothing.
  function retryBackend() {
    if (health.retry() === 0) window.location.reload()
  }
  const {
    roomId, roomCode, isHost, isReady, lobbyPlayers, lobbyError, roomPhase,
    createRoom, joinRoom, setReady, startGame, leaveRoom, gameMode, setGameMode,
  } = useGameRoom(user, username)

  const [nameInput, setNameInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [claimError, setClaimError] = useState(null)
  const [view, setView] = useState('home') // home | join
  const [copied, setCopied] = useState(false)        // room-code copy feedback (BUG-04)
  const [editingName, setEditingName] = useState(false) // username edit mode (BUG-05)
  const [editName, setEditName] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  // Game start is a side effect · never call onGameStart during render (it would update a parent
  // mid-render). Fire it from an effect once the room transitions to playing. Pass roomId so the
  // parent can route to /game/:roomId (T1 · roomId must cross the boundary outside synced state).
  useEffect(() => {
    if (roomPhase === 'playing' && roomId) onGameStart?.(roomId)
  }, [roomPhase, roomId, onGameStart])

  async function handleClaim() {
    setClaimError(null)
    const { error } = await claimUsername(nameInput.trim())
    if (error) setClaimError(error)
  }

  // BUG-04 · copy the room code so players can paste it into WhatsApp in one tap.
  function copyCode() {
    if (!roomCode) return
    navigator.clipboard?.writeText(roomCode)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => {})
  }

  // BUG-05 · rename: claimUsername upserts the player_profiles row, so it doubles as an edit.
  async function saveName() {
    const next = editName.trim()
    if (next.length < 2) return
    const { error } = await claimUsername(next)
    if (!error) { setEditingName(false); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500) }
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
    // A first-time visitor has no persisted session, so a dead backend fails sign-in outright and
    // lands them HERE · this is the screen a stranger actually hits, and the one that used to lie.
    const claimBlocked = !backend.canUseRooms || nameInput.trim().length < 2
    // NOTE · no data-backend-status attribute on any element here. useConnectionHealth already
    // reflects the authoritative value onto <html>, and a second element publishing the same
    // attribute name would shadow it in document order for any querySelector or CSS rule.
    // One attribute, one owner.
    return (
      <div style={centeredScreen}>
        <h1 style={title}>NEOTOPIA</h1>
        <p style={tagline}>Build a consciousness civilization · 2055 approaches</p>
        <ElementRow />
        <BackendBanner backend={backend} onRetry={retryBackend} />
        <div style={card}>
          <p style={label}>Choose your name</p>
          <input
            style={backend.canUseRooms ? input : inert(input)}
            placeholder="Builder name (max 20)"
            value={nameInput}
            maxLength={20}
            disabled={!backend.canUseRooms}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !claimBlocked && handleClaim()}
            autoFocus
          />
          {claimError && <p style={errorText}>{claimError}</p>}
          <button
            data-testid="claim-btn"
            style={claimBlocked ? inert(primaryBtn) : primaryBtn}
            disabled={claimBlocked}
            onClick={handleClaim}
          >
            Enter NeoTopia
          </button>
        </div>
        <p style={stageLine}>Stage 2 of 5 · The Awareness</p>
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
          <div style={codeDisplay} data-testid="room-code">{roomCode}</div>
          <button style={copyBtn} onClick={copyCode}>
            {copied ? '✓ Copied' : 'Copy code'}
          </button>
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
            data-testid="ready-btn"
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

      {/* Editable username (BUG-05) · pencil → input · Enter or Save commits via claimUsername upsert. */}
      {editingName ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', maxWidth: 360 }}>
          <input
            style={{ ...input, flex: 1 }}
            value={editName}
            maxLength={20}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
            autoFocus
          />
          <button style={{ ...secondaryBtn, minWidth: 64 }} disabled={editName.trim().length < 2} onClick={saveName}>Save</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={muted}>Welcome, {username}</p>
          <button style={editIcon} aria-label="Edit your name" onClick={() => { setEditName(username); setEditingName(true) }}>✎</button>
          {savedFlash && <span style={{ ...mutedSmall, color: '#1DC864' }}>Saved</span>}
        </div>
      )}

      <ElementRow />

      <BackendBanner backend={backend} onRetry={retryBackend} />

      {view === 'home' && (
        <div style={card}>
          {/* Host picks the mode here · createRoom resolves + persists it (joiners inherit via the room). The
              mode MUST be the createRoom ARGUMENT (its default would otherwise reset setGameMode · Rule 61). */}
          <ModeToggle gameMode={gameMode} setGameMode={setGameMode} />
          {/* Both room actions hang off the SAME gate as the banner above · they cannot look live while
              the banner says the servers are unreachable (that divergence is the bug this closes). */}
          <button
            data-testid="create-room-btn"
            style={backend.canUseRooms ? primaryBtn : inert(primaryBtn)}
            disabled={!backend.canUseRooms}
            onClick={() => createRoom(gameMode)}
          >
            Create Room
          </button>
          <button
            data-testid="join-room-btn"
            style={backend.canUseRooms ? secondaryBtn : inert(secondaryBtn)}
            disabled={!backend.canUseRooms}
            onClick={() => { setView('join'); setCodeInput('') }}
          >
            Join Room
          </button>
          {lobbyError && <p style={errorText}>{lobbyError}</p>}
        </div>
      )}

      {view === 'join' && (
        <div style={card}>
          <p style={label}>Enter room code</p>
          <input
            style={{
              ...(backend.canUseRooms ? input : inert(input)),
              textTransform: 'uppercase', letterSpacing: 6, textAlign: 'center', fontSize: 24, fontVariantNumeric: 'tabular-nums',
            }}
            placeholder="ABC234"
            value={codeInput}
            maxLength={6}
            disabled={!backend.canUseRooms}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && backend.canUseRooms && codeInput.length === 6 && joinRoom(codeInput)}
            autoFocus
          />
          {lobbyError && <p style={errorText}>{lobbyError}</p>}
          {/* Reachable only via the (already gated) Join Room button, but the backend can die WHILE
              this view is open · so the submit re-reads the same gate rather than trusting entry. */}
          <button
            data-testid="join-submit-btn"
            style={backend.canUseRooms && codeInput.length === 6 ? primaryBtn : inert(primaryBtn)}
            disabled={!backend.canUseRooms || codeInput.length < 6}
            onClick={() => joinRoom(codeInput)}
          >
            Join
          </button>
          {/* Back is pure local view state · it needs no backend, so it stays live on purpose. */}
          <button style={secondaryBtn} onClick={() => setView('home')}>Back</button>
        </div>
      )}

      <p style={stageLine}>Stage 2 of 5 · The Awareness</p>
    </div>
  )
}

// ── Design tokens · all interactive targets >= 44px ───────────────
const centeredScreen = { minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }
const title = { color: 'rgba(255,255,255,0.9)', fontWeight: 300, fontSize: 28, letterSpacing: 6, textAlign: 'center', margin: 0 }
const muted = { color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', margin: 0 }
const mutedSmall = { color: 'rgba(255,255,255,0.25)', fontSize: 13 }
const card = { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12, padding: 24, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }
const label = { color: 'rgba(255,255,255,0.45)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }
const tagline = { color: 'rgba(255,255,255,0.4)', fontSize: 13, letterSpacing: 2, textAlign: 'center', margin: 0 }
const stageLine = { color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', margin: 0 }
const input = { height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 16, outline: 'none', width: '100%', boxSizing: 'border-box' }
const primaryBtn = { minHeight: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 500, padding: '0 16px' }
const secondaryBtn = { minHeight: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', padding: '0 16px' }
const backBtn = { position: 'absolute', top: 20, left: 20, minHeight: 44, padding: '0 16px', borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }
const codeBox = { textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }
const codeDisplay = { fontSize: 40, fontWeight: 700, letterSpacing: 12, color: '#C89440', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', textShadow: '0 0 16px rgba(200,148,64,0.35)' }
const copyBtn = { minHeight: 44, padding: '0 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer', letterSpacing: 0.5 }
const editIcon = { minHeight: 44, minWidth: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }
const playerList = { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }
const playerRow = { minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
const avatar = { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }
const playerName = { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500 }
const hostBadge = { fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }
const readyBadge = { fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(30,200,100,0.15)', color: '#1DC864' }
const waitingBadge = { fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }
const errorText = { color: '#E24B4A', fontSize: 12, margin: 0, textAlign: 'center' }
// ── Backend banners · terminal failure reuses errorText's red so trouble reads as one visual
// language · a recoverable retry uses the gold accent instead, because it is not an error yet. ──
const downBanner = { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 12, border: '1px solid rgba(226,75,74,0.35)', background: 'rgba(226,75,74,0.08)', boxSizing: 'border-box' }
const retryingBanner = { ...downBanner, border: '1px solid rgba(200,148,64,0.35)', background: 'rgba(200,148,64,0.08)' }
const downHeadline = { color: '#E24B4A', fontSize: 14, fontWeight: 600, letterSpacing: 0.3, margin: 0 }
const retryingHeadline = { ...downHeadline, color: '#C89440' }
const downDetail = { color: 'rgba(255,255,255,0.55)', fontSize: 12.5, lineHeight: 1.5, margin: 0 }
// The raw cause, kept small and monospaced · useful to us in a screenshot, ignorable to a player.
const downReason = { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-word', margin: 0 }
const retryBtn = { minHeight: 44, borderRadius: 8, border: '1px solid rgba(226,75,74,0.4)', background: 'rgba(226,75,74,0.12)', color: '#E24B4A', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginTop: 2 }
// Reuses the existing hexPulse keyframe (src/index.css · T1) · no new global CSS dependency.
const spinner = { width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', animation: 'hexPulse 1.4s ease-in-out infinite' }
