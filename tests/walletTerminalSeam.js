// NeoTopia · the wallet/terminal seam, named BEFORE it opens (T3 S64).
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS, AND WHY IT IS A FUNCTION RATHER THAN A PARAGRAPH
//
// docs/WALLET_AND_DEMOLITION_CONTRACT.md (T2 S63) states the change to the terminal proof precisely:
//
//     today   DEAD  ⇔  no card available                   AND  no legal placement
//     wallet  DEAD  ⇔  (no card available OR no money)     AND  no legal placement
//
// and says of the current early return in `maybeForceDeadlockEndgame`: "That early return becomes wrong
// the moment cards cost money ... This is a one-line change and it is the whole wallet-side terminal fix."
//
// THE SOFT-LOCK IS THE CLASS THAT TOOK FOUR FIXES ACROSS THREE LANES TO CLOSE (Rule 103), and the wallet
// makes the dead position reachable a second way. The composition gate for it · practice.e2e.js's S45
// block · is the only thing in this repo that has ever caught it. So the seam gets named now, while it
// can still be designed against a condition rather than inferred from the source afterwards (Rule 65).
//
// A COMMENT WOULD HAVE BEEN THE OBVIOUS FORM AND IT IS THE WRONG ONE. Rule 105a: a test that is wrong
// goes red one day, a comment that is wrong goes red never. The day the wallet lands, a paragraph saying
// "remember the terminal fix" is read by nobody, whereas a biconditional reds by itself.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT IT ASSERTS · A BICONDITIONAL, WHICH IS WHY IT NEEDS NO SKIP AND CANNOT ROT
//
//     a per-player money field EXISTS   ⇔   the terminal condition REFERENCES it
//
//   today          false ⇔ false   passes, and reports ARMED so nobody reads it as coverage
//   wallet lands   true  ⇔ false   RED, naming the one-line fix the contract already committed to
//   both land      true  ⇔ true    passes, and now means something
//   fix without    false ⇔ true    RED · a dangling reference to a field nothing creates
//     the wallet
//
// Rule 115b says a guard for a dependency that has not landed must be ARMED, not silent · a guard that
// simply passes in that state is indistinguishable from one that agrees. Both states are asserted here.
//
// ⚠ AND IT DOES NOT HARDCODE THE FIELD NAME, WHICH WOULD BE A GUESS ABOUT SOMEBODY ELSE'S FUTURE CODE
// (Rule 125 · a discriminator you did not author is not your fingerprint). The contract says "wallet" 21
// times and "money" 13, and I am not the one who will choose. So the name is EXTRACTED from the player
// factory and then required in the terminal condition · both sides read the same source, so the guard
// cannot be wrong about the name, only about whether the two agree. If T2 calls it `funds`, this still
// works and no line of it needs editing.

/** Candidate identifiers for a per-player money field. Deliberately broad · this set decides only
 *  what the guard LOOKS for, never what it asserts, and a miss here shows up as ARMED rather than
 *  as a false green (the failure direction that gets noticed). */
export const MONEY_TOKENS = ['wallet', 'money', 'funds', 'coins', 'credits', 'balance']

/** Strip // and block comments so PROSE about money can never be read as a FIELD called money.
 *  Rule 116 · the composed answer is not what the text says; here the transform is "is this code".
 *  gameStore.js is ~40% commentary by line and every one of the six tokens appears in it today. */
