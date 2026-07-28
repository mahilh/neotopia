-- ============================================================================================
-- 🔴 ADVERSARIAL REVIEW COMPLETE · VERDICT: APPLY_WITH_FIXES · DO NOT APPLY AS-IS
-- ============================================================================================
-- Two independent reviewers (security/evasion and lockout/correctness lenses) returned
-- APPLY_WITH_FIXES with 16 defects between them. Every claim below was RE-VERIFIED by the lead
-- against the live production DB · these are not speculative review notes.
--
-- ── THE FINDING THAT REFRAMES THIS ENTIRE MIGRATION ─────────────────────────────────────────
-- Rate-limiting the RPCs is LARGELY THEATRE while the underlying tables stay directly writable.
-- CONFIRMED LIVE on wynccumuisjxbptjlfwq:
--   has_column_privilege(authenticated, player_profiles.neotopia_index, UPDATE) = TRUE
--     -> an attacker skips increment_neotopia_index entirely and PATCHes the brand counter to
--        2147483647 in ONE request. Policy profiles_own is FOR ALL USING(...) with WITH CHECK
--        NULL (verified: 1 such policy), so the USING expression is reused and the write passes.
--   has_column_privilege(authenticated, game_sessions.state, UPDATE) = TRUE
--     -> all three draw tiers are bypassed by a direct PATCH on state. The CLIENT ALREADY DOES
--        THIS (useGameSync.js:271 writes the whole state jsonb), so the path cannot simply be shut
--        without moving state writes behind an RPC first.
--   has_table_privilege(authenticated, game_events, INSERT) = TRUE, table is in the
--     supabase_realtime publication, event_data is unbounded jsonb -> storage + fanout amplifier.
--   has_table_privilege(authenticated, room_players, INSERT) = TRUE with room_players_join
--     WITH CHECK (user_id = auth.uid()) and NOTHING else · no joinable-state or capacity check.
--     So the "proof of play" gate this migration leans on is CLIENT-ASSERTABLE in one INSERT.
-- CONCLUSION: close the direct-write surface FIRST (column-scoped grants + real WITH CHECK
-- policies + an RPC for state writes). Rate limits are the second layer, not the first.
--
-- ── DEFECTS THAT WOULD HAVE BROKEN REAL PLAYERS OR CI (lockout lens) ────────────────────────
--   · MEASURED game length is 118-125s (three live hosts, game_rooms.created_at ->
--     game_sessions.updated_at), NOT the 10-20 minutes assumed here. A real player completes
--     ~25-30 games/hour, so the civ_index hourly tier in this file silently stops counting their
--     districts partway through a normal session. The limits below are sized on a WRONG premise.
--   · A burst tier of 20/10s BREAKS tests/e2e/draw-rpc-concurrency.mjs, which fires
--     N_CONCURRENT (default 16, documented usage 24) draws in ONE Promise.all against one seat.
--     The repo own atomic-draw proof would fail as "RACE DETECTED" when nothing raced.
--   · Hoisting the TURN GATE outside the FOR UPDATE makes rejection strictly MORE restrictive
--     than the live function (rejects if EITHER the unlocked pre-read or the locked read says
--     "not your turn"), producing spurious errors during a turn flip. Keep the cheap auth checks
--     and the rate limits pre-lock · that part correctly fixes 011 lock-ordering DoS · but leave
--     the turn gate ONLY in its post-lock position.
--   · A per-session shared draw bucket is a WEAPON: one seated attacker drains it and throttles
--     the innocent players in that game. Shared-fate tiers need fail-soft treatment.
--   · Per-uid tiers ADD write amplification against a mint-evadable attacker (their bucket is
--     always fresh, so the limiter always writes AND always fires the prune). Evaluate the
--     mint-RESISTANT tier FIRST so a denial costs zero writes.
--
-- ── ALSO CONFIRMED ──────────────────────────────────────────────────────────────────────────
--   · request.headers / request.jwt.claims are NULL on the MCP management connection · that is
--     EXPECTED and is NOT evidence about the PostgREST path. The per-IP tier remains UNPROVEN and
--     must stay disabled until probed from a real browser session.
--   · The DB is NOT empty: 350 game_rooms, 334 game_sessions live. (list_tables reports rows:0 ·
--     that is a stale planner estimate, not truth. Do not size limits from it.)
--
-- NEXT SESSION: fix the direct-write surface first, re-size every limit against the 118-125s
-- measurement, then re-run the adversarial pass before applying anything here.
-- ============================================================================================

