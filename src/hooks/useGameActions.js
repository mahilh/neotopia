import { useState, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { hexesInRadius, REGIONS } from '../utils/hexUtils'

// Six axial neighbor directions (flat-top) · matches gameStore.NEIGHBOR_DIRS.
const NEIGHBOR_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]

// FALLBACK valid-placement computation · a SAFETY NET only. The store already ships the
// authoritative store.getValidPlacements(factoryId, regionId), which handleRegionSelect
// prefers; this runs only if that selector is ever absent. It mirrors placeElement's FULL
// accept rule so the two layers can't drift: factory-border gate (factory.betweenRegions),
// empty region → center only, otherwise empty hex adjacent to an existing element · bounded
// to the region's rendered hexes (radius 2) so every offered target is clickable.
function computeValidTargets(region, regionDef, factory, regionId) {
  if (!region || !regionDef || !factory) return []
  if (!factory.betweenRegions.includes(regionId)) return [] // factory must border this region
  const occupied = region.hexes
  const hasElement = Object.values(occupied).some(h => h.element)
  if (!hasElement) {
    return [{ q: region.center.q, r: region.center.r }]
  }
  return hexesInRadius(regionDef.cq, regionDef.cr, regionDef.radius).filter(({ q, r }) => {
    if (occupied[`${q},${r}`]?.element) return false // hex must be empty
    return NEIGHBOR_DIRS.some(([dq, dr]) => occupied[`${q + dq},${r + dr}`]?.element) // touches existing
  })
}

