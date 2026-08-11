// NeoTopia · THE FRONT DOOR SHOWS THE GAME PLAYING ITSELF (T1 S48).
//
// This replaces three cards of prose that DESCRIBED the loop with a looping board that PERFORMS it.
// The principle is not new to this product · an outside auditor called the dashed-hex affordance on
// the play board "the mechanic teaching itself", and this is that idea moved to the front door.
//
// ── THE ENGINE IS THE SOURCE, NOT A SCRIPT OF IT ─────────────────────────────────────────────────
// Every claim this section makes on screen is COMPUTED by the same code the game runs:
//     the pattern completes  ->  patternMatcher.findBuildableCards, on a real hexes map
//     the district's name    ->  projectCards.PROJECT_CARDS (card_21 · Solarpunk Atrium)
//     its point value        ->  that card's own `points`
//     the final-score line   ->  patternMatcher.calculateFinalScore
//     the board's geometry   ->  hexUtils.hexToPixel / hexCorners / hexesInRadius / REGIONS
//     the token art          ->  Board/ElementIcon.elementIconShapes · the SAME glyphs the game draws
// Nothing here re-states a rule in its own words, so the landing page cannot drift away from the
// product the way a paragraph can (Rule 45 · one contract). If the scoring formula ever gains a term,
// the number on the front door moves with it and HowItWorksDemo.test.jsx says so.
//
// AND IT REFUSES TO PERFORM A LIE. buildDemoMatch() asks the real matcher whether the placement it is
// about to animate actually completes the card. If the matcher says no · a pattern edit, a rotation
// change, a seed that drifted · `ok` is false and the component renders NOTHING, leaving the prose
// beneath as the whole explanation. A demo whose engine disagrees with it must go dark rather than
// resolve to a plausible frame (Rule 80: a counter that cannot measure must say so).
//
// ── WHY INTERSECTIONOBSERVER IS THE MECHANISM AND NOT AN OPTIMISATION ────────────────────────────
// The brief's hardest constraint is "it must teach in the first FIVE seconds, not the twentieth".
// An autoplaying loop CANNOT satisfy that by construction: a visitor scrolling to this section at a
// random moment arrives at a random beat, and a viewer who meets beat 3 first learns nothing. So the
// loop starts · and RESTARTS at beat 0 · when the section enters the viewport, which is the only way
// to guarantee that the first thing anybody sees is the first beat. Keeping timers off the CPU while
// the section is off-screen is a side benefit, not the reason.
//
// ── PREFERS-REDUCED-MOTION IS NOT OPTIONAL ON A SECTION WHOSE JOB IS EXPLANATION ─────────────────
// Under `reduce` the timeline never starts and the stage renders the FINAL COMPOSITE instead of a
// blank: the completed district, its name and points, the region score already advanced, and the
// balance panel. Everything a viewer would have learned in twelve seconds, in one still frame. The
// prose below is the second half of that fallback and is why it stays.
//
// THE CAPTION IS DELIBERATELY NOT A LIVE REGION. An aria-live caption that rewrites itself every
// ~2.5s interrupts a screen reader four times per loop, forever. The <svg> carries one static
// role="img" description of the whole sequence and the prose beneath carries the detail.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  hexToPixel, hexCorners, hexesInRadius, HEX_SIZE, ELEMENT_COLORS, REGIONS, TERRAIN, FACTORIES,
} from '../utils/hexUtils'
import { findBuildableCards, calculateFinalScore } from '../lib/patternMatcher'
import { PROJECT_CARDS } from '../lib/projectCards'
import { elementIconShapes } from './Board/ElementIcon'

// ── THE DEMO'S INPUTS ────────────────────────────────────────────────────────────────────────────
// card_21 · Solarpunk Atrium · pattern (0,0) energy + (0,1) biofarming + (1,0) community.
// Chosen for three reasons and they are all teaching reasons: THREE DIFFERENT ELEMENTS (so the shape
// and the composition both matter, which a single-element card hides), a tight triangle (legible at
// landing-page scale), and a name that sounds like somewhere a person could stand.
export const DEMO_CARD_ID = 'card_21'
export const DEMO_REGION_ID = 0 // Sacred City · the region the camera sits on

