// NeoTopia game state · Zustand + Immer.
// This is the CLIENT-SIDE MIRROR of Supabase game_sessions.state (jsonb).
// RULE: the Supabase DB is the source of truth. syncFromServer() lets the server win.

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import { findBuildableCards, getClusterDetail as computeClusterDetail, getClusterTotal as computeClusterTotal, calculateFinalScore } from '../lib/patternMatcher'
import { hexesInRadius, REGIONS as REGION_DEFS } from '../utils/hexUtils'
import { TURN_TIME_LIMIT, DEFAULT_GAME_MODE, getModeConfig, STARTING_WALLET, CARD_PRICE, priceOf, WALLET_ENABLED } from './gameConfig'

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
// bonusPile = the bonus tokens this region awards when a player's score marker crosses a threshold.
// SEEDED FROM THE RULEBOOK (T2 S38 · docs/NEOTOPIA_GAME_RULEBOOK.md:115-125), which names a specific
// token per threshold rather than a shuffled stack:
//     7  Soul Crystal (carnelian)  · Government Subsidy   → 'subsidy'
//     13 Heart Crystal (rose quartz) · Private Initiative → 'initiative'
//     18 Amethyst Crown           · New Building Permits  → 'permits'
// It sat EMPTY from S15 to S38, which is why no player has ever held a bonus token: the granter in
// scoreCard was correct and had nothing to give. This is real data from the repo's own rulebook, not
// invented · rule 32 forbids baking guessed game data and this is not guessed.
//
// The FOURTH type, 'automatization', is NOT a score-track reward. It comes from the bonus HEXES printed
// on the board, and their (q,r) coordinates are the item still outstanding from Mahil. That layer stays
// unwired rather than approximated.
//
// `claimed` rather than removal, so the pile stays a stable-length record of what a region offers and
// what has gone · a shift() would make "this region has no 18-token left" indistinguishable from
// "this region never had one". Plain JSON, so it survives the broadcast round trip (rule 22).
const createRegionBonusPile = () => [
  { threshold: 7, type: 'subsidy', claimed: false },
  { threshold: 13, type: 'initiative', claimed: false },
  { threshold: 18, type: 'permits', claimed: false },
]

// DERIVED FROM hexUtils.REGIONS, not typed here (T2 S64 · routed by T1 S63 after their rename).
//
// This list was a hand-written second copy of TWO things the board already owns · the region NAME
// and the region CENTRE · and the names had gone stale in a way that reached a player. T1 renamed
// the regions to Water / Forest / Desert District; `patternMatcher.getClusterDetail` stamps
// `regionName: region.name` off THESE objects, and FinalScore rendered it. So a finished game showed
// a board saying "Water District" and a score row underneath saying "Sacred City", with nothing red
// anywhere. T1 made their side read REGION_NAMES with a fallback, so the screen was already correct
// at HEAD; this makes the store stop being the wrong answer to "what is region 1 called".
//
// The centres were the quieter half and are the reason this is a bind rather than three string
// edits: `center: {q,r}` duplicated `cq/cr` exactly, so the store held a second copy of the board's
// geometry with nothing checking the two agreed (Rule 45). Deriving both removes the class.
const createInitialRegions = () => REGION_DEFS.map(r => ({
  id: r.id,
  name: r.name,
  center: { q: r.cq, r: r.cr },
  hexes: {},
  lastBuiltIllustration: null,
  scores: {},
  bonusPile: createRegionBonusPile(),
}))

// Six axial neighbor directions (flat-top), shared by placement-adjacency checks.
const NEIGHBOR_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]

// Score-track positions that award a bonus token when the marker crosses them (CLAUDE.md).
const SCORE_THRESHOLDS = [7, 13, 18]

