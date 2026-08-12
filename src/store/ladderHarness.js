// NeoTopia · THE TWO-BOT PLAYOUT HARNESS, in one place (T2 S49 · extracted from flatGrantBalance).
//
// WHY IT IS A MODULE. S48 built "play one game, score it two ways" to answer whether the bonus-token
// earn skew decides anything. S49 asks a different question of the same machinery · whether the
// DIFFICULTY LADDER is internally well-spaced · and the only honest choices were to export this or to
// write a second copy. The project has been bitten twice by the second option in three sessions
// (T3 and I both hand-rolled the deadlock board and both produced the identical 2-legal-placements
// bug), so it is a module (Rule 45).
//
// THE CONSOLIDATION COSTS A WITNESS AND THAT IS NOT FREE (Rule 94). Two wrong-in-different-ways copies
// still disagree, and a disagreement is a signal; one shared copy that is wrong is wrong in both
// experiments at once, silently, with both gates green. So this file is defended harder than either
// caller needs: the structural properties it promises are asserted by its OWN consumers below, and
// `flatDeal`'s evenness is now an exact identity rather than a tolerance (see ladderRow's
// `flatTokenImbalance`).

import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'
import { chooseBotAction, makeRng } from '../lib/botPolicy'
import { calculateFinalScore, getClusterTotal } from '../lib/patternMatcher'

const api = () => useGameStore.getState()

const shuffled = (arr, rng) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export const bots = (...levels) =>
  levels.map((difficulty, i) => ({ userId: null, username: `B${i}`, isBot: true, difficulty }))