// The board a visitor arrives to: PARTLY BUILT, with the gap already visible. Beat 1 is ONE token
// moving, not three, because the eye can follow one thing in two seconds and cannot follow three.
// The extra tokens are texture · they exist so the region reads as a place somebody has been playing
// in, and the test asserts they do not accidentally complete anything (see the "before" counterweight).
export const DEMO_SEED = {
  '0,0':  { element: 'energy',     placedBy: 0 },
  '0,1':  { element: 'biofarming', placedBy: 0 },
  '-1,0': { element: 'technology', placedBy: 1 },
  '-1,2': { element: 'community',  placedBy: 1 },
  '1,-2': { element: 'energy',     placedBy: 1 },
  '2,-1': { element: 'biofarming', placedBy: 0 },
}
// The move the demo performs · the third element of the Atrium.
export const DEMO_PLACE = { q: 1, r: 0, type: 'community', placedBy: 0 }
export const DEMO_PLACE_KEY = `${DEMO_PLACE.q},${DEMO_PLACE.r}`
// What the factory is holding. The placed type must be among them or the sentence "move an element
// FROM A FACTORY" is not true of anything on screen · asserted in the test rather than trusted.
export const FACTORY_STOCK = ['community', 'energy', 'technology']

export const DEMO_CARD = PROJECT_CARDS.find(c => c.id === DEMO_CARD_ID)

// Sacred City's score BEFORE the placement. The after-value is DERIVED from the card's own points
// rather than typed, so the chip cannot tick to a number the engine disagrees with (Rule 81 · compute
// the constraint, do not reason it).
export const DEMO_REGION_BEFORE = 4
export const DEMO_REGION_AFTER = DEMO_REGION_BEFORE + (DEMO_CARD?.points ?? 0)

// The three regional scores beat 4 argues about, in region-id order. Sacred City's is the value beat 3
// just ticked to · the four beats are one continuous game, not four unrelated illustrations.
// Free Energy is deliberately the WORST: at 4 points it contributes 12 of the 28, so the tripling is
// visible as arithmetic rather than asserted as a rule.
export const DEMO_SCORES = [DEMO_REGION_AFTER, 9, 4]

// ── THE TIMELINE ─────────────────────────────────────────────────────────────────────────────────
// `at` is a PREFIX SUM, never typed, so the five-second claim below is arithmetic on this table and
// not a comment somebody has to maintain.
export const BEATS = [
  { id: 'place',   ms: 2200, caption: 'Move an element from a factory into a region.' },
  { id: 'score',   ms: 2800, caption: 'Three elements complete a pattern. The district is built.' },
  { id: 'advance', ms: 2600, caption: 'That region’s score advances.' },
  { id: 'balance', ms: 4600, caption: 'Your worst region is multiplied by three.' },
]
export const BEAT_STARTS = BEATS.reduce((acc, b, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + BEATS[i - 1].ms)
  return acc
}, [])
export const LOOP_MS = BEATS.reduce((n, b) => n + b.ms, 0)

// THE CONSTRAINT, AS A NUMBER RATHER THAN AN INTENTION: place + score must both be finished inside
// five seconds, so a visitor who looks away after five has still seen the whole core loop. The test
// computes BEAT_STARTS[2] from the table above and fails if anybody lengthens the first two beats.
export const TEACH_BY_MS = 5000

/**
 * Ask the REAL matcher whether a move actually builds the card it names.
 *
 * Returns { ok, card, match, hexesBefore, hexesAfter, matchedKeys, reason }. `ok` is false · and the
 * component renders nothing at all · when either half of the claim fails:
 *   the BEFORE board must NOT already complete the card (else beat 1 is theatre · the pattern would
 *     already have been there and the token would be decoration), and
 *   the AFTER board must complete it, THROUGH the placed hex (else beat 2 is a lie).
 * Both are checked here rather than only in the test, because a test protects the repo and this
 * protects the visitor.
 *
 * PARAMETERISED so the refusal branches can be driven with a deliberately broken board. A guard
 * whose failure path cannot be exercised is a guard nobody has seen work (Rule 86).
 */
