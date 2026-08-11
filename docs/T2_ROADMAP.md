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

## 2 · THE ONE QUESTION THAT DECIDES IT

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

### 🔴 One thing I found tonight that contradicts what we believed

**`player_profiles.games_played` and `.games_won` are `0` for all 41 profiles** — against **63**
civilization scores recorded and **24** `game_wins` ledger rows.

So the **ledger moves and the denormalised columns do not.** I did not debug it (this was a save-and-plan
session) but the lead is one line: `games_played` is referenced by exactly one function,
`record_civilization_score`, and there is **no trigger on `game_wins`**. This is the same
absence-looks-like-a-value shape as `award_game_win` sitting at 0 rows for two sessions. **It is the
first thing I would look at after the flat-grant experiment**, and it matters because a player's profile
is the only place their history is visible to them.

---

## 4 · OPEN IN MY LANE, RANKED

1. **The flat-grant experiment** (§2). Decides the threshold question. Everything else can wait behind it.
2. **`games_played` / `games_won` read 0** (§3). Real data exists; nothing surfaces it.
3. **Bonus tokens are one-quarter shipped.** Only **subsidy** is spendable today.
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