// One game, played once. Returns everything a scoring needs · the per-seat score base with ZERO
// tokens, plus the token grants in the order they were granted.
//
// The base is taken from the REAL scoring function with a token count of 0 rather than re-derived,
// because calculateFinalScore's token term is purely additive (best + second + 3*worst + 3*tokens +
// cluster). base + 3*n is therefore EXACTLY the real score for n tokens, and no second scoring engine
// exists to drift from the first.
// T2 S50 · `mode` IS A REAL PARAMETER NOW, AND ITS ABSENCE WAS A FINDING.
// Rule 111 says a constant that appears at every call site of an experiment is a hidden parameter
// whose value silently qualifies every result. I wrote that rule in S49 about REFERENCE_POLICY and
// then pointed the same grep at my own harness, which found this: `initGame` takes a 4th argument for
// the game mode and NOT ONE balance harness has ever passed it. So every finding from S39 to S50 is
// Classic-only, while Flow is shipped and user-selectable with 9 production tiles instead of 12.
// Defaulting to undefined keeps every existing caller byte-identical (initGame's own default is
// DEFAULT_GAME_MODE), so this is a widening and not a change.
export function playOnce(configs, seed, mode, { recordCrossings = false } = {}) {
  useGameStore.setState(useGameStore.getInitialState(), true)
  const rng = makeRng(seed)
  api().initGame(configs, shuffled(PROJECT_CARDS, rng), shuffled(PRODUCTION_TILES, rng), mode)
  let lastPlacedKey = null
  const heldPrev = configs.map(() => 0)
  const grantOrder = []
  // T2 S53 · THE CROSSING SEQUENCE, in the order the crossings happen.
  // OPT-IN SINCE S54. Exactly one of playOnce's six consumers needs it (pileDepth.test.js), and a
  // shared instrument should not carry a single caller's cost by default.
  //
  // ⚠ AND THE PERFORMANCE ARGUMENT I MADE FOR THIS CHANGE WAS WRONG · MEASURED, IT COSTS NOTHING.
  // I closed S53 calling this sampler "O(seats x regions) per action on the hot path of every balance
  // experiment", which is true as a description and false as a concern. A 20-seed builder block, three
  // runs each:
  //     always-on   1260 / 1291 / 1251 ms      mean 1267.3
  //     opt-in off  1256 / 1247 / 1288 ms      mean 1263.7
  // 0.3% apart, inside a 40ms run-to-run spread. The instrument had the resolution to see the effect
  // I claimed · a 7.7% cost would have been ~97ms, more than twice the spread · so this is a real null
  // and not a noisy one.
  //
  // WORSE, AND THE REASON THIS NOTE IS THIS LONG: the first draft of this very comment quoted
  // "1174/1170/1163ms with it off, i.e. ~7.7%". I had not run the off case. I wrote a plausible
  // before/after into a comment that existed to justify the change, and only caught it because I then
  // ran the measurement anyway. A fabricated number inside a justification is worse than no number,
  // because it makes the change look already-validated (Rule 81; and S48's identical mistake, which I
  // wrote a rule about).
  //
  // THE CHANGE STANDS ON DESIGN, NOT SPEED: five experiments should not pay for one caller's data,
  // and the flag makes the dependency legible. That is a smaller claim than the one I set out with,
  // and it is the one the evidence supports.
  // Recorded so one game can be scored under ALTERNATE award rules offline. The bots read no bonus
  // state (asserted live in bonusBalance.test.js premise B, and botPolicy.js has zero references), so
  // changing WHO gets a token changes no decision · the game is identical and only the scoring
  // differs. That makes a rule comparison an EXACT control rather than a paired-seed statistical one
  // (Rule 74), the same property that made S48's flat-grant experiment decisive.
  // Final scores alone are not enough here: they give the SET of crossings but not their ORDER, and
  // every first-come-first-served rule is decided by order.
  const crossings = []
  const scorePrev = recordCrossings ? configs.map(() => ({})) : null

  for (let i = 0; i < 4000 && api().phase === 'playing'; i++) {
    const s = api(); const seat = s.currentSeat
    for (let k = 0; k < configs.length; k++) {
      const held = s.players.find(x => x.seat === k)?.bonusTokens.length ?? 0
      for (let n = heldPrev[k]; n < held; n++) grantOrder.push(k)
      heldPrev[k] = held
    }
    // Sample every seat's per-region score and record any threshold it has just passed. This is the
    // DEFINITION of a crossing (prev < t <= now), not a copy of the granter's award logic · and the
    // counterweight in pileDepth.test.js proves the derivation by replaying the SHIPPED rule against
    // it and requiring it to reproduce the real token counts exactly (Rule 36).
    if (recordCrossings) {
      for (let k = 0; k < configs.length; k++) {
        const sc = s.players.find(x => x.seat === k)?.scores ?? {}
        for (const [regionId, v] of Object.entries(sc)) {
          const before = scorePrev[k][regionId] ?? 0
          const now = v ?? 0
          if (now > before) {
            for (const t of [7, 13, 18]) if (before < t && now >= t) crossings.push({ seat: k, regionId, threshold: t })
            scorePrev[k][regionId] = now
          }
        }
      }
    }
    const a = chooseBotAction({
      state: api(), seat, difficulty: configs[seat].difficulty,
      getValidPlacements: api().getValidPlacements, getBuildableCards: api().getBuildableCards, lastPlacedKey, rng,
    })
    if (a.type === 'placeElement') { api().placeElement(seat, a.factoryId, a.elementType, a.q, a.r, a.regionId); lastPlacedKey = `${a.q},${a.r}` }
    else if (a.type === 'scoreCard') { api().scoreCard(seat, a.cardId, a.regionId, a.lastPlacedKey); lastPlacedKey = null }
    else if (a.type === 'drawCard') api().drawCard(seat, a.source, a.cardIndex)
    else { api().endTurn(); lastPlacedKey = null }
  }
  // Final sweep · a token granted by the LAST scoring action of the game would otherwise be missed,
  // because the loop samples holdings at the top of each iteration and there is no iteration after
  // the phase leaves 'playing'.
  const st = api()
  for (let k = 0; k < configs.length; k++) {
    const held = st.players.find(x => x.seat === k)?.bonusTokens.length ?? 0
    for (let n = heldPrev[k]; n < held; n++) grantOrder.push(k)
    // Final sweep for crossings too · a crossing caused by the LAST scoring action of the game would
    // otherwise be missed, for the same reason the token sweep above exists.
    if (recordCrossings) {
      const sc = st.players.find(x => x.seat === k)?.scores ?? {}
      for (const [regionId, v] of Object.entries(sc)) {
        const before = scorePrev[k][regionId] ?? 0
        const now = v ?? 0
        if (now > before) {
          for (const t of [7, 13, 18]) if (before < t && now >= t) crossings.push({ seat: k, regionId, threshold: t })
          scorePrev[k][regionId] = now
        }
      }
    }
  }
  return {
    grantOrder,
    crossings,
    // T2 S51 · `scores` and `pileClaimed` are ADDITIVE and exist for the four-player experiment.
    // The bonus granter drops a contested crossing SILENTLY · gameStore.js:487 does
    // `if (i >= 0) { claim }` with no else · so a player who crosses 7 in a region whose subsidy is
    // already gone gets nothing and nothing records that they tried. DEMAND is therefore not
    // observable from the grant log, and at four players sharing a nine-token pool it is the whole
    // question.
    // It IS observable from the final scores, exactly and without re-implementing the granter
    // (Rule 45): region scores only ever increase (scoreCard adds, nothing subtracts), so a final
    // score of S in a region means precisely the thresholds <= S were crossed at some point.
    scores: configs.map((_, seat) => ({ ...st.players.find(x => x.seat === seat).scores })),
    pileClaimed: (st.regions ?? []).reduce((n, r) => n + (r.bonusPile ?? []).filter(b => b.claimed).length, 0),
    pileTotal: (st.regions ?? []).reduce((n, r) => n + (r.bonusPile ?? []).length, 0),
    seats: configs.map((_, seat) => {
      const p = st.players.find(x => x.seat === seat)
      return {
        base: calculateFinalScore(p.scores, 0, getClusterTotal(st.regions, seat)),
        earned: p.bonusTokens.length,
        // T2 S51 · ADDITIVE, for the perceptibility check. The cluster total is 1 point per element
        // of this seat's colour in the biggest cluster per region (board rule p9), so it is a direct
        // proxy for how CLUMPED this player's board looks · which is the thing a person actually
        // sees, as against the win column. Taken from the real scoring function, not re-derived.
        cluster: getClusterTotal(st.regions, seat),
      }
    }),
  }
}

