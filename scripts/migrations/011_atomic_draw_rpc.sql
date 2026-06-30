-- NeoTopia · migration 011 · ATOMIC SEAT-SCOPED DRAW RPC (T2 S18 design · T2 S22 verified+applied)
-- ============================================================================================
-- STATUS: ✅ APPLIED TO PRODUCTION · T2 S22 · 2026-06-30 · supabase migration 20260630104754
--   (atomic_seat_scoped_draw_rpc). Verified BEFORE apply against the live DB (Rule 56/68): every
--   referenced column exists (game_sessions.room_id/state/mode/current_seat/actions_remaining/id +
--   room_players.room_id/user_id/seat_number); every jsonb field matches a real game_sessions.state
--   row (deck/theOffer/players[].seat/players[].hand/actionsRemaining/currentSeat); and the full
--   read-modify-write body was proven on a real row by a read-only (no-mutation) SELECT · deck pop
--   46→45, hand append 3→4, appended==drawn deck-top, action decrement 3→2, seat→index lookup 0→0.
--   pgproc=1 confirmed post-apply (security_definer=true · search_path="" · GRANT EXECUTE to
--   authenticated only · anon NOT granted · Rule 44). NOT YET WIRED: T3 still calls deck.shift()/
--   pushState locally · this RPC is INERT until T3 routes the draw path through supabase.rpc(). The
--   deploy is the unblock (it was the PGRST202 wall T3 hit for 4 sessions · Rule 68).
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
-- VERIFY CHECKLIST (T2 S22 · resolved before apply):
--   [x] Field names live: confirmed against real game_sessions.state row 26421afa · state has
--       deck, theOffer, players (players[0].seat="0", players[0].hand array), actionsRemaining,
--       currentSeat. All present, all correct types (Rule 56).
--   [x] jsonb ops proven on a REAL row via read-only SELECT (zero mutation): deck pop 46→45,
--       jsonb_set 3-level hand append 3→4 with appended==drawn deck-top, WITH ORDINALITY seat→idx
--       lookup, action decrement 3 to 2. (Caught: v_player_idx MUST be integer not bigint · the RPC
--       declares it integer, so jsonb->v_player_idx is valid; an ad-hoc bigint cast errors 42883.)
--   [~] FOR UPDATE serialization: guaranteed by Postgres row-lock semantics · the function is one
--       implicit txn holding an exclusive lock on the game_sessions row from SELECT…FOR UPDATE
--       through UPDATE, so a concurrent caller blocks until the first commits then reads the updated
--       state (the canonical fix for the client-side clobber 17f5931 characterizes). Not separately
--       demonstrated with two live connections (single MCP channel); semantics are standard.
--   [x] RLS interaction: SECURITY DEFINER + search_path="" runs as owner, bypassing RLS; the
--       room_players seat-ownership EXISTS check IS the authorization, and auth.uid() null-check
--       rejects true-anon. GRANT is authenticated-only (anon NOT granted · tighter than 009 · Rule 44).
--   [~] Deck exhaustion: RPC raises 'deck is empty'; T3's wiring must catch and route to the existing
--       client-side endgame trigger (maybeForceFlowEndgame). Left as a WIRING decision for T3.
-- WIRING (T3 · after apply): in the draw path, call supabase.rpc('draw_card_for_seat', {...}) instead
--   of the local deck.shift()/hand.push() + pushState snapshot. Apply the returned card to local state;
--   the DB row update drives realtime sync to peers (no separate broadcast needed). Keep the old
--   snapshot path for non-draw actions.
-- ============================================================================================
