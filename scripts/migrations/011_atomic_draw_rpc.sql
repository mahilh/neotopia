-- NeoTopia · migration 011 · ATOMIC SEAT-SCOPED DRAW RPC (T2 S18 · Task C · DESIGN)
-- ============================================================================================
-- STATUS: DESIGN ARTIFACT · NOT YET APPLIED TO PRODUCTION.
--   The SECURITY / LOCKING / AUTH skeleton below is production-grade and load-bearing (it is the
--   point of the migration). The jsonb read-modify-write BODY is the proposed implementation but is
--   UNTESTED against the live state shape · T3 (wiring) + T2 S19 (body verification) finish and apply
--   it. Do NOT `supabase db push` this until the VERIFY CHECKLIST at the bottom is green. (Rule 46:
--   prove scope + auth before wiring a state-mutating SECURITY DEFINER · Rule 56: verify column/field
--   names live before relying on them.)
--
-- THE PROBLEM THIS FIXES (T3 S17 finding · proven by the 17f5931 characterization test):
--   Game state syncs as a WHOLE-STATE SNAPSHOT (useGameSync.pushState writes the entire Zustand store
--   to game_sessions.state jsonb). There is NO 'draw_card' event reducer · game_events rows are an
--   AUDIT log, not a state machine. So two clients drawing at the "same time" each do:
--       read snapshot -> mutate locally (deck.shift / hand.push) -> write whole snapshot back
--   and the second write CLOBBERS the first (last-write-wins). A draw can be silently LOST. This is
--   exactly the race Flow mode makes routine: SIMULTANEOUS_DRAW lets every seat draw inside their own
--   15s window, so concurrent draws are the norm, not the exception.
--
-- THE FIX (atomicity at the DB, not the client):
--   Move the read-modify-write of a single draw INTO one Postgres transaction that holds a ROW LOCK
--   on the game_sessions row (SELECT ... FOR UPDATE). Concurrent draws then SERIALIZE on the lock
--   instead of racing on the client: each draw reads the freshest state, pops one card, appends it to
--   the caller's hand, and writes back · atomically. No draw is lost. This replaces the
--   client-draw + snapshot-broadcast pattern for the draw action specifically.
--
-- WHY THIS CANNOT (yet) BE A FULLY SERVER-OWNED DECK:
--   The deck is shuffled CLIENT-SIDE at init (useGameRoom.js shuffleArray([...DECK])) and exists ONLY
--   inside game_sessions.state.deck (jsonb). There is no server-side deck table, seed, or index. So
--   this RPC operates ON the jsonb snapshot (pops state->'deck'->0 etc.) rather than reconstructing a
--   deck server-side. That is enough to make draws ATOMIC (the whole point). A future migration could
--   persist a deck seed + cursor server-side for a fully authoritative deck (T2 S19+ · larger change).
--
-- PATTERN MIRRORED: migration 009 record_civilization_score
--   (security definer · set search_path = '' · auth.uid() self-scope · server-side validation · GRANT).
-- ============================================================================================

