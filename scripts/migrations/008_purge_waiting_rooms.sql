-- NeoTopia · migration 008 · extend purge_e2e_test_data() to bot-hosted rooms of ANY status.
-- Authored by T2 S12 (2026-06-27). Applied to remote via Supabase MCP. Committed for the repo.
--
-- WHY: migrations 006/007 only deleted FINISHED bot-hosted rooms. The bot/E2E flow leaves rooms in
-- 'waiting' (never started) or 'playing' (crashed / turn-capped mid-game) — those never reach 'finished',
-- so the old purge left them ORPHANED and they accrued (55+ hand-purged across S10+S11 · a live scope
-- check right before this migration found 1 'playing' bot room the old RPC would have missed). The
-- room-status filter was never the safety boundary — the USERNAME PREFIX is. So we drop the status filter.
--
-- NOTE on the name: the forge framed this as "purge 'waiting' rooms" but the live orphan was 'playing', not
-- 'waiting' — the bot leaves rooms in EITHER non-finished status. The accurate fix is "any status", so the
-- observability key is named unfinished_rooms_deleted (status <> 'finished'), not waiting_rooms_deleted.
--
-- WHAT CHANGES vs 006: remove `and r.status = 'finished'` → delete bot-hosted rooms of ANY status. The
-- migration-005 FK cascade still clears room_players + game_sessions + game_events per deleted room.
-- Adds an unfinished_rooms_deleted count to the return (observability into the newly-covered rooms).
--
-- SAFETY (proven live BEFORE applying · scope SELECT via MCP): the prefix scope matched ONLY the 2 bot
-- profiles (BotAlpha%/BotBeta%) · 7 real profiles were NOT matched. A real or hand-typed name is SPARED.
--
-- SECURITY (unchanged hardening · Rules 26/44): SECURITY DEFINER · search_path pinned EMPTY · every object
-- schema-qualified (a definer fn with a mutable search_path is a privilege-escalation vector · matches
-- migrations 003/004/006). DEFENSE IN DEPTH: an in-body auth.uid() guard rejects any unauthenticated caller
-- even if EXECUTE is ever loosened — signInAnonymously() yields a non-null uid (the CI/teardown path), so
-- authenticated callers (including anonymous ones) still pass. Grant posture re-asserted from migration 007
-- (revoke from public + anon · grant to authenticated only) so this migration stands alone.
-- Idempotent · returns {rooms_deleted, unfinished_rooms_deleted, profiles_deleted}.
-- Rollback: re-apply migration 006's body (restores the status = 'finished' filter).

create or replace function public.purge_e2e_test_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rooms_deleted integer := 0;
  unfinished_rooms_deleted integer := 0;
  profiles_deleted integer := 0;
begin
  -- Defense in depth (Rule 44): reject unauthenticated callers even if EXECUTE is ever re-granted to anon.
  -- signInAnonymously() (the CI/teardown path) yields the `authenticated` role WITH a non-null uid → passes.
  if auth.uid() is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  -- Observability: how many of the about-to-be-deleted bot rooms were NOT finished (the newly-covered ones).
  select count(*) into unfinished_rooms_deleted
  from public.game_rooms r
  where r.status <> 'finished'
    and r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

  -- 1) ALL bot-hosted rooms (ANY status) · cascade (mig 005) cleans players + session + events per room.
  with gone as (
    delete from public.game_rooms r
    where r.host_id in (
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

  return jsonb_build_object(
    'rooms_deleted', rooms_deleted,
    'unfinished_rooms_deleted', unfinished_rooms_deleted,
    'profiles_deleted', profiles_deleted);
end;
$$;

-- Re-assert the migration-007 grant posture (CREATE OR REPLACE preserves grants, but make it explicit so
-- this migration stands alone and the anon revocation can never silently regress).
revoke execute on function public.purge_e2e_test_data() from public, anon;
grant  execute on function public.purge_e2e_test_data() to authenticated;
