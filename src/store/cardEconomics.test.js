// THE CARD ECONOMY · what a player actually buys, measured before anybody prices anything (T2 S63)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Mahil has decided that cards will be BOUGHT from a per-player wallet of $1B rather than drawn free,
// and ruled that prices are DERIVED and not invented. A price is a claim about how many cards a
// player can afford, so the claim cannot be evaluated until somebody has counted how many a player
// takes. Nobody had. This file counts it on the game that exists.
//
// ⚠ WHAT THIS CAN AND CANNOT ANSWER, said first because the limit is the part that gets believed
// hardest (preamble §4). It measures the basket players take WHEN CARDS ARE FREE. Under a wallet
// they will take a different one · that is the entire point of charging for them · so this is not a
// prediction of behaviour and nothing here should be read as one. It is the only thing that CAN be
// measured today, and it is decisive for one question and one only: AT WHICH PRICE DOES THE WALLET
// FIRST BIND. A price below the cheapest observed basket constrains nobody and the wallet is
// decoration; a price above the dearest constrains everybody at every skill level. Those two numbers
// bracket every sane price, and they are facts about the current game rather than opinions about the
// next one. Rule 106 in advance: this is a measurement of ONE arm, so quote it against the arm.
//
// THE ACCOUNTING CLOSES, WHICH IS WHY THE NUMBERS CAN BE TRUSTED. A card enters a hand by being
// dealt or drawn and leaves it by being scored. The third door is useBonus (Government Subsidy draws
// two), and no bot opens it · botPolicy.js contains zero references to bonus state, which
// bonusBalance.test.js premise B asserts against the source on every run. So for every seat
//     dealt + drawsThatLanded  ===  scored + heldAtEnd
// and across the whole table every one of the 56 cards is in exactly one of four places. Both are
// asserted below rather than assumed, because the entire economics rests on them.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { playOnce, bots, makeReporter } from './ladderHarness'
import { WALLET_ENABLED } from './gameConfig'
import { DIFFICULTIES } from '../lib/botPolicy'
import { PROJECT_CARDS } from '../lib/projectCards'

const SRC_ROOT = join(process.cwd(), 'src') + '/'
const BOT_DECISION_FILES = ['lib/botPolicy.js', 'hooks/useBotTurns.js']

const SEEDS = Number(process.env.ECON_SEEDS || 10)
const OFFSET = Number(process.env.ECON_OFFSET || 0)
const seeds = Array.from({ length: SEEDS }, (_, i) => 4100 + OFFSET + i * 17)
const report = makeReporter('ECON_OUT')

const WALLET = 1_000_000_000            // Mahil's ruling · per player, not a shared pool
const DECK_SIZE = PROJECT_CARDS.length  // read, never typed · 56 today

const sum = a => a.reduce((n, x) => n + x, 0)
const mean = a => (a.length ? sum(a) / a.length : 0)
const q = (a, p) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const round = (x, n = 2) => +x.toFixed(n)
/** Counts of each value, as a plain object · this is the DISTRIBUTION the brief asked for. */
const histogram = (a) => {
  const h = {}
  for (const v of a) h[v] = (h[v] ?? 0) + 1
  return h
}

/**
 * Every seat of every game in one cell, flattened to one observation per PLAYER-GAME · which is the
 * unit a wallet is spent in. Returns the raw rows; every statistic below is derived from them, so
 * there is exactly one path from the engine to a number.
 */
