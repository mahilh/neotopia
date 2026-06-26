# T2 S13 MASTER FORGE · ENGINE + CIVILIZATION VOCABULARY
# NeoTopia · June 27 2026 · post-bot-proven · 36 placed in production
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.
# T2 lane: src/lib/ · src/store/ · src/hooks/ · api/ · scripts/ · migrations/

## WHAT CHANGED SINCE LAST FORGE
- Bot v4.3: 36 placed in 20 turns · DOM-DIAG confirmed all selectors working
- 1 error remains: ready-failed (host page has no Ready btn, bot clicks it on both pages)
- Proxy placed counter confirmed unreliable vs DB (Rule 53)
- projectCards.js has 56 cards with functional but NOT esoteric names
- T1 is upgrading CardFrame this session — your card names will display in their new frames
- Esoteric knowledge skill: .claude/skills/esoteric-knowledge/SKILL.md has the vocabulary

## SESSION GOAL
Two high-impact parallel tracks:

Track 1 (CIVILIZATION SOUL): Upgrade all 56 card names + descriptions to NeoTopia esoteric vocabulary.
Track 2 (BOT ENGINEERING): Bot v4.4 · fix ready-failed · add rate-limit retry · DB-verified count.

Task A: Card names + descriptions upgrade (projectCards.js — T2 lane, src/lib/)
Task B: Bot v4.4 lobby fix + rate-limit retry (scripts/bot-simulate.js)
Task C: DB-verified placed count in bot (replaces proxy)

---

## GATES

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -50
  Confirm: COMMS local-only · NEVER git commit comms · force:true LOAD-BEARING

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  Confirm: T1 is working on CardFrame/FinalScore/GameRoom. T3 is on CI + reconnect.
  HARD STOP if T1 has claimed src/lib/projectCards.js (it is your file).

Gate 3 (5 min):
  cat src/lib/projectCards.js | head -80
  cat .claude/skills/esoteric-knowledge/SKILL.md | head -120
  Read the CARD NAMING VOCABULARY section. These are the vocabulary rules for card names.
  Understand the Placard Test and Frequency Test before writing a single card name.

Gate 4: npx vitest run 2>&1 | tail -6
  HARD STOP if red. patternMatcher.test.js and gameEndEvent.test.js must pass.

Gate 5: npm run build 2>&1 | tail -4
  HARD STOP if build fails.

Gate 6: cat scripts/bot-simulate.js | grep -n 'ready\|Ready\|readySel'
  Understand exactly where the ready button logic lives before touching it.

Gate 7: Read src/lib/supabase.js to get exact env var names for VITE_SUPABASE_URL etc.
  DO NOT guess env vars. Read the file.

---

## TASK A · Upgrade All 56 Card Names + Descriptions
# Target: 49/50 · Highest soul impact of any task this session
# Every player reads these names every turn. Generic names kill the civilization feeling.

RULES FOR NAMING:
  1. The `id`, `pattern`, `points`, `illustration`, `district` MUST NOT CHANGE.
     Only `name` and `description` change.
  2. Every name must pass the PLACARD TEST:
     "Would this text appear on a building placard in NeoTopia 2055?"
  3. Names should be 2-4 words. Memorable. Specific.
  4. Descriptions should be 1 sentence. Poetic. Direct. No corporate language.
  5. Reference esoteric vocabulary: Orichalcum, Fohat, Akashic, Naacal, Mycelial,
     Lemurian, Ra, Ennead, Fibonacci, Metatron, Vesica, Torus, Holographic, etc.
  6. Do NOT change names that are already strong (Source Temple, Open Contact Embassy,
     Soul Academy, Food Forest, NeoTopia Heart, 2055 Horizon, etc.)
  7. The grandfather reference in card_23 ("My grandfather's dream") STAYS — it is Mahil's voice.

UPGRADE PRIORITY (start here, then do the rest):
  HIGHEST: 2pt cards (12 cards) — seen most frequently, most generic currently
  MEDIUM: 3pt cards cards not already strong
  LOW: 4pt and 5pt cards (most already have strong names)

