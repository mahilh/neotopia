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

/** The body of a named function declaration, brace-matched. Returns '' when absent · an absence must
 *  never read as "no reference", so callers distinguish the two (see detectWalletSeam). */
export function functionBody(src, name) {
  const code = stripComments(src)
  const start = code.indexOf(`function ${name}`)
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
  const terminalRefs = moneyField !== null && terminalBody !== null
    ? new RegExp(`\\b${moneyField}\\b`).test(terminalBody)
    : false

  const armed = moneyField === null
  return {
    moneyField,
    terminalBody,
    terminalRefs,
    armed,
    // The biconditional. When armed, both sides are false and it holds trivially · which is exactly
    // why `armed` is reported separately and asserted by the caller rather than folded in here.
    ok: (moneyField !== null) === terminalRefs,
    why: armed
      ? `no per-player money field in the player factory · ARMED, NOT ASSERTING. Looked for ${MONEY_TOKENS.join('/')}`
      : terminalRefs
        ? `the wallet ('${moneyField}') has landed AND ${terminalFnName} accounts for it`
        : `'${moneyField}' exists on a player and ${terminalFnName} does NOT reference it · a player with ` +
          'cards in the deck and an empty wallet is exactly as stuck as one with an empty deck, and the ' +
          'dead-position check will decline to notice. See docs/WALLET_AND_DEMOLITION_CONTRACT.md §5.',
  }
}
