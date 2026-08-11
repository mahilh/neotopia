// NeoTopia bot policy · practice mode (T2 S32)
// ─────────────────────────────────────────────────────────────────────────────
// PURE. Given a store state snapshot and a seat, return ONE action descriptor. No store access, no
// timers, no DOM, no randomness that is not seeded. src/hooks/useBotTurns.js applies the result
// through the SAME store actions a human click uses, one action at a time, until endTurn · which is
// exactly how a person plays a turn, and it means a bot can never take a move a player could not.
//
// WHY IT TAKES ITS SELECTORS AS ARGUMENTS
// Legal placements and buildable cards are engine rules that already exist (gameStore.getValidPlacements
// and getBuildableCards, which delegate to patternMatcher). Reimplementing either here would be a second
// copy of the rules that drifts (CLAUDE.md: never reimplement patternMatcher). So they are injected: the
// driver passes the real store selectors, and so do the tests. This file decides WHAT to do, never what
// is legal.
//
// NO BOT SEES HIDDEN INFORMATION. Not one of the three levels reads another player's hand or the deck
// order. A bot that peeks is not a difficulty setting, it is a cheat, and a player feels it even when
// they cannot name it. Difficulty here is entirely about how well the bot uses what a human can also see.

export const DIFFICULTIES = ['apprentice', 'builder', 'architect']
export const DEFAULT_DIFFICULTY = 'builder'

// THE LADDER IS NOT EXPOSED IN THE UI YET, AND THAT IS A DECISION, NOT AN OMISSION (Mahil · S33).
// The three levels are ordered (proven below) but not CALIBRATED · 92/100/98% are bot-vs-bot rates,
// which show that architect beats builder, not that builder is a fair fight for a person. A spread
// that wide would teach badly: a player who loses 98-2 learns nothing and a player who wins 92-8
// learns less. So practice runs at DEFAULT_DIFFICULTY and there is no picker. T1: do not build one.
// It ships in the session it becomes honest.
export const DIFFICULTY_SELECTABLE = false

// ── THE REFERENCE OPPONENT · a fixed yardstick, deliberately NOT one of the three ────────────────
// The problem with the numbers above is that they are all self-referential: every level is measured
// against another level, so tuning any one of them silently moves the scale for the other two, and
// none of the rates means anything in human terms. That is why one human game cannot calibrate the
// ladder today · it would only tell us about whichever level was played.
//
// This is the fix, and it is the whole reason it exists: an opponent that NEVER CHANGES. Each level's
// win rate is stated against this, not against its siblings. Then a single human game against the
// reference locates the PLAYER on the same scale, and all three levels are calibrated at once,
// because their distances from the yardstick are already known.
//
// >>> DO NOT TUNE THESE TWO CONSTANTS. EVER. <<< Changing them invalidates every rate ever recorded
// against them, which is exactly the property that makes a benchmark worth having. If the reference
// turns out to be badly chosen, add reference_v2 and keep this one.
// It is not selectable as a difficulty (not in DIFFICULTIES) · it is a measuring instrument.
export const REFERENCE_POLICY = 'reference'
// Reference behaviour, stated in words so it survives a refactor: always score a district when one is
// available, otherwise draw a card 25% of the time, otherwise place on a uniformly random legal hex.
// The constants themselves live in POLICIES below and are pinned by botPolicyIdentity.test.js, so the
// "do not tune" instruction above is now a test rather than a comment (Rule 105a · a comment that is
// wrong goes red never).

