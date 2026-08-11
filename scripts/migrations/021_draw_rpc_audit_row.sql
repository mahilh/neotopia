-- NeoTopia · migration 021 · THE DRAW RPC WRITES ITS OWN AUDIT ROW (T2 S42 · Mahil approved)
-- ============================================================================================
-- STATUS: see the APPLY LOG at the foot of this file.
-- SCOPE: this migration adds ONE insert to draw_card_for_seat. It changes no schema, no grant, no
--   policy, and no other function. Migration 014 remains unapplied and is untouched by this.
--
-- WHY THIS EXISTS · S40 cost an evening to a question that should have cost one query.
--   T3 reported "the draw RPC returns 200 and the client still shows offer 4, actions 3". Settling it
--   took FOUR separate read-only queries and still left one hypothesis open, because after a draw the
--   only surviving evidence is the FINAL VALUE of game_sessions.state · and a value cannot distinguish
--       never attempted   ·   attempted and refused   ·   attempted, written, and overwritten
--   They all present as an unchanged row. That is the same absence-looks-like-a-value shape as Rules
--   80 / 84 / 85, one layer down: the DB was resting at a plausible number and could not say why.
--
--   The 175 draw_card rows that already exist do not help · every one has event_data '{}' (verified
--   live: max payload seen across the whole table is 586 bytes, and every draw_card row is empty).
--   They record that a draw was CLAIMED, never which card, by whom, or whether it landed.
--
-- THE EVIDENCE PROPERTY, and it is free rather than engineered:
--   The insert sits INSIDE the function, which is one implicit transaction already holding the
--   FOR UPDATE row lock. So it is atomic with the state write by construction:
--     · a successful draw  → exactly ONE row, carrying the seat and the actual card
--     · a REFUSED draw     → every raise above rolls the txn back → NO row, never a partial one
--     · a draw that writes and is later clobbered → the row SURVIVES the clobber, because a later
--       whole-state snapshot overwrites game_sessions.state and cannot retract a game_events row.
--   That last line is the one that closes S40's open hypothesis. "Written then overwritten" stops
--   being indistinguishable from "never attempted" the moment the evidence lives in a different table.
--
-- FAIL-CLOSED, deliberately, because the alternative defeats the purpose:
--   If the audit insert were to fail, the draw fails with it. That is the right trade HERE · a draw
--   that cannot be recorded reproduces exactly the ambiguity this migration exists to remove, and a
--   rolled-back draw is recoverable (the player retries) whereas an unrecorded one is not diagnosable.
--   It is only an acceptable trade because the insert CANNOT realistically fail, and each reason was
--   checked against the live schema rather than assumed (Rule 56/68):
--     · event_type 'draw_card'  → already in the CHECK constraint's allowed array. VERIFIED.
--     · seat_number CHECK 0..3  → p_seat is already proven to own a row in room_players above, and
--                                 a seat outside 0..3 cannot pass that check.
--     · event_data <= 4096 bytes (migration 018) → the payload below is a fixed set of scalars,
--                                 roughly 200 bytes. The largest event_data in the table today is 586.
--     · session_id FK           → p_session_id was SELECTed successfully above, so the row exists.
--     · RLS insert policy       → not consulted: SECURITY DEFINER runs as owner. The seat-ownership
--                                 EXISTS check above IS the authorization (unchanged from 011).
--     · sequence_num            → GENERATED ALWAYS AS IDENTITY, so it is DELIBERATELY NOT SUPPLIED.
--                                 Providing it raises 428C9. information_schema reports column_default
--                                 NULL for identity columns, which reads as "the caller must supply
--                                 this" and is the opposite of the truth · useGameSync.js:332 already
--                                 says so in a comment. Verified with is_identity, not inferred.
--
-- 'via' IS THE FIELD THAT ANSWERS THE ACTUAL QUESTION. The legacy client path also wrote 'draw_card'
--   rows, so event_type alone cannot tell an RPC draw from a client one. 'via' names the writer, and
--   the diagnostic query becomes a single predicate on it. Without that field this table would have
--   the same problem it is being used to solve.
-- ============================================================================================

