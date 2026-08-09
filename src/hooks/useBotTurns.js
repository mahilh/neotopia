// Practice mode · drives bot seats (T2 S32)
// ─────────────────────────────────────────────────────────────────────────────
// Mount this in GameRoom unconditionally. It is INERT unless some seat has isBot, so a real
// multiplayer game is completely unaffected · there is nothing to branch on at the call site.
//
// It applies botPolicy's decisions through the SAME store actions a human click uses, ONE action at a
// time with a visible pause between them. That matters for two reasons: a bot can never take a move a
// player could not, and the player can actually SEE what the opponent did. A bot that resolves its
// whole turn in one frame is indistinguishable from the board changing by itself.
//
// PRACTICE IS LOCAL. No session, no channel, no writes. Do not add persistence here · a practice game
// must not touch games_played or the civilization index, because it is practice and it does not count.
import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { chooseBotAction, makeRng, DEFAULT_DIFFICULTY } from '../lib/botPolicy'

export const BOT_MOVE_DELAY_MS = 650

export function useBotTurns({ enabled = true, delayMs = BOT_MOVE_DELAY_MS } = {}) {
  const players = useGameStore(s => s.players)
  const currentSeat = useGameStore(s => s.currentSeat)
  const actionsRemaining = useGameStore(s => s.actionsRemaining)
  const phase = useGameStore(s => s.phase)

  // One RNG for the whole practice game, so a bot's choices are reproducible per session rather than
  // re-seeded on every render (rule 32 · no unseeded randomness in game logic).
  const rngRef = useRef(null)
  if (rngRef.current === null) rngRef.current = makeRng(Date.now() % 2147483647 || 1)

  // THE most likely bug in this feature: React StrictMode invokes effects twice in development, and a
  // bot that moves twice per tick silently plays a different game. The latch is keyed on the exact
  // (seat, actionsRemaining, phase) tuple the decision was made from · a repeat invocation for the
  // same tuple does nothing, and a genuine next step always changes at least one of the three.
  const lastKeyRef = useRef(null)

  // The completing-element rule needs the hex just placed, and it resets whenever the turn does.
  // Declared up here rather than below the effect that reads it · the closure would work either way,
  // but a ref used above its own declaration is the kind of thing that survives review and then breaks
  // when somebody reorders two hooks.
  const lastPlacedRef = useRef(null)

  useEffect(() => {
    if (!enabled || phase !== 'playing') return
    const me = players.find(p => p.seat === currentSeat)
    if (!me?.isBot) return

    const key = `${currentSeat}:${actionsRemaining}:${phase}`
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key

    const timer = setTimeout(() => {
      const s = useGameStore.getState()
      // Re-check at the moment of acting, not at the moment of scheduling · a human could have ended
      // the game, or the seat could have moved on, in the 650ms we waited (Rule 64).
      if (s.phase !== 'playing' || s.currentSeat !== currentSeat) return
      const seat = currentSeat
      const action = chooseBotAction({
        state: s, seat,
        difficulty: me.difficulty ?? DEFAULT_DIFFICULTY,
        getValidPlacements: s.getValidPlacements,
        getBuildableCards: s.getBuildableCards,
        lastPlacedKey: lastPlacedRef.current,
        rng: rngRef.current,
      })
      switch (action.type) {
        case 'placeElement':
          s.placeElement(seat, action.factoryId, action.elementType, action.q, action.r, action.regionId)
          lastPlacedRef.current = `${action.q},${action.r}`
          break
        case 'scoreCard':
          s.scoreCard(seat, action.cardId, action.regionId, action.lastPlacedKey)
          lastPlacedRef.current = null
          break
        case 'drawCard':
          s.drawCard(seat, action.source, action.cardIndex)
          break
        default:
          s.endTurn()
          lastPlacedRef.current = null
      }
    }, delayMs)

    return () => clearTimeout(timer)
  }, [enabled, players, currentSeat, actionsRemaining, phase, delayMs])

  useEffect(() => { lastPlacedRef.current = null }, [currentSeat])
}
