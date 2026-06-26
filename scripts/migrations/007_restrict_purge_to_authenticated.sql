-- NeoTopia · migration 007 · security hardening of purge_e2e_test_data() (migration 006).
-- Authored by T2 S9 (2026-06-26) in response to an automated push-time security review.
--
-- FINDING (HIGH · correct): migration 006 granted EXECUTE on a DESTRUCTIVE function to `anon`. That is an
-- Unauthenticated Destructive Action — any caller holding only the public anon key (no sign-in) could
-- invoke the delete. The username-prefix scope (E2E% / BotAlpha% / BotBeta%) bounds the blast radius to
-- test data, BUT those prefixes are NOT reserved at registration, so a real user could hold one · and an
-- unauthenticated destructive RPC is a category we should not expose on the public API at all.
--
-- FIX: require an AUTHENTICATED session. Supabase anonymous sign-in (signInAnonymously) still yields the
-- `authenticated` Postgres role (only a request with NO user JWT is `anon`), so the E2E/CI globalTeardown
-- — which already signs in anonymously — keeps access with NO service-role key (T3's requirement holds).
-- We also revoke the Postgres DEFAULT `EXECUTE TO PUBLIC` on functions, which otherwise silently re-grants
-- anon even after `revoke ... from anon`. Net: only an authenticated principal may run the purge.
--
-- Residual (documented, accepted): any authenticated user (incl. an anonymous one) can still call it, but
-- it only ever deletes test-prefixed data · a future hard guarantee would reserve those prefixes at
-- registration (CHECK/trigger) so no real profile can match. Rollback: re-grant to anon (NOT recommended).

revoke execute on function public.purge_e2e_test_data() from public, anon;
grant  execute on function public.purge_e2e_test_data() to authenticated;