SPECIFIC UPGRADES (use these as-is or improve them):
  card_01 "Solar Garden" → "Fibonacci Solar Terrace"
    desc: "Sunlight arranged in living spirals, feeding the district from above."
  card_02 "Root Network" → "Mycelial Memory Array"
    desc: "Underground intelligence threading the living earth beneath every building."
  card_03 "Signal Bridge" → "Resonance Crossing"
    desc: "Two frequencies meet and become coherent: the first step in any civilization."
  card_04 "Gathering Circle" → "Council Ring"
    desc: "The oldest governance technology: nine people in a circle, listening."
  card_05 "Hydrogen Arc Station" → "Orichalcum Arc Node"
    desc: "Atlantean energy principles, reborn in clean plasma and conscious design."
  card_06 "Seed Vault" → "Naacal Seed Archive"
    desc: "Before cities: seeds. The Naacal stored what Mu knew. We continue."
  card_07 "Healing Pool" → "Crystal Healing Waters"
    desc: "Water charged with intention is the oldest medicine still working."
  card_08 "Spark Terminal" → "Fohat Activation Node"
    desc: "The cosmic electricity Blavatsky named: now flowing through conscious circuitry."
  card_09 "Data Grove" → "Akashic Grove"
    desc: "A living computer: the forest stores what the Akashic field remembers."
  card_10 "Solar Spring" → "Helios Source Spring"
    desc: "Sun feeds water feeds earth: an unbroken sacred loop, three elements as one."
  card_11 "Code Commons" → "Open Source Consciousness"
    desc: "Share the code. Share the light. No knowledge is private in NeoTopia."
  card_12 "Wind Weave" → "Aeolian Frequency Array"
    desc: "Invisible force made audible. The wind has always been transmitting."
  card_14 "BioFarm Collective" → "Living Earth Collective"
    desc: "Three growing things: three generations of memory in regenerated soil."
  card_15 "Resonance Grid Tower" → "Fohat Transmission Tower"
    desc: "Consciousness rises from earth to sky, carried on frequencies we are learning to read."
  card_17 "Energy Spire" → "Orichalcum Energy Spire"
    desc: "Three aligned sources create a harmonic that neither one could produce alone."
  card_19 "Quantum Observatory" → "Stellar Coherence Station"
    desc: "We built telescopes to see the stars. Now we build instruments to see ourselves."
  card_22 "Frequency Gate" → "Sound Frequency Gateway"
    desc: "Some thresholds are made of vibration. You pass through by becoming coherent."
  card_23 name STAYS "Free Energy Lab"
    desc STAYS: "My grandfather's dream. The invention that cannot be suppressed."
  card_25 "Mushroom Dome" → "Mycelium Intelligence Dome"
    desc: "The first conscious building material. Grown, not manufactured. Alive, not inert."
  card_26 "Star Map Center" → "Cosmic Cartography Nexus"
    desc: "To know where we are in the galaxy is to know what we are responsible for."
  card_27 "Sound Chamber" → "Cymatics Healing Chamber"
    desc: "Frequency made visible becomes sacred geometry. The body recognizes its origin."
  card_28 "Living Archive" → "Akashic Living Archive"
    desc: "A civilization chooses what to remember. These walls hold what matters."
  card_30 "Seed Library" → "Naacal Seed Library"
    desc: "A seed is a compressed universe. We keep universes here, organized by memory."
  card_33 "Quantum Research Center" → "Holographic Research Center"
    desc: "Bohm's implicate order made visible: the universe unfolds from this room."
  card_37 "Signal Broadcast Tower" → "Consciousness Broadcast Tower"
    desc: "What you transmit becomes the frequency of the district. Choose carefully."
  card_39 "Council Chamber" → "Ennead Council Chamber"
    desc: "Nine seats. Nine principles. The Egyptian Ennead remembered in modern form."
  card_43 "Harmonic Grid" → "Fohat Harmonic Grid"
    desc: "Power distributed with love cannot be corrupted. The grid is the covenant."
  card_45 "Memory Garden" → "Ancestral Memory Garden"
    desc: "We plant what our grandparents dreamed. We harvest what our children will know."
  card_46 "Frequency Research Hub" → "Biofield Frequency Laboratory"
    desc: "Everything vibrates. The question is always: at what frequency are we building?"

  All other cards: keep name if already strong, or apply the same vocabulary standard.

AFTER MAKING ALL CHANGES:
  Run the card count assertion: node -e "import('./src/lib/projectCards.js').then(m => console.log(m.PROJECT_CARDS.length))"
  Must still be 56.

  Run vitest: npx vitest run 2>&1 | tail -6
  Must still be 102 green.

COMMIT:
  git add src/lib/projectCards.js
  git commit -m 'feat(cards): NeoTopia esoteric vocabulary upgrade · all 56 card names + descriptions · Placard Test · NeoTopia T2 S13'

---

## TASK B · Bot v4.4 · Fix ready-failed + Rate-limit Retry
# Target: 48/50

### Fix 1: ready-failed (currently: 1 error per game)

