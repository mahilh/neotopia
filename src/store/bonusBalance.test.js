import { test, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { useGameStore, PRODUCTION_TILES } from './gameStore'
import { PROJECT_CARDS } from '../lib/projectCards'
import { chooseBotAction, makeRng, DIFFICULTIES, REFERENCE_POLICY } from '../lib/botPolicy'
import { calculateFinalScore, getClusterTotal } from '../lib/patternMatcher'

// T2 S39 · DID BONUS TOKENS BREAK BALANCE?
//
// THE CONTROL IS EXACT, not statistical, and that is worth stating before any number. Bots never read
// or spend bonus tokens (grep: botPolicy.js and useBotTurns.js contain neither `bonusTokens` nor
// `useBonus`), so seeding the pile changes SCORING ONLY and cannot change a single decision. Each game
// is therefore played ONCE and scored TWO WAYS · with the tokens the player earned, and with that term
// forced to zero. Same games, same commit, same data, per Rule 74 · and unlike S35 there is not even a
// sampling difference between the arms.
//
// unusedBonusCount is the 2nd arg of calculateFinalScore and is worth 3 points each, so "unseeded" is
// exactly `calculateFinalScore(scores, 0, cluster)`. Nothing is simulated or approximated.

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// T2 S40 · THE GUARD THAT WATCHES ITS OWN ASSUMPTION
//
// Everything below this block measures a term worth a FLAT 3 POINTS EACH, because every token in the
// 360 games was UNSPENT · nothing calls useBonus. That is not a detail of the measurement, it is the
// measurement's premise, and the premise is the part with an expiry date. The day a control ships,
// a token stops being a constant and becomes a DECISION, and a decision is exactly the kind of term
// that rewards skill instead of diluting it. The finding below is "tokens help the weaker player"
// and its whole mechanism is signal-to-noise 0.23 · variance four times the mean edge. Spending
// converts variance into choice. THE SIGN CAN INVERT.
//
// The standing guard could not notice that. It watches the term's MAGNITUDE (tokenPointShare), which
// is unchanged by making the term spendable · a 3-point token is 3 points whether you chose it or
// not. So it would have stayed green on the exact day its own conclusion stopped being valid: a gate
// watching a number instead of watching its assumptions.
//
// This is the assumption, asserted. It is expected to FAIL the day T1 wires a control, and failing is
// the correct behaviour · the message says what to do rather than what broke.
//
// Two premises, not one, and they fail in different directions:
//   A · no PRODUCT code invokes useBonus  → tokens are unspent → the measured term is a flat constant
//   B · no BOT decision code reads tokens → seeding cannot change a decision → the control is EXACT
//       rather than statistical, which is the strongest property this experiment has (Rule 74).
// B breaking is the more dangerous of the two, because it does not change any number · it silently
// downgrades a same-game control into two different games, and nothing else would ever say so.

// join(cwd,'src') rather than import.meta.url · Vite rewrites the latter under vitest and it resolved
// to a bare '/src'. The counterweight's file-count floor is what caught that, on the first run.
const SRC_ROOT = join(process.cwd(), 'src') + '/'
const BOT_DECISION_FILES = ['lib/botPolicy.js', 'hooks/useBotTurns.js']

// The definition itself is not a call. Everything else that survives comment-stripping is.
const DEFINITION = /^\s*useBonus:\s*\(/

// Comment-strip then look for the identifier. Kept as a PURE FUNCTION of (name, source) so the
// positive control below can drive THIS code path rather than a second copy of it (Rule 45 · a
// re-implemented check is a second contract, and it is the copy that stays right).
function invokesUseBonus(source) {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => (DEFINITION.test(l) ? '' : l.replace(/(^|[^:])\/\/.*$/, '$1')))
    .join('\n')
  return /\buseBonus\b/.test(stripped)
}

function productSources(dir = SRC_ROOT, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { productSources(p, out); continue }
    if (!/\.jsx?$/.test(e) || /\.test\.|\.spec\./.test(e)) continue
    out.push([p.slice(SRC_ROOT.length), readFileSync(p, 'utf8')])
  }
  return out
}

