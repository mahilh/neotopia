// NeoTopia · CARD ART SYNC · Drive `cardN.png` (unpadded) → public/art/cards/card_NN.png (zero-padded).
// Run: node scripts/sync-card-art.cjs           (report only · downloads nothing)
//      node scripts/sync-card-art.cjs --apply   (download + downscale + write)
//
// THE MAPPING IS THE WHOLE JOB, and it is where this silently goes wrong. Drive holds `card7.png`;
// CardFrame.jsx:121 resolves art as `/art/cards/${card.id}.png` and the ids are `card_07`. A card whose
// PNG 404s does not error · it renders the procedural shimmer placeholder, which looks deliberate. So a
// gap in this mapping is invisible by construction: the same absence-looks-like-a-value shape that let
// the art counter read 0/56 for fifteen sessions while 20 PNGs sat on disk. This script therefore
// reports GAPS, COLLISIONS and STRAYS as its primary output, and the copy is the side effect.
//
// SIZE IS A CONTRACT, NOT A PREFERENCE. The 20 shipped PNGs are 320x320 and average 142 KB. The Drive
// originals average ~1.4 MB · 10x · so copying them raw would put ~78 MB of binary into a PUBLIC repo
// and ship a 1.4 MB image per card to every player. We downscale to the established 320x320 and report
// the achieved size so a regression against that contract is visible rather than discovered later.

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { google } = require('googleapis')

const FOLDER_ID = '1mAMAeriwZSlrTJTFczFX56HCasvUQfyo'
const KEY_FILE = path.join(__dirname, '../.claude/service-account-key.json')
const OUT_DIR = path.join(__dirname, '../public/art/cards')
const TMP_DIR = path.join(__dirname, '../.art-tmp')
const EDGE = 320
const APPLY = process.argv.includes('--apply')

// The deck is the source of truth for WHICH ids must exist · not a hardcoded 1..56 (Rule 91: do not
// read a count off a position when the real list is right there).
function deckIds() {
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/projectCards.js'), 'utf8')
  return [...src.matchAll(/id: '(card_\d+)'/g)].map(m => m[1])
}

async function main() {
  const ids = deckIds()
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() })

  let files = [], pageToken
  do {
    const r = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,size,mimeType)', pageSize: 200, pageToken,
    })
    files.push(...r.data.files); pageToken = r.data.nextPageToken
  } while (pageToken)

  // Map Drive name → target id. Anything that is not cardN.png is a STRAY and is reported, never guessed at.
  const byTarget = new Map(), strays = []
  for (const f of files) {
    const m = /^card(\d+)\.png$/i.exec(f.name)
    if (!m || !f.mimeType.startsWith('image/')) { strays.push(f.name); continue }
    const target = `card_${String(Number(m[1])).padStart(2, '0')}`
    if (!byTarget.has(target)) byTarget.set(target, [])
    byTarget.get(target).push(f)
  }

  const collisions = [...byTarget.entries()].filter(([, v]) => v.length > 1)
  const missing = ids.filter(id => !byTarget.has(id))
  const extra = [...byTarget.keys()].filter(t => !ids.includes(t))

  console.log(`\nDrive folder: ${files.length} files · ${byTarget.size} map to a card id`)
  console.log(`Deck: ${ids.length} cards`)
  if (strays.length) console.log(`\n⚠️  STRAYS (not cardN.png · ignored): ${strays.join(', ')}`)
  if (collisions.length) {
    console.log(`\n❌ COLLISIONS · two Drive files claim one id · REFUSING to guess which wins:`)
    collisions.forEach(([t, v]) => console.log(`   ${t} ← ${v.map(f => f.name).join(' + ')}`))
  }
  if (missing.length) console.log(`\n❌ NO DRIVE FILE for ${missing.length}: ${missing.join(', ')}`)
  if (extra.length) console.log(`\n⚠️  Drive file with no card in the deck: ${extra.join(', ')}`)

  if (!APPLY) {
    console.log(`\n(report only · re-run with --apply to download and write)\n`)
    return process.exit(collisions.length || missing.length ? 1 : 0)
  }
  if (collisions.length) { console.log('\nRefusing to apply with unresolved collisions.\n'); process.exit(1) }

  fs.mkdirSync(TMP_DIR, { recursive: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })
  let written = 0, totalBytes = 0
  for (const id of ids) {
    const f = byTarget.get(id)?.[0]
    if (!f) continue
    const tmp = path.join(TMP_DIR, `${id}.src.png`)
    const out = path.join(OUT_DIR, `${id}.png`)
    const res = await drive.files.get({ fileId: f.id, alt: 'media' }, { responseType: 'arraybuffer' })
    fs.writeFileSync(tmp, Buffer.from(res.data))
    // sips ships with macOS · no new dependency for a one-off pipeline.
    execFileSync('sips', ['-Z', String(EDGE), tmp, '--out', out], { stdio: 'ignore' })
    const kb = fs.statSync(out).size
    totalBytes += kb; written++
    process.stdout.write(`\r  ${written}/${byTarget.size} · ${id} · ${Math.round(kb / 1024)} KB   `)
  }
  fs.rmSync(TMP_DIR, { recursive: true, force: true })
  console.log(`\n\n✅ wrote ${written} · avg ${Math.round(totalBytes / written / 1024)} KB · total ${(totalBytes / 1048576).toFixed(1)} MB`)
  console.log('   verify with: node scripts/check-art.js\n')
}

main().catch(e => { console.error('\n💥 ' + e.message + '\n'); process.exit(1) })