ROOT CAUSE: Bot tries Ready button on BOTH p1 (host) AND p2 (joiner).
Host page has no Ready button — it has a Start button.
The bot loop `for (const page of [p1, p2])` tries Ready on p1 → times out → ready-failed.

FIX: Apply Ready ONLY to p2 (joiner). Host waits for Start.

Find the ready section in playGame() and change:
  // BEFORE:
  for (const page of [p1, p2]) {
    for (const sel of readySelectors) { ... click Ready ... }
  }
  // AFTER:
  // Joiner (p2) clicks Ready
  for (const sel of readySelectors) {
    const btn = p2.locator(sel).first()
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click().catch(e => errors.push({type:'ready-failed', message: e.message.slice(0,80)}))
      await delay(500)
      break
    }
  }
  // Host (p1) does NOT click Ready — host only sees Start button

### Fix 2: Rate-limit retry

Add an auth retry wrapper. Place near the top of bot-simulate.js:

async function signInWithRetry(page, maxRetries = 3) {
  // The Supabase anon-auth rate limit is ~30 signins/hr.
  // Retry with exponential wait when we hit it.
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Supabase auth happens automatically when the page loads and auth.js runs.
      // If the lobby page shows an error state ("Rate limit"), wait and reload.
      const isRateLimited = await page.locator('text=/rate limit/i').isVisible({ timeout: 2000 }).catch(() => false)
      if (!isRateLimited) return true  // no rate limit, proceed
      const waitMs = (i + 1) * 70000  // 70s, 140s, 210s
      log(`[AUTH] Rate limited · retry ${i+1}/${maxRetries} in ${Math.round(waitMs/1000)}s`)
      await delay(waitMs)
      await page.reload()
      await delay(2000)
    } catch { return false }
  }
  return false
}

Call after enterLobby returns the page:
  const p1 = await enterLobby(ctx1, username1)
  await signInWithRetry(p1)
  const p2 = await enterLobby(ctx2, username2)
  await signInWithRetry(p2)

EVIDENCE GATE:
  Run: BOT_GAMES=1 BOT_TURNS=20 BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
  Confirm: Error types: {} (empty · 0 ready-failed errors)

COMMIT:
  git add scripts/bot-simulate.js
  git commit -m 'feat(bot): v4.4 · fix ready-failed host-only · rate-limit retry on signin · NeoTopia T2 S13'

---

## TASK C · DB-Verified Placed Count
# Target: 46/50 · Rule 53: verify the persisted artifact, not the proxy

PREMISE CHECK FIRST:
  cat src/lib/supabase.js
  Find the exact createClient call and env var names.
  Also find where board state is written: grep -n 'board_state\|boardState\|game_sessions' src/store/gameStore.js | head -20
  DO NOT implement before you know the exact column name.

ADD to bot-simulate.js, AFTER the turn loop and BEFORE the final return:

async function dbPlacedCount(supabaseUrl, supabaseKey, roomCode) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(supabaseUrl, supabaseKey)
    // Sign in anonymously (needed for RLS)
    await sb.auth.signInAnonymously()
    const { data, error } = await sb
      .from('game_sessions')
      .select('board_state')  // REPLACE with actual column name after reading gameStore.js
      .eq('room_code', roomCode)
      .maybeSingle()
    if (error || !data) return null
    // Parse board_state JSON and count hex entries with elements
    const board = typeof data.board_state === 'string'
      ? JSON.parse(data.board_state) : data.board_state
    let count = 0
    for (const region of Object.values(board?.regions ?? {})) {
      for (const hex of Object.values(region?.hexes ?? {})) {
        if (hex?.element) count++
      }
    }
    return count
  } catch { return null }
}

In playGame(), after the game loop:
  const dbCount = await dbPlacedCount(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    roomCode
  )
  if (dbCount !== null) {
    log(`DB-verified placed: ${dbCount} · proxy: ${placed}${dbCount !== placed ? ' ⚠ MISMATCH' : ' ✓ match'}`)
  }

In the report:
  summary.totalPlacedProxy = [existing placed]
  summary.totalPlacedDB = dbCount ?? null
  summary.dbVerified = dbCount === placed

COMMIT:
  git add scripts/bot-simulate.js
  git commit -m 'feat(bot): v4.4 DB-verified placed count · proxy vs truth · Rule 53 · NeoTopia T2 S13'

---

## RULES (non-negotiable)
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · tests/e2e/ · src/hooks/useGameRoom*
  NEVER commit .claude/comms/
  DO: run vitest after card changes. 102 green required.
  DO: run npm run build before every commit.
  Evolution lesson → .claude/comms/tomorrow.md · filesystem ONLY · NEVER git commit

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive
