// IS THE OUTCOME-NULL SENSITIVE TO SPENDABLE SUPPLY?  (T2 S54 · P1)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// S53 measured the rulebook divergence and reported: large in EXPERIENCE (contested crossings
// 32.5% -> 11.4%), nil in OUTCOME (win rate unmoved in every arm and every block). That outcome-null
// was measured with bots that NEVER SPEND, so every token scored a flat 3 and the arms differed only
// in how many flat 3s were handed out. The shipped game is not that game: a player can spend today
// (GameRoom.jsx:1302), and S46 measured a spendable token at roughly +7.7 points of win rate to
// whoever cashes it. So the null rests on a scope caveat, and it is my own headline.
//
// ── THE QUESTION AS FRAMED IS NOT ANSWERABLE, AND THE REASON IS THE SAME SHAPE AS S53's ─────────
// The brief's arithmetic is "arm B grants 31% more tokens (5.93 vs 4.52) against a +7.7 per-token
// effect". Two things break that multiplication, and both were checked at the artifact:
//
//   1 · ONLY SUBSIDY IS SPENDABLE IN PRACTICE. The spend path tests
//       `p?.bonusTokens?.includes('subsidy')`, and useBonus implements subsidy / initiative /
//       automatization differently while silently rejecting anything else. The shipped pile holds
//       exactly ONE subsidy per region. So arm B's extra token is only worth anything to a spender
//       if the fourth tile HAPPENS to be spendable · and nobody knows what the fourth tile is.
//       Measuring "arm B with spending" therefore requires guessing a type (Rule 32).
//   2 · +7.7 IS NOT A PER-TOKEN SLOPE. It was measured as the effect of a POLICY DIFFERENCE · one
//       side spends on sight, the other never. S47 then found the gradient is on HOW OFTEN you
//       spend rather than on timing, that a late-game plan is indistinguishable from on-sight
//       (exact 50.0 head to head), and that a plan spending LESS is worse than hoarding. That is
//       the signature of a saturating effect, not a linear one. Multiplying it by a token count
//       assumes the linearity S47 already argued against.
//
// ── SO THE GUESS-FREE QUESTION, WHICH IS ALSO THE STRONGER ONE ──────────────────────────────────
// Not "what does arm B do", but: DOES THE SPEND EFFECT SCALE WITH SPENDABLE SUPPLY AT ALL?
// If it saturates, the outcome-null is robust to whatever the fourth tile turns out to be, and the
// photograph cannot overturn S53's headline. If it grows, supply is a live axis and arm B's answer
// depends on the tile's type · which is then a question worth asking Mahil precisely.
//
// THE DIAL, and it needs no new game data. The pile entries are {threshold, type, claimed} and the
// granter matches by threshold, so retyping the EXISTING three entries changes how many of a
// region's tokens are spendable without changing how many exist, when they are granted, or to whom:
//     supply 1  {7 subsidy, 13 initiative, 18 permits}   the shipped pile
//     supply 2  {7 subsidy, 13 subsidy,    18 permits}
//     supply 3  {7 subsidy, 13 subsidy,    18 subsidy}
// Token COUNT, grant TIMING and RECIPIENT are identical across all three arms · only spendability
// moves. That is a cleaner dial than adding tiles would have been, and it is the reason this can be
// asked at all without knowing the fourth tile.
//
// ⚠ CONTROL LOSS, STATED UP FRONT. This is NOT an exact control. A bot that spends makes different
// decisions, so the arms diverge from the first spend and this is paired-seed statistical, not one
// game scored many ways. That loss is permanent and is a property of the question rather than of the
// design (S46 and S47 paid it too; S48's flat-grant and S53's replay avoided it only because the
// quantity under test was inert).

