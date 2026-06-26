// scripts/bot-simulate.js
// NeoTopia autonomous bot simulation · finds bugs by playing the game
//
// HOW TO RUN:
//   Tab 1: npm run dev
//   Tab 2: node scripts/bot-simulate.js
// Or against production:
//   BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
//
// Options: BOT_GAMES=5 BOT_TURNS=20 BOT_HEADED=1
//
// v4.1 — June 26 2026:
//   ROOT CAUSE (v4): turn alternation assumption was wrong · seat is DB-driven
//   FIX (v4): detectActiveTurn polls BOTH pages · acts on whichever shows badge
//   BUGFIX (v4.1): room code selector — [style*="letter-spacing"] selector was
//   inadvertently dropped from v4 · it was the selector that actually matched
//   in production (AZRHUE run) · restored + more fallbacks added

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'

const BASE = process.env.BOT_URL || 'http://localhost:5173'
const NUM_GAMES = parseInt(process.env.BOT_GAMES || '3')
const TURN_LIMIT = parseInt(process.env.BOT_TURNS || '30')
const HEADED = process.env.BOT_HEADED === '1'

const log = (...args) => console.log(new Date().toISOString().slice(11,19), ...args)
const delay = ms => new Promise(r => setTimeout(r, ms))

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
    '[placeholder*="name" i]',
    '[placeholder*="username" i]',
    'input[type="text"]:visible',
    '[data-testid="username-input"]',
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

async function doRandomAction(page, turn, errors) {
  try {
    if (Math.random() < 0.7) {
      const factories = await page.locator('[data-testid="factory"], [data-factory]').all()
      if (factories.length > 0) {
        await factories[Math.floor(Math.random() * factories.length)].click({ timeout: 2000 }).catch(() => {})
        await delay(400)
        const validHexes = await page.locator('[data-valid="true"], [data-testid="hex-valid"]').all()
        if (validHexes.length > 0) {
          await validHexes[Math.floor(Math.random() * validHexes.length)].click({ timeout: 2000 }).catch(() => {})
          await delay(300)
          return 'placed-element'
        }
      }
    }

    const offerCards = await page.locator('[data-offer] [class*="card"], [data-testid="card-offer"]').all()
    if (offerCards.length > 0) {
      await offerCards[Math.floor(Math.random() * offerCards.length)].click({ timeout: 2000 }).catch(() => {})
      await delay(300)
      return 'drew-card'
    }

    return 'no-action'
  } catch (err) {
    errors.push({ turn, type: 'action-error', message: err.message.slice(0, 100) })
    return 'error'
  }
}

