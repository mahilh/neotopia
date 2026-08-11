// NeoTopia · the civilization's front door (route '/').
// Copy DIVERGED from docs/NEOTOPIA_LANDING_PAGE.md in T1 S27 (language grounding): the doc is now the
// older wording. Where they disagree, this file is what ships and the doc needs updating, not this.
// The setting and register are unchanged · what left was the metaphysical vocabulary a first-time
// player could not parse ("consciousness civilization", "when the land is claimed ... precedent").
// Copy was previously the canonical wording from docs/NEOTOPIA_LANDING_PAGE.md · every line passes the
// Civilization Narrative Coherence test (Dimension 35): it would stand on a placard in a real
// NeoTopia district. Voice rules honored: no exclamation marks · '·' never em dashes · civilization
// first, game second. The Global Index counter is the REAL aggregate (getGlobalIndex · same source
// as the FinalScore record), seed-fallback so it never shows a broken number.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGlobalIndex } from '../lib/supabase'

const GLOBAL_INDEX_BASE = 147823 // fallback only · getGlobalIndex already folds the seed in.

// Card-art design progress (T1 S20) · counted at BUILD time, NO server call. import.meta.glob resolves the
// existing /public/art/cards/card_NN.png files into the bundle (verified empirically against the real Vite 8
// build · public globs DO match · Object.keys reads only the matched PATHS, so the non-eager glob never
// imports or bundles the PNGs themselves). The deck is 56 cards (projectCards.js · the fixed denominator);
// the numerator climbs on its own as real illustrations land in public/art/cards/ — no code change needed.
const DESIGNED_DISTRICTS = Object.keys(import.meta.glob('/public/art/cards/card_*.png')).length
const TOTAL_DISTRICTS = 56

const BG = '#0a0a0f'

// NE·OT·OP·IA · two letters per element, in board order. Mahil's colours, and they are NOT the raw
// ELEMENT_COLORS from hexUtils: energy is #CC5522 here rather than the board's #E24B4A, because the
// wordmark sits on #0a0a0f at 52px where the board's red is louder than the other three. Kept as an
// explicit table for that reason · importing the board palette would silently "fix" a deliberate
// choice the next time somebody tidies (Rule 45: a second contract, stated as one).
//
// ONE COLOUR DEVIATES FROM THE BRIEF, AND IT IS MEASURED RATHER THAN PREFERRED. Against #0a0a0f:
//     NE #CC5522  4.60:1  AA        OT #1D9E75  5.83:1  AA        OP #7F77DD  5.25:1  AA
//     IA #2244AA  2.33:1  FAIL      · below AA (4.5) and below AA-LARGE (3.0) as well
// Three of the four were chosen well and the fourth is unreadable · at 52px it is a dark blue on a
// near-black field, so the word would end in two letters a low-vision reader loses entirely.
// #376DFF is the SAME HUE lifted 1.605x, the smallest multiple that clears 4.5:1, measured at
// 4.51:1. Hue and saturation are untouched; only lightness moves, and only as far as it must.
// Flagged to Mahil rather than done quietly: if the darker blue is wanted for brand reasons, the
// honest fallback is #2952CE at 3.01:1, which is legal for large text only and would forbid ever
// using this wordmark at body size.
const WORDMARK = [
  ['NE', '#CC5522'], // energy
  ['OT', '#1D9E75'], // biofarming
  ['OP', '#7F77DD'], // technology
  ['IA', '#376DFF'], // community · brief said #2244AA (2.33:1) · lifted to clear AA. See above.
]
const sectionLabel = {
  fontSize: 12, letterSpacing: 4, color: 'rgba(255,255,255,0.5)', // WCAG AA (~5.3:1 on #0a0a0f) · 12px min (UX scan)
  textTransform: 'uppercase', marginBottom: 16,
}

