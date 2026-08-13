// NeoTopia · the wallet/terminal seam (T3 S64). Design in tests/walletTerminalSeam.js.
//
// ORDER IS DELIBERATE. The synthetic cases come FIRST and the live repo case LAST · originally because
// the live case was the ARMED one and held trivially, so it could prove nothing about whether the guard
// worked (Rule 86). ⚠ THAT STOPPED BEING TRUE ON 2026-08-13 and the sentence is corrected rather than
// left: T2 shipped the wallet, the guard fired, and the live case now ASSERTS. The ordering stays,
// because the synthetic cases still cover states the repo cannot be in at any one moment.
//
// WHAT THE TRANSITION ACTUALLY SHOWED, since a guard's first firing is the only real test of it:
//     moneyField 'wallet'   EXTRACTED from the player factory, not hardcoded · T2 chose the name and
//                           the guard needed no edit (Rule 125 · it is not my fingerprint to guess)
//     terminalRefs true     maybeForceDeadlockEndgame gates on it against CARD_PRICE
// So the biconditional HELD at the transition · both halves landed together and the guard confirmed a
// correct change rather than catching a defect. That is the outcome it was built to make visible in
// EITHER direction, and reporting it as a success is as much the job as reporting a failure.
//
// TEETH, mutation-proven (each reds a DIFFERENT assertion · Rule 118):
//   W1  stripComments becomes identity          -> the prose-is-not-a-field case reds
//   W2  the field regex becomes .includes()     -> the substring case reds (Rule 112)
//   W3  ok drops its right-hand side            -> the wallet-landed-without-the-fix case reds
//   W4  functionBody returns '' instead of null -> the missing-function case reds
//   W5  MONEY_TOKENS loses 'funds'              -> the not-my-guess case reds

import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { detectWalletSeam, stripComments, functionBody, MONEY_TOKENS } from './walletTerminalSeam.js'

const TERMINAL_FN = 'maybeForceDeadlockEndgame'

// A store whose terminal function is written the way today's is · no money term.
const storeNoMoney = `
function ${TERMINAL_FN}(state) {
  if (state.deck.length > 0 || state.theOffer.length > 0) return
  if (anyPlacementPossible(state)) return
  state.endGameTriggered = true
}`

const storeWithMoney = `
function ${TERMINAL_FN}(state) {
  const p = state.players[state.currentSeat]
  if ((state.deck.length > 0 || state.theOffer.length > 0) && p.wallet >= CARD_PRICE) return
  if (anyPlacementPossible(state)) return
  state.endGameTriggered = true
}`

