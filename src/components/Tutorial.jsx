// NeoTopia · first-turn tutorial overlay (T1 S8).
// The most important component in the project: the first playtest (Karachi · 2 players · 17 turns ·
// 0 points) reached turn 17 with an empty board because NEITHER player discovered Action B (place an
// element from a factory). The game worked; they did not know how to play it. This overlay stops the
// player before their first action and shows them, visually, the two action types — with the emphasis
// on placing an element. It shows once ever (localStorage), only on the first turn, only on your turn.

import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { getModeConfig } from '../store/gameConfig'

const KEY = 'neotopia_tutorial_v1'
// Fail SAFE: if localStorage is unavailable (private mode / blocked), treat as already seen so we never
// trap the player behind an overlay we also can't dismiss-persist.
export const tutorialSeen = () => { try { return !!localStorage.getItem(KEY) } catch { return true } }

// Steps are built per-mode (T1 S20) so the first (turn-structure) step states the live clock + draw rules:
// Flow is a short simultaneous-draw sprint, Classic a longer turn-locked game. The numbers come from
// getModeConfig — the single source for the per-mode params (gameConfig.js) — never hardcoded here, so a
// config change can't silently drift the onboarding copy (rule 32 · constants, not magic numbers).
// ── THE PLACEMENT SEQUENCE · ONE SOURCE FOR THE COPY AND FOR THE TEST THAT DRIVES IT (T1 S50) ────
// This overlay has now taught the wrong placement flow in three different ways across three
// sessions (S8's two-click version, S29's fix, S30's aim-first rewrite), and every time the copy
// was checked by READING it. So it is no longer prose: it is this list, the paragraph is rendered
// from it, and Tutorial.flow.test.jsx CLICKS `testid` in this order against a real GameRoom and
// requires each tap to advance the phase. A step that the game does not have cannot survive that,
// and neither can a step in the wrong place.
//
// WHY THE PANEL PATH AND NOT THE BOARD SHORTCUT. Clicking a previewed hex right after the factory
// does do something · it AIMS at that hex's region · and S30 rewrote this step around it. Two
// measured reasons it is the wrong thing to teach:
//   1 · IT MAKES THE READER TAP A HEX TWICE. Aim, then choose an element, then tap a hex again to
//       place. As instructions that is simply confusing, and the two taps look identical.
//   2 · ON A PHONE IT IS PARTLY BEHIND THE SHEET. In `factorySelected` the bottom sheet is OPEN,
//       because the element buttons live in it · measured at 320, 27 of 60 board cells are covered
//       in exactly that phase. So the hex the S30 copy tells a first-timer to look for may not be
//       on screen, on the device most first-timers are holding.
// The shortcut still works and is left in the product. It is discovered, not taught.
export const PLACEMENT_TAPS = [
  { testid: 'factory',     text: 'a factory token · the coloured icons between the regions' },
  { testid: 'element-btn', text: 'which element to take, in the panel' },
  { testid: 'region-btn',  text: 'which region it goes to' },
  { testid: 'hex-valid',   text: 'a highlighted hex on the board' },
]

