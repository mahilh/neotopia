// The one assertion that practice cannot make, made where it can be.
//
// A mutation swapping `myPlayer` for `currentPlayer` in GameRoom's wallet wiring left 34 tests green
// · including a control written for exactly that swap · because practice runs with mySeat null, so
// the two expressions denote the same object there. Nothing built on practice can separate them.
// These do, because mySeat and currentSeat are arguments here.
import { describe, it, expect } from 'vitest'
import { viewingPlayer } from './viewingPlayer'

const TABLE = [
  { seat: 0, username: 'Host', wallet: 300_000_000, bonusTokens: ['subsidy'] },
  { seat: 1, username: 'Peer', wallet: 930_000_000, bonusTokens: [] },
]

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COUNTERWEIGHT · FIRST (Rule 90)
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('counterweight · the two candidates must actually DIFFER in this fixture', () => {
  it('seat 0 and seat 1 hold different money and different tokens', async () => {
    // THE DEFINING PROPERTY OF THE FIXTURE, and the exact thing the practice-based control lacked:
    // if both seats held the same balance, `returns mine` and `returns the current seat's` would be
    // satisfied by the same value and no assertion below could tell them apart (Rule 130).
    expect(TABLE[0].wallet).not.toBe(TABLE[1].wallet)
    expect(TABLE[0].bonusTokens).not.toEqual(TABLE[1].bonusTokens)
  })
})

describe('whose personal state the bar shows', () => {
  it('MY seat, even while it is the other player\'s turn', async () => {
    // The case that costs something: waiting for your opponent, and the bar shows their money.
    const p = viewingPlayer({ players: TABLE, mySeat: 0, currentSeat: 1 })
    expect(p.seat, 'the bar follows whoever is playing rather than whoever is looking · in a real ' +
      'room that renders an opponent\'s balance and held tokens to the player waiting').toBe(0)
    expect(p.wallet).toBe(300_000_000)
  })

  it('and the other way round · seat 1 looking while seat 0 plays', async () => {
    // Both directions, because a single-direction test passes on `players[mySeat]` AND on
    // `players[0]`, and only one of those is right.
    const p = viewingPlayer({ players: TABLE, mySeat: 1, currentSeat: 0 })
    expect(p.seat).toBe(1)
    expect(p.wallet).toBe(930_000_000)
  })

  it('falls back to the current seat ONLY when this client has no seat · practice and solo', async () => {
    // The fallback is what makes practice work and it must stay a fallback. Asserted as an ordering
    // rather than as a value, so it cannot be satisfied by ignoring mySeat.
    expect(viewingPlayer({ players: TABLE, mySeat: null, currentSeat: 1 }).seat).toBe(1)
    expect(viewingPlayer({ players: TABLE, mySeat: null, currentSeat: 0 }).seat).toBe(0)
  })

  it('a seat the table does not hold returns NOTHING, never somebody else', async () => {
    // A client claiming seat 4 at a two-seat table is a divergence. Showing it seat 0's wallet would
    // be a silent wrong answer where null is a visible absent one (Rule 80 · never resolve to a
    // plausible value when you cannot measure).
    expect(viewingPlayer({ players: TABLE, mySeat: 4, currentSeat: 0 })).toBeNull()
    expect(viewingPlayer({ players: [], mySeat: 0, currentSeat: 0 })).toBeNull()
    expect(viewingPlayer({ players: TABLE, mySeat: null, currentSeat: null })).toBeNull()
    expect(viewingPlayer({ players: undefined, mySeat: 0, currentSeat: 0 })).toBeNull()
  })
})