// THE FLAT DEAL · an even split, with a SELF-CORRECTING remainder.
//
// Two earlier versions of this were wrong and the history is kept because it is the whole lesson
// (Rule 110). V1 alternated the recipient once per game so the odd token "would not always land on
// seat 0" · but the caller flips its orientation once per game too, so the two alternations LOCKED IN
// PHASE and logical player A took the extra token in every single game. Measured: flatGap +0.50 in
// twelve of twelve rung-blocks, in the arm whose only job is to be even. V2 dropped the alternation
// and leaned on the orientation swap, which is unbiased in expectation but leaves a residual that
// GROWS AS THE BLOCK SHRINKS · correct at 40 seeds, red at 12, i.e. a flake with a delay on it.
//
// V3, here: when the total is odd the extra goes to whichever LOGICAL side has received fewer extras
// so far. The whole-block imbalance is therefore bounded at ONE TOKEN at any seed count, which is an
// identity rather than a tolerance · and identities do not need to be re-tuned when someone changes
// SPEND_SEEDS. A randomisation scheme that shares a period with the thing it balances against
// balances nothing; the fix was to stop randomising.
export function flatDeal(totalTokens, extras) {
  const half = Math.floor(totalTokens / 2)
  const deal = { a: half, b: half }
  if (totalTokens % 2) {
    if (extras.a <= extras.b) { deal.a++; extras.a++ } else { deal.b++; extras.b++ }
  }
  return deal
}

