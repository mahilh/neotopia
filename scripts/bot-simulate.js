// scripts/bot-simulate.js
// NeoTopia autonomous bot simulation · finds bugs by playing the game
//
// HOW TO RUN:
//   BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
//   BOT_HEADED=1 BOT_GAMES=1 node scripts/bot-simulate.js (visual debug)
//
// v4.2 — June 27 2026:
//   DIAGNOSIS: placed:0 despite turns working (v4/v4.1 fixed turn detection)
//   ROOT (partial): factory/offer card selectors + render timing · added diagnostics + broader selectors
//   FIX: full DOM diagnostic logging after board load + broader selectors
//   FIX: delay after factory click 400ms→1500ms + waitForSelector on valid hexes
//   FIX: page.evaluate to scan DOM for ALL testids on first turn (selector audit)
// v4.3 — June 27 2026 (T2 S12 · the actual placed:0 fix · proven local 31 + prod 37):
//   TRUE ROOT: placement is a 4-STEP UI flow (GameRoom.jsx uiPhase), NOT 2 clicks. v4.2 clicked a factory
//   then waited for a valid hex that never appears — a hex only lights up AFTER an element AND a region are
//   chosen (drew 53 · placed 0 was the tell: drawing worked, so turn-detect + convergence already worked).
//   FIX: doRandomAction drives factory → element <button> → region <button> → valid hex (keeps v4.2 infra).
// v4.4 — June 27 2026 (T2 S13):
//   FIX ready-failed: Ready is joiner-only (host sees Start, not Ready) · the lone per-game error, gone.
//   FIX rate limit: enterLobbyWithRetry · the ~30/hr anon-signin ceiling fataled 5/5 S12 re-runs · retry+backoff.
//   ADD Rule 53: dbPlacedCount reads the REAL placed count from game_sessions.state · proxy ≠ DB truth.
// v4.5 — June 27 2026 (T2 S14): close the proxy gap AT SOURCE · the `placed` counter now increments ONLY when
//   the board's .hex-element-in token count actually grows (the committed-placement signal) · a swallowed click
//   that placed nothing no longer counts (S13 caught proxy 21 vs DB 19 · now the proxy is honest by construction).
// v4.6 — June 27 2026 (T2 S17): BOT_MODE env ('classic'|'flow') · the bot selects the mode in the lobby BEFORE
//   Create Room (host picks at createRoom → game_sessions.mode · migration 010) and then DB-VERIFIES the persisted
//   mode (dbSessionMode · Rule 53 · the column is truth). The Flow toggle is T1's lobby UI and is NOT shipped yet,
//   so flow selection is GUARDED: if the toggle is absent the bot falls back to Classic and SAYS SO (Rule 63 · no
//   fake Flow game). The moment T1 ships the toggle, BOT_MODE=flow drives a real 9-tile Flow game · no further change.

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'

// Load VITE_SUPABASE_* from .env.local if not already set, so dbPlacedCount (Rule 53) works when the bot is
// run plainly as `node scripts/bot-simulate.js`. Same vars the app uses · NO secrets hardcoded. CI can pass
// them as real env vars instead (the loader only fills what is missing · a missing file is non-fatal).
try {
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*(VITE_SUPABASE_[A-Z_]+)\s*=\s*(.+?)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  }
} catch { /* .env.local absent · dbPlacedCount returns null gracefully */ }

const BASE = process.env.BOT_URL || 'http://localhost:5173'
const NUM_GAMES = parseInt(process.env.BOT_GAMES || '3')
const TURN_LIMIT = parseInt(process.env.BOT_TURNS || '30')
const HEADED = process.env.BOT_HEADED === '1'
const MODE = (process.env.BOT_MODE || 'classic').toLowerCase() // 'classic' | 'flow' (T2 S17 · selected in lobby pre-Create)

const log = (...args) => console.log(new Date().toISOString().slice(11,19), ...args)
const delay = ms => new Promise(r => setTimeout(r, ms))