export function evaluateDemo({ card, seed, place } = {}) {
  if (!card) return { ok: false, reason: 'no such card in the deck' }
  if (!seed || !place) return { ok: false, reason: 'no board to evaluate' }

  const placeKey = `${place.q},${place.r}`
  const hexesBefore = { ...seed }
  const hexesAfter = {
    ...hexesBefore,
    [placeKey]: { element: place.type, placedBy: place.placedBy },
  }

  // No lastPlacedKey: "is this card ALREADY complete anywhere on the seed board?"
  const already = findBuildableCards(hexesBefore, [card], null)
  if (already.length > 0) return { ok: false, reason: 'the seed board already completes the card' }

  // With lastPlacedKey: only a pattern THROUGH the just-placed hex counts · the game's own rule.
  const match = findBuildableCards(hexesAfter, [card], null, placeKey)[0]
  if (!match) return { ok: false, reason: 'the placement does not complete the card' }

  return {
    ok: true,
    card,
    match,
    hexesBefore,
    hexesAfter,
    placeKey,
    matchedKeys: match.matchedHexKeys,
    reason: null,
  }
}

/** evaluateDemo bound to the constants this section actually animates. */
export function buildDemoMatch() {
  return evaluateDemo({ card: DEMO_CARD, seed: DEMO_SEED, place: DEMO_PLACE })
}

/** The final-score line, computed by the engine. Exported so the prose fallback shows the same one. */
export function demoFinalScore() {
  const sorted = [...DEMO_SCORES].sort((a, b) => b - a)
  const [best, second, worst] = sorted
  return {
    best,
    second,
    worst,
    total: calculateFinalScore(DEMO_SCORES),
    // The operation as WRITTEN on screen. The test asserts this arithmetic equals the engine's answer,
    // so the day calculateFinalScore gains a default term, the front door stops agreeing with itself
    // and says so instead of quietly showing two-thirds of a formula (Rule 97 · a citation outlives
    // the thing it cites).
    written: best + second + worst * 3,
  }
}

function prefersReducedMotion() {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
}

// ── GEOMETRY ─────────────────────────────────────────────────────────────────────────────────────
const REGION = REGIONS.find(r => r.id === DEMO_REGION_ID)
const FACTORY = FACTORIES.find(f => f.betweenRegions.includes(DEMO_REGION_ID))
const CELLS = hexesInRadius(REGION.cq, REGION.cr, REGION.radius)
const KEY = (q, r) => `${q},${r}`
const PT = (q, r) => hexToPixel(q, r, HEX_SIZE)
const POLY = (q, r, scale = 1) =>
  hexCorners(PT(q, r).x, PT(q, r).y, HEX_SIZE * scale).map(c => `${c.x},${c.y}`).join(' ')

