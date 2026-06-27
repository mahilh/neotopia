-- NeoTopia · migration 009 · Global NeoTopia Index LEDGER (per-game per-player civilization records).
-- Authored by T2 S14 (2026-06-27). Applied to remote via Supabase MCP. Committed for the repo.
--
-- WHY: migration 004 gave an AGGREGATE counter (player_profiles.neotopia_index · summed via a definer RPC).
-- This adds the DETAILED ledger the forge asked for: one row per player per finished game, with the
-- per-region final scores. The first queryable bridge between the game (Stage 2) and the real civilization
-- record (Stage 5) — "a civilization that leaves no record leaves no legacy".
--
-- DESIGN CORRECTIONS vs the forge's draft (premise-checked · Rule 56):
--   · session_id / player_id are PLAIN uuids · NO foreign keys. The forge used
--     `session_id REFERENCES game_sessions(id) ON DELETE CASCADE` and `player_id REFERENCES auth.users(id)`.
--     A CASCADE would DELETE the permanent civilization record the moment its game_session is purged
--     (migration 008 purges bot/abandoned rooms routinely) — exactly the data we must keep forever. And
--     referencing auth.users from an app table is a Supabase anti-pattern. So: denormalized, permanent, no
--     cascade. The ledger outlives every transient room.
--   · INSERT is SELF-SCOPED via RLS (auth.uid() = player_id), NOT a one-client-writes-everyone loop (which
--     the forge's integration implied · that fails RLS for the other players' rows). Each of the N clients
--     writes its OWN row at game-end → one row per player · no cross-client over-count (same rule-32
--     discipline as recordCivilizationContribution · fire ONCE from the consumer's localStorage-guarded
--     one-shot). The wiring (a single recordCivilizationDetail call in FinalScore) is handed to T1 in comms.
--   · UNIQUE (session_id, player_id) · idempotency guard against a re-render / rejoin double-record.
--
-- SECURITY: RLS enabled. Public SELECT (the index is a public civilization record · leaks only game scores,
-- no PII beyond the self-chosen username). INSERT allowed only for the row's own player (auth.uid()).
-- Rollback: drop table public.global_neotopia_index.

create table if not exists public.global_neotopia_index (
  id                 bigint generated always as identity primary key,
  session_id         uuid,                          -- plain · permanent ledger survives session/room purge
  player_id          uuid    not null,              -- the contributor's auth.uid() (enforced by RLS on insert)
  username           text    not null,
  sacred_city_score  int     not null default 0,
  living_earth_score int     not null default 0,
  free_energy_score  int     not null default 0,
  total_score        int     not null default 0,
  cards_built        int     not null default 0,
  recorded_at        timestamptz not null default now(),
  unique (session_id, player_id)
);

alter table public.global_neotopia_index enable row level security;

-- Public civilization ledger · anyone may read the aggregate history.
create policy global_index_read_all on public.global_neotopia_index
  for select using (true);

-- A client may insert ONLY its own contribution · cannot forge another player's row.
create policy global_index_insert_own on public.global_neotopia_index
  for insert to anon, authenticated
  with check (auth.uid() = player_id);
