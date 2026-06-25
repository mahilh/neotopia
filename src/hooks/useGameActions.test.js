import { renderHook, act } from '@testing-library/react'
import { describe, test, expect, beforeEach } from 'vitest'
import { useGameStore } from '../store/gameStore'
import { useGameActions } from './useGameActions'

// useGameStore is a module singleton shared across tests · reset the slices these
// handlers read to a clean mid-game baseline before each test.
describe('useGameActions', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({ actionsRemaining: 3, currentSeat: 0 })
    })
  })

  test('idle phase · clicking factory with no actions remaining does nothing', () => {
    act(() => { useGameStore.setState({ actionsRemaining: 0 }) })
    const { result } = renderHook(() => useGameActions())

    expect(result.current.uiPhase).toBe('idle')
    act(() => { result.current.handleFactoryClick(0) })

    // Guard short-circuits · no transition, no selection.
    expect(result.current.uiPhase).toBe('idle')
    expect(result.current.selectedFactory).toBe(null)
  })

  test('factorySelected → elementSelected → regionSelected state transitions', () => {
    const { result } = renderHook(() => useGameActions())

    act(() => { result.current.handleFactoryClick(0) })
    expect(result.current.uiPhase).toBe('factorySelected')
    expect(result.current.selectedFactory).toBe(0)

    act(() => { result.current.handleElementSelect('energy') })
    expect(result.current.uiPhase).toBe('elementSelected')
    expect(result.current.selectedElement).toBe('energy')

    act(() => { result.current.handleRegionSelect(0) })
    expect(result.current.uiPhase).toBe('regionSelected')
    expect(result.current.selectedRegion).toBe(0)
    // Empty region → fallback offers exactly the region center as a valid target.
    expect(result.current.validTargets).toEqual([{ q: 0, r: 0 }])
  })

  test('multiplayer turn-gate · not your turn (currentSeat ≠ mySeat) blocks all actions', () => {
    act(() => { useGameStore.setState({ actionsRemaining: 3, currentSeat: 0 }) })
    // We are seat 1, but it is seat 0's turn → isMyTurn false → every action is a no-op.
    const { result } = renderHook(() => useGameActions({ mySeat: 1 }))

    expect(result.current.isMyTurn).toBe(false)
    act(() => { result.current.handleFactoryClick(0) })
    expect(result.current.uiPhase).toBe('idle')          // factory click blocked
    expect(result.current.selectedFactory).toBe(null)
    act(() => { result.current.handleEndTurn() })
    expect(useGameStore.getState().currentSeat).toBe(0)  // end turn blocked · seat unchanged
  })

  test('multiplayer turn-gate · your turn (currentSeat === mySeat) allows actions', () => {
    act(() => { useGameStore.setState({ actionsRemaining: 3, currentSeat: 2 }) })
    const { result } = renderHook(() => useGameActions({ mySeat: 2 }))

    expect(result.current.isMyTurn).toBe(true)
    act(() => { result.current.handleFactoryClick(1) })
    expect(result.current.uiPhase).toBe('factorySelected')
    expect(result.current.selectedFactory).toBe(1)
  })

  test('reset clears all state back to idle', () => {
    const { result } = renderHook(() => useGameActions())

    act(() => { result.current.handleFactoryClick(0) })
    act(() => { result.current.handleElementSelect('energy') })
    expect(result.current.uiPhase).toBe('elementSelected')

    // Re-clicking the selected factory toggles off · exercises reset().
    act(() => { result.current.handleFactoryClick(0) })

    expect(result.current.uiPhase).toBe('idle')
    expect(result.current.selectedFactory).toBe(null)
    expect(result.current.selectedElement).toBe(null)
    expect(result.current.selectedRegion).toBe(null)
    expect(result.current.validTargets).toEqual([])
    expect(result.current.patternHighlight).toEqual([])
    expect(result.current.buildableMatches).toEqual([])
  })
})
