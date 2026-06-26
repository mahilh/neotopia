// scripts/generate-art.js
// NeoTopia automated card art generation via OpenAI gpt-image-2
//
// SETUP (one-time, 3 minutes):
// 1. Go to https://platform.openai.com/api-keys
// 2. Sign in (use same Google as ChatGPT)
// 3. Create new API key
// 4. Add to .env.local: OPENAI_API_KEY=sk-...
// 5. Add $10 credit at platform.openai.com/settings/billing
//
// RUN:
//   node scripts/generate-art.js
//   node scripts/generate-art.js --dry-run  (shows prompts only, no generation)
//   node scripts/generate-art.js --card stellar-observatory  (single card)
//
// OUTPUT: public/art/cards/[card-id].png
// Claude Code will auto-detect and integrate these into card components

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')

// Load env
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8').trim().split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
)

const DRY_RUN = process.argv.includes('--dry-run')
const SINGLE_CARD = process.argv.includes('--card') ? process.argv[process.argv.indexOf('--card') + 1] : null

if (!env.OPENAI_API_KEY && !DRY_RUN) {
  console.error('\nMissing OPENAI_API_KEY in .env.local')
  console.error('Setup: https://platform.openai.com/api-keys')
  console.error('Add to .env.local: OPENAI_API_KEY=sk-...')
  console.error('Then add $10 credit at platform.openai.com/settings/billing')
  console.error('\nTo preview all prompts without generating images:')
  console.error('  node scripts/generate-art.js --dry-run')
  process.exit(1)
}

// The master style injected into every card prompt
// Defines the NeoTopia civilization visual identity
const STYLE = [
  'solarpunk consciousness civilization 2055',
  'sacred geometry architecture integrated with living nature',
  'warm golden hour sunlight',
  'crystal resonance technology',
  'regenerative ecological systems',
  'isometric architectural view',
  'cinematic depth of field',
  'warm teal-amber-gold color palette',
  'ultra-detailed illustration',
  'game card art style',
  'no text no words no letters',
  'photorealistic solarpunk'
].join(', ')

