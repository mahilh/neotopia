-- NeoTopia · migration 003 · keep game_rooms.player_count accurate via a trigger.
-- Authored by T3 S3 (2026-06-25). Applied to remote via Supabase MCP. Committed for the repo.
--
-- WHY: clients cannot reliably maintain player_count. A non-host cannot UPDATE game_rooms under
-- the rooms_update_host RLS policy (host_id = auth.uid()), so the forge's join-time increment was
-- silently DENIED (0 rows). A naive client increment also races: two simultaneous joiners both read
-- count=1 and both write count=2. A trigger that RECOUNTS the actual room_players rows is both
-- race-safe (each recount reflects committed rows) and authoritative.
--
-- SECURITY: SECURITY DEFINER so the recount UPDATE bypasses rooms_update_host (the joiner who fires
-- the trigger is not the host). search_path is pinned EMPTY and every object is schema-qualified ·
-- a definer-rights function with a mutable search_path is a privilege-escalation vector, so we
-- remove that surface entirely (built-ins resolve via the always-present pg_catalog).
-- Idempotent (create-or-replace + drop-if-exists) · rollback = drop trigger + drop function.

create or replace function public.update_player_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_rooms
  set player_count = (
    select count(*) from public.room_players
    where room_id = coalesce(NEW.room_id, OLD.room_id)
  )
  where id = coalesce(NEW.room_id, OLD.room_id);
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_player_count on public.room_players;
create trigger trg_player_count
  after insert or delete on public.room_players
  for each row execute function public.update_player_count();
