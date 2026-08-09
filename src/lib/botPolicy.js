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
const REFERENCE_DRAW_BIAS = 0.25   // FROZEN
// Reference behaviour, stated in words so it survives a refactor: always score a district when one is
// available, otherwise draw a card 25% of the time, otherwise place on a uniformly random legal hex.

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
const DRAW_BIAS = { apprentice: 0.05, builder: 0.30, architect: 0.55 }

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
  const level = (DIFFICULTIES.includes(difficulty) || difficulty === REFERENCE_POLICY)
    ? difficulty
    : DEFAULT_DIFFICULTY
  const drawBias = level === REFERENCE_POLICY ? REFERENCE_DRAW_BIAS : DRAW_BIAS[level]

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
  if (scorable.length && (level !== 'apprentice' || placements.length === 0)) {
    // Architect scores into its weakest region when it can · that region is multiplied by three.
    if (level === 'architect') {
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
    if (level === 'apprentice' || level === REFERENCE_POLICY) {
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
      if (level === 'architect' && p.regionId === worstRegion) score += 2
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
