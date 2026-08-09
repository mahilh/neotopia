# Why the Global NeoTopia Index has never incremented

**T2 S29 · 2026-08-08 · every number below measured against the live production DB
(`wynccumuisjxbptjlfwq`), not inferred from code.**

The Landing hero and FinalScore both render `GLOBAL_INDEX_BASE (147,823) + sum(player_profiles.neotopia_index)`.
That sum has been **0** for the life of the project. Verified on screen this session: the landing page
reads exactly `147,823`.

## Verdict

**Not a bug in the counter path. The counter has simply never been given anything to count.**

The forge posed three hypotheses. Measured answers:

| Hypothesis | Verdict |
|---|---|
| Failing on a permission closed in migration 017 | ❌ **Ruled out.** 017 is innocent · proof below |
| Called, failing silently | ❌ **Ruled out.** When called, it works · proof below |
| Never called | ✅ **This one.** The guard's precondition has never once been true in production |

### 017 is innocent · the client path works end to end

Last session I proved `increment_neotopia_index` still worked *inside SQL*. That was the weaker
claim, and the forge was right to ask for the client path. Re-proved over real HTTP through
PostgREST as a genuine anonymous user — the exact path `supabase.js:63` takes:

```
signInAnonymously()                                  -> OK
insert player_profiles (useAuth.js:126 columns)      -> OK      ← post-017 grant is sufficient
rpc('increment_neotopia_index', { amount: 7 })       -> OK
select own neotopia_index                            -> 7
rpc('get_global_neotopia_index')                     -> 7       ← the public counter MOVED
```

