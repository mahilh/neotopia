-- 018 · bound game_events.event_data  (T2 S29)
-- Closes the cheap half of SECURITY_SURFACE.md finding 3: "game_events accepts unbounded jsonb and
-- fans it out over realtime". This is step (1) of the two-step shape assessed in T2 S28. Step (2),
-- the SECURITY DEFINER RPC + `revoke insert`, is NOT here: it bounds RATE (which a CHECK cannot) but
-- it edits useGameSync.js:335, which is T3's file, so it sequences with them.
--
-- SIZED ON MEASURED DATA, not a guessed round number (re-measured live at write time, S29):
--   235 rows · avg event_data 12 bytes · LARGEST EVER WRITTEN 586 bytes · rows already over 4096: 0
-- 4096 is ~7x the largest payload the game has ever produced. The biggest legitimate row is the
-- game_end audit (lib/gameEndEvent.js · final score per player + districts); even at 4 players that
-- stays comfortably inside the bound, and the existing 586-byte high-water mark is a 2-player one.
-- If a future payload ever needs more, raise the number deliberately in a migration · do not drop it.
--
-- Because zero live rows violate it, the constraint is added VALIDATED (no NOT VALID + later
-- VALIDATE dance). The table is small (168 kB) so the validation scan is trivial.
--
-- WHAT THIS DOES AND DOES NOT CLOSE (stated plainly so the next reader does not over-trust it):
--   ✅ one row can no longer be arbitrarily large · the storage-per-row vector is bounded
--   ✅ the realtime fanout per message is bounded by the same number
--   ❌ it does NOT bound the NUMBER of rows · an attacker can still loop small inserts. That is
--      step (2)'s job. A CHECK is per-row by construction and cannot see rate.
-- Also worth recording: since migration 016 closed the join surface, an attacker can only insert
-- into a session of their OWN room, so the fanout reaches only their own subscribers. The remaining
-- exposure is storage and account-level realtime quota, not other players' bandwidth.

begin;

alter table public.game_events
  add constraint game_events_event_data_size
  check (pg_column_size(event_data) <= 4096);

commit;
