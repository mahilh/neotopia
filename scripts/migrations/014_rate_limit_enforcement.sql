-- NeoTopia · migration 014 · RATE-LIMIT ENFORCEMENT POINTS  (PHASE 2 of 2)
-- ============================================================================================
-- STATUS: 🔴 NOT APPLIED. DO NOT APPLY UNTIL THE ADVERSARIAL REVIEW CLEARS IT.
--
--   Migration 013 (the ledger + primitive) IS applied and proven live · it is inert by design.
--   THIS file is the part that can break the game, because every enforcement point below sits on a
--   path a real player uses. It is held deliberately: 013 gave us the evidence that the limiter
--   works with a blast radius of zero, and 014 is where that stops being true.
--
--   Rule 68 applies with force: this file in git is INTENT, not STATE.
--
-- WHAT STILL GATES IT (do these before applying):
--   [ ] Adversarial review across three lenses · lockout / evasion / SQL-correctness.
--   [ ] VERIFY QUERY IP (below) run from a REAL browser session · decides whether tier 2 exists at
--       all. Until then, treat the per-IP tier as ABSENT, not as coverage.
--   [ ] A clean bot-simulate run against a staging/preview deploy with this applied, confirming a
--       full 4-player game never trips a limit.
--
-- ── VERIFIED LIVE ALREADY (do not re-litigate) ───────────────────────────────────────────────
--   · auth.users: 2,476 rows, 100% anonymous, peak 26 minted in ONE minute. Free identity minting
--     is not hypothetical here, it is the observed traffic pattern.
--   · has_function_privilege('anon','draw_card_for_seat',...) = TRUE. Migration 011's header claims
--     "authenticated only · anon NOT granted" · THE LIVE ACL DISAGREES. The GRANT was written, the
--     REVOKE was not (Rule 61 · verify the value, not the signature). Section 4 closes it.
--   · A real anonymous player session carries role="authenticated" (is_anonymous=true), NOT "anon".
--     PROVEN by decoding a live signInAnonymously access_token. This is why revoking `anon` below
--     does not lock out a single real player · it removes an unauthenticated-caller hole only.
--   · pg_cron / pg_net / dblink absent · no autonomous transactions, so a call that later RAISES
--     cannot keep its ledger increment. Stated as a residual gap, not papered over.
--
-- LOCK-ORDER INVARIANT (deadlock safety · read before adding a 4th enforcement point):
--   Every path takes the LEDGER row lock FIRST and the domain row lock (game_sessions /
--   player_profiles / game_rooms) SECOND. Never the reverse. authenticator carries lock_timeout=8s
--   (verified live), so an inverted order surfaces as a game-breaking 8s stall, not a clean error.
-- ============================================================================================


