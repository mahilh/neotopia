// NeoTopia · WRITE ORDERING · the single contract shared by the writer (T2) and the overtake
// detector (T3). One counter, imported by both, so the predicate and the detector cannot disagree.
//
// THE BUG (T3 S42 · 0b40998, reproduced deterministically with no live run): useGameActions.persist is
// fire-and-forget, and pushState reads serializableState() SYNCHRONOUSLY at call time and issues a bare
//   .update({...}).eq('room_id', roomId)
// with no sequence, no predicate and no queue. So place·place·place·EndTurn issues FOUR overlapping
// UPDATEs, each carrying a full snapshot of a DIFFERENT instant, and the row keeps whichever the server
// applied LAST. When that is a placement issued BEFORE the End Turn, current_seat reverts and the turn
// advance is gone. ONE client losing a write to ITSELF · no opponent, no concurrency between humans.
//
// ── WHY NOT THE OBVIOUS FIX ─────────────────────────────────────────────────────────────────────────
// The textbook optimistic lock is `WHERE version = :base` with the DB incrementing. IT IS WRONG HERE,
// and it fails in the damaging direction. All four writes in a burst read base=0 before any of them
// lands, so the first applies and the other THREE are rejected · including the End Turn. That converts
// "sometimes loses the last write" into "reliably loses every write after the first". A fix that makes
// the failure deterministic is not automatically an improvement.
//
// ── THE PRIMITIVE THAT IS CORRECT ───────────────────────────────────────────────────────────────────
// A client-owned MONOTONIC counter, numbered by ISSUE order, with a strictly-less-than predicate:
//     update({ ...snapshot, state_version: n }).eq('room_id', id).lt('state_version', n)
// The row accepts a write only if it is NEWER than what the row already holds, so APPLY order is forced
// to equal ISSUE order and a stale snapshot becomes a no-op instead of a clobber.
//   issue 1,2,3,4 · applied 1,2,4,3 → write 3 hits `4 < 3` = false → rejected. Final state is 4, the
//   End Turn, which is exactly the write the bug was eating.
// Postgres re-evaluates the WHERE after taking the row lock under READ COMMITTED, so two genuinely
// concurrent UPDATEs cannot both pass. The guarantee is the database's, not the client's · which is the
// whole point, because T3 correctly refused a client-side workaround: awaiting persist only narrows the
// window and still loses a write to any retry or slow socket.
//
// ── THE TWO-CLIENT CASE, stated rather than glossed ─────────────────────────────────────────────────
// If A and B both hold version 4 and both issue 5, one lands and the other is REJECTED. B's move does
// not silently vanish: the UPDATE matches zero rows, which is a signal (see wasOvertaken) and B can
// re-sync and retry. That is strictly better than the current silent last-write-wins, and it is the
// standard answer · but it is a REJECTION, not a merge, and nobody should read this file believing
// two simultaneous movers are now fully solved. Turn order makes that rare; it does not make it absent.

// The column. Named once, here, so a rename cannot desynchronise writer from detector (Rule 45 · a
// second copy of a contract is a second contract, and it is the copy that drifts).
export const WRITE_ORDER_COLUMN = 'state_version'

// The version to stamp on the next write. Numbered by ISSUE order · call it synchronously at the same
// moment the snapshot is taken, or the number stops describing the snapshot it travels with.
export function nextStateVersion(lastKnown) {
  const n = Number(lastKnown)
  return (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0) + 1
}

// Fold a version observed from the server (postgres_changes payload, or a re-seed) into the local
// counter. MAX, never assignment: a client that has issued 7 and then receives 5 from a peer's older
// write must not renumber backwards, or its next write would be rejected by its own predicate.
export function adoptServerVersion(local, serverVersion) {
  const a = Number(local), b = Number(serverVersion)
  return Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0)
}

// Did the write lose the race? PostgREST returns the affected rows when the request asks for them, so
// an empty array means the predicate excluded this write · someone newer got there first.
// `data == null` is NOT an overtake · that is a request that did not report rows (no select), and
// calling it an overtake would invent a race that never happened. Distinguish, never default.
export function wasOvertaken(data) {
  if (data == null) return false
  return Array.isArray(data) && data.length === 0
}