export function stripComments(src) {
  return String(src ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** The body of a named function, brace-matched. Returns null when absent · an absence must never read
 *  as "no reference", so callers distinguish the two (see detectWalletSeam).
 *
 *  THREE DECLARATION FORMS, because the fix below follows delegation and a helper may be written any
 *  of these ways. Matching only `function NAME` would make the reader's coverage depend on somebody
 *  else's style choice, and then "I could not read it" and "it does not check money" become the same
 *  answer · which is the exact conflation this whole module exists to prevent (Rule 80). */
export function functionBody(src, name) {
  const code = stripComments(src)
  // ⚠ PRIORITY ORDER, NOT EARLIEST-IN-FILE, AND THE DIFFERENCE IS A BUG I SHIPPED FOR ONE PROBE RUN.
  // My first draft collected every pattern's index and took the SMALLEST. `maybeForceDeadlockEndgame(`
  // matches its own CALL SITE at gameStore.js:161, which is 113 lines ABOVE the declaration · so it
  // brace-matched from the caller and every arm of my probe came back identically false. Preamble §3
  // carries this exact sentence ("an idempotency guard that greps for a symbol matches its USES, not
  // its declaration") and I read it at boot, then introduced it an hour later while fixing a
  // different grep defect. What caught it was not rereading: it was that the answer was UNIFORM
  // across four inputs designed to differ, which is §3's own tell.
  const declarationPatterns = [
    `function ${name}`,   // function declaration
    `const ${name} =`,    // arrow assigned to a const
    `${name}: (`,         // object property arrow · how a zustand store method is written
    `${name}: function`,
  ]
  let start = -1
  for (const pat of declarationPatterns) {
    const i = code.indexOf(pat)
    if (i !== -1) { start = i; break }
  }
  if (start === -1) return null
  const open = code.indexOf('{', start)
  if (open === -1) return null
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') { depth--; if (depth === 0) return code.slice(open, i + 1) }
  }
  return null
}

/** Names this body CALLS · `foo(` where `foo` is not a keyword and not a member access. */
export function calledNames(body) {
  const out = new Set()
  for (const m of String(body ?? '').matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof'].includes(m[1])) out.add(m[1])
  }
  return [...out]
}

/**
 * The terminal condition's REACHABLE code · its own body plus ONE level of the local functions it
 * calls.
 *
 * ⚠ THIS IS THE FIX FOR A FALSE POSITIVE THAT WAS ALREADY SHAPING PRODUCTION CODE (T3 S69).
 * Council ordered the three spellings of affordability collapsed onto one helper. T2 declined to do
 * it to the terminal condition and said why, in a comment in gameStore.js: extracting the predicate
 * "leaves a body with no `wallet`, no `price` and no operator, so their biconditional goes from
 * `true ⇔ true` to `true ⇔ false` and REDS a shared gate for three lanes". They were right · measured
 * before this change, the collapsed form reported `ok=false` on correct code.
 *
 * So my guard was not merely capable of a false positive, it had ALREADY BEEN PAID: a colleague kept a
 * predicate inline, against their own design judgement and against Council's instruction, to keep my
 * grep green. That is worse than a gate that cries wolf · this one silently bought a worse design and
 * nobody would ever have seen the invoice (Rule 115 · ask of any guard what it FORBIDS and who was
 * relying on doing that).
 *
 * AND MY OWN PREAMBLE NAMES THE MECHANISM IN §1, IN THESE WORDS: "a grep cannot see DELEGATION.
 * solo-host looked like it never deleted its room and it calls a helper that does." I read that line
 * at boot this session, then measured this an hour later. A rule you have read does not protect the
 * code you wrote three sessions ago (Rule 119's corollary).
 *
 * ONE LEVEL, AND IT IS MEASURED RATHER THAN PICKED (T3 S70). I shipped this in S69 as a stated limit
 * with a counterweight and said in my own close that it was still "a limit I picked rather than
 * derived". Measured against the real gameStore, hops from an entry point to a body that COMPARES the
 * money field:
 *     maybeForceDeadlockEndgame   0      it compares inline today
 *     canAcquireCard              0      likewise · it calls cheapestAvailableCost for the PRICE, but
 *                                        the `wallet >= price` comparison is in its own body
 *     tryDrawCard                 0
 * So the collapse Council ordered · the terminal delegating to canAcquireCard · needs exactly ONE,
 * and one is what this does. Sufficient for the ordered design with zero margin, which is worth
 * knowing rather than guessing.
 *
 * WHAT MAKES THE MARGIN SAFE is that a name this cannot RESOLVE is reported in `unresolved` rather
 * than contributing nothing silently: "I could not read the helper" and "the helper does not check
 * money" are different findings with different fixes, and collapsing them is the Rule 80 failure this
 * module exists to avoid. So going a level deeper than this reads as UNMEASURED · loud, and one edit
 * to fix · never as a false green.
 */
export function reachableCode(src, terminalBody) {
  if (terminalBody === null) return { code: null, unresolved: [] }
  const unresolved = []
  let code = terminalBody
  for (const name of calledNames(terminalBody)) {
    const body = functionBody(src, name)
    if (body === null) unresolved.push(name)
    else code += `\n${body}`
  }
  return { code, unresolved }
}

/**
 * Does `field` participate in a COMPARISON anywhere in this code?
 *
 * LINE-SCOPED, NOT WHOLE-BODY, and that is the second defect fixed here. The old test was "the token
 * `price` appears somewhere in the body AND some comparison operator appears somewhere in the body" ·
 * two independent existence checks over a whole function, which is satisfied by a log line sitting
 * near an unrelated `if`. It also depended on the LOCAL VARIABLE being called `price`: renaming it to
 * `cost` reds the gate, and `cheapestAvailableCost` · the real function T2 now calls · does not match
 * `\bprice\b` at all. A discriminator that turns on somebody else's variable name is not mine to
 * assert (Rule 125).
 *
 * The claim I actually mean is "the money field is compared against something", so that is what is
 * measured. `=` alone is excluded so a destructure or an assignment cannot satisfy it.
 *
 * ⚠ PER LINE, NOT PER CHARACTER WINDOW · AND THE WINDOW WAS MY FIRST DRAFT, CAUGHT BY THE
 * COUNTERWEIGHT ON ITS FIRST RUN. I flattened the whitespace and looked for an operator within 80
 * characters of the field. Measured on the vacuity fixture · a body that logs the wallet and then
 * gates on `state.deck.length > 0` · the unrelated `>` sits THIRTY characters after `wallet` and the
 * check returned true. A character window cannot distinguish "compared" from "near something that is
 * compared", and 80 was a number I picked rather than measured, which is preamble §2's wire sized
 * from nothing.
 *
 * THE ERROR THIS BUYS, NAMED RATHER THAN LEFT (Rule 117b · "err strict" is not a direction): a body
 * that splits ONE comparison across two lines now reads as no gate, so the failure direction is a
 * FALSE RED. That is loud, it names the function, and it is one edit to fix. The opposite error is a
 * gate that passes on a body which mentions money and gates on nothing · silent, and the exact
 * vacuity this term exists to close. Buy the loud one.
 */
export function comparesField(code, field) {
  if (!code || !field) return false
  const NAME = new RegExp(`\\b${field}\\b`)
  const CMP = /[<>]=?|[=!]==/
  return String(code).split('\n').some(line => NAME.test(line) && CMP.test(line))
}

/**
 * @param {object} o
 * @param {string} o.storeSrc        src/store/gameStore.js
 * @param {string} o.playerFactory   the source region that builds a player object
 * @param {string} o.terminalFnName  the function carrying the dead-position early return
 * @returns {{ moneyField: string|null, terminalRefs: boolean, armed: boolean, ok: boolean,
 *             terminalBody: string|null, why: string }}
 */
export function detectWalletSeam({ storeSrc, playerFactory, terminalFnName }) {
  const factory = stripComments(playerFactory)
  // A FIELD, not a mention: `wallet:` or `wallet =`. `includes('wallet')` would match a variable, an
  // import, or the word in a template string · a substring match is an identity check with no
  // boundary (Rule 112), and I have shipped that defect inside a brand-new guard before.
  const moneyField = MONEY_TOKENS.find(t => new RegExp(`\\b${t}\\s*[:=]`).test(factory)) ?? null

  const terminalBody = functionBody(storeSrc, terminalFnName)
  const { code: reachable, unresolved } = reachableCode(storeSrc, terminalBody)
  // ⚠ A MENTION IS NOT A USE (T3 S66, at the moment the guard stopped being armed). `\bwallet\b`
  // appearing in the reachable code is satisfied by a log line, a destructure, or a comment that
  // survived stripping. The contract's clause is a COMPARISON, so the field must be compared against
  // something. Without this second term the biconditional could be satisfied by a body that names the
  // field and gates on nothing · the same mention-shaped vacuity that let a substring stand in for a
  // value in endgame-live (Rule 112's family, one level up).
  //
  // BOTH TERMS NOW READ `reachable`, NOT `terminalBody` · see reachableCode above for why, and for
  // what it cost before it was fixed.
  const mentionsField = moneyField !== null && reachable !== null
    ? new RegExp(`\\b${moneyField}\\b`).test(reachable)
    : false
  const comparesToField = comparesField(reachable, moneyField)
  const terminalRefs = mentionsField && comparesToField

  const armed = moneyField === null
  // "I could not read a helper it delegates to" is NOT "the helper does not check money", and the
  // second is only reportable when the first is empty. Surfaced so the caller can assert on it
  // instead of inheriting a false negative (Rule 80).
  const blind = !terminalRefs && unresolved.length > 0
  return {
    moneyField,
    terminalBody,
    reachable,
    unresolved,
    blind,
    terminalRefs,
    mentionsField,
    comparesToField,
    armed,
    // The biconditional. When armed, both sides are false and it holds trivially · which is exactly
    // why `armed` is reported separately and asserted by the caller rather than folded in here.
    ok: (moneyField !== null) === terminalRefs,
    why: armed
      ? `no per-player money field in the player factory · ARMED, NOT ASSERTING. Looked for ${MONEY_TOKENS.join('/')}`
      : terminalRefs
        ? `the wallet ('${moneyField}') has landed AND ${terminalFnName} gates on it` +
          (unresolved.length ? ` (unread delegates: ${unresolved.join(', ')})` : '') +
          ` · reachable code is the body plus ${calledNames(terminalBody ?? '').length} called name(s)`
        : blind
          ? `UNMEASURED · ${terminalFnName} does not gate on '${moneyField}' in code I can READ, and it ` +
            `delegates to ${unresolved.join(', ')}, which I could not resolve in this source. That is ` +
            'not the same finding as "it does not check money" and must not be reported as one.'
          : `'${moneyField}' exists on a player and ${terminalFnName} does not GATE on it (mentions=` +
            `${mentionsField}, comparesToField=${comparesToField}) · a player with cards in the deck ` +
            'and an empty wallet is exactly as stuck as one with an empty deck, and the dead-position ' +
            'check will decline to notice. See docs/WALLET_AND_DEMOLITION_CONTRACT.md §5.',
  }
}
