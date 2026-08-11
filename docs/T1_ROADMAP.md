# T1 ROADMAP · interface lane

Written at the close of S47 (August 11 2026) for someone with no memory of the sessions behind it.
HEAD when written: `c9c7593` · all four workflows green · 840 tests.

---

## WHERE THE INTERFACE STANDS

Five sessions ago a player could reach Turn 33 and have the game stop accepting input **forever**,
be told to click hexes that did not exist, watch a full-screen celebration fire for their opponent's
points, and never once be shown how their score was calculated. All of that is fixed and measured.
The interface now tells the truth about what you can do, what you earned, and who earned it. **The
one place it is still worse than the game underneath it is the phone board**: at 320px a hex is
14.4px — twice what it was, and still a third of the 44px a thumb needs.

---

## SHIPPED, WITH NUMBERS

| what | the measurement that proves it |
|---|---|
| **The soft-lock escape** (S44) | End Turn required all 3 actions *spent*; a player with 2 left and no legal move was trapped forever, and reloading restored it. Now unlocks when no legal move exists. Reproduced the exact state and escaped it: turn 1→2. |
| **Escape cancels a placement** (S44) | Measured `escapeWorked: false`. The only way out was clicking the same factory again, which nothing told you. |
| **Honest instructions** (S44) | Three strings promised the impossible. "The dashed hexes show where it can go" printed while `strokeDasharray` matched **0 polygons**; region buttons rendered enabled on full regions; an empty factory opened an empty panel. All now gated on real legal-move counts. |
| **The formula made legible** (S45) | It shipped in S27 and I reported it *missing* — it renders `× 3` **with a space** and my grep was for `×3`. The real defect: **1.70:1 contrast** against a 4.5:1 standard. Now **5.34:1**. |
| **Celebration fires for the right player** (S44) | The store always stamped `sacredMilestone.player`; the overlay destructured past it, so a bot crossing 9 got *your* full-screen gold celebration. Now attributed. |
| **Cluster points say who earned them** (S45–46) | A 3-token cluster read "+3 pts" while paying 2 to one player and 1 to another. Now split per seat — and a pre-S35 board that paid **nobody** now says **"unclaimed · 3"** instead of showing points that reached no one. |
| **The phone board** (S47) | 320px: board **288×82 → 288×173**, hex **6.8 → 14.4px** (15.5% → 32.8% of 44px). 375 → 19.8px, 414 → 31.2px. **0 of 57 cells blocked at seven widths. Desktop unchanged.** |
| **Wordmark NEO / TOPIA** (S47) | Two colours split on meaning — bone 16.25:1, amber 7.30:1. Replaced four element colours, which only "teach the four elements" to someone who already knows there are four. |
| **The hero** (S45–47) | "Four builders. One world. Only one of you builds it right." Replaced "Pure strategy · No dice" — a game described by what it lacks. |

---

## NEXT · THE FULL-BLEED PHONE BOARD

**The numbers, so tomorrow-you does not re-derive them.** At 320×568 the chrome is **215px of a
568px screen before the board gets anything**: header **142px** (122 when the instruction fits one
line — see below), action bar **73px**. What shipped in S47 splits the remaining 354px as 3:2
between board and sidebar, which is why the hex doubled. Full-bleed reclaims most of the 215.

**The prerequisite already exists:** Escape cancels the placement flow (S44). A bottom sheet needs a
dismiss path and the game has one.

**The design decision that has to be made, and I deliberately did not improvise it:**

1. **Bottom sheet** — board full-bleed, the 4-step panel slides over it on demand. Most board area;
   costs a layer and an animation, and the sheet must not repeat the S39 action-log mistake of
   covering cells while letting clicks through.
2. **Collapsing header** — keep the column, shrink the header to a single line and move the
   instruction into the action bar. Cheapest; recovers maybe 70px, so the hex reaches ~20px, not 44.
3. **Board-first with a drawer tab** — a persistent 44px tab at the edge, the panel opens over the
   board. Between the two in cost.

Only (1) plausibly reaches 44px. It is a design decision about where the controls live, not a CSS
tweak, which is why it is a session of its own rather than the last hour of another one.

**Gate it at 320, not desktop.** The instruction-wrap effect is **zero at 1440**, so a desktop gate
is blind to the whole defect.

---

## OPEN IN MY LANE, RANKED

Ordered by how many players hit it and how badly.

