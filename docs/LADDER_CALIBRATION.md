# THE DIFFICULTY LADDER · v1 was a rout, v2 is a ladder

**T2 S49 measured it. T2 S50 retuned it, on Mahil's explicit call.**
**40 seeds, 80 games per row · v1 numbers at HEAD `cdcab77`, v2 at the S50 retune commit.**
**Harness: `ladderCalibration.test.js` (order) · `ladderSpacing.test.js` (derivation) · engine: `ladderHarness.js`**

---

## THE HEADLINE

| matchup | **v1** (S32-S49) | **v2** (S50) | target |
|---|---|---|---|
| apprentice vs builder | **6.3%** | **32.5%** | ~35% |
| builder vs architect | **15.2%** | **34.2%** | ~35% |
| apprentice vs architect | **0.0%** *(0 wins in 80)* | **13.9%** | n/a |
| every rung vs **itself** | 50.0 / margin 0.00 | 50.0 / margin 0.00 | 50 |

v2 is the mean of **three disjoint 40-seed blocks** · 32.5 / 35.4 / 32.5 and 34.2 / 29.5 / 31.2 and
13.9 / 21.3 / 10.0. The two adjacent steps sit **1.7 points apart** at 40 seeds, against v1's 6.3 and
15.2 (a factor of 2.4).

---

## PART 1 · THE PREMISE THAT TOOK ONE GREP (S49)

Every duel in this repository · S39's, S46's, S47's, S48's · passed `REFERENCE_POLICY` as the opponent:

```
bonusBalance      duel(REFERENCE_POLICY, level, SEEDS)        for each level
spendableBalance  duel(level, REFERENCE_POLICY, HEAVY, ...)   for each level
flatGrantBalance  ladderRow(level, REFERENCE_POLICY, ...)     for each level
```

**Nothing had ever played apprentice against builder.** Five sessions of "ladder" measurement, and the
ladder had never been asked whether its own rungs are separated. The functions took two arbitrary
policies the whole time; one argument was simply always the same. (Rule 111.)

Measured against itself, v1 was worse than the reference rows suggested, not better · **one step of
difficulty took a player from an even game to one win in seven, and the two ends were not a contest.**
My hypothesis had been the flattering one: that the instrument was distorting S48's reading. The
reading was conservative.

---

## PART 2 · WHY v1 WAS A ROUT · the decomposition (S50)

Until S50 a "difficulty" was four scattered `level === 'x'` comparisons, so it **read as one dial**.
It is four axes, and v1's apprentice was handicapped on **three of them at once**:

| | drawBias | scoreEager | placement | defendWorst |
|---|---|---|---|---|
| v1 apprentice | 0.05 | **false** | random | false |
| v1 builder | 0.30 | true | affinity | false |
| v1 architect | 0.55 | true | affinity | **true** |

Reverting one axis at a time from builder, 80 games each:

| arm | win % vs builder | mean margin |
|---|---|---|
| builder + v1's draw bias (0.05) | 11.3 | **−16.35** |
| builder + random placement | 32.5 | **−9.31** |
| builder + lazy scoring | 42.3 | **−6.69** |
| | **sum** | **−32.35** |
| v1 apprentice (all three) | **0.0** | **−32.60** |

**The three handicaps compose ADDITIVELY in margin (−32.35 predicted, −32.60 measured · 0.8% error)
while the win rate collapses to zero.** A win rate is a *threshold* on the margin, so three
individually-survivable handicaps stack past the point where any game is winnable. That is Rule 88's
saturation explaining its own mechanism, and it is why v1 needed re-spacing rather than a rewrite.

### The draw-bias response curve

The only continuous axis, swept against a fixed 0.30 midpoint:

| drawBias | 0.00 | 0.10 | 0.20 | **0.30** | 0.40 | 0.55 | 0.70 | 0.85 | 1.00 |
|---|---|---|---|---|---|---|---|---|---|
| win % | 5.1 | 24.1 | 31.6 | **50.0** | 67.9 | 77.2 | 97.5 | 96.3 | 98.8 |
| margin | −20.69 | −12.82 | −6.40 | **0.00** | +10.85 | +18.57 | +36.84 | +40.61 | +46.59 |

Slope near the middle: **~0.86 points of margin per 0.01 of draw bias**. That number is what the v2
constants were chosen from. Note the top of the range: the win rate is **saturated above 0.70** (97.5 →
96.3 → 98.8, non-monotone) while the margin is still climbing cleanly · the same run showing both a
statistic that has run out of room and one that has not.

---

## PART 3 · v2, AND WHAT IT COST

| | drawBias | scoreEager | placement | defendWorst |
|---|---|---|---|---|
| apprentice | 0.30 | true | **random** | false |
| builder | 0.30 | true | affinity | false |
| architect | **0.39** | true | affinity | true |

