// NeoTopia · THE LOCAL SESSION · practice mode's transport, which is the absence of one (T3 S32).
// T3 owns this file · it is the local counterpart to useGameSync.js and deliberately mirrors its shape.
//
// WHAT THIS IS FOR
//   A practice game is a real game of NeoTopia with no other humans in it. Every rule, every card and
//   every score is the genuine engine · what it does not have is a network. So this is not a new game
//   mode, it is a null transport: the same store, the same actions, the same call signatures, with the
//   persistence pointed at this tab instead of at Postgres.
//
// MOST OF THE PATH ALREADY EXISTED (Rule 58 · check before you build)
//   App.jsx already routes `/game` with no param, GameRoom already inits a local game when there is no
//   route roomId, and useGameSync(null, …) is already inert · its subscribe effect returns on !roomId,
//   pushState returns {error:'No room'} and sendMove returns false, all before touching the network.
//   Read, not assumed. What was missing was more than one player, survival across a refresh, a clean
//   exit, and somebody willing to state the guarantees in writing.
//
// THE GUARANTEE, AND WHY IT IS WORTH MORE THAN PRACTICE MODE
//   This file imports NOTHING from ../lib/supabase and makes no request of any kind. That buys two
//   things. First, practice costs ZERO anonymous sign-ins, on a budget that is per-IP and shared by
//   every terminal and every CI runner. Second, and this is the part that matters to a player:
//   practice does not require a session AT ALL, so when anonymous sign-in is rate limited the game is
//   still playable. A visitor who cannot sign in is exactly the person practice mode is for · which is
//   why the entry to it must never be gated on canUseRooms (T1's half of this contract).
//
// TWO HAZARDS THIS FILE IS SHAPED AROUND, both found by reading the store rather than by guessing:
//   1. gameStore.syncFromServer is `Object.assign(state, serverGameState)` · a MERGE. Any key this
//      file wrote into the store and a real server payload does not carry would SURVIVE into a real
//      game. So the practice flag lives here and in the route, and never in the store. Nothing below
//      writes a marker field.
//   2. Leaving practice is not navigation. The store keeps the finished practice game, phase stays
//      'playing', and GameRoom's solo-init guard (`phase === 'lobby'`) therefore will not re-arm. That
//      is why endPractice() exists as an explicit teardown rather than being implied by a route change.

import { useCallback, useEffect, useRef, useState } from 'react'
// Same modules, same specifiers GameRoom.jsx uses (:19-20) · verified against the real files rather
// than guessed, because three of the four live somewhere other than where their names suggest.
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../store/gameStore'
import { DECK } from '../lib/projectCards'
import { DEFAULT_GAME_MODE, getModeConfig } from '../store/gameConfig'

// Bumped when the persisted shape changes · a stale snapshot is then ignored rather than half-restored.
export const PRACTICE_STORAGE_KEY = 'neotopia-practice-v1'

// Seat identities. These are the CONTRACT with the bot lane (T2): a bot driver decides which seats it
// plays by asking isPracticeBot(player.userId), never by assuming "seat 0 is human".
export const PRACTICE_HUMAN_ID = 'local-human'
export const practiceBotId = (n) => `local-bot-${n}`
export const isPracticeBot = (userId) => typeof userId === 'string' && userId.startsWith('local-bot-')

// 1 human + 1..3 bots. Clamped rather than validated-and-thrown: a bad count from a UI selector should
// give the player a game, not an error screen.
export const MIN_BOTS = 1
export const MAX_BOTS = 3
const clampBots = (n) => Math.min(MAX_BOTS, Math.max(MIN_BOTS, Number.isFinite(+n) ? Math.round(+n) : MIN_BOTS))

// The SAME serialization useGameSync sends to game_sessions.state · one shape, not two (Rule 45). Kept
// as a local helper rather than imported so this module stays free of any file that touches supabase.
const snapshot = () => JSON.parse(JSON.stringify(useGameStore.getState()))

// sessionStorage, not localStorage, and the difference is deliberate: a practice game belongs to the
// TAB that is playing it. With localStorage two tabs would restore the same game and then overwrite
// each other's moves · a data race invented for no reason in a mode whose entire point is that there
// are no other clients. Every access is total: storage is blocked outright in some private modes, and
// a practice game that cannot persist must still be playable.
function readSaved() {
  try {
    const raw = sessionStorage.getItem(PRACTICE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // A snapshot with no players is not a game · discard rather than restore a half-state.
    if (!parsed || !Array.isArray(parsed.players) || parsed.players.length === 0) return null
    return parsed
  } catch { return null }
}
function writeSaved(state) {
  try { sessionStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(state)) } catch { /* unavailable · play on */ }
}
export function clearSaved() {
  try { sessionStorage.removeItem(PRACTICE_STORAGE_KEY) } catch { /* nothing to clear */ }
}

