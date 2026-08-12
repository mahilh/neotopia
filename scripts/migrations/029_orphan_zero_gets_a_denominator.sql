-- 029 · a zero orphan count is UNREADABLE without exposure  (T2 S58)
--
-- ⚠⚠ HELD · NOT APPLIED. It reads the `auth` schema, which is a NEW CLASS OF ACCESS for a function
--    any authenticated player can execute. That needs Mahil's yes, not my judgement. Section
--    "THE SURFACE THIS ADDS" states exactly what a caller would learn.
--    Migration 014 and 025's mass delete remain unapplied.
--
-- ⚠ READ-ONLY. No delete predicate changes. Three SELECTs and three keys, exactly like 027 and 028.
--
-- ══ MY OWN 028 IS THE THING THIS FIXES, ONE SESSION OLD ════════════════════════════════════════════
-- 028 shipped `rooms_orphaned_1d` so the receipt could answer "is a producer still open" without a
-- human diffing two runs from memory. It cannot answer it, and the reason is not a bug in the SQL:
--
--     rooms_orphaned_1d = 0  can mean  the producer is CLOSED
--     rooms_orphaned_1d = 0  can mean  NOTHING RAN
--
-- and the counter cannot tell them apart. This is Rule 80 in the instrument I built to answer exactly
-- this question · a plausible zero that reads as health.
--
-- IT COST A CLAIM THE SAME NIGHT IT MATTERED. Diagnosing the producer I wrote "five E2E runs since
-- T3's fix, zero orphans" and used it to judge whether the producer was closed. THREE OF THE FIVE
-- WERE CANCELLED (see scripts/ci-receipt.cjs), and only ONE room existed in the whole 11.8-hour
-- window · because a SUCCESSFUL cleanup deletes its own evidence. So `game_rooms` cannot supply its
-- own denominator: the passing case leaves no row, which is Rule 110's corollary aimed at my counter
-- rather than at a writer ("is the write failing, or is the evidence being deleted?").
--
-- AND MAHIL'S PRECONDITION FOR THE MASS DELETE IS EXACTLY THIS NUMBER · "do not run it until the
-- orphan counter has shown a flat day". A quiet weekend satisfies that sentence while proving
-- nothing. The delete is held on a reading the instrument cannot currently make.
--
-- ══ WHAT IT ADDS · the exposure the zero needs ═════════════════════════════════════════════════════
--   identities_1d       auth identities created in the last 24 hours
--   identities_total    the level, against a metered MAU cap on the FREE plan
--   identities_nonanon  identities that are NOT anonymous · i.e. the fixed CI pool
--
-- HOW TO READ THE RECEIPT once this is applied:
--   orphaned_1d 0  · identities_1d 0     UNMEASURED. Nobody ran. Says nothing about any producer.
--   orphaned_1d 0  · identities_1d high  the producer WAS exercised and did not orphan. Real evidence.
--   orphaned_1d > 0                      a producer is open regardless of exposure. Diagnose.
--
-- WHY auth.users IS THE RIGHT DENOMINATOR AND player_profiles IS NOT. The obvious choice is "E2E
-- profiles created recently", and it fails for the same reason the rooms do: THE PURGE DELETES THEM,
-- so at any instant only the 30-minute grace window is visible and a 24-hour count is structurally
-- impossible. auth.users is the one table in the blast radius of every harness run that NOTHING in
-- this project can delete · which is the property that makes it a permanent leak (Rule 124) and the
-- same property that makes it an honest denominator.
--
-- ══ AND IT IS THE POOL'S ONLY OBSERVABLE ═══════════════════════════════════════════════════════════
-- S58 proved the pool credential authenticates (verify-pool-signin.cjs, green in CI: not anonymous,
-- pre-existing, reused not minted). What no instrument can yet see is whether the app BRANCH is being
-- taken · T3's per-context allocator is not built, so every CI browser still mints an identity.
-- identities_1d is that observable. It sits at 968/day today. If the pool lands and works, it falls,
-- and if it does not fall the pool is inert no matter how green its unit tests are. That is precisely
-- the gap I named in the S57 close ("a rigorous safety proof and zero evidence of function") and a
-- counter is the cheapest way to stop it becoming a spec that runs nowhere (Rule 79).
--
-- ══ THE SURFACE THIS ADDS · the reason it is held ══════════════════════════════════════════════════
-- purge_e2e_test_data is EXECUTE-granted to `authenticated`, which is every signed-in player. After
-- this, such a caller learns THREE AGGREGATE COUNTS about auth.users. It returns:
--   · no email, no id, no timestamp, no user data of any kind · three integers
-- but "how many accounts exist" is still information this function did not previously disclose, and
-- the auth schema is not somewhere a public-facing function has reached before in this project.
-- I judge the risk low and I am not the right person to accept it silently (Rule 44's spirit · a
-- SECURITY DEFINER reachable by a player is a surface, and every widening of it is a decision).
-- THE NARROWER ALTERNATIVE if the answer is no: return the counts only to `postgres`/service callers
-- and NULL otherwise. It costs one `current_user` branch and makes the number invisible to the CI
-- teardown, which is the only place it is read · so it is strictly worse unless the disclosure is
-- actually unacceptable.
--
-- ══ PRE-APPLY VERIFICATION ═════════════════════════════════════════════════════════════════════════
--   [x] Base is the DEPLOYED body of 028, confirmed by md5 bd5f010742cd42e951edfeb6a378293b AND by
--       asserting both 028 keys are present in pg_get_functiondef · not by trusting the file (109a).
--   [x] Exactly one purge_e2e_test_data exists in public (fn_count 1 · no overload to shadow).
--   [x] Owner is `postgres`, prosecdef true, and that owner HAS SELECT on auth.users and USAGE on
--       schema auth · measured before this was written, not assumed (Rule 123a · check the vantage
--       point is permitted to see the thing BEFORE designing the instrument).
--   [x] search_path is '' so auth.users is fully qualified · an unqualified `users` resolves to
--       nothing and would fail at runtime, not at apply time.
--   [x] Every DELETE predicate byte-identical to the deployed one.
--   [x] Return shape ADDITIVE · all twelve existing keys keep their names, so global-teardown.js and
--       scripts/healthcheck.cjs need no edit.
--   [x] `create or replace` preserves grants (authenticated:EXECUTE, postgres:EXECUTE); none restated.
--   [x] auth.uid() guard preserved (Rule 44).
--
-- MEASURED IMMEDIATELY BEFORE WRITING, so the first receipt has something to compare against:
--   auth_users_total 5978 · identities_1d 968 · identities_3h 24 · non_anon 1 · rooms_orphaned_1d 81
--   (identities_3h 24 against 0 orphans in that window is the first real evidence that T3's
--    softCleanup fix closed the producer · the window was exercised, not idle.)

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
  identities_1d integer := 0;
  identities_total integer := 0;
  identities_nonanon integer := 0;
  grace constant interval := interval '30 minutes';