// Numerological milestones (T2 S15): when a player's TOTAL score (sum of all regions) crosses one of these
// sacred numbers, the store surfaces a one-shot `sacredMilestone` signal that T1 celebrates with a brief
// overlay. The game teaches numerology through play · never by announcing it. The symbol for 9 deliberately
// avoids the hexagram/Star-of-David (CLAUDE.md banned · Flower-of-Life lineage) · T1 may restyle the glyphs.
const SACRED_MILESTONE_NUMBERS = [7, 9, 13, 18, 27, 36]
// Sacred score thresholds. The numbers and the glyphs carry the mystery-school meaning (7 spiritual
// perfection · 9 the Ennead · 13 transformation · 18 life doubled · 27 three nines · 36 the four
// elements) and are FIXED · they are the esoteric spine of the game and never change.
// The MESSAGE is the one part a player actually reads, so it is written for someone who has never
// heard of any of that: plain city-builder language about what just happened on their board. The
// meaning is still there, said in the open rather than in code words (T2 S27). MilestoneOverlay
// renders symbol + message straight from here (Rule 62) · this table is the single source of truth.
const SACRED_MILESTONES = {
  7:  { message: 'Seven points · your first district takes shape',           symbol: '✴' },
  9:  { message: 'Nine points · a quarter of the city, finished',            symbol: '✷' },
  13: { message: 'Thirteen points · no longer the plan you started with',    symbol: '☽' },
  18: { message: 'Eighteen points · people live here now',                   symbol: '⬡' },
  27: { message: 'Twenty-Seven points · you build like a veteran',           symbol: '△' },
  36: { message: 'Thirty-Six points · all four elements in balance',         symbol: '◆' },
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

  // The clock may have reached its final tile WHILE the Flow deck was already empty (this is one of the two
  // orderings that complete the soft-lock · see maybeForceFlowEndgame). Re-check after every refill.
  maybeForceFlowEndgame(state)
  // A refill that could not happen (tiles exhausted) is exactly when the board can go dead, so the
  // deadlock check belongs here too · not only at end of turn. Catching it on the placement means a
  // player who is about to be stuck is already in the endgame rather than one turn behind it.
  maybeForceDeadlockEndgame(state)
}

// Flow soft-lock guard (T2 S19). Flow mode's simultaneous draw (getModeConfig.SIMULTANEOUS_DRAW) lets every
// seat draw every window, so the whole deck+offer can drain into players' hands BEFORE the production-tile
// clock runs out. The clock — the ONLY thing that sets endGameTriggered (refillFactoryDraft above) — advances
// only when a factory empties on a placement. If placements stall (S18 bot: 56 cards in hands · 36 placed ·
// productionTilesRemaining=1 · endGameTriggered=false), the last end-flag tile is never consumed and the game
// freezes on phase 'playing' forever. This safety net forces the SAME endGameTriggered flag the natural clock
// sets (rule 62 · extend, never replace) once drawing is PERMANENTLY impossible (deck AND offer both empty)
// AND only the final tile remains (productionTilesRemaining<=1) — leaving endTurn's existing 2-round → 'scoring'
// path to end the game. Mode-gated to Flow: Classic is turn-locked, so its slow deck never out-drains the
// clock and this never fires there (Classic's serialized behavior is byte-identical). The <=1 guard keeps it
// conservative — it only ever fires at the very last tile, where forcing the endgame equals the natural
// trigger, so a healthy game is never cut short. Deterministic · no Date/random in the reducer (rule 32).
function maybeForceFlowEndgame(state) {
  if (state.endGameTriggered) return // already in the endgame · nothing to force
  if (!getModeConfig(state.mode).SIMULTANEOUS_DRAW) return // Flow only · Classic is unaffected
  if (state.deck.length === 0 && state.theOffer.length === 0 && state.productionTilesRemaining <= 1) {
    state.endGameTriggered = true
  }
}