// The viewBox is DERIVED from the cells actually drawn plus the factory · so a change to REGIONS or
// HEX_SIZE reframes the camera instead of cropping the board (Rule 81).
//
// THE TWO TEXT LAYERS LIVE OUTSIDE THE SVG, AND THAT IS THE FIX FOR A DEFECT THE DOM COULD NOT SEE.
// The first build drew the district name and the score pill INSIDE the viewBox, and both landed on
// the hexes · "Solarpunk Atrium" printed straight across the three gold-ringed cells it was naming,
// and the score pill collided with the balance formula. Every measurement I had (clipping,
// reachability, viewport containment) was green, because none of them asks whether two things are
// drawn in the same place. Only the render said so (Rule 55).
// Reserving bands INSIDE the frame fixed the overlap and created a second problem: it took the
// frame to 406.8 x 423.4, and an almost-square viewBox under `meet` with a max-height letterboxes ·
// the board rendered ~404 wide inside an 870 box, with the border drawn around mostly nothing. (It
// also invalidated my own hexPx figures, which divided rendered width by viewBox width · under
// `meet` the scale is min(w/vbW, h/vbH), so those numbers were answering a different question.
// Rule 92: both sides of a comparison have to be the same quantity.)
// So the bands are DOM siblings now: the SVG frames the board and nothing else, and two HTML strips
// sit above and below it. Overlap becomes impossible by construction rather than by arithmetic, the
// text is real text, and the frame goes to a 1.32:1 landscape that fills its box.
const HEX_HALF_H = HEX_SIZE * Math.sqrt(3) / 2 // flat-top: the vertical half-extent of a cell
export const VIEW = (() => {
  const pts = [...CELLS.map(c => PT(c.q, c.r)), PT(FACTORY.q, FACTORY.r)]
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  const minX = Math.min(...xs) - HEX_SIZE * 1.15, maxX = Math.max(...xs) + HEX_SIZE * 1.15
  const minY = Math.min(...ys) - HEX_HALF_H * 1.12, maxY = Math.max(...ys) + HEX_HALF_H * 1.12
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
})()
// Capped so the near-square-to-landscape frame renders at its natural aspect instead of being
// letterboxed inside a full-width box. At 620 a hex is ~110px across.
export const STAGE_MAX_W = 620

// The product's reward colour · score flash, milestone, cluster points, and TOPIA in the wordmark.
// EXPORTED so the BALANCE panel on the landing page uses this one rather than declaring its own
// (Rule 45: two constants with the same value are two contracts, and they drift on the day somebody
// tunes one of them).
export const GOLD = '#C89440'

