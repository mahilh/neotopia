-- 028 · the orphan counter answers "is it still growing" without memory  (T2 S57)
--
-- ⚠ READ-ONLY. No delete predicate changes. Two SELECTs and two keys, exactly like 027.
--    Migration 014 and 025's mass delete remain unapplied.
--
-- ══ MY OWN S56 CRITIQUE, AND IT MATTERS MORE NOW THAN WHEN I WROTE IT ══════════════════════════════
-- S56 shipped `rooms_orphaned` (a LEVEL) and re-sited the tripwire onto the DERIVATIVE in the same
-- session. So the number the receipt prints is not the number the tripwire reads, and answering
-- "is it still growing" requires diffing one CI run against a previous one BY EYE · which is exactly
-- the manual step that stops happening.
--
-- IT IS NOW THE ONLY QUESTION THAT MATTERS. T3 has closed two producers in two sessions ·
-- cleanupSeeded stripping seats off rooms it failed to delete (0cd6b60), and softCleanup never
-- deleting the room at all (954d362) · so the next thing the counter has to answer, alone and without
-- a human comparing runs, is whether ANOTHER producer exists. A level cannot answer that. A level
-- after a fix looks exactly like a level before one.
--
-- ══ WHAT IT ADDS ═══════════════════════════════════════════════════════════════════════════════════
--   rooms_orphaned_1d      orphaned rooms CREATED in the last 24 hours
--   profiles_unreachable_1d  unsweepable profiles CREATED in the last 24 hours
--
-- Both are self-contained: one receipt line now says "644 orphans, 6 of them from today" and the
-- second number is the derivative. Zero for a day means every remaining producer is closed and the
-- backlog is inert garbage · which is the precondition Mahil set for the mass delete
-- ("do not run it until the orphan counter has shown a flat day").
--
-- WHY A 24-HOUR SLICE AND NOT A DELTA TABLE. A delta needs somewhere to remember the last value,
-- which is a new table, a write inside a read path, and a thing that can itself go stale. A window
-- over `created_at` is stateless and correct on the first call · no memory, nothing to seed, and it
-- reads the same whether the purge ran once today or forty times.
--
-- ⚠ AND IT IS A WINDOW ON CREATION, NOT ON ORPHANING. A room created yesterday and orphaned today
-- counts as YESTERDAY's. That is the honest limit and it is acceptable here because the producers
-- measured so far orphan a room within its own run · but if a slow orphaning mechanism ever appears,
-- this number will under-report it and the level will be the only witness. Stated so nobody reads a
-- zero here as proof of no production (Rule 80: name the failure the measurement cannot see).
--
-- ══ PRE-APPLY VERIFICATION ═════════════════════════════════════════════════════════════════════════
--   [x] Base is the DEPLOYED body of 027, read via pg_get_functiondef (md5 75a4a30a...), not a file.
--   [x] Every DELETE predicate byte-identical to the deployed one.
--   [x] game_rooms.created_at and player_profiles.created_at both confirmed present and timestamptz.
--   [x] Return shape ADDITIVE · all ten existing keys keep their names, so global-teardown.js needs
--       no edit.
--   [x] `create or replace` preserves grants; none restated. SECURITY DEFINER + empty search_path
--       preserved. auth.uid() guard preserved (Rule 44).

begin;

create or replace function public.purge_e2e_test_data()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  rooms_deleted integer := 0;
  unfinished_rooms_deleted integer := 0;
  profiles_deleted integer := 0;
  games_played_destroyed bigint := 0;
  games_won_destroyed bigint := 0;
  rooms_spared_recent integer := 0;
  profiles_spared_recent integer := 0;
  profiles_spared_live_room integer := 0;
  profiles_unreachable integer := 0;
  rooms_orphaned integer := 0;
  rooms_orphaned_1d integer := 0;
  profiles_unreachable_1d integer := 0;
  grace constant interval := interval '30 minutes';
