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

export function useGameActions() {
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
  }, [actionsRemaining, selectedFactory, reset])

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
  }, [uiPhase, selectedFactory, selectedElement, selectedRegion, validTargets, currentSeat, reset])

  // Scoring: player clicks a glowing card in their hand.
  const handleCardScore = useCallback((cardId) => {
    if (uiPhase !== 'scorePending') return
    if (selectedRegion === null) return
    const match = buildableMatches.find(m => m.cardId === cardId)
    if (!match) return
    const store = useGameStore.getState()
    // 4th arg lastPlacedKey · scoreCard re-validates the completion against the board and
    // rejects SILENTLY (void) on any mismatch. Snapshot the region score and only tear down
    // scorePending on a real award · otherwise keep the prompt so the player can retry/End Turn.
    // (Mirrors handleHexClick's commit-confirmation · matters once T3 realtime sync can diverge.)
    const before = store.players.find(p => p.seat === currentSeat)?.scores[selectedRegion]
    store.scoreCard(currentSeat, cardId, selectedRegion, lastPlacedKey)
    const after = useGameStore.getState().players.find(p => p.seat === currentSeat)?.scores[selectedRegion]
    if (after !== before) reset()
  }, [uiPhase, selectedRegion, buildableMatches, lastPlacedKey, currentSeat, reset])

  const handleEndTurn = useCallback(() => {
    useGameStore.getState().endTurn()
    reset()
  }, [reset])

  return {
    selectedFactory, selectedElement, selectedRegion,
    validTargets, patternHighlight, buildableMatches, uiPhase,
    handleFactoryClick, handleElementSelect, handleRegionSelect,
    handleHexClick, handleCardScore, handleEndTurn,
  }
}