// v4.4 · DB-VERIFIED PLACED COUNT (Rule 53 · the proxy is not the outcome · the server is).
// The in-game `placed` counter increments on the .catch()-swallowed click, NOT on a DB commit — T3 S12
// caught it lying (proxy said 8/11, the DB said 0/11). This reads the TRUTH from the persisted board.
// Schema verified LIVE (do not trust the forge's guess of board_state/room_code · both are wrong):
//   game_sessions.state (jsonb) · filtered by room_id (uuid) · board at state.regions[].hexes["q,r"].element
//   game_rooms maps room_code (the 6-char the bot holds) → id (room_id).
// RLS: game_rooms.rooms_read_all + game_sessions.sessions_read are both {public}/qual=true → a PURE anon-key
// read works with NO signInAnonymously (so this never adds to the ~30/hr signin budget Fix 2 guards).
let _sbClient = null
async function dbPlacedCount(roomCode) {
  try {
    const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key || !roomCode) return null
    if (!_sbClient) {
      const { createClient } = await import('@supabase/supabase-js')
      _sbClient = createClient(url, key)
    }
    const { data: room } = await _sbClient.from('game_rooms').select('id').eq('room_code', roomCode).maybeSingle()
    if (!room) return null
    const { data: sess } = await _sbClient.from('game_sessions').select('state').eq('room_id', room.id).maybeSingle()
    const state = typeof sess?.state === 'string' ? JSON.parse(sess.state) : sess?.state
    if (!state?.regions) return null
    let count = 0
    for (const region of state.regions) {
      for (const hex of Object.values(region?.hexes ?? {})) {
        if (hex && hex.element) count++
      }
    }
    return count
  } catch { return null }
}

// v4.6 · DB-VERIFIED GAME MODE (Rule 53 · T2 S17): read the PERSISTED mode (game_sessions.mode · migration 010)
// for a room · same pure anon-key read as dbPlacedCount (no signin · sessions_read RLS is public). Proves whether
// Flow was actually selected end-to-end (column === 'flow') vs the bot silently running Classic. Returns the mode
// string ('classic'|'flow') or null when unreadable (room purged / no session / no creds).
async function dbSessionMode(roomCode) {
  try {
    const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key || !roomCode) return null
    if (!_sbClient) {
      const { createClient } = await import('@supabase/supabase-js')
      _sbClient = createClient(url, key)
    }
    const { data: room } = await _sbClient.from('game_rooms').select('id').eq('room_code', roomCode).maybeSingle()
    if (!room) return null
    const { data: sess } = await _sbClient.from('game_sessions').select('mode').eq('room_id', room.id).maybeSingle()
    return sess?.mode ?? null
  } catch { return null }
}

// v4.6 · SELECT GAME MODE IN THE LOBBY (T2 S17): the host picks the mode BEFORE Create Room (createRoom(mode) →
// game_sessions.mode). classic is the default · nothing to click. flow needs T1's lobby toggle, which is NOT
// shipped yet — so this is GUARDED: it tries the likely selectors and reports whether the control was actually
// found. Absent today → fall back to Classic and SAY SO (Rule 63 · never fake a Flow game). Returns the mode the
// bot actually managed to select, so the caller can DB-verify the truth rather than the request.
async function selectGameMode(page, mode, label) {
  if (mode !== 'flow') return { selected: 'classic', found: null } // classic · a flow toggle is N/A (not 'found')
  const flowSelectors = [
    '[data-testid="mode-flow"]', '[data-testid="game-mode-flow"]',
    'button:has-text("Flow")', 'label:has-text("Flow")',
    '[role="radio"]:has-text("Flow")', '[role="tab"]:has-text("Flow")', '[aria-label*="flow" i]',
  ]
  for (const sel of flowSelectors) {
    const el = page.locator(sel).first()
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ force: true }).catch(() => {})
      await delay(300)
      log(`[${label}] Flow mode selected in lobby (selector '${sel}')`)
      return { selected: 'flow', found: true }
    }
  }
  log(`[${label}] BOT_MODE=flow requested but NO Flow toggle found (T1 lobby toggle not shipped yet) · falling back to Classic · session mode will be 'classic' (honest · Rule 63 · blocked until T1 S17 ships the toggle)`)
  return { selected: 'classic', found: false }
}