// ── THE DEADLOCK TERMINAL CONDITION (T2 S44) ────────────────────────────────────────────────────────
// A browser audit reached turn 33 in practice and the game stopped accepting input FOREVER: 2 actions
// left, End Turn disabled (it wants all 3 spent), timer at 0 and not force-advancing, deck empty, two
// factories holding nothing, and the one stocked factory bordering only regions that were 19/19 FULL.
//
// THIS IS NOT THE EXHAUSTION THE ENGINE ALREADY KNEW ABOUT, and conflating the two is why it survived.
// endGameTriggered has exactly one natural source: refillFactoryDraft, which runs ONLY as a side effect
// of a placement that empties a factory. So the tile clock is driven BY placements. Take placements
// away and the clock cannot advance, the trigger can never fire, and the position is permanently dead
// with tiles still on the board. maybeForceFlowEndgame above does not help: it is mode-gated to Flow
// (its own comment reasons "Classic is turn-locked, so its slow deck never out-drains the clock", which
// this audit falsifies) and it additionally requires productionTilesRemaining<=1, which a deadlocked
// game never reaches for the same reason.
//
// MEASURED before writing this, on the reconstructed state: 40 consecutive endTurn() calls left phase
// 'playing', endGameTriggered false and tiles frozen at 3. The game genuinely cannot end.
//
// WHY THIS IS SAFE · the condition is not "the player is stuck this turn", it is "no action can ever
// become available again", which is a closed proof rather than a heuristic:
//   · drawing needs deck or offer · both empty, and nothing refills them (endTurn's top-up pulls from
//     the same empty deck)
//   · placing needs a stocked factory with a legal hex in a region it borders
//   · a factory can ONLY be restocked by refillFactoryDraft, which only runs on a placement
// So with no draw and no placement, no future state differs from this one. Scoring a card is still
// possible and costs no action, but it moves no element and stocks no factory · it cannot reopen play,
// which is why it is deliberately not counted here.
// Deliberately ignores actionsRemaining: the budget resets every turn, so it can make a player stuck
// NOW but can never make a position dead. Checking it would end healthy games (Rule 73's question ·
// can this term even mean what I want it to mean).
function anyPlacementPossible(state) {
  for (const f of state.factories) {
    if (!f.elements?.some(e => e.count > 0)) continue
    for (const regionId of f.betweenRegions) {
      const region = state.regions.find(r => r.id === regionId)
      const regionDef = REGION_DEFS.find(rd => rd.id === regionId)
      if (!region || !regionDef) continue
      const occupied = Object.values(region.hexes).some(h => h.element)
      if (!occupied) return true // an empty region always accepts its centre
      for (const hex of hexesInRadius(regionDef.cq, regionDef.cr, regionDef.radius)) {
        if (region.hexes[`${hex.q},${hex.r}`]?.element) continue
        if (NEIGHBOR_DIRS.some(([dq, dr]) => region.hexes[`${hex.q + dq},${hex.r + dr}`]?.element)) return true
      }
    }
  }
  return false
}

