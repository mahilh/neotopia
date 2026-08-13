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
//     terminalRefs true     maybeForceDeadlockEndgame gates on it against a price
//                           (it read `CARD_PRICE` that day · T2 S69 moved it to cheapestAvailableCost,
//                            and the guard needed no edit, which is the same property twice)
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
//
// TEETH FOR THE S69 WIDENING · 7 mutations, GREEN baseline, each redding a different assertion:
//   D1  reachableCode returns the body only              -> the collapse Council ordered
//   D2  blind hardcoded false                            -> the UNMEASURED counterweight
//   D3  comparesField -> two whole-body existence checks -> both vacuity counterweights
//   D4  comparesField accepts a bare `=`                 -> the destructure case
//   D5  functionBody takes earliest index                -> declaration vs call site
//   D6  calledNames drops the member-access guard        -> the member-call case + the live repo
//   D7  terminalRefs drops comparesToField               -> the end-to-end vacuity counterweight
// TWO of those runs were interpretable ONLY because the harness refused them. D0 came back RED on the
// first pass · my new counterweight had found a real defect in the window · and the harness printed
// "STOP, every mutation below would red for free". D3 came back DID NOT LAND, because it still
// targeted the code that fix had replaced. A harness that rendered either as a row would have handed
// me a table of seven results in which two were not results (Rules 110b / 124's corollary).
// ⚠ AND MY OWN SUMMARY LINE SAID "on a green baseline" WHILE ROW D0 SAID BASELINE IS RED, four lines
// above it. The harness classified correctly and the script consuming it threw the classification
// away · Rule 130's second corollary, in the tool I wrote to prevent exactly that.

import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  detectWalletSeam, stripComments, functionBody, MONEY_TOKENS, comparesField, calledNames,
} from './walletTerminalSeam.js'

const TERMINAL_FN = 'maybeForceDeadlockEndgame'

// ⚠ EVERY FIXTURE HERE IS A COMPLETE WORLD, and it was not until S69 · when the reader learned to
// follow delegation, TWO existing tests went red for one unstated reason: they call
// `anyPlacementPossible` and never define it, so the honest verdict became UNMEASURED rather than
// RED. The reader is right (an unreadable delegate MIGHT be the money check, and only `terminalRefs
// === false` makes the question live at all). The fixtures were toy worlds pretending to be source
// files, which is Rule 100's "a fixture can describe an impossible board" one lane over · and the tell
// was that both failed the same way, which is a premise nobody wrote down rather than two bugs.
const STUBS = `
function anyPlacementPossible(state) { return state.regions.length > 0 }
function cheapestAvailableCost(state) { return state.deck.length ? 1 : null }`

// A store whose terminal function is written the way today's is · no money term.
const storeNoMoney = `
function ${TERMINAL_FN}(state) {
  if (state.deck.length > 0 || state.theOffer.length > 0) return
  if (anyPlacementPossible(state)) return
  state.endGameTriggered = true
}${STUBS}`

