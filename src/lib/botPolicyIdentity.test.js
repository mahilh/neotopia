// BOT POLICY · DECISION IDENTITY  (T2 S50)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THIS FILE EXISTS TO BE WRITTEN BEFORE A REFACTOR, NOT AFTER ONE (Rule 90).
//
// S50 restructures botPolicy.js from three scattered `level === 'x'` string comparisons into a
// declarative POLICY TABLE, so the ladder's axes can be varied one at a time. That refactor's
// characteristic failure is not a crash and not a red win-rate gate · it is a SILENTLY DIFFERENT
// DECISION on some state nobody sampled, which would invalidate every measurement S39-S49 without
// changing a single test's colour. The existing botPolicy.test.js gates ORDER (architect beats
// builder beats apprentice); an order gate cannot see a policy that moved and stayed ordered.
//
// So this pins the actual decisions: the complete action trace of real seeded games, hashed. It is a
// characterisation test in the strict sense · it asserts WHAT THE CODE DOES, making no claim that any
// of it is correct. If a future session deliberately retunes a level, these constants are SUPPOSED to
// change, and the diff is the evidence that the change was deliberate and scoped to the level named.
//
// WHY A TRACE AND NOT A SCORE. An outcome fingerprint (final scores, tokens) collapses hundreds of
// decisions into three integers, so two different policies can agree on it by coincidence · and the
// coincidence is likeliest exactly where the change is small, which is the case this guard is for.
// The trace records every action's TYPE AND ARGUMENTS in order, so a single differing hex reddens it.
//
// THE REFERENCE POLICY IS PINNED HERE TOO, and that is the load-bearing one. botPolicy.js says
// ">>> DO NOT TUNE THESE TWO CONSTANTS. EVER. <<<" about the reference, because every rate ever
// recorded against it is void if it moves. Until now that instruction was a COMMENT · a comment
// cannot go red (Rule 105a). Now it can.

import { describe, it, expect } from 'vitest'
import { useGameStore, PRODUCTION_TILES } from '../store/gameStore'
import { PROJECT_CARDS } from './projectCards'
import { chooseBotAction, makeRng, DIFFICULTIES, REFERENCE_POLICY } from './botPolicy'

const api = () => useGameStore.getState()

