# T2 ROADMAP · engine, backend, balance
**Written T2 S47 · August 11 2026 · for someone with no memory of the sessions behind it**

Everything below is measured unless it says otherwise. Where I got something wrong earlier, the
correction is in the table rather than only in a commit message.

---

## 1 · THE BALANCE PICTURE, IN ONE TABLE

Three sessions of measurement on bonus tokens, reconciled.

| session | what was measured | result |
|---|---|---|
| **S39** | token **unspent** (a flat 3 points) | favours the **weaker** player · −2.4 / −3.0 / −0.8 |
| **S46** | token **spendable**, self-play, one side spends | spender **+7.7** · 7/7 blocks, p≈0.008 |
| **S47** | does **timing** matter | **no** · late-game vs on-sight is exactly **50.0** head-to-head, spend rates 1.15 vs 1.14 |
| **S47** | the **ladder**, both sides spending | apprentice **+1.2**, builder **−6.3**, architect **0.0** · washes out |
| **S47** | **earning** rate | architect **6.3** tokens/game · reference **1.3** · apprentice **0.27** · ~**23×** |

### The sentence that reframes all of it

> **The spending mechanism is fair. The earning mechanism is steeply skewed to whoever is already
> ahead. Two sessions went into measuring the fair half.**

### My correction, stated plainly

**S46 implied a skill amplifier. It is not one.** +7.7 is an advantage over a player who *ignores the
feature*, not a reward for playing well. The proof is the ladder row: when both sides spend, the skill
ordering barely moves and mostly moves *against* the stronger player — the same direction S39 found for
unspent tokens. Both numbers are true; they just answer different questions, and only the ladder one is
about balance.

I also called +7.7 a **floor** ("the dumbest possible use of the decision"). Measured, it is near the
**ceiling** — no timing heuristic beat it, and spending *less* was worse than hoarding.

### Why the earn gap is the interesting number

Tokens are earned by crossing score thresholds at **7 / 13 / 18**, so earning is a function of *scoring
speed* and therefore already favours whoever is winning. At 3 points each unspent, the 23× spread is
worth roughly **15 points of final score to architect against 0.8 to apprentice — before any decision is
taken.**

The win rate **cannot show you this**: architect sits at ~99% and apprentice at ~5–12%, both pinned
against a bound. Any win-rate delta there is structurally incapable of expressing the gap. That is why
everything above is reported and gated on the **earn gap** instead.

---

## 2 · THE ONE QUESTION THAT DECIDES IT — ✅ ANSWERED S48

> **REDUNDANT.** The architect's ~5-token surplus is **a third of its entire winning margin** and it
> changes the outcome of **0 games in 320**, across 4 disjoint blocks, on an *exact* control. Where the
> skew does bite it goes the *other* way: the shipped rule costs the builder ~4 points of win rate.
> **Recommendation: change nothing. Thresholds stay at 7/13/18.** Full table and the mechanism in
> `docs/BONUS_TOKEN_BALANCE.md`; the experiment is `src/store/flatGrantBalance.test.js` and it now runs
> its *reported* block size on every commit rather than a sixth of it.
>
> The question and the pre-commit are kept below exactly as written, because a pre-commit that gets
> edited after the result is not a pre-commit.

**Is the 23× earn gap redundant with skill, or compounding it?**

Architect wins **98.8% with no tokens at all**. So the gap may simply be *another symptom of being
better*, not an extra advantage. **Both readings look identical in the data I have, and they point at
opposite decisions.**

### The experiment (can start cold, reuses `src/store/spendableBalance.test.js`)

Hold play fixed and change **only how tokens arrive**: grant them on a **flat schedule** (e.g. one per
player every N turns) instead of at threshold crossings. Everything else identical — same seeds, same
policies, same deck and tile order. Then compare ladder deltas against tonight's numbers.

### Pre-commit the decision