// WHAT MEASUREMENT CHANGED (T2 S32 · this is the honest history of this file, keep it)
// The first version graded difficulty on PLACEMENT QUALITY: random < greedy-cluster < greedy plus
// worst-region defence. Measured with seat order controlled for (each matchup played both ways, so
// turn-order advantage cancels), greedy and random were indistinguishable · 44% vs 56%, i.e. noise.
// The first gate I wrote MISSED this because it only ran one seating, so it was measuring the seat
// advantage and would have passed with all three levels collapsed into one. I only found that by
// running the teeth check.
// Then a novice that "wastes" actions taking cards it does not need beat the greedy bot 85% of the
// time. That is not a bug in the bot, it is a fact about the game: with one shared action budget, a
// drawn card is a future district and a placed element is only a step toward one, so HAND SIZE
// dominates board tactics. Any difficulty ladder built on placement quality is measuring nothing.
// So the ladder is built on the lever that actually moves the result, and it is named honestly.
// >>> This is also a real design signal for Mahil: if drawing dominates placing, the action economy
//     is doing something the board is supposed to do. Worth a look. <<<
//
// ── THE LADDER AS A TABLE, NOT AS SCATTERED STRING COMPARISONS (T2 S50) ───────────────────────────
// Until S50 a "difficulty" was four separate `level === 'x'` tests spread through the decision
// function, and it read as ONE dial. It is not one dial, it is FOUR AXES, and that turned out to be
// the whole explanation for the ladder's shape: apprentice is not "builder with a lower draw bias",
// it is crippled on THREE axes at once (it draws almost never, it declines to score a finished
// district while it still has anywhere to place, and it places at random). Three handicaps stacked
// multiplicatively is why one step of difficulty was worth 94-6 rather than 65-35 · nobody chose that
// spread, it fell out of a representation that made the axes invisible.
//
// Writing them down separately costs nothing at runtime and makes the ladder MEASURABLE: an
// experiment can now hold three axes fixed and sweep the fourth, which is what S50 P1 does. It also
// makes the reference's position legible · see below.
//
//   drawBias     0..1 · chance of taking a card instead of placing, when a placement is available.
//                Higher = stronger. This is the axis that actually decides games (see the history
//                note above); the other three are much smaller.
//   scoreEager   take an available district immediately, rather than only when nothing is placeable.
//   placement    'random' = uniform legal hex · 'affinity' = most same-element neighbours (cluster
//                growth, board rule p9).
//   defendWorst  steer BOTH the scoring target and the placement toward the seat's weakest region,
//                which is the one multiplied by three in the final score.
//
// THE REFERENCE IS NOT OUTSIDE THE LADDER · IT IS A HYBRID RUNG INSIDE IT, and the table is what
// makes that obvious at a glance: builder's scoreEager, apprentice's placement, and a drawBias
// between the two. S49 measured every rung against it for five sessions and read the results as
// distances from a neutral yardstick; they were distances from an unnamed fourth rung (Rule 111).
// That does not make it a bad instrument · a frozen opponent is still the only way to compare a
// number recorded tonight with one recorded in S39 · but it is not a midpoint and must never be
// described as one.
// ── LADDER v2 · RETUNED T2 S50, ON MEASUREMENT, ON MAHIL'S EXPLICIT CALL ─────────────────────────
// v1 was apprentice {0.05, lazy, random} · builder {0.30, eager, affinity} · architect {0.55, eager,
// affinity, defendWorst}. Measured rung-against-rung for the first time in S49, it was unshippable:
//
//              v1 (shipped S32-S49)        v2 (here)          target
//   app v bld           6.3%                 33.5%            ~35%
//   bld v arc          15.2%                 31.6%            ~35%
//   app v arc           0.0%   <- 0 in 80    15.1%             --
//
// v2 numbers are the mean of THREE DISJOINT 40-seed blocks (32.5/35.4/32.5 · 34.2/29.5/31.2 ·
// 13.9/21.3/10.0), with every self-play control at exactly 50.0 and margin 0.00. Full table and the
// response curve behind it: docs/LADDER_CALIBRATION.md.
//
// WHAT CHANGED AND WHY EACH ONE:
//   BUILDER IS BYTE-IDENTICAL. It is DEFAULT_DIFFICULTY, so it is the only policy any human has ever
//     actually played against (practice mode has no picker), and moving it would change the one
//     experience that exists in order to fix two that do not. Its fingerprint in
//     botPolicyIdentity.test.js is unchanged from 3994d8d, which is the proof rather than the claim.
//   APPRENTICE loses only its PLACEMENT quality now, not three things at once. Measured, the three v1
//     handicaps were worth -16.35, -9.31 and -6.69 points of margin and they compose ADDITIVELY
//     (-32.35 predicted, -32.60 measured) · but win rate is a threshold on margin, so stacking three
//     small handicaps produced a 0-in-80 rout. Random placement alone is -9.31, which is the ~35%
//     step on its own.
//   APPRENTICE IS NOW scoreEager. A bot that holds a COMPLETED district while it still has somewhere
//     to place does not look weak, it looks broken · and it was the cheapest of the three handicaps
//     anyway. Difficulty should read as playing worse, never as malfunctioning.
//   ARCHITECT pays for its edge in drawBias (0.55 -> 0.39) and keeps defendWorst.
//
// ⚠ defendWorst IS WORTH ZERO WIN RATE, MEASURED. Builder+defendWorst against builder: 50.0%, margin
//   +3.00, over 80 games. The comment below calls it "the one genuinely strategic idea in the file"
//   and hedged that it was "a SMALL part of the gap" · it is not small, it is NIL as a win term. It is
//   kept because it gives architect a visible character (it steers toward the region being multiplied
//   by three) and costs nothing, and it is now labelled as flavour rather than as strength. Rule 73:
//   before concluding a mechanic matters, check whether it is capable of mattering.
//   ✅ T2 S51 · AND "VISIBLE CHARACTER" IS NOW MEASURED, NOT ASSERTED. When I wrote that sentence it
//   was a claim about human perception with no evidence, made in the same breath as demonstrating the
//   feature was worth nothing · which is the kind of thing that survives forever because it sounds
//   like a concession. Measured over three disjoint 40-seed blocks (ladderVisibility.test.js):
//   defendWorst, isolated on builder, takes a seat's REGION SPREAD from 15.2 to 7.7. It HALVES it.
//   So the axis worth exactly 0 win rate produces the largest board-shape difference in the ladder,
//   and drawBias · which is worth essentially the whole ladder · leaves almost no visual trace.
//   Win rate and board shape are close to orthogonal here, and that is worth knowing before anyone
//   "simplifies" this table by deleting the term that does not move the win column.
export const POLICIES = {
  apprentice:        { drawBias: 0.30, scoreEager: true,  placement: 'random',   defendWorst: false },
  builder:           { drawBias: 0.30, scoreEager: true,  placement: 'affinity', defendWorst: false },
  architect:         { drawBias: 0.39, scoreEager: true,  placement: 'affinity', defendWorst: true },
  // >>> FROZEN. Pinned by botPolicyIdentity.test.js. See the DO NOT TUNE block above. <<<
  // NOTE THE CONSEQUENCE, because it is not a defect and will look like one: the reference is
  // apprentice's policy with drawBias 0.25 instead of 0.30, so under v2 the WHOLE LADDER now beats it
  // (60.0 / 66.7 / 84.8). Under v1 the ladder straddled it (5.1 / 77.2 / 98.8). That is arithmetic,
  // not drift · rungs that are close to each other are close to any third party too, so calibrating
  // the ladder necessarily compressed its span against the yardstick from 94 points to 25. The
  // ordering against it is intact and strictly increasing, which is the property that makes it a
  // scale. It discriminates architect sharply and apprentice-from-builder poorly, and that is the
  // honest limitation of keeping it frozen · which is the right trade, because a yardstick that moves
  // is not one (Mahil, S50).
  [REFERENCE_POLICY]: { drawBias: 0.25, scoreEager: true, placement: 'random',   defendWorst: false },
}