export default function HowItWorksDemo() {
  const demo = useMemo(buildDemoMatch, [])
  const score = useMemo(demoFinalScore, [])
  const rootRef = useRef(null)
  const timerRef = useRef(null)
  const [beat, setBeat] = useState(0)
  const [running, setRunning] = useState(false)
  const [reduced, setReduced] = useState(prefersReducedMotion)

  // Track the setting live · someone who turns reduced-motion on should not have to reload.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq?.addEventListener) return
    const onChange = e => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Run only while on screen · see the header for why this is the mechanism and not a saving.
  // No IntersectionObserver (very old browsers, and jsdom) falls back to always-running, which is the
  // degraded-but-correct answer: the animation plays, it just cannot guarantee you saw beat 1 first.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setRunning(true); return }
    const io = new IntersectionObserver(
      entries => { for (const e of entries) setRunning(e.isIntersecting) },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // THE TIMELINE. Deps are two BOOLEANS and nothing else · Rule 76: a setTimeout inside an effect is
  // cancelled by its own cleanup every time a dep identity churns, and this page re-renders when the
  // Global Index resolves. A callback or an object in here would silently kill every beat after the
  // first, with nothing in the console.
  useEffect(() => {
    if (!running || reduced) return
    setBeat(0) // ALWAYS restart at beat 0 · the five-second claim depends on it
    let i = 0
    const tick = () => {
      i = (i + 1) % BEATS.length
      setBeat(i)
      timerRef.current = setTimeout(tick, BEATS[i].ms)
    }
    timerRef.current = setTimeout(tick, BEATS[0].ms)
    return () => clearTimeout(timerRef.current)
  }, [running, reduced])

  // A demo that cannot prove its own claim does not get to make it.
  if (!demo.ok) return null

  // Under reduced motion the stage renders the FINAL COMPOSITE · every layer at once, no timeline.
  const phase = reduced ? 'balance' : BEATS[beat].id
  // The token is mounted in every beat; during `place` it animates in from the factory, so the dashed
  // target is the thing that is conditional, not the token.
  const landed = reduced || phase !== 'place'
  const showMatch = reduced || phase !== 'place'
  // THE CHIP AND THE BALANCE PANEL ARE MUTUALLY EXCLUSIVE, and that is a fix rather than a
  // preference: the panel already carries Sacred City's 7, so drawing "4 -> 7" underneath it was a
  // second rendering of the same number in the same place (measured: the two collided and neither
  // was readable). Beat 3 owns the transition, beat 4 owns the comparison.
  const showChip = reduced || phase === 'advance'
  // AND THE OVERLAY DOES NOT RUN UNDER REDUCED MOTION AT ALL. The brief's fallback is the prose, and
  // the page's own BALANCE panel below this section renders the SAME demoFinalScore() numbers · so a
  // reduced-motion visitor gets the completed board and the score transition here, and the formula
  // as text there, with nothing stacked on anything.
  const showBalance = !reduced && phase === 'balance'

  const target = PT(DEMO_PLACE.q, DEMO_PLACE.r)
  const from = PT(FACTORY.q, FACTORY.r)
  const matched = new Set(demo.matchedKeys)
  const terrain = TERRAIN[REGION.terrain]

  return (
    <div
      ref={rootRef}
      data-testid="hiw-demo"
      data-beat={phase}
      data-reduced={reduced ? 'true' : 'false'}
      style={{ margin: '0 0 34px' }}
    >
      <div style={{
        position: 'relative', maxWidth: STAGE_MAX_W, margin: '0 auto',
        borderRadius: 18, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)',
        padding: '10px 0 12px',
      }}>
        {/* TOP BAND · the district. Reserved height so nothing jumps when it appears in beat 2. */}
        <div className="hiw-band" data-band="top" style={{ minHeight: 46 }}>
          {showMatch && (
            <div data-testid="hiw-district" className={reduced ? undefined : 'hiw-rise'} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(15px, 2.2vw, 19px)', fontWeight: 500, color: GOLD, letterSpacing: 0.2 }}>
                {demo.card.name}
              </div>
              <div style={{ fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>
                {`+${demo.card.points} points`}
              </div>
            </div>
          )}
        </div>

        <svg
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={
            'A NeoTopia region. An element moves from a factory onto the board, completing the '
            + `${demo.card.name} pattern for ${demo.card.points} points. The region score rises from `
            + `${DEMO_REGION_BEFORE} to ${DEMO_REGION_AFTER}, and the final score triples the weakest `
            + `of the three regions: ${score.best} + ${score.second} + (${score.worst} times 3) = ${score.total}.`
          }
          style={{
            display: 'block', width: '100%', height: 'auto',
            opacity: showBalance ? 0.55 : 1, transition: reduced ? 'none' : 'opacity 0.5s ease',
          }}
        >
          {/* the region's ground · the same terrain wash the play board uses */}
          <circle
            cx={PT(REGION.cq, REGION.cr).x} cy={PT(REGION.cq, REGION.cr).y}
            r={HEX_SIZE * 3.6} fill={`rgba(${terrain.wash},0.5)`}
          />

          {/* empty cells */}
          {CELLS.map(c => {
            const k = KEY(c.q, c.r)
            if (demo.hexesAfter[k]) return null
            return (
              <polygon
                key={k} points={POLY(c.q, c.r, 0.94)}
                fill={terrain.fill} stroke="rgba(255,255,255,0.09)" strokeWidth="1"
              />
            )
          })}

          {/* THE TARGET AFFORDANCE · the dashed outline that an auditor called "the mechanic teaching
              itself". It is the reason beat 1 reads in under two seconds: the eye is told where to
              look before anything moves. */}
          {!landed && (
            <polygon
              data-testid="hiw-target"
              points={POLY(DEMO_PLACE.q, DEMO_PLACE.r, 0.94)}
              fill={`${ELEMENT_COLORS[DEMO_PLACE.type]}18`}
              stroke={ELEMENT_COLORS[DEMO_PLACE.type]} strokeWidth="2.5" strokeDasharray="7 6"
              className={reduced ? undefined : 'hiw-dashed'}
            />
          )}

          {/* seeded tokens */}
          {Object.entries(demo.hexesBefore).map(([k, h]) => {
            const [q, r] = k.split(',').map(Number)
            const p = PT(q, r)
            const isMatch = showMatch && matched.has(k)
            return (
              <g key={k}>
                <polygon
                  points={POLY(q, r, 0.94)}
                  fill={`${ELEMENT_COLORS[h.element]}22`}
                  stroke={isMatch ? GOLD : 'rgba(255,255,255,0.12)'}
                  strokeWidth={isMatch ? 3 : 1}
                  className={isMatch && !reduced ? 'hiw-matched' : undefined}
                />
                <g transform={`translate(${p.x} ${p.y})`}>
                  {elementIconShapes(h.element, ELEMENT_COLORS[h.element], HEX_SIZE)}
                </g>
              </g>
            )
          })}

          {/* THE FACTORY, WITH STOCK IN IT. The first build drew an empty outline under the word
              FACTORY while the caption said "move an element from a factory" · so the one noun the
              sentence depends on was visibly empty. It holds the three element types the demo's
              region can still take, and the community disc is the one that leaves. */}
          <g transform={`translate(${from.x} ${from.y})`}>
            <polygon
              points={hexCorners(0, 0, HEX_SIZE * 0.86).map(c => `${c.x},${c.y}`).join(' ')}
              fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"
            />
            {FACTORY_STOCK.map((type, i) => {
              const a = (Math.PI * 2 * i) / FACTORY_STOCK.length - Math.PI / 2
              const spent = !landed ? false : type === DEMO_PLACE.type // it left the factory
              return (
                <g key={type} transform={`translate(${Math.cos(a) * HEX_SIZE * 0.36} ${Math.sin(a) * HEX_SIZE * 0.36})`} opacity={spent ? 0.22 : 1}>
                  <circle r={HEX_SIZE * 0.19} fill={ELEMENT_COLORS[type]} fillOpacity="0.9" />
                </g>
              )
            })}
            <text
              x="0" y={HEX_SIZE * 1.42} textAnchor="middle"
              fill="rgba(255,255,255,0.55)" fontSize={HEX_SIZE * 0.4} letterSpacing="2"
            >FACTORY</text>
          </g>

          {/* THE TRAVELLING TOKEN. Positioned by the SVG transform ATTRIBUTE on the outer <g>; the
              inner <g> carries the CSS animation, because a CSS transform would otherwise override
              the attribute and the token would animate from the viewBox origin. transform-box:
              fill-box is set in index.css for the same reason .hex-element-in sets it. */}
          <g transform={`translate(${target.x} ${target.y})`}>
              <g
                data-testid="hiw-token"
                className={!reduced && phase === 'place' ? 'hiw-travel' : undefined}
                style={{ '--hiw-dx': `${from.x - target.x}px`, '--hiw-dy': `${from.y - target.y}px` }}
              >
                <polygon
                  points={hexCorners(0, 0, HEX_SIZE * 0.94).map(c => `${c.x},${c.y}`).join(' ')}
                  fill={`${ELEMENT_COLORS[DEMO_PLACE.type]}22`}
                  stroke={showMatch ? GOLD : 'rgba(255,255,255,0.12)'}
                  strokeWidth={showMatch ? 3 : 1}
                  className={showMatch && !reduced ? 'hiw-matched' : undefined}
                />
                {elementIconShapes(DEMO_PLACE.type, ELEMENT_COLORS[DEMO_PLACE.type], HEX_SIZE)}
              </g>
          </g>

        </svg>

        {/* BOTTOM BAND · the region score. Reserved height for the same reason as the top. */}
        <div className="hiw-band" data-band="bottom" style={{ minHeight: 36 }}>
          {showChip && (
            <div
              data-testid="hiw-region-score"
              className={reduced ? undefined : 'hiw-rise'}
              style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 8,
                padding: '5px 16px', borderRadius: 999,
                border: `1px solid ${GOLD}`, background: 'rgba(10,10,15,0.88)',
                fontSize: 14, color: 'rgba(255,255,255,0.92)', fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.65)' }}>{REGION.name}</span>
              <span>{DEMO_REGION_BEFORE} →</span>
              <span style={{ color: GOLD, fontWeight: 600, fontSize: 17 }}>{DEMO_REGION_AFTER}</span>
            </div>
          )}
        </div>

        {/* ── BEAT 4 · THE BALANCE ARGUMENT ─────────────────────────────────────────────────────
            HTML rather than SVG text: it is the one part of this section a person may want to
            select, zoom or have read to them, and it is arithmetic rather than geometry. */}
        {showBalance && (
          <div
            data-testid="hiw-balance"
            className={reduced ? undefined : 'hiw-rise'}
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 18, padding: 20, textAlign: 'center',
              // A SCRIM, not per-chip backgrounds. The first version gave each chip a 3%-white fill
              // and the board's own tokens read straight through the numbers · a "7" with a purple
              // technology disc behind it. One opaque layer for the whole panel is both cleaner and
              // one contrast question instead of six.
              background: 'rgba(10,10,15,0.82)',
            }}
          >
            {/* THREE CARDS ON A LAPTOP, THREE ROWS ON A PHONE · and that is a fix, not a flourish.
                MEASURED at 320 before it: the three cards wrapped to THREE ROWS and the panel wanted
                359px inside a 222px stage, so 59px came off the top and 77px off the bottom · the
                formula, which is the entire point of this beat, was clipped out of the box on the
                smallest screen while every jsdom test stayed green. Rule 83: reduce demand rather
                than arbitrate the remainder. The layout switch is in index.css (.hiw-chips). */}
            <div className="hiw-chips" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {REGIONS.map(r => {
                const v = DEMO_SCORES[r.id]
                const worst = v === score.worst
                return (
                  <div
                    key={r.id}
                    className="hiw-chip"
                    data-testid={`hiw-region-${r.id}`}
                    data-worst={worst ? 'true' : 'false'}
                    style={{
                      minWidth: 92, padding: '10px 14px', borderRadius: 12,
                      border: `1px solid ${worst ? GOLD : 'rgba(255,255,255,0.14)'}`,
                      background: worst ? 'rgba(200,148,64,0.12)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>
                      {r.name}
                    </div>
                    <div className="hiw-chip-val" style={{
                      fontSize: 26, fontWeight: 300, marginTop: 2,
                      color: worst ? GOLD : 'rgba(255,255,255,0.92)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{v}</div>
                  </div>
                )
              })}
            </div>

            {/* THE FORMULA AS AN OPERATION, NOT A RESULT · the brief's words, and the reason the
                multiplication is a separate emphasised token rather than a sentence about it. */}
            <div
              data-testid="hiw-formula"
              style={{
                fontSize: 'clamp(15px, 2.6vw, 22px)', fontWeight: 300, letterSpacing: 1,
                color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums',
              }}
            >
              {score.best} + {score.second} +{' '}
              <span style={{ color: GOLD, fontWeight: 500 }}>({score.worst} &times; 3)</span>
              {' = '}
              <span data-testid="hiw-total" style={{ color: GOLD, fontWeight: 500 }}>{score.total}</span>
            </div>
            {/* HIDDEN BELOW 480 (index.css) · it is a second rendering of what the caption under the
                stage already says, and on a phone that duplication is what pushed the formula out of
                the box. The information survives; the second copy of it does not (Rule 83). */}
            <div className="hiw-sub" style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', maxWidth: 420, lineHeight: 1.6 }}>
              Your weakest region decides the game. {score.worst} points became{' '}
              {score.worst * 3} of the {score.total}.
            </div>
          </div>
        )}
      </div>

      {/* caption + beat position. Not a live region · see the header. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, minHeight: 26 }}>
        <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
          {BEATS.map((b, i) => (
            <span
              key={b.id}
              data-testid={`hiw-dot-${b.id}`}
              data-on={(reduced || i === beat) ? 'true' : 'false'}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: (reduced || i === beat) ? GOLD : 'rgba(255,255,255,0.2)',
                transition: reduced ? 'none' : 'background 0.3s ease',
              }}
            />
          ))}
        </div>
        <p
          key={phase}
          data-testid="hiw-caption"
          className={reduced ? undefined : 'hiw-fade'}
          style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.62)', letterSpacing: 0.3 }}
        >
          {reduced
            ? 'Place an element, complete a pattern, build a district · and keep your weakest region alive.'
            : BEATS[beat].caption}
        </p>
      </div>
    </div>
  )
}
