// NeoTopia · the civilization record shown when a game reaches its end (phase === 'scoring').
// T1 owns this file. This is NOT a scoreboard · it is a record of a civilization that was built.
//
// PREMISE-CHECKED contracts (rule 7/28 · the forge draft assumed all three wrong):
//   · calculateFinalScore(regionalScores:number[], unusedBonusCount, clusterBonus) -> NUMBER
//       formula: best + 2nd + (worst x 3) + (unusedBonus x 3) + clusterBonus · the cluster bonus is a FLAT
//       peer term (board game rule p9 · getClusterTotal · T2 S18), NOT folded into a region score upstream.
//   · player state: { username, scores:[r0,r1,r2], bonusTokens:[type], scoredCardIds?:[id] }
//       scoredCardIds is optional · "Districts Built" degrades gracefully when it is absent.
//   · terminal phase is 'scoring' (gameStore endTurn) · NOT 'ended' · the lobby lives at '/lobby'
//     (Landing is at '/' since T1 S7) · the "new civilization" CTA routes to '/lobby'.

import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { calculateFinalScore } from '../lib/patternMatcher'
// Namespace import (NOT a named import) for getClusterDetail · it is shipped by T2 (S17) and may land on
// origin AFTER this file. A static `import { getClusterDetail }` would make Rollup fail the build wherever
// the export is not yet present; a namespace read is `undefined` instead, so the cluster section simply
// hides until T2's export lands (Rule 65 · the consumer degrades gracefully across an unsynced seam).
import * as patternMatcher from '../lib/patternMatcher'
import { ELEMENT_COLORS } from '../utils/hexUtils'
import { DECK } from '../lib/projectCards'
import { getGlobalIndex, recordCivilizationContribution, getGlobalCivilizationTotal, recordCivilizationDetail } from '../lib/supabase'
import { buildGameEndEvent } from '../lib/gameEndEvent'

const REGION_NAMES = ['Sacred City', 'Living Earth', 'Free Energy']
const REGION_COLORS = ['#7F77DD', '#1D9E75', '#E24B4A']
const GLOBAL_INDEX_BASE = 147823 // canonical seed · fallback only · getGlobalIndex already folds this in.
// Display names for the lowercase element keys getClusterDetail returns (energy/biofarming/…) · the colour
// comes straight from ELEMENT_COLORS keyed off the same lowercase key (the board's single colour source).
const ELEMENT_LABELS = { energy: 'Energy', biofarming: 'BioFarming', technology: 'Technology', community: 'Community' }

// One player's final record · derived purely from store-true fields, no fabricated data (rule 32).
// `clusterBonus` is the board-global cluster term (board game rule p9 · getClusterTotal · T2 S18) — a FLAT
// peer of the unused-token bonus that the engine folds into every player's total (calculateFinalScore's 3rd
// arg). The SAME number for every player (the board is shared · no per-hex placer to attribute it · T2 S18),
// so it lifts all totals equally and never changes the ranking. Passing it here makes the on-screen total
// match the game_end audit record, which computes the identical total (gameEndEvent.js · rule 40/65/63).
function recordFor(player, clusterBonus = 0) {
  const scores = [0, 1, 2].map(id => player.scores?.[id] ?? 0)
  const unusedBonus = player.bonusTokens?.length ?? 0
  const total = calculateFinalScore(scores, unusedBonus, clusterBonus) // single source of truth · the engine fn.

  const sorted = [...scores].sort((a, b) => b - a)
  const [best, second, worst] = [sorted[0] ?? 0, sorted[1] ?? 0, sorted[2] ?? 0]
  // The single lowest-scoring region is the one tripled · tie-break to the lowest id (deterministic ·
  // the numeric total is unaffected by which tied region we highlight).
  const worstRegionId = [0, 1, 2].reduce((w, id) => (scores[id] < scores[w] ? id : w), 0)

  const scoredCards = (player.scoredCardIds ?? [])
    .map(id => DECK.find(c => c.id === id))
    .filter(Boolean)

  return { ...player, scores, unusedBonus, clusterBonus, total, best, second, worst, worstRegionId, scoredCards }
}

// Reactively honors prefers-reduced-motion · true when the user asked for less motion.
function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduce
}

