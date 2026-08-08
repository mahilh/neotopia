-- 017 · player_profiles column grants  (T2 S28)
-- Closes SECURITY_SURFACE.md finding 1: the flagship public counter is client-writable.
--
-- THE SHAPE (identical to the one closed on room_players in 016 · the third instance of it in this DB):
--   profiles_own is  FOR ALL  USING (user_id = auth.uid())  with a NULL WITH CHECK.
--   Postgres reuses USING as the check, so the only thing the new row must satisfy is "still yours".
--   Every other column is free. WITH CHECK cannot see the OLD row, so no policy expression can say
--   "neotopia_index may not change" · this has to close at the grant layer.
--
-- PREMISE-CHECKED LIVE before writing (Rule 68), and the live check made the finding WORSE, not
-- weaker. The finding says "two requests rewrite the counter". Measured against the real DB as the
-- authenticated role under forged JWT claims:
--   · UPDATE own neotopia_index = 999999            → ALLOWED
--   · INSERT a *fresh* profile with 888888 outright → ALLOWED   ← INSERT(neotopia_index) is granted too,
--     so it is ONE request from a brand-new anonymous identity, not two. Anonymous sign-in is free and
--     unlimited, so the cost of publishing an arbitrary number is a single POST.
--   · get_global_neotopia_index() then returned 1888887 (true value at the time: 0).
-- Landing.jsx and FinalScore.jsx both render GLOBAL_INDEX_BASE + that sum, so the landing page would
-- have read "2,036,710 consciousness districts built". Fixtures were deleted and the counter verified
-- back to 0 before this migration was written.
--
-- SAFE TO REVOKE · verified against every write in the tree, not inferred:
--   useAuth.js:126        INSERT (user_id, username, avatar_color)
--   useAuth.js:125        UPDATE (username)
--   useGameRoom.js:258/436 upsert(..., ignoreDuplicates) → ON CONFLICT DO NOTHING · INSERT only
--   supabase.js:63        the counter is written ONLY via increment_neotopia_index(integer), which is
--                         SECURITY DEFINER owned by postgres · it does not consult the caller's column
--                         grants, so this migration cannot break legitimate scoring.
-- Nothing anywhere writes neotopia_index, elo_rating, games_played or games_won directly. Those three
-- stat columns are revoked alongside the counter: they are the same forgeable-public-record class, are
-- read by the same surfaces, and no code path loses a capability it uses.
--
-- anon is revoked outright. It never legitimately writes here: Supabase anonymous sign-in issues a JWT
-- with role=authenticated, so the real client is `authenticated` even for a guest, and a true anon
-- session has no auth.uid() so profiles_own rejects its rows anyway. Belt and braces.

begin;

revoke insert, update on public.player_profiles from anon, authenticated;

-- Exactly what the client legitimately writes, and nothing else. id and created_at keep their defaults
-- (the client never sets them); user_id stays insertable because useAuth supplies it on the initial row,
-- and profiles_own still pins it to auth.uid().
grant insert (user_id, username, avatar_color) on public.player_profiles to authenticated;
grant update (username, avatar_color)          on public.player_profiles to authenticated;

commit;
