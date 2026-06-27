// NeoTopia game state · Zustand + Immer.
// This is the CLIENT-SIDE MIRROR of Supabase game_sessions.state (jsonb).
// RULE: the Supabase DB is the source of truth. syncFromServer() lets the server win.

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import { findBuildableCards, findLargestCluster, getClusterDetail as computeClusterDetail, getClusterTotal as computeClusterTotal, calculateFinalScore } from '../lib/patternMatcher'
import { hexesInRadius, REGIONS as REGION_DEFS } from '../utils/hexUtils'
import { TURN_TIME_LIMIT, DEFAULT_GAME_MODE, getModeConfig } from './gameConfig'

// Immer does not draft Map/Set unless this is enabled. pendingMoves is a Set that
// the optimistic-update flow mutates, so without this the first mutation throws.
enableMapSet()

// Production tile definitions (12 total · these are the game clock).
// When a factory empties, the top tile is consumed to refill it.
export const PRODUCTION_TILES = [
  { id: 0, elements: { energy: 2, biofarming: 1, technology: 1, community: 0 } },
  { id: 1, elements: { energy: 0, biofarming: 2, technology: 0, community: 2 } },
  { id: 2, elements: { energy: 1, biofarming: 0, technology: 2, community: 1 } },
  { id: 3, elements: { energy: 2, biofarming: 2, technology: 0, community: 0 } },
  { id: 4, elements: { energy: 0, biofarming: 1, technology: 2, community: 1 } },
  { id: 5, elements: { energy: 1, biofarming: 0, technology: 1, community: 2 } },
  { id: 6, elements: { energy: 2, biofarming: 0, technology: 2, community: 0 } },
  { id: 7, elements: { energy: 0, biofarming: 2, technology: 1, community: 1 } },
  { id: 8, elements: { energy: 1, biofarming: 1, technology: 0, community: 2 } },
  { id: 9, elements: { energy: 2, biofarming: 1, technology: 1, community: 0 } },
  { id: 10, elements: { energy: 0, biofarming: 0, technology: 2, community: 2 } },
  // Tile 11 = end-of-game flag tile (all 4 element types = 1 each).
  { id: 11, elements: { energy: 1, biofarming: 1, technology: 1, community: 1 }, isEndFlag: true },
]

export function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Region centers in the global axial frame (per CLAUDE.md). The first element placed
// in an empty region must land on its center; later ones must touch an existing element.
// bonusPile = this region's stack of bonus tokens awarded when the score marker crosses a
// threshold (top = index 0). Seeded EMPTY · fill from rulebook data in initGame once it exists.
const createInitialRegions = () => [
  { id: 0, name: 'Sacred City', center: { q: 0, r: 0 }, hexes: {}, lastBuiltIllustration: null, scores: {}, bonusPile: [] },
  { id: 1, name: 'Living Earth', center: { q: 8, r: -4 }, hexes: {}, lastBuiltIllustration: null, scores: {}, bonusPile: [] },
  { id: 2, name: 'Free Energy', center: { q: 4, r: 5 }, hexes: {}, lastBuiltIllustration: null, scores: {}, bonusPile: [] },
]

// Six axial neighbor directions (flat-top), shared by placement-adjacency checks.
const NEIGHBOR_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]

// Score-track positions that award a bonus token when the marker crosses them (CLAUDE.md).
const SCORE_THRESHOLDS = [7, 13, 18]

// Numerological milestones (T2 S15): when a player's TOTAL score (sum of all regions) crosses one of these
// sacred numbers, the store surfaces a one-shot `sacredMilestone` signal that T1 celebrates with a brief
// overlay. The game teaches numerology through play · never by announcing it. The symbol for 9 deliberately
// avoids the hexagram/Star-of-David (CLAUDE.md banned · Flower-of-Life lineage) · T1 may restyle the glyphs.
const SACRED_MILESTONE_NUMBERS = [7, 9, 13, 18, 27, 36]
const SACRED_MILESTONES = {
  7:  { message: 'Sacred Seven · Spiritual Perfection Awakens',      symbol: '✴' },
  9:  { message: 'Nine · Completion · The Ennead Speaks',            symbol: '✷' },
  13: { message: 'Thirteen · Sacred Feminine · Transformation',      symbol: '☽' },
  18: { message: 'Eighteen · Life Doubled · The District Breathes',  symbol: '⬡' },
  27: { message: 'Twenty-Seven · Three Nines · Mastery',             symbol: '△' },
  36: { message: 'Thirty-Six · The Four Elements Complete',          symbol: '◆' },
}