**Builder is byte-identical to v1.** It is `DEFAULT_DIFFICULTY`, so it is the only policy any human has
ever played against (practice mode has no picker), and moving it would change the one experience that
exists in order to fix two that do not. Proven rather than claimed: its decision fingerprint in
`botPolicyIdentity.test.js` is unchanged from `3994d8d`.

**Apprentice loses only placement quality now**, and it is `scoreEager` · a bot that holds a *completed*
district while it still has somewhere to place does not look weak, it looks broken. Difficulty should
read as playing worse, never as malfunctioning.

### `defendWorst` is worth ZERO win rate · and HALVES the region spread

Builder + `defendWorst` against builder: **50.0%, margin +3.00**, 80 games. The code called it "the one
genuinely strategic idea in the file" and hedged that it was "a SMALL part of the gap." It is not small,
it is **nil as a win term**. (Rule 73: before concluding a mechanic matters, check whether it is
*capable* of mattering.)

**S50 kept it as "flavour · it gives architect a visible character" with no evidence at all. S51
measured that claim** (`ladderVisibility.test.js`, three disjoint 40-seed blocks):

| self-play | clustering | region spread |
|---|---|---|
| apprentice | **15.6** | 12.0 |
| builder | 24.9 | **15.2** |
| architect | 25.6 | 9.5 |
| builder + `defendWorst` *(isolated)* | 25.4 | **7.7** |

**`defendWorst` halves the region spread, 15.2 → 7.7.** The axis worth exactly zero win rate produces
the largest board-shape difference in the ladder, while `drawBias` · worth essentially the entire
ladder · leaves almost no visual trace. **Win rate and board shape are close to orthogonal here.**

The bottom rung is visible by a different mechanism: apprentice clusters 15.6 against builder's 24.9,
about 37% less clumped, in every block. So a player can see which rung they are playing on both
steps · scattered at the bottom, even at the top. Note region spread is **non-monotone**: builder is
the most lopsided player on the board, because only `defendWorst` evens up on purpose.

### The tradeoffs, stated

1. **65/35 adjacent and a gentle end-to-end are mutually exclusive.** Two steps of ~1/3 compound to
   ~1/9. 13.9% end-to-end is exactly what evenly-spaced 33% steps imply · arithmetic, not a design
   failure. A milder 60/40 ladder would give ~25% end-to-end and a duller middle.
2. **The whole ladder now sits above the frozen reference** · 60.0 / 66.7 / 84.8, where v1 straddled it
   at 5.1 / 77.2 / 98.8. Rungs that are ~35 points apart are necessarily close to any third party too,
   so the span against the yardstick **compressed from 94 points to 25**. The ordering survives and is
   gated; what is lost is resolution between apprentice and builder specifically.
3. **The win rate can no longer order the bottom two rungs.** On the first v2 run `botPolicy.test.js`
   reported apprentice 75.0% and builder 73.7% against the reference · *inverted* · on games whose
   margins were cleanly ordered (2.60 vs 10.10). The gates now assert the **margin** (Rule 88b). This is
   the price of a calibrated ladder: making it fair makes it more expensive to measure.
4. **`REFERENCE_POLICY` stays frozen and unpickable** (Mahil, S50). A yardstick that moves is not one,
   and moving it voids every rate recorded since S39.

---

## PART 4 · WHAT THIS DOES NOT MEASURE · unchanged, and it is the important caveat

**Bot against bot, two players, Classic mode.** Nothing here predicts what a human finds hard, and no
human with a claimed username has ever finished a recorded multiplayer game (S48). The retune was made
on Mahil's explicit overrule of "evidence first" · *"0.0% and 6.3% are outside any range a human
measurement could rescue"* · which is a statement about v1 being knowably wrong, not a claim that v2 is
knowably right. **v2's 32.5/34.2 is a bot-calibrated ladder awaiting its first human game.**

Per Rule 111, the two constants this harness hid: every row above is **two players**, and · until S50
· every row was **Classic mode**, because no balance harness had ever passed `initGame` its 4th
argument. `ladderRow` now takes a mode. **Four players is still unmeasured**: `bots()` is only ever
called with two, and `ladderRow` is structurally a duel.

### ⚠ WHAT A FLOW RETUNE WOULD ACTUALLY TAKE (T2 S53 · reported, deliberately not done)

The divergence below is real and unresolved. Costed rather than fixed, because retuning two ladders on
a session's tail is the same mistake as running an experiment whose question a document had already
closed.

**First, the thing that sizes the urgency:** `DIFFICULTY_SELECTABLE` is still `false` and there is no
picker anywhere in `src/components` or `src/pages` (verified at the artifact, not from memory).
Practice runs at `builder` in both modes. **So no player can currently pick a rung in either mode, and
nobody can experience the divergence.** It becomes real on the day the picker ships, not before.

**Second, the thing that sizes the severity:** Flow's steps are 27.6 / 39.9 against Classic's
33.5 / 31.6. Uneven, but *both are inside a playable band*. v1's were 6.3 / 15.2, which was a launch
blocker because one win in sixteen teaches nothing. **This is a polish item and it should not be
priced like the last one.**

**What it would cost, in order, and the first item is the one people will want to skip:**

1. **Measure the drawBias response curve IN FLOW.** The Classic slope (~0.86 points of margin per 0.01
   of bias) **cannot be assumed to carry** · the fact that the ladder did not transfer is itself the
   evidence that the axis behaves differently under a 9-tile clock. Tuning Flow off the Classic slope
   would be Rule 111 again: a constant lifted from one context into another without checking.
2. **A mode-aware `POLICIES` table**, i.e. `POLICIES[mode][level]` and a mode argument threaded through
   `resolvePolicy`. That permanently **doubles the tuning surface**: every future balance question is
   asked twice, and every answer can disagree with itself.
3. **Re-pin the decision fingerprints.** `botPolicyIdentity.test.js` passes no mode, so it pins Classic
   only. A mode-aware table needs a second set of fixtures or the Flow policies ship unpinned · which
   is the state Classic was in before S50 and the reason the ladder rotted unnoticed.
4. **Re-run the ladder and token blocks in Flow** so `docs/` carries Flow numbers rather than Classic
   numbers with a caveat.
5. **Decide what `REFERENCE_POLICY` means per mode.** It is frozen, correctly · but a yardstick frozen
   in Classic is not automatically a yardstick in Flow, and its *distances* to the rungs are already
   mode-dependent. Either it is one instrument measured separately per mode, or Flow needs its own,
   and adding `reference_v2` is exactly what `botPolicy.js`'s own header says to do rather than tuning
   the original.

**The alternative worth naming, because it may be the right answer:** accept the divergence and scope
the labels. A player picks a mode *and* a difficulty and experiences one combination; they never run
Classic-builder and Flow-builder side by side. The consistency concern is real but second-order, and
one honest sentence in the picker ("difficulty is tuned for Classic") costs nothing against a
permanent doubling of the tuning surface. **My recommendation is to do step 1 only** · measure the
Flow curve, which is cheap and is a prerequisite for every other option · and then decide, rather than
committing to a mode-aware table before knowing whether the axis even behaves the same way.

### Flow mode · measured in S50, three disjoint 40-seed blocks

**The worry was that Flow's 9 tiles would leave the token subsystem near-inert. It does not.** Flow
grants tokens at a stable fraction of Classic's volume · apprentice **0.62**, builder **0.80**,
architect **0.66**, with under 0.06 of spread between blocks. A quarter fewer tiles costs a
proportionate slice of token volume, not a cliff, so the closed token decision transfers to Flow.

**The ladder calibration does not transfer:**

| | Classic v2 | Flow |
|---|---|---|
| apprentice vs builder | 33.5 | **27.6** |
| builder vs architect | 31.6 | **39.9** |
| **step gap** | **1.9** | **12.3** |

Ordered in both · no rung is broken, and that is gated. But v2 was tuned to sit at ~33/33 and in Flow
it sits at ~28/40: the bottom step is *harder* and the top step *easier*. Likely mechanism, stated as
the hypothesis it is: apprentice's only handicap is random placement, and a game a quarter shorter
gives fewer turns to recover from a bad placement. Untested · a decomposition sweep in Flow would
settle it and did not run.

**So every spacing number in this document is a Classic number.** The retune fixed a launch blocker in
the mode the ladder will most likely ship in first; it did not calibrate Flow, and Flow was never
measured before S50 at all.

---

## FREE COROLLARY · the S48 token finding survives the retune

`ladderRow` scores every game both ways, so flat-vs-earned came along at no cost. Under **v1**:

| matchup | win % as earned | win % flattened | games flipped |
|---|---|---|---|
| apprentice vs builder | 6.3 | 6.3 | 2 / 80 |
| builder vs architect | 15.2 | 16.5 | 8 / 80 |
| apprentice vs architect | 0.0 | 0.0 | 0 / 80 |

Redistributing every bonus token evenly moved these matchups by **0.0, 1.3 and 0.0 points**. The earn
skew decides nothing between real ladder rungs · the generalisation S48 could not make. The gates in
`flatGrantBalance.test.js` that carried this claim now assert the ladder's **ordering** rather than its
position relative to the reference, because the position was a buried assumption that the retune
falsified (see that file's S50 note).
