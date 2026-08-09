import { useCallback } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Landing from './pages/Landing'
import Lobby from './pages/Lobby'
import GameRoom from './pages/GameRoom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* '/' is the civilization's front door (Landing) · its CTAs route to the lobby. */}
        <Route path="/" element={<Landing />} />
        <Route path="/lobby" element={<LobbyRoute />} />
        {/* Invite link · one tap, type a name, in the room. Renders the SAME Lobby with the code
            from the URL handed in (see JoinRoute below for why it is not a separate page). */}
        <Route path="/join/:code" element={<JoinRoute />} />
        {/* Route-param carries roomId across the lobby→game boundary · survives refresh (free rejoin). */}
        <Route path="/game/:roomId" element={<GameRoom />} />
        {/* No param · solo dev entry (GameRoom auto-inits a local game, no realtime). */}
        <Route path="/game" element={<GameRoom />} />
        {/* PRACTICE (T1 S32) · the only path in the product for somebody who arrives alone, which is
            what nearly everyone does. Deliberately its own path rather than /game: T3 attaches the
            auth-free session shape here, and a distinct route means practice can never be confused
            with a real room by a link, a test, or a reader. ?bots=N carries the chosen opponent
            count · GameRoom's existing local mode serves the zero-opponent case today. */}
        <Route path="/practice" element={<PracticeRoute />} />
        {/* Catch-all · any unmatched path lands on the front door, never a blank SPA screen. */}
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  )
}

// Lobby owns auth + room lifecycle (T3). On game start it hands us the roomId · we route into the
// game by URL so the id survives an unmount/refresh and useGameSync can re-subscribe + reseed.
//
// AND the same trick one step earlier, for the waiting room (T1 S32). Refreshing there used to
// destroy the room from the player's side: membership is per-instance useState inside useGameRoom
// with nothing behind it, so the remount a refresh causes loses it, while the seat stays held in the
// database. The code goes into the QUERY STRING rather than into the path on purpose · pushing
// /join/CODE would change which <Route> matches, React would unmount this element and mount JoinRoute,
// and that remount is the exact thing being defended against. Same route + a replaced search keeps one
// Lobby instance alive, and a reload re-enters through the invite auto-join path.
function LobbyRoute() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const roomParam = params.get('room')

  // replace, not push · the waiting room is not a place the Back button should walk through, and
  // functional form so a concurrent search-param change is never clobbered.
  const onRoomCode = useCallback((code) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (code) next.set('room', code)
      else next.delete('room')
      return next
    }, { replace: true })
  }, [setParams])

  return (
    <Lobby
      initialCode={roomParam}
      onRoomCode={onRoomCode}
      onPractice={(bots) => navigate(`/practice?bots=${bots}`)}
      onGameStart={(roomId) => navigate(`/game/${roomId}`)}
    />
  )
}

// An invite link lands here. It renders the SAME Lobby as /lobby with the URL's code handed in,
// rather than a page of its own · and that is load-bearing, not a shortcut.
//
// useGameRoom (T3) keeps roomId / roomCode / seat / roomPhase in plain per-instance useState. There
// is no store or context for room membership. So a standalone join page that called joinRoom(code)
// and then navigated to /lobby would hand the player a FRESH hook instance sitting at roomId=null,
// roomPhase='idle' · they would hold a real room_players row in the database and still be looking at
// the Create Room screen, with no way back to the room they just joined. Keeping one Lobby instance
// across claim → join → waiting room is what makes the invite survive, and it reuses the existing
// waiting room and game-start navigation instead of duplicating them.
// Practice · a local game with no room, no seat claim and no realtime. The opponent count rides the
// query string so the entry point stays a plain link and a player can bookmark or re-run it, which is
// the "replayable indefinitely" half of the intent.
//
// CLOSED IN S33, and it is worth recording which half moved. In S32 this comment said the route still
// cost one anonymous sign-in, because GameRoom called useAuth() unconditionally and useAuth mints an
// identity when none is stored. That was true and it was mine to fix: GameRoom now splits into an
// authed shell and a local one, and the practice route mounts the shell with no useAuth in its tree.
// Zero sign-ins is now a property of the component graph rather than a promise in a comment.
//
// `practice` is a prop and not an inference from `bots`, because zero opponents is a legitimate
// practice game AND the shape /game has always had · only the route knows the difference, and the
// difference decides whether the game is written to the civilization's permanent record.
function PracticeRoute() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const raw = Number.parseInt(params.get('bots') ?? '0', 10)
  const bots = Number.isFinite(raw) ? Math.min(3, Math.max(0, raw)) : 0
  // Home rather than back · Back would re-enter whatever screen sent them here, and the board they
  // just tore down is the one thing behind them.
  return <GameRoom practice practiceBots={bots} onExitPractice={() => navigate('/')} />
}

function JoinRoute() {
  const navigate = useNavigate()
  const { code } = useParams()
  // onPractice was missing here, and this is the ONE route where it matters most: every dead-invite
  // screen (room gone, room full, game started, game over) renders on this route, and a person who
  // followed a link to a room that no longer exists is the most stranded visitor in the product.
  // /lobby had the handler and the invite path did not, so the escape hatch existed everywhere except
  // where somebody needed it.
  return (
    <Lobby
      initialCode={code}
      onPractice={(bots) => navigate(`/practice?bots=${bots}`)}
      onGameStart={(roomId) => navigate(`/game/${roomId}`)}
    />
  )
}
