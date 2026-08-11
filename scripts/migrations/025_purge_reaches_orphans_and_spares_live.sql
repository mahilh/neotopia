-- 025 · the purge reaches what it orphaned, and stops orphaning it  (T2 S50)
--
-- ⛔ HELD. ITS AGE HALF SHIPPED AS 026 (APPLIED T2 S51); ITS REACH HALF IS DELIBERATELY NOT APPLIED.
--
--    MAHIL'S S51 DECISION, after LLM Council: "ship the age-guard predicate NOW, hold the mass
--    delete · the age-guard is the fix; the deletion is housekeeping wearing the fix's clothes."
--    So this file is no longer a candidate to apply AS IS · 026 is the deployed body and applying
--    this one would REVERT 026's orphan-invariant clause while also running the mass delete.
--
--    WHAT THIS FILE IS NOW: the reference implementation of the REACH clause, kept for the day the
--    tripwire fires. To use it, lift ONLY the `or not exists (... player_profiles ...)` disjunct in
--    the room DELETE and add it on top of 026's body. Do not apply this file wholesale.
--
--    TRIPWIRE (recorded S51): orphaned rooms past ~1000, or a measurable query-performance impact.
--    Measured 597 at the moment 026 was applied, growing roughly 4 per hour.
--
--    AND THE EVIDENCE ARGUMENT IN THIS HEADER IS WRONG · see docs/DRAW_AUDIT_READOUT.md. It says the
--    delete would destroy "177 draw_card audit rows from migration 021". 175 of those carry an EMPTY
--    payload and only 2 carry the audit fields, both being the harness's own `audit_offer_0` fixture.
--    The corpus holds nothing recoverable. That does not re-open the decision · it means the held
--    delete is cheap AND worthless, which is a better reason to leave it alone than the one I gave.
--
--    ⚠ ORIGINAL S50 HEADER FOLLOWS · NOT APPLIED. NEEDS MAHIL'S EXPLICIT YES, in the form S49 used
--    for 023 ("Apply it").
--    Migration 014 remains unapplied and is unrelated.
--    SUPERSEDES 024, which was written in S49 and never applied · see the note at the bottom.
--
-- ⚠ AND IT CORRECTS A PREMISE IN THE S50 BRIEF. The brief says "024 landed for the time window."
--    IT DID NOT. Verified against the live database, not against the file (Rule 109a): the newest
--    applied migration is `20260811175146 023_purge_reports_what_it_destroys`. 024 is committed and
--    unapplied. That matters here rather than being pedantry, because the reach half below is only
--    SAFE because of the time window · applying reach onto a database that does not have 024's guard
--    would delete rooms that live runs are playing in. The two halves are one change and this file
--    is that one change.
--
-- ══ WHAT IS ACTUALLY WRONG, MEASURED LIVE TODAY ════════════════════════════════════════════════════
--
--   game_rooms                                                630
--     · whose host has NO player_profiles row                 593     <- unreachable by the purge
--     · reachable by the DEPLOYED purge right now               0     <- it deletes nothing at all
--     · whose host has a real (non-E2E) profile                37
--   game_sessions                                             579
--   player_profiles                                            40
--     · matching the purge's own E2E patterns                   0
--
-- THE PURGE IS CURRENTLY INERT. Not "too narrow" · ZERO. It selects rooms via
-- `host_id in (select user_id from player_profiles where username like 'E2E%' ...)` and then DELETES
-- those profiles, so it destroys its own selector. Every E2E profile has already been consumed, and
-- what is left is 593 rooms it can no longer see, growing by a handful an hour (the newest orphan
-- was four minutes old when this was written).
--
-- ══ AND THE ORPHANING IS THE CI COLLISION, NOT A SEPARATE BUG ══════════════════════════════════════
-- This is the part worth reading twice, because it retires a problem I failed to fix last session.
-- Two workflows fire on every push to main and both run global-teardown.js. Run A's purge deletes
-- run B's PROFILES while B is still playing · B's rooms are orphaned at that instant, and from then
-- on nothing can ever reach them. So the leak and the collision have ONE cause, and one fix:
--
--   AGE-GUARD THE PROFILE DELETE, and a concurrent run's identities are untouchable.
--
-- In S49 I tried to fix the collision at the CI layer with a shared concurrency group. It cancelled
-- the Placement Guard on two consecutive pushes · a merge gate that cannot fail, strictly worse than
-- the collision · and I reverted it. The fix was never a mutex. It is that a cleanup routine should
-- not be able to touch anything younger than the job that is running. (`.github/` needed no change.)
--
-- ══ WHAT I VERIFIED AGAINST THE LIVE SCHEMA BEFORE WRITING A LINE ══════════════════════════════════
--   [x] DEPLOYED body read via pg_get_functiondef · the base below is 023's live body, not a file.
--   [x] game_rooms columns: id, room_code, host_id, status, max_players, player_count, created_at.
--       THERE IS NO updated_at · T3's suggested "skip rooms updated in the last N minutes" cannot be
--       written as specified, so the guard is on created_at and the difference is stated, not glossed.
--   [x] player_profiles HAS created_at, 0 of 40 rows null · so the profile delete can be age-guarded
--       too, which is the collision fix above. This is the column S49 did not think to look for.
--   [x] host_id is NULLABLE (0 null rows today). `not exists (...)` is true for a null host_id, so a
--       null-host room reads as an orphan · which is correct, and it is also unreachable by anything
--       else. Called out because it is the kind of three-valued-logic detail that silently widens a
--       DELETE (Rule 26).
--   [x] CASCADE GRAPH, enumerated rather than assumed:
--         game_rooms -> game_sessions (CASCADE) -> game_events (CASCADE)
--         game_rooms -> room_players  (CASCADE)
--       NOTHING references player_profiles · confirming the one clause of Rule 105 that survived S48.
--       global_neotopia_index and game_wins do NOT reference rooms, so THE LEDGER IS UNAFFECTED.
--   [x] `create or replace function` preserves grants · 006's revoke-from-public and
--       grant-to-authenticated are untouched and are NOT restated (restating risks widening them).
--   [x] SECURITY DEFINER + `set search_path to ''` preserved · every reference stays schema-qualified.
--   [x] The auth.uid() guard is preserved (Rule 44).
--   [x] Return shape is ADDITIVE · every existing key keeps its name and meaning, so
--       tests/e2e/global-teardown.js (T3's file) needs no edit.
--
-- ══ EXACTLY WHAT THE FIRST RUN DESTROYS · measured, not estimated ══════════════════════════════════
-- Run the counting query at the bottom of this file immediately before applying; these are today's,
-- and they are computed with THIS FILE'S PREDICATE rather than a paraphrase of it:
--
--   game_rooms                                       593    of 630 · 37 survive
--   game_sessions   (cascade)                        573    of which 562 are not 'finished' · 6 survive
--   room_players    (cascade)                         38
--   game_events     (cascade)                        234    of 242 total · 97%
--     · of which draw_card audit rows                177    <- migration 021's evidence
--
-- ⚠ THAT FIRST NUMBER WAS 587 IN MY FIRST DRAFT OF THIS HEADER, AND IT WAS WRONG. I wrote the table
-- from a simplified query (`orphan AND older than 30 minutes`) rather than from the predicate the
-- function actually uses, and the two differ by the six recent rooms that are already 'finished' ·
-- which this migration deliberately sweeps at any age. A destruction count paraphrased from the
-- change instead of computed from it is Rule 81 in the place it is least affordable. Kept visible
-- rather than silently corrected, because the next person to size a delete will be tempted the same way.
--
-- THE 177 DRAW-AUDIT ROWS ARE THE ONE REAL LOSS AND I AM NOT GLOSSING IT. They are the artifact
-- migration 021 was built to produce. They belong to dead E2E rooms and the PROOF they supported is
-- tests/e2e/draw-rpc-audit.mjs (12/12, re-runnable), not the rows themselves · but "97% of
-- game_events" is a sentence someone should read before saying yes, not after.
--
-- WHY NOT KEEP THEM. Exempting rooms that carry audit rows would make the purge's reach depend on
-- whether a game happened to draw a card, which is a second, invisible selector · the exact class of
-- bug this migration exists to remove. If the audit rows are worth keeping they should be copied to a
-- table that does not cascade from game_rooms, which is a separate piece of work and a real one.
--
-- ══ WHAT THIS STILL DOES NOT DO ════════════════════════════════════════════════════════════════════
-- The 37 rooms whose host has a REAL profile are untouched, correctly · they include whatever human
-- play exists. This function has never had a way to tell an abandoned human room from a live one and
-- still does not; that needs a heartbeat column, not a cleanup routine.

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
  orphan_rooms_deleted integer := 0;
  rooms_spared_recent integer := 0;
  profiles_spared_recent integer := 0;
  -- ONE constant, used by every predicate below. A window that differs between the room clause and
  -- the profile clause would re-open the orphaning race in the gap between them.
  -- SIZED FROM THE SPECS, NOT PICKED (Rule 81): the longest single live spec in this repo is
  -- backend-recovery-live at ~3.0 minutes; four-player-live budgets 240s per test; the endgame spec
  -- ran 22.7s. Rooms and profiles are created per TEST, so the relevant number is the longest test,
  -- not the 40-minute job timeout. 30 minutes is an order of magnitude of headroom.
  grace constant interval := interval '30 minutes';
begin
  -- Defense in depth (Rule 44): reject unauthenticated callers even if EXECUTE is ever re-granted to anon.
  if auth.uid() is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  -- ── THE TWO PREDICATES, DEFINED ONCE IN WORDS SO THE FOUR USES BELOW CANNOT DRIFT ────────────────
  -- A room is IN SCOPE when its host is one of our test identities, OR when its host has no profile
  -- at all (which is only reachable because a previous purge deleted that profile · see the header).
  -- A row is PROTECTED when it is younger than `grace`, except that a FINISHED room is never
  -- protected: it cannot be in play, so the window would buy nothing and only delay the cleanup.

  select count(*) into unfinished_rooms_deleted
  from public.game_rooms r
  where r.status is distinct from 'finished'
    and (r.host_id in (
          select user_id from public.player_profiles
          where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
      or not exists (select 1 from public.player_profiles p where p.user_id = r.host_id))
    and r.created_at <= now() - grace;

  -- Counted BEFORE the delete, like 023's two sums: a spared row is the whole point of this
  -- migration, and a counter that only reports what was destroyed cannot show that the guard fired
  -- (Rule 80 · unmeasured and zero must not look the same).
  select count(*) into rooms_spared_recent
  from public.game_rooms r
  where r.status is distinct from 'finished'
    and r.created_at > now() - grace
    and (r.host_id in (
          select user_id from public.player_profiles
          where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
      or not exists (select 1 from public.player_profiles p where p.user_id = r.host_id));

  select count(*) into profiles_spared_recent
  from public.player_profiles
  where (username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
    and created_at > now() - grace;

  -- How much of the reach is NEW · i.e. rooms the deployed function could not see at all. Reported so
  -- the first run's receipt shows the leak being drained rather than an unexplained jump in
  -- rooms_deleted.
  select count(*) into orphan_rooms_deleted
  from public.game_rooms r
  where not exists (select 1 from public.player_profiles p where p.user_id = r.host_id)
    and (r.status = 'finished' or r.created_at <= now() - grace);

  -- T2 S48 · the evidence, taken before it is destroyed (migration 023). Unchanged in meaning; the
  -- age guard is applied so the sums describe the rows this call actually deletes.
  select coalesce(sum(games_played), 0), coalesce(sum(games_won), 0)
    into games_played_destroyed, games_won_destroyed
  from public.player_profiles
  where (username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
    and created_at <= now() - grace;

  with gone as (
    delete from public.game_rooms r
    where (r.host_id in (
            select user_id from public.player_profiles
            where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
        or not exists (select 1 from public.player_profiles p where p.user_id = r.host_id))
      -- PROTECTED: young and not finished. A finished room is swept at any age.
      and (r.status = 'finished' or r.created_at <= now() - grace)
    returning 1)
  select count(*) into rooms_deleted from gone;

  -- THE COLLISION FIX. Age-guarding this delete is what stops one CI job destroying another job's
  -- identities mid-game, which is what produced 593 unreachable rooms. Rooms are deleted above first,
  -- so within this transaction the selector is still intact for the rows being removed.
  with gone as (
    delete from public.player_profiles
    where (username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
      and created_at <= now() - grace
    returning 1)
  select count(*) into profiles_deleted from gone;

  return jsonb_build_object(
    'rooms_deleted', rooms_deleted,
    'unfinished_rooms_deleted', unfinished_rooms_deleted,
    'profiles_deleted', profiles_deleted,
    'games_played_destroyed', games_played_destroyed,
    'games_won_destroyed', games_won_destroyed,
    -- ADDITIVE (T2 S50). Existing readers are unaffected.
    'orphan_rooms_deleted', orphan_rooms_deleted,
    'rooms_spared_recent', rooms_spared_recent,
    'profiles_spared_recent', profiles_spared_recent);
end;
$function$;

commit;

-- ══ RUN THIS IMMEDIATELY BEFORE APPLYING, AND PASTE THE RESULT INTO THE APPROVAL ═══════════════════
-- The numbers in the header are from the moment this file was written. They grow by a handful an
-- hour, and a destructive change should be approved against what it will actually destroy, not
-- against a remembered figure (Rule 28 · a premise has a shelf life).
--
--   with victims as (
--     select r.id from public.game_rooms r
--     where not exists (select 1 from public.player_profiles p where p.user_id = r.host_id)
--       and r.created_at <= now() - interval '30 minutes')
--   select (select count(*) from victims) as rooms,
--          (select count(*) from public.game_sessions s where s.room_id in (select id from victims)) as sessions,
--          (select count(*) from public.game_events e where e.session_id in
--             (select id from public.game_sessions s where s.room_id in (select id from victims))) as events;
--
-- ══ A PROPERTY OF THE GUARD I MEASURED AND DID NOT EXPECT ══════════════════════════════════════════
-- `rooms_spared_recent` evaluates to ZERO against production today, and it is not because the clause
-- is wrong. Every one of the six rooms created in the last half hour is already status='finished',
-- and a finished room is deliberately swept at any age. Room statuses live: finished 566 (553
-- orphaned), playing 46 (40 orphaned), waiting 18 (0 orphaned).
--
-- SO THE ROOM AGE GUARD IS NOT THE HALF THAT MATTERS · THE PROFILE ONE IS. The room guard only ever
-- fires for a room that is young AND still in play, which is a narrow window. The profile guard fires
-- for every identity a running job owns, and it is what actually stops job A destroying job B's
-- selector. 024 shipped only the room half, which is the weaker of the two, and I would not have
-- found that by reading it · only by counting what each clause protects.
--
-- ══ AFTER APPLYING ═════════════════════════════════════════════════════════════════════════════════
-- The first nightly receipt should show a large `orphan_rooms_deleted` (the backlog draining once)
-- and then near-zero on every subsequent run. `rooms_spared_recent` is EXPECTED to sit at 0 most
-- runs, per the paragraph above · so it is `profiles_spared_recent` that should be non-zero whenever
-- two jobs overlap, and that is the number to watch. A guard that has never fired is a guard nobody
-- has seen work (Rule 86), and these two counters are what make the difference visible.
--
-- ══ SUPERSEDES 024 ═════════════════════════════════════════════════════════════════════════════════
-- 024 added the age guard alone and was never applied. Keeping both as separate unapplied files would
-- leave two committed migrations each claiming to define this function, with no way to tell from the
-- repo which one is meant · which is precisely the "migrations are a log, not a state" trap that cost
-- T3 a wrong retraction in S46 (Rule 109). 024's header is annotated to point here. Apply THIS ONE.
