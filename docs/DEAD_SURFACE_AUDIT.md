# DEAD SURFACE AUDIT · every exported symbol with no shipping caller
**T2 S38 · August 9 2026 · HEAD 26e8b55**
**CORRECTED T2 S39 · two of five findings were wrong · see "The correction" below**

> **Run it yourself:** `bash scripts/audit-dead-surface.sh`. S38 did this by hand and got two wrong.

## The correction (T2 S39)

**S38 scanned only `src/ api/ scripts/` and treated everything under `tests/` as noise. That is wrong
in one specific way, and it produced two false findings.** A unit test calling a function proves
nothing about whether the function is wanted · but **an E2E spec that runs in CI is a real consumer**,
and deleting the symbol breaks the merge gate.

| symbol | S38 said | actually |
|---|---|---|
| `factoryRefill` | dead · "coverage aimed at the wrong function" | **TEST-SUPPORT.** Driven by `flow-mode.e2e.js:123`, which runs on the merge gate. That spec's own comment notes `factoryRefill → refillFactoryDraft` is *the same code path* a factory-empty triggers, so testing it does exercise the real logic. **The S38 claim was overstated** · what is true is only that no *product* code calls it. |
| `getFinalScore` | dead | **TEST-SUPPORT.** Consumed by `four-player-live.e2e.js:217` (merge gate) and `multiplayer-endgame-live.e2e.js:137` (nightly). |
| `getLargestCluster` | dead | **Genuinely dead · DELETED in S39.** Nothing referenced it, not even a unit test. |
| `getMyProfileStats` | dead | Driven by one CI spec, but still **never rendered to a user**. The user-facing gap stands. |
| `useBonus` | dead | Still uncalled by product code. Blocked on T1's control, not abandoned. |

**Two symbols S38 missed entirely**, found by the scripted version:
- `getBiomeForRegion` (`src/lib/terrainBiomes.js:52`) · **zero references of any kind**, and its own file
  comment asserts "T1 imports getBiomeForRegion(regionId) in the board layer." That consumer does not
  exist. Likely orphaned when the painted board landed in S38. **T1's call** · not deleted.
- `DIFFICULTY_SELECTABLE` (`botPolicy.js:28`) · **stays, and its unusedness is its meaning.** It is a
  feature flag exported as `false` and pinned by a test. Same family as `BOT_OPPONENTS_READY`.

And the tool bit me the way the S38 method bit me: on its first run it reported `factoryRefill` and
`getFinalScore` as *used*, because **its own header comment names them as examples** and it was grepping
itself. A plausible wrong answer from a probe · Rule 75b. Fixed by excluding the script from its own scan.

## Verdicts, current

| symbol | verdict |
|---|---|
| `useBonus` | KEEP · engine proven, blocked on T1's control |
| `getMyProfileStats` | KEEP · escalate to T1 to render; data has been real since S38 |
| `factoryRefill` | KEEP · test-support API on the merge gate |
| `getFinalScore` | KEEP · consumed by two CI specs |
| `DIFFICULTY_SELECTABLE` | KEEP · a decision pin; unused by design |
| `getBiomeForRegion` | T1's call · comment claims a consumer that does not exist |
| `getLargestCluster` | **DELETED** |


## Why this pass exists

Two consecutive sessions produced the same bug class, and both were found *incidentally* while doing
something else:

- **S35** · `award_game_win` was applied, proven five ways against the live DB, and invoked by nothing.
  `game_wins` held 0 rows against 3 finished games.
- **S37** · `useBonus` implements three of four rulebook effects correctly, and nothing grants a token.
  `bonusTokens` is `[]` in every game ever played.

Two in two is a rate, not a coincidence. **The column that matters is the last one** — why the broken
value looks correct — because that is what let all of these survive in plain sight. A writer that throws
gets fixed the same day. A writer that rests at `0`, `[]`, or "not displayed" survives for months.

## Method, and its limits

Enumerated every `export function` in `src/lib/`, every top-level action in the `gameStore` create
object, and every export of `supabase.js`. For each, counted references across `src/`, `api/` and
`scripts/`, **excluding the definition itself and every test file**.

