// NeoTopia · the waiting room's "why can't I start yet" view model.
//
// WHY THIS EXISTS (T1 S31 · traced live on localhost): a first visitor types a name, creates a room,
// and lands in front of a permanently disabled button reading "Waiting for players (0/0 ready)".
// Nothing on that screen said a second person was required. Worse, the label is arithmetic nonsense
// when you are alone · zero of zero ARE ready, so it reads as a broken game rather than an empty room.
// The two-player minimum is stated exactly once, on the landing screen, two screens behind them.
//
// WHAT THIS IS NOT: it does not decide whether a lone player SHOULD be able to start. That is a
// product question (a solo-vs-bot mode) and it belongs to Mahil, not to this file. MIN_PLAYERS is
// stated here as the rule the UI is explaining, not as a rule this file invented.
//
// WHAT THIS IS: the pure mapping from the roster to (a) whether Start is live, (b) what the button
// says, and (c) the one sentence that tells the player what to do next. Same shape as
// backendStatus.js, and pure for the same reason · the wall a player hits should be testable without
// a browser, a websocket, or a second human.
//
// THE ROSTER IS PRESENCE, NOT THE DATABASE. `players` here is whatever useGameRoom returns, which is
// usePresence's channel.presenceState() · it never reads room_players. That is load-bearing for the
// STALLED case below: the host is always in their own presence state once the channel subscribes, so
// an EMPTY roster cannot mean "nobody joined" · it means the channel has not synced. Distinguishing
// those two is the difference between "invite a friend" and "your connection has not come up".

/** The rule the room enforces. game_rooms.max_players caps the other end at 4. */
export const MIN_PLAYERS = 2

const HINT_STALLED = 'Still reaching the room. If this stays, leave and open it again.'
const HINT_ALONE   = 'NeoTopia needs at least two players. Send the invite link above, or read the room code out loud.'
const HINT_UNREADY = 'Everyone has to tap Ready before the game can start.'

/**
 * @param {object}   input
 * @param {Array}    input.players  the live roster · [{ username, seat, isHost, isReady, userId }]
 * @param {boolean}  input.isHost   only the host is shown a reason · a joiner cannot act on an empty room
 *
 * @returns {{canStart: boolean, startLabel: string, hint: ?string, isAlone: boolean,
 *            rosterStalled: boolean, readyCount: number, othersCount: number}}
 */
export function deriveLobbyGate({ players = [], isHost = false } = {}) {
  const roster = Array.isArray(players) ? players : []
  const others = roster.filter(p => !p?.isHost)
  const readyCount = others.filter(p => p?.isReady).length

  // Deliberately the same expression the button has always used, moved rather than rewritten: the
  // point of this change is the EXPLANATION, and quietly altering who may start while claiming to
  // only improve the copy is how a "wording fix" becomes a rules change nobody reviewed.
  const canStart = roster.length >= MIN_PLAYERS && others.every(p => p?.isReady)
  const rosterStalled = roster.length === 0
  const isAlone = roster.length < MIN_PLAYERS

  const startLabel =
    canStart ? 'Start Game'
    : rosterStalled ? 'Connecting to the room…'
    : isAlone ? 'Waiting for another player'
    // Only meaningful once there is somebody to be ready · this is the count that was showing 0/0.
    : `Waiting for players (${readyCount}/${others.length} ready)`

  const hint =
    !isHost || canStart ? null
    : rosterStalled ? HINT_STALLED
    : isAlone ? HINT_ALONE
    : HINT_UNREADY

  return { canStart, startLabel, hint, isAlone, rosterStalled, readyCount, othersCount: others.length }
}
