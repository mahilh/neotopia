import { describe, test, expect } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_CARDS } from './projectCards'

// T2 S42 · EVERY CARD HAS ART, AND THAT IS NOW A GATE RATHER THAN A FACT.
//
// Mahil completed the deck this session · all 56 images exist. The thing worth protecting is not the
// count, it is the FAILURE MODE: CardFrame.jsx:121 resolves art as `/art/cards/${card.id}.png`, and a
// missing file does not throw. It renders the procedural shimmer, which looks deliberate and reads as
// a design choice. So a card losing its art is invisible in the product, in the build, and in CI.
//
// That is the exact shape that let the art counter sit at 0/56 for about fifteen sessions while 20
// PNGs were on disk, and it is why check-art.js existing is not sufficient · a script nothing runs
// cannot report anything (Rule 79). This is the same audit as a merge gate.
//
// The mapping is also the historically fragile part: Drive ships `card7.png`, the deck wants
// `card_07`. A zero-padding slip produces exactly one silently-blank card.

const ART_DIR = join(process.cwd(), 'public', 'art', 'cards')

describe('card art', () => {
  // COUNTERWEIGHT FIRST (Rule 90). The cheap way to make every assertion below pass is to point the
  // check at a directory that does not exist, or to iterate an empty deck · both yield a green
  // vacuous suite. Written first, when there is nothing else here for it to hide behind.
  test('the audit is looking at a real deck and a real directory', () => {
    expect(PROJECT_CARDS.length, 'the deck is 56 and has been for the whole project').toBe(56)
    expect(existsSync(ART_DIR), `no art directory at ${ART_DIR} · every check below would pass vacuously`)
      .toBe(true)
    expect(readdirSync(ART_DIR).filter(f => f.endsWith('.png')).length,
      'the directory is empty · the checks below would still be green').toBeGreaterThan(0)
  })

  test('every card id resolves to a PNG · a 404 renders shimmer and looks intentional', () => {
    const missing = PROJECT_CARDS
      .filter(c => !existsSync(join(ART_DIR, `${c.id}.png`)))
      .map(c => `${c.id} (${c.name})`)
    expect(missing, `${missing.length} card(s) would render the placeholder instead of their art`)
      .toEqual([])
  })

  test('ids are zero-padded two-digit · the Drive-to-repo mapping slip', () => {
    // Drive holds cardN.png unpadded; the deck holds card_NN. card_7.png would 404 forever in silence.
    const wrong = PROJECT_CARDS.map(c => c.id).filter(id => !/^card_\d{2}$/.test(id))
    expect(wrong, 'a card id that is not card_NN cannot be produced by the sync script').toEqual([])
  })

  test('art stays inside its weight budget · a public repo and a phone both pay for this', () => {
    // The 20 originally-shipped PNGs were 320x320 / ~142 KB. The Drive masters are ~1.4 MB, so a raw
    // copy is a 10x regression that nothing else would notice: it does not fail, it just makes every
    // card slow and the repo huge. Bound is generous (400 KB) so this flags a PIPELINE change · a raw
    // master landing in the repo · rather than nagging about ordinary compression variance.
    const heavy = PROJECT_CARDS
      .map(c => ({ id: c.id, kb: Math.round(statSync(join(ART_DIR, `${c.id}.png`)).size / 1024) }))
      .filter(f => f.kb > 400)
    expect(heavy, 'these look like un-downscaled masters · re-run scripts/sync-card-art.cjs --apply')
      .toEqual([])
  })
})
