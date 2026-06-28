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
const buildSteps = (cfg, isFlow) => [
  {
    heading: 'Three actions per turn',
    body: isFlow
      ? `Each turn you choose three times: draw a project card from the Offer, or move an element from a factory onto the board. In Flow mode the clock is just ${cfg.TURN_TIME_LIMIT} seconds per turn and every player draws at the same time.`
      : `Each turn you choose three times. You can draw a project card from the Offer, or move an element from a factory onto the board. You have ${cfg.TURN_TIME_LIMIT} seconds per turn.`,
    visual: null,
  },
  {
    heading: 'To place an element',
    body: 'Click any factory token (the colored icons between the regions). An element leaves the factory. Then click any empty hex in the adjacent region to place it there.',
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

        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginBottom: 26 }}>
          {s.body}
        </p>

        {/* Factory → Board visual (step 2 · the action they missed) */}
        {s.visual === 'factory' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
            padding: '14px 18px', background: 'rgba(255,255,255,0.03)',
            borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div className="tut-factory" style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              border: '2px solid rgba(226,75,74,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
              ⚡
            </div>
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>→</div>
            <div style={{
              width: 48, height: 48, flexShrink: 0, background: 'rgba(127,119,221,0.12)',
              borderRadius: 10, border: '1px solid rgba(127,119,221,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: 'rgba(127,119,221,0.85)', textAlign: 'center', lineHeight: 1.3,
            }}>
              hex<br />on<br />board
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
              Factory token → place on any adjacent region
            </p>
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