async function dismissTutorial(page, label) {
  const tutorialSelectors = [
    '[data-testid="tutorial-skip"]',
    '[data-testid="tutorial-dismiss"]',
    'button:has-text("Start building the civilization")',
    'button:has-text(/skip|got it/i)',
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

// Poll BOTH player pages to detect the active turn.
// Do NOT assume alternation — seat assignment is DB-driven.
// BotAlpha might be seat 1 (goes second), BotBeta seat 0 (first).
async function detectActiveTurn(p1, p2) {
  const TURN_SELECTORS = [
    '[data-my-turn="true"]',  // T1 S11: persistent attr on game root · no timing issue
    '.my-turn-badge',         // T1 S9: CSS class · conditionally mounted
    'text=/your turn/i',      // Fallback text match
  ]

  for (const sel of TURN_SELECTORS) {
    const p1Active = await p1.locator(sel).first()
      .isVisible({ timeout: 1800 }).catch(() => false)
    if (p1Active) return { page: p1, label: 'p1' }

    const p2Active = await p2.locator(sel).first()
      .isVisible({ timeout: 1800 }).catch(() => false)
    if (p2Active) return { page: p2, label: 'p2' }
  }

  return null
}

// Extract room code from the lobby page with multiple fallback strategies.
// v4.1 FIX: restore the [style*="letter-spacing"] selector that matched in production.
// The room code in NeoTopia lobby is a letter-spaced monospace element (copy-button UI).
async function extractRoomCode(page) {
  // Strategy 1: known class names (most reliable when present)
  const classSelectors = [
    '[class*="room-code"]',
    '[class*="roomCode"]',
    '[class*="RoomCode"]',
    '[data-testid="room-code"]',
  ]
  for (const sel of classSelectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 2000 })
      const text = (await el.textContent()).trim().replace(/\s/g, '')
      const match = text.match(/[A-Z0-9]{4,6}/)
      if (match) return match[0]
    } catch { /* continue */ }
  }

  // Strategy 2: letter-spacing style (matched AZRHUE in production — DO NOT REMOVE)
  try {
    const el = await page.waitForSelector(
      '[style*="letter-spacing"][style*="monospace"], [style*="letter-spacing"] code, [style*="letter-spacing"] span',
      { timeout: 3000 }
    )
    const text = (await el.textContent()).trim().replace(/\s/g, '')
    const match = text.match(/[A-Z0-9]{4,6}/)
    if (match) return match[0]
  } catch { /* continue */ }

  // Strategy 3: <code> tag
  try {
    const el = await page.waitForSelector('code', { timeout: 2000 })
    const text = (await el.textContent()).trim().replace(/\s/g, '')
    const match = text.match(/[A-Z0-9]{4,6}/)
    if (match) return match[0]
  } catch { /* continue */ }

  // Strategy 4: scan ALL visible text for a 6-char uppercase alphanumeric code
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

  // Strategy 5: URL may contain the code after room creation
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

  try {
    const p1 = await enterLobby(ctx1, `BotAlpha${gameNum}_${tag}`)
    const p2 = await enterLobby(ctx2, `BotBeta${gameNum}_${tag}`)

    const createBtn = await p1.waitForSelector(
      'button:has-text("Create Room"), button:has-text("Create")',
      { timeout: 10000 }
    )
    await createBtn.click()
    await delay(1800) // extra time for room creation DB write
    log(`[BotAlpha${gameNum}] Created room`)

    const roomCode = await extractRoomCode(p1)
    if (!roomCode || roomCode.length < 4) {
      errors.push({ turn: 0, type: 'room-code-not-visible', message: 'All 5 extraction strategies failed — room code UI needs data-testid="room-code"' })
      throw new Error(`Bad room code: "${roomCode}"`)
    }
    log(`Room code: ${roomCode}`)

    const joinBtn = await p2.waitForSelector(
      'button:has-text("Join Room"), button:has-text("Join")',
      { timeout: 8000 }
    )
    await joinBtn.click()
    await delay(500)
    const codeInput = await p2.waitForSelector(
      'input[maxlength="6"], input[placeholder*="code" i], input[placeholder*="room" i]',
      { timeout: 5000 }
    )
    await codeInput.fill(roomCode)
    await p2.locator('button:has-text("Join")').last().click()
    await delay(1000)
    log(`[BotBeta${gameNum}] Joined ${roomCode}`)

    // Ready up (soft-fail — host may not have a Ready button in some lobby states)
    const readySelectors = ['[data-testid="ready-btn"]', 'button:has-text("Ready")', 'button:has-text("I\'m Ready")']
    for (const page of [p1, p2]) {
      for (const sel of readySelectors) {
        const btn = page.locator(sel).first()
        if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
          await btn.click().catch(e => errors.push({ turn: 0, type: 'ready-failed', message: e.message.slice(0, 80) }))
          await delay(300)
          break
        }
      }
    }
    await delay(1000)

    await p1.locator('button:has-text("Start")').click({ timeout: 6000 }).catch(e =>
      errors.push({ turn: 0, type: 'start-failed', message: e.message.slice(0, 80) })
    )

    await p1.waitForURL(/\/game\//, { timeout: 15000 })
    await p2.waitForURL(/\/game\//, { timeout: 15000 })
    log('Both on game board')
    await delay(800)

    // Dismiss tutorial for BOTH players in parallel
    const [t1ok, t2ok] = await Promise.all([
      dismissTutorial(p1, 'host'),
      dismissTutorial(p2, 'joiner'),
    ])
    if (!t1ok && !t2ok) {
      errors.push({ turn: 0, type: 'no-tutorial', message: 'Tutorial not dismissable for either player' })
    }
    await delay(500)

    // Play turns — poll BOTH pages for the active turn (v4 core fix)
    let turn = 0, gameEnded = false, stuckCount = 0

    while (turn < TURN_LIMIT && !gameEnded) {
      const active = await detectActiveTurn(p1, p2)

      if (!active) {
        stuckCount++
        if (stuckCount > 30) {
          errors.push({ turn, type: 'stuck-state', message: `No player has turn after extended wait at turn ${turn}` })
          stuckCount = 0
          turn++
        }
        await delay(400)
        continue
      }

      stuckCount = 0
      const { page: activePage, label } = active

      for (let a = 0; a < 3; a++) {
        const action = await doRandomAction(activePage, turn, errors)
        moves.push({ turn, action, player: label })
        await delay(250)
      }

      await activePage.locator('[data-testid="end-turn-btn"], button:has-text("End Turn")').first()
        .click({ timeout: 3000 }).catch(() => {})
      await delay(800)

      turn++
      const placedSoFar = moves.filter(m => m.action === 'placed-element').length
      log(`Turn ${turn} · ${label} · placed:${placedSoFar}`)

      const finished = await p1.locator('text=/final score|civilization complete|2055/i')
        .isVisible({ timeout: 500 }).catch(() => false)
      if (finished) { log(`Game ${gameNum} complete at turn ${turn}`); gameEnded = true }
    }

    const placed = moves.filter(m => m.action === 'placed-element').length
    const drew = moves.filter(m => m.action === 'drew-card').length
    log(`Game ${gameNum}: ${turn} turns · placed ${placed} · drew ${drew} · ${errors.length} errors`)

    return { game: gameNum, completed: gameEnded, turns: turn,
      duration: Math.round((Date.now() - start) / 1000),
      errors: errors.length, placedElements: placed, drewCards: drew, errorList: errors }

  } catch (err) {
    errors.push({ turn: -1, type: 'fatal', message: err.message.slice(0, 200) })
    return { game: gameNum, completed: false, errors: errors.length + 1, errorList: errors, fatal: err.message.slice(0, 100) }
  } finally {
    await ctx1.close().catch(() => {})
    await ctx2.close().catch(() => {})
  }
}

