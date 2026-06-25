import { BrowserRouter, Routes, Route } from 'react-router-dom'
import GameRoom from './pages/GameRoom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingStub />} />
        <Route path="/game" element={<GameRoom />} />
        <Route path="/lobby" element={<LobbyStub />} />
      </Routes>
    </BrowserRouter>
  )
}

function LandingStub() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',
      justifyContent:'center',background:'#0a0a0f',color:'rgba(255,255,255,0.8)',
      flexDirection:'column',gap:16}}>
      <h1 style={{fontSize:32,fontWeight:300,letterSpacing:4}}>NEOTOPIA</h1>
      <p style={{color:'rgba(255,255,255,0.4)',fontSize:14}}>
        A consciousness civilization · 2055
      </p>
      <a href="/game" style={{marginTop:8,padding:'10px 24px',
        border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,
        color:'rgba(255,255,255,0.7)',textDecoration:'none',fontSize:13}}>
        Enter Game (dev)
      </a>
    </div>
  )
}

function LobbyStub() {
  return <div style={{color:'white',padding:'2rem'}}>Lobby · Session 2</div>
}