1. **Hex targets under 44px at every width except desktop.** 320 → 14.4px, 375 → 19.8, 414 → 31.2.
   Everyone on a phone, every tap. The item above.
2. **The tutorial's Step 2 misorders the core verb.** A player learns the wrong sequence for the
   thing they will do most.
3. **The four elements are never explained.** They drive every pattern, every cluster, every score,
   and nothing on screen says what they are.
4. **"Cluster" has no user-facing name.** Two players now score *different* cluster totals and the
   only place it is explained is a line inside the end-screen panel.
5. **Legal hexes at 1.1:1 against terrain.** The single most important signal in the game — where
   you may place — is nearly invisible against the ground it sits on.
6. **Turn timer expires with no effect.** A countdown that does nothing teaches the player that
   nothing on screen means anything.
7. **The region step is structurally redundant.** Picking an element usually determines the region;
   the step exists to be clicked through.
8. **The sidebar hides a variable percentage of itself.** It has always been a scroll surface —
   871px in what is now a 149px box — with no affordance saying so.
9. **Non-text contrast failures** (borders, dividers, disabled states). Not caught by the text-only
   checks I have been running.
10. **Screen 2's prose wall.** The "how it works" section is paragraphs where it should be a board.

**Not previously on the register, found in S45–47:**

11. **Copy is a layout input on phones.** A 66-character instruction wraps to two lines and costs the
    board **20px — 24% of its height**. I changed instruction copy in S44 and silently shrank the
    board by a quarter; nothing noticed. `boardMetrics` now reports the string alongside the geometry
    so a gate can pin both.
12. **The Practice button and the wordmark share amber** (`#C89440`). Kept deliberately — see
    BLOCKED ON MAHIL.

---

## DEBT I OWE MY OWN INSTRUMENTS

- **The CSS gate pins a string, not a behaviour.** `GameRoom.phone.test.jsx` asserts `index.css`
  *contains* `flex: 3 1 0`. That passes if the rule is beaten later in the cascade, by a more
  specific selector, or by an `!important` elsewhere. **The fix: `getComputedStyle(boardArea).flexGrow
  === '3'` at 320 and `'1'` at 1280, in T3's browser gate** — keeping only the DOM claim (the class is
  on the right element) in jsdom.
- **The coupling assertion runs nowhere.** `boardMetrics` now asserts its own line-count arithmetic
  in jsdom, but the claim it exists for — that header wrap and board height move together — is
  witnessed only in a browser I drove by hand. It belongs in the same gate.
- **The reachability probe's live runs are all mine.** `probe.reachability` is in T3's merge gate for
  the board, but every other surface I have pointed it at (the action bar, the score screen, the
  bonus panel) was a one-off I ran and did not wire.
- **`inkLoss` (card art) is committed and unwired.** Signature posted to comms in S43; no workflow
  calls it.

---

## BLOCKED ON MAHIL

1. **Amber on the wordmark vs the Practice button.** `TOPIA` is `#C89440`; the "Practice alone"
   button uses the same hue at 0.4 alpha border / 0.1 fill, 259px below it. I kept amber and refused
   the teal fallback because teal appears nowhere else in the product and would add a *fifth* hue to
   a page whose whole correction was having fewer. **If it still reads as a clash: say so, and I will
   neutralise the BUTTON to white/grey — not recolour the brand.**
2. **The phone-layout direction** — option 1, 2 or 3 above. Only option 1 reaches 44px.
3. **`neotopia.io` does not resolve.** Outstanding for many sessions; DNS is not in any terminal's
   lane.
4. **Bonus-hex `(q,r)` coordinates** — thirteen requests outstanding. It is the only route to the
   fourth token type (`automatization`), and until it lands the Use button for that token is wired
   but unreachable.

---

## ONE THING WORTH KNOWING BEFORE YOU CHANGE ANY LAYOUT

**The board container had no class at all.**

Until S47 the element holding the board was an unnamed `<div>` with inline styles. Every responsive
rule in `index.css` could therefore only address `.game-sidebar` — which is **exactly why five
sessions of layout work could not touch the board**, and why the sidebar ended up with a 240px
reservation while the board took whatever was left (114px of a 568px screen).

It is `.game-board-area` now. If you are about to fight the phone layout, that class is the handle,
and its absence is the explanation for how the game's most important surface became the one nobody
could style.
