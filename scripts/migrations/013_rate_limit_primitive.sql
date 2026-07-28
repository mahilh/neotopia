-- NeoTopia · migration 013 · RATE-LIMIT LEDGER + PRIMITIVE  (PHASE 1 of 2)
-- ============================================================================================
-- STATUS: ✅ APPLIED TO PRODUCTION 2026-07-29 (project wynccumuisjxbptjlfwq) and PROVEN LIVE.
--   Applied via supabase apply_migration as `013_rate_limit_primitive`. Unlike a file sitting in
--   this directory, this one IS deployed state, not intent (Rule 68).
--
-- DELIBERATELY INERT. This phase creates the MECHANISM and wires it to NOTHING · no triggers, no
--   changed RPC bodies. That is the point: the limiter could be proven against the live production
--   database with a blast radius of zero, before any hot game path depends on it. Enforcement is
--   migration 014, held until adversarial review clears it.
--
-- THE PROBLEM: NeoTopia had ZERO rate limiting. Not in the DB (no limiter table/counters; pg_cron,
--   pg_net and dblink all verified ABSENT), not at the edge (api/ is empty, vercel.json has no WAF
--   rules), and not meaningfully in the client · busyRef / isDrawing / the localStorage latch are
--   CORRECTNESS latches that live on the attacker's machine and are worthless as controls.
--
-- THE CENTRAL CONSTRAINT · why this is not a normal rate limiter: auth is signInAnonymously()
--   (useAuth.js:44). VERIFIED LIVE: auth.users holds 2,476 rows, 100% anonymous, with an observed
--   peak of 26 identities minted in ONE MINUTE. Every RLS policy and RPC gate keys on auth.uid(),
--   so ANY limit keyed only on auth.uid() is defeated for the price of one extra HTTP request.
--   Migration 014 answers this with resource-bound keys (proof-of-play, per-IP, global) rather
--   than pretending a per-uid counter is a control.
--
-- SHAPE · one ledger table + one primitive, callable from any trigger or RPC:
--     public.check_rate_limit(action, key, limit, window, cost) -> boolean
--   Fixed-window bucket ROWS (cheap, O(1) write, naturally expiring) read through a SLIDING-window
--   estimator:  estimate = prev_hits * (1 - elapsed_fraction) + current_hits
--   Token-bucket-quality smoothing while storing at most TWO rows per active key · which is what
--   lets the ledger self-clean with no scheduler.
--
-- ── LIVE PROOF (run after apply · this is the pass/fail evidence) ────────────────────────────
--   begin;
--     set local rl.force_untrusted = 'on';
--     select i, public.check_rate_limit('proof_draw','proof:key:1',30,interval '60 seconds')
--       from generate_series(1,40) i;
--   commit;
--   OBSERVED: i=1..30 -> true, i=31..40 -> false.            <- the limit fires, exactly at the cap
--   OBSERVED: ledger row hits = 30 (NOT 40)                  <- denials cost ZERO writes
--   OBSERVED: expires_at - window_start = 00:02:00           <- self-cleaning contract = 2 x window
--   OBSERVED: trusted caller (limit 1, called 3x) -> all true <- CI/seeds are never throttled
--   OBSERVED: anon_exec=false AND auth_exec=false for all 5 new functions <- limiter unreachable
--   Cleanup performed: delete from public.rate_limit_ledger where action like 'proof_%';
--
-- ── A DEFECT FOUND WHILE PROVING IT (Rule 63 · write the test that tells the truth) ──────────
--   The original design's proof query said "set local role authenticated" to escape the trusted
--   bypass. That does NOT work: SET ROLE changes current_user but NOT session_user, so the
--   session_user='postgres' branch still short-circuits to trusted and the proof can never show a
--   denial. Hence the rl.force_untrusted GUC below · a transaction-scoped, superuser-only override
--   that exists purely so the limiter is PROVABLE from the SQL editor.
-- ============================================================================================

create table if not exists public.rate_limit_ledger (
  action       text        not null,
  bucket_key   text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  expires_at   timestamptz not null,
  primary key (action, bucket_key, window_start)
);

create index if not exists idx_rate_limit_ledger_expires
  on public.rate_limit_ledger (expires_at);

