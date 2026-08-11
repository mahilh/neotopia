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

// Everything one bot action can move. Exported so a test can state the deadlock in the same terms the
// driver does rather than re-deriving it.
export function seatSignature(player, currentSeat, actionsRemaining, phase, turnNumber = 0) {
  return [
    currentSeat, actionsRemaining, phase,
    player?.hand?.length ?? 0,          // draw, and the card that leaves the hand when a district is built
    player?.scoredCardIds?.length ?? 0, // the district itself · the move that used to cost nothing visible
    // turnNumber (T2 S46) · THE ONLY COMPONENT THAT ALWAYS ADVANCES.
    // The soft-lock survived three correct fixes and ended here. On a deadlocked board every other
    // component is a CONSTANT: the seat cycles back to its old value, actions reset to 3, the phase is
    // still 'playing', and a player who cannot act neither draws nor scores. So when the turn returned
    // to a bot the key was byte-identical to the previous time, the latch below read it as a repeat
    // invocation, and the bot never moved again · which stalls the two-round endgame burn, because that
    // burn is driven by seats ENDING TURNS. endGameTriggered is necessary and not sufficient (Rule 103).
    // Nothing here is a legality judgement: chooseBotAction already returns endTurn correctly when it
    // has no options (botPolicy.js:195), and the driver's safety net already passes on a refused action.
    // The bot was never choosing wrongly · it was never being ASKED. That is why a fourth legality
    // predicate would have been the wrong fix (three surfaces were guessing separately before T1
    // unified them, and this needed none of it).
    // Within a turn turnNumber is constant, so the latch keeps its whole purpose · it still blocks the
    // double invocation it was written for, and now re-arms when a genuinely new turn begins.
    turnNumber,
  ].join(':')
}

export function useBotTurns({ enabled = true, delayMs = BOT_MOVE_DELAY_MS } = {}) {
  const players = useGameStore(s => s.players)
  const currentSeat = useGameStore(s => s.currentSeat)
  const actionsRemaining = useGameStore(s => s.actionsRemaining)
  const phase = useGameStore(s => s.phase)
  const turnNumber = useGameStore(s => s.turnNumber)   // latch component · see seatSignature

  // One RNG for the whole practice game, so a bot's choices are reproducible per session rather than
  // re-seeded on every render (rule 32 · no unseeded randomness in game logic).
  const rngRef = useRef(null)
  if (rngRef.current === null) rngRef.current = makeRng(Date.now() % 2147483647 || 1)

  // THE most likely bug in this feature: React StrictMode invokes effects twice in development, and a
  // bot that moves twice per tick silently plays a different game. The latch is keyed on the exact
  // (seat, actionsRemaining, phase) tuple the decision was made from · a repeat invocation for the
  // same tuple does nothing, and a genuine next step always changes at least one of the three.
  //
  // WIDENED BY T1 S33, after a live practice game deadlocked · T2 please review, this is your file and
  // the second of two cross-lane edits I made tonight (the other is isBot in useLocalSession).
  //
  // The latch was keyed on (seat, actionsRemaining, phase). SCORING A CARD CHANGES NONE OF THE THREE:
  // tryScoreCard mutates the hand, the score, scoredCardIds and region.lastBuiltIllustration, and
  // deliberately does NOT spend an action (a district is the consequence of a placement, not a separate
  // action · gameStore.js:363-400). But it DOES give `players` a new identity, so the effect re-ran,
  // found an identical key, returned early · and the cleanup on that re-run had already cancelled the
  // pending timer. Nothing rescheduled it. The seat froze for the rest of the game.
  //
  // Deterministic, not a race: every bot stalls the first time it does the most valuable thing it can
  // do. It survived both lanes' tests because no test had ever let a bot reach a scorable board, and it
  // survived my own first live run for the same reason (three clean bot turns, botCards: []). Measured
  // by subscribing to the store during a stall: at t+650ms `changed: ["players","regions"]` with
  // actionsRemaining still 3, and then silence.
  //
  // The key now carries the seat's own material state, so any action that advances the game advances
  // the key. StrictMode protection is unchanged · a repeat invocation with identical state still
  // produces an identical key.
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

    const key = seatSignature(me, currentSeat, actionsRemaining, phase, turnNumber)
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
      // The signature read from the LIVE store, before and after, so the safety net below measures what
      // actually happened rather than what the action said it would do.
      const signature = () => {
        const x = useGameStore.getState()
        return seatSignature(x.players.find(p => p.seat === seat), x.currentSeat, x.actionsRemaining, x.phase, x.turnNumber)
      }
      const before = signature()

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

      // SAFETY NET · widening the key fixes the one deadlock that was found. This closes the CLASS.
      // Every store action here validates and can silently refuse (placeElement returns before mutating,
      // tryScoreCard returns false, drawCard guards), and any refusal leaves the signature identical ·
      // which means the latch above will not re-arm and this seat never moves again. A frozen board with
      // no error is the worst failure this feature has, because it is indistinguishable from a bot that
      // is still thinking. Passing the turn instead is a bad move; stopping the game is not a move at all.
      if (signature() === before) {
        useGameStore.getState().endTurn()
        lastPlacedRef.current = null
      }
    }, delayMs)

    return () => clearTimeout(timer)
  }, [enabled, players, currentSeat, actionsRemaining, phase, turnNumber, delayMs])

  useEffect(() => { lastPlacedRef.current = null }, [currentSeat])
}
