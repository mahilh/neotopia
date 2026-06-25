# NeoTopia · Multiplayer Architecture

The realtime multiplayer system for NeoTopia.io. This is the onboarding spec for any
contributor touching auth, rooms, lobby, or live game sync.

Owner lane: **T3** (`src/hooks/useGameRoom.js`, `src/hooks/useGameSync.js`,
`src/hooks/usePresence.js`, `src/pages/Lobby.jsx`). Auth (`useAuth.js`) and the game store
(`gameStore.js`) are **T2**. UI (`GameRoom.jsx`, `App.jsx`, board) is **T1**.

Supabase project: `wynccumuisjxbptjlfwq` (ap-south-1). All claims below are verified live with
two anonymous clients (see "Verification status").

---

## 1. The one rule

**The database is the single source of truth.** The Zustand store
(`src/store/gameStore.js`) is a per-client *mirror* of `game_sessions.state` (jsonb). Every
move is written to the DB; every client re-derives its board from the DB via Postgres change
events. A client never trusts its local state over the server's — `syncFromServer()` lets the
server win on every conflict.

---

## 2. Auth flow (T2 · `src/hooks/useAuth.js`)

```
first visit ─▶ supabase.auth.signInAnonymously() ─▶ anonymous user (role: authenticated, real JWT)
                                                   └▶ claimUsername() upserts player_profiles
return visit ─▶ supabase.auth.getSession() restores the SAME user_id (persisted session)
```

- Anonymous sign-in must be **enabled** in Supabase Auth settings (Dashboard → Authentication →
  Sign In / Providers → Anonymous). There is no MCP/SQL toggle for this. With it off,
  `signInAnonymously()` returns "Anonymous sign-ins are disabled" and the entire feature is dead.
- The anon user's `auth.uid()` is what every RLS policy checks. Identity = membership.
- `useAuth` exports `{ user, username, isLoading, authError, isClaimed, claimUsername }`.

> ✅ **Auth-churn bug — FIXED (T2 S6 · commit `d420342`).** Previously `useAuth` raced
> `getSession()` against localStorage hydration: on reload `getSession()` resolved `null` before
> the persisted session hydrated, so it fell through to `signInAnonymously()` and **minted a new
> user every reload** (and, under React StrictMode's double-mount, two users in one mount —
> independently reproduced in S5: 2 distinct ids). The fix drives auth **entirely off
> `onAuthStateChange`**: `INITIAL_SESSION` fires once *after* hydration, so a persisted session is
> adopted with no `getSession` race, and an anon user is minted only when `INITIAL_SESSION`
> confirms none — exactly once. `supabase.js` also pins `storageKey='neotopia-auth'` +
> `detectSessionInUrl:false`. Verified: reload restores the same `user_id`. Live two-tab **browser**
> confirmation is T1 S5's E2E.

---

## 3. Room lifecycle (T3 · `src/hooks/useGameRoom.js`)

```
idle ─create/join─▶ waiting (lobby) ─host start─▶ playing ─host leave─▶ finished
```

`game_rooms.status` CHECK allows only `('waiting','playing','finished')` — there is **no
'lobby'/'closed'**. Map: `waiting` = lobby, `playing` = in-game, `finished` = closed.
`room_code` is **6 chars** (CHECK `length = 6`) drawn from an unambiguous charset (no I/O/0/1).

| Action | DB writes | Notes |
|---|---|---|
| `createRoom()` | insert `game_rooms` (retry once on 23505 code clash) · upsert `player_profiles` · `claimSeat` seat 0 | becomes host |
| `joinRoom(code)` | look up room by code · `claimSeat` next free seat | rejoin reuses own seat |
| `setReady(bool)` | none (Presence only) | ready state is ephemeral until start |
| `startGame()` | `initGame()` → insert `game_sessions` · update `game_rooms.status='playing'` · broadcast `game_start` | host only |
| `leaveRoom()` | delete own `room_players` row · host sets `status='finished'` | RLS-scoped to self/host |

- **Seats:** `claimSeat` returns the actually-claimed seat (retries to the next free seat on a
  `(room_id, seat_number)` unique collision). `joinRoom` uses the returned value, so
  `room_players.seat_number` and the Presence `seat` always agree.
- **`player_count`** is maintained by a DB trigger (migration 003), **not** by clients — a
  non-host cannot UPDATE `game_rooms` under RLS, and a client increment would race.