/**
 * useLocalSession(active, opts)
 *
 * Returns the SAME shape as useGameSync so a consumer can hold either one in the same variable:
 *   { sendMove, pushState, broadcast, sessionId, ready, endPractice }
 *
 * Inert in every observable way while `active` is false · it reads no storage, touches no store and
 * returns callbacks that do nothing. That is what lets GameRoom call BOTH hooks unconditionally (rules
 * of hooks) and simply choose which result it uses.
 *
 * @param {boolean} active
 * @param {{bots?: number, mode?: string, username?: string, botNames?: string[]}} [opts]
 */
export function useLocalSession(active, { bots = MIN_BOTS, mode = DEFAULT_GAME_MODE, username = 'You', botNames } = {}) {
  const [ready, setReady] = useState(false)
  // One activation = one game. Without this, any re-render that changed `bots` or `mode` would
  // re-init and silently destroy a game in progress · the selector belongs to the screen BEFORE this.
  const startedRef = useRef(false)
  // Set for the duration of endPractice(), which mutates the store on purpose. Without it the
  // subscription below would observe that teardown and write the blank slate straight back into the
  // storage key endPractice had just cleared · a teardown that un-does itself.
  const tearingDownRef = useRef(false)

  useEffect(() => {
    if (!active) {
      startedRef.current = false
      setReady(false)
      return
    }
    if (startedRef.current) return
    startedRef.current = true

    // RESTORE FIRST. A refresh mid-practice must not silently deal a new board · that is the same
    // class of loss as the waiting room forgetting its room, and it is avoidable here for free.
    const saved = readSaved()
    if (saved) {
      useGameStore.getState().syncFromServer(saved)
      setReady(true)
      return
    }

    const n = clampBots(bots)
    const players = [
      { userId: PRACTICE_HUMAN_ID, username: username || 'You' },
      ...Array.from({ length: n }, (_, i) => ({
        userId: practiceBotId(i + 1),
        username: botNames?.[i] ?? `Bot ${i + 1}`,
        // isBot ADDED BY T1 S33 · the one key that made this feature exist, and the only edit T1 made
        // outside its own lane. Flagged rather than quietly landed (comms + commit message).
        //
        // WHY. This file's header states the contract as "a bot driver decides which seats it plays by
        // asking isPracticeBot(player.userId)". useBotTurns.js does not ask that · it asks `player.isBot`,
        // which is gameStore's own documented flag (gameStore.js:193-201, spread through initGame so a
        // non-practice player shape stays byte-identical). Two contracts for one question, and each lane
        // tested only its own side: this file's tests assert the bot USERIDS, botPolicy's tests build
        // their own fixtures WITH isBot. Composed, the bots were seated and then sat there · currentSeat
        // reached a bot and the game stopped, forever, because nothing was ever going to move it.
        // Measured before this line was written: the bot seat's keys were
        // [seat,userId,username,color,hand,bonusTokens,scores,scoredCardIds] and the driver returned at
        // `if (!me?.isBot) return`. Stamping isBot by hand made the same seat move. (Rule 45/65.)
        //
        // RECONCILED TOWARD isBot, not toward the userId prefix, because the store flag is the one that
        // survives contact with a real room: `local-bot-N` is a convention of THIS transport, so a bot
        // seated any other way would be invisible to a prefix test, and `difficulty` has to travel with
        // the seat regardless and already rides here. isPracticeBot() stays exported and correct · it is
        // how the HUMAN seat is identified, which is a different question.
        //
        // difficulty is deliberately NOT set: initGame stamps `p.difficulty ?? 'builder'`, which is also
        // botPolicy's DEFAULT_DIFFICULTY, which is the level Mahil chose for every practice game in S33.
        // Declaring it a fourth time would be a fourth thing to keep in agreement · the composed result
        // is pinned instead by GameRoom.practice.test.jsx, which goes red if any of the three drifts.
        isBot: true,
      })),
    ]
    // getModeConfig resolves an unknown mode to Classic, so a bad value degrades instead of throwing.
    const resolved = getModeConfig(mode).id ?? DEFAULT_GAME_MODE
    useGameStore.getState().initGame(players, shuffleArray([...DECK]), shuffleArray([...PRODUCTION_TILES]), resolved)
    writeSaved(snapshot())
    setReady(true)
  }, [active, bots, mode, username, botNames])

  // ── PERSIST EVERY COMMITTED CHANGE, not only the ones routed through this transport (T3 S35) ──────
  // MEASURED, not assumed: after 19 turns of a real practice game the saved snapshot still read turn 1,
  // 12 tiles, 0 elements placed. A player who left a board with 13 elements and refreshed came back to
  // one with 11, at turn 8 instead of turn 10. The restore path above was working perfectly · there was
  // simply almost nothing to restore.
  //
  // WHY. sendMove/pushState below persist correctly, and useGameActions calls them for every human
  // action. useBotTurns does not: it drives seats with useGameStore.getState().<action>() directly
  // (useBotTurns.js:82,98,127), which is a legitimate choice · it is a driver, not a client, and it
  // predates this transport. But it means every bot move between two human actions was invisible here,
  // so a refresh rewound the board by up to a full round of opponents' play.
  //
  // FIXED AT THE TRANSPORT, not by asking useBotTurns to route through it. Persistence is this file's
  // job, and a rule of the form "everyone who mutates the store must remember to tell the transport" is
  // exactly the kind of second contract that was already broken once here (Rule 45): the isBot key had
  // two contracts for one question and the seats sat still. A subscription cannot be forgotten by a
  // caller that does not know it exists, and it covers writers that do not exist yet.
  //
  // Unconditional rather than debounced, on measurement: the snapshot is 20KB and a clone+stringify
  // costs 0.13ms, so even the once-a-second turn-timer tick is 0.13ms/s. Debouncing would buy nothing
  // real and would open a window in which a refresh loses the last move · which is the entire bug.
  //
  // sendMove/pushState keep their own writeSaved calls. They are not redundant: pushState mirrors
  // useGameSync's contract, where a caller that awaits it is entitled to assume the write has already
  // happened when it resolves. This subscription is the safety net underneath them, and both being
  // independently sufficient is the shape T1 shipped in useBotTurns for the same reason.
  useEffect(() => {
    if (!active || !ready) return
    const unsubscribe = useGameStore.subscribe(() => {
      if (tearingDownRef.current) return
      writeSaved(snapshot())
    })
    return unsubscribe
  }, [active, ready])

  // Persist the current store. Mirrors useGameSync.pushState's RESULT shape ({error}) so a caller that
  // checks `if (error)` behaves identically in both modes · the point of a drop-in is that the calling
  // code cannot tell which transport it has.
  const pushState = useCallback(async () => {
    if (!active) return { error: { message: 'No practice session' } }
    writeSaved(snapshot())
    return { error: null }
  }, [active])

  // Apply a move, then persist. Same signature and same return type as useGameSync.sendMove.
  // eventType/eventData are accepted and ignored ON PURPOSE: a practice game has no audit log, and the
  // bot lane must be able to make the identical call without knowing which transport it is holding.
  const sendMove = useCallback(async (mutate, _eventType, _eventData) => {
    if (!active) return false
    if (typeof mutate === 'function') mutate()
    writeSaved(snapshot())
    return true
  }, [active])

  // There is nobody to broadcast to. Returns the success shape rather than an error: a caller awaiting
  // it should proceed, because in a one-client game "everyone has been told" is trivially true.
  const broadcast = useCallback(async () => ({ error: null }), [])

  // Teardown. Explicit because a route change does NOT do this: the store would keep the finished
  // practice game, phase would stay 'playing', and the next real game would seed on top of it through
  // a syncFromServer that MERGES. Returning the store to a lobby-phase blank slate also re-arms
  // GameRoom's own solo-init guard, so entering practice a second time deals a fresh board.
  const endPractice = useCallback(() => {
    // Raised BEFORE clearSaved, and lowered only after the last store mutation below. The two store
    // calls that follow are the teardown itself, and the persistence subscription above is still live
    // for them · React unsubscribes on the next commit, not synchronously here. Without this flag the
    // blank slate would be written straight back into the key this line just cleared, and the next
    // visit would restore a one-player game with an empty deck. Ordering matters more than the flag:
    // clearing first and lowering last is what makes the whole teardown atomic from storage's view.
    tearingDownRef.current = true
    try {
      clearSaved()
      startedRef.current = false
      const store = useGameStore.getState()
      // initGame is the only full reset the store has · run it with a throwaway single player and then
      // drop back to 'lobby' so nothing downstream mistakes the blank slate for a playable game.
      store.initGame([{ userId: PRACTICE_HUMAN_ID, username: 'You' }], [], [])
      store.setPhase('lobby')
      setReady(false)
    } finally {
      // try/finally so a throw in initGame cannot leave this latched · a stuck flag would silently
      // disable persistence for the rest of the tab's life, which is the original bug with no symptom.
      tearingDownRef.current = false
    }
  }, [])

  // sessionId is null, not a fake id: game_events.session_id is a real FK and anything that needs one
  // must be able to tell that there is nothing here to reference.
  return { sendMove, pushState, broadcast, sessionId: null, ready, endPractice }
}