// Complete 56-card deck definition
// id: file name (public/art/cards/[id].png)
// element: energy | biofarming | technology | community
// prompt: what the building IS (style applied automatically)
const DECK = [
  // ENERGY (red) · 12 cards
  { id: 'hydrogen-arc-station', element: 'energy', prompt: 'hydrogen electrolysis industrial plant with elegant arc reactors and water-splitting towers, surrounded by green gardens and flowing water channels' },
  { id: 'solar-concentrator', element: 'energy', prompt: 'vast array of parabolic solar mirrors concentrating sunlight into a central glowing tower, desert landscape with oasis gardens' },
  { id: 'wind-vortex-array', element: 'energy', prompt: 'spiral wind turbines integrated into coastal cliffs, elegant white forms catching ocean winds, bioluminescent moss on rocks' },
  { id: 'plasma-fusion-ring', element: 'energy', prompt: 'circular fusion reactor ring with visible magnetic containment fields glowing blue-white, surrounded by cooling gardens and crystal arrays' },
  { id: 'tidal-converter', element: 'energy', prompt: 'underwater turbine array harvesting ocean tidal energy, bioluminescent marine life visible, surface structure of crystal and stone' },
  { id: 'geothermal-bore', element: 'energy', prompt: 'deep earth bore station with natural steam vents rising through mineral crystal formations, warm orange-red glow from earth below' },
  { id: 'harmonic-grid', element: 'energy', prompt: 'smart energy distribution grid with glowing crystalline nodes at intersections, energy flowing like light rivers between structures' },
  { id: 'zero-point-station', element: 'energy', prompt: 'quantum vacuum energy research facility with floating geometric tesseract structures, surrounded by perfectly calm reflective water' },
  { id: 'torus-generator', element: 'energy', prompt: 'large toroidal energy generator with visible donut-shaped magnetic flow patterns glowing gold, integrated into a living hillside' },
  { id: 'solar-hydrogen-array', element: 'energy', prompt: 'massive solar farm powering hydrogen production silos, geometric rows of panels and cylindrical storage, lush borders of food forests' },
  { id: 'kinetic-harvest-tower', element: 'energy', prompt: 'elegant tower with kinetic art panels harvesting motion and vibration into electricity, panels spinning and catching light' },
  { id: 'bio-energy-nexus', element: 'energy', prompt: 'biological energy conversion center with living algae tanks glowing green, biogas domes, mycelium processing chambers' },

  // BIOFARMING (green) · 12 cards
  { id: 'root-network', element: 'biofarming', prompt: 'underground mycelium network glowing bioluminescent connecting ancient forest trees, luminescent roots visible in cross-section, magical blue-green underground world' },
  { id: 'infinite-garden', element: 'biofarming', prompt: 'cascading terraced garden with waterfalls between levels, infinite variety of flowering plants, herbs, fruit trees, sun-drenched abundance' },
  { id: 'seed-vault', element: 'biofarming', prompt: 'crystalline seed preservation vault built into a mountain face, interior glowing with organized seed collections, frost patterns on crystal walls' },
  { id: 'aquaponic-farm', element: 'biofarming', prompt: 'integrated fish and plant growing systems in glass geodesic domes, koi and tropical fish visible, lush leafy plants growing above water channels' },
  { id: 'bioluminescent-grove', element: 'biofarming', prompt: 'forest of bioluminescent trees at twilight, blue-green-purple glow emanating from bark and leaves, magical peaceful atmosphere' },
  { id: 'mycelium-information-grid', element: 'biofarming', prompt: 'research center studying fungal network intelligence, large mycelium specimens in glass chambers, bioluminescent spore clouds visible' },
  { id: 'permaculture-hub', element: 'biofarming', prompt: 'permaculture design center with spiral garden mandala visible from above, food forest canopy, herb spirals, pond and swale systems' },
  { id: 'sacred-water-tower', element: 'biofarming', prompt: 'ancient-modern water tower with sacred geometric patterns carved in stone, living vines and flowers growing up the structure, water flowing down in streams' },
  { id: 'living-earth-station', element: 'biofarming', prompt: 'soil restoration research center with biochar production, healthy dark earth visible in test beds, crystal soil analysis chambers' },
  { id: 'biochar-field', element: 'biofarming', prompt: 'agricultural field using biochar soil enhancement, rich dark fertile earth with visible crystal microstructure, abundant crops growing, research tents' },
  { id: 'medicinal-plant-archive', element: 'biofarming', prompt: 'greenhouse library of rare medicinal plants organized by tradition, crystalline dome roof with golden light, ancient herbal texts visible in alcoves' },
  { id: 'food-forest-hub', element: 'biofarming', prompt: 'multi-canopy food forest community hub, fruit trees, nut trees, berry bushes, edible herbs, gathering spaces under the canopy, harvest baskets' },

  // TECHNOLOGY (purple) · 12 cards
  { id: 'quantum-research-center', element: 'technology', prompt: 'quantum computing laboratory with glowing qubit array processors in crystal chambers, scientists in clean suits, purple quantum field effects visible' },
  { id: 'signal-broadcast-tower', element: 'technology', prompt: 'consciousness broadcast tower with crystal frequency amplifiers arranged in sacred geometry, visible frequency rings emanating from the apex' },
  { id: 'entanglement-network', element: 'technology', prompt: 'quantum entanglement communication hub with paired particle transmitter arrays, entanglement beams visible between receiver stations on hilltops' },
  { id: 'superposition-lab', element: 'technology', prompt: 'research laboratory where quantum superposition experiments create visible rainbow interference patterns and holographic data clouds' },
  { id: 'resonance-grid-tower', element: 'technology', prompt: 'tall crystal tower broadcasting healing frequencies across the city, concentric sound wave patterns visible in the air around it, birds perching on crystal spires' },
  { id: 'magnetic-levitation-hub', element: 'technology', prompt: 'maglev transport station with elegant pod vehicles floating above magnetic rails, smooth curves, clean white and crystal architecture' },
  { id: 'living-archive', element: 'technology', prompt: 'holographic knowledge library where information is stored in living crystal matrices, glowing data visible inside crystal pillars, scholars studying' },
  { id: 'phi-spiral-tower', element: 'technology', prompt: 'golden ratio phi spiral tower rising gracefully, sacred geometry proportions perfect, mathematical beauty made physical, warm golden facade' },
  { id: 'digital-data-grove', element: 'technology', prompt: 'servers and processors housed inside living ancient trees, organic circuitry visible in bark patterns, root networks connected to crystal data centers' },
  { id: 'quartz-amplifier', element: 'technology', prompt: 'large natural quartz crystal array on a hilltop amplifying and directing healing frequencies, crystal clusters catching rainbow light' },
  { id: 'merkaba-field', element: 'technology', prompt: 'star tetrahedron energy field generator surrounded by geometric light patterns, merkaba structure rotating slowly, visible sacred geometry field' },
  { id: 'quantum-consciousness-hub', element: 'technology', prompt: 'mind-technology interface research center with neural mapping chambers, consciousness visualization screens, calming blue-violet atmosphere' },

  // COMMUNITY (blue) · 20 cards (includes 2pt and 5pt)
  { id: 'gathering-circle', element: 'community', prompt: 'ancient stone circle with modern sacred geometry integration, ceremony fire in center, community gathered, starry sky above, warm firelight' },
  { id: 'open-contact-embassy', element: 'community', prompt: 'cosmic embassy building with celestial antenna arrays on roof, peaceful landing zones, sacred geometry facade, night sky with stars and subtle phenomena' },
  { id: 'earth-embassy', element: 'community', prompt: 'planetary diplomacy center with Earth as motif in architecture, living green walls, delegates from many traditions gathering, global representation' },
  { id: 'stellar-observatory', element: 'community', prompt: 'open-air observatory with multiple crystal telescope domes, star maps inlaid in the floor plaza, community members stargazing, warm amber lighting' },
  { id: 'crystal-resonance-hall', element: 'community', prompt: 'sound healing hall built from natural crystal formations, person lying in center receiving treatment, crystal bowls surrounding, calming blue-white crystal light' },
  { id: 'selenite-sanctuary', element: 'community', prompt: 'healing sanctuary built from white selenite crystal pillars, interior glowing soft white, meditation cushions, incredibly peaceful and luminous' },
  { id: 'amethyst-healing-grove', element: 'community', prompt: 'grove of large natural amethyst crystal formations used for healing, purple crystal cave opening into forest, healing ceremonies visible' },
  { id: 'solar-commons', element: 'community', prompt: 'shared public plaza where all architectural surfaces generate solar power, community market and gathering space below, invisible solar integration elegant' },
  { id: 'sound-bath-hall', element: 'community', prompt: 'circular healing hall with suspended crystal singing bowls, acoustic dome ceiling focusing sound, community sound bath in progress, golden resonant light' },
  { id: 'wisdom-keeper-school', element: 'community', prompt: 'education campus blending ancient and future, elders and young learners together, sacred geometry classroom layout, gardens for nature learning' },
  { id: 'sacred-pyramid', element: 'community', prompt: 'geometric pyramid with crystal apex glowing gold, sacred geometry proportions, golden ratio visible in architecture, community gathering at base' },
  { id: 'living-city-core', element: 'community', prompt: 'the heart of the consciousness city, biomorphic tower where all community systems meet and harmonize, living walls, water features, community pulse visible' },
  { id: 'stone-circle', element: 'community', prompt: 'small ancient stone circle in a meadow, morning mist, solstice alignment visible, healing herbs growing between stones, reverent simplicity' },
  { id: 'frequency-hall', element: 'community', prompt: 'community hall designed for frequency and resonance, Chladni pattern acoustics in ceiling design, community choir or sound healers visible' },
  { id: 'solar-commons-small', element: 'community', prompt: 'intimate solar-powered commons garden, fruit trees, benches, community connection space, completely powered by elegant integrated solar' },
  { id: 'community-well', element: 'community', prompt: 'sacred community well with crystal water source, gathering place, geometric stonework, clear pure water flowing, herbs growing around it' },
  { id: 'spark-terminal', element: 'community', prompt: 'small energy transfer terminal connecting community to the grid, elegant minimal design, amber glow, integrated into garden setting' },
  { id: 'data-grove', element: 'community', prompt: 'small grove where trees serve as natural network nodes, bioluminescent moss showing data flow, peaceful and natural information exchange' },
  { id: 'root-network-small', element: 'community', prompt: 'intimate underground mycelium communication node, bioluminescent roots in a small chamber, two paths connecting underground' },
  { id: 'gathering-circle-small', element: 'community', prompt: 'small ceremonial gathering circle of standing stones, firepit, four directions marked, intimate sacred space for ceremony' },
]

