-- 026 · the purge can no longer orphan a room  (T2 S51)
--
-- ⚠ MIGRATION 014 REMAINS UNAPPLIED AND IS UNRELATED.
--    SUPERSEDES 024 (never applied) and supersedes the AGE half of 025. 025's REACH clause · the mass
--    delete of the 593 historical orphans · is deliberately NOT here. See "WHAT IS HELD" below.
--
-- ══ THE DECISION THIS IMPLEMENTS ═══════════════════════════════════════════════════════════════════
-- Mahil, S51, after LLM Council: "ship the age-guard predicate NOW, hold the mass delete · the
-- age-guard is the fix; the deletion is housekeeping wearing the fix's clothes." That split is right
-- and this file is only the first half of it.
--
-- ══ THE MECHANISM, WHICH IS ALSO THE CI COLLISION ══════════════════════════════════════════════════
-- Two workflows fire on every push to main and both run tests/e2e/global-teardown.js ->
-- purge_e2e_test_data(). Run A's purge deletes run B's PROFILES while B is still playing. From that
-- instant B's rooms have a host_id with no profile row, and since the function finds rooms only
-- THROUGH profiles, nothing can ever reach them again. 593 of 630 production rooms are in that state
-- and the deployed function deletes exactly ZERO rooms per call · verified live, and its own receipt
-- has been printing `{"rooms_deleted":0,"profiles_deleted":0}` every run for sessions.
--
-- One cause, one fix: NOTHING YOUNG MAY BE DELETED. `player_profiles` has a `created_at` column (0 of
-- 40 rows null, verified live) · S49 wrote the room half of this guard without checking whether the
-- profile half was even possible, which is why 024 protected zero rows.
--
-- ══ THE INVARIANT · AND IT IS A CLOSED ARGUMENT, NOT A HEURISTIC (Rule 100b) ═══════════════════════
-- AFTER THIS MIGRATION, purge_e2e_test_data() CANNOT CREATE AN ORPHAN.
--
-- The naive version of this fix does not achieve that, and the hole is easy to miss. Age-guarding the
-- two deletes INDEPENDENTLY still allows:
--     t=0      job mints profile P
--     t=31m    the same long-running job opens room R using P    (job timeout is 40 minutes)
--     t=32m    purge runs · P is older than the grace window so it is DELETED
--                            R is younger than the window so it is SPARED
--              -> R is orphaned, by the very function written to stop orphaning
-- So the profile delete additionally refuses to remove a profile that still owns a PROTECTED room.
-- With that clause the argument closes:
--     a room is deleted            -> it is not orphaned, it is gone
--     a room survives and is old   -> its profile is deletable, but the room was in scope and was
--                                     deleted in the same transaction, so this case is empty
--     a room survives and is young -> its profile is explicitly retained by the new clause
-- therefore every surviving room still has its profile. There is no fourth case. That is what makes
-- this safe to ship without the reach clause: the leak stops growing even though the backlog remains.
--
-- ══ WHAT IS HELD, AND THE TRIPWIRE ═════════════════════════════════════════════════════════════════
-- The 593 existing orphans are NOT deleted by this migration. They are unreachable garbage and they
-- stay unreachable. Mahil's reasoning: the deletion is housekeeping, and housekeeping should wait for
-- a reason rather than be done because it is available.
--
--   TRIPWIRE (recorded S51): if orphaned rooms pass ~1000, or begin affecting query performance, the
--   mass delete stops being housekeeping and becomes the fix. The reference implementation of the
--   reach clause is in 025 and should be applied ON TOP of this body, not instead of it.
--
-- AND THE EVIDENCE ARGUMENT AGAINST THE MASS DELETE IS GONE · I raised it in S50 and it was wrong.
-- I reported "177 draw-audit rows from migration 021"; measured, 175 of those carry `event_data = '{}'`
-- and only 2 carry the audit payload, both of them the E2E harness's own `audit_offer_0` fixture. The
-- full readout is docs/DRAW_AUDIT_READOUT.md. It does not re-open the decision · it just means the
-- held delete is cheap AND worthless rather than cheap and risky.
--
-- ══ PRE-APPLY VERIFICATION, AGAINST THE LIVE DATABASE ══════════════════════════════════════════════
--   [x] DEPLOYED body read via pg_get_functiondef (md5 609b25d565283834eec1aad2e4c4f21d) · the base
--       below is 023's live body plus predicates. NOT read from a migration file (Rule 109a).
--   [x] newest applied migration = 20260811175146 (023). 024 and 025 confirmed unapplied.
--   [x] player_profiles.created_at EXISTS, timestamptz, 0 of 40 rows null.
--   [x] game_rooms has created_at and NO updated_at · the guard is on CREATION time and says so.
--   [x] game_rooms.status is nullable. `status is distinct from 'finished'` is used where a NULL must
--       count as unfinished; the delete's own clause is written `status = 'finished' or created_at <=`
--       so a NULL status falls through to the age test, i.e. it is treated as in-play and protected.
--       Three-valued logic silently widens DELETEs and this is where it would (Rule 26).
--   [x] grants BEFORE: authenticated:EXECUTE, postgres:EXECUTE · anon EXECUTE false · prosecdef true ·
--       proconfig search_path="". `create or replace` preserves all of these and none are restated.
--   [x] Return shape is ADDITIVE · every existing key keeps its name and meaning, so
--       tests/e2e/global-teardown.js (T3's file) needs no edit.
--   [x] NO row is deleted that the deployed function would not already delete. This migration only
--       ever SUBTRACTS from the delete set, so the worst case of a mistake here is that cleanup stops
--       happening · not that something extra is destroyed. That asymmetry is why this half is
--       shippable and the reach half is not.

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
  -- ONE constant for every predicate below. A window that differed between the room clause and the
  -- profile clause would re-open the orphaning race in the gap between them.
  -- SIZED FROM THE SPECS, NOT PICKED (Rule 81): the longest single live spec in this repo is
  -- backend-recovery-live at ~3.0 minutes; four-player-live budgets 240s per test; the endgame spec
  -- ran 22.7s. Rooms and profiles are created per TEST, so the relevant figure is the longest TEST,
  -- not the 40-minute job timeout. 30 minutes is an order of magnitude of headroom.
  grace constant interval := interval '30 minutes';
begin
  -- Defense in depth (Rule 44): reject unauthenticated callers even if EXECUTE is ever re-granted to anon.
  if auth.uid() is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  select count(*) into unfinished_rooms_deleted
  from public.game_rooms r
  where r.status is distinct from 'finished'
    and r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
    and r.created_at <= now() - grace;

  -- SPARED COUNTS, read before the deletes. A guard that only reports what it destroyed cannot show
  -- that it fired, and a guard nobody has seen fire is a guard nobody knows works (Rule 86 / Rule 80).
  -- profiles_spared_live_room is the one to watch: it is the clause that closes the orphaning hole,
  -- and it is expected to be non-zero exactly when two jobs overlap.
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

  -- T2 S48 · the evidence, taken before it is destroyed (migration 023). Unchanged in meaning; the
  -- predicate is aligned with the profile delete below so the sums describe the rows this call
  -- actually removes rather than the rows it once would have.
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

  -- ROOMS. Scope is unchanged from the deployed body (host username prefix · migration 008
  -- deliberately removed the status filter and that is NOT being reverted). The only change is the
  -- age guard: a FINISHED room is swept at any age because it cannot be in play, and an unfinished
  -- one is protected until it is older than the grace window.
  with gone as (
    delete from public.game_rooms r
    where r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
      and (r.status = 'finished' or r.created_at <= now() - grace)
    returning 1)
  select count(*) into rooms_deleted from gone;

  -- PROFILES · THE ROOT-CAUSE FIX. Two clauses, and the second one is the one that closes the
  -- invariant: never delete a profile that still owns a room this same call has protected, or the
  -- guard above would hand us the orphan directly (see THE INVARIANT in the header).
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
    -- ADDITIVE (T2 S51). Existing readers are unaffected.
    'rooms_spared_recent', rooms_spared_recent,
    'profiles_spared_recent', profiles_spared_recent,
    'profiles_spared_live_room', profiles_spared_live_room);
end;
$function$;

commit;

-- ══ AFTER APPLYING ═════════════════════════════════════════════════════════════════════════════════
-- WHAT TO EXPECT, so a surprising receipt is recognisable as one:
--   rooms_deleted              stays at or near 0 for now · there are no E2E profiles left to find
--                              rooms through, and the 593 historical orphans are deliberately out of
--                              scope. It should start moving as new runs create and then age out.
--   profiles_spared_recent     non-zero whenever a purge overlaps a running job · this is the fix
--                              working, and it is the number that says the collision is closed.
--   profiles_spared_live_room  expected to be RARE (it needs a job older than the grace window that
--                              is still opening rooms). If it is never non-zero that is fine; if it
--                              is FREQUENT, the grace window is shorter than a real job and should be
--                              re-sized from measurement rather than raised by feel.
--   orphan count               should stop GROWING. It will not shrink · that is the held half.
--
-- THE ONE-QUERY CHECK that this migration did what it claims, run against production any time:
--   select count(*) from public.game_rooms r
--   where not exists (select 1 from public.player_profiles p where p.user_id = r.host_id);
-- Measured 593 immediately before applying. If that number climbs, the invariant above is wrong and
-- the argument in the header needs re-deriving, not the window widening.
