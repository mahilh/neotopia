# NeoTopia · Security Surface

> **S27 TOP PRIORITY.** Nothing in the "Direct-write surface" section below was fixed. It is
> documented deliberately and left alone, because the correct fix crosses the T2/T3 lane boundary
> and must not be attempted in a wrap-up window.
>
> Written T2 S26 · 2026-07-29 · every claim verified against the live production database
> (`wynccumuisjxbptjlfwq`), not inferred from migration files. Re-verify before acting: a migration
> in git proves intent, not deployed state (Rule 68).

---

## The one-sentence version

**Rate-limiting the RPCs is largely theatre, because the tables those RPCs protect are directly
writable by any anonymous player through PostgREST.** An attacker never has to call the guarded
function at all. Close the direct-write surface first; rate limits are the second layer, not the
first.

Auth context that makes all of this reachable: the app uses `supabase.auth.signInAnonymously()`
(`src/hooks/useAuth.js:44`). Anonymous identities are free and unlimited · `auth.users` holds
**2,476 rows, 100% anonymous, with an observed peak of 26 minted in a single minute**. A real
anonymous session carries `role="authenticated"` (`is_anonymous=true`), verified by decoding a live
access token. So "authenticated" in every policy below means *anyone who loaded the page*, not
"a trusted user".

---

## 1 · The global index counter is PATCH-able to any value

| | |
|---|---|
| **Table / column** | `public.player_profiles.neotopia_index` (integer) |
| **Policy** | `profiles_own` · `FOR ALL` · `USING (user_id = auth.uid())` · **`WITH CHECK` IS NULL** |
| **Grant** | `has_column_privilege('authenticated','player_profiles','neotopia_index','UPDATE') = TRUE` |
| **Severity** | Critical (integrity of the flagship public metric) |

`get_global_neotopia_index()` is literally
`select coalesce(sum(neotopia_index), 0) from public.player_profiles`. That sum is the
"consciousness districts built" number on the Landing hero and FinalScore.

**Why the RPC limit does not cover it.** `increment_neotopia_index` clamps its argument to `[0,56]`
and (in the staged migration 014) would be rate-limited and gated on proof-of-play. None of that
matters: the column is writable directly.

```
POST /auth/v1/signup                      → anonymous session, free, unlimited
PATCH /rest/v1/player_profiles?user_id=eq.<own uid>
      {"neotopia_index": 2147483647}      → the global counter is now whatever the attacker wants
```

Two requests. The guarded function is never invoked. Note also that because `profiles_own` is
`FOR ALL` with a **NULL `WITH CHECK`**, Postgres reuses the `USING` expression as the check, so the
write passes cleanly.

**Fix direction (S27):** take the column away from the client ·
`revoke update on player_profiles from anon, authenticated;` then
`grant update (username, avatar_color) on player_profiles to authenticated;` · and add an explicit
`WITH CHECK` to `profiles_own` so an INSERT cannot seed a value either.

---

## 2 · `game_sessions.state` is directly UPDATE-able, bypassing every draw limit

| | |
|---|---|
| **Table / column** | `public.game_sessions.state` (jsonb · the entire game) |
| **Policy** | `sessions_update_member` · `FOR UPDATE` · `USING (EXISTS (SELECT 1 FROM room_players rp WHERE rp.room_id = game_sessions.room_id AND rp.user_id = auth.uid()))` · **`WITH CHECK` IS NULL** |
| **Grant** | `has_column_privilege('authenticated','game_sessions','state','UPDATE') = TRUE` |
| **Severity** | Critical (game integrity: deck, hands, scores, turn order) |

**Why the RPC limit does not cover it.** Migration 011's `draw_card_for_seat` exists precisely to
make draws atomic (`FOR UPDATE` + server-side deck mutation), and migration 014 would rate-limit it
in three tiers. But `state` holds the deck, every hand, every region and `current_seat`, and it can
be overwritten wholesale without touching the RPC. An attacker who holds any seat can deal
themselves cards, rewrite scores, or seize the turn in one PATCH.

