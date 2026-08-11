import { describe, test, expect } from 'vitest'
import { WRITE_ORDER_COLUMN, nextStateVersion, adoptServerVersion, wasOvertaken } from './writeOrder'

// T2 S43 · the write-ordering contract. T3 reproduced the defect in useGameSync.writeorder.test.js
// (one client losing its own End Turn); this pins the PRIMITIVE that refuses it, and the reasoning for
// why it is this primitive and not the textbook one.
//
// A tiny model of the server: a row holding { version, seat }, and an UPDATE that applies only when the
// incoming version is strictly greater. This is the same qual Postgres evaluates under the row lock
// (`lt(state_version, n)`), so the model and migration 022 assert the same rule in two places · which is
// the point, because the SQL side is proven live and this side is proven on every commit.
function applyWithPredicate(row, write) {
  if (write.version > row.version) return { version: write.version, seat: write.seat, applied: true }
  return { ...row, applied: false }
}

// The burst that loses a turn: place, place, place, End Turn · issued 1,2,3,4.
const BURST = [
  { version: 1, seat: 0, label: 'place' },
  { version: 2, seat: 0, label: 'place' },
  { version: 3, seat: 0, label: 'place' },
  { version: 4, seat: 1, label: 'END TURN' },
]

describe('write ordering · the predicate that refuses a stale snapshot', () => {
  // COUNTERWEIGHT FIRST (Rule 90), and here it guards against the SIMPLIFICATION rather than a bad fix.
  // The textbook optimistic lock is `WHERE version = :base` with the DB incrementing, and it is the
  // thing a future reader will "clean this up" into. It fails in the damaging direction: every write in
  // the burst reads base 0 before any lands, so the first applies and the other three are REJECTED,
  // including the End Turn. This test exists to make that concrete rather than argued · if it ever goes
  // green while the seat is 1, the equality lock became viable and this whole design can be revisited.
  test('THE WRONG FIX · an equality lock on the base version drops the End Turn', () => {
    let row = { version: 0, seat: 0 }
    const applied = []
    for (const w of BURST) {
      // every write in a fire-and-forget burst was composed against base 0
      if (row.version === 0) { row = { version: row.version + 1, seat: w.seat }; applied.push(w.label) }
    }
    expect(applied, 'only the first write survives an equality lock').toEqual(['place'])
    expect(row.seat, 'the turn never advances · deterministically, every single time').toBe(0)
  })

  test('out-of-order delivery · the End Turn survives, the stale placement is refused', () => {
    let row = { version: 0, seat: 0 }
    // the defect order T3 measured: the End Turn (4) lands, then a placement issued earlier (3) arrives
    const order = [BURST[0], BURST[1], BURST[3], BURST[2]]
    const refused = []
    for (const w of order) {
      const next = applyWithPredicate(row, w)
      if (!next.applied) refused.push(w.version)
      row = { version: next.version, seat: next.seat }
    }
    expect(refused, 'the write composed before the End Turn must be refused').toEqual([3])
    expect(row.seat, 'THE BUG: without the predicate this reverts to 0 and both players deadlock').toBe(1)
    expect(row.version).toBe(4)
  })

  test('in-order delivery is unaffected · the guard must not cost a legitimate write', () => {
    let row = { version: 0, seat: 0 }
    let refusedCount = 0
    for (const w of BURST) {
      const next = applyWithPredicate(row, w)
      if (!next.applied) refusedCount++
      row = { version: next.version, seat: next.seat }
    }
    expect(refusedCount, 'a correctly-ordered burst loses nothing').toBe(0)
    expect(row).toEqual({ version: 4, seat: 1 })
  })

  // ADDED AFTER A FAILED MUTATION, and worth the paragraph because the test was ALREADY GREEN.
  // I relaxed the model's predicate from `>` to `>=` · the difference between a correct optimistic
  // guard and one that lets a tie through · and all seven tests passed. They could not fail: no two
  // writes in the sequences above share a version, and `>` and `>=` differ ONLY at equality. So the
  // strictness that the whole design rests on was asserted nowhere, in a file whose subject is that
  // strictness. Rule 86's shape again · the assertion I most believed was the one never exercised.
  // Equality is not a hypothetical: it is exactly the two-client case (both hold 4, both issue 5),
  // which the module header describes and nothing here was checking.
  test('STRICTNESS · two clients issuing the SAME version · exactly one may win', () => {
    let row = { version: 4, seat: 0 }
    const a = applyWithPredicate(row, { version: 5, seat: 1 })
    expect(a.applied, 'the first writer at a new version applies').toBe(true)
    row = { version: a.version, seat: a.seat }

    const b = applyWithPredicate(row, { version: 5, seat: 2 })
    expect(b.applied, 'a SECOND write at the same version must be refused · `>=` would let it clobber')
      .toBe(false)
    expect(row.seat, "the loser must not overwrite the winner's state").toBe(1)
  })

  test('the column is named once · writer and detector cannot drift apart', () => {
    expect(WRITE_ORDER_COLUMN).toBe('state_version')
  })

  test('nextStateVersion is monotonic and survives a junk starting value', () => {
    expect(nextStateVersion(0)).toBe(1)
    expect(nextStateVersion(41)).toBe(42)
    // a legacy row reads 0; undefined/NaN/negative must not produce NaN or go backwards, because a
    // version that resets to a plausible number is the Rule 80 failure with a counter attached.
    for (const junk of [undefined, null, NaN, -5, 'x']) expect(nextStateVersion(junk)).toBe(1)
  })

  test('adoptServerVersion takes the MAX · a client never renumbers backwards', () => {
    expect(adoptServerVersion(7, 9)).toBe(9)
    // the dangerous direction: a peer's older write arrives while we have already issued 7. Assigning
    // would make our next write 6 and our own predicate would refuse it · a client bricking itself.
    expect(adoptServerVersion(7, 5)).toBe(7)
    expect(adoptServerVersion(0, undefined)).toBe(0)
  })

  test('wasOvertaken distinguishes REFUSED from NOT REPORTED', () => {
    expect(wasOvertaken([]), 'zero rows matched · someone newer got there first').toBe(true)
    expect(wasOvertaken([{ id: 'x' }])).toBe(false)
    // The one that matters: a request that did not ask for rows returns null. Calling that an overtake
    // would invent a race that never happened and send the client re-syncing on every write.
    expect(wasOvertaken(null), 'no rows REPORTED is not the same as no rows MATCHED').toBe(false)
    expect(wasOvertaken(undefined)).toBe(false)
  })
})
