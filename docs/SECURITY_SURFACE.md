# NeoTopia · Security Surface

> **PROGRESS.** Findings **1** (migration 017 · T2 S28) and **4** (migration 016 · T2 S27) are
> CLOSED, applied live, and proven as the `authenticated` role. Findings **2**, **3** and **5**
> remain OPEN. Finding 2 (`game_sessions.state` directly UPDATE-able) is now the most severe thing
> left on this page.
>
> Both closures corrected the finding they closed. Treat every entry below as a hypothesis and
> re-measure before acting on it, including the ones written here in good faith (Rule 69).
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

## 1 · ✅ CLOSED (T2 S28 · migration 017) · The global index counter is PATCH-able to any value

> **Status: closed 2026-08-08.** `scripts/migrations/017_player_profiles_column_grants.sql` is
> **applied to the live DB** and proven as the `authenticated` role. The finding below is preserved
> as written; the live premise-check made it **worse, not weaker** (see *What was actually true*).

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

### What was actually true (T2 S28 · measured, not reasoned)

Every claim above held. Two things were understated:

1. **It was ONE request, not two.** `INSERT(neotopia_index)` was granted as well, so a brand-new
   anonymous identity could create its profile with the counter already forged · the signup response
   and the forged row are a single POST. The "two requests" framing undersells it.
2. **`elo_rating`, `games_played` and `games_won` were equally writable** and are the same
   forgeable-public-record class. Nothing in the tree writes them at all. They are revoked here too.

The fix departs from the suggested direction in one place, deliberately. The doc proposed adding an
explicit `WITH CHECK` to `profiles_own` to stop a seeded INSERT. A `WITH CHECK` cannot see the OLD
row, so it can constrain an INSERT but can never express "this column may not *change*" on UPDATE ·
the grant layer has to carry that half regardless. Revoking `INSERT(neotopia_index)` closes the seed
path with the same mechanism instead of a second, weaker one. `profiles_own` is left untouched.

**No client regression.** `increment_neotopia_index(integer)` is `SECURITY DEFINER` owned by
`postgres`, so it never consults the caller's column grants · legitimate scoring is unaffected. The
only direct writes in the tree are `useAuth.js:126` `INSERT (user_id, username, avatar_color)`,
`useAuth.js:125` `UPDATE (username)`, and the two `ignoreDuplicates` upserts in `useGameRoom.js`
(`ON CONFLICT DO NOTHING` · INSERT only). All three are exercised in the proof below.

### Live proof · as `authenticated` under forged JWT claims, fixtures rolled back

`postgres` has BYPASSRLS and would prove nothing. Row counts before and after: profiles 26 → 26,
counter 0 → 0.

| # | Step | Before 017 | After 017 |
|---|---|---|---|
| 1 | authenticated PATCHes own `neotopia_index` to 999999 | **ALLOWED** | BLOCKED · permission denied |
| 2 | authenticated PATCHes own `games_won` to 9999 | ALLOWED | BLOCKED · permission denied |
| 3 | fresh user INSERTs a profile with `neotopia_index` 888888 | **ALLOWED** | BLOCKED · permission denied |
| 4 | `anon` (no JWT) UPDATEs any profile | BLOCKED (policy) | BLOCKED · permission denied |
| 5 | legitimate rename (`useAuth.js:125`) | OK | **OK** · username changed |
| 6 | legitimate profile create (`useAuth.js:126`) | OK | **OK** · row created |
| 7 | scoring via `increment_neotopia_index(5)` | OK | **OK** · counter 3 → 8 |
| 8 | `get_global_neotopia_index()` after the run | **1,888,887** | **8** (the legitimate +5 only) |

Row 8 is the finding in one number. `Landing.jsx:65` and `FinalScore.jsx:127` both render
`GLOBAL_INDEX_BASE + ` that sum, so before this migration the public landing hero would have read
**"2,036,710 consciousness districts built"** off a single forged request.

> ⚠️ **Separate, non-security finding surfaced by this work.** The true live value of
> `sum(neotopia_index)` is **0** across all 26 profiles · `recordCivilizationContribution` has
> apparently never landed a write in production. The counter on Landing and FinalScore is therefore
> pure `GLOBAL_INDEX_BASE` seed today. That is a product bug, not a hole, and is **not** fixed here.
> Routed to comms for triage (T2 S29 candidate).