| outcome | reading | what I would recommend |
|---|---|---|
| **Ladder unchanged** (deltas still ≈ apprentice +1, builder −6, architect 0) | the earn gap is **cosmetic** — it tracks skill without adding to it | **Change nothing.** Thresholds stay at 7/13/18. Close the balance question. |
| **Middle rung moves** (builder's delta shifts materially toward 0 or positive) | the gap is **compounding** — earning is handing the leader a real extra edge | **The thresholds are the lever.** Flatten or widen them; do *not* touch the token's 3 points or its effect, because both measured fair. |

Watch **builder**, not the ends. It is the only rung with headroom to move — apprentice and architect
are both saturated, which is the same trap that hid this for two sessions.

---

## 3 · ENGINE AND BACKEND STATE · what is proven, and how

| thing | state | evidence |
|---|---|---|
| **Cluster ownership** | shipped | greedy-beats-random **46.7% → 64.3%** on the *same 60 games* scored both ways; control 50.0 |
| **`state_version` write predicate** | **live in prod** (migration 022) | stale write refused (0 rows) against real Postgres in `tests/e2e/draw-rpc-audit.mjs` · 16/16 |
| **Draw audit row** | **live in prod** (migration 021) | 12/12 live; refusals write zero rows; the row **survives a clobber**, which is what makes a lost draw provable |
| **Deadlock terminal condition** | shipped | 40 endTurns on the reconstructed board left it hung before the fix. **My retraction:** correct but *not causal* — that board is unreachable by legal play (0 in 160 turn-samples). The audit's real lock was T1's UI gate. |
| **Bot can always pass** | shipped | the latch key could not tell two turns apart on a dead board; `turnNumber` added. Third time this latch has bitten (Rule 107) |
| **Adversarial fuzz** | shipped | policy determines reachable states: maxHand **greedy 6 / drawHeavy 29 / oneRegion 28** — the audit's human reached 26 |
| **`award_game_win`** | wired, ledger moving | **24 rows in `game_wins`** |
| **Card art / deck** | complete | 56/56 PNGs, 56 cards, 0 duplicate names |
| **Migration 014** | 🔴 **NOT APPLIED**, as instructed | verified live: **0 rate-limit policies** in prod (the 3 rate-limit functions are 013's primitive, which is correct) |

### ✅ RESOLVED S48 — and my S47 sentence below was wrong

> **What I wrote in S47:** *"`games_played` and `.games_won` are 0 for all 41 profiles… So the ledger
> moves and the denormalised columns do not."* Kept visible, because the correction is only useful
> next to the claim it replaces.

**The write is not broken. It lands, and then the row holding it is deleted.**

`award_game_win` returns `'awarded'` **only** when `GET DIAGNOSTICS row_count > 0` — a distinction added
precisely because its first version lied about this. A proven live run recorded in
`.github/workflows/e2e-live-nightly.yml` logged `award_game_win 'awarded'`. **So the counter incremented.**
Then `globalTeardown` ran `purge_e2e_test_data`, which deletes every profile matching
`E2E% / BotAlpha% / BotBeta%` with no status and no age filter, and took the row with it.

```
ledger rows 63 · rows whose player has NO profile  63   ← all
game_wins   24 · wins whose winner has NO profile  24   ← all
profiles matching 'E2E%'                            0   ← the purge has taken every one
```

**And for humans the zero is correct.** Only 3 of 63 ledger rows are non-E2E; all three are from
June 28, all score 0, two are named `BotAlpha`/`BotBeta` and the third is literally `Anonymous` — which
is `record_civilization_score`'s own fallback for a caller with no profile. All three **predate
migration 019**, the first writer `games_played` ever had. No human with a claimed username has ever
finished a recorded multiplayer game, so `0` is the truth.

**The real defect is one turn past the family we keep finding.** This path has a writer, a caller, a
reader, and a status string that distinguishes a real credit from a zero-row write — and **no possible
observer**, because our own teardown destroys the only witness between the run and any query. Not a
writer with no caller (`award_game_win`, S35). Not a render with no gate (card art, S42). **A caller
with no observable**, which is worse, because every individual piece is correct and tested.

**✅ APPLIED S49** — `scripts/migrations/023_purge_reports_what_it_destroys.sql`. The purge now reports
the two sums it is about to erase, so the increment shows up in the nightly log without the row
surviving. Grants read back **identical** to before (`authenticated`, `postgres`; `anon` EXECUTE
false), SECURITY DEFINER and empty `search_path` intact. The next nightly that finishes a real game
should print a non-zero `games_won_destroyed`.

**🔴 AND THE SAME FUNCTION HAS TWO MORE PROBLEMS, both measured S49** (`migrations/024`, **written,
NOT applied — needs your yes**):

1. **It deletes rooms that are being played right now.** No status and no age predicate, and
   `game_sessions` cascades from `game_rooms`. This is T3's Rule 109 hazard. Their proposed fix —
   "skip rooms updated in the last N minutes" — **cannot be written as specified: `game_rooms` has no
   `updated_at` column.** 024 uses `created_at` with a 30-minute window, sized from the longest
   measured live spec (~3.0 min), and says plainly that it protects by *creation* time, not last-touch.
2. **It can never reach 571 of the 608 rooms in production.** It selects rooms via
   `host_id IN (profiles LIKE 'E2E%')` and then **deletes those profiles** — it destroys its own
   selector. So it sweeps too *wide* in time and too *narrow* in reach, from one root cause. 024
   deliberately does **not** fix the leak: that means deleting 571 rooms and 557 sessions in one
   statement, which deserves its own approval and its own dry run.

**I tried to fix this at the CI layer tonight and it did not work.** The three workflows that run the
purge had three different concurrency groups (and `e2e.yml` had none), so `e2e.yml` and the placement
guard ran simultaneously on every push and destroyed each other's rooms — that *is* the mechanism
behind a Placement Guard reddening on a docs-only commit. But putting them in one shared group
**cancelled the placement guard on both pushes it saw**: two workflows entering one group on the same
push means one runs and one goes pending, and the next push cancels the pending one. A merge gate that
is cancelled cannot fail, which is worse than the collision. **Reverted, and verified green again.**

The collision is real and **stays open until 024**. It is not fixable at the CI layer. What survives
is narrower and still worth having: `e2e.yml` is now serialised against itself, which it never was.

---

## 4 · OPEN IN MY LANE, RANKED

*(S48: items 1 and 2 are done. Struck through rather than deleted, so a reader who half-remembers the
old list meets the outcome instead of a silent edit.)*

1. ~~**The flat-grant experiment** (§2).~~ **DONE S48.** Answer: the earn skew is **redundant** with
   skill — a third of the architect's margin, and it flips **0 of 320 games**. Thresholds stay at
   7/13/18. See §2 and `docs/BONUS_TOKEN_BALANCE.md`.
2. ~~**`games_played` / `games_won` read 0** (§3).~~ **DIAGNOSED S48**, and my framing of it was wrong —
   the write lands and the teardown deletes the row. Migration 023 written, **awaiting approval**.
3. 🔴 **THE DIFFICULTY LADDER HAS NO USABLE MIDDLE** (new, S49 · `docs/LADDER_CALIBRATION.md`).
   Measured rung-against-rung for the first time — every previous duel in the repo used one common
   opponent, so this had never been asked. **apprentice v builder 6.3% · builder v architect 15.2% ·
   apprentice v architect 0.0% (zero wins in 80 games).** Self-play controls exactly 50.0/0.00, so the
   harness has no side. One step of difficulty is roughly one win in seven; the ends are not a
   contest. **Not recommending a rebalance** — evidence first, and the missing evidence is a human:
   nobody with a claimed username has ever finished a recorded game. Matters only when the ladder is
   exposed in the UI, which is currently a deliberate no.
4. **Bonus tokens are one-quarter shipped.** Only **subsidy** is spendable today.
   - `initiative` — needs T1's placement sub-flow (choose element + hex with no factory constraint)
   - `permits` — needs outer-ring/off-map tracking that does not exist
   - `automatization` — needs **bonus-hex coordinates**, outstanding **14 requests** (see §6)
4. **No hand cap.** The rulebook has none — 263 lines, no limit, no discard step, and nothing in the
   code caps it. 26 cards observed; theoretical max is 56. **Not a bug until Mahil says the physical
   game has a limit.** The render problem is T1's.
5. **Orphan lore terms.** `AetherNet` and `Source Temple` still appear in `ElementIcon.jsx` hover labels
   (and `docs/PLATO_REPUBLIC_INTEGRATION.md`), though `Source Temple` was renamed out of the *deck* in
   S43. Cosmetic, and T1's file — flagging only so it is not rediscovered as a mystery.

---

## 5 · DEBT I OWE MY OWN INSTRUMENTS

**The gates run a sixth of the measurement they name.** `spendableBalance.test.js` runs **12 seeds** per
commit, while every number in §1 comes from **40-seed blocks run twice by hand**. In my own words, that
is *"close to the citation-with-no-runner failure I wrote Rule 97 about"* — it will stay green forever
while the reported table drifts, and the doc looks authoritative.

**The fix, and it is not more CI seeds** (the file already costs 32s): a nightly
`SPEND_SEEDS=40 SPEND_OUT=…` invocation appending to a results file, so the table has a runner rather
than a memory of one.

**Three counterweight failures in three sessions.** S45 (`>` vs `>=` never exercised), S46 (vacuous
scenario), S47 (a rate guard that passed at 0.01 spends/game). The transferable rule, written here
because this is where it will be re-read:

> **A rate guard must be sized against the baseline it is compared to, never against zero.**
> `expect(spends).toBeGreaterThan(0)` certified a comparison between hoarding and hoarding.
> It is now `> 0.25 ×` the on-sight rate.

---

## 6 · BLOCKED ON MAHIL

**1 · Bonus-hex coordinates — 14 requests deep.**
What I need: for each of the three regions, **which hex carries a bonus symbol on the physical board,
and which token it grants.** All 57 coordinates are already enumerated by region and ring in
`docs/BONUS_HEX_DATA_REQUEST.md` — you can mark the list, or send a photo with them circled, or describe
the position in words and I will convert it and read the conversion back before it ships. It is the only
route to `automatization`, and the only remaining input for the whole subsystem. I will not guess them.

**2 · The threshold decision.** Pending my flat-grant experiment (§2). Nothing needed from you yet —
the pre-commit table in §2 exists so you can decide the *rule* now and let the measurement resolve it.

**3 · Whether the physical game caps hand size.** If it does, tell me the number; it is a small change
with a clear test. If it does not, §4.4 closes and the render problem stays with T1.

---

*Saved state at close: HEAD `c9c7593` on origin/main, 840 tests green serial, build clean, all five
workflows green. Migration 014 unapplied and verified so.*
