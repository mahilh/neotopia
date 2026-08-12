// THE TIMING PROMISE AUDIT · WHAT THE COPY CLAIMS vs WHAT THE PRODUCT DOES.
//
// ── S57 · THE PROMISE IS NOW TRUE, AND THE HEADER IS REWRITTEN RATHER THAN DELETED (Rule 101b) ───
// S52 measured that nothing enforced it. S53 found it was mode-dependent. T3 shipped both halves in
// S56 · the `players.length > 1` predicate and practice seat resolution together · and I verified it
// at COMMITTED HEAD in a detached worktree, because the shared tree carried their newer uncommitted
// edits (preamble §5):
//     practice + 1 bot   turn ends at EXACTLY 90s   · the promise is kept
//     solo, 0 bots       no expiry within 105s      · the carve-out, by design
// The 90 rather than 95 is the seat fix working. I measured that divergence in S56 from the artifact
// (practice seats carry local-human while the clock read user?.id, so Classic would have ended at
// 95s and Flow at 17.25s) and handed it over before they shipped; this is the confirmation.
//
// ── AND THE ONE CASE THE PREDICATE EXEMPTS WAS SAYING SOMETHING FALSE ────────────────────────────
// Solo has no clock by design. The Tutorial said "You have 90 seconds per turn" there anyway · and
// PracticeStart OPENS ON `bots: 0`, so that is the default option and the first thing a first-timer
// meets. The sentence is now conditional on the SAME predicate the clock uses, read from the same
// store, so the two cannot drift.
// ⚠ THIS REVERSES MY OWN S54 DETERMINATION ("change nothing"), and the fact changed rather than my
// mind: in S54 practice had NO clock at all, so a conditional promise would have taught a different
// game from the one about to be played. Now the clock runs in every practice mode that IS a game,
// and the only exemption is the one the product already calls "Free exploration · learn the board".
//
// WHAT SURVIVES UNCHANGED, and it is why this file was worth writing before any of it existed: every
// timing statement reads TURN_TIME_LIMIT from getModeConfig. That is what let Classic AND Flow become
// correct simultaneously without editing a single number.
//
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { GAME_MODES, getModeConfig } from '../store/gameConfig'

const SRC = path.resolve(__dirname, '..')
const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8')

// Files that make a timing statement to the player. Named explicitly, and the list is checked
// against the tree below so a NEW one cannot join silently (Rule 100 · a guard whose subject is a
// name cannot notice a sibling).
const SPEAKERS = ['components/Tutorial.jsx', 'pages/Lobby.jsx', 'components/ActionBar.jsx']

describe('counterweight · the audit is looking at files that actually speak', () => {
  it('every named speaker exists and mentions a turn budget', () => {
    for (const f of SPEAKERS) {
      const src = read(f)
      expect(src.length, `${f} is empty`).toBeGreaterThan(200)
      expect(src, `${f} no longer says anything about turn time · either it was removed (then take ` +
        'it off this list) or this audit is pointed at the wrong file')
        .toMatch(/TURN_TIME_LIMIT|turnTimeLimit|turnTimeRemaining/)
    }
  })

  it('and no OTHER file in the tree has started making one', () => {
    // The audit's scope is a claim too. A fourth place printing a hardcoded turn budget is exactly
    // what this is meant to prevent, and it would be invisible to a list of three.
    //
    // ⚠ THE FIRST VERSION OF THIS COULD NOT MATCH THE STRING IT NAMES, and only a mutation said so.
    // It searched /\b(seconds per turn|s per turn|s turns)\b/ · and in "90s per turn" there is NO
    // word boundary between the `0` and the `s`, because both are word characters. So the guard
    // written to catch a hardcoded "90s per turn" was blind to precisely that, while matching a
    // form nobody writes. Rule 112's shape (a boundary assumption inside an instrument) in the one
    // assertion here whose whole job is to notice something new.
    // The patterns below require a TIME UNIT before the phrase, which is also what keeps them off
    // "Three actions per turn" · a real line in both the Tutorial and the Landing page that is not
    // a timing promise at all.
    const PROMISE = [
      /\d+\s*s(?:econds)?\s+(?:per\s+turn|turns)/i,   // "90s per turn" · "90 seconds per turn"
      /\}\s*s(?:econds)?\s+(?:per\s+turn|turns)/i,    // "{cfg.TURN_TIME_LIMIT}s per turn"
    ]
    const walk = (dir, out = []) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p, out)
        else if (/\.jsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
      }
      return out
    }
    const offenders = walk(SRC)
      .filter(f => /\/(components|pages)\//.test(f))
      .filter(f => !SPEAKERS.some(s => f.endsWith(s)))
      .filter(f => { const src = fs.readFileSync(f, 'utf8'); return PROMISE.some(re => re.test(src)) })
      .map(f => path.relative(SRC, f))
    expect(offenders, 'a new timing promise appeared outside the audited set').toEqual([])

    // AND THE PATTERNS MUST MATCH THE THING THEY NAME · asserted here rather than trusted, because
    // the version that could not was green for exactly as long as nobody mutated it.
    expect(PROMISE.some(re => re.test('// 90s per turn')), 'the guard cannot see "90s per turn"').toBe(true)
    expect(PROMISE.some(re => re.test('You have 90 seconds per turn.')), 'cannot see "90 seconds per turn"').toBe(true)
    expect(PROMISE.some(re => re.test('{cfg.TURN_TIME_LIMIT}s per turn')), 'cannot see the interpolated form').toBe(true)
    expect(PROMISE.some(re => re.test('Three actions per turn. That\'s it.')),
      'the guard fires on a line that is NOT a timing promise · it would condemn the Landing page')
      .toBe(false)
  })
})