describe('the synthetic cases · the only ones that can have teeth while the wallet does not exist', () => {

  test('ARMED · no money field anywhere · holds trivially and SAYS SO', () => {
    const r = detectWalletSeam({
      storeSrc: storeNoMoney,
      playerFactory: 'const player = { seat, userId, username, hand: [], scores: {}, bonusTokens: [] }',
      terminalFnName: TERMINAL_FN,
    })
    expect(r.moneyField, 'a field was found where none exists · the guard would assert against a ghost').toBeNull()
    expect(r.armed, 'the armed state must be REPORTED, not inferred from a pass · a guard for a dependency ' +
      'that has not landed must be armed, not silent (Rule 115b)').toBe(true)
    expect(r.ok).toBe(true)
    expect(r.why).toMatch(/ARMED, NOT ASSERTING/)
  })

  test('RED · the wallet lands and the terminal condition does not account for it', () => {
    const r = detectWalletSeam({
      storeSrc: storeNoMoney,
      playerFactory: 'const player = { seat, userId, hand: [], scores: {}, wallet: STARTING_WALLET }',
      terminalFnName: TERMINAL_FN,
    })
    expect(r.moneyField).toBe('wallet')
    expect(r.armed).toBe(false)
    expect(r.terminalRefs).toBe(false)
    expect(r.ok, 'the whole point of the file · this is the state that must go red').toBe(false)
    expect(r.why, 'the failure must name the fix, not just the fault').toMatch(/empty wallet/)
  })

  test('GREEN · both halves land together', () => {
    const r = detectWalletSeam({
      storeSrc: storeWithMoney,
      playerFactory: 'const player = { seat, hand: [], wallet: STARTING_WALLET }',
      terminalFnName: TERMINAL_FN,
    })
    expect(r.moneyField).toBe('wallet')
    expect(r.terminalRefs).toBe(true)
    expect(r.ok).toBe(true)
  })

  test('RED THE OTHER WAY · a terminal condition referencing a field nothing creates', () => {
    const r = detectWalletSeam({
      storeSrc: storeWithMoney,
      playerFactory: 'const player = { seat, hand: [], scores: {} }',
      terminalFnName: TERMINAL_FN,
    })
    // moneyField is null so the biconditional holds · and that is CORRECT: with no field, there is no
    // seam to guard. Recorded as a deliberate limit rather than left for someone to discover: this
    // guard watches the FIELD, and a dangling reference is a different defect with a different owner.
    expect(r.armed, 'no field, so armed · this guard cannot see a dangling reference and does not claim to')
      .toBe(true)
    expect(r.ok).toBe(true)
  })

  test('PROSE IS NOT A FIELD · the word money in a comment must not arm anything', () => {
    const r = detectWalletSeam({
      storeSrc: storeNoMoney,
      playerFactory: `
        // Under a wallet this costs money and delivers nothing · see the contract.
        /* wallet: the per-player balance, once it exists */
        const player = { seat, hand: [], scores: {} }`,
      terminalFnName: TERMINAL_FN,
    })
    expect(r.moneyField, 'a comment armed the guard · gameStore.js is roughly 40% commentary and every ' +
      'one of the six tokens already appears in it, so this is not hypothetical').toBeNull()
  })

  test('A SUBSTRING IS NOT A FIELD · walletless / moneyBag must not match (Rule 112)', () => {
    const r = detectWalletSeam({
      storeSrc: storeNoMoney,
      playerFactory: 'const player = { seat, walletless: true, moneyBagIcon: "x", hand: [] }',
      terminalFnName: TERMINAL_FN,
    })
    expect(r.moneyField, 'a longer identifier containing a token matched · that is an identity check ' +
      'with no boundary, and I have shipped it inside a brand-new guard before').toBeNull()
  })

  // ⚠ THIS LIST IS DELIBERATELY A SECOND, INDEPENDENT COPY AND MUST NOT BE IMPORTED (T3 S64).
  // The first draft iterated MONEY_TOKENS itself, and mutation W5 · delete 'funds' from the module ·
  // came back 10 PASSED. Of course it did: removing a token removed the case that tested it. The two
  // sides of the check came from one source, so it could not fail (Rule 92), inside the file whose
  // entire subject is not hardcoding somebody else's identifier. Only the mutation found it; rereading
  // it twice did not.
  const NAMES_THE_CONTRACT_MIGHT_USE = ['wallet', 'money', 'funds', 'coins', 'credits', 'balance']

  test('THE NAME IS EXTRACTED, NOT GUESSED · every candidate works with no edit', () => {
    for (const token of NAMES_THE_CONTRACT_MIGHT_USE) {
      const r = detectWalletSeam({
        storeSrc: storeNoMoney,
        playerFactory: `const player = { seat, ${token}: 10 }`,
        terminalFnName: TERMINAL_FN,
      })
      expect(r.moneyField, `'${token}' was not detected · the guard would stay silently ARMED forever if ` +
        'T2 picked this name, which is the exact failure mode of hardcoding somebody else\'s future ' +
        'identifier. If this token is genuinely not wanted, delete it HERE as a decision, not by ' +
        'shrinking MONEY_TOKENS and letting this test shrink with it.')
        .toBe(token)
    }
  })

  test('the module\'s list still covers every name this test expects · drift, stated as a claim', () => {
    const missing = NAMES_THE_CONTRACT_MIGHT_USE.filter(t => !MONEY_TOKENS.includes(t))
    expect(missing, `MONEY_TOKENS no longer covers ${missing.join(', ')} · the detector stopped looking ` +
      'for a name this test still considers plausible. That is a decision worth making on purpose.')
      .toEqual([])
  })

  test('A MISSING TERMINAL FUNCTION IS NOT A PASSING ONE', () => {
    expect(functionBody(storeNoMoney, 'noSuchFunction'),
      'an absent function must be distinguishable from one with no reference · null, never an empty ' +
      'string, or a renamed terminal condition would read as "does not mention money" and pass forever')
      .toBeNull()
    expect(functionBody(storeNoMoney, TERMINAL_FN)).toContain('endGameTriggered')
  })

  test('stripComments removes both forms and keeps the code', () => {
    expect(stripComments('a // wallet: 1\nb /* money: 2 */ c')).not.toMatch(/wallet|money/)
    expect(stripComments('const wallet = 1 // note')).toMatch(/const wallet = 1/)
  })
})

