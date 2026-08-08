// NeoTopia · lobby page (username claim → create/join → waiting room → start).
// T1 owns this file (src/pages/ · CLAUDE.md lane grant). Mobile-first · every target is >= 44px.
// Auth: useAuth (T2). Room: useGameRoom (T3). No window.confirm anywhere.

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGameRoom, JOIN_FAILURE } from '../hooks/useGameRoom'
import ElementIcon from '../components/Board/ElementIcon'
import { GAME_MODES } from '../store/gameConfig'
import { useBackendHealth } from '../hooks/useConnectionHealth'
import { deriveBackendStatus } from '../utils/backendStatus'
import { normalizeRoomCode, isRoomCodeShape, buildInviteUrl } from '../utils/roomLink'

// Seat → the colour actually painted on a roster avatar. These hexes are the ONLY seat colour a player
// ever sees: the `color` on a store player and the `player_color` on a room_players row are never
// rendered anywhere (grepped S28).
//
// SEAT 3 IS GOLD (Mahil, S29). The live CHECK on room_players accepts only blue/gold/green/red, so
// 'gold' is what the database stores for seat 3 (useGameRoom.js SEAT_COLORS, T3 S28) and #C89440 is
// what a player now sees. Same token as the room code, the invite button and the winner line · the
// palette gains no new entry.
//
// Measured before choosing, because "gold" alone does not say which gold (CIE76 dE from each seat,
// and WCAG contrast for the white initials sitting on top):
//                    vs blue  vs red  vs green   worst   white text
//   #7F77DD purple      25      90       96        25      3.76:1     ← what it was
//   #C89440 gold       101      51       67        51      2.70:1     ← chosen
//   #B8871F deeper     108      55       70        55      3.22:1
// The purple it replaces was the LEAST separable pair on the board (dE 25 from seat 0's blue, where
// anything under ~25 starts to read as "same colour, different lighting"). Gold doubles the worst-case
// separation, so four players are now easier to tell apart than three were.
// KNOWN COST, not an oversight: white 12px initials on this gold measure 2.70:1, the weakest of the
// four (the others are 3.39 to 3.93 and none of them reach the 4.5 that 12px bold wants). The name is
// spelled out in full immediately to the right, so the initials are redundant rather than load-bearing.
// #B8871F buys 3.22:1 if the initials should stand on their own · one line, but it adds a hex the
// palette does not otherwise use.
// All three copies of this list now agree, which they have not done before: useGameRoom.SEAT_COLORS
// writes 'gold' (T3 S28), gameStore.js:188 says 'gold' (T2 S29), and seat 3 is painted gold here. The
// three still exist as three separate literals though, so agreement is a coincidence maintained by
// hand · Rule 45 stands, and one of them should eventually import from another.
// Exported so the distinguishability claim above is a GATE rather than a comment. The four-player
// roster screenshot that would have shown this needs four live anonymous sessions, and the anon
// sign-in budget is exhausted (T2 S29) · so the check that matters became a test instead of a picture
// (Rule 31 · when live verification is blocked, convert it to something deterministic).
export const SEAT_COLORS = ['#378ADD', '#E24B4A', '#1D9E75', '#C89440'] // blue · red · green · gold (by seat)

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