const createInitialFactories = () => [
  { id: 0, betweenRegions: [0, 1], q: 4, r: -2, elements: [] },
  { id: 1, betweenRegions: [1, 2], q: 6, r: 1, elements: [] },
  { id: 2, betweenRegions: [0, 2], q: 2, r: 3, elements: [] },
]

// Convert a production tile's element counts into a factory's element list.
function tileToFactoryElements(tile) {
  return Object.entries(tile.elements)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, count }))
}

// Pure draft mutation: refill `factoryId` from the top production tile.
// Defined at module scope so it can run INSIDE an existing Immer producer.
// (Calling a store action via get() from within set() would commit to a throwaway
// draft and silently lose the mutation · this avoids that.)
function refillFactoryDraft(state, factoryId) {
  const factory = state.factories.find(f => f.id === factoryId)
  if (!factory) return
  if (state.productionTilesRemaining === 0) return

  const discarded = state.productionTiles.shift()
  state.productionTilesRemaining--

  if (discarded?.isEndFlag || state.productionTilesRemaining === 0) {
    state.endGameTriggered = true
  }

  if (state.productionTiles.length > 0) {
    factory.elements = tileToFactoryElements(state.productionTiles[0])
  }
}

export const useGameStore = create(immer((set, get) => ({
  // State
  phase: 'lobby',
  roomId: null,
  players: [],
  currentSeat: 0,
  actionsRemaining: 3,
  bonusUsedThisTurn: false, // CLAUDE.md: only 1 bonus per turn · reset each endTurn
  turnNumber: 1,
  // Per-turn countdown (seconds) · reset to TURN_TIME_LIMIT each endTurn · synced via pushState so the
  // WAITING player sees the active player's clock (T3 S8 request). The per-second DECREMENT is LOCAL view
  // state in T1's component (gated on isMyTurn · never a pushState per tick · that would write-storm) ·
  // endTurn only RESETS it to a constant (no clock in the reducer · rule 32). gameConfig.TURN_TIME_LIMIT
  // is the single source for the value · T1 imports it for the cap.
  turnTimeRemaining: TURN_TIME_LIMIT,
  regions: createInitialRegions(),
  factories: createInitialFactories(),
  theOffer: [],
  deck: [],
  productionTiles: [],
  productionTilesRemaining: 12,
  endGameTriggered: false,
  endGameRoundsRemaining: 2,
  pendingMoves: new Set(), // optimistic-update tracking
  lastError: null,

  // Actions
  // mode (T2 S16): 'classic' (default · 12 tiles · 90s) or 'flow' (9 tiles · 15s). Reads getModeConfig — the
  // engine never hardcodes the numbers. mode is set on the state ONLY for a non-default mode (a LAZY field, like
  // sacredMilestone): a Classic game's serialized shape is byte-identical to before, so the E2E seededState
  // guard stays green WITHOUT a fixture edit, while a Flow game carries mode='flow' that syncs to both clients
  // (syncFromServer Object.assign). T3's createRoom passes the 4th arg + writes game_sessions.mode; a hydrating
  // client gets mode from the synced state. Reducers read getModeConfig(state.mode) (undefined → classic).
  initGame: (playerConfigs, shuffledDeck, shuffledTiles, mode = DEFAULT_GAME_MODE) => set(state => {
    const modeCfg = getModeConfig(mode)
    // Lazy + RESET: persist mode only for a non-default mode · and CLEAR any leftover mode on a default game
    // (initGame is a full reset · re-initializing Classic after a Flow game must not inherit mode='flow').
    // The default game therefore has no `mode` key at all → shape unchanged → seededState guard stays green.
    // undefined (not delete) for the default: JSON.stringify DROPS an undefined-valued key, so the serialized
    // shape the seededState guard pins has no `mode` key · and getModeConfig(undefined) falls back to Classic.
    state.mode = (mode && mode !== DEFAULT_GAME_MODE) ? mode : undefined
    state.phase = 'playing'
    state.players = playerConfigs.map((p, i) => ({
      seat: i,
      userId: p.userId,
      username: p.username,
      color: ['blue', 'red', 'green', 'purple'][i],
      hand: [],
      bonusTokens: [],
      scores: [0, 0, 0],
      scoredCardIds: [], // ids of cards this player scored · drives the FinalScore "Districts Built" record (T1 S6)
    }))
    state.deck = shuffledDeck
    // Pin the end-flag tile to the bottom regardless of how the caller shuffled, so
    // end-game triggers only when the stack is nearly exhausted (spec: the flag is last).
    // Then size the stack to the mode's END_GAME_TILE: Classic keeps all 12 (slice is a no-op on a 12-tile
    // deck), Flow keeps 9 → the game's clock (the existing remaining===0 trigger in refillFactoryDraft) ends
    // the game proportionally sooner. The end-game LOGIC is unchanged · only the stack length (the clock) is.
    const orderedTiles = [
      ...shuffledTiles.filter(t => !t.isEndFlag),
      ...shuffledTiles.filter(t => t.isEndFlag),
    ].slice(0, modeCfg.END_GAME_TILE)
    state.productionTiles = orderedTiles
    state.productionTilesRemaining = orderedTiles.length
    state.currentSeat = 0
    state.actionsRemaining = 3
    state.bonusUsedThisTurn = false
    state.turnNumber = 1
    state.turnTimeRemaining = modeCfg.TURN_TIME_LIMIT // mode-derived (Classic 90s · Flow 15s) · not hardcoded
    state.regions = createInitialRegions()
    state.factories = createInitialFactories()
    state.theOffer = []
    state.endGameTriggered = false
    state.endGameRoundsRemaining = 2

    // Deal 3 cards to each player.
    for (const player of state.players) {
      player.hand = state.deck.splice(0, 3)
    }
    // The Offer: 4 face-up cards.
    state.theOffer = state.deck.splice(0, 4)

    // Rulebook setup: each factory starts with exactly 1 of each element type.
    // Production tiles exist ONLY for refills (when a factory empties during play) ·
    // the stack is left untouched here so all 12 tiles drive the game clock.
    const STARTING_ELEMENTS = ['energy', 'biofarming', 'technology', 'community']
    state.factories.forEach(factory => {
      factory.elements = STARTING_ELEMENTS.map(type => ({ type, count: 1 }))
    })
  }),

  placeElement: (seat, fromFactoryId, elementType, toQ, toR, regionId) => set(state => {
    // Validate fully BEFORE mutating, so a rejected move never consumes an element.
    if (state.currentSeat !== seat) return
    if (state.actionsRemaining <= 0) return

    const factory = state.factories.find(f => f.id === fromFactoryId)
    if (!factory) return
    if (!factory.betweenRegions.includes(regionId)) return // factory must border the region

    const el = factory.elements.find(e => e.type === elementType && e.count > 0)
    if (!el) return

    const region = state.regions.find(r => r.id === regionId)
    if (!region) return

    const hexKey = `${toQ},${toR}`
    if (region.hexes[hexKey]?.element) return // hex must be empty

    // Placement rule (CLAUDE.md): first element in an empty region must be the center;
    // every later element must be adjacent to an existing one. Keeps each region a single
    // contiguous shape, which cluster scoring (BFS) and pattern matching both depend on.
    const regionHasElement = Object.values(region.hexes).some(h => h.element)
    if (!regionHasElement) {
      if (toQ !== region.center.q || toR !== region.center.r) return
    } else {
      const touchesExisting = NEIGHBOR_DIRS.some(([dq, dr]) => region.hexes[`${toQ + dq},${toR + dr}`]?.element)
      if (!touchesExisting) return
    }

    // Commit: pull from factory, place in region.
    el.count--
    if (el.count === 0) factory.elements = factory.elements.filter(e => e.count > 0)

    if (!region.hexes[hexKey]) region.hexes[hexKey] = {}
    region.hexes[hexKey].element = elementType

    // Bonus earn: covering a hex that carries a bonus token awards it to the placer. One-shot ·
    // the hex is now occupied and can never be covered again. (bonusType is seeded on hexes in
    // initGame from rulebook data · no hex carries one yet, so this is a no-op until that lands.)
    if (region.hexes[hexKey].bonusType) {
      const placer = state.players.find(p => p.seat === seat)
      if (placer) placer.bonusTokens.push(region.hexes[hexKey].bonusType)
    }

    state.actionsRemaining--

    // Auto-refill when the factory is emptied (runs on THIS draft · see refillFactoryDraft).
    const totalInFactory = factory.elements.reduce((sum, e) => sum + e.count, 0)
    if (totalInFactory === 0) {
      refillFactoryDraft(state, fromFactoryId)
    }

    // Buildable-card detection is informational · scoring is an explicit scoreCard action.
    // T1 reads getBuildableCards(regionId, hexKey) to highlight completions.
  }),

  // Draw a card · Flow mode makes the DRAW GATE turn-agnostic (T2 S17 Task A · simultaneous draw).
  drawCard: (seat, source, cardIndex) => set(state => {
    const player = state.players.find(p => p.seat === seat)
    if (!player) return

    const isCurrentSeat = state.currentSeat === seat
    // SIMULTANEOUS_DRAW (getModeConfig · classic=false · flow=true): in Flow, drawing is NOT gated by whose
    // turn it is — each player draws into their OWN hand within their own 15s window (Flow's defining mechanic).
    // Classic stays strictly turn-locked. The draw is deterministic (offer index / deck.shift on a deck shuffled
    // ONCE at init · host-authoritative + persisted · NO Math.random in this reducer · rule 32), so T3 can
    // serialize concurrent draw_card events server-side without divergence (the channel is the remaining seam).
    const simultaneous = getModeConfig(state.mode).SIMULTANEOUS_DRAW
    if (!isCurrentSeat && !simultaneous) return // classic / non-current → reject (classic behavior unchanged)

    // Action budget: actionsRemaining is the CURRENT turn-holder's single shared place/draw/score counter (the
    // engine is still turn-based). The current seat spends from it exactly as before. A non-current simultaneous
    // draw must NOT touch it — decrementing the active player's budget would corrupt their turn (rule 65 · the
    // composed seam). It is instead bounded by the shared deck/offer emptying; a true per-player action budget +
    // per-player 15s timer is the cross-lane Flow follow-up (engine + T3 channel · see comms · NOT this slice).
    // Only the DRAW GATE is turn-agnostic here · Flow is not yet fully simultaneous and the comment does not claim it.
    if (isCurrentSeat && state.actionsRemaining <= 0) return

    if (source === 'offer') {
      const card = state.theOffer[cardIndex]
      if (!card) return
      player.hand.push(card)
      state.theOffer.splice(cardIndex, 1)
      // Offer is replenished in endTurn().
    } else {
      const card = state.deck.shift()
      if (card) player.hand.push(card)
    }

    if (isCurrentSeat) state.actionsRemaining-- // only the active turn-holder spends an action (rule 65)
  }),

  // Score a card · returns true on a real award, false if rejected (wrong seat, card not in
  // hand, Diverse-City violation, or the pattern isn't actually complete on the board).
  // SINGLE OWNER of the scoring rule · the void scoreCard below delegates here.
  // lastPlacedKey ('q,r') is the just-placed hex · pass it to honor the completing-element rule.
  tryScoreCard: (seat, cardId, regionId, lastPlacedKey = null) => {
    // Validate against current state BEFORE mutating, so a rejected call changes nothing.
    const state = get()
    if (state.currentSeat !== seat) return false
    const player = state.players.find(p => p.seat === seat)
    const region = state.regions.find(r => r.id === regionId)
    if (!player || !region) return false

    const cardIdx = player.hand.findIndex(c => c.id === cardId)
    if (cardIdx === -1) return false
    const card = player.hand[cardIdx]

    // Diverse City: cannot build the same illustration consecutively in this region.
    if (region.lastBuiltIllustration === card.illustration) return false

    // Authoritative build check: the card's pattern must actually be completed on the
    // board (and include the completing hex, if given). Without this, any in-hand card
    // could be banked against any region for free points · the core scoring exploit.
    const matches = findBuildableCards(region.hexes, [card], region.lastBuiltIllustration, lastPlacedKey)
    if (matches.length === 0) return false

    set(s => {
      const p = s.players.find(p => p.seat === seat)
      const r = s.regions.find(r => r.id === regionId)
      if (!p || !r) return
      const idx = p.hand.findIndex(c => c.id === cardId)
      if (idx === -1) return
      p.hand.splice(idx, 1)
      const prevScore = p.scores[regionId] ?? 0
      p.scores[regionId] = prevScore + card.points
      // Record the built district for the end-game civilization record (FinalScore · T1 S6).
      // Guard for players seeded via setState without the field (older test fixtures).
      if (!Array.isArray(p.scoredCardIds)) p.scoredCardIds = []
      p.scoredCardIds.push(cardId)
      r.lastBuiltIllustration = card.illustration

      // Bonus earn: each score-track threshold newly crossed awards the TOP of this region's
      // bonus pile (rulebook: deterministic top-of-pile · NOT random). Pile is empty until
      // initGame seeds it from rulebook data, so this is a no-op until that data lands.
      for (const t of SCORE_THRESHOLDS) {
        if (prevScore < t && p.scores[regionId] >= t && r.bonusPile?.length > 0) {
          p.bonusTokens.push(r.bonusPile.shift())
        }
      }

      // Numerological milestone (T2 S15): fire when the player's TOTAL crosses a sacred number. Checked on the
      // TOTAL (sum of all regions · not per-region, which would fire too often) · the highest threshold crossed
      // by this score wins. Deterministic · rule-32 safe (no clock / random). Set LAZILY (never in initGame) so
      // the synced-state SHAPE the seededState guard pins stays unchanged · T1 reads s.sacredMilestone + clears it.
      const newTotal = Object.values(p.scores).reduce((sum, v) => sum + (v || 0), 0)
      const prevTotal = newTotal - card.points
      let crossed = null
      for (const t of SACRED_MILESTONE_NUMBERS) {
        if (prevTotal < t && newTotal >= t) crossed = t
      }
      if (crossed != null) {
        s.sacredMilestone = { player: seat, milestone: crossed, ...SACRED_MILESTONES[crossed] }
      }
    })
    return true
  },

  // Void wrapper · kept for callers that don't need the outcome. Delegates to tryScoreCard
  // so the scoring rule lives in exactly ONE place.
  scoreCard: (seat, cardId, regionId, lastPlacedKey = null) => {
    get().tryScoreCard(seat, cardId, regionId, lastPlacedKey)
  },

  factoryRefill: (factoryId) => set(state => {
    refillFactoryDraft(state, factoryId)
  }),

  endTurn: () => set(state => {
    // Replenish The Offer to 4 cards.
    while (state.theOffer.length < 4 && state.deck.length > 0) {
      state.theOffer.push(state.deck.shift())
    }

    // End-game round tracking: once triggered, each completed full round burns one
    // of the two remaining rounds. (Seat wrap to 0 marks a round boundary.)
    const nextSeat = (state.currentSeat + 1) % state.players.length
    if (state.endGameTriggered && nextSeat === 0 && state.endGameRoundsRemaining > 0) {
      state.endGameRoundsRemaining--
      if (state.endGameRoundsRemaining === 0) {
        state.phase = 'scoring'
      }
    }

    state.currentSeat = nextSeat
    state.actionsRemaining = 3
    state.bonusUsedThisTurn = false // fresh turn · the next player may use a bonus
    // Fresh turn budget · mode-derived (Flow resets to 15s, Classic to 90s) · synced to every client via
    // pushState. state.mode is the lazy field (undefined → classic). Still a CONSTANT from config, never a
    // clock read — rule 32 holds (no Date/random in the replayable reducer).
    state.turnTimeRemaining = getModeConfig(state.mode).TURN_TIME_LIMIT
    state.turnNumber++
  }),

  // Bonus tokens are FREE actions (do not consume actionsRemaining). The token is removed
  // ONLY if the bonus actually applies · a rejected bonus (e.g. an illegal initiative hex)
  // must never silently burn a token that is worth 3pts at game end.
  useBonus: (seat, bonusType, bonusData) => set(state => {
    const player = state.players.find(p => p.seat === seat)
    if (!player) return
    const tokenIdx = player.bonusTokens.indexOf(bonusType)
    if (tokenIdx === -1) return
    if (state.bonusUsedThisTurn) return // CLAUDE.md: only 1 bonus per turn · reject silently

    let consumed = false

    switch (bonusType) {
      case 'automatization': // one free extra action
        state.actionsRemaining++
        consumed = true
        break

      case 'subsidy': {
        // Government Subsidy: draw 2 cards · prefer The Offer (more choice), then the deck.
        // (Front cards for now · a future version can take chosen Offer indices via bonusData.)
        let drawn = 0
        while (drawn < 2 && state.theOffer.length > 0) { player.hand.push(state.theOffer.shift()); drawn++ }
        while (drawn < 2 && state.deck.length > 0) { player.hand.push(state.deck.shift()); drawn++ }
        consumed = drawn > 0 // nothing to draw → don't waste the token
        break
      }

      case 'initiative': {
        // Private Initiative: place ANY element (from reserve) into ANY region · no factory
        // constraint, but the same empty/center/adjacency rule as placeElement.
        // bonusData = { elementType, toQ, toR, regionId }
        if (!bonusData) break
        const { elementType, toQ, toR, regionId } = bonusData
        const region = state.regions.find(r => r.id === regionId)
        if (!region) break
        const hexKey = `${toQ},${toR}`
        if (region.hexes[hexKey]?.element) break // hex must be empty
        const regionHasElement = Object.values(region.hexes).some(h => h.element)
        if (!regionHasElement) {
          if (toQ !== region.center.q || toR !== region.center.r) break // first must be center
        } else {
          const touches = NEIGHBOR_DIRS.some(([dq, dr]) => region.hexes[`${toQ + dq},${toR + dr}`]?.element)
          if (!touches) break // later must be adjacent to an existing element
        }
        if (!region.hexes[hexKey]) region.hexes[hexKey] = {}
        region.hexes[hexKey].element = elementType
        consumed = true
        break
      }

      case 'permits': // place from a factory onto a free outer semicircle space · TODO (needs outer-space tracking)
      default:
        break
    }

    if (consumed) {
      player.bonusTokens.splice(tokenIdx, 1)
      state.bonusUsedThisTurn = true // one bonus per turn · reset in endTurn
    }
  }),

  // Called when Supabase realtime pushes updated state · server wins on conflicts.
  syncFromServer: (serverState) => set(state => {
    // pendingMoves is client-local optimistic-update bookkeeping and is not JSON-serializable
    // (a Set). Never let a server payload clobber it with an array · that would break the next
    // pendingMoves.add()/.has(). Merge everything else; rehydrate the Set deliberately.
    const { pendingMoves, ...serverGameState } = serverState
    Object.assign(state, serverGameState)
    if (pendingMoves !== undefined) {
      state.pendingMoves = new Set(Array.isArray(pendingMoves) ? pendingMoves : [])
    }
  }),

  setPhase: (phase) => set(state => { state.phase = phase }),

  // Dismiss the active numerological milestone (T2 S15). T1's GameRoom overlay calls this on auto-dismiss
  // (~2.5s) so the one-shot signal does not re-trigger. Lazy field · null when none is showing.
  clearMilestone: () => set(state => { state.sacredMilestone = null }),

  // Computed: buildable cards for the current player in a region.
  // Pass lastPlacedKey ('q,r') after a placement to honor the completing-element rule.
  getBuildableCards: (regionId, lastPlacedKey = null) => {
    const state = get()
    const player = state.players.find(p => p.seat === state.currentSeat)
    const region = state.regions.find(r => r.id === regionId)
    if (!player || !region) return []
    return findBuildableCards(region.hexes, player.hand, region.lastBuiltIllustration, lastPlacedKey)
  },

  // Computed: every hex in `regionId` where the current player could legally drop an
  // element from `factoryId` this turn. T1 renders these as validTargets · the rule is
  // owned here so the board layer can never drift from placeElement's own validation.
  // Uses static imports (hexesInRadius + REGION_DEFS) · an `await import()` inside this
  // synchronous selector would throw at call time.
  getValidPlacements: (factoryId, regionId) => {
    const state = get()

    // Gate: placement only when actions remain (mirrors placeElement's gate).
    if (state.actionsRemaining <= 0) return []

    const factory = state.factories.find(f => f.id === factoryId)
    if (!factory) return []
    if (!factory.betweenRegions.includes(regionId)) return [] // factory must border this region

    const region = state.regions.find(r => r.id === regionId)
    if (!region) return []

    const regionDef = REGION_DEFS.find(rd => rd.id === regionId)
    if (!regionDef) return []

    // All hexes that belong to this region (bounded by its radius).
    const allRegionHexes = hexesInRadius(regionDef.cq, regionDef.cr, regionDef.radius)

    const hasExistingElement = Object.values(region.hexes).some(h => h.element)

    // First placement in an empty region: only the center is legal (CLAUDE.md rule).
    if (!hasExistingElement) {
      return [{ q: region.center.q, r: region.center.r }]
    }

    // Later placements: hex must be empty AND adjacent to at least one existing element
    // (contiguous-region rule that cluster scoring + pattern matching both depend on).
    return allRegionHexes.filter(hex => {
      const key = `${hex.q},${hex.r}`
      if (region.hexes[key]?.element) return false // occupied
      return NEIGHBOR_DIRS.some(([dq, dr]) => region.hexes[`${hex.q + dq},${hex.r + dr}`]?.element)
    })
  },

  // Computed: largest same-element cluster in a region (final-scoring helper).
  getLargestCluster: (regionId, elementType) => {
    const region = get().regions.find(r => r.id === regionId)
    if (!region) return 0
    return findLargestCluster(region.hexes, elementType)
  },

  // Computed: per-region per-element cluster breakdown for the FinalScore visualization (T2 S17 · Task B).
  // Reads the SHARED board (regions · element-only, no per-hex placer → clusters are board-global) and
  // delegates to the pure computeClusterDetail (patternMatcher · reuses the existing BFS · rule 10). Returns
  // [{ regionId, regionName, element, count }] · count >= 2 · element is the lowercase ELEMENT_COLORS key.
  // INTENDED for FinalScore at phase==='scoring' (the board still holds the final layout) · NOT yet wired:
  // FinalScore imports neither the store nor regions today. PREFERRED delivery (review C5): T1 passes
  // regions={regions} (GameRoom already reads them reactively) + useMemo(()=>computeClusterDetail(regions),
  // [regions]) — the pure fn avoids the fresh-array-every-call Object.is churn a selector subscription causes.
  // This selector stays for non-React/imperative readers. DESCRIPTIVE sizes only · no cluster->points rule (rule 32).
  getClusterDetail: () => computeClusterDetail(get().regions),

  // Computed: the board's total cluster bonus (board game rule p9 · sum of getClusterDetail's per-cluster
  // bonus · the SAME flat number folded into every player's final score). Civilization-level: the board is
  // SHARED (no per-hex placer) so the bonus is not attributable per player (T2 S18 · see calculateFinalScore).
  getClusterTotal: () => computeClusterTotal(get().regions),

  // Computed: final score for a player (best + 2nd + worst*3 + unusedBonus*3 + clusterBonus).
  getFinalScore: (seat) => {
    const player = get().players.find(p => p.seat === seat)
    if (!player) return 0
    return calculateFinalScore(player.scores, player.bonusTokens.length, computeClusterTotal(get().regions))
  },
})))
