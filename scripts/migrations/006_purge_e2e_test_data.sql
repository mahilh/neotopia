-- NeoTopia · migration 006 · purge_e2e_test_data() — anon-callable cleanup of E2E / bot test data.
-- Authored by T2 S9 (2026-06-26). Applied to remote via Supabase MCP. Committed for the repo.
--
-- WHY (requested by T3 S8 · comms): the E2E suite + bot create per-run player_profiles rows with UNIQUE
-- usernames and NO DELETE policy · neither the room host nor an anon client can remove them (own-row RLS),
-- so they accrue forever. T3 wanted a SECURITY DEFINER RPC it can call in a Playwright globalTeardown
-- WITHOUT shipping a service-role key into CI (the safer alternative to a service-role node script · the
-- repo has no service-role key in .env.local). This is that RPC.
--
-- WHAT it deletes (scoped to the deterministic TEST-username generators · NEVER by status alone):
--   1. FINISHED game_rooms whose host's profile username starts with E2E / BotAlpha / BotBeta · the
--      migration-005 FK cascade then clears room_players + game_sessions + game_events in one statement.
--   2. The residual player_profiles rows with those same test usernames.
--   A real or manually-typed name is SPARED · verified live before shipping (the only matches were the
--   E2E generator names · 'Mahil' / 'twergtery' / 'HostReal' / etc. do NOT match).
--
-- SECURITY: SECURITY DEFINER (so it can reach other users' rows that own-row RLS hides) · search_path
-- pinned EMPTY · every object schema-qualified (a definer function with a mutable search_path is a
-- privilege-escalation vector · matches migrations 003/004). anon-callable BY DESIGN, but the
-- username-prefix scope is the guard: the worst an anon caller can do is delete test-pattern data that
-- is meant to be ephemeral. Idempotent · returns a {rooms_deleted, profiles_deleted} summary.
-- Rollback: drop function public.purge_e2e_test_data();

create or replace function public.purge_e2e_test_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rooms_deleted integer := 0;
  profiles_deleted integer := 0;
begin
  -- 1) finished rooms hosted by a test user · cascade (mig 005) cleans players + session + events.
  with gone as (
    delete from public.game_rooms r
    where r.status = 'finished'
      and r.host_id in (
        select user_id from public.player_profiles
        where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
    returning 1)
  select count(*) into rooms_deleted from gone;

  -- 2) the residual test profiles (unique username · no DELETE policy · only a definer fn can remove them).
  with gone as (
    delete from public.player_profiles
    where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%'
    returning 1)
  select count(*) into profiles_deleted from gone;

  return jsonb_build_object('rooms_deleted', rooms_deleted, 'profiles_deleted', profiles_deleted);
end;
$$;

grant execute on function public.purge_e2e_test_data() to anon, authenticated;
