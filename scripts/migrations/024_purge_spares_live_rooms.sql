-- 024 · purge_e2e_test_data stops deleting rooms that are being played right now  (T2 S49)
--
-- ⛔ SUPERSEDED BY 025, AND NEVER APPLIED. DO NOT APPLY THIS FILE.
--    Verified against the live database in S50 (Rule 109a · pg_get_functiondef and the migration
--    list, not a file): the newest applied migration is 023. This one never landed, despite the S50
--    brief describing it as having done so.
--
--    Kept rather than deleted because it is the record of a correct diagnosis, and because two of its
--    findings stand and are cited by 025 (game_rooms has no updated_at · the 30-minute window is
--    sized from the longest measured live spec). But it must not be applied, for two reasons:
--
--    1 · IT IS THE WEAKER HALF, MEASURED. Its guard protects a room that is young AND still in play.
--        Counted against production, that is zero rows today · every room created in the last half
--        hour is already 'finished'. The clause that actually stops one CI job destroying another's
--        rooms is an age guard on the PROFILE delete, which this file does not have, because in S49
--        I never checked whether player_profiles had a created_at column. It does.
--    2 · TWO COMMITTED, UNAPPLIED MIGRATIONS EACH REDEFINING ONE FUNCTION is exactly the
--        "migrations are a log, not a state" trap that cost T3 a wrong retraction in S46 (Rule 109).
--        Whoever applies next must not have to guess which file is meant.
--
--    Migration 014 remains unapplied and is unrelated.
--
-- ══ THE HAZARD, REINSTATED BY T3 AS RULE 109 ═══════════════════════════════════════════════════════
-- purge_e2e_test_data deletes game_rooms by host-username prefix with NO status and NO age predicate.
-- game_sessions has an ON DELETE CASCADE foreign key to game_rooms. So a teardown does not clean up
-- "this run" · it deletes EVERY E2E-hosted room in the project, including one two browsers are
-- playing in at that moment. That is T3's S45 measurement ("NO ROW for room_id while two browsers
-- played"), which they retracted in S46 after reading migration 006 and reinstated in S48 after
-- reading the DEPLOYED function. 008 had already dropped 006's status filter; its title says so.
--
-- ══ WHAT I VERIFIED, BECAUSE T3 FLAGGED THAT THEIR SUGGESTION RESTED ON AN UNCHECKED COLUMN ════════
-- Their proposed fix was "skip rooms updated within the last N minutes". IT CANNOT BE WRITTEN AS
-- SPECIFIED. Measured against the live schema:
--
--   game_rooms columns: id, room_code, host_id, status, max_players, player_count, created_at
--
-- There is NO updated_at. Only created_at exists, and it is a weaker signal: it says when the room
-- was opened, not when anything last happened in it. So the guard below is written on created_at and
-- the difference is stated rather than glossed · a room is protected for a fixed window after it is
-- CREATED, not for a window after it was last touched.
--
-- WINDOW SIZED FROM THE SPECS, NOT PICKED (Rule 81). The longest single live spec measured in this
-- repo is backend-recovery-live at ~3.0 minutes (it waits out a real websocket death); four-player
-- -live sets its own 240s per-test budget; multiplayer-endgame-live ran 22.7s. Rooms are created per
-- TEST, not per job, so the relevant number is the longest test and not the 40-minute job timeout.
-- 30 minutes is an order of magnitude of headroom over the worst measured spec, and the cost of the
-- window is only that a STRANDED unfinished room survives one extra half hour before the next run
-- sweeps it · which is the outcome 008 was written to avoid, delayed, not prevented.
--
-- FINISHED ROOMS ARE STILL SWEPT IMMEDIATELY, at any age. A finished room cannot be in play, so the
-- window would buy nothing and would only slow the cleanup 008 exists to do.
--
-- ══ WHAT THIS DELIBERATELY DOES NOT FIX, AND IT IS BIGGER ══════════════════════════════════════════
-- Measured tonight against production:
--
--   game_rooms                                        608
--     · whose host has NO player_profiles row         571      <-- unreachable by this function
--     · whose host still has one                       37
--   game_sessions                                     557
--
-- The room delete selects `host_id in (select user_id from player_profiles where username like ...)`
-- and the function then DELETES THOSE PROFILES. It destroys its own selector. Any room whose host
-- profile is already gone can never be matched again, so the purge simultaneously sweeps too WIDE in
-- time (killing live rooms) and too NARROW in reach (571 rooms it cannot touch). Both come from
-- selecting rooms through a table the same call empties.
--
-- That is a real leak and it is NOT addressed here, on purpose: fixing it means deleting 571 rooms
-- and 557 sessions in one statement, which is a different risk conversation and deserves its own
-- approval with its own dry run. Recorded so it is not rediscovered as a mystery. The narrow fix
-- first (Rule 46 · prove scope before wiring a destructive function into anything unattended).
--
-- ══ PRE-APPLY VERIFICATION ═════════════════════════════════════════════════════════════════════════
--   [x] LIVE definition read via pg_get_functiondef at the moment of writing, NOT from a migration
--       file · Rule 109a. Body below is the deployed 023 body plus one predicate.
--   [x] game_rooms.created_at CONFIRMED to exist (timestamptz); updated_at CONFIRMED ABSENT.
--   [x] game_rooms.status values present in production: finished, playing, waiting.
--   [x] game_sessions -> game_rooms FK confirmed (game_sessions_room_id_fkey), so the cascade T3
--       described is real and this predicate is what stands between a live session and deletion.
--   [x] The counter `unfinished_rooms_deleted` keeps its existing meaning · it counts what WOULD be
--       swept, and after this change some of those are spared, so it becomes an over-count of the
--       delete. Renaming it would break T3's global-teardown.js reader, so it stays and the new
--       `rooms_spared_recent` says what was held back. ADDITIVE, like 023.
--   [x] `create or replace` preserves grants · 023's read-back confirmed authenticated+postgres only,
--       anon EXECUTE false. No grant/revoke statement appears below; restating them risks widening.
--   [ ] APPROVAL FROM MAHIL · not applied.

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
begin
  if auth.uid() is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  select count(*) into unfinished_rooms_deleted
  from public.game_rooms r
  where r.status <> 'finished'
    and r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

  -- T2 S49 · what the new predicate holds back, counted before the delete so the receipt can say
  -- "I spared N" rather than leaving a caller to infer it from two numbers that no longer agree.
  select count(*) into rooms_spared_recent
  from public.game_rooms r
  where r.status <> 'finished'
    and r.created_at > now() - interval '30 minutes'
    and r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

  select coalesce(sum(games_played), 0), coalesce(sum(games_won), 0)
    into games_played_destroyed, games_won_destroyed
  from public.player_profiles
  where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%';

  with gone as (
    delete from public.game_rooms r
    where r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
      -- THE WHOLE CHANGE, and it is one clause: a room that is NOT finished and was created in the
      -- last 30 minutes is presumed to be a run in progress · possibly this one, possibly a
      -- concurrent one, possibly a human at a laptop · and is left alone. Finished rooms are swept
      -- at any age, because a finished room cannot be in play.
      and not (r.status <> 'finished' and r.created_at > now() - interval '30 minutes')
    returning 1)
  select count(*) into rooms_deleted from gone;

  -- NOTE, and it is the reason the profile delete is NOT similarly guarded: profiles carry the
  -- counters 023 reports and are matched by name alone, so sparing them would keep E2E rows in a
  -- 40-row table forever. The room guard is what protects a live run; the cascade runs from rooms.
  with gone as (
    delete from public.player_profiles
    where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%'
    returning 1)
  select count(*) into profiles_deleted from gone;

  return jsonb_build_object(
    'rooms_deleted', rooms_deleted,
    'unfinished_rooms_deleted', unfinished_rooms_deleted,
    'profiles_deleted', profiles_deleted,
    'games_played_destroyed', games_played_destroyed,
    'games_won_destroyed', games_won_destroyed,
    'rooms_spared_recent', rooms_spared_recent);
end;
$function$;

commit;

-- ══ AFTER APPLYING ═════════════════════════════════════════════════════════════════════════════════
-- Two concurrent E2E runs should both survive, and the receipt says so: the second teardown reports a
-- non-zero rooms_spared_recent instead of silently having deleted the first run's room. If it reports
-- 0 while a run is demonstrably in flight, the predicate is not matching and the guard is decorative ·
-- which is the failure mode worth watching for, because it looks exactly like success (Rule 80).