// `initialCode` arrives only from the /join/:code invite route (App.jsx · JoinRoute). Everything
// about the invite path is additive: with no code this component behaves exactly as it did before.
export default function Lobby({ onGameStart, initialCode = null }) {
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
    createRoom, joinRoom, peekRoom, setReady, startGame, leaveRoom, gameMode, setGameMode,
  } = useGameRoom(user, username)

  const [nameInput, setNameInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [claimError, setClaimError] = useState(null)
  const [view, setView] = useState('home') // home | join
  const [copied, setCopied] = useState(false)        // room-code copy feedback (BUG-04)
  const [editingName, setEditingName] = useState(false) // username edit mode (BUG-05)
  const [editName, setEditName] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)     // invite-link copy feedback (S27)
  const [autoJoining, setAutoJoining] = useState(false)   // an invite join is in flight
  const [inviteDismissed, setInviteDismissed] = useState(false) // player chose to type a code instead
  const [peek, setPeek] = useState(null)                  // peekRoom preview of the invited room
  const [joinResult, setJoinResult] = useState(null)      // structured outcome of the invite join

  // The invite code, cleaned of everything it picks up in transit (case, spaces, dashes). Shape is
  // checked here so an obviously-broken link fails instantly and honestly, instead of costing a
  // round trip to come back as the generic 'Room not found'.
  const inviteCode = initialCode ? normalizeRoomCode(initialCode) : ''
  const hasInvite = inviteCode !== '' && !inviteDismissed
  const inviteValid = isRoomCodeShape(inviteCode)

  // One attempt per code. joinRoom's own busyRef makes a second concurrent call return SILENTLY ·
  // no error, no state change · so under StrictMode's double-mount an unguarded auto-join would look
  // like a join that simply never happened. The latch is keyed on the CODE, not on mount count.
  const joinAttemptRef = useRef(null)

  // Game start is a side effect · never call onGameStart during render (it would update a parent
  // mid-render). Fire it from an effect once the room transitions to playing. Pass roomId so the
  // parent can route to /game/:roomId (T1 · roomId must cross the boundary outside synced state).
  useEffect(() => {
    if (roomPhase === 'playing' && roomId) onGameStart?.(roomId)
  }, [roomPhase, roomId, onGameStart])

  // ── Invite preview ──────────────────────────────────────────────
  // peekRoom (T3 S27) reads the room and its roster with the anon key and writes nothing, so it can
  // run before the visitor has a name or even a session. That ordering is the point: a dead or full
  // link is reported BEFORE we ask a stranger to type anything, instead of after. It re-runs once a
  // session exists because `rejoinable` is unanswerable without one.
  const canUseRooms = backend.canUseRooms
  useEffect(() => {
    if (!hasInvite || !inviteValid) return
    if (roomPhase !== 'idle') return
    let alive = true
    Promise.resolve(peekRoom(inviteCode)).then(r => { if (alive) setPeek(r) })
    return () => { alive = false }
  }, [hasInvite, inviteValid, inviteCode, roomPhase, peekRoom])

  // ── Invite auto-join ────────────────────────────────────────────
  // The whole point of a share link: the player should not have to type a code they already clicked.
  // This waits for the preconditions to be genuinely true rather than firing early · for an invitee,
  // "no session yet" and "no name yet" are the NORMAL opening state, not errors, and firing then
  // would burn the one attempt on a guaranteed NAME_REQUIRED. canUseRooms is read as a primitive
  // because `backend` is a fresh object on every render.
  useEffect(() => {
    if (!hasInvite || !inviteValid) return
    if (roomPhase !== 'idle') return          // already in a room · nothing to do
    if (!canUseRooms || !user?.id || !username) return
    if (joinAttemptRef.current === inviteCode) return
    joinAttemptRef.current = inviteCode
    setAutoJoining(true)
    // joinRoom returns a structured { ok } / { ok:false, reason, message } (T3 S27). Branch on
    // `reason`, never on the message text · the codes are the contract and the copy is not.
    Promise.resolve(joinRoom(inviteCode))
      .then(r => setJoinResult(r ?? null))
      .finally(() => setAutoJoining(false))
  }, [hasInvite, inviteValid, inviteCode, roomPhase, canUseRooms, user?.id, username, joinRoom])

  // Let the player try the same code again after a failure (a full room can empty, a server can come
  // back). Clearing the latch re-arms the effect above; joinRoom clears lobbyError itself on entry.
  function retryInvite() {
    joinAttemptRef.current = null
    setJoinResult(null)
    setPeek(null)
    setAutoJoining(false)
  }

  // ── What the invite screen should say when the player cannot get in ──────────────────────────
  // Every branch names the real obstacle and then says what to do next · a stranger who followed a
  // link is the least-oriented person in the product and a bare 'Room not found' strands them.
  // Terminal cases only: a network or offline failure is NOT here, because the banner already
  // explains it and the join is still worth retrying.
  function inviteBlock() {
    if (!inviteValid) {
      return {
        headline: "This invite link isn't valid",
        detail: 'A room code is 6 characters, and never uses the letter I or O, or the digits 0 or 1. Ask for a new link, or type a code yourself.',
      }
    }
    const reason = peek?.ok === false ? peek.reason : joinResult?.ok === false ? joinResult.reason : null
    if (reason === JOIN_FAILURE.INVALID_CODE) {
      return { headline: "This invite link isn't valid", detail: 'Ask for a new link, or type a code yourself.' }
    }
    if (reason === JOIN_FAILURE.NOT_FOUND) {
      return {
        headline: 'This room no longer exists',
        detail: 'It may have been closed, or the link may have a typo. Ask for a new link, or type a code yourself.',
      }
    }
    if (reason === JOIN_FAILURE.ROOM_FULL) {
      return { headline: 'That room is full', detail: 'Every seat is taken. Ask them to start a new game, or join a different room.' }
    }
    if (reason === JOIN_FAILURE.ALREADY_STARTED) {
      return { headline: 'That game has already started', detail: 'You can join a different room, or ask them for a new game.' }
    }
    // The preview can rule the room out before any join is attempted. `rejoinable` overrides it: a
    // player returning to their OWN in-progress game is admitted by design (T3 S27), so a room that
    // is un-joinable to a stranger is still open to them.
    if (peek?.ok && !peek.canJoin && !peek.rejoinable) {
      return peek.status === 'playing'
        ? { headline: 'That game has already started', detail: 'You can join a different room, or ask them for a new game.' }
        : { headline: 'That room is full', detail: `All ${peek.maxPlayers} seats are taken. Ask them to start a new game, or join a different room.` }
    }
    return null
  }

  // Copy for the RETRYABLE failures. A player must never be shown a raw database error as the
  // explanation of what happened to them · proven necessary live: a seat-colour CHECK violation
  // surfaced to the screen as `new row for relation "room_players" violates check constraint ...`,
  // which tells a person nothing they can act on. The raw text is still rendered, small and quiet,
  // because it is what makes a screenshot diagnosable for us (same treatment as the backend banner).
  function inviteRetryDetail(reason) {
    switch (reason) {
      case JOIN_FAILURE.SEAT_CONFLICT:    return 'Someone took the last seat first.'
      case JOIN_FAILURE.BACKEND_OFFLINE:  return "Can't reach NeoTopia's servers right now."
      case JOIN_FAILURE.NOT_AUTHENTICATED: return 'Still connecting. Give it a moment.'
      case JOIN_FAILURE.BUSY:             return 'Already on the way in.'
      default:                            return 'Something went wrong on the way in.'
    }
  }

  // Fall back to the ordinary manual path, with the code they arrived with already filled in.
  function dismissInvite() {
    setInviteDismissed(true)
    setView('join')
    setCodeInput(inviteValid ? inviteCode : '')
  }

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

  // S27 · copy the whole clickable invite link, not just the code. This is the one-tap path: the
  // person receiving it taps, types a name, and is in the room. buildInviteUrl returns null rather
  // than a half-built URL if the code is unusable, so a link that cannot work never reaches a
  // clipboard · hence the guard rather than an optimistic template string.
  function copyInviteLink() {
    const url = buildInviteUrl(roomCode, window.location.origin)
    if (!url) return
    navigator.clipboard?.writeText(url)
      .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) })
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

  // ── An invite link that cannot work ─────────────────────────────
  // Deliberately BEFORE the username claim. peekRoom needs no session, so a dead, closed or full
  // link is answerable immediately · making a stranger type a name first and THEN telling them the
  // room is gone is the version of this screen that wastes their time.
  const blocked = hasInvite && roomPhase === 'idle' ? inviteBlock() : null
  if (blocked) {
    return (
      <div style={centeredScreen}>
        <h1 style={title}>NEOTOPIA</h1>
        <div style={card} data-testid="invite-blocked">
          <p style={label}>Invite link</p>
          <div style={inviteCodeLine}>{inviteValid ? inviteCode : String(initialCode ?? '').slice(0, 10)}</div>
          <p style={inviteHeadline}>{blocked.headline}</p>
          <p style={inviteDetail}>{blocked.detail}</p>
          <button style={primaryBtn} data-testid="invite-manual" onClick={dismissInvite}>
            Enter a code instead
          </button>
        </div>
        <p style={stageLine}>Free to play · no download · no account</p>
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
        <p style={tagline}>Build the city of 2055 · two to four players</p>
        <ElementRow />
        <BackendBanner backend={backend} onRetry={retryBackend} />
        {/* Why this stranger is here. Without it, an invite link opens on a name prompt with no
            explanation of what they are about to enter. */}
        {hasInvite && inviteValid && (
          <p style={inviteNote} data-testid="invite-context">
            Joining room <span style={inviteNoteCode}>{inviteCode}</span>
            {peek?.ok && ` · ${peek.playerCount} of ${peek.maxPlayers} players`}
          </p>
        )}
        <div style={card}>
          <p style={label}>{hasInvite && inviteValid ? 'Choose a name to enter' : 'Choose your name'}</p>
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
        <p style={stageLine}>Free to play · no download · no account</p>
      </div>
    )
  }

  // ── Invite · going in, or a failure worth retrying ──────────────
  // Reached only once the name exists, so the auto-join effect is armed. Terminal failures never
  // land here (they were answered by the blocked screen above) · what remains is the wait itself
  // and the retryable class: a lost seat race, a transport error, a server that just came back.
  if (hasInvite && roomPhase === 'idle') {
    const retryable = joinResult?.ok === false && !autoJoining
    return (
      <div style={centeredScreen}>
        <h1 style={title}>NEOTOPIA</h1>
        <div style={codeBox}>
          <p style={label}>Joining room</p>
          <div style={codeDisplay} data-testid="invite-code">{inviteCode}</div>
          {peek?.ok && (
            <p style={muted} data-testid="invite-roster">
              {peek.playerCount} of {peek.maxPlayers} players waiting
            </p>
          )}
        </div>

        <BackendBanner backend={backend} onRetry={retryBackend} />

        {!retryable && (
          <>
            <div style={spinner} />
            <p style={muted} data-testid="invite-joining">
              {canUseRooms ? 'Taking you in…' : 'Waiting for the connection…'}
            </p>
          </>
        )}

        {retryable && (
          <div style={card} data-testid="invite-error">
            <p style={inviteHeadline}>Could not get you in</p>
            <p style={inviteDetail}>{inviteRetryDetail(joinResult.reason)}</p>
            {/* The cause, verbatim · small and quiet. Useful to us in a screenshot, ignorable to a
                player, and never the sentence they have to read to understand what happened. */}
            {joinResult.message && <p style={downReason}>{joinResult.message}</p>}
            <button style={primaryBtn} data-testid="invite-retry" onClick={retryInvite}>Try again</button>
            <button style={secondaryBtn} data-testid="invite-manual" onClick={dismissInvite}>Enter a code instead</button>
          </div>
        )}
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
          {/* The link is the one-tap path · whoever receives it taps, types a name, and is in here.
              The code stays alongside it because it is what you read out loud in the same room. */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={shareBtn} data-testid="copy-invite-link" onClick={copyInviteLink}>
              {linkCopied ? '✓ Link copied' : 'Copy invite link'}
            </button>
            <button style={copyBtn} data-testid="copy-room-code" onClick={copyCode}>
              {copied ? '✓ Copied' : 'Copy code'}
            </button>
          </div>
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

      <p style={stageLine}>Free to play · no download · no account</p>
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
// ── Invite link (S27) · gold because sharing the room is the primary action in the waiting room,
// and gold is already this app's "this is the important one" accent (room code, selected mode). ──
const shareBtn = { minHeight: 44, padding: '0 20px', borderRadius: 8, border: '1px solid rgba(200,148,64,0.45)', background: 'rgba(200,148,64,0.12)', color: '#C89440', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: 0.5 }
const inviteNote = { color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', margin: 0, lineHeight: 1.6 }
const inviteNoteCode = { color: '#C89440', fontWeight: 700, letterSpacing: 2, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }
const inviteCodeLine = { fontSize: 26, fontWeight: 700, letterSpacing: 8, color: '#C89440', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', textAlign: 'center', wordBreak: 'break-all' }
const inviteHeadline = { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: 500, margin: 0, textAlign: 'center' }
const inviteDetail = { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6, margin: 0, textAlign: 'center' }
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