create or replace function public.draw_card_for_seat(
  p_session_id uuid,
  p_seat       integer,
  p_source     text    default 'deck',   -- 'deck' | 'offer'
  p_card_index integer default 0          -- index into theOffer when p_source = 'offer'
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
  v_player_idx   integer;            -- index in state->'players' whose 'seat' = p_seat
  v_drawn        jsonb;
begin
  -- ── AUTH BOUNDARY (Rule 59: a public write needs a server-side trust boundary) ──────────────────
  -- Anonymous sign-ins still carry a real auth.uid() (role 'authenticated', is_anonymous=true); a
  -- truly unauthenticated caller has auth.uid() = NULL and is rejected here.
  if v_uid is null then
    raise exception 'permission denied: draw_card_for_seat requires an authenticated session';
  end if;
  if p_session_id is null then
    raise exception 'session_id is required';
  end if;
  if p_source is null or p_source not in ('deck', 'offer') then
    raise exception 'p_source must be deck or offer';
  end if;

  -- ── ATOMICITY: lock the session row for the duration of the txn ─────────────────────────────────
  -- FOR UPDATE serializes every concurrent draw on THIS session: the second drawer blocks here until
  -- the first commits, then reads the already-updated state. This is what defeats last-write-wins.
  select gs.room_id, gs.state, gs.mode, gs.current_seat
    into v_room_id, v_state, v_mode, v_current_seat
    from public.game_sessions gs
   where gs.id = p_session_id
   for update;

  if v_room_id is null then
    raise exception 'session not found: %', p_session_id;
  end if;

  -- ── SEAT OWNERSHIP (anti-spoof): the caller may ONLY draw for a seat they hold in this room ──────
  select exists (
    select 1 from public.room_players rp
     where rp.room_id = v_room_id
       and rp.user_id = v_uid
       and rp.seat_number = p_seat
  ) into v_owns_seat;
  if not v_owns_seat then
    raise exception 'permission denied: seat % is not owned by the calling player', p_seat;
  end if;

  -- ── TURN GATING (mode-aware · mirrors gameStore.drawCard) ───────────────────────────────────────
  -- Classic: only the active turn-holder may draw. Flow: SIMULTANEOUS_DRAW · any seated player draws
  -- into their OWN hand within their window, and a non-current draw must NOT spend the active player's
  -- action budget (that would corrupt the turn-holder's turn · gameStore rule-65 note).
  if v_mode is distinct from 'flow' and p_seat is distinct from v_current_seat then
    raise exception 'not your turn: seat % cannot draw while seat % is active (classic mode)', p_seat, v_current_seat;
  end if;

  -- ============================================================================================
  -- DESIGN BODY · jsonb read-modify-write · VERIFY field names + array shapes live before apply.
  -- (Rule 56 · these come from serializableState(): state.deck[], state.theOffer[], state.players[]
  --  with players[i].seat and players[i].hand[] · confirm against a real game_sessions.state row.)
  -- ============================================================================================

  -- Locate the player array index whose seat = p_seat (players is an ARRAY, keyed by .seat not index).
  select (idx - 1)                       -- jsonb arrays are 0-based; WITH ORDINALITY is 1-based
    into v_player_idx
    from jsonb_array_elements(v_state->'players') with ordinality as e(elem, idx)
   where (e.elem->>'seat')::int = p_seat
   limit 1;
  if v_player_idx is null then
    raise exception 'seat % not present in session players', p_seat;
  end if;

  if p_source = 'deck' then
    -- Pop the top of the deck (index 0). Empty deck → nothing to draw.
    if jsonb_array_length(coalesce(v_state->'deck', '[]'::jsonb)) = 0 then
      raise exception 'deck is empty';
    end if;
    v_drawn := v_state->'deck'->0;
    v_state := jsonb_set(v_state, '{deck}', (v_state->'deck') - 0);  -- remove element 0
  else  -- 'offer'
    if v_state->'theOffer'->p_card_index is null then
      raise exception 'no offer card at index %', p_card_index;
    end if;
    v_drawn := v_state->'theOffer'->p_card_index;
    v_state := jsonb_set(v_state, '{theOffer}', (v_state->'theOffer') - p_card_index);
  end if;

  -- Append the drawn card to that player's hand.
  v_state := jsonb_set(
    v_state,
    array['players', v_player_idx::text, 'hand'],
    coalesce(v_state->'players'->v_player_idx->'hand', '[]'::jsonb) || jsonb_build_array(v_drawn),
    true
  );

  -- Spend an action ONLY for a classic-mode draw by the active seat (Flow/non-current draws do not).
  if v_mode is distinct from 'flow' and p_seat = v_current_seat then
    v_state := jsonb_set(
      v_state, '{actionsRemaining}',
      to_jsonb(greatest((coalesce(v_state->>'actionsRemaining','0'))::int - 1, 0))
    );
  end if;

  -- Persist atomically (still inside the FOR UPDATE txn). Keep the denormalized columns in step with
  -- the snapshot (Rule 45: a denormalized column is a second contract) · actions_remaining mirrors
  -- state.actionsRemaining; current_seat/phase are untouched by a draw.
  update public.game_sessions
     set state = v_state,
         actions_remaining = (v_state->>'actionsRemaining')::int
   where id = p_session_id;

  -- Return the drawn card to the caller (apply to local state · Supabase realtime broadcasts the row).
  return v_drawn;
end;
$$;

-- GRANT: authenticated only. Real players (incl. anonymous sign-ins) hold the 'authenticated' role and
-- a non-null auth.uid(); a true-anon (no session) has no business mutating game state, and the auth.uid()
-- null-check above already rejects it. Tighter than 009's anon+authenticated grant by design (Rule 44:
-- minimize the surface of a state-mutating SECURITY DEFINER).
grant execute on function public.draw_card_for_seat(uuid, integer, text, integer)
  to authenticated;

-- ============================================================================================
-- VERIFY CHECKLIST (T3 + T2 S19 · all must be green BEFORE `supabase db push`):
--   [ ] Confirm serializableState() field names live: deck, theOffer, players[].seat, players[].hand,
--       actionsRemaining, currentSeat (read one real game_sessions.state row · Rule 56).
--   [ ] Unit-prove the jsonb ops on a fixture state row (deck pop, offer-index pop, hand append,
--       action decrement) · pgTAP or a scripted execute_sql against a throwaway session.
--   [ ] Prove the FOR UPDATE serialization with two concurrent transactions (the second sees the
--       first's drawn card removed · no clobber) · this is the regression 17f5931 characterizes.
--   [ ] Confirm RLS interaction: SECURITY DEFINER bypasses RLS, so the seat-ownership EXISTS check IS
--       the authorization (not the table policy). Re-read migration 002 policies before trusting it.
--   [ ] Decide deck exhaustion / endgame interplay (empty-deck raise vs graceful no-op).
-- WIRING (T3 · after apply): in the draw path, call supabase.rpc('draw_card_for_seat', {...}) instead
--   of the local deck.shift()/hand.push() + pushState snapshot. Apply the returned card to local state;
--   the DB row update drives realtime sync to peers (no separate broadcast needed). Keep the old
--   snapshot path for non-draw actions.
-- ============================================================================================