Grep is a hypothesis (Rule 69), so every zero was then read by hand. That caught one false positive:
`record_civilization_score` is an RPC *string* invoked through `supabase.rpc(...)`, not a JS symbol, so
its zero is meaningless. **It is called and it works** — the live endgame spec watched it return 204
tonight.

Limit worth stating: this finds symbols nothing references. It does **not** find a symbol that is
called on a branch no player reaches. That is a different audit and a harder one.

## FINDINGS · 5 real instances

| symbol | where | resting value today | why that looks correct |
|---|---|---|---|
| `useBonus` | `gameStore.js:450` | `bonusTokens` is `[]`, always | An empty hand is exactly what a player who has earned nothing should see. Both granters read data nothing seeds (S37). |
| `getMyProfileStats` | `supabase.js:107` | never called · `gamesPlayed` / `gamesWon` / `elo` are never rendered | A stat that is not on screen cannot look wrong. The DB has been correct since S35 and no human has seen it. |
| `getFinalScore` | `gameStore.js:606` | correct numbers, read by nobody | It delegates to `calculateFinalScore`, so it agrees with the screen *by construction* — until someone edits one of the two. |
| `getLargestCluster` | `gameStore.js:582` | correct numbers, read by nobody | Thin wrapper over the one BFS (Rule 10). Right answer, no consumer. |
| `factoryRefill` | `gameStore.js` | tiles are consumed anyway, via `refillFactoryDraft` | **The game's clock still advances**, because placement calls the internal helper directly. The public action is redundant, not load-bearing. |

### The two that are worth acting on

**`getMyProfileStats` is the highest-value one, and tonight changed its status.** It was a dormant
orphan while `games_won` was 0 for everybody. The live endgame spec I wired in P4 just recorded
`gamesPlayed 1/1, gamesWon 1/0` for two real players. **The data is now real and nothing displays it.**
That is no longer "a stat nobody shows" — it is a completed feature invisible to the person who earned
it. T1's lane; flagged in S35 and again now, with evidence this time.

**`factoryRefill` is the subtle one, and it is a test-coverage lie.** It is referenced in *four* test
files (`gameStore.test.js` ×3, `flowModeEngine.test.js`, and named in `endGamePhase.test.js`'s header),
which reads as "the refill path is well covered." It is not: **shipping code never calls it.** The path
that actually runs is `refillFactoryDraft`, invoked inside `placeElement`. So the tests exercise a
public wrapper while the real path is covered only incidentally through placement. Nothing is broken —
the clock demonstrably advances, games reach `scoring` in 20-24 turns — but the coverage those four
tests appear to provide is aimed at the wrong function.

### The one that is about my own work

`getFinalScore` has no shipping caller, and **the only non-test reference to it is a comment in
`gameEndEvent.js:14` asserting that the store, the screen and the audit row all use "the SAME engine
fn."** They use the same *underlying* fn (`calculateFinalScore`); they do not go through
`getFinalScore`. `FinalScore.jsx` computes its own total via `recordFor`.

I wrote `clusterOwnership.test.js` in S35 and gated `getFinalScore` in it — a test I was pleased with,
against a function no shipping code calls. It is not worthless (it pins the seat-threading contract for
whoever calls it next) but I presented it as covering the seam and it does not. The seam is
`FinalScore.jsx` + `gameEndEvent.js`, which is why I had to edit `FinalScore.jsx` that session at all.

## Recommendation, in order

1. **Render `getMyProfileStats`** (T1). Real data exists now.
2. **Grant bonus tokens** (T2, this session's P3, unblocked by T1's `31caca2`).
3. **Point `factoryRefill`'s tests at `refillFactoryDraft`,** or delete the public action. Either is
   fine; the current state pays for coverage it does not get.
4. **Leave `getFinalScore` / `getLargestCluster` alone.** Both are correct, cheap, and plausibly
   wanted by the next caller. Deleting correct code to make an audit table shorter is not a win. The
   fix that *is* worth doing is correcting the false claim in `gameEndEvent.js:14`.

## What this audit does not clear

`api/` is empty of exported helpers, and `scripts/` was scanned but is tooling rather than product.
The harder question — a function with callers on a branch no player reaches — is untouched, and S35's
Rule 75a says that is exactly where the expensive bugs live.