// Options:
//   sync   · the useGameSync handle ({ pushState, ... }) in multiplayer · null in solo. After a
//            committed local mutation we pushState() so every client syncs via postgres_changes.
//   mySeat · this client's seat number · null in solo. Turn-gate: only the seat whose turn it is acts.
export function useGameActions({ sync = null, mySeat = null } = {}) {
  // Placement state machine: idle → factorySelected → elementSelected → regionSelected → scorePending
  const [selectedFactory, setSelectedFactory] = useState(null)   // factory id (0/1/2)
  const [selectedElement, setSelectedElement] = useState(null)   // element type string
  const [selectedRegion, setSelectedRegion] = useState(null)     // region id (0/1/2)
  const [validTargets, setValidTargets] = useState([])           // [{q,r}] from store/fallback
  const [patternHighlight, setPatternHighlight] = useState([])   // [{q,r}] matched pattern
  const [buildableMatches, setBuildableMatches] = useState([])   // [{cardId, matchedHexKeys, ...}]
  const [lastPlacedKey, setLastPlacedKey] = useState(null)       // 'q,r' completing hex · scoreCard needs it
  const [uiPhase, setUiPhase] = useState('idle')
  // idle | factorySelected | elementSelected | regionSelected | scorePending

  // Read just the slices these handlers need · avoids re-render cascades.
  const actionsRemaining = useGameStore(s => s.actionsRemaining)
  const currentSeat = useGameStore(s => s.currentSeat)

  // Multiplayer turn ownership: only the active seat may act. null mySeat = solo (always your turn).
  const isMyTurn = mySeat == null || currentSeat === mySeat
  // Persist authoritative state after a committed local move so every client syncs · no-op in solo.
  // eventType is the APP vocabulary (place/draw/score/endTurn) · useGameSync's EVENT_TYPE_DB map
  // translates it to the game_events CHECK value at the persistence boundary (T3 owns that mapping ·
  // place→place_element · draw→draw_card · score→build_project · endTurn→turn_end). The action layer
  // deliberately does NOT speak DB-CHECK vocabulary · emitting the long names here bypassed T3's
  // translator → every audit row was silently skipped (the S6 double-fix collision · re-aligned T1 S7).
  const persist = useCallback((eventType) => { sync?.pushState?.(eventType) }, [sync])

  const reset = useCallback(() => {
    setSelectedFactory(null)
    setSelectedElement(null)
    setSelectedRegion(null)
    setValidTargets([])
    setPatternHighlight([])
    setBuildableMatches([])
    setLastPlacedKey(null)
    setUiPhase('idle')
  }, [])

  // Step 1: player clicks a factory hex.
  const handleFactoryClick = useCallback((factoryId) => {
    if (!isMyTurn) return // not your turn (multiplayer)
    if (actionsRemaining <= 0) return
    if (selectedFactory === factoryId) { reset(); return } // toggle off
    setSelectedFactory(factoryId)
    setSelectedElement(null)
    setSelectedRegion(null)
    setValidTargets([])
    setPatternHighlight([])
    setBuildableMatches([])
    setLastPlacedKey(null)
    setUiPhase('factorySelected')
  }, [isMyTurn, actionsRemaining, selectedFactory, reset])

  // Step 2: player clicks an element type in the factory.
  const handleElementSelect = useCallback((elementType) => {
    if (selectedFactory === null) return // factory 0 is falsy · check null explicitly
    setSelectedElement(elementType)
    setSelectedRegion(null)
    setValidTargets([])
    setUiPhase('elementSelected')
    // Region choice (factory.betweenRegions) is rendered by the sidebar · no board change yet.
  }, [selectedFactory])

  // Step 3: player clicks a region button → highlight valid hexes on the board.
  const handleRegionSelect = useCallback((regionId) => {
    if (selectedElement === null) return
    setSelectedRegion(regionId)
    setUiPhase('regionSelected')

    const store = useGameStore.getState()
    let targets
    if (typeof store.getValidPlacements === 'function') {
      // Authoritative selector (T2) · preferred · keeps UI and engine in lockstep.
      targets = store.getValidPlacements(selectedFactory, regionId)
    } else {
      // Safety net if the authoritative selector is ever absent · same rule as placeElement.
      const region = store.regions.find(r => r.id === regionId)
      const regionDef = REGIONS.find(r => r.id === regionId)
      const factory = store.factories.find(f => f.id === selectedFactory)
      targets = computeValidTargets(region, regionDef, factory, regionId)
    }
    setValidTargets(targets)
  }, [selectedElement, selectedFactory])

  // Step 4: player clicks a valid hex → place element + check for buildable cards.
  const handleHexClick = useCallback((q, r, regionId) => {
    if (!isMyTurn) return
    if (uiPhase !== 'regionSelected') return
    if (selectedFactory === null || selectedElement === null || selectedRegion === null) return
    if (regionId !== selectedRegion) return // clicked outside the target region
    // HexCell binds onClick to EVERY hex · only act on a highlighted valid target.
    if (!validTargets.some(t => t.q === q && t.r === r)) return

    const store = useGameStore.getState()
    const beforeActions = store.actionsRemaining
    store.placeElement(currentSeat, selectedFactory, selectedElement, q, r, regionId)

    // placeElement validates and rejects silently · confirm it actually committed.
    if (useGameStore.getState().actionsRemaining === beforeActions) { reset(); return }
    persist('place') // committed · sync to other clients (→ place_element via EVENT_TYPE_DB)

    // Completing-element rule: pass the just-placed hex so only completions that include it surface.
    const placedKey = `${q},${r}`
    const matches = store.getBuildableCards(regionId, placedKey)

    if (matches.length > 0) {
      const matchedKeys = [...new Set(matches.flatMap(m => m.matchedHexKeys))]
      setPatternHighlight(matchedKeys.map(k => {
        const [pq, pr] = k.split(',').map(Number)
        return { q: pq, r: pr }
      }))
      setBuildableMatches(matches)
      setLastPlacedKey(placedKey)
      setSelectedFactory(null)
      setSelectedElement(null)
      setValidTargets([])
      // Keep selectedRegion · scoreCard is awarded against it.
      setUiPhase('scorePending')
    } else {
      reset()
    }
  }, [isMyTurn, uiPhase, selectedFactory, selectedElement, selectedRegion, validTargets, currentSeat, reset, persist])

  // Draw a card (The Offer at cardIndex, or the deck top) · one action. Turn-gated + synced.
  const handleDrawCard = useCallback((source, cardIndex) => {
    if (!isMyTurn) return
    const store = useGameStore.getState()
    if (store.actionsRemaining <= 0) return
    const beforeActions = store.actionsRemaining
    store.drawCard(currentSeat, source, cardIndex)
    if (useGameStore.getState().actionsRemaining !== beforeActions) persist('draw') // committed · sync (→ draw_card)
  }, [isMyTurn, currentSeat, persist])

  // Scoring: player clicks a glowing card in their hand.
  // Returns the scored card + region on a real award (drives GameRoom's ScoreFlash), else null.
  const handleCardScore = useCallback((cardId) => {
    if (!isMyTurn) return null
    if (uiPhase !== 'scorePending') return null
    if (selectedRegion === null) return null
    const match = buildableMatches.find(m => m.cardId === cardId)
    if (!match) return null
    const store = useGameStore.getState()
    const player = store.players.find(p => p.seat === currentSeat)
    const scoredCard = player?.hand.find(c => c.id === cardId) ?? null // capture before it leaves the hand
    const regionId = selectedRegion
    // tryScoreCard (T2) re-validates the completion against the board and returns whether it awarded.
    // 4th arg lastPlacedKey honors the completing-element rule. Only tear down + flash on a real award.
    const scored = store.tryScoreCard(currentSeat, cardId, regionId, lastPlacedKey)
    if (scored) {
      persist('score') // committed · sync to other clients (scoring a card builds its district → build_project)
      reset()
      return { card: scoredCard, regionId }
    }
    return null
  }, [isMyTurn, uiPhase, selectedRegion, buildableMatches, lastPlacedKey, currentSeat, reset, persist])

  const handleEndTurn = useCallback(() => {
    if (!isMyTurn) return
    useGameStore.getState().endTurn()
    persist('endTurn') // committed · sync (advances currentSeat for every client → turn_end)
    reset()
  }, [isMyTurn, reset, persist])

  return {
    selectedFactory, selectedElement, selectedRegion,
    validTargets, patternHighlight, buildableMatches, uiPhase, isMyTurn,
    handleFactoryClick, handleElementSelect, handleRegionSelect,
    handleHexClick, handleCardScore, handleDrawCard, handleEndTurn,
  }
}