// ============================================================
// DOM DIAGNOSTIC (run once after board loads)
// Scans the live DOM and reports everything relevant.
// This tells us EXACTLY what selectors exist vs what we expected.
// ============================================================
async function diagnoseDom(page, label) {
  const info = await page.evaluate(() => {
    // All data-testid values in the DOM
    const allTestids = [...document.querySelectorAll('[data-testid]')]
      .map(el => el.getAttribute('data-testid'))
      .filter(Boolean)

    // All data-* attributes that might be game-related
    const gameAttrs = [...document.querySelectorAll('[data-factory],[data-valid],[data-my-turn],[data-offer],[data-game-phase]')]
      .map(el => ({
        tag: el.tagName,
        attrs: Object.fromEntries([...el.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value.slice(0, 30)])),
        class: el.className.toString().slice(0, 40),
      }))

    // Count of key selector results
    const factories = document.querySelectorAll('[data-testid="factory"],[data-factory]').length
    const validHexes = document.querySelectorAll('[data-valid="true"],[data-testid="hex-valid"]').length
    const offerByAttr = document.querySelectorAll('[data-offer]').length
    const offerByClass = document.querySelectorAll('[class*="offer" i],[class*="Offer"]').length
    const cardsByOffer = document.querySelectorAll('[data-offer] [class*="card"]').length
    const cardsByTestid = document.querySelectorAll('[data-testid="card-offer"]').length
    const myTurn = document.querySelectorAll('[data-my-turn="true"]').length
    const endTurn = document.querySelectorAll('[data-testid="end-turn-btn"]').length

    // Find any button-like elements in the game that might be factories or cards
    const allButtons = [...document.querySelectorAll('button,svg g[role="button"],g[tabindex],[role="button"]')]
      .filter(el => el.getBoundingClientRect().width > 0)
      .slice(0, 20)
      .map(el => ({ tag: el.tagName, class: el.className.toString().slice(0, 30), testid: el.getAttribute('data-testid') }))

    return {
      allTestids,
      gameAttrs,
      counts: { factories, validHexes, offerByAttr, offerByClass, cardsByOffer, cardsByTestid, myTurn, endTurn },
      buttonSample: allButtons,
      url: window.location.pathname,
    }
  })

  log(`[DOM-DIAG ${label}] testids: ${info.allTestids.join(', ')}`)
  log(`[DOM-DIAG ${label}] counts: factories=${info.counts.factories} validHex=${info.counts.validHexes} offer-attr=${info.counts.offerByAttr} offer-class=${info.counts.offerByClass} cardsByOffer=${info.counts.cardsByOffer} cardsByTestid=${info.counts.cardsByTestid} myTurn=${info.counts.myTurn} endTurn=${info.counts.endTurn}`)
  if (info.gameAttrs.length > 0) log(`[DOM-DIAG ${label}] game-attrs:`, JSON.stringify(info.gameAttrs.slice(0, 5)))
  log(`[DOM-DIAG ${label}] buttons:`, JSON.stringify(info.buttonSample.slice(0, 8)))

  return info
}

async function enterLobby(ctx, username) {
  const page = await ctx.newPage()
  await page.goto(BASE)
  await delay(1500)

  const enterBtns = [
    'button:has-text("Enter the Civilization")',
    'button:has-text("Enter")',
    'a:has-text("Enter the Civilization")',
  ]
  for (const sel of enterBtns) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      log(`[${username}] Landing page — clicking through`)
      await btn.click()
      await delay(1000)
      break
    }
  }

  const nameSelectors = [
    '[placeholder*="name" i]', '[placeholder*="username" i]',
    'input[type="text"]:visible', '[data-testid="username-input"]',
  ]
  for (const sel of nameSelectors) {
    const input = page.locator(sel).first()
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill(username)
      await input.press('Enter')
      await delay(600)
      log(`[${username}] Username set`)
      break
    }
  }
  return page
}

// v4.4 · RATE-LIMIT RESILIENCE (Rule 51/52 · S12 root cause): the app signs in anonymously on load, and
// Supabase caps anon sign-ins at ~30/hr. Multi-game runs blow past it → the signin fails → the page never
// reaches the lobby (no Create/Join button), which fataled 5/5 of S12's re-runs. We detect that symptom (or
// an explicit rate-limit message) and retry with backoff on a fresh page. On a healthy run the first attempt
// succeeds instantly (no behavior change); only a throttled run pays the wait.
async function enterLobbyWithRetry(ctx, username, maxRetries = 3) {
  const lobbyReadySel =
    'button:has-text("Create Room"), button:has-text("Join Room"), button:has-text("Create"), button:has-text("Join"), [data-testid="ready-btn"]'
  for (let i = 0; i < maxRetries; i++) {
    const page = await enterLobby(ctx, username)
    const ready = await page.locator(lobbyReadySel).first().isVisible({ timeout: 5000 }).catch(() => false)
    if (ready) return page
    const rateLimited = await page.locator('text=/rate limit|too many|try again/i').first()
      .isVisible({ timeout: 500 }).catch(() => false)
    if (i === maxRetries - 1) return page // last try · hand back so existing error handling reports it
    const waitMs = (i + 1) * 70000 // 70s · 140s — clears the rolling anon-signin window
    log(`[AUTH] ${username} · lobby unreachable${rateLimited ? ' · RATE LIMITED' : ''} · retry ${i + 1}/${maxRetries - 1} in ${Math.round(waitMs / 1000)}s`)
    await page.close().catch(() => {})
    await delay(waitMs)
  }
}