const buildSteps = (cfg, isFlow) => [
  {
    // THIS STEP OFFERED TWO EQUAL CHOICES AND THEY ARE NOT EQUAL (fixed T1 S37 · gap 1 of
    // docs/TUTORIAL_GAP_AUDIT.md, the highest-value line in it).
    // Mahil's practice game: turn 3, HAND 7, all three regions on zero. He drew seven cards and built
    // nothing · not because he misread this, but because he did exactly what it invited, three times
    // a turn, for three turns. "Draw a card, OR move an element" reads as a preference between two
    // equivalent moves. Mechanically they are not remotely equivalent:
    //   · ONLY A PLACEMENT CAN EVER SCORE. A card in hand is inert until the board matches it, and
    //     the board only changes by placing.
    //   · and they cost wildly different effort · drawing is one click on a large illustrated card in
    //     the sidebar, placing is four clicks across the board and a panel.
    // So a new player reading "either is fine" will take the cheap one every time, and end up where
    // he ended up. The copy now says which one builds the civilization and which one only prepares
    // for it, and step 2 · the placement · is where the emphasis has always been.
    heading: 'Three actions per turn',
    body: isFlow
      ? `Each turn you take three actions. Placing an element on the board is the one that builds: only a placement can score a district. Drawing a project card from the Offer gives you something to build LATER · it scores nothing on its own. In Flow mode you have ${cfg.TURN_TIME_LIMIT} seconds per turn and every player draws at the same time.`
      : `Each turn you take three actions. Placing an element on the board is the one that builds: only a placement can score a district. Drawing a project card from the Offer gives you something to build LATER · it scores nothing on its own. You have ${cfg.TURN_TIME_LIMIT} seconds per turn.`,
    visual: null,
  },
  {
    // THIS STEP DESCRIBED A FLOW THE GAME DOES NOT HAVE (fixed T1 S29).
    // It said: click a factory, then click an empty hex. That is two clicks. Placement is four, and
    // the two it left out are where a player gets stranded · after clicking a factory, NO hex is
    // highlighted yet, so the instruction "then click any empty hex" does nothing at all. The panel is
    // asking which element and which region first, and a player who was told about two steps has no
    // reason to look there.
    // This overlay exists because a playtest reached turn 17 with an empty board (see the file header).
    // T2 S29 measured the same shape still happening in production: across 339 sessions exactly ONE
    // ever had an element placed. Verified by driving the real UI at 375px and 1280px · all four
    // controls are on screen and the loop completes, so the interaction works and only the
    // instructions for it were wrong.
    // S30 · rewritten again, around the board's aim shortcut. S50 REVERSED THAT, for two measured
    // reasons in the PLACEMENT_TAPS block above · it told the reader to tap a hex twice, and on a
    // phone the hex it points at is behind the sheet in exactly that phase. The order below is now
    // executed by a test rather than read by a reviewer.
    heading: 'To place an element',
    body: `Four taps, and the panel asks for them in this order. Only a highlighted hex will accept an element, and the line at the top of the screen always says which tap it is waiting for.`,
    taps: PLACEMENT_TAPS,
    visual: 'factory',
  },
  {
    heading: 'To score a project card',
    body: 'When the elements on the board match the dot pattern on one of your hand cards, you score that district. The pattern can be in any rotation.',
    visual: 'card',
  },
]

