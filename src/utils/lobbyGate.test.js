import { describe, it, expect } from 'vitest'
import { deriveLobbyGate, MIN_PLAYERS } from './lobbyGate'

// ── Why this file exists ─────────────────────────────────────────────────────────────────────────
// Traced live on localhost (T1 S31): a first visitor typed a name, created a room, and sat in front of
// a disabled button reading "Waiting for players (0/0 ready)" with no sentence anywhere telling them a
// second person was needed. They can wait forever; nothing they can click changes it.
//
// So the thing under test is not really `canStart` · it is whether the screen EXPLAINS itself. A gate
// that refuses without saying why is the wall. Every case below is a state a real player can be in.

const host = (over = {}) => ({ username: 'Wanderer', seat: 0, isHost: true, ...over })
const guest = (over = {}) => ({ username: 'Friend', seat: 1, isHost: false, isReady: false, ...over })

describe('deriveLobbyGate · the waiting room has to say what it is waiting for', () => {
  it('refuses to start a game with one player, and SAYS a second is needed', () => {
    const g = deriveLobbyGate({ players: [host()], isHost: true })
    expect(g.canStart).toBe(false)
    expect(g.isAlone).toBe(true)
    // The old label. "(0/0 ready)" is arithmetic nonsense when you are alone: zero of zero ARE ready,
    // so it reads as a broken game rather than an empty room.
    expect(g.startLabel, 'the button must not report a ready-count with nobody to count')
      .not.toMatch(/0\/0/)
    expect(g.hint, 'the screen must name the missing thing').toMatch(/two players|another player|at least two/i)
    expect(g.hint, 'and point at the action already on screen').toMatch(/invite|code/i)
  })

  it('tells the host their connection has not come up, rather than that the room is empty', () => {
    // The roster is presence, not the database (useGameRoom → usePresence.channel.presenceState()).
    // The host is always in their OWN presence state once the channel subscribes, so an empty list
    // cannot mean "nobody joined" · it means the channel never synced. Telling that host to invite a
    // friend would be advice that cannot possibly work.
    const g = deriveLobbyGate({ players: [], isHost: true })
    expect(g.rosterStalled).toBe(true)
    expect(g.hint).not.toMatch(/invite/i)
    expect(`${g.startLabel} ${g.hint}`).toMatch(/reach|connect/i)
  })

  it('counts only the other players once there are some', () => {
    const g = deriveLobbyGate({ players: [host(), guest(), guest({ seat: 2, isReady: true })], isHost: true })
    expect(g.canStart).toBe(false)
    expect(g.othersCount).toBe(2)
    expect(g.readyCount).toBe(1)
    expect(g.startLabel).toContain('1/2')
    expect(g.hint).toMatch(/ready/i)
  })

  it('opens the gate when everyone else is ready', () => {
    const g = deriveLobbyGate({ players: [host(), guest({ isReady: true })], isHost: true })
    expect(g.canStart).toBe(true)
    expect(g.startLabel).toBe('Start Game')
    expect(g.hint, 'nothing to explain once the button works').toBeNull()
  })

  it('never explains the wall to somebody who cannot act on it', () => {
    // A joiner staring at "send the invite link" is being told to do the host's job.
    for (const players of [[host()], [], [host(), guest()]]) {
      expect(deriveLobbyGate({ players, isHost: false }).hint).toBeNull()
    }
  })

  it('does not quietly change who may start', () => {
    // This module was extracted from the component during a COPY fix. If the extraction also relaxed
    // the rule, a wording change would have shipped a rules change nobody reviewed. The minimum is
    // MIN_PLAYERS and a host alone is still refused · that is a product decision, not a copy one.
    expect(MIN_PLAYERS).toBe(2)
    expect(deriveLobbyGate({ players: [host()], isHost: true }).canStart).toBe(false)
    expect(deriveLobbyGate({ players: [host(), guest({ isReady: true })], isHost: true }).canStart).toBe(true)
  })

  it('survives a roster that has not been shaped yet', () => {
    // presenceState() is assembled from a wire payload · a half-tracked entry is a real possibility,
    // and the waiting room must not crash on the screen a player is already stuck on.
    for (const players of [undefined, null, [undefined], [{}], 'nonsense']) {
      expect(() => deriveLobbyGate({ players, isHost: true })).not.toThrow()
    }
    // Two entries that carry nothing are two players who have not said they are ready · the gate
    // stays shut. (I first asserted `true` here and the test caught it: absent is not ready.)
    expect(deriveLobbyGate({ players: [{}, {}], isHost: true }).canStart).toBe(false)
    // With a real host entry alongside a ready one, an unshaped roster still resolves correctly.
    expect(deriveLobbyGate({ players: [host(), { isReady: true }], isHost: true }).canStart).toBe(true)
  })
})
