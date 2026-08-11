// THE TIMING PROMISE AUDIT · WHAT THE COPY CLAIMS vs WHAT THE PRODUCT DOES (T1 S52).
//
// ── THE FINDING, MEASURED IN A BROWSER RATHER THAN READ ───────────────────────────────────────────
// Three places tell the player a turn is time-limited, and a fourth counts it down live:
//     Tutorial step 1     "You have {TURN_TIME_LIMIT} seconds per turn."
//     Tutorial mode chip  "{TURN_TIME_LIMIT}s per turn · {END_GAME_TILE} tiles"
//     Lobby mode card     "{END_GAME_TILE} tiles · {TURN_TIME_LIMIT}s turns"
//     ActionBar           a per-second readout and a shrinking bar
// NOTHING ENFORCES IT. Sat on a real practice board and did not touch anything:
//     t=  0s  myTurn=true  timer 90
//     t= 30s  myTurn=true  timer 60
//     t= 60s  myTurn=true  timer 30
//     t= 90s  myTurn=true  timer  0
//     t=130s  myTurn=true  timer  0   · turnNumber and currentSeat UNCHANGED throughout
// The turn never expires. Worse than merely unenforced: the readout goes RED under 10s, reaches 0,
// empties its bar and STAYS there, so it looks exactly like a turn that has run out while the player
// still holds it. A promise that is silently not kept is one thing; one with a live animation
// counting down to nothing is a different and louder thing.
//
// GameRoom.jsx:244 does say "DISPLAY ONLY" in a comment. That is not why this file believes it · a
// comment that is wrong goes red never (Rule 105a), and whether a turn expires is a COMPOSITION
// question (timer -> store -> seat advance), which is exactly the shape a source read cannot answer
// (Rule 116). The 130 seconds above are the evidence.
//
// ── WHAT THIS FILE DOES AND DELIBERATELY DOES NOT DO ─────────────────────────────────────────────
// It does NOT change the copy, and it does NOT go red. T3 is building the turn timeout this session,
// which will make all four of these statements TRUE. Editing the copy to remove the promise now
// would have to be reverted next session, and reddening the shared merge gate for a defect in
// another lane is a tripwire aimed at a colleague (Rule 103b).
// What it DOES is the prerequisite: pin every timing statement to the SINGLE SOURCE, so that when
// the timeout lands and the number is tuned, the tutorial, the chip, the lobby card and the bar all
// move together instead of three of them quietly becoming lies.
//
// ⚠ WHEN T3'S TIMEOUT LANDS, THIS HEADER IS A FALSE CLAIM AND MUST BE REWRITTEN, not deleted: the
// measurement above is the argument for whatever the new assertion is (Rule 101b).

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