-- ============================================================================================
-- 1 · ENFORCEMENT POINT A · increment_neotopia_index          [FAIL-CLOSED, deliberately]
-- ============================================================================================
-- WHAT IT IS: +1..56 to player_profiles.neotopia_index. get_global_neotopia_index() SUMs exactly
--   that column, and that sum is the flagship "consciousness districts built" number on the Landing
--   hero and FinalScore. One HTTP request permanently moves the brand metric, and there is NO
--   increment ledger, so nothing can ever be unwound or audited.
-- WHAT GUARDED IT BEFORE: didRecordRef, a React useRef. localStorage.clear() resets it. That was
--   the entire control.
--
-- PROOF-OF-PLAY GATE · this, not the number, is what resists anon minting. A uid-keyed limit alone
--   is worthless (mint a uid, get a fresh budget), so the caller must now hold a room_players row ·
--   i.e. have actually taken a seat. A freshly minted anon has none. That converts "1 request per
--   +56" into "create room -> claim seat -> +56", and room creation is itself limited by point C.
--   The two limits COMPOSE: sustained inflation is bounded by the room-creation rate.
--
-- LIMITS · 2/60s AND 8/3600s per auth.uid(). Legitimate volume is ONE call per FINISHED game; a
--   Flow game is 9 tiles at 15s and Classic 12 at 90s, so even a speedrunner tops out near 4-6
--   finished games/hour. 2/60s absorbs the one real double-fire (a reload during 'scoring') while
--   stopping a tight loop at the second request. 8/hour caps one identity at 8x56=448/hour instead
--   of unbounded (today 10 req/s = +2M/hour) · a ~4,500x reduction.
--
-- FAIL-CLOSED is the asymmetry argument: failing closed costs a player one cosmetic counter tick
--   and zero gameplay; failing open permanently corrupts the number the brand is built on, with no
--   audit trail and no client-reachable cleanup path.
create or replace function public.increment_neotopia_index(amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_has_seat boolean;
begin
  -- The original was LANGUAGE sql with no null-uid guard · it relied on `where user_id = auth.uid()`
  -- matching zero rows. That is silent, not safe (Rule 59).
  if v_uid is null then
    raise exception 'permission denied: increment_neotopia_index requires an authenticated session';
  end if;

  select exists (select 1 from public.room_players rp where rp.user_id = v_uid) into v_has_seat;
  if not v_has_seat then
    raise exception 'permission denied: increment_neotopia_index requires having joined a game';
  end if;

  -- Burst tier first · it is the one that stops a loop instantly.
  if not public.check_rate_limit('civ_index_burst', 'u:' || v_uid::text, 2, interval '60 seconds') then
    raise exception 'rate limit: civilization index already recorded recently · retry in a minute';
  end if;
  if not public.check_rate_limit('civ_index_hourly', 'u:' || v_uid::text, 8, interval '1 hour') then
    raise exception 'rate limit: too many civilization records this hour';
  end if;

  update public.player_profiles
     set neotopia_index = coalesce(neotopia_index, 0) + least(greatest(amount, 0), 56)
   where user_id = v_uid;
end;
$$;


-- ============================================================================================
-- 2 · ENFORCEMENT POINT B · draw_card_for_seat                 [FAIL-OPEN]
-- ============================================================================================
-- REPLACES the migration-011 body. The game logic is byte-for-byte identical. TWO changes:
--
--  (i)  RATE LIMIT, two tiers.
--  (ii) LOCK-ORDERING FIX · and this matters as much as the limit. In 011 the FIRST thing the
--       function did was SELECT ... FOR UPDATE on game_sessions, and only THEN check seat ownership
--       and turn. So a caller owning NO seat could take an exclusive row lock on a stranger's live
--       game, in a loop, and serialize every real player behind it. Now every cheap, lock-free
--       validation runs BEFORE the lock, and only a call that will actually mutate takes it. The
--       turn check is RE-RUN against the locked row to close the TOCTOU this opens.
--
-- LIMITS · 30 draws/60s per (session,seat) AND 60/60s per session:
--   · Classic allows at most 3 draws per 90s turn (actionsRemaining starts at 3), so 30/60s is ~15x
--     the legitimate ceiling.
--   · Flow is the real target: migration 011 DELIBERATELY disables the turn gate in flow mode and
--     does not decrement actions for a non-current seat, so the action budget is NOT a brake and a
--     seated player can loop the RPC unbounded · each call taking the row lock, rewriting the ENTIRE
--     state jsonb (deck + 3 regions + every hand) and fanning it out over realtime to every
--     subscriber. 30/60s = one draw every 2s sustained, far above any human click rate.
--   · The per-SESSION tier bounds room-wide damage: the deck is 56 cards, so 60 draws in 60s across
--     all seats exceeds the entire deck · structurally impossible to hit legitimately, yet it caps
--     the lock/WAL/realtime storm at 1 write/sec/room even if an attacker holds all four seats.
--   · Bursts are fine: the estimator only smooths across the WINDOW boundary. 5 draws in 3s is
--     nowhere near 30.
--
-- FAIL-OPEN: a limiter defect must never make a live game unplayable. Draws are already bounded by
--   three brakes that survive a limiter outage · deck size (56, hard), seat ownership (max 4
--   attackers per room), and the FOR UPDATE serialization itself.
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

  -- LOCK-FREE PRE-READ (was a FOR UPDATE in 011) · every rejection path below now costs an index
  -- lookup instead of an exclusive lock on a live game's row.
  select gs.room_id, gs.mode, gs.current_seat
    into v_room_id, v_mode, v_current_seat
    from public.game_sessions gs
   where gs.id = p_session_id;

  if v_room_id is null then
    raise exception 'session not found: %', p_session_id;
  end if;

  -- SEAT OWNERSHIP · NOW BEFORE THE LOCK. The single most important reordering in this migration.
  select exists (
    select 1 from public.room_players rp
     where rp.room_id = v_room_id and rp.user_id = v_uid and rp.seat_number = p_seat
  ) into v_owns_seat;
  if not v_owns_seat then
    raise exception 'permission denied: seat % is not owned by the calling player', p_seat;
  end if;

  -- TURN GATING (mode-aware · unchanged semantics) · NOW BEFORE THE LOCK.
  if v_mode is distinct from 'flow' and p_seat is distinct from v_current_seat then
    raise exception 'not your turn: seat % cannot draw while seat % is active (classic mode)', p_seat, v_current_seat;
  end if;

  -- RATE LIMIT · fail-open · LEDGER LOCK BEFORE SESSION LOCK (see the invariant in the header).
  if not public.check_rate_limit_safe(
       'draw', 's:' || p_session_id::text || ':' || p_seat::text, 30, interval '60 seconds') then
    raise exception 'rate limit: too many draws for seat % · slow down', p_seat;
  end if;
  if not public.check_rate_limit_safe(
       'draw_session', 's:' || p_session_id::text, 60, interval '60 seconds') then
    raise exception 'rate limit: too many draws in this game · slow down';
  end if;

  -- NOW take the lock and re-read authoritative state.
  select gs.state, gs.mode, gs.current_seat
    into v_state, v_mode, v_current_seat
    from public.game_sessions gs
   where gs.id = p_session_id
   for update;

  if v_state is null then
    raise exception 'session not found: %', p_session_id;   -- deleted between pre-read and lock
  end if;

  -- TOCTOU CLOSE: the pre-check was an OPTIMISATION; THIS is the authoritative gate.
  if v_mode is distinct from 'flow' and p_seat is distinct from v_current_seat then
    raise exception 'not your turn: seat % cannot draw while seat % is active (classic mode)', p_seat, v_current_seat;
  end if;

  -- ── GAME BODY · unchanged from migration 011 ───────────────────────────────────────────────
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

  return v_drawn;
end;
$$;


-- ============================================================================================
-- 3 · ENFORCEMENT POINT C · INSERT public.game_rooms (BEFORE INSERT trigger)   [FAIL-OPEN]
-- ============================================================================================
-- The launch blocker as stated. It MUST be a trigger, not an RPC wrapper: createRoom does a direct
-- PostgREST `supabase.from('game_rooms').insert()` (useGameRoom.js:38), so a trigger is the only
-- place the limit cannot be routed around. VERIFIED: game_rooms has ZERO non-internal triggers, so
-- this adds no ordering interaction.
--
-- A FREE PROPERTY OF DOING IT IN-TRANSACTION: the ledger increment shares the INSERT's transaction,
-- so if the insert then fails (23505 on room_code) the increment ROLLS BACK too · insertRoomWithRetry's
-- retry-once does NOT double-charge the bucket. The same property is why a limiter can never
-- "remember" a call that later raises; that is the honest residual gap (no autonomous transactions).
--
-- THREE TIERS, each defeating a different attacker:
--   TIER 1 · 6 rooms/300s per auth.uid(). A host creates a room then plays in it for 5-20 minutes;
--     six in five minutes already covers re-clicking Create through a bad connection plus the retry.
--     ~10x normal behaviour. HONEST: this tier is minting-EVADABLE on its own.
--   TIER 2 · 20 rooms/300s per client IP · SKIPPED when the IP is not resolvable. The only tier that
--     resists free anon minting. Tolerates a shared-NAT household while stopping a single-box script.
--     UNPROVEN on the PostgREST path · self-disables rather than throttling everyone into one NULL
--     bucket. Run VERIFY QUERY IP below before counting this as coverage.
--   TIER 3 · 300 rooms/60s GLOBAL circuit breaker. The backstop for a distributed/IP-rotating flood.
--     Sized against reality: peak observed is 251 anonymous sign-ins in an hour (~4/min), so 300 per
--     MINUTE is ~75x organic peak. TRADEOFF STATED PLAINLY: this tier CAN deny innocent players
--     during an attack · it converts DB exhaustion into a temporary, self-healing "can't create a
--     room right now". Right trade at 300/min, WRONG trade if anyone tunes it near organic volume.
--     Set to 0 to hard-close room creation during an incident.
create or replace function public.rl_enforce_room_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ip  text := public.rl_client_ip();
begin
  if public.rl_is_trusted_caller() then
    return new;
  end if;

  -- TIER 1 · per identity. RLS already forces host_id = auth.uid(), so these agree; the coalesce
  -- keeps the tier from collapsing into a shared NULL key.
  if not public.check_rate_limit_safe(
       'room_create', 'u:' || coalesce(new.host_id, v_uid)::text, 6, interval '5 minutes') then
    raise exception 'rate limit: too many rooms created · wait a few minutes before creating another'
      using errcode = '53400';
  end if;

  -- TIER 2 · per IP · skipped entirely when unresolvable.
  if v_ip is not null then
    if not public.check_rate_limit_safe('room_create_ip', 'ip:' || v_ip, 20, interval '5 minutes') then
      raise exception 'rate limit: too many rooms created from this network · try again shortly'
        using errcode = '53400';
    end if;
  end if;

  -- TIER 3 · global circuit breaker.
  if not public.check_rate_limit_safe('room_create_global', 'all', 300, interval '60 seconds') then
    raise exception 'NeoTopia is under unusually heavy load · room creation is paused for a moment'
      using errcode = '53400';
  end if;

  return new;
end;
$$;

revoke all on function public.rl_enforce_room_create() from public, anon, authenticated;

drop trigger if exists rl_game_rooms_insert on public.game_rooms;
create trigger rl_game_rooms_insert
  before insert on public.game_rooms
  for each row execute function public.rl_enforce_room_create();


-- ============================================================================================
-- 4 · GRANT REPAIR · close migration 011's undocumented PUBLIC hole
-- ============================================================================================
-- `create or replace function` PRESERVES the existing ACL, so the hole verified live above survives
-- a body replacement. It must be revoked explicitly. Safe for real players: a live anonymous session
-- carries role="authenticated", NOT "anon" (proven by decoding a real signInAnonymously token), so
-- this removes an UNAUTHENTICATED-caller path only.
revoke all on function public.draw_card_for_seat(uuid, integer, text, integer) from public, anon;
grant execute on function public.draw_card_for_seat(uuid, integer, text, integer) to authenticated;

-- increment_neotopia_index deliberately KEEPS anon+authenticated: its real boundary is now the
-- null-uid check + proof-of-play + rate limit inside the body, not the grant. Anonymous sign-ins
-- carry role='authenticated' anyway, so revoking anon would change nothing about who can reach it ·
-- it would only create a FALSE sense of a boundary (the exact mistake migrations 007/008 made).
revoke all on function public.increment_neotopia_index(integer) from public;
grant execute on function public.increment_neotopia_index(integer) to anon, authenticated;


-- ============================================================================================
-- 5 · PROOF QUERIES (run AFTER apply)
-- ============================================================================================
-- ── VERIFY QUERY IP · does tier 2 exist at all? (UNPROVEN · decides real per-IP coverage) ────
--   Create ONE room from a REAL BROWSER session (not the SQL editor / MCP · different connection,
--   always NULL), then:
--     select bucket_key, hits from public.rate_limit_ledger where action = 'room_create_ip';
--   IF a row keyed 'ip:<addr>' appears -> tier 2 is LIVE.
--   IF no rows -> tier 2 self-disabled and per-IP limiting must move to the Vercel WAF
--   (vercel.json currently has no firewall rules). Do not record tier 2 as coverage until proven.
--
-- ── VERIFY QUERY ROOM · does the room-create limit fire end to end? ──────────────────────────
--   From a real browser session, create 8 rooms in a loop. EXPECT the first 6 to succeed and the
--   remainder to fail with 'rate limit: too many rooms created'. Then:
--     select * from public.rate_limit_peek('room_create', 'u:<uid>', interval '5 minutes');
--
-- ── VERIFY QUERY DRAW · does the draw limit fire on the REAL RPC path? ───────────────────────
--   With a real seated player, fire 40 draws via supabase.rpc('draw_card_for_seat', ...). EXPECT the
--   first ~30 to succeed or fail with a GAME reason ('deck is empty'), the rest with
--   'rate limit: too many draws for seat N'. useDrawCard.js already surfaces rpcError.message
--   verbatim, so the throttle message reaches the UI with ZERO client edits.
--
-- ── VERIFY QUERY FAIL-OPEN · is the limiter silently failing open? ───────────────────────────
--   check_rate_limit_safe swallows errors by design, so a broken limiter looks like a quiet one.
--     select action, count(*) buckets, sum(hits) hits, max(window_start) newest
--       from public.rate_limit_ledger group by action order by action;
--   EXPECT rows for 'draw', 'draw_session', 'room_create' during normal traffic. If game traffic is
--   flowing and 'draw' has NO recent bucket, the limiter is failing open · investigate.
--
-- ── ROLLBACK (keep this to hand while applying) ──────────────────────────────────────────────
--   drop trigger if exists rl_game_rooms_insert on public.game_rooms;
--   -- then re-apply the migration-011 body of draw_card_for_seat and the migration-009 body of
--   -- increment_neotopia_index. The ledger + primitive (013) can stay · they are inert without
--   -- these call sites.
-- ============================================================================================