describe('the LIVE repo · armed until 2026-08-13, asserting since', () => {
  test('the biconditional holds against the real gameStore, in whichever state it is in', () => {
    const storeSrc = readFileSync(resolve(process.cwd(), 'src/store/gameStore.js'), 'utf8')
    const r = detectWalletSeam({ storeSrc, playerFactory: storeSrc, terminalFnName: TERMINAL_FN })

    // POSITIVE CONTROL FIRST (Rule 120). "No money field" and "I read the wrong file" are the same
    // observation, and an absence measured against an empty string is the cheapest false finding there is.
    expect(functionBody(storeSrc, TERMINAL_FN),
      `${TERMINAL_FN} was not found in gameStore.js · this whole check just measured a file it could not ` +
      'read, or the function was renamed. Either way the absence below means nothing.').toBeTruthy()

    console.log(`[wallet-seam] ${r.why}`)

    // ── THE GUARD STOPPED BEING ARMED ON 2026-08-13 AND THIS IS THE FLIP (T3 S66) ──────────────────
    // It used to assert `armed === true` · a wake-up device, whose whole job was to fail the day a
    // money field appeared. It did exactly that, and T2 had shipped BOTH halves together:
    //     moneyField 'wallet'  ·  maybeForceDeadlockEndgame gates on it against CARD_PRICE
    // so the biconditional HELD at the transition. The guard confirmed a correct change rather than
    // catching a defect, which is the outcome it was built to make visible either way.
    //
    // A wake-up assertion that has woken you cannot stay · re-asserting `armed` would now red on
    // every run for a state that is CORRECT, which is a gate that cries wolf (Rule 94a) and gets
    // switched off before the day it is right. What replaces it is the assertion that was always the
    // real one, and it is true in BOTH states · which also keeps it honest on a CI checkout, where
    // gameStore.js may not yet carry the field (Rule 67 · gate what is true where the gate runs).
    expect(r.ok, r.why).toBe(true)

    if (r.armed) {
      expect(r.moneyField, 'armed means no money field · nothing else may be concluded').toBeNull()
    } else {
      // Both halves reported separately, because "accounts for it" was satisfiable by a MENTION until
      // S66 · a log line or a destructure naming the field would have passed. The contract's clause is
      // a comparison, so the body must both name the field AND compare against a price.
      expect(r.mentionsField, `${TERMINAL_FN} does not name '${r.moneyField}' · a player with cards in ` +
        'the deck and an empty wallet is exactly as stuck as one with an empty deck, and the ' +
        'dead-position check would decline to notice (docs/WALLET_AND_DEMOLITION_CONTRACT.md §5)').toBe(true)
      expect(r.comparesToPrice, `${TERMINAL_FN} names '${r.moneyField}' but compares it to no price · a ` +
        'mention is not a gate, and this is the vacuity the biconditional could not see before S66').toBe(true)
    }
  })
})