const storeWithMoney = `
function ${TERMINAL_FN}(state) {
  const p = state.players[state.currentSeat]
  if ((state.deck.length > 0 || state.theOffer.length > 0) && p.wallet >= CARD_PRICE) return
  if (anyPlacementPossible(state)) return
  state.endGameTriggered = true
}${STUBS}`

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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// DELEGATION · A GREP CANNOT SEE IT, AND MINE WAS ALREADY SHAPING PRODUCTION CODE (T3 S69)
//
// Council ordered the three spellings of affordability collapsed onto one helper. T2 did it everywhere
// EXCEPT the terminal condition, and left the reason in gameStore.js: extracting the predicate "leaves a
// body with no `wallet`, no `price` and no operator, so their biconditional goes from `true ⇔ true` to
// `true ⇔ false` and REDS a shared gate for three lanes."
//
// Measured before the fix, on the real file: the collapsed form reported `ok=false` on correct code. So
// this was not a gate that MIGHT cry wolf · it had already been paid, in a colleague keeping a predicate
// inline against their own judgement and against an instruction, to keep my grep green. A gate that cries
// wolf gets switched off and somebody notices; one that quietly buys a worse design sends no invoice.
//
// THE COUNTERWEIGHT IS FIRST AND IT IS THE ONE THAT MATTERS: the obvious repair · "follow delegation" ·
// is one keystroke away from "accept any body that calls anything", and that would make the guard
// unfailable in exactly the direction it exists to fail.
describe('the terminal condition may DELEGATE its money check (Rule 115 · what does this guard forbid)', () => {

  const inline = `
function ${TERMINAL_FN}(state) {
  const price = cheapestAvailableCost(state)
  if (price !== null && (state.players ?? []).some(p => (p.wallet ?? 0) >= price)) return
  if (anyPlacementPossible(state)) return
  state.endGameTriggered = true
}${STUBS}`
  const delegating = (helperBody) => `
function ${TERMINAL_FN}(state) {
  if (anySeatCanAcquire(state)) return
  if (anyPlacementPossible(state)) return
  state.endGameTriggered = true
}
function anySeatCanAcquire(state) {${helperBody}}${STUBS}`
  const FACTORY = 'const player = { seat, hand: [], wallet: STARTING_WALLET }'
  const seam = (storeSrc) => detectWalletSeam({ storeSrc, playerFactory: FACTORY, terminalFnName: TERMINAL_FN })

  test('COUNTERWEIGHT · delegating to a helper that does NOT check money is still RED', () => {
    const r = seam(delegating('\n  return state.deck.length > 0 || state.theOffer.length > 0\n'))
    expect(r.ok, 'following delegation was widened into accepting ANY body that calls something · the ' +
      'guard can now no longer fail in the one direction it exists for').toBe(false)
    expect(r.blind, 'reported as unreadable when the helper was right there and readable · that would ' +
      'excuse the exact defect this asserts').toBe(false)
  })

  test('COUNTERWEIGHT · a helper this reader cannot resolve is UNMEASURED, not a verdict (Rule 80)', () => {
    const r = seam(`
function ${TERMINAL_FN}(state) {
  if (someHelperDefinedInAnotherModule(state)) return
  state.endGameTriggered = true
}`)
    expect(r.unresolved, 'the unreadable delegate was not named · then "I could not look" and "it does ' +
      'not check money" become the same answer').toContain('someHelperDefinedInAnotherModule')
    expect(r.blind).toBe(true)
    expect(r.why).toMatch(/UNMEASURED/)
  })

  test('the collapse Council ordered now PASSES · the design my gate was forbidding', () => {
    const r = seam(delegating(
      '\n  const price = cheapestAvailableCost(state)\n' +
      '  return price !== null && (state.players ?? []).some(p => (p.wallet ?? 0) >= price)\n'))
    expect(r.ok, 'a terminal condition that delegates its money check to a helper that performs it is ' +
      'CORRECT, and this used to red').toBe(true)
    expect(r.mentionsField).toBe(true)
    expect(r.comparesToField).toBe(true)
  })

  test('and the inline form is unchanged · no regression on what ships today', () => {
    expect(seam(inline).ok).toBe(true)
  })

  test('the verdict no longer turns on a LOCAL VARIABLE NAME (Rule 125)', () => {
    // The old term was "the token `price` appears somewhere in the body". Renaming one local reddened
    // a correct gate · and `cheapestAvailableCost`, the function T2 actually calls, does not contain
    // the substring `price` at all. A discriminator I did not author is not mine to assert.
    expect(seam(inline.replace(/\bprice\b/g, 'cost')).ok).toBe(true)
  })

  test('COUNTERWEIGHT · a body that NAMES the field and gates on nothing is RED, end to end', () => {
    // The S66 vacuity ("a mention is not a use") was asserted only on `comparesField` in isolation ·
    // enumerating this session's mutations before writing them (§2) found that nothing drove
    // detectWalletSeam through it, so dropping `comparesToField` from `terminalRefs` reddened NOTHING.
    // A term with no test at the level it is composed at is a term that can be deleted silently.
    const r = seam(`
function ${TERMINAL_FN}(state) {
  console.log('balance check', state.players[0].wallet)
  if (state.deck.length > 0) return
  state.endGameTriggered = true
}${STUBS}`)
    expect(r.mentionsField, 'the field is named right there · if this is false the case is not the one ' +
      'it claims to be').toBe(true)
    expect(r.comparesToField, 'a log line satisfied the gate').toBe(false)
    expect(r.ok, 'naming the money field without comparing it is exactly the vacuity S66 closed').toBe(false)
  })

  test('comparesField is LINE-SCOPED · a mention far from any comparison is not a gate', () => {
    const far = `console.log(state.players[0].wallet)\n${'const filler = 1\n'.repeat(12)}if (a >= b) return`
    expect(comparesField(far, 'wallet'), 'an unrelated comparison elsewhere in the function satisfied ' +
      'the check · that is two independent existence tests wearing one name').toBe(false)
    expect(comparesField('(p.wallet ?? 0) >= price', 'wallet')).toBe(true)
    // `=` alone must not count, or a destructure or an assignment reads as a gate.
    expect(comparesField('const { wallet } = player', 'wallet')).toBe(false)
  })

  test('functionBody finds the DECLARATION, never an earlier CALL SITE', () => {
    // Shipped for exactly one probe run: collecting every pattern's index and taking the smallest made
    // `maybeForceDeadlockEndgame(` match its own call site 113 lines above the declaration, so the
    // reader brace-matched from the caller and every arm came back identically false. Preamble §3
    // carries this sentence already; what caught it was the answer being UNIFORM across four inputs
    // built to differ, not rereading the code.
    // ⚠ THE FIXTURE NEEDS A BRACE BLOCK BETWEEN THE CALL AND THE DECLARATION, or it does not hold the
    // collision. My first version had the call immediately above the declaration, so brace-matching
    // from the call site found the declaration's own `{` anyway and the test passed under the very
    // mutation it names · which is why the teeth check reddened the LIVE repo case instead of this
    // one and I read WHICH test went red (Rule 118a). gameStore has 113 lines and several blocks
    // between them; this now has one (Rule 112b · pin the corpus, or the proof evaporates).
    const src = [
      'function outer() {',
      `  ${TERMINAL_FN}(state)`,
      '}',
      'function between(x) {',
      '  if (x) { return NOT_THE_TERMINAL_BODY }',
      '}',
      `function ${TERMINAL_FN}(state) {`,
      '  return DECLARED',
      '}',
    ].join('\n')
    expect(functionBody(src, TERMINAL_FN)).toContain('DECLARED')
    expect(functionBody(src, TERMINAL_FN), 'brace-matched from the CALL SITE · the reader is describing ' +
      'a different function than the one it names').not.toContain('NOT_THE_TERMINAL_BODY')
  })

  test('calledNames ignores member calls and keywords', () => {
    const names = calledNames('if (x) { foo(1); state.bar(2); return baz(3) }')
    expect(names).toContain('foo')
    expect(names).toContain('baz')
    expect(names, 'a member call was read as a local function · then resolving it always fails and every ' +
      'body reports itself unreadable').not.toContain('bar')
    expect(names).not.toContain('if')
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
      expect(r.comparesToField, `${TERMINAL_FN} names '${r.moneyField}' but compares it to nothing · a ` +
        'mention is not a gate, and this is the vacuity the biconditional could not see before S66').toBe(true)
      // "I could not read a helper" must never be inherited as "the helper does not check money".
      expect(r.unresolved, `${TERMINAL_FN} delegates to ${r.unresolved.join(', ')}, which this reader ` +
        'could not resolve in gameStore.js. The verdict above is therefore about code it CAN see, and ' +
        'the honest report is UNMEASURED · extend functionBody or move the check (Rule 80).').toEqual([])
    }
  })
})
