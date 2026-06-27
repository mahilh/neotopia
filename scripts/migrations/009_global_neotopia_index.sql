-- NeoTopia · migration 009 · Global NeoTopia Index LEDGER (per-game per-player civilization records).
-- Authored by T2 S14 (2026-06-27). Applied to remote via Supabase MCP. Committed for the repo.
--
-- WHY: migration 004 gave an AGGREGATE counter (player_profiles.neotopia_index · summed via a definer RPC).
-- This adds the DETAILED, queryable ledger: one row per player per finished game, with per-region final
-- scores. The first bridge between the game (Stage 2) and the real civilization record (Stage 5).
--
-- DESIGN (premise-checked · Rule 56 · hardened after an automated security review of the first draft):
--   · session_id / player_id are PLAIN uuids · NO foreign keys. A FK CASCADE would DELETE the permanent
--     civilization record the moment its game_session is purged (migration 008 purges rooms routinely) —
--     exactly the data we must keep forever. Denormalized + permanent. session_id is NOT NULL so the
--     UNIQUE (session_id, player_id) dedup can never be bypassed by null-session spam (review finding #1).
--   · WRITES GO ONLY THROUGH record_civilization_score() — a SECURITY DEFINER RPC (the same trust model as
--     increment_neotopia_index). There is deliberately NO direct INSERT policy, so a client can NEVER:
--       - forge another player's row (player_id is set to auth.uid() inside the function · self-scoped),
--       - impersonate via a chosen display name (username is DERIVED from player_profiles · review finding #2),
--       - lie about scores (each component is clamped + total_score is RE-DERIVED server-side · finding #3).
--     Each of the N clients calls it once at game-end (the consumer's localStorage-guarded one-shot · rule 32)
--     → one row per player per game. The wiring (a single recordCivilizationDetail call in FinalScore) is
--     handed to T1 in comms.
--   · CHECK constraints are belt-and-suspenders behind the clamping RPC (bounds + total = sum identity).
--
-- SECURITY: RLS enabled · public SELECT (the index is a public record · leaks only game scores + the
-- self-chosen username, no other PII) · no INSERT policy (definer RPC is the only writer). search_path
-- pinned EMPTY on the function · schema-qualified. Rollback: drop function record_civilization_score; drop
-- table global_neotopia_index.

create table if not exists public.global_neotopia_index (
  id                 bigint generated always as identity primary key,
  session_id         uuid    not null,
  player_id          uuid    not null,
  username           text    not null,
  sacred_city_score  int     not null default 0 check (sacred_city_score  between 0 and 999),
  living_earth_score int     not null default 0 check (living_earth_score between 0 and 999),
  free_energy_score  int     not null default 0 check (free_energy_score  between 0 and 999),
  total_score        int     not null default 0,
  cards_built        int     not null default 0 check (cards_built between 0 and 56),
  recorded_at        timestamptz not null default now(),
  unique (session_id, player_id),
  check (total_score = sacred_city_score + living_earth_score + free_energy_score)
);

alter table public.global_neotopia_index enable row level security;

-- Public civilization ledger · anyone may READ. NO direct INSERT policy by design (see the RPC below).
create policy global_index_read_all on public.global_neotopia_index
  for select using (true);

-- The ONLY writer · SECURITY DEFINER · self-scoped, server-derived username, clamped scores, re-derived total.
create or replace function public.record_civilization_score(
  p_session_id uuid, p_sacred integer, p_living integer, p_free integer, p_cards integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  -- username DERIVED from the caller's own profile · never trusted from the client (anti-impersonation).
  select username into v_name from public.player_profiles where user_id = v_uid;
  v_name := coalesce(v_name, 'Anonymous');
  -- clamp each component to a sane bound · the client cannot inflate the public record.
  v_s := least(greatest(coalesce(p_sacred, 0), 0), 999);
  v_l := least(greatest(coalesce(p_living, 0), 0), 999);
  v_f := least(greatest(coalesce(p_free,   0), 0), 999);
  v_c := least(greatest(coalesce(p_cards,  0), 0), 56);
  -- total is RE-DERIVED here · the client never supplies it.
  insert into public.global_neotopia_index
    (session_id, player_id, username, sacred_city_score, living_earth_score, free_energy_score, total_score, cards_built)
  values (p_session_id, v_uid, v_name, v_s, v_l, v_f, v_s + v_l + v_f, v_c)
  on conflict (session_id, player_id) do nothing;  -- idempotent · a re-fire / rejoin records once
end;
$$;

grant execute on function public.record_civilization_score(uuid, integer, integer, integer, integer)
  to anon, authenticated;
