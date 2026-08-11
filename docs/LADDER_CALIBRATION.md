# IS THE DIFFICULTY LADDER A LADDER?
**T2 S49 · August 11 2026 · 40 seeds, 80 games per row, measured at HEAD `cdcab77`**
**Harness: `src/store/ladderCalibration.test.js` · engine: `src/store/ladderHarness.js`**

---

## THE PREMISE THAT TOOK ONE GREP

Every duel in this repository — S39's, S46's, S47's, S48's — passes `REFERENCE_POLICY` as the opponent:

```
bonusBalance      duel(REFERENCE_POLICY, level, SEEDS)        for each level
spendableBalance  duel(level, REFERENCE_POLICY, HEAVY, ...)   for each level
flatGrantBalance  ladderRow(level, REFERENCE_POLICY, ...)     for each level
```

**Nothing had ever played apprentice against builder, or builder against architect.** Five sessions of
"ladder" measurement, and the ladder had never been asked whether its own rungs are separated. The
functions took two arbitrary policies the whole time; one argument was simply always the same.

---

## THE TABLE

| matchup | win % | mean margin | saturated | tokens A | tokens B |
|---|---|---|---|---|---|
| **apprentice vs itself** | **50.0** | **0.00** | no | 0.64 | 0.64 |
| **builder vs itself** | **50.0** | **0.00** | no | 2.24 | 2.24 |
| **architect vs itself** | **50.0** | **0.00** | no | 3.41 | 3.41 |
| apprentice vs **builder** | **6.3** | −30.91 | no | 0.26 | 2.95 |
| builder vs **architect** | **15.2** | −28.66 | no | 1.61 | 4.63 |
| apprentice vs **architect** | **0.0** | −76.49 | **YES** | 0.04 | 6.10 |
| *apprentice vs reference* | *5.1* | *−20.50* | no | 0.26 | 2.08 |
| *builder vs reference* | *77.2* | *+13.59* | no | 2.54 | 1.63 |
| *architect vs reference* | *98.8* | *+61.38* | **YES** | 6.20 | 1.21 |

The three self-play rows are the counterweight, written and asserted first: a policy against itself
must tie, and all three land on **exactly 50.0 with a margin of exactly 0.00**. The harness has no
side, so the asymmetric rows are measuring the ladder and not the instrument.

---

## THE FINDING · the ladder is more extreme against ITSELF than against the reference

**One step of difficulty takes a player from an even game to roughly one win in seven. The two ends
are not a contest at all — zero wins in eighty games.**

I expected the opposite. My hypothesis was that a ladder can be perfectly spaced internally while
looking extreme against a common reference, which would have made S48's "both ends are pinned" an
artifact of the comparison partner. **It is the reverse.** Adjacent rungs (6.3%, 15.2%) are *harder*
matchups than anything measured against the reference except architect-vs-reference.

So S48's saturation reading was correct and **understated**. The ends are not merely pinned against a
middling opponent; adjacent rungs are pinned against each other. **There is no competitive pairing in
this ladder except a policy against itself.**

The reference policy sits *inside* the ladder, between apprentice and builder — which is why it looked
like the gentler opponent. It was never a neutral yardstick; it was an unnamed fourth rung.

### What this means if the ladder is ever exposed

The ladder is **not exposed in the UI, and that is a decision, not an omission** (Mahil, S33). This is
recorded for the session that changes that decision: as it stands, the three settings are not three
difficulties, they are three different games. A player who finds "builder" even would win about 15% of
games against "architect" and about 94% against "apprentice". There is no rung a player can climb to.

**Not recommending a rebalance.** That is Mahil's call and the standing pattern is evidence first — the
same discipline the bonus-token question closed under. What is missing before any tuning is a human
data point, and there is none: no human with a claimed username has ever finished a recorded
multiplayer game (S48).

---

## FREE COROLLARY · the S48 token finding survives rung-vs-rung

`ladderRow` scores every game both ways, so the flat-vs-earned comparison came along at no cost — and
S48's conclusion was only ever tested rung-**vs-reference**:

| matchup | win % as earned | win % flattened | games flipped |
|---|---|---|---|
| apprentice vs builder | 6.3 | 6.3 | 2 / 80 |
| builder vs architect | 15.2 | 16.5 | 8 / 80 |
| apprentice vs architect | 0.0 | 0.0 | 0 / 80 |

Redistributing every bonus token evenly moves these matchups by **0.0, 1.3 and 0.0 points**. The earn
skew decides nothing between real ladder rungs either, which is the generalisation S48 could not make.

---

## WHAT THIS DOES NOT MEASURE

Bot against bot. Nothing here predicts what a human finds hard. It answers the narrower question the
ladder's own design implies: **are these three policies distinguishable from each other, in the right
order, by a usable amount?** Ordered — yes, and gated as such. Usable — no.
