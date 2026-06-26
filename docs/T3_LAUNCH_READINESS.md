# NeoTopia · Launch Readiness — T3 (Realtime Multiplayer) view

_Authored by T3 · Session 7 · 2026-06-26. Scope: the realtime/multiplayer layer (auth, room
lifecycle, state sync, reconnect, audit log, presence). "Evidence" below means a test or a live
proof T3 can point to — not a claim. Other lanes' work is listed separately and labelled as theirs._

## ✅ Fully verified — T3 owns the evidence

| Capability | Proof |
|---|---|
| **Anon auth persists across reload** (same `user_id`) | `two-human.e2e.js` rejoin test asserts `uid` is identical before/after a hard reload (T3 S7) · Node two-client proof (d420342 · Bug 13). |
| **Move sync** — DB → `postgres_changes` → all clients | `useGameSync` postgres_changes subscription · authoritative `game_sessions` row · verified loop (7802096). |
| **Reconnect** — `window.online` + `visibilitychange` → `fetchAndSeed` | `reconnect.e2e.js` · 2 Playwright tests, CDP offline + WS-blocked, stable 2× (238a88d). |
| **Two-human lobby→board handshake** (presence convergence + `game_start` broadcast) | `two-human.e2e.js` test 1 · two separate browser contexts run create→join→ready→start entirely through the UI · both land on the live board · stable 2× (T3 S7). |
| **game_events audit log actually writes** | `resolveDbEventType` at the persistence boundary · accepts the DB-valid names `useGameActions` emits today AND legacy shorthand · guarded by `useGameSync.eventmap.test.js` · output verified against the **live** CHECK (T3 S7). **Was silently empty before this session** (see Known Issues → resolved). |
| **CI pipeline** | `.github/workflows/e2e.yml` runs `npx playwright test` on push/PR · reconnect + two-human suites. |
| **E2E self-cleanup** (admin-owned rooms) | `cleanup()` hard-deletes via `rooms_delete_host` (migration 005) → FK cascade clears players + session + events. |

## ◻ Verified, but NOT T3's evidence (other lanes own the proof)

- **FinalScore civilization record** — T1 (8/8 browser checks, S6). T3 only drives the overlay in the
  E2E (asserts 2055 / Global Index / CTA render); the scoring math + layout are T1's.
- **Global NeoTopia Index** — T2 migration 004 (SECURITY DEFINER aggregate). T1 is wiring
  `getGlobalIndex()` into FinalScore (in-flight this session).
- **Turn gate / 1-bonus-per-turn / scoring engine** — T2 unit tests.

## ⏳ Remaining for launch

1. **Terminal phase over the wire.** The two-human E2E reveals the record per-tab via the real DEV
   end-game shortcut (deterministic). The natural end (phase `scoring` propagating through
   `game_sessions` to both clients) is proven by the same sync mechanism as every other move, but is
   not yet asserted end-to-end in a single test (playing 56 cards in CI is infeasible). _Honest gap,
   not a silent one._
2. **True cross-machine play** (two physical devices / networks) — not automatable in single-browser
   Playwright. Manual smoke before launch.
3. **CI secrets** — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` must be added as GitHub Actions
   secrets, or the E2E job fails at the Supabase calls (not a code bug). _Mahil action._
4. **`neotopia.io` domain** — Vercel → add domain → DNS. Not a T3 item; noted for the launch checklist.

## 🔭 Observed in-flight this session (cross-lane · uncommitted as T3 wrote this)

- **T1** — Landing page (`src/pages/Landing.jsx`) + entry-flow move (`/` → Landing, `/lobby` → Lobby)
  + `getGlobalIndex()` wiring into FinalScore. _T3's two-human E2E was made resilient to BOTH the
  committed `/`→Lobby contract and this new flow, so it stays green through the transition._
- **T2** — migration 005 `rooms_delete_host` (applied live · T3 wired it into E2E cleanup) +
  `src/lib/gameEndEvent.js`.

## 🛠 Known issues resolved this session

- **game_events was silently empty.** T1 S6 renamed `useGameActions` events to the DB-valid names
  while T3 S6 added a translate-only map keyed on the OLD shorthand. Together, every audit insert
  missed the map and was skipped (no 400 — just nothing written). Fixed by `resolveDbEventType`
  (pass-through for valid names + translate legacy), locked by the eventmap guard. **This unblocks
  replay** (game_events now has data).

## 🌱 Post-launch (not blocking)

- ELO rating (`player_profiles.elo_rating` is seeded but unused).
- Spectator mode · game replay from the `game_events` log (now newly unblocked).
- Bonus-token earn positions from the physical board (data pending · Mahil).
- E2E data hygiene: Test 1 creates browser-owned rooms + `player_profiles` rows that this Node client
  cannot delete (RLS); they are tagged `E2E…` for a periodic service-role purge. A scheduled purge or
  a test-only TTL would close this.
