import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Lobby from './pages/Lobby'
import GameRoom from './pages/GameRoom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LobbyRoute />} />
        {/* Route-param carries roomId across the lobby→game boundary · survives refresh (free rejoin). */}
        <Route path="/game/:roomId" element={<GameRoom />} />
        {/* No param · solo dev entry (GameRoom auto-inits a local game, no realtime). */}
        <Route path="/game" element={<GameRoom />} />
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
