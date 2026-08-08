-- 015 · room_players join authorization  (T2 S27)
-- Closes SECURITY_SURFACE.md finding 4: "a stranger can join a live game".
--
-- Every claim below was checked against the live DB (wynccumuisjxbptjlfwq) before writing, not
-- read off the finding (Rule 68 · a migration in git proves intent, not state). That check
-- REVISED the finding in two places, and the revisions are why this file is shaped the way it is:
--
--   "no room-exists check"  → ALREADY CLOSED. room_players.room_id is a FK to game_rooms(id).
--                             An insert naming a non-existent room fails on the FK, not on RLS.
--   "no capacity check"     → ALREADY CLOSED **at max_players = 4 only**, structurally:
--                             CHECK (seat_number BETWEEN 0 AND 3) + UNIQUE (room_id, seat_number)
--                             + UNIQUE (room_id, user_id) cap any room at 4 distinct rows. A 5th
--                             player was never possible. But max_players is CHECK (2..4), so a
--                             2- or 3-seat room accepted 4. That gap is real and is closed here.
--   "no joinable-state chk" → GENUINELY OPEN, and the severe one. 21 rooms were live in status
--                             'playing' at the time of writing, every one joinable by any
--                             anonymous session. This is the finding's actual substance.
--
-- Capacity is enforced via game_rooms.player_count, NOT a count(*) over room_players. A subquery
-- against room_players from inside room_players' own policy raises "infinite recursion detected in
-- policy". player_count is safe to lean on here: trg_player_count recomputes it as a full
-- count(*) AFTER INSERT OR DELETE, runs SECURITY DEFINER (so RLS never starves it), and measured
-- zero drift across all 355 live rooms. Because the trigger is AFTER, the value the policy reads
-- is the pre-insert count · exactly the right thing to compare against max_players.
-- It remains a denormalized second contract (Rule 45), which is why the structural seat cap above
-- is left in place as the load-bearing bound and this is the refinement on top.
--
-- Known and accepted: the host may UPDATE their own game_rooms row (rooms_update_host), so a
-- malicious host can raise max_players or zero player_count in a room they own. They also choose
-- max_players in the first place, so room capacity is host-discretionary by design. The seat
-- CHECK + UNIQUE still cap that room at 4. Not a cross-room escalation.

begin;

-- ── 1 · the join gate ────────────────────────────────────────────────────────────────────────
-- Roles are left unspecified (PUBLIC), matching the policy this replaces. anon is not widened by
-- that: anon has no auth.uid(), so `user_id = auth.uid()` is NULL and the row is rejected.
drop policy if exists room_players_join on public.room_players;

create policy room_players_join on public.room_players
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.game_rooms r
      where r.id = room_players.room_id
        and r.status = 'waiting'
        and r.player_count < r.max_players
    )
  );

-- No client regression: useGameRoom.joinRoom already refuses a non-'waiting' room client-side and,
-- on a rejoin, REUSES the caller's existing room_players row rather than inserting a new one. So a
-- legitimate mid-game reconnect never reaches this policy. Client-side guards are UX; this is the
-- boundary (SECURITY_SURFACE.md preamble).

-- ── 2 · close the UPDATE bypass that would have made step 1 decorative ───────────────────────
-- room_players_update_own is `FOR UPDATE USING (user_id = auth.uid())` with a NULL WITH CHECK, so
-- Postgres reuses USING as the check. The new row only has to still be about you — room_id and
-- seat_number are free to change. A player could therefore join a 'waiting' room legitimately and
-- then PATCH room_id across into a live game, never touching the INSERT policy at all.
--
-- WITH CHECK cannot see the OLD row, so this is closed at the grant layer instead: take the
-- identity/placement columns away from the client entirely. Verified safe first · nothing in
-- src/, tests/, scripts/ or api/ issues an UPDATE against room_players at all, so this revokes a
-- capability no code path uses. is_ready / character / username stay writable for the lobby.
revoke update on public.room_players from anon, authenticated;
grant update (is_ready, character, username) on public.room_players to authenticated;

commit;
