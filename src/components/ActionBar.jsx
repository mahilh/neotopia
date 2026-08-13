import { useEffect, useRef, useState } from 'react'
import { formatMoney, MONEY_SLOT_PX } from '../utils/formatMoney'

// NeoTopia · fixed bottom action bar for the game screen.
// T1 owns this file. Mobile-first · 44px touch targets · tabular-nums on all counts.
// Left: whose turn it is · Center: 3 action dots (filled = used) · Right: bonus tokens + End Turn.

// Bonus token presentation · type → short label + effect hint + accent (element palette).
// The KEYS are the engine's contract (gameStore.js useBonus · T2's lane) and never change. Only the
// label/hint are player-facing: 'Automatization' was a translation artefact from the original board
// game, and 'Automation' is the ordinary English word for the same thing.
// ── WHAT A TOKEN DOES, AND WHETHER IT CAN YET BE DONE (T1 S43) ──────────────────────────────────
// The chip has displayed these four effects since S38 and offered no way to perform any of them ·
// an affordance for a verb that did not exist. This is the verb. But the four cases are NOT equal
// in the engine, and a control that pretends they are would be worse than none:
//
//   subsidy        useBonus draws 2 (Offer first, then deck) · consumed = drawn > 0.   ONE CLICK.
//   automatization actionsRemaining++ · consumed unconditionally.                      ONE CLICK.
//                  NOT REACHABLE TODAY: it is the bonus-HEX reward, and the hex (q,r) data has been
//                  outstanding twelve requests, so no player can hold one. Wired anyway · it costs
//                  a line and it is the one case that stops being dead the day the data lands.
//   initiative     needs bonusData {elementType,toQ,toR,regionId} and re-validates centre-first and
//                  adjacency. A one-click button CANNOT supply that, so it is not offered as one.
//   permits        `case 'permits': break` · the engine does nothing at all, by its own TODO
//                  (needs outer-ring tracking). There is no honest button for this today.
//
// AND `useBonus` REJECTS SILENTLY · it returns with no error on a wrong turn, on a second use in one
// turn, or on an unimplemented type. So the button must be disabled for exactly the cases the engine
// would refuse, and must SAY WHY. A control that no-ops on click is the worst of the three options,
// and it is what shipping this naively would have produced (Rule 80, in the UI: never resolve to a
// plausible nothing).
const BONUS_META = {
  automatization: { label: 'Auto',       hint: 'Automation · +1 action this turn',            color: '#E24B4A', oneClick: true },
  subsidy:        { label: 'Subsidy',    hint: 'Subsidy · draw 2 cards (Offer first)',        color: '#1D9E75', oneClick: true },
  initiative:     { label: 'Initiative', hint: 'Initiative · place an element from reserve',  color: '#7F77DD', oneClick: false, why: 'Pick a hex on the board · not yet wired' },
  permits:        { label: 'Permits',    hint: 'Permits · place in the outer ring',           color: '#378ADD', oneClick: false, why: 'Not implemented in the rules engine yet' },
}

// Why this token cannot be spent right now, or null when it can. Ordered so the most specific
// reason wins · "it is not your turn" is more useful than "you already used one".
export function bonusBlockedReason(type, { isMyTurn, bonusUsedThisTurn }) {
  const meta = BONUS_META[type]
  if (!meta) return 'Unknown token'
  if (!meta.oneClick) return meta.why
  if (!isMyTurn) return 'Only on your turn'
  if (bonusUsedThisTurn) return 'One bonus per turn'
  return null
}

const TOTAL_ACTIONS = 3

