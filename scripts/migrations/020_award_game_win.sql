-- 020 · games_won gets an honest writer  (T2 S33)
--
-- 019 gave games_played its first writer and deliberately left games_won at 0, because
-- record_civilization_score is per-caller: it sees ONE player's scores and cannot know whether that
-- player won. This migration does the whole-session comparison, at the one row that already sees
-- every seat: the `game_end` audit event (src/lib/gameEndEvent.js · event_data.final_scores[]).
--
-- WHY NOT event_data.winner_seat, WHICH IS ALREADY IN THE PAYLOAD
-- Because it is not a winner. buildGameEndEvent ranks with Array.sort, which is stable, so a tie
-- keeps seat order and winner_seat becomes "the lowest seat among the top scorers" · documented as a
-- tiebreak in that file, not as a victory. Measured against production before writing this: all 3
-- game_end rows that exist score 0-0 across both seats, and all 3 report winner_seat = 0. Trusting
-- that field would have awarded seat 0 a win in every game this civilization has ever finished.
-- So the winner is RECOMPUTED here from final_scores[].total, and A TIE AWARDS NOBODY.
--
-- TRUST BOUNDARY (rule 59)
-- The outcome is derived entirely from the STORED row, never from the request · the caller passes a
-- session id and nothing else, so no client can nominate itself. Any player of that session may fire
-- it and they all get the same answer. A non-participant is rejected outright: not because they could
-- forge a result (they could not) but because there is no reason for a stranger to be able to make
-- this table grow. SECURITY DEFINER owned by postgres, so it does not consult the caller's column
-- grants · 017's REVOKE of UPDATE on games_won stands, and this remains the only way the number moves.
--
-- IDEMPOTENCY · the same shape 019 proved
-- 019 leaned on global_neotopia_index's UNIQUE row as the "already counted" fact. games_won has no
-- such row, so this migration creates one: game_wins, keyed by session_id. INSERT ... ON CONFLICT DO
-- NOTHING, and the increment is conditioned on FOUND · a re-fire from a second seat, or a reload,
-- increments nothing. The table doubles as the permanent public record of who won each session, which
-- is the thing this project keeps discovering it needs: a value with a reader.
--
-- IT RETURNS A STATUS INSTEAD OF VOID, ON PURPOSE
-- 'awarded' | 'awarded_no_profile' | 'tie' | 'already_awarded' | 'no_game_end' | 'no_winner_id'.
-- The recurring pathology in
-- this codebase is a write path whose failure is indistinguishable from its success (games_played sat
-- at 0 for six weeks; the health monitor was red for 17 runs). A silent `void` here would be the same
-- mistake a third time. The caller logs what came back.
--
-- NO BACKFILL. The 3 existing game_end rows are all 0-0 E2E fixture ties, so the honest backfill is
-- zero rows anyway · and counting forward from a known-true zero beats a reconstructed number.

begin;

-- The permanent record of who won each session. One row per session, ever.
create table if not exists public.game_wins (
  session_id  uuid primary key,
  winner_id   uuid references auth.users(id) on delete set null,
  winner_seat integer,
  winning_total integer not null default 0,
  awarded_at  timestamptz not null default now()
);

alter table public.game_wins enable row level security;

-- Public-readable like the civilization ledger (009): a win is part of the public record.
-- There is deliberately NO insert/update/delete policy · the SECURITY DEFINER function below is the
-- only writer, and a table with RLS on and no write policy denies every client write by default.
drop policy if exists game_wins_read_all on public.game_wins;
create policy game_wins_read_all on public.game_wins for select using (true);

grant select on public.game_wins to anon, authenticated;
revoke insert, update, delete on public.game_wins from anon, authenticated;

