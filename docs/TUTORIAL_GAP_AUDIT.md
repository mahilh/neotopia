# TUTORIAL GAP AUDIT · what the game never tells a player

T1 S35 · August 9 2026 · **reported, not fixed** (forge instruction)

## The screenshot this starts from

Mahil, playing practice: **Turn 3 · HAND 7 · all three regions scoring 0.** He drew seven
cards and built nothing.

That is not a player failing to understand the tutorial. It is a player doing exactly what
the tutorial suggested, three times a turn, for three turns.

## What the tutorial actually says

`src/components/Tutorial.jsx` · three steps, shown ONCE ever (localStorage
`neotopia_tutorial_v1`), only on turn 1, only on your turn:

1. **Three actions per turn** — draw a project card from the Offer, *or* move an element from
   a factory onto the board. Plus the per-turn clock.
2. **To place an element** — the four clicks (factory → dashed hex → element → place).
3. **To score a project card** — when the elements on the board match the dot pattern on a
   hand card, you score that district. Any rotation.

Steps 2 and 3 are accurate and were both rewritten to stay that way (S29, S30). The gaps are
not in what they say. They are in everything that happens *after* a card is drawn.

## The gaps, in order of what they cost

### 1 · Drawing and placing are presented as equal choices. They are not.

Step 1 offers them as symmetric: "draw a project card, **or** move an element". Mechanically
they are not symmetric at all — **only a placement can ever score anything.** A hand card is
inert until the board matches it, and the board only changes by placing.

And the two actions are wildly unequal in effort. Drawing is one click on a large, labelled,
illustrated card in the sidebar. Placing is four clicks across the board and a side panel. A
new player reading "either is fine" will take the cheap one, three times a turn.

**This gap alone explains the screenshot.** It is the highest-value fix on this list.

### 2 · Nothing says what a hand card is *for*

Step 3 explains matching, but never frames the hand as a set of objectives — "these are what
you are trying to build; the board is how you build them". A player who has drawn seven cards
has seven things they do not know they are supposed to act on.

### 3 · The final score formula is never mentioned anywhere

`calculateFinalScore` (patternMatcher.js):

```
best + second + (worst × 3) + (unused bonus tokens × 3) + your cluster points
```

**The worst region counts TRIPLE.** This inverts the strategy a player will naturally adopt.
Concentrating on one strong region is the obvious plan and it is close to the worst possible
one. Nothing in the product says so — not the tutorial, not the score sidebar, not the
end screen before it is too late to matter.

A player who never learns `best + second + (worst × 3)` is playing a different game from the
one that was built.

### 4 · Cluster points are never mentioned

Board rulebook p9, shipped S18/S19 and made per-player in T2 S35: **1 point for each element
token of your colour on the biggest cluster of that element in each region.** This is a direct
placement heuristic — clump your own tokens of one type — and it is the term that most rewards
deliberate placement. It is invisible until the final score screen.

### 5 · Diverse City is never mentioned

`findBuildableCards` skips any card whose `illustration` matches the region's
`lastBuiltIllustration`: **you cannot build the same illustration twice in a row in the same
region.** A player holding two similar cards will watch the second one refuse to light up and
receive no explanation at all. Silent refusals are the worst kind.

### 6 · The completing-element rule is never mentioned

Only patterns that include the hex you *just placed* are offered as scoreable
(`lastPlacedKey`). So a pattern you completed and did not immediately score does not come
back on a later turn until you touch it again. A player who places, hesitates, and moves on
has lost that district without being told anything happened.

### 7 · Bonus tokens are displayed with a description of something the game cannot do

Not a tutorial gap · **a live defect.** ActionBar shows held bonus tokens with tooltips:
"Automation · +1 action this turn", "Subsidy · draw 2 cards", "Initiative · place from
reserve", "Permits · place in the outer ring". `useBonus` exists in `gameStore` and **no
control anywhere calls it.** None of those four things can be done.

What bonus tokens actually do today is score 3 points each *if left unspent*, which is the
opposite of what the tooltip tells the player to try. Either wire `useBonus` to a control or
change the copy; right now the UI describes a game that is not running.

### 8 · The clock is a number with no meaning

The mode chip shows "12 tiles" / "9 tiles". Nothing says a production tile is consumed when a
factory empties, or that running out of them ends the game. The player is shown a countdown
without being told it is one.

### 9 · Structural · there is no way back in

`setShowTutorial` is called from exactly one place: the tutorial's own dismiss handler. Once
`neotopia_tutorial_v1` is set there is **no route back to the rules from inside the game** —
no help button, no rules panel, nothing in the action bar. Everything above therefore has to
land in one pass, on turn 1, before the player has any context to hang it on. That is a lot
to ask of three dialogs, and it is the reason gaps 3–6 cannot simply be appended as steps 4,
5, 6 and 7.

## Recommendation (for whoever picks this up · not done here)

Do **not** answer this with more tutorial steps. Nine facts in a turn-1 modal is worse than
three, and the modal is already the only chance.

Split it by when the player can use the information:

- **Turn 1, in the modal:** fix gap 1 only. Make placement the recommended action and say
  plainly that only placing can score. One sentence, in the step that already exists.
- **On first draw:** a single line near the hand — what the card is for (gap 2).
- **Just-in-time, when it first bites:** Diverse City (5) and the completing-element rule (6)
  should surface as an explanation at the moment a card refuses to light, not as advance
  warnings. Both are currently silent refusals, which is the actual defect.
- **Persistently, on the score panel:** the shape of the final score (3) and cluster points
  (4). These are strategy, not instructions, and they need to be re-readable across the whole
  game. This is also what a rules re-entry point (9) would carry.
- **Separately, as a bug:** gap 7 is not documentation. Wire it or reword it.

## What was verified, and how

Read against HEAD rather than from memory: `Tutorial.jsx`, `patternMatcher.calculateFinalScore`
and `findBuildableCards`, `gameStore.tryScoreCard` / `getFinalScore` / `useBonus`,
`gameConfig.getModeConfig`, `ActionBar.BONUS_META`, and every call site of `useBonus` and
`setShowTutorial`.

One correction made along the way: the second argument to `calculateFinalScore` is **unused
BONUS TOKENS**, not unused cards. A hand full of undrawn-on cards is not a direct scoring
penalty · it is a hand full of districts never built, which costs the same in practice but for
a different reason, and the distinction matters if anyone writes copy about it.