begin
  if auth.uid() is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  select count(*) into profiles_unreachable
  from public.player_profiles
  where not (username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

  -- T2 S57 · THE DERIVATIVE. Same predicate, windowed on creation, so one receipt answers whether a
  -- producer is still open without anyone remembering yesterday's number.
  select count(*) into profiles_unreachable_1d
  from public.player_profiles
  where not (username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
    and created_at > now() - interval '24 hours';

  select count(*) into rooms_orphaned
  from public.game_rooms r
  where not exists (select 1 from public.player_profiles p where p.user_id = r.host_id);

  select count(*) into rooms_orphaned_1d
  from public.game_rooms r
  where not exists (select 1 from public.player_profiles p where p.user_id = r.host_id)
    and r.created_at > now() - interval '24 hours';

  select count(*) into unfinished_rooms_deleted
  from public.game_rooms r
  where r.status is distinct from 'finished'
    and r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
    and r.created_at <= now() - grace;

  select count(*) into rooms_spared_recent
  from public.game_rooms r
  where r.status is distinct from 'finished'
    and r.created_at > now() - grace
    and r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

  select count(*) into profiles_spared_recent
  from public.player_profiles
  where (username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
    and created_at > now() - grace;

  select count(*) into profiles_spared_live_room
  from public.player_profiles pp
  where (pp.username like 'E2E%' or pp.username like 'BotAlpha%' or pp.username like 'BotBeta%')
    and pp.created_at <= now() - grace
    and exists (
      select 1 from public.game_rooms r
      where r.host_id = pp.user_id
        and r.status is distinct from 'finished'
        and r.created_at > now() - grace);

  select coalesce(sum(games_played), 0), coalesce(sum(games_won), 0)
    into games_played_destroyed, games_won_destroyed
  from public.player_profiles pp
  where (pp.username like 'E2E%' or pp.username like 'BotAlpha%' or pp.username like 'BotBeta%')
    and pp.created_at <= now() - grace
    and not exists (
      select 1 from public.game_rooms r
      where r.host_id = pp.user_id
        and r.status is distinct from 'finished'
        and r.created_at > now() - grace);

  with gone as (
    delete from public.game_rooms r
    where r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
      and (r.status = 'finished' or r.created_at <= now() - grace)
    returning 1)
  select count(*) into rooms_deleted from gone;

  with gone as (
    delete from public.player_profiles pp
    where (pp.username like 'E2E%' or pp.username like 'BotAlpha%' or pp.username like 'BotBeta%')
      and pp.created_at <= now() - grace
      and not exists (
        select 1 from public.game_rooms r
        where r.host_id = pp.user_id
          and r.status is distinct from 'finished'
          and r.created_at > now() - grace)
    returning 1)
  select count(*) into profiles_deleted from gone;

  return jsonb_build_object(
    'rooms_deleted', rooms_deleted,
    'unfinished_rooms_deleted', unfinished_rooms_deleted,
    'profiles_deleted', profiles_deleted,
    'games_played_destroyed', games_played_destroyed,
    'games_won_destroyed', games_won_destroyed,
    'rooms_spared_recent', rooms_spared_recent,
    'profiles_spared_recent', profiles_spared_recent,
    'profiles_spared_live_room', profiles_spared_live_room,
    'profiles_unreachable', profiles_unreachable,
    'rooms_orphaned', rooms_orphaned,
    -- ADDITIVE (T2 S57) · the derivative the re-sited tripwire actually reads.
    'rooms_orphaned_1d', rooms_orphaned_1d,
    'profiles_unreachable_1d', profiles_unreachable_1d);
end;
$function$;

commit;

-- ══ AFTER APPLYING ═════════════════════════════════════════════════════════════════════════════════
-- THE TRIPWIRE NOW READS ITSELF:
--   rooms_orphaned_1d > 0 across successive runs  ->  a producer is still open. Diagnose, do not delete.
--   rooms_orphaned_1d = 0 for a full day          ->  the backlog is inert. The mass delete (025's
--                                                     reach clause) becomes housekeeping and Mahil's
--                                                     stated precondition is met.
-- Measured immediately before applying, so the first receipt can be compared against something.
