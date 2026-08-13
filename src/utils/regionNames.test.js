// THE REGION IS NAMED IN ONE PLACE (T1 S63).
//
// WHY THIS FILE EXISTS. Renaming the three districts found SEVEN independent hand-written copies of
// their identity in shipped code: hexUtils.REGIONS, FinalScore's two arrays, GameRoom's constant AND
// two more inline arrays inside its own JSX, ProjectCard's colour map, ElementIcon's lore table, and
// gameStore's own region objects. Every one of them was correct on the day it was written. That is
// Rule 45 seven times over, and the failure it produces is the specific one Mahil named: a control,
// a score row or a screen-reader announcement naming a region the board no longer shows.
//
// The proof that it was not theoretical: getClusterDetail stamps `regionName` off the STORE's copy,
// and the score screen rendered that string. Renaming hexUtils alone would have shipped a board
// saying "Water District" over a cluster row saying "Sacred City", with nothing red.
//
// A GUARD APPLIED TO ONE MEMBER OF A CLASS ROTS THE MOMENT THE CLASS GROWS (Rule 100), so this
// ENUMERATES: it walks shipped source and fails on any file that writes a region name as a literal.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REGIONS, TERRAIN } from './hexUtils'

const SRC = path.resolve(__dirname, '..')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(js|jsx)$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) out.push(p)
  }
  return out
}

// Comment lines are excluded on purpose. A comment naming an old region is a HISTORY note and this
// repo keeps those deliberately (Rule 101b · keep the history, change the claim). What must not
// survive is a literal in a position that can REACH A PLAYER.
const codeLines = (src) => src.split('\n')
  .map((l, i) => ({ n: i + 1, t: l }))
  .filter(({ t }) => !/^\s*(\/\/|\*|\/\*)/.test(t))

describe('counterweight · the scanner is looking at real shipped code', () => {
  // Written first (Rule 90). Every assertion below is an ABSENCE, and an absence is the cheapest
  // thing in the world to observe by accident · a scanner pointed at an empty list, a wrong root or
  // a filter that excludes everything reports a clean repo forever (Rule 120).
  const files = walk(SRC)

  it('finds the files it is supposed to be reading', () => {
    expect(files.length, 'the walk found nothing · every assertion in this file would be vacuous')
      .toBeGreaterThan(30)
    for (const must of ['components/Board/GameBoard.jsx', 'components/FinalScore.jsx', 'pages/GameRoom.jsx']) {
      expect(files.some(f => f.endsWith(must)), `${must} is not in the scan · it holds region names`).toBe(true)
    }
  })

  it('and it can still SEE a literal when there is one to see', () => {
    // The positive control has to exercise the MECHANISM, not merely provoke the same verdict
    // (Rule 130b). So it runs the real matcher over a synthetic line that a real file could contain.
    const matcher = (line) => REGIONS.some(r => line.includes(`'${r.name}'`) || line.includes(`"${r.name}"`))
    expect(matcher(`const x = ['${REGIONS[0].name}', 'other']`), 'the matcher cannot see a literal').toBe(true)
    expect(matcher('const x = REGIONS.map(r => r.name)'), 'the matcher fires on a legitimate read').toBe(false)
  })
})

describe('one source for the district names', () => {
  it('no shipped file writes a region name as a string literal · hexUtils is the only source', () => {
    const offenders = []
    for (const f of walk(SRC)) {
      if (f.endsWith(path.join('utils', 'hexUtils.js'))) continue     // the declaration itself
      for (const { n, t } of codeLines(fs.readFileSync(f, 'utf8'))) {
        for (const r of REGIONS) {
          if (t.includes(`'${r.name}'`) || t.includes(`"${r.name}"`)) {
            offenders.push(`${path.relative(SRC, f)}:${n} writes "${r.name}" as a literal`)
          }
        }
      }
    }
    expect(offenders, 'a second copy of a region name. Import REGIONS from utils/hexUtils and read ' +
      'it · a literal here is a rename that half-lands, silently, in whichever surface nobody ' +
      'happened to open:\n  ' + offenders.join('\n  ')).toEqual([])
  })

  it('every district name STARTS with its own terrain · the name is the label the board draws', () => {
    // The whole argument for the rename is that the name says what the place is made of, which is
    // what let the board drop its second label row. If the two ever decouple, the board silently
    // goes back to naming a region something its ground contradicts · which is exactly the state
    // src/lib/terrainBiomes.js has been in, unnoticed, since S10, because nothing consumed it.
    for (const r of REGIONS) {
      const terrain = TERRAIN[r.terrain]
      expect(terrain, `region ${r.id} claims terrain "${r.terrain}" which does not exist`).toBeTruthy()
      expect(r.name.toLowerCase().startsWith(terrain.name.toLowerCase()),
        `"${r.name}" does not start with its terrain "${terrain.name}" · the board draws ONE line per ` +
        'region now and it is this name, so a player would be told the place is something the ground is not')
        .toBe(true)
    }
  })

  it('the three names are distinct and none is a prefix of another', () => {
    // A prefix would make the literal-scan above ambiguous AND would make any substring match on a
    // name wrong (Rule 112 · a substring match is an identity check with no boundary).
    const names = REGIONS.map(r => r.name)
    expect(new Set(names).size, 'two regions share a name').toBe(names.length)
    for (const a of names) for (const b of names) {
      if (a !== b) expect(b.startsWith(a), `"${a}" is a prefix of "${b}"`).toBe(false)
    }
  })
})
