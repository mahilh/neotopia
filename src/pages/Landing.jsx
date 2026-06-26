// NeoTopia · the civilization's front door (route '/').
// Copy is the canonical wording from docs/NEOTOPIA_LANDING_PAGE.md · every line passes the
// Civilization Narrative Coherence test (Dimension 35): it would stand on a placard in a real
// NeoTopia district. Voice rules honored: no exclamation marks · '·' never em dashes · civilization
// first, game second. The Global Index counter is the REAL aggregate (getGlobalIndex · same source
// as the FinalScore record), seed-fallback so it never shows a broken number.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGlobalIndex } from '../lib/supabase'

const GLOBAL_INDEX_BASE = 147823 // fallback only · getGlobalIndex already folds the seed in.

const BG = '#0a0a0f'
const sectionLabel = {
  fontSize: 10, letterSpacing: 4, color: 'rgba(255,255,255,0.5)', // WCAG AA (~5.3:1 on #0a0a0f)
  textTransform: 'uppercase', marginBottom: 16,
}

function MicroCard({ tag, lines }) {
  return (
    <div style={{
      flex: '1 1 220px', maxWidth: 300, padding: '24px 22px', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ fontSize: 10, letterSpacing: 4, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
        {tag}
      </div>
      {lines.map((l, i) => (
        <p key={i} style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
          {l}
        </p>
      ))}
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(null)

  const enter = () => navigate('/lobby')
  const scrollTo = (id) => (e) => {
    e.preventDefault()
    // Honor prefers-reduced-motion · an explicit JS 'smooth' would otherwise override the user setting.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  // Real Global NeoTopia Index · read-only · falls back to the seed inside getGlobalIndex on any error.
  useEffect(() => {
    let alive = true
    getGlobalIndex().then(n => { if (alive && typeof n === 'number') setIndex(n) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const shownIndex = (index ?? GLOBAL_INDEX_BASE).toLocaleString()

  return (
    <main style={{ background: BG, color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>

      {/* ───────────── HERO ───────────── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 24px',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 28, textTransform: 'uppercase' }}>
          2055
        </div>
        <div style={{ fontSize: 13, letterSpacing: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 28 }}>
          NEOTOPIA
        </div>
        <h1 style={{
          fontSize: 'clamp(28px, 5.5vw, 56px)', fontWeight: 200, letterSpacing: -0.5,
          color: 'rgba(255,255,255,0.95)', lineHeight: 1.15, maxWidth: 780, margin: '0 0 24px',
        }}>
          Every move you make becomes a building in 2055.
        </h1>
        <p style={{ fontSize: 'clamp(13px, 2vw, 17px)', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, maxWidth: 560, lineHeight: 1.7, margin: '0 0 12px' }}>
          Pure strategy · No dice · Build a consciousness civilization in real time
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginBottom: 44 }}>
          Two to four players · Browser-based · No download required
        </p>

        <button
          onClick={enter}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'; e.currentTarget.style.color = 'rgba(255,255,255,0.95)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'; e.currentTarget.style.color = 'rgba(255,255,255,0.95)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
          style={{
            height: 56, minHeight: 56, padding: '0 48px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)', background: 'transparent',
            color: 'rgba(255,255,255,0.8)', fontSize: 12, letterSpacing: 5, cursor: 'pointer',
            textTransform: 'uppercase', transition: 'all 0.2s',
          }}
        >
          Enter the Civilization
        </button>

        <a
          href="#how-it-works"
          onClick={scrollTo('how-it-works')}
          style={{
            marginTop: 28, height: 44, display: 'flex', alignItems: 'center',
            fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textDecoration: 'none',
          }}
        >
          Watch how it works ↓
        </a>
      </section>

      {/* ───────────── THE GAME ───────────── */}
      <section id="how-it-works" style={{ maxWidth: 920, margin: '0 auto', padding: '80px 24px' }}>
        <div style={sectionLabel}>The Game</div>
        <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 300, color: 'rgba(255,255,255,0.92)', margin: '0 0 24px', letterSpacing: -0.3 }}>
          Three actions per turn. That's it.
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 680, margin: '0 0 14px' }}>
          NeoTopia is a hexagonal strategy game set in the year 2055. You and up to three others build a
          consciousness civilization · placing elements, completing patterns, and scoring districts.
        </p>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 680, margin: '0 0 14px' }}>
          Each turn you choose three times: draw a project card, or move an element from a factory into
          one of three living regions. When your placed element completes a pattern matching one of your
          cards, you score that building.
        </p>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, maxWidth: 680, margin: '0 0 40px' }}>
          No luck mechanics. No randomness. Every outcome is a decision.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <MicroCard tag="PLACE" lines={['Move elements from factories into regions.', 'Build patterns. Complete districts.']} />
          <MicroCard tag="SCORE" lines={['Match your hand to the board.', 'Each completed pattern builds a named civilization project.']} />
          <MicroCard tag="BALANCE" lines={["Your worst region's score is multiplied by three.", 'You cannot ignore a failing district. Balance is civilizational law.']} />
        </div>
      </section>

      {/* ───────────── THE DIVERSE CITY RULE ───────────── */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
        <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 300, color: 'rgba(255,255,255,0.9)', margin: '0 0 18px' }}>
          The Diverse City rule.
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: 0 }}>
          You cannot build the same type of structure twice in a row in the same region. Not because it
          is arbitrary. Because a monoculture is not a civilization. Variety is not a strategy in
          NeoTopia. It is a requirement baked into the rules.
        </p>
      </section>

      {/* ───────────── THE PURPOSE ───────────── */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={sectionLabel}>The Purpose</div>
        <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 300, color: 'rgba(255,255,255,0.92)', margin: '0 0 22px', letterSpacing: -0.3 }}>
          These aren't fictional buildings.
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.9, margin: '0 0 18px', letterSpacing: 0.3 }}>
          Solar Temple · BioFarm Collective · Healing Sanctuary · Open Contact Embassy · Crystal Academy
          · Quantum Observatory.
        </p>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: '0 0 18px' }}>
          Every project card in this game is named after a real district that will exist in the physical
          NeoTopia civilization by 2055. When you score a Solar Temple, you are not earning five points.
          You are rehearsing the construction of a building that Mahil Hussain intends to see standing on
          Earth within his lifetime.
        </p>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: '0 0 32px' }}>
          NeoTopia was founded by Syed Mahil Hussain. The game is Stage 2 of a 5-stage civilization
          project. You are playing in Stage 2. Stage 5 is land.
        </p>
        <blockquote style={{
          margin: 0, padding: '20px 28px', borderLeft: '2px solid rgba(255,215,0,0.4)',
          fontSize: 'clamp(17px, 2.4vw, 22px)', fontWeight: 300, fontStyle: 'italic',
          color: 'rgba(255,255,255,0.78)', lineHeight: 1.6,
        }}>
          “The game is the rehearsal. The civilization is the goal.”
        </blockquote>
      </section>

      {/* ───────────── GLOBAL NEOTOPIA INDEX ───────────── */}
      <section style={{ maxWidth: 560, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 300, color: 'rgba(255,255,255,0.9)', margin: '0 0 28px' }}>
          Every game matters.
        </h2>
        <div style={{
          padding: '32px 28px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.02)', marginBottom: 28,
        }}>
          <div style={{ fontSize: 'clamp(40px, 8vw, 56px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.92)', letterSpacing: -1, marginBottom: 10 }}>
            {shownIndex}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>
            consciousness districts built across all NeoTopia games
          </div>
        </div>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, margin: 0 }}>
          When you score a project card, it joins a permanent global counter of every district ever built
          across every game ever played. When the land is claimed, these numbers become precedent.
        </p>
      </section>

      {/* ───────────── FINAL CTA ───────────── */}
      <section style={{
        maxWidth: 720, margin: '0 auto', padding: '80px 24px 100px', textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <h2 style={{ fontSize: 'clamp(22px, 3.6vw, 34px)', fontWeight: 200, color: 'rgba(255,255,255,0.92)', lineHeight: 1.4, margin: '0 0 40px', letterSpacing: -0.3 }}>
          The civilization began in consciousness.<br />
          Then it became code.<br />
          Now two humans can play it in real time.
        </h2>
        <button
          onClick={enter}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,215,0,0.5)'; e.currentTarget.style.color = 'rgba(255,215,0,0.92)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,215,0,0.5)'; e.currentTarget.style.color = 'rgba(255,215,0,0.92)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
          style={{
            height: 56, minHeight: 56, padding: '0 44px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 4, cursor: 'pointer',
            textTransform: 'uppercase', transition: 'all 0.2s',
          }}
        >
          Start New Civilization →
        </button>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 22, lineHeight: 1.8 }}>
          Free · Browser-based · No account required to play<br />
          Create a room · Share the code · Build together
        </p>
      </section>

      {/* ───────────── FOOTER ───────────── */}
      <footer style={{ padding: '32px 24px 48px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
          NeoTopia · Building the civilization · 2055
        </div>
        <a
          href="https://github.com/mahilh/neotopia"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '10px 16px',
            fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', letterSpacing: 0.5,
          }}
        >
          github.com/mahilh/neotopia
        </a>
      </footer>
    </main>
  )
}
