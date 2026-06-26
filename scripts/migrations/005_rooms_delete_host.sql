-- NeoTopia · migration 005 · rooms_delete_host — let a room HOST delete its own FINISHED room.
-- Authored by T2 S8 (2026-06-26). Applied to remote via Supabase MCP. Committed for the repo.
--
-- WHY: game_rooms had policies for SELECT (rooms_read_all), INSERT (rooms_insert), UPDATE
-- (rooms_update_host) but NO DELETE policy. With RLS enabled + no DELETE policy, a host can only
-- soft-close a room to status='finished' · never remove it. The E2E suite (T3 S6) therefore leaves
-- inert 'finished' test rooms in the live DB after every CI run (it could not hard-delete · flagged
-- in comms L498-504 as a cross-lane RLS decision, not taken unilaterally). This policy lets the game
-- clean up after itself with NO service-role access.
--
-- SCOPE (deliberately narrow · strictly ⊂ the existing rooms_update_host permission):
--   host_id = auth.uid()    · a player may only delete a room they host (never someone else's room).
--   status  = 'finished'    · only a finished room · so a delete can NEVER drop a live/waiting game
--                             out from under its players (no griefing · no accidental mid-game wipe).
--   (No TO clause · matches the sibling rooms_update_host exactly · applies to the same roles. The
--    table-level DELETE grant to anon+authenticated already exists from migration 001.)
--
-- CASCADE (verified live this session · pg_constraint.confdeltype = 'c' on all three):
--   room_players.room_id  → game_rooms  ON DELETE CASCADE
--   game_sessions.room_id → game_rooms  ON DELETE CASCADE
--   game_events.session_id→ game_sessions ON DELETE CASCADE
--   So deleting ONE finished room removes its room_players + game_sessions + (transitively) game_events
--   in a single statement. FK referential-action cascades run as the table owner and are NOT subject to
--   the child tables' RLS, so this ONE policy is sufficient for full cleanup · no child DELETE policies.
--
-- SECURITY: adds no new exposure · delete-own-finished is a strict subset of the update-own permission
-- a host already has. anon cannot touch another host's room (host_id = auth.uid()), nor a non-finished
-- room. Idempotent (drop-if-exists then create) · rollback = drop policy rooms_delete_host.

drop policy if exists rooms_delete_host on public.game_rooms;

create policy rooms_delete_host on public.game_rooms
  for delete
  using (host_id = auth.uid() and status = 'finished');
