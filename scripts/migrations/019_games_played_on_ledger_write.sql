-- 019 · player_profiles.games_played actually counts games  (T2 S31)
--
-- THE FINDING, AND IT IS NOT WHAT THE FORGE EXPECTED
-- games_played is 0 for all 35 rows including people who demonstrably played. The forge framed this as
-- "a write path that either is never called or fails silently". Measured live, it is neither:
--
--   · 0 triggers on player_profiles
--   · NO function in the public schema mentions games_played, games_won or elo_rating
--     (checked every pg_proc def, not just the ones we remember writing)
--   · NO client code writes them · the only occurrences in src/ are useAuth.test.js:96-98 asserting the
--     rename payload does NOT carry them, and a comment
--   · NOTHING READS THEM EITHER · no component, no query, no RPC
--   · every one of the 35 rows sits at its column DEFAULT (games_played 0, games_won 0, elo 1000)
--
-- There is no write path. There never was one. This is not a broken feature, it is an unbuilt one:
-- three columns created in 001 with defaults and no author on either side.
--
-- MIGRATION 017 IS INNOCENT (the ordering risk the forge asked about). 017 revoked UPDATE on these
-- columns from anon/authenticated, which cannot have broken a legitimate write because there was no
-- legitimate write to break · and the function below is SECURITY DEFINER owned by postgres, so it does
-- not consult the caller's column grants at all. 017 stands, and it is what makes this safe: the ONLY
-- way games_played can move is through this server-side path, so a client cannot forge its own record.
--
-- WHY HERE, INSTEAD OF A NEW RPC THE CLIENT MUST REMEMBER TO CALL
-- record_civilization_score already fires exactly once per player per finished session from
-- FinalScore.jsx, and it is already guarded by UNIQUE (session_id, player_id) + ON CONFLICT DO NOTHING.
-- That unique row IS the "this game already counted for this player" fact. Deriving games_played from it
-- costs no client change (no cross-lane edit into T1's FinalScore.jsx), and it cannot double-count on a
-- reload or a re-fire because the increment is conditioned on the insert ACTUALLY happening (FOUND is
-- false when ON CONFLICT swallowed it). A separate RPC would have been a fourth thing nobody calls.
--
-- Note the condition it inherits, stated so nobody over-trusts the number: FinalScore fires this only
-- when there is a live sync sessionId, so SOLO games are not counted. That is correct (a solo game has
-- no session) but it does mean games_played means "multiplayer games finished", not "games started".
--
-- games_won IS DELIBERATELY NOT SET HERE. This RPC is per-caller by construction · it knows one player's
-- scores and cannot see the other seats, so it cannot honestly say who won. Inventing a winner from a
-- single row would be worse than leaving the column at 0. Doing it properly needs a whole-session
-- comparison at game end · that sequences with the game_end audit row, and it is a separate migration.
--
-- Backfill is NOT attempted: room_players is emptied when a room is deleted (T1 S30), so for the 332
-- purged sessions there is no roster left to count from. The ledger holds 3 rows, all score 0. Counting
-- forward from a known-honest zero beats a reconstructed number nobody can verify.

begin;

create or replace function public.record_civilization_score(
  p_session_id uuid, p_sacred integer, p_living integer, p_free integer, p_cards integer)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_s integer; v_l integer; v_f integer; v_c integer;
begin
  if v_uid is null then
    raise exception 'permission denied: record_civilization_score requires an authenticated session';
  end if;
  if p_session_id is null then
    raise exception 'session_id is required';
  end if;
  select username into v_name from public.player_profiles where user_id = v_uid;
  v_name := coalesce(v_name, 'Anonymous');
  v_s := least(greatest(coalesce(p_sacred, 0), 0), 999);
  v_l := least(greatest(coalesce(p_living, 0), 0), 999);
  v_f := least(greatest(coalesce(p_free,   0), 0), 999);
  v_c := least(greatest(coalesce(p_cards,  0), 0), 56);
  insert into public.global_neotopia_index
    (session_id, player_id, username, sacred_city_score, living_earth_score, free_energy_score, total_score, cards_built)
  values (p_session_id, v_uid, v_name, v_s, v_l, v_f, v_s + v_l + v_f, v_c)
  on conflict (session_id, player_id) do nothing;

  -- T2 S31 · the only writer games_played has ever had. Conditioned on FOUND so a re-fire that hits
  -- ON CONFLICT DO NOTHING increments nothing · the ledger's unique row is the idempotency key for both.
  -- A player with no profile row (never claimed a name) updates 0 rows and that is fine, not an error.
  if found then
    update public.player_profiles
       set games_played = games_played + 1
     where user_id = v_uid;
  end if;
end;
$function$;

commit;