Fixture deleted afterwards; counter back to 0. EXECUTE grants confirmed intact for both `anon` and
`authenticated` (`increment` and `get_global` are `SECURITY DEFINER` owned by `postgres`, so they
never consult the caller's column grants).

### So why is it never called?

`FinalScore.jsx:148` guards the write:

```js
if (didRecordRef.current || mySeat == null || myDistricts <= 0) return
```

`myDistricts` is this client's `scoredCardIds.length`. So the counter moves only when **a real
player scores at least one card in a game that reaches the scoring phase.** That has never happened:

| Measured across all production sessions | Value |
|---|---|
| Sessions ever recorded | 339 |
| Sessions that reached past turn 2 | 323 (max turn reached: **17**) |
| Sessions with a card in someone's hand | 338 |
| **Sessions where any element was ever placed** | **1** (2 hexes, 2026-06-25) |
| **Cards ever scored, all players, all games** | **0** |
| Bonus tokens ever earned | 0 |
| Finished games (`phase='finished'`) | 11 · all 2026-06-26 · all with 0 scored cards |

Games draw cards and end turns, but essentially nothing is ever *placed*, so no pattern ever
completes, so nothing is ever scored. The three ledger rows in `global_neotopia_index` (June 28)
tell the same story from the other side: they exist, so `record_civilization_score` fires and lands
— but every score in them is `0`.

> ⚠️ One caveat stated honestly: `purge_e2e_test_data` deletes rooms and their cascading sessions,
> so these counts are survivorship-biased toward sessions that escaped teardown. The direction of
> the finding is unaffected (a purge cannot explain `sum(neotopia_index) = 0`, because profiles and
> their counters are not cascaded away), but "1 placement ever" should be read as "1 that survived".

### Why no elements get placed: the bot cannot play, and there are no humans

The only thing generating traffic is `scripts/bot-simulate.js`. Its last prod report (June 28)
records `placedElements: 42` — but that is the bot's own **click proxy**, and the same report has
`dbPlacedCount: null`, i.e. the DB never confirmed a single one.

Running it this session against localhost fataled before reaching the board:

```
[AUTH] BotAlpha1 · lobby unreachable · retry 1/2 in 70s
[AUTH] BotAlpha1 · lobby unreachable · retry 2/2 in 140s
Games completed: 0/1 · Elements placed: 0 · Cards drawn: 0
```

Root cause measured directly, not guessed:

```
signInAnonymously() -> 429 Request rate limit reached
```

The app signs in anonymously on load, so a Supabase anon-signup throttle locks **every** new
client out of the lobby — the bot, and any real player arriving in the same window. `auth.users`
already holds ~2,500 anonymous identities.

## What this means

1. **Nothing needs fixing in the counter itself.** The pipeline is proven working end to end.
2. **The number on the landing page is decorative today**, and will stay at exactly 147,823 until a
   real game is played to a scored card. It is not lying about a failure; it is reporting a true 0
   on top of a seed.
3. **The real blocker is that the game cannot currently be played by automation**, and the anon
   rate limit is a live product risk, not just a test-harness annoyance.

## Open · sequenced for S30 (none of this was in S29's three priorities)

- **`scripts/bot-simulate.js` cannot reach the lobby** (T2 lane). It needs to survive/avoid the 429,
  and its `placedElements` proxy should be replaced with the DB-verified count it already has a slot
  for (`dbPlacedCount`) · a proxy that disagrees with the database is how "42 placed" hid "0 placed"
  for six weeks (Rule 61: verify the value, not the signature).
- **The anon rate limit is a production availability risk.** Worth deciding deliberately: raise the
  Supabase limit, or stop minting a fresh identity per page load.
- **Verify a real scored game lands a real increment.** This session could not: the 429 blocks a
  second browser identity, and the lobby roster is presence-driven, so a DB-seeded second seat is
  invisible to the host and Start stays disabled. Once the anon budget resets, the one-command repro is:
  `BOT_URL=http://localhost:5173 BOT_GAMES=1 node scripts/bot-simulate.js`
  then re-read `select sum(neotopia_index) from player_profiles`.

---

# Addendum · T2 S31 · is there a COMMON cause? (the forge asked; the answer is yes, but not the obvious one)

Three findings now share a family resemblance, and the forge was right to ask whether they are one bug
wearing three coats. Measured, they are **three different mechanisms**:

| # | Finding | Mechanism |
|---|---|---|
| 1 | `neotopia_index` never incremented | The writer **exists and works**. Its precondition (a scored card) had never once been true. |
| 2 | bot `dbPlacedCount: null` for six weeks | The writer ran, but against the **wrong database** · an inherited shell env beat `.env.local`. |
| 3 | `games_played` is 0 for all 36 rows | There is **no writer at all**, and never was. Checked every `pg_proc` def, every trigger, all of `src/`. |

Different causes. But they failed the same way, and *that* is the pattern worth keeping:

> **Nobody ever read the value back.**

Each of these numbers had no consumer, no gate, and no test asserting it moves. And each has a resting
value that is indistinguishable from correct: a new profile *should* read `games_played = 0`, a fresh
civilization index *should* read the seed, and an unavailable DB check *should* report `null`. Zero is
the most plausible-looking wrong answer a counter can give. There is no error, no log line, no red
tick · the failure state and the healthy state render identically, so the only thing that could have
caught any of them is somebody deliberately asking "has this number ever moved?"

That question had never been asked of any of them until it was asked three times in four sessions, and
each time the answer was no.

**The actionable form:** a stored value with no reader is not a feature, it is a claim nobody has
checked. Either give it a consumer that would notice its absence, or do not store it. The three
columns in this family (`games_played`, `games_won`, `elo_rating`) still have **no reader** even after
019 gave `games_played` a writer · that is now the honest open item, not the write path.

**What 019 fixed and what it deliberately did not:**

- ✅ `games_played` increments once per player per finished multiplayer session, server-side, inside
  `record_civilization_score`, conditioned on the ledger insert actually happening (so a re-fire on a
  reload counts nothing). Proven over the real HTTP client path: `0 → 1 → 1 (re-fire) → 2`, and a
  direct `PATCH games_played = 9999` from that same authenticated client was **blocked** by 017.
- ❌ `games_won` is untouched. That RPC is per-caller and cannot see the other seats, so it cannot
  honestly name a winner. Inventing one from a single row would be worse than a truthful 0.
- ❌ No backfill. `room_players` is emptied when a room is deleted, so for the purged sessions there is
  no roster left to count. Counting forward from an honest zero beats a reconstruction nobody can check.
- ⚠️ It counts **multiplayer games finished**, not games started, because `FinalScore` only calls it
  when a live `sessionId` exists. Solo games have no session and are correctly not counted.

---

# Addendum 2 · T2 S32 · the read path, and how `games_won` can be named honestly

## The reader exists now · `getMyProfileStats()` (`src/lib/supabase.js`)

Returns `{ gamesPlayed, gamesWon, elo } | null` for the caller's own profile (RLS is own-row, so it
cannot see anyone else's). **Null means "unknown", not zero** · a consumer must render nothing rather
than a zero, because an absent stat that looks like a real zero is precisely the failure this whole
family of bugs is made of. T1 has the exact render requirement in the comment above the function.

That closes the loop 019 opened: the value now has somebody watching it, which is the only mechanism
that has ever caught one of these.

## `games_won` · why it is still 0, and the design that can change that honestly

`record_civilization_score` is **per caller**. It sees one player's scores and cannot see the other
seats, so it cannot name a winner. That reasoning stands and nothing below weakens it: the fix is not
to make that RPC guess, it is to do the comparison somewhere that can legitimately see the whole table.

**The one place that already sees every seat is the `game_end` audit row.** `FinalScore` writes exactly
one per game (lowest seat present, localStorage-guarded, `buildGameEndEvent` carries every player's
final total including the cluster bonus, so the audit already equals the screen). So:

```
migration 020 · award_game_win(p_session_id uuid)     SECURITY DEFINER, owned by postgres
  1. read the ONE game_end row for p_session_id from game_events
  2. winner = max(total) over its players array
     · a tie awards NOBODY the win (a shared first place is not a win, and picking one by seat
       order would be inventing a result · the same objection as inventing one from a single row)
  3. resolve that seat to a user_id via the audit payload
  4. update player_profiles set games_won = games_won + 1 where user_id = <winner>
  5. idempotent on the same key the ledger already uses · a UNIQUE row per session, so a re-fire
     awards nothing. Do NOT key it on "have I already incremented" · key it on a row that exists.
```

Three properties that make it honest, and each is a constraint, not a nicety:

- **It is not callable usefully by a liar.** The caller passes only a session id; the winner comes
  from the stored audit row, not from the request. A client cannot nominate itself.
- **It must not trust the caller's seat.** Any player in the session may fire it; the result is the
  same regardless of who does, which is what makes a re-fire from a second client safe.
- **It counts multiplayer finishes only**, exactly like `games_played`, because it reads a row that
  only exists when there is a session. Practice games have none and must never count.

**Backfill: none, again.** The 5 ledger rows are all score 0 and the purged sessions have no audit
rows left. Counting forward from an honest zero beats a reconstruction nobody can verify.

**Sequencing:** this is one migration and no client change, the same shape as 019, but it depends on
the `game_end` payload's exact structure, which is T1's `buildGameEndEvent`. Read that file at the
moment of writing the migration rather than trusting this paragraph (Rule 64) · the audit format has
changed twice already this project.

---

# Addendum 3 · can a real player win and not be credited?  (T2 S34)

Migration 020's first live run returned `awarded` while crediting nobody: the winner had never claimed
a username, so there was no `player_profiles` row to increment. I split that case out as
`awarded_no_profile` using `GET DIAGNOSTICS`. A distinct status code is a diagnostic, though, not an
answer · the question underneath it is whether a **real player** can reach game end uncredited.

**Measured answer: no. Not one has, and the path is gated rather than lucky.**

| who took a seat | distinct users | of those, with NO profile row |
|---|---|---|
| non-harness names (Architect, yo, …) | **26** | **0** |
| `E2E*` harness identities | 24 | 24 |
| bot / fixture scripts (BotAlpha…, HostReal) | 14 | 12 |

3,281 auth users exist against 39 profiles, but that ratio is meaningless here · it is the anon
sign-in leak measured in `ANON_SIGNIN_BUDGET.md`, overwhelmingly identities that signed in and did
nothing. What matters is the 64 who actually took a seat, and among those the split is total: every
non-harness player has a profile, every harness identity does not.

## Why, structurally · three chances, and the first is a hard gate

1. `Lobby.jsx:475` · `if (!isClaimed || !username)` renders the claim screen instead of the lobby.
   **The lobby is unreachable without a claimed name.**
2. `useAuth.claimUsername` returns early on any write error (`if (error) return`) and only then sets
   `CLAIMED_KEY`. So `isClaimed` cannot become true on a failed insert · the gate opens only after a
   confirmed row.
3. `useGameRoom` re-upserts the profile in both `createRoom` (:311) and `joinRoom` (:528), with
   `ignoreDuplicates` so it can never overwrite an existing name.

The harness identities are uncredited precisely because they skip step 1 · specs seed seats directly
rather than through the claim screen. That is the harness being a harness, not a product defect.

## The one path that survives, stated plainly

`isClaimed` is read from **localStorage**, while the identity it refers to lives in the anon session.
If a session is rotated or lost while localStorage survives, a **new** `user_id` enters a lobby that
still believes a name was claimed · and that identity has no profile row. Nothing then stands between
it and an uncredited win except the two backstop upserts, which are `await`ed **without checking their
error**. They are called best-effort in their own comment, and they are the only remaining guard.

Nobody has hit this: 26/26. It is narrow, and it is not worth a redesign. It is worth knowing that the
last line of defence is unchecked, because the entire family of bugs this document exists to record is
"a write whose failure looks exactly like its success".

- The cheap fix is one error check on those two upserts. **They live in `useGameRoom.js`, which is
  T3's file** · flagged to them rather than edited here.
- `awarded_no_profile` is therefore a harness-only status today. It should stay in the function: it is
  how we would ever find out if that changed.

**Not yet observable in production at all:** `award_game_win` has no caller. T1 has the one-line call
site (`FinalScore.jsx`, after `pushState` resolves) and until it lands, `games_won` stays 0 for
everyone regardless of any of the above.
