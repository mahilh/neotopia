import { useState } from 'react'
import GameBoard from '../components/Board/GameBoard'
import { FACTORIES, REGIONS } from '../utils/hexUtils'

// Stub game state · replaced by Zustand store in Session 2
const STUB_REGIONS = REGIONS.map(r => ({...r, hexes: {
  '0,0': {element: r.id === 0 ? 'technology' : null},
  '1,0': {element: r.id === 1 ? 'biofarming' : null},
}}))

const ELEMENT_CYCLE = ['energy','biofarming','technology','community']
const STUB_FACTORIES = FACTORIES.map((f, i) => ({...f, elements: [
  {type: ELEMENT_CYCLE[i % 4], count: 2},
  {type: ELEMENT_CYCLE[(i + 1) % 4], count: 1}, // distinct from the first stack
]}))

export default function GameRoom() {
  const [actionsLeft, setActionsLeft] = useState(3)
  const [validTargets, setValidTargets] = useState([])

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        height: 56,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
      }}>
        <span style={{color:'rgba(255,255,255,0.9)',fontWeight:500,letterSpacing:3,fontSize:13}}>
          NEOTOPIA
        </span>
        <span style={{color:'rgba(255,255,255,0.3)',fontSize:12}}>Room: ·</span>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:12}}>
          <span style={{color:'rgba(255,255,255,0.5)',fontSize:12}}>Actions:</span>
          <span style={{
            color:'white',fontWeight:600,fontSize:18,
            fontVariantNumeric:'tabular-nums',minWidth:24,textAlign:'center'
          }}>
            {actionsLeft}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
        {/* Board area */}
        <div style={{flex:1,padding:16,display:'flex',alignItems:'center',justifyContent:'center',minHeight:0,minWidth:0}}>
          <GameBoard
            regions={STUB_REGIONS}
            factories={STUB_FACTORIES}
            validTargets={validTargets}
            onHexClick={(q, r, regionId) => {
              console.log('hex clicked:', q, r, regionId)
              setActionsLeft(a => Math.max(0, a-1))
            }}
          />
        </div>

        {/* Right sidebar */}
        <aside style={{
          width: 280,
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          gap: 16,
        }}>
          {/* The Offer */}
          <div>
            <div style={{color:'rgba(255,255,255,0.4)',fontSize:10,letterSpacing:2,
              textTransform:'uppercase',marginBottom:8}}>
              The Offer
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{
                  height:64,border:'1px dashed rgba(255,255,255,0.1)',
                  borderRadius:8,display:'flex',alignItems:'center',
                  justifyContent:'center',color:'rgba(255,255,255,0.2)',fontSize:12,
                }}>
                  Card slot {i}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button style={{
              height:44,border:'1px solid rgba(255,255,255,0.15)',
              borderRadius:8,background:'transparent',color:'rgba(255,255,255,0.7)',
              cursor:'pointer',fontSize:13,
            }}>
              Draw Card
            </button>
            <button style={{
              height:44,border:'1px solid rgba(255,255,255,0.15)',
              borderRadius:8,background:'transparent',color:'rgba(255,255,255,0.7)',
              cursor:'pointer',fontSize:13,
            }}>
              Move Element
            </button>
          </div>

          {/* Hand */}
          <div>
            <div style={{color:'rgba(255,255,255,0.4)',fontSize:10,letterSpacing:2,
              textTransform:'uppercase',marginBottom:8}}>
              Your Hand
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6,
              maxHeight:200,overflowY:'auto'}}>
              {[1,2,3].map(i => (
                <div key={i} style={{
                  height:56,border:'1px dashed rgba(255,255,255,0.08)',
                  borderRadius:8,display:'flex',alignItems:'center',
                  padding:'0 12px',color:'rgba(255,255,255,0.2)',fontSize:12,
                }}>
                  Project card {i}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