- **Edge case:** if a player leaves mid-lobby, seats become non-contiguous (e.g. `[0,2]`).
  `initGame` re-seats by array index (`[0,1]`), so the in-game seat/color can differ from the
  lobby's. The game stays internally consistent (identity is `userId`); only the color/number
  label shifts. Acceptable today; if it matters, have `initGame` honor an explicit seat (T2).

---

## 4. Realtime channels — never mix these three

| Channel | Topic | Carries | Owner |
|---|---|---|---|
| **Presence** | `lobby:<roomId>` | who's connected + `{userId, username, seat, isHost, isReady}` | `usePresence.js` |
| **Broadcast** | `lobby:<roomId>` | the **`game_start` signal only** (no game state) | `usePresence.js` |
| **Postgres changes** | `game-sync:<roomId>` | authoritative `game_sessions.state` (every move) | `useGameSync.js` |

Rules that prevent the classic realtime bugs:
- **Broadcast is signal-only**, max ~1KB (`useGameSync.broadcast` hard-guards this). Never send
  deck/hand/tiles/state over Broadcast — clients pull state from the DB themselves. (Supabase
  Broadcast caps at 32KB; we stay far under for hand privacy + latency.)
- **One canonical Presence payload.** `usePresence` keeps a single `selfRef` and re-`track()`s
  the *whole* object on every change. A partial `track()` replaces the keyed entry and would
  wipe `seat`/`isHost` — that bug is designed out.
- **Always clean up before re-subscribing.** Every `connect()` removes the prior channel first;
  this is what survives React StrictMode's double-mount without leaking a duplicate subscription
  (the "ghost player" / double-event bug).
- The `game_sessions` filter is `room_id=eq.<roomId>` with `event: '*'` — `'*'` so a joiner who
  subscribes *before* the host's INSERT still catches that INSERT and seeds from it.

---

## 5. Move flow (end to end)

```
T1 useGameActions ─▶ store mutation (placeElement/drawCard/tryScoreCard/endTurn)
                  ─▶ useGameSync.pushState(eventType, eventData)
                       ├─ game_sessions UPDATE (state jsonb + scalar mirrors)  ← triggers postgres_changes
                       └─ game_events INSERT (append-only audit; best-effort)
                  ─▶ Supabase fans the UPDATE to every subscribed client
                  ─▶ each client's postgres_changes handler ─▶ syncFromServer(payload.new.state)
                  ─▶ Zustand store updates ─▶ board re-renders
```

- **Optimistic path:** `useGameSync.sendMove(mutate, eventType, eventData)` snapshots the store
  **before** mutating, applies `mutate()` locally, persists, and **rolls back to the snapshot**
  if the write fails. (Single owner of optimistic-update — T2 deliberately did not build a
  second `useOptimisticMove`.)
- **Snapshots are JSON, not `structuredClone`.** The store holds action *functions* (jsonb can't
  hold them; `structuredClone` throws `DataCloneError`) and a `pendingMoves` Set (not
  serializable). `serializableState()` does `JSON.parse(JSON.stringify(store))`;
  `syncFromServer` rehydrates `pendingMoves` as a Set on read. Round-trip is lossless.
- **`game_events.sequence_num` is `GENERATED ALWAYS AS IDENTITY`** — never set it explicitly
  (errors "cannot insert a non-DEFAULT value"). The DB assigns a monotonic value, which also
  gives a correct cross-client replay order. `session_id` is `game_sessions.id` (a uuid FK) —
  **not** `room_id`. `useGameSync` caches the session id on subscribe (`sessionIdRef`).

---

## 6. Reconnect & rejoin (T3 · `useGameSync.js`)

The guarantee: **after any disconnect, the board is correct.** `fetchAndSeed(roomId)` pulls the
current `game_sessions` row and seeds the store — one read recovers *any* number of missed
UPDATEs.