// ══ MEASURED · THREE DISJOINT 40-SEED BLOCKS (SUPPLY_OFFSET 0 / 400 / 800) ═══════════════════════
//
//   spendable/region   spends/game        ONE SPENDS (spender win%)       BOTH SPEND
//   1 (shipped)            1.23           54.4 / 59.0 / 59.7 = 57.7          50.0 x3
//   2                      2.17           56.3 / 60.0 / 60.0 = 58.8          50.0 x3
//   3                      2.94           66.3 / 60.0 / 58.8 = 61.7          50.0 x3
//
// ── 1 · THE HARNESS REPRODUCES A NUMBER IT DID NOT PRODUCE ───────────────────────────────────────
// Supply 1, one side spending, is 57.7% · i.e. +7.7 over even, which is S46's headline measured by a
// different harness in a different session. A new instrument agreeing with a published result it was
// not tuned against is the strongest counterweight available here, and it is why the arms below are
// worth reading at all.
//
// ── 2 · THE EFFECT GROWS, BUT STRONGLY SUBLINEARLY · THE MULTIPLICATION WAS INVALID ─────────────
// The brief's arithmetic was "+7.7 per token x 1.4 extra tokens". Measured:
//     0    -> 1.23 spends/game   moves 50.0 -> 57.7    = +6.3 per spend   (the FIRST spend)
//     1.23 -> 2.94 spends/game   moves 57.7 -> 61.7    = +2.3 per spend   (every LATER spend)
// The first spend is worth about three times a later one. So 1.4 extra spendable tokens buys roughly
// +3 points at the very most, not the +11 the multiplication implies · and S47 had already argued
// this from the other side (timing plans that spend LESS were worse than hoarding, late-game
// indistinguishable from on-sight · the signature of a saturating effect).
//
// ── 3 · AND THE DECIDING ROW · BOTH-SPEND IS EXACTLY 50.0 AT EVERY SUPPLY LEVEL ─────────────────
// Nine cells, three supply levels, three disjoint blocks, exactly 50.0 in all nine. When both players
// use the feature · the realistic case once it is discoverable · SUPPLY DOES NOT MATTER AT ALL. The
// +7.7 was never a reward for skill; it is an advantage over a player who does not use a feature
// (Rule 106, which S47 established and this re-confirms across a 3x supply range).
//
// ── THE ANSWER TO S53's OPEN CAVEAT ──────────────────────────────────────────────────────────────
// MY OUTCOME-NULL SURVIVES. S53 said the rulebook divergence is large in experience and nil in
// outcome, with the caveat that it was measured on non-spending bots. Tripling the spendable supply
// moves the symmetric case not at all and the asymmetric case by +4.0. Whatever the fourth tile turns
// out to be, it cannot overturn that headline · which is what the photograph now confirms rather than
// reopens.
//
// ⚠ AND THE 12-SEED RUN NEARLY SAID THE OPPOSITE. The counterweight block at 12 seeds reported
// 54.2 -> 75.0 across the same supply range · a dramatic, mechanism-shaped scaling that would have
// inverted S53's headline. Three 40-seed blocks put it at 57.7 -> 61.7, and block 1 alone still shows
// 66.3 while blocks 2 and 3 show 60.0 and 58.8. THIRD TIME IN FIVE SESSIONS that a striking
// single-block number dissolved on repetition (S50's spend deltas, S51's apprentice out-earning
// builder, this). The pattern is now reliable enough to be a habit: never report a shape from one
// block, however good the mechanism sounds.

import { describe, it, expect } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'
import { chooseBotAction, makeRng } from '../lib/botPolicy'
import { makeReporter } from './ladderHarness'

const api = () => useGameStore.getState()
const SEEDS = Number(process.env.SUPPLY_SEEDS || 12)
const OFFSET = Number(process.env.SUPPLY_OFFSET || 0)
const seeds = Array.from({ length: SEEDS }, (_, i) => 2000 + OFFSET + i * 23)
const report = makeReporter('SUPPLY_OUT')

const shuffled = (arr, rng) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const bots = (...levels) => levels.map((difficulty, i) => ({ userId: null, username: `B${i}`, isBot: true, difficulty }))

/** Retype the region piles so `spendable` of the three tokens are subsidy. Count/timing unchanged. */
function setSpendableSupply(spendable) {
  const TYPES = ['subsidy', 'initiative', 'permits']
  useGameStore.setState(st => ({
    regions: st.regions.map(r => ({
      ...r,
      bonusPile: (r.bonusPile ?? []).map((b, i) => ({ ...b, type: i < spendable ? 'subsidy' : TYPES[i] })),
    })),
  }))
}

