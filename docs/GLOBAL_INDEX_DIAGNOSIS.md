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