// Sets the SAME endGameTriggered flag the natural clock sets (Rule 62 · extend, never replace), so the
// existing endTurn 2-round → 'scoring' path does the ending. All modes: the deadlock is a property of
// the board, not of the draw rules.
// ⚠ THE WALLET ADDS A FOURTH EXHAUSTION AND IT IS MONOTONE (T2 S66 · the contract's §5, and T3's
// tests/walletTerminalSeam.js is the biconditional that made this a red rather than a paragraph).
//
//     before   DEAD  ⇔  no card available                 AND  no legal placement
//     now      DEAD  ⇔  (no card available OR no money)   AND  no legal placement
//
// A player with forty cards in the deck and an empty wallet is EXACTLY as stuck as one with an empty
// deck, and the early return below would have declined to notice. Money only ever decreases (nothing
// refunds it until demolition, which is deliberately not built yet), so "no money" is permanent and
// the proof stays CLOSED rather than becoming a heuristic.
//
// The affordability term is INLINED rather than extracted into a helper, and that is not style: T3's
// guard reads the BODY of this function for the money field, because a terminal condition that
// delegates its money question elsewhere is exactly as easy to get wrong and much harder to see.
//
// WITH THE FLAG OFF THIS IS BYTE-FOR-BYTE THE OLD PREDICATE · `affordable` is unconditionally true,
// so `cardExists && affordable` reduces to `cardExists`. That equivalence is asserted, not asserted-
// by-comment: gameStore.test.js drives a deadlocked board with the flag in both states.
function maybeForceDeadlockEndgame(state) {
  if (state.endGameTriggered) return
  if (state.phase !== 'playing') return
  const cardExists = state.deck.length > 0 || state.theOffer.length > 0
  // `.some`, not the current seat: the question is whether the GAME can still move, and a game in
  // which one player is broke and another can buy is not dead. Flat pricing makes CARD_PRICE the
  // cheapest card there is, so this is exact rather than an approximation of "the cheapest card".
  const affordable = !WALLET_ENABLED || (state.players ?? []).some(p => (p.wallet ?? 0) >= CARD_PRICE)
  if (cardExists && affordable) return
  if (anyPlacementPossible(state)) return
  state.endGameTriggered = true
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
      // Seat colours · MUST match useGameRoom.SEAT_COLORS (the list that writes room_players.player_color)
      // and the live CHECK on that column: ARRAY['blue','gold','green','red']. Seat 3 was 'purple' here,
      // which is not in the CHECK · nothing renders this field today, so it never 400'd, but three lists
      // describing one value is three contracts and the odd one out is the one that bites later. (T2 S29)
      color: ['blue', 'red', 'green', 'gold'][i],
      hand: [],
      bonusTokens: [],
      scores: [0, 0, 0],
      scoredCardIds: [], // ids of cards this player scored · drives the FinalScore "Districts Built" record (T1 S6)
      // THE WALLET (T2 S66). ALWAYS PRESENT, even while WALLET_ENABLED is false · a field that
      // appears only under a flag would change the serialized state shape on the day the flag flips,
      // and that shape is pinned by tests/e2e/fixtures/seededState.json. Shape first, behaviour
      // second, so the two risks are never in one diff.
      // NOT spread-conditionally like isBot: every player has a wallet in every game, so an absent
      // one is a bug and must read as `undefined` loudly rather than be papered over with `?? ` at
      // the read sites (docs/WALLET_AND_DEMOLITION_CONTRACT.md §1). One default, here.
      wallet: STARTING_WALLET,
      // Practice mode (T2 S32) · a bot seat is an ordinary seat with a policy attached. NOTHING in the
      // store branches on these: turn order is seat-based, colours come from the same list, and every
      // bot move goes through the same actions a human click uses. They exist so useBotTurns knows whose
      // turn to drive and how to play it.
      // SPREAD, NOT ALWAYS-PRESENT, and for the same reason `mode` above is: tests/seededState.guard.test.js
      // pins the serialized shape of a normal game. Adding two keys to every player would change that shape
      // for every non-practice game and break the guard · a practice game is never serialized to a session
      // anyway, because practice never has one.
      ...(p.isBot ? { isBot: true, difficulty: p.difficulty ?? 'builder' } : {}),
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
    // WHO placed it (T2 S35). The board game's cluster rule scores "each Element Token OF THEIR COLOR",
    // and until this line existed a hex recorded only its element, so the cluster bonus had to be
    // board-global · one number added identically to every player, incapable of deciding anything
    // (docs/ACTION_ECONOMY_FINDING.md §8). This is the token's colour. getClusterDetail(regions, seat)
    // reads it; nothing else may write it (a hex is placed once and never cleared · placement requires
    // an EMPTY hex, checked above, so this is write-once by construction).
    region.hexes[hexKey].placedBy = seat

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

  // ── BUYING A CARD  (T2 S66) ─────────────────────────────────────────────────────────────────────
  // Returns an OUTCOME with a REASON, following tryScoreCard's precedent exactly rather than adding a
  // second shape for the same idea (Rule 45). The reason is an enumerated string and not a boolean
  // for one measured purpose: T1 has to tell "you are broke" apart from "it is not your turn" apart
  // from "you have no actions left", and a boolean collapses all three into a silent no-op · which
  // this project has paid for four times (Rule 80 · a counter that cannot measure must say so).
  //
  //   ok | not_your_turn | no_actions | no_card | insufficient_funds | no_seat
  //
  // ⚠ VALIDATE FULLY BEFORE DEBITING (Rule 29), and `no_card` is not hypothetical · it was live.
  // The old drawCard decremented actionsRemaining and THEN did `deck.shift()` unchecked, so a draw
  // against an empty deck cost an action and delivered nothing. No bot ever hit it (chooseBotAction
  // guards deck.length > 0 · measured ZERO refused draws across 103,750 acquisitions, which is why
  // this fix cannot move a single number in docs/CARD_ECONOMY.md), but a human clicking an empty
  // deck could. Under a wallet that becomes money for nothing.
  tryDrawCard: (seat, source, cardIndex) => {
    const state = get()
    const player = state.players.find(p => p.seat === seat)
    if (!player) return { ok: false, reason: 'no_seat', cost: 0, balance: 0 }

    const isCurrentSeat = state.currentSeat === seat
    const simultaneous = getModeConfig(state.mode).SIMULTANEOUS_DRAW
    if (!isCurrentSeat && !simultaneous) return { ok: false, reason: 'not_your_turn', cost: 0, balance: player.wallet }
    if (isCurrentSeat && state.actionsRemaining <= 0) return { ok: false, reason: 'no_actions', cost: 0, balance: player.wallet }

    // WHICH card, before anything is spent. The offer is addressed and the deck is the top of a
    // shuffled stack; both can be absent, and absent is a refusal rather than a silent nothing.
    const card = source === 'offer' ? state.theOffer[cardIndex] : state.deck[0]
    if (!card) return { ok: false, reason: 'no_card', cost: 0, balance: player.wallet }

    // priceOf takes the card it currently ignores · see gameConfig. With the flag off the cost is 0,
    // so no purchase can ever be refused for money and the engine is unchanged.
    const cost = WALLET_ENABLED ? priceOf(card) : 0
    const balance = player.wallet ?? 0
    if (cost > 0 && balance < cost) return { ok: false, reason: 'insufficient_funds', cost, balance }

    set(s => {
      const p = s.players.find(x => x.seat === seat)
      if (!p) return
      if (source === 'offer') {
        const c = s.theOffer[cardIndex]
        if (!c) return                       // re-checked inside the write · validated state can age
        p.hand.push(c)
        s.theOffer.splice(cardIndex, 1)      // The Offer is replenished in endTurn().
      } else {
        const c = s.deck.shift()
        if (!c) return
        p.hand.push(c)
      }
      if (cost > 0) p.wallet = (p.wallet ?? 0) - cost
      // Only the active turn-holder spends an action · a non-current simultaneous draw must not
      // touch the current player's budget (rule 65 · the composed seam).
      if (s.currentSeat === seat) s.actionsRemaining--
      // The draw that empties the card supply is one of the two seams that can complete the Flow
      // soft-lock (the other is a tile-consuming refill · see refillFactoryDraft).
      maybeForceFlowEndgame(s)
      maybeForceDeadlockEndgame(s)
    })
    return { ok: true, reason: 'ok', cost, balance: balance - cost }
  },

  // Draw a card · Flow mode makes the DRAW GATE turn-agnostic (T2 S17 Task A · simultaneous draw).
  // VOID WRAPPER, delegating to tryDrawCard so the purchase rule lives in exactly ONE place · the
  // same relationship scoreCard has with tryScoreCard.
  drawCard: (seat, source, cardIndex) => { get().tryDrawCard(seat, source, cardIndex) },


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

      // Bonus earn (T2 S38 · this granter had never run, because the pile was always empty).
      //
      // AWARD BY THRESHOLD, NOT BY STACK TOP. The old code did `bonusPile.shift()` on any crossing,
      // which is only correct while exactly one player ever crosses anything. The rulebook
      // (docs/NEOTOPIA_GAME_RULEBOOK.md:115-125) maps each threshold to a SPECIFIC token · 7 Government
      // Subsidy, 13 Private Initiative, 18 New Building Permits · so with a stack, the second player to
      // cross 7 in a region would have been handed the 13-token. Matching the crossing to its own entry
      // is following the source; the stack was the guess.
      //
      // Each entry is claimable ONCE per region, which preserves the scarcity the shift() implied: the
      // first player to reach 7 in Sacred City takes its Subsidy and nobody else can.
      // ✅ ANSWERED T2 S52, FROM THE PRINTED RULEBOOK · one token per threshold PER REGION, shared.
      // This was flagged in S38 as an open question and shelved on the grounds that "the difference
      // only shows up in a game where two players both cross the same threshold in one region." S51
      // measured that case: it is 36% of all crossings at two players and 51% at four, so the
      // shelving REASON was wrong even though the shelved ANSWER turned out right.
      // Rulebook page 6, "Gaining Bonuses": "when your Score Marker reaches or passes by positions 7,
      // 13 or 18, gain the token on top of the pile of the corresponding Region, IF ANY." Singular,
      // shared pile, and "if any" is what licenses a crossing that awards nothing. This granter is
      // faithful on that point. Do not re-open it from the 36% alone · see docs/BONUS_TOKEN_BALANCE.md.
      //
      // ⚠ TWO THINGS THE SAME SENTENCE DISAGREES WITH, unresolved and NOT guessed at (Rule 32):
      //   · it says the token ON TOP OF THE PILE · stack order · and this code matches the crossing to
      //     its own threshold instead. S38's Rule 85 made that change citing the repo markdown's
      //     threshold->token mapping; the printed book states an ORDERING, which points the other way.
      //   · setup step 8 builds 3 stacks of FOUR tiles. createRegionBonusPile builds THREE, so the
      //     game holds 9 tokens where the printed one holds 12 · every scarcity figure S51 measured is
      //     against a pool a quarter too small. The 4th is probably 'automatization', still blocked on
      //     docs/BONUS_HEX_DATA_REQUEST.md.
      //
      // A single card can cross two thresholds at once (5 -> 15 takes both 7 and 13). That is intended
      // and the loop already handled it.
      for (const t of SCORE_THRESHOLDS) {
        if (prevScore < t && p.scores[regionId] >= t) {
          const i = r.bonusPile?.findIndex(b => b.threshold === t && !b.claimed) ?? -1
          if (i >= 0) {
            r.bonusPile[i].claimed = true
            p.bonusTokens.push(r.bonusPile[i].type)
          }
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

    // Deadlock check AFTER the top-up (which is the last thing that can make a draw possible again)
    // and BEFORE the round accounting, so the very turn that discovers the deadlock also starts
    // burning the two endgame rounds instead of waiting a full extra lap.
    maybeForceDeadlockEndgame(state)

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
        // Same ownership stamp as placeElement (T2 S35). A token placed by a bonus token is still that
        // player's token · the rulebook scores colour, not the route the element took onto the board.
        // Missing this would make Private Initiative the one placement that scores nobody any points.
        region.hexes[hexKey].placedBy = seat
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

  // getLargestCluster was here and is DELETED (T2 S39 · dead-surface audit). Nothing called it: not
  // product code, not a CI-gated E2E spec, not even a unit test · only its own definition and a comment
  // in patternMatcher describing it. The engine function it wrapped, findLargestCluster, is still there
  // and IS used · by getClusterDetail inside patternMatcher, which is where the one BFS lives (rule 10).
  // Its import here went with it: deleting the wrapper left the import orphaned, which the test suite
  // and the build both happily accepted. Removing a correct wrapper is
  // safe precisely because the thing it wrapped is the one on the path. Re-add in one line if a caller
  // ever appears · that is cheaper than leaving surface that has to be re-audited every few sessions.

  // Computed: per-region per-element cluster breakdown for the FinalScore visualization (T2 S17 · Task B).
  // Reads the SHARED board (regions · element-only, no per-hex placer → clusters are board-global) and
  // delegates to the pure computeClusterDetail (patternMatcher · reuses the existing BFS · rule 10). Returns
  // [{ regionId, regionName, element, count }] · count >= 2 · element is the lowercase ELEMENT_COLORS key.
  // INTENDED for FinalScore at phase==='scoring' (the board still holds the final layout) · NOT yet wired:
  // FinalScore imports neither the store nor regions today. PREFERRED delivery (review C5): T1 passes
  // regions={regions} (GameRoom already reads them reactively) + useMemo(()=>computeClusterDetail(regions),
  // [regions]) — the pure fn avoids the fresh-array-every-call Object.is churn a selector subscription causes.
  // This selector stays for non-React/imperative readers. Pass a seat for that player's own cluster points
  // (board game rule p9 · T2 S35); omit it for the board-global sizes the viz shows.
  getClusterDetail: (seat) => computeClusterDetail(get().regions, seat),

  // Computed: cluster bonus (board game rule p9 · 1pt per element token OF THAT SEAT'S COLOR on the biggest
  // cluster of each element per region). PASS THE SEAT · without one this is the pre-S35 board-global number,
  // which is identical for every player and therefore cannot affect a ranking (see calculateFinalScore).
  getClusterTotal: (seat) => computeClusterTotal(get().regions, seat),

  // Computed: final score for a player (best + 2nd + worst*3 + unusedBonus*3 + own cluster points).
  getFinalScore: (seat) => {
    const player = get().players.find(p => p.seat === seat)
    if (!player) return 0
    // The seat is threaded into the cluster term (T2 S35). Before that it was the board total and every
    // player got the same number here · the reason a placement could not change who won.
    return calculateFinalScore(player.scores, player.bonusTokens.length, computeClusterTotal(get().regions, seat))
  },
})))