// ============================================================
// CORE ACTION — v4.2: diagnostic logging + broader selectors
// + 1500ms delay after factory click (was 400ms — too short for DOM render)
// + waitForSelector on valid hexes instead of .all()
// ============================================================
// v4.3: the element-select + region-select buttons carry no data-testid (T1 lane · GameRoom.jsx aside),
// so match them by role + visible text. (T1 follow-up flagged in comms: data-testid would make this copy-proof.)
const ELEMENT_RE = /energy|biofarming|technology|community/i
const REGION_RE  = /sacred city|living earth|free energy/i

async function doRandomAction(page, turn, actionNum, errors, domDiag) {
  try {
    // FACTORY SELECTORS (ordered by specificity)
    const FACTORY_SELS = [
      '[data-testid="factory"]',
      '[data-factory]',
      // Broader fallbacks based on DOM diagnostic findings:
      'g[data-testid]',       // SVG group with any testid (might be factory)
      '[class*="factory" i]', // element with "factory" in class name
      'circle[r]',            // SVG circles (often used for factory tokens)
    ]

    if (Math.random() < 0.7) {
      let factories = []
      let foundSel = null
      for (const sel of FACTORY_SELS) {
        factories = await page.locator(sel).all()
        if (factories.length > 0) { foundSel = sel; break }
      }

      if (turn === 0 && actionNum === 0) {
        log(`[ACTION DIAG turn${turn}] factory selector '${foundSel}' → ${factories.length} elements`)
      }

      if (factories.length > 0) {
        // v4.5 (Rule 53 · close the proxy gap AT SOURCE · T2 S14): snapshot the board's committed-element
        // count BEFORE the attempt. .hex-element-in is the persistent placed-element token (HexCell.jsx · the
        // same 0→1 signal T3's placement guard asserts). We count a placement ONLY if this number grows —
        // a .catch()-swallowed click that placed nothing no longer inflates the proxy (S13 caught proxy 21 vs DB 19).
        const beforeCount = await page.locator('.hex-element-in').count().catch(() => 0)
        await factories[Math.floor(Math.random() * factories.length)].click({ timeout: 2000, force: true }).catch(() => {})
        // v4.2: delay — game needs time to render the element-select panel after the factory click.
        await delay(1500)

        // v4.3 ROOT-CAUSE FIX: placement is a 4-STEP flow (GameRoom.jsx uiPhase), not 2 clicks. After the
        // factory click the UI sits in 'factorySelected' with NO hex highlighted — a hex only lights up once
        // an ELEMENT and a REGION are chosen. v4.2 waited for a valid hex that never came (drew 53 · placed 0).
        // STEP 2 · pick an element type from the factory
        const elBtn = page.getByRole('button').filter({ hasText: ELEMENT_RE }).first()
        if (await elBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await elBtn.click({ timeout: 2000, force: true }).catch(() => {})
          await delay(300)
          // STEP 3 · pick a region this factory borders
          const regBtn = page.getByRole('button').filter({ hasText: REGION_RE }).first()
          if (await regBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await regBtn.click({ timeout: 2000, force: true }).catch(() => {})
            await delay(300)
          }
        }

        // STEP 4 · the engine now highlights legal hexes (center-first then adjacency) · wait for one (2s)
        try {
          await page.locator('[data-valid="true"]').first().waitFor({ state: 'visible', timeout: 2000 })
        } catch { /* valid hexes may not appear if the factory was empty or the selection was incomplete */ }

        const VALID_HEX_SELS = ['[data-valid="true"]', '[data-testid="hex-valid"]', '[class*="valid" i]']
        let validHexes = []
        for (const sel of VALID_HEX_SELS) {
          validHexes = await page.locator(sel).all()
          if (validHexes.length > 0) break
        }

        if (turn === 0 && actionNum === 0) {
          log(`[ACTION DIAG turn${turn}] valid-hex count: ${validHexes.length}`)
        }

        if (validHexes.length > 0) {
          // force:true IS LOAD-BEARING — do NOT remove (T3 S12 DB-verified this). The valid-hex ring runs an
          // infinite hexPulse scale animation (src/index.css · scale 1↔1.08), so the <g data-valid> bbox never
          // settles → Playwright's click-stability wait times out BEFORE onClick→placeElement fires. Without
          // force the click is swallowed and NOTHING commits (room board stays empty · DB-proven). With force,
          // the 4-step chain commits real elements (T3 confirmed 11 in game_sessions for room YQZHRB).
          await validHexes[Math.floor(Math.random() * validHexes.length)].click({ timeout: 2000, force: true }).catch(() => {})
          await delay(800) // DB commit + optimistic re-render round-trip · let the placed token settle before counting
          // v4.5: count ONLY a placement that actually grew the board (the honest proxy · matches DB in the normal case).
          const afterCount = await page.locator('.hex-element-in').count().catch(() => 0)
          if (afterCount > beforeCount) return 'placed-element'
          log(`[WARN turn${turn}] placement UI completed but board token count did not grow (${beforeCount}→${afterCount}) · NOT counted (Rule 53)`)
          return 'place-uncommitted'
        }
      }
    }

    // OFFER CARD SELECTORS (ordered by specificity)
    const CARD_SELS = [
      '[data-testid="card-offer"]',
      '[data-offer] [class*="card"]',
      '[class*="offer" i] [class*="card" i]',
      '[class*="Offer"] button',
      '[class*="offer" i] button',
      '[class*="hand" i] [class*="card" i]',  // try hand too
      '[class*="ProjectCard"]',
    ]

    let offerCards = []
    let offerSel = null
    for (const sel of CARD_SELS) {
      offerCards = await page.locator(sel).all()
      if (offerCards.length > 0) { offerSel = sel; break }
    }

    if (turn === 0 && actionNum === 0) {
      log(`[ACTION DIAG turn${turn}] offer selector '${offerSel}' → ${offerCards.length} elements`)
    }

    if (offerCards.length > 0) {
      await offerCards[Math.floor(Math.random() * offerCards.length)].click({ timeout: 2000, force: true }).catch(() => {})
      await delay(400)
      return 'drew-card'
    }

    // Last resort: use page.evaluate to find and click any game-interactive element
    if (domDiag && turn === 0 && actionNum === 0) {
      log('[ACTION DIAG] Both factory and card selectors returned 0 — game board missing testids. T1 must add data-testid="card-offer" to offer cards and data-offer to offer container.')
    }

    return 'no-action'
  } catch (err) {
    errors.push({ turn, type: 'action-error', message: err.message.slice(0, 100) })
    return 'error'
  }
}