begin
  if auth.uid() is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  select count(*) into profiles_unreachable
  from public.player_profiles
  where not (username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

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

  -- T2 S58 · THE EXPOSURE DENOMINATOR. Aggregates only · no id, no email, no timestamp leaves here.
  -- Without these, a zero above is unreadable: "the producer is closed" and "nobody ran" are the
  -- same number, and the mass delete is gated on telling them apart.
  select count(*) into identities_total from auth.users;
  select count(*) into identities_1d from auth.users where created_at > now() - interval '24 hours';
  select count(*) into identities_nonanon from auth.users where not is_anonymous;

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
    'rooms_orphaned_1d', rooms_orphaned_1d,
    'profiles_unreachable_1d', profiles_unreachable_1d,
    -- ADDITIVE (T2 S58) · the exposure that makes a zero above readable, and the only observable
    -- the fixed CI pool has. Aggregates only.
    'identities_1d', identities_1d,
    'identities_total', identities_total,
    'identities_nonanon', identities_nonanon);
end;
$function$;

commit;

-- ══ AFTER APPLYING ═════════════════════════════════════════════════════════════════════════════════
-- The receipt becomes self-interpreting and the mass-delete precondition becomes decidable:
--   identities_1d ~0                      -> the window is IDLE. Any orphan zero is UNMEASURED.
--   identities_1d high + orphaned_1d 0    -> exercised and clean. THIS is "a flat day".
--   identities_1d falling over sessions   -> the pool is actually being used by the harness.
-- Baseline on the day it is applied: identities_1d 968, identities_nonanon 1, orphaned_1d 81.
