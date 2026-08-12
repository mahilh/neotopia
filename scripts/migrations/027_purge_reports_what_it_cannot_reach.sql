-- 027 · the purge reports what it CANNOT reach  (T2 S55)
--
-- ⚠ NOT APPLIED. Needs Mahil's explicit yes, in the form used for 023 and 026.
--    Migration 014 remains unapplied. 025's mass delete remains unapplied and is unrelated to this.
--
-- ⚠ READ-ONLY. This changes NO delete predicate. It adds two counters to the jsonb receipt the
--    function already returns, and touches nothing else. Diffed against the deployed body, the only
--    changes are two SELECTs and two keys.
--
-- ══ THE LEAK, MEASURED ═════════════════════════════════════════════════════════════════════════════
--   player_profiles                                        71
--     · matching E2E% / BotAlpha% / BotBeta%               22   <- reachable by this function
--     · OUTSIDE the reserved namespace                     49   <- 69%, unreachable FOREVER
--     · unreachable and created in the last 48h            10
--   observed unreachable prefixes, last 48h:
--     A11yEsc | A11yEsc2 | A11yProb | Probe320 | T3PRBH9E | T3PRBH9G | T3PRBP9E | test
--
-- Every one of those is a test identity that the cleanup routine can never delete, because the
-- routine identifies its rows BY USERNAME PREFIX and these do not carry one. They accumulate for the
-- lifetime of the project. `healthcheck.cjs` is a latent fifth producer · it mints `hc_<hex>` every
-- thirty minutes and currently deletes its own fixtures, so one failed cleanup is one permanent row.
--
-- ══ WHY THIS BELONGS IN THE PURGE AND NOT IN A WORKFLOW · a premise check that killed the first plan
-- My first design put this metric in scripts/healthcheck.cjs, which already runs every 30 minutes
-- with credentials and renders a summary. IT CANNOT WORK. player_profiles carries exactly one RLS
-- policy:
--     profiles_own   ALL   (user_id = auth.uid())
-- Own-row only. An anon or authenticated client counting profiles sees ITS OWN and nothing else, so
-- the metric would have reported 1 · or 0 · forever, in a workflow whose whole purpose is to notice
-- things. That is a false zero of exactly the kind Rule 80 is about, and it would have been shipped
-- into the alerting path. game_rooms is world-readable (rooms_read_all, qual true), but the ORPHANED
-- room count needs a join to player_profiles, so it is unreadable for the same reason.
--
-- So the only component in the system with the privilege to see this leak is a SECURITY DEFINER
-- function, and there is already exactly one that runs on every CI job and prints its result.
--
-- ══ WHAT IT ADDS ═══════════════════════════════════════════════════════════════════════════════════
--   profiles_unreachable   profiles this function can never delete, because their username carries
--                          no reserved prefix. Should be FLAT. Every increment is a new producer that
--                          did not use the namespace, and the run that increments it is the run that
--                          introduced it · which is the whole point of putting the number here rather
--                          than discovering it in a quarterly audit.
--   rooms_orphaned         rooms whose host has no profile row. Cannot be deleted by this function
--                          either (it finds rooms THROUGH profiles). 630 at the time of writing.
--
-- Both are pure SELECT COUNTs over small tables, computed before the deletes, and neither is used in
-- any predicate. The worst case of a mistake here is a wrong number in a log.
--
-- ══ WHAT THIS DOES NOT DO, said plainly ════════════════════════════════════════════════════════════
-- It does not fix the leak. Fixing it means either every producer adopting the namespace · which is
-- unenforceable, because the producers are dynamically-constructed strings in three lanes and my own
-- S52 guard cannot see them · or the flag column recorded as the destination in
-- src/lib/reservedNames.js. This makes the leak VISIBLE on every CI run so the decision has a number
-- attached, and it is deliberately the smaller move.
--
-- ⚠ AND IT IS THE COUNCIL TRIPWIRE'S SECOND STRIKE. reservedNames.js records: "if the prefix scheme
-- collides a SECOND time, the flag column stops being a destination and becomes the fix. One
-- collision is a bug; two is the design telling you." The first was a player being able to CLAIM a
-- reserved name (S51). This is the mirror image · producers failing to USE it, 49 times. Sophia's
-- dissent said a second collision was near-certain because every new spec is a new producer. It was.
-- I am not calling the tripwire myself: it is recorded, the evidence is here, and it is Mahil's call.
--
-- ══ PRE-APPLY VERIFICATION ═════════════════════════════════════════════════════════════════════════
--   [x] Base is the DEPLOYED body of 026 read via pg_get_functiondef, not a file (Rule 109a).
--   [x] Every DELETE predicate is byte-identical to the deployed one · verified by diff.
--   [x] Return shape is ADDITIVE · all eight existing keys keep their names and meanings, so
--       tests/e2e/global-teardown.js (T3's) needs no edit.
--   [x] `create or replace` preserves grants; none are restated. SECURITY DEFINER and
--       `set search_path to ''` preserved; every reference stays schema-qualified.
--   [x] The auth.uid() guard is preserved (Rule 44).
--   [x] The two new counts were run as SELECTs against production first · 49 and 630.

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
  grace constant interval := interval '30 minutes';
begin
  if auth.uid() is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  -- T2 S55 · WHAT THIS FUNCTION CANNOT REACH. Read-only, used in no predicate below.
  select count(*) into profiles_unreachable
  from public.player_profiles
  where not (username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

  select count(*) into rooms_orphaned
  from public.game_rooms r
  where not exists (select 1 from public.player_profiles p where p.user_id = r.host_id);

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
    -- ADDITIVE (T2 S55) · what this function can NEVER reach.
    'profiles_unreachable', profiles_unreachable,
    'rooms_orphaned', rooms_orphaned);
end;
$function$;

commit;

-- ══ AFTER APPLYING ═════════════════════════════════════════════════════════════════════════════════
-- profiles_unreachable should be FLAT at 49 and every increase names a run that introduced a producer
-- outside the namespace. rooms_orphaned starts at ~630 and is expected to keep climbing until the
-- room-orphaning mechanism is found · see docs/ORPHAN_DIAGNOSIS.md for everything measured about it.