-- LOAD-BEARING, NOT HYGIENE (Rule 19, inverted · the correct GRANT here is NO GRANT).
-- VERIFIED LIVE in pg_default_acl: migration 001's blanket
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES
--   TO anon, authenticated
-- is STILL in force, so this table was world-writable at the grant layer the instant it was
-- created, and exposed at /rest/v1/rate_limit_ledger. A client that can UPDATE the ledger can zero
-- its own bucket or saturate a victim's · that makes the limiter worse than useless.
revoke all on table public.rate_limit_ledger from anon, authenticated;

-- Defence in depth: RLS on with ZERO policies = deny-all for every non-owner, so the table stays
-- inert even if a future migration re-runs 001's blanket grant. NOT `force row level security` ·
-- the SECURITY DEFINER functions below run as the table OWNER and must bypass RLS.
alter table public.rate_limit_ledger enable row level security;

comment on table public.rate_limit_ledger is
  'NeoTopia rate-limit buckets (migration 013). Deny-all by design: no RLS policies, no grants. '
  'Written ONLY by public.check_rate_limit (SECURITY DEFINER). Self-pruning, no pg_cron.';


-- ── TRUSTED-CALLER BYPASS ────────────────────────────────────────────────────────────────────
-- CI (tests/e2e), seed scripts and the SQL editor must not be throttled.
create or replace function public.rl_is_trusted_caller()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  -- TEST OVERRIDE (transaction-scoped). Without this the limiter is UNPROVABLE from the SQL editor
  -- (see the defect note in the header). Only a superuser/owner session can set this GUC, so it is
  -- not an attacker-reachable bypass.
  if coalesce(current_setting('rl.force_untrusted', true), '') = 'on' then
    return false;
  end if;

  -- NOTE THE TRAP: current_user is USELESS here · inside a SECURITY DEFINER function it is the
  -- function OWNER (postgres) for EVERY caller, so a current_user check would bypass the limiter
  -- for everyone. session_user survives SECURITY DEFINER.
  if session_user in ('postgres', 'supabase_admin') then
    return true;
  end if;

  begin
    v_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  exception when others then
    v_role := null;                    -- malformed/absent claims are simply "not trusted"
  end;
  return v_role = 'service_role';      -- holding the service key is already total compromise
end;
$$;


-- ── BEST-EFFORT CLIENT IP (optional tier · self-disabling) ───────────────────────────────────
-- IP is the ONLY key a uid-minting attacker cannot rotate for free, but it is not reliably visible
-- inside Postgres here: auth.audit_log_entries is empty and inet_client_addr() returns the
-- pooler/PostgREST address, not the player. PostgREST *may* expose forwarded headers as the
-- transaction-local request.headers GUC. Returns NULL when unavailable, and every consuming tier
-- SKIPS rather than fails · degrading to "no IP tier" is safe, guessing an IP is not.
create or replace function public.rl_client_ip()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hdrs jsonb;
  v_ip   text;
begin
  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;
  if v_hdrs is null then
    return null;
  end if;
  -- cf-connecting-ip is single-valued and unspoofable behind the CDN; x-forwarded-for is a list
  -- whose FIRST element is the client. Both absent on a direct connection · exactly when we want
  -- the tier disabled.
  v_ip := coalesce(
            v_hdrs ->> 'cf-connecting-ip',
            split_part(coalesce(v_hdrs ->> 'x-forwarded-for', ''), ',', 1)
          );
  return nullif(btrim(v_ip), '');
end;
$$;