async function generateImage(card) {
  const prompt = `${card.prompt}, ${STYLE}`

  if (DRY_RUN) {
    console.log(`\n[${card.element.toUpperCase()}] ${card.id}`)
    console.log(`Prompt (${prompt.length} chars):`)
    console.log(prompt)
    return null
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',  // GPT Image 2 (gpt-image-1 is the API name)
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',  // use 'hd' for final quality (costs 2x)
      response_format: 'b64_json',
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`OpenAI API error: ${err.error?.message || response.status}`)
  }

  const data = await response.json()
  return Buffer.from(data.data[0].b64_json, 'base64')
}

async function main() {
  const outDir = join(ROOT, 'public', 'art', 'cards')
  mkdirSync(outDir, { recursive: true })

  const cards = SINGLE_CARD
    ? DECK.filter(c => c.id === SINGLE_CARD)
    : DECK

  if (SINGLE_CARD && cards.length === 0) {
    console.error(`Card not found: ${SINGLE_CARD}`)
    console.error('Available cards:')
    DECK.forEach(c => console.log(` ${c.id}`))
    process.exit(1)
  }

  console.log(`\nNeoTopia Art Generator · ${cards.length} cards · ${DRY_RUN ? 'DRY RUN' : 'LIVE GENERATION'}`)
  if (!DRY_RUN) {
    const estCost = (cards.length * 0.04).toFixed(2)
    console.log(`Estimated cost: ~$${estCost} (standard quality)`)
    console.log(`Output: ${outDir}`)
  }
  console.log('')

  let generated = 0
  let skipped = 0
  let failed = 0

  for (const card of cards) {
    const outPath = join(outDir, `${card.id}.png`)

    if (!DRY_RUN && existsSync(outPath)) {
      console.log(`[SKIP] ${card.id} (already exists)`)
      skipped++
      continue
    }

    try {
      process.stdout.write(`[${card.element}] ${card.id}... `)
      const imageData = await generateImage(card)

      if (imageData) {
        writeFileSync(outPath, imageData)
        console.log(`saved`)
        generated++
        // Brief pause to avoid rate limiting
        await new Promise(r => setTimeout(r, 500))
      } else {
        console.log('(dry run)')
      }
    } catch (err) {
      console.log(`FAILED: ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${generated} generated · ${skipped} skipped · ${failed} failed`)
  if (generated > 0) {
    console.log(`Images saved to: ${outDir}`)
    console.log(`Claude Code will detect and integrate them automatically.`)
  }
}

main().catch(err => {
  console.error('Generation failed:', err.message)
  process.exit(1)
})