function MicroCard({ tag, lines }) {
  return (
    <div style={{
      flex: '1 1 220px', maxWidth: 300, padding: '24px 22px', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ fontSize: 12, letterSpacing: 4, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
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
        {/* ── THE WORDMARK IS THE GAME (T1 S45) ─────────────────────────────────────────────────
            Eight letters, four elements, two each · NE energy, OT biofarming, OP technology, IA
            community. The same four colours the board is played in, so the name teaches the palette
            before the tutorial has to. Font and tracking are UNCHANGED on Mahil's instruction and he
            is right; this is colour only.
            AND IT WAS A SUBTITLE OF ITS OWN DATE. NEOTOPIA rendered at 13px against a 56px tagline ·
            one pixel larger than the kicker above it. A brand that is smaller than every other
            element on its own hero is not a brand, it is a caption. It leads now, and the "2055"
            kicker is gone rather than repeated: it appeared here AND in the headline one line below,
            and the headline is the one that earns it. */}
        <div
          data-testid="wordmark"
          aria-label="NeoTopia"
          style={{
            fontSize: 'clamp(28px, 6vw, 52px)', letterSpacing: 10, marginBottom: 26,
            fontWeight: 300, display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
          }}
        >
          {WORDMARK.map(([pair, color], i) => (
            <span key={i} style={{ color }} data-wordmark-pair={pair}>{pair}</span>
          ))}
        </div>
        <h1 style={{
          fontSize: 'clamp(22px, 4vw, 40px)', fontWeight: 200, letterSpacing: -0.5,
          color: 'rgba(255,255,255,0.95)', lineHeight: 1.2, maxWidth: 780, margin: '0 0 20px',
        }}>
          Your weakest district decides whether your world survives.
        </h1>
        {/* Replaces "Pure strategy · No dice", which described the game by what it LACKS · nobody
            ever wanted a game because it had no dice. The positive form of that claim already
            existed on this page, buried at 16px far below the fold: "No luck mechanics. No
            randomness. Every outcome is a decision." This is its promotion.
            "city" -> "world" throughout · NeoTopia means new land, and the game is three regions
            rather than one city.
            DELETED HERE: "Two to four players · Browser-based · No download required". Six
            comma-separated claims sat between the hero and the first button, and the lobby already
            carries the equivalent at the moment it is actually needed. */}
        <p style={{ fontSize: 'clamp(13px, 2vw, 17px)', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, maxWidth: 560, lineHeight: 1.7, margin: '0 0 44px' }}>
          Three regions. Four elements. Neglect nothing.
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

        {/* PRACTICE (T1 S32) · the second door, and on this page specifically because the landing page
            is the ONE screen that never signs anybody in (measured by T2 S30). A visitor who wants to
            see the board before committing to anything can do it from here without an identity being
            minted, which is the shape Mahil's zero-sign-in constraint asks for. It is also the only
            path in the product for somebody who arrives ALONE · every other route ends at a Start
            button that needs a second connected human. */}
        <button
          data-testid="landing-practice"
          onClick={() => navigate('/practice?bots=0')}
          style={{
            marginTop: 16, height: 48, minHeight: 48, padding: '0 30px', borderRadius: 10,
            border: '1px solid rgba(200,148,64,0.4)', background: 'rgba(200,148,64,0.1)',
            color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 3, cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Practice alone
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
          world · placing elements, completing patterns, and scoring districts.
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
          <MicroCard tag="BALANCE" lines={["Your worst region's score is multiplied by three.", 'You cannot ignore a failing district. Balance is not optional.']} />
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
          Solar farms · seed archives · healing centres · research domes · water towers · community
          halls.
        </p>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: '0 0 18px' }}>
          Every project card in this game is named after a real district that will exist in the physical
          NeoTopia world by 2055. When you score a Solar Temple, you are not earning five points. You are
          rehearsing the construction of a building that Mahil intends to see standing on Earth within
          his lifetime.
        </p>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: '0 0 32px' }}>
          NeoTopia was founded by Mahil. Building it takes five stages · this game is the second one.
          The last stage is real land, really bought and really built on.
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
            districts built across all NeoTopia games
          </div>
        </div>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, margin: 0 }}>
          When you score a project card, it joins a permanent global counter of every district ever built
          across every game ever played. When the real world breaks ground, this is the record of everyone
          who helped design it.
        </p>
      </section>

      {/* ───────────── FINAL CTA ───────────── */}
      <section style={{
        maxWidth: 720, margin: '0 auto', padding: '80px 24px 100px', textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <h2 style={{ fontSize: 'clamp(22px, 3.6vw, 34px)', fontWeight: 200, color: 'rgba(255,255,255,0.92)', lineHeight: 1.4, margin: '0 0 40px', letterSpacing: -0.3 }}>
          The civilization began as an idea.<br />
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
        {/* Civilization design progress (T1 S20) · how many of the 56 district illustrations actually exist,
            counted at build time from public/art/cards (DESIGNED_DISTRICTS · no server call). Quiet by design
            and honest at 0 — the card art is the civilization's face, and this tracks it toward 56. The gold
            fill matches the landing's accent (blockquote / final-CTA gold rgba(255,215,0)). */}
        <div style={{ maxWidth: 300, margin: '0 auto 22px' }}>
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 11 }}>
            <div style={{
              height: '100%', width: `${(DESIGNED_DISTRICTS / TOTAL_DISTRICTS) * 100}%`,
              background: 'rgba(255,215,0,0.5)', borderRadius: 2, transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{ fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{DESIGNED_DISTRICTS}</span> of {TOTAL_DISTRICTS} civilization districts have been designed
          </div>
        </div>
        <div style={{ fontSize: 12, letterSpacing: 3, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
          NeoTopia · Building the civilization · 2055
        </div>
        <a
          href="https://github.com/mahilh/neotopia"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '10px 16px',
            fontSize: 12, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', letterSpacing: 0.5,
          }}
        >
          github.com/mahilh/neotopia
        </a>
      </footer>
    </main>
  )
}
