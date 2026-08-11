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
import { getGlobalIndex, recordCivilizationContribution, getGlobalCivilizationTotal, recordCivilizationDetail, awardGameWin } from '../lib/supabase'
import { buildGameEndEvent } from '../lib/gameEndEvent'

const REGION_NAMES = ['Sacred City', 'Living Earth', 'Free Energy']
const REGION_COLORS = ['#7F77DD', '#1D9E75', '#E24B4A']
const GLOBAL_INDEX_BASE = 147823 // canonical seed · fallback only · getGlobalIndex already folds this in.
// Display names for the lowercase element keys getClusterDetail returns (energy/biofarming/…) · the colour
// comes straight from ELEMENT_COLORS keyed off the same lowercase key (the board's single colour source).
const ELEMENT_LABELS = { energy: 'Energy', biofarming: 'BioFarming', technology: 'Technology', community: 'Community' }

// One player's final record · derived purely from store-true fields, no fabricated data (rule 32).
// `clusterBonus` is THIS PLAYER'S OWN cluster term (board game rule p9 · getClusterTotal(regions, seat) ·
// T2 S35) — a FLAT peer of the unused-token bonus that the engine folds into the total (calculateFinalScore's
// 3rd arg). It was board-global and therefore identical for everybody from S18 until S35, which meant it
// lifted all totals equally and could never change the ranking; hexes now carry `placedBy`, so each player
// scores only their own tokens on each biggest cluster and this term finally DIFFERS between players.
// Passing it here makes the on-screen total match the game_end audit record, which computes the identical
// per-player total (gameEndEvent.js v2 · rule 40/65/63).
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