// Play `seeds` x 2 orientations ONCE each, and score every game BOTH ways · tokens as EARNED (the
// shipped rule) and tokens dealt FLAT.
//
// Every seed is played both ways round, which is load-bearing rather than tidy: it is what cancels
// any constant seat advantage in the engine, and an S48 mutation proved it (injecting +6 to seat 0's
// base changes no aggregate here, because seat 0 is A in one orientation and B in the other).
//
// levelA / levelB are difficulty strings OR the reference policy · this makes no assumption that one
// of them is a "reference", which is exactly the assumption S49 exists to remove.
export function ladderRow(levelA, levelB, seeds, mode) {
  let earnedWinsA = 0, earnedWinsB = 0, flatWinsA = 0, flatWinsB = 0
  let marginEarned = 0, marginFlat = 0, flips = 0, moved = 0
  let tokensA = 0, tokensB = 0, flatA = 0, flatB = 0, totalTokens = 0, games = 0
  let volumePreserved = true
  const extras = { a: 0, b: 0 }

  for (const seed of seeds) {
    for (const swap of [false, true]) {
      const configs = bots(swap ? levelB : levelA, swap ? levelA : levelB)
      const aSeat = swap ? 1 : 0, bSeat = 1 - aSeat
      const g = playOnce(configs, seed, mode)
      const earnedTok = [g.seats[0].earned, g.seats[1].earned]
      const deal = flatDeal(earnedTok[0] + earnedTok[1], extras)
      const flat = []
      flat[aSeat] = deal.a; flat[bSeat] = deal.b
      games++

      if (flat[0] + flat[1] !== earnedTok[0] + earnedTok[1]) volumePreserved = false
      if (flat[aSeat] !== earnedTok[aSeat]) moved++

      totalTokens += earnedTok[0] + earnedTok[1]
      tokensA += earnedTok[aSeat]; tokensB += earnedTok[bSeat]
      flatA += flat[aSeat]; flatB += flat[bSeat]

      const eA = g.seats[aSeat].base + 3 * earnedTok[aSeat]
      const eB = g.seats[bSeat].base + 3 * earnedTok[bSeat]
      const fA = g.seats[aSeat].base + 3 * flat[aSeat]
      const fB = g.seats[bSeat].base + 3 * flat[bSeat]

      marginEarned += eA - eB
      marginFlat += fA - fB
      if (eA > eB) earnedWinsA++; else if (eB > eA) earnedWinsB++
      if (fA > fB) flatWinsA++; else if (fB > fA) flatWinsB++
      if ((eA > eB) !== (fA > fB) || (eA === eB) !== (fA === fB)) flips++
    }
  }
  const pct = (w, l) => (w + l ? +(100 * w / (w + l)).toFixed(1) : 50)
  return {
    games, volumePreserved, moved, flips,
    winPctEarned: pct(earnedWinsA, earnedWinsB),
    winPctFlat: pct(flatWinsA, flatWinsB),
    marginEarned: +(marginEarned / games).toFixed(2),
    marginFlat: +(marginFlat / games).toFixed(2),
    earnedPerGameA: +(tokensA / games).toFixed(2),
    earnedPerGameB: +(tokensB / games).toFixed(2),
    earnGap: +((tokensA - tokensB) / games).toFixed(2),
    flatGap: +((flatA - flatB) / games).toFixed(2),
    tokensPerGame: +(totalTokens / games).toFixed(2),
    // THE STRUCTURAL PROPERTY, IN ABSOLUTE TOKENS RATHER THAN AS A RATE (T2 S49 · P4).
    // The flat arm's whole-block imbalance. flatDeal's self-correcting remainder bounds this at 1 by
    // construction, at ANY seed count · so a consumer can assert `<= 1` as an IDENTITY instead of
    // picking a tolerance on flatGap, which is the same number divided by a game count and therefore
    // needs re-tuning whenever the block size moves. S48 shipped the tolerance version and T3 caught
    // it red at a smaller block in the shared tree. Prove by identity, not by agreeing a bound
    // (Rule 81's better half).
    flatTokenImbalance: Math.abs(flatA - flatB),
    raw: { marginEarned: marginEarned / games, marginFlat: marginFlat / games,
      earnGap: (tokensA - tokensB) / games, flatGap: (flatA - flatB) / games },
  }
}

// A tiny convenience shared by both experiments' REPORT lines · vitest v4 only surfaces console.log
// on failure, so a passing run has to report through a file.
export function makeReporter(envVar) {
  return (label, obj) => {
    if (process.env[envVar]) {
      // eslint-disable-next-line no-undef
      require('node:fs').appendFileSync(process.env[envVar], JSON.stringify({ label, ...obj }) + '\n')
    }
  }
}
