-- NeoTopia · migration 002 · RLS WRITE policies for game_sessions + game_events.
-- Authored by T3 S2 (2026-06-25). Applied to remote via Supabase MCP as migration
-- "rls_write_policies_sessions_events". Committed here so the repo stays the source of truth.
--
-- WHY: migration 001 GRANTed table privileges, but RLS on these two tables shipped with ONLY
-- SELECT policies (sessions_read / events_read). With RLS enabled and no INSERT/UPDATE policy,
-- those commands are DENIED regardless of GRANT — so at runtime:
--   · "Start Game"  → game_sessions INSERT failed (row-level-security violation)
--   · every move    → game_sessions UPDATE + game_events INSERT failed
-- T3 is the first terminal to WRITE these tables, so T3 hit the wall a GRANT-only check missed.
--
-- SECURITY: membership-scoped to mirror the existing self-scoped posture
-- (room_players.user_id = auth.uid()). auth.uid() is null without a valid JWT, so the EXISTS
-- check also blocks fully-unauthenticated callers. Idempotent (drop-if-exists) · rollback = drop.
--
-- NOTE (future hardening · T2): these allow ANY seated member to update the session at any time
-- (no server-side turn-ownership enforcement). True authority belongs in an edge function
-- (api/game-action.js) that validates current_seat before writing. Tracked, not yet built.

drop policy if exists sessions_insert_member on public.game_sessions;
create policy sessions_insert_member on public.game_sessions
  for insert with check (
    exists (
      select 1 from public.room_players rp
      where rp.room_id = game_sessions.room_id
        and rp.user_id = auth.uid()
    )
  );

drop policy if exists sessions_update_member on public.game_sessions;
create policy sessions_update_member on public.game_sessions
  for update using (
    exists (
      select 1 from public.room_players rp
      where rp.room_id = game_sessions.room_id
        and rp.user_id = auth.uid()
    )
  );

drop policy if exists events_insert_member on public.game_events;
create policy events_insert_member on public.game_events
  for insert with check (
    exists (
      select 1 from public.game_sessions gs
      join public.room_players rp on rp.room_id = gs.room_id
      where gs.id = game_events.session_id
        and rp.user_id = auth.uid()
    )
  );