/**
 * Resolve a `difficulty` argument to a policy.
 * Accepts a level NAME (the shipped path · practice mode passes a string), or an explicit policy
 * OBJECT, which is how an experiment sweeps one axis while holding the rest fixed. An unrecognised
 * name falls back to DEFAULT_DIFFICULTY, which is the pre-S50 behaviour and is relied on by callers
 * that pass `undefined` for a human seat.
 */
export function resolvePolicy(difficulty) {
  if (difficulty && typeof difficulty === 'object') {
    // Partial overrides are merged onto the default so a sweep can name ONLY the axis it varies ·
    // `{ drawBias: 0.4 }` must not silently reset scoreEager to undefined and take the apprentice
    // branch. Same defaulting as an unknown string, so the two entry points cannot disagree.
    return { ...POLICIES[DEFAULT_DIFFICULTY], ...difficulty }
  }
  return POLICIES[difficulty] ?? POLICIES[DEFAULT_DIFFICULTY]
}

// Deterministic PRNG · practice games must be reproducible so the win-rate gate in botPolicy.test.js
// measures the POLICY and not the luck of a particular run (rule 32 · never Math.random in game logic).
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5;  s >>>= 0
    return s / 4294967296
  }
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length]

/** Every (factory, element, region, hex) the seat could legally play right now. */
export function enumeratePlacements(state, getValidPlacements) {
  const out = []
  for (const factory of state.factories ?? []) {
    const available = (factory.elements ?? []).filter(e => e.count > 0)
    if (available.length === 0) continue
    for (const regionId of factory.betweenRegions ?? []) {
      const hexes = getValidPlacements(factory.id, regionId) ?? []
      if (hexes.length === 0) continue
      for (const el of available) {
        for (const hex of hexes) {
          out.push({ factoryId: factory.id, elementType: el.type, regionId, q: hex.q, r: hex.r })
        }
      }
    }
  }
  return out
}

/** Size of the seat's own weakest region score · the x3 term, and the only number worth defending. */
function weakestRegionIndex(player) {
  const scores = player?.scores ?? [0, 0, 0]
  let worst = 0
  for (let i = 1; i < scores.length; i++) if (scores[i] < scores[worst]) worst = i
  return worst
}