function cell(levels, mode, { rotate = false } = {}) {
  const rows = []
  const games = []
  const n = levels.length
  for (const seed of seeds) {
    for (let rot = 0; rot < (rotate ? n : 1); rot++) {
      const order = levels.map((_, i) => levels[(i + rot) % n])
      const g = playOnce(bots(...order), seed, mode)
      games.push(g)
      for (let seat = 0; seat < n; seat++) {
        const s = g.seats[seat]
        const acquired = s.scoredPoints.length + s.handAtEnd
        rows.push({
          level: order[seat], seat,
          dealt: s.dealt,
          drawActions: s.drawActions,
          acquired,
          // A draw that opened a door and delivered nothing. drawCard spends the action and then
          // does deck.shift() unchecked, so this is possible by construction; it is reported rather
          // than assumed absent (Rule 114 · the silent no-op makes demand unmeasurable).
          refusedDraws: s.dealt + s.drawActions - acquired,
          scored: s.scoredPoints.length,
          held: s.handAtEnd,
          placeActions: s.placeActions,
          scoreActions: s.scoreActions,
          refusedScores: s.scoreActions - s.scoredPoints.length,
          // THE COLUMN THE PRICE IS AN EXCHANGE RATE BETWEEN, and the denominator is exactly two
          // terms because SCORING IS FREE. `actionsRemaining--` appears in placeElement and in
          // drawCard and NOWHERE ELSE · measured directly (actions 1 -> 1 across a successful
          // tryScoreCard), not read off a comment, because the comment at gameStore.js:402 calls it
          // a "place/draw/score counter" and that is what put a third term in here in the first
          // place. My own counterweight below caught it: the three-term sum exceeded the actions the
          // game had granted, which is impossible, and the draw share was understated everywhere.
          drawShare: s.drawActions / Math.max(1, s.drawActions + s.placeActions),
          scoredPoints: s.scoredPoints,
          heldPoints: s.handPoints,
          acquiredPoints: sum(s.scoredPoints) + sum(s.handPoints),
        })
      }
    }
  }
  return { rows, games, levels: [...levels], mode: mode ?? 'classic', seats: n }
}

