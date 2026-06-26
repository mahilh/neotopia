# NeoTopia · Launch Readiness — T3 (Realtime Multiplayer) view

_Authored by T3 · Sessions 7–10 · 2026-06-26. Scope: the realtime/multiplayer layer (auth, room
lifecycle, state sync, reconnect, audit log, presence, end-of-game propagation). "Evidence" below
means a test or a live proof T3 can point to — not a claim. Other lanes' work is labelled as theirs._

**S10 verification:** full E2E suite **5/5 green** in a fresh rate-limit window (25s) · the
`globalTeardown` purged residual profiles end-to-end (`{rooms_deleted:0, profiles_deleted:4}`) — the
proof the S9 rate limit had blocked. Bot v3 + UX scan run against production — see Remaining → Bot.

**S12 verification:** full E2E suite **6/6 green** in a fresh window (32.8s) · `globalTeardown`
purged 6 residual profiles. **CIVILIZATION MILESTONE — first machine-placed elements, DB-confirmed**
(11 elements committed to live `game_sessions` board state). The bot's `totalPlaced=0` is root-caused
to a single automation issue (the valid-hex pulse animation defeats Playwright's click-stability
check) with a one-line fix (`force:true`) — see Resolved below. `game-ux.e2e.js` extended with a
**placement guard** that drives factory→element→region→hex and asserts the element commits
(`hex-element-in` token 0→1) — a permanent CI regression test for the placement-commit class.

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

1. **Bot now plays a full turn loop · ONE automation issue left before `totalPlaced>0` in the committed
   bot** (S12). Progression: baseline `{ready-failed:3, no-tutorial:3, stuck-state:90}` → S10
   `{…, stuck-state:20}` → **S12: room-code read FIXED** (v4.1 compound `[style*="letter-spacing"][style*="monospace"]`
   selector · T2 8a11930) and **turn detection FIXED** (bot detects all turns via `data-my-turn`, T1 S11) —
   `stuck-state` is gone, the bot draws cards and runs the whole turn loop. The lone remaining blocker is
   **the placement hex-click**: the valid-target hex's ring runs an infinite `hexPulse` scale animation
   (`src/index.css`), so the `<g data-valid>` bbox never settles and Playwright's click-stability check
   times out BEFORE `onClick→placeElement` fires. **DB-proven**: committed bot → board empty (0 placed) ·
   the same chain with `click({force:true})` → real elements committed to `game_sessions` (server state
   confirmed, 11 elements). Fix is a one-liner in T2's `scripts/bot-simulate.js` (the step-4 hex click →
   `{force:true}`). A human click is unaffected — this is automation-only, NOT a UI bug. T3 has converted
   the finding into a permanent guard: `game-ux.e2e.js` now force-clicks the chain and asserts the commit.
   _UX scan (T2): scope IN-GAME testids to `/game` — they false-positive on Landing/Lobby (never reaches /game)._
2. **True cross-machine play** (two physical devices / networks) — not automatable in single-browser
   Playwright. Manual smoke before launch.
3. **Natural-end E2E through real play** — `phase-over-wire.e2e.js` drives the terminal phase via an
   authoritative DB write (faithful to what `endTurn`'s `pushState` now does). A full 56-card play-to-end
   in one test is still infeasible in CI · the boundary fix + the propagation proof together cover it.
4. **`neotopia.io` domain** — Vercel → add domain → DNS. _Mahil action · not a T3 item._
5. **Bonus earn data + 56 card images** — _Mahil_ (physical board positions; art generation in progress).

## 🛠 Issues resolved across S7–S12

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
- **Bot `totalPlaced=0` root-caused (S12)** — isolated, not inferred. Instrumented the placement chain
  and proved every UI link fires (factory→element→region→valid-hex-lit), then proved against the live DB
  that the committed bot's hex click commits **nothing** (board empty) while a `force:true` click commits
  **real** elements (11, server-confirmed). Cause: the valid-hex pulse animation (`transform: scale`)
  keeps the `<g>` bbox moving, so Playwright never sees it "stable" and the click times out before
  `placeElement`. One-line fix routed to T2 (`scripts/bot-simulate.js` step-4 → `{force:true}`); guard
  added by T3 (`game-ux.e2e.js`). Rule-49 catch: the bot's `placed` counter is a proxy (counts
  `tryPlaceElement===true`, which is unconditional after the swallowed click error) — the **DB**, not the
  proxy, is the source of truth for "an element was placed."

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