/** How many same-element neighbours a hex would have · a cheap proxy for cluster growth (board rule p9). */
function neighbourAffinity(state, regionId, q, r, elementType) {
  const region = (state.regions ?? []).find(x => x.id === regionId)
  if (!region) return 0
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  let n = 0
  for (const [dq, dr] of DIRS) {
    if (region.hexes?.[`${q + dq},${r + dr}`]?.element === elementType) n++
  }
  return n
}

/**
 * Decide this bot's next single action.
 * @returns {{type:'scoreCard'|'placeElement'|'drawCard'|'endTurn', ...}}
 */
export function chooseBotAction({
  state, seat, difficulty = DEFAULT_DIFFICULTY,
  getValidPlacements, getBuildableCards,
  lastPlacedKey = null, rng = makeRng(1),
}) {
  const player = (state.players ?? []).find(p => p.seat === seat)
  if (!player) return { type: 'endTurn' }
  if (state.phase !== 'playing') return { type: 'endTurn' }
  if ((state.actionsRemaining ?? 0) <= 0) return { type: 'endTurn' }

  // REFERENCE_POLICY is accepted here but is absent from DIFFICULTIES, so it can never be selected as
  // a difficulty · it exists only so the ladder can be measured against something that does not move.
  const policy = resolvePolicy(difficulty)
  const drawBias = policy.drawBias

  // 1 · SCORE. A completed district is the only thing that actually wins, so Builder and Architect
  //     always take one. Apprentice takes it only when it has nothing else to do, which is what makes
  //     it beatable without making it behave randomly enough to look broken.
  const regionIds = (state.regions ?? []).map(r => r.id)
  const scorable = []
  for (const regionId of regionIds) {
    for (const card of getBuildableCards(regionId, lastPlacedKey) ?? []) {
      scorable.push({ type: 'scoreCard', seat, cardId: card.id ?? card.cardId, regionId, lastPlacedKey })
    }
  }
  const placements = enumeratePlacements(state, getValidPlacements)
  if (scorable.length && (policy.scoreEager || placements.length === 0)) {
    // Architect scores into its weakest region when it can · that region is multiplied by three.
    if (policy.defendWorst) {
      const target = regionIds[weakestRegionIndex(player)]
      return scorable.find(s => s.regionId === target) ?? scorable[0]
    }
    return scorable[0]
  }

  // 2 · PLACE.
  if (placements.length) {
    // DRAW BIAS · the axis that actually decides these games, and it was NOT the one I designed on.
    // See the header note "WHAT MEASUREMENT CHANGED". Higher = takes a card instead of building more
    // often = stronger, because a bigger hand is more completable districts later.
    if (rng() < drawBias) {
      if ((state.theOffer ?? []).length > 0) return { type: 'drawCard', seat, source: 'offer', cardIndex: 0 }
      if ((state.deck ?? []).length > 0) return { type: 'drawCard', seat, source: 'deck', cardIndex: 0 }
    }
    // Apprentice and the reference both place at random · they differ only in draw bias and in
    // whether they take an available district, which keeps the yardstick simple to describe.
    if (policy.placement === 'random') {
      return { type: 'placeElement', seat, ...pick(placements, rng) }
    }

    const worstRegion = regionIds[weakestRegionIndex(player)]
    let best = null, bestScore = -Infinity
    for (const p of placements) {
      let score = neighbourAffinity(state, p.regionId, p.q, p.r, p.elementType)
      // Architect additionally pulls play toward the region that is dragging its total down · worst x3
      // is the whole scoring formula. Measured honestly, this is a SMALL part of the Builder/Architect
      // gap; DRAW_BIAS above is most of it. Kept because it is the one genuinely strategic idea in the
      // file and it costs nothing, not because the numbers say it is decisive.
      if (policy.defendWorst && p.regionId === worstRegion) score += 2
      if (score > bestScore) { bestScore = score; best = p }
    }
    return { type: 'placeElement', seat, ...best }
  }

  // 3 · DRAW. Nothing placeable · take a card so the hand can complete a district later. Prefer the
  //     offer (visible to everyone, so this leaks nothing) and fall back to the deck.
  if ((state.theOffer ?? []).length > 0) return { type: 'drawCard', seat, source: 'offer', cardIndex: 0 }
  if ((state.deck ?? []).length > 0) return { type: 'drawCard', seat, source: 'deck', cardIndex: 0 }

  // 4 · Nothing left to do this turn.
  return { type: 'endTurn' }
}
