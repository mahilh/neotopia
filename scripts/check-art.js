// NeoTopia · card-art audit. Lists which of the 56 cards have a PNG and which still render the
// procedural sacred-geometry placeholder (CardFrame loads /art/cards/<card.id>.png · T1 S13).
// Run: node scripts/check-art.js
// Authorized scripts/ carve-out for T1 S14 · read-only · does NOT touch the bot or any T2 file.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROJECT_CARDS } from '../src/lib/projectCards.js'

// Resolve relative to THIS file so the audit works from any working directory.
const artPath = (id) => fileURLToPath(new URL(`../public/art/cards/${id}.png`, import.meta.url))

const withArt = PROJECT_CARDS.filter(c => existsSync(artPath(c.id)))
const missing = PROJECT_CARDS.filter(c => !existsSync(artPath(c.id)))

console.log(`\nNeoTopia card art: ${withArt.length}/${PROJECT_CARDS.length} cards have PNG art`)
if (withArt.length) console.log('Have art:', withArt.map(c => c.id).join(', '))
if (missing.length) {
  console.log(`\nMissing (${missing.length}) · still on the procedural placeholder:`)
  console.log(missing.map(c => `  ${c.id} · ${c.name}`).join('\n'))
}
console.log('')
