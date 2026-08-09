// NeoTopia · the local session's own evidence (T3 S32).
//
// The claim practice mode rests on is NEGATIVE — "this costs no anonymous sign-ins and touches no
// database" — and a negative is exactly the kind of claim that rots quietly. Nothing goes red when
// somebody adds an import three modules down; the game keeps working and the guarantee stops being
// true. So the first test here is a static reachability proof over the real import graph, not a
// mock: mocks prove what a module DID on one path, and the guarantee is about what it CAN do.

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  useLocalSession, PRACTICE_STORAGE_KEY, PRACTICE_HUMAN_ID,
  practiceBotId, isPracticeBot, clearSaved, MIN_BOTS, MAX_BOTS,
} from './useLocalSession'
import { useGameStore } from '../store/gameStore'

const HERE = dirname(fileURLToPath(import.meta.url))

beforeEach(() => {
  clearSaved()
  useGameStore.getState().setPhase('lobby')
})
afterEach(() => { clearSaved() })

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the guarantee · practice cannot reach the network', () => {
  test('nothing in useLocalSession\'s import graph can reach lib/supabase', () => {
    // WHY A STATIC WALK AND NOT A MOCK. A spy proves the code did not call supabase during ONE
    // rendered path. The promise made to the player is stronger and different: that there is no path.
    // Only the module graph can answer that, and only the graph notices when a future edit to
    // gameStore (or anything it pulls in) quietly adds a client three levels down.
    const seen = new Set()
    const trail = new Map()   // module → the file that imported it, so a failure can name the chain

    const resolveSpec = (spec, fromFile) => {
      if (!spec.startsWith('.')) return null // node_modules · react, zustand, immer · not our graph
      const base = resolve(dirname(fromFile), spec)
      for (const cand of [base, base + '.js', base + '.jsx', resolve(base, 'index.js')]) {
        if (existsSync(cand) && !cand.endsWith('/')) return cand
      }
      return null
    }

    const walk = (file) => {
      if (seen.has(file)) return
      seen.add(file)
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/(?:^|\n)\s*import\s[^'"]*['"]([^'"]+)['"]/g)) {
        const child = resolveSpec(m[1], file)
        if (!child) continue
        if (!trail.has(child)) trail.set(child, file)
        walk(child)
      }
    }
    walk(resolve(HERE, 'useLocalSession.js'))

    const chainTo = (f) => {
      const chain = [f]
      while (trail.has(chain[0])) chain.unshift(trail.get(chain[0]))
      return chain.map(p => p.replace(/^.*\/src\//, 'src/')).join(' → ')
    }
    const offenders = [...seen].filter(f => /\/lib\/supabase\.js$/.test(f))
    expect(offenders.map(chainTo),
      'a practice game must be playable with no session at all · reaching lib/supabase would make ' +
      'the mode depend on the exact thing (anonymous sign-in) it exists to survive')
      .toEqual([])

    // THE WALK MUST BE TRANSITIVE, and that has to be asserted rather than assumed. A one-hop walk
    // would pass everything above while missing the failure that actually threatens this guarantee:
    // nobody is going to import supabase into THIS file, they are going to add it to something
    // gameStore already pulls in. patternMatcher is two hops out (useLocalSession → gameStore →
    // lib/patternMatcher), so its presence proves recursion rather than a single directory listing.
    const rel = [...seen].map(p => p.replace(/^.*\/src\//, 'src/'))
    expect(rel, 'the walk did not recurse · it would miss a supabase import added downstream')
      .toContain('src/lib/patternMatcher.js')
    expect(rel).toContain('src/store/gameStore.js')
    expect(seen.size, 'the import walk found nothing · the reachability proof would be worthless').toBeGreaterThan(5)
  })

  test('the practice game leaves no practice-shaped key in the store', () => {
    // gameStore.syncFromServer is Object.assign · a MERGE. A marker written here would survive into
    // the next REAL game, where no server payload would ever clear it. The flag lives in the hook
    // and the route on purpose, and this is what keeps it there.
    const hook = renderHook(() => useLocalSession(true, { bots: 2 }))
    expect(hook.result.current.ready).toBe(true)

    const keys = Object.keys(useGameStore.getState())
    expect(keys.filter(k => /practice|local|bot/i.test(k))).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('useLocalSession · inert until it is asked for', () => {
  test('inactive touches NOTHING · no store change, no storage write, no ready', () => {
    // GameRoom calls this hook on every render of a REAL game too (rules of hooks · both transports
    // are always constructed and one is chosen). If being constructed had any effect, every online
    // game would carry a phantom practice session.
    useGameStore.getState().setPhase('lobby')
    const before = JSON.stringify(useGameStore.getState())

    const hook = renderHook(() => useLocalSession(false, { bots: 3 }))

    expect(hook.result.current.ready).toBe(false)
    expect(JSON.stringify(useGameStore.getState())).toBe(before)
    expect(sessionStorage.getItem(PRACTICE_STORAGE_KEY)).toBeNull()
  })

  test('its callbacks are safe to hold and call while inactive', async () => {
    const hook = renderHook(() => useLocalSession(false))
    let moved, pushed
    await act(async () => {
      moved = await hook.result.current.sendMove(() => { throw new Error('must not run') })
      pushed = await hook.result.current.pushState()
    })
    expect(moved).toBe(false)                       // and the mutate above was never invoked
    expect(pushed.error).toBeTruthy()
    expect(hook.result.current.sessionId).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('useLocalSession · the game it deals', () => {
  test('one human and N bots, seated in order, with the seat colours the rest of the app uses', () => {
    const hook = renderHook(() => useLocalSession(true, { bots: 3, username: 'Mahil' }))
    expect(hook.result.current.ready).toBe(true)

    const { players, phase } = useGameStore.getState()
    expect(phase).toBe('playing')
    expect(players).toHaveLength(4)
    expect(players.map(p => p.seat)).toEqual([0, 1, 2, 3])
    expect(players[0]).toMatchObject({ userId: PRACTICE_HUMAN_ID, username: 'Mahil' })
    expect(players.slice(1).map(p => p.userId)).toEqual([practiceBotId(1), practiceBotId(2), practiceBotId(3)])
    // The same list room_players.player_color is CHECKed against · a practice board that coloured its
    // seats differently would teach the player a legend the real game contradicts.
    expect(players.map(p => p.color)).toEqual(['blue', 'red', 'green', 'gold'])
    // Everyone got a real opening hand · this is the genuine engine, not a mock board.
    expect(players.every(p => p.hand.length === 3)).toBe(true)
  })

  test('the bot ids are identifiable, and the human is not mistaken for one', () => {
    // The contract with the bot lane: a driver asks which seats it owns rather than assuming seat 0
    // is the human. If isPracticeBot ever matched the human, a bot would play the player's turns.
    expect(isPracticeBot(practiceBotId(1))).toBe(true)
    expect(isPracticeBot(PRACTICE_HUMAN_ID)).toBe(false)
    expect(isPracticeBot(undefined)).toBe(false)
    expect(isPracticeBot('u-real-anon-uuid')).toBe(false)
  })

  test('a nonsense bot count still yields a playable game · clamped, never thrown', () => {
    for (const [given, expected] of [[0, MIN_BOTS], [99, MAX_BOTS], [undefined, MIN_BOTS], ['2', 2], [NaN, MIN_BOTS]]) {
      clearSaved()
      const hook = renderHook(() => useLocalSession(true, { bots: given }))
      expect(useGameStore.getState().players.length, `bots=${given}`).toBe(expected + 1)
      hook.unmount()
    }
  })

  test('an unknown mode degrades to Classic rather than dealing an unplayable board', () => {
    const hook = renderHook(() => useLocalSession(true, { bots: 1, mode: 'not-a-mode' }))
    expect(hook.result.current.ready).toBe(true)
    expect(useGameStore.getState().productionTilesRemaining).toBe(12) // Classic's stack
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('useLocalSession · it survives a refresh, which is the whole reason it persists', () => {
  test('a move is applied AND persisted · the snapshot is not written only at deal time', async () => {
    const hook = renderHook(() => useLocalSession(true, { bots: 1 }))
    await act(async () => {
      await hook.result.current.sendMove(() => useGameStore.getState().endTurn(), 'turn_end')
    })

    const saved = JSON.parse(sessionStorage.getItem(PRACTICE_STORAGE_KEY))
    expect(saved.currentSeat).toBe(useGameStore.getState().currentSeat)
    expect(saved.currentSeat).toBe(1) // the move really happened, rather than both being 0
  })

  test('remounting restores the SAME game · a refresh must not silently re-deal', async () => {
    const first = renderHook(() => useLocalSession(true, { bots: 2 }))
    await act(async () => {
      await first.result.current.sendMove(() => useGameStore.getState().endTurn(), 'turn_end')
      await first.result.current.sendMove(() => useGameStore.getState().endTurn(), 'turn_end')
    })
    const before = {
      seat: useGameStore.getState().currentSeat,
      offer: useGameStore.getState().theOffer.map(c => c.id),
      players: useGameStore.getState().players.length,
    }
    expect(before.seat).toBe(2)
    first.unmount()

    // Simulate the reload: the store is a module singleton in the app too, so what actually proves a
    // RESTORE is that state which a fresh deal would reset (currentSeat, the offer) comes back.
    useGameStore.getState().setPhase('lobby')
    const second = renderHook(() => useLocalSession(true, { bots: 2 }))

    expect(second.result.current.ready).toBe(true)
    expect(useGameStore.getState().currentSeat, 'a fresh deal would put this back to 0').toBe(before.seat)
    expect(useGameStore.getState().theOffer.map(c => c.id)).toEqual(before.offer)
    expect(useGameStore.getState().players).toHaveLength(before.players)
  })

  test('a corrupt or empty snapshot is discarded, not half-restored', () => {
    sessionStorage.setItem(PRACTICE_STORAGE_KEY, '{ not json')
    const a = renderHook(() => useLocalSession(true, { bots: 1 }))
    expect(a.result.current.ready).toBe(true)
    expect(useGameStore.getState().players).toHaveLength(2) // dealt fresh
    a.unmount()

    clearSaved()
    sessionStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ players: [] }))
    useGameStore.getState().setPhase('lobby')
    const b = renderHook(() => useLocalSession(true, { bots: 1 }))
    expect(useGameStore.getState().players).toHaveLength(2)
    b.unmount()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('useLocalSession · leaving practice', () => {
  test('endPractice clears the snapshot and returns the store to a lobby-phase blank slate', async () => {
    const hook = renderHook(() => useLocalSession(true, { bots: 2 }))
    expect(sessionStorage.getItem(PRACTICE_STORAGE_KEY)).toBeTruthy()

    await act(async () => { hook.result.current.endPractice() })

    expect(sessionStorage.getItem(PRACTICE_STORAGE_KEY)).toBeNull()
    // 'lobby' specifically, not merely "different": GameRoom's own solo-init guard reads
    // phase === 'lobby', so leaving practice in 'playing' would stop the next game from ever arming.
    expect(useGameStore.getState().phase).toBe('lobby')
    expect(hook.result.current.ready).toBe(false)
  })

  test('after endPractice, entering practice again deals a NEW board rather than the old one', async () => {
    const first = renderHook(() => useLocalSession(true, { bots: 1 }))
    await act(async () => { await first.result.current.sendMove(() => useGameStore.getState().endTurn(), 'turn_end') })
    expect(useGameStore.getState().currentSeat).toBe(1)
    await act(async () => { first.result.current.endPractice() })
    first.unmount()

    const second = renderHook(() => useLocalSession(true, { bots: 1 }))
    expect(second.result.current.ready).toBe(true)
    expect(useGameStore.getState().currentSeat, 'a cleared practice game must not resurrect').toBe(0)
    expect(useGameStore.getState().players).toHaveLength(2)
  })
})