describe('every timing promise reads the single source', () => {
  // THIS IS THE PREREQUISITE FOR T3'S TIMEOUT. When the timeout lands, whoever tunes the number
  // changes gameConfig. If any of these had retyped "90", that one becomes a lie the same day and
  // nothing goes red · which is how a product ends up promising two different numbers.
  it.each(SPEAKERS)('%s prints the config value, never a literal', (f) => {
    const src = read(f)
    expect(src, `${f} interpolates a turn budget from somewhere other than config`)
      .toMatch(/TURN_TIME_LIMIT|turnTimeLimit/)
    // The literal forms that would silently diverge. `90` alone is far too common to ban, so this
    // bans it where it is a CLAIM: next to the words a player reads.
    expect(src, `${f} hardcodes a turn budget in copy`).not.toMatch(
      /\b\d+\s*(?:s|seconds)\s+(?:per\s+turn|turns)\b/)
  })

  it('the two modes really do differ · a shared constant would make the audit pointless', () => {
    // If Classic and Flow had the same budget, "reads from config" would be unfalsifiable · every
    // hardcoded value would happen to be right. They differ, so the claim has teeth.
    const classic = getModeConfig('classic').TURN_TIME_LIMIT
    const flow = getModeConfig('flow').TURN_TIME_LIMIT
    expect(classic).toBeGreaterThan(0)
    expect(flow).toBeGreaterThan(0)
    expect(flow, 'Flow and Classic share a turn budget · then no copy can be wrong about it')
      .not.toBe(classic)
    expect(Object.keys(GAME_MODES)).toEqual(expect.arrayContaining(['classic', 'flow']))
  })
})

describe('the promise is conditional on the CLOCK, not on a mode name', () => {
  // The failure this prevents is a second predicate. If the Tutorial decided "is this timed?" its own
  // way · practice-vs-multiplayer, or a bots count · it would be a second rules engine that agrees
  // today and drifts the first time the clock's condition changes (Rule 45). Both read
  // players.length from the same store.
  it('the Tutorial derives it from players.length, exactly as useGameSync does', () => {
    const tut = read('components/Tutorial.jsx')
    expect(tut, 'the Tutorial invented its own notion of "timed"').toMatch(
      /useGameStore\(st => \(st\.players\?\.length \?\? 0\) > 1\)/)
    expect(tut, 'the timing sentence is unconditional again · it is false in solo, which is the ' +
      'DEFAULT practice option').toMatch(/timed \?/)
  })

  it('and the clock uses that same predicate', () => {
    const sync = fs.readFileSync(path.resolve(SRC, 'hooks/useGameSync.js'), 'utf8')
    expect(sync, 'the clock no longer keys on players.length · the Tutorial is now describing a ' +
      'condition that does not govern anything').toMatch(/players\?\.length \?\? 0\) < 2\) return/)
  })

  it('counterweight · solo really is the exempt case, not an empty distinction', () => {
    // If the clock ran for one seat too, "no clock on your own" would be a lie in the other
    // direction · and this whole conditional would be worse than the sentence it replaced.
    const sync = fs.readFileSync(path.resolve(SRC, 'hooks/useGameSync.js'), 'utf8')
    expect(sync).toMatch(/PRACTICE_HUMAN_ID/)   // seat resolution shipped with it
    expect(sync.indexOf('< 2) return'), 'the guard is gone').toBeGreaterThan(0)
  })
})

describe('the countdown is honest about being a countdown', () => {
  it('the bar and the readout are driven by the same value · not two clocks', () => {
    // Two independently-computed clocks is the Rule 45 shape and it drifts in front of the player.
    const src = read('components/ActionBar.jsx')
    const bar = src.match(/width:\s*`\$\{[^`]*turnTimeRemaining[^`]*\}%`/)
    expect(bar, 'the progress bar is not computed from turnTimeRemaining').toBeTruthy()
    expect(src, 'the readout is not computed from turnTimeRemaining').toMatch(
      /\{Math\.ceil\(turnTimeRemaining\)\}s/)
    expect(src, 'aria-valuenow must carry the same number a sighted player reads').toMatch(
      /aria-valuenow=\{Math\.ceil\(turnTimeRemaining\)\}/)
  })
})