**⚠️ This one cannot simply be revoked.** The client *already depends on this exact path*:
`src/hooks/useGameSync.js:271` does
`.from('game_sessions').update({ state, current_seat, ... }).eq('room_id', roomId)` · the whole
state jsonb, written from the client's local Zustand store. Revoking the grant without first moving
state writes behind a `SECURITY DEFINER` RPC would break live multiplayer immediately.

**Fix direction (S27) · this is the T2+T3 seam.** Introduce a server-side state-write RPC (the shape
`draw_card_for_seat` already uses), migrate `useGameSync.pushState` onto it, *then* revoke the column
grant. T2 owns the RPC, T3 owns `useGameSync.js`. It cannot be done safely by one lane alone, which
is exactly why it was not attempted in the S26 wrap-up.

---

## 3 · `game_events` accepts unbounded jsonb and fans it out over realtime

| | |
|---|---|
| **Table** | `public.game_events` · `event_data jsonb`, no size constraint |
| **Policy** | `events_insert_member` · `FOR INSERT` · `WITH CHECK (EXISTS (SELECT 1 FROM game_sessions gs JOIN room_players rp ON rp.room_id = gs.room_id WHERE gs.id = game_events.session_id AND rp.user_id = auth.uid()))` |
| **Grant** | `has_table_privilege('authenticated','game_events','INSERT') = TRUE` |
| **Amplifier** | the table is in the `supabase_realtime` publication (verified in `pg_publication_tables`) |
| **Severity** | High (storage exhaustion + realtime fanout DoS) |

**Why the RPC limit does not cover it.** There is no RPC in front of `game_events` at all · the
client inserts directly, so there is no function to rate-limit. Every accepted row is additionally
broadcast to every subscriber of that session, so one attacker's insert loop costs storage *and*
multiplies into bandwidth for every honest player in the room.

The only gate is membership, which section 4 shows is self-granted.