// COUNTERWEIGHT FIRST (Rule 90). This assertion's only job is to fail in a scenario I am deliberately
// not creating, so it is the one line in the file that never gets to demonstrate it can · which is
// precisely the shape of the vacuous guard Rule 86 was written about. Written first, there is nothing
// else here for it to hide behind.
//
// The specific way the guard below could go quietly toothless is the comment-stripper: strip too much
// (an over-greedy block-comment regex, a `//` inside a string or a URL swallowing the rest of a real
// line) and every file reads as clean forever, green and meaningless. So the positive control does not
// use a tidy synthetic snippet · it takes a REAL product file, whole, comments, JSX, URLs and all, and
// appends one call. If the stripper mangles real source, this goes red here instead of lying there.
test('the premise check has teeth · a real product file with one added call is detected', () => {
  const files = productSources()
  expect(files.length, 'the scanner walked no files · a guard over an empty set is not a guard')
    .toBeGreaterThan(20)

  const pick = (suffix) => {
    const hit = files.find(([n]) => n.endsWith(suffix))
    expect(hit, `${suffix} was not among the ${files.length} files walked · the scan root is wrong, ` +
      'and a guard pointed at the wrong tree passes forever').toBeTruthy()
    return hit[1]
  }

  const real = pick('pages/GameRoom.jsx')
  expect(invokesUseBonus(real), 'GameRoom.jsx is the file most likely to gain the control first, and ' +
    'it must read as clean today or the guard is already broken').toBe(false)
  expect(invokesUseBonus(real + '\n  const spend = () => useBonus(seat, type)\n'),
    'the stripper eats real source · this guard would be green no matter what shipped').toBe(true)

  // And the definition is not a call · without this the guard is red from birth and gets deleted.
  expect(/^\s*useBonus:\s*\(/m.test(pick('store/gameStore.js')),
    'useBonus is gone · this whole file needs revisiting').toBe(true)
})

test('PREMISE · bonus tokens are still unspent and the bots are still token-blind', () => {
  const callers = productSources().filter(([, s]) => invokesUseBonus(s)).map(([n]) => n)
  expect(callers, [
    '',
    `PRODUCT CODE NOW CALLS useBonus (${callers.join(', ')}).`,
    '',
    'This is not a regression · it is the feature landing, and this guard exists to catch the day it',
    'does. But it invalidates docs/BONUS_TOKEN_BALANCE.md, which measured a term worth a flat 3 points',
    'each because every token was unspent. A spendable token is a DECISION, and the measured effect',
    '(tokens help the weaker player, -0.8 to -3.0 pts) rests entirely on the term being NOISE ·',
    'signal-to-noise 0.23. Choice converts noise into skill. THE SIGN MAY INVERT.',
    '',
    'RE-RUN, then update the doc and this test:',
    '  BALANCE_SEEDS=120 SEED_OFFSET=0|120|240 BALANCE_OUT=/tmp/bal.jsonl \\',
    '    npx vitest run src/store/bonusBalance.test.js --no-file-parallelism',
    '',
  ].join('\n')).toEqual([])

  // PREMISE B · the exactness of the control, which breaks silently and changes no number.
  for (const f of BOT_DECISION_FILES) {
    const src = readFileSync(join(SRC_ROOT, f), 'utf8')
    expect(/bonus/i.test(src), `${f} now reads bonus state, so seeding the pile can change a DECISION ` +
      'and not merely a score. The same-games control in this file is no longer exact · it is two ' +
      'different games, and every "identical play" claim in docs/BONUS_TOKEN_BALANCE.md must go.')
      .toBe(false)
  }
})

const api = () => useGameStore.getState()
const shuffled = (arr, rng) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// One complete game. Returns, per seat, everything needed to score it either way.
const withTokensRaw = (scores, tokens, cluster) => calculateFinalScore(scores, tokens, cluster)

function playOut(configs, seed) {
  useGameStore.setState(useGameStore.getInitialState(), true)
  const rng = makeRng(seed)
  api().initGame(configs, shuffled(PROJECT_CARDS, rng), shuffled(PRODUCTION_TILES, rng))
  let lastPlacedKey = null
  for (let i = 0; i < 4000 && api().phase === 'playing'; i++) {
    const s = api(); const seat = s.currentSeat
    const a = chooseBotAction({
      state: s, seat, difficulty: configs[seat].difficulty,
      getValidPlacements: s.getValidPlacements, getBuildableCards: s.getBuildableCards, lastPlacedKey, rng,
    })
    if (a.type === 'placeElement') { api().placeElement(seat, a.factoryId, a.elementType, a.q, a.r, a.regionId); lastPlacedKey = `${a.q},${a.r}` }
    else if (a.type === 'scoreCard') { api().scoreCard(seat, a.cardId, a.regionId, a.lastPlacedKey); lastPlacedKey = null }
    else if (a.type === 'drawCard') api().drawCard(seat, a.source, a.cardIndex)
    else { api().endTurn(); lastPlacedKey = null }
  }
  const st = api()
  return {
    phase: st.phase,
    seats: configs.map((_, seat) => {
      const p = st.players.find(x => x.seat === seat)
      const cluster = getClusterTotal(st.regions, seat)
      const tokens = p.bonusTokens.length
      return {
        tokens,
        // The term's own SIZE. Win rate saturates; points do not · this is what makes overpowering
        // detectable cheaply (see the guard below).
        tokenPoints: withTokensRaw(p.scores, tokens, cluster) - calculateFinalScore(p.scores, 0, cluster),
        total: calculateFinalScore(p.scores, 0, cluster),
        // The two arms. Identical inputs but for the term under test.
        withTokens: calculateFinalScore(p.scores, tokens, cluster),
        without: calculateFinalScore(p.scores, 0, cluster),
      }
    }),
  }
}

const bots = (...levels) => levels.map((difficulty, i) => ({ userId: null, username: `B${i}`, isBot: true, difficulty }))

// Seat-controlled: every seed is played with the matchup both ways round, so seat order cannot
// contribute. Draws are excluded from the denominator rather than counted as half.
function duel(weak, strong, seeds) {
  const acc = { withTokens: { wins: 0, decisive: 0 }, without: { wins: 0, decisive: 0 } }
  let tokenAdvantage = 0, games = 0
  // PAIRED counting · the two arms score the SAME game, so the margins are not independent samples and
  // comparing them as two proportions understates the instrument badly. What matters is the DISCORDANT
  // pairs: games the token term flipped, and which way. (McNemar's setup.)
  let flipToStrong = 0, flipToWeak = 0, shareNum = 0, shareDen = 0
  const diffs = []
  const OFF = Number(process.env.SEED_OFFSET || 0)
  for (let seed = 1 + OFF; seed <= seeds + OFF; seed++) {
    for (const flip of [false, true]) {
      const r = playOut(flip ? bots(strong, weak) : bots(weak, strong), seed)
      if (r.phase !== 'scoring') continue
      games++
      const S = flip ? r.seats[0] : r.seats[1]   // the strong policy
      const W = flip ? r.seats[1] : r.seats[0]
      tokenAdvantage += S.tokens - W.tokens
      diffs.push(S.tokens - W.tokens)
      shareNum += S.tokenPoints + W.tokenPoints
      shareDen += S.total + W.total
      const wWith = S.withTokens === W.withTokens ? null : S.withTokens > W.withTokens
      const wOut = S.without === W.without ? null : S.without > W.without
      if (wWith !== null && wOut !== null && wWith !== wOut) { wWith ? flipToStrong++ : flipToWeak++ }
      for (const arm of ['withTokens', 'without']) {
        if (S[arm] === W[arm]) continue
        acc[arm].decisive++
        if (S[arm] > W[arm]) acc[arm].wins++
      }
    }
  }
  const pct = a => (a.decisive ? +(a.wins / a.decisive * 100).toFixed(1) : null)
  return {
    withTokens: pct(acc.withTokens),
    without: pct(acc.without),
    delta: +(pct(acc.withTokens) - pct(acc.without)).toFixed(1),
    games,
    meanTokenAdvantageToStrong: +(tokenAdvantage / games).toFixed(2),
    sdTokenAdvantage: +Math.sqrt(diffs.reduce((s2, d) => s2 + (d - tokenAdvantage / games) ** 2, 0) / Math.max(1, diffs.length - 1)).toFixed(2),
    // The paired result. discordant = games the term decided at all.
    flippedToStrong: flipToStrong,
    flippedToWeak: flipToWeak,
    discordant: flipToStrong + flipToWeak,
    netFlips: flipToStrong - flipToWeak,
    // token points as a share of the score they are added to · the non-saturating magnitude signal
    tokenPointShare: +(shareNum / Math.max(1, shareDen)).toFixed(4),
  }
}

const SEEDS = Number(process.env.BALANCE_SEEDS || 25)

// THE TRIPWIRE, encoded rather than remembered · and SIZED, rather than asserted at the number that
// sounded right. The LLM council set it before any result existed: if the token term moves a ladder win
// rate by more than ~10 points, that is a rebalance session, not a feature session. Pre-committing it is
// the whole point, because a threshold chosen after seeing the result is not a threshold.
//
// THE ANSWER (360 seeds, three disjoint blocks): apprentice -2.4, builder -3.0, architect -0.8. All
// negative · tokens help the WEAKER player · replicated 9/9 cells, and significant when the paired
// discordant games are pooled within a matchup across independent blocks (builder p=0.0065, apprentice
// p=0.019). Well inside the tripwire, so the recommendation was NOT to stop feature work.
//
// BUT THE PER-RUNG DELTA IS NOT MEASURABLE AT A SAMPLE THIS SUITE CAN AFFORD, and asserting it anyway
// would have shipped a gate that flakes red on a healthy build · which is Rule 84's failure mode with
// the sign flipped. MEASURED before choosing: across eight 25-seed blocks the per-rung delta ranged to
// -10.2 (it would have tripped a 10-point wire once in eight runs, on working code); across six 60-seed
// blocks it still reached 8.3, for 20s a run. So:
//   · the MEAN of |delta| across the three rungs IS stable · it topped out at 5.3 over those same eight
//     blocks · so the 10-point tripwire is asserted on that.
//   · a per-rung CATASTROPHE bound of 20 catches a single rung collapsing without flagging sampling noise.
//   · the control assertions are exact at every sample tried: 50/50 with zero net flips in 8/8 blocks at
//     25 seeds and 6/6 at 60. They are the real guard.
// Reproduce the tight measurement: BALANCE_SEEDS=120 SEED_OFFSET=0|120|240 with BALANCE_OUT set.
const TRIPWIRE_POINTS = 10
const CATASTROPHE_POINTS = 20
// THE SHARP ONE, and the reason the two above are only a backstop. Win rate SATURATES: apprentice sits
// near 10% and architect near 98%, so both are pinned against a bound and can barely register a delta
// at all · averaging across them drags any win-rate statistic toward zero. Proven, not suspected:
// mutating the token term from 3 points to 12 · a fourfold overpowering · produced apprentice -8.0,
// builder -17.6, architect +0.0, for a mean of 8.5, and SAILED UNDER a 10-point wire. The first version
// of this guard had no teeth and I nearly shipped it.
// Points do not saturate. tokenPointShare is the token term as a fraction of the score it is added to,
// and it is near-constant: 0.105 to 0.137 across every rung and every 25-seed block measured. The 3->12
// mutation takes it to roughly 0.44. The band is wide enough never to flake and narrow enough that
// switching the term off (0.0) or multiplying it also fails.
const SHARE_MIN = 0.05
const SHARE_MAX = 0.20

test('bonus tokens do not decide the game · the token term stays inside the balance tripwire', () => {
  const out = { seeds: SEEDS, ladderVsFrozenReference: {}, control: null, tokenEffect: {} }

  // (b) the difficulty ladder, both arms.
  for (const level of DIFFICULTIES) out.ladderVsFrozenReference[level] = duel(REFERENCE_POLICY, level, SEEDS)
  // The vacuity check (Rule 86): identical policies must sit at 50 in BOTH arms, or the instrument
  // is measuring something other than skill.
  out.control = duel(REFERENCE_POLICY, REFERENCE_POLICY, SEEDS)

  // (c) does the player who crosses 7 more often simply win? Correlate the token differential with
  // the outcome, on games the token term actually DECIDED (flipped the winner).
  let flipped = 0, decidedGames = 0, flippedTowardMoreTokens = 0
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = playOut(bots('builder', 'architect'), seed)
    if (r.phase !== 'scoring') continue
    decidedGames++
    const [a, b] = r.seats
    const winnerWith = a.withTokens === b.withTokens ? null : (a.withTokens > b.withTokens ? 0 : 1)
    const winnerWithout = a.without === b.without ? null : (a.without > b.without ? 0 : 1)
    if (winnerWith !== null && winnerWithout !== null && winnerWith !== winnerWithout) {
      flipped++
      const moreTokens = a.tokens === b.tokens ? null : (a.tokens > b.tokens ? 0 : 1)
      if (moreTokens === winnerWith) flippedTowardMoreTokens++
    }
  }
  out.tokenEffect = {
    gamesScored: decidedGames,
    gamesWhereTokensFlippedTheWinner: flipped,
    flipRate: decidedGames ? +(flipped / decidedGames * 100).toFixed(1) : null,
    ofThoseFlipsWonByThePlayerWithMoreTokens: flippedTowardMoreTokens,
  }

  console.log('[balance] ' + JSON.stringify(out))
  // vitest v4 only surfaces console output on failure, so a run whose whole purpose is the NUMBER
  // would print nothing when it passes. BALANCE_OUT makes the measurement retrievable.
  if (process.env.BALANCE_OUT) {
    // eslint-disable-next-line no-undef
    require('node:fs').appendFileSync(process.env.BALANCE_OUT, JSON.stringify(out) + '\n')
  }

  // VACUITY FIRST (Rule 86 · the counterweight is the test most likely to be hollow). Two identical
  // policies must sit at 50 in BOTH arms. If this drifts, the instrument is measuring seat order or
  // the token term is favouring a SEAT, and every number below it is worthless.
  expect(out.control.withTokens, 'identical policies must tie in the seeded arm').toBe(50)
  expect(out.control.without, 'identical policies must tie in the unseeded arm').toBe(50)
  expect(out.control.netFlips, 'the token term must not systematically favour either seat').toBe(0)

  // THE TRIPWIRE. Direction is expected to be negative · tokens add variance that is only weakly
  // correlated with skill, so they help the underdog · but the magnitude is what decides whether this
  // is a balance question or a rebalance job.
  // MAGNITUDE FIRST · the assertion with actual teeth.
  for (const [level, r] of Object.entries(out.ladderVsFrozenReference)) {
    expect(r.tokenPointShare, `${level}: bonus tokens are ${(r.tokenPointShare * 100).toFixed(1)}% of the ` +
      'final score · the term has been re-weighted, and win rate is too saturated to notice')
      .toBeGreaterThanOrEqual(SHARE_MIN)
    expect(r.tokenPointShare, `${level}: bonus tokens are ${(r.tokenPointShare * 100).toFixed(1)}% of the ` +
      'final score · overpowered').toBeLessThanOrEqual(SHARE_MAX)
  }

  // The win-rate wire, kept as a COARSE backstop rather than the primary signal · see the note above.
  const deltas = Object.values(out.ladderVsFrozenReference).map(r => Math.abs(r.delta))
  const meanAbs = deltas.reduce((a, b) => a + b, 0) / deltas.length
  expect(meanAbs, `the token term moved the ladder by a mean of ${meanAbs.toFixed(1)} points, past the ` +
    `${TRIPWIRE_POINTS}-point tripwire · stop feature work and rebalance`)
    .toBeLessThanOrEqual(TRIPWIRE_POINTS)
  for (const [level, r] of Object.entries(out.ladderVsFrozenReference)) {
    expect(Math.abs(r.delta), `${level} alone moved ${r.delta} points · a single rung collapsing is a ` +
      'rebalance even when the mean looks calm').toBeLessThanOrEqual(CATASTROPHE_POINTS)
  }
}, 120_000)