-- ── THE PRIMITIVE ────────────────────────────────────────────────────────────────────────────
-- TRUE = allowed (and p_cost consumed). FALSE = denied.
--
-- FOUR PROPERTIES THAT MAKE THIS SAFE IN A HOT GAME PATH (all four proven live · see header):
--  (a) ATOMIC IN ONE STATEMENT. The consume is a single INSERT ... ON CONFLICT DO UPDATE ... WHERE.
--      Postgres takes the row lock and RE-EVALUATES the WHERE against the live row, so two
--      concurrent callers cannot both slip through at the boundary. No read-then-write race.
--  (b) DENIALS COST ZERO WRITES. When the WHERE fails, DO UPDATE does nothing and RETURNING yields
--      no row · a throttled attacker in a tight loop generates NO ledger churn and NO WAL. It also
--      means a denial never extends its own penalty: the limit is a ceiling, not a tripwire, so an
--      unlucky player is never locked out for longer than one window.
--  (c) NO BOUNDARY DOUBLING. A naive fixed window lets 2x the limit through across a boundary. The
--      prev-bucket weighting closes it (limit 30, prev full, 16.7% in -> budget 5, not 30).
--  (d) SELF-CLEANING WITHOUT A SCHEDULER. A bucket is still needed as the "previous" bucket until
--      window_start + 2*W, which is exactly expires_at. Pruning fires only when a call OPENS a new
--      bucket · deterministic, no random(), naturally proportional to load. Bounded to 200 rows,
--      SKIP LOCKED so it can never block or deadlock against a concurrent limiter call.
--
-- STRICT VARIANT: propagates its own errors. Fail-open vs fail-closed is a CALLER decision.
create or replace function public.check_rate_limit(
  p_action text,
  p_key    text,
  p_limit  integer,
  p_window interval,
  p_cost   integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now           timestamptz := clock_timestamp();
  v_secs          double precision;
  v_epoch         double precision;
  v_win_epoch     double precision;
  v_win_start     timestamptz;
  v_prev_start    timestamptz;
  v_elapsed_frac  double precision;
  v_prev_hits     integer;
  v_cur_hits_pre  integer;
  v_is_new_bucket boolean;
  v_budget        integer;
  v_hits          integer;
  v_action        text := left(coalesce(p_action, ''), 64);
  v_key           text := left(coalesce(p_key, ''), 128);
begin
  if public.rl_is_trusted_caller() then
    return true;
  end if;

  -- A NULL/blank key would collapse every subject into ONE shared bucket and throttle the entire
  -- product. That is a limiter bug, so refuse rather than pretend it is a limit.
  if v_action = '' or v_key = '' then
    raise exception 'check_rate_limit: action and key are required (got action=%, key=%)', p_action, p_key;
  end if;
  if p_limit is null or p_limit < 0 then
    raise exception 'check_rate_limit: limit must be >= 0 (got %)', p_limit;
  end if;
  v_secs := extract(epoch from p_window);
  if v_secs is null or v_secs <= 0 then
    raise exception 'check_rate_limit: window must be a positive interval (got %)', p_window;
  end if;
  if p_cost is null or p_cost < 1 then
    raise exception 'check_rate_limit: cost must be >= 1 (got %)', p_cost;
  end if;
  if p_limit = 0 then
    return false;                                -- explicit kill-switch: limit 0 = closed
  end if;

  -- Epoch-aligned bucketing · pure arithmetic on UTC seconds, correct for any window size and
  -- immune to timezone/DST (date_trunc is not).
  v_epoch      := extract(epoch from v_now);
  v_win_epoch  := floor(v_epoch / v_secs) * v_secs;
  v_win_start  := to_timestamp(v_win_epoch);
  v_prev_start := to_timestamp(v_win_epoch - v_secs);
  v_elapsed_frac := (v_epoch - v_win_epoch) / v_secs;        -- 0.0 .. 1.0

  -- The previous bucket is immutable by now (all new writes land in the current bucket), so this
  -- read is race-free and needs no lock. ONE index range scan covers both buckets.
  select coalesce(sum(l.hits) filter (where l.window_start = v_prev_start), 0),
         max(l.hits)          filter (where l.window_start = v_win_start)
    into v_prev_hits, v_cur_hits_pre
    from public.rate_limit_ledger l
   where l.action = v_action
     and l.bucket_key = v_key
     and l.window_start in (v_prev_start, v_win_start);

  v_is_new_bucket := v_cur_hits_pre is null;

  -- floor() keeps the estimator conservative (never grants a fractional extra request).
  v_budget := floor(p_limit::double precision - (coalesce(v_prev_hits, 0)::double precision
                                                 * (1.0 - v_elapsed_frac)))::integer;

  -- Deny WITHOUT writing. This is also the guard that makes the INSERT branch safe (an INSERT has
  -- no WHERE to protect it).
  if v_budget < p_cost then
    return false;
  end if;

  insert into public.rate_limit_ledger as l (action, bucket_key, window_start, hits, expires_at)
  values (v_action, v_key, v_win_start, p_cost, v_win_start + (p_window * 2))
      on conflict (action, bucket_key, window_start) do update
         set hits = l.hits + p_cost
       where l.hits + p_cost <= v_budget
  returning l.hits into v_hits;

  if v_hits is null then
    return false;                                -- DO UPDATE's WHERE rejected it
  end if;

  if v_is_new_bucket then
    delete from public.rate_limit_ledger d
     where d.ctid in (
             select l2.ctid
               from public.rate_limit_ledger l2
              where l2.expires_at < v_now
              order by l2.expires_at
              limit 200
                for update skip locked
           );
  end if;

  return true;
end;
$$;


-- ── FAIL-OPEN WRAPPER ────────────────────────────────────────────────────────────────────────
-- For callers that must NEVER be bricked by a limiter defect. Caveat stated plainly: the EXCEPTION
-- block opens a subtransaction per call and will also catch 57014 query_canceled from
-- statement_timeout · which is precisely the case we want to fail open on, but it means a genuinely
-- overloaded DB silently stops limiting. Detect that state with the ledger-activity query rather
-- than discovering it in an incident.
create or replace function public.check_rate_limit_safe(
  p_action text,
  p_key    text,
  p_limit  integer,
  p_window interval,
  p_cost   integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.check_rate_limit(p_action, p_key, p_limit, p_window, p_cost);
exception when others then
  return true;   -- a broken limiter must not be a broken game
end;
$$;


-- ── OBSERVABILITY · non-consuming peek ───────────────────────────────────────────────────────
-- Read a bucket's live sliding estimate WITHOUT spending it. This is what makes the limits tunable
-- against real traffic instead of guesswork. Operator tool only (service_role).
create or replace function public.rate_limit_peek(
  p_action text,
  p_key    text,
  p_window interval
)
returns table (
  window_start timestamptz,
  prev_hits    integer,
  cur_hits     integer,
  estimate     numeric,
  elapsed_pct  numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select extract(epoch from clock_timestamp()) as ep,
           extract(epoch from p_window)          as secs
  ), b as (
    select to_timestamp(floor(w.ep / w.secs) * w.secs)          as win_start,
           to_timestamp(floor(w.ep / w.secs) * w.secs - w.secs) as prev_start,
           (w.ep - floor(w.ep / w.secs) * w.secs) / w.secs      as frac
      from w
  )
  select b.win_start,
         coalesce(max(l.hits) filter (where l.window_start = b.prev_start), 0)::integer,
         coalesce(max(l.hits) filter (where l.window_start = b.win_start), 0)::integer,
         round((coalesce(max(l.hits) filter (where l.window_start = b.prev_start), 0) * (1 - b.frac)
                + coalesce(max(l.hits) filter (where l.window_start = b.win_start), 0))::numeric, 2),
         round((b.frac * 100)::numeric, 1)
    from b
    left join public.rate_limit_ledger l
           on l.action = p_action
          and l.bucket_key = p_key
          and l.window_start in (b.prev_start, b.win_start)
   group by b.win_start, b.frac;
$$;


-- ── GRANTS · the correct grant is NO GRANT ───────────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC on every new function by default, and PUBLIC includes anon. A
-- limiter the attacker can call directly is not a limiter: they could burn a VICTIM's bucket by
-- passing that victim's key (ledger poisoning), or spend a junk action to keep their own clean.
-- These are callable ONLY from inside the SECURITY DEFINER functions that will consume them, which
-- run as the owner and need no grant of their own.
-- VERIFIED AFTER APPLY: anon_exec=false and auth_exec=false for all five.
revoke all on function public.check_rate_limit(text, text, integer, interval, integer)      from public, anon, authenticated;
revoke all on function public.check_rate_limit_safe(text, text, integer, interval, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_peek(text, text, interval)                         from public, anon, authenticated;
revoke all on function public.rl_is_trusted_caller()                                        from public, anon, authenticated;
revoke all on function public.rl_client_ip()                                                from public, anon, authenticated;

grant execute on function public.rate_limit_peek(text, text, interval) to service_role;
