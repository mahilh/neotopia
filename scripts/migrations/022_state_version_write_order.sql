-- NeoTopia · migration 022 · STATE_VERSION · the server-side ordering guarantee for game_sessions
-- ============================================================================================
-- STATUS: see the APPLY LOG at the foot of this file.
-- SCOPE: adds ONE column with a default. No function, grant, policy or existing column is touched.
--   Migration 014 remains unapplied and is unaffected.
--
-- THE BUG THIS CLOSES (T3 S42 · 0b40998 · reproduced deterministically with zero live runs):
--   useGameActions.persist is fire-and-forget; pushState reads serializableState() synchronously and
--   issues a bare `.update({...}).eq('room_id', roomId)` · no sequence, no predicate, no queue. So
--   place·place·place·EndTurn issues FOUR overlapping UPDATEs carrying snapshots of four different
--   instants, and the row keeps whichever landed LAST. When that is a placement issued BEFORE the End
--   Turn, current_seat reverts and the turn advance is gone · ONE client losing a write to ITSELF.
--   Both players then deadlock in opposite directions. This is the last thing between the project and
--   a live game that ends on its own.
--
-- WHY A COLUMN AND NOT AN RPC: the draw needed an RPC because it does a read-modify-write of shared
--   deck state. This does not · the client already holds the whole snapshot it intends to write. All
--   that is missing is a way for the SERVER to refuse a stale one, and a predicate on a monotonic
--   column is exactly that, with no new SECURITY DEFINER surface to authorize (Rule 44) and no change
--   to the snapshot architecture. Smallest thing that makes the guarantee the database's.
--
-- THE PREDICATE (contract lives in src/lib/writeOrder.js · imported by writer AND detector):
--   update({ ...snapshot, state_version: n }).eq('room_id', id).lt('state_version', n)
--   A write applies only if it is strictly NEWER than the row. Apply order is forced to equal issue
--   order; a stale snapshot becomes a no-op instead of a clobber.
--
-- THE FIX THAT WOULD HAVE MADE IT WORSE, recorded so nobody "simplifies" it back:
--   The textbook optimistic lock is `WHERE version = :base` with the DB incrementing. Every write in a
--   burst reads base=0 before any lands, so the first applies and the other THREE are rejected ·
--   INCLUDING the End Turn. That turns "sometimes loses the last write" into "reliably loses every
--   write after the first". Deterministic failure is not automatically an improvement.
--
-- CONCURRENCY: under READ COMMITTED, Postgres re-evaluates the UPDATE's WHERE clause after acquiring
--   the row lock, so of two genuinely simultaneous writers exactly one can pass. The guarantee is the
--   database's. bigint, not integer: at one write per action for the life of the project this will
--   never wrap, and a counter that can wrap is a counter that resets to a plausible value (Rule 80).
--
-- BACKFILL: `default 0 not null` on an existing table. Postgres 11+ stores the default in the catalog
--   rather than rewriting every row, so this is not a long lock on a live table. Existing rows read 0,
--   which is correct · every future write is >= 1 and therefore strictly newer than any legacy row.
-- ============================================================================================

alter table public.game_sessions
  add column if not exists state_version bigint not null default 0;

comment on column public.game_sessions.state_version is
  'Monotonic write-order counter, owned by the CLIENT and numbered by issue order. Writers must send '
  'state_version = lastKnown + 1 and predicate the UPDATE on `lt(state_version, n)` so a stale snapshot '
  'is refused rather than applied. See src/lib/writeOrder.js · T2 S43 migration 022.';

-- No index: every access is already by the primary key or by room_id, both of which are indexed, and
-- the predicate is an additional qual on an already-located row rather than a lookup path of its own.

-- ============================================================================================
-- WHAT THIS MIGRATION DOES NOT DO, stated because the column alone changes nothing:
--   The column is INERT until the writer sends it and predicates on it. That write path is
--   useGameSync.pushState, which is T3's file and T3's lane. This migration plus src/lib/writeOrder.js
--   is the half that is server-side by construction; the wiring is theirs, and the shared contract
--   exists so the predicate and their overtake detector cannot end up counting two different things.
--   A migration present in git is not a deployed schema, and a deployed column is not a fix (Rule 68).
--
-- APPLY LOG:
--   [x] APPLIED TO PRODUCTION · T2 S43 · supabase migration `state_version_write_order`.
--       Verified after apply, read back rather than assumed:
--         · column present, bigint, not null, default 0
--         · all existing rows read 0 (no partial backfill)
--         · a simulated out-of-order write is REFUSED by the predicate and the newer value survives
--           (proven on a real row inside a transaction that was rolled back · zero net mutation)
-- ============================================================================================
