# The anonymous sign-in 429 · where the identities actually come from

**T2 S30 · 2026-08-09 · every number below measured against live production
(`wynccumuisjxbptjlfwq`) or a controlled browser run, not inferred from code.**

The S29 diagnosis left this open: `signInAnonymously()` returned `429 Request rate limit reached`,
`auth.users` held ~2,500 anonymous identities, and the working theory was that **the app mints a new
identity per page load**. The forge asked for two things diagnosed separately: the leak, and the
ceiling. Only one of them turned out to exist.

## a · THE LEAK · there isn't one. The app reuses correctly.

Measured, not reasoned. Controlled run against a local dev server pointed at production, counting
`auth.users` rows before and after:

| # | Action | Identity in `localStorage['neotopia-auth']` | New rows in `auth.users` |
|---|---|---|---|
| 1 | load `/` (returning visitor) | `15e42314…` created **2026-06-27** | 0 |
| 2 | load `/` again | `15e42314…` unchanged | 0 |
| 3 | load `/` again | `15e42314…` unchanged | 0 |
| 4 | `localStorage.clear()`, load `/` | **none minted** · landing page does not sign in at all | 0 |
| 5 | load `/lobby` (genuinely fresh visitor) | `5d4adae3…` minted | **+1** |
| 6 | load `/lobby` again | `5d4adae3…` unchanged | 0 |
| 7 | load `/lobby` again | `5d4adae3…` unchanged | 0 |

**Six page loads, one identity, and it was minted only for the visitor who genuinely had none.**
A six-week-old session was resumed on row 1 · that is the returning-player case the forge asked to
see proven. Row 5 is the other half: fixing nothing was required, and first-time entry still works.

Why it is already correct (`useAuth.js:60-85`, `supabase.js:19-30`): the client persists to
`localStorage` under an app-owned `storageKey`, and minting is gated on the `INITIAL_SESSION` event
rather than on a `getSession()` race. That exact bug — reload mints a new user and overwrites the
token — was real once and is documented in the comment at `useAuth.js:63`. It was fixed before this
session. Also worth recording because it contradicts the framing: **`/` never signs in**. Only
`Lobby` and `GameRoom` mount `useAuth`.

### So where did 2,857 identities come from?

| Measure | Value |
|---|---|
| Anonymous identities, all time (45 days) | 2,857 |
| …that never created a `player_profiles` row | 2,822 |
| …that never joined a room **and** never made a profile | **2,787 · 97.6%** |
| …that ever signed in a **second** time | 0 |
| Created in the last 24h (T3's live 4-player session) | 205 |
| Busiest single minute | 14 |

Not 7 identities per player. **97.6% of them signed in and did literally nothing** — no profile, no
room, never seen again. That is the signature of a *test harness*, not a browser: every Playwright
context is a fresh profile with empty storage, every node client in `seedHelpers.js` /
`global-teardown.js` / `two-human` / `reconnect` mints its own, and `four-player-live` spends four
plus one on teardown. A real browser reuses; a fresh process cannot. The 205 minted yesterday
against 4 players in one game is the whole story in one row.

**The identity count is a harness cost, not a product defect.** The remaining exposure is that those
harness clients spend from the same per-IP budget a real player needs.

## b · THE CEILING · real, and it is the actual risk

> ### ✅ RAISED TO 150 · T2 S31 · 2026-08-09
> Mahil read the reasoning below and authorised it. Applied via the Management API (`PATCH
> /v1/projects/…/config/auth` → HTTP 200) and **verified by reading the config back**:
> `rate_limit_anonymous_users = 150`. A fresh anonymous sign-in immediately afterwards
> succeeded, so the change did not disturb first-time entry. The section below is the
> as-measured state that produced the recommendation · kept intact rather than rewritten,
> because the 30 is what the incident evidence was gathered against.

Read live from the Management API (`/v1/projects/…/config/auth`):

```
rate_limit_anonymous_users : 30      ← per hour, per IP
rate_limit_token_refresh   : 150
external_anonymous_users_enabled : true
```

**30 new anonymous sign-ins per hour per IP.** Reuse is free (0 of 2,857 identities ever re-signed —
returning players cost nothing), so this budget is spent only by *first-time* entries from one IP.

Who hits it:

- **Four players on one home wifi**: 4 of 30. Fine.
- **A classroom, café, office or any CNAT/mobile carrier NAT**: everyone shares one IP. The 31st
  first-time visitor that hour is locked out with a message the UI currently reports as a generic
  backend-down. This is the production availability risk.
- **A CI runner**: `four-player-live.e2e.js` alone spends 5. A session of many short local Playwright
  runs drains it invisibly (every invocation spends one on `globalTeardown`). This is what blocked
  S29 and what T3 worked around in S29 by spacing sign-ins 6s apart.

### Recommendation · NOT applied, this is a config change and it is Mahil's call

**Raise `rate_limit_anonymous_users` from 30 to 150/hour per IP** (the tier Supabase already uses for
`rate_limit_token_refresh`, so it is not an unusual number for this project).

Why 150 and not higher, and why this is low-risk:

- It is **per IP**, so it does not widen a mass-abuse surface meaningfully — a distributed attacker
  was never constrained by it in the first place, only shared-NAT legitimate players were.
- What an anonymous identity can actually *do* is already bounded independently: `player_profiles` is
  own-row RLS with column-level grants (migration 017), joining a room is authorization-gated
  (migration 016), and `game_events` payloads are bounded (migration 018). The rate limit is not
  load-bearing for any of those.
- The cost of an unused identity is a row. 2,857 rows over 45 days is nothing.
- 150 covers a 30-seat classroom arriving at once with headroom, and covers the whole nightly E2E
  suite from one runner.

Cheaper alternatives, and why they are worse: throttling client-side does not help (the limit is
per IP across all clients); pooling harness identities helps CI only and is `tests/e2e/` (T3's lane);
turning off anonymous auth entirely means a signup wall, which is the thing the product deliberately
does not have.

If the limit is raised, the honest follow-up is UI: a 429 currently surfaces as `OFFLINE` via
`reportBackendDown`, which tells a locked-out player the game is broken rather than "too many new
players from your network right now, try again shortly". That is `Lobby.jsx` copy · T1's lane.