**Fix direction (S27):** route the audit append through a `SECURITY DEFINER` RPC that calls the
rate limiter (migration 013's `check_rate_limit` is already live and proven), or at minimum add a
`CHECK (pg_column_size(event_data) < N)` plus a global circuit-breaker tier. Do **not** put a plain
trigger here · it would not bound the fanout.

---

## 4 · A stranger can join a live game · `room_players` INSERT has no real authorization

| | |
|---|---|
| **Table** | `public.room_players` |
| **Policy** | `room_players_join` · `FOR INSERT` · `WITH CHECK (user_id = auth.uid())` · **and nothing else** |
| **Grant** | `has_table_privilege('authenticated','room_players','INSERT') = TRUE` |
| **Severity** | Critical (it is the load-bearing gate for everything else) |

That policy checks only "you are inserting a row about yourself". It does **not** check that:

- the room exists,
- the room is in a joinable state (`status = 'waiting'`) · **a live `playing` game is joinable**,
- the room has capacity (`player_count < max_players`),
- the seat was assigned by the server.

The only practical barrier is `UNIQUE (room_id, seat_number)`, which merely stops two players
taking the *same* seat. Live scale: 350 `game_rooms`, 334 `game_sessions`.

**Why this is the worst one.** Migration 014's "proof of play" gate · the mechanism intended to make
rate limits resistant to free anonymous identity minting · is `EXISTS (SELECT 1 FROM room_players
WHERE user_id = auth.uid())`. That predicate is **client-assertable in a single INSERT**. So the
anti-minting defence costs an attacker one extra request, which is the same objection that made
per-`auth.uid()` limits useless in the first place.

**Fix direction (S27):**

```sql
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM game_rooms r
               WHERE r.id = room_id
                 AND r.status = 'waiting'
                 AND r.player_count < r.max_players)
)
```

and stop treating a `room_players` row as evidence of anything until it is server-assigned.

---

## 5 · SECURITY DEFINER EXECUTE grants · a class, not an instance

Postgres grants `EXECUTE` **to `PUBLIC` on every new function by default**, and `PUBLIC` includes
`anon`. Writing `GRANT EXECUTE ... TO authenticated` therefore does **not** remove anonymous access;
it only adds a redundant second grant. `CREATE OR REPLACE FUNCTION` *preserves* the existing ACL, so
a later migration replacing the body never repairs it. The tell in `pg_proc.proacl` is a leading
`=X/postgres` · that empty grantee **is** `PUBLIC`.

**Fixed in migration 015 (applied 2026-07-29):** `draw_card_for_seat` claimed
"authenticated only · anon NOT granted" in migration 011's header while the live ACL was
`{=X/postgres,postgres=X/postgres,authenticated=X/postgres}` and
`has_function_privilege('anon', ...) = TRUE`. Now `anon_exec = false`, ACL
`{postgres=X/postgres,authenticated=X/postgres}`. Safe for players because a real anonymous session
carries `role="authenticated"`, so only an *unauthenticated* path was removed.

### Remaining, audited and deliberately unchanged tonight

| Function | `anon_exec` | Verdict |
|---|---|---|
| `get_global_neotopia_index()` | true | **By design.** Read-only aggregate, `anon` granted intentionally (migration 004) so the Landing counter works pre-auth. Leave. |
| `increment_neotopia_index(int)` | **true** | **WRITE, unauthenticated-reachable.** Granted to `anon` *explicitly*, so revoking PUBLIC alone does not close it. Revoking `anon` is safe (real players are `authenticated`) but touches a live client call path in FinalScore · do it deliberately, with a test. |
| `record_civilization_score(...)` | **true** | **WRITE, unauthenticated-reachable.** Same shape and same fix as above. |
| `update_player_count()` | true | Low risk: `RETURNS trigger`, so it is not meaningfully invocable through PostgREST. `proacl` is NULL (pure PUBLIC default). Hygiene revoke only. |
| `purge_e2e_test_data()` | false | `anon` already correctly blocked (migration 007), but `authenticated` retains EXECUTE · and every site visitor is `authenticated`. CI teardown uses it with the anon key (`tests/e2e/global-teardown.js:21`). Move teardown to the service key, then revoke. |

**Standing rule for every future function:** an explicit
`REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;` is mandatory, and the proof is
`has_function_privilege('anon', ..., 'EXECUTE') = false` · not the presence of a `GRANT` statement
in the migration file (Rule 61 · verify the value, not the signature).

---

## 6 · Related, already handled

- **`rate_limit_ledger` containment.** `pg_default_acl` still carries migration 001's blanket
  `GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon, authenticated`, so **any new table in
  `public` is world-writable at the grant layer the instant it is created**. Migration 013's
  `REVOKE` + RLS-with-no-policies on the ledger is load-bearing, not hygiene. Any future table must
  do the same.
- **Migration 013 (rate-limit ledger + primitive)** is applied and proven (limit fires exactly at
  the cap; denials cost zero writes) but is **inert** · wired to nothing. It is correct and safe to
  leave applied.
- **Migration 014 (enforcement)** is written, adversarially reviewed (`APPLY_WITH_FIXES`, 16
  defects) and **not applied**. Do not apply it before the direct-write surface above is closed ·
  its limits protect functions that can be bypassed entirely.

---

## Measurement notes (do not re-derive these wrong)

- `list_tables` reports `rows: 0` for every table. **That is a stale planner estimate, not truth.**
  The live database holds 350 `game_rooms` and 334 `game_sessions`. Never size a limit from it.
- `current_setting('request.headers', true)` returns NULL over the Supabase MCP connection. That is
  **expected** · it is a direct management connection, not the PostgREST path · and is *not*
  evidence that per-IP keying is unavailable. It must be probed from a real browser session before
  any per-IP tier is counted as coverage.
- A complete game takes **118–125 seconds** (measured across three live hosts,
  `game_rooms.created_at` → `game_sessions.updated_at`), i.e. ~25–30 games/hour per player · not the
  10–20 minutes assumed when migration 014's hourly tiers were first sized.
