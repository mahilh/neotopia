# NeoTopia · Launch Readiness — T3 (Realtime Multiplayer) view

_Authored by T3 · Sessions 7–9 · 2026-06-26. Scope: the realtime/multiplayer layer (auth, room
lifecycle, state sync, reconnect, audit log, presence, end-of-game propagation). "Evidence" below
means a test or a live proof T3 can point to — not a claim. Other lanes' work is labelled as theirs._

## ✅ Fully verified — T3 owns the evidence

| Capability | Proof |
|---|---|
| **Anon auth persists across reload** (same `user_id`) | `two-human.e2e.js` rejoin test asserts `uid` is identical before/after a hard reload (S7) · Node two-client proof (d420342 · Bug 13). |
| **Move sync** — DB → `postgres_changes` → all clients | `useGameSync` postgres_changes subscription · authoritative `game_sessions` row. |
| **Reconnect** — `window.online` + `visibilitychange` → `fetchAndSeed` | `reconnect.e2e.js` · 2 Playwright tests, CDP offline + WS-blocked, stable 2× (238a88d). |
| **Two-human lobby→board handshake** (presence convergence + `game_start` broadcast) | `two-human.e2e.js` test 1 · two separate browser contexts run create→join→ready→start through the UI · both land on the live board · stable 2× (S7). |
| **End-of-game propagates to BOTH tabs** (phase over the wire) | `phase-over-wire.e2e.js` (S8 · 8840885) · ONE authoritative `game_sessions` write → `postgres_changes` → FinalScore on both subscribed tabs incl. the passive one · PASS 2×. |
| **Natural game-end actually persists** (was silently un-syncable) | `sessionPhaseColumn` maps the store terminal `scoring` → the column's CHECK-valid `finished` at the `pushState` boundary · guarded by `useGameSync.phasecolumn.test.js` (S8). See Resolved below. |
| **game_events audit log writes** | `resolveDbEventType` at the persistence boundary · accepts DB-valid names + legacy shorthand · guarded by `useGameSync.eventmap.test.js` · verified vs the live CHECK (S7). |
| **E2E leaves 0 test rooms** | Per-test: admin rooms hard-delete via `rooms_delete_host` (005); browser-owned rooms self-clean via host-session impersonation (`deleteRoomAsHost` · S8). Suite-level: `global-teardown.js` calls the authenticated `purge_e2e_test_data()` RPC (006/007) for residual profiles · no service-role key (S9). |
| **CI pipeline** | `.github/workflows/e2e.yml` runs the suite on push/PR · secrets `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` added by Mahil. |

## ◻ Verified, but NOT T3's evidence (other lanes own the proof)

- **FinalScore civilization record** — T1 (8/8 browser checks). T3 drives the overlay in the E2E
  (asserts 2055 / Global Index / CTA render); the scoring math + layout are T1's.
- **Global NeoTopia Index** — T2 migration 004 (`get_global_neotopia_index` / `increment_neotopia_index`)
  + T1's FinalScore wiring (live).
- **Turn gate / scoring engine / engine fuzz** — T2 unit tests. **Turn timer** — T2 decided the countdown
  is a LOCAL UI concern (not synced store state · `gameConfig.js`), so there is no T3 sync work for it.
- **First-turn Tutorial + onboarding** — T1 S8 (the playtest fix · players had not placed elements).

## ⏳ Remaining for launch

1. **Bot harness selectors** — `scripts/bot-simulate.js` (T2) still targets class-name selectors; needs
   T1 to ship `data-testid` on the Board components first (NOT present yet · T3 S9 gate-skipped the
   bot-selector task and flagged it). Tracks the playtest's "players didn't place elements" finding.
2. **True cross-machine play** (two physical devices / networks) — not automatable in single-browser
   Playwright. Manual smoke before launch.
3. **Natural-end E2E through real play** — `phase-over-wire.e2e.js` drives the terminal phase via an
   authoritative DB write (faithful to what `endTurn`'s `pushState` now does). A full 56-card play-to-end
   in one test is still infeasible in CI · the boundary fix + the propagation proof together cover it.
4. **`neotopia.io` domain** — Vercel → add domain → DNS. _Mahil action · not a T3 item._
5. **Bonus earn data + 56 card images** — _Mahil_ (physical board positions; art generation in progress).

## 🛠 Issues resolved across S7–S9

- **game_events was silently empty** (S7) — two lanes both "fixed" the S5 400; the combination skipped
  every audit insert. `resolveDbEventType` pass-through + translate · guarded · replay unblocked.
- **The natural game-end never synced** (S8 · latent shipped bug) — `game_sessions.phase` has its own
  CHECK (`playing|endgame|finished`); the store's terminal `scoring` is not in it, so at the real end
  `pushState`'s `phase: s.phase` write would 400 the ENTIRE state UPDATE and the game-over state would
  never persist/propagate. Latent only because no game had reached the end (playtest died at turn 17).
  Fixed at the write boundary (`sessionPhaseColumn`); the jsonb still carries the true `scoring`.
- **E2E test-data accrual** (S8–S9) — browser-owned rooms now self-clean (host-session 005 delete);
  residual `player_profiles` (UNIQUE username · no DELETE policy) cleaned by the `purge_e2e_test_data`
  RPC (T2 · 006 + 007-hardened to authenticated) via the Playwright `globalTeardown`. Suite now leaves 0.

## ⚠️ Known environmental note (not a code issue)

Supabase rate-limits **anonymous sign-ins per IP**. Running the E2E suite many times in one hour locally
exhausts the hourly quota → tests fail at `signInAnonymously` ("Request rate limit reached"). `signInAnonRetry`
backs off transient bursts; the `globalTeardown` soft-fails (never fails the suite). CI runs the suite ONCE
(~6 sign-ins) · well under the limit. If a local re-run shows this, wait for the window to reset.

## 🌱 Post-launch (not blocking)

- ELO rating (`player_profiles.elo_rating` seeded but unused).
- Spectator mode · game replay from the `game_events` log (now unblocked · the audit log writes).
- Reserve the `E2E%`/`Bot%` username prefixes at registration (CHECK/trigger) so the purge RPC can never
  match a real profile — the last hardening step for the test-data cleanup (T2).
