import { renderHook, act } from '@testing-library/react'
import { describe, test, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../store/gameStore'
import { DECK } from '../lib/projectCards'
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

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// handleDrawCard · THE SEAM THAT CARRIES THE REFUSAL REASON  (T2 S68)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// This function had NO test of any kind before tonight · 86 lines in this file and every one of them
// about the placement state machine. It is the layer that discarded `tryDrawCard`'s outcome for two
// sessions, so a refused draw was silent before any wallet existed, and it is the last link in the
// chain Council ordered (engine S66 -> T3's seam guard S66 -> T1's readout S67 -> this).
describe('handleDrawCard · the engine answers and the answer survives', () => {
  const freshGame = (n = 2) => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true)
      useGameStore.getState().initGame(
        Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, username: `P${i}` })),
        shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]))
    })
  }

  // ── COUNTERWEIGHT, FIRST AND ALONE (Rule 90) ────────────────────────────────────────────────────
  // The whole claim is that the caller now receives THE ENGINE'S outcome. A hook that synthesised a
  // plausible `{ ok: false, reason: ... }` of its own would satisfy every other assertion below and
  // would be the same defect one layer up · a second producer of the same vocabulary (Rule 45).
  //
  // `no_card` is the discriminator BECAUSE THIS HOOK CONTAINS NO CODE FOR IT. There is no branch
  // here that could invent it, so its arrival proves the value travelled from tryDrawCard rather
  // than being manufactured in between. A reason the hook CAN produce (`not_your_turn`) would prove
  // nothing, which is exactly why it is not the one used here.
  it('a reason this hook cannot produce reaches the caller', () => {
    freshGame()
    act(() => { useGameStore.setState(s => { s.deck = [] }) })
    const { result } = renderHook(() => useGameActions())
    let r
    act(() => { r = result.current.handleDrawCard('deck', 0) })
    expect(r?.reason, 'the caller did not receive `no_card`, which is a reason NOTHING in ' +
      'useGameActions can construct · so either the outcome is not the engine\'s or it is being ' +
      'discarded again, and the refusal surface has no producer').toBe('no_card')
    expect(r.ok).toBe(false)
    // POSITIVE CONTROL · an empty deck must not also be an empty offer, or `no_card` would be
    // reachable for a reason this test is not about.
    expect(useGameStore.getState().theOffer.length, 'the offer is empty too, so this measured the ' +
      'wrong emptiness').toBeGreaterThan(0)
  })

  it('a successful draw returns ok and the card actually lands in the hand', () => {
    freshGame()
    const before = useGameStore.getState().players[0].hand.length
    const { result } = renderHook(() => useGameActions())
    let r
    act(() => { r = result.current.handleDrawCard('offer', 0) })
    expect(r.ok).toBe(true)
    expect(r.reason).toBe('ok')
    expect(useGameStore.getState().players[0].hand.length, 'ok was reported without a card arriving')
      .toBe(before + 1)
  })

  // The gate this replaced returned a bare falsy `undefined` from the hook's own pre-check. The
  // engine answers it now and the caller learns WHY · which is the entire point of the change.
  it('no actions left is refused BY THE ENGINE, with a reason', () => {
    freshGame()
    act(() => { useGameStore.setState({ actionsRemaining: 0 }) })
    const { result } = renderHook(() => useGameActions())
    let r
    act(() => { r = result.current.handleDrawCard('offer', 0) })
    expect(r.reason, 'the hook still short-circuits with an untyped falsy value · T1 has nothing to ' +
      'render and the click is silent').toBe('no_actions')
    expect(r.ok).toBe(false)
  })

  it('a seat that is not this client is refused by the HOOK, which is the only layer that can see it', () => {
    freshGame()
    act(() => { useGameStore.setState({ currentSeat: 1 }) })
    const { result } = renderHook(() => useGameActions({ mySeat: 0 }))
    let r
    act(() => { r = result.current.handleDrawCard('offer', 0) })
    expect(r.reason).toBe('not_your_turn')
    expect(useGameStore.getState().players[1].hand.length, 'the draw went through for the other seat')
      .toBe(3)
  })

  // ── THE EQUIVALENCE, DRIVEN RATHER THAN ARGUED (Rule 135b) ──────────────────────────────────────
  // The old code inferred success from `actionsRemaining` moving. That is correct ONLY because this
  // path passes `currentSeat`, so the engine's `if (s.currentSeat === seat)` decrement always
  // applies. It is a coincidence, not a contract, and the comment in useGameActions.js says so ·
  // this is the measurement that makes that sentence a record rather than a hope.
  it('the retired actions-counter proxy and the engine\'s ok agree on this path', () => {
    freshGame()
    const { result } = renderHook(() => useGameActions())
    for (const [source, idx] of [['offer', 0], ['offer', 0], ['deck', 0], ['offer', 0]]) {
      const before = useGameStore.getState().actionsRemaining
      let r
      act(() => { r = result.current.handleDrawCard(source, idx) })
      const committed = useGameStore.getState().actionsRemaining !== before
      expect(committed, `old proxy said ${committed} and the engine said ${r.ok} for ${source} · the ` +
        'two disagree, so replacing one with the other was a behaviour change and not a rewiring')
        .toBe(r.ok)
      if (!r.ok) break
    }
  })

  // ── THE CROSS-FILE CONTRACT THIS CHANGE CREATED, AND IT HAS NO OWNER (Rule 115) ─────────────────
  // Returning an object made one specific mistake SILENT: an object is always truthy, so
  // `if (handleDrawCard(...))` without `.ok` logs "drew X" on every refusal. Every alternative shape
  // was worse (the only falsy values in JS carry no properties, so nothing can be both falsy-on-
  // refusal and carry a reason), which means the hazard is inherent and has to be guarded rather
  // than designed away.
  //
  // ⚠ I ASSUMED THIS WAS ALREADY DEFENDED AND IT WAS NOT. My mutation run reported the `.ok`
  // deletion as RED, so I recorded it as covered. Re-run with nothing else on the machine it is
  // GREEN · 52 passed · and the earlier red came from a full serial suite I had left running in the
  // background (Rule 33 / Rule 77). A mutation harness is the WORST place for a load flake, because
  // a spurious red reads as "this has teeth" · the flattering direction · and retires the question.
  //
  // The behavioural half (a refused draw adds no log entry) belongs to T1: GameRoom.jsx and the
  // action log are their lane, and it is routed in comms. This is the half that is mine, and it is
  // the same shape as the tick-health <-> e2e.yml job-name guard: assert the RELATION across the
  // two files, not the presence of a token (preamble §2 · a name appearing is not a name being used).
  it('no GameRoom call site uses the outcome OBJECT as a truth test', () => {
    // ⚠ THIS ASSERTED A FORM AND WENT RED ON CORRECT CODE (T2 S69). The first version required the
    // call to be textually followed by `.ok`. T1 then landed the refusal surface and wrote the
    // obviously right thing · `const r = handleDrawCard('offer', i); if (r.ok) {...} else {...}` ·
    // which reads `ok` and does not match `handleDrawCard(...).ok`. My guard failed their correct
    // code, in their lane, on the day they took the seam I asked them to take.
    //
    // The preamble's own §2 says it: assert the RELATION, never the presence of a token. "Is the
    // call followed by .ok" is a proxy for "does the caller read ok", and the proxy broke on the
    // first legitimate refactor. So this now forbids the ONE construct that is actually dangerous ·
    // the outcome object used directly where a boolean is expected · and permits every shape that
    // reads the field, including binding it first.
    const src = readFileSync(join(process.cwd(), 'src/pages/GameRoom.jsx'), 'utf8')
    const calls = [...src.matchAll(/handleDrawCard\s*\(/g)]
    // POSITIVE CONTROL FIRST · a renamed handler or a wrong path yields ZERO matches, and "none of
    // zero are dangerous" passes forever (preamble §3, fifth shape · name the value that reddens it).
    expect(calls.length, 'no handleDrawCard call site found in GameRoom.jsx · this guard is passing ' +
      'vacuously. Either the handler was renamed or this path is wrong; find it before trusting the ' +
      'assertion below').toBeGreaterThan(0)

    // The dangerous forms: the call standing alone as a condition or as an operand of a boolean.
    // `if (handleDrawCard(...))`, `else if (...)`, `&& handleDrawCard(...)`, `!handleDrawCard(...)`.
    const dangerous = [...src.matchAll(/(?:if\s*\(|&&\s*|\|\|\s*|!\s*)handleDrawCard\s*\([^)]*\)\s*(?![.\w])/g)]
      .map(m => m[0].trim())
    expect(dangerous, 'GameRoom uses the RESULT of handleDrawCard directly as a truth test. It ' +
      'returns the engine OUTCOME OBJECT since T2 S68 and every object is truthy · so the branch is ' +
      'taken even when the draw was refused for money, and the action log announces a card the ' +
      'player never got. Read `.ok` (binding it to a variable first is fine).').toEqual([])
  })

  it('a refused draw does not persist, and a successful one does', () => {
    freshGame()
    const pushed = []
    const sync = { pushState: (t) => pushed.push(t) }
    const { result } = renderHook(() => useGameActions({ sync }))
    act(() => { result.current.handleDrawCard('offer', 0) })
    expect(pushed, 'a successful draw was not synced · every other client keeps the old hand')
      .toEqual(['draw'])
    act(() => { useGameStore.setState({ actionsRemaining: 0 }) })
    act(() => { result.current.handleDrawCard('offer', 0) })
    expect(pushed, 'a REFUSED draw pushed state · the wire now carries a move that never happened')
      .toEqual(['draw'])
  })
})