async function dismissTutorial(page, label) {
  const tutorialSelectors = [
    '[data-testid="tutorial-skip"]', '[data-testid="tutorial-dismiss"]',
    'button:has-text("Start building the civilization")', 'button:has-text(/skip|got it/i)',
  ]
  for (const sel of tutorialSelectors) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click().catch(() => {})
      log(`Tutorial dismissed (${label})`)
      await delay(300)
      return true
    }
  }
  return false
}

async function detectActiveTurn(p1, p2) {
  const TURN_SELECTORS = [
    '[data-my-turn="true"]',
    '.my-turn-badge',
    'text=/your turn/i',
  ]
  for (const sel of TURN_SELECTORS) {
    const p1Active = await p1.locator(sel).first().isVisible({ timeout: 1800 }).catch(() => false)
    if (p1Active) return { page: p1, label: 'p1' }
    const p2Active = await p2.locator(sel).first().isVisible({ timeout: 1800 }).catch(() => false)
    if (p2Active) return { page: p2, label: 'p2' }
  }
  return null
}

async function extractRoomCode(page) {
  const classSelectors = ['[class*="room-code"]', '[class*="roomCode"]', '[class*="RoomCode"]', '[data-testid="room-code"]']
  for (const sel of classSelectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 2000 })
      const text = (await el.textContent()).trim().replace(/\s/g, '')
      const match = text.match(/[A-Z0-9]{4,6}/)
      if (match) return match[0]
    } catch { /* continue */ }
  }
  try {
    const el = await page.waitForSelector('[style*="letter-spacing"][style*="monospace"], [style*="letter-spacing"] code, [style*="letter-spacing"] span', { timeout: 3000 })
    const text = (await el.textContent()).trim().replace(/\s/g, '')
    const match = text.match(/[A-Z0-9]{4,6}/)
    if (match) return match[0]
  } catch { /* continue */ }
  try {
    const el = await page.waitForSelector('code', { timeout: 2000 })
    const text = (await el.textContent()).trim().replace(/\s/g, '')
    const match = text.match(/[A-Z0-9]{4,6}/)
    if (match) return match[0]
  } catch { /* continue */ }
  try {
    const code = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim().replace(/\s/g, '')
        const match = text.match(/^[A-Z0-9]{6}$/)
        if (match) return match[0]
      }
      return null
    })
    if (code) return code
  } catch { /* continue */ }
  const urlMatch = page.url().match(/[A-Z0-9]{6}/)
  if (urlMatch) return urlMatch[0]
  return null
}

