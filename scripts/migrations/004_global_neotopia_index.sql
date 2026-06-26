-- NeoTopia · migration 004 · the real Global NeoTopia Index (aggregate of districts built across ALL games).
-- Authored by T2 S7 (2026-06-26). Applied to remote via Supabase MCP. Committed for the repo.
--
-- WHY: FinalScore.jsx (T1) shows a "Global NeoTopia Index" · the count of consciousness districts built
-- across every NeoTopia game. It currently displays a static seed (GLOBAL_INDEX_BASE) + this game only,
-- and left an explicit hook: "T2 wires real aggregation later". The real total = SUM(player_profiles
-- .neotopia_index). BUT player_profiles RLS is `profiles_own` (cmd=ALL · user_id = auth.uid()), so an anon
-- client SELECT returns ONLY its own row · a naive `select sum(neotopia_index)` would return the caller's
-- own index, never a true global (verified live: privileged sees 3 rows, anon sees 1). A SECURITY DEFINER
-- aggregate is the minimal correct enabler · it exposes ONLY the single summed number, never any row data.
--
-- TWO functions:
--   · get_global_neotopia_index()   READ  · sums neotopia_index across all profiles (bypasses own-row RLS
--                                           to aggregate · returns one bigint · leaks no per-player data).
--   · increment_neotopia_index(int) WRITE · adds a game's district count to the CALLER's own profile.
--                                           Scoped to auth.uid() INSIDE the function, so even though
--                                           SECURITY DEFINER bypasses RLS, a caller can only grow their
--                                           OWN row. Contribution is clamped to [0,56] (max cards/game)
--                                           as a sanity bound against a trivially-inflated vanity counter.
--                                           (Full integrity needs server-side game-end detection · out of
--                                           scope · this is a best-effort, client-fired flavor counter.)
--
-- SECURITY: SECURITY DEFINER on both · search_path pinned EMPTY · every object schema-qualified (a
-- definer-rights function with a mutable search_path is a privilege-escalation vector · matches mig 003).
-- Idempotent (create-or-replace) · rollback = drop both functions.

create or replace function public.get_global_neotopia_index()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select coalesce(sum(neotopia_index), 0)::bigint from public.player_profiles
$$;

create or replace function public.increment_neotopia_index(amount integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.player_profiles
  set neotopia_index = coalesce(neotopia_index, 0) + least(greatest(amount, 0), 56)
  where user_id = auth.uid()
$$;

-- Anon-first app · both callable by anon and authenticated. The read leaks only an aggregate ·
-- the write is self-scoped via auth.uid(), so anon cannot touch another player's row.
grant execute on function public.get_global_neotopia_index() to anon, authenticated;
grant execute on function public.increment_neotopia_index(integer) to anon, authenticated;