create or replace function public.draw_card_for_seat(
  p_session_id uuid,
  p_seat       integer,
  p_source     text    default 'deck',
  p_card_index integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_room_id      uuid;
  v_state        jsonb;
  v_mode         text;
  v_current_seat integer;
  v_owns_seat    boolean;
  v_player_idx   integer;
  v_drawn        jsonb;
begin
  if v_uid is null then
    raise exception 'permission denied: draw_card_for_seat requires an authenticated session';
  end if;
  if p_session_id is null then
    raise exception 'session_id is required';
  end if;
  if p_source is null or p_source not in ('deck', 'offer') then
    raise exception 'p_source must be deck or offer';
  end if;

  select gs.room_id, gs.state, gs.mode, gs.current_seat
    into v_room_id, v_state, v_mode, v_current_seat
    from public.game_sessions gs
   where gs.id = p_session_id
   for update;

  if v_room_id is null then
    raise exception 'session not found: %', p_session_id;
  end if;

  select exists (
    select 1 from public.room_players rp
     where rp.room_id = v_room_id
       and rp.user_id = v_uid
       and rp.seat_number = p_seat
  ) into v_owns_seat;
  if not v_owns_seat then
    raise exception 'permission denied: seat % is not owned by the calling player', p_seat;
  end if;

  if v_mode is distinct from 'flow' and p_seat is distinct from v_current_seat then
    raise exception 'not your turn: seat % cannot draw while seat % is active (classic mode)', p_seat, v_current_seat;
  end if;

  select (idx - 1)
    into v_player_idx
    from jsonb_array_elements(v_state->'players') with ordinality as e(elem, idx)
   where (e.elem->>'seat')::int = p_seat
   limit 1;
  if v_player_idx is null then
    raise exception 'seat % not present in session players', p_seat;
  end if;

  if p_source = 'deck' then
    if jsonb_array_length(coalesce(v_state->'deck', '[]'::jsonb)) = 0 then
      raise exception 'deck is empty';
    end if;
    v_drawn := v_state->'deck'->0;
    v_state := jsonb_set(v_state, '{deck}', (v_state->'deck') - 0);
  else
    if v_state->'theOffer'->p_card_index is null then
      raise exception 'no offer card at index %', p_card_index;
    end if;
    v_drawn := v_state->'theOffer'->p_card_index;
    v_state := jsonb_set(v_state, '{theOffer}', (v_state->'theOffer') - p_card_index);
  end if;

  v_state := jsonb_set(
    v_state,
    array['players', v_player_idx::text, 'hand'],
    coalesce(v_state->'players'->v_player_idx->'hand', '[]'::jsonb) || jsonb_build_array(v_drawn),
    true
  );

  if v_mode is distinct from 'flow' and p_seat = v_current_seat then
    v_state := jsonb_set(
      v_state, '{actionsRemaining}',
      to_jsonb(greatest((coalesce(v_state->>'actionsRemaining','0'))::int - 1, 0))
    );
  end if;

  update public.game_sessions
     set state = v_state,
         actions_remaining = (v_state->>'actionsRemaining')::int
   where id = p_session_id;

  -- ── THE AUDIT ROW (migration 021) ───────────────────────────────────────────────────────────────
  -- Same transaction, same row lock. Records the POST-draw counts so a reader can tell what the write
  -- actually did without re-deriving it from a state that may since have been overwritten.
  -- sequence_num is omitted ON PURPOSE (GENERATED ALWAYS AS IDENTITY · supplying it raises 428C9).
  insert into public.game_events (session_id, seat_number, event_type, event_data)
  values (
    p_session_id,
    p_seat,
    'draw_card',
    jsonb_build_object(
      'via',           'draw_card_for_seat',
      'source',        p_source,
      'card_id',       v_drawn->>'id',
      'card_name',     v_drawn->>'name',
      'card_index',    case when p_source = 'offer' then p_card_index else null end,
      'mode',          v_mode,
      'deck_after',    jsonb_array_length(coalesce(v_state->'deck', '[]'::jsonb)),
      'offer_after',   jsonb_array_length(coalesce(v_state->'theOffer', '[]'::jsonb)),
      'actions_after', (v_state->>'actionsRemaining')::int
    )
  );

  return v_drawn;
end;
$$;

-- No GRANT statement here on purpose. create-or-replace PRESERVES existing privileges, and 011 + 015
-- already settled them (authenticated:EXECUTE, anon deliberately absent · Rule 44). Re-granting would
-- risk widening a surface this project spent a migration narrowing.

-- ============================================================================================
-- THE DIAGNOSTIC THIS BUYS · what S40 needed and did not have. One query, not four:
--
--   select seat_number,
--          event_data->>'card_name'  as card,
--          event_data->>'source'     as src,
--          event_data->>'offer_after' as offer_after,
--          event_data->>'actions_after' as actions_after,
--          created_at
--     from game_events
--    where session_id = '<uuid>'
--      and event_type = 'draw_card'
--      and event_data->>'via' = 'draw_card_for_seat'
--    order by sequence_num;
--
--   rows present + state moved   → the draw worked
--   rows present + state pristine → IT RAN AND WAS CLOBBERED (the S40 hypothesis that stayed open)
--   no rows at all                → the function never executed · look at the client, not the DB
--
-- PRE-APPLY VERIFICATION (all read-only, against the live DB, before this was written · Rule 56/68):
--   [x] game_events columns + types read from information_schema
--   [x] sequence_num is_identity = YES / ALWAYS  → omitted from the insert
--   [x] event_type CHECK array contains 'draw_card'
--   [x] seat_number CHECK is 0..3 · satisfied by the room_players ownership check above
--   [x] event_data CHECK is pg_column_size <= 4096 · payload is ~200 bytes, table max today is 586
--   [x] no user triggers on game_events · the insert fires nothing else
--   [x] game_events IS in the supabase_realtime publication, so each draw now also broadcasts an
--       event row. SAFE: there is no 'draw_card' reducer in useGameSync and Rule 62 forbids adding
--       one · the client ignores these rows entirely. Noted because it is a real behaviour change.
--   [x] deployed prosrc fetched and compared before replacing · md5 77eeab87…, logically identical to
--       011 with comments stripped, so this replace reverts no drift.
--
-- APPLY LOG:
--   [x] APPLIED TO PRODUCTION · T2 S42 · supabase migration `draw_rpc_audit_row`.
--       Approval was given in the T2 S42 forge ("MAHIL APPROVES THE AUDIT ROW", scoped to the audit
--       row only · migration 014 remains unapplied and untouched).
--       POST-APPLY VERIFICATION (read back from pg_proc, not assumed):
--         · the insert is present in the deployed body
--         · prosecdef still true · still SECURITY DEFINER
--         · grants UNCHANGED: authenticated:EXECUTE, postgres:EXECUTE · anon still absent.
--           create-or-replace preserves privileges, and this was checked rather than trusted because
--           silently re-widening a surface that migration 015 deliberately narrowed is the expensive
--           way to be wrong here (Rule 44).
--
--   LIVE PROOF · tests/e2e/draw-rpc-audit.mjs · 12/12 green against the real DB, one anon sign-in:
--     COUNTERWEIGHT FIRST (Rule 90 · written and run BEFORE the success case, when nothing else had
--     written anything and its vacuity would have been immediate):
--       · a draw for an UNOWNED seat is refused        → zero audit rows
--       · a draw past the end of the offer is refused  → zero audit rows
--         (deep · past the lock, the ownership check and the turn gate)
--     THEN the success case:
--       · exactly ONE row · right seat · the ACTUAL card (audit_offer_0) · via='draw_card_for_seat'
--       · post-draw counts recorded · sequence_num assigned by the DB (1767), never supplied
--     AND THE PROPERTY THAT CLOSES S40's OPEN HYPOTHESIS:
--       · a whole-state snapshot was written back over the draw · game_sessions.state returned to
--         pristine, the draw invisible there · AND THE AUDIT ROW SURVIVED. "Written then overwritten"
--         is no longer indistinguishable from "never attempted".
--
--   NO CONCURRENCY REGRESSION · the insert runs inside the existing FOR UPDATE txn, so it lengthens
--   the critical section. Re-ran tests/e2e/draw-rpc-concurrency.mjs (T3 S23) against the new body:
--   16 concurrent same-seat draws → 16 distinct cards, 0 duplicates, 0 lost, "FOR UPDATE serialized:
--   YES". Unchanged from before this migration.
-- ============================================================================================