Recovery triggers (Supabase's own WS retry is not reliable on sleep / throttle / tab-suspend):
- `CHANNEL_ERROR` / `TIMED_OUT` / `system` error → debounced full reconnect (fresh channel +
  `fetchAndSeed`).
- `window 'online'` → full reconnect.
- `document visibilitychange → visible` → `fetchAndSeed` reseed (mobile tabs suspend the WS
  silently; mobile is ~65% of play).
- On every fresh `SUBSCRIBED`, `fetchAndSeed` runs **after** subscribe so no UPDATE is missed in
  the subscribe gap.

**Rejoin after refresh** is free with the route-param design (`/game/:roomId`, T1): the URL
survives reload → `GameRoom` reads `roomId` from `useParams` → `useGameSync(roomId)` re-subscribes
and `fetchAndSeed` restores the board. `useAuth` restores the same anon user, so the player's
`room_players` row + seat are intact. (The `useAuth` reload-churn that previously broke this was
fixed in T2 S6 — §2.)

`roomId` must cross the lobby→game boundary **outside** synced state (it's the key you need to
*start* syncing — chicken-and-egg). The route param carries it; `store.roomId` is deliberately
left unset so it never round-trips through `serializableState()` to every client.

---

## 7. Security model (RLS)

RLS is a **separate gate from GRANTs** — a table can have full GRANTs and still deny writes if no
policy matches. All write policies are membership-scoped (`= auth.uid()` or an EXISTS over
`room_players`), mirroring the self-scoped posture.

| Migration | What | Why |
|---|---|---|
| `001_grant_permissions.sql` | GRANT SELECT/INSERT/UPDATE/DELETE to anon+authenticated | raw tables denied without GRANT |
| `002_rls_write_policies.sql` | INSERT/UPDATE policies on `game_sessions` + `game_events` | shipped SELECT-only → Start Game + every move were RLS-denied |
| `003_player_count_trigger.sql` | trigger recounts `room_players` → `game_rooms.player_count` | non-host can't UPDATE game_rooms; client increment races. SECURITY DEFINER + `search_path=''` + schema-qualified |

Policy summary (per command):
- `game_rooms`: SELECT all · INSERT `host_id = auth.uid()` · UPDATE host only.
- `room_players`: SELECT all · INSERT/UPDATE/DELETE own (`user_id = auth.uid()`).
- `game_sessions`: SELECT all · INSERT/UPDATE if you're a `room_players` member of that room.
- `game_events`: SELECT all · INSERT if you're a member of the event's session's room.
- `player_profiles`: ALL own (`user_id = auth.uid()`).

> Future hardening (T2): membership policies let *any* seated member write the session at any
> time — there is no server-side turn-ownership check. A Supabase edge function
> (`api/game-action.js`) that validates `current_seat` before writing is the real authority. The
> RLS policies are the floor, not the ceiling.

---

## 8. Verification status (as of T3 S5)

Proven live with two anonymous clients against the real DB:
- create → join → ready → start → move, every RLS write policy exercised with a real
  `auth.uid()`; presence sync; `game_start` broadcast; `postgres_changes` state delivery.
- Reconnect-recovery: a move missed while the channel was dropped is recovered by `fetchAndSeed`
  on reconnect, then live updates resume.
- `sequence_num` ascending + DB-assigned; `player_count` trigger (0→2 join, 2→1 leave);
  `room_players.seat_number === Presence.seat`.

**Not yet proven in a real browser** (gated on the `useAuth` StrictMode fix + a free Playwright
instance): the full two-tab **UI** E2E and reconnect via DevTools/CDP offline. The data layer
beneath the UI is proven; the UI render/interaction layer is the remaining gap.

---

## File map

| File | Lane | Responsibility |
|---|---|---|
| `src/lib/supabase.js` | T2 | single Supabase client (persistSession, eventsPerSecond cap) |
| `src/hooks/useAuth.js` | T2 | anon sign-in, username claim, session restore |
| `src/store/gameStore.js` | T2 | Zustand+Immer mirror, `initGame`, `syncFromServer`, scoring |
| `src/hooks/useGameRoom.js` | T3 | room create/join/leave/start, seat claim |
| `src/hooks/usePresence.js` | T3 | lobby Presence roster + `game_start` Broadcast |
| `src/hooks/useGameSync.js` | T3 | `game_sessions` sync, optimistic moves, reconnect |
| `src/pages/Lobby.jsx` | T3 | claim → create/join → waiting → start UI |
| `src/pages/GameRoom.jsx` | T1 | board, seeds from `useGameSync`, persists via `pushState` |
| `src/App.jsx` | T1 | routes: `/` Lobby · `/game/:roomId` multiplayer · `/game` solo dev |
| `scripts/migrations/00{1,2,3}_*.sql` | T2/T3 | GRANTs, RLS write policies, player_count trigger |