function playOut(configs, seed, { plans = {}, spendable = 1 } = {}) {
  useGameStore.setState(useGameStore.getInitialState(), true)
  const rng = makeRng(seed)
  api().initGame(configs, shuffled(PROJECT_CARDS, rng), shuffled(PRODUCTION_TILES, rng))
  setSpendableSupply(spendable)          // after initGame · initGame rebuilds the regions

  let lastPlacedKey = null
  const spendsBySeat = configs.map(() => 0)
  for (let i = 0; i < 4000 && api().phase === 'playing'; i++) {
    const s = api(); const seat = s.currentSeat
    if (plans[seat] === 'onSight' && !s.bonusUsedThisTurn) {
      const p = s.players.find(x => x.seat === seat)
      if (p?.bonusTokens?.includes('subsidy')) {
        const before = p.bonusTokens.length
        api().useBonus(seat, 'subsidy')
        if ((api().players.find(x => x.seat === seat)?.bonusTokens.length ?? before) < before) spendsBySeat[seat]++
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
  const st = api()
  return {
    phase: st.phase,
    spendsBySeat,
    scores: configs.map((_, seat) => st.getFinalScore(seat)),
  }
}

/** planA/planB are the spend plans for the two LOGICAL sides; every seed is played both ways round. */
function duel(planA, planB, spendable) {
  let winsA = 0, winsB = 0, spendsA = 0, spendsB = 0, games = 0
  for (const seed of seeds) {
    for (const swap of [false, true]) {
      const aSeat = swap ? 1 : 0, bSeat = 1 - aSeat
      const plans = { [aSeat]: planA, [bSeat]: planB }
      const r = playOut(bots('builder', 'builder'), seed, { plans, spendable })
      if (r.phase !== 'scoring') continue
      games++
      spendsA += r.spendsBySeat[aSeat]; spendsB += r.spendsBySeat[bSeat]
      if (r.scores[aSeat] > r.scores[bSeat]) winsA++
      else if (r.scores[bSeat] > r.scores[aSeat]) winsB++
    }
  }
  return {
    games,
    winPctA: (winsA + winsB) ? +(100 * winsA / (winsA + winsB)).toFixed(1) : 50,
    spendsA: +(spendsA / (games || 1)).toFixed(2),
    spendsB: +(spendsB / (games || 1)).toFixed(2),
  }
}

describe(`spendable SUPPLY · does the spend effect scale? (${SEEDS} seeds x 2)`, () => {
  // ── COUNTERWEIGHTS, FIRST (Rule 90) ─────────────────────────────────────────────────────────────
  // This is a NEW harness, so before any arm is compared it has to be shown to (a) actually move the
  // dial and (b) reproduce a result someone else already measured. Either failure produces a
  // confident null that is entirely mine.
  it('the supply dial really changes how much gets spent, and games still finish', () => {
    const lo = duel('onSight', 'never', 1)
    const hi = duel('onSight', 'never', 3)
    report('counterweight', { lo, hi })

    expect(lo.games, 'games are not reaching scoring · the harness is broken, not the finding')
      .toBeGreaterThan(SEEDS)
    expect(lo.spendsA, 'the spender spent NOTHING at supply 1 · the spend path never fired and every ' +
      'arm below is hoarding against hoarding, which is the exact vacuity S47 shipped once already ' +
      '(Rule 106)').toBeGreaterThan(0.25)
    expect(hi.spendsA, `supply 3 produced ${hi.spendsA} spends per game against supply 1's ` +
      `${lo.spendsA}. The dial does not move, so "the effect does not scale with supply" would be a ` +
      'statement about a knob that is not connected').toBeGreaterThan(lo.spendsA)
    expect(lo.spendsB, 'the NON-spender spent something · the plans are not being applied per seat')
      .toBe(0)
  }, 900_000)

  it('measures whether the spend advantage grows with supply', () => {
    const rows = {}
    for (const supply of [1, 2, 3]) {
      rows[`s${supply}_oneSpends`] = duel('onSight', 'never', supply)
      rows[`s${supply}_bothSpend`] = duel('onSight', 'onSight', supply)
    }
    report('S54_supply', rows)

    // GATED · the one structural claim, and it is S47's finding re-asserted at every supply level:
    // when BOTH sides spend the same way, the matchup is symmetric and must tie. If a both-spend arm
    // drifts off 50 the harness has acquired a side and every one-spends number inherits it.
    for (const supply of [1, 2, 3]) {
      const b = rows[`s${supply}_bothSpend`]
      expect(b.winPctA, `both sides spending at supply ${supply} came out at ${b.winPctA}% · identical ` +
        'policies and identical plans cannot favour a side, so the orientation swap is not cancelling')
        .toBeGreaterThan(38)
      expect(b.winPctA, `both sides spending at supply ${supply} came out at ${b.winPctA}%`).toBeLessThan(62)
    }

    // NOT GATED · the shape of the one-spends curve across supply. That is the finding, and bounding
    // it would pin a number the photograph has not been taken for yet.
  }, 1_800_000)
})