async function main() {
  log(`NeoTopia Bot Simulation v4.1 · ${NUM_GAMES} games · ${BASE}`)
  log('v4: both-page turn detection · v4.1: restored room-code selector + 5-strategy extraction')
  mkdirSync('.bot-reports', { recursive: true })

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 300 : 0 })
  const allResults = []
  for (let g = 1; g <= NUM_GAMES; g++) {
    allResults.push(await playGame(g, browser))
    await delay(2000)
  }
  await browser.close()

  const report = {
    timestamp: new Date().toISOString(), url: BASE, botVersion: 'v4.1',
    results: allResults,
    summary: {
      completed: allResults.filter(r => r.completed).length,
      totalErrors: allResults.reduce((s, r) => s + r.errors, 0),
      gamesWithPlacement: allResults.filter(r => r.placedElements > 0).length,
      totalPlaced: allResults.reduce((s, r) => s + (r.placedElements || 0), 0),
      totalDrew: allResults.reduce((s, r) => s + (r.drewCards || 0), 0),
      errorTypes: allResults.flatMap(r => r.errorList || [])
        .reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc }, {}),
    },
  }

  const reportPath = `.bot-reports/report-${Date.now()}.json`
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('\n=== BOT SIMULATION REPORT (v4.1) ===')
  console.log(`Games completed: ${report.summary.completed}/${NUM_GAMES}`)
  console.log(`Total errors: ${report.summary.totalErrors}`)
  console.log(`Games with element placement: ${report.summary.gamesWithPlacement}/${NUM_GAMES}`)
  console.log(`Elements placed: ${report.summary.totalPlaced} · Cards drawn: ${report.summary.totalDrew}`)
  console.log('Error types:', report.summary.errorTypes)
  console.log(`Report: ${reportPath}`)
  if (report.summary.totalErrors > 0) {
    console.log('\nCRITICAL BUGS:')
    allResults.flatMap(r => r.errorList || []).slice(0, 15)
      .forEach(e => console.log(` [${e.type}] ${e.message || ''}`))
  }
}

main().catch(err => { console.error('Bot failed:', err.message); process.exit(1) })