create or replace function public.award_game_win(p_session_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid       uuid := auth.uid();
  v_scores    jsonb;
  v_top       integer;
  v_n_top     integer;
  v_winner    jsonb;
  v_winner_id uuid;
  v_rows      integer;
begin
  if v_uid is null then
    raise exception 'permission denied: award_game_win requires an authenticated session';
  end if;
  if p_session_id is null then
    raise exception 'session_id is required';
  end if;

  -- Cheap exit before any work · a second seat firing after the first one settled it.
  if exists (select 1 from public.game_wins where session_id = p_session_id) then
    return 'already_awarded';
  end if;

  -- The earliest game_end row for this session. Ordered rather than assumed-unique: FinalScore's
  -- localStorage guard makes a duplicate unlikely, not impossible (a second browser has its own
  -- localStorage), and "whichever row Postgres happened to return" is not a decision procedure.
  select e.event_data->'final_scores'
    into v_scores
    from public.game_events e
   where e.session_id = p_session_id
     and e.event_type = 'game_end'
   order by e.sequence_num asc, e.created_at asc
   limit 1;

  if v_scores is null or jsonb_typeof(v_scores) <> 'array' or jsonb_array_length(v_scores) = 0 then
    return 'no_game_end';
  end if;

  -- The caller must have been in this game. Not a forgery guard (the result is read from the stored
  -- row either way) · a blast-radius guard, so only participants can cause a row to appear.
  if not exists (
    select 1 from jsonb_array_elements(v_scores) s
     where nullif(s->>'user_id', '')::uuid = v_uid
  ) then
    raise exception 'permission denied: caller is not a player of this session';
  end if;

  select max((s->>'total')::integer) into v_top from jsonb_array_elements(v_scores) s;

  select count(*) into v_n_top
    from jsonb_array_elements(v_scores) s
   where (s->>'total')::integer = v_top;

  -- A TIE AWARDS NOBODY. Recorded anyway, with a null winner, so the session is permanently marked
  -- as settled · otherwise every seat re-runs the whole comparison forever and 'tie' would be
  -- indistinguishable from 'never fired'.
  if v_n_top > 1 then
    insert into public.game_wins (session_id, winner_id, winner_seat, winning_total)
    values (p_session_id, null, null, coalesce(v_top, 0))
    on conflict (session_id) do nothing;
    return 'tie';
  end if;

  select s into v_winner
    from jsonb_array_elements(v_scores) s
   where (s->>'total')::integer = v_top
   limit 1;

  v_winner_id := nullif(v_winner->>'user_id', '')::uuid;
  if v_winner_id is null then
    -- A solo/unauthenticated seat won. Nothing to credit · say so rather than crediting the wrong row.
    return 'no_winner_id';
  end if;

  insert into public.game_wins (session_id, winner_id, winner_seat, winning_total)
  values (p_session_id, v_winner_id, (v_winner->>'seat')::integer, coalesce(v_top, 0))
  on conflict (session_id) do nothing;

  -- Conditioned on FOUND for the same reason 019 is: two seats can race past the early-exit above,
  -- and only the one that actually inserted may increment.
  --
  -- 'awarded_no_profile' EXISTS BECAUSE THE FIRST VERSION OF THIS FUNCTION LIED. It returned
  -- 'awarded' whether or not the UPDATE touched a row, and the first live run said 'awarded' while
  -- crediting nobody · the winner was an E2E identity that had never claimed a username, so it has
  -- no player_profiles row. That is this project's signature bug wearing a new hat: a success string
  -- covering a zero-row write. A winner without a profile is legitimate and must not raise, but it
  -- must not report the same word as a real credit either. GET DIAGNOSTICS is the only honest test.
  if found then
    update public.player_profiles
       set games_won = games_won + 1
     where user_id = v_winner_id;
    get diagnostics v_rows = row_count;
    return case when v_rows > 0 then 'awarded' else 'awarded_no_profile' end;
  end if;

  return 'already_awarded';
end;
$function$;

revoke all on function public.award_game_win(uuid) from public;
grant execute on function public.award_game_win(uuid) to authenticated;

commit;