const shuffled = (arr, rng) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// FNV-1a over the trace. Any deterministic digest would do; this one is four lines and has no import.
function digest(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

// Play one game and return { trace, actions } · the trace is every decision, fully argument-qualified.
// This drives the SAME loop the balance harness uses (ladderHarness.playOnce) rather than a
// simplified stand-in, because a harness that models the caller instead of being it is how the draw
// harnesses rotted for a whole session (Rule 36 / Rule 97).
function traceGame(levels, seed) {
  useGameStore.setState(useGameStore.getInitialState(), true)
  const rng = makeRng(seed)
  const configs = levels.map((difficulty, i) => ({ userId: null, username: `B${i}`, isBot: true, difficulty }))
  api().initGame(configs, shuffled(PROJECT_CARDS, rng), shuffled(PRODUCTION_TILES, rng))

  let lastPlacedKey = null
  const parts = []
  for (let i = 0; i < 4000 && api().phase === 'playing'; i++) {
    const seat = api().currentSeat
    const a = chooseBotAction({
      state: api(), seat, difficulty: levels[seat],
      getValidPlacements: api().getValidPlacements, getBuildableCards: api().getBuildableCards,
      lastPlacedKey, rng,
    })
    // Every field that distinguishes one action from another. A placement that moved by one hex, a
    // card scored into a different region, or a draw that switched from offer to deck all change this.
    parts.push([seat, a.type, a.cardId ?? '', a.regionId ?? '', a.elementType ?? '',
      a.q ?? '', a.r ?? '', a.source ?? '', a.cardIndex ?? ''].join(':'))

    if (a.type === 'placeElement') { api().placeElement(seat, a.factoryId, a.elementType, a.q, a.r, a.regionId); lastPlacedKey = `${a.q},${a.r}` }
    else if (a.type === 'scoreCard') { api().scoreCard(seat, a.cardId, a.regionId, a.lastPlacedKey); lastPlacedKey = null }
    else if (a.type === 'drawCard') api().drawCard(seat, a.source, a.cardIndex)
    else { api().endTurn(); lastPlacedKey = null }
  }
  return { trace: digest(parts.join('|')), actions: parts.length }
}

// Each level is fingerprinted IN BOTH SEATS against the frozen reference, over two seeds. Both seats
// matters: seat 0 moves first, and a policy that differs only in how it responds to a board someone
// else has already touched would hide in a seat-0-only sample.
const FIXTURES = [
  { name: 'apprentice v reference', levels: ['apprentice', REFERENCE_POLICY], seed: 11 },
  { name: 'reference v apprentice', levels: [REFERENCE_POLICY, 'apprentice'], seed: 11 },
  { name: 'builder v reference', levels: ['builder', REFERENCE_POLICY], seed: 12 },
  { name: 'reference v builder', levels: [REFERENCE_POLICY, 'builder'], seed: 12 },
  { name: 'architect v reference', levels: ['architect', REFERENCE_POLICY], seed: 13 },
  { name: 'reference v architect', levels: [REFERENCE_POLICY, 'architect'], seed: 13 },
  { name: 'reference v reference', levels: [REFERENCE_POLICY, REFERENCE_POLICY], seed: 14 },
]

// MEASURED AT 3994d8d, BEFORE the S50 policy-table refactor. Regenerate deliberately, never to make
// a red run green: `EXPECTED` printing on failure is the whole diff.
//
// SENSITIVITY, MEASURED RATHER THAN ASSUMED (three mutations, on a baseline verified green first ·
// Rule 110b). The guard catches a ONE PERCENT move on a single axis, which is the smallest change
// anyone would plausibly make. But it does not catch it in every fixture, and that is the useful
// half: `builder.drawBias 0.30 -> 0.31` reddened `reference v builder` ALONE, because a 1% change to
// a threshold only alters a decision on the games where rng() happened to land inside the 1% window
// that moved. Likewise `reference.drawBias 0.25 -> 0.26` reddened three of its six fixtures.
// So the SET is the instrument and no single fixture is (Rule 100) · which is why every level is
// pinned in BOTH SEATS and why the coverage test below refuses to let a new level ship unpinned.
// `builder.scoreEager true -> false` reddened both builder fixtures and neither reference-only one,
// which is the negative direction: a change to one level must not red another's fingerprint.
// ⚠ FOUR OF THESE WERE DELIBERATELY REGENERATED IN S50 WHEN THE LADDER WAS RETUNED, and the old
// values are kept beside the new ones because the DIFF is the evidence (Rule 101b · keep the history,
// change the claim). This is what a legitimate regeneration looks like: it is scoped, it is
// predicted BEFORE it is run, and the prediction is what makes it a check rather than a rubber stamp.
//
//   PREDICTED  : v2 moves apprentice and architect and leaves builder and the reference alone.
//   MEASURED   : exactly four fixtures red · both apprentice, both architect. The three fixtures that
//                contain only builder and/or the reference stayed GREEN, unchanged from 3994d8d.
//
// That is the proof of the two scoping claims POLICIES makes in prose · "builder is byte-identical"
// and "the reference is frozen" · and it is a proof rather than an assertion precisely because these
// digests were recorded BEFORE the retune was written. A fingerprint captured after a change can only
// ever agree with it.
//
//   fixture                     v1 (3994d8d)          v2 (S50)
//   apprentice v reference      81e67bf5 / 106        49732a79 / 133
//   reference v apprentice      20b93863 /  95        ba48508d / 121
//   architect  v reference      a1829fa3 / 167        923b77a5 / 148
//   reference v architect       376ed07c / 167        262a7c86 / 147
//   builder    v reference      61a3891b / 137        UNCHANGED
//   reference v builder         2cb4bc5d / 122        UNCHANGED
//   reference v reference       03203fc9 / 135        UNCHANGED
//
// The action counts are readable as a sanity check on direction: apprentice's games got LONGER (106
// -> 133) because it now takes cards at builder's rate instead of almost never, and architect's got
// SHORTER (167 -> 148) because its draw bias came down from 0.55 to 0.39.
const EXPECTED = {
  'apprentice v reference': { trace: '49732a79', actions: 133 },
  'reference v apprentice': { trace: 'ba48508d', actions: 121 },
  'builder v reference': { trace: '61a3891b', actions: 137 },
  'reference v builder': { trace: '2cb4bc5d', actions: 122 },
  'architect v reference': { trace: '923b77a5', actions: 148 },
  'reference v architect': { trace: '262a7c86', actions: 147 },
  'reference v reference': { trace: '03203fc9', actions: 135 },
}

describe('bot policy · decision identity across the S50 refactor', () => {
  // COUNTERWEIGHT, FIRST AND ON ITS OWN. The wrong way to satisfy every assertion below is a trace
  // function that cannot distinguish anything · one that returns a constant, or that hashes only the
  // action COUNT, or that silently records zero actions because the game never left 'playing'. All
  // three would pin seven identical digests and look like a thorough guard.
  //
  // So before pinning anything: two levels that genuinely differ must produce DIFFERENT digests, and
  // every game must actually have been played.
  it('the fingerprint can tell two policies apart at all (vacuity guard)', () => {
    const a = traceGame(['apprentice', REFERENCE_POLICY], 11)
    const b = traceGame(['architect', REFERENCE_POLICY], 11)
    const same = traceGame(['apprentice', REFERENCE_POLICY], 11)

    expect(a.actions, 'a traced game with zero actions would make every digest below identical and ' +
      'meaningless · the loop never entered, or the phase was not "playing"').toBeGreaterThan(50)
    expect(a.trace, 'apprentice and architect must not hash the same · if they do, this instrument ' +
      'is measuring nothing and no assertion in this file has any force').not.toBe(b.trace)
    expect(same.trace, 'the same policy on the same seed must reproduce EXACTLY · without this the ' +
      'digests below would be a record of one run rather than a property of the code').toBe(a.trace)
  })

  it.each(FIXTURES)('$name · decisions are byte-identical to 3994d8d', ({ name, levels, seed }) => {
    const got = traceGame(levels, seed)
    expect({ name, ...got }).toEqual({ name, ...EXPECTED[name] })
  })

  it('every DIFFICULTY and the reference are covered by a fixture', () => {
    // Rule 100: a guard whose subject is a NAME cannot notice a sibling. Adding a fourth difficulty
    // without a fixture must red HERE rather than quietly ship unpinned.
    const covered = new Set(FIXTURES.flatMap(f => f.levels))
    for (const d of [...DIFFICULTIES, REFERENCE_POLICY]) {
      expect(covered.has(d), `${d} has no identity fixture · add one to FIXTURES`).toBe(true)
    }
  })
})
