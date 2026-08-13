# NeoTopia · the interface, handed over

Written T1 S70, the last engineering session in this lane. For a stranger, not for a session log.
Everything here is measured; where it is a judgement it says so.

---

## 1 · What a player sees on their first screen

They land on `/practice?bots=1`. Before anything else, a **modal tutorial** opens on
*"Three actions per turn"* with **Skip** and **Next →**. Everything behind it is already built and
already live — the board is dealt, the wallet is funded, the bot is seated.

Behind the modal, at 1280:

- **The board.** Three hexagonal districts on a painted island — Water (blue), Forest (green),
  Desert (red) — each with a `0` in the middle and four factories floating between them, each
  factory a hex showing coloured element counts.
- **The right sidebar**, top to bottom: `THE OFFER` (four face-up cards), `HAND · 3`, `SCORE`
  (a You / Bot 1 column per district).
- **The action bar**, bottom, one row: a pulsing green dot, *Your turn*, `90s`, the action count,
  and **End Turn** (disabled — you have not spent your actions yet).
- **The header**, top right: a sound button, a `?`, and **Leave practice**.

At 320 the sidebar becomes a **bottom sheet** that is *closed*. The Offer and the Hand are behind a
handle reading `Hand 3 · Offer 4`. **This is the single biggest difference between the two layouts
and the easiest thing to forget** — a harness that clicks an Offer card at 320 without opening the
sheet clicks a hidden element and reports that nothing happened. That cost me a measurement this
session.

The instruction line, centred in the header, is the only thing that tells a new player what to do:
*"Click a factory to take an element · or draw a card from the Offer"*. It is state-driven and it
changes at every step of the placement flow. **It is the most load-bearing string in the product**
and it has been wrong three separate times; each fix is recorded next to it.

The core loop is a **four-step placement**: factory → element → region → a valid hex. Steps 1, 2 and
3 are controls in the sidebar; step 4 is on the board. At 320 the sheet opens and closes around that
alternation automatically, which is deliberate and is the trickiest piece of layout in the app.

---

## 2 · Five things the interface will not tell them

**1 · That the wallet is finite in a way that matters, until it is gone.**
With `WALLET_ENABLED` on, every Offer card reads `$70M` and the bar reads `$1.00B`. That is fourteen
cards. Nothing anywhere suggests spending is a decision until the fifteenth purchase, when a red line
appears under the Offer: *"You have $20M · this card costs $70M"*. Played four times, buying on every
action: the money runs out at **turn 9**, with **17 cards in hand and nothing built**. The arithmetic
is fully on screen the whole time — `$70M` on the card, the balance in the bar — and it still reads
as free until it isn't. **The refusal is in the right place and arrives at the wrong time.**

**2 · Which of their cards is worth chasing.**
Six of those seventeen cards were one placement from completing. The near-miss badge (`4 OF 5
PLACED`) exists to say exactly that, and **none of the six was on screen** — the strip shows two
cards and the badges started at index 2. `6115481` adds a count to the hand label (`Hand · 17 · 6
close`) so the player at least knows to scroll. It is a mitigation, not a fix.

**3 · That a bot is thinking, and it never should.**
A bot turn takes ~3.1 seconds. T2 measured the deliberation at **1.04ms** — the timer is **3,014×**
the computation. There is no thinking indicator and there must never be one; it would be an animation
of a `setTimeout`. What the player does see is real: the bot's placement bursts (six particles,
measured identical to a human's) and since `6115481` its completed districts light up too.

**4 · Why the End Turn button is disabled.**
It unlocks on exactly two conditions: your actions are spent, **or** you have no legal move at all.
The second is the interesting one and it now includes affordability — a broke player facing 46
face-up cards can pass. When that fires, the instruction says which kind of stuck: *"Nothing you can
afford"* rather than *"No legal move left"*.

**5 · That the sound is adjustable.**
There is one SFX slider in a popover behind the sound button, persisted, independent of mute.
Council's tripwire: **if a playtester mutes rather than adjusting, it is not discoverable and belongs
visible.** That question is still open and only a person can answer it.

---

## 3 · The three measurements that would go stale first

I have shipped all three of these mistakes, and found all three myself rather than by a test. That is
the reason this section exists.

**1 · `MONEY_SLOT_PX = 46` in `src/utils/formatMoney.js`.**
The wallet readout is a fixed 46px slot — the widest string the formatter can emit over the *whole
reachable domain* of balances, measured in Chromium in the bar's own font. It is fixed on purpose: a
`width: auto` readout makes the bar's total demand a function of the balance, so the layout is
correct at `$1.00B` and wraps at `$930M`.

**It goes stale the moment pricing stops being flat.** The domain is `STARTING_WALLET − k·CARD_PRICE`,
which is only the whole domain while every card costs the same. There is an assertion for exactly
that premise (`priceOf` must return the same value for two different cards) — but the *font* is the
unguarded half. Change the bar's font-size, weight or family and all fifteen measurements are wrong,
silently, and the bar wraps at some balance nobody's fixture visits.
**Re-measure by:** running the sweep in `ActionBar.wallet.test.jsx`'s header against a browser.

**2 · The `ADVANCE` table in `src/components/Board/GameBoard.focus.test.jsx`, and every per-character width.**
27 entries of per-character advance, calibrated at one font size. I originally shipped a single
`UNITS_PER_CHAR` derived from **one** sample and it was wrong for any string that wasn't the one I
measured. The table is better and it is still a calibration.
**It goes stale on any font change**, and the failure is a title that overflows its card at some
names and not others.
**Re-measure by:** `getBBox` differencing in a real browser, not by counting characters.

**3 · The strip and bar geometry: `handStrip.js`, and the `296 / 298.1` arithmetic in `ActionBar.jsx`.**
The hand strip shows 2 cards; the action bar fits on one row at 320 with **1.9px** to spare. Both are
computed, both are gated, and both rest on things a layout change moves:

- the strip's window is **288px** at 320 and **255px** at *every* desktop width — the sidebar is the
  narrowest strip in the product, narrower than a phone, and the budget is **not monotonic** in the
  viewport (414 fits three, 1440 fits two)
- the bar's one-row result belongs to **one string**: `"Your turn"` at 57.0px. `"Waiting for Ana"` is
  94.7px and wraps, as it always did

I shipped a 4px strip padding tuned at 320 that cost the second card at **every** desktop width, and
a `column-gap: 10` that put the bar on two rows at 320 for thirty sessions.
**Re-measure by:** the six-width sweep the header of `handStrip.test.js` records. Never at one width.

---

## 4 · The one thing I would tell the next person

**jsdom cannot hold a layout claim, and this lane's expensive defects have all been layout claims.**

The two that mattered most this session were both invisible to every test I own:

- `Number(null)` is `0`, so a missing stored volume read back as a deliberate zero — **every player
  who had never touched the slider would have booted muted**, behind a control saying sound was on.
  Found by my own test on its first run.
- The sound popover anchored `right: 0` to a trigger that is not at the right of the screen, so at
  320 it ran to **x = −118** with the mute button off-screen and unreachable. **I quoted the
  ActionBar's identical bug in the comment two lines above while writing it.** Found by a browser.

And the third, which no instrument caught at all: **six near-miss badges, zero visible.** Both
features were correct. Only playing the game found it.

Run it. The measurements are good, and they are not the same thing as the game.

— T1, S70