export default function FinalScore({ players = [], mySeat = null, sync = null, roomId = null, regions = [] }) {
  const [revealed, setRevealed] = useState(false)
  const [liveIndex, setLiveIndex] = useState(null) // real DB aggregate · null until fetched
  const didFetchRef = useRef(false)                // getGlobalIndex fires exactly once
  const didRecordRef = useRef(false)               // our own contribution records exactly once (when valid)
  const didGameEndRef = useRef(false)              // the game_end audit row fires exactly once
  const didDetailRef = useRef(false)               // the per-game civilization-score ledger row fires exactly once
  const reduceMotion = usePrefersReducedMotion()
  const navigate = useNavigate()

  useEffect(() => {
    if (reduceMotion) { setRevealed(true); return } // prefers-reduced-motion · skip the 0.8s fade
    const t = setTimeout(() => setRevealed(true), 600) // 600ms breath before the reveal.
    return () => clearTimeout(t)
  }, [reduceMotion])

  // Board-global element clusters (T2 S17/S18 getClusterDetail · BFS · rule 10). The board is SHARED (no
  // per-hex placer), so a cluster · and its bonus · belongs to the CIVILIZATION, not a player · shown once,
  // not per record. Each cluster of >= 2 like elements is worth 1 point per token on it (board game rule p9 ·
  // `bonus` === `count` · T2 S18). Empty until T2's export is on origin → the section just hides (Rule 65 ·
  // the consumer degrades gracefully across an unsynced seam · namespace read is `undefined`, not a build fail).
  const clusterDetail = useMemo(
    () => (typeof patternMatcher.getClusterDetail === 'function' ? patternMatcher.getClusterDetail(regions) : []),
    [regions],
  )
  // The board-global cluster bonus · the SAME flat term the engine folds into every player's final total
  // (calculateFinalScore's 3rd arg · T2 S18). Derived from the SAME clusterDetail rendered below, so the
  // "+N total" line can never disagree with the per-cluster rows (Rule 63) · this equals, by construction,
  // patternMatcher.getClusterTotal(regions) (which is itself sum(getClusterDetail.bonus) · one BFS · rule 10).
  const clusterBonus = useMemo(
    () => clusterDetail.reduce((sum, c) => sum + (c.bonus || 0), 0),
    [clusterDetail],
  )

  const finalScores = useMemo(
    () => players.map(p => recordFor(p, clusterBonus)).sort((a, b) => b.total - a.total),
    [players, clusterBonus],
  )
  const totalProjectsBuilt = useMemo(
    () => finalScores.reduce((s, p) => s + p.scoredCards.length, 0),
    [finalScores],
  )
  // THIS client's own districts · the only amount we may record (own auth.uid() profile · own seat).
  const myDistricts = useMemo(
    () => finalScores.find(p => p.seat === mySeat)?.scoredCards.length ?? 0,
    [finalScores, mySeat],
  )

  // Read the real Global NeoTopia Index aggregate exactly once. NO alive-guard: setState-after-unmount
  // is a safe no-op in React 19, and StrictMode's dev double-invoke must NOT suppress the result (a
  // single-fetch latch + alive-guard would leave liveIndex null forever in dev → seed-only). getGlobalIndex
  // itself never throws (it falls back to the seed).
  useEffect(() => {
    if (didFetchRef.current) return
    didFetchRef.current = true
    getGlobalIndex().then(n => { if (typeof n === 'number') setLiveIndex(n) }).catch(() => {})
  }, [])

  // The civilization SCORE ledger (record_civilization_score sum · distinct from the district COUNT above).
  // getGlobalCivilizationTotal never rejects · it returns a number (0 on failure or an empty ledger), so the
  // section shows once the effect resolves and renders this game's localScore optimistically (never a bare 0 ·
  // grows as the ledger fills · the writer is wired below now that sessionId is exposed · T1 S16 Task D).
  const [globalCivTotal, setGlobalCivTotal] = useState(null)
  const didCivFetchRef = useRef(false)
  useEffect(() => {
    if (didCivFetchRef.current) return
    didCivFetchRef.current = true
    getGlobalCivilizationTotal().then(t => { if (typeof t === 'number') setGlobalCivTotal(t) }).catch(() => {})
  }, [])

  // Record THIS client's own districts exactly once · own auth.uid() profile · own seat ONLY, so the
  // global sum is exact across players (never N× over-counted · rule 32 · T2's increment is auth.uid()-
  // scoped + clamped [0,56] · both RPCs verified SECURITY DEFINER + granted anon · T1 S7). Separate
  // one-shot ref + live deps so a first render with an unresolved seat (mySeat null / myDistricts 0)
  // does NOT burn the latch · the effect re-runs until a valid contribution is actually recorded.
  useEffect(() => {
    if (didRecordRef.current || mySeat == null || myDistricts <= 0) return
    didRecordRef.current = true
    recordCivilizationContribution(myDistricts).catch(() => {})
  }, [mySeat, myDistricts])

  // Record THIS client's per-game detailed civilization scores into the Global Index LEDGER (migration 009 ·
  // record_civilization_score · server sets player_id=auth.uid() · UNIQUE(session_id,player_id) ON CONFLICT DO
  // NOTHING so it is idempotent · own seat only). REQUIRES a live sessionId · solo has none → naturally skipped.
  // Rule 61: the console.log PROVES the value is live before the write. T1 S15 flagged sync.sessionId undefined;
  // T3 S16 (1e9e249) exposed it reactively from useGameSync · re-verified the value here before wiring (S16 D).
  // The latch is NOT burned while sessionId is still null, so the effect re-runs once it resolves.
  useEffect(() => {
    if (didDetailRef.current) return
    const sessionId = sync?.sessionId
    // Rule 61 evidence gate · log the LIVE value before any write (do not remove · it proves the wire).
    console.log('[NeoTopia] recordCivilizationDetail: sessionId =', sessionId, '· mySeat =', mySeat)
    if (!sessionId || mySeat == null) return // solo / no live session → nothing to record (latch NOT burned)
    const me = finalScores.find(p => p.seat === mySeat)
    if (!me) return
    didDetailRef.current = true
    recordCivilizationDetail({ sessionId, scores: me.scores, cardsBuilt: me.scoredCards.length }).catch(() => {})
  }, [sync, mySeat, finalScores])

  // Append the game_end audit row ONCE per game · the permanent civilization record (T2 built the PURE
  // payload · the consumer fires it · comms T2 S8). "Exactly one client" = the lowest-seat present writes
  // it (deterministic · everyone else skips · no duplicate rows), and a per-room localStorage guard makes
  // a reload during 'scoring' idempotent. eventType 'gameEnd' → resolveDbEventType → 'game_end' (CHECK-valid).
  // Skipped in solo (no sync). Passes BOTH players and regions: buildGameEndEvent folds the board-global
  // cluster bonus (getClusterTotal · board game rule p9) into each player's audit total, so the permanent
  // game_end record matches the totals shown on this screen. T2's handoff was explicit — thread regions into
  // the display total AND this payload in the SAME change, else the audit (0 cluster) diverges from the screen
  // (+N cluster) · gameEndEvent.js header · Rule 40/65. regions defaults to [] → 0 bonus when unavailable.
  useEffect(() => {
    if (didGameEndRef.current) return
    if (!sync?.pushState || mySeat == null) return
    const seats = players.map(p => p.seat).filter(s => typeof s === 'number')
    if (seats.length === 0 || mySeat !== Math.min(...seats)) return
    const guardKey = roomId ? `neotopia_gameend_${roomId}` : null
    try { if (guardKey && localStorage.getItem(guardKey)) { didGameEndRef.current = true; return } } catch {}
    didGameEndRef.current = true
    try { if (guardKey) localStorage.setItem(guardKey, '1') } catch {}
    const { eventType, eventData } = buildGameEndEvent({ players, regions })
    sync.pushState(eventType, eventData)
  }, [sync, mySeat, players, roomId, regions])

  // Global Index target = real persisted aggregate (already includes the seed) + this whole game's
  // contribution, shown optimistically · seed-only fallback before the fetch resolves / on error. A
  // bounded, self-healing cosmetic race exists (a peer recording before our read resolves can show it
  // high by ≤ the peer's district count) · the PERSISTED aggregate stays exact (T1 S7 review).
  const indexTarget = (liveIndex ?? GLOBAL_INDEX_BASE) + totalProjectsBuilt
  // Count it up on reveal (T1 S8) · ease from the current shown value so a late liveIndex resolve never
  // snaps backward · prefers-reduced-motion shows the final number instantly.
  const [shownIndex, setShownIndex] = useState(GLOBAL_INDEX_BASE)
  const shownRef = useRef(GLOBAL_INDEX_BASE)
  useEffect(() => { shownRef.current = shownIndex }, [shownIndex])
  useEffect(() => {
    if (!revealed) return
    if (reduceMotion) { setShownIndex(indexTarget); return }
    let current = shownRef.current
    if (current === indexTarget) return
    const step = Math.max(1, Math.ceil(Math.abs(indexTarget - current) / 40))
    const dir = indexTarget > current ? 1 : -1
    const timer = setInterval(() => {
      current = dir > 0 ? Math.min(current + step, indexTarget) : Math.max(current - step, indexTarget)
      setShownIndex(current)
      if (current === indexTarget) clearInterval(timer)
    }, 25)
    return () => clearInterval(timer)
  }, [revealed, indexTarget, reduceMotion])

  if (finalScores.length === 0) return null

  const winner = finalScores[0]
  // This client's final score (solo: mySeat null → the lone player, i.e. the winner) · the contribution.
  const localScore = (finalScores.find(p => p.seat === mySeat) ?? winner).total

  return (
    <div
      role="dialog"
      aria-label="NeoTopia final civilization record"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'rgba(4,4,10,0.98)',
        opacity: revealed ? 1 : 0, transition: 'opacity 0.8s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 24px 80px',
      }}
    >
      <style>{`@keyframes fs-card-reveal { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* CIVILIZATION HEADER */}
      <div style={{ textAlign: 'center', marginBottom: 56, flexShrink: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 8, color: 'rgba(255,255,255,0.2)', marginBottom: 16, textTransform: 'uppercase' }}>
          NeoTopia · Consciousness Civilization
        </div>
        <div style={{ fontSize: 52, fontWeight: 100, color: 'rgba(255,255,255,0.92)', letterSpacing: 12, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
          2055
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', letterSpacing: 2 }}>
          The civilization is complete
        </div>
        {/* Winner announcement · only when there is a contest (2+ players) · gold, the FOUNDER colour */}
        {finalScores.length > 1 && (
          <div style={{ fontSize: 19, color: '#C89440', letterSpacing: 1, marginTop: 18, fontWeight: 400 }}>
            {winner.username} built the strongest civilization
          </div>
        )}
      </div>

      {/* PLAYER RECORDS */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48, width: '100%', maxWidth: 760, flexShrink: 0 }}>
        {finalScores.map((player, rank) => {
          const isWinner = rank === 0
          return (
            <div key={player.seat} style={{
              flex: '1 1 320px', maxWidth: 360, borderRadius: 20, overflow: 'hidden',
              border: isWinner ? '1px solid rgba(255,215,0,0.35)' : '1px solid rgba(255,255,255,0.07)',
              background: isWinner ? 'rgba(255,215,0,0.04)' : 'rgba(255,255,255,0.02)',
              // Stagger each civilization record in (T1 S8) · reduced-motion shows them at once.
              ...(reduceMotion ? null : { opacity: 0, animation: 'fs-card-reveal 0.45s ease forwards', animationDelay: `${rank * 0.18}s` }),
            }}>
              {/* Player header · name + final total */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                {isWinner && (
                  <span style={{ fontSize: 11, color: 'rgba(255,215,0,0.7)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 4, padding: '2px 6px', letterSpacing: 1 }}>
                    FOUNDER
                  </span>
                )}
                <span style={{ color: isWinner ? 'rgba(255,215,0,0.9)' : 'rgba(255,255,255,0.8)', fontWeight: 500, fontSize: 16 }}>
                  {player.username}
                </span>
                <span style={{
                  marginLeft: 'auto', fontSize: 36, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  color: isWinner ? 'rgba(255,215,0,0.95)' : 'white',
                }}>
                  {player.total}
                </span>
              </div>

              {/* Region breakdown · worst region is tripled (loss aversion · the strongest mechanic) */}
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map(id => {
                  const isWorst = id === player.worstRegionId
                  const shown = isWorst ? player.scores[id] * 3 : player.scores[id]
                  return (
                    <div key={id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: isWorst ? '10px 12px' : '4px 0',
                      borderRadius: isWorst ? 8 : 0,
                      background: isWorst ? 'rgba(255,120,0,0.12)' : 'transparent',
                      border: isWorst ? '1px solid rgba(255,120,0,0.22)' : '1px solid transparent',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: REGION_COLORS[id], flexShrink: 0 }} />
                      <span style={{ flex: 1, color: isWorst ? 'rgba(255,160,40,0.9)' : 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                        {REGION_NAMES[id]}
                      </span>
                      {isWorst && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,140,0,0.85)', letterSpacing: 1 }}>
                          × 3
                        </span>
                      )}
                      <span style={{
                        fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 15, minWidth: 30, textAlign: 'right',
                        color: isWorst ? 'rgba(255,160,40,0.95)' : 'rgba(255,255,255,0.75)',
                      }}>
                        {shown}
                      </span>
                    </div>
                  )
                })}

                {/* Unused bonus tokens · each worth x3 at game end (psychology: never waste a token) */}
                {player.unusedBonus > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>unused tokens × 3</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                      +{player.unusedBonus * 3}
                    </span>
                  </div>
                )}

                {/* Score formula · the real engine formula, exactly */}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', letterSpacing: 0.3, fontVariantNumeric: 'tabular-nums' }}>
                  {player.best} + {player.second} + ({player.worst} × 3)
                  {player.unusedBonus > 0 ? ` + (${player.unusedBonus} × 3)` : ''}
                  {player.clusterBonus > 0 ? ` + ${player.clusterBonus} cluster` : ''} = {player.total}
                </div>
              </div>

              {/* Districts built · the irreplaceable Skyrim reward (hidden until scoredCardIds lands) */}
              {player.scoredCards.length > 0 && (
                <div style={{ padding: '14px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.2)', marginBottom: 10, textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}>
                    Districts Built · {player.scoredCards.length}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {player.scoredCards.map((card, i) => (
                      <span key={`${card.id}-${i}`} style={{
                        fontSize: 10, padding: '3px 8px', borderRadius: 5,
                        background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.42)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        {card.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ELEMENT CLUSTERS · the connected patterns the civilization formed (board-global · the most
          educational end-screen moment). Each cluster is worth 1 point per token on it (board game rule p9 ·
          getClusterDetail.bonus · T2 S18) · this is the same flat clusterBonus folded into every total above
          (Rule 63 · the per-row points + the total line sum to that number). T1 S19 (was count-only · S17 Task C). */}
      {clusterDetail.length > 0 && (
        <div style={{
          maxWidth: 420, width: '100%', padding: '22px 28px', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', marginBottom: 40, flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.25)', marginBottom: 4, textTransform: 'uppercase', textAlign: 'center' }}>
            Element Clusters
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 16, lineHeight: 1.6 }}>
            the connected patterns this civilization formed · 1 point per token (board game rule)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {clusterDetail.map((c, i) => (
              <div key={`${c.regionId}-${c.element}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: ELEMENT_COLORS[c.element] ?? '#888', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: 500 }}>
                  {ELEMENT_LABELS[c.element] ?? c.element}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>· {c.regionName}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {c.count} connected
                  </span>
                  {/* bonus === count by the rule · the guard renders 0 pts if T2's `bonus` field is ever absent (Rule 65) */}
                  <span style={{ color: 'rgba(200,148,64,0.9)', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 46, textAlign: 'right' }}>
                    +{c.bonus ?? 0} pts
                  </span>
                </span>
              </div>
            ))}
          </div>
          {/* Board-global total · equals the clusterBonus added to every player's final score above */}
          {clusterBonus > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)',
            }}>
              <span style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                Cluster bonus
              </span>
              <span style={{ color: 'rgba(200,148,64,0.95)', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                +{clusterBonus} pts total
              </span>
            </div>
          )}
        </div>
      )}

      {/* GLOBAL NEOTOPIA INDEX · this game's contribution to a real civilization */}
      <div style={{
        maxWidth: 420, width: '100%', textAlign: 'center', padding: '28px 32px', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', marginBottom: 40, flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.25)', marginBottom: 14, textTransform: 'uppercase' }}>
          Global NeoTopia Index
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.88)', letterSpacing: -1, marginBottom: 8 }}>
          {shownIndex.toLocaleString()}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
          consciousness districts built across all NeoTopia games
        </div>
        <div style={{ marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,0.5)', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {winner.username} founded the highest civilization at{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'rgba(255,215,0,0.85)' }}>{winner.total}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
          this game added {totalProjectsBuilt} toward the physical civilization by 2055
        </div>

        {/* Civilization SCORE ledger (points) · getGlobalCivilizationTotal · shown optimistically with this
            game's contribution · hidden until the query resolves (T1 S16 Task B). */}
        {globalCivTotal !== null && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
              Civilization Index ·{' '}
              <span style={{ color: 'rgba(255,215,0,0.85)' }}>{(globalCivTotal + localScore).toLocaleString()}</span>{' '}
              points
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              Your civilization contributed {localScore} to Stage 2 of 5
            </div>
          </div>
        )}
      </div>

      {/* CTA · civilization language, not game language · lobby now lives at '/lobby' (Landing is '/') */}
      <button
        data-testid="play-again-btn"
        onClick={() => navigate('/lobby')}
        style={{
          height: 56, flexShrink: 0, padding: '0 48px', borderRadius: 12, border: '1px solid rgba(200,148,64,0.35)',
          background: 'rgba(200,148,64,0.06)', color: 'rgba(200,148,64,0.85)',
          fontSize: 12, letterSpacing: 4, cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s',
        }}
      >
        Start New Civilization
      </button>

      {/* Civilization stage line · connects the end-game moment back to the real 5-stage vision */}
      <div style={{ marginTop: 30, fontSize: 11, letterSpacing: 3, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', flexShrink: 0 }}>
        Stage 2 of 5 · The Awareness
      </div>
    </div>
  )
}