/** The reported shape of one cell. Everything here is a statistic OF `rows`, never of the engine. */
function summarise({ rows, games, seats, mode }) {
  const acquired = rows.map(r => r.acquired)
  const scored = rows.map(r => r.scored)
  const held = rows.map(r => r.held)
  const allScoredPts = rows.flatMap(r => r.scoredPoints)
  const allHeldPts = rows.flatMap(r => r.heldPoints)
  // THE PRICE CURVE, and it is arithmetic rather than a model: a player who acquired A cards can
  // afford a uniform price P exactly while P <= WALLET / A. So WALLET/A is that player-game's
  // BREAKING PRICE, and the distribution of breaking prices IS the answer to "at price P, what
  // fraction of players would have run out". No behavioural assumption is added by this step; the
  // one behavioural assumption is stated at the top of the file and belongs to the basket itself.
  const breakUniform = rows.map(r => WALLET / Math.max(1, r.acquired))
  const breakPerPoint = rows.map(r => WALLET / Math.max(1, r.acquiredPoints))
  return {
    seats, mode, games: games.length, observations: rows.length,
    acquired: { mean: round(mean(acquired)), p10: q(acquired, 0.1), p50: q(acquired, 0.5), p90: q(acquired, 0.9),
      min: Math.min(...acquired), max: Math.max(...acquired), hist: histogram(acquired) },
    scored: { mean: round(mean(scored)), p10: q(scored, 0.1), p50: q(scored, 0.5), p90: q(scored, 0.9),
      min: Math.min(...scored), max: Math.max(...scored), hist: histogram(scored) },
    held: { mean: round(mean(held)), p50: q(held, 0.5), max: Math.max(...held), hist: histogram(held) },
    // The ratio the brief named: a price on a DRAW charges for the whole basket, not for the
    // buildings. If this is far from 1 the wallet is mostly buying speculation.
    acquiredPerScored: round(mean(acquired) / Math.max(1e-9, mean(scored))),
    pointMix: {
      scored: histogram(allScoredPts),
      held: histogram(allHeldPts),
      scoredMean: round(mean(allScoredPts)),
      heldMean: round(mean(allHeldPts)),
    },
    supply: {
      deckAtEnd: round(mean(games.map(g => g.deckAtEnd)), 1),
      offerAtEnd: round(mean(games.map(g => g.offerAtEnd)), 1),
      exhaustedPct: round(100 * games.filter(g => g.deckAtEnd === 0).length / games.length, 1),
      turns: round(mean(games.map(g => g.turnsPlayed)), 1),
    },
    priceAtWhichWalletBinds: {
      // Read as: at this uniform per-card price, that percentage of observed baskets became
      // unaffordable. `never` is the cheapest observed basket · below it the wallet does nothing.
      neverBinds: Math.round(Math.min(...breakUniform)),
      binds10pct: Math.round(q(breakUniform, 0.1)),
      binds50pct: Math.round(q(breakUniform, 0.5)),
      binds90pct: Math.round(q(breakUniform, 0.9)),
      alwaysBinds: Math.round(Math.max(...breakUniform)),
    },
    pricePerPointAtWhichWalletBinds: {
      neverBinds: Math.round(Math.min(...breakPerPoint)),
      binds50pct: Math.round(q(breakPerPoint, 0.5)),
      alwaysBinds: Math.round(Math.max(...breakPerPoint)),
    },
    refusedDrawsTotal: sum(rows.map(r => r.refusedDraws)),
    refusedScoresTotal: sum(rows.map(r => r.refusedScores)),
    actions: {
      draw: round(mean(rows.map(r => r.drawActions))),
      place: round(mean(rows.map(r => r.placeActions))),
      score: round(mean(rows.map(r => r.scoreActions))),
      drawSharePct: round(100 * mean(rows.map(r => r.drawShare)), 1),
    },
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHTS · FIRST AND ALONE (Rule 90)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('card economy · the accounting closes before any of it is read', () => {
  // 1 · CONSERVATION PER SEAT. If a card can enter a hand by a route this file does not know about,
  //     every acquisition figure is low and every derived price is high · in the direction that
  //     makes the wallet look roomier than it is, which is the comfortable error nobody audits.
  it('a seat cannot hold more cards than it was dealt plus the draws it took', () => {
    const g = playOnce(bots('builder', 'builder'), 4100)
    for (const s of g.seats) {
      const acquired = s.scoredPoints.length + s.handAtEnd
      expect(acquired, `seat holds ${acquired} cards against ${s.dealt} dealt + ${s.drawActions} ` +
        'draw actions · a card reached a hand by a route this measurement does not model, so every ' +
        'basket size below is wrong and the derived prices with them')
        .toBeLessThanOrEqual(s.dealt + s.drawActions)
      // T2 S67 · AND NOW IT IS AN EQUALITY, because the harness asks the ENGINE for each card and
      // reads its refusal instead of assuming one never happens. Before S67 the gap between the two
      // sides was UNATTRIBUTED · the file's own header claims `dealt + drawsThatLanded === scored +
      // heldAtEnd` and could only assert `<=`, so a lost draw and a correct game were the same
      // reading (Rule 114 · `if (found) { act }` with no else makes the shortfall unmeasurable).
      //
      // ⚠ AND THIS TERM RESTS AT ZERO UNDER BOT PLAY, which is exactly the shape Rule 132 is about:
      // chooseBotAction guards all four non-money refusals, so `<=` and `===` are the same assertion
      // on today's fixture and no mutation can tell them apart. It is written as the equality anyway
      // because the DAY they differ is the day the inequality silently absorbs a real defect · and
      // walletPriceSweep carries the positive control proving the engine can produce the refusal.
      expect(acquired + s.refusedByEngine, 'the conservation identity does not close: the engine ' +
        `refused ${s.refusedByEngine} draws and the shortfall is ` +
        `${s.dealt + s.drawActions - acquired} · those must be the same number, or a card left the ` +
        'accounting by a route neither the harness nor the engine reports')
        .toBe(s.dealt + s.drawActions)
    }
  })

  // 1b · THE FLAG-OFF GUARD FIRES (T2 S67). playOnce THROWS if handed a wallet arm while
  //      WALLET_ENABLED is false, because the engine would then charge 0 for every card and the arm
  //      would measure the FREE game under a price label · a complete, self-consistent, entirely
  //      wrong sweep (Rule 135).
  //
  //      IT IS TESTED HERE AND NOT WHERE IT IS USED, and that is the whole point. walletPriceSweep
  //      mocks the flag ON, so the guard is unreachable in the only file that passes a wallet · a
  //      mutation deleting it there stays green (measured, M2). A guard whose subject is absent from
  //      the environment it runs in is Rule 128, and the cheap fix is to assert it somewhere the
  //      subject exists. This file does not mock, so the flag really is false here.
  it('playOnce refuses a priced arm while the wallet flag is off', () => {
    expect(WALLET_ENABLED, 'this file mocks nothing, so the shipped flag must be false here · if it ' +
      'has been turned on, this guard is now unreachable everywhere and needs a new home').toBe(false)
    expect(() => playOnce(bots('builder', 'builder'), 4100, undefined, { wallet: { budget: 1e9 } }),
      'a wallet arm ran with the flag off and returned a result · every price it reports is 0')
      .toThrow(/WALLET_ENABLED is false/)
  })

  // 2 · CONSERVATION ACROSS THE WHOLE DECK. The stronger form, and it is the one that would catch a
  //     card being duplicated rather than lost. Every one of the 56 must be in exactly one of four
  //     places when the game stops: scored, in a hand, in the deck, or face-up in the offer.
  it('all 56 cards are somewhere when the game ends · none created, none destroyed', () => {
    // ⚠ THIS RAN ON A FOUR-PLAYER GAME AND COULD NOT FAIL ON ITS DECK TERM. Mutation M4 replaced
    // `deckAtEnd: st.deck.length` with a hardcoded 0 and the test stayed GREEN, because a 4-player
    // Classic game exhausts the deck in 58-98% of games (docs/CARD_ECONOMY.md §1) and this seed is
    // one of them. The mutation landed · the md5 changed · and the fixture happened to sit exactly
    // on the mutated value, so a term the assertion names was never exercised once (Rule 130 · ask
    // of a GREEN result how many ways it could have been produced).
    //
    // Two players, therefore, where the deck ends with 7 to 24 cards left · and the positive control
    // is asserted rather than assumed, because the whole point is that the term must be non-zero for
    // the sum to mean anything (Rule 120).
    const g = playOnce(bots('builder', 'builder'), 4100)
    expect(g.deckAtEnd, 'POSITIVE CONTROL · this game ended with an empty deck, so the deck term ' +
      'below contributes nothing and the conservation sum cannot detect a broken deck count. Pick ' +
      'a fixture whose deck survives, or this assertion is one term short of what it claims')
      .toBeGreaterThan(0)
    const inHands = sum(g.seats.map(s => s.scoredPoints.length + s.handAtEnd))
    expect(inHands + g.deckAtEnd + g.offerAtEnd,
      `${inHands} in play + ${g.deckAtEnd} deck + ${g.offerAtEnd} offer does not reconcile to the ` +
      `${DECK_SIZE}-card deck · the reading is not measuring the deck it names`).toBe(DECK_SIZE)
  })

  // 3 · VACUITY. Zero draws and zero scores would produce a perfectly consistent table of zeroes,
  //     and a price curve computed from it would divide by the deal alone and look plausible. The
  //     numbers must be built on players who actually did both things.
  it('players actually draw and actually score · otherwise the basket is just the deal', () => {
    const g = playOnce(bots('builder', 'builder'), 4100)
    for (const s of g.seats) {
      expect(s.drawActions, 'no seat drew a single card · the acquisition figure is the opening ' +
        'hand and nothing else').toBeGreaterThan(0)
      expect(s.scoredPoints.length, 'no seat scored · then the acquired:scored ratio is infinite ' +
        'and the point mix is empty').toBeGreaterThan(0)
      expect(s.placeActions, 'no seat placed an element · the action split reports a column of ' +
        'zeroes and the draw SHARE, which is the quantity a price is an exchange rate for, is 100%')
        .toBeGreaterThan(0)
    }
  })

  // 3b · THE ACTION COUNTERS HAVE TEETH IN BOTH DIRECTIONS. Vacuity above catches a counter stuck at
  //      zero; these catch one that counts too much, which is the failure that would inflate the
  //      draw share without looking wrong. Both are identities rather than observed rates.
  it('the action columns cannot exceed what the game granted, or undercount their own successes', () => {
    const g = playOnce(bots('builder', 'builder'), 4100)
    // SCORING IS FREE · so the budget is draws + placements and nothing else. This assertion was
    // written with a third term and went RED on its first run, which is how the free-scoring rule
    // was found: 102.6 actions taken against 85.8 granted is not a tight bound, it is impossible,
    // and the arithmetic said so before any code was read (Rule 81 · compute the constraint in the
    // test, not in your head).
    const spent = sum(g.seats.map(s => s.drawActions + s.placeActions))
    // turnNumber increments once per SEAT turn (endTurn advances currentSeat and turnNumber
    // together), each granting 3, and a seat may end early · so this is <= and never ==.
    expect(spent, `${spent} actions were taken across ${g.turnsPlayed} seat-turns, which grant at ` +
      `most ${g.turnsPlayed * 3} · either a column is double-counting and the draw share is ` +
      'inflated, or something has started charging an action for scoring')
      .toBeLessThanOrEqual(g.turnsPlayed * 3)
    for (const s of g.seats) {
      expect(s.scoreActions, 'more cards were scored than scoring was attempted · the attempt ' +
        'counter is not counting attempts, so refusedScores is meaningless')
        .toBeGreaterThanOrEqual(s.scoredPoints.length)
    }
  })

  // 4 · THE POINT LOOKUP RESOLVED. scoredPoints comes from a Map keyed on card id; a miss yields
  //     `undefined`, sum() then yields NaN, and NaN propagates into every price silently. A price
  //     of NaN is a number-shaped nothing (Rule 80) and it would be reported as one.
  it('every scored and held card resolved to a real point value', () => {
    const g = playOnce(bots('builder', 'builder'), 4100)
    const all = g.seats.flatMap(s => [...s.scoredPoints, ...s.handPoints])
    expect(all.length).toBeGreaterThan(0)
    expect(all.filter(p => ![2, 3, 4, 5].includes(p)),
      'a card resolved to something that is not a NeoTopia point value · the id->points lookup ' +
      'missed and every mean below is NaN or wrong').toEqual([])
  })

  // 5 · MODE IS A REAL PARAMETER. Rule 111 was written in this repository about exactly this: every
  //     balance harness passed no mode for eleven sessions, so Flow silently WAS Classic and a Flow
  //     column would have been a copy of the Classic one presented as a comparison.
  it('flow is a different game from classic on the same seed', () => {
    const c = playOnce(bots('builder', 'builder'), 4100, 'classic')
    const f = playOnce(bots('builder', 'builder'), 4100, 'flow')
    expect([f.turnsPlayed, f.deckAtEnd], `flow produced turns=${f.turnsPlayed} deck=${f.deckAtEnd} ` +
      `and classic produced turns=${c.turnsPlayed} deck=${c.deckAtEnd} · identical means the mode ` +
      'argument is being dropped and the Flow row below is the Classic row wearing a label')
      .not.toEqual([c.turnsPlayed, c.deckAtEnd])
  })

  // 7 · THE PREMISE OF THE WHOLE FILE, GUARDED · THESE BOTS DO NOT KNOW WHAT MONEY IS.
  //     Everything measured here is "the basket when cards are FREE", and that sentence is only true
  //     while no bot decision reads a wallet. The day a wallet-aware policy lands, every number in
  //     docs/CARD_ECONOMY.md silently becomes a measurement of a different game · no error, no red,
  //     and the doc goes on being quoted, which is exactly how a stale claim survives (Rule 97).
  //
  //     I ALMOST DID NOT WRITE THIS, and the reason is the interesting part. bonusBalance.test.js
  //     carries the identical guard for BONUS state and I checked whether it would cover me: it
  //     tests `/bonus/i` against these same files, so a wallet-aware bot passes it untouched. The
  //     existing guard's scope is its subject, not its shape, and inheriting protection from a
  //     neighbour's guard is a thing you have to CHECK rather than assume.
  //
  //     THE ALARM IS PRECISE AND THE REMEDY IS PROVISIONAL (Rule 98a): this says what stopped being
  //     true and who to ask. It deliberately does NOT say "re-run the measurement", because that is
  //     a guess about a future I cannot see · S43's guard fired correctly and then prescribed a
  //     re-run that would have replayed bit-identical games.
  it('PREMISE · no bot decision reads money · the basket measured here is the FREE-DRAW basket', () => {
    //     It matches COMMENTS as well as code, deliberately: bonusBalance's guard on these same two
    //     files does the same, and a guard that is quieter than the one beside it is the odd one out
    //     rather than the careful one. The cost is a red on a comment that merely mentions money,
    //     which is one human read of a message that explains itself · and any mention of money in a
    //     bot DECISION file is worth that read. Word-bounded, not a substring (Rule 112).
    const MONEY = /\b(wallet|afford|priceOf|CARD_PRICE|insufficient_funds)\b/i
    for (const f of BOT_DECISION_FILES) {
      const src = readFileSync(join(SRC_ROOT, f), 'utf8')
      // PRESENCE ANCHOR, in the same assertion block (Rule 125b): an absence-only check passes on an
      // empty file, a moved file or a typo'd path, and would then certify the premise forever.
      expect(src.length, `${f} read as empty · this guard would report "no bot reads money" about a ` +
        'file it never loaded, which is the vacuous pass Rule 125b exists to stop').toBeGreaterThan(500)
      expect(MONEY.test(src), `${f} now reads money, so a bot's DRAW decision can depend on what it ` +
        'can afford. Every figure in docs/CARD_ECONOMY.md is then a measurement of a game that no ' +
        'longer exists · it says of itself that it measures the basket "when cards are free". Do not ' +
        'assume the fix is a re-run: ask what the new policy budgets with, because a bot with a FIXED ' +
        'draw bias that simply stops when broke is one specific and rather poor budgeting strategy, ' +
        'and comparing it against an adaptive one is the actual open question (see ' +
        'docs/WALLET_AND_DEMOLITION_CONTRACT.md).').toBe(false)
    }
  })

  // 6 · FOUR SEATS REALLY PLAY. A four-player cell whose seats 2 and 3 never act is a two-player
  //     game with two spectators, and it would report a HALVED basket as a player-count effect.
  it('all four seats acquire cards in a four-player game', () => {
    const g = playOnce(bots('builder', 'builder', 'builder', 'builder'), 4100)
    expect(g.seats.length).toBe(4)
    const active = g.seats.filter(s => s.scoredPoints.length + s.handAtEnd > s.dealt).length
    expect(active, `${active} of 4 seats ever acquired a card beyond the deal · the rest never took ` +
      'a turn, and the per-player basket below would be an artifact of seating').toBe(4)
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE MEASUREMENT · reported, not gated. Nothing here is a pass/fail: what a basket SHOULD be is a
// design decision nobody has taken, and gating a number before the decision exists is how a wire
// sized from one run becomes a flake with a delay on it (Rule 111's corollary).
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe(`the basket · ${SEEDS} seeds x 12 cells (offset ${OFFSET})`, () => {
  it('measures what a player buys, across seats, modes and rungs', () => {
    const out = {}
    for (const mode of ['classic', 'flow']) {
      for (const n of [2, 4]) {
        for (const level of DIFFICULTIES) {
          out[`${mode}_${n}p_${level}`] = summarise(cell(Array(n).fill(level), mode))
        }
      }
    }
    // THE CONTESTED CELL. Every row above is self-play, which measures a rung's own appetite with a
    // mirror opponent. The deck is SHARED, so what a rung actually GETS depends on who it is sitting
    // opposite · and the brief's question ("a price tuned to one rung punishes the other") is about
    // exactly that. Rotated, so neither policy keeps the seat-0 advantage (Rule 111 · the constant
    // that never varies is the one that qualifies the result).
    out.classic_2p_architect_vs_apprentice = summarise(
      cell(['architect', 'apprentice'], 'classic', { rotate: true }))
    const mixed = cell(['architect', 'apprentice'], 'classic', { rotate: true })
    out.contested = Object.fromEntries(['architect', 'apprentice'].map(lvl => {
      const rs = mixed.rows.filter(r => r.level === lvl)
      return [lvl, { acquired: round(mean(rs.map(r => r.acquired))), scored: round(mean(rs.map(r => r.scored))),
        held: round(mean(rs.map(r => r.held))), points: round(mean(rs.map(r => r.acquiredPoints))) }]
    }))

    report(`S63_card_economy_offset_${OFFSET}`, out)

    // The whole table in one line per cell, for the run log. vitest v4 surfaces console.log only on
    // failure, so the durable copy is the reporter file above · this is for a watched run.
    for (const [k, v] of Object.entries(out)) {
      if (!v.acquired) continue
      // eslint-disable-next-line no-console
      console.log(`${k.padEnd(34)} acq ${String(v.acquired.mean).padStart(5)} ` +
        `[${v.acquired.min}-${v.acquired.max}] scored ${String(v.scored.mean).padStart(5)} ` +
        `held ${String(v.held.mean).padStart(5)} ratio ${v.acquiredPerScored} ` +
        `deckLeft ${v.supply.deckAtEnd} exhausted ${v.supply.exhaustedPct}% ` +
        `bind50 $${(v.priceAtWhichWalletBinds.binds50pct / 1e6).toFixed(1)}M`)
    }

    // ── THE ONLY STRUCTURAL ASSERTIONS IN THIS BLOCK ────────────────────────────────────────────
    // Not design numbers. Both are properties the measurement itself would be meaningless without.
    for (const [k, v] of Object.entries(out)) {
      if (!v.acquired) continue
      expect(v.observations, `${k} produced no observations`).toBeGreaterThan(0)
      expect(v.acquired.mean, `${k} reports a mean basket at or below the opening deal · every ` +
        'player-game in the cell drew nothing, which is not a finding about the economy but a ' +
        'broken cell').toBeGreaterThan(3)
    }
  }, 600_000)
})