export default function Tutorial({ onDismiss }) {
  const [step, setStep] = useState(0)
  // Mode-aware (T1 S20): read the live mode from the store (undefined → Classic via getModeConfig's fallback).
  // Tutorial only mounts during phase 'playing' (GameRoom gate), so the mode is already seeded by then. Reading
  // a slice + a pure config accessor is consumer-only — no store mutation, no lane crossing.
  const mode = useGameStore(st => st.mode)
  const cfg = getModeConfig(mode)
  const isFlow = cfg.SIMULTANEOUS_DRAW
  const steps = buildSteps(cfg, isFlow)
  const s = steps[step]
  const isLast = step === steps.length - 1

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1') } catch {}
    onDismiss?.()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to play NeoTopia"
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: '#0d0d18', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18, padding: '32px 36px', maxWidth: 440, width: '100%',
      }}>

        {/* Step progress bars */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= step ? 'rgba(127,119,221,0.8)' : 'rgba(255,255,255,0.1)',
              transition: 'background 0.25s',
            }} />
          ))}
        </div>

        {/* Mode pacing chip (T1 S20) · always visible · Flow = gold (matches the lobby Flow toggle + FinalScore
            winner gold rgba(255,215,0)), Classic = the tutorial's purple. Numbers from getModeConfig · the draw
            line only shows when the mode actually draws simultaneously. tabular-nums on the numbers (rule 5). */}
        <div
          data-testid="tutorial-mode"
          data-mode={isFlow ? 'flow' : 'classic'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20,
            padding: '7px 12px', borderRadius: 8,
            background: isFlow ? 'rgba(255,215,0,0.07)' : 'rgba(127,119,221,0.08)',
            border: `1px solid ${isFlow ? 'rgba(255,215,0,0.32)' : 'rgba(127,119,221,0.3)'}`,
          }}
        >
          <span style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600,
            color: isFlow ? 'rgba(255,215,0,0.92)' : 'rgba(127,119,221,0.95)',
          }}>
            {cfg.label} mode
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
            {cfg.TURN_TIME_LIMIT}s per turn · {cfg.END_GAME_TILE} tiles{isFlow ? ' · draw simultaneously' : ''}
          </span>
        </div>

        <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textTransform: 'uppercase' }}>
          Step {step + 1} of {steps.length}
        </div>

        <h2 style={{ fontSize: 21, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 13, lineHeight: 1.3 }}>
          {s.heading}
        </h2>

        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginBottom: s.taps ? 14 : 26 }}>
          {s.body}
        </p>

        {/* A NUMBERED LIST, NOT A SENTENCE. Four taps written as prose is one 40-word line in which
            the order is carried by the words "then" and "and" · which is how the last three versions
            of this step managed to be wrong without looking wrong. An ordered list makes the count
            and the sequence structural, and it is what the test reads. */}
        {s.taps && (
          <ol data-testid="tutorial-taps" style={{ margin: '0 0 24px', paddingLeft: 22 }}>
            {s.taps.map(t => (
              <li key={t.testid} data-tap={t.testid} style={{
                fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, marginBottom: 6,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {t.text}
              </li>
            ))}
          </ol>
        )}

        {/* Factory → Board visual (step 2 · the action they missed). */}
        {s.visual === 'factory' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, marginBottom: 24,
            padding: '14px 18px', background: 'rgba(255,255,255,0.03)',
            borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
          }}>
           {/* A NUMBERED LIST, not a left-to-right flow (T1 S30). The interaction gained a fourth step
               and the arrow diagram stopped fitting: measured 19px outside the dialog at 320px and 57px
               of row overflow, because the dialog only offers ~200px of inner width there and four 44px
               boxes plus three arrows cannot live in it. This layout has no width it can outgrow · each
               step owns a line, the glyph carries the shape the player is looking for on the board, and
               the label says what to do with it. Re-measured at 320/360/375/414/768: zero overflow. */}
           {[
             { glyph: '⚡', label: 'Click a factory token', cls: 'tut-factory',
               style: { borderRadius: '50%', border: '2px solid rgba(226,75,74,0.7)', fontSize: 15 } },
             { glyph: '⬡', label: 'Click one of the dashed hexes it lights on the board',
               style: { borderRadius: 8, border: '2px dashed rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontSize: 15 } },
             { glyph: '●', label: 'Pick which element goes there',
               style: { borderRadius: 8, border: '1px solid rgba(200,148,64,0.5)', background: 'rgba(200,148,64,0.10)', color: 'rgba(200,148,64,0.95)', fontSize: 13 } },
             { glyph: '⬡', label: 'The hex lights up · click it to place',
               style: { borderRadius: 8, border: '1px solid rgba(127,119,221,0.6)', background: 'rgba(127,119,221,0.18)', color: 'rgba(160,152,255,0.95)', fontSize: 15 } },
           ].map((s, i) => (
             <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
               <div className={s.cls} style={{
                 width: 28, height: 28, flexShrink: 0,
                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                 ...s.style,
               }}>
                 {s.glyph}
               </div>
               <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>{s.label}</span>
             </div>
           ))}
          </div>
        )}

        {/* Card pattern visual (step 3) */}
        {s.visual === 'card' && (
          <div style={{
            marginBottom: 24, padding: '14px 18px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
            fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7,
          }}>
            The colored dots on each card show the element types you need.<br />
            Arrange them in that shape on the board, in any rotation, to score the district.
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isLast ? (
            <>
              <button
                data-testid="tutorial-skip"
                onClick={dismiss}
                style={{
                  height: 48, minHeight: 48, flex: '0 0 auto', padding: '0 20px',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9,
                  background: 'transparent', color: 'rgba(255,255,255,0.4)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                Skip
              </button>
              <button
                autoFocus
                onClick={() => setStep(n => n + 1)}
                style={{
                  height: 48, minHeight: 48, flex: 1,
                  border: '1px solid rgba(127,119,221,0.35)', borderRadius: 9,
                  background: 'rgba(127,119,221,0.1)', color: 'rgba(255,255,255,0.85)',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                Next →
              </button>
            </>
          ) : (
            <button
              autoFocus
              data-testid="tutorial-dismiss"
              onClick={dismiss}
              style={{
                height: 52, minHeight: 52, flex: 1,
                border: '1px solid rgba(127,119,221,0.4)', borderRadius: 10,
                background: 'rgba(127,119,221,0.15)',
                color: 'rgba(255,255,255,0.9)', fontSize: 13, cursor: 'pointer', letterSpacing: 1,
              }}
            >
              Start building the civilization
            </button>
          )}
        </div>
      </div>

      {/* Pulse the factory token · disabled under prefers-reduced-motion (vestibular safety). */}
      <style>{`
        .tut-factory { animation: tut-pulse 1.6s ease-in-out infinite; }
        @keyframes tut-pulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.65; transform:scale(1.12) } }
        @media (prefers-reduced-motion: reduce) { .tut-factory { animation: none } }
      `}</style>
    </div>
  )
}