async function playGame(gameNum, browser) {
  log(`=== GAME ${gameNum} START ===`)
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const errors = []
  const moves = []
  const start = Date.now()
  const tag = Date.now().toString(36).slice(-5)
  // Hoisted so the catch (fatal) path can still report the mode truth · a crash AFTER the toggle was clicked must
  // NOT make the summary claim 'toggle not found' (Rule 63 · the v4.6-first-run honesty bug this fixes).
  let modeSel = { selected: 'classic', found: null }

  try {
    const p1 = await enterLobbyWithRetry(ctx1, `BotAlpha${gameNum}_${tag}`)
    const p2 = await enterLobbyWithRetry(ctx2, `BotBeta${gameNum}_${tag}`)

    // v4.6 (T2 S17): the host picks the game mode in the lobby BEFORE Create Room (createRoom(mode) persists it
    // to game_sessions.mode). Guarded · falls back to Classic when the Flow toggle is absent (T1 lobby UI pending).
    modeSel = await selectGameMode(p1, MODE, `BotAlpha${gameNum}`)

    const createBtn = await p1.waitForSelector('button:has-text("Create Room"), button:has-text("Create")', { timeout: 10000 })
    await createBtn.click()
    await delay(1800)
    log(`[BotAlpha${gameNum}] Created room`)

    const roomCode = await extractRoomCode(p1)
    if (!roomCode || roomCode.length < 4) {
      errors.push({ turn: 0, type: 'room-code-not-visible', message: 'All extraction strategies failed' })
      throw new Error(`Bad room code: "${roomCode}"`)
    }
    log(`Room code: ${roomCode}`)

    // v4.3: looser lobby timeouts — the realtime lobby sync to the Mumbai Supabase region is slow on some
    // machines · v4.2's 8s/5s flaked at the join step before placement could be reached (the board itself works).
    const joinBtn = await p2.waitForSelector('button:has-text("Join Room"), button:has-text("Join")', { timeout: 20000 })
    await joinBtn.click()
    await delay(500)
    const codeInput = await p2.waitForSelector('input[maxlength="6"], input[placeholder*="code" i], input[placeholder*="room" i]', { timeout: 12000 })
    await codeInput.fill(roomCode)
    await p2.locator('button:has-text("Join")').last().click()
    await delay(1000)
    log(`[BotBeta${gameNum}] Joined ${roomCode}`)

    // v4.4: Ready is JOINER-ONLY. The host (p1) sees a Start button (Lobby.jsx:140 · isHost), NOT a Ready
    // button (Lobby.jsx:148 · ready-btn renders only for the joiner) — clicking Ready on the host was the
    // lone 'ready-failed' error every game. The host waits for Start (handled just below).
    const readySelectors = ['[data-testid="ready-btn"]', 'button:has-text("Ready")', 'button:has-text("I\'m Ready")']
    for (const sel of readySelectors) {
      const btn = p2.locator(sel).first()
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click().catch(e => errors.push({ turn: 0, type: 'ready-failed', message: e.message.slice(0, 80) }))
        await delay(500)
        break
      }
    }
    await delay(1000)

    await p1.locator('button:has-text("Start")').click({ timeout: 6000 }).catch(e =>
      errors.push({ turn: 0, type: 'start-failed', message: e.message.slice(0, 80) })
    )

    await p1.waitForURL(/\/game\//, { timeout: 15000 })
    await p2.waitForURL(/\/game\//, { timeout: 15000 })
    log('Both on game board')
    await delay(1500) // extra wait for full game state to sync from DB

    const [t1ok, t2ok] = await Promise.all([
      dismissTutorial(p1, 'host'),
      dismissTutorial(p2, 'joiner'),
    ])
    if (!t1ok && !t2ok) errors.push({ turn: 0, type: 'no-tutorial', message: 'Tutorial not dismissable' })
    await delay(800)

    // DOM DIAGNOSTIC — run once after game starts to see what elements exist
    log('Running DOM diagnostic...')
    const domDiag = await diagnoseDom(p1, 'p1-board')

    let turn = 0, gameEnded = false, stuckCount = 0
    while (turn < TURN_LIMIT && !gameEnded) {
      const active = await detectActiveTurn(p1, p2)
      if (!active) {
        stuckCount++
        if (stuckCount > 30) {
          errors.push({ turn, type: 'stuck-state', message: `No player has turn at turn ${turn}` })
          stuckCount = 0; turn++
        }
        await delay(400)
        continue
      }
      stuckCount = 0
      const { page: activePage, label } = active

      for (let a = 0; a < 3; a++) {
        const action = await doRandomAction(activePage, turn, a, errors, domDiag)
        moves.push({ turn, action, player: label })
        await delay(300)
      }

      await activePage.locator('[data-testid="end-turn-btn"], button:has-text("End Turn")').first()
        .click({ timeout: 3000 }).catch(() => {})
      await delay(1000) // allow DB sync + next turn render

      turn++
      const placedSoFar = moves.filter(m => m.action === 'placed-element').length
      const drewSoFar = moves.filter(m => m.action === 'drew-card').length
      log(`Turn ${turn} · ${label} · placed:${placedSoFar} · drew:${drewSoFar}`)

      const finished = await p1.locator('text=/final score|civilization complete|2055/i').isVisible({ timeout: 500 }).catch(() => false)
      if (finished) { log(`Game ${gameNum} complete at turn ${turn}`); gameEnded = true }
    }

    const placed = moves.filter(m => m.action === 'placed-element').length
    const drew = moves.filter(m => m.action === 'drew-card').length
    // Rule 53: verify the persisted artifact, not the proxy. Read the real placed count from game_sessions.
    const dbPlaced = await dbPlacedCount(roomCode)
    if (dbPlaced === null) log(`DB-verified placed: unavailable · proxy: ${placed}`)
    else log(`DB-verified placed: ${dbPlaced} · proxy: ${placed}${dbPlaced === placed ? ' ✓ match' : ' ⚠ MISMATCH (DB wins)'}`)
    // v4.6 (Rule 53): DB-verify the persisted MODE · proves whether Flow was actually achieved end-to-end.
    const dbMode = await dbSessionMode(roomCode)
    const modeOk = dbMode != null && dbMode === modeSel.selected
    log(`Mode · requested:${MODE} · selected:${modeSel.selected}${modeSel.found ? '' : ' (Flow toggle ABSENT · fell back)'} · DB:${dbMode ?? 'unavailable'}${dbMode != null ? (modeOk ? ' ✓' : ' ⚠ MISMATCH') : ''}`)
    log(`Game ${gameNum}: ${turn} turns · placed ${placed} (proxy) · drew ${drew} · ${errors.length} errors`)

    return { game: gameNum, completed: gameEnded, turns: turn,
      duration: Math.round((Date.now() - start) / 1000),
      errors: errors.length, placedElements: placed, dbPlacedCount: dbPlaced, drewCards: drew,
      requestedMode: MODE, selectedMode: modeSel.selected, flowToggleFound: modeSel.found, dbMode, errorList: errors }

  } catch (err) {
    errors.push({ turn: -1, type: 'fatal', message: err.message.slice(0, 200) })
    // Carry the mode truth even on a fatal crash (Rule 63) · a game that selected Flow then crashed at Start is
    // NOT a 'toggle missing' case · the summary must distinguish them.
    return { game: gameNum, completed: false, errors: errors.length + 1, errorList: errors, fatal: err.message.slice(0, 100),
      requestedMode: MODE, selectedMode: modeSel.selected, flowToggleFound: modeSel.found, dbMode: null }
  } finally {
    await ctx1.close().catch(() => {})
    await ctx2.close().catch(() => {})
  }
}

async function main() {
  log(`NeoTopia Bot Simulation v4.6 · ${NUM_GAMES} games · ${BASE} · BOT_MODE=${MODE}`)
  log('v4.6: BOT_MODE flow/classic · lobby mode-select (guarded · T1 toggle pending) · DB-verified persisted mode (Rule 53)')
  mkdirSync('.bot-reports', { recursive: true })

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 400 : 0 })
  const allResults = []
  for (let g = 1; g <= NUM_GAMES; g++) {
    allResults.push(await playGame(g, browser))
    await delay(2000)
  }
  await browser.close()

  const report = {
    timestamp: new Date().toISOString(), url: BASE, botVersion: 'v4.6',
    requestedMode: MODE,
    results: allResults,
    summary: {
      completed: allResults.filter(r => r.completed).length,
      totalErrors: allResults.reduce((s, r) => s + r.errors, 0),
      gamesWithPlacement: allResults.filter(r => r.placedElements > 0).length,
      totalPlaced: allResults.reduce((s, r) => s + (r.placedElements || 0), 0),
      // v4.6 (Rule 53): mode truth · was Flow actually persisted, and did the lobby toggle exist this run?
      requestedMode: MODE,
      flowToggleFound: allResults.some(r => r.flowToggleFound === true),
      flowDbVerified: allResults.some(r => r.dbMode === 'flow'),
      dbModeBreakdown: allResults.reduce((acc, r) => { const m = r.dbMode || 'unknown'; acc[m] = (acc[m] || 0) + 1; return acc }, {}),
      // Rule 53: the proxy (totalPlaced) vs the DB truth. dbVerified=true means they agree.
      totalPlacedProxy: allResults.reduce((s, r) => s + (r.placedElements || 0), 0),
      totalPlacedDB: allResults.some(r => r.dbPlacedCount != null)
        ? allResults.reduce((s, r) => s + (r.dbPlacedCount || 0), 0) : null,
      dbVerified: allResults.some(r => r.dbPlacedCount != null)
        ? allResults.reduce((s, r) => s + (r.placedElements || 0), 0) === allResults.reduce((s, r) => s + (r.dbPlacedCount || 0), 0)
        : null,
      totalDrew: allResults.reduce((s, r) => s + (r.drewCards || 0), 0),
      errorTypes: allResults.flatMap(r => r.errorList || [])
        .reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc }, {}),
    },
  }

  const reportPath = `.bot-reports/report-${Date.now()}.json`
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('\n=== BOT SIMULATION REPORT (v4.6) ===')
  console.log(`Games completed: ${report.summary.completed}/${NUM_GAMES}`)
  console.log(`Elements placed: ${report.summary.totalPlaced} (proxy) · ${report.summary.totalPlacedDB ?? 'N/A'} (DB-verified) · Cards drawn: ${report.summary.totalDrew}`)
  console.log(`Mode: requested=${MODE} · DB persisted=${JSON.stringify(report.summary.dbModeBreakdown)} · flow toggle found=${report.summary.flowToggleFound} · flow DB-verified=${report.summary.flowDbVerified}`)
  if (MODE === 'flow' && !report.summary.flowDbVerified) {
    if (report.summary.flowToggleFound) {
      console.warn('NOTE: the Flow toggle WAS selected, but no Flow session was DB-verified this run (the game did not start/finish cleanly · see errors). This is NOT a toggle-availability block · re-run for a clean Flow verification (Rule 63).')
    } else {
      console.warn('NOTE: BOT_MODE=flow requested but the Flow toggle was not found this run · ran Classic (honest · Rule 63 · check the lobby toggle data-testid="mode-flow").')
    }
  }
  if (report.summary.dbVerified === false) {
    console.warn('WARNING: proxy and DB placed counts DISAGREE · the proxy over-counts swallowed clicks · the DB wins (Rule 53)')
  }
  console.log('Error types:', report.summary.errorTypes)
  console.log(`Report: ${reportPath}`)
  console.log('\nKEY: look for [DOM-DIAG] and [ACTION DIAG] lines above — they show why placed:0')
}

main().catch(err => { console.error('Bot failed:', err.message); process.exit(1) })