// practice · a local game against bots. It is a REAL game of NeoTopia by every rule, and it is shown in
// full here on purpose · the score screen is the payoff, and hiding it would make practice feel like a
// demo. What it must never be is COUNTED. Nothing below that writes is allowed to run for it. (T1 S33)
//
// onLeavePractice / onPlayAgain · THE EXIT LIVES IN HERE NOW, and only in practice (T1 S36). This dialog
// is position:fixed inset:0 zIndex 300 and opaque, so it paints over GameRoom's whole header · including
// the "Leave practice" control, which stayed in the DOM and kept passing a visibility check while being
// unclickable by a human. Both default to a plain navigation so a caller that forgets them still leaves
// the player somewhere real, but only GameRoom's handlers run the practice teardown.
export default function FinalScore({
  players = [], mySeat = null, sync = null, roomId = null, regions = [], practice = false,
  onLeavePractice = null, onPlayAgain = null,
}) {
  const [revealed, setRevealed] = useState(false)
  const [liveIndex, setLiveIndex] = useState(null) // real DB aggregate · null until fetched
  const didFetchRef = useRef(false)                // getGlobalIndex fires exactly once
  const didRecordRef = useRef(false)               // our own contribution records exactly once (when valid)
  const didGameEndRef = useRef(false)              // the game_end audit row fires exactly once
  const didDetailRef = useRef(false)               // the per-game civilization-score ledger row fires exactly once
  const didAwardRef = useRef(false)                // award_game_win is asked exactly once per client (T2 S35)
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
  // ── WHOSE CLUSTER POINTS ARE THESE (T1 S45) ──────────────────────────────────────────────────
  // The handover T2 left in the comment below, taken. Since S35 the engine awards each player only
  // the tokens THEY placed, so this panel and the formula line above it were describing two
  // different quantities with the same word: the rows summed the whole board (say 40) while each
  // player's own line read "+24 cluster", and nothing on screen connected the two. A player with a
  // different number from their opponent had no way to learn that PLACEMENT is what earned it ·
  // which is the entire point of the mechanic, and the reason it measured as noise until S35.
  // getClusterDetail already takes a seat and returns the same rows with `bonus` counting only that
  // seat's tokens, so this is the engine's own split rather than a second arithmetic here (Rule 45).
  const clusterBySeat = useMemo(() => {
    if (typeof patternMatcher.getClusterDetail !== 'function') return {}
    const out = {}
    for (const p of players) {
      if (typeof p?.seat !== 'number') continue
      out[p.seat] = patternMatcher.getClusterDetail(regions, p.seat)
    }
    return out
  }, [regions, players])
  // The board's TOTAL cluster points · the sum of the per-cluster rows shown below, i.e. every token on every
  // biggest cluster. This is a civilization figure for the display only: since T2 S35 the engine scores each
  // player just their OWN tokens, so per-seat bonuses sum to AT MOST this number (less when a cluster holds
  // tokens placed before ownership tracking existed). It is deliberately NOT what any player's total uses.
  const clusterBonus = useMemo(
    () => clusterDetail.reduce((sum, c) => sum + (c.bonus || 0), 0),
    [clusterDetail],
  )

  // T2 S35 · MINIMAL CROSS-LANE EDIT, flagged to T1 in comms. Each record now takes that seat's OWN cluster
  // points, not the board total, so the on-screen total matches the game_end audit row (gameEndEvent.js v2,
  // which computes getClusterTotal(regions, seat) per player). Shipping the engine change without this one
  // line would have made the screen and the permanent record disagree · Rule 65, the composed bug that hides
  // exactly when two lanes each ship a correct half. The per-cluster VISUALIZATION below is untouched and
  // still shows civilization-level sizes: breaking those rows down by player is a real design job in T1's
  // lane, not a seam fix, so it is handed over rather than guessed at.
  const finalScores = useMemo(
    () => players.map(p => recordFor(
      p,
      typeof p?.seat === 'number' && typeof patternMatcher.getClusterTotal === 'function'
        ? patternMatcher.getClusterTotal(regions, p.seat)
        : 0,
    )).sort((a, b) => b.total - a.total),
    [players, regions],
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
  //
  // THE PRACTICE GUARD, and why it is first rather than folded into the condition above it. Until S33
  // this effect was protected by nothing but `mySeat == null`, and that held only by accident: a local
  // game seeded userId 'dev-1', which never matched an auth id, so mySeat stayed null and the write was
  // skipped. Practice mode ends that accident · the human seat has to be identified for the turn gate to
  // work at all (otherwise the player can act on a bot's turn), and identifying it sets mySeat, which
  // was the only thing standing between a practice game and the civilization's permanent record.
  // Nor would "there is no session" have saved it: this RPC is fired through the shared supabase client
  // and takes its player from auth.uid(), so for any RETURNING visitor · precisely the people who
  // practise · the write would have succeeded. Bots would have built the real NeoTopia. (Rule 65: two
  // lanes each shipped a correct half, and the bug lives in the composition.)
  //
  // AND THE RELOAD, which is the bug T3 measured live in S37 (neotopia_index 3 -> 6, 3 -> 6, 2 -> 4 ·
  // the delta always exactly the player's district count, and refreshing twice triples it).
  // `increment_neotopia_index` is a BARE increment: it clamps one call to [0,56] and carries no
  // idempotency key at all, so its only protection was `didRecordRef` · a useRef, which a page reload
  // destroys. Refreshing your own score screen is an ordinary thing to do, and it inflates the
  // civilization's headline number, the one the Landing page leads with.
  // Every other write on this screen already survives a reload: record_civilization_score is
  // UNIQUE(session_id, player_id) ON CONFLICT DO NOTHING, award_game_win is keyed on
  // game_wins.session_id, and the game_end audit row below was given an explicit per-room
  // localStorage guard FOR EXACTLY THIS CASE. This one was the outlier.
  // Keyed on the SESSION rather than the room, because the session is what one game is · a room that
  // hosts a second game must be able to contribute again. Seat is in the key too, so two people
  // sharing a browser are not one contributor.
  // STATED PLAINLY: this closes the reload, not the class. A different browser re-entering the same
  // finished session still double-counts, because a client-side guard cannot be authoritative about
  // a server-side counter. The durable fix is an idempotency key on the RPC itself, which lives in
  // migrations/ and is T2's · routed to them in comms rather than half-built here.
  const contribGuardKey = (sync?.sessionId || roomId) && mySeat != null
    ? `neotopia_index_${sync?.sessionId || roomId}_${mySeat}`
    : null
  useEffect(() => {
    if (practice) return
    if (didRecordRef.current || mySeat == null || myDistricts <= 0) return
    try {
      if (contribGuardKey && localStorage.getItem(contribGuardKey)) { didRecordRef.current = true; return }
    } catch { /* storage blocked · fall through to the ref, which is what we had before */ }
    didRecordRef.current = true
    try { if (contribGuardKey) localStorage.setItem(contribGuardKey, String(myDistricts)) } catch {}
    recordCivilizationContribution(myDistricts).catch(() => {})
  }, [practice, mySeat, myDistricts, contribGuardKey])

  // Record THIS client's per-game detailed civilization scores into the Global Index LEDGER (migration 009 ·
  // record_civilization_score · server sets player_id=auth.uid() · UNIQUE(session_id,player_id) ON CONFLICT DO
  // NOTHING so it is idempotent · own seat only). REQUIRES a live sessionId · solo has none → naturally skipped.
  // Rule 61: the console.log PROVES the value is live before the write. T1 S15 flagged sync.sessionId undefined;
  // T3 S16 (1e9e249) exposed it reactively from useGameSync · re-verified the value here before wiring (S16 D).
  // The latch is NOT burned while sessionId is still null, so the effect re-runs once it resolves.
  useEffect(() => {
    if (practice) return // sessionId is already null in practice · stated anyway, so the rule is one rule
    if (didDetailRef.current) return
    const sessionId = sync?.sessionId
    // Rule 61 evidence gate · log the LIVE value before any write (do not remove · it proves the wire).
    console.log('[NeoTopia] recordCivilizationDetail: sessionId =', sessionId, '· mySeat =', mySeat)
    if (!sessionId || mySeat == null) return // solo / no live session → nothing to record (latch NOT burned)
    const me = finalScores.find(p => p.seat === mySeat)
    if (!me) return
    didDetailRef.current = true
    recordCivilizationDetail({ sessionId, scores: me.scores, cardsBuilt: me.scoredCards.length }).catch(() => {})
  }, [practice, sync, mySeat, finalScores])

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
    if (practice) return // a practice game writes no audit row · there is no session for it to belong to
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
  }, [practice, sync, mySeat, players, roomId, regions])

  // Credit the winner (T2 S35 · migration 020's award_game_win, which shipped in S33 and has been invoked by
  // NOTHING ever since · games_won has therefore been 0 for every player in the world, a value indistinguishable
  // from "nobody has won yet". A writer with no caller resting at a plausible number is this project's signature
  // bug and it had it again, one layer up from the last one.)
  //
  // FIRED FROM EVERY SEAT, deliberately, unlike the game_end row above which only the lowest seat writes. The
  // RPC is idempotent (game_wins.session_id is the primary key, INSERT .. ON CONFLICT DO NOTHING) and recomputes
  // the winner server-side from the stored game_end row, so every seat asking gets the same answer and the extra
  // callers are the recovery path for the lowest seat closing its tab. It deliberately does NOT trust the
  // payload's winner_seat: that field is a stable-sort artifact and all three historical rows are 0-0, so
  // trusting it would have awarded seat 0 a win in every game ever finished.
  //
  // THE RACE, and why it is retried rather than ordered. This effect cannot see when the lowest seat's audit
  // insert lands, and there is no ordering primitive between clients. A seat that asks too early gets
  // 'no_game_end' and writes nothing · harmless, but if every seat asked once and every ask was early, the
  // winner would go uncredited. So a 'no_game_end' is retried a few times; any other status is terminal.
  useEffect(() => {
    if (practice) return // a practice game has no session and credits nobody · same rule as every write here
    if (didAwardRef.current) return
    const sessionId = sync?.sessionId
    if (!sessionId || mySeat == null) return // latch NOT burned · re-runs when sessionId resolves
    didAwardRef.current = true

    let cancelled = false
    ;(async () => {
      // 4 attempts over ~7s. The audit row is written by a peer in the same reveal, so this is generous.
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        const status = await awardGameWin(sessionId)
        // Rule 61 · log the STATUS, not the fact that a call happened. 'awarded' vs 'awarded_no_profile' is
        // the whole difference between a credited win and a success string over a zero-row write.
        console.log('[NeoTopia] award_game_win:', status, '· session', sessionId, '· attempt', attempt + 1)
        if (status !== 'no_game_end') return // awarded | awarded_no_profile | tie | already_awarded | null
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      }
    })()
    return () => { cancelled = true }
  }, [practice, sync?.sessionId, mySeat])

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

  // Practice CTAs. The fallbacks are '/' (the landing page), never '/lobby': a caller that forgets to
  // hand these over should still leave a practice player somewhere they can definitely use, and the
  // lobby is the one screen that requires the sign-in this mode exists to do without.
  const leave = onLeavePractice ?? (() => navigate('/'))
  const playAgain = onPlayAgain ?? leave

  return (
    <div
      role="dialog"
      aria-label="NeoTopia final civilization record"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'rgba(4,4,10,0.98)',
        opacity: revealed ? 1 : 0, transition: 'opacity 0.8s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 24px 0',
      }}
    >
      <style>{`@keyframes fs-card-reveal { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* CIVILIZATION HEADER */}
      <div style={{ textAlign: 'center', marginBottom: 56, flexShrink: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 8, color: 'rgba(255,255,255,0.2)', marginBottom: 16, textTransform: 'uppercase' }}>
          NeoTopia · Civilization Record
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
                    WINNER
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
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>unused tokens × 3</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                      +{player.unusedBonus * 3}
                    </span>
                  </div>
                )}

                {/* ── THE FORMULA SHIPPED AND WAS INVISIBLE (T1 S45) ────────────────────────────
                    I reported last session that the scoring formula "does not exist in the shipped
                    product", from a bundle grep for `×3`. It renders `× 3`, WITH A SPACE, so my
                    search matched nothing and I called a built feature missing · and the brief
                    repeated the finding using the same string, which is not an independent check
                    (Rule 92: two sides of one source). It has been here since S27.
                    WHAT IS ACTUALLY WRONG IS THAT NOBODY CAN READ IT. Measured: white at alpha 0.20
                    on this dialog's rgb(4,4,10) is CONTRAST 1.70:1, against the 4.5:1 AA needs for
                    11px text · off by a factor of 2.6. The line carrying the game's entire strategic
                    argument was drawn at the threshold of visibility. 0.5 measures 5.34:1 and 12px
                    stops it being the smallest thing on a screen full of 36px numbers.
                    Rule 70, exactly: a feature can exist and be too subtle to perceive, and the
                    report that it is missing is the symptom of that rather than a contradiction. */}
                <div data-testid="score-formula" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', letterSpacing: 0.3, fontVariantNumeric: 'tabular-nums' }}>
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

      {/* Plato's civilizational decay law made visible · the worst region is tripled because a city
          dominated by one soul-part collapses under its own imbalance (PLATO_BOOKS · Pillar 2).
          T1 S27 · the on-screen line now STATES the rule instead of gesturing at it · the tripling is
          the strongest mechanic in the game and the end screen was the one place it went unexplained. */}
      <div style={{
        maxWidth: 640, textAlign: 'center', marginBottom: 48, flexShrink: 0,
        fontSize: 12, letterSpacing: 1.5, lineHeight: 1.6, color: 'rgba(255,160,40,0.8)',
      }}>
        Your lowest-scoring region counts three times. A city is only as strong as its weakest district.
      </div>

      {/* ELEMENT CLUSTERS · the connected patterns the civilization formed (board-global · the most
          educational end-screen moment). Each cluster is worth 1 point per token on it (board game rule p9 ·
          getClusterDetail.bonus). T1 S19 (was count-only · S17 Task C).
          T2 S35 · THE COPY HERE CHANGED BECAUSE THE RULE DID. These rows are the whole board, and each point
          now goes to WHOEVER PLACED that token, not to everybody. So the total below is what the board is
          worth in aggregate, and it no longer equals what any single player received (Rule 63 · the screen
          must not claim a number the engine does not award). Splitting these rows per player is the natural
          next step and is T1's · handed over in comms rather than guessed at here. */}
      {clusterDetail.length > 0 && (
        <div style={{
          maxWidth: 420, width: '100%', padding: '22px 28px', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', marginBottom: 40, flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.25)', marginBottom: 4, textTransform: 'uppercase', textAlign: 'center' }}>
            Element Clusters
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 16, lineHeight: 1.6 }}>
            the largest connected group of each element, in each region · 1 point per token, to whoever placed it
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {clusterDetail.map((c, i) => {
              // Only players who actually earned something on THIS cluster · a row listing everyone
              // with a 0 beside their name is noise, and it is the common case with three seats.
              const seatSplit = players
                .map(p => ({
                  seat: p.seat,
                  name: (p.username ?? 'Rival').slice(0, 8),
                  mine: mySeat != null && p.seat === mySeat,
                  bonus: (clusterBySeat[p.seat] ?? []).find(
                    r => r.regionId === c.regionId && r.element === c.element,
                  )?.bonus ?? 0,
                }))
                .filter(s => s.bonus > 0)
              // ── POINTS ON THE BOARD THAT NOBODY RECEIVED (T1 S46) ──────────────────────────────
              // WITNESSED IN A BROWSER, which is the only reason it is here. A board synced from
              // before S35 carries hexes with an element and NO placedBy, so getClusterDetail awards
              // every seat 0 while the row still reads "+3 pts" · the split then renders NOTHING,
              // which is indistinguishable from "one player earned it all". That is the exact
              // failure I predicted when I shipped this in jsdom and could not have caught there:
              // my fixture stamped every hex, because I wrote it.
              // Measured live with placedBy stripped: board 3, seat0 0, seat1 0, splits [], and both
              // formula lines lost their cluster term entirely. The screen claimed three points that
              // went to no one and said nothing about it (Rule 80 · never resolve to a plausible
              // nothing). Naming the remainder is the whole fix.
              const claimed = seatSplit.reduce((n, s) => n + s.bonus, 0)
              const unclaimed = Math.max(0, (c.bonus ?? 0) - claimed)
              return (
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
                  {/* WHO GOT THE POINTS, per cluster. The row used to end here with the board total, so a
                      2-player game showed "+7 pts" on a cluster that paid 5 to one player and 2 to the
                      other. The split is the whole lesson of the mechanic · it is the only place the
                      screen can say "you earned these by placing them". */}
                  {unclaimed > 0 && (
                    <span data-testid="cluster-unclaimed" title="placed before this game recorded who placed it" style={{
                      fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap',
                    }}>
                      unclaimed <span style={{ opacity: 0.55 }}>·</span> {unclaimed}
                    </span>
                  )}
                  {seatSplit.length > 1 && (
                    <span data-testid="cluster-split" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      {seatSplit.map(s => (
                        // A BARE SPACE IS AMBIGUOUS WHEN THE NAME ENDS IN A NUMBER, and the default
                        // opponent is called "Bot 1". Driving this in a real browser rendered
                        // "Bot 1 1" · name then score, indistinguishable from a name. My jsdom
                        // fixture used "Rival" and could not have shown it. The separator makes the
                        // number a number for every username, and the count is dimmer than the
                        // name so the eye lands on who before how many.
                        <span key={s.seat} style={{
                          fontSize: 11, fontVariantNumeric: 'tabular-nums',
                          color: s.mine ? 'rgba(200,148,64,0.95)' : 'rgba(255,255,255,0.45)',
                          fontWeight: s.mine ? 700 : 500, whiteSpace: 'nowrap',
                        }}>
                          {s.mine ? 'you' : s.name} <span style={{ opacity: 0.55 }}>·</span> {s.bonus}
                        </span>
                      ))}
                    </span>
                  )}
                  {/* bonus === count by the rule · the guard renders 0 pts if T2's `bonus` field is ever absent (Rule 65) */}
                  <span style={{ color: 'rgba(200,148,64,0.9)', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 46, textAlign: 'right' }}>
                    +{c.bonus ?? 0} pts
                  </span>
                </span>
              </div>
              )
            })}
          </div>
          {/* Board total · what every cluster on the board is worth in aggregate. Since T2 S35 this is SPLIT
              between the players by who placed each token, so it is NOT any one player's cluster score · the
              label says "on the board" for exactly that reason. */}
          {clusterBonus > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)',
            }}>
              <span style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                Cluster points on the board
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
          districts built across all NeoTopia games
        </div>
        <div style={{ marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,0.5)', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {winner.username} scored the highest at{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'rgba(255,215,0,0.85)' }}>{winner.total}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
          this game added {totalProjectsBuilt} districts
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
              your game added {localScore} points to that total
            </div>
          </div>
        )}
      </div>

      {/* ── THE WAY OUT · and in practice it has to live INSIDE this dialog ─────────────────────────
          MEASURED by T3 (S35), not read: at phase 'scoring' the "Leave practice" button in GameRoom's
          header is still in the DOM and still passes a visibility check, and
          `document.elementFromPoint` at its centre returns THIS element. A real click (no force)
          times out. So at the one moment a practice player is most likely to want out, the only
          control they could actually reach was the one below · which sent them to the MULTIPLAYER
          lobby, a screen that needs the sign-in practice mode exists to survive without, and never
          ran endPractice(), leaving the finished game in the store and in sessionStorage behind them.

          Same class as the ScoreFlash bug found in the same session: a full-viewport overlay
          swallowing the control underneath it. The fix is not to raise the button's z-index · it is
          to put the exit where the player is actually looking. There is exactly ONE `leave-practice`
          in the document at any time (GameRoom drops its header copy at 'scoring'), so the testid
          keeps meaning "the way out", wherever the way out currently lives. */}
      {/* Closing line · the same footer wording the landing page ends on, so the loop reads as one
          voice. It sits ABOVE the sticky row now · a footer underneath a permanently-visible bar is
          a footer nobody ever sees. */}
      <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, letterSpacing: 3, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', flexShrink: 0 }}>
        NeoTopia · Building the civilization · 2055
      </div>

      {/* ── AND IT HAS TO BE ON SCREEN WHEN THE SCREEN ARRIVES (T1 S39 · T3 measured it) ───────────
          Seven viewports, not one of them showed a CTA on arrival:

              1440x900   243px below the fold      390x844   692px below
              1280x720   423px below               375x667   889px below
               768x1024  119px below · the best    320x568  1038px BELOW

          It was never unreachable · this dialog scrolls, and one to three wheel gestures land a real
          click · so it is neither Rule 78a (covered) nor 78b (pushed off a row). It is the third
          case: below the fold in a scrollable container. What makes it a defect rather than a normal
          long page is that the MACOS OVERLAY SCROLLBAR IS 0px WIDE UNTIL YOU ARE ALREADY SCROLLING,
          so there is no passive affordance at all · the content just stops mid score-row. At 320 the
          last three things a player can read without moving are "0", "Living Earth", "0".
          On a phone that is roughly two screens of scrolling before ANY next action exists, on the
          one screen practice mode was built to pay off. Same family as the tutorial step-1 framing:
          the interface not answering "what now".
          STICKY, NOT MOVED TO THE TOP. The reveal order is the point of this screen · the score is
          the payoff and the CTA is what you do after it. Sticking the row to the bottom of the
          scrollport answers "what now" on arrival without putting "Start New Civilization" above the
          civilization. The buttons are the same nodes with the same testids; only where they sit
          changed. */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 2,
        display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', flexShrink: 0,
        width: '100%', padding: '18px 0 20px',
        // Fades the record out underneath rather than cutting it, so the sticky row reads as part of
        // the screen instead of a bar dropped on top of it.
        background: 'linear-gradient(to top, rgba(4,4,10,0.99) 55%, rgba(4,4,10,0))',
      }}>
        <button
          data-testid="play-again-btn"
          onClick={practice ? playAgain : () => navigate('/lobby')}
          style={{
            height: 56, flexShrink: 0, padding: '0 48px', borderRadius: 12, border: '1px solid rgba(200,148,64,0.35)',
            background: 'rgba(200,148,64,0.06)', color: 'rgba(200,148,64,0.85)',
            fontSize: 12, letterSpacing: 4, cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s',
          }}
        >
          {/* In practice "again" means another practice game, not the lobby · a visitor who is here
              because anonymous sign-in is rate limited cannot use the lobby at all. */}
          {practice ? 'Play Again' : 'Start New Civilization'}
        </button>
        {practice && (
          <button
            data-testid="leave-practice"
            onClick={leave}
            style={{
              height: 56, flexShrink: 0, padding: '0 32px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)',
              background: 'transparent', color: 'rgba(255,255,255,0.55)',
              fontSize: 12, letterSpacing: 4, cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s',
            }}
          >
            Leave Practice
          </button>
        )}
      </div>

    </div>
  )
}