-- NeoTopia · migration 014 · RATE-LIMIT ENFORCEMENT POINTS  (PHASE 2 of 2)
-- ============================================================================================
-- STATUS: 🔴 NOT APPLIED. Rule 68 · this file in git is INTENT, not STATE.
--
--   Migration 013 (ledger + primitive) IS applied and proven live · it is inert by design.
--   THIS file is the part that can break the game, because every enforcement point sits on a path
--   a real player uses. 013 gave us evidence that the limiter works with a blast radius of zero;
--   014 is where that stops being true.
--
-- ── RECONCILED (Rule 66 · the tree moved under this file mid-session) ────────────────────────
--   An earlier 014 draft existed in this working tree. This version KEEPS its structure, its
--   lock-order invariant and its grant repair, and CORRECTS six things that a live re-measurement
--   of this database proved wrong or missing. Every change is called out inline as "014-REV".
--
-- ── RE-VERIFIED LIVE AT THE MOMENT OF WRITING · not from any file (Rule 64) ──────────────────
--   PHASE 1 IS DEPLOYED: public.rate_limit_ledger (RLS on, anon/auth revoked) + check_rate_limit,
--     check_rate_limit_safe, rl_is_trusted_caller, rl_client_ip, rate_limit_peek · all
--     prosecdef=t, search_path='', anon_exec=f, auth_exec=f. 014 adds NO new limiter mechanism.
--   THE DATABASE IS NOT EMPTY. The prior design round assumed "all tables 0 rows"; that premise is
--     STALE (Rule 28/64) and every limit below was re-derived from real traffic:
--       game_rooms 350 · game_sessions 334 · game_events 232 · room_players 45
--       player_profiles 12 · global_neotopia_index 3 · auth.users 2478 (100% anonymous)
--   MEASURED PEAKS (this is what the limits are sized against, not click-rate reasoning):
--       rooms/min by ONE host ......... max 1    p99 1
--       rooms/min GLOBAL .............. max 7    · rooms/5min GLOBAL max 11
--       signups/min GLOBAL ............ max 26
--       draws/10s per (session,seat) .. max 6
--       draws/min per (session,seat) .. max 18   p95 18      <-- 014-REV #1 hinges on this
--       draws/min per session ......... max 36               <-- 014-REV #1 hinges on this
--       events/min per session ........ max 47
--       game_sessions.state size ...... avg 7.5 KB, max 7.8 KB (not the 20-60 KB assumed earlier)
--       sessions by mode .............. classic 334, flow 0  (Flow has NEVER run in production, so
--                                        all Flow numbers remain derived from GAME_MODES)
--   has_function_privilege('anon','draw_card_for_seat',...) = TRUE. Migration 011's header claims
--     "authenticated only · anon NOT granted" · THE LIVE ACL DISAGREES:
--     {=X/postgres,postgres=X/postgres,authenticated=X/postgres} · the leading `=X` IS the implicit
--     PUBLIC grant that `create function` always adds and 011 never revoked (Rule 61).
--     PROVEN OVER HTTP (Rule 39 · the status is the witness), anon key, no user JWT:
--       POST /rest/v1/rpc/draw_card_for_seat -> HTTP 400
--       {"code":"P0001","message":"permission denied: draw_card_for_seat requires an
--         authenticated session"}
--     A P0001 from the function's OWN body · not 42501, not PGRST202 · proves PostgREST resolved
--     and EXECUTED it as anon. Only the in-body null-uid check stopped it. Section 5 closes it.
--   POSTGREST IS v11+ : an unknown RPC returns code PGRST202. That is the version floor for
--     `raise sqlstate 'PGRST'`, so a REAL HTTP 429 is available. 014-REV #2 uses it.
--   pg_cron / pg_net / dblink ABSENT (extensions are exactly pg_stat_statements, pgcrypto, plpgsql,
--     supabase_vault, uuid-ossp, vector) · no autonomous transactions. Stated as a residual gap.
--   anon statement_timeout=3s · authenticated 8s · authenticator lock_timeout=8s · max_connections 60.
--
-- ── THE SIX CORRECTIONS ──────────────────────────────────────────────────────────────────────
--   014-REV #1 · DRAW LIMITS WERE TOO TIGHT TO BE SAFE. The prior draft used 30/60s per
--     (session,seat) and 60/60s per session, justified as "~15x the legitimate ceiling" from
--     Classic's 3-actions-per-turn. Measured reality: 18 draws/min per seat and 36/min per session
--     HAVE ALREADY HAPPENED in this database. Those limits are 1.67x observed peak, not 15x · they
--     would fire during a normal bot/E2E game. Re-sized to >=3.3x measured peak, plus a short burst
--     tier that the long tier alone cannot express.
--   014-REV #2 · REJECTIONS NOW RETURN A REAL HTTP 429. The prior draft used bare `raise exception`
--     (P0001 -> HTTP 400) and `errcode='53400'` (-> HTTP 500). A throttle that looks like a server
--     outage is the worst of both: it pages on-call and it teaches the client nothing. PostgREST
--     v11+ is confirmed, so rl_reject() emits a true 429 through the SAME { data, error } shape
--     every call site already handles.
--   014-REV #3 · LIMITS ARE NOW DATA, NOT CONSTANTS. Every rule lives in public.rate_limit_config
--     and is disarmable with one UPDATE · no migration, no deploy. On a live production database
--     this is the single most valuable blast-radius control there is, and the prior draft required
--     a migration to change any number.
--   014-REV #4 · THE GLOBAL INDEX IS NOW STRUCTURALLY PROTECTED, NOT COUNTED. Proof-of-play plus a
--     uid-keyed counter is still mint-evadable: mint -> create room -> claim seat -> +56, forever.
--     public.civilization_claims' PRIMARY KEY (session_id, player_id) caps it at +56 per seat per
--     game FOREVER. A UNIQUE constraint is not a budget, so minting cannot reset it.
--   014-REV #5 · record_civilization_score IS NOW GATED. The prior draft did not touch it. It is
--     the single worst path in the write surface: global_neotopia_index.session_id has NO FOREIGN
--     KEY (verified in pg_constraint · only PK, UNIQUE(session_id,player_id) and range CHECKs), so
--     the UNIQUE the code relies on for idempotence is defeated by sending a fresh random UUID per
--     call. One request = one permanent row in the PUBLIC civilization ledger.
--   014-REV #6 · THE IP TIER NO LONGER TRUSTS A FORGEABLE HEADER. 013's live rl_client_ip reads
--     split_part(x-forwarded-for, ',', 1) · the LEFTMOST element, which is whatever the CLIENT
--     sent. Keying a limit on it is worse than no limit: rotatable (worthless) AND forgeable
--     against a victim (an attacker burns an innocent player's budget = targeted lockout). Replaced
--     with a config-driven whitelist that ships DISABLED and never honours the leftmost entry.
--
-- ── WHAT THIS FILE DELIBERATELY DOES NOT DO (the blast-radius argument) ──────────────────────
--   NO trigger on game_sessions UPDATE. NO trigger on game_events INSERT. Those are the HOT path:
--   every committed move writes both, and there are 334 real sessions in this database right now.
--   A defect in a trigger there bricks every live game. The draw path is limited INSIDE
--   draw_card_for_seat instead · identical coverage of the expensive write (it is the only draw
--   path that takes the row lock) with a failure surface of one function instead of one table.
--   The ONE trigger here is on game_rooms INSERT: a COLD path (measured peak 1/min/host, 7/min
--   global) with no RPC to wrap, because the client inserts that row directly (useGameRoom.js:38).
--   NO RLS policy is dropped. NO table GRANT is revoked. NO RPC signature is broken. NO client file
--   changes. A currently-deployed browser keeps working in every path.
--
-- ── FAILURE POLICY · ONE RULE, NO EXCEPTIONS ─────────────────────────────────────────────────
--   THROTTLES ALWAYS FAIL OPEN. AUTHORIZATION ALWAYS FAILS CLOSED.
--   Every rate check goes through rl_gate(), which wraps the limiter AND pins lock_timeout=250ms,
--   so it can never eat more than 250ms of the caller's 3s/8s budget and can never stall inside
--   draw_card_for_seat's FOR UPDATE window against authenticator's lock_timeout=8s.
--   This is only defensible because the guarantees that MATTER are structural (014-REV #4/#5), not
--   counters. rl_gate RETURNS a boolean and never raises, so the fail-open handler is structurally
--   incapable of swallowing an authorization raise.
--
-- LOCK-ORDER INVARIANT (deadlock safety · read before adding a 4th enforcement point):
--   Every path takes the LEDGER row lock FIRST and the domain row lock (game_sessions /
--   player_profiles / game_rooms) SECOND. Never the reverse.
--
-- WHAT STILL GATES APPLYING THIS:
--   [ ] VERIFY IP (section 9) from a REAL browser session · decides whether tier 2 exists at all.
--   [ ] A clean bot-simulate run against a preview deploy with this applied, confirming a full
--       4-player game never trips a limit. This is the gate that matters most · the limits above
--       are sized against measured history, and bot-simulate is what produced that history.
-- ============================================================================================


-- ============================================================================================
-- 1 · CONFIG · limits as DATA (014-REV #3)
-- ============================================================================================
create table if not exists public.rate_limit_config (
  rule           text    primary key,
  max_hits       integer not null check (max_hits >= 0),
  window_seconds integer not null check (window_seconds > 0),
  enabled        boolean not null default true,
  note           text
);

-- LOAD-BEARING, NOT HYGIENE (Rule 19, inverted). VERIFIED LIVE in pg_default_acl: migration 001's
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ... ON TABLES TO anon, authenticated
-- is STILL in force ·
--   defaclobjtype 'r', public: {postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres,
--                               authenticated=arwdDxtm/postgres, service_role=Dxtm/postgres}
-- so this table is world-writable at the grant layer the instant it exists, and served at
-- /rest/v1/rate_limit_config. A client that can UPDATE it sets every limit to 0 (kills the product)
-- or to 2^31 (disables every limit). Same trap 013 documented for the ledger.
revoke all on table public.rate_limit_config from anon, authenticated;
alter table public.rate_limit_config enable row level security;   -- zero policies = deny all
grant select on table public.rate_limit_config to service_role;

comment on table public.rate_limit_config is
  'NeoTopia rate-limit rules (migration 014). Deny-all by design: no RLS policies, no anon/auth '
  'grants. Read ONLY by public.rl_gate (SECURITY DEFINER). Tune with UPDATE · no migration needed.';

-- ON CONFLICT DO NOTHING so re-running this migration can NEVER clobber a limit an operator has
-- tuned against live traffic. Change a limit with UPDATE, not by editing this file.
insert into public.rate_limit_config (rule, max_hits, window_seconds, note) values
  ('draw_burst',         20,   10, 'per (session,seat) · 3.3x measured peak 6/10s'),
  ('draw_seat',          60,   60, 'per (session,seat) · 3.3x measured peak 18/min'),
  ('draw_session',      150,   60, 'per session, all seats · 4.2x measured peak 36/min · deck is 56'),
  ('room_create_user',    8,  300, 'per host_id · 8x measured peak (1/min/host)'),
  ('room_create_ip',     40,  300, 'per client IP · DISABLED until the header is verified'),
  ('room_create_global',240,   60, 'circuit breaker · 34x measured peak 7/min · SHARED FATE'),
  ('civ_index_user',      6, 3600, 'per uid · backstop · mint-evadable by design (see REV #4)'),
  ('civ_index_global',  180, 3600, 'circuit breaker on the public counter · SHARED FATE'),
  ('civ_record_user',    12, 3600, 'per uid · the structural gate in section 7 is the real control'),
  ('purge_user',          6, 3600, 'per uid · purge_e2e_test_data is destructive AND publicly reachable'),
  ('purge_global',       20, 3600, 'circuit breaker on the destructive purge')
on conflict (rule) do nothing;

-- The IP tier ships DISABLED. Arming it requires SEEING the real header set first (section 9).
update public.rate_limit_config set enabled = false where rule = 'room_create_ip';

-- Config CHANNEL, not a limit: `note` carries the header name to trust; max_hits/window are unused.
-- ONLY these three values are honoured. cf-connecting-ip is strongly preferred · it is SET by the
-- CDN and OVERWRITES anything the client sends, which is what makes it unforgeable. Cloudflare IS
-- in this project's path (responses carry `server: cloudflare` and `cf-ray`), but whether that
-- header survives into PostgREST is UNPROVEN. The LEFTMOST x-forwarded-for entry is never honoured
-- by any code path in this file, deliberately (014-REV #6).
insert into public.rate_limit_config (rule, max_hits, window_seconds, enabled, note)
values ('ip_header', 1, 1, false,
        '' /* one of: cf-connecting-ip | x-real-ip | x-forwarded-for-rightmost */)
on conflict (rule) do nothing;


-- ============================================================================================
-- 2 · THE GATE · the only way this migration consumes the limiter
-- ============================================================================================
-- Returns TRUE = allowed. NEVER raises. Rejection is the CALLER's decision, which is what keeps
-- the fail-open handler structurally unable to swallow an authorization raise.
--
-- lock_timeout is a FUNCTION attribute, so Postgres saves and restores it around every call: it
-- bounds the limiter's own ledger acquisition and then leaves the caller's subsequent
-- SELECT ... FOR UPDATE at the default. Shortening THAT lock would be actively harmful · honest
-- contention between two players drawing in the same game SHOULD block, not error.
-- statement_timeout is deliberately NOT set: a function-scoped value cannot re-arm the timer of an
-- already-running statement, so declaring it would look like a guard while doing nothing.
create or replace function public.rl_gate(p_rule text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
set lock_timeout = '250ms'
as $$
declare
  v_max integer; v_window integer; v_enabled boolean;
begin
  if p_key is null or p_key = '' then
    return true;                      -- no subject to key on (e.g. IP tier disarmed) => not our call
  end if;

  select c.max_hits, c.window_seconds, c.enabled
    into v_max, v_window, v_enabled
    from public.rate_limit_config c
   where c.rule = p_rule;

  if not found or v_enabled is not true then
    return true;                      -- unknown or disabled rule => allow (fail open)
  end if;

  return public.check_rate_limit(p_rule, p_key, v_max, make_interval(secs => v_window), 1);
exception when others then
  return true;                        -- FAIL OPEN · a broken limiter must not be a broken game
end;
$$;


-- ============================================================================================
-- 3 · REJECTION · a real HTTP 429, with zero client changes (014-REV #2)
-- ============================================================================================
-- PostgREST maps a plain `raise exception` (P0001) to HTTP 400 and 53400 to HTTP 500 · both wrong,
-- and a throttle that presents as a 500 will page on-call for a working system.
-- `raise sqlstate 'PGRST'` sets the true status and body. VERIFIED AVAILABLE: this project's
-- PostgREST returns PGRST202 for an unknown RPC, which is the v11+ error scheme that ships with
-- custom-status raising.
-- The JSON `message` field becomes error.message in supabase-js, so useDrawCard.js:52
-- (setError(rpcError.message)) renders the throttle text through the path it ALREADY uses for
-- 'deck is empty' and 'not your turn'. Nothing in src/ changes.
create or replace function public.rl_reject(p_message text, p_hint text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise sqlstate 'PGRST' using
    message = json_build_object(
                'code',    '429',
                'message', p_message,
                'details', 'NeoTopia rate limit',
                'hint',    coalesce(p_hint, 'Wait a moment and try again.'))::text,
    detail  = json_build_object('status', 429, 'status_text', 'Too Many Requests')::text;
end;
$$;

-- Replaces 013's rl_client_ip (014-REV #6). Config-driven whitelist; returns NULL unless explicitly
-- armed, and rl_gate treats NULL as "not our call" so the tier simply does not exist until an
-- operator arms it. No ::inet cast · a malformed header must not raise inside a game transaction.
create or replace function public.rl_client_ip()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source text; v_enabled boolean; v_hdrs jsonb; v_xff text; v_parts text[];
begin
  select c.note, c.enabled into v_source, v_enabled
    from public.rate_limit_config c where c.rule = 'ip_header';
  if not found or v_enabled is not true or coalesce(v_source, '') = '' then
    return null;
  end if;

  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;
  if v_hdrs is null then
    return null;                       -- not a PostgREST request (psql, pooler, MCP)
  end if;

  if v_source = 'cf-connecting-ip' then
    return left(nullif(btrim(v_hdrs ->> 'cf-connecting-ip'), ''), 64);
  elsif v_source = 'x-real-ip' then
    return left(nullif(btrim(v_hdrs ->> 'x-real-ip'), ''), 64);
  elsif v_source = 'x-forwarded-for-rightmost' then
    v_xff := nullif(v_hdrs ->> 'x-forwarded-for', '');
    if v_xff is null then return null; end if;
    v_parts := string_to_array(v_xff, ',');
    return left(nullif(btrim(v_parts[array_length(v_parts, 1)]), ''), 64);
  end if;
  return null;
exception when others then
  return null;
end;
$$;


-- ============================================================================================
-- 4 · ENFORCEMENT POINT A · draw_card_for_seat        [FAIL-OPEN + a real DoS fix]
-- ============================================================================================
-- REPLACES the migration-011 body. The game body is byte-for-byte identical to the LIVE definition
-- (read this session via pg_get_functiondef, not from the migration file · Rule 68). THREE changes:
--
--  (i)  LOCK-ORDERING FIX · this matters as much as the limit. In 011 the FIRST statement was
--       SELECT ... FOR UPDATE, and seat ownership was checked AFTER. Since sessions_read is
--       USING(true), any anon-key holder can enumerate every session id · so a caller owning NO
--       seat could take an exclusive row lock on any stranger's live game, in a loop, and serialize
--       every real player behind it. Now every cheap lock-free validation runs BEFORE the lock, and
--       the turn check is RE-RUN against the locked row to close the TOCTOU that opens.
--  (ii) EXHAUSTION PRE-CHECK (new in this revision). Because a raise rolls back its own ledger
--       increment, a loop of calls that always fail ('deck is empty') would be free. Checking
--       exhaustion against the lock-free pre-read means such a loop now raises WITHOUT ever taking
--       the row lock · which is the actual DoS. The residual cost is two index lookups, stated in
--       the residual gaps rather than papered over.
--  (iii)RATE LIMITS, consumed after the cheap gates and BEFORE the lock, never inside it.
--
-- LIMITS (014-REV #1 · re-sized against measured traffic, NOT click-rate reasoning):
--   · draw_burst   20 per 10s per (session,seat) · 3.3x the measured peak of 6.
--   · draw_seat    60 per 60s per (session,seat) · 3.3x the measured peak of 18. The prior draft's
--     30/60s was 1.67x measured peak and would have fired during a normal bot game.
--   · draw_session 150 per 60s per session · 4.2x the measured peak of 36, and above the entire
--     56-card deck, so it is structurally unreachable in legitimate play while still capping a
--     lock/WAL/realtime storm even if an attacker holds all four seats.
--   Flow is the real target: 011 DELIBERATELY disables the turn gate when mode='flow' and does not
--   decrement actions for a non-current seat, so the action budget is NOT a brake and a seated
--   player can loop unbounded · each call taking the row lock, rewriting the whole state jsonb and
--   fanning it out to every realtime subscriber. Flow has never run in production (0 of 334
--   sessions), so this closes the hole before it is ever exercised rather than after.
--
-- FAIL-OPEN: a limiter defect must never make a live game unplayable. Draws stay bounded by three
--   brakes that survive a limiter outage · deck size (56, hard), seat ownership (max 4 attackers
--   per room), and the FOR UPDATE serialization itself.
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
  select gs.room_id, gs.state, gs.mode, gs.current_seat
    into v_room_id, v_state, v_mode, v_current_seat
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

  -- EXHAUSTION PRE-CHECK · so a doomed loop never reaches the row lock. Advisory only; the locked
  -- read below re-checks and remains the authority.
  if p_source = 'deck' then
    if jsonb_array_length(coalesce(v_state->'deck', '[]'::jsonb)) = 0 then
      raise exception 'deck is empty';
    end if;
  else
    if v_state->'theOffer'->p_card_index is null then
      raise exception 'no offer card at index %', p_card_index;
    end if;
  end if;

  -- RATE LIMIT · fail-open · LEDGER LOCK BEFORE SESSION LOCK (see the invariant in the header).
  -- Narrow -> broad, and the same order in every caller: that is what makes the multi-key rules
  -- deadlock-free.
  if not public.rl_gate('draw_burst', 's:' || p_session_id::text || ':' || p_seat::text) then
    perform public.rl_reject(format('Drawing too fast for seat %s · slow down', p_seat),
                             'Wait a couple of seconds and draw again.');
  end if;
  if not public.rl_gate('draw_seat', 's:' || p_session_id::text || ':' || p_seat::text) then
    perform public.rl_reject(format('Too many draws for seat %s · slow down', p_seat),
                             'Draws are limited per seat per minute.');
  end if;
  if not public.rl_gate('draw_session', 's:' || p_session_id::text) then
    perform public.rl_reject('Too many draws in this game · slow down',
                             'This game is receiving draws faster than it can be played.');
  end if;

  -- NOW take the lock and re-read authoritative state (the 011 atomicity fix, preserved · proven
  -- empirically T3 S23 · 5c53e12).
  select gs.state, gs.mode, gs.current_seat
    into v_state, v_mode, v_current_seat
    from public.game_sessions gs
   where gs.id = p_session_id
   for update;

  if v_state is null then
    raise exception 'session not found: %', p_session_id;   -- deleted between pre-read and lock
  end if;

  -- TOCTOU CLOSE: the pre-checks were an OPTIMISATION; THIS is the authoritative gate.
  if v_mode is distinct from 'flow' and p_seat is distinct from v_current_seat then
    raise exception 'not your turn: seat % cannot draw while seat % is active (classic mode)', p_seat, v_current_seat;
  end if;

  -- ══ GAME BODY · byte-for-byte identical to the live migration-011 definition ═════════════════
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
-- 5 · ENFORCEMENT POINT B · INSERT public.game_rooms (BEFORE INSERT trigger)   [FAIL-OPEN]
-- ============================================================================================
-- MUST be a trigger, not an RPC wrapper: createRoom does a direct PostgREST
-- `supabase.from('game_rooms').insert()` (useGameRoom.js:38 via insertRoomWithRetry), so a trigger
-- is the only place the limit cannot be routed around. VERIFIED LIVE: game_rooms has ZERO
-- non-internal triggers, so this adds no ordering interaction. (The only pre-existing app triggers
-- anywhere are game_sessions.on_session_updated BEFORE UPDATE and room_players.trg_player_count
-- AFTER INSERT/DELETE.)
--
-- A FREE PROPERTY OF DOING IT IN-TRANSACTION: the ledger increment shares the INSERT's transaction,
-- so if the insert then fails (23505 on room_code) the increment ROLLS BACK too ·
-- insertRoomWithRetry's retry-once does NOT double-charge the bucket. One honest room costs exactly
-- one unit of budget, which is what makes a limit of 8 safe rather than optimistic.
--
-- THREE TIERS, each defeating a different attacker:
--   TIER 1 · 8 rooms/300s per host_id. Measured peak is 1 room/min by a single host (p99 also 1),
--     so this is ~8x real behaviour and still covers re-clicking Create through a bad connection.
--     HONEST: minting-EVADABLE on its own.
--   TIER 2 · 40 rooms/300s per client IP · SKIPPED entirely when unresolvable. The only tier that
--     resists free anon minting. Sized above tier 1 because one IP legitimately fronts a household,
--     office or classroom. UNPROVEN on the PostgREST path · self-disables rather than throttling
--     everyone into one shared NULL bucket. Run VERIFY IP before counting it as coverage.
--   TIER 3 · 240 rooms/60s GLOBAL circuit breaker. The backstop for a distributed / IP-rotating
--     flood. Measured global peak is 7 rooms/min (and 11 per 5 min), so this is ~34x organic peak.
--     TRADEOFF STATED PLAINLY: this tier CAN deny innocent players during an attack. It converts DB
--     exhaustion into a temporary, self-healing "can't create a room right now". Right trade at
--     240/min; WRONG trade if anyone ever tunes it near organic volume. Set max_hits=0 to
--     hard-close room creation during an incident. RAISE IT BEFORE ANY MARKETING PUSH.
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

  -- TIER 1 · keyed on NEW.host_id, not auth.uid(): RLS (rooms_insert WITH CHECK host_id =
  -- auth.uid()) already forces them equal, and keying on the COLUMN also binds a JWT-less caller ·
  -- which is what makes the SQL proof in section 9 a real proof rather than one that silently took
  -- a bypass. The coalesce keeps the tier from collapsing into a shared NULL key.
  if not public.rl_gate('room_create_user', 'u:' || coalesce(new.host_id, v_uid)::text) then
    perform public.rl_reject(
      'Too many rooms created · wait a few minutes before creating another',
      'You can create a handful of rooms every few minutes.');
  end if;

  -- TIER 2 · per IP · skipped entirely when unresolvable.
  if v_ip is not null and not public.rl_gate('room_create_ip', 'ip:' || v_ip) then
    perform public.rl_reject(
      'Too many rooms created from this network · try again shortly',
      'Several players on one network share this limit.');
  end if;

  -- TIER 3 · global circuit breaker.
  if not public.rl_gate('room_create_global', 'all') then
    perform public.rl_reject(
      'NeoTopia is under unusually heavy load · room creation is paused for a moment',
      'This is temporary and clears within a minute.');
  end if;

  return new;
end;
$$;

drop trigger if exists rl_game_rooms_insert on public.game_rooms;
create trigger rl_game_rooms_insert
  before insert on public.game_rooms
  for each row execute function public.rl_enforce_room_create();


-- ============================================================================================
-- 6 · ENFORCEMENT POINT C · the public Global Index · STRUCTURAL, not counted (014-REV #4)
-- ============================================================================================
-- get_global_neotopia_index() = sum(player_profiles.neotopia_index) is the flagship "consciousness
-- districts built" number on the Landing hero (Landing.jsx:61) and FinalScore. One HTTP request
-- permanently moves the brand metric, there is NO increment ledger, and nothing can ever be unwound
-- or audited. Its only guard today is didRecordRef · a React useRef at FinalScore.jsx:148, reset by
-- an incognito tab.
--
-- NO uid-keyed limit can fix this. Anonymous identities are free (2,478 already exist; 26 minted in
-- one observed minute), and even proof-of-play only turns "1 request per +56" into
-- "mint -> create room -> claim seat -> +56". The fix has to be a CONSTRAINT, because a constraint
-- is not a budget and cannot be reset by minting a new identity.
create table if not exists public.civilization_claims (
  session_id uuid        not null,
  player_id  uuid        not null,
  amount     integer     not null check (amount between 0 and 56),
  claimed_at timestamptz not null default now(),
  primary key (session_id, player_id)
);
-- Same pg_default_acl trap as section 1. Read is public (it is a civilization record); writes go
-- only through the SECURITY DEFINER function below.
revoke all on table public.civilization_claims from anon, authenticated;
alter table public.civilization_claims enable row level security;
drop policy if exists civilization_claims_read_all on public.civilization_claims;
create policy civilization_claims_read_all on public.civilization_claims for select using (true);
grant select on table public.civilization_claims to anon, authenticated, service_role;

comment on table public.civilization_claims is
  'One irrevocable claim per (session, player) against the Global NeoTopia Index (migration 014). '
  'The PRIMARY KEY is the anti-inflation guarantee: +56 max per seat per game, forever, and it '
  'survives anonymous-uid minting in a way no counter can. Deliberately NO foreign keys · a CASCADE '
  'would erase a permanent civilization record when migration 008 purges its game_session.';

-- NEW session-scoped signature · structurally uninflatable. The client should migrate to this
-- (sessionId is already in scope at FinalScore.jsx:168), after which civ_index_user and
-- civ_index_global can be disabled outright.
create or replace function public.increment_neotopia_index(p_session_id uuid, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_seat   integer;
  v_amount integer;
  v_rows   integer := 0;
begin
  if v_uid is null then
    raise exception 'permission denied: increment_neotopia_index requires an authenticated session';
  end if;
  if p_session_id is null then
    raise exception 'session_id is required';
  end if;

  -- AUTHORIZATION · fails CLOSED. A minted identity holds no seat, so it can claim nothing.
  select rp.seat_number into v_seat
    from public.game_sessions gs
    join public.room_players rp on rp.room_id = gs.room_id
   where gs.id = p_session_id and rp.user_id = v_uid
   limit 1;
  if v_seat is null then
    raise exception 'permission denied: no seat held in session %', p_session_id;
  end if;

  v_amount := least(greatest(coalesce(p_amount, 0), 0), 56);

  insert into public.civilization_claims (session_id, player_id, amount)
  values (p_session_id, v_uid, v_amount)
  on conflict (session_id, player_id) do nothing;
  get diagnostics v_rows = row_count;   -- row_count is INTEGER; assigning it to a boolean is 42804

  if v_rows > 0 then
    update public.player_profiles
       set neotopia_index = coalesce(neotopia_index, 0) + v_amount
     where user_id = v_uid;
  end if;

  return jsonb_build_object('applied', v_rows > 0, 'amount', v_amount);
end;
$$;

-- LEGACY signature · KEPT WORKING so the currently-deployed client does not break. Postgres
-- overloading plus PostgREST's named-argument resolution make `{ amount: n }` unambiguous.
-- Return type stays `void` · `create or replace` cannot change a return type (42P13).
--
-- 014-REV: the prior draft added a proof-of-play gate here (caller must hold a room_players row)
-- and made this path FAIL-CLOSED. Both are removed, deliberately:
--   · FinalScore fires this for SOLO games too (the effect keys on mySeat and myDistricts, not on
--     a room), so requiring membership would SILENTLY stop solo play from contributing to the brand
--     counter. That is a PRODUCT decision, not a security fix, and it must not be smuggled into a
--     rate-limit migration.
--   · Proof-of-play does not actually resist minting (mint -> room -> seat costs 3 requests), so it
--     bought a behaviour change without buying the guarantee. The 2-arg signature above buys the
--     guarantee properly.
-- HONEST LIMITATION: per-uid throttling here is mint-evadable. civ_index_global is the only tier in
-- this path that is not, and migrating the client to the 2-arg signature is the real answer.
create or replace function public.increment_neotopia_index(amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- The original was LANGUAGE sql with no null-uid guard · it relied on `where user_id = auth.uid()`
  -- matching zero rows. That is silent, not safe (Rule 59).
  if v_uid is null then
    raise exception 'permission denied: increment_neotopia_index requires an authenticated session';
  end if;

  if not public.rl_gate('civ_index_user', 'u:' || v_uid::text) then
    perform public.rl_reject('Civilization index already recorded · try again later',
                             'This score was already contributed to the global index.');
  end if;
  if not public.rl_gate('civ_index_global', 'all') then
    perform public.rl_reject('The global index is busy · your score will count shortly',
                             'This is temporary and clears within the hour.');
  end if;

  update public.player_profiles
     set neotopia_index = coalesce(neotopia_index, 0) + least(greatest(amount, 0), 56)
   where user_id = v_uid;
end;
$$;


-- ============================================================================================
-- 7 · ENFORCEMENT POINT D · record_civilization_score · restore the missing FK (014-REV #5)
-- ============================================================================================
-- THE WORST PATH IN THE WRITE SURFACE, and the prior draft did not touch it.
-- global_neotopia_index has UNIQUE (session_id, player_id) but NO FOREIGN KEY on session_id ·
-- verified live in pg_constraint (only PK, that UNIQUE, and the range/total CHECKs). The code
-- relies on that UNIQUE for idempotence, but it is defeated completely by sending a FRESH RANDOM
-- UUID per call: every row is "new". So one HTTP request = one permanent row in the PUBLIC
-- civilization ledger, with an attacker-chosen username and total_score up to 2997, and there is no
-- DELETE policy to remove it. getGlobalCivilizationTotal() (src/lib/supabase.js:95) SELECTs the
-- whole table and sums it CLIENT-SIDE, so poisoning it is also an unbounded-egress and browser-OOM
-- vector against every player who reaches FinalScore.
--
-- The rate limit is the LESSER half here and is labelled a backstop. The real fix is the structural
-- gate: the session must EXIST and the caller must have been SEATED in its room. That re-anchors
-- the ledger to a real game and makes the existing UNIQUE a genuine bound again.
--
-- SAFE FOR REAL PLAYERS · verified in the client, not assumed: recordCivilizationDetail returns
-- early unless sessionId is non-null (supabase.js:76) and FinalScore only calls it when
-- sync.sessionId exists AND mySeat != null (FinalScore.jsx:167) · i.e. only from a real, seated
-- multiplayer game, where the room_players row provably exists. Solo never reaches it.
-- Signature and `returns void` preserved exactly; every clamp and the server-derived username are
-- kept verbatim from migration 009.
create or replace function public.record_civilization_score(
  p_session_id uuid,
  p_sacred     integer,
  p_living     integer,
  p_free       integer,
  p_cards      integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_seat integer;
  v_s integer; v_l integer; v_f integer; v_c integer;
begin
  if v_uid is null then
    raise exception 'permission denied: record_civilization_score requires an authenticated session';
  end if;
  if p_session_id is null then
    raise exception 'session_id is required';
  end if;

  -- STRUCTURAL GATE · the foreign key this table never had · fails CLOSED.
  select rp.seat_number into v_seat
    from public.game_sessions gs
    join public.room_players rp on rp.room_id = gs.room_id
   where gs.id = p_session_id and rp.user_id = v_uid
   limit 1;
  if v_seat is null then
    raise exception 'permission denied: no seat held in session % (the civilization ledger only records real games)', p_session_id;
  end if;

  -- Backstop throttle · fail-open.
  if not public.rl_gate('civ_record_user', 'u:' || v_uid::text) then
    perform public.rl_reject('Too many civilization records submitted · try again later',
                             'Each finished game records once.');
  end if;

  -- ══ body preserved verbatim from migration 009 ══════════════════════════════════════════════
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
end;
$$;


-- ============================================================================================
-- 8 · ENFORCEMENT POINT E · purge_e2e_test_data + GRANT REPAIR
-- ============================================================================================
-- purge_e2e_test_data is DESTRUCTIVE (deletes game_rooms and cascades sessions/events/room_players,
-- then deletes player_profiles) and is reachable by EVERY VISITOR of the production site:
-- migrations 007/008 revoked it from `anon` believing that excluded the public (Rule 44), but
-- signInAnonymously() issues role='authenticated' with a real auth.uid(), so both the GRANT and the
-- function's own null-uid guard are satisfied by any browser that loads the page.
--
-- THIS MIGRATION ONLY THROTTLES IT. It does NOT revoke it, because tests/e2e/global-teardown.js
-- authenticates with signInAnonymously() and calls it with the ANON key (verified in that file:
-- "we get access with NO service-role key in CI"). Revoking to service_role would silently break CI
-- teardown, and that is a separate change with its own CI diff. Throttling is the zero-breakage
-- half and it removes the CPU/lock DoS loop (three unindexed LIKE scans plus a cascading
-- multi-table DELETE, currently unbounded).
-- FOLLOW-UP, TRACKED: revoke to service_role and switch global-teardown.js to the service key.
create or replace function public.purge_e2e_test_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rooms_deleted integer := 0;
  unfinished_rooms_deleted integer := 0;
  profiles_deleted integer := 0;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'permission denied: purge_e2e_test_data requires an authenticated session';
  end if;

  if not public.rl_gate('purge_user', 'u:' || v_uid::text) then
    perform public.rl_reject('Too many purge requests', 'Test-data purge is rate limited.');
  end if;
  if not public.rl_gate('purge_global', 'all') then
    perform public.rl_reject('Purge is temporarily rate limited', 'Try again later.');
  end if;

  -- ══ body byte-for-byte identical to the live migration-006/008 definition ═══════════════════
  select count(*) into unfinished_rooms_deleted
  from public.game_rooms r
  where r.status <> 'finished'
    and r.host_id in (
      select user_id from public.player_profiles
      where username like 'E2E%' or username like 'BotAlpha%' or username like 'BotBeta%');

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
    'profiles_deleted', profiles_deleted);
end;
$$;


-- ── GRANTS · Rule 19, and here the correct grant is mostly NO GRANT ─────────────────────────
-- A limiter the attacker can call directly is not a limiter: they could burn a VICTIM's bucket by
-- passing that victim's key (ledger poisoning), or spend a junk action to keep their real one
-- clean. These are called ONLY from inside SECURITY DEFINER functions and a trigger, all of which
-- run as the owner and need no grant of their own. (Postgres checks the trigger's CREATOR at
-- CREATE TRIGGER time, not the writer at fire time.)
revoke all on function public.rl_gate(text, text)          from public, anon, authenticated;
revoke all on function public.rl_reject(text, text)        from public, anon, authenticated;
revoke all on function public.rl_client_ip()               from public, anon, authenticated;
revoke all on function public.rl_enforce_room_create()     from public, anon, authenticated;

-- ⚠️ THE LIVE VULNERABILITY FIX. `create or replace function` PRESERVES the existing ACL, so the
-- hole proven over HTTP in the header survives a body replacement · section 4 did NOT close it.
-- This does. Safe for real players: a live anonymous session carries role="authenticated", NOT
-- "anon", so this removes an UNAUTHENTICATED-caller path only.
revoke all on function public.draw_card_for_seat(uuid, integer, text, integer) from public, anon;
grant execute on function public.draw_card_for_seat(uuid, integer, text, integer) to authenticated;

-- increment_neotopia_index(integer) deliberately KEEPS anon+authenticated: its real boundary is now
-- the null-uid check plus the rate limit inside the body, not the grant. Anonymous sign-ins carry
-- role='authenticated' anyway, so revoking anon would change nothing about who can reach it · it
-- would only create a FALSE sense of a boundary (the exact mistake migrations 007/008 made).
revoke all on function public.increment_neotopia_index(integer) from public;
grant execute on function public.increment_neotopia_index(integer) to anon, authenticated;
revoke all on function public.increment_neotopia_index(uuid, integer) from public, anon;
grant execute on function public.increment_neotopia_index(uuid, integer) to authenticated;
revoke all on function public.record_civilization_score(uuid, integer, integer, integer, integer)
  from public;
grant execute on function public.record_civilization_score(uuid, integer, integer, integer, integer)
  to anon, authenticated;

-- Operator-only diagnostic · the ONE call that settles whether the IP tier can ever be real.
-- It must be invoked THROUGH PostgREST (service_role key, POST /rest/v1/rpc/rl_debug_request_context).
-- Calling it from the SQL editor or MCP returns NULL headers and proves NOTHING, because that
-- connection never traversed PostgREST · that distinction is exactly what made this unanswerable
-- read-only, and it is why the tier ships disarmed.
create or replace function public.rl_debug_request_context()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.rl_is_trusted_caller() then
    raise exception 'permission denied: service_role only';
  end if;
  return jsonb_build_object(
    'headers',          nullif(current_setting('request.headers', true), '')::jsonb,
    'method',           current_setting('request.method', true),
    'path',             current_setting('request.path',   true),
    'resolved_ip',      public.rl_client_ip(),
    'ip_header_config', (select note from public.rate_limit_config where rule = 'ip_header'));
end;
$$;
revoke all on function public.rl_debug_request_context() from public, anon, authenticated;
grant execute on function public.rl_debug_request_context() to service_role;


-- ============================================================================================
-- 9 · VERIFY · run AFTER apply. Two proofs, because neither alone is sufficient
--     (Rule 72: running a verifier once proves it EXECUTES, not that its verdict is SOUND).
--     Each asserts BOTH directions: under the limit MUST pass, over it MUST fail.
-- ============================================================================================
--
-- ── PROOF A · the gate fires, deterministically, with zero residue ──────────────────────────
--   THE TRAP: rl_is_trusted_caller() returns TRUE for session_user='postgres', so running this
--   from the SQL editor bypasses the limiter and reports 40 x true. `set local role authenticated`
--   does NOT help · it changes current_user, not session_user. Migration 013 shipped the
--   rl.force_untrusted GUC precisely so this proof is possible.
--
--   begin;
--     set local rl.force_untrusted = 'on';
--     select count(*) filter (where ok)     as allowed,
--            count(*) filter (where not ok) as denied
--       from (select public.rl_gate('draw_burst', 'proof:verify:014') as ok
--               from generate_series(1, 40)) t;
--     select action, bucket_key, hits, expires_at - window_start as ttl
--       from public.rate_limit_ledger where bucket_key = 'proof:verify:014';
--   rollback;
--   EXPECT: allowed = 20, denied = 20   <- fires exactly at draw_burst.max_hits
--   EXPECT: hits    = 20 (never 40)     <- denials cost ZERO writes
--   EXPECT: ttl     = 00:00:20          <- self-cleaning contract = 2 x window
--   allowed = 40 means you are still a trusted caller · check the GUC.
--
-- ── PROOF B · the real trigger refuses a real insert, end to end, fully rolled back ─────────
--   begin;
--     set local rl.force_untrusted = 'on';
--     do $verify$
--     declare v_host uuid; v_max integer; v_fired boolean := false;
--     begin
--       select max_hits into v_max from public.rate_limit_config where rule = 'room_create_user';
--       select id into v_host from auth.users limit 1;   -- game_rooms.host_id FKs auth.users
--       for i in 1..v_max loop
--         insert into public.game_rooms (room_code, host_id, status, max_players, player_count)
--         values (lpad(to_hex(i), 6, 'Z'), v_host, 'waiting', 4, 1);
--       end loop;
--       raise notice 'OK  · % inserts under the limit all succeeded', v_max;
--       begin
--         insert into public.game_rooms (room_code, host_id, status, max_players, player_count)
--         values ('ZZZZZZ', v_host, 'waiting', 4, 1);
--       exception when others then
--         v_fired := true;
--         raise notice 'OK  · insert #% REJECTED · sqlstate=% (PGRST => HTTP 429 over REST)',
--           v_max + 1, returned_sqlstate;
--       end;
--       if not v_fired then
--         raise exception 'FAIL · insert #% was ALLOWED · room_create_user did NOT fire', v_max + 1;
--       end if;
--     end $verify$;
--   rollback;   -- discards the test rooms AND the ledger increments · zero residue
--   (lpad(to_hex(i),6,'Z') yields ZZZZZ1..ZZZZZ8 · length 6 satisfies the room_code CHECK, and none
--    collides with the ZZZZZZ overflow probe.)
--
-- ── PROOF C · the anon hole on draw_card_for_seat is actually closed ────────────────────────
--   select has_function_privilege('anon',
--     'public.draw_card_for_seat(uuid,integer,text,integer)', 'EXECUTE') as anon_can_draw;
--   EXPECT: false   (it is TRUE before this migration · that is the whole point)
--   And over HTTP, with the anon key and NO user JWT:
--     curl -s -o /dev/null -w '%{http_code}\n' -X POST \
--       "$URL/rest/v1/rpc/draw_card_for_seat" -H "apikey: $ANON" \
--       -H 'Content-Type: application/json' \
--       -d '{"p_session_id":"00000000-0000-0000-0000-000000000000","p_seat":0}'
--   EXPECT: 404 / PGRST202 (no longer in the anon schema cache).
--   BEFORE this migration the same call returns 400 / P0001 · i.e. the body EXECUTED.
--
-- ── PROOF D · nothing else was left reachable ───────────────────────────────────────────────
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_can,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('rl_gate','rl_reject','rl_client_ip','rl_enforce_room_create',
--                        'rl_debug_request_context','check_rate_limit','check_rate_limit_safe',
--                        'rate_limit_peek','rl_is_trusted_caller')
--    order by 1;
--   EXPECT: anon_can = false AND auth_can = false for ALL nine.
--   select tablename, count(*) from pg_policies
--    where tablename in ('rate_limit_ledger','rate_limit_config') group by 1;
--   EXPECT: zero rows (RLS on, no policies = deny all).
--
-- ── PROOF E · settle the IP question (the one thing unanswerable read-only) ─────────────────
--   Call THROUGH PostgREST with the SERVICE ROLE key · not from the SQL editor:
--     curl -s -X POST "$URL/rest/v1/rpc/rl_debug_request_context" \
--       -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
--       -H 'Content-Type: application/json' -d '{}' | python3 -m json.tool
--   Read which of cf-connecting-ip / x-real-ip / x-forwarded-for actually arrived, and how many
--   hops x-forwarded-for carries. ONLY THEN arm the tier:
--     update public.rate_limit_config set note = 'cf-connecting-ip', enabled = true
--      where rule = 'ip_header';
--     update public.rate_limit_config set enabled = true where rule = 'room_create_ip';
--   If headers come back NULL, leave it disabled: per-IP limiting then belongs at the Vercel WAF
--   (vercel.json has no firewall rules today), which is the correct layer for it regardless.
--   Cross-check that it is really live:
--     select bucket_key, hits from public.rate_limit_ledger where action = 'room_create_ip';
--
-- ── PROOF F · is the limiter silently failing open? ─────────────────────────────────────────
--   rl_gate swallows errors by design, so a broken limiter looks exactly like a quiet one.
--     select action, count(*) buckets, sum(hits) hits, max(window_start) newest
--       from public.rate_limit_ledger group by action order by action;
--   EXPECT buckets for 'draw_burst' / 'draw_seat' / 'draw_session' / 'room_create_user' during
--   normal traffic. If games are flowing and 'draw_seat' has NO recent bucket, the limiter is
--   failing open · investigate before trusting any of it.
--
-- ── OPERATIONS ─────────────────────────────────────────────────────────────────────────────
--   select * from public.rate_limit_config order by rule;                        -- every limit
--   select * from public.rate_limit_ledger order by window_start desc limit 50;  -- live counters
--   select * from public.rate_limit_peek('draw_seat', 's:<sid>:<seat>', interval '60 seconds');
--   update public.rate_limit_config set max_hits = 480 where rule = 'room_create_global';
--   update public.rate_limit_config set enabled  = false where rule = 'draw_burst';  -- disarm one
--   update public.rate_limit_config set enabled  = false;                            -- disarm ALL
--   -- ledger health · `prunable` climbing monotonically for an hour = the inline GC is behind
--   select count(*) total, count(*) filter (where expires_at < now()) prunable,
--          pg_size_pretty(pg_total_relation_size('public.rate_limit_ledger')) sz
--     from public.rate_limit_ledger;
--
-- ── ROLLBACK (keep this to hand while applying) ─────────────────────────────────────────────
--   FASTEST, NO-DOWNTIME PARTIAL ROLLBACK · prefer this in an incident:
--     update public.rate_limit_config set enabled = false;          -- every limit off, instantly
--     drop trigger if exists rl_game_rooms_insert on public.game_rooms;
--   FULL ROLLBACK:
--     drop trigger if exists rl_game_rooms_insert on public.game_rooms;
--     -- re-apply the bodies from 011 (draw_card_for_seat), 009 (increment_neotopia_index(integer),
--     -- record_civilization_score) and 006/008 (purge_e2e_test_data) · all reproduced in those files
--     drop function if exists public.increment_neotopia_index(uuid, integer);
--     drop function if exists public.rl_debug_request_context();
--     drop function if exists public.rl_enforce_room_create();
--     drop function if exists public.rl_gate(text, text);
--     drop function if exists public.rl_reject(text, text);
--     drop table if exists public.rate_limit_config;
--     -- KEEP public.civilization_claims · it is a permanent record, not rate-limit state.
--   The ledger + primitive (013) can stay in every case · they are inert without these call sites.
--
-- ============================================================================================
-- 10 · RESIDUAL GAPS · stated plainly, because pretending otherwise is worse
-- ============================================================================================
--  1. UID-KEYED TIERS REMAIN MINT-EVADABLE. Resource-bound keys (session_id, seat) are immune · a
--     fresh uid buys no draws in a game you are not seated in, and that covers 100% of in-game
--     damage. But room creation has no pre-existing row to key on, so tier 1 caps rooms per
--     IDENTITY, not per attacker. room_create_global is the only tier that survives minting and it
--     is shared-fate. The real per-IP answer is the Vercel WAF plus lowering
--     rate_limit_anonymous_users · the DB layer buys time and makes abuse expensive; it was never
--     going to be the whole answer.
--  2. THE ANON-SIGNIN CEILING IS UNVERIFIED AND THE REPO'S ASSUMPTION IS CONTRADICTED.
--     scripts/bot-simulate.js:21 assumes ~30/hr; this database shows 26 mints in ONE MINUTE. The
--     auth config is not in Postgres · read Dashboard -> Authentication -> Rate Limits and check
--     whether any CAPTCHA provider is enabled (none appears anywhere in the repo).
--  3. A CALL THAT RAISES AFTER PASSING THE GATE IS REFUNDED. No autonomous transactions exist
--     (pg_cron/pg_net/dblink all verified ABSENT). BENEFICIAL for room creation (retries refunded),
--     but a seated player looping a draw that always fails is not charged. Section 4's pre-lock
--     exhaustion check removes the expensive part (the row lock); the residual cost is two index
--     lookups per request.
--  4. NOT COVERED HERE · each needs its own fix, and a rate limit is the WRONG tool for all four:
--     · room_players INSERT is the privilege-escalation hinge. room_players_join checks ONLY
--       user_id = auth.uid() · not room status, not capacity · so ONE insert into a stranger's
--       in-progress room grants sessions_update_member (arbitrary overwrite of that game's entire
--       state) and unbounded game_events inserts. Fix is an RLS predicate
--       (AND EXISTS (select 1 from game_rooms r where r.id = room_id and r.status = 'waiting'))
--       plus a capacity assertion. DELIBERATELY NOT THROTTLED: claimSeat legitimately fires up to 5
--       inserts for ONE contended join (useGameRoom.js:56-79), so a limit would hit honest players.
--     · sessions_read / rooms_read_all / room_players_read / events_read are all USING (true), so
--       every game's full state jsonb · including every opponent's hand · is world-readable to any
--       anon-key holder. Information disclosure, not rate limiting.
--     · Realtime is unauthorized: both channels are created without private:true
--       (usePresence.js:93, useGameSync.js:106) and the lobby obeys a `game_start` broadcast after
--       only a payload.roomId check with no sender verification (usePresence.js:109 ->
--       useGameRoom.js:130). Entirely outside Postgres.
--     · purge_e2e_test_data still needs the service_role revoke once global-teardown.js moves to
--       the service key (section 8).
--  5. SEPARATE LAUNCH BLOCKER, CONFIRMED LIVE, ONE WORD: useGameRoom.js:21
--     SEAT_COLORS = ['blue','red','green','purple'] writes player_color='purple' for seat 3, but
--     room_players_player_color_check allows only (blue, gold, green, red) · read from pg_constraint
--     this session. Seat 3 always fails 23514, and claimSeat retries only on 23505
--     (useGameRoom.js:68), so THE 4TH PLAYER CAN NEVER JOIN ANY ROOM. 'purple' -> 'gold'.
--     Not fixed here: it is a client file in another lane and this migration touches no client code.
--  6. NOT APPLIED, NOT PARSED BY A POSTGRES. This session was read-only. Every PREMISE was verified
--     against the live catalog and over HTTP, but the DDL itself has not been executed. Apply to a
--     Supabase BRANCH first if one is available, then run PROOFS A-D before trusting it.
-- ============================================================================================
