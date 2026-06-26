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
// T1 S9 UPDATE: data-testid attrs now in game · selectors updated below
// Bot still fatals at Join Room claim flow (lobby username step) — see enterLobby()

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'

const BASE = process.env.BOT_URL || 'http://localhost:5173'
const NUM_GAMES = parseInt(process.env.BOT_GAMES || '3')
const TURN_LIMIT = parseInt(process.env.BOT_TURNS || '30')
const HEADED = process.env.BOT_HEADED === '1'

const log = (...args) => console.log(new Date().toISOString().slice(11,19), ...args)
const delay = ms => new Promise(r => setTimeout(r, ms))

// Navigate through landing page and handle the claim/username flow
async function enterLobby(ctx, username) {
  const page = await ctx.newPage()
  await page.goto(BASE)
  await delay(1500)

  // Handle Landing page (’Enter the Civilization' CTA)
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

  // Handle username claim step (may appear after landing or on lobby)
  // Try multiple selectors that cover the claim flow after T1 S8 rework
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

  // If we're at /lobby, we're good. If not, try navigating there.
  if (!page.url().includes('lobby')) {
    await delay(500)
  }

  return page
}

async function doRandomAction(page, turn, errors) {
  try {
    // 70% chance to place element (the action new players miss)
    if (Math.random() < 0.7) {
      // T1 S9: data-testid="factory" now in DOM — use it
      const factories = await page.locator('[data-testid="factory"], [data-factory]').all()
      if (factories.length > 0) {
        await factories[Math.floor(Math.random() * factories.length)].click({ timeout: 2000 }).catch(() => {})
        await delay(400)
        // T1 S9: data-valid="true" in DOM for valid hexes
        const validHexes = await page.locator('[data-valid="true"], [data-testid="hex-valid"]').all()
        if (validHexes.length > 0) {
          await validHexes[Math.floor(Math.random() * validHexes.length)].click({ timeout: 2000 }).catch(() => {})
          await delay(300)
          return 'placed-element'
        }
      }
    }

    // Draw a card from The Offer
    // T1 S9: [data-offer] preserved on the offer container
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

async function playGame(gameNum, browser) {
  log(`=== GAME ${gameNum} START ===`)
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const errors = []
  const moves = []
  const start = Date.now()

  try {
    const p1 = await enterLobby(ctx1, `BotAlpha${gameNum}`)
    const p2 = await enterLobby(ctx2, `BotBeta${gameNum}`)

    // p1 creates room
    const createBtn = await p1.waitForSelector(
      'button:has-text("Create Room"), button:has-text("Create")',
      { timeout: 10000 }
    )
    await createBtn.click()
    await delay(1500)
    log(`[BotAlpha${gameNum}] Created room`)

    // Extract room code
    let roomCode = null
    try {
      const codeEl = await p1.waitForSelector(
        '[class*="room-code"], [class*="roomCode"], code, [style*="letter-spacing"][style*="monospace"]',
        { timeout: 6000 }
      )
      const raw = (await codeEl.textContent()).trim().replace(/\s/g, '')
      roomCode = raw.match(/[A-Z0-9]{4,6}/)?.[0] || raw.slice(0, 6)
      log(`Room code: ${roomCode}`)
    } catch {
      const match = p1.url().match(/[A-Z0-9]{6}/)
      if (match) roomCode = match[0]
      errors.push({ turn: 0, type: 'room-code-not-visible', message: 'Room code display missing — UX bug · needs copy button with data-testid' })
    }
    if (!roomCode || roomCode.length < 4) throw new Error(`Bad room code: "${roomCode}"`)

    // p2 joins
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

    // Ready up — T1 S10: data-testid="ready-btn" expected
    const readySelectors = ['[data-testid="ready-btn"]', 'button:has-text("Ready")', 'button:has-text("I\'m Ready")']
    for (const sel of readySelectors) {
      const btn1 = p1.locator(sel).first()
      if (await btn1.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn1.click().catch(e => errors.push({ turn:0, type:'ready-failed', message: e.message.slice(0,80) }))
        break
      }
    }
    for (const sel of readySelectors) {
      const btn2 = p2.locator(sel).first()
      if (await btn2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn2.click().catch(e => errors.push({ turn:0, type:'ready-failed', message: e.message.slice(0,80) }))
        break
      }
    }
    await delay(800)

    // Start game
    await p1.locator('button:has-text("Start")').click({ timeout: 6000 }).catch(e =>
      errors.push({ turn:0, type:'start-failed', message: e.message.slice(0,80) })
    )

    await p1.waitForURL(/\/game\//, { timeout: 15000 })
    await p2.waitForURL(/\/game\//, { timeout: 15000 })
    log('Both on game board')

    // Handle tutorial overlay — T1 S10: data-testid="tutorial-dismiss" expected
    const tutorialSelectors = [
      '[data-testid="tutorial-dismiss"]',
      '[data-testid="tutorial-skip"]',
      'button:has-text("Start building the civilization")',
      'button:has-text(/got it|skip/i)',
    ]
    let tutorialFound = false
    for (const sel of tutorialSelectors) {
      const btn = p1.locator(sel).first()
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click().catch(() => {})
        tutorialFound = true
        log('Tutorial dismissed')
        break
      }
    }
    if (!tutorialFound) {
      errors.push({ turn: 0, type: 'no-tutorial', message: 'Tutorial not found — T1 S10 must fix gate (decouple from isMyTurn)' })
    }

    // Play turns
    let turn = 0, gameEnded = false, stuckCount = 0
    while (turn < TURN_LIMIT && !gameEnded) {
      const activePage = turn % 2 === 0 ? p1 : p2
      // T1 S9: data-testid="my-turn-badge" in DOM
      const isMyTurn = await activePage.locator(
        '[data-testid="my-turn-badge"], text=/your turn/i'
      ).first().isVisible({ timeout: 800 }).catch(() => false)

      if (!isMyTurn) {
        stuckCount++
        if (stuckCount > 30) {
          errors.push({ turn, type: 'stuck-state', message: `No turn detected at turn ${turn}` })
          stuckCount = 0; turn++
        }
        await delay(400)
        continue
      }
      stuckCount = 0

      for (let a = 0; a < 3; a++) {
        const action = await doRandomAction(activePage, turn, errors)
        moves.push({ turn, action })
        await delay(250)
      }
      // T1 S9: data-testid="end-turn-btn" in DOM
      await activePage.locator('[data-testid="end-turn-btn"], button:has-text("End Turn")').first()
        .click({ timeout: 3000 }).catch(() => {})
      await delay(700)
      turn++

      const finalScore = await p1.locator('text=/2055|civilization complete/i').isVisible({ timeout: 500 }).catch(() => false)
      if (finalScore) { log(`Game complete at turn ${turn}`); gameEnded = true }
    }

    const placed = moves.filter(m => m.action === 'placed-element').length
    const drew = moves.filter(m => m.action === 'drew-card').length
    log(`Game ${gameNum}: ${turn} turns · placed ${placed} · drew ${drew} · ${errors.length} errors`)
    return { game: gameNum, completed: gameEnded, turns: turn, duration: Math.round((Date.now()-start)/1000), errors: errors.length, placedElements: placed, drewCards: drew, errorList: errors }

  } catch (err) {
    errors.push({ turn: -1, type: 'fatal', message: err.message.slice(0, 200) })
    return { game: gameNum, completed: false, errors: errors.length + 1, errorList: errors, fatal: err.message.slice(0, 100) }
  } finally {
    await ctx1.close().catch(() => {})
    await ctx2.close().catch(() => {})
  }
}

async function main() {
  log(`NeoTopia Bot Simulation · ${NUM_GAMES} games · ${BASE}`)
  mkdirSync('.bot-reports', { recursive: true })

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 300 : 0 })
  const allResults = []
  for (let g = 1; g <= NUM_GAMES; g++) {
    allResults.push(await playGame(g, browser))
    await delay(2000)
  }
  await browser.close()

  const report = {
    timestamp: new Date().toISOString(),
    url: BASE,
    results: allResults,
    summary: {
      completed: allResults.filter(r => r.completed).length,
      totalErrors: allResults.reduce((s,r) => s + r.errors, 0),
      gamesWithPlacement: allResults.filter(r => r.placedElements > 0).length,
      totalPlaced: allResults.reduce((s,r) => s + (r.placedElements||0), 0),
      totalDrew: allResults.reduce((s,r) => s + (r.drewCards||0), 0),
      errorTypes: allResults.flatMap(r => r.errorList||[]).reduce((acc,e) => { acc[e.type]=(acc[e.type]||0)+1; return acc }, {}),
    }
  }
  const reportPath = `.bot-reports/report-${Date.now()}.json`
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('\n=== BOT SIMULATION REPORT ===')
  console.log(`Games: ${report.summary.completed}/${NUM_GAMES}`)
  console.log(`Errors: ${report.summary.totalErrors}`)
  console.log(`Placed: ${report.summary.totalPlaced} · Drew: ${report.summary.totalDrew}`)
  console.log('Error types:', report.summary.errorTypes)
  console.log(`Report: ${reportPath}`)
}

main().catch(err => { console.error('Bot failed:', err.message); process.exit(1) })