export default function ActionBar({
  playerName = 'Builder',
  mySeat = null,          // null = solo (no turn ownership concept)
  isMyTurn = true,        // solo is always your turn
  actionsRemaining = 3,
  noLegalMove = false,    // no placement, no draw, no district to score · unlocks End Turn early
  bonusTokens = [],       // [type, ...] held by the current player
  bonusUsedThisTurn = false, // the engine allows exactly one bonus per turn and refuses in silence
  turnTimeRemaining = null, // seconds left this turn · null hides the timer (legacy callers / tests)
  turnTimeLimit = 90,     // full turn budget · drives the progress-bar width
  wallet = null,          // THIS player's balance · null hides the readout AND keeps the action dots
  onEndTurn = () => {},
  onUseBonus = () => {},  // (type) => void · spends the token through the store
}) {
  // ── THE WALLET READOUT IS A SWAP, NOT AN ADDITION (T1 S67) ──────────────────────────────────────
  // See the measurement block below. `wallet == null` is the shipped state today (WALLET_ENABLED is
  // false in gameConfig), so this renders byte-identically to S66 for every player · and the moment
  // it is a number, the three action dots give up their 64px to pay for it.
  const showWallet = wallet != null && Number.isFinite(wallet)
  const used = Math.max(0, TOTAL_ACTIONS - actionsRemaining)
  // ── THE ESCAPE HATCH (T1 S44) ──────────────────────────────────────────────────────────────────
  // `actionsRemaining === 0` alone is a CAGE, and a real player sat in it at Turn 33: two actions
  // left, deck empty, every reachable region full, so nothing could be spent and the only control
  // that ends the turn refused on the grounds that the turn was not over. Reloading restored it from
  // sessionStorage · a permanent soft-lock in shipped code.
  // The engine never agreed: handleEndTurn gates on isMyTurn alone and would have ended that turn.
  // So the condition is "the turn is over OR this player cannot act", and the second half is
  // computed from real legal-move counts by GameRoom rather than guessed here.
  const canEndTurn = isMyTurn && (actionsRemaining === 0 || noLegalMove)

  // Turn-status label · multiplayer shows whose turn, solo just shows the player.
  const status = mySeat === null
    ? playerName
    : isMyTurn ? 'Your turn' : `Waiting for ${playerName}`

  // ── THIS BAR IS OVER-SUBSCRIBED, AND EVERY FIX HERE IS ABOUT WHO PAYS FOR THAT ──────────────────
  // ⚠ THE "~448px INTO A 292px BOX" THIS BLOCK CARRIED SINCE S38 IS STALE, AND IT WAS THE FIRST
  // THING I READ WHENEVER I TOUCHED THIS FILE. It described the bar BEFORE the S38 fixes landed ·
  // four labelled token pills, the "Actions" word, the timer's progress bar · and the prose two
  // paragraphs down says those were removed. Both were in this file the whole time and the wrong one
  // sat at the point of use, which is T2's Rule 132 corollary in my own header. I then quoted it in
  // a closing recommendation and it became the next session's brief (Rule 108).
  //
  // MEASURED AT HEAD, in Chromium, live game, max-content clone against the live rect per element:
  //     320, no tokens      content box 296   demand 298.1   deficit    2.1
  //     320, four tokens    content box 296   demand 378.6   deficit   82.6
  //     375, no tokens      content box 351   demand 298.1   slack     52.9
  //   (the box is 296 and not 292 because index.css drops the padding to 12 below 480)
  //
  // NOTHING IS BEING SHRUNK ANY MORE · every element's max-content width equals its live width, in
  // every arm. The S38 casualty is genuinely fixed: "Your turn" measures 57.0px, not 0.0. What the
  // 2.1px buys instead is a WRAP: at 320, and only at 320, the bar is TWO ROWS and End Turn sits
  // alone on the second at x=12. That is the tell · a right-aligned group rendering at the left
  // padding edge · and it costs 8.5px of board height (72.5 vs 64.0 at 375+).
  //
  // SO THE ANSWER TO "WHAT COMES OFF WHEN THE READOUT ARRIVES" IS ARITHMETIC AND NOT TASTE:
  //     wallet readout        +46 slot +10 gap  =  +56    ->  354.1, comfortably two rows
  //     drop the action DOTS  -54 -10 gap       =  -64    ->  290.1, ONE ROW, 5.9px spare
  //     drop the NUMERAL      -16 -10 gap       =  -26    ->  328.1, still two rows
  // Only the dots buy the row back, and the dots are the redundant half: three filled circles and
  // the numeral beside them are THE SAME INTEGER, rendered twice, 10px apart. That is the S38 move
  // again (133px came off by deleting two second renderings of information already on screen) and it
  // is the only one available here · the timer's seconds are the only clock, and the status text is
  // the only thing that says WHOSE turn it is.
  //
  // Its three groups want ~448px inside a 292px content box at 320. That is not "full", it is 156px
  // short, and flex has always closed the gap by shrinking whatever can shrink.   <- THE HISTORY:
  //
  // S37 · End Turn was the casualty once bonus tokens existed: four labelled pills put its right
  //       edge 267px off the side of a phone. A player who cannot reach End Turn cannot play, and
  //       auto-end-turn only rescues them once they have no actions left. Fixed by wrapping.
  // S38 · but wrapping is paid for in HEIGHT: 64 -> 119 -> 183px as tokens arrive, so the full set
  //       cost 119px of a 335px board on the smallest screen the game supports.
  //       AND the deeper one, found by measuring instead of asking whether it fit: at 320 AND at
  //       375, holding NO tokens, the status span rendered at 0.0px. "Waiting for Alice" · the
  //       turn-ownership signal in a real room · has been absorbing the entire deficit and
  //       disappearing, in shipped code, while I reported three sessions running that the bar fits.
  //
  // So: give the row its space back (index.css drops the "Actions" word and the timer's progress bar
  // below 480px · ~133px, both decoration whose information survives elsewhere), and stop spending
  // 266px on four pills. ONE CHIP says how many and which, by colour, in ~63px, and the detail moves
  // into a panel that opens ON TAP · where it can say what each token actually does, instead of
  // hiding it in a `title` attribute no touch device has ever shown anyone.
  const [tokensOpen, setTokensOpen] = useState(false)

  // ── AND IT HAS TO BE DISMISSIBLE BY MORE THAN THE ONE CONTROL THAT OPENED IT (T1 S39) ───────────
  // Measured: 296 x 281 at a 320px phone · half the height of a 568px screen · and when I shipped it
  // the only way out was a second tap on the chip. That is the ScoreFlash shape (S35): a large
  // overlay with exactly one exit. It is much milder here (the toggle genuinely works, and the panel
  // does not cover the board) but it is the same bet, that the player finds the one control.
  // Escape, and a click anywhere else, both close it.
  //
  // THE OPEN FLAG IS READ THROUGH A REF, and the reason is narrower than Rule 76 makes it sound ·
  // stated precisely because I mutation-tested the claim and my first version of it was wrong.
  // Listing [tokensOpen] in the deps is ALSO correct: React re-subscribes on the change and the
  // handler is never stale. What the ref buys is that the listeners attach exactly once instead of
  // swapping on every toggle · and, more usefully, it makes the empty dep array SAFE. Empty deps
  // with a direct read of `tokensOpen` is the shape somebody reaches for when they notice the
  // re-subscribing, and it captures `false` forever: Escape then silently stops working, with
  // nothing in the console. Mutating to exactly that reddens three tests in ActionBar.reach.
  const panelRef = useRef(null)
  const chipRef = useRef(null)
  const openRef = useRef(tokensOpen)
  openRef.current = tokensOpen
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && openRef.current) setTokensOpen(false) }
    const onDown = (e) => {
      if (!openRef.current) return
      // The chip is excluded so its own onClick keeps toggling rather than being closed here first
      // and reopened by the click · which would make the chip look dead.
      if (chipRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setTokensOpen(false)
    }
    document.addEventListener('keydown', onKey)
    // `pointerdown`, not `click`: a click that starts on the board and ends elsewhere should still
    // dismiss, and pointerdown fires before the board's own handlers get the event.
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [])

  return (
    <footer className="action-bar" style={{
      flexShrink: 0, minHeight: 64, position: 'relative',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.015)',
      display: 'flex', alignItems: 'center',
      // Wrap is UNCONDITIONAL again, and that is the point. S37 had to gate it on holding a token,
      // because turning it on for everyone replaced flex's shrink with a wrap and cost 25px of board
      // on every phone. With the chip and the 133px returned to the row it never triggers at any
      // supported width, so the safety net can be on permanently without ever being paid for · it is
      // now what would happen INSTEAD of losing End Turn, rather than what happens.
      // columnGap/rowGap rather than `gap` + `rowGap`: React warns that mixing a shorthand with a
      // longhand for the same value during a rerender can silently drop one of them.
      columnGap: 16, rowGap: 8,
      flexWrap: 'wrap',
      padding: '0 20px',
    }}>
      {/* Turn-dot pulse when it IS your turn · the clearest human "act now" signal (reduced-motion safe). */}
      <style>{`
        .turn-dot-active { animation: turn-pulse 1.5s ease-in-out infinite; }
        @keyframes turn-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(30,200,100,0.5); } 50% { box-shadow: 0 0 0 6px rgba(30,200,100,0); } }
        @media (prefers-reduced-motion: reduce) { .turn-dot-active { animation: none; } }
      `}</style>
      {/* LEFT · turn status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          className={isMyTurn ? 'turn-dot-active' : undefined}
          style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: isMyTurn ? '#1DC864' : 'rgba(255,255,255,0.25)',
            boxShadow: isMyTurn ? '0 0 8px rgba(30,200,100,0.6)' : 'none',
          }}
        />
        <span
          className={isMyTurn ? 'my-turn-badge' : undefined}
          data-testid="my-turn-badge"
          style={{
            color: isMyTurn ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)',
            fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {status}
        </span>

        {/* Turn timer · live per-second readout + shrinking bar (driven by GameRoom's local countdown).
            Warm amber, turning red under 10s. tabular-nums (rule 5). null hides it for solo/legacy/tests. */}
        {turnTimeRemaining != null && (
          <div
            data-testid="turn-timer"
            role="progressbar"
            aria-label="Turn time remaining"
            aria-valuemin={0}
            aria-valuemax={turnTimeLimit}
            aria-valuenow={Math.ceil(turnTimeRemaining)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 2 }}
          >
            <span style={{
              color: turnTimeRemaining <= 10 ? '#E24B4A' : '#E2A23B',
              fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              minWidth: 26, textAlign: 'right',
            }}>
              {Math.ceil(turnTimeRemaining)}s
            </span>
            {/* The bar, not the number · hidden below 480px, where its 52px was being paid for out
                of the player's name. The seconds beside it carry the same reading. */}
            <div className="ab-timer-bar" style={{ width: 52, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, (turnTimeRemaining / turnTimeLimit) * 100))}%`,
                background: turnTimeRemaining <= 10 ? '#E24B4A' : '#E2A23B',
                transition: 'width 1s linear',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* CENTER · action dots (filled = used) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto' }}>
        {/* Hidden below 480px · the three dots and the number beside them say "actions" without
            spending 67px of a 292px row on the word. */}
        <span className="ab-actions-label" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
          Actions
        </span>
        {/* THE DOTS ARE THE PAYER, and they are the redundant half of a pair rather than a casualty:
            three filled circles and the numeral 10px to their right are the same integer. They earn
            their 64px while nothing else needs it and give it up the moment something does. */}
        {!showWallet && (
          <div data-testid="action-dots" style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: TOTAL_ACTIONS }, (_, i) => {
              const isUsed = i < used
              return (
                <span key={i} style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: isUsed ? 'rgba(255,255,255,0.85)' : 'transparent',
                  border: isUsed ? '1px solid rgba(255,255,255,0.85)' : '1px solid rgba(255,255,255,0.3)',
                  transition: 'background 0.2s, border-color 0.2s',
                }} />
              )
            })}
          </div>
        )}
        <span data-testid="actions-left" style={{
          color: actionsRemaining > 0 ? 'rgba(255,255,255,0.55)' : '#E24B4A',
          fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 16, textAlign: 'center',
        }}>
          {actionsRemaining}
        </span>
        {/* THE READOUT · a FIXED 46px slot, right-aligned, never `width: auto`.
            Auto makes the bar's total demand a function of the BALANCE, so the layout could be
            correct at $1.00B and wrap at $930M · a width regression that appears on the first
            purchase of a game and never in a test that starts fresh. 46 is the widest string the
            formatter can emit over the whole reachable domain (15 balances, measured · see
            utils/formatMoney.js), not the width of the starting value.
            The `$` is the visible label and the sr-only word is the spoken one: this sits between
            two other bare numbers (seconds left, actions left) and a naked 930 says nothing about
            which. NOT a live region · one more polite announcer competing with the two GameRoom
            already owns is a decision with no measurement under it (open since S61). */}
        {showWallet && (
          <span
            data-testid="wallet-readout"
            data-wallet={wallet}
            style={{
              width: MONEY_SLOT_PX, flexShrink: 0, textAlign: 'right',
              color: 'rgba(200,148,64,0.95)',
              fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }}
          >
            <span className="sr-only">Wallet </span>{formatMoney(wallet)}
          </span>
        )}
      </div>

      {/* RIGHT · bonus tokens + End Turn
          NOT the home for a rules button, and that was measured rather than reasoned (T1 S36). At a
          320px viewport with no bonus tokens · the state every player is in today · this bar is
          exactly 320 of 320 wide, with End Turn's right edge at 300. It has no room at all. Adding a
          44px control here put End Turn's right edge at 337, i.e. 17px OFF THE SCREEN, which is the
          same defect as the practice exit fixed in this very session: a control present in the DOM
          that a player cannot reach. The route back to the rules lives in the header instead. */}
      {/* The right group wraps INTERNALLY too, and that is not belt-and-braces. Four tokens plus End
          Turn is about 380 units on its own, so wrapping this group as a single unit onto a second
          row would still overflow a 320px phone · the fix has to go all the way down to the strip. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {bonusTokens.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <button
              ref={chipRef}
              data-testid="bonus-chip"
              data-bonus-count={bonusTokens.length}
              aria-expanded={tokensOpen}
              aria-label={`${bonusTokens.length} bonus ${bonusTokens.length === 1 ? 'token' : 'tokens'} · show what they do`}
              onClick={() => setTokensOpen(o => !o)}
              style={{
                height: 44, minHeight: 44, padding: '0 10px', borderRadius: 10, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                border: `1px solid ${tokensOpen ? 'rgba(200,148,64,0.55)' : 'rgba(200,148,64,0.3)'}`,
                background: tokensOpen ? 'rgba(200,148,64,0.12)' : 'rgba(200,148,64,0.06)',
                color: 'rgba(200,148,64,0.95)', fontSize: 13, fontWeight: 600,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}
            >
              {/* One dot per token, in its own colour · WHICH tokens you hold, at a glance, in the
                  width a single label used to take. Capped at four because four is the whole set. */}
              <span style={{ display: 'inline-flex', gap: 3 }}>
                {bonusTokens.slice(0, 4).map((type, i) => (
                  <span key={`${type}-${i}`} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: (BONUS_META[type] ?? { color: '#888' }).color,
                  }} />
                ))}
              </span>
              {bonusTokens.length}
            </button>

            {tokensOpen && (
              <div
                ref={panelRef}
                data-testid="bonus-detail"
                role="group"
                aria-label="Bonus tokens"
                style={{
                  // ANCHORED TO THE BAR, NOT TO THE CHIP, and that is a measured correction. Pinned
                  // to the chip with right:0 it was fine while the chip sat on the right · but once
                  // the row wraps at 320 the chip starts at the LEFT of its own row, and the panel
                  // ran from x=-159 to x=90: two thirds of it off the side of the phone. The footer
                  // is always exactly as wide as the viewport, so anchoring here cannot escape it.
                  position: 'absolute', bottom: 'calc(100% + 8px)', right: 12, zIndex: 40,
                  width: 'max-content', maxWidth: 'calc(100vw - 24px)',
                  padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(13,13,24,0.98)', border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
              >
                {bonusTokens.map((type, i) => {
                  const meta = BONUS_META[type] ?? { label: type, hint: type, color: '#888' }
                  const blocked = bonusBlockedReason(type, { isMyTurn, bonusUsedThisTurn })
                  return (
                    <div key={`${type}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                      <span style={{ color: meta.color, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, flexShrink: 0 }}>
                        {meta.label}
                      </span>
                      {/* WHAT IT DOES AND WHY IT CANNOT BE DONE ARE BOTH REQUIRED, and my first
                          version replaced the first with the second · the S38 test caught it, which
                          is precisely what it was written for. A blocked token that stops saying
                          what it is for teaches the player nothing about the token they are holding
                          and cannot spend, which is the state they are in most of the time. */}
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 1.45 }}>
                          {meta.hint}
                        </span>
                        {blocked && (
                          <span data-testid="bonus-blocked-why" style={{
                            color: 'rgba(255,255,255,0.32)', fontSize: 10, lineHeight: 1.4, fontStyle: 'italic',
                          }}>
                            {blocked}
                          </span>
                        )}
                      </span>
                      {/* THE VERB. Rule 4's 44px applies here as much as anywhere · this is the only
                          control that spends a token, and it lives in a panel a player opened on
                          purpose. Disabled carries the reason in the row above rather than in a
                          title attribute, which a touch device never shows (the S38 lesson). */}
                      <button
                        data-testid="bonus-use"
                        data-bonus-type={type}
                        data-blocked={blocked ? 'true' : 'false'}
                        disabled={!!blocked}
                        title={blocked ?? `Use ${meta.label}`}
                        aria-label={blocked ? `${meta.label} unavailable · ${blocked}` : `Use ${meta.label}`}
                        onClick={() => { if (!blocked) { onUseBonus(type); setTokensOpen(false) } }}
                        style={{
                          marginLeft: 'auto', flexShrink: 0,
                          height: 44, minHeight: 44, padding: '0 12px', borderRadius: 8,
                          border: `1px solid ${blocked ? 'rgba(255,255,255,0.12)' : meta.color}`,
                          background: blocked ? 'transparent' : `${meta.color}22`,
                          color: blocked ? 'rgba(255,255,255,0.3)' : meta.color,
                          fontSize: 11, letterSpacing: 0.6, whiteSpace: 'nowrap',
                          cursor: blocked ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Use
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        <button
          className="ab-end-turn"
          data-testid="end-turn-btn"
          data-unlocked-by={noLegalMove && actionsRemaining > 0 ? 'no-legal-move' : undefined}
          onClick={onEndTurn}
          disabled={!canEndTurn}
          title={noLegalMove && actionsRemaining > 0 ? 'No legal move left · end your turn' : undefined}
          style={{
            height: 44, padding: '0 22px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: canEndTurn ? 'pointer' : 'default',
            border: '1px solid rgba(255,255,255,0.2)',
            background: canEndTurn ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: canEndTurn ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          End Turn
        </button>
      </div>
    </footer>
  )
}
