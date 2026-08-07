import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
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
        {/* Catch-all · any unmatched path lands on the front door, never a blank SPA screen. */}
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  )
}

// Lobby owns auth + room lifecycle (T3). On game start it hands us the roomId · we route into the
// game by URL so the id survives an unmount/refresh and useGameSync can re-subscribe + reseed.
function LobbyRoute() {
  const navigate = useNavigate()
  return <Lobby onGameStart={(roomId) => navigate(`/game/${roomId}`)} />
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
function JoinRoute() {
  const navigate = useNavigate()
  const { code } = useParams()
  return <Lobby initialCode={code} onGameStart={(roomId) => navigate(`/game/${roomId}`)} />
}