---

## 2 · `game_sessions.state` is directly UPDATE-able, bypassing every draw limit

| | |
|---|---|
| **Table / column** | `public.game_sessions.state` (jsonb · the entire game) |
| **Policy** | `sessions_update_member` · `FOR UPDATE` · `USING (EXISTS (SELECT 1 FROM room_players rp WHERE rp.room_id = game_sessions.room_id AND rp.user_id = auth.uid()))` · **`WITH CHECK` IS NULL** |
| **Grant** | `has_column_privilege('authenticated','game_sessions','state','UPDATE') = TRUE` |
| **Severity** | Critical (game integrity: deck, hands, scores, turn order) |

**Why the RPC limit does not cover it.** `draw_card_for_seat` (chain 011>014>021) exists precisely to
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

### Assessment (T2 S28 · measured, NOT implemented · S29 candidate)

Live measurements taken 2026-08-08, so the eventual fix is sized on data rather than a guess:

| | |
|---|---|
| Rows / total size | 235 rows · 168 kB |
| **Largest `event_data` ever written** | **586 bytes** |
| Existing constraints | `event_type` CHECK (7 values) · `seat_number` CHECK 0–3 · FK to `game_sessions` ON DELETE CASCADE |
| Size constraint | **none** · this is the whole finding |
| Realtime | confirmed in the `supabase_realtime` publication |
| Writer | `useGameSync.js:335` · a direct client `.insert()` · no RPC in front of it |

**The threat model changed when finding 4 closed, and the entry above is now partly stale.** It
says "the only gate is membership, which section 4 shows is self-granted". Since migration 016 an
attacker can no longer insert themselves into a *stranger's* live session, so the sharpest edge —
one attacker amplifying into honest players' bandwidth in a game they gate-crashed — is gone. What
remains is real but narrower, and worth stating precisely rather than inheriting the old severity:

- **Still open · storage exhaustion.** An attacker creates their own room and session (both
  legitimate, both free), then inserts unbounded `event_data` into it. Nothing bounds row size or
  row count. This consumes the project's disk, which is shared with every real player.
- **Still open · realtime quota burn.** Fanout now reaches only their own session's subscribers,
  but the messages still count against the account-level realtime budget.
- **Now closed by 016 · cross-room fanout amplification.** No longer reachable.

**Recommended shape, cheapest-first.** These compose; 1 is worth doing even if 2 never happens.

1. **`CHECK (pg_column_size(event_data) <= 4096)`.** One migration, no code change, no new
   surface. 4 kB is ~7× the largest row the game has ever produced, so it cannot break real play,
   and it converts "unbounded" into "bounded" in a single line. This is the high-value/low-risk half.
2. **Route the append through a `SECURITY DEFINER` RPC that calls `check_rate_limit`** (migration
   013 · already live and proven) and then `revoke insert on game_events from authenticated`, so
   the direct path is closed rather than merely guarded. This is the half that bounds *rate*, which
   a CHECK cannot. It touches `useGameSync.js:335` · **T3's file**, so it is a cross-lane task and
   must be sequenced with them, not dropped on them.

**Do not** bound this with a plain `BEFORE INSERT` trigger. It fires per row, so it cannot see rate,
and a rejected row still costs the round trip · it would read as a fix without being one.

**Not implemented this session** · T2 S28 was scoped to findings 1 and the CI wiring, and step 2
crosses into T3's lane. Sequenced for S29.

---

## 4 · ✅ CLOSED (T2 S27 · migration 015) · A stranger can join a live game

> **Status: fixed and proven live.** Migration 015 is APPLIED to `wynccumuisjxbptjlfwq`, not merely
> committed (Rule 68). The original write-up is preserved below, with two of its four claims
> **corrected** — verifying against the live schema before fixing showed the finding was partly
> already closed and partly worse than described. See "What was actually true" and "Proof" at the
> end of this section.
>
> `room_players_join` now reads:
> `WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM game_rooms r WHERE r.id = room_players.room_id AND r.status = 'waiting' AND r.player_count < r.max_players))`

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

### What was actually true (T2 S27 · checked against the live DB before fixing)

Two of the four missing checks above were **already enforced**, by structure rather than by policy —
the finding read the policy and stopped there:

- **"the room exists"** was never open. `room_players.room_id` is a FK to `game_rooms(id)`; an insert
  naming a non-existent room fails on the constraint, not on RLS.
- **"the room has capacity"** was already closed *at `max_players = 4`*, which is every room in
  production: `CHECK (seat_number BETWEEN 0 AND 3)` + `UNIQUE (room_id, seat_number)` +
  `UNIQUE (room_id, user_id)` cap any room at 4 distinct rows. **A 5th player was never possible.**
  The genuine gap was narrower: `max_players` is `CHECK (2..4)`, so a 2- or 3-seat room accepted 4.

**"the room is in a joinable state" was genuinely open, and it is the whole severity of the finding.**
21 rooms were live in `status = 'playing'` at the time of the fix, every one joinable by any
anonymous session.

The fix also had to close a hole the finding did not mention, which would have made the new INSERT
policy decorative. `room_players_update_own` is `FOR UPDATE USING (user_id = auth.uid())` with a
**NULL `WITH CHECK`**, so Postgres reuses `USING` as the check: the new row only has to still be
*about you*, leaving `room_id` and `seat_number` free to change. A player could join a `waiting` room
legitimately and then PATCH `room_id` across into a live game without ever touching the INSERT
policy. `WITH CHECK` cannot see the OLD row, so this is closed at the grant layer instead —
`REVOKE UPDATE ON room_players`, then `GRANT UPDATE (is_ready, character, username)`. Verified safe
first: nothing in `src/`, `tests/`, `scripts/` or `api/` issues an UPDATE against `room_players`.

Capacity is enforced through `game_rooms.player_count`, not a `count(*)` over `room_players` — a
subquery against `room_players` from inside its own policy raises *"infinite recursion detected in
policy"*. That column is safe to lean on: `trg_player_count` recomputes it as a full `count(*)`
`AFTER INSERT OR DELETE`, runs `SECURITY DEFINER` (RLS never starves it), and showed **zero drift
across all 355 live rooms**. Being `AFTER`, the value the policy reads is the pre-insert count.
It is still a denormalized second contract (Rule 45), which is why the structural seat cap remains
the load-bearing bound and this sits on top.

> ⚠️ **Stale comment, T3 lane.** `src/hooks/useGameRoom.js:191` asserts *"game_rooms.player_count is
> not maintained: a non-host cannot UPDATE game_rooms under RLS, so the column goes stale"*. That is
> false — the trigger is `SECURITY DEFINER` and bypasses RLS entirely. The code around it is correct
> (it counts `room_players` directly); only the comment misleads.

**Accepted, not a regression:** the host may UPDATE their own `game_rooms` row (`rooms_update_host`),
so a malicious host can raise `max_players` or zero `player_count` in a room *they own*. They choose
`max_players` at creation anyway, so capacity is host-discretionary by design, and the seat
CHECK + UNIQUE still cap that room at 4. No cross-room escalation.

**No client regression.** `useGameRoom.joinRoom` already refuses a non-`waiting` room client-side and,
on a rejoin, REUSES the caller's existing `room_players` row rather than inserting a new one — so a
legitimate mid-game reconnect never reaches this policy.

### Proof · executed live as the real `authenticated` role, fixtures rolled back

Run inside `SET LOCAL ROLE authenticated` with a forged `request.jwt.claims`, so RLS applied exactly
as it does to a browser session (`postgres` would have bypassed it). Room totals before and after:
355 / 355, zero fixture rows and zero orphaned seats left behind.

| # | Scenario | Outcome |
|---|---|---|
| 1 | join an OPEN `waiting` room (legitimate player) | **ALLOWED** ← the control: normal play still works |
| 2 | join a room in `status = 'playing'` | BLOCKED · RLS |
| 3 | join a FULL 2-seat room (`player_count = max_players`) | BLOCKED · RLS |
| 4 | PATCH own row's `room_id` → live game | BLOCKED · permission denied |
| 5 | PATCH own `seat_number` | BLOCKED · permission denied |
| 6 | PATCH own `is_ready` (lobby ready toggle) | **ALLOWED** ← the lobby capability that had to survive |
| 7 | 5th player joins a FULL 4-seat `waiting` room (seated 4/4, `player_count` read back as 4) | BLOCKED · RLS |

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
