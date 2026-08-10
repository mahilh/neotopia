# BONUS HEX DATA · the one datum the bonus-token subsystem is still missing
**T2 S39 · for Mahil · 12th request, and now the ONLY thing outstanding**

## What changed, so this is worth answering now

For ten sessions this was one of two missing pieces and neither was actionable. **The other half
answered itself in S38:** the pile contents came out of `docs/NEOTOPIA_GAME_RULEBOOK.md:115-125`, which
names a token per score threshold (7 Government Subsidy · 13 Private Initiative · 18 New Building
Permits). Tokens are now earned in **40 of 40 games**.

So this is no longer "a nicety pending." It is the single last input, and it unlocks exactly one thing:
**`automatization` (Automatization · one free extra action), which has no other route into the game.**
The other three token types are already reachable through the score track.

## What I need · precisely

**For each of the three regions, which hex coordinates carry a bonus symbol on the physical board, and
which token each one grants.**

That is it. No format work needed on your side · read them off the board and mark the list below.

### Why I will not guess

Rule 32 forbids baking guessed game data. The pile was permissible because the rulebook *states* it;
coordinates are not stated anywhere in the repo, and a wrong hex is worse than no hex: it would put a
reward on a space the physical board does not, quietly change which placements are good, and be
invisible to every test I could write. The measurement work in `docs/BONUS_TOKEN_BALANCE.md` would also
silently become a measurement of invented data.

## The board, enumerated · just mark the ones with a symbol

Each region is a radius-2 hex, 19 spaces, 57 in total. Coordinates are axial `(q,r)` in the global
frame · the same numbers the engine uses, so whatever you mark can be pasted straight in.

### Sacred City · region 0 · centre (0,0)
```
ring 0 :  (0,0)
ring 1 :  (-1,0)  (-1,1)  (0,-1)  (0,1)  (1,-1)  (1,0)
ring 2 :  (-2,0)  (-2,1)  (-2,2)  (-1,-1) (-1,2) (0,-2)
          (0,2)   (1,-2)  (1,1)   (2,-2)  (2,-1) (2,0)
```

### Living Earth · region 1 · centre (8,-4)
```
ring 0 :  (8,-4)
ring 1 :  (7,-4)  (7,-3)  (8,-5)  (8,-3)  (9,-5)  (9,-4)
ring 2 :  (6,-4)  (6,-3)  (6,-2)  (7,-5)  (7,-2)  (8,-6)
          (8,-2)  (9,-6)  (9,-3)  (10,-6) (10,-5) (10,-4)
```

### Free Energy · region 2 · centre (4,5)
```
ring 0 :  (4,5)
ring 1 :  (3,5)   (3,6)   (4,4)   (4,6)   (5,4)   (5,5)
ring 2 :  (2,5)   (2,6)   (2,7)   (3,4)   (3,7)   (4,3)
          (4,7)   (5,3)   (5,6)   (6,3)   (6,4)   (6,5)
```

**Answer in any of these forms · all equally usable:**
1. `region 0: (1,-1) automatization, (−2,1) subsidy` … · coordinates and token type
2. "ring 1, the space north-east of centre in each region, all automatization" · describe the position
   and I will convert it and read the conversion back to you before it ships
3. A photo of the board with the bonus spaces circled

**If the board does not mark a token TYPE per space** (i.e. every bonus hex grants the same thing, or
you draw from a face-down supply), say so · that is a different and simpler shape and I will implement
whichever is true rather than assume the richer one.

## Two follow-up questions, only if you know offhand

1. **Does the bonus hex still pay if a player covers it late?** The current code awards on covering, and
   the space can only be covered once, so it is one-shot and first-come. That matches how the score-track
   tokens behave.
2. **Are bonus hexes ever on a region CENTRE?** The centre is forced as the first placement in an empty
   region, so a bonus there is guaranteed to whoever opens the region · which may be intended, but it is
   the one position with no choice attached.

## Where it lands when it arrives

`createInitialRegions()` in `src/store/gameStore.js` · the granter at `:288` already reads
`region.hexes[key].bonusType` and awards it, and has since S15. It has simply never had a hex to read.
`src/store/bonusTokens.test.js` carries a test asserting no hex currently has one; **that test going red
is the signal the feature came alive**, and it is written to say so.

Roughly a ten-line change plus tests once the coordinates exist.
