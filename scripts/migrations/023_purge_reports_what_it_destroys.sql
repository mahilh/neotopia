-- 023 · purge_e2e_test_data reports the counters it is about to destroy  (T2 S48)
--
-- ✅ APPLIED T2 S49 · August 11 2026, on Mahil's explicit approval (scoped to this migration only).
--    Recorded as supabase migration `023_purge_reports_what_it_destroys`.
--    POST-APPLY READ-BACK, because create-or-replace preserving grants is a claim until it is checked:
--        grants BEFORE : authenticated=EXECUTE, postgres=EXECUTE
--        grants AFTER  : authenticated=EXECUTE, postgres=EXECUTE      <- identical, nothing widened
--        anon EXECUTE  : false (before and after) · 015's narrowing intact
--        prosecdef true · proconfig search_path="" · both preserved
--    Migration 014 remains unapplied and is unrelated to this.
--
-- ══ THE FINDING, AND IT IS NOT THE ONE THE ROADMAP RECORDED ════════════════════════════════════════
-- docs/T2_ROADMAP.md (S47) said: "the ledger moves and the denormalised columns don't", and framed
-- games_played / games_won reading 0 for all 40 profiles as a write that never lands. MEASURED, it is
-- the opposite: THE WRITE LANDS AND THEN THE ROW IS DELETED.
--
--   player_profiles                                     40   · all at games_played 0, games_won 0
--   global_neotopia_index rows                          63   · 60 E2E, 3 non-E2E
--   game_wins rows                                      24   · 21 real winners, 3 ties
--   ledger rows whose player has NO profile             63   · ALL of them
--   game_wins rows whose winner has NO profile          24   · ALL of them
--   player_profiles matching 'E2E%'                      0   · the purge has taken every one
--
-- So the UPDATE in 019 and 020 matches zero rows AT QUERY TIME. It did not match zero rows AT WRITE
-- TIME, and the proof was already in this repo: award_game_win returns 'awarded' ONLY when
-- `get diagnostics v_rows = row_count` is positive, and returns 'awarded_no_profile' otherwise · a
-- distinction added precisely because the first version lied about this. The nightly workflow's own
-- header records a proven live run logging "award_game_win 'awarded' then 'already_awarded' from the
-- second seat" (.github/workflows/e2e-live-nightly.yml). 'awarded' is emitted on a NON-ZERO row count.
-- The counter incremented. Then globalTeardown ran purge_e2e_test_data and deleted the profile.
--
-- AND FOR HUMANS THE ZERO IS CORRECT. Only 3 of the 63 ledger rows are non-E2E; all three are from
-- 2026-06-28, all score 0, two are named BotAlpha/BotBeta (the bot harness) and the third is literally
-- 'Anonymous' · which is record_civilization_score's own fallback for a caller with no profile. All
-- three predate migration 019, which is the first writer games_played ever had. No human with a
-- profile has ever finished a recorded multiplayer game, so 0 is the truth and not a bug.
--
-- ══ WHAT THE ACTUAL DEFECT IS ══════════════════════════════════════════════════════════════════════
-- This path has a writer (019, 020), a caller (FinalScore.jsx), a reader (fetchPlayerStats), and a
-- status string built to distinguish a real credit from a zero-row write. What it does not have is an
-- OBSERVER: the only row that could witness the increment is destroyed by our own teardown between the
-- run and any query anyone would run afterwards. So the subsystem cannot be verified by the suite that
-- exercises it, and it has read 0 for six weeks looking exactly like a broken write.
--
-- That is one turn of the screw past the family this project keeps finding. award_game_win was a
-- WRITER WITH NO CALLER (S35). card art was a RENDER WITH NO GATE (S42). This is a CALLER WITH NO
-- OBSERVABLE, and it is worse than either because every individual piece is correct and tested.
--
-- ══ WHY REPORTING, RATHER THAN NOT DELETING ════════════════════════════════════════════════════════
-- The obvious fix · exempt profiles with games_played > 0 from the purge · is wrong. Every E2E run
-- that finishes a game would then leave a permanent profile row, so the table grows without bound and
-- the purge stops doing the one job it has. T3's S48 Rule 109 makes the same point about the ROOM
-- clause from the other side: migration 008 deliberately dropped the status filter because a filtered
-- purge stranded 55+ orphans, and they explicitly asked me not to revert it.
--
-- So: DESTROY THE ROWS, KEEP THE EVIDENCE. The function already returns a jsonb receipt. This adds the
-- two sums it is about to erase, measured inside the same transaction, immediately before the delete.
-- A nightly run that credits a winner then prints `"games_won_destroyed": 1`, and the increment becomes
-- observable in the CI log without the row surviving. Nothing about the delete changes.
--
-- SCOPE, so nobody reads this as more than it is: this makes the write PROVABLE, it does not make the
-- counters USEFUL. games_played will still read 0 for every human until a human with a claimed
-- username finishes a multiplayer game, and that is a product fact rather than a bug.
--
-- ══ PRE-APPLY VERIFICATION ═════════════════════════════════════════════════════════════════════════
--   [x] LIVE definition read via pg_get_functiondef, NOT from a migration file · T3's Rule 109 is
--       exactly the lesson that `create or replace` makes migrations a LOG and not a STATE, and 008
--       had already changed 006's body. The body below is 008's live body plus two SELECTs.
--   [x] The DELETE predicates are BYTE-IDENTICAL to the deployed ones · rooms by host username prefix
--       with NO status filter (008's deliberate behaviour), profiles by the same three prefixes.
--   [x] `create or replace function` preserves existing grants · 006's revoke-from-public and
--       grant-to-authenticated are untouched and are NOT restated (restating risks widening them).
--   [x] SECURITY DEFINER + `set search_path to ''` preserved · every reference stays schema-qualified.
--   [x] The auth.uid() guard is preserved (Rule 44 · a definer function callable by anon is a vector).
--   [x] Return shape is ADDITIVE · the three existing keys keep their names and meanings, so
--       global-teardown.js and anything reading rooms_deleted / unfinished_rooms_deleted /
--       profiles_deleted continues to work unchanged. T3 owns that file; nothing there needs editing.
--   [x] The two new sums are read BEFORE the delete, inside the same function call, so they cannot
--       race the delete they describe.
--   [ ] APPROVAL FROM MAHIL · not applied. This edits a function that deletes production rows, and
--       the standing rule is read-only unless a session says otherwise.

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
begin
  -- Defense in depth (Rule 44): reject unauthenticated callers even if EXECUTE is ever re-granted to anon.
  if auth.uid() is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  select count(*) into unfinished_rooms_deleted
  from public.game_rooms r
  where r.status <> 'finished'
    and r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

  -- T2 S48 · THE EVIDENCE, TAKEN BEFORE IT IS DESTROYED. These two sums are the only trace that
  -- record_civilization_score and award_game_win ever credited anybody: the rows carrying them are
  -- deleted four statements below, which is why both columns have read 0 in every query anyone has
  -- ever run against this database. Reading them here costs one index-free scan of a 40-row table and
  -- turns "the counters never move" into a number in the nightly's log.
  select coalesce(sum(games_played), 0), coalesce(sum(games_won), 0)
    into games_played_destroyed, games_won_destroyed
  from public.player_profiles
  where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%';

  with gone as (
    delete from public.game_rooms r
    where r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%')
    returning 1)
  select count(*) into rooms_deleted from gone;

  with gone as (
    delete from public.player_profiles
    where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%'
    returning 1)
  select count(*) into profiles_deleted from gone;

  return jsonb_build_object(
    'rooms_deleted', rooms_deleted,
    'unfinished_rooms_deleted', unfinished_rooms_deleted,
    'profiles_deleted', profiles_deleted,
    -- ADDITIVE. Existing readers are unaffected; a reader that wants the proof asks for these.
    'games_played_destroyed', games_played_destroyed,
    'games_won_destroyed', games_won_destroyed);
end;
$function$;

commit;

-- ══ AFTER APPLYING ═════════════════════════════════════════════════════════════════════════════════
-- The next nightly that finishes a real game should print a NON-ZERO games_won_destroyed. If it prints
-- zero while award_game_win logged 'awarded' in the same run, then the two disagree and the increment
-- genuinely is not landing · which would be the finding the roadmap thought it already had, arrived at
-- honestly. Either way the ambiguity is gone, which is the entire point (Rule 80: a counter that
-- cannot measure must say so rather than resolve to a plausible value).
